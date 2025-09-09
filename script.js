// script-updated.js
// Replaces the previous script.js. Uses OpenCV.js (loaded at runtime) to provide a robust
// teeth detection pipeline based on color, position, curvature and symmetry and draws
// per-tooth overlays. Also wires the form-complete flow so the upload/camera UI works
// and the "Analyze My Smile" button responds instantly.

// How to use: include this file instead of the old script.js in index.html.
// This script will dynamically insert OpenCV.js from CDN. It falls back to a simpler
// JS-only pipeline if OpenCV fails to load.

(() => {
  // --- Config / thresholds (tweak if needed) ---
  const MIN_CONTOUR_AREA = 200; // px
  const MAX_CONTOUR_AREA = 20000; // px
  const TOOTH_ASPECT_RATIO_MIN = 0.2;
  const TOOTH_ASPECT_RATIO_MAX = 1.5;
  const SYMMETRY_MARGIN = 0.12; // fraction of mouth width allowed for symmetry offset

  // --- DOM refs ---
  const imageUpload = document.getElementById('image-upload');
  const analyzeBtn = document.getElementById('analyze-btn');
  const resultsImage = document.getElementById('results-image');
  const imagePreview = document.getElementById('image-preview');
  const uploadSection = document.getElementById('upload-section');
  const formCompleteBtn = document.getElementById('form-complete-btn');
  const cameraBtn = document.getElementById('camera-btn');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalMessage = document.getElementById('modal-message');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const resultsSection = document.getElementById('results-section');
  const resultsImageContainer = document.getElementById('results-image-container');
  const smileScoreDisplay = document.getElementById('smile-score-display');
  const discountPercent = document.getElementById('discount-percent');

  let uploadedFile = null;
  let stream = null;
  let videoEl = null;
  let cvReady = false;

  // show modal helper
  function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.remove('hidden');
  }
  modalCloseBtn.addEventListener('click', () => modal.classList.add('hidden'));

  // form-complete -> reveal upload UI
  formCompleteBtn.addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
    formCompleteBtn.disabled = true;
    formCompleteBtn.textContent = "Form recorded — upload photo";
  });

  // file input
  imageUpload.addEventListener('change', (e) => {
    uploadedFile = e.target.files[0] || null;
    analyzeBtn.disabled = !uploadedFile;
    renderPreviewFromFile(uploadedFile);
  });

  function renderPreviewFromFile(file) {
    imagePreview.innerHTML = '';
    if (!file) {
      imagePreview.innerHTML = '<span class="text-gray-400">Image preview will appear here</span>';
      return;
    }
    const img = document.createElement('img');
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    imagePreview.appendChild(img);
  }

  // camera functionality
  cameraBtn.addEventListener('click', async () => {
    if (stream) {
      stopCamera();
      cameraBtn.textContent = 'Take Photo';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      videoEl = document.createElement('video');
      videoEl.autoplay = true; videoEl.playsInline = true; videoEl.srcObject = stream;
      videoEl.style.maxWidth = '100%';
      imagePreview.innerHTML = '';
      imagePreview.appendChild(videoEl);
      await videoEl.play();
      cameraBtn.textContent = 'Capture Photo';
      // replace camera click to capture
      cameraBtn.onclick = () => captureFromVideo();
    } catch (err) {
      showModal('Camera error', 'Unable to access camera. Please allow camera permissions or upload a photo.');
    }
  });

  function stopCamera() {
    if (!stream) return;
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    videoEl = null;
    cameraBtn.onclick = null;
  }

  async function captureFromVideo() {
    if (!videoEl) return;
    const c = document.createElement('canvas');
    c.width = videoEl.videoWidth; c.height = videoEl.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    c.toBlob(b => {
      uploadedFile = new File([b], 'capture.png', { type: 'image/png' });
      analyzeBtn.disabled = false;
      renderPreviewFromFile(uploadedFile);
      stopCamera();
      cameraBtn.textContent = 'Take Photo';
      cameraBtn.onclick = null;
    });
  }

  // Analyze handler — attempts OpenCV pipeline if cvReady, else uses JS fallback
  analyzeBtn.addEventListener('click', async () => {
    if (!uploadedFile) return showModal('No image', 'Please upload or capture a photo first.');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    try {
      const dataURL = await fileToDataURL(uploadedFile);
      const img = await loadImage(dataURL);
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      let overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = canvas.width; overlayCanvas.height = canvas.height;
      let overlayCtx = overlayCanvas.getContext('2d');

      // Run detection
      let teethInfo = null;
      if (cvReady && typeof cv !== 'undefined') {
        teethInfo = runOpenCVTeethPipeline(canvas, overlayCtx);
      } else {
        teethInfo = runJSTeethPipeline(canvas, overlayCtx);
      }

      // Compose overlay onto original and show results
      ctx.drawImage(overlayCanvas, 0, 0);
      resultsImage.src = canvas.toDataURL('image/png');
      resultsSection.classList.remove('hidden');

      // Simple smile score from number of detected teeth + symmetry/colour heuristics
      const score = Math.max(30, Math.min(98, Math.round(50 + (teethInfo.count - 8) * 4 + (teethInfo.symmetryScore || 0) * 10 - (teethInfo.yellowness || 0) * 8)));
      smileScoreDisplay.textContent = score + '/100';
      const discount = Math.min(60, Math.round((score - 30) * 0.9));
      discountPercent.textContent = discount + '%';

    } catch (err) {
      console.error(err);
      showModal('Analysis error', 'Something went wrong during analysis. Try a different photo or check console.');
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze My Smile';
    }
  });

  // Utility: file -> dataURL
  function fileToDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej; r.readAsDataURL(file);
    });
  }
  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
    });
  }

  // --- JS fallback pipeline (no OpenCV) ---
  function runJSTeethPipeline(canvas, overlayCtx) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // 1) find bright low-saturation pixels (typical tooth color)
    const mask = new Uint8ClampedArray(w * h);
    let sumL = 0, countL = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 510; // 0..1
      const s = max === 0 ? 0 : (max - min) / max;
      sumL += l; countL++;
    }
    const meanL = sumL / countL;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 510;
        const s = max === 0 ? 0 : (max - min) / max;
        // tooth if light and low saturation and not too red (lips)
        if (l > Math.max(0.55, meanL + 0.05) && s < 0.35 && !(r > 150 && g < 90)) mask[y*w + x] = 1;
        else mask[y*w + x] = 0;
      }
    }

    // 2) simple connected component labeling (4-neigh)
    const { labels, components } = labelComponents(mask, w, h);

    // 3) filter components by area and bounding box aspect ratio
    const comps = [];
    for (let i = 1; i <= components.count; i++) {
      const comp = components.stats[i];
      if (!comp) continue;
      const area = comp.area;
      if (area < MIN_CONTOUR_AREA || area > MAX_CONTOUR_AREA) continue;
      const bw = comp.maxX - comp.minX + 1; const bh = comp.maxY - comp.minY + 1;
      const ar = bw / bh;
      if (ar < TOOTH_ASPECT_RATIO_MIN || ar > TOOTH_ASPECT_RATIO_MAX) continue;
      comps.push({ area, minX: comp.minX, minY: comp.minY, maxX: comp.maxX, maxY: comp.maxY, cx: (comp.minX+comp.maxX)/2 });
    }

    // 4) symmetry check and sort by x
    comps.sort((a,b)=>a.cx-b.cx);
    const mouthWidth = w; // approximation
    const midX = w/2;
    let symmetryScore = 0;
    if (comps.length > 0) {
      // measure left-right distribution
      const left = comps.filter(c => c.cx < midX).length;
      const right = comps.filter(c => c.cx > midX).length;
      symmetryScore = 1 - Math.abs(left - right) / Math.max(1, comps.length);
    }

    // 5) draw overlays for each detected comp (bounding box + smooth outline)
    overlayCtx.clearRect(0,0,canvas.width, canvas.height);
    overlayCtx.lineWidth = Math.max(2, Math.round(Math.max(w,h)/200));
    for (let i=0;i<comps.length;i++){
      const c = comps[i];
      overlayCtx.strokeStyle = 'rgba(0,200,120,0.9)';
      overlayCtx.fillStyle = 'rgba(0,200,120,0.06)';
      overlayCtx.beginPath();
      overlayCtx.roundRect(c.minX, c.minY, c.maxX-c.minX, c.maxY-c.minY, 6);
      overlayCtx.fill(); overlayCtx.stroke();
    }

    // simple yellowness estimate (higher -> worse)
    let yellowness = 0;
    for (let i=0;i<comps.length;i++){
      const c = comps[i];
      const cx = Math.round(c.cx), cy = Math.round((c.minY+c.maxY)/2);
      const idx = (cy * w + cx) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      // more yellow if r & g > b
      const y = (r + g)/2 - b;
      yellowness += Math.max(0, y/255);
    }
    yellowness = comps.length ? yellowness / comps.length : 0;

    return { count: comps.length, symmetryScore, yellowness };
  }

  // --- OpenCV.js pipeline ---
  function runOpenCVTeethPipeline(canvas, overlayCtx) {
    const src = cv.imread(canvas);
    const w = src.cols, h = src.rows;

    // convert to LAB for lightness separation and stability
    let lab = new cv.Mat();
    cv.cvtColor(src, lab, cv.COLOR_RGBA2RGB);
    cv.cvtColor(lab, lab, cv.COLOR_RGB2Lab);

    // split channels
    let labPlanes = new cv.MatVector();
    cv.split(lab, labPlanes);
    let L = labPlanes.get(0);
    // normalize L
    let Lnorm = new cv.Mat();
    cv.normalize(L, Lnorm, 0, 255, cv.NORM_MINMAX);

    // adaptive threshold on L channel
    let Lblur = new cv.Mat();
    cv.GaussianBlur(Lnorm, Lblur, new cv.Size(5,5), 0);
    let thresh = new cv.Mat();
    cv.adaptiveThreshold(Lblur, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, -8);

    // mask out lips (red areas) using HSV
    let hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);
    let lowLip = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 50, 30, 0]);
    let highLip = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 255, 255, 255]);
    let lipMask = new cv.Mat();
    cv.inRange(hsv, lowLip, highLip, lipMask);

    // invert lip mask and combine with thresh
    let lipInv = new cv.Mat(); cv.bitwise_not(lipMask, lipInv);
    let teethMask = new cv.Mat(); cv.bitwise_and(thresh, lipInv, teethMask);

    // morphological ops to clean
    let kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5,5));
    cv.morphologyEx(teethMask, teethMask, cv.MORPH_OPEN, kernel);
    cv.morphologyEx(teethMask, teethMask, cv.MORPH_CLOSE, kernel);

    // find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(teethMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const comps = [];
    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area < MIN_CONTOUR_AREA || area > MAX_CONTOUR_AREA) { cnt.delete(); continue; }
      const rect = cv.boundingRect(cnt);
      const ar = rect.width / rect.height;
      if (ar < TOOTH_ASPECT_RATIO_MIN || ar > TOOTH_ASPECT_RATIO_MAX) { cnt.delete(); continue; }

      // curvature heuristic: approximate polygon and compare lengths
      let approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * cv.arcLength(cnt, true), true);
      const perimeter = cv.arcLength(cnt, true);
      const avgVertex = approx.rows || 1;
      const curvatureScore = avgVertex / Math.max(1, perimeter/10);

      comps.push({ cnt, area, rect, curvatureScore });
      approx.delete();
    }

    // sort comps left->right
    comps.sort((a,b)=> (a.rect.x + a.rect.width/2) - (b.rect.x + b.rect.width/2));

    // symmetry calculation: compare left/right counts
    const midX = w/2;
    const left = comps.filter(c => (c.rect.x + c.rect.width/2) < midX).length;
    const right = comps.filter(c => (c.rect.x + c.rect.width/2) > midX).length;
    const symmetryScore = 1 - Math.abs(left - right) / Math.max(1, comps.length);

    // colour/yellowness metric: average a/b channels from Lab (a: green-red, b: blue-yellow)
    const labVec = new cv.MatVector();
    cv.split(lab, labVec);
    const bChannel = labVec.get(2);
    let yellowness = 0;
    for (let i=0;i<comps.length;i++){
      const c = comps[i];
      const cx = Math.round(c.rect.x + c.rect.width/2);
      const cy = Math.round(c.rect.y + c.rect.height/2);
      const val = bChannel.ucharPtr(cy, cx)[0];
      yellowness += val/255; // higher -> more yellow
    }
    yellowness = comps.length ? yellowness / comps.length : 0;

    // draw overlays
    overlayCtx.clearRect(0,0,w,h);
    overlayCtx.lineWidth = Math.max(2, Math.round(Math.max(w,h)/200));
    for (let i=0;i<comps.length;i++){
      const r = comps[i].rect;
      overlayCtx.strokeStyle = 'rgba(0,200,120,0.95)';
      overlayCtx.fillStyle = 'rgba(0,200,120,0.06)';
      overlayCtx.beginPath();
      overlayCtx.roundRect(r.x, r.y, r.width, r.height, 6);
      overlayCtx.fill(); overlayCtx.stroke();
    }

    // clean up
    src.delete(); lab.delete(); L.delete(); Lnorm.delete(); Lblur.delete && Lblur.delete();
    thresh.delete(); hsv.delete(); lowLip.delete(); highLip.delete(); lipMask.delete(); lipInv.delete();
    kernel.delete(); contours.delete(); hierarchy.delete(); labPlanes.delete && labPlanes.delete();

    // note: we kept cnt Mats in comps; free them now
    comps.forEach(c => c.cnt && c.cnt.delete());

    return { count: comps.length, symmetryScore, yellowness };
  }

  // --- small JS connected-component labeling used by fallback ---
  function labelComponents(mask, w, h) {
    const labels = new Int32Array(w*h).fill(0);
    const stats = {}; // stats[label] = { area, minX, minY, maxX, maxY }
    let currentLabel = 0;
    const stack = [];
    for (let y=0;y<h;y++){
      for (let x=0;x<w;x++){
        const idx = y*w + x;
        if (!mask[idx] || labels[idx]) continue;
        currentLabel++;
        labels[idx] = currentLabel;
        stats[currentLabel] = { area: 0, minX:x, minY:y, maxX:x, maxY:y };
        stack.push(idx);
        while (stack.length) {
          const p = stack.pop();
          const px = p % w, py = Math.floor(p / w);
          const neighbors = [ [px-1,py],[px+1,py],[px,py-1],[px,py+1] ];
          stats[currentLabel].area++;
          if (px < stats[currentLabel].minX) stats[currentLabel].minX = px;
          if (py < stats[currentLabel].minY) stats[currentLabel].minY = py;
          if (px > stats[currentLabel].maxX) stats[currentLabel].maxX = px;
          if (py > stats[currentLabel].maxY) stats[currentLabel].maxY = py;
          for (const n of neighbors) {
            const nx = n[0], ny = n[1];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny*w + nx;
            if (mask[ni] && !labels[ni]) { labels[ni] = currentLabel; stack.push(ni); }
          }
        }
      }
    }
    return { labels, components: { count: currentLabel, stats } };
  }

  // --- OpenCV loader ---
  function injectOpenCV() {
    return new Promise((resolve, reject) => {
      if (window.cv && cv.ready) { cvReady = true; return resolve(); }
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/3.4.0/opencv.js';
      script.async = true;
      script.onload = () => {
        // wait for cv to be ready
        const waitForCv = setInterval(() => {
          if (window.cv && cv.Mat) { clearInterval(waitForCv); cvReady = true; resolve(); }
        }, 100);
        setTimeout(() => { if (!cvReady) { clearInterval(waitForCv); console.warn('OpenCV load timeout'); resolve(); } }, 5000);
      };
      script.onerror = () => { console.warn('Failed to load OpenCV.js — using JS fallback'); resolve(); };
      document.body.appendChild(script);
    });
  }

  // try to load OpenCV at startup but don't block UI
  injectOpenCV();

})();
