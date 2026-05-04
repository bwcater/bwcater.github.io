'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
const SUITS   = ['♠','♥','♦','♣'];
const RANKS   = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED     = new Set(['♥','♦']);
const DRAG_PX = 6;
const UNDO_MAX = 50;

// ── Theme palettes ────────────────────────────────────────────────────────────
const BACK_COLORS = [
  { name:'Navy',    value:'#1c3b6e' },
  { name:'Forest',  value:'#1b4332' },
  { name:'Crimson', value:'#6b0f0f' },
  { name:'Slate',   value:'#2c313c' },
  { name:'Purple',  value:'#3d1a5e' },
  { name:'Teal',    value:'#0f4c4c' },
];
const FELT_COLORS = [
  { name:'Forest',  value:'#2d6a4f' },
  { name:'Navy',    value:'#1a3a5c' },
  { name:'Crimson', value:'#7b1a1a' },
  { name:'Slate',   value:'#3a3f4b' },
  { name:'Teal',    value:'#1a5c56' },
  { name:'Purple',  value:'#4a2d6a' },
];

// ── Preferences ───────────────────────────────────────────────────────────────
const DEFAULT_PREFS = {
  drawMode:      1,
  gameMode:      'standard',
  timedDuration: 300, // default: 5 minutes (options: 300, 600, 900)
  backColor:     '#1c3b6e',
  backLetters:   'CC',
  feltColor:     '#2d6a4f',
  autoComplete:  true,
};

let prefs = (() => {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('sol_prefs') || '{}') }; }
  catch { return { ...DEFAULT_PREFS }; }
})();

function savePrefs() { localStorage.setItem('sol_prefs', JSON.stringify(prefs)); }

function applyPrefs() {
  document.documentElement.style.setProperty('--green', prefs.feltColor);
  document.documentElement.style.setProperty('--navy',  prefs.backColor);
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const DEFAULT_STATS = { played:0, won:0, bestTime:null, bestMoves:null, totalTime:0, totalMoves:0 };

let stats = (() => {
  try { return { ...DEFAULT_STATS, ...JSON.parse(localStorage.getItem('sol_stats') || '{}') }; }
  catch { return { ...DEFAULT_STATS }; }
})();

function saveStats() { localStorage.setItem('sol_stats', JSON.stringify(stats)); }

// ── State ─────────────────────────────────────────────────────────────────────
let state      = {};
let undoStack  = [];
let moveCount  = 0;
let gameActive = false; // true after first move (for standard timer)

// ── Timer ─────────────────────────────────────────────────────────────────────
let timerInterval = null;
let elapsed = 0;

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    elapsed++;
    updateTimerDisplay();
    if (prefs.gameMode === 'timed' && elapsed >= prefs.timedDuration) timesUp();
  }, 1000);
}

function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

function updateTimerDisplay() {
  const t = prefs.gameMode === 'timed' ? Math.max(0, prefs.timedDuration - elapsed) : elapsed;
  const m = Math.floor(t / 60);
  const s = t % 60;
  const el = document.getElementById('timer-display');
  el.textContent = `${m}:${String(s).padStart(2,'0')}`;
  el.classList.toggle('timer-warning', prefs.gameMode === 'timed' && t <= 30);
}

function ensureTimerRunning() {
  if (timerInterval) return;
  gameActive = true;
  startTimer();
}

function timesUp() {
  stopTimer();
  stats.played++;
  saveStats();
  document.getElementById('times-up-screen').classList.remove('hidden');
}

// ── Move counter ──────────────────────────────────────────────────────────────
function incMoves() {
  moveCount++;
  document.getElementById('move-counter').textContent =
    moveCount + (moveCount === 1 ? ' move' : ' moves');
}

// ── Undo ──────────────────────────────────────────────────────────────────────
function pushUndo() {
  undoStack.push(JSON.parse(JSON.stringify(state)));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  document.getElementById('undo-btn').disabled = false;
}

