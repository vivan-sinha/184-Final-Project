function KuwaharaFilter(ctx, width, height) {
    const windowSize = 15;
    const quadrantSize = Math.ceil(windowSize / 2);
    const { hsvArray } = getImageHSVArray(ctx, width, height);
    const result = new Uint8ClampedArray(width * height * 4);
  
    const getHSV = (x, y) => {
      if (x >= width || y >= height) return null;
      return hsvArray[y * width + x];
    };
  
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const tl_x = Math.max(0, Math.floor(x - windowSize / 2));
        const tl_y = Math.max(0, Math.floor(y - windowSize / 2));
        const mid_x = Math.min(width, tl_x + quadrantSize);
        const mid_y = Math.min(height, tl_y + quadrantSize);
        const wind_x = Math.min(width, tl_x + windowSize);
        const wind_y = Math.min(height, tl_y + windowSize);
  
        const quadrants = [
          [], [], [], []
        ];
  
        for (let j = tl_y; j < wind_y; j++) {
          for (let i = tl_x; i < wind_x; i++) {
            const hsv = getHSV(i, j);
            if (!hsv) continue;
  
            if (j < mid_y && i < mid_x) quadrants[0].push(hsv);
            else if (j < mid_y && i >= mid_x) quadrants[1].push(hsv);
            else if (j >= mid_y && i < mid_x) quadrants[2].push(hsv);
            else quadrants[3].push(hsv);
          }
        }
  
        const stdDevs = quadrants.map(q => {
          if (q.length === 0) return Infinity;
          const vValues = q.map(p => p[2]);
          const mean = vValues.reduce((a, b) => a + b, 0) / vValues.length;
          const variance = vValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) / vValues.length;
          return Math.sqrt(variance);
        });
  
        const bestIndex = stdDevs.indexOf(Math.min(...stdDevs));
        const bestQuadrant = quadrants[bestIndex];
  
        const avg = [0, 0, 0];
        bestQuadrant.forEach(([h, s, v]) => {
          avg[0] += h;
          avg[1] += s;
          avg[2] += v;
        });
        avg[0] /= bestQuadrant.length;
        avg[1] /= bestQuadrant.length;
        avg[2] /= bestQuadrant.length;
  
        const [r, g, b] = hsvToRgb(avg[0] / 255, avg[1] / 255, avg[2] / 255);
  
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= height || xx >= width) continue;
            const idx = (yy * width + xx) * 4;
            result[idx] = r;
            result[idx + 1] = g;
            result[idx + 2] = b;
            result[idx + 3] = 255;
          }
        }
      }
    }
};

export { KuwaharaFilter };

function rgbToHsv(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h, s = (max === 0 ? 0 : d / max), v = max;
  
    switch (max) {
        case min: h = 0; break;
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  
    return [h, s, v];
}
  
function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return [r * 255, g * 255, b * 255];
}

function getImageHSVArray(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const hsvArray = [];
  
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
  
      const [h, s, v] = rgbToHsv(r, g, b).map(val => val * 255);
      hsvArray.push([h, s, v]);
    }
  
    return { hsvArray, width, height };
}

function GaussianBlur(ctx, width, height, radius = 2) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const weights = [1, 4, 6, 4, 1]; // Simple 5x1 kernel
    const kernelSum = weights.reduce((a, b) => a + b);
    const temp = new Uint8ClampedArray(data);
  
    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < 3; c++) {
          let val = 0;
          for (let k = -2; k <= 2; k++) {
            const xi = Math.min(width - 1, Math.max(0, x + k));
            val += weights[k + 2] * temp[(y * width + xi) * 4 + c];
          }
          data[(y * width + x) * 4 + c] = val / kernelSum;
        }
      }
    }
  
    // Vertical pass
    temp.set(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < 3; c++) {
          let val = 0;
          for (let k = -2; k <= 2; k++) {
            const yi = Math.min(height - 1, Math.max(0, y + k));
            val += weights[k + 2] * temp[(yi * width + x) * 4 + c];
          }
          data[(y * width + x) * 4 + c] = val / kernelSum;
        }
      }
    }
  
    ctx.putImageData(imageData, 0, 0);
};

export { GaussianBlur };