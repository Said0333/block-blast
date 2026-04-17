/**
 * BLOCK BLAST — app.js
 * Pure vanilla JS puzzle game
 * Drag-and-drop, touch support, line clearing, scoring
 */

'use strict';

// ============================================================
//  CONSTANTS
// ============================================================

const BOARD_SIZE  = 10;   // 10×10 grid
const SLOT_COUNT  = 3;    // 3 pieces shown at a time

/** All possible block shapes (as row/col offsets from [0,0]) */
const SHAPES = [
  // 1×1
  { name: '1x1',   cells: [[0,0]] },

  // 1×2, 2×1
  { name: '1x2',   cells: [[0,0],[0,1]] },
  { name: '2x1',   cells: [[0,0],[1,0]] },

  // 1×3, 3×1
  { name: '1x3',   cells: [[0,0],[0,1],[0,2]] },
  { name: '3x1',   cells: [[0,0],[1,0],[2,0]] },

  // 1×4, 4×1
  { name: '1x4',   cells: [[0,0],[0,1],[0,2],[0,3]] },
  { name: '4x1',   cells: [[0,0],[1,0],[2,0],[3,0]] },

  // 1×5, 5×1
  { name: '1x5',   cells: [[0,0],[0,1],[0,2],[0,3],[0,4]] },
  { name: '5x1',   cells: [[0,0],[1,0],[2,0],[3,0],[4,0]] },

  // 2×2 square
  { name: '2x2',   cells: [[0,0],[0,1],[1,0],[1,1]] },

  // 3×3 square
  { name: '3x3',   cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]] },

  // 2×3 / 3×2
  { name: '2x3',   cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]] },
  { name: '3x2',   cells: [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]] },

  // L shapes
  { name: 'L1',    cells: [[0,0],[1,0],[2,0],[2,1]] },
  { name: 'L2',    cells: [[0,0],[0,1],[0,2],[1,0]] },
  { name: 'L3',    cells: [[0,0],[0,1],[1,1],[2,1]] },
  { name: 'L4',    cells: [[0,2],[1,0],[1,1],[1,2]] },
  { name: 'L5',    cells: [[0,0],[1,0],[1,1],[1,2]] },
  { name: 'L6',    cells: [[0,0],[0,1],[0,2],[1,2]] },
  { name: 'L7',    cells: [[0,1],[1,1],[2,0],[2,1]] },
  { name: 'L8',    cells: [[0,0],[1,0],[1,1],[1,2]] },  // mirror

  // T shapes
  { name: 'T1',    cells: [[0,0],[0,1],[0,2],[1,1]] },
  { name: 'T2',    cells: [[0,0],[1,0],[1,1],[2,0]] },
  { name: 'T3',    cells: [[0,1],[1,0],[1,1],[1,2]] },
  { name: 'T4',    cells: [[0,0],[0,1],[1,0],[2,0]] },

  // S / Z shapes
  { name: 'S1',    cells: [[0,1],[0,2],[1,0],[1,1]] },
  { name: 'S2',    cells: [[0,0],[1,0],[1,1],[2,1]] },
  { name: 'Z1',    cells: [[0,0],[0,1],[1,1],[1,2]] },
  { name: 'Z2',    cells: [[0,1],[1,0],[1,1],[2,0]] },

  // Diagonal / Plus
  { name: 'PLUS',  cells: [[0,1],[1,0],[1,1],[1,2],[2,1]] },
  { name: 'DIAG1', cells: [[0,0],[1,1],[2,2]] },
  { name: 'DIAG2', cells: [[0,2],[1,1],[2,0]] },

  // Corner pieces
  { name: 'CORN1', cells: [[0,0],[0,1],[1,0]] },
  { name: 'CORN2', cells: [[0,0],[0,1],[1,1]] },
  { name: 'CORN3', cells: [[0,0],[1,0],[1,1]] },
  { name: 'CORN4', cells: [[0,1],[1,0],[1,1]] },
];

/** CSS color var indices (0-7) */
const COLOR_COUNT = 8;

// ============================================================
//  STATE
// ============================================================

