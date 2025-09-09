// script.js — updated: client-side smile analysis with lips/teeth/tooth detection & overlays

document.addEventListener('DOMContentLoaded', () => {
    const formSection = document.getElementById('form-section');
    const uploadSection = document.getElementById('upload-section');
    const resultsSection = document.getElementById('results-section');
    const formCompleteBtn = document.getElementById('form-complete-btn');
    const imageUpload = document.getElementById('image-upload');
    const cameraBtn = document.getElementById('camera-btn');
    const imagePreview = document.getElementById('image-preview');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultsImage = document.getElementById('results-image');
    const smileScoreDisplay = document.getElementById('smile-score-display');
    const discountPercent = document.getElementById('discount-percent');
    const whatsappLink = document.getElementById('whatsapp-link');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    let uploadedFile = null;

    // -------------------------
    // UI handlers (existing)
    // -------------------------
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

    // -------------------------
    // Main Analysis Entry Point
    // -------------------------
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
            const dataURL = await fileToDataURL(uploadedFile);
            const img = await loadImage(dataURL);

            const canvasOutput = document.createElement('canvas');
            const ctx = canvasOutput.getContext('2d');

            // Resize to a manageable size while preserving aspect ratio
            const maxDim = 900;
            let scale = 1;
            if (img.width > maxDim || img.height > maxDim) {
                scale = Math.min(maxDim / img.width, maxDim / img.height);
            }
            canvasOutput.width = Math.round(img.width * scale);
            canvasOutput.height = Math.round(img.height * scale);
            ctx.drawImage(img, 0, 0, canvasOutput.width, canvasOutput.height);

            const imageData = ctx.getImageData(0, 0, canvasOutput.width, canvasOutput.height);

            // Run the analysis — returns overlay canvas (drawn on same canvas) and metrics
            const analysis = analyzeSmile(imageData, canvasOutput);

            // Put the overlay result into the results-image preview
            resultsImage.src = canvasOutput.toDataURL('image/png');

            // Compute a smile score (heuristic blend of features)
            const smileScore = computeSmileScore(analysis.metrics);
            let discount = (100 - smileScore);
            if (discount < 10) discount = 10;
            if (discount > 40) discount = 40;

            smileScoreDisplay.textContent = `${Math.round(smileScore)}%`;
            discountPercent.textContent = `${Math.round(discount)}%`;
            whatsappLink.href = `https://wa.me/916005795693?text=Hi, I just finished the Impec Smile Challenge. Here is my analysis.`;

            uploadSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
        } catch (error) {
            console.error("Analysis failed:", error);
            showModal("Analysis Error", "We encountered a technical issue. Please try again.");
        } finally {
            analyzeBtn.textContent = 'Analyze My Smile';
            analyzeBtn.disabled = false;
            analyzeBtn.classList.remove('cursor-not-allowed');
            analyzeBtn.classList.add('hover:bg-[#c2185b]');
        }
    });

    // -------------------------
    // Utility helpers
    // -------------------------
    function fileToDataURL(file) {
        return new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });
    }

    function loadImage(dataURL) {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = dataURL;
        });
    }

    // Convert RGB to HSL (0..1 values)
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h, s, l };
    }

    // Heuristics: is this pixel a lip color? (pink/purple canopy)
    function isLipPixel(r, g, b) {
        const { h, s, l } = rgbToHsl(r, g, b);
        // pink/purple hues ~ 300..350/0..0.9 and 300..360 also includes red-pink; but H is 0..1 so convert to degrees:
        const hueDeg = h * 360;
        // Accept pinks and purples: approx 260° (purple) to 25° (pink/red) wrapping around
        // We'll accept either: hue in [260,360] OR [0,40], with sufficient saturation and medium lightness
        const satOkay = s > 0.25;
        const lightOkay = l > 0.08 && l < 0.85; // not too dark or blown out
        const hueOkay = (hueDeg >= 260 && hueDeg <= 360) || (hueDeg >= 0 && hueDeg <= 40);
        return hueOkay && satOkay && lightOkay;
    }

    // Heuristics: is this pixel tooth-white? (high lightness, low saturation)
    function isToothPixel(r, g, b) {
        const { s, l } = rgbToHsl(r, g, b);
        // white-ish: high lightness, low-to-medium saturation
        // thresholds may need tuning
        return l > 0.75 && s < 0.35;
    }

    // Is this pixel dark (gap/space)? (low lightness)
    function isDarkPixel(r, g, b) {
        const { l } = rgbToHsl(r, g, b);
        return l < 0.2;
    }

    // Flood fill / connected component labeling (4-connected)
    function labelConnectedComponents(binaryMask, width, height) {
        // binaryMask: Uint8Array of 0/1 for pixel inclusion, length = width*height
        const labels = new Int32Array(width * height).fill(0);
        let currentLabel = 0;
        const neighbors = [-1, 1, -width, width]; // left, right, up, down offsets (careful at boundaries)
        const idx = (x, y) => y * width + x;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const p = idx(x, y);
                if (binaryMask[p] && labels[p] === 0) {
                    currentLabel++;
                    // BFS stack
                    const stack = [p];
                    labels[p] = currentLabel;
                    while (stack.length) {
                        const cur = stack.pop();
                        const cx = cur % width;
                        const cy = Math.floor(cur / width);
                        // neighbor 4-connected
                        if (cx > 0) {
                            const n = cur - 1;
                            if (binaryMask[n] && labels[n] === 0) { labels[n] = currentLabel; stack.push(n); }
                        }
                        if (cx < width - 1) {
                            const n = cur + 1;
                            if (binaryMask[n] && labels[n] === 0) { labels[n] = currentLabel; stack.push(n); }
                        }
                        if (cy > 0) {
                            const n = cur - width;
                            if (binaryMask[n] && labels[n] === 0) { labels[n] = currentLabel; stack.push(n); }
                        }
                        if (cy < height - 1) {
                            const n = cur + width;
                            if (binaryMask[n] && labels[n] === 0) { labels[n] = currentLabel; stack.push(n); }
                        }
                    }
                }
            }
        }

        return { labels, count: currentLabel };
    }

    // Compute bounding box and centroid for each label
    function extractComponents(labels, count, width, height) {
        const comps = [];
        for (let i = 0; i < count; i++) {
            comps.push({ minX: width, minY: height, maxX: 0, maxY: 0, area: 0, sumX: 0, sumY: 0 });
        }
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const lab = labels[idx];
                if (lab > 0) {
                    const c = comps[lab - 1];
                    if (x < c.minX) c.minX = x;
                    if (x > c.maxX) c.maxX = x;
                    if (y < c.minY) c.minY = y;
                    if (y > c.maxY) c.maxY = y;
                    c.area++;
                    c.sumX += x;
                    c.sumY += y;
                }
            }
        }
        // finalize centroid
        for (let i = 0; i < comps.length; i++) {
            const c = comps[i];
            if (c.area === 0) {
                c.cx = 0; c.cy = 0;
            } else {
                c.cx = c.sumX / c.area;
                c.cy = c.sumY / c.area;
            }
        }
        return comps;
    }

    // Main analysis function
    function analyzeSmile(imageData, canvas) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        // Masks
        const lipMask = new Uint8Array(width * height);
        const toothMask = new Uint8Array(width * height);
        const darkMask = new Uint8Array(width * height);

        // Step 1: classify pixels into lip / tooth / dark
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (isLipPixel(r, g, b)) lipMask[p] = 1;
            if (isToothPixel(r, g, b)) toothMask[p] = 1;
            if (isDarkPixel(r, g, b)) darkMask[p] = 1;
        }

        // Step 2: label tooth connected components to find individual teeth
        const toothLabels = labelConnectedComponents(toothMask, width, height);
        const toothComps = extractComponents(toothLabels.labels, toothLabels.count, width, height);

        // Filter out tiny components (noise)
        const minToothArea = Math.max(60, Math.round((width * height) * 0.00005)); // adapt to image size
        const teeth = toothComps
            .map((c, idx) => ({ ...c, label: idx + 1 }))
            .filter(c => c.area >= minToothArea);

        // Step 3: For each tooth, determine inner bright/core vs outline by sampling pixel lightness
        const innerThreshold = 0.9;    // l > 0.9 considered inner bright white (tuneable)
        const outlineLower = 0.7;      // 0.7 < l <= 0.9 considered outline (tuneable)

        const metrics = {
            teethCount: teeth.length,
            teethSymmetryScore: 0,
            gapsDetected: 0,
            overbiteScore: 0,
            innerVsOutlineRatio: 0,
            lipFound: false
        };

        // compute lip bounding box if lips exist
        const lipLabels = labelConnectedComponents(lipMask, width, height);
        const lipComps = extractComponents(lipLabels.labels, lipLabels.count, width, height)
            .map((c, idx) => ({ ...c, label: idx + 1 }))
            .filter(c => c.area > 200); // only sizeable lips
        let lipBox = null;
        if (lipComps.length) {
            // choose largest lip component
            lipComps.sort((a, b) => b.area - a.area);
            const lip = lipComps[0];
            lipBox = { minX: lip.minX, minY: lip.minY, maxX: lip.maxX, maxY: lip.maxY };
            metrics.lipFound = true;
        }

        // For per-tooth brightness analysis, we will sample pixels in bounding box and count inner/outline pixels
        let totalInner = 0, totalOutline = 0;
        const ctx = canvas.getContext('2d');

        for (const tooth of teeth) {
            let innerCount = 0, outlineCount = 0;
            for (let y = tooth.minY; y <= tooth.maxY; y++) {
                for (let x = tooth.minX; x <= tooth.maxX; x++) {
                    const p = y * width + x;
                    // only consider pixels labeled as belonging to this tooth label
                    if (toothLabels.labels[p] !== tooth.label) continue;
                    const i = p * 4;
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const { l } = rgbToHsl(r, g, b);
                    if (l >= innerThreshold) innerCount++;
                    else if (l >= outlineLower) outlineCount++;
                }
            }
            totalInner += innerCount;
            totalOutline += outlineCount;
            tooth.innerCount = innerCount;
            tooth.outlineCount = outlineCount;
            // also compute width and height
            tooth.w = tooth.maxX - tooth.minX + 1;
            tooth.h = tooth.maxY - tooth.minY + 1;
        }

        metrics.innerVsOutlineRatio = totalOutline === 0 ? 1 : totalInner / (totalOutline + 1);

        // Step 4: symmetry — simple left-right matching across image center line
        // We'll compute average x-distance of tooth centroids to vertical center and compare mirror distances
        if (teeth.length >= 2) {
            const centerX = width / 2;
            // sort teeth by cx (left to right)
            const sorted = [...teeth].sort((a, b) => a.cx - b.cx);
            // pair left-right: first with last, second with second-last, etc.
            let symmetryScoreSum = 0;
            let pairs = 0;
            for (let i = 0; i < Math.floor(sorted.length / 2); i++) {
                const left = sorted[i];
                const right = sorted[sorted.length - 1 - i];
                const leftMirrorDist = Math.abs(left.cx - centerX);
                const rightMirrorDist = Math.abs(right.cx - centerX);
                const pairSym = 1 - (Math.abs(leftMirrorDist - rightMirrorDist) / centerX); // 0..1-ish
                symmetryScoreSum += Math.max(0, pairSym);
                pairs++;
            }
            metrics.teethSymmetryScore = pairs ? (symmetryScoreSum / pairs) * 100 : 100;
        } else {
            metrics.teethSymmetryScore = 50; // low confidence
        }

        // Step 5: gap detection — scan between adjacent tooth bounding boxes for dark vertical stripes
        // Collect horizontal slices across teeth Y median
        const sortedTeeth = [...teeth].sort((a, b) => a.cx - b.cx);
        let gapCount = 0;
        for (let i = 0; i < sortedTeeth.length - 1; i++) {
            const a = sortedTeeth[i], b = sortedTeeth[i + 1];
            // Only consider pairs that are close vertically (same row) — if they are on different rows, skip
            const verticalOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
            if (verticalOverlap < Math.min(a.h, b.h) * 0.25) continue;
            // examine the vertical strip between a.maxX and b.minX
            const startX = Math.max(0, a.maxX + 1);
            const endX = Math.min(width - 1, b.minX - 1);
            if (endX <= startX) continue;
            // compute fraction of dark pixels in that strip (only within vertical overlapping y-range)
            const y0 = Math.max(a.minY, b.minY);
            const y1 = Math.min(a.maxY, b.maxY);
            let darkPixels = 0, totalPixels = 0;
            for (let y = y0; y <= y1; y++) {
                for (let x = startX; x <= endX; x++) {
                    totalPixels++;
                    const p = y * width + x;
                    if (darkMask[p]) darkPixels++;
                }
            }
            const darkFrac = totalPixels ? (darkPixels / totalPixels) : 0;
            // If a significant fraction of the inter-tooth strip is dark -> gap
            if (darkFrac > 0.35 && (endX - startX) >= 2) {
                gapCount++;
            }
        }
        metrics.gapsDetected = gapCount;

        // Step 6: overbite/crossbite detection
        // Outline height heuristic: average outline heights of upper teeth vs lower teeth.
        // We define "upper" as teeth with centroid above vertical median of tooth centroids, similarly for lower
        const medianY = teeth.length ? (teeth.reduce((s, t) => s + t.cy, 0) / teeth.length) : height / 2;
        const upperTeeth = teeth.filter(t => t.cy < medianY);
        const lowerTeeth = teeth.filter(t => t.cy >= medianY);

        // Function to estimate outline 'length' as outlineCount / width (approx)
        const upperOutlineLen = upperTeeth.length ? (upperTeeth.reduce((s, t) => s + (t.outlineCount || 0), 0) / upperTeeth.length) : 0;
        const lowerOutlineLen = lowerTeeth.length ? (lowerTeeth.reduce((s, t) => s + (t.outlineCount || 0), 0) / lowerTeeth.length) : 0;

        // If upper outlines are noticeably longer than lower -> possible overbite
        if (upperOutlineLen > lowerOutlineLen * 1.15) {
            metrics.overbiteScore = 100 * Math.min(1, (upperOutlineLen / (lowerOutlineLen + 1)) - 1);
        } else if (lowerOutlineLen > upperOutlineLen * 1.15) {
            // underbite / crossbite (opposite)
            metrics.overbiteScore = -100 * Math.min(1, (lowerOutlineLen / (upperOutlineLen + 1)) - 1);
        } else {
            metrics.overbiteScore = 0;
        }

        // Step 7: visualization overlay on canvas: draw lip canopy, tooth bounding boxes, per-tooth inner/outline colors, gaps highlighted
        // We will draw semi-transparent overlays:
        ctx.lineWidth = Math.max(1, Math.round(Math.min(width, height) * 0.002));

        // Draw lip mask outline if found
        if (lipBox) {
            ctx.strokeStyle = 'rgba(180, 0, 120, 0.9)'; // strong pink/purple
            ctx.fillStyle = 'rgba(225, 115, 200, 0.12)';
            ctx.beginPath();
            ctx.rect(lipBox.minX, lipBox.minY, lipBox.maxX - lipBox.minX + 1, lipBox.maxY - lipBox.minY + 1);
            ctx.fill();
            ctx.stroke();
        }

        // Draw teeth bounding boxes and mark inner vs outline brightness
        ctx.font = `${Math.max(10, Math.round(width * 0.02))}px Arial`;
        ctx.textAlign = 'center';
        let toothIndex = 1;
        for (const tooth of teeth) {
            // color mapping: inner-dominant -> green-ish overlay; outline-dominant -> orange
            const ratio = (tooth.innerCount || 0) / (tooth.outlineCount + 1);
            const green = Math.min(200, Math.round(180 * Math.min(1, ratio))); // more inner => greener
            const red = 220 - green;
            ctx.strokeStyle = `rgba(${red},${green},60,0.95)`;
            ctx.fillStyle = `rgba(${red},${green},60,0.18)`;
            ctx.beginPath();
            ctx.rect(tooth.minX, tooth.minY, tooth.w, tooth.h);
            ctx.fill();
            ctx.stroke();
            // Draw centroid marker
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillText(String(toothIndex), tooth.cx, Math.max(tooth.minY - 6, 10));
            toothIndex++;
        }

        // Highlight gaps (re-compute visually)
        ctx.strokeStyle = 'rgba(30,30,30,0.9)';
        ctx.fillStyle = 'rgba(20,20,20,0.45)';
        for (let i = 0; i < sortedTeeth.length - 1; i++) {
            const a = sortedTeeth[i], b = sortedTeeth[i + 1];
            const startX = Math.max(0, a.maxX + 1);
            const endX = Math.min(width - 1, b.minX - 1);
            if (endX <= startX) continue;
            const y0 = Math.max(a.minY, b.minY);
            const y1 = Math.min(a.maxY, b.maxY);
            // compute dark fraction quick
            let darkPixels = 0, totalPixels = 0;
            for (let y = y0; y <= y1; y++) {
                for (let x = startX; x <= endX; x++) {
                    totalPixels++;
                    const p = y * width + x;
                    if (darkMask[p]) darkPixels++;
                }
            }
            const darkFrac = totalPixels ? (darkPixels / totalPixels) : 0;
            if (darkFrac > 0.35 && (endX - startX) >= 2) {
                ctx.beginPath();
                ctx.rect(startX, y0, endX - startX + 1, y1 - y0 + 1);
                ctx.fill();
                ctx.stroke();
            }
        }

        // Annotate summary metrics on top-left
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(8, 8, Math.min(320, width * 0.45), 80);
        ctx.fillStyle = 'black';
        ctx.font = `${Math.max(10, Math.round(width * 0.018))}px Arial`;
        const lines = [
            `Teeth detected: ${teeth.length}`,
            `Gaps: ${metrics.gapsDetected}`,
            `Symmetry: ${Math.round(metrics.teethSymmetryScore)}%`,
            metrics.overbiteScore > 5 ? `Overbite indicator` : (metrics.overbiteScore < -5 ? `Underbite indicator` : `Bite: neutral`)
        ];
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], 20 + (Math.min(320, width * 0.45) / 2), 28 + i * 18);
        }

        // final metrics returned
        return { metrics: metrics, annotatedCanvas: canvas };
    }

    // Heuristic scoring: combine various metrics to a 0..100 smile score
    function computeSmileScore(metrics) {
        // Base 100, subtract penalties:
        // penalize gaps, asymmetry, unfavorable inner-outline ratio, and overbite indication
        let score = 100;

        // gaps: each gap penalizes significantly
        score -= Math.min(30, metrics.gapsDetected * 8);

        // symmetry: ideal is high symmetry; reduce if low
        score -= Math.max(0, (100 - (metrics.teethSymmetryScore || 50)) * 0.25);

        // inner vs outline: prefer more inner bright area
        const idealRatio = 1.6; // inner/outline desired
        const ratio = metrics.innerVsOutlineRatio || 1;
        if (ratio < idealRatio) {
            score -= Math.min(20, (idealRatio - ratio) * 10);
        }

        // overbite: positive or negative magnitude reduces score moderately
        score -= Math.min(20, Math.abs(metrics.overbiteScore) * 0.12);

        // lip not found -> lower confidence
        if (!metrics.lipFound) score -= 8;

        // clamp
        if (score < 20) score = 20;
        if (score > 100) score = 100;
        return score;
    }
});
