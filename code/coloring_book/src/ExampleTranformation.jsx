const ExampleTransformation = (ctx, img) => {
    //FLIP COLORS

    const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
    const imageData = ctx.createImageData(width, height);
    const newData = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const [r, g, b] = [data[idx], data[idx + 1], data[idx + 2]];
        newData[idx] = 255 - r;
        newData[idx + 1] = 255 - g;
        newData[idx + 2] = 255 - b;
        newData[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
};

export { ExampleTransformation };
