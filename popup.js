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
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error("Failed to save to localStorage: ", e);
        }
    }

    static getFromLocalStorage(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error("Failed to get from localStorage: ", e);
            return null;
        }
    }

    static removeFromLocalStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error("Failed to remove from localStorage: ", e);
        }
    }
}

class ApiKeyManager {
    constructor() {
        this.modal = document.getElementById('apiKeyModal');
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.saveBtn = document.getElementById('saveApiKeyBtn');
        this.closeBtn = document.getElementById('closeModalBtn');
        this.settingsBtn = document.getElementById('settingsButton');

        this.bindEvents();
    }

    bindEvents() {
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                this.showModal();
            });
        }
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => {
                this.saveApiKey();
            });
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.hideModal();
            });
        }
        if (this.modal) {
            this.modal.addEventListener('click', (event) => {
                if (event.target === this.modal) {
                    this.hideModal();
                }
            });
        }
    }

    showModal() {
        const existingKey = StorageManager.getFromLocalStorage('apiKey');
        if (existingKey) {
            this.apiKeyInput.value = existingKey;
        } else {
            this.apiKeyInput.value = '';
        }
        this.modal.style.display = 'flex';
    }

    hideModal() {
        this.modal.style.display = 'none';
    }

    saveApiKey() {
        const apiKey = this.apiKeyInput.value;
        StorageManager.saveToLocalStorage('apiKey', apiKey);
        this.hideModal();
    }
}
class ScribbleAIIntegration {
    constructor(scribbleApp) {
        this.scribbleApp = scribbleApp;
        this.aiPanel = document.getElementById('rightPanel');
        this.aiNoteElement = document.querySelector('.ai-note');
        this.aiWriteButton = document.getElementById('aiWriteButton');
        this.pollingTimeout = null;
        this.apiCache = {};
        this.bindEvents();
    }

    bindEvents() {
        if (this.aiWriteButton) {
            this.aiWriteButton.addEventListener('click', () => this.handleAiWrite());
        }
    }

    async handleAiWrite() {
        const apiKey = StorageManager.getFromLocalStorage('apiKey');
        if (!apiKey) {
            App.apiKeyManager.showModal();
            return;
        }

        const dataToAnalyze = this.extractScribbleData();
        if (!dataToAnalyze) {
            this.aiNoteElement.textContent = 'Please upload or create an image to analyze.';
            return;
        }

        this.aiNoteElement.textContent = 'Analyzing...';
        
        try {
            const requestBody = { image: dataToAnalyze };
            // Note: This is a placeholder for your API endpoint.
            // You will need to replace this with the actual API URL.
            const response = await this.callAiApi('POST', 'https://your-imagine-pro-api-endpoint/v1/analyze-image', apiKey, requestBody);
            this.aiNoteElement.textContent = response.description;
        } catch (error) {
            this.aiNoteElement.textContent = `Error: ${error.message}`;
        }
    }

    extractScribbleData() {
        // You'll need to get the canvas data as a data URL.
        const canvas = document.getElementById('mainCanvas');
        if (canvas.toDataURL) {
            return canvas.toDataURL('image/png');
        }
        return null;
    }