let board       = [];       // 2D array: null | colorIndex
let queue       = [];       // 3 piece objects: { shape, color, used }
let score       = 0;
let highScore   = 0;
let lines       = 0;
let level       = 1;
let comboCount  = 0;
let gameActive  = false;

// Drag state
let dragState = {
  active:    false,
  slotIndex: -1,
  shape:     null,
  color:     -1,
  ghostEl:   null,
  // current board row/col highlighted
  hoverRow:  -1,
  hoverCol:  -1,
};

// ============================================================
//  DOM REFERENCES
// ============================================================

const gameBoardEl    = document.getElementById('gameBoard');
const scoreEl        = document.getElementById('scoreDisplay');
const highScoreEl    = document.getElementById('highScoreDisplay');
const linesEl        = document.getElementById('linesDisplay');
const levelEl        = document.getElementById('levelDisplay');
const nextBlocksEl   = document.getElementById('nextBlocks');
const restartBtn     = document.getElementById('restartBtn');
const gameOverModal  = document.getElementById('gameOverModal');
const modalScore     = document.getElementById('modalScore');
const modalBest      = document.getElementById('modalBest');
const playAgainBtn   = document.getElementById('playAgainBtn');
const comboEl        = document.getElementById('comboDisplay');
const scorePopEl     = document.getElementById('scorePop');

// Cell DOM cache
let cellEls = [];

// ============================================================
//  AUDIO  (simple Web Audio tones — no files needed)
// ============================================================

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return audioCtx;
}

function playTone(freq, type = 'square', duration = 0.08, vol = 0.12) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function sfxPlace()  { playTone(220, 'square', 0.06, 0.1); }
function sfxClear()  {
  [523, 659, 784, 1046].forEach((f, i) =>
    setTimeout(() => playTone(f, 'sine', 0.12, 0.15), i * 60)
  );
}
function sfxGameOver() { [200, 160, 120].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.25, 0.18), i * 120)); }
function sfxCombo()    { playTone(1046, 'sine', 0.2, 0.2); }

// ============================================================
//  INIT
// ============================================================

function init() {
  highScore = parseInt(localStorage.getItem('blockblast_hi') || '0', 10);
  highScoreEl.textContent = highScore;
  buildBoardDOM();
  startGame();
}

function startGame() {
  board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  score = 0;
  lines = 0;
  level = 1;
  comboCount = 0;
  gameActive = true;

  updateScoreUI();
  renderBoard();
  generateQueue();
  renderQueue();
  hideModal();
}

// ============================================================
//  BOARD DOM BUILD
// ============================================================

function buildBoardDOM() {
  gameBoardEl.innerHTML = '';
  cellEls = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    cellEls[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      gameBoardEl.appendChild(cell);
      cellEls[r][c] = cell;
    }
  }

  // Board drag-over / drop listeners
  gameBoardEl.addEventListener('mousemove', onBoardMouseMove);
  gameBoardEl.addEventListener('mouseleave', onBoardMouseLeave);
  gameBoardEl.addEventListener('mouseup',   onBoardDrop);
  gameBoardEl.addEventListener('touchmove', onBoardTouchMove, { passive: false });
  gameBoardEl.addEventListener('touchend',  onBoardTouchEnd,  { passive: false });
}

// ============================================================
//  RENDER
// ============================================================

function renderBoard() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = cellEls[r][c];
      const val  = board[r][c];
      if (val !== null) {
        cell.classList.add('filled');
        cell.dataset.color = val;
      } else {
        cell.classList.remove('filled', 'highlight', 'invalid');
        delete cell.dataset.color;
      }
    }
  }
}

function renderQueue() {
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot  = document.getElementById('slot' + i);
    const piece = queue[i];

    slot.innerHTML = '';
    slot.classList.remove('used', 'dragging');

    if (!piece || piece.used) {
      slot.classList.add('used');
      continue;
    }

    const miniGrid = buildMiniGrid(piece.shape, piece.color);
    slot.appendChild(miniGrid);

    // Mouse drag
    slot.onmousedown = (e) => startDrag(e, i, 'mouse');
    // Touch drag
    slot.ontouchstart = (e) => startDrag(e, i, 'touch');
  }
}

