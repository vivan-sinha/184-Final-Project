import React, { useRef, useState, useEffect } from "react";

export default function DrawingPage(props) {
  // Destructure props to extract necessary data
  const { FILENAME, COLORS, REGION_MAP, DIMENSIONS } = props;

  // Refs for various canvas elements and containers
  const canvasRef = useRef(null);
  const highlightRef = useRef(null);
  const cursorRef = useRef(null);
  const paletteRef = useRef(null);
  const canvasWrapperRef = useRef(null);

  // State variables for managing drawing, selected region, brush width, etc.
  const [drawing, setDrawing] = useState(false); // Tracks if the user is currently drawing
  const [currentColor, setCurrentColor] = useState(null); // Currently selected color
  const [selectedRegion, setSelectedRegion] = useState(null); // Currently selected region
  const [brushWidth, setBrushWidth] = useState(10); // Width of the brush
  const [showOutlines, setShowOutlines] = useState(true); // Whether to show region outlines
  const [lastPoint, setLastPoint] = useState(null); // Last point drawn on the canvas

  // Initialize the base canvas with a white background
  useEffect(() => {
    const baseCanvas = canvasRef.current;
    baseCanvas.width = DIMENSIONS.width;
    baseCanvas.height = DIMENSIONS.height;
    const baseCtx = baseCanvas.getContext("2d");
    baseCtx.fillStyle = "#ffffff";
    baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
  }, [DIMENSIONS]);

  // Highlight selected region or show outlines for all regions
  useEffect(() => {
    const highlightCanvas = highlightRef.current;
    highlightCanvas.width = DIMENSIONS.width;
    highlightCanvas.height = DIMENSIONS.height;

    const ctx = highlightCanvas.getContext("2d");
    ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);

    // Helper function to determine if a pixel is a border pixel
    const isBorderPixel = (region, x, y) => {
      const key = `${x},${y}`;
      if (!region.has(key)) return false;
      const neighbors = [
        `${x - 1},${y}`, `${x + 1},${y}`,
        `${x},${y - 1}`, `${x},${y + 1}`
      ];
      return neighbors.some(n => !region.has(n));
    };

    if (selectedRegion) {
      const region = REGION_MAP.find(r => r.name === selectedRegion);

      ctx.fillStyle = "black";
      region.pixels.forEach((key) => {
        const [x, y] = key.split(",").map(Number);
        if (isBorderPixel(region.pixels, x, y)) {
          ctx.fillRect(x, y, 1, 1);
        }
      });

      ctx.fillStyle = "rgba(128,128,128,0.8)";
      for (let x = 0; x < highlightCanvas.width; x++) {
        for (let y = 0; y < highlightCanvas.height; y++) {
          if (!region.pixels.has(`${x},${y}`)) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }

    } else if (showOutlines) {
      ctx.fillStyle = "black";
      REGION_MAP.forEach(({ pixels }) => {
        pixels.forEach((key) => {
          const [x, y] = key.split(",").map(Number);
          if (isBorderPixel(pixels, x, y)) {
            ctx.fillRect(x, y, 1, 1);
          }
        });
      });

      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      REGION_MAP.forEach(({ pixels, colorNum }) => {
        let sumX = 0, sumY = 0, count = 0;
        pixels.forEach(key => {
          const [x, y] = key.split(",").map(Number);
          sumX += x;
          sumY += y;
          count++;
        });
        const centerX = Math.round(sumX / count);
        const centerY = Math.round(sumY / count);

        // translucent background circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fill();

        // label text
        ctx.fillStyle = "black";
        const offsetY = 1; // text was being rendered a little too high
        ctx.fillText(colorNum.toString(), centerX, centerY + offsetY);
      });
    }
  }, [selectedRegion, showOutlines, REGION_MAP, DIMENSIONS]);

  // Initialize the cursor canvas
  useEffect(() => {
    const cursorCanvas = cursorRef.current;
    cursorCanvas.width = DIMENSIONS.width;
    cursorCanvas.height = DIMENSIONS.height;
  }, [DIMENSIONS]);

  // Handle clicks outside the canvas and palette
  useEffect(() => {
    const handleClickOutside = (e) => {
      const isOutsideCanvas = canvasWrapperRef.current && !canvasWrapperRef.current.contains(e.target);
      const isOutsidePalette = paletteRef.current && !paletteRef.current.contains(e.target);
  
      const clickedOutside = isOutsideCanvas && isOutsidePalette;
  
      if (clickedOutside && !drawing) {
        if (selectedRegion !== null) {
          setSelectedRegion(null);
        } else {
          setCurrentColor(null);
        }
      }
    };
  
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [drawing, selectedRegion]);

  // Draw the cursor on the canvas
  const drawCursor = (e) => {
    const canvas = cursorRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!currentColor || !selectedRegion) return;

    const [x, y] = getCursorPos(e);

    ctx.beginPath();
    ctx.arc(x, y, brushWidth / 2, 0, 2 * Math.PI);
    ctx.fillStyle = currentColor;
    ctx.globalAlpha = 0.6;
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.stroke();

    ctx.globalAlpha = 1.0; // Reset alpha
  };

  // Apply drawing to the selected region using a mask
  const applyMaskedDrawing = (drawCallback, boundingBox = null) => {
    const mainCanvas = canvasRef.current;
    const [width, height] = [mainCanvas.width, mainCanvas.height];
    const mainCtx = mainCanvas.getContext("2d");

    const offCanvas = document.createElement("canvas");
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext("2d");

    offCtx.drawImage(mainCanvas, 0, 0);
    drawCallback(offCtx);

    const region = REGION_MAP.find(r => r.name === selectedRegion);
    const newPixels = offCtx.getImageData(0, 0, width, height);
    const oldPixels = mainCtx.getImageData(0, 0, width, height);

    const [minX, minY, maxX, maxY] = boundingBox || [0, 0, width, height];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = (y * width + x) * 4;
        if (region.pixels.has(`${x},${y}`)) {
          oldPixels.data[i + 0] = newPixels.data[i + 0];
          oldPixels.data[i + 1] = newPixels.data[i + 1];
          oldPixels.data[i + 2] = newPixels.data[i + 2];
          oldPixels.data[i + 3] = newPixels.data[i + 3];
        }
      }
    }

    mainCtx.putImageData(oldPixels, 0, 0);
  };

  // Start drawing on the canvas
  const startDraw = (e) => {
    const [x, y] = getCursorPos(e);
    if (selectedRegion) {
      if (inSelectedRegion(x, y)) {
        if (!currentColor) return; 
        setDrawing(true);
        setLastPoint([x, y]);
        drawDot(x, y);
      } else {
        setSelectedRegion(null);
      }
    } else {
      for (const region of REGION_MAP) {
        if (region.pixels.has(`${x},${y}`)) {
          setSelectedRegion(region.name);
          break;
        }
      }
    }
  };

  // End drawing on the canvas
  const endDraw = () => {
    setDrawing(false);
    setLastPoint(null);
  };

  // Draw a line on the canvas
  const draw = (e) => {
    if (!drawing || !lastPoint || !currentColor) return;

    // Get the current cursor position
    const [x, y] = getCursorPos(e);

    // Ensure the cursor is within the selected region
    if (!inSelectedRegion(x, y)) return;

    // Get the last cursor position
    const [lastX, lastY] = lastPoint;

    // Calculate the bounding box for the brush stroke
    const r = Math.ceil(brushWidth / 2);
    const minX = Math.max(0, Math.min(lastX, x) - r);
    const maxX = Math.min(canvasRef.current.width - 1, Math.max(lastX, x) + r);
    const minY = Math.max(0, Math.min(lastY, y) - r);
    const maxY = Math.min(canvasRef.current.height - 1, Math.max(lastY, y) + r);

    // Apply the drawing to the canvas within the bounding box
    applyMaskedDrawing((ctx) => {
      ctx.lineWidth = brushWidth; // Set the brush width
      ctx.lineCap = "round"; // Use rounded edges for the brush
      ctx.strokeStyle = currentColor;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY); // Start from the last cursor position
      ctx.lineTo(x, y); // Draw a line to the current cursor position
      ctx.stroke();
    }, [minX, minY, maxX, maxY]);

    // Update the last cursor position
    setLastPoint([x, y]);
  };

  // Draw a dot on the canvas
  const drawDot = (x, y) => {
    // Calculate the bounding box for the dot
    const r = Math.ceil(brushWidth / 2);
    const minX = Math.max(0, x - r);
    const maxX = Math.min(canvasRef.current.width - 1, x + r);
    const minY = Math.max(0, y - r);
    const maxY = Math.min(canvasRef.current.height - 1, y + r);

    // Apply the drawing to the canvas within the bounding box
    applyMaskedDrawing((ctx) => {
      ctx.beginPath();
      ctx.arc(x, y, brushWidth / 2, 0, 2 * Math.PI);
      ctx.fillStyle = currentColor;
      ctx.fill();
    }, [minX, minY, maxX, maxY]);
  };

  // Get the cursor position relative to the canvas
  const getCursorPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    return [x, y];
  };

  // Check if a point is inside the selected region
  const inSelectedRegion = (x, y) => {
    if (!selectedRegion) return false;
    const region = REGION_MAP.find(r => r.name === selectedRegion);
    return region && region.pixels.has(`${x},${y}`);
  };

  // Render the drawing page UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-semibold mb-4">{FILENAME}</h1>

      {/* Display selected region or prompt to select one */}
      {selectedRegion ? (
        <p className="mb-2 text-lg font-medium text-gray-700">
          Region Color: <span className="text-blue-600">{REGION_MAP.filter(r => r.name === selectedRegion)[0].colorNum}</span>
        </p>
      ) : (
        <p className="mb-2 text-lg font-medium text-gray-500 italic">
          No region selected — click inside one to begin
        </p>
      )}

      {/* Brush width controls */}
      <div className="flex flex-col items-center w-full max-w-6xl mb-6">
        <div className="flex items-center justify-center gap-4">
          <label htmlFor="brushWidth" className="text-lg">Brush Width:</label>
          <input
            id="brushWidth"
            type="range"
            min="1"
            max="50"
            value={brushWidth}
            onChange={(e) => setBrushWidth(Number(e.target.value))}
            className="w-40"
          />
          <div>
          <input
            type="number"
            min="1"
            max="100"
            value={brushWidth}
            onChange={(e) => {
              const val = Math.max(1, Math.min(500, Number(e.target.value)));
              setBrushWidth(val);
            }}
            className="ml-2 w-auto text-center border border-black/10 rounded py-0.5 mr-0.5 no-spinner"
          />
          <span className="text-md">px</span></div>
        </div>
      </div>

      {/* Canvas and palette */}
      <div className="flex flex-row gap-6 w-full max-w-6xl justify-center items-center">
        <div
          ref={canvasWrapperRef}
          className={`relative bg-white border-2 border-gray-300 rounded shadow-lg ${selectedRegion? (currentColor ? "cursor-none" : "cursor-not-allowed") : "cursor-pointer"}`}
          style={{ width: DIMENSIONS.width, height: DIMENSIONS.height }}
        >
          {/* Toggle outlines button */}
          {!selectedRegion && (
            <button
              onClick={() => setShowOutlines(prev => !prev)}
              className="absolute top-2 right-2 z-30 bg-white/80 border border-gray-400 rounded px-3 py-1 text-sm shadow hover:bg-white"
            >
              {showOutlines ? "Hide Outlines" : "Show Outlines"}
            </button>
          )}

          {/* Main canvas */}
          <canvas
            ref={canvasRef}
            style={{ width: `${DIMENSIONS.width}px`, height: `${DIMENSIONS.height}px` }}
            className="absolute top-0 left-0 z-0"
            onMouseDown={startDraw}
            onMouseUp={endDraw}
            onMouseMove={(e) => { draw(e); drawCursor(e); }}
            onMouseLeave={(e) => {
              endDraw();
              cursorRef.current.getContext("2d").clearRect(0, 0, DIMENSIONS.width, DIMENSIONS.height);
            }}
          />
          {/* Highlight canvas */}
          <canvas
            ref={highlightRef}
            style={{ width: `${DIMENSIONS.width}px`, height: `${DIMENSIONS.height}px` }}
            className="absolute top-0 left-0 z-10 pointer-events-none"
          />
          {/* Cursor canvas */}
          <canvas
            ref={cursorRef}
            style={{ width: `${DIMENSIONS.width}px`, height: `${DIMENSIONS.height}px`, cursor: "none" }}
            className="absolute top-0 left-0 z-20 pointer-events-none"
          />
        </div>

        {/* Color palette */}
        <div ref={paletteRef} className="flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold mb-2">Colors:</h2>
          <div className="flex flex-col items-center">
            {COLORS.map((color, index) => {
              const isSelected = color === currentColor;
              return (
                <div
                  key={color}
                  onClick={() => setCurrentColor(color)}
                  className="w-12 h-15 rounded-full my-1 cursor-pointer border-2 flex items-center justify-center text-2xl relative overflow-hidden"
                  style={{
                    backgroundColor: color,
                    borderColor: isSelected ? 'black' : 'transparent',
                    opacity: isSelected || currentColor === null ? 1 : 0.4,
                  }}
                >
                  <span className="text-2xl bg-white/40 rounded-full px-2">{index}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
