document.addEventListener('DOMContentLoaded', () => {
  const imageUpload = document.getElementById('image-upload');
  const analyzeBtn = document.getElementById('analyze-btn');
  const resultsImage = document.getElementById('results-image');
  const smileScoreDisplay = document.getElementById('smile-score-display');
  const resultsSection = document.getElementById('results-section');
  const cameraBtn = document.getElementById('camera-btn');
  const imagePreview = document.getElementById('image-preview');

  let uploadedFile = null;
  let videoStream = null;

  imageUpload.addEventListener('change', (e) => {
    uploadedFile = e.target.files[0];
    showPreview(uploadedFile);
    analyzeBtn.disabled = !uploadedFile;
  });

  cameraBtn.addEventListener('click', async () => {
    if (!videoStream) {
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.autoplay = true;
        video.srcObject = videoStream;
        video.classList.add('rounded-xl', 'w-full', 'h-full', 'object-cover');
        imagePreview.innerHTML = "";
        imagePreview.appendChild(video);

        // Add capture button dynamically
        const captureBtn = document.createElement('button');
        captureBtn.textContent = "Capture Photo";
        captureBtn.className = "w-full bg-pink-500 text-white mt-2 py-2 px-4 rounded-full shadow-md hover:bg-pink-600 transition";
        imagePreview.appendChild(captureBtn);

        captureBtn.addEventListener('click', () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          stopCamera();

          // Convert to file-like object
          canvas.toBlob(blob => {
            uploadedFile = new File([blob], "captured.jpg", { type: "image/jpeg" });
            showPreview(uploadedFile);
            analyzeBtn.disabled = false;
          }, "image/jpeg");
        });
      } catch (err) {
        alert("Unable to access camera. Please allow camera permissions.");
      }
    }
  });

  function stopCamera() {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
  }

  function showPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.innerHTML = `<img src="${e.target.result}" class="rounded-xl w-full h-full object-cover"/>`;
    };
    reader.readAsDataURL(file);
  }

  analyzeBtn.addEventListener('click', async () => {
    if (!uploadedFile) return;

    const dataURL = await fileToDataURL(uploadedFile);
    const img = await loadImage(dataURL);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // === Preprocessing: normalize brightness/contrast ===
    normalizeImage(imageData);

    const score = enhancedSmileAnalysis(imageData);

    resultsImage.src = canvas.toDataURL('image/png');
    smileScoreDisplay.textContent = score.toFixed(0);
    resultsSection.classList.remove('hidden');
  });

  function fileToDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  // === Enhanced Analysis ===
  function enhancedSmileAnalysis(imageData) {
    const { data, width, height } = imageData;
    const gray = new Float32Array(width * height);

    // Step 1: Build grayscale + compute mean brightness
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
      gray[i / 4] = g / 255;
      sum += g / 255;
    }
    const mean = sum / gray.length;

    // Step 2: Adaptive thresholding (local window)
    const mask = new Uint8Array(width * height);
    const windowSize = 15; // local region
    const half = Math.floor(windowSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let localSum = 0, count = 0;
        for (let wy = -half; wy <= half; wy++) {
          for (let wx = -half; wx <= half; wx++) {
            const nx = x + wx, ny = y + wy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              localSum += gray[ny * width + nx];
              count++;
            }
          }
        }
        const localMean = localSum / count;
        if (gray[y * width + x] > Math.max(localMean * 1.1, mean * 1.05)) {
          mask[y * width + x] = 1;
        }
      }
    }

    // Step 3: Morphological cleanup
    morphClose(mask, width, height);
    morphOpen(mask, width, height);

    // Step 4: Connected component labeling
    const { count } = labelComponents(mask, width, height);

    // Step 5: Symmetry check (approx)
    let leftCount = 0, rightCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x]) {
          if (x < width / 2) leftCount++; else rightCount++;
        }
      }
    }
    const symmetry = 1 - Math.abs(leftCount - rightCount) / (leftCount + rightCount + 1);

    // Step 6: Compute final score
    const alignmentScore = Math.min(1, count / 28);
    const score = 100 * 0.5 * alignmentScore + 100 * 0.3 * symmetry + 20; // weighted
    return Math.max(0, Math.min(100, score));
  }

  function normalizeImage(imageData) {
    const { data } = imageData;
    let min = 255, max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    const range = max - min || 1;
    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        let norm = (data[i + j] - min) / range * 255;
        data[i + j] = Math.max(0, Math.min(255, norm));
      }
    }
  }

  function morphClose(mask, w, h) {
    // Fill small gaps (dilation then erosion)
    const temp = mask.slice();
    for (let i = 0; i < w * h; i++) {
      if (mask[i]) continue;
      // check neighbors
      let hasNeighbor = false;
      for (const n of [i - 1, i + 1, i - w, i + w]) {
        if (n >= 0 && n < w * h && mask[n]) { hasNeighbor = true; break; }
      }
      if (hasNeighbor) temp[i] = 1;
    }
    temp.forEach((v, i) => mask[i] = v);
  }

  function morphOpen(mask, w, h) {
    // Remove small noise (erosion then dilation)
    const temp = mask.slice();
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue;
      let isolated = true;
      for (const n of [i - 1, i + 1, i - w, i + w]) {
        if (n >= 0 && n < w * h && mask[n]) { isolated = false; break; }
      }
      if (isolated) temp[i] = 0;
    }
    temp.forEach((v, i) => mask[i] = v);
  }

  function labelComponents(mask, w, h) {
    const labels = new Int32Array(w * h).fill(0);
    let label = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (mask[idx] && labels[idx] === 0) {
          label++;
          const stack = [idx];
          labels[idx] = label;
          while (stack.length) {
            const p = stack.pop();
            for (const n of [p - 1, p + 1, p - w, p + w]) {
              if (n >= 0 && n < w * h && mask[n] && labels[n] === 0) {
                labels[n] = label;
                stack.push(n);
              }
            }
          }
        }
      }
    }
    return { labels, count: label };
  }
});
