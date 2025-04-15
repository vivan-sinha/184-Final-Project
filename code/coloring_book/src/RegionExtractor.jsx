import React, { useRef, useState } from 'react';

export default function RegionExtractor({ onComplete }) {
  const [colors, setColors] = useState([]);
  const [regionMap, setRegionMap] = useState({});
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const canvasRef = useRef();
  const fileInputRef = useRef();

  const handleFile = (file) => {
    const img = new Image();
    img.onload = () => processImage(img, file.name);
    img.src = URL.createObjectURL(file);
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

  const colorToHex = (r, g, b) =>
    "#" + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

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
  
    setColors(colors);
    setRegionMap(regions);
  
    if (onComplete) {
      onComplete(colors, regions, originalFilename, {
        width: img.width,
        height: img.height,
      });
    }
  };
  

  return (
    <div className="flex flex-col h-[100vh] items-center justify-center p-6 space-y-20">
      <h1 className="text-6xl font-semibold">Region Extractor</h1>

      <div
        className="flex flex-col items-center justify-center w-[75vw] h-40 align-middle border-4 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <p className="text-gray-600 text-2xl">Click or drag and drop an image here to upload</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
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
                ${Object.entries(regionMap).map(
                ([name, set]) =>
                    `  ${name}: new Set([
                    ${Array.from(set).slice(0, 10).join(", ")}${
                    set.size > 10 ? ", ..." : ""
                    }
                ]),`
                ).join("\n")}
            };`}
          </pre>
        </>
      )}
    </div>
  );
}
