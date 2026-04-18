// solver.worker.js 
// Runs in a Web Worker so the main thread is never blocked.
// Tiles use -1 for empty (avoids object allocation in tight recursion).

let cancelled = false;

self.onmessage = (e) => {
  if (e.data.type === 'CANCEL') {
    cancelled = true;
    return;
  }
  if (e.data.type === 'SOLVE') {
    cancelled = false;
    const { tiles, emptyPosition, gridSize } = e.data;
    // Convert null → -1 for the solver
    const t = tiles.map(v => v == null ? -1 : v);
    try {
      const moves = solvePuzzle(t, emptyPosition, gridSize);
      self.postMessage({ type: 'SOLUTION', moves });
    } catch (err) {
      if (!cancelled) {
        self.postMessage({ type: 'UNSOLVABLE' });
      }
    }
  }
};

// ─── Public entry ──────────────────────────────────────────────────────────

function solvePuzzle(tiles, emptyPosition, gridSize) {
  const weight = gridSize >= 4 ? 3 : 1;
  let bound = weight * heuristic(tiles, gridSize);
  const path = [];

  while (true) {
    if (cancelled) throw new Error('cancelled');
    const t = idaSearch(tiles, emptyPosition, path, 0, bound, -1, weight, gridSize);
    if (t === -1) return path;
    if (t === Infinity) throw new Error('unsolvable');
    bound = t;
  }
}

// ─── IDA* core ─────────────────────────────────────────────────────────────

function idaSearch(tiles, emptyPos, path, g, bound, prevEmpty, weight, gridSize) {
  if (cancelled) throw new Error('cancelled');

  const h = weight * heuristic(tiles, gridSize);
  const f = g + h;
  if (f > bound) return f;
  if (h === 0) return -1;

  let minimum = Infinity;

  for (const neighbor of validNeighbors(emptyPos, gridSize)) {
    if (neighbor === prevEmpty) continue;

    // Apply move
    const prevVal = tiles[neighbor];
    tiles[emptyPos] = prevVal;
    tiles[neighbor] = -1;

    path.push(neighbor);
    const t = idaSearch(tiles, neighbor, path, g + 1, bound, emptyPos, weight, gridSize);

    // Undo move
    tiles[neighbor] = prevVal;
    tiles[emptyPos] = -1;

    if (t === -1) return -1;
    if (t < minimum) minimum = t;
    path.pop();
  }

  return minimum;
}

// ─── Heuristic ─────────────────────────────────────────────────────────────

function heuristic(tiles, gridSize) {
  return manhattanDistance(tiles, gridSize) + linearConflict(tiles, gridSize);
}

function manhattanDistance(tiles, gridSize) {
  const g = gridSize;
  let h = 0;
  for (let p = 0; p < tiles.length; p++) {
    const v = tiles[p];
    if (v === -1) continue;
    h += Math.abs(Math.floor(p / g) - Math.floor(v / g)) +
         Math.abs(p % g - v % g);
  }
  return h;
}

// Adds 2 for each tile that must leave its row/col to let another pass.
// Uses minimum-removals = total − LIS length (provably admissible).
function linearConflict(tiles, gridSize) {
  const g = gridSize;
  let lc = 0;

  // Row conflicts
  for (let row = 0; row < g; row++) {
    const targets = [];
    for (let col = 0; col < g; col++) {
      const v = tiles[row * g + col];
      if (v === -1) continue;
      if (Math.floor(v / g) === row) targets.push(v % g);
    }
    lc += targets.length - lisLength(targets);
  }

  // Column conflicts
  for (let col = 0; col < g; col++) {
    const targets = [];
    for (let row = 0; row < g; row++) {
      const v = tiles[row * g + col];
      if (v === -1) continue;
      if (v % g === col) targets.push(Math.floor(v / g));
    }
    lc += targets.length - lisLength(targets);
  }

  return lc * 2;
}

// Longest increasing subsequence via patience sorting — O(n log n)
function lisLength(seq) {
  if (seq.length === 0) return 0;
  const tails = [];
  for (const x of seq) {
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
}

// ─── Neighbors ─────────────────────────────────────────────────────────────

function validNeighbors(position, g) {
  const row = Math.floor(position / g);
  const col = position % g;
  const neighbors = [];
  if (row > 0)     neighbors.push(position - g);
  if (row < g - 1) neighbors.push(position + g);
  if (col > 0)     neighbors.push(position - 1);
  if (col < g - 1) neighbors.push(position + 1);
  return neighbors;
}
