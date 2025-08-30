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

class ToolManager {
    constructor(canvas, imageManager) {
        this.activeTool = 'brush'; // Default tool
        this.canvas = canvas;
        this.imageManager = imageManager;
        this.toolButtons = {
            brush: document.getElementById('brushTool'),
            pointer: document.getElementById('pointerTool')
        };
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.toolButtons.brush.addEventListener('click', () => this.setTool('brush'));
        this.toolButtons.pointer.addEventListener('click', () => this.setTool('pointer'));
    }

    setTool(tool) {
        if (this.activeTool === tool) return;

        this.activeTool = tool;
        this.updateToolButtons();
        this.updateCanvasCursor();
        this.imageManager.deselectAllImages();
    }

    updateToolButtons() {
        for (const tool in this.toolButtons) {
            if (tool === this.activeTool) {
                this.toolButtons[tool].classList.add('active');
            } else {
                this.toolButtons[tool].classList.remove('active');
            }
        }
    }

    updateCanvasCursor() {
        if (this.activeTool === 'brush') {
            this.canvas.classList.remove('pointer-mode');
            this.canvas.style.pointerEvents = 'auto'; // Canvas captures events for drawing
            // Disable pointer events on image containers when in brush mode
            document.querySelectorAll('.image-container').forEach(container => {
                container.style.pointerEvents = 'none';
            });
        } else {
            this.canvas.classList.add('pointer-mode');
            this.canvas.style.pointerEvents = 'none'; // Canvas doesn't capture events
            // Enable pointer events on image containers when in pointer mode
            document.querySelectorAll('.image-container').forEach(container => {
                container.style.pointerEvents = 'auto';
            });
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
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
        this.canvas.addEventListener('touchcancel', () => this.stopDrawing());
    }
}

class ImageManager {
    constructor(imageLayerId, activeTabId) {
        this.imageLayer = document.getElementById(imageLayerId);
        this.imageInput = document.getElementById('image-upload');
        this.uploadButton = document.getElementById('uploadImageBtn');
        this.activeTabId = activeTabId;

        this.images = []; // Store multiple images
        this.currentImage = null; // Currently selected image
        this.isDragging = false;
        this.isResizing = false;
        this.activeHandle = null;
        this.startX = 0;
        this.startY = 0;
        this.initialWidth = 0;
        this.initialHeight = 0;
        this.initialLeft = 0;
        this.initialTop = 0;

        this.imageDrawings = new Map();
        this.imageCanvases = new Map(); // Add this - store canvas for each image

        this.setupEventListeners();
        this.loadImages();
    }

    setActiveTab(tabId) {
        this.activeTabId = tabId;
        this.imageLayer.innerHTML = '';
        this.images = [];
        this.currentImage = null;
        this.loadImages();
    }

    setupEventListeners() {
        this.uploadButton.addEventListener('click', () => this.imageInput.click());
        this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));

