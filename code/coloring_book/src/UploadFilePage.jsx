import React, { useRef, useState } from 'react';
import { extractRegions } from './ExtractRegions';
import { ExampleTransformation } from './ExampleTranformation';
import { KMeansTransformation } from './KMeansTransformation';
import { KuwaharaFilter } from './KuwaharaFilter';
import { GaussianBlur } from './KuwaharaFilter';

export default function UploadFilePage({ onComplete }) {
  const [colors, setColors] = useState([]);
  const [regionMap, setRegionMap] = useState([]);
  // const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [SMALL_REGION_THRESHOLD, set_SMALL_REGION_THRESHOLD] = useState(50);
  const [numColors, setNumColors] = useState(5);
  const canvasRef = useRef();
  const fileInputRef = useRef();
  const [uploadedFile, setUploadedFile] = useState(null);
  const [imageState, setImageState] = useState(null);
  const [filenameState, setFilenameState] = useState(null);
  const [canStartProcessing, setCanStartProcessing] = useState(false);
  const [canStartDrawing, setCanStartDrawing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('')

  const delayWithDraw = async (ms) => {
    await new Promise(requestAnimationFrame);
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  const processImageFromCanvas = async (canvas, filename) => {
    setCanStartProcessing(false);
    setCanStartDrawing(false);
    setImageState(null);
    const img = new Image();
    img.onload = async () => {
      const ctx = canvasRef.current.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      // setImageDimensions({ width: img.width, height: img.height });

      ctx.drawImage(img, 0, 0);
      setCurrentStatus('Applying Kuwahara Filter...')
      await delayWithDraw(100);

      KuwaharaFilter(ctx, img.width, img.height);
      setCurrentStatus('Blurring Edges...')
      await delayWithDraw(800);

      GaussianBlur(ctx, img.width, img.height, 2);
      setCurrentStatus('Clustering Colors...')
      await delayWithDraw(800);

      KMeansTransformation(ctx, img, numColors);
      await delayWithDraw(800);

      // extractRegions(
      //   ctx,
      //   setColors,
      //   setRegionMap,
      //   SMALL_REGION_THRESHOLD,
      //   onComplete,
      //   img,
      //   filename
      // );

      setCurrentStatus('Done!')
      setImageState(img);
      setFilenameState(filename);
      setCanStartDrawing(true); 
    };
    img.src = canvas.toDataURL();
  };

  const handleFile = (file) => {
    setUploadedFile(file);
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
            // setImageDimensions({ width, height });

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

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
      };
      img.src = URL.createObjectURL(file);
    }

    setCanStartProcessing(true);
    setCanStartDrawing(false);
    setCurrentStatus('')
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


  const startDrawing = () => {
    const ctx = canvasRef.current.getContext("2d")
    extractRegions(
      ctx,
      setColors,
      setRegionMap,
      SMALL_REGION_THRESHOLD,
      onComplete,
      imageState,
      filenameState
    );
  }

  return (
    <div className="flex h-[100vh] w-full p-6">
      {/* Left side */}
      <div className="w-1/3 pr-6 flex flex-col space-y-6">
        <h1 className="text-5xl font-semibold">Region Extractor</h1>

        <div className="flex gap-6">
          <label>
            Small Region Threshold:
            <input
              type="number"
              min={1}
              max={200}
              value={SMALL_REGION_THRESHOLD}
              onChange={(e) =>
                set_SMALL_REGION_THRESHOLD(Math.max(1, Math.min(200, Number(e.target.value))))
              }
              className="no-spinner ml-2 border-b outline-0 text-center"
            />
          </label>

          <label>
            Number of Colors:
            <input
              type="number"
              min={-1}
              max={30}
              value={numColors}
              onChange={(e) =>
                setNumColors(Math.max(-1, Math.min(256, Number(e.target.value))))
              }
              className="no-spinner ml-2 border-b outline-0 text-center"
            />
          </label>
        </div>
        
        <div className='h-full flex flex-col items-center justify-items-center justify-center space-y-15'>
          <div
            className="flex flex-col items-center justify-center h-[60vh] border-4 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <p className="text-gray-600 text-xl">Click or drag-and-drop an image or JSON file here</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.json"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
          <div className='flex flex-row space-x-5'>
            <button
              onClick={() => canStartProcessing && processImageFromCanvas(canvasRef.current, uploadedFile.name)}
              className={`px-6 py-2 text-white rounded-lg ${canStartProcessing? "bg-blue-600 hover:bg-blue-700": "bg-gray-500 cursor-not-allowed disabled"} transition`}
            >
              Start Processing
            </button>
            <button
              onClick={startDrawing}
              className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition ${canStartDrawing ? '' : 'hidden'}`}
            >
              Start Drawing
            </button>
          </div>
        </div>

        {colors.length > 0 && (
          <>
            <h2 className="text-lg font-bold mt-4">Extracted COLORS</h2>
            <pre className="overflow-auto max-h-40">{JSON.stringify(colors, null, 2)}</pre>

            <h2 className="text-lg font-bold mt-4">Generated REGION_MAP</h2>
            <pre className="overflow-auto max-h-40">
              {`const REGION_MAP = {
${regionMap.map(region =>
    `  ${region.name}: new Set([\n    ${Array.from(region.pixels).slice(0, 10).join(", ")}${region.pixels.size > 10 ? ", ..." : ""}\n  ]),`
  ).join("\n")}
};`}
            </pre>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="w-2/3">
        <div className='text-center'><h1 className='text-5xl font-semibold pb-5'>Preview</h1></div>
        <div className={`h-full flex flex-col justify-center items-center`}>
          {currentStatus}
          <canvas ref={canvasRef} className="border shadow-md" />
        </div>
      </div>
    </div>
  );
}