function undo() {
  if (!undoStack.length) return;
  state = undoStack.pop();
  if (moveCount > 0) {
    moveCount--;
    document.getElementById('move-counter').textContent =
      moveCount + (moveCount === 1 ? ' move' : ' moves');
  }
  document.getElementById('undo-btn').disabled = undoStack.length === 0;
  render();
}

// ── Pointer tracking ──────────────────────────────────────────────────────────
let pdown   = null;
let drag    = null;
let dealing = false;

// ── Game init ─────────────────────────────────────────────────────────────────
function initState() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank, rankIdx: RANKS.indexOf(rank), faceUp: false });

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const tableau = Array.from({ length: 7 }, () => []);
  for (let col = 0; col < 7; col++)
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      card.faceUp = (row === col);
      tableau[col].push(card);
    }

  state      = { stock: deck.map(c => ({ ...c, faceUp: false })), waste: [], foundations: [[], [], [], []], tableau };
  undoStack  = [];
  moveCount  = 0;
  elapsed    = 0;
  gameActive = false;
  document.getElementById('undo-btn').disabled = true;
  document.getElementById('move-counter').textContent = '0 moves';
  updateTimerDisplay();
}

function newGame() {
  if (dealing) return;
  dealing = true;
  stopTimer();

  const stockEl = document.getElementById('stock');
  const deckEl  = createShuffleDeck();
  stockEl.appendChild(deckEl);

  setTimeout(() => {
    deckEl.remove();
    initState();
    ['win-screen','times-up-screen'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('auto-complete-btn').classList.add('hidden');
    updateCardSize();
    render();
    requestAnimationFrame(() => requestAnimationFrame(dealCards));
  }, 680);
}

// ── Shuffle deck ──────────────────────────────────────────────────────────────
function createShuffleDeck() {
  const deck = document.createElement('div');
  deck.className = 'shuffle-deck';
  const L0 = (prefs.backLetters[0] || 'C');
  const L1 = (prefs.backLetters[1] || 'R');
  for (let i = 0; i < 3; i++) {
    const card = document.createElement('div');
    card.className = 's-card';
    card.innerHTML = `<span class="back-c">${L0}</span><span class="back-r">${L1}</span>`;
    deck.appendChild(card);
  }
  return deck;
}

// ── Deal animation ────────────────────────────────────────────────────────────
const DEAL_STEP     = 55;
const DEAL_DURATION = 260;

function nthCard(col, idx) {
  return document.getElementById('col' + col).querySelectorAll('.card')[idx] || null;
}

function dealCards() {
  const sr = document.getElementById('stock').getBoundingClientRect();
  const seq = [];
  for (let row = 0; row < 7; row++)
    for (let col = row; col < 7; col++)
      seq.push({ col, cardIdx: row });

  seq.forEach(({ col, cardIdx }) => {
    const el = nthCard(col, cardIdx);
    if (!el) return;
    const r  = el.getBoundingClientRect();
    const dx = sr.left + sr.width  / 2 - r.left - r.width  / 2;
    const dy = sr.top  + sr.height / 2 - r.top  - r.height / 2;
    el.style.transition = 'none';
    el.style.transform  = `translate(${dx}px,${dy}px)`;
    el.style.opacity    = '0';
  });

  seq.forEach(({ col, cardIdx }, i) => {
    setTimeout(() => {
      const el = nthCard(col, cardIdx);
      if (!el) return;
      el.style.transition = `transform ${DEAL_DURATION}ms cubic-bezier(0.25,0,0.35,1), opacity 120ms`;
      el.style.transform  = 'translate(0,0)';
      el.style.opacity    = '1';
      if (i === seq.length - 1) {
        setTimeout(() => {
          seq.forEach(({ col, cardIdx }) => {
            const el = nthCard(col, cardIdx);
            if (el) { el.style.transition = el.style.transform = el.style.opacity = ''; }
          });
          dealing = false;
          // Timed mode: start timer immediately. Standard: waits for first move.
          if (prefs.gameMode === 'timed') startTimer();
        }, DEAL_DURATION + 50);
      }
    }, i * DEAL_STEP);
  });
}

// ── Rules ─────────────────────────────────────────────────────────────────────
function canTableau(card, col) {
  if (!col.length) return card.rankIdx === 12;
  const top = col[col.length - 1];
  return top.faceUp && RED.has(card.suit) !== RED.has(top.suit) && card.rankIdx === top.rankIdx - 1;
}

function canFoundation(card, pile) {
  if (!pile.length) return card.rankIdx === 0;
  const top = pile[pile.length - 1];
  return top.suit === card.suit && card.rankIdx === top.rankIdx + 1;
}

function isWon() { return state.foundations.every(f => f.length === 13); }

// ── Auto-complete ─────────────────────────────────────────────────────────────
function checkAutoComplete() {
  const canAC = prefs.autoComplete
    && state.stock.length === 0
    && state.waste.length === 0
    && state.tableau.every(col => col.every(c => c.faceUp));
  document.getElementById('auto-complete-btn').classList.toggle('hidden', !canAC);
}

function runAutoComplete() {
  document.getElementById('auto-complete-btn').classList.add('hidden');
  function step() {
    let moved = false;
    outer: for (const src of [
      state.waste.length ? [state.waste[state.waste.length-1], { type:'waste' }] : null,
      ...state.tableau.map((col,c) => col.length ? [col[col.length-1], { type:'tableau', col:c, cardIdx:col.length-1 }] : null)
    ]) {
      if (!src) continue;
      const [card, loc] = src;
      if (toFoundation([card], loc)) { moved = true; break outer; }
    }
    if (moved) { render(); if (!isWon()) setTimeout(step, 80); }
  }
  step();
}

// ── Location helpers ──────────────────────────────────────────────────────────
function pickCards(loc) {
  if (loc.type === 'waste')      { const t = state.waste[state.waste.length-1]; return t ? [t] : []; }
  if (loc.type === 'foundation') { const t = state.foundations[loc.idx]; return t.length ? [t[t.length-1]] : []; }
  if (loc.type === 'tableau')    return state.tableau[loc.col].slice(loc.cardIdx);
  return [];
}

function removeCards(loc, count) {
  if (loc.type === 'waste')           state.waste.pop();
  else if (loc.type === 'foundation') state.foundations[loc.idx].pop();
  else if (loc.type === 'tableau')    state.tableau[loc.col].splice(-count);
}

function flipTop(col) {
  const cards = state.tableau[col];
  if (cards.length && !cards[cards.length-1].faceUp) {
    cards[cards.length-1].faceUp = true;
    cards[cards.length-1].justFlipped = true;
  }
}

// ── Moves ─────────────────────────────────────────────────────────────────────
function toFoundation(cards, loc) {
  if (cards.length !== 1) return false;
  for (let i = 0; i < 4; i++) {
    if (canFoundation(cards[0], state.foundations[i])) {
      removeCards(loc, 1);
      state.foundations[i].push(cards[0]);
      if (loc.type === 'tableau') flipTop(loc.col);
      return true;
    }
  }
  return false;
}

function toTableau(cards, loc, targetCol) {
  if (loc.type === 'tableau' && loc.col === targetCol) return false;
  if (!canTableau(cards[0], state.tableau[targetCol])) return false;
  removeCards(loc, cards.length);
  state.tableau[targetCol].push(...cards);
  if (loc.type === 'tableau') flipTop(loc.col);
  return true;
}

// ── Card element factory ──────────────────────────────────────────────────────
function makeCardEl(card, loc) {
  const el = document.createElement('div');
  el.className = 'card ' + (card.faceUp ? 'face-up' : 'face-down');
  if (RED.has(card.suit)) el.classList.add('red');
  if (card.justFlipped)   { el.classList.add('just-flipped'); delete card.justFlipped; }
  el._card = card;
  el._loc  = loc;

  const front = document.createElement('div');
  front.className = 'card-face card-front';
  front.innerHTML =
    `<div class="corner tl"><div class="rank">${card.rank}</div><div class="csuit">${card.suit}</div></div>` +
    `<div class="suit-center">${card.suit}</div>` +
    `<div class="corner br"><div class="rank">${card.rank}</div><div class="csuit">${card.suit}</div></div>`;

  const back = document.createElement('div');
  back.className = 'card-face card-back';
  const L0 = prefs.backLetters[0] || 'C';
  const L1 = prefs.backLetters[1] || 'R';
  back.innerHTML = `<span class="back-c">${L0}</span><span class="back-r">${L1}</span>`;

  el.appendChild(front);
  el.appendChild(back);
  return el;
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  // Stock
  const stockEl = document.getElementById('stock');
  stockEl.innerHTML = '';
  stockEl.classList.toggle('empty', !state.stock.length);
  if (state.stock.length)
    stockEl.appendChild(makeCardEl(state.stock[state.stock.length-1], { type:'stock' }));

  // Waste
  const wasteEl = document.getElementById('waste');
  wasteEl.innerHTML = '';
  if (state.waste.length) {
    if (prefs.drawMode === 3) {
      const visible = state.waste.slice(Math.max(0, state.waste.length - 3));
      const OFF = 18;
      visible.forEach((card, i) => {
        const isTop = i === visible.length - 1;
        const el = makeCardEl(card, isTop ? { type:'waste' } : { type:'waste-bg' });
        el.style.cssText = `position:absolute;left:${i*OFF}px;top:0;z-index:${i+1};`;
        if (!isTop) el.style.pointerEvents = 'none';
        wasteEl.appendChild(el);
      });
      wasteEl.style.overflow = 'visible';
    } else {
      wasteEl.appendChild(makeCardEl(state.waste[state.waste.length-1], { type:'waste' }));
    }
  }

  // Foundations
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('f' + i);
    el.innerHTML = '';
    const pile = state.foundations[i];
    if (pile.length) {
      el.appendChild(makeCardEl(pile[pile.length-1], { type:'foundation', idx:i }));
    } else {
      const h = document.createElement('div');
      h.className = 'pile-hint';
      h.textContent = SUITS[i];
      el.appendChild(h);
    }
  }

  // Tableau
  for (let col = 0; col < 7; col++) {
    const colEl = document.getElementById('col' + col);
    colEl.innerHTML = '';
    if (!state.tableau[col].length) {
      const h = document.createElement('div');
      h.className = 'col-hint';
      h.textContent = 'K';
      colEl.appendChild(h);
    }
    state.tableau[col].forEach((card, cardIdx) => {
      const el = makeCardEl(card, { type:'tableau', col, cardIdx });
      el.style.zIndex = cardIdx + 1;
      colEl.appendChild(el);
    });
  }

  checkAutoComplete();
  if (isWon()) handleWin();
}