        // Use the image layer for event delegation
        this.imageLayer.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());

        // Touch events for mobile
        this.imageLayer.addEventListener('touchstart', (e) => this.handleTouchStart(e), {passive: false});
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), {passive: false});
        document.addEventListener('touchend', () => this.handleMouseUp());
    }

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            // Generate unique ID for each image
            const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const imageData = {
                id: imageId,
                src: event.target.result,
                left: 50 + (this.images.length * 20), // Offset each new image
                top: 50 + (this.images.length * 20),
                width: 200,
                height: 'auto',
                drawingData: null
            };
            this.createImageElement(imageData);
            this.saveImagesState();
        };
        reader.readAsDataURL(file);
        this.imageInput.value = ''; // Reset input for same file upload
    }

    createImageElement(imageData) {
        const container = document.createElement('div');
        container.classList.add('image-container');
        container.dataset.imageId = imageData.id;
        container.style.left = `${imageData.left}px`;
        container.style.top = `${imageData.top}px`;

        const img = document.createElement('img');
        img.src = imageData.src;
        img.draggable = false;
        img.style.width = `${imageData.width}px`;
        img.style.height = 'auto';
        img.style.pointerEvents = 'none'; // Prevent image from capturing events

    // Create a canvas for this image's drawings
        const drawingCanvas = document.createElement('canvas');
        drawingCanvas.style.position = 'absolute';
        drawingCanvas.style.top = '0';
        drawingCanvas.style.left = '0';
        drawingCanvas.style.width = '100%';
        drawingCanvas.style.height = '100%';
        drawingCanvas.style.pointerEvents = 'none';
        drawingCanvas.style.zIndex = '1';
        
        container.appendChild(img);
        container.appendChild(drawingCanvas); // Add the drawing canvas

        // Add resize handles
        ['tl', 'tr', 'bl', 'br'].forEach(pos => {
            const handle = document.createElement('div');
            handle.classList.add('resize-handle', pos);
            container.appendChild(handle);
        });

        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('image-delete-btn');
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Delete image';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteImage(imageData.id);
        });
        container.appendChild(deleteBtn);

        this.imageLayer.appendChild(container);
        
        // Add to images array
        this.images.push({
            id: imageData.id,
            element: container
        });
        this.imageCanvases.set(imageData.id, drawingCanvas);
        this.imageDrawings.set(imageData.id, imageData.drawingData);

        // Set as current image
        this.selectImage(container);

        // Wait for image to load
        img.onload = () => {
            if (imageData.width === 200 && !imageData.height) { // New image, center it
                this.centerImage(container);
            }
            this.saveImagesState();
        };
                // Load existing drawing data if available
        if (imageData.drawingData) {
            this.loadDrawingToCanvas(drawingCanvas, imageData.drawingData);
        }
    }

    // Add method to load drawing to a specific canvas
    loadDrawingToCanvas(canvas, drawingData) {
        const img = new Image();
        img.onload = () => {
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        };
        img.src = drawingData;
    }

    selectImage(container) {
        // Deselect all images
        this.deselectAllImages();
        
        // Select this image
        container.classList.add('selected');
        this.currentImage = container;
        
        // Bring to front
        container.style.zIndex = this.getHighestZIndex() + 1;

        // Render the associated drawing
        App.scribbleCanvas.loadCanvasState();
    }
    
    deselectAllImages() {
        this.imageLayer.querySelectorAll('.image-container').forEach(img => {
            img.classList.remove('selected');
        });
        this.currentImage = null;
        App.scribbleCanvas.loadCanvasState(); // Clear the canvas when no image is selected
    }


    renderImageDrawing() {
        const canvas = document.getElementById('scribbleCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

        if (this.currentImage) {
            const imageId = this.currentImage.dataset.imageId;
            const drawingData = this.imageDrawings.get(imageId);
            if (drawingData) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                };
                img.src = drawingData;
            }
        }
    }

    getHighestZIndex() {
        let maxZ = 0;
        this.imageLayer.querySelectorAll('.image-container').forEach(img => {
            const z = parseInt(img.style.zIndex) || 0;
            if (z > maxZ) maxZ = z;
        });
        return maxZ;
    }

    centerImage(container) {
        if (!container) return;
        const layerRect = this.imageLayer.getBoundingClientRect();
        const imgRect = container.getBoundingClientRect();
        const newX = Math.max(0, (layerRect.width - imgRect.width) / 2);
        const newY = Math.max(0, (layerRect.height - imgRect.height) / 2);
        container.style.left = `${newX}px`;
        container.style.top = `${newY}px`;
    }

    deleteImage(imageId) {
        const imageIndex = this.images.findIndex(img => img.id === imageId);
        if (imageIndex > -1) {
            this.images[imageIndex].element.remove();
            this.images.splice(imageIndex, 1);
            
            if (this.currentImage && this.currentImage.dataset.imageId === imageId) {
                this.currentImage = null;
            }
            
            this.imageDrawings.delete(imageId);
            this.imageCanvases.delete(imageId); // Clean up the canvas reference
            this.saveImagesState();
            App.scribbleCanvas.loadCanvasState();
        }
    }

    saveImagesState() {
        const imagesData = [];
        this.imageLayer.querySelectorAll('.image-container').forEach(container => {
            const img = container.querySelector('img');
            const imageId = container.dataset.imageId;
            imagesData.push({
                id: imageId,
                src: img.src,
                left: container.offsetLeft,
                top: container.offsetTop,
                width: img.offsetWidth,
                height: img.offsetHeight,
                zIndex: container.style.zIndex || 0,
                drawingData: this.imageDrawings.get(imageId) || null
            });
        });
        StorageManager.saveToLocalStorage(`imagesState_${this.activeTabId}`, JSON.stringify(imagesData));
    }

    loadImages() {
        const savedState = StorageManager.getFromLocalStorage(`imagesState_${this.activeTabId}`);
        if (savedState) {
            try {
                const imagesData = JSON.parse(savedState);
                imagesData.forEach(imageData => {
                    this.createImageElement(imageData);
                    if (imageData.zIndex) {
                        const container = this.imageLayer.querySelector(`[data-image-id="${imageData.id}"]`);
                        if (container) {
                            container.style.zIndex = imageData.zIndex;
                        }
                    }
                });
            } catch (e) {
                console.error("Failed to parse images state:", e);
                StorageManager.removeFromLocalStorage(`imagesState_${this.activeTabId}`);
            }
        }
    }

    clearImages() {
        this.imageLayer.innerHTML = '';
        this.images = [];
        this.currentImage = null;
        this.imageDrawings = new Map();
        StorageManager.removeFromLocalStorage(`imagesState_${this.activeTabId}`);
    }

    handleMouseDown(e) {
        // Only handle image interactions if the pointer tool is active
        if (App.toolManager.activeTool !== 'pointer') {
            this.deselectAllImages();
            return;
        }

        const target = e.target;
        const imageContainer = target.closest('.image-container');

        if (imageContainer) {
            this.selectImage(imageContainer);
        }

        if (target.classList.contains('resize-handle')) {
            e.preventDefault();
            e.stopPropagation();
            this.isResizing = true;
            this.activeHandle = target;
            this.currentImage = imageContainer;
            
            const img = this.currentImage.querySelector('img');
            this.initialWidth = img.offsetWidth;
            this.initialHeight = img.offsetHeight;
            this.initialLeft = this.currentImage.offsetLeft;
            this.initialTop = this.currentImage.offsetTop;
        } else if (imageContainer) {
            e.preventDefault();
            e.stopPropagation();
            this.isDragging = true;
            this.currentImage = imageContainer;
            this.currentImage.classList.add('dragging');
            
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.initialLeft = this.currentImage.offsetLeft;
            this.initialTop = this.currentImage.offsetTop;
        }
    }

    handleTouchStart(e) {
        if (App.toolManager.activeTool !== 'pointer') {
            return;
        }
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        if (target && (target.classList.contains('image-container') || target.parentElement?.classList.contains('image-container'))) {
            e.preventDefault();
            const fakeMouseEvent = {
                target: target,
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {},
                stopPropagation: () => {}
            };
            this.handleMouseDown(fakeMouseEvent);
        }
    }

    handleMouseMove(e) {
        if (App.toolManager.activeTool !== 'pointer') {
            return;
        }

        if (this.isDragging && this.currentImage) {
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;

            const newLeft = this.initialLeft + dx;
            const newTop = this.initialTop + dy;

            this.currentImage.style.left = `${newLeft}px`;
            this.currentImage.style.top = `${newTop}px`;
        } else if (this.isResizing && this.currentImage) {
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
            const img = this.currentImage.querySelector('img');

            let newWidth = this.initialWidth;
            let newHeight = this.initialHeight;
            let newLeft = this.initialLeft;
            let newTop = this.initialTop;

            const aspectRatio = this.initialWidth / this.initialHeight;

            if (this.activeHandle.classList.contains('br')) {
                newWidth = Math.max(50, this.initialWidth + dx);
                newHeight = newWidth / aspectRatio;
            } else if (this.activeHandle.classList.contains('bl')) {
                newWidth = Math.max(50, this.initialWidth - dx);
                newHeight = newWidth / aspectRatio;
                newLeft = this.initialLeft + this.initialWidth - newWidth;
            } else if (this.activeHandle.classList.contains('tr')) {
                newWidth = Math.max(50, this.initialWidth + dx);
                newHeight = newWidth / aspectRatio;
                newTop = this.initialTop + this.initialHeight - newHeight;
            } else if (this.activeHandle.classList.contains('tl')) {
                newWidth = Math.max(50, this.initialWidth - dx);
                newHeight = newWidth / aspectRatio;
                newLeft = this.initialLeft + this.initialWidth - newWidth;
                newTop = this.initialTop + this.initialHeight - newHeight;
            }

            img.style.width = `${newWidth}px`;
            img.style.height = `${newHeight}px`;
            this.currentImage.style.left = `${newLeft}px`;
            this.currentImage.style.top = `${newTop}px`;
        }
    }

    handleTouchMove(e) {
        if (App.toolManager.activeTool !== 'pointer') {
            return;
        }
        if (this.isDragging || this.isResizing) {
            const touch = e.touches[0];
            const fakeMouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {}
            };
            this.handleMouseMove(fakeMouseEvent);
        }
    }

    handleMouseUp() {
        if (this.isDragging || this.isResizing) {
            this.saveImagesState();
        }
        if (this.currentImage) {
            this.currentImage.classList.remove('dragging');
        }
        this.isDragging = false;
        this.isResizing = false;
        this.activeHandle = null;
    }
}

