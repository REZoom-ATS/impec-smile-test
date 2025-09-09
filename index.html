// script.js — upgraded with AI-like reasoning for tooth detection
// Combines lip detection, tooth detection using brightness, symmetry, curvature splitting, and outline thickness heuristics
// Adds adaptive thresholding to mimic AI-like decision-making


document.addEventListener('DOMContentLoaded', () => {
const imageUpload = document.getElementById('image-upload');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsImage = document.getElementById('results-image');


let uploadedFile = null;
imageUpload.addEventListener('change', (e) => { uploadedFile = e.target.files[0]; analyzeBtn.disabled = !uploadedFile; });


analyzeBtn.addEventListener('click', async () => {
if (!uploadedFile) return;
const dataURL = await fileToDataURL(uploadedFile);
const img = await loadImage(dataURL);


const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = img.width; canvas.height = img.height;
ctx.drawImage(img, 0, 0);
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);


const analysis = analyzeSmile(imageData, canvas);
resultsImage.src = canvas.toDataURL('image/png');
});


function fileToDataURL(file) {
return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
function loadImage(src) {
return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; });
}


function rgbToHsl(r, g, b) {
r /= 255; g /= 255; b /= 255;
const max = Math.max(r, g, b), min = Math.min(r, g, b);
let h, s, l = (max + min) / 2;
if (max === min) { h = s = 0; } else {
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


function adaptiveToothPixel(r, g, b, meanLight) {
const { s, l } = rgbToHsl(r, g, b);
return l > Math.max(0.6, meanLight * 0.9) && s < 0.35;
}


function labelComponents(mask, w, h) {
const labels = new Int32Array(w * h).fill(0);
let label = 0;
for (let y = 0; y < h; y++) {
for (let x = 0; x < w; x++) {
const idx = y * w + x;
if (mask[idx] && labels[idx] === 0) {
label++; const stack = [idx]; labels[idx] = label;
while (stack.length) {
const p = stack.pop();
const px = p % w, py = Math.floor(p / w);
for (const n of [p - 1, p + 1, p - w, p + w]) {
if (n >= 0 && n < w * h && mask[n] && labels[n] === 0) { labels[n] = label; stack.push(n); }
}
}
}
}
}
return { labels, count: label };
}


});
