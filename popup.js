// Global utility functions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// StorageManager Class: Handles localStorage operations for multiple tabs
class StorageManager {
    static saveToLocalStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error("Could not save to localStorage: ", e);
        }
    }

    static getFromLocalStorage(key, defaultValue = '') {
        try {
            return localStorage.getItem(key) || defaultValue;
        } catch (e) {
            console.error("Could not retrieve from localStorage: ", e);
            return defaultValue;
        }
    }

    static removeFromLocalStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error("Could not remove from localStorage: ", e);
        }
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
            StorageManager.saveToLocalStorage('canvasState_' + TabManager.activeTabId, this.canvasElement.toDataURL());
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
            StorageManager.saveToLocalStorage('canvasState_' + TabManager.activeTabId, this.canvasElement.toDataURL());
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

// ImageManager Class: Manages the uploaded, draggable, and resizable images
class ImageManager {
    constructor(imageLayerId) {
        this.imageLayer = document.getElementById(imageLayerId);
        this.imageInput = document.getElementById('image-upload');
        this.uploadButton = document.getElementById('uploadImageBtn');

        this.currentImage = null;
        this.isDragging = false;
        this.isResizing = false;
        this.activeHandle = null;
        this.startX = 0;
        this.startY = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.uploadButton.addEventListener('click', () => this.imageInput.click());
        this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
    }

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (this.currentImage) {
                this.currentImage.remove(); // Remove previous image
            }
            this.createImageElement(event.target.result);
        };
        reader.readAsDataURL(file);
    }

    createImageElement(src) {
        const container = document.createElement('div');
        container.classList.add('image-container');

        const img = document.createElement('img');
        img.src = src;
        img.draggable = false; // Prevent default drag behavior

        container.appendChild(img);

        ['tl', 'tr', 'bl', 'br'].forEach(pos => {
            const handle = document.createElement('div');
            handle.classList.add('resize-handle', pos);
            container.appendChild(handle);
        });

        this.imageLayer.appendChild(container);
        this.currentImage = container;

        this.centerImage();
        this.updatePointers();
    }

    centerImage() {
        const layerRect = this.imageLayer.getBoundingClientRect();
        const imgRect = this.currentImage.getBoundingClientRect();
        const newX = (layerRect.width - imgRect.width) / 2;
        const newY = (layerRect.height - imgRect.height) / 2;
        this.currentImage.style.left = `${newX}px`;
        this.currentImage.style.top = `${newY}px`;
    }

    updatePointers() {
        this.imageLayer.style.pointerEvents = this.currentImage ? 'auto' : 'none';
        this.imageLayer.querySelectorAll('.image-container').forEach(el => el.style.pointerEvents = 'auto');
    }

    handleMouseDown(e) {
        const target = e.target;
        if (target.classList.contains('image-container')) {
            this.isDragging = true;
            this.currentImage = target;
            this.startX = e.clientX - this.currentImage.offsetLeft;
            this.startY = e.clientY - this.currentImage.offsetTop;
            this.currentImage.style.cursor = 'grabbing';
        } else if (target.classList.contains('resize-handle')) {
            this.isResizing = true;
            this.activeHandle = target;
            this.currentImage = target.closest('.image-container');
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.initialWidth = this.currentImage.offsetWidth;
            this.initialHeight = this.currentImage.offsetHeight;
            this.initialLeft = this.currentImage.offsetLeft;
            this.initialTop = this.currentImage.offsetTop;
        }
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            e.preventDefault();
            this.currentImage.style.left = `${e.clientX - this.startX}px`;
            this.currentImage.style.top = `${e.clientY - this.startY}px`;
        } else if (this.isResizing) {
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;

            let newWidth = this.initialWidth;
            let newHeight = this.initialHeight;
            let newLeft = this.initialLeft;
            let newTop = this.initialTop;

            if (this.activeHandle.classList.contains('br') || this.activeHandle.classList.contains('tr')) {
                newWidth = this.initialWidth + dx;
            }
            if (this.activeHandle.classList.contains('bl') || this.activeHandle.classList.contains('tl')) {
                newWidth = this.initialWidth - dx;
                newLeft = this.initialLeft + dx;
            }
            if (this.activeHandle.classList.contains('br') || this.activeHandle.classList.contains('bl')) {
                newHeight = this.initialHeight + dy;
            }
            if (this.activeHandle.classList.contains('tr') || this.activeHandle.classList.contains('tl')) {
                newHeight = this.initialHeight - dy;
                newTop = this.initialTop + dy;
            }

            if (newWidth > 50) {
                this.currentImage.style.width = `${newWidth}px`;
                this.currentImage.style.left = `${newLeft}px`;
            }
            if (newHeight > 50) {
                this.currentImage.style.height = `${newHeight}px`;
                this.currentImage.style.top = `${newTop}px`;
            }
        }
    }

    handleMouseUp() {
        this.isDragging = false;
        this.isResizing = false;
        this.activeHandle = null;
        if (this.currentImage) {
            this.currentImage.style.cursor = 'grab';
        }
    }
}