    async callAiApi(method, url, apiKey, body) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}` // Assuming the API uses a Bearer token
        };

        const config = {
            method: method,
            headers: headers,
            body: JSON.stringify(body)
        };

        const response = await fetch(url, config);
        if (!response.ok) {
            throw new Error(`API call failed with status ${response.status}`);
        }

        return response.json();
    }
}

// LayerManager Class: Manages the stack of layers (drawings and images)
class LayerManager {
    constructor() {
        this.layers = [];
        this.activeLayer = null;
        this.undoStack = [];
        this.redoStack = [];
    }

    addLayer(layer) {
        this.saveStateToHistory();
        this.layers.push(layer);
        this.saveState();
        App.renderer.renderAllLayers();
    }

    addDrawingLayer(data) {
        this.addLayer({
            id: `drawing_${Date.now()}`,
            type: 'drawing',
            data: data
        });
        this.activeLayer = null;
    }

    addImageLayer(data) {
        const newLayer = {
            id: `image_${Date.now()}`,
            type: 'image',
            data: data,
            x: 50,
            y: 50,
            width: 200,
            height: 'auto'
        };
        this.addLayer(newLayer);
        this.setActiveLayer(newLayer);
    }

    getLayers() {
        return this.layers;
    }

    removeLayer(layerId) {
        this.saveStateToHistory();
        this.layers = this.layers.filter(layer => layer.id !== layerId);
        this.activeLayer = null;
        this.saveState();
        App.renderer.renderAllLayers();
        App.renderer.renderActiveState();
    }

    clearLayers() {
        this.saveStateToHistory();
        this.layers = [];
        this.activeLayer = null;
        this.saveState();
        App.renderer.renderAllLayers();
        App.renderer.renderActiveState();
    }

    setActiveLayer(layer) {
        this.activeLayer = layer;
        App.renderer.renderActiveState();
    }

    getLayerAt(x, y) {
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.type === 'image') {
                const img = new Image();
                img.src = layer.data;
                const layerWidth = layer.width;
                const layerHeight = App.renderer.getImageHeight(layer);
                if (x >= layer.x && x <= layer.x + layerWidth && y >= layer.y && y <= layer.y + layerHeight) {
                    if (this.activeLayer !== layer) {
                        this.setActiveLayer(layer);
                        this.saveStateToHistory();
                        // Bring the selected image to the top of the stack
                        if (this.layers.length > 1 && i !== this.layers.length - 1) {
                            const [selectedLayer] = this.layers.splice(i, 1);
                            this.layers.push(selectedLayer);
                            this.saveState();
                            App.renderer.renderAllLayers();
                        }
                    }
                    return layer;
                }
            }
        }
        this.setActiveLayer(null);
        return null;
    }

    saveStateToHistory() {
        if (JSON.stringify(this.layers) !== JSON.stringify(this.undoStack[this.undoStack.length - 1])) {
            this.undoStack.push(JSON.parse(JSON.stringify(this.layers)));
            this.redoStack = []; // Clear redo stack on new action
            if (this.undoStack.length > 50) { // Limit history to 50 states
                this.undoStack.shift();
            }
        }
    }

    undo() {
        if (this.undoStack.length > 0) {
            this.redoStack.push(JSON.parse(JSON.stringify(this.layers)));
            const prevState = this.undoStack.pop();
            this.layers = prevState;
            this.activeLayer = null;
            this.saveState();
            App.renderer.renderAllLayers();
            App.renderer.renderActiveState();
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            this.undoStack.push(JSON.parse(JSON.stringify(this.layers)));
            const nextState = this.redoStack.pop();
            this.layers = nextState;
            this.activeLayer = null;
            this.saveState();
            App.renderer.renderAllLayers();
            App.renderer.renderActiveState();
        }
    }

    saveState() {
        StorageManager.saveToLocalStorage(`layersState_${TabManager.activeTabId}`, JSON.stringify(this.layers));
    }

    loadState() {
        const savedState = StorageManager.getFromLocalStorage(`layersState_${TabManager.activeTabId}`);
        if (savedState) {
            try {
                this.layers = JSON.parse(savedState);
            } catch (e) {
                console.error("Failed to parse layers state:", e);
                this.layers = [];
            }
        } else {
            this.layers = [];
        }
        this.activeLayer = null;
        this.undoStack = [JSON.parse(JSON.stringify(this.layers))];
        this.redoStack = [];
        App.renderer.renderAllLayers();
        App.renderer.renderActiveState();
    }
}

// ToolManager Class: Manages the active tool (brush or pointer)
class ToolManager {
    constructor() {
        this.activeTool = 'brush'; // Default tool
        this.toolButtons = {
            brush: document.getElementById('brushTool'),
            pointer: document.getElementById('pointerTool')
        };
        this.setupEventListeners();
        this.updateToolButtons();
    }

    setTool(tool) {
        this.activeTool = tool;
        this.updateToolButtons();
        this.updateCanvasCursor();
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
        const mainCanvas = document.getElementById('mainCanvas');
        if (this.activeTool === 'brush') {
            mainCanvas.style.cursor = 'crosshair';
        } else {
            mainCanvas.style.cursor = 'default';
        }
    }

    setupEventListeners() {
        this.toolButtons.brush.addEventListener('click', () => this.setTool('brush'));
        this.toolButtons.pointer.addEventListener('click', () => this.setTool('pointer'));
    }
}

// InteractionManager Class: Handles mouse/touch events for dragging and resizing
class InteractionManager {
    constructor(overlayCanvas, layerManager, renderer) {
        this.overlayCanvas = overlayCanvas;
        this.layerManager = layerManager;
        this.renderer = renderer;
        this.isDragging = false;
        this.isResizing = false;
        this.dragStart = { x: 0, y: 0 };
        this.resizeHandle = null;

        this.overlayCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.overlayCanvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.overlayCanvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.overlayCanvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

        this.overlayCanvas.addEventListener('touchstart', (e) => this.handleMouseDown(e.touches[0]), { passive: false });
        this.overlayCanvas.addEventListener('touchmove', (e) => this.handleMouseMove(e.touches[0]), { passive: false });
        this.overlayCanvas.addEventListener('touchend', () => this.handleMouseUp(), { passive: false });
    }

    handleMouseDown(e) {
        const rect = this.overlayCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (App.toolManager.activeTool === 'pointer') {
            e.preventDefault();
            const activeLayer = this.layerManager.activeLayer;

            if (activeLayer && activeLayer.type === 'image') {
                const handles = this.renderer.getImageHandles(activeLayer);
                
                // Check if the close button was clicked
                const closeBtn = this.renderer.getCloseButton(activeLayer);
                if (mouseX >= closeBtn.x - 12 && mouseX <= closeBtn.x + 12 && mouseY >= closeBtn.y - 12 && mouseY <= closeBtn.y + 12) {
                    this.layerManager.removeLayer(activeLayer.id);
                    return;
                }

                for (const key in handles) {
                    const handle = handles[key];
                    if (mouseX >= handle.x - 6 && mouseX <= handle.x + 6 && mouseY >= handle.y - 6 && mouseY <= handle.y + 6) {
                        this.isResizing = true;
                        this.resizeHandle = key;
                        this.dragStart = { x: mouseX, y: mouseY, width: activeLayer.width, height: this.renderer.getImageHeight(activeLayer) };
                        return;
                    }
                }
            }
            const clickedLayer = this.layerManager.getLayerAt(mouseX, mouseY);
            if (clickedLayer && clickedLayer.type === 'image') {
                this.isDragging = true;
                this.dragStart = { x: mouseX, y: mouseY, layerX: clickedLayer.x, layerY: clickedLayer.y };
            }
        } else if (App.toolManager.activeTool === 'brush') {
            this.renderer.handleDrawingMouseDown(mouseX, mouseY);
        }
    }

    handleMouseMove(e) {
        const rect = this.overlayCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (App.toolManager.activeTool === 'pointer') {
            const activeLayer = this.layerManager.activeLayer;

            if (this.isDragging && activeLayer && activeLayer.type === 'image') {
                const dx = mouseX - this.dragStart.x;
                const dy = mouseY - this.dragStart.y;
                activeLayer.x = this.dragStart.layerX + dx;
                activeLayer.y = this.dragStart.layerY + dy;
                this.renderer.renderActiveState();
            } else if (this.isResizing && activeLayer && activeLayer.type === 'image') {
                const dx = mouseX - this.dragStart.x;
                const dy = mouseY - this.dragStart.y;

                if (this.resizeHandle === 'br') {
                    activeLayer.width = Math.max(20, this.dragStart.width + dx);
                } else if (this.resizeHandle === 'bl') {
                    const newWidth = Math.max(20, this.dragStart.width - dx);
                    activeLayer.x = this.dragStart.layerX + (this.dragStart.width - newWidth);
                    activeLayer.width = newWidth;
                } else if (this.resizeHandle === 'tr') {
                    activeLayer.width = Math.max(20, this.dragStart.width + dx);
                    const newHeight = Math.max(20, this.dragStart.height - dy);
                    activeLayer.y = this.dragStart.layerY + (this.dragStart.height - newHeight);
                } else if (this.resizeHandle === 'tl') {
                    const newWidth = Math.max(20, this.dragStart.width - dx);
                    activeLayer.x = this.dragStart.layerX + (this.dragStart.width - newWidth);
                    const newHeight = Math.max(20, this.dragStart.height - dy);
                    activeLayer.y = this.dragStart.layerY + (this.dragStart.height - newHeight);
                }

                const img = new Image();
                img.src = activeLayer.data;
                const aspectRatio = img.width / img.height;
                activeLayer.height = activeLayer.width / aspectRatio;

                this.renderer.renderActiveState();
            }
        } else if (App.toolManager.activeTool === 'brush') {
            this.renderer.handleDrawingMouseMove(mouseX, mouseY);
        }
    }

    handleMouseUp() {
        if (this.isDragging || this.isResizing) {
            this.isDragging = false;
            this.isResizing = false;
            this.dragStart = { x: 0, y: 0 };
            this.resizeHandle = null;
            this.layerManager.saveStateToHistory();
            this.layerManager.saveState();
            this.renderer.renderAllLayers(); // Final render on main canvas
        } else if (App.toolManager.activeTool === 'brush') {
            this.renderer.handleDrawingMouseUp();
        }
    }
}

// Renderer Class: Manages drawing and displaying all layers on the main canvas
class Renderer {
    constructor(mainCanvasId, overlayCanvasId) {
        this.mainCanvas = document.getElementById(mainCanvasId);
        this.mainCtx = this.mainCanvas.getContext('2d');
        this.overlayCanvas = document.getElementById(overlayCanvasId);
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        this.isDrawing = false;
        this.points = [];
        this.currentDrawingCanvas = document.createElement('canvas'); // Temp canvas for single strokes
        this.currentDrawingCtx = this.currentDrawingCanvas.getContext('2d');

        this.resizeCanvas = debounce(this._resizeCanvas.bind(this), 200);
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas);

        this.setupCanvas();
        this.setupControls();
        this.setupButtons();
    }

    _resizeCanvas() {
        const sidebar = document.querySelector('.controls-sidebar');
        const footer = document.querySelector('#footer');
        const header = document.getElementById('header');
        const tabBar = document.getElementById('tab-bar');

        const sidebarWidth = sidebar ? sidebar.offsetWidth : 0;
        const footerHeight = footer ? footer.offsetHeight : 0;
        const headerHeight = header ? header.offsetHeight : 0;
        const tabBarHeight = tabBar ? tabBar.offsetHeight : 0;

        this.mainCanvas.width = window.innerWidth - sidebarWidth;
        this.mainCanvas.height = window.innerHeight - footerHeight - headerHeight - tabBarHeight;
        this.overlayCanvas.width = this.mainCanvas.width;
        this.overlayCanvas.height = this.mainCanvas.height;

        this.renderAllLayers();
        this.renderActiveState();
    }

    setupCanvas() {
        this.mainCtx.lineCap = 'round';
        this.mainCtx.lineJoin = 'round';
        this.mainCtx.lineWidth = 5;
        this.mainCtx.strokeStyle = '#000';
        
        this.currentDrawingCtx.lineCap = 'round';
        this.currentDrawingCtx.lineJoin = 'round';
    }
    
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
                this.mainCtx.strokeStyle = color;
                this.currentDrawingCtx.strokeStyle = color;
            });
        });

        if (document.querySelector('.color-box[data-color="#000000"]')) {
            document.querySelector('.color-box[data-color="#000000"]').classList.add('active');
        }
        
        const brushSizeSlider = document.getElementById('brushSizeSlider');
        const brushSizeValue = document.getElementById('brushSizeValue');
        
        brushSizeSlider.addEventListener('input', () => {
            const size = brushSizeSlider.value;
            this.mainCtx.lineWidth = size;
            this.currentDrawingCtx.lineWidth = size;
            brushSizeValue.textContent = size;
        });
    }

    setupButtons() {
        document.getElementById('clearButton').addEventListener('click', () => App.layerManager.clearLayers());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadCanvas());
        document.getElementById('printBtn').addEventListener('click', () => this.printCanvas());
        
        // Add keyboard shortcuts for undo/redo
        document.addEventListener('keydown', (e) => {
            const isMac = (navigator.platform.toUpperCase().indexOf('MAC') >= 0);
            if (e.key === 'z' && (isMac ? e.metaKey : e.ctrlKey)) {
                e.preventDefault();
                App.layerManager.undo();
            } else if (e.key === 'y' && (isMac ? e.metaKey : e.ctrlKey)) {
                e.preventDefault();
                App.layerManager.redo();
            }
        });
    }

    handleDrawingMouseDown(x, y) {
        this.isDrawing = true;
        this.points = [{ x, y }];
        
        this.currentDrawingCanvas.width = this.overlayCanvas.width;
        this.currentDrawingCanvas.height = this.overlayCanvas.height;
        this.currentDrawingCtx.clearRect(0, 0, this.currentDrawingCanvas.width, this.currentDrawingCanvas.height);
        this.currentDrawingCtx.strokeStyle = this.mainCtx.strokeStyle;
        this.currentDrawingCtx.lineWidth = this.mainCtx.lineWidth;
    }

    handleDrawingMouseMove(x, y) {
        if (!this.isDrawing) return;
        this.points.push({ x, y });
        
        this.currentDrawingCtx.clearRect(0, 0, this.currentDrawingCanvas.width, this.currentDrawingCanvas.height);
        this.currentDrawingCtx.beginPath();
        this.currentDrawingCtx.moveTo(this.points[0].x, this.points[0].y);
        
        for (let i = 1; i < this.points.length - 1; i++) {
            const midPoint = {
                x: (this.points[i].x + this.points[i + 1].x) / 2,
                y: (this.points[i].y + this.points[i + 1].y) / 2,
            };
            this.currentDrawingCtx.quadraticCurveTo(this.points[i].x, this.points[i].y, midPoint.x, midPoint.y);
        }
        
        const lastPoint = this.points[this.points.length - 2];
        const lastMidPoint = {
            x: (lastPoint.x + x) / 2,
            y: (lastPoint.y + y) / 2,
        };
        this.currentDrawingCtx.quadraticCurveTo(lastPoint.x, lastPoint.y, lastMidPoint.x, lastMidPoint.y);
        
        this.currentDrawingCtx.stroke();
        this.renderActiveState();
    }

    handleDrawingMouseUp() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        if (this.points.length > 0) {
            App.layerManager.addDrawingLayer(this.currentDrawingCanvas.toDataURL());
        }
        
        this.points = [];
        this.renderActiveState();
    }

    getImageHeight(layer) {
        const img = new Image();
        img.src = layer.data;
        const aspectRatio = img.width / img.height;
        return layer.width / aspectRatio;
    }

    getImageHandles(layer) {
        const height = this.getImageHeight(layer);
        return {
            br: { x: layer.x + layer.width, y: layer.y + height },
            bl: { x: layer.x, y: layer.y + height },
            tr: { x: layer.x + layer.width, y: layer.y },
            tl: { x: layer.x, y: layer.y }
        };
    }

    getCloseButton(layer) {
        return {
            x: layer.x + layer.width,
            y: layer.y
        };
    }

    renderAllLayers() {
        this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        
        const layers = App.layerManager.getLayers();
        layers.forEach(layer => {
            const img = new Image();
            img.onload = () => {
                if (layer.type === 'drawing') {
                    this.mainCtx.drawImage(img, 0, 0);
                } else if (layer.type === 'image') {
                    const layerHeight = this.getImageHeight(layer);
                    this.mainCtx.drawImage(img, layer.x, layer.y, layer.width, layerHeight);
                }
            };
            img.src = layer.data;
        });
    }

    renderActiveState() {
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // Render the current, unsaved drawing stroke on top
        if (this.isDrawing) {
            this.overlayCtx.drawImage(this.currentDrawingCanvas, 0, 0);
        }

        // Draw selection and resize handles for the active layer
        const activeLayer = App.layerManager.activeLayer;
        if (activeLayer && activeLayer.type === 'image') {
            const height = this.getImageHeight(activeLayer);
            this.overlayCtx.strokeStyle = '#007bff';
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.setLineDash([5, 5]);
            this.overlayCtx.strokeRect(activeLayer.x, activeLayer.y, activeLayer.width, height);
            this.overlayCtx.setLineDash([]); // Reset line dash

            const handles = this.getImageHandles(activeLayer);
            this.overlayCtx.fillStyle = '#007bff';
            for (const key in handles) {
                const handle = handles[key];
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(handle.x, handle.y, 6, 0, 2 * Math.PI);
                this.overlayCtx.fill();
                this.overlayCtx.stroke();
            }

            // Draw the close button
            const closeBtn = this.getCloseButton(activeLayer);
            this.overlayCtx.fillStyle = '#ff4444';
            this.overlayCtx.beginPath();
            this.overlayCtx.arc(closeBtn.x, closeBtn.y, 10, 0, 2 * Math.PI);
            this.overlayCtx.fill();
            this.overlayCtx.fillStyle = '#fff';
            this.overlayCtx.font = 'bold 16px Arial';
            this.overlayCtx.textAlign = 'center';
            this.overlayCtx.textBaseline = 'middle';
            this.overlayCtx.fillText('x', closeBtn.x, closeBtn.y);
        }
    }

   downloadCanvas() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.mainCanvas.width;
        tempCanvas.height = this.mainCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
    
        const layers = App.layerManager.getLayers();
        let loadedCount = 0;
        const totalLayers = layers.length;
    
        const renderAndDownload = () => {
            // Draw the current, unsaved drawing stroke on top if it exists
            if (this.isDrawing) {
                tempCtx.drawImage(this.currentDrawingCanvas, 0, 0);
            }
    
            const url = tempCanvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            a.download = `scribbler_drawing_${TabManager.activeTabId}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
    
        if (totalLayers === 0) {
            renderAndDownload();
        } else {
            layers.forEach(layer => {
                const img = new Image();
                img.onload = () => {
                    if (layer.type === 'image') {
                        const layerHeight = this.getImageHeight(layer);
                        tempCtx.drawImage(img, layer.x, layer.y, layer.width, layerHeight);
                    } else if (layer.type === 'drawing') {
                        tempCtx.drawImage(img, 0, 0);
                    }
                    loadedCount++;
                    if (loadedCount === totalLayers) {
                        renderAndDownload();
                    }
                };
                img.src = layer.data;
            });
        }
    }
    
    // Add the corrected code for the printCanvas and downloadCanvas methods within the Renderer class
    printCanvas() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.mainCanvas.width;
        tempCanvas.height = this.mainCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
    
        const layers = App.layerManager.getLayers();
        let loadedCount = 0;
        const totalImages = layers.filter(l => l.type === 'image').length;
    
        const renderAndPrint = () => {
            // Check if a current drawing exists and draw it onto the temp canvas
            if (this.isDrawing) {
                tempCtx.drawImage(this.currentDrawingCanvas, 0, 0);
            }
            
            const dataUrl = tempCanvas.toDataURL('image/png');
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
            
            // Wait for the image to load in the new window before printing
            const img = printWindow.document.querySelector('img');
            img.onload = () => {
                printWindow.print();
                printWindow.close();
            };
        };
    
        if (totalImages === 0) {
            renderAndPrint();
        } else {
            layers.forEach(layer => {
                if (layer.type === 'drawing') {
                    const img = new Image();
                    img.onload = () => {
                        tempCtx.drawImage(img, 0, 0);
                        loadedCount++;
                        if (loadedCount === layers.length) {
                            renderAndPrint();
                        }
                    };
                    img.src = layer.data;
                } else if (layer.type === 'image') {
                    const img = new Image();
                    img.onload = () => {
                        const layerHeight = this.getImageHeight(layer);
                        tempCtx.drawImage(img, layer.x, layer.y, layer.width, layerHeight);
                        loadedCount++;
                        if (loadedCount === layers.length) {
                            renderAndPrint();
                        }
                    };
                    img.src = layer.data;
                }
            });
        }
    }
}

