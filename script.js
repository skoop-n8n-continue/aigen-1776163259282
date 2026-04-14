/**
 * Pencil App - Core Logic
 * Uses Pointer Events API for unified input handling (Mouse, Touch, Stylus)
 */

class PencilApp {
    constructor() {
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.tempCanvas = document.getElementById('temp-canvas');
        this.tempCtx = this.tempCanvas.getContext('2d');

        // State
        this.isDrawing = false;
        this.currentTool = 'pencil';
        this.currentColor = '#00b7af';
        this.currentSize = 5;
        this.points = []; // For line smoothing
        this.undoStack = [];
        this.maxUndoSteps = 30;

        // Initialize
        this.init();
        this.setupEventListeners();
        this.saveState(); // Initial state
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.updateCursor();
    }

    resize() {
        const wrapper = document.querySelector('.canvas-wrapper');
        const width = wrapper.clientWidth;
        const height = wrapper.clientHeight;

        // Create temporary canvas to hold existing image
        const offscreen = document.createElement('canvas');
        offscreen.width = this.canvas.width;
        offscreen.height = this.canvas.height;
        const offCtx = offscreen.getContext('2d');
        if (this.canvas.width > 0 && this.canvas.height > 0) {
            offCtx.drawImage(this.canvas, 0, 0);
        }

        // Resize main canvases
        this.canvas.width = width;
        this.canvas.height = height;
        this.tempCanvas.width = width;
        this.tempCanvas.height = height;

        // Draw back
        this.ctx.drawImage(offscreen, 0, 0);
        this.updateBrushSettings();
    }

    setupEventListeners() {
        // Pointer Events (Mouse, Touch, Stylus)
        this.canvas.addEventListener('pointerdown', (e) => this.startDrawing(e));
        window.addEventListener('pointermove', (e) => this.draw(e));
        window.addEventListener('pointerup', (e) => this.stopDrawing(e));
        window.addEventListener('pointercancel', (e) => this.stopDrawing(e));

        // Tool Buttons
        document.getElementById('pencil-tool').addEventListener('click', () => this.setTool('pencil'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('clear-btn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadImage());

        // Inputs
        const colorPicker = document.getElementById('color-picker');
        const colorPreview = document.getElementById('color-preview');
        colorPicker.addEventListener('input', (e) => {
            this.currentColor = e.target.value;
            colorPreview.style.backgroundColor = this.currentColor;
        });

        const sizeSlider = document.getElementById('size-slider');
        const sizeValue = document.getElementById('size-value');
        sizeSlider.addEventListener('input', (e) => {
            this.currentSize = parseInt(e.target.value);
            sizeValue.textContent = `${this.currentSize}px`;
        });

        // Shortcut keys
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
        });
    }

    updateBrushSettings() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = this.currentSize;

        if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
        }
    }

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${tool}-tool`).classList.add('active');
        this.updateCursor();
    }

    updateCursor() {
        this.canvas.style.cursor = 'crosshair';
    }

    startDrawing(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        this.isDrawing = true;
        const pos = this.getPointerPos(e);
        this.points = [pos];

        this.updateBrushSettings();

        // Single dot handling
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);

        e.preventDefault();
    }

    draw(e) {
        if (!this.isDrawing) return;

        const pos = this.getPointerPos(e);
        this.points.push(pos);

        if (this.points.length > 2) {
            const lastTwoPoints = this.points.slice(-2);
            const controlPoint = lastTwoPoints[0];
            const endPoint = {
                x: (lastTwoPoints[0].x + lastTwoPoints[1].x) / 2,
                y: (lastTwoPoints[0].y + lastTwoPoints[1].y) / 2
            };

            this.ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, endPoint.x, endPoint.y);
            this.ctx.stroke();

            // Setup for next segment
            this.ctx.beginPath();
            this.ctx.moveTo(endPoint.x, endPoint.y);
        } else {
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        }

        e.preventDefault();
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.saveState();
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    saveState() {
        const dataUrl = this.canvas.toDataURL();
        if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === dataUrl) {
            return;
        }

        this.undoStack.push(dataUrl);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length <= 1) {
            // If only one state (initial blank), just clear
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.undoStack.pop(); // Remove current state
        const lastState = this.undoStack[this.undoStack.length - 1];

        const img = new Image();
        img.onload = () => {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
            this.updateBrushSettings();
        };
        img.src = lastState;
    }

    clearCanvas() {
        if (confirm('Clear entire canvas?')) {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.saveState();
        }
    }

    downloadImage() {
        const downloadCanvas = document.createElement('canvas');
        downloadCanvas.width = this.canvas.width;
        downloadCanvas.height = this.canvas.height;
        const dCtx = downloadCanvas.getContext('2d');

        // Background
        dCtx.fillStyle = '#000000';
        dCtx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);

        // Content
        dCtx.drawImage(this.canvas, 0, 0);

        const link = document.createElement('a');
        link.download = `drawing-${Date.now()}.png`;
        link.href = downloadCanvas.toDataURL('image/png');
        link.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PencilApp();
});
