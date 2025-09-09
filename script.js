// script-debugged-full.js (improved JS fallback)
// Adds connected-component-based tooth detection when OpenCV is unavailable

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Smile Analyzer script loaded with improved fallback');

  const formCompleteBtn = document.getElementById('form-complete-btn');
  const uploadSection = document.getElementById('upload-section');
  const imageUpload = document.getElementById('image-upload');
  const analyzeBtn = document.getElementById('analyze-btn');
  const imagePreview = document.getElementById('image-preview');
  const resultsSection = document.getElementById('results-section');
  const resultsImage = document.getElementById('results-image');

  let uploadedFile = null;
  let cvReady = false;

  const cvScript = document.createElement('script');
  cvScript.src = 'https://docs.opencv.org/3.4.0/opencv.js';
  cvScript.async = true;
  cvScript.onload = () => {
    console.log('✅ OpenCV.js loaded');
    const wait = setInterval(() => {
      if (window.cv && cv.Mat) {
        cvReady = true;
        clearInterval(wait);
        console.log('✅ OpenCV ready');
      }
    }, 100);
    setTimeout(() => clearInterval(wait), 5000);
  };
  document.body.appendChild(cvScript);

  formCompleteBtn?.addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
  });

  imageUpload?.addEventListener('change', (e) => {
    uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    const img = document.createElement('img');
    img.src = URL.createObjectURL(uploadedFile);
    img.onload = () => URL.revokeObjectURL(img.src);
    imagePreview.innerHTML = '';
    imagePreview.appendChild(img);
    analyzeBtn.disabled = false;
  });

  analyzeBtn.addEventListener('click', async () => {
    if (!uploadedFile) return alert('Please upload a photo first');

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';

    try {
      const dataURL = await fileToDataURL(uploadedFile);
      const img = await loadImage(dataURL);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = canvas.width;
      overlayCanvas.height = canvas.height;
      const overlayCtx = overlayCanvas.getContext('2d');

      let teethInfo;
      if (cvReady && window.cv) {
        teethInfo = runOpenCVTeethPipeline(canvas, overlayCtx);
      } else {
        teethInfo = runImprovedJSTeethPipeline(canvas, overlayCtx);
      }

      ctx.drawImage(overlayCanvas, 0, 0);
      resultsImage.src = canvas.toDataURL('image/png');
      resultsSection.classList.remove('hidden');
      console.log(`✅ Detected ${teethInfo.count} teeth (fallback=${!cvReady})`);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze My Smile';
    }
  });

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function runImprovedJSTeethPipeline(canvas, overlayCtx) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const mask = new Uint8ClampedArray(w * h);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 510;
      const s = max === 0 ? 0 : (max - min) / max;
      mask[i / 4] = (l > 0.55 && s < 0.35) ? 1 : 0;
    }

    const comps = [];
    const labels = new Int32Array(w * h);
    let label = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!mask[idx] || labels[idx]) continue;
        label++;
        const stack = [idx];
        let minX = x, maxX = x, minY = y, maxY = y, area = 0;
        while (stack.length) {
          const p = stack.pop();
          if (labels[p]) continue;
          labels[p] = label;
          area++;
          const px = p % w, py = Math.floor(p / w);
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
          [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
            const nx = px + dx, ny = py + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
              const nidx = ny * w + nx;
              if (mask[nidx] && !labels[nidx]) stack.push(nidx);
            }
          });
        }
        if (area > 200 && area < 20000) {
          comps.push({ minX, maxX, minY, maxY, area });
        }
      }
    }

    overlayCtx.lineWidth = Math.max(1, Math.round(Math.max(w, h) / 400));
    overlayCtx.strokeStyle = 'rgba(0,200,120,0.9)';
    comps.forEach(c => overlayCtx.strokeRect(c.minX, c.minY, c.maxX - c.minX, c.maxY - c.minY));

    return { count: comps.length };
  }

  function runOpenCVTeethPipeline(canvas, overlayCtx) {
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, gray, 180, 255, cv.THRESH_BINARY);
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(gray, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); ++i) {
      const rect = cv.boundingRect(contours.get(i));
      overlayCtx.strokeStyle = 'lime';
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    const count = contours.size();
    src.delete(); gray.delete(); contours.delete(); hierarchy.delete();
    return { count };
  }
});
