// Load MediaPipe FaceMesh and OpenCV.js
// Add these scripts in your index.html <head> if not already:
// <script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"></script>
// <script src="https://docs.opencv.org/4.x/opencv.js"></script>

let imageFile = null;

// DOM elements
const formCompleteBtn = document.getElementById('form-complete-btn');
const uploadSection = document.getElementById('upload-section');
const imageUpload = document.getElementById('image-upload');
const imagePreview = document.getElementById('image-preview');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsSection = document.getElementById('results-section');
const smileScoreDisplay = document.getElementById('smile-score-display');
const resultsImage = document.getElementById('results-image');
const discountPercent = document.getElementById('discount-percent');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

// Step 1: Show upload section after form completion
formCompleteBtn.addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
    document.getElementById('form-section').classList.add('hidden');
});

// Step 2: Handle image upload & preview
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    imageFile = file;

    const reader = new FileReader();
    reader.onload = () => {
        imagePreview.innerHTML = `<img id="uploaded-img" src="${reader.result}" class="w-full h-full object-cover rounded-xl" />`;
        analyzeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
});

// Modal close
modalCloseBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// Utility: Show modal
function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.remove('hidden');
}

// Step 3: Smile Analysis
analyzeBtn.addEventListener('click', async () => {
    if (!imageFile) {
        showModal('No Image', 'Please upload a clear photo of your teeth.');
        return;
    }

    const img = document.getElementById('uploaded-img');

    // Wait until OpenCV.js is ready
    if (!cv || !cv.Mat) {
        showModal('Error', 'OpenCV.js not loaded properly.');
        return;
    }

    // Convert image to OpenCV Mat
    let src = cv.imread(img);
    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB);

    // Teeth detection placeholder
    // Normally, you'd use a trained segmentation model
    // For demonstration, we'll just check mouth region via FaceMesh
    const smileScore = await analyzeTeeth(src);

    // Display results
    resultsSection.classList.remove('hidden');
    smileScoreDisplay.textContent = smileScore;
    resultsImage.src = URL.createObjectURL(imageFile);

    // Discount logic based on score
    let discount = 0;
    if (smileScore >= 90) discount = 50;
    else if (smileScore >= 75) discount = 30;
    else if (smileScore >= 50) discount = 15;
    discountPercent.textContent = discount + '%';

    // Cleanup
    src.delete();
});

// ---------------------------
// Core Teeth Analysis Function
// ---------------------------
async function analyzeTeeth(srcMat) {
    // Step 1: Detect facial landmarks using MediaPipe FaceMesh
    const faceMesh = new FaceMesh.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.8,
        minTrackingConfidence: 0.8
    });

    return new Promise((resolve) => {
        faceMesh.onResults((results) => {
            if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                showModal('Teeth Not Detected', 'Please make sure your teeth are visible in the image.');
                resolve(0);
                return;
            }

            const landmarks = results.multiFaceLandmarks[0];

            // Extract mouth region landmarks
            const mouthIndices = [
                61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308
            ];
            const mouthPoints = mouthIndices.map(i => landmarks[i]);

            // Step 2: Compute symmetry and alignment features
            let alignmentDeviation = computeAlignmentDeviation(mouthPoints);
            let symmetryDeviation = computeSymmetryDeviation(mouthPoints);
            let gapScore = computeGapScore(mouthPoints);
            let biteScore = computeBiteScore(mouthPoints);
            let missingTeethPenalty = computeMissingTeethPenalty(mouthPoints);

            // Step 3: Weighted smile score calculation (deterministic)
            const score = Math.max(0, Math.min(100,
                100
                - 20 * alignmentDeviation
                - 20 * symmetryDeviation
                - 15 * gapScore
                - 20 * biteScore
                - 25 * missingTeethPenalty
            ));

            resolve(Math.round(score));
        });

        // Convert OpenCV Mat to HTML Image for FaceMesh
        const canvas = document.createElement('canvas');
        canvas.width = srcMat.cols;
        canvas.height = srcMat.rows;
        cv.imshow(canvas, srcMat);

        faceMesh.send({ image: canvas });
    });
}

// ---------------------------
// Feature Calculation Helpers
// ---------------------------
function computeAlignmentDeviation(points) {
    // Rough horizontal alignment deviation (0 to 1)
    let yValues = points.map(p => p.y);
    let meanY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    let deviation = yValues.reduce((a, b) => a + Math.abs(b - meanY), 0) / yValues.length;
    return deviation * 5; // scale for scoring
}

function computeSymmetryDeviation(points) {
    // Rough symmetry between left/right
    let left = points.slice(0, points.length / 2);
    let right = points.slice(points.length / 2);
    let deviation = 0;
    for (let i = 0; i < left.length; i++) {
        deviation += Math.abs(left[i].x - (1 - right[right.length - 1 - i].x));
    }
    return deviation * 10; // scale for scoring
}

function computeGapScore(points) {
    // Simple distance variance between adjacent points
    let distances = [];
    for (let i = 1; i < points.length; i++) {
        let dx = points[i].x - points[i - 1].x;
        let dy = points[i].y - points[i - 1].y;
        distances.push(Math.sqrt(dx * dx + dy * dy));
    }
    let mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    let variance = distances.reduce((a, b) => a + Math.abs(b - mean), 0) / distances.length;
    return variance * 5;
}

function computeBiteScore(points) {
    // Rough vertical overlap measure
    let yValues = points.map(p => p.y);
    let maxY = Math.max(...yValues);
    let minY = Math.min(...yValues);
    return Math.abs(maxY - minY) * 5;
}

function computeMissingTeethPenalty(points) {
    // Roughly check if too few landmarks (simulates missing teeth)
    return points.length < 12 ? 1 : 0;
}