// ── Card sizing ───────────────────────────────────────────────────────────────
function updateCardSize() {
  const col = document.querySelector('.column');
  if (!col) return;
  const w = col.getBoundingClientRect().width;
  document.documentElement.style.setProperty('--card-h', Math.round(w * 7 / 5) + 'px');
}

// ── Win ───────────────────────────────────────────────────────────────────────
function handleWin() {
  stopTimer();
  stats.played++;
  stats.won++;
  stats.totalTime  += elapsed;
  stats.totalMoves += moveCount;
  if (stats.bestTime  === null || elapsed    < stats.bestTime)  stats.bestTime  = elapsed;
  if (stats.bestMoves === null || moveCount  < stats.bestMoves) stats.bestMoves = moveCount;
  saveStats();

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  document.getElementById('win-stats').innerHTML =
    `Time: <strong>${fmt(elapsed)}</strong> &nbsp;·&nbsp; Moves: <strong>${moveCount}</strong>`;

  playWinAnimation(() => document.getElementById('win-screen').classList.remove('hidden'));
}

function playWinAnimation(onComplete) {
  const fEls = [0,1,2,3].map(i => document.getElementById('f'+i));
  let launched = 0;
  const total  = 12;
  fEls.forEach((fEl, fi) => {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        launchWinCard(fEl.getBoundingClientRect());
        if (++launched >= total) setTimeout(onComplete, 700);
      }, fi * 80 + i * 160);
    }
  });
}

