// tile-cache.js — Computes CSS background values for image tile slicing.
// Uses a pure CSS background approach: no canvas rasterization needed.
// The full image is set as background-image; background-size + background-position
// crop the correct tile portion for each correctIndex.

export class TileCache {
  #imageUrl = null;   // object URL (may point to a downscaled canvas blob)
  #bgSize = null;     // { w, h } in px — the scaled image dimensions
  #bgOrigin = null;   // { x, y } in px — offset to center aspect-filled image

  // Call when a new image is selected.
  // tileSize: CSS pixel tile width/height (square)
  // gridSize: 3 or 4
  setImage(file, tileSize, gridSize) {
    if (this.#imageUrl) URL.revokeObjectURL(this.#imageUrl);
    this.#imageUrl = null;
    this.#bgSize = null;
    this.#bgOrigin = null;
    this.#loadAndPrepare(file, tileSize, gridSize);
  }

  hasImage() {
    return this.#imageUrl !== null;
  }

  // Returns CSS style object for a tile's background, given its correctIndex.
  // correctIndex: which tile (0-based) in solved order
  // tileSize: CSS px width/height
  // gridSize: 3 or 4
  getStyle(correctIndex, tileSize, gridSize) {
    if (!this.#imageUrl || !this.#bgSize) return {};
    const col = correctIndex % gridSize;
    const row = Math.floor(correctIndex / gridSize);
    const bx = this.#bgOrigin.x - col * tileSize;
    const by = this.#bgOrigin.y - row * tileSize;
    return {
      backgroundImage: `url(${this.#imageUrl})`,
      backgroundSize: `${this.#bgSize.w}px ${this.#bgSize.h}px`,
      backgroundPosition: `${bx}px ${by}px`,
      backgroundRepeat: 'no-repeat',
    };
  }

  getImageUrl() {
    return this.#imageUrl;
  }

  clear() {
    if (this.#imageUrl) URL.revokeObjectURL(this.#imageUrl);
    this.#imageUrl = null;
    this.#bgSize = null;
    this.#bgOrigin = null;
  }

  // Load image and downscale if needed before storing.
  // iPhone photos can be 12MP+ — each tile holding the full texture in GPU
  // memory causes iOS to evict layers and flash black. Capping at 2× the
  // puzzle display size (retina) keeps GPU usage tiny without visible quality loss.
  #loadAndPrepare(file, tileSize, gridSize) {
    const rawUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const puzzleSize = tileSize * gridSize;
      const scale = Math.max(puzzleSize / img.naturalWidth, puzzleSize / img.naturalHeight);
      const scaledW = img.naturalWidth * scale;
      const scaledH = img.naturalHeight * scale;
      const originX = (puzzleSize - scaledW) / 2;
      const originY = (puzzleSize - scaledH) / 2;

      const applyLayout = (url) => {
        this.#imageUrl = url;
        this.#bgSize   = { w: scaledW, h: scaledH };
        this.#bgOrigin = { x: originX, y: originY };
      };

      // 2× puzzle size is plenty for retina; beyond that we're just burning GPU memory.
      const maxDim = puzzleSize * 2;
      if (img.naturalWidth > maxDim || img.naturalHeight > maxDim) {
        const factor = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.ceil(img.naturalWidth  * factor);
        canvas.height = Math.ceil(img.naturalHeight * factor);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(rawUrl);
        canvas.toBlob(blob => applyLayout(URL.createObjectURL(blob)), 'image/jpeg', 0.92);
      } else {
        applyLayout(rawUrl);
      }
    };

    img.onerror = () => URL.revokeObjectURL(rawUrl);
    img.src = rawUrl;
  }
}
