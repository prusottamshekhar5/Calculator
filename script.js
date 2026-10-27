// --- State Management ---
let currentInput = '0';
let previousInput = '';
let operator = null;
let shouldResetScreen = false;
let soundEnabled = true;
let isDegree = true; // true = DEG, false = RAD

// DOM Elements
const calculatorEl = document.getElementById('calculator');
const resultEl = document.getElementById('result');
const expressionEl = document.getElementById('expression');
const angleBadgeEl = document.getElementById('angleBadge');
const angleBtnEl = document.getElementById('angleBtn');
const btnNormal = document.getElementById('btnNormal');
const btnScientific = document.getElementById('btnScientific');
const sciKeypad = document.getElementById('sciKeypad');
const soundToggleBtn = document.getElementById('soundToggle');
const soundWaves = document.getElementById('soundWaves');
const operatorButtons = document.querySelectorAll('[data-action="operator"]');

// --- Web Audio API Tactile Click Synthesizer ---
let audioCtx = null;
function playClickSound(pitch = 210) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, audioCtx.currentTime + 0.035);

    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.035);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  } catch (e) {
    // Ignore audio errors if blocked by browser policy
  }
}

// --- Mode Switching (Normal vs. Scientific) ---
function setMode(mode) {
  const isSci = mode === 'scientific';
  calculatorEl.classList.toggle('scientific-mode', isSci);
  btnNormal.classList.toggle('active', !isSci);
  btnScientific.classList.toggle('active', isSci);
  btnNormal.setAttribute('aria-selected', !isSci);
  btnScientific.setAttribute('aria-selected', isSci);
  sciKeypad.setAttribute('aria-hidden', !isSci);
  playClickSound(280);
}

btnNormal.addEventListener('click', () => setMode('normal'));
btnScientific.addEventListener('click', () => setMode('scientific'));

soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggleBtn.classList.toggle('active', soundEnabled);
  soundWaves.style.display = soundEnabled ? 'block' : 'none';
  if (soundEnabled) playClickSound(320);
});

// --- Number Formatting & Display ---
function formatNumber(numStr) {
  if (numStr === 'Error' || numStr === 'Infinity' || numStr === '-Infinity' || numStr === 'NaN') {
    return 'Error';
  }
  if (numStr.includes('e')) return numStr;

  const [integerPart, decimalPart] = numStr.split('.');
  const isNegative = integerPart.startsWith('-');
  const absInt = isNegative ? integerPart.slice(1) : integerPart;
  const formattedInt = absInt ? parseFloat(absInt).toLocaleString('en-US') : '0';
  const signedInt = isNegative ? `-${formattedInt}` : formattedInt;

  return decimalPart !== undefined ? `${signedInt}.${decimalPart}` : signedInt;
}

