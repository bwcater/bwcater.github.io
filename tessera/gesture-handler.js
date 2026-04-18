// gesture-handler.js — Drag gesture handler (port of buildSlideGesture from ContentView.swift)
// Uses Pointer Events API (unified mouse + touch).

export class GestureHandler {
  #gridEl;
  #game;
  #renderer;
  #sound;
  #onMoveCommitted;
  #tileSize;
  #gap;
  #padding;

  // Current drag state (mirrors Swift's SlideState)
  #slideState = null;
  // { positions[], isHorizontal, direction, stepSize, liveOffset, maxTravel }

  #activePointerId = null;
  #dragOrigin = null;   // { x, y } client coords at pointerdown
  #draggedPosition = null;

  #onPointerDown;
  #onPointerMove;
  #onPointerUp;
  #onPointerCancel;

  constructor(gridEl, game, renderer, sound, onMoveCommitted) {
    this.#gridEl = gridEl;
    this.#game = game;
    this.#renderer = renderer;
    this.#sound = sound;
    this.#onMoveCommitted = onMoveCommitted;

    this.#onPointerDown = this.#handlePointerDown.bind(this);
    this.#onPointerMove = this.#handlePointerMove.bind(this);
    this.#onPointerUp = this.#handlePointerUp.bind(this);
    this.#onPointerCancel = this.#handlePointerCancel.bind(this);
  }

  enable() {
    this.#gridEl.addEventListener('pointerdown', this.#onPointerDown);
    this.#gridEl.addEventListener('pointermove', this.#onPointerMove);
    this.#gridEl.addEventListener('pointerup', this.#onPointerUp);
    this.#gridEl.addEventListener('pointercancel', this.#onPointerCancel);
  }

  disable() {
    this.#gridEl.removeEventListener('pointerdown', this.#onPointerDown);
    this.#gridEl.removeEventListener('pointermove', this.#onPointerMove);
    this.#gridEl.removeEventListener('pointerup', this.#onPointerUp);
    this.#gridEl.removeEventListener('pointercancel', this.#onPointerCancel);
    this.#clearDrag();
  }

  // Call whenever layout changes (tileSize, gridSize, padding, gap)
  updateLayout(tileSize, gap, padding) {
    this.#tileSize = tileSize;
    this.#gap = gap;
    this.#padding = padding;
  }

  // ─── Pointer handlers ──────────────────────────────────────────────────

  #handlePointerDown(e) {
    if (this.#activePointerId !== null) return;
    if (!this.#game.isStarted || this.#game.isSolving) return;

    const position = this.#positionFromPoint(e.clientX, e.clientY);
    if (position === -1) return;
    if (!this.#game.canSlide(position)) return;
    if (this.#game.tiles[position] == null) return; // tapped empty cell

    this.#activePointerId = e.pointerId;
    this.#dragOrigin = { x: e.clientX, y: e.clientY };
    this.#draggedPosition = position;
    this.#slideState = null;

    try { this.#gridEl.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }

  #handlePointerMove(e) {
    if (e.pointerId !== this.#activePointerId) return;
    e.preventDefault();

    const dx = e.clientX - this.#dragOrigin.x;
    const dy = e.clientY - this.#dragOrigin.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Require minimum drag of 8px before committing to a direction
    if (this.#slideState === null) {
      if (absDx < 8 && absDy < 8) return;

      const dragIsHorizontal = absDx >= absDy;
      const state = this.#computeSlideState(this.#draggedPosition, dragIsHorizontal);
      if (!state) return;

      // Verify drag direction matches legal slide direction
      const rawComponent = dragIsHorizontal ? dx : dy;
      const dragSign = rawComponent >= 0 ? 1 : -1;
      if (dragSign !== state.direction) return;

      state.liveOffset = Math.abs(rawComponent);
      this.#slideState = state;
    } else {
      const raw = this.#slideState.isHorizontal ? dx : dy;
      this.#slideState.liveOffset = Math.min(
        Math.max(Math.abs(raw), 0),
        this.#slideState.maxTravel
      );
    }

    // Clamp offset and apply to renderer
    const clamped = Math.min(this.#slideState.liveOffset, this.#slideState.maxTravel);
    this.#renderer.applySlideOffset(
      this.#slideState.positions,
      clamped,
      this.#slideState.isHorizontal,
      this.#slideState.direction
    );
  }

  #handlePointerUp(e) {
    if (e.pointerId !== this.#activePointerId) return;
    e.preventDefault();

    if (!this.#slideState) {
      this.#clearDrag();
      return;
    }

    const state = this.#slideState;
    const clamped = Math.min(state.liveOffset, state.maxTravel);
    const committed = clamped / state.maxTravel > 0.3;

    this.#clearDrag();

    if (committed) {
      // Positions are drag-source first (near empty last) — reverse for moveGroup
      const reversed = [...state.positions].reverse();
      this.#renderer.clearSlideOffset(state.positions);
      this.#game.moveGroup(reversed);
      this.#sound.playTileMove();
      this.#renderer.update(this.#game);
      this.#onMoveCommitted();
    } else {
      this.#renderer.snapBackTiles(state.positions, state.isHorizontal);
    }
  }

  #handlePointerCancel(e) {
    if (e.pointerId !== this.#activePointerId) return;
    if (this.#slideState) {
      this.#renderer.snapBackTiles(this.#slideState.positions, this.#slideState.isHorizontal);
    }
    this.#clearDrag();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  #clearDrag() {
    this.#activePointerId = null;
    this.#dragOrigin = null;
    this.#draggedPosition = null;
    this.#slideState = null;
  }

  // Hit-test: which grid position does this client point correspond to?
  #positionFromPoint(clientX, clientY) {
    const rect = this.#gridEl.getBoundingClientRect();
    const x = clientX - rect.left - this.#padding;
    const y = clientY - rect.top - this.#padding;
    const col = Math.floor(x / (this.#tileSize + this.#gap));
    const row = Math.floor(y / (this.#tileSize + this.#gap));
    const g = this.#game.gridSize;
    if (col < 0 || col >= g || row < 0 || row >= g) return -1;
    return row * g + col;
  }

  // Port of computeSlideState from ContentView.swift
  // Computes which tiles will slide and in which direction.
  #computeSlideState(draggedPosition, dragIsHorizontal) {
    const g = this.#game.gridSize;
    const ep = this.#game.emptyPosition;
    const dragRow = Math.floor(draggedPosition / g);
    const dragCol = draggedPosition % g;
    const emptyRow = Math.floor(ep / g);
    const emptyCol = ep % g;

    if (draggedPosition === ep) return null;

    const isHorizontal = dragRow === emptyRow && dragCol !== emptyCol;
    const isVertical = dragCol === emptyCol && dragRow !== emptyRow;

    if (!isHorizontal && !isVertical) return null;
    if (isHorizontal !== dragIsHorizontal) return null;

    const stepSize = this.#tileSize + this.#gap;
    const positions = [];
    let current = draggedPosition;

    if (isHorizontal) {
      const direction = emptyCol > dragCol ? 1 : -1;
      while (current !== ep) {
        positions.push(current);
        current += direction;
      }
      return {
        positions,
        isHorizontal: true,
        direction,
        stepSize,
        liveOffset: 0,
        maxTravel: stepSize * positions.length,
      };
    } else {
      const direction = emptyRow > dragRow ? 1 : -1;
      while (current !== ep) {
        positions.push(current);
        current += direction * g;
      }
      return {
        positions,
        isHorizontal: false,
        direction,
        stepSize,
        liveOffset: 0,
        maxTravel: stepSize * positions.length,
      };
    }
  }
}
