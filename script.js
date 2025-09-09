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
