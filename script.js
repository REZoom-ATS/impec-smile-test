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

    // --- AI Analysis Logic (Simulated with TensorFlow.js) ---
    async function analyzeSmile(image) {
        console.log("Starting smile analysis on image data...");

        // Load the FaceMesh model
        // In a real app, you'd load this once and reuse it.
        const model = await facemesh.load({ maxFaces: 1 });

        // Pass the image to the model for facial landmark detection
        const predictions = await model.estimateFaces(image);
        
        // This is a simulated prediction since we cannot access the model's true output
        const hasLipLandmarks = predictions.length > 0;
        const hasTeethLandmarks = hasLipLandmarks && Math.random() > 0.1;
        const hasPerfectAlignment = hasTeethLandmarks && Math.random() > 0.4;
        const hasGaps = hasTeethLandmarks && Math.random() > 0.5;
        const hasOverbite = hasTeethLandmarks && Math.random() > 0.7;

        // Calculate a simulated score
        let score = 100;
        if (!hasLipLandmarks) score -= 20;
        if (!hasTeethLandmarks) score -= 30;
        if (!hasPerfectAlignment) score -= 25;
        if (hasGaps) score -= 20;
        if (hasOverbite) score -= 15;

        if (score < 10) score = 10;
        if (score > 100) score = 100;
        score = Math.round(score);

        return {
            score: score,
            landmarks: hasTeethLandmarks ? predictions[0].scaledMesh : null
        };
    }

    function drawAnalysisOverlay(canvas, image, landmarks) {
        const ctx = canvas.getContext('2d');
        const imgWidth = image.naturalWidth;
        const imgHeight = image.naturalHeight;
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        const scaleX = canvasWidth / imgWidth;
        const scaleY = canvasHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!landmarks) return;

        // Draw simulated lips as a pink canopy
        ctx.strokeStyle = '#E91E63'; // Pink for lips
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        // This is a placeholder for drawing the lip contour
        // In a real implementation, you would use the specific landmarks for the lips
        const lipPoints = [
            landmarks[61], landmarks[146], landmarks[91], landmarks[181], landmarks[84], landmarks[17],
            landmarks[314], landmarks[405], landmarks[321], landmarks[375]
        ];
        
        ctx.moveTo(lipPoints[0][0] * scale, lipPoints[0][1] * scale);
        for(let i = 1; i < lipPoints.length; i++) {
            ctx.lineTo(lipPoints[i][0] * scale, lipPoints[i][1] * scale);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw simulated teeth
        ctx.strokeStyle = '#FFFFFF'; // White for teeth outlines
        ctx.fillStyle = '#f0f0f0'; // Lighter white for the inner part
        ctx.lineWidth = 2;

        const teeth = [
            // Simulating coordinates for the upper teeth
            { outline: [[160, 240], [175, 240], [175, 260], [160, 260]], inner: [[162, 242], [173, 242], [173, 258], [162, 258]] },
            { outline: [[180, 240], [195, 240], [195, 260], [180, 260]], inner: [[182, 242], [193, 242], [193, 258], [182, 258]] },
            { outline: [[200, 240], [215, 240], [215, 260], [200, 260]], inner: [[202, 242], [213, 242], [213, 258], [202, 258]] },
            { outline: [[220, 240], [235, 240], [235, 260], [220, 260]], inner: [[222, 242], [233, 242], [233, 258], [222, 258]] },
            // Simulating coordinates for the lower teeth
            { outline: [[170, 270], [185, 270], [185, 290], [170, 290]], inner: [[172, 272], [183, 272], [183, 288], [172, 288]] },
            { outline: [[190, 270], [205, 270], [205, 290], [190, 290]], inner: [[192, 272], [203, 272], [203, 288], [192, 288]] },
            { outline: [[210, 270], [225, 270], [225, 290], [210, 290]], inner: [[212, 272], [223, 272], [223, 288], [212, 288]] },
        ];

        teeth.forEach(tooth => {
            // Draw the inner, brighter part
            ctx.fillStyle = '#f0f0f0';
            ctx.beginPath();
            ctx.moveTo(tooth.inner[0][0] * scale, tooth.inner[0][1] * scale);
            for(let i = 1; i < tooth.inner.length; i++) {
                ctx.lineTo(tooth.inner[i][0] * scale, tooth.inner[i][1] * scale);
            }
            ctx.closePath();
            ctx.fill();

            // Draw the darker outline
            ctx.strokeStyle = '#A9A9A9';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tooth.outline[0][0] * scale, tooth.outline[0][1] * scale);
            for(let i = 1; i < tooth.outline.length; i++) {
                ctx.lineTo(tooth.outline[i][0] * scale, tooth.outline[i][1] * scale);
            }
            ctx.closePath();
            ctx.stroke();
        });
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
});
