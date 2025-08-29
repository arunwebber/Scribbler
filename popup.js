// StorageManager Class: Handles localStorage operations
class StorageManager {
    // Save data to localStorage
    static saveToLocalStorage(key, value) {
        localStorage.setItem(key, value);
    }

    // Retrieve data from localStorage
    static getFromLocalStorage(key, defaultValue = '') {
        return localStorage.getItem(key) || defaultValue;
    }
}

// KeyboardShortcutManager Class: Handles undo and redo functionality via keyboard shortcuts
class KeyboardShortcutManager {
    constructor(canvasElement) {
        this.canvasElement = canvasElement;
        this.undoStack = [];
        this.redoStack = [];
    }

    // Save the current state to undo stack
    saveState() {
        this.undoStack.push(this.canvasElement.toDataURL());
        if (this.undoStack.length > 50) {
            this.undoStack.shift(); // Keep the stack size manageable
        }
        this.redoStack = []; // Clear redo stack after a new action
    }

    // Undo the last action
    undo() {
        if (this.undoStack.length > 0) {
            const lastState = this.undoStack.pop();
            this.redoStack.push(this.canvasElement.toDataURL());
            const img = new Image();
            img.onload = () => {
                const ctx = this.canvasElement.getContext('2d');
                ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = lastState;
            StorageManager.saveToLocalStorage('canvasState', this.canvasElement.toDataURL());
        }
    }

    // Redo the last undone action
    redo() {
        if (this.redoStack.length > 0) {
            const lastState = this.redoStack.pop();
            this.undoStack.push(this.canvasElement.toDataURL());
            const img = new Image();
            img.onload = () => {
                const ctx = this.canvasElement.getContext('2d');
                ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = lastState;
            StorageManager.saveToLocalStorage('canvasState', this.canvasElement.toDataURL());
        }
    }

    // Handle keyboard shortcuts for undo and redo
    handleKeyboardShortcuts(event) {
        if (event.ctrlKey) {
            if (event.key === 'z' || event.key === 'Z') {
                event.preventDefault();
                this.undo(); // Perform undo action
            } else if (event.key === 'y' || event.key === 'Y') {
                event.preventDefault();
                this.redo(); // Perform redo action
            }
        }
    }
}

// DOMButtonManager Class: Handles DOM button events
class DOMButtonManager {
    constructor(buttonId, action) {
        this.button = document.getElementById(buttonId);
        this.action = action; // The action to perform when the button is clicked

        this.setupEventListener();
    }

    // Set up the event listener for the button
    setupEventListener() {
        if (this.button) {
            this.button.addEventListener('click', () => {
                this.action(); // Perform the action when the button is clicked
            });
        } else {
            console.error(`Button with id "${this.button.id}" not found.`);
        }
    }
}

class TouchManager {
    constructor(canvas, startDrawingCallback, drawCallback, stopDrawingCallback) {
        this.canvas = canvas;
        this.startDrawingCallback = startDrawingCallback;
        this.drawCallback = drawCallback;
        this.stopDrawingCallback = stopDrawingCallback;
    }

    // Handle touch start events
    handleTouchStart(e) {
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.startDrawingCallback(touch.clientX - rect.left, touch.clientY - rect.top);
    }

    // Handle touch move events
    handleTouchMove(e) {
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.drawCallback(touch.clientX - rect.left, touch.clientY - rect.top);
    }

    // Attach touch event listeners to the canvas
    attachTouchEvents() {
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.stopDrawingCallback());
        this.canvas.addEventListener('touchcancel', () => this.stopDrawingCallback());
    }
}

class ScribbleCanvas {
    constructor(canvasId, clearButtonId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.drawing = false;
        this.points = [];
        
        // Call resizeCanvas() here to set initial canvas dimensions
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Initialize KeyboardShortcutManager with the canvas element
        this.keyboardShortcutManager = new KeyboardShortcutManager(this.canvas);
        
        // Load the saved canvas state from localStorage
        const savedState = StorageManager.getFromLocalStorage('canvasState', '');
        if (savedState) {
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = savedState;
        }

        this.setupCanvas();
        this.setupControls();
        this.attachEventListeners(clearButtonId);

        // Initialize TouchManager with touch handling callbacks
        this.touchManager = new TouchManager(this.canvas, 
            (x, y) => this.startDrawing(x, y), 
            (x, y) => this.draw(x, y), 
            () => this.stopDrawing()
        );
        this.touchManager.attachTouchEvents(); // Attach touch events to the canvas
    }