// TabManager Class: Handles multi-sheet functionality
class TabManager {
    static activeTabId = 'tab-1';
    static tabList = [];
    static canvasInstance = null; // Reference to the ScribbleCanvas instance

    static initialize(canvasInstance) {
        this.canvasInstance = canvasInstance;
        this.tabContainer = document.getElementById('tab-container');
        this.addTabBtn = document.getElementById('add-tab-btn');

        this.addTabBtn.addEventListener('click', () => this.addTab());
        this.loadTabsFromStorage();
        if (this.tabList.length === 0) {
            this.addTab(); // Add a default tab if none exist
        } else {
            this.switchToTab(this.activeTabId);
        }
    }

    static loadTabsFromStorage() {
        const storedTabs = StorageManager.getFromLocalStorage('scribbler_tabs');
        if (storedTabs) {
            this.tabList = JSON.parse(storedTabs);
            const storedActiveTab = StorageManager.getFromLocalStorage('scribbler_activeTabId', this.tabList[0].id);
            this.activeTabId = storedActiveTab;
            this.renderTabs();
        }
    }

    static saveTabsToStorage() {
        StorageManager.saveToLocalStorage('scribbler_tabs', JSON.stringify(this.tabList));
        StorageManager.saveToLocalStorage('scribbler_activeTabId', this.activeTabId);
    }
    
    static generateUniqueTabTitle() {
        const highestNumber = this.tabList.reduce((max, tab) => {
            const num = parseInt(tab.title.replace('Sheet ', '')) || 0;
            return Math.max(max, num);
        }, 0);
        return `Sheet ${highestNumber + 1}`;
    }

    static addTab() {
        const newTabId = `tab-${Date.now()}`;
        const newTab = {
            id: newTabId,
            title: this.generateUniqueTabTitle(),
        };
        this.tabList.push(newTab);
        this.renderTabs();
        this.switchToTab(newTabId);
    }

    static renderTab(tab) {
        const tabElement = document.createElement('div');
        tabElement.classList.add('tab');
        tabElement.id = tab.id;
        if (tab.id === this.activeTabId) {
            tabElement.classList.add('active');
        }

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('tab-title');
        titleSpan.textContent = tab.title;

        titleSpan.ondblclick = (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = tab.title;
            input.className = 'edit-title';

            tabElement.replaceChild(input, titleSpan);
            input.focus();

            const saveTitle = () => {
                const newTitle = input.value.trim() || tab.title;
                const existingTab = this.tabList.find(t => t.id === tab.id);
                if (existingTab) {
                    existingTab.title = newTitle;
                    this.saveTabsToStorage();
                }
                titleSpan.textContent = newTitle;
                tabElement.replaceChild(titleSpan, input);
            };

            input.addEventListener('blur', saveTitle);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });
        };

        const closeBtn = document.createElement('button');
        closeBtn.classList.add('tab-close-btn');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeTab(tab.id);
        });
        
        tabElement.appendChild(titleSpan);
        tabElement.appendChild(closeBtn);
        this.tabContainer.appendChild(tabElement);
        
        tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close-btn') && !e.target.classList.contains('edit-title')) {
                this.switchToTab(tab.id);
            }
        });
    }

    static renderTabs() {
        this.tabContainer.innerHTML = '';
        this.tabList.forEach(tab => this.renderTab(tab));
    }

    static switchToTab(tabId) {
        if (this.activeTabId) {
            const currentActiveTab = document.getElementById(this.activeTabId);
            if (currentActiveTab) {
                currentActiveTab.classList.remove('active');
            }
        }
        
        const newActiveTab = document.getElementById(tabId);
        if (newActiveTab) {
            newActiveTab.classList.add('active');
            this.activeTabId = tabId;
            this.canvasInstance.loadCanvasState();
            this.saveTabsToStorage();
        }
    }

    static removeTab(tabId) {
        if (this.tabList.length === 1) {
            alert("Cannot delete the last sheet.");
            return;
        }

        this.tabList = this.tabList.filter(tab => tab.id !== tabId);
        StorageManager.removeFromLocalStorage(`canvasState_${tabId}`);

        if (this.activeTabId === tabId) {
            const newActiveTabId = this.tabList[0].id; // Switch to the first tab
            this.switchToTab(newActiveTabId);
        } else {
            this.saveTabsToStorage();
            this.renderTabs(); // Re-render all tabs
        }
    }
}

class ScribbleCanvas {
    constructor(canvasId, clearButtonId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.drawing = false;
        this.points = [];
        
        this.resizeCanvas = debounce(this._resizeCanvas.bind(this), 200);
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas);
        
        this.keyboardShortcutManager = new KeyboardShortcutManager(this.canvas);
        
