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

    const lipAnalysisEl = document.getElementById('lip-analysis');
    const teethColorAnalysisEl = document.getElementById('teeth-color-analysis');
    const gapsAnalysisEl = document.getElementById('gaps-analysis');
    const alignmentAnalysisEl = document.getElementById('alignment-analysis');
    const overbiteCrossbiteAnalysisEl = document.getElementById('overbite-crossbite-analysis');

    let uploadedFile = null;

    // --- AI Analysis Logic (Simulated) ---
    function analyzeSmile(imageData) {
        console.log("Starting smile analysis on image data...");

        // In a real-world scenario, you would send this image data to a server-side
        // model or use a client-side library like TensorFlow.js for analysis.
        // This function simulates the results based on your specified logic.

        const results = {
            lip_identified: Math.random() > 0.1, // 90% chance of being identified
            teeth_color_score: Math.floor(Math.random() * 60) + 40, // Score from 40-100
            gaps_detected: Math.random() > 0.5, // 50% chance of gaps
            alignment_score: Math.floor(Math.random() * 60) + 40, // Score from 40-100
            overbite_detected: Math.random() > 0.7, // 30% chance of overbite
            crossbite_detected: Math.random() > 0.7 // 30% chance of crossbite
        };

        // Calculate the final score based on the analysis
        let finalScore = 100;
        let analysisText = {
            lips: "Lips could not be clearly identified as a canopy.",
            teethColor: "The brightness of your teeth could not be determined.",
            gaps: "No gaps were detected between your teeth. Great!",
            alignment: "Teeth alignment is symmetric and well-aligned.",
            overbiteCrossbite: "No overbite or crossbite issues were detected."
        };

        if (results.lip_identified) {
            finalScore -= 5; // A small deduction for not being perfect
            analysisText.lips = "Lips were successfully identified as a canopy. Excellent!";
        } else {
            finalScore -= 20;
        }

        if (results.teeth_color_score < 70) {
            finalScore -= (70 - results.teeth_color_score) * 0.5;
            analysisText.teethColor = `Teeth brightness is moderate, with some darker shades of grey. A more brilliant white would improve your smile.`;
        } else {
             analysisText.teethColor = `Your teeth are a beautiful bright white with minimal darker outlines.`;
        }
        
        if (results.gaps_detected) {
            finalScore -= 20;
            analysisText.gaps = "Gaps were detected between your teeth. This can be improved with orthodontic treatment.";
        }
        
        if (results.alignment_score < 80) {
            finalScore -= (80 - results.alignment_score) * 0.7;
            analysisText.alignment = `Your teeth show signs of misalignment. Symmetry can be improved with a treatment plan.`;
        }
        
        if (results.overbite_detected && !results.crossbite_detected) {
            finalScore -= 15;
            analysisText.overbiteCrossbite = "An overbite was detected. The upper teeth outlines are longer than the lower ones.";
        } else if (results.crossbite_detected && !results.overbite_detected) {
            finalScore -= 15;
            analysisText.overbiteCrossbite = "A crossbite was detected. The lower teeth outlines are longer than the upper ones.";
        } else if (results.overbite_detected && results.crossbite_detected) {
            finalScore -= 25;
            analysisText.overbiteCrossbite = "Both overbite and crossbite signs were detected, indicating a complex alignment issue.";
        }

        // Ensure the score is within a valid range
        if (finalScore < 0) finalScore = 0;
        if (finalScore > 100) finalScore = 100;

        return { score: Math.round(finalScore), summary: analysisText };
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
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageData = event.target.result;
                const analysisResult = analyzeSmile(imageData);

                const { score, summary } = analysisResult;

                let discount = (100 - score);

                // Cap the discount to be within the 10-40% range
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

                // Display detailed analysis summary
                lipAnalysisEl.textContent = summary.lips;
                teethColorAnalysisEl.textContent = summary.teethColor;
                gapsAnalysisEl.textContent = summary.gaps;
                alignmentAnalysisEl.textContent = summary.alignment;
                overbiteCrossbiteAnalysisEl.textContent = summary.overbiteCrossbite;

                uploadSection.classList.add('hidden');
                resultsSection.classList.remove('hidden');
            };
            reader.readAsDataURL(uploadedFile);

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
