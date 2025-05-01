from flask import Flask, request, send_file, send_from_directory
from PIL import Image
import numpy as np
import io

app = Flask(__name__)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/segment', methods=['POST'])
def segment():
    file = request.files['image']
    k = int(request.form['k'])

    image = Image.open(file.stream).convert("RGB")
    image_array = np.array(image)
    height, width, _ = image_array.shape

    #reshape image into datapoints
    data = image_array.reshape(-1, 3)

    # randomly select k distinct data points
    centroids = data[np.random.choice(data.shape[0], k, replace=False)]

    # max iteration is 400
    for i in range(400): 

        # find distance from all points to the current centroids 
        # (axis = 2, collapses feature with L2 norm )
        distances = np.linalg.norm(data[:, np.newaxis] - centroids, axis=2)

        # assign each data point to their nearest cluster
        labels = np.argmin(distances, axis=1)

        # new centroids found by averaging points in each cluster
        new_centroids = np.array([data[labels == j].mean(axis=0) for j in range(k)])

        # check for convergence
        if np.all(centroids == new_centroids):
            break

        centroids = new_centroids

    segmented_data = centroids[labels].reshape(height, width, 3).astype(np.uint8)
    segmented_img = Image.fromarray(segmented_data)

    buffer = io.BytesIO()
    segmented_img.save(buffer, format="PNG")
    buffer.seek(0)
    return send_file(buffer, mimetype='image/png')

if __name__ == '__main__':
    app.run(debug=True)