        this.setupCanvas();
        this.setupControls();
        this.attachEventListeners(clearButtonId);

        this.touchManager = new TouchManager(this.canvas, 
            (x, y) => this.startDrawing(x, y), 
            (x, y) => this.draw(x, y), 
            () => this.stopDrawing()
        );
        this.touchManager.attachTouchEvents();
    }

    // Load the canvas state from localStorage for the active tab
    loadCanvasState() {
        const savedState = StorageManager.getFromLocalStorage('canvasState_' + TabManager.activeTabId, '');
        if (savedState) {
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = savedState;
        } else {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    // Resize the canvas to fit the window
    _resizeCanvas() {
        const sidebar = document.querySelector('.controls-sidebar');
        const footer = document.querySelector('#footer');
        const header = document.getElementById('header');
        const tabBar = document.getElementById('tab-bar');

        const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
        const footerHeight = footer ? footer.offsetHeight : 0;
        const headerHeight = header ? header.offsetHeight : 0;
        const tabBarHeight = tabBar ? tabBar.offsetHeight : 0;

        this.canvas.width = window.innerWidth - sidebarWidth;
        this.canvas.height = window.innerHeight - footerHeight - headerHeight - tabBarHeight;
        this.loadCanvasState(); // Reload the canvas content after resizing
    }

    // Set up canvas properties and resize functionality
    setupCanvas() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = 5;
        this.ctx.strokeStyle = '#000';
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

        if (document.querySelector('.color-box[data-color="#000000"]')) {
            document.querySelector('.color-box[data-color="#000000"]').classList.add('active');
        }

        const brushSizeSlider = document.getElementById('brushSizeSlider');
        const brushSizeValue = document.getElementById('brushSizeValue');
        
        brushSizeSlider.addEventListener('input', () => {
            const size = brushSizeSlider.value;
            this.ctx.lineWidth = size;
            brushSizeValue.textContent = size;
        });
    }

    // Save the current state to undo stack
    saveState() {
        this.keyboardShortcutManager.saveState();
    }

    startDrawing(x, y) {
        this.drawing = true;
        this.points = [{ x, y }];
        this.saveState();
    }

    stopDrawing() {
        if (this.drawing) {
            this.drawing = false;
            this.points = [];
            StorageManager.saveToLocalStorage('canvasState_' + TabManager.activeTabId, this.canvas.toDataURL());
        }
    }

    draw(x, y) {
        if (!this.drawing) return;

        this.points.push({ x, y });

        if (this.points.length >= 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.points[0].x, this.points[0].y);

            for (let i = 1; i < this.points.length - 1; i++) {
                const midPoint = {
                    x: (this.points[i].x + this.points[i + 1].x) / 2,
                    y: (this.points[i].y + this.points[i + 1].y) / 2,
                };
                this.ctx.quadraticCurveTo(this.points[i].x, this.points[i].y, midPoint.x, midPoint.y);
            }

            const lastPoint = this.points[this.points.length - 2];
            const lastMidPoint = {
                x: (lastPoint.x + x) / 2,
                y: (lastPoint.y + y) / 2,
            };
            this.ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, lastMidPoint.x, lastMidPoint.y);

            this.ctx.stroke();
        }
    }
    
    // Function to download the canvas as an image
    downloadCanvas() {
        const url = this.canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `scribbler_drawing_${TabManager.activeTabId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    // Function to print the canvas content
    printCanvas() {
        const dataUrl = this.canvas.toDataURL('image/png');
        const windowContent = `<!DOCTYPE html>
            <html>
                <head>
                    <title>Scribbler Print</title>
                </head>
                <body>
                    <img src="${dataUrl}" style="max-width: 100%;">
                </body>
            </html>`;
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write(windowContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    attachEventListeners(clearButtonId) {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e.offsetX, e.offsetY));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e.offsetX, e.offsetY));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

        document.addEventListener('keydown', (e) => this.keyboardShortcutManager.handleKeyboardShortcuts(e));

        document.getElementById(clearButtonId).addEventListener('click', () => {
            this.saveState();
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            StorageManager.saveToLocalStorage('canvasState_' + TabManager.activeTabId, '');
        });

        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadCanvas());
        document.getElementById('printBtn').addEventListener('click', () => this.printCanvas());
    }
}

// Dark Mode Switcher
const darkModeToggle = document.getElementById('darkModeToggle');
darkModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
    StorageManager.saveToLocalStorage('darkMode', darkModeToggle.checked);
});

// Initial dark mode check
if (StorageManager.getFromLocalStorage('darkMode') === 'true') {
    darkModeToggle.checked = true;
    document.body.classList.add('dark-mode');
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
    const scribbleCanvas = new ScribbleCanvas('scribbleCanvas', 'clearButton');
    const imageManager = new ImageManager('image-layer');
    TabManager.initialize(scribbleCanvas);
});