import React, { useState } from 'react';
import UploadFilePage from './UploadFilePage';
import DrawingPage from './DrawingPage';

export default function App() {
  const [step, setStep] = useState("upload");
  const [regionMap, setRegionMap] = useState(null);
  const [colors, setColors] = useState([]);
  const [filename, setFilename] = useState("Uploaded Image");
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

  const handleExtractionComplete = (extractedColors, extractedRegionMap, originalFilename, imageDims) => {
    setColors(extractedColors);
    setRegionMap(extractedRegionMap);
    setFilename(originalFilename || "Uploaded Image");
    setDimensions(imageDims || { width: 640, height: 480 });
    setStep("draw");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {step === "upload" ? (
        <UploadFilePage onComplete={handleExtractionComplete} />
      ) : (
        <DrawingPage
          FILENAME={filename}
          COLORS={colors}
          REGION_MAP={regionMap}
          DIMENSIONS={dimensions}
        />
      )}
    </div>
  );
}
