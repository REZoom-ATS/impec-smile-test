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

    // --- AI Analysis Logic (Simulated for client-side) ---
    async function predictOrthodonticIssues() {
        // This is a simulated prediction function that provides a realistic range of scores.
        console.log("Making a prediction...");

        // Define a base score for a "perfect" smile
        let finalScore = 100;

        // Simulate a number of issues to detect (from 1 to 4)
        const numIssuesToDetect = Math.floor(Math.random() * 4) + 1;

        // Simulate deduction of points for each issue
        for (let i = 0; i < numIssuesToDetect; i++) {
            const deduction = Math.floor(Math.random() * 20) + 5; // Deduct between 5 and 25 points
            finalScore -= deduction;
        }

        // Ensure the score doesn't fall below a minimum
        if (finalScore < 50) {
            finalScore = 50;
        }

        return finalScore;
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
            const smileScore = await predictOrthodonticIssues();
            let discount = (100 - smileScore);

            // Cap the discount to be within the 10-40% range
            if (discount < 10) {
                discount = 10;
            }
            if (discount > 40) {
                discount = 40;
            }

            smileScoreDisplay.textContent = `${smileScore}%`;
            discountPercent.textContent = `${discount}%`;
            whatsappLink.href = `https://wa.me/916005795693?text=Hi, I just finished the Impec Smile Challenge. Here is a screenshot of my results. I need a review.`;

            // Update the results image and hide the upload section
            resultsImage.src = URL.createObjectURL(uploadedFile);
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
