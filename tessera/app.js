// app.js — App coordinator (port of ContentView.swift)
// Wires all modules together and handles UI events.

import { PuzzleGame } from './puzzle-game.js';
import { TileCache }   from './tile-cache.js';
import { SoundManager } from './sound-manager.js';
import { GestureHandler } from './gesture-handler.js';
import { Renderer, GAP, PADDING } from './renderer.js';

class App {
  #game    = new PuzzleGame();
  #cache   = new TileCache();
  #sound   = new SoundManager();
  #renderer;
  #gesture;
  #solver;           // Web Worker
  #solverCb = null;  // pending callback waiting for worker result
  #cachedSolution = null; // mirrors Swift's @State cachedSolution

  // Tracks the currently selected file for layout refreshes
  #imageFile = null;
  #showNumbers = true;

  // Auto-solve timer
  #autoSolveTimer = null;
  #autoSolveMoves = null;
  #autoSolveIndex = 0;
  #isSolverLoading = false;

  // ─── Init ────────────────────────────────────────────────────────────────

  init() {
    this.#renderer = new Renderer(
      document.getElementById('puzzle-grid'),
      this.#cache
    );
    this.#renderer.buildGrid(this.#game);

    this.#gesture = new GestureHandler(
      document.getElementById('puzzle-grid'),
      this.#game,
      this.#renderer,
      this.#sound,
      () => this.#onMoveCommitted()
    );
    this.#gesture.updateLayout(
      this.#renderer.getTileSize(), GAP, PADDING
    );
    this.#gesture.enable();

    this.#solver = new Worker('./solver.worker.js');
    this.#solver.onmessage = (e) => this.#onSolverMessage(e);

    this.#wireUI();
    this.#setupShake();
    this.#setupResize();
    this.#updateUI();
  }

  #wireUI() {
    // Colors button — revert to rainbow gradient board
    document.getElementById('btn-colors').addEventListener('click', () => {
      this.#onColorsSelected();
    });

    // Photo picker
    document.getElementById('btn-photo').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', (e) => {
      if (e.target.files[0]) this.#onPhotoSelected(e.target.files[0]);
      e.target.value = ''; // allow re-selecting same file
    });

    // Footer action buttons
    document.getElementById('btn-start').addEventListener('click', () => this.#onStart());
    document.getElementById('btn-new-game').addEventListener('click', () => this.#onNewGame());
    document.getElementById('btn-hint').addEventListener('click', () => this.#onHint());
    document.getElementById('btn-solve').addEventListener('click', () => this.#onSolve());
    document.getElementById('btn-stop').addEventListener('click', () => this.#onStop());

    // Icon toggles — also init sound on first tap
    document.getElementById('btn-sound').addEventListener('click', () => {
      this.#sound.init();
      this.#sound.toggle();
      this.#updateUI();
    });
    document.getElementById('btn-numbers').addEventListener('click', () => {
      this.#showNumbers = !this.#showNumbers;
      this.#renderer.setShowNumbers(this.#showNumbers);
      this.#updateUI();
    });

    // Grid size picker
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = parseInt(btn.dataset.size, 10);
        this.#game.changeGridSize(size);
        this.#cachedSolution = null;
        document.querySelectorAll('.size-btn').forEach(b =>
          b.classList.toggle('active', b === btn)
        );
        this.#renderer.buildGrid(this.#game);
        this.#renderer.refreshLayout(this.#game);
        this.#gesture.updateLayout(this.#renderer.getTileSize(), GAP, PADDING);
        if (this.#imageFile) {
          this.#cache.setImage(this.#imageFile, this.#renderer.getTileSize(), size);
        }
        this.#updateUI();
      });
    });

    // Init sound on any first interaction
    document.addEventListener('pointerdown', () => this.#sound.init(), { once: true });
  }

  // ─── Photo ───────────────────────────────────────────────────────────────

  #onPhotoSelected(file) {
    this.#imageFile = file;
    this.#cache.setImage(file, this.#renderer.getTileSize(), this.#game.gridSize);
    this.#game.hasImage = true;

    if (this.#game.isStarted) {
      this.#stopAutoSolve();
      this.#game.reset();
    }

    // Give the image a moment to load then rebuild grid with image tiles
    setTimeout(() => {
      this.#renderer.buildGrid(this.#game);
      this.#updateUI();
    }, 100);
  }

  #onColorsSelected() {
    this.#imageFile = null;
    this.#cache.clear();
    this.#game.hasImage = false;

    if (this.#game.isStarted) {
      this.#stopAutoSolve();
      this.#game.reset();
    }

    this.#renderer.buildGrid(this.#game);
    this.#updateUI();
  }

  // ─── Game actions ─────────────────────────────────────────────────────────

  #onStart() {
    this.#sound.init();
    this.#game.startGame();
    this.#cachedSolution = null;
    this.#renderer.buildGrid(this.#game);
    this.#gesture.updateLayout(this.#renderer.getTileSize(), GAP, PADDING);
    this.#gesture.enable();
    this.#updateUI();
  }

  #onNewGame() {
    this.#stopAutoSolve();
    this.#cachedSolution = null;
    this.#game.reset();
    this.#renderer.buildGrid(this.#game);
    this.#updateUI();
  }

  #onMoveCommitted() {
    if (!this.#game.isSolving) {
      this.#cachedSolution = null;
    }
    if (this.#game.isWon) this.#onWin();
    this.#updateUI();
  }

  #onWin() {
    if (!this.#game.isAutoSolving) {
      this.#sound.playSolvedChime();
    }
    this.#renderer.triggerWinAnimation();
    // Rebuild to show complete puzzle (filled-in tile)
    setTimeout(() => {
      this.#renderer.buildGrid(this.#game);
      this.#updateUI();
    }, 350);
  }

  // ─── Hint ────────────────────────────────────────────────────────────────

  #onHint() {
    if (!this.#game.isStarted || this.#game.isWon || this.#game.isSolving) return;
    this.#game.isSolving = true;
    this.#isSolverLoading = true;
    this.#updateUI();

    this.#requestSolution(async (moves) => {
      this.#isSolverLoading = false;
      if (!moves || moves.length === 0) {
        this.#game.isSolving = false;
        this.#updateUI();
        return;
      }

      const position = moves[0];
      await this.#renderer.animateMove(position, this.#game);
      this.#game.move(position);
      this.#cachedSolution = moves.slice(1);
      this.#game.hintsUsed++;
      this.#game.isSolving = false;
      this.#renderer.update(this.#game);
      if (this.#game.isWon) this.#onWin();
      this.#updateUI();
    });
  }

  // ─── Solve ───────────────────────────────────────────────────────────────

  #onSolve() {
    if (!this.#game.isStarted || this.#game.isWon || this.#game.isAutoSolving) return;
    this.#game.isSolving = true;
    this.#game.isAutoSolving = true;
    this.#isSolverLoading = true;
    this.#gesture.disable();
    this.#updateUI();

    this.#requestSolution((moves) => {
      this.#isSolverLoading = false;
      this.#cachedSolution = null;
      if (!moves || moves.length === 0) {
        this.#game.isSolving = false;
        this.#game.isAutoSolving = false;
        this.#gesture.enable();
        this.#updateUI();
        return;
      }
      this.#autoSolveMoves = moves;
      this.#autoSolveIndex = 0;
      this.#updateUI();
      this.#playNextSolveMove();
    });
  }

  async #playNextSolveMove() {
    if (!this.#game.isAutoSolving) return;
    if (this.#autoSolveIndex >= this.#autoSolveMoves.length) {
      this.#game.isSolving = false;
      setTimeout(() => {
        this.#game.isAutoSolving = false;
        this.#gesture.enable();
        this.#updateUI();
      }, 50);
      return;
    }

    const position = this.#autoSolveMoves[this.#autoSolveIndex];
    await this.#renderer.animateMove(position, this.#game);
    if (!this.#game.isAutoSolving) return; // cancelled during animation

    this.#game.move(position);
    this.#renderer.update(this.#game);

    if (this.#game.isWon) {
      this.#game.isSolving = false;
      this.#game.isAutoSolving = false;
      this.#gesture.enable();
      this.#onWin();
      this.#updateUI();
      return;
    }

    this.#autoSolveIndex++;
    this.#autoSolveTimer = setTimeout(() => this.#playNextSolveMove(), 60);
  }

  #onStop() {
    this.#stopAutoSolve();
    this.#updateUI();
  }

  #stopAutoSolve() {
    if (this.#autoSolveTimer) {
      clearTimeout(this.#autoSolveTimer);
      this.#autoSolveTimer = null;
    }
    this.#solver.postMessage({ type: 'CANCEL' });
    this.#solverCb = null;
    this.#game.isSolving = false;
    this.#game.isAutoSolving = false;
    this.#isSolverLoading = false;
    this.#gesture.enable();
  }

  // ─── Solver worker ───────────────────────────────────────────────────────

  #requestSolution(callback) {
    if (this.#cachedSolution && this.#cachedSolution.length > 0) {
      callback(this.#cachedSolution);
      return;
    }
    this.#solverCb = callback;
    this.#solver.postMessage({
      type: 'SOLVE',
      tiles: this.#game.tiles,
      emptyPosition: this.#game.emptyPosition,
      gridSize: this.#game.gridSize,
    });
  }

  #onSolverMessage(e) {
    const cb = this.#solverCb;
    this.#solverCb = null;
    if (!cb) return;

    if (e.data.type === 'SOLUTION') {
      cb(e.data.moves);
    } else {
      cb(null);
    }
  }

  // ─── Shake detection ─────────────────────────────────────────────────────

  #setupShake() {
    // iOS 13+ requires permission for DeviceMotionEvent
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      // Will be requested on first user interaction
      document.addEventListener('pointerdown', async () => {
        try {
          const perm = await DeviceMotionEvent.requestPermission();
          if (perm === 'granted') this.#listenForShake();
        } catch (_) {}
      }, { once: true });
    } else {
      this.#listenForShake();
    }
  }

  #listenForShake() {
    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
      if (mag > 25 && !this.#game.isStarted) {
        this.#onStart();
      }
    });
  }

  // ─── Resize ──────────────────────────────────────────────────────────────

  #setupResize() {
    let resizeTimer;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.#renderer.refreshLayout(this.#game);
        this.#renderer.buildGrid(this.#game);
        const ts = this.#renderer.getTileSize();
        this.#gesture.updateLayout(ts, GAP, PADDING);
        if (this.#imageFile) {
          this.#cache.setImage(this.#imageFile, ts, this.#game.gridSize);
          setTimeout(() => {
            this.#renderer.buildGrid(this.#game);
          }, 150);
        }
      }, 100);
    });
    ro.observe(document.getElementById('puzzle-board'));
  }

  // ─── UI state sync ───────────────────────────────────────────────────────

  #updateUI() {
    const g = this.#game;

    // Header
    const moveCounter = document.getElementById('move-counter');
    const statusText = document.getElementById('status-text');
    if (g.isStarted) {
      moveCounter.textContent = `↔ ${g.moveCount}`;
      moveCounter.hidden = false;
      statusText.hidden = true;
    } else {
      moveCounter.hidden = true;
      statusText.textContent = g.hasImage ? 'Shake or tap Start' : 'Pick a photo to play';
      statusText.hidden = false;
    }

    // Solved flash
    const solvedLabel = document.getElementById('solved-label');
    if (g.isWon) {
      solvedLabel.hidden = false;
      solvedLabel.classList.add('flash');
      setTimeout(() => solvedLabel.classList.remove('flash'), 2000);
    } else {
      solvedLabel.hidden = true;
      solvedLabel.classList.remove('flash');
    }

    // Sound toggle
    const btnSound = document.getElementById('btn-sound');
    btnSound.textContent = this.#sound.isEnabled ? '🔊' : '🔇';
    btnSound.classList.toggle('active-blue', this.#sound.isEnabled);

    // Numbers toggle
    const btnNum = document.getElementById('btn-numbers');
    btnNum.classList.toggle('active-green', this.#showNumbers);
    btnNum.textContent = '#';

    // Grid size picker (only when not started)
    document.getElementById('grid-picker').hidden = g.isStarted;

    // Action buttons
    const btnStart   = document.getElementById('btn-start');
    const btnNewGame = document.getElementById('btn-new-game');
    const btnHint    = document.getElementById('btn-hint');
    const btnSolve   = document.getElementById('btn-solve');
    const btnStop    = document.getElementById('btn-stop');

    // Hide all first
    [btnStart, btnNewGame, btnHint, btnSolve, btnStop].forEach(b => b.hidden = true);

    if (!g.isStarted) {
      btnStart.hidden = false;
    } else if (g.isWon) {
      btnNewGame.hidden = false;
    } else if (g.isAutoSolving) {
      btnNewGame.hidden = false;
      btnStop.hidden = false;
      btnStop.textContent = this.#isSolverLoading ? '⏳ Stop' : 'Stop';
    } else {
      btnNewGame.hidden = false;
      if (!g.isSolving) {
        btnHint.hidden = false;
        const threshold = g.gridSize === 3 ? 3 : 5;
        if (g.hintsUsed >= threshold) {
          btnSolve.hidden = false;
        }
      }
    }
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