function cleanPrecision(num) {
  if (!isFinite(num) || isNaN(num)) return 'Error';
  if (Math.abs(num) > 1e12 || (Math.abs(num) > 0 && Math.abs(num) < 1e-9)) {
    return num.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return String(Number(Math.round(num + 'e10') + 'e-10'));
}

function getOperatorSymbol(op) {
  const symbols = { '/': '÷', '*': '×', '-': '−', '+': '+', '^': '^' };
  return symbols[op] || '';
}

function updateDisplay() {
  resultEl.textContent = formatNumber(currentInput);
  resultEl.classList.toggle('small-text', currentInput.length > 9);

  if (operator !== null) {
    expressionEl.textContent = `${formatNumber(previousInput)} ${getOperatorSymbol(operator)}`;
  }

  operatorButtons.forEach(btn => {
    btn.classList.toggle('active-op', btn.dataset.value === operator && shouldResetScreen);
  });
}

// --- Standard Calculator Functions ---
function appendNumber(number) {
  if (currentInput === 'Error') currentInput = '0';
  if (currentInput === '0' || shouldResetScreen) {
    currentInput = number;
    shouldResetScreen = false;
  } else if (currentInput.replace(/[-.]/g, '').length < 12) {
    currentInput += number;
  }
  updateDisplay();
}

function appendDecimal() {
  if (shouldResetScreen || currentInput === 'Error') {
    currentInput = '0.';
    shouldResetScreen = false;
    updateDisplay();
    return;
  }
  if (!currentInput.includes('.')) {
    currentInput += '.';
    updateDisplay();
  }
}

function clearAll() {
  currentInput = '0';
  previousInput = '';
  operator = null;
  shouldResetScreen = false;
  expressionEl.textContent = '';
  updateDisplay();
}

function deleteDigit() {
  if (shouldResetScreen || currentInput === 'Error') {
    currentInput = '0';
    shouldResetScreen = false;
  } else if (currentInput.length === 1 || (currentInput.length === 2 && currentInput.startsWith('-'))) {
    currentInput = '0';
  } else {
    currentInput = currentInput.slice(0, -1);
  }
  updateDisplay();
}

function applyPercent() {
  if (currentInput === 'Error') return;
  const val = parseFloat(currentInput);
  if (isNaN(val)) return;
  currentInput = cleanPrecision(val / 100);
  updateDisplay();
}

function chooseOperator(nextOperator) {
  if (currentInput === 'Error') clearAll();
  if (operator !== null && !shouldResetScreen) {
    calculate();
  }
  previousInput = currentInput;
  operator = nextOperator;
  shouldResetScreen = true;
  updateDisplay();
}

function calculate() {
  if (operator === null || shouldResetScreen) return;
  const prev = parseFloat(previousInput);
  const current = parseFloat(currentInput);
  if (isNaN(prev) || isNaN(current)) return;

  let computation = 0;
  switch (operator) {
    case '+': computation = prev + current; break;
    case '-': computation = prev - current; break;
    case '*': computation = prev * current; break;
    case '^': computation = Math.pow(prev, current); break;
    case '/':
      if (current === 0) {
        currentInput = 'Error';
        operator = null;
        previousInput = '';
        shouldResetScreen = true;
        expressionEl.textContent = 'Cannot divide by 0';
        updateDisplay();
        return;
      }
      computation = prev / current;
      break;
    default: return;
  }

  expressionEl.textContent = `${formatNumber(previousInput)} ${getOperatorSymbol(operator)} ${formatNumber(currentInput)} =`;
  currentInput = cleanPrecision(computation);
  operator = null;
  shouldResetScreen = true;
  updateDisplay();
}

// --- Scientific Functions ---
function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function handleScientific(sciAction) {
  if (sciAction === 'angle') {
    isDegree = !isDegree;
    const label = isDegree ? 'DEG' : 'RAD';
    angleBadgeEl.textContent = label;
    angleBtnEl.textContent = label;
    return;
  }

  if (sciAction === 'pi') {
    currentInput = cleanPrecision(Math.PI);
    shouldResetScreen = true;
    expressionEl.textContent = 'π';
    updateDisplay();
    return;
  }

  if (sciAction === 'e') {
    currentInput = cleanPrecision(Math.E);
    shouldResetScreen = true;
    expressionEl.textContent = 'e';
    updateDisplay();
    return;
  }

  const val = parseFloat(currentInput);
  if (isNaN(val)) return;

  let res = 0;
  let exprLabel = '';
  const rad = isDegree ? (val * Math.PI) / 180 : val;

  switch (sciAction) {
    case 'sin':
      res = Math.abs(Math.sin(rad)) < 1e-15 ? 0 : Math.sin(rad);
      exprLabel = `sin(${formatNumber(currentInput)}${isDegree ? '°' : ''})`;
      break;
    case 'cos':
      res = Math.abs(Math.cos(rad)) < 1e-15 ? 0 : Math.cos(rad);
      exprLabel = `cos(${formatNumber(currentInput)}${isDegree ? '°' : ''})`;
      break;
    case 'tan':
      if (isDegree && Math.abs(val % 180) === 90) {
        res = NaN;
      } else {
        res = Math.abs(Math.tan(rad)) < 1e-15 ? 0 : Math.tan(rad);
      }
      exprLabel = `tan(${formatNumber(currentInput)}${isDegree ? '°' : ''})`;
      break;
    case 'ln':
      res = val <= 0 ? NaN : Math.log(val);
      exprLabel = `ln(${formatNumber(currentInput)})`;
      break;
    case 'log':
      res = val <= 0 ? NaN : Math.log10(val);
      exprLabel = `log(${formatNumber(currentInput)})`;
      break;
    case 'sqrt':
      res = val < 0 ? NaN : Math.sqrt(val);
      exprLabel = `√(${formatNumber(currentInput)})`;
      break;
    case 'cbrt':
      res = Math.cbrt(val);
      exprLabel = `∛(${formatNumber(currentInput)})`;
      break;
    case 'sq':
      res = val * val;
      exprLabel = `(${formatNumber(currentInput)})²`;
      break;
    case 'inv':
      res = val === 0 ? NaN : 1 / val;
      exprLabel = `1/(${formatNumber(currentInput)})`;
      break;
    case 'fact':
      res = factorial(val);
      exprLabel = `${formatNumber(currentInput)}!`;
      break;
    case 'neg':
      if (currentInput !== '0' && currentInput !== 'Error') {
        currentInput = currentInput.startsWith('-') ? currentInput.slice(1) : `-${currentInput}`;
        updateDisplay();
      }
      return;
    case 'abs':
      res = Math.abs(val);
      exprLabel = `|${formatNumber(currentInput)}|`;
      break;
    default:
      return;
  }

  expressionEl.textContent = `${exprLabel} =`;
  currentInput = cleanPrecision(res);
  shouldResetScreen = true;
  updateDisplay();
}

// --- Click Delegation for Both Keypads ---
calculatorEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.key');
  if (!btn) return;

  const isAccent = btn.classList.contains('equals') || btn.classList.contains('operator');
  playClickSound(isAccent ? 310 : btn.classList.contains('sci-key') ? 250 : 210);

  if (btn.dataset.number !== undefined) {
    appendNumber(btn.dataset.number);
  } else if (btn.dataset.action === 'decimal') {
    appendDecimal();
  } else if (btn.dataset.action === 'clear') {
    clearAll();
  } else if (btn.dataset.action === 'delete') {
    deleteDigit();
  } else if (btn.dataset.action === 'percent') {
    applyPercent();
  } else if (btn.dataset.action === 'operator') {
    chooseOperator(btn.dataset.value);
  } else if (btn.dataset.action === 'calculate') {
    calculate();
  } else if (btn.dataset.sci) {
    handleScientific(btn.dataset.sci);
  }
});

// --- Keyboard Support ---
window.addEventListener('keydown', (e) => {
  let key = e.key;
  if (key === 'Enter' || key === '=') key = 'Enter';
  if (key === 'c' || key === 'C') key = 'Escape';

  const matchingBtn = document.querySelector(`.key[data-key="${key}"]`);
  if (matchingBtn) {
    e.preventDefault();
    matchingBtn.classList.add('pressed');
    matchingBtn.click();
    setTimeout(() => matchingBtn.classList.remove('pressed'), 120);
  }
});