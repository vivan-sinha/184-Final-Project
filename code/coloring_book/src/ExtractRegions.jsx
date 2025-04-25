const extractRegions = (
  ctx,
  setColors,
  setRegionMap,
  SMALL_REGION_THRESHOLD,
  onComplete,
  img,
  originalFilename
) => {

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

export { extractRegions };