// TabManager Class: Handles multi-sheet functionality
class TabManager {
    static activeTabId = 'tab-1';
    static tabList = [];
    static layerManager = null;
    
    static initialize(layerManager) {
        this.layerManager = layerManager;
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
            this.layerManager.loadState();
            this.saveTabsToStorage();
        }
    }

    static removeTab(tabId) {
        if (this.tabList.length === 1) {
            alert("Cannot delete the last sheet.");
            return;
        }

        this.tabList = this.tabList.filter(tab => tab.id !== tabId);
        StorageManager.removeFromLocalStorage(`layersState_${tabId}`);

        if (this.activeTabId === tabId) {
            const newActiveTabId = this.tabList[0].id; // Switch to the first tab
            this.switchToTab(newActiveTabId);
        } else {
            this.saveTabsToStorage();
            this.renderTabs(); // Re-render all tabs
        }
    }
}

// Image Handling
const imageInput = document.getElementById('image-upload');
const uploadButton = document.getElementById('uploadImageBtn');
uploadButton.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        App.layerManager.addImageLayer(event.target.result);
    };
    reader.readAsDataURL(file);
    imageInput.value = ''; // Reset input for same file upload
});


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
    static layerManager;
    static renderer;
    static toolManager;
    static interactionManager;
    static apiKeyManager;
    static scribbleAIIntegration;

    static initialize() {
        this.layerManager = new LayerManager();
        this.renderer = new Renderer('mainCanvas', 'overlayCanvas');
        this.toolManager = new ToolManager();
        this.interactionManager = new InteractionManager(this.renderer.overlayCanvas, this.layerManager, this.renderer);
        this.apiKeyManager = new ApiKeyManager();
        this.scribbleAIIntegration = new ScribbleAIIntegration(this); // Pass the App instance
        TabManager.initialize(this.layerManager);
    }
}
// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
    App.initialize();
});