function launchWinCard(r) {
  const L0 = prefs.backLetters[0] || 'C';
  const L1 = prefs.backLetters[1] || 'R';
  const el  = document.createElement('div');
  el.className = 'win-card card-back';
  el.innerHTML = `<span class="back-c">${L0}</span><span class="back-r">${L1}</span>`;
  el.style.cssText =
    `position:fixed;width:${r.width}px;height:${r.height}px;left:${r.left}px;top:${r.top}px;` +
    `background:var(--navy);border-radius:var(--radius);z-index:800;overflow:hidden;` +
    `border:1px solid rgba(0,0,0,.15);box-shadow:2px 4px 8px rgba(0,0,0,.3);`;
  document.body.appendChild(el);
  const dx  = (Math.random() - 0.5) * 400;
  const dy  = -(150 + Math.random() * 250);
  const rot = (Math.random() - 0.5) * 720;
  const a   = el.animate(
    [{ transform:'translate(0,0) rotate(0deg)', opacity:1 },
     { transform:`translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity:0 }],
    { duration: 900 + Math.random() * 400, easing:'cubic-bezier(0,0,0.2,1)', fill:'forwards' }
  );
  a.onfinish = () => el.remove();
}

// ── Pointer helpers ───────────────────────────────────────────────────────────
function clientPos(e) {
  if (e.touches && e.touches.length)         return { x:e.touches[0].clientX,        y:e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches.length) return { x:e.changedTouches[0].clientX, y:e.changedTouches[0].clientY };
  return { x:e.clientX, y:e.clientY };
}

// ── Pointer down ──────────────────────────────────────────────────────────────
function onDown(e) {
  if (dealing) return;
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest('#stock')) { handleStockClick(); return; }

  const cardEl = e.target.closest('.card');
  if (!cardEl || !cardEl._card) return;

  if (!cardEl._card.faceUp && cardEl._loc && cardEl._loc.type === 'tableau') {
    const col = state.tableau[cardEl._loc.col];
    if (cardEl._loc.cardIdx === col.length - 1) {
      pushUndo();
      col[col.length-1].faceUp = true;
      col[col.length-1].justFlipped = true;
      ensureTimerRunning();
      render();
    }
    return;
  }
  if (!cardEl._card.faceUp) return;

  const pos = clientPos(e);
  pdown = { cardEl, startX:pos.x, startY:pos.y };
  e.preventDefault();
}

// ── Pointer move ──────────────────────────────────────────────────────────────
function onMove(e) {
  if (!pdown && !drag) return;
  const pos = clientPos(e);

  if (pdown && !drag && Math.hypot(pos.x - pdown.startX, pos.y - pdown.startY) > DRAG_PX) {
    beginDrag(pdown.cardEl, pdown.startX, pdown.startY, pos.x, pos.y);
    pdown = null;
  }
  if (drag) {
    drag.ghost.style.left = (pos.x - drag.ox) + 'px';
    drag.ghost.style.top  = (pos.y - drag.oy) + 'px';
    e.preventDefault();
  }
}

// ── Pointer up ────────────────────────────────────────────────────────────────
function onUp(e) {
  if (pdown) { handleCardClick(pdown.cardEl); pdown = null; return; }
  if (!drag) return;
  const pos = clientPos(e);
  drag.ghost.remove();
  const target = document.elementFromPoint(pos.x, pos.y);
  if (target) tryDrop(drag.cards, drag.loc, target);
  drag = null;
  render();
}

// ── Begin drag ────────────────────────────────────────────────────────────────
function beginDrag(cardEl, startX, startY, curX, curY) {
  const loc   = cardEl._loc;
  const cards = pickCards(loc);
  if (!cards.length) return;

  const rect  = cardEl.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.width = rect.width + 'px';

  cards.forEach((card, i) => {
    const clone = makeCardEl(card, loc);
    clone.style.display = 'block';
    if (i > 0) clone.style.marginTop = 'calc(var(--face-up-reveal) - var(--card-h))';
    ghost.appendChild(clone);
  });

  const ox = startX - rect.left;
  const oy = startY - rect.top;
  ghost.style.left = (curX - ox) + 'px';
  ghost.style.top  = (curY - oy) + 'px';
  document.body.appendChild(ghost);
  drag = { cards, loc, ghost, ox, oy };
}

// ── Drop ──────────────────────────────────────────────────────────────────────
function tryDrop(cards, fromLoc, targetEl) {
  const foundEl = targetEl.closest('.foundation');
  if (foundEl) {
    const idx = parseInt(foundEl.id.replace('f',''), 10);
    if (!isNaN(idx) && cards.length === 1 && canFoundation(cards[0], state.foundations[idx])) {
      pushUndo();
      removeCards(fromLoc, 1);
      state.foundations[idx].push(cards[0]);
      if (fromLoc.type === 'tableau') flipTop(fromLoc.col);
      incMoves(); ensureTimerRunning();
      return true;
    }
    return false;
  }
  const colEl = targetEl.closest('.column');
  if (colEl) {
    const col = parseInt(colEl.id.replace('col',''), 10);
    if (!isNaN(col)) {
      pushUndo();
      if (toTableau(cards, fromLoc, col)) { incMoves(); ensureTimerRunning(); return true; }
      undoStack.pop();
      document.getElementById('undo-btn').disabled = undoStack.length === 0;
    }
  }
  return false;
}

// ── Click handlers ────────────────────────────────────────────────────────────
function handleStockClick() {
  pushUndo();
  if (!state.stock.length) {
    state.stock = [...state.waste].reverse().map(c => ({ ...c, faceUp:false }));
    state.waste = [];
  } else {
    const n = prefs.drawMode === 3 ? Math.min(3, state.stock.length) : 1;
    for (let i = 0; i < n; i++) { const c = state.stock.pop(); c.faceUp = true; state.waste.push(c); }
  }
  incMoves(); ensureTimerRunning(); render();
}

function handleCardClick(cardEl) {
  if (!cardEl._card || !cardEl._card.faceUp) return;
  const cards = pickCards(cardEl._loc);
  if (!cards.length) return;
  pushUndo();
  let moved = toFoundation(cards, cardEl._loc)
    || [0,1,2,3,4,5,6].some(col => toTableau(cards, cardEl._loc, col));
  if (moved) { incMoves(); ensureTimerRunning(); render(); }
  else { undoStack.pop(); document.getElementById('undo-btn').disabled = undoStack.length === 0; }
}

// ── Preferences UI ────────────────────────────────────────────────────────────
function openPrefs() {
  document.getElementById('pref-draw-mode').value    = prefs.drawMode;
  document.getElementById('pref-game-mode').value    = prefs.gameMode;
  document.getElementById('pref-time-limit').value   = prefs.timedDuration;
  document.getElementById('pref-initials').value     = prefs.backLetters;
  document.getElementById('pref-auto-complete').checked = prefs.autoComplete;
  document.getElementById('timed-options').classList.toggle('hidden', prefs.gameMode !== 'timed');
  renderSwatches();
  refreshStats();
  document.getElementById('prefs-screen').classList.remove('hidden');
}

function closePrefs() {
  prefs.drawMode      = parseInt(document.getElementById('pref-draw-mode').value);
  prefs.gameMode      = document.getElementById('pref-game-mode').value;
  prefs.timedDuration = parseInt(document.getElementById('pref-time-limit').value);
  prefs.autoComplete  = document.getElementById('pref-auto-complete').checked;
  const raw = document.getElementById('pref-initials').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  prefs.backLetters = (raw + 'CR').slice(0, 2);
  savePrefs();
  applyPrefs();
  document.getElementById('prefs-screen').classList.add('hidden');
  render(); // refresh card backs with new initials/color
}

function renderSwatches() {
  buildSwatches('back-color-swatches', BACK_COLORS, 'backColor',
    v => { prefs.backColor = v; document.documentElement.style.setProperty('--navy', v); });
  buildSwatches('felt-color-swatches', FELT_COLORS, 'feltColor',
    v => { prefs.feltColor = v; document.documentElement.style.setProperty('--green', v); });
}

function buildSwatches(containerId, palette, prefKey, onPick) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  palette.forEach(({ name, value }) => {
    const sw = document.createElement('button');
    sw.className = 'color-swatch' + (prefs[prefKey] === value ? ' selected' : '');
    sw.style.background = value;
    sw.title = name;
    sw.addEventListener('click', () => {
      onPick(value);
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    container.appendChild(sw);
  });
}

// ── Stats panel ───────────────────────────────────────────────────────────────
function refreshStats() {
  const fmt = s => s === null ? '—' : `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  document.getElementById('stat-played').textContent    = stats.played;
  document.getElementById('stat-won').textContent       = stats.won;
  document.getElementById('stat-winrate').textContent   = stats.played ? Math.round(stats.won / stats.played * 100) + '%' : '—';
  document.getElementById('stat-best-time').textContent  = fmt(stats.bestTime);
  document.getElementById('stat-best-moves').textContent = stats.bestMoves ?? '—';
  const avgT = stats.won ? Math.round(stats.totalTime  / stats.won) : null;
  const avgM = stats.won ? Math.round(stats.totalMoves / stats.won) : null;
  document.getElementById('stat-avg-time').textContent  = fmt(avgT);
  document.getElementById('stat-avg-moves').textContent = avgM ?? '—';
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  applyPrefs();

  // Pointer events
  document.addEventListener('mousedown',  onDown);
  document.addEventListener('mousemove',  onMove);
  document.addEventListener('mouseup',    onUp);
  document.addEventListener('touchstart', onDown, { passive:false });
  document.addEventListener('touchmove',  onMove, { passive:false });
  document.addEventListener('touchend',   onUp);

  // Buttons
  document.getElementById('new-game-btn').addEventListener('click', newGame);
  document.getElementById('play-again-btn').addEventListener('click', newGame);
  document.getElementById('new-game-after-timeout-btn').addEventListener('click', newGame);
  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('auto-complete-btn').addEventListener('click', runAutoComplete);

  // How to play
  const howTo = document.getElementById('how-to-screen');
  document.getElementById('how-to-btn').addEventListener('click', () => howTo.classList.remove('hidden'));
  document.getElementById('close-how-to-btn').addEventListener('click', () => howTo.classList.add('hidden'));
  howTo.addEventListener('click', e => { if (e.target === howTo) howTo.classList.add('hidden'); });

  // Preferences
  const prefsScreen = document.getElementById('prefs-screen');
  document.getElementById('prefs-btn').addEventListener('click', openPrefs);
  document.getElementById('close-prefs-btn').addEventListener('click', closePrefs);
  prefsScreen.addEventListener('click', e => { if (e.target === prefsScreen) closePrefs(); });
  document.getElementById('pref-game-mode').addEventListener('change', e =>
    document.getElementById('timed-options').classList.toggle('hidden', e.target.value !== 'timed')
  );
  document.getElementById('reset-stats-btn').addEventListener('click', () => {
    stats = { ...DEFAULT_STATS };
    saveStats();
    refreshStats();
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + tab));
      if (tab === 'stats') refreshStats();
    })
  );

  window.addEventListener('resize', () => { updateCardSize(); render(); });

  newGame();
});