// TabManager Class: Handles multi-sheet functionality
class TabManager {
    static activeTabId = 'tab-1';
    static tabList = [];
    static canvasInstance = null; // Reference to the ScribbleCanvas instance
    static imageManager = null; // Reference to the ImageManager instance

    static initialize(canvasInstance, imageManager) {
        this.canvasInstance = canvasInstance;
        this.imageManager = imageManager;
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
            this.imageManager.setActiveTab(tabId);
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
        StorageManager.removeFromLocalStorage(`imageState_${tabId}`);

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
    constructor(canvasId, clearButtonId, imageManager) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.drawing = false;
        this.points = [];
        this.imageManager = imageManager;
        
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
        if (this.imageManager.currentImage) {
            this.imageManager.renderImageDrawing();
        } else {
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

    // Update startDrawing to handle coordinate adjustment
    startDrawing(x, y) {
        if (App.toolManager.activeTool !== 'brush') return;
        this.drawing = true;
        
        let adjustedX = x;
        let adjustedY = y;
        
        // If drawing on an image, adjust coordinates
        if (this.imageManager.currentImage) {
            const imageRect = this.imageManager.currentImage.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            adjustedX = x - (imageRect.left - canvasRect.left);
            adjustedY = y - (imageRect.top - canvasRect.top);
        }
        
        this.points = [{ x: adjustedX, y: adjustedY }];
        this.saveState();
    }

// Update stopDrawing to save to the correct location
    stopDrawing() {
        if (!this.drawing) return;

        this.drawing = false;
        this.points = [];
        
        if (this.imageManager.currentImage) {
            const imageId = this.imageManager.currentImage.dataset.imageId;
            const imageCanvas = this.imageManager.imageCanvases.get(imageId);
            
            if (imageCanvas) {
                this.imageManager.imageDrawings.set(imageId, imageCanvas.toDataURL());
                this.imageManager.saveImagesState();
            }
        } else {
            StorageManager.saveToLocalStorage('canvasState_' + TabManager.activeTabId, this.canvas.toDataURL());
        }
    }

draw(x, y) {
    if (!this.drawing || App.toolManager.activeTool !== 'brush') return;

    let targetCanvas = this.canvas;
    let targetCtx = this.ctx;
    let adjustedX = x;
    let adjustedY = y;

    // If an image is selected, draw on its canvas instead
    if (this.imageManager.currentImage) {
        const imageId = this.imageManager.currentImage.dataset.imageId;
        const imageCanvas = this.imageManager.imageCanvases.get(imageId);
        
        if (imageCanvas) {
            // Get image position and adjust coordinates
            const imageRect = this.imageManager.currentImage.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            adjustedX = x - (imageRect.left - canvasRect.left);
            adjustedY = y - (imageRect.top - canvasRect.top);
            
            // Set canvas size to match image
            const img = this.imageManager.currentImage.querySelector('img');
            if (imageCanvas.width !== img.offsetWidth) {
                imageCanvas.width = img.offsetWidth;
                imageCanvas.height = img.offsetHeight;
                
                // Reload existing drawing after resize
                const existingData = this.imageManager.imageDrawings.get(imageId);
                if (existingData) {
                    this.imageManager.loadDrawingToCanvas(imageCanvas, existingData);
                }
            }
            
            targetCanvas = imageCanvas;
            targetCtx = imageCanvas.getContext('2d');
            
            // Copy drawing settings
            targetCtx.lineCap = this.ctx.lineCap;
            targetCtx.lineJoin = this.ctx.lineJoin;
            targetCtx.lineWidth = this.ctx.lineWidth;
            targetCtx.strokeStyle = this.ctx.strokeStyle;
        }
    }

    this.points.push({ x: adjustedX, y: adjustedY });

    if (this.points.length >= 2) {
        targetCtx.beginPath();
        targetCtx.moveTo(this.points[0].x, this.points[0].y);

        for (let i = 1; i < this.points.length - 1; i++) {
            const midPoint = {
                x: (this.points[i].x + this.points[i + 1].x) / 2,
                y: (this.points[i].y + this.points[i + 1].y) / 2,
            };
            targetCtx.quadraticCurveTo(this.points[i].x, this.points[i].y, midPoint.x, midPoint.y);
        }

        const lastPoint = this.points[this.points.length - 2];
        const lastMidPoint = {
            x: (lastPoint.x + adjustedX) / 2,
            y: (lastPoint.y + adjustedY) / 2,
        };
        targetCtx.quadraticCurveTo(lastPoint.x, lastPoint.y, lastMidPoint.x, lastMidPoint.y);

        targetCtx.stroke();
    }
}

    
    // Function to download the canvas as an image
    downloadCanvas() {
        const url = this.createCombinedCanvas().toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `scribbler_drawing_${TabManager.activeTabId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    // Function to print the canvas content
    printCanvas() {
        const dataUrl = this.createCombinedCanvas().toDataURL('image/png');
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
        printWindow.close();
    }

    createCombinedCanvas() {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
    
        // Draw the background color
        tempCtx.fillStyle = document.body.classList.contains('dark-mode') ? '#1f2022' : '#f9f9fb';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
        // Sort images by zIndex to draw them in the correct order
        const sortedImages = this.imageManager.images.sort((a, b) => {
            const zA = parseInt(a.element.style.zIndex) || 0;
            const zB = parseInt(b.element.style.zIndex) || 0;
            return zA - zB;
        });
    
        // Draw images and their associated drawings
        sortedImages.forEach(image => {
            const imgElement = image.element.querySelector('img');
            const drawingData = this.imageManager.imageDrawings.get(image.id);
    
            // Draw the image itself
            tempCtx.drawImage(imgElement, image.element.offsetLeft, image.element.offsetTop, imgElement.offsetWidth, imgElement.offsetHeight);
    
            // If there's drawing data for this image, draw it on top
            if (drawingData) {
                const drawingImg = new Image();
                drawingImg.src = drawingData;
                tempCtx.drawImage(drawingImg, image.element.offsetLeft, image.element.offsetTop, imgElement.offsetWidth, imgElement.offsetHeight);
            }
        });
    
        // Draw the main canvas content (which contains the current drawing)
        const currentCanvasState = new Image();
        currentCanvasState.src = this.canvas.toDataURL();
        tempCtx.drawImage(currentCanvasState, 0, 0);
    
        return tempCanvas;
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
            this.imageManager.clearImages();
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

// Main application class to hold instances
class App {
    static scribbleCanvas;
    static imageManager;
    static toolManager;

    static initialize() {
        this.imageManager = new ImageManager('image-layer');
        this.scribbleCanvas = new ScribbleCanvas('scribbleCanvas', 'clearButton', this.imageManager);
        this.toolManager = new ToolManager(this.scribbleCanvas.canvas, this.imageManager);
        TabManager.initialize(this.scribbleCanvas, this.imageManager);
    }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
    App.initialize();
});