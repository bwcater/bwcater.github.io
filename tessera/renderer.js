// renderer.js — DOM tile grid builder and updater

export const GAP = 3;
export const PADDING = 10;

export class Renderer {
  #gridEl;
  #boardEl;
  #tileEls = [];     // indexed by grid position
  #tileSize = 0;
  #showNumbers = true;
  #tileCache;

  constructor(gridEl, tileCache) {
    this.#gridEl = gridEl;
    this.#boardEl = gridEl.parentElement;
    this.#tileCache = tileCache;
  }

  // Full rebuild — call on gridSize change, new game start, or image change
  buildGrid(game) {
    const g = game.gridSize;
    this.#tileSize = this.#computeTileSize(g);
    this.#gridEl.style.setProperty('--grid-size', g);

    this.#gridEl.innerHTML = '';
    this.#tileEls = [];

    // Show solved/preview grid (all tiles in order, including the last slot)
    // or active shuffled grid
    const showAll = !game.isStarted || game.isWon;

    for (let pos = 0; pos < g * g; pos++) {
      const el = this.#makeTileEl(pos, game, showAll);
      this.#gridEl.appendChild(el);
      this.#tileEls.push(el);
    }
  }

  // Incremental update after a move — cheaper than full rebuild
  update(game) {
    const g = game.gridSize;
    const showAll = !game.isStarted || game.isWon;

    for (let pos = 0; pos < g * g; pos++) {
      this.#updateTileEl(this.#tileEls[pos], pos, game, showAll);
    }
  }

  // Called every pointermove — hot path, only updates transform
  applySlideOffset(positions, offset, isHorizontal, direction) {
    const px = offset * direction;
    const transform = isHorizontal
      ? `translate(${px}px, 0)`
      : `translate(0, ${px}px)`;
    for (const pos of positions) {
      const el = this.#tileEls[pos];
      if (!el) continue;
      el.style.transform = transform;
      el.style.zIndex = '1';
    }
  }

  clearSlideOffset(positions) {
    for (const pos of positions) {
      const el = this.#tileEls[pos];
      if (!el) continue;
      el.style.transform = '';
      el.style.zIndex = '';
    }
  }

  // Spring snap-back via CSS transition
  snapBackTiles(positions, isHorizontal) {
    for (const pos of positions) {
      const el = this.#tileEls[pos];
      if (!el) continue;
      el.style.transition = 'transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'translate(0, 0)';
      el.addEventListener('transitionend', () => {
        el.style.transition = '';
        el.style.transform = '';
        el.style.zIndex = '';
      }, { once: true });
    }
  }

  // Animate a hint move: slide tile toward empty then commit
  // Returns a Promise that resolves after the animation completes
  animateMove(position, game) {
    return new Promise(resolve => {
      const g = game.gridSize;
      const ep = game.emptyPosition;
      const isHorizontal = Math.floor(position / g) === Math.floor(ep / g);
      const direction = isHorizontal
        ? (ep % g > position % g ? 1 : -1)
        : (Math.floor(ep / g) > Math.floor(position / g) ? 1 : -1);
      const stepSize = this.#tileSize + GAP;

      const el = this.#tileEls[position];
      if (!el) { resolve(); return; }

      const px = stepSize * direction;
      const transform = isHorizontal
        ? `translate(${px}px, 0)`
        : `translate(0, ${px}px)`;

      el.style.transition = 'transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      el.style.transform = transform;
      el.style.zIndex = '1';

      setTimeout(() => {
        el.style.transition = '';
        el.style.transform = '';
        el.style.zIndex = '';
        resolve();
      }, 220);
    });
  }

  triggerWinAnimation() {
    this.#gridEl.classList.remove('win-pulse');
    this.#boardEl.classList.remove('win-shimmer');
    void this.#gridEl.offsetWidth; // force reflow
    this.#gridEl.classList.add('win-pulse');
    setTimeout(() => {
      this.#boardEl.classList.add('win-shimmer');
    }, 280);
    setTimeout(() => {
      this.#gridEl.classList.remove('win-pulse');
      this.#boardEl.classList.remove('win-shimmer');
    }, 1100);
  }

  setShowNumbers(show) {
    this.#showNumbers = show;
    this.#gridEl.classList.toggle('hide-numbers', !show);
  }

  getTileSize() {
    return this.#tileSize;
  }

  // Recompute layout when puzzle board size changes
  refreshLayout(game) {
    this.#tileSize = this.#computeTileSize(game.gridSize);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  #computeTileSize(gridSize) {
    const boardSize = this.#boardEl ? this.#boardEl.clientWidth - PADDING * 2 : 300;
    return Math.floor((boardSize - GAP * (gridSize - 1)) / gridSize);
  }

  #makeTileEl(position, game, showAll) {
    const el = document.createElement('div');
    this.#updateTileEl(el, position, game, showAll);
    return el;
  }

  #updateTileEl(el, position, game, showAll) {
    const g = game.gridSize;
    el.dataset.position = position;

    // Determine correctIndex for this slot
    let correctIndex;
    if (showAll) {
      correctIndex = position; // solved/preview: tile at position = its own correctIndex
    } else {
      correctIndex = game.tiles[position]; // null for empty cell
    }

    // Reset classes
    el.className = 'tile';

    if (correctIndex == null) {
      // Empty cell
      el.className = 'tile-empty';
      el.style.cssText = `width:${this.#tileSize}px;height:${this.#tileSize}px;`;
      el.innerHTML = '';
      return;
    }

    // Is this tile movable (same row or col as empty)?
    const isMovable = game.isStarted && !game.isWon && game.canSlide(position);

    el.classList.toggle('movable', isMovable);
    el.style.cssText = `width:${this.#tileSize}px;height:${this.#tileSize}px;`;

    // Apply image background or gradient placeholder
    if (this.#tileCache.hasImage()) {
      const style = this.#tileCache.getStyle(correctIndex, this.#tileSize, g);
      el.style.backgroundImage = style.backgroundImage;
      el.style.backgroundSize = style.backgroundSize;
      el.style.backgroundPosition = style.backgroundPosition;
      el.style.backgroundRepeat = style.backgroundRepeat;
    } else {
      // Rainbow gradient placeholder — unique per tile
      const n = g * g;
      const hue1 = (correctIndex / (n - 1)) * 360;
      const hue2 = ((correctIndex + 1) / (n - 1)) * 360;
      el.style.backgroundImage =
        `linear-gradient(135deg, hsl(${hue1},65%,70%), hsl(${hue2},55%,50%))`;
    }

    // Tile number label
    const numSize = Math.min(this.#tileSize * 0.3, 22);
    el.innerHTML = `<span class="tile-num" style="font-size:${numSize * 0.6}px;width:${numSize}px;height:${numSize}px;">${correctIndex + 1}</span>`;
  }
}