    // Set up canvas properties and resize functionality
    setupCanvas() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = 5;
        this.ctx.strokeStyle = '#000';
    }

    // Function to generate a random hex color
    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    // Setup color palette and brush size controls
    setupControls() {
        const colorPaletteGrid = document.getElementById('colorPaletteGrid');
        const colors = [
            '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
            '#FF00FF', '#00FFFF', '#808080', '#C0C0C0', '#800000', '#808000',
            '#008000', '#800080', '#008080', '#000080', '#FF4500', '#2E8B57',
            '#D2691E', '#4B0082', '#A52A2A', '#DDA0DD', '#F5DEB3', '#9ACD32',
            '#20B2AA', '#F08080', '#6B8E23', '#FF69B4', '#CD5C5C', '#FFA07A',
            '#90EE90', '#F4A460', '#BA55D3', '#DAA520', '#C71585', '#00BFFF'
        ];

        // Generate the color grid
        colors.forEach(color => {
            const colorBox = document.createElement('div');
            colorBox.classList.add('color-box');
            colorBox.style.backgroundColor = color;
            colorBox.setAttribute('data-color', color);
            colorPaletteGrid.appendChild(colorBox);

            colorBox.addEventListener('click', () => {
                document.querySelectorAll('.color-box').forEach(box => box.classList.remove('active'));
                colorBox.classList.add('active');
                this.ctx.strokeStyle = color;
            });
        });

        // Set initial active color
        if (document.querySelector('.color-box[data-color="#000000"]')) {
            document.querySelector('.color-box[data-color="#000000"]').classList.add('active');
        }

        // Brush size slider
        const brushSizeSlider = document.getElementById('brushSizeSlider');
        const brushSizeValue = document.getElementById('brushSizeValue');
        
        brushSizeSlider.addEventListener('input', () => {
            const size = brushSizeSlider.value;
            this.ctx.lineWidth = size;
            brushSizeValue.textContent = size;
        });
    }

    // Resize the canvas to fit the window
    resizeCanvas() {
        const sidebar = document.querySelector('.controls-sidebar');
        const bottomControls = document.querySelector('.bottom-controls');
        const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
        const bottomControlsHeight = bottomControls ? bottomControls.offsetHeight : 0;
        
        this.canvas.width = window.innerWidth - sidebarWidth;
        this.canvas.height = window.innerHeight - bottomControlsHeight;
    }

    // Save the current state to undo stack
    saveState() {
        this.keyboardShortcutManager.saveState(); // Save the current state to the undo stack
    }

    // Start drawing
    startDrawing(x, y) {
        this.drawing = true;
        this.points = [{ x, y }]; // Start tracking points
        this.saveState(); // Save the canvas state before drawing
    }

    // Stop drawing
    stopDrawing() {
        if (this.drawing) {
            this.drawing = false;
            this.points = []; // Reset points for the next stroke
        }
    }

    // Draw on the canvas
    draw(x, y) {
        if (!this.drawing) return;

        // Add the new point
        this.points.push({ x, y });

        // If we have enough points, start drawing
        if (this.points.length >= 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.points[0].x, this.points[0].y);

            // Create a smooth curve
            for (let i = 1; i < this.points.length - 1; i++) {
                const midPoint = {
                    x: (this.points[i].x + this.points[i + 1].x) / 2,
                    y: (this.points[i].y + this.points[i + 1].y) / 2,
                };
                this.ctx.quadraticCurveTo(this.points[i].x, this.points[i].y, midPoint.x, midPoint.y);
            }

            // Connect to the latest point
            const lastPoint = this.points[this.points.length - 2];
            const lastMidPoint = {
                x: (lastPoint.x + x) / 2,
                y: (lastPoint.y + y) / 2,
            };
            this.ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, lastMidPoint.x, lastMidPoint.y);

            // Stroke the path
            this.ctx.stroke();
        }
    }

    // Attach event listeners for mouse, keyboard events, and clear button
    attachEventListeners(clearButtonId) {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e.offsetX, e.offsetY));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e.offsetX, e.offsetY));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

        document.addEventListener('keydown', (e) => this.keyboardShortcutManager.handleKeyboardShortcuts(e));

        // Clear canvas button
        document.getElementById(clearButtonId).addEventListener('click', () => {
            this.saveState(); // Save current state before clearing
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            StorageManager.saveToLocalStorage('canvasState', ''); // Clear stored state in localStorage
        });
    }
}
// Initialize the ScribbleCanvas class with the KeyboardShortcutManager
const scribbleCanvas = new ScribbleCanvas('scribbleCanvas', 'clearButton');