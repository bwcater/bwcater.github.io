// puzzle-game.js — PuzzleGame state (direct port of Item.swift)
// Pure data, zero DOM dependencies.

export class PuzzleGame {
  gridSize = 3;
  tiles = [];        // tiles[position] = correctIndex (number) | null
  emptyPosition = 0;
  moveCount = 0;
  isWon = false;
  isStarted = false;
  isSolving = false;
  isAutoSolving = false;
  hintsUsed = 0;
  hasImage = false;

  get tileCount() { return this.gridSize * this.gridSize; }
  get tileCountMinusOne() { return this.tileCount - 1; }

  constructor() {
    this.#solvedState();
  }

  #solvedState() {
    this.tiles = [];
    for (let i = 0; i < this.tileCountMinusOne; i++) this.tiles.push(i);
    this.tiles.push(null);
    this.emptyPosition = this.tileCountMinusOne;
    this.moveCount = 0;
    this.isWon = false;
    this.isStarted = false;
    this.hintsUsed = 0;
  }

  changeGridSize(size) {
    this.gridSize = size;
    this.#solvedState();
  }

  startGame() {
    // Reset to solved then make 500 random legal moves — always solvable
    this.tiles = [];
    for (let i = 0; i < this.tileCountMinusOne; i++) this.tiles.push(i);
    this.tiles.push(null);
    this.emptyPosition = this.tileCountMinusOne;
    this.moveCount = 0;
    this.isWon = false;
    this.hintsUsed = 0;

    let lastEmpty = -1;
    for (let i = 0; i < 500; i++) {
      const candidates = this.validNeighbors(this.emptyPosition).filter(p => p !== lastEmpty);
      if (candidates.length === 0) continue;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      lastEmpty = this.emptyPosition;
      this.tiles[this.emptyPosition] = this.tiles[pick];
      this.tiles[pick] = null;
      this.emptyPosition = pick;
    }

    this.isStarted = true;
  }

  reset() {
    this.isSolving = false;
    this.isAutoSolving = false;
    this.#solvedState();
  }

  validNeighbors(position) {
    const g = this.gridSize;
    const row = Math.floor(position / g);
    const col = position % g;
    const neighbors = [];
    if (row > 0)     neighbors.push(position - g);
    if (row < g - 1) neighbors.push(position + g);
    if (col > 0)     neighbors.push(position - 1);
    if (col < g - 1) neighbors.push(position + 1);
    return neighbors;
  }

  canMove(position) {
    if (!this.isStarted || this.tiles[position] == null) return false;
    return this.validNeighbors(this.emptyPosition).includes(position);
  }

  // Returns true if position is in the same row or column as the empty space
  // (i.e. it can be part of a chain drag)
  canSlide(position) {
    if (!this.isStarted) return false;
    const g = this.gridSize;
    const ep = this.emptyPosition;
    return Math.floor(position / g) === Math.floor(ep / g) ||
           position % g === ep % g;
  }

  move(position) {
    if (!this.canMove(position)) return;
    this.tiles[this.emptyPosition] = this.tiles[position];
    this.tiles[position] = null;
    this.emptyPosition = position;
    this.moveCount++;
    this.#checkWin();
  }

  // positions: array from farthest tile to nearest (toward empty)
  // mirrors Swift's game.moveGroup(positions: positions.reversed())
  moveGroup(positions) {
    for (const pos of positions) {
      if (this.tiles[pos] == null) return;
      if (!this.validNeighbors(this.emptyPosition).includes(pos)) return;
      this.tiles[this.emptyPosition] = this.tiles[pos];
      this.tiles[pos] = null;
      this.emptyPosition = pos;
    }
    this.moveCount++;
    this.#checkWin();
  }

  #checkWin() {
    for (let i = 0; i < this.tileCountMinusOne; i++) {
      if (this.tiles[i] !== i) return;
    }
    this.isWon = true;
  }
}
