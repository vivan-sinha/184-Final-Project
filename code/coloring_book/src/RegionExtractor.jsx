import React, { useRef, useState } from 'react';

export default function RegionExtractor({ onComplete }) {
  const [colors, setColors] = useState([]);
  const [regionMap, setRegionMap] = useState({});
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [SMALL_REGION_THRESHOLD, set_SMALL_REGION_THRESHOLD] = useState(50);
  const canvasRef = useRef();
  const fileInputRef = useRef();


  const handleFile = (file) => {
    const reader = new FileReader();
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          if (json.image) {
            const height = json.image.length;
            const width = json.image[0].length;
            const canvas = canvasRef.current;
            canvas.width = width;
            canvas.height = height;
            setImageDimensions({ width, height });

            const ctx = canvas.getContext("2d");
            const imageData = ctx.createImageData(width, height);
            const data = imageData.data;

            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const [r, g, b] = json.image[y][x];
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
              }
            }

            ctx.putImageData(imageData, 0, 0);
            const img = new Image();
            img.onload = () => processImage(img, file.name);
            img.src = canvas.toDataURL();
          } else {
            alert("JSON file must contain an 'image' key.");
          }
        } catch (err) {
          alert("Failed to parse JSON file.");
        }
      };
      reader.readAsText(file);
    } else {
      const img = new Image();
      img.onload = () => processImage(img, file.name);
      img.src = URL.createObjectURL(file);
    }
  };

  const handleImageUpload = (e) => {
    if (e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const processImage = (img, originalFilename) => {
    const canvas = canvasRef.current;
    canvas.width = img.width;
    canvas.height = img.height;
    setImageDimensions({ width: img.width, height: img.height });

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
    const visited = Array.from({ length: height }, () => Array(width).fill(false));
    const regions = [];
    const colorToIndex = {};
    const colors = [];

    const colorToHex = (r, g, b) =>
      "#" + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

    const getColorAt = (x, y) => {
      const i = (y * width + x) * 4;
      return {
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
      };
    };

    const matchColor = (c1, c2) =>
      c1.r === c2.r && c1.g === c2.g && c1.b === c2.b;

    const floodFill = (startX, startY, baseColor) => {
      const stack = [[startX, startY]];
      const pixels = new Set();

      while (stack.length > 0) {
        const [x, y] = stack.pop();
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (visited[y][x]) continue;

        const currentColor = getColorAt(x, y);
        if (!matchColor(baseColor, currentColor)) continue;

        visited[y][x] = true;
        pixels.add(`${x},${y}`);

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      return pixels;
    };

    let regionId = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (visited[y][x]) continue;

        const baseColor = getColorAt(x, y);
        const hex = colorToHex(baseColor.r, baseColor.g, baseColor.b);

        if (!(hex in colorToIndex)) {
          colorToIndex[hex] = colors.length;
          colors.push(hex);
        }

        const colorIdx = colorToIndex[hex];
        const pixels = floodFill(x, y, baseColor);
        if (pixels.size > 0) {
          regions.push({
            name: `region${regionId}`,
            pixels,
            colorNum: colorIdx,
          });
          regionId++;
        }
      }
    }

    // Merge small regions
    const pixelToRegion = {};
    regions.forEach((region, i) => {
      region.idx = i;
      region.skip = false;
      region.pixels.forEach(pixel => {
        pixelToRegion[pixel] = i;
      });
    });

    const getAdjacentRegion = (region) => {
      const neighborCounts = {};
      for (const pixel of region.pixels) {
        const [x, y] = pixel.split(",").map(Number);
        const neighbors = [
          [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
        ];
        for (const [nx, ny] of neighbors) {
          const neighborKey = `${nx},${ny}`;
          const neighborRegion = pixelToRegion[neighborKey];
          if (neighborRegion !== undefined && neighborRegion !== region.idx && !regions[neighborRegion].skip) {
            neighborCounts[neighborRegion] = (neighborCounts[neighborRegion] || 0) + 1;
          }
        }
      }
      const sorted = Object.entries(neighborCounts).sort((a, b) => b[1] - a[1]);
      return sorted.length > 0 ? parseInt(sorted[0][0]) : undefined;
    };

    for (const region of regions) {
      if (region.pixels.size < SMALL_REGION_THRESHOLD) {
        const neighborIdx = getAdjacentRegion(region);
        if (neighborIdx !== undefined) {
          for (const px of region.pixels) {
            regions[neighborIdx].pixels.add(px);
            pixelToRegion[px] = neighborIdx;
          }
          region.skip = true;
        }
      }
    }

    const mergedRegions = regions.filter(r => !r.skip).map((r, i) => ({
      name: `region${i}`,
      pixels: r.pixels,
      colorNum: r.colorNum
    }));

    setColors(colors);
    setRegionMap(mergedRegions);

    if (onComplete) {
      onComplete(colors, mergedRegions, originalFilename, {
        width: img.width,
        height: img.height,
      });
    }
  };

  return (
    <div className="flex flex-col h-[100vh] items-center justify-center p-6 space-y-10">
      <h1 className="text-6xl font-semibold">Region Extractor</h1>
      <span>Small Region Threshold: <input type="number" min={1} max={200} value={SMALL_REGION_THRESHOLD} 
            onChange={(e) => {
              const val = Math.max(1, Math.min(200, Number(e.target.value)));
              set_SMALL_REGION_THRESHOLD(val)}} className="no-spinner border-b outline-0 text-center" /></span>
      <div
        className="flex flex-col items-center justify-center w-[75vw] h-40 align-middle border-4 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <p className="text-gray-600 text-2xl">Click or drag and drop an image or JSON file here to upload</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.json"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {colors.length > 0 && (
        <>
          <h2 className="text-lg font-bold mt-4">Extracted COLORS</h2>
          <pre>{JSON.stringify(colors, null, 2)}</pre>

          <h2 className="text-lg font-bold mt-4">Generated REGION_MAP</h2>
          <pre>
            {`const REGION_MAP = {
${regionMap.map(region =>
    `  ${region.name}: new Set([\n    ${Array.from(region.pixels).slice(0, 10).join(", ")}${region.pixels.size > 10 ? ", ..." : ""}\n  ]),`
  ).join("\n")}
};`}
          </pre>
        </>
      )}
    </div>
  );
}
