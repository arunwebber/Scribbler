<p align="center">
  <img src="https://raw.githubusercontent.com/arunwebber/Scribbler/refs/heads/main/images/icon_128.png" alt="Centered Icon" width="128" height="128">
</p>

# Scribbler Chrome Extension

## Overview
Scribbler is a simple Chrome extension that allows users to draw freely on a canvas within a popup. It supports dynamic resizing of the canvas to match the window size, allowing users to scribble anywhere within the popup. The user can also clear the canvas with a button.

## Features
- **Dynamic Canvas Resizing**: The canvas automatically adjusts to fit the size of the window, both when resized or initially loaded.
- **Freehand Drawing**: Users can draw freely using their mouse or touchpad.
- **Clear Button**: A button is provided to clear the canvas and start a fresh drawing.
- **Responsive Layout**: The canvas adjusts to the width and height of the popup window.

## Installation
1. Download the extension files.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer Mode** (toggle in the top right).
4. Click **Load unpacked** and select the folder containing the extension files.
5. The Scribbler extension should now be installed and available in the toolbar.

## How to Use
1. Click on the Scribbler extension icon in your browser toolbar.
2. A popup window will appear with a blank canvas ready for drawing.
3. Use your mouse or touchpad to scribble freely on the canvas.
4. Click the **Clear** button at the bottom to reset the canvas and start over.
5. Resize the popup window to see the canvas automatically adjust to the new size.

## Files
- `popup.html`: The HTML structure for the popup, including the canvas and button elements.
- `style.css`: Basic styling for the canvas and buttons.
- `popup.js`: The JavaScript that handles the canvas drawing functionality, resizing logic, and button actions.

## License
This project is open-source and available under the [MIT License](LICENSE).

## Contributing
Feel free to submit issues or pull requests for improvements. All contributions are welcome!