function buildMiniGrid(shape, color) {
  const rows = Math.max(...shape.cells.map(c => c[0])) + 1;
  const cols = Math.max(...shape.cells.map(c => c[1])) + 1;

  const grid = document.createElement('div');
  grid.className = 'mini-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;

  const occupied = new Set(shape.cells.map(([r, c]) => `${r},${c}`));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'mini-cell';
      if (occupied.has(`${r},${c}`)) {
        cell.classList.add('on');
        cell.dataset.color = color;
      }
      grid.appendChild(cell);
    }
  }
  return grid;
}

// ============================================================
//  QUEUE MANAGEMENT
// ============================================================

function generateQueue() {
  queue = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    queue.push(randomPiece());
  }
}

function randomPiece() {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const color = Math.floor(Math.random() * COLOR_COUNT);
  return { shape, color, used: false };
}

function isQueueEmpty() {
  return queue.every(p => p.used);
}

function refreshQueueIfNeeded() {
  if (isQueueEmpty()) {
    generateQueue();
    renderQueue();
  }
}

// ============================================================
//  DRAG & DROP — MOUSE
// ============================================================

function startDrag(e, slotIndex, mode) {
  if (!gameActive) return;
  const piece = queue[slotIndex];
  if (!piece || piece.used) return;

  // Unlock audio context on first interaction
  getAudioCtx();

  e.preventDefault();

  dragState.active    = true;
  dragState.slotIndex = slotIndex;
  dragState.shape     = piece.shape;
  dragState.color     = piece.color;
  dragState.hoverRow  = -1;
  dragState.hoverCol  = -1;

  // Create ghost element
  const ghost = buildGhostEl(piece.shape, piece.color);
  document.body.appendChild(ghost);
  dragState.ghostEl = ghost;

  document.getElementById('slot' + slotIndex).classList.add('dragging');

  if (mode === 'mouse') {
    positionGhost(e.clientX, e.clientY);
    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup',   onDocMouseUp);
  } else {
    const t = e.touches[0];
    positionGhost(t.clientX, t.clientY);
    document.addEventListener('touchmove', onDocTouchMove, { passive: false });
    document.addEventListener('touchend',  onDocTouchEnd,  { passive: false });
  }
}

function buildGhostEl(shape, color) {
  const rows = Math.max(...shape.cells.map(c => c[0])) + 1;
  const cols = Math.max(...shape.cells.map(c => c[1])) + 1;

  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  ghost.style.gridTemplateRows    = `repeat(${rows}, var(--cell-size))`;
  ghost.style.display = 'grid';

  const colorVar = getComputedStyle(document.documentElement).getPropertyValue(`--c${color + 1}`).trim();
  ghost.style.color = colorVar;

  const occupied = new Set(shape.cells.map(([r, c]) => `${r},${c}`));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'ghost-cell';
      if (occupied.has(`${r},${c}`)) {
        cell.style.background = colorVar;
        cell.style.boxShadow  = `0 0 8px ${colorVar}`;
        cell.style.opacity    = '0.85';
      } else {
        cell.style.opacity = '0';
      }
      ghost.appendChild(cell);
    }
  }
  return ghost;
}

function positionGhost(x, y) {
  if (!dragState.ghostEl) return;
  dragState.ghostEl.style.left = x + 'px';
  dragState.ghostEl.style.top  = y + 'px';
}

function onDocMouseMove(e) {
  positionGhost(e.clientX, e.clientY);
  highlightBoardFromPointer(e.clientX, e.clientY);
}

function onDocMouseUp(e) {
  document.removeEventListener('mousemove', onDocMouseMove);
  document.removeEventListener('mouseup',   onDocMouseUp);
  tryPlaceFromPointer(e.clientX, e.clientY);
  endDrag();
}

function onDocTouchMove(e) {
  e.preventDefault();
  const t = e.touches[0];
  positionGhost(t.clientX, t.clientY);
  highlightBoardFromPointer(t.clientX, t.clientY);
}

