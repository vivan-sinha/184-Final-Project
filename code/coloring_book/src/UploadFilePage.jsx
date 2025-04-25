import React, { useRef, useState } from 'react';
import { extractRegions } from './ExtractRegions';
import { ExampleTransformation } from './ExampleTranformation';

export default function UploadFilePage({ onComplete }) {
  const [colors, setColors] = useState([]);
  const [regionMap, setRegionMap] = useState([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [SMALL_REGION_THRESHOLD, set_SMALL_REGION_THRESHOLD] = useState(50);
  const canvasRef = useRef();
  const fileInputRef = useRef();

  const processImageFromCanvas = (canvas, filename) => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      setImageDimensions({ width: img.width, height: img.height });

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      
      // Whatever other image processing kuwahara, kmeans, etc.
      // ExampleTransformation(ctx, img); // FLIP COLORS

      extractRegions(
        ctx,
        setColors,
        setRegionMap,
        SMALL_REGION_THRESHOLD,
        onComplete,
        img,
        filename
      );
    };
    img.src = canvas.toDataURL();
  };

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
            processImageFromCanvas(canvas, file.name);
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
      img.onload = () => {
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        setImageDimensions({ width: img.width, height: img.height });
        
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        processImageFromCanvas(canvas, file.name);
      };
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
