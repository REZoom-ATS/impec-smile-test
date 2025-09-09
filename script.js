document.addEventListener('DOMContentLoaded', () => {
    const formSection = document.getElementById('form-section');
    const uploadSection = document.getElementById('upload-section');
    const resultsSection = document.getElementById('results-section');
    const formCompleteBtn = document.getElementById('form-complete-btn');
    const imageUpload = document.getElementById('image-upload');
    const cameraBtn = document.getElementById('camera-btn');
    const imagePreview = document.getElementById('image-preview');
    const analyzeBtn = document.getElementById('analyze-btn');
    const smileScoreDisplay = document.getElementById('smile-score-display');
    const discountPercent = document.getElementById('discount-percent');
    const whatsappLink = document.getElementById('whatsapp-link');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const resultsImage = document.getElementById('results-image');
    const overlayCanvas = document.getElementById('overlay-canvas');
    const resultsCanvas = document.getElementById('results-canvas');

    let uploadedFile = null;
    let model = null;

    // Load the FaceMesh model once at the beginning
    async function loadModel() {
        if (!model) {
            console.log("Loading FaceMesh model...");
            model = await facemesh.load({ maxFaces: 1 });
            console.log("Model loaded successfully.");
        }
    }

    // --- AI Analysis Logic (Simulated with TensorFlow.js) ---
    async function analyzeSmile(image) {
        console.log("Starting smile analysis on image data...");

        if (!model) {
            showModal("Model not loaded", "Please try again in a moment as the model is still loading.");
            return { score: 0, landmarks: null };
        }

        try {
            const predictions = await model.estimateFaces(image);

            // If a face is detected, proceed with the analysis
            if (predictions.length > 0) {
                const landmarks = predictions[0].scaledMesh;

                // --- Start of Smile Analysis Logic ---
                // This is a simulated score and evaluation based on your criteria,
                // but using the real landmarks for drawing.

                // Simulate detection of key facial landmarks for lips and teeth
                const hasLipLandmarks = landmarks.length > 0;
                const hasTeethLandmarks = hasLipLandmarks; // Assume teeth are part of the mouth landmarks

                // Calculate a simulated score based on a few random factors to
                // demonstrate the analysis logic you described
                let score = 100;
                let hasGaps = Math.random() > 0.7; // 30% chance of gaps
                let hasOverbite = Math.random() > 0.8; // 20% chance of overbite

                if (hasGaps) score -= 20;
                if (hasOverbite) score -= 15;
                if (Math.random() > 0.5) score -= 10; // 50% chance of imperfect brightness

                score = Math.max(10, Math.min(100, Math.round(score)));

                return { score: score, landmarks: landmarks, hasGaps: hasGaps, hasOverbite: hasOverbite };

            } else {
                // If no face is detected
                return { score: 0, landmarks: null };
            }

        } catch (error) {
            console.error("TensorFlow analysis failed:", error);
            showModal("Analysis Error", "Failed to analyze the image. Please try a different photo.");
            return { score: 0, landmarks: null };
        }
    }

    function drawAnalysisOverlay(canvas, image, landmarks) {
        const ctx = canvas.getContext('2d');
        const imgWidth = image.naturalWidth;
        const imgHeight = image.naturalHeight;
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Calculate scaling to fit image in canvas while maintaining aspect ratio
        const scale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight);
        const offsetX = (canvasWidth - imgWidth * scale) / 2;
        const offsetY = (canvasHeight - imgHeight * scale) / 2;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!landmarks) return;

        // Draw the lips as a pink canopy
        ctx.strokeStyle = '#E91E63'; // Pink for lips
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        // FaceMesh landmarks for inner and outer lips
        const outerLips = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375];
        ctx.moveTo(landmarks[outerLips[0]][0] * scale + offsetX, landmarks[outerLips[0]][1] * scale + offsetY);
        for(let i = 1; i < outerLips.length; i++) {
            ctx.lineTo(landmarks[outerLips[i]][0] * scale + offsetX, landmarks[outerLips[i]][1] * scale + offsetY);
        }
        ctx.closePath();
        ctx.stroke();

        // Simulate drawing teeth outlines based on surrounding landmarks
        const teethOutlines = [
            // Example points around the mouth that could be used for teeth
            [10, 308, 292, 402, 17], // Upper teeth region
            [17, 402, 292, 308, 10] // Lower teeth region (simplified)
        ];

        // Draw the inner, brighter part of the teeth
        ctx.fillStyle = '#f0f0f0'; // Lighter white
        ctx.beginPath();
        for (const path of teethOutlines) {
            ctx.moveTo(landmarks[path[0]][0] * scale + offsetX, landmarks[path[0]][1] * scale + offsetY);
            for(let i = 1; i < path.length; i++) {
                ctx.lineTo(landmarks[path[i]][0] * scale + offsetX, landmarks[path[i]][1] * scale + offsetY);
            }
        }
        ctx.closePath();
        ctx.fill();

        // Draw the darker outline
        ctx.strokeStyle = '#A9A9A9'; // Shades of grey
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const path of teethOutlines) {
            ctx.moveTo(landmarks[path[0]][0] * scale + offsetX, landmarks[path[0]][1] * scale + offsetY);
            for(let i = 1; i < path.length; i++) {
                ctx.lineTo(landmarks[path[i]][0] * scale + offsetX, landmarks[path[i]][1] * scale + offsetY);
            }
        }
        ctx.closePath();
        ctx.stroke();
    }

    // --- UI and User Flow Logic ---

    function showModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.classList.remove('hidden');
    }

    modalCloseBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    formCompleteBtn.addEventListener('click', () => {
        formSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
    });

    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadedFile = file;
            analyzeBtn.disabled = false;
            analyzeBtn.classList.remove('bg-gray-200', 'text-gray-700');
            analyzeBtn.classList.add('bg-[#e91e63]', 'text-white', 'hover:bg-[#c2185b]');

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    imagePreview.innerHTML = `<img id="preview-img" src="${event.target.result}" class="w-full h-full object-contain rounded-xl" />`;
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    cameraBtn.addEventListener('click', () => {
        imageUpload.setAttribute('capture', 'camera');
        imageUpload.click();
    });

    analyzeBtn.addEventListener('click', async () => {
        if (!uploadedFile) {
            showModal("No Image Uploaded", "Please upload a photo before analysis.");
            return;
        }

        analyzeBtn.textContent = 'Analyzing...';
        analyzeBtn.disabled = true;
        analyzeBtn.classList.remove('hover:bg-[#c2185b]');
        analyzeBtn.classList.add('cursor-not-allowed');

        try {
            const uploadedImg = document.getElementById('preview-img');
            const analysisResult = await analyzeSmile(uploadedImg);
            const { score, landmarks } = analysisResult;

            let discount = (100 - score);
            if (discount < 10) {
                discount = 10;
            }
            if (discount > 40) {
                discount = 40;
            }

            // Update UI with results
            smileScoreDisplay.textContent = `${score}%`;
            discountPercent.textContent = `${discount}%`;
            whatsappLink.href = `https://wa.me/916005795693?text=Hi, I just finished the Impec Smile Challenge. Here is a screenshot of my results. My score is ${score}%.`;
            
            // Set the result image
            resultsImage.src = URL.createObjectURL(uploadedFile);

            // Draw the overlay on the results canvas
            resultsImage.onload = () => {
                 drawAnalysisOverlay(resultsCanvas, resultsImage, landmarks);
            };

            uploadSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
        } catch (error) {
            console.error("Analysis failed:", error);
            showModal("Analysis Error", "We encountered a technical issue. Please try again.");
        } finally {
            analyzeBtn.textContent = 'Analyze My Smile';
            analyzeBtn.disabled = false;
            analyzeBtn.classList.remove('cursor-not-allowed');
        }
    });

    // Start loading the model as soon as the page loads
    loadModel();
});
  analyzeBtn.addEventListener('click', async () => {
    if (!uploadedFile) return;
    analyzeBtn.textContent = 'Analyzing...';
    analyzeBtn.disabled = true;

    const imgElement = document.createElement('img');
    imgElement.src = URL.createObjectURL(uploadedFile);
    await imgElement.decode();

    const result = await predictOrthodonticIssuesWithDebug(imgElement);

    // Display results
    analysisJson.textContent = JSON.stringify(result, null, 2);
    detectedIssuesList.innerHTML = '';
    if (Object.keys(result.severity).length === 0) {
      detectedIssuesList.innerHTML = `<li class="list-none text-center">${result.findings_summary}</li>`;
    } else {
      for (const issue of Object.keys(result.severity)) {
        const li = document.createElement('li');
        li.textContent = `${issue} (${result.severity[issue]})`;
        detectedIssuesList.appendChild(li);
      }
    }

    resultsImage.src = imgElement.src;
    discountPercent.textContent = `${(100 - result.perfect_smile_percentage) * 0.8}%`;

    resultsSection.classList.remove('hidden');
    analyzeBtn.textContent = 'Analyze My Smile';
    analyzeBtn.disabled = false;
  });
});

