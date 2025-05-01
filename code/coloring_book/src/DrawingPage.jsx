import React, { useRef, useState, useEffect } from "react";
import {useCanvas, useDrawing} from "./DrawingFunctions";

// Main component
export default function DrawingPage(props) {
  const { FILENAME, COLORS, REGION_MAP, DIMENSIONS } = props;
  const canvasWrapperRef = useRef(null);
  const paletteRef = useRef(null);
  const [showOutlines, setShowOutlines] = useState(true);
  const [autoSelectColor, setAutoSelectColor] = useState(false);
  const [sprayMode, setSprayMode] = useState(false);

  const {
    canvasRef,
    highlightRef,
    cursorRef,
    isHoveringCanvas,
    setIsHoveringCanvas
  } = useCanvas(DIMENSIONS);

  const {
    drawing,
    currentColor,
    setCurrentColor,
    selectedRegion,
    setSelectedRegion,
    brushWidth,
    setBrushWidth,
    startDraw,
    endDraw,
    draw,
    drawCursor
  } = useDrawing(canvasRef, highlightRef, cursorRef, DIMENSIONS, REGION_MAP, showOutlines, autoSelectColor, COLORS);

  // Event handlers
  useEffect(() => {
    const handleClickOutside = (e) => {
      const isOutsideCanvas = canvasWrapperRef.current && !canvasWrapperRef.current.contains(e.target);
      const isOutsidePalette = paletteRef.current && !paletteRef.current.contains(e.target);

      const clickedOutside = isOutsideCanvas && isOutsidePalette;

      if (clickedOutside && !drawing) {
        setCurrentColor(null);
        setSelectedRegion(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [drawing, setCurrentColor, setSelectedRegion]);

  const downloadImage = async () => {
    try {
      const blob = await new Promise(resolve => {
        canvasRef.current.toBlob(resolve, 'image/png');
      });
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: "Paint by Numbers - " + FILENAME.replace(/\.json$/, ''),
        types: [{
          description: 'PNG Image',
          accept: { 'image/png': ['.png'] }
        }]
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error saving file:', err);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isHoveringCanvas) return;
      const digit = parseInt(e.key);
      if (!isNaN(digit) && digit < COLORS.length) {
        setCurrentColor(COLORS[digit]);
      }
    };

    const handleOutlineToggle = (e) => {
      if (e.key.toLowerCase() === 'o') {
        setShowOutlines(prev => !prev);
      }
    };

    const handleSave = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        downloadImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", handleOutlineToggle);
    window.addEventListener("keydown", handleSave);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", handleOutlineToggle);
      window.removeEventListener("keydown", handleSave);
    };
  }, [COLORS, isHoveringCanvas, setCurrentColor, FILENAME]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setCurrentColor(null);
        setSelectedRegion(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [setCurrentColor, setSelectedRegion]);

  const getCursorStyle = () => {
    if (selectedRegion) {
      if (currentColor) {
        return brushWidth < 50 ? "cursor-none" : "cursor-crosshair";
      }
      return "cursor-not-allowed";
    }
    return "cursor-pointer";
  };

  // Render
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-semibold mb-4">{FILENAME}</h1>
      {selectedRegion ? (
        <p className="mb-2 text-lg font-medium text-gray-700">
          Region Color: <span className="text-blue-600">{REGION_MAP.filter(r => r.name === selectedRegion)[0].colorNum}</span>
        </p>
      ) : (
        <p className="mb-2 text-lg font-medium text-gray-500 italic">
          No region selected — click inside one to begin
        </p>
      )}
      <div className="flex flex-col items-center w-full max-w-6xl mb-1">
        <div className="flex items-center justify-center gap-4">
          <label htmlFor="brushWidth" className="text-lg">Brush Width:</label>
          <input
            id="brushWidth"
            type="range"
            min="1"
            max="75"
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
            <span className="text-md">px</span>
          </div>
        </div>
      </div>
      <div className="flex flex-row gap-6 w-full max-w-6xl justify-center items-center">
        <div className="flex flex-col items-center">
          <div
            ref={canvasWrapperRef}
            onMouseEnter={() => setIsHoveringCanvas(true)}
            onMouseLeave={() => setIsHoveringCanvas(false)}
            className={`relative mt-5 bg-white ${getCursorStyle()}`}
            style={{ width: DIMENSIONS.width, height: DIMENSIONS.height }}
          >
            {!selectedRegion && (
              <button
                onClick={() => setShowOutlines(prev => !prev)}
                className="absolute top-2 right-2 z-30 bg-white/80 border border-gray-400 rounded px-3 py-1 text-sm shadow hover:bg-white"
              >
                {showOutlines ? "Hide Outlines" : "Show Outlines"}
              </button>
            )}
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
            <canvas
              ref={highlightRef}
              style={{ width: `${DIMENSIONS.width}px`, height: `${DIMENSIONS.height}px` }}
              className="absolute top-0 left-0 z-10 pointer-events-none"
            />
            <canvas
              ref={cursorRef}
              style={{ width: `${DIMENSIONS.width}px`, height: `${DIMENSIONS.height}px`, cursor: "none" }}
              className="absolute top-0 left-0 z-20 pointer-events-none"
            />
          </div>
          <button
            onClick={downloadImage}
            className="mt-2 text-black hover:text-blue-800 cursor-pointer underline"
          >
            Download Current Image
          </button>
        </div>
        <div ref={paletteRef} className="flex flex-col items-center justify-center">
        <div className="mb-4">
          <label htmlFor="mode-select" className="mr-2 font-medium">Mode:</label>
          <select
            id="mode-select"
            value={sprayMode ? "spray" : "normal"}
            onChange={(e) => setSprayMode(e.target.value === "spray")}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="normal">Normal</option>
            <option value="spray">Spray</option>
          </select>
        </div>
          <div className={`mt-4 text-xs px-2 py-1 rounded-full mb-3 border border-gray-400 flex items-center gap-2 cursor-pointer ${autoSelectColor ? "bg-blue-200" : "bg-white"}`} onClick={() => setAutoSelectColor(prev => !prev)}>
            Auto-Select
          </div>
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
