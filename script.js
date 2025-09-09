let imageFile = null;
let videoStream = null;

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
// Step 1: Form Complete
// -------------------------
formCompleteBtn.addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
    document.getElementById('form-section').classList.add('hidden');
});

// -------------------------
// Step 2: File Upload
// -------------------------
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    imageFile = file;
    displayPreview(file);
});

// -------------------------
// Step 3: Camera Capture
// -------------------------
cameraBtn.addEventListener('click', async () => {
    if (videoStream) stopCamera();

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
        showModal('Camera Error', 'Unable to access your camera.');
        return;
    }

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = videoStream;
    video.classList.add('w-full', 'h-full', 'object-cover', 'rounded-xl');

    imagePreview.innerHTML = '';
    imagePreview.appendChild(video);

    const captureBtn = document.createElement('button');
    captureBtn.textContent = 'Capture Photo';
    captureBtn.className = 'w-full mt-2 bg-[#e91e63] text-white font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-[#c2185b] transition-colors duration-300';
    imagePreview.appendChild(captureBtn);

    captureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            imageFile = new File([blob], 'captured.jpg', { type: 'image/jpeg' });
            displayPreview(imageFile);
            stopCamera();
        }, 'image/jpeg', 0.95);
    });
});

function stopCamera() {
    if (!videoStream) return;
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
}

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
// Step 4: Analyze Smile
// -------------------------
analyzeBtn.addEventListener('click', async () => {
    if (!imageFile) {
        showModal('No Image', 'Please upload or capture a clear photo of your teeth.');
        return;
    }

    const img = document.getElementById('uploaded-img');
    if (!img.complete) {
        showModal('Processing Error', 'Image not fully loaded. Try again.');
        return;
    }

    const smileScore = await analyzeTeeth(img);

    resultsSection.classList.remove('hidden');
    smileScoreDisplay.textContent = smileScore;
    resultsImage.src = URL.createObjectURL(imageFile);

    // Discount logic
    let discount = 0;
    if (smileScore >= 90) discount = 50;
    else if (smileScore >= 75) discount = 30;
    else if (smileScore >= 50) discount = 15;
    discountPercent.textContent = discount + '%';
});

// -------------------------
// Teeth Analysis Core
// -------------------------
async function analyzeTeeth(imageElement) {
    return new Promise((resolve) => {
        const faceMesh = new FaceMesh.FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.8, minTrackingConfidence: 0.8 });

        faceMesh.onResults((results) => {
            if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                showModal('Teeth Not Detected', 'Please make sure your teeth are visible.');
                resolve(0);
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

            resolve(Math.round(score));
        });

        const canvas = document.createElement('canvas');
        canvas.width = imageElement.naturalWidth;
        canvas.height = imageElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        faceMesh.send({ image: canvas });
    });
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
