const canvas = document.getElementById('scribbleCanvas');
const ctx = canvas.getContext('2d');

// Store the saved image data URL and previous scale factor
let savedImage = null;
let scaleFactor = 1;  // Initial scale factor

// Resize the canvas to match the window size
function resizeCanvas() {
    // Calculate the scale factor based on the new window size
    const newScaleFactor = window.innerWidth / canvas.width;

    // If the scale factor changes, redraw the saved content with the new scale
    if (newScaleFactor !== scaleFactor) {
        scaleFactor = newScaleFactor;

        // Save current drawing to an image before resizing
        if (canvas.width && canvas.height) {
            savedImage = canvas.toDataURL(); // Save the current canvas state as an image
        }

        // Resize canvas
        canvas.width = window.innerWidth;  // Set canvas width to window's width
        canvas.height = window.innerHeight - 50;  // Set canvas height, leaving space for the button

        // If there was previous drawing, restore and scale it
        if (savedImage) {
            const img = new Image();
            img.onload = function () {
                // Redraw the saved image scaled according to the new size
                ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // Scale the image to the new size
            };
            img.src = savedImage;
        }
    }
}

// Resize the canvas whenever the window is resized
window.addEventListener('resize', resizeCanvas);

// Initialize canvas size and scaling
resizeCanvas();

// Variables to track drawing state
let drawing = false;
let lastX = 0;
let lastY = 0;

// Start drawing when mouse is pressed
canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];  // Get mouse position on canvas
});

// Stop drawing when mouse is released
canvas.addEventListener('mouseup', () => {
    drawing = false;
});

// Draw on the canvas when mouse is moved
canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

// Clear button functionality
document.getElementById('clearButton').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);  // Clear the entire canvas
    savedImage = null; // Reset the saved image to clear history
});
