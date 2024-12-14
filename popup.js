const canvas = document.getElementById('scribbleCanvas');
const ctx = canvas.getContext('2d');

// Resize the canvas to fit the window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 50;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Set canvas properties
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.lineWidth = 5; // Adjust thickness
ctx.strokeStyle = '#000'; // Line color

let drawing = false;
let points = []; // Track points for the current stroke
let undoStack = []; // Stack for undo states
let redoStack = []; // Stack for redo states

// Save the current canvas state to the undo stack
function saveStateToUndo() {
    if (undoStack.length > 20) {
        // Limit stack size to avoid excessive memory usage
        undoStack.shift();
    }
    undoStack.push(canvas.toDataURL());
    redoStack = []; // Clear redo stack whenever a new action is performed
}

// Restore a canvas state from a data URL
function restoreCanvasFromState(state) {
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = state;
}

// Undo the last action
function undo() {
    if (undoStack.length > 0) {
        const lastState = undoStack.pop();
        redoStack.push(canvas.toDataURL()); // Save current state for redo
        restoreCanvasFromState(lastState);
    }
}

// Redo the last undone action
function redo() {
    if (redoStack.length > 0) {
        const redoState = redoStack.pop();
        undoStack.push(canvas.toDataURL()); // Save current state for undo
        restoreCanvasFromState(redoState);
    }
}

// Start drawing
function startDrawing(x, y) {
    drawing = true;
    points = [{ x, y }]; // Start tracking points
    saveStateToUndo(); // Save the canvas state before drawing
}

// Stop drawing
function stopDrawing() {
    if (drawing) {
        drawing = false;
        points = []; // Reset points for the next stroke
    }
}

// Draw on the canvas
function draw(x, y) {
    if (!drawing) return;

    // Add the new point
    points.push({ x, y });

    // If we have enough points, start drawing
    if (points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        // Create a smooth curve
        for (let i = 1; i < points.length - 1; i++) {
            const midPoint = {
                x: (points[i].x + points[i + 1].x) / 2,
                y: (points[i].y + points[i + 1].y) / 2,
            };
            ctx.quadraticCurveTo(points[i].x, points[i].y, midPoint.x, midPoint.y);
        }

        // Connect to the latest point
        const lastPoint = points[points.length - 2];
        const lastMidPoint = {
            x: (lastPoint.x + x) / 2,
            y: (lastPoint.y + y) / 2,
        };
        ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, lastMidPoint.x, lastMidPoint.y);

        // Stroke the path
        ctx.stroke();
    }
}

// Event listeners for mouse events
canvas.addEventListener('mousedown', (e) => startDrawing(e.offsetX, e.offsetY));
canvas.addEventListener('mousemove', (e) => draw(e.offsetX, e.offsetY));
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);

// Event listeners for touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    startDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    draw(touch.clientX - rect.left, touch.clientY - rect.top);
});

canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

// Keyboard shortcuts for Undo/Redo
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); // Prevent default browser behavior (e.g., undo in text input)
        undo();
    } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault(); // Prevent default browser behavior (e.g., redo in text input)
        redo();
    }
});


// Clear canvas
document.getElementById('clearButton').addEventListener('click', () => {
    saveStateToUndo(); // Save current state before clearing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});
