const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const pageUrl = 'https://dacameragirl.github.io/Jaxons-Number-Genius-Lab/';
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(pageUrl)}`;

const els = {
  canvas: $('#numberCanvas'),
  cursorTrail: $('#cursorTrail'),
  mainMenu: $('#mainMenu'),
  sectionView: $('#sectionView'),
  sectionContent: $('#sectionContent'),
  backBtn: $('#backBtn'),
  stars: $('#stars'),
  resetStars: $('#resetStars'),
  voiceIndicator: $('#voiceIndicator'),
  voiceLabel: $('#voiceLabel'),
  voiceToggleBtn: $('#voiceToggleBtn'),
  qrMini: $('#qrMini'),
};

const state = {
  stars: Number(localStorage.getItem('geniusLabStars') || 0),
  voiceOn: localStorage.getItem('geniusLabVoice') !== 'off',
  calc: {
    current: '0',
    previous: '',
    operator: '',
    fresh: true,
  },
  prime: {
    numbers: [],
    selected: new Set(),
  },
  magic: [8, 1, 6, 3, '', 7, 4, 9, 2],
  roundStarted: 0,
};

const sky = {
  ctx: null,
  numbers: [],
  pointer: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  return items.sort(() => Math.random() - 0.5);
}

function setStars(value) {
  state.stars = Math.max(0, value);
  localStorage.setItem('geniusLabStars', String(state.stars));
  els.stars.textContent = state.stars;
}

function addStar(amount = 1) {
  setStars(state.stars + amount);
}

function startRound() {
  state.roundStarted = Date.now();
}

function speedBonus() {
  const seconds = (Date.now() - state.roundStarted) / 1000;
  if (seconds <= 10) return 3;
  if (seconds <= 18) return 2;
  if (seconds <= 30) return 1;
  return 0;
}

function setFeedback(text, good = false) {
  const feedback = $('.feedback');
  if (!feedback) return;
  feedback.textContent = text;
  feedback.style.color = good ? '#05813e' : '#285f85';
}

function bestVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = ['Google US English', 'Samantha', 'Karen', 'Moira', 'Victoria', 'Alex'];
  return preferred.map((name) => voices.find((voice) => voice.name === name)).find(Boolean)
    || voices.find((voice) => voice.lang && voice.lang.startsWith('en'))
    || voices[0]
    || null;
}

function speak(text, priority = false) {
  if (!state.voiceOn || !text || !('speechSynthesis' in window)) return;
  if (priority) window.speechSynthesis.cancel();

  const readable = String(text)
    .replaceAll('**', ' to the power of ')
    .replaceAll('*', ' times ')
    .replaceAll('/', ' divided by ')
    .replaceAll('+', ' plus ')
    .replaceAll('-', ' minus ')
    .replaceAll('=', ' equals ');

  const utterance = new SpeechSynthesisUtterance(readable);
  utterance.voice = bestVoice();
  utterance.rate = 0.9;
  utterance.pitch = 1.08;
  utterance.volume = 1;
  utterance.onstart = () => els.voiceIndicator.classList.add('speaking');
  utterance.onend = () => els.voiceIndicator.classList.remove('speaking');
  window.speechSynthesis.speak(utterance);
}

function updateVoiceUi() {
  els.voiceIndicator.classList.toggle('muted', !state.voiceOn);
  els.voiceIndicator.setAttribute('aria-pressed', String(state.voiceOn));
  els.voiceLabel.textContent = state.voiceOn ? 'Voice On' : 'Voice Off';
  els.voiceToggleBtn.textContent = state.voiceOn ? 'Voice is on - tap to mute' : 'Voice is off - tap to turn on';
  els.voiceToggleBtn.classList.toggle('muted', !state.voiceOn);
}

function toggleVoice() {
  state.voiceOn = !state.voiceOn;
  localStorage.setItem('geniusLabVoice', state.voiceOn ? 'on' : 'off');
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  updateVoiceUi();
  if (state.voiceOn) speak('Voice is on. Hi Jaxon.', true);
}

function sectionHeader(title, intro) {
  return `
    <header class="activity-head">
      <div>
        <h2>${title}</h2>
        <p>${intro}</p>
      </div>
      <button class="mini-action" type="button" data-say="${intro}">Say Rules</button>
    </header>
  `;
}

function openSection(id) {
  els.mainMenu.classList.add('hidden');
  els.sectionView.classList.remove('hidden');

  const actions = {
    calculator: renderCalculator,
    primeHunter: renderPrimeHunter,
    fibonacci: renderFibonacci,
    baseConverter: renderBaseConverter,
    multiMaster: renderMultiMaster,
    magicSquare: renderMagicSquare,
    factorialBlast: renderFactorialBlast,
    patternDetective: renderPatternDetective,
    qrStation: renderQrStation,
  };

  actions[id]();
}

function goBack() {
  els.sectionView.classList.add('hidden');
  els.mainMenu.classList.remove('hidden');
  speak('Back to the main menu.', true);
}

function displayCalc() {
  const display = $('#calcDisplay');
  if (display) display.textContent = state.calc.current.replaceAll('*', 'x').replaceAll('/', '\u00f7');
}

function calcNumber(value) {
  const calc = state.calc;
  if (calc.fresh || calc.current === '0' || calc.current === 'Error') {
    calc.current = value;
    calc.fresh = false;
  } else if (calc.current.replace('-', '').replace('.', '').length < 12) {
    calc.current += value;
  }
  displayCalc();
  speak(value);
}

function calcOperator(operator) {
  const calc = state.calc;
  if (calc.previous && calc.operator && !calc.fresh) calcEquals(true);
  calc.previous = calc.current;
  calc.operator = operator;
  calc.fresh = true;
  displayCalc();
  speak({ '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '**': 'to the power of' }[operator] || operator);
}

function calcEquals(chain = false) {
  const calc = state.calc;
  if (!calc.operator || !calc.previous) return;
  const a = Number(calc.previous);
  const b = Number(calc.current);
  let result = 0;
  if (calc.operator === '+') result = a + b;
  if (calc.operator === '-') result = a - b;
  if (calc.operator === '*') result = a * b;
  if (calc.operator === '/') result = b === 0 ? 'Error' : a / b;
  if (calc.operator === '**') result = a ** b;
  calc.current = result === 'Error' ? 'Error' : String(Number(result.toFixed(10)));
  if (!chain) {
    calc.previous = '';
    calc.operator = '';
  }
  calc.fresh = true;
  displayCalc();
  speak(result === 'Error' ? 'Cannot divide by zero.' : `equals ${calc.current}`, true);
}

function calcSpecial(action) {
  const calc = state.calc;
  const n = Number(calc.current);
  if (action === 'clear') {
    calc.current = '0';
    calc.previous = '';
    calc.operator = '';
    calc.fresh = true;
    speak('Clear');
  }
  if (action === 'back') {
    calc.current = calc.current.length > 1 ? calc.current.slice(0, -1) : '0';
    speak('delete');
  }
  if (action === 'sqrt') {
    calc.current = n < 0 ? 'Error' : String(Number(Math.sqrt(n).toFixed(8)));
    calc.fresh = true;
    speak(`square root equals ${calc.current}`, true);
  }
  if (action === 'square') {
    calc.current = String(Number((n * n).toFixed(8)));
    calc.fresh = true;
    speak(`${n} squared equals ${calc.current}`, true);
  }
  if (action === 'sign') {
    calc.current = String(n * -1);
    speak(calc.current, true);
  }
  if (action === 'percent') {
    calc.current = String(Number((n / 100).toFixed(8)));
    calc.fresh = true;
    speak(calc.current, true);
  }
  if (action === 'fact') {
    const whole = Math.floor(n);
    calc.current = whole < 0 || whole > 12 ? 'Error' : String(factorial(whole));
    calc.fresh = true;
    speak(calc.current === 'Error' ? 'Factorial needs a whole number from zero through twelve.' : `${whole} factorial equals ${calc.current}`, true);
  }
  displayCalc();
}

function renderCalculator() {
  els.sectionContent.innerHTML = `
    ${sectionHeader('Calculator Lab', 'A talking calculator with powers, square roots, factorials, percents, and big number buttons.')}
    <p class="challenge-note">Genius+ tools: powers, square roots, squares, factorials, percent, and keyboard entry.</p>
    <output id="calcDisplay" class="calc-display">0</output>
    <div class="calc-grid">
      ${['7','8','9','/','sqrt','4','5','6','*','square','1','2','3','-','**','0','.','=','+','fact','percent','sign','back','clear'].map((key) => `
        <button type="button" data-calc="${key}">${calcLabel(key)}</button>
      `).join('')}
    </div>
    <p class="feedback">Type with the buttons. The lab will read the numbers out loud.</p>
  `;
  state.calc = { current: '0', previous: '', operator: '', fresh: true };
  speak('Calculator Lab. Type numbers and I will read them to you.', true);
}

function calcLabel(key) {
  return {
    '/': '\u00f7',
    '*': 'x',
    '**': 'x^y',
    sqrt: '\u221a',
    square: 'x\u00b2',
    percent: '%',
    fact: 'n!',
    sign: '+/-',
    back: 'Back',
    clear: 'Clear',
  }[key] || key;
}

function isPrime(number) {
  if (number < 2) return false;
  for (let i = 2; i <= Math.sqrt(number); i += 1) {
    if (number % i === 0) return false;
  }
  return true;
}

function renderPrimeHunter() {
  startRound();
  state.prime.selected = new Set();
  const primes = shuffle([53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131]).slice(0, 6);
  const notPrimes = shuffle([51, 57, 63, 69, 77, 87, 91, 93, 99, 111, 119, 121, 123, 129, 133, 143]).slice(0, 8);
  state.prime.numbers = shuffle([...primes, ...notPrimes]);
  els.sectionContent.innerHTML = `
    ${sectionHeader('Prime Hunter', 'Tap every prime number from a mixed board of tricky composites.')}
    <p class="challenge-note">Genius+ rule: watch for composites like 91, 119, 121, and 143.</p>
    <div class="prime-grid">
      ${state.prime.numbers.map((number) => `<button type="button" data-prime="${number}">${number}</button>`).join('')}
    </div>
    <button class="mini-action" type="button" data-check-primes>Check Prime Hunt</button>
    <p class="feedback">Prime numbers have exactly two factors: 1 and themselves.</p>
  `;
  speak('Prime Hunter. Tap every prime number. Watch for tricky composites.', true);
}

function renderFibonacci() {
  startRound();
  const start = rand(4, 13);
  const seq = [start, start + rand(5, 17)];
  while (seq.length < 8) seq.push(seq.at(-1) + seq.at(-2));
  const missingIndex = rand(3, 6);
  const answer = seq[missingIndex];
  els.sectionContent.innerHTML = `
    ${sectionHeader('Fibonacci Builder', 'This is a Fibonacci-style chain with bigger starting values. Find the missing number.')}
    <p class="challenge-note">Genius+ rule: the missing value may be deep in the chain.</p>
    <div class="result-box"><strong>${seq.map((number, index) => index === missingIndex ? '?' : number).join('  ')}</strong></div>
    <div class="choice-grid">
      ${shuffle([answer, answer + seq[0], answer - seq[1], answer + seq[1], Math.abs(answer - seq[0])]).map((number) => choice(number, number === answer)).join('')}
    </div>
    <p class="feedback">Look at the two numbers before the missing spot.</p>
  `;
  speak('Fibonacci Builder. Bigger chain. Find the missing value.', true);
}

function renderBaseConverter() {
  startRound();
  const value = rand(128, 2047);
  els.sectionContent.innerHTML = `
    ${sectionHeader('Base Converter', 'Convert bigger numbers between decimal, binary, octal, and hex.')}
    <p class="challenge-note">Genius+ rule: challenges can ask decimal to binary, binary to decimal, or hex to decimal.</p>
    <input id="baseInput" class="number-input" type="number" min="0" max="99999" value="${value}" aria-label="Decimal number" />
    <div id="baseOutput" class="base-grid"></div>
    <button class="mini-action" type="button" data-new-base>New Binary Challenge</button>
    <div id="baseChallenge"></div>
    <p class="feedback">Binary uses 0 and 1. Hex uses 0 through 9 and A through F.</p>
  `;
  updateBaseOutput(value);
  renderBaseChallenge();
  $('#baseInput').addEventListener('input', (event) => updateBaseOutput(event.target.value));
  speak('Base Converter. Convert numbers between decimal, binary, octal, and hex.', true);
}

function updateBaseOutput(value) {
  const number = Math.max(0, Number(value || 0));
  $('#baseOutput').innerHTML = `
    <div class="base-box"><span>Binary</span><strong>${number.toString(2)}</strong></div>
    <div class="base-box"><span>Octal</span><strong>${number.toString(8)}</strong></div>
    <div class="base-box"><span>Decimal</span><strong>${number.toString(10)}</strong></div>
    <div class="base-box"><span>Hex</span><strong>${number.toString(16).toUpperCase()}</strong></div>
  `;
}

function renderBaseChallenge() {
  startRound();
  const kind = shuffle(['toBinary', 'fromBinary', 'fromHex'])[0];
  const decimal = rand(64, 511);
  let prompt = `What is ${decimal} in binary?`;
  let answer = decimal.toString(2);
  let wrong = [(decimal + 1).toString(2), Math.max(1, decimal - 2).toString(2), (decimal + 8).toString(2), decimal.toString(8)];
  if (kind === 'fromBinary') {
    prompt = `What is binary ${decimal.toString(2)} in decimal?`;
    answer = String(decimal);
    wrong = [String(decimal + 1), String(decimal - 2), String(decimal + 8), String(decimal + 16)];
  }
  if (kind === 'fromHex') {
    prompt = `What is hex ${decimal.toString(16).toUpperCase()} in decimal?`;
    answer = String(decimal);
    wrong = [String(decimal + 10), String(decimal - 6), String(decimal + 16), String(decimal + 1)];
  }
  $('#baseChallenge').innerHTML = `
    <div class="result-box"><span>${prompt}</span></div>
    <div class="choice-grid">
      ${shuffle([answer, ...wrong]).map((item) => choice(item, item === answer)).join('')}
    </div>
  `;
}

function renderMultiMaster() {
  startRound();
  const a = rand(13, 24);
  const b = rand(11, 19);
  const c = rand(7, 49);
  const subtract = Math.random() > 0.5;
  const answer = subtract ? (a * b) - c : (a * b) + c;
  const op = subtract ? '-' : '+';
  els.sectionContent.innerHTML = `
    ${sectionHeader('Multiplication Master', 'Solve a two-step multiplication challenge.')}
    <p class="challenge-note">Genius+ rule: multiply first, then finish the second step.</p>
    <div class="result-box"><strong>(${a} x ${b}) ${op} ${c} = ?</strong></div>
    <input id="multiAnswer" class="answer-input" inputmode="numeric" aria-label="Multiplication answer" />
    <button class="mini-action" type="button" data-answer="${answer}" data-input="multiAnswer">Check Answer</button>
    <p class="feedback">Use strategy: break ${a} x ${b} into smaller facts, then ${subtract ? 'subtract' : 'add'} ${c}.</p>
  `;
  $('#multiAnswer').focus();
  speak(`Multiplication Master. What is ${a} times ${b}, ${subtract ? 'minus' : 'plus'} ${c}?`, true);
}

function renderMagicSquare() {
  startRound();
  state.magic = ['', '', '', '', '', '', '', '', ''];
  els.sectionContent.innerHTML = `
    ${sectionHeader('Magic Square', 'Build the whole 3 by 3 magic square. Every line must equal 15.')}
    <p class="challenge-note">Genius+ rule: use each number 1 through 9 exactly once.</p>
    <div class="magic-grid">
      ${state.magic.map((value, index) => `<input data-magic="${index}" value="${value}" inputmode="numeric" aria-label="Magic square cell ${index + 1}" />`).join('')}
    </div>
    <button class="mini-action" type="button" data-check-magic>Check Magic Square</button>
    <p class="feedback">Hint: the center of a 3 by 3 magic square is usually 5.</p>
  `;
  speak('Magic Square. Build the whole square. Use each number one through nine exactly once.', true);
}

function renderFactorialBlast() {
  startRound();
  const n = rand(7, 10);
  const answer = factorial(n);
  els.sectionContent.innerHTML = `
    ${sectionHeader('Factorial Blast', 'A factorial multiplies a number by every positive number below it.')}
    <p class="challenge-note">Genius+ rule: factorials are large. Track the multiplication chain carefully.</p>
    <div class="result-box"><strong>${n}! = ?</strong><span>${n}! means ${Array.from({ length: n }, (_, i) => n - i).join(' x ')}</span></div>
    <div class="choice-grid">
      ${shuffle([answer, answer + (n * 100), answer / n, answer * 2, answer - (n * 10)]).map((number) => choice(number, number === answer)).join('')}
    </div>
    <p class="feedback">Factorials grow fast.</p>
  `;
  speak(`Factorial Blast. What is ${n} factorial?`, true);
}

function factorial(number) {
  return number <= 1 ? 1 : number * factorial(number - 1);
}

function renderPatternDetective() {
  startRound();
  const type = shuffle(['add', 'multiply', 'square', 'cube', 'triangular', 'alternating', 'multiplyAdd'])[0];
  let seq = [];
  let answer = 0;
  let clue = '';
  if (type === 'add') {
    const start = rand(20, 80);
    const step = rand(11, 29);
    seq = Array.from({ length: 5 }, (_, i) => start + i * step);
    answer = start + 5 * step;
    clue = 'arithmetic jump';
  }
  if (type === 'multiply') {
    const start = rand(3, 9);
    const factor = rand(2, 4);
    seq = Array.from({ length: 5 }, (_, i) => start * (factor ** i));
    answer = start * (factor ** 5);
    clue = 'geometric growth';
  }
  if (type === 'square') {
    const start = rand(5, 11);
    seq = Array.from({ length: 5 }, (_, i) => (start + i) ** 2);
    answer = (start + 5) ** 2;
    clue = 'square numbers';
  }
  if (type === 'cube') {
    const start = rand(2, 6);
    seq = Array.from({ length: 5 }, (_, i) => (start + i) ** 3);
    answer = (start + 5) ** 3;
    clue = 'cube numbers';
  }
  if (type === 'triangular') {
    const start = rand(5, 10);
    const tri = (n) => (n * (n + 1)) / 2;
    seq = Array.from({ length: 5 }, (_, i) => tri(start + i));
    answer = tri(start + 5);
    clue = 'triangular numbers';
  }
  if (type === 'alternating') {
    const start = rand(30, 90);
    const plus = rand(9, 21);
    const minus = rand(3, 8);
    seq = [start];
    for (let i = 1; i < 6; i += 1) seq.push(i % 2 ? seq.at(-1) + plus : seq.at(-1) - minus);
    answer = seq.pop();
    clue = `alternate +${plus}, -${minus}`;
  }
  if (type === 'multiplyAdd') {
    const start = rand(2, 8);
    const factor = rand(2, 4);
    const add = rand(3, 9);
    seq = [start];
    while (seq.length < 6) seq.push(seq.at(-1) * factor + add);
    answer = seq.pop();
    clue = `multiply by ${factor}, then add ${add}`;
  }
  els.sectionContent.innerHTML = `
    ${sectionHeader('Pattern Detective', 'Find the hidden rule and choose what comes next.')}
    <p class="challenge-note">Genius+ rule: patterns can be squares, cubes, triangular numbers, alternating rules, or multiply-then-add.</p>
    <div class="result-box"><strong>${seq.join('  ')}  ?</strong><span>Clue: ${clue}</span></div>
    <div class="choice-grid">
      ${shuffle([answer, answer + 1, Math.max(1, answer - rand(5, 17)), answer + rand(6, 25), Math.max(1, Math.round(answer / 2))]).map((number) => choice(number, number === answer)).join('')}
    </div>
    <p class="feedback">Find the rule before picking the answer.</p>
  `;
  speak('Pattern Detective. Find the hidden rule and choose what comes next.', true);
}

function renderQrStation() {
  els.sectionContent.innerHTML = `
    ${sectionHeader('QR Scan Station', 'Scan this code with a phone, tablet, or Amazon Fire tablet to open the number lab.')}
    <div class="qr-station">
      <img src="${qrUrl}" alt="QR code for ${pageUrl}" />
      <a class="page-link" href="${pageUrl}">${pageUrl}</a>
    </div>
    <p class="feedback">Internet is needed the first time. After it opens once, the game files are cached so the activities can work offline.</p>
  `;
  speak('QR Scan Station. Scan this code with a phone, tablet, or Amazon Fire tablet.', true);
}

function choice(label, correct) {
  return `<button type="button" data-choice="${correct ? 'yes' : 'no'}">${label}</button>`;
}

function handleActivityClick(event) {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.say) speak(button.dataset.say, true);

  if (button.dataset.calc) {
    const key = button.dataset.calc;
    if (/^[0-9.]$/.test(key)) calcNumber(key);
    else if (['+', '-', '*', '/', '**'].includes(key)) calcOperator(key);
    else if (key === '=') calcEquals();
    else calcSpecial(key);
  }

  if (button.dataset.prime) {
    const number = Number(button.dataset.prime);
    if (state.prime.selected.has(number)) state.prime.selected.delete(number);
    else state.prime.selected.add(number);
    button.classList.toggle('selected');
    speak(number);
  }

  if (button.hasAttribute('data-check-primes')) {
    const selected = state.prime.numbers.filter((number) => state.prime.selected.has(number));
    const correct = state.prime.numbers.filter(isPrime);
    const success = selected.length === correct.length && selected.every((number) => isPrime(number));
    if (success) {
      const earned = 3 + speedBonus();
      addStar(earned);
      setFeedback(`Perfect prime hunt. ${earned} stars earned.`, true);
      speak(`Perfect prime hunt. ${earned} stars earned.`, true);
    } else {
      setFeedback('Close. Check which numbers only have two factors.');
      speak('Close. Check which numbers only have two factors.', true);
    }
  }

  if (button.dataset.choice) {
    if (button.dataset.choice === 'yes') {
      const earned = 2 + speedBonus();
      addStar(earned);
      setFeedback(`Correct. ${earned} stars earned.`, true);
      speak(`Correct. ${earned} stars earned.`, true);
    } else {
      setFeedback('Not that one. Try the strategy again.');
      speak('Try again.', true);
    }
  }

  if (button.hasAttribute('data-new-base')) renderBaseChallenge();

  if (button.dataset.answer) {
    const input = document.getElementById(button.dataset.input);
    const correct = String(button.dataset.answer) === String(input.value).trim();
    if (correct) {
      const earned = 2 + speedBonus();
      addStar(earned);
      setFeedback(`Correct. ${earned} stars earned.`, true);
      speak(`Correct. ${earned} stars earned.`, true);
    } else {
      setFeedback(`Not yet. The answer is not ${input.value || 'blank'}.`);
      speak('Not yet. Try again.', true);
    }
  }

  if (button.hasAttribute('data-check-magic')) {
    const values = $$('[data-magic]').map((input) => Number(input.value));
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    const allNumbers = values.every((value) => Number.isInteger(value) && value >= 1 && value <= 9);
    const allUnique = new Set(values).size === 9;
    const allFifteen = lines.every((line) => line.reduce((sum, index) => sum + values[index], 0) === 15);
    if (allNumbers && allUnique && allFifteen) {
      const earned = 4 + speedBonus();
      addStar(earned);
      setFeedback(`Magic square solved. ${earned} stars earned.`, true);
      speak(`Magic square solved. ${earned} stars earned.`, true);
    } else {
      setFeedback('Not magic yet. Use 1 through 9 once, and every row, column, and diagonal must equal fifteen.');
      speak('Not magic yet. Use one through nine once. Every line must equal fifteen.', true);
    }
  }
}

function bindMenu() {
  $$('.menu-btn').forEach((button) => {
    button.addEventListener('click', () => openSection(button.dataset.section));
  });
  els.backBtn.addEventListener('click', goBack);
  els.sectionContent.addEventListener('click', handleActivityClick);
  els.resetStars.addEventListener('click', () => setStars(0));
  els.voiceIndicator.addEventListener('click', toggleVoice);
  els.voiceToggleBtn.addEventListener('click', toggleVoice);
}

function setupEffects() {
  els.qrMini.src = qrUrl;
  resizeCanvas();
  requestAnimationFrame(drawNumbers);
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('pointermove', (event) => {
    sky.pointer.x = event.clientX;
    sky.pointer.y = event.clientY;
    if (Math.random() > 0.58) cursorPop(event.clientX, event.clientY);
  });
}

function resizeCanvas() {
  const scale = window.devicePixelRatio || 1;
  els.canvas.width = Math.floor(window.innerWidth * scale);
  els.canvas.height = Math.floor(window.innerHeight * scale);
  els.canvas.style.width = `${window.innerWidth}px`;
  els.canvas.style.height = `${window.innerHeight}px`;
  sky.ctx = els.canvas.getContext('2d');
  sky.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  sky.numbers = Array.from({ length: 150 }, () => ({
    value: rand(0, 999),
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.9,
    vy: 0.2 + Math.random() * 1.1,
    size: 16 + Math.random() * 36,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawNumbers() {
  const ctx = sky.ctx;
  if (!ctx) return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  sky.numbers.forEach((item) => {
    item.x += item.vx + (sky.pointer.x - item.x) * 0.0011;
    item.y += item.vy + (sky.pointer.y - item.y) * 0.00075;
    if (item.y > window.innerHeight + 70) {
      item.y = -70;
      item.x = Math.random() * window.innerWidth;
    }
    if (item.x < -80) item.x = window.innerWidth + 80;
    if (item.x > window.innerWidth + 80) item.x = -80;

    const alpha = 0.18 + Math.abs(Math.sin(performance.now() / 390 + item.phase)) * 0.68;
    ctx.font = `1000 ${item.size}px Nunito, sans-serif`;
    ctx.fillStyle = `rgba(7, 90, 158, ${alpha})`;
    ctx.shadowColor = 'rgba(255, 91, 189, .7)';
    ctx.shadowBlur = 18;
    ctx.fillText(item.value, item.x, item.y);
  });
  requestAnimationFrame(drawNumbers);
}

function cursorPop(x, y) {
  const pop = document.createElement('span');
  pop.className = 'cursor-pop';
  pop.textContent = rand(0, 99);
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  pop.style.setProperty('--dx', `${rand(-62, 62)}px`);
  els.cursorTrail.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove(), { once: true });
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    if (els.sectionView.classList.contains('hidden')) return;
    if (!$('#calcDisplay')) return;
    const mapped = {
      Enter: '=',
      Backspace: 'back',
      Escape: 'clear',
      x: '*',
      X: '*',
    }[event.key] || event.key;
    if (/^[0-9+\-*/.=]$/.test(mapped) || ['back', 'clear'].includes(mapped)) {
      event.preventDefault();
      if (/^[0-9.]$/.test(mapped)) calcNumber(mapped);
      else if (['+', '-', '*', '/'].includes(mapped)) calcOperator(mapped);
      else if (mapped === '=') calcEquals();
      else calcSpecial(mapped);
    }
  });
}

function init() {
  setStars(state.stars);
  updateVoiceUi();
  bindMenu();
  bindKeyboard();
  setupEffects();
  if (state.voiceOn) setTimeout(() => speak("Welcome to Jaxon's Number Lab. Pick a number challenge.", true), 800);
}

init();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
