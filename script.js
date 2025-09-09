// script.js with Debug Overlays for Smile Analysis

document.addEventListener('DOMContentLoaded', () => {
  const imageUpload = document.getElementById('image-upload');
  const analyzeBtn = document.getElementById('analyze-btn');
  const imagePreview = document.getElementById('image-preview');
  const resultsImage = document.getElementById('results-image');
  const analysisJson = document.getElementById('analysis-json');
  const detectedIssuesList = document.getElementById('detected-issues-list');
  const discountPercent = document.getElementById('discount-percent');
  const resultsSection = document.getElementById('results-section');

  let uploadedFile = null;

  imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadedFile = file;
      analyzeBtn.disabled = false;

      const reader = new FileReader();
      reader.onload = (event) => {
        imagePreview.innerHTML = `<canvas id="preview-canvas" class="w-full h-full object-contain rounded-xl"></canvas>`;
        const img = new Image();
        img.onload = () => {
          const canvas = document.getElementById('preview-canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
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
