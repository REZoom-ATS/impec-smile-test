let imageFile = null;
let videoStream = null;
let video = null;
let animationFrameId = null;
let model = null;

// DOM Elements
const formCompleteBtn = document.getElementById('form-complete-btn');
const uploadSection = document.getElementById('upload-section');
const imageUpload = document.getElementById('image-upload');
const imagePreview = document.getElementById('image-preview');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsSection = document.getElementById('results-section');
const smileScoreDisplay = document.getElementById('smile-score-display');
const resultsImage = document.getElementById('results-image');
const discountPercent = document.getElementById('discount-percent');
const cameraBtn = document.getElementById('camera-btn');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

// -------------------------
// Modal
// -------------------------
modalCloseBtn.addEventListener('click', () => modal.classList.add('hidden'));
function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.remove('hidden');
}

// -------------------------
// Load TensorFlow.js Face Landmarks Detection Model
// -------------------------
async function loadModel() {
    model = await faceLandmarksDetection.load(
        faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
        { maxFaces: 1 }
    );
}
loadModel();

// -------------------------
// Form Completion
// -------------------------
formCompleteBtn.addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
    document.getElementById('form-section').classList.add('hidden');
});

// -------------------------
// Display Preview
// -------------------------
function displayPreview(file) {
    const reader = new FileReader();
    reader.onload = () => {
        imagePreview.innerHTML = `<img id="uploaded-img" src="${reader.result}" class="w-full h-full object-cover rounded-xl" />`;
        analyzeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

// -------------------------
// File Upload
// -------------------------
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    imageFile = file;
    stopCamera();
    displayPreview(file);
});

// -------------------------
// Camera Capture with Live Overlay
// -------------------------
cameraBtn.addEventListener('click', async () => {
    stopCamera();

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    } catch (err) {
        showModal('Camera Error', 'Unable to access your camera.');
        return;
    }

    video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = videoStream;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.classList.add('w-full', 'h-full', 'rounded-xl');
    const ctx = canvas.getContext('2d');
    imagePreview.innerHTML = '';
    imagePreview.appendChild(canvas);

    const processFrame = async () => {
        if (!videoStream) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (model) {
            const predictions = await model.estimateFaces({ input: video });
            if (predictions.length > 0) {
                const mouthLandmarks = predictions[0].annotations.lipsUpperOuter.concat(
                    predictions[0].annotations.lipsLowerOuter
                );
                drawLandmarks(ctx, mouthLandmarks);
            }
        }

        animationFrameId = requestAnimationFrame(processFrame);
    };
    processFrame();

    const captureBtn = document.createElement('button');
    captureBtn.textContent = 'Capture Photo';
    captureBtn.className = 'w-full mt-2 bg-[#e91e63] text-white font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-[#c2185b] transition-colors duration-300';
    imagePreview.appendChild(captureBtn);

    captureBtn.addEventListener('click', () => {
        const capturedCanvas = document.createElement('canvas');
        capturedCanvas.width = canvas.width;
        capturedCanvas.height = canvas.height;
        const capturedCtx = capturedCanvas.getContext('2d');
        capturedCtx.drawImage(canvas, 0, 0);
        capturedCanvas.toBlob((blob) => {
            imageFile = new File([blob], 'captured.jpg', { type: 'image/jpeg' });
            stopCamera();
            displayPreview(imageFile);
        }, 'image/jpeg', 0.95);
    });
});

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
}

// -------------------------
// Draw Landmarks
// -------------------------
function drawLandmarks(ctx, points) {
    ctx.strokeStyle = '#e91e63';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
        const [x, y] = p;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
}

// -------------------------
// Analyze Smile Button
// -------------------------
analyzeBtn.addEventListener('click', async () => {
    if (!imageFile) {
        showModal('No Image', 'Please upload or capture a photo of your teeth.');
        return;
    }

    const img = document.getElementById('uploaded-img');
    if (!img.complete) {
        img.onload = () => runSmileAnalysis(img);
    } else {
        runSmileAnalysis(img);
    }
});

// -------------------------
// Smile Analysis
// -------------------------
async function runSmileAnalysis(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Detect face and mouth
    const predictions = await model.estimateFaces({ input: img });
    if (predictions.length === 0) {
        showModal('Teeth Not Detected', 'Please make sure your teeth are visible.');
        return;
    }

    const mouthLandmarks = predictions[0].annotations.lipsUpperOuter.concat(
        predictions[0].annotations.lipsLowerOuter
    );

    if (!mouthLandmarks || mouthLandmarks.length === 0) {
        showModal('Teeth Not Detected', 'Please make sure your teeth are visible.');
        return;
    }

    // Convert mouth region to OpenCV Mat
    let src = cv.imread(img);
    let mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    mouthLandmarks.forEach(([x, y]) => {
        cv.circle(mask, new cv.Point(x, y), 2, new cv.Scalar(255), -1);
    });

    // Teeth segmentation using simple threshold on mouth region
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    let teeth = new cv.Mat();
    cv.threshold(gray, teeth, 150, 255, cv.THRESH_BINARY);

    // Apply mask
    cv.bitwise_and(teeth, mask, teeth);

    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(teeth, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    if (contours.size() === 0) {
        showModal('Teeth Not Detected', 'Please make sure your teeth are visible.');
        src.delete(); gray.delete(); teeth.delete(); contours.delete(); hierarchy.delete();
        return;
    }

    // Compute features
    const features = computeFeatures(contours);

    // Smile score calculation
    const score = calculateSmileScore(features);

    smileScoreDisplay.textContent = Math.round(score);

    // Draw mouth overlay
    ctx.strokeStyle = '#e91e63';
    ctx.lineWidth = 2;
    mouthLandmarks.forEach(([x, y], i) => {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.stroke();
    });

    resultsImage.src = canvas.toDataURL();

    // Discount calculation
    let discount = 0;
    if (score >= 90) discount = 50;
    else if (score >= 75) discount = 30;
    else if (score >= 50) discount = 15;
    discountPercent.textContent = discount + '%';

    resultsSection.classList.remove('hidden');

    src.delete(); gray.delete(); teeth.delete(); contours.delete(); hierarchy.delete();
}

// -------------------------
// Feature Extraction
// -------------------------
function computeFeatures(contours) {
    let alignmentDeviation = 0;
    let symmetryDeviation = 0;
    let gapScore = 0;
    let crowdingScore = 0;
    let biteScore = 0;
    let missingTeethPenalty = 0;

    const n = contours.size();
    if (n < 12) missingTeethPenalty = 1;

    // Dummy placeholders for demo purposes
    alignmentDeviation = 0.1;
    symmetryDeviation = 0.1;
    gapScore = 0.05;
    crowdingScore = 0.05;
    biteScore = 0.1;

    return { alignmentDeviation, symmetryDeviation, gapScore, crowdingScore, biteScore, missingTeethPenalty };
}

// -------------------------
// Smile Score Calculation
// -------------------------
function calculateSmileScore(f) {
    return Math.max(0, Math.min(100,
        100 - 20 * f.alignmentDeviation
            - 20 * f.symmetryDeviation
            - 15 * f.crowdingScore
            - 15 * f.gapScore
            - 20 * f.biteScore
            - 10 * f.missingTeethPenalty
    ));
}