async function predictOrthodonticIssuesWithDebug(imageElement) {
  const tensor = tf.browser.fromPixels(imageElement)
    .resizeBilinear([256, 256])
    .toFloat()
    .div(tf.scalar(255));

  const imageData = await tf.browser.toPixels(tensor);
  const width = 256;
  const height = 256;

  function getPixel(i) {
    return [imageData[i], imageData[i + 1], imageData[i + 2]];
  }

  let teethMask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b] = getPixel(idx);
      const brightness = (r + g + b) / 3;
      if (brightness > 200) {
        teethMask[y * width + x] = 1;
      }
    }
  }

  function getClusters(mask) {
    const visited = new Uint8Array(mask.length);
    let clusters = [];

    function floodFill(i, cluster) {
      if (i < 0 || i >= mask.length || visited[i] || mask[i] === 0) return;
      visited[i] = 1;
      cluster.push(i);
      const neighbors = [i - 1, i + 1, i - width, i + width];
      neighbors.forEach(n => floodFill(n, cluster));
    }

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1 && !visited[i]) {
        let cluster = [];
        floodFill(i, cluster);
        clusters.push(cluster);
      }
    }
    return clusters;
  }

  const toothClusters = getClusters(teethMask).filter(c => c.length > 30);
  const toothPositions = toothClusters.map(cluster => {
    let xs = cluster.map(i => i % width);
    let ys = cluster.map(i => Math.floor(i / width));
    return {
      x: xs.reduce((a, b) => a + b) / xs.length,
      y: ys.reduce((a, b) => a + b) / ys.length,
      cluster
    };
  }).sort((a, b) => a.x - b.x);

  // Draw debug overlay
  drawTeethOverlay(toothPositions, width, height);

  let issues = {};
  let perfectSmileScore = 100;

  for (let i = 0; i < toothPositions.length - 1; i++) {
    const gap = toothPositions[i + 1].x - toothPositions[i].x;
    if (gap > 25) {
      issues['Spacing'] = 'Mild';
      perfectSmileScore -= 5;
    }
  }

  const upperTeeth = toothPositions.filter(p => p.y < height / 2);
  const lowerTeeth = toothPositions.filter(p => p.y >= height / 2);
  if (upperTeeth.length > 4 && lowerTeeth.length > 4) {
    const avgUpperY = upperTeeth.reduce((a, p) => a + p.y, 0) / upperTeeth.length;
    const avgLowerY = lowerTeeth.reduce((a, p) => a + p.y, 0) / lowerTeeth.length;
    if (avgUpperY > avgLowerY - 20) {
      issues['Overbite'] = 'Moderate';
      perfectSmileScore -= 15;
    }
  }
  if (toothClusters.length < 12) {
    issues['Crowding'] = 'Moderate';
    perfectSmileScore -= 15;
  }

  if (perfectSmileScore < 0) perfectSmileScore = 0;

  return {
    case_classification: Object.keys(issues).join(' + ') || 'No Orthodontic Treatment Required',
    severity: issues,
    findings_summary: Object.keys(issues).length ? Object.entries(issues).map(([k,v]) => `${v} ${k}`).join(', ') : 'No significant orthodontic issues detected.',
    perfect_smile_percentage: perfectSmileScore
  };
}

function drawTeethOverlay(toothPositions, width, height) {
  const canvas = document.getElementById('preview-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;

  toothPositions.forEach(pos => {
    const minX = Math.min(...pos.cluster.map(i => i % width));
    const maxX = Math.max(...pos.cluster.map(i => i % width));
    const minY = Math.min(...pos.cluster.map(i => Math.floor(i / width)));
    const maxY = Math.max(...pos.cluster.map(i => Math.floor(i / width)));
    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    ctx.strokeRect(minX, minY, boxWidth, boxHeight);
  });
}
