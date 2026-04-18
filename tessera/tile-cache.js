// tile-cache.js — Computes CSS background values for image tile slicing.
// Uses a pure CSS background approach: no canvas rasterization needed.
// The full image is set as background-image; background-size + background-position
// crop the correct tile portion for each correctIndex.

export class TileCache {
  #imageUrl = null;   // object URL from createObjectURL
  #bgSize = null;     // { w, h } in px — the scaled image dimensions
  #bgOrigin = null;   // { x, y } in px — offset to center aspect-filled image

  // Call when a new image is selected.
  // tileSize: CSS pixel tile width/height (square)
  // gridSize: 3 or 4
  setImage(file, tileSize, gridSize) {
    // Revoke previous object URL to avoid memory leaks
    if (this.#imageUrl) URL.revokeObjectURL(this.#imageUrl);
    this.#imageUrl = URL.createObjectURL(file);
    this.#computeLayout(file, tileSize, gridSize);
  }

  // Call when tileSize or gridSize changes (grid resize / window resize).
  // Requires setImage to have been called first.
  updateLayout(file, tileSize, gridSize) {
    this.#computeLayout(file, tileSize, gridSize);
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

  // Precompute aspect-fill layout so getStyle() is O(1) per tile
  #computeLayout(file, tileSize, gridSize) {
    if (!file || tileSize <= 0) return;

    const img = new Image();
    img.onload = () => {
      const puzzleSize = tileSize * gridSize;
      const scaleX = puzzleSize / img.naturalWidth;
      const scaleY = puzzleSize / img.naturalHeight;
      const scale = Math.max(scaleX, scaleY); // aspect-fill
      const scaledW = img.naturalWidth * scale;
      const scaledH = img.naturalHeight * scale;
      const originX = (puzzleSize - scaledW) / 2;
      const originY = (puzzleSize - scaledH) / 2;
      this.#bgSize = { w: scaledW, h: scaledH };
      this.#bgOrigin = { x: originX, y: originY };
    };
    img.src = this.#imageUrl;
  }

  clear() {
    if (this.#imageUrl) URL.revokeObjectURL(this.#imageUrl);
    this.#imageUrl = null;
    this.#bgSize = null;
    this.#bgOrigin = null;
  }
}
