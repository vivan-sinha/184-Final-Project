import React, { useRef, useState, useEffect } from "react";

// Custom hook for canvas-related logic
const useCanvas = (DIMENSIONS) => {
    const canvasRef = useRef(null);
    const highlightRef = useRef(null);
    const cursorRef = useRef(null);
    const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);
  
    useEffect(() => {
      const baseCanvas = canvasRef.current;
      baseCanvas.width = DIMENSIONS.width;
      baseCanvas.height = DIMENSIONS.height;
      const baseCtx = baseCanvas.getContext("2d");
      baseCtx.fillStyle = "#ffffff";
      baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
    }, [DIMENSIONS]);
  
    useEffect(() => {
      const cursorCanvas = cursorRef.current;
      cursorCanvas.width = DIMENSIONS.width;
      cursorCanvas.height = DIMENSIONS.height;
    }, [DIMENSIONS]);
  
    return {
      canvasRef,
      highlightRef,
      cursorRef,
      isHoveringCanvas,
      setIsHoveringCanvas
    };
  };
  
  // Drawing-related functions
  const useDrawing = (canvasRef, highlightRef, cursorRef, DIMENSIONS, REGION_MAP, showOutlines, autoSelectColor, COLORS, sprayMode) => {
    const [drawing, setDrawing] = useState(false);
    const [currentColor, setCurrentColor] = useState(null);
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [brushWidth, setBrushWidth] = useState(10);
    const [lastPoint, setLastPoint] = useState(null);

    useEffect(() => {
        const highlightCanvas = highlightRef.current;
        highlightCanvas.width = DIMENSIONS.width;
        highlightCanvas.height = DIMENSIONS.height;
  
        const ctx = highlightCanvas.getContext("2d");
        ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
  
        if (selectedRegion) {
            const region = REGION_MAP.find(r => r.name === selectedRegion);
  
            ctx.fillStyle = "black";
            region.borderPixels.forEach(key => {
                const [x, y] = key.split(",").map(Number);
                ctx.fillRect(x, y, 1, 1);
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
            REGION_MAP.forEach(region => {
                region.borderPixels.forEach(key => {
                    const [x, y] = key.split(",").map(Number);
                    ctx.fillRect(x, y, 1, 1);
                });
            });
        }
    }, [DIMENSIONS, selectedRegion, showOutlines, REGION_MAP]);
  
    useEffect(() => {
      if (!currentColor) {
        const ctx = cursorRef.current.getContext("2d");
        ctx.clearRect(0, 0, DIMENSIONS.width, DIMENSIONS.height);
      }
    }, [currentColor, cursorRef, DIMENSIONS.width, DIMENSIONS.height]);
  
    const getCursorPos = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.floor(e.clientX - rect.left);
      const y = Math.floor(e.clientY - rect.top);
      return [x, y];
    };
  
    const inSelectedRegion = (x, y) => {
      if (!selectedRegion) return false;
      const region = REGION_MAP.find(r => r.name === selectedRegion);
      return region && region.pixels.has(`${x},${y}`);
    };
  
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
  
      ctx.globalAlpha = 1.0;
    };
  
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
          setCurrentColor(null);
        }
      } else {
        for (const region of REGION_MAP) {
          if (region.pixels.has(`${x},${y}`)) {
            setSelectedRegion(region.name);
            if (autoSelectColor) {
              setCurrentColor(COLORS[region.colorNum]);
            }
            break;
          }
        }
      }
    };
  
    const endDraw = () => {
      setDrawing(false);
      setLastPoint(null);
    };
  
    const draw = (e) => {
      if (!drawing || !lastPoint || !currentColor) return;
  
      const [x, y] = getCursorPos(e);
      if (!inSelectedRegion(x, y)) return;
  
      const [lastX, lastY] = lastPoint;
      if (sprayMode) {
        const dx = x - lastX;
        const dy = y - lastY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        //const steps = Math.ceil(distance / 2);
        const steps = Math.ceil(distance / brushWidth);

        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const interpX = lastX + t * dx;
          const interpY = lastY + t * dy;
          drawDot(interpX, interpY);
        }
      } else {
        const r = Math.ceil(brushWidth / 2);
        const minX = Math.max(0, Math.min(lastX, x) - r);
        const maxX = Math.min(canvasRef.current.width - 1, Math.max(lastX, x) + r);
        const minY = Math.max(0, Math.min(lastY, y) - r);
        const maxY = Math.min(canvasRef.current.height - 1, Math.max(lastY, y) + r);
    
        applyMaskedDrawing((ctx) => {
          ctx.lineWidth = brushWidth;
          ctx.lineCap = "round";
          ctx.strokeStyle = currentColor;
          ctx.beginPath();
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }, [minX, minY, maxX, maxY]);
      }
      setLastPoint([x, y]);
    };

    const drawDot = (x, y) => {
      const r = Math.ceil(brushWidth / 2);
      const minX = Math.max(0, x - r);
      const maxX = Math.min(canvasRef.current.width - 1, x + r);
      const minY = Math.max(0, y - r);
      const maxY = Math.min(canvasRef.current.height - 1, y + r);

      //const numParticles = Math.floor(brushWidth * 2);
      const numParticles = Math.floor(Math.pow(brushWidth, 1.2));

      applyMaskedDrawing((ctx) => {
        if (sprayMode) {
          ctx.fillStyle = currentColor;
          for (let i = 0; i < numParticles; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * (brushWidth / 2);
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            ctx.beginPath();
            //ctx.arc(x + offsetX, y + offsetY, 1.2, 0, 2 * Math.PI);
            ctx.fillRect(x + offsetX, y + offsetY, 1, 1);

            ctx.fill();
          }
        } else {
          ctx.beginPath();
          ctx.arc(x, y, brushWidth / 2, 0, 2 * Math.PI);
          ctx.fillStyle = currentColor;
          ctx.fill();
        }
      }, [minX, minY, maxX, maxY]);
    };
    
  
    return {
      drawing,
      currentColor,
      setCurrentColor,
      selectedRegion,
      setSelectedRegion,
      brushWidth,
      setBrushWidth,
      lastPoint,
      startDraw,
      endDraw,
      draw,
      drawCursor
    };
  };
  
  export { useCanvas, useDrawing };