let videoStream = null;
let video = null;
let animationFrameId = null;
let model = null;
let modelLoaded = false;
let cvReady = false;

// DOM
const imageUpload = document.getElementById('image-upload');
const analyzeBtn = document.getElementById('analyze-btn');
const imagePreview = document.getElementById('image-preview');
const cameraBtn = document.getElementById('camera-btn');

// ==========================
// LOAD MODELS
// ==========================
async function initModels() {
  console.log("Loading Face Landmarks Model...");
  model = await faceLandmarksDetection.load(
    faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
    { maxFaces: 1 }
  );
  modelLoaded = true;
  console.log("Face Landmarks Model Loaded.");
  enableUI();
}

function onOpenCvReady() {
  cvReady = true;
  console.log("OpenCV.js Loaded.");
  enableUI();
}

// Enable buttons once both libs are ready
function enableUI() {
  if (modelLoaded && cvReady) {
    cameraBtn.disabled = false;
    analyzeBtn.disabled = false;
  }
}

initModels();

// ==========================
// CAMERA HANDLING
// ==========================
cameraBtn.addEventListener("click", async () => {
  if (videoStream) stopCamera();

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (err) {
    alert("Camera access denied or not available.");
    return;
  }

  video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = videoStream;
  await video.play();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  imagePreview.innerHTML = "";
  imagePreview.appendChild(canvas);

  video.addEventListener("loadedmetadata", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    drawLoop(ctx, canvas);
  });
});

function drawLoop(ctx, canvas) {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  animationFrameId = requestAnimationFrame(() => drawLoop(ctx, canvas));
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

// ==========================
// IMAGE UPLOAD
// ==========================
imageUpload.addEventListener("change", e => {
  stopCamera();
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.innerHTML = `<img id="uploaded-img" src="${reader.result}" class="rounded-xl w-full"/>`;
  };
  reader.readAsDataURL(file);
});

// ==========================
// ANALYZE SMILE
// ==========================
analyzeBtn.addEventListener("click", async () => {
  if (!modelLoaded || !cvReady) {
    alert("Please wait until models finish loading.");
    return;
  }

  let img = document.getElementById("uploaded-img");
  if (!img) {
    alert("Please upload or capture a photo first.");
    return;
  }

  if (!img.complete) {
    img.onload = () => processImage(img);
  } else {
    processImage(img);
  }
});

async function processImage(img) {
  // STEP 1: Detect landmarks
  const predictions = await model.estimateFaces({ input: img });
  if (!predictions.length) {
    alert("No face detected or teeth not visible.");
    return;
  }

  // STEP 2: OpenCV processing
  let src = cv.imread(img);
  cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
  cv.threshold(src, src, 150, 255, cv.THRESH_BINARY);

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(src, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  if (contours.size() === 0) {
    alert("No teeth detected. Please show your teeth clearly.");
    src.delete(); contours.delete(); hierarchy.delete();
    return;
  }

  // Example: Deterministic "smile score"
  let score = Math.min(100, Math.max(0, 100 - contours.size() * 2));
  alert("Smile Score: " + score);

  src.delete(); contours.delete(); hierarchy.delete();
}