function onDocTouchEnd(e) {
  document.removeEventListener('touchmove', onDocTouchMove);
  document.removeEventListener('touchend',  onDocTouchEnd);
  const t = e.changedTouches[0];
  tryPlaceFromPointer(t.clientX, t.clientY);
  endDrag();
}

// Board-level move (for non-document scenarios — belt-and-suspenders)
function onBoardMouseMove(e) { if (dragState.active) highlightBoardFromPointer(e.clientX, e.clientY); }
function onBoardMouseLeave()  { if (dragState.active) clearHighlight(); }
function onBoardDrop(e)       { /* handled by document mouseup */ }
function onBoardTouchMove(e)  { /* handled by document touchmove */ }
function onBoardTouchEnd(e)   { /* handled by document touchend */ }

function cellFromPoint(x, y) {
  // Use elementFromPoint to find which cell is under the pointer
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const cell = el.closest('.cell');
  if (!cell) return null;
  return { r: parseInt(cell.dataset.r), c: parseInt(cell.dataset.c) };
}

function getSnapOrigin(pointerRow, pointerCol, shape) {
  // Snap the top-left of the shape's bounding box to the cell, adjusted for center of piece
  const maxR = Math.max(...shape.cells.map(c => c[0]));
  const maxC = Math.max(...shape.cells.map(c => c[1]));
  const originRow = pointerRow - Math.floor(maxR / 2);
  const originCol = pointerCol - Math.floor(maxC / 2);
  return { originRow, originCol };
}

function highlightBoardFromPointer(x, y) {
  clearHighlight();
  const hit = cellFromPoint(x, y);
  if (!hit) return;

  const { originRow, originCol } = getSnapOrigin(hit.r, hit.c, dragState.shape);
  const valid = canPlace(dragState.shape, originRow, originCol);

  dragState.hoverRow = originRow;
  dragState.hoverCol = originCol;

  for (const [dr, dc] of dragState.shape.cells) {
    const r = originRow + dr;
    const c = originCol + dc;
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      cellEls[r][c].classList.add(valid ? 'highlight' : 'invalid');
    }
  }
}

function clearHighlight() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      cellEls[r][c].classList.remove('highlight', 'invalid');
    }
  }
}

function tryPlaceFromPointer(x, y) {
  const hit = cellFromPoint(x, y);
  if (!hit) return;

  const { originRow, originCol } = getSnapOrigin(hit.r, hit.c, dragState.shape);
  if (canPlace(dragState.shape, originRow, originCol)) {
    placePiece(dragState.shape, dragState.color, dragState.slotIndex, originRow, originCol);
  }
}

function endDrag() {
  clearHighlight();
  if (dragState.ghostEl) {
    dragState.ghostEl.remove();
    dragState.ghostEl = null;
  }
  const slot = document.getElementById('slot' + dragState.slotIndex);
  if (slot) slot.classList.remove('dragging');

  dragState.active    = false;
  dragState.slotIndex = -1;
  dragState.shape     = null;
  dragState.color     = -1;
}

// ============================================================
//  GAME LOGIC
// ============================================================

function canPlace(shape, originRow, originCol) {
  for (const [dr, dc] of shape.cells) {
    const r = originRow + dr;
    const c = originCol + dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c] !== null) return false;
  }
  return true;
}

function placePiece(shape, color, slotIndex, originRow, originCol) {
  // Write cells onto the board
  for (const [dr, dc] of shape.cells) {
    board[originRow + dr][originCol + dc] = color;
  }

  sfxPlace();

  // Mark piece as used
  queue[slotIndex].used = true;
  renderQueue();

  // Render board
  renderBoard();

  // Check for line clears
  checkAndClearLines();

  // Refresh queue if all pieces used
  refreshQueueIfNeeded();

  // Check game over
  setTimeout(() => {
    if (!canAnyPieceBePlaced()) {
      triggerGameOver();
    }
  }, 600);
}

