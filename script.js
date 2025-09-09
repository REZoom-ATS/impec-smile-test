let imageFile = null;
let videoStream = null;
let video = null;
let animationFrameId = null;
let faceMesh = null;

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

    // Canvas for live overlay
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.classList.add('w-full', 'h-full', 'rounded-xl');
    const ctx = canvas.getContext('2d');
    imagePreview.innerHTML = '';
    imagePreview.appendChild(canvas);

    if (!faceMesh) initFaceMesh();

    const processFrame = () => {
        if (!videoStream) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        faceMesh.send({ image: canvas });
        animationFrameId = requestAnimationFrame(processFrame);
    };
    processFrame();

    // Capture Button
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
// Initialize FaceMesh
// -------------------------
function initFaceMesh() {
    faceMesh = new FaceMesh.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.8,
        minTrackingConfidence: 0.8
    });

    faceMesh.onResults((results) => {
        const canvas = imagePreview.querySelector('canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (video && videoStream) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;

        const landmarks = results.multiFaceLandmarks[0];
        const mouthIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308];
        const mouthPoints = mouthIndices.map(i => landmarks[i]);

        ctx.strokeStyle = '#e91e63';
        ctx.lineWidth = 2;
        ctx.beginPath();
        mouthPoints.forEach((p, i) => {
            const x = p.x * canvas.width;
            const y = p.y * canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
    });
}

// -------------------------
// Analyze Button
// -------------------------
analyzeBtn.addEventListener('click', () => {
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

function runSmileAnalysis(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    if (!faceMesh) initFaceMesh();

    faceMesh.onResults((results) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            showModal('Teeth Not Detected', 'Please make sure your teeth are visible.');
            return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        const mouthIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308];
        const mouthPoints = mouthIndices.map(i => landmarks[i]);

        const alignmentDeviation = computeAlignmentDeviation(mouthPoints);
        const symmetryDeviation = computeSymmetryDeviation(mouthPoints);
        const gapScore = computeGapScore(mouthPoints);
        const biteScore = computeBiteScore(mouthPoints);
        const missingTeethPenalty = computeMissingTeethPenalty(mouthPoints);

        const score = Math.max(0, Math.min(100,
            100 - 20 * alignmentDeviation
                - 20 * symmetryDeviation
                - 15 * gapScore
                - 20 * biteScore
                - 25 * missingTeethPenalty
        ));

        smileScoreDisplay.textContent = Math.round(score);

        // Overlay on captured image
        ctx.strokeStyle = '#e91e63';
        ctx.lineWidth = 2;
        ctx.beginPath();
        mouthPoints.forEach((p, i) => {
            const x = p.x * canvas.width;
            const y = p.y * canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();

        resultsImage.src = canvas.toDataURL();

        // Discount
        let discount = 0;
        if (score >= 90) discount = 50;
        else if (score >= 75) discount = 30;
        else if (score >= 50) discount = 15;
        discountPercent.textContent = discount + '%';

        resultsSection.classList.remove('hidden');
    });

    faceMesh.send({ image: canvas });
}

// -------------------------
// Feature Helpers
// -------------------------
function computeAlignmentDeviation(points) {
    let yValues = points.map(p => p.y);
    let meanY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    let deviation = yValues.reduce((a, b) => a + Math.abs(b - meanY), 0) / yValues.length;
    return deviation * 5;
}

function computeSymmetryDeviation(points) {
    let left = points.slice(0, points.length / 2);
    let right = points.slice(points.length / 2);
    let deviation = 0;
    for (let i = 0; i < left.length; i++) {
        deviation += Math.abs(left[i].x - (1 - right[right.length - 1 - i].x));
    }
    return deviation * 10;
}

function computeGapScore(points) {
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
    let yValues = points.map(p => p.y);
    return Math.abs(Math.max(...yValues) - Math.min(...yValues)) * 5;
}

function computeMissingTeethPenalty(points) {
    return points.length < 12 ? 1 : 0;
}
