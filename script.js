let imageFile = null;
let videoStream = null;
let video = null;
let animationFrameId = null;
let model = null;
let modelLoaded = false;
let cvReady = false;

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
    modelLoaded = true;
    console.log("Face Landmarks model loaded.");
}
loadModel();

// -------------------------
// OpenCV.js Ready Callback
// -------------------------
function onOpenCvReady() {
    cvReady = true;
    console.log("OpenCV.js is ready.");
}

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
    canvas.classList.add('w-full', 'h-full', 'rounded-xl');
    const ctx = canvas.getContext('2d');
    imagePreview.innerHTML = '';
    imagePreview.appendChild(canvas);

    video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        processFrame();
    });

    const processFrame = async () => {
        if (!videoStream) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (modelLoaded) {
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

    function processFrame() {
        if (!videoStream) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(processFrame);
    }
});

function stopCamera() {
    if (videoStream) videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
}

// -------------------------
// Draw Landmarks
// -------------------------
function drawLandmarks(ctx, points) {
    ctx.strokeStyle = '#e91e63';
    ctx.lineWidth = 2;
    points.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.stroke();
    });
}

// -------------------------
// Analyze Smile Button
// -------------------------
analyzeBtn.addEventListener('click', async () => {
    if (!modelLoaded) {
        showModal('Model Loading', 'Please wait a moment, model is still loading.');
        return;
    }
    if (!cvReady) {
        showModal('Processing Error', 'OpenCV.js is not ready yet. Please try again in a few seconds.');
        return;
    }
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

    let src = cv.imread(img);
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    let teethMask = new cv.Mat();
    cv.threshold(gray, teethMask, 150, 255, cv.THRESH_BINARY);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(teethMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    if (contours.size() === 0) {
        showModal('Teeth Not Detected', 'Please make sure your teeth are visible.');
        src.delete(); gray.delete(); teethMask.delete(); contours.delete(); hierarchy.delete();
        return;
    }

    const features = computeFeatures(contours);
    const score = calculateSmileScore(features);
    smileScoreDisplay.textContent = Math.round(score);

    // Draw mouth landmarks overlay
    drawLandmarks(ctx, mouthLandmarks);
    resultsImage.src = canvas.toDataURL();

    // Discount calculation
    let discount = 0;
    if (score >= 90) discount = 50;
    else if (score >= 75) discount = 30;
    else if (score >= 50) discount = 15;
    discountPercent.textContent = discount + '%';

    resultsSection.classList.remove('hidden');

    src.delete(); gray.delete(); teethMask.delete(); contours.delete(); hierarchy.delete();
}

// -------------------------
// Feature Extraction
// -------------------------
function extractTeethData(contours) {
    const teeth = [];
    const n = contours.size();
    for (let i = 0; i < n; i++) {
        const cnt = contours.get(i);
        const rect = cv.boundingRect(cnt);
        const moments = cv.moments(cnt);
        const cx = moments.m10 / moments.m00;
        const cy = moments.m01 / moments.m00;
        teeth.push({ rect, cx, cy });
    }
    teeth.sort((a, b) => a.cx - b.cx);
    return teeth;
}

function computeAlignmentDeviation(teeth) {
    const n = teeth.length;
    if (n === 0) return 1;
    const ys = teeth.map(t => t.cy);
    const meanY = ys.reduce((a,b)=>a+b,0)/n;
    return ys.reduce((a,y)=>a+Math.abs(y-meanY),0)/n / 50;
}

function computeSymmetryDeviation(teeth) {
    const n = teeth.length;
    if (n < 2) return 1;
    const mid = Math.floor(n/2);
    let deviation = 0;
    for (let i = 0; i < mid; i++) {
        const left = teeth[i];
        const right = teeth[n-1-i];
        deviation += Math.abs(left.cx - (teeth[n-1].cx - right.cx));
        deviation += Math.abs(left.rect.height - right.rect.height);
    }
    return deviation / 200;
}

function computeGapAndCrowding(teeth) {
    let gapScore = 0;
    let crowdingScore = 0;
    for (let i = 1; i < teeth.length; i++) {
        const prev = teeth[i-1];
        const curr = teeth[i];
        const gap = curr.rect.x - (prev.rect.x + prev.rect.width);
        if (gap > 0) gapScore += gap;
        else crowdingScore += Math.abs(gap);
    }
    return { gapScore: gapScore / 50, crowdingScore: crowdingScore / 50 };
}

function computeBiteScore(teeth) {
    const ys = teeth.map(t => t.cy);
    return (Math.max(...ys) - Math.min(...ys)) / 50;
}

function computeMissingTeethPenalty(teeth) {
    const expected = 12;
   