function checkAndClearLines() {
  const fullRows = [];
  const fullCols = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    if (board[r].every(v => v !== null)) fullRows.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    if (board.every(row => row[c] !== null)) fullCols.push(c);
  }

  const totalLines = fullRows.length + fullCols.length;
  if (totalLines === 0) {
    comboCount = 0;
    comboEl.textContent = '';
    return;
  }

  comboCount++;
  const comboBonus = comboCount > 1 ? comboCount : 1;

  // Animate clearing cells
  const clearSet = new Set();
  fullRows.forEach(r => {
    for (let c = 0; c < BOARD_SIZE; c++) clearSet.add(`${r},${c}`);
  });
  fullCols.forEach(c => {
    for (let r = 0; r < BOARD_SIZE; r++) clearSet.add(`${r},${c}`);
  });

  clearSet.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    cellEls[r][c].classList.add('clearing');
  });

  // Add flash overlay
  addBoardFlash();

  sfxClear();
  if (comboCount > 1) sfxCombo();

  // Show combo
  if (comboCount > 1) {
    comboEl.textContent = `${comboCount}× COMBO!`;
  } else {
    comboEl.textContent = `${totalLines} LINE${totalLines > 1 ? 'S' : ''}!`;
  }

  setTimeout(() => {
    comboEl.textContent = '';
  }, 1200);

  // Remove from board after animation
  setTimeout(() => {
    clearSet.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      board[r][c] = null;
      cellEls[r][c].classList.remove('clearing', 'filled');
      delete cellEls[r][c].dataset.color;
    });

    // Scoring
    const basePoints = totalLines * 100 * totalLines; // quadratic reward
    const combo  = comboCount > 1 ? comboCount * 50  : 0;
    const earned = basePoints * comboBonus + combo;

    addScore(earned, clearSet.size);
    lines += totalLines;
    level = Math.floor(lines / 10) + 1;

    linesEl.textContent = lines;
    levelEl.textContent = level;

    renderBoard();
  }, 450);
}

function addBoardFlash() {
  const flash = document.createElement('div');
  flash.className = 'clear-flash';
  document.querySelector('.board-container').appendChild(flash);
  setTimeout(() => flash.remove(), 400);
}

function addScore(earned, _cells) {
  score += earned;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('blockblast_hi', highScore);
    highScoreEl.textContent = highScore;
    highScoreEl.classList.add('pop');
    setTimeout(() => highScoreEl.classList.remove('pop'), 400);
  }
  scoreEl.textContent = score;
  scoreEl.classList.add('pop');
  setTimeout(() => scoreEl.classList.remove('pop'), 300);

  showScorePop('+' + earned);
}

function showScorePop(text) {
  scorePopEl.textContent = text;
  scorePopEl.classList.remove('show');
  void scorePopEl.offsetWidth; // reflow
  scorePopEl.classList.add('show');
}

function updateScoreUI() {
  scoreEl.textContent     = score;
  highScoreEl.textContent = highScore;
  linesEl.textContent     = lines;
  levelEl.textContent     = level;
}

// ============================================================
//  GAME OVER CHECK
// ============================================================

function canAnyPieceBePlaced() {
  const activePieces = queue.filter(p => !p.used);
  for (const piece of activePieces) {
    if (canShapeFitAnywhere(piece.shape)) return true;
  }
  return false;
}

function canShapeFitAnywhere(shape) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlace(shape, r, c)) return true;
    }
  }
  return false;
}

function triggerGameOver() {
  gameActive = false;
  sfxGameOver();
  modalScore.textContent = score;
  modalBest.textContent  = highScore;
  showModal();
}

// ============================================================
//  MODAL
// ============================================================

function showModal() {
  gameOverModal.classList.add('visible');
}

function hideModal() {
  gameOverModal.classList.remove('visible');
}

// ============================================================
//  EVENT LISTENERS
// ============================================================

restartBtn.addEventListener('click', () => {
  endDrag(); // clean up if mid-drag
  startGame();
});

playAgainBtn.addEventListener('click', () => {
  startGame();
});

// Prevent context menu on long press (mobile)
document.addEventListener('contextmenu', e => e.preventDefault());

// ============================================================
//  KEYBOARD SHORTCUT
// ============================================================

document.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') {
    endDrag();
    startGame();
  }
});

// ============================================================
//  ENTRY
// ============================================================

window.addEventListener('DOMContentLoaded', init);
