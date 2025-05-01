const KMeansTransformation = (ctx, img, k = 5, max_iter = 400) => {
    const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
    const imageData = ctx.createImageData(width, height);

    // get (r,g,b,a) data from the imageData
    const newData = imageData.data;

    // reshape image into RGB datapoints
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
        pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    // randomly select k distinct data points
    let centroids = [];
    const used = new Set();
    while (centroids.length < k) {
        const idx = Math.floor(Math.random() * pixels.length);
        if (!used.has(idx)) {
            centroids.push([...pixels[idx]]);
            used.add(idx);
        }
    }

    let labels = new Array(pixels.length);

    for (let iter = 0; iter < max_iter; iter++) {
        for (let i = 0; i < pixels.length; i++) {
            // find min distances from points to the current centroids 
            let minDist = Infinity, label = 0;
            for (let j = 0; j < k; j++) {
                const dist = euclidean(pixels[i], centroids[j]);
                if (dist < minDist) {
                    minDist = dist;
                    label = j;
                }
            }
            // assign each datapoint to their nearest cluster
            labels[i] = label;
        }

        // update centroids by averaging points in each cluster
        let newCentroids = Array(k).fill(0).map(() => [0, 0, 0]);
        let counts = Array(k).fill(0);
        for (let i = 0; i < pixels.length; i++) {
            const label = labels[i];
            const [r, g, b] = pixels[i];
            newCentroids[label][0] += r;
            newCentroids[label][1] += g;
            newCentroids[label][2] += b;
            counts[label]++;
        }

        for (let j = 0; j < k; j++) {
            // handle empty clusters
            if (counts[j] === 0) {
                const idx = Math.floor(Math.random() * pixels.length);
                newCentroids[j] = [...pixels[idx]];
                counts[j] = 1;
            } else {
                newCentroids[j][0] /= counts[j];
                newCentroids[j][1] /= counts[j];
                newCentroids[j][2] /= counts[j];
            }
        }

        // check for convergence
        if (!centroidsChanged(centroids, newCentroids)) break;
        centroids = newCentroids;
    }

    // round centroids
    centroids = centroids.map(c => c.map(x => Math.round(x)));

    // assign final colors
    for (let i = 0; i < pixels.length; i++) {
        const [r, g, b] = centroids[labels[i]];
        newData[i * 4] = r;
        newData[i * 4 + 1] = g;
        newData[i * 4 + 2] = b;
        newData[i * 4 + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
};

export { KMeansTransformation };


function euclidean(a, b) {
    return Math.sqrt(
        (a[0] - b[0]) ** 2 +
        (a[1] - b[1]) ** 2 +
        (a[2] - b[2]) ** 2
    );
}

function centroidsChanged(oldC, newC, threshold = 1e-2) {
    for (let i = 0; i < oldC.length; i++) {
        for (let j = 0; j < 3; j++) {
            if (Math.abs(oldC[i][j] - newC[i][j]) > threshold) {
                return true;
            }
        }
    }
    return false;
}