// --- Perlin noise (2D) ---
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function grad(hash, x, y) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

const perm = new Uint8Array(512);

function seedNoise() {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}

function noise(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x);
  const v = fade(y);
  const a = perm[X] + Y;
  const b = perm[X + 1] + Y;
  return lerp(
    lerp(grad(perm[a],     x,     y),     grad(perm[b],     x - 1, y),     u),
    lerp(grad(perm[a + 1], x,     y - 1), grad(perm[b + 1], x - 1, y - 1), u),
    v
  );
}

// --- DOM ---
const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const artboard = document.querySelector('.artboard');
const densityInput = document.querySelector('#density');
const speedInput = document.querySelector('#speed');
const densityValue = document.querySelector('#density-value');
const speedValue = document.querySelector('#speed-value');
const pauseButton = document.querySelector('#pause');
const reseedButton = document.querySelector('#reseed');
const exportButton = document.querySelector('#export');
const statusText = document.querySelector('#status-text');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Palettes ---
const palettes = {
  ember: { accent: '#ff5b41', colors: [[255, 91, 65], [255, 190, 48], [242, 55, 113], [255, 116, 50]] },
  tide:  { accent: '#1ed8d3', colors: [[30, 216, 211], [65, 125, 255], [174, 67, 255], [55, 239, 157]] },
  moss:  { accent: '#b7ef30', colors: [[183, 239, 48], [255, 202, 49], [55, 218, 155], [246, 89, 75]] },
};

let currentPalette = palettes.ember;
let particles = [];
let paused = reduceMotion;
let dimensions = { width: 0, height: 0, dpr: 1 };
let zOffset = 0;

const SCALE = 0.0022;

function noiseAngle(x, y) {
  return noise(x * SCALE, y * SCALE + zOffset) * Math.PI * 4;
}

// --- Particle ---
class Particle {
  constructor() { this.reset(true); }

  reset(initial = false) {
    this.x = Math.random() * dimensions.width;
    this.y = Math.random() * dimensions.height;
    this.prevX = this.x;
    this.prevY = this.y;
    this.speed = 0.9 + Math.random() * 0.8;
    this.colorIndex = Math.floor(Math.random() * currentPalette.colors.length);
    this.life = 0;
    this.maxLife = 200 + Math.random() * 220;
    this.alpha = initial ? 0.3 + Math.random() * 0.4 : 0;
  }

  update(speedMult) {
    this.prevX = this.x;
    this.prevY = this.y;
    const angle = noiseAngle(this.x, this.y);
    this.x += Math.cos(angle) * this.speed * speedMult;
    this.y += Math.sin(angle) * this.speed * speedMult;
    this.life++;

    if (this.life < 30) this.alpha = Math.min(0.85, this.alpha + 0.028);
    if (this.life > this.maxLife - 40) this.alpha -= 0.021;

    if (
      this.alpha <= 0 ||
      this.life > this.maxLife ||
      this.x < -20 || this.x > dimensions.width + 20 ||
      this.y < -20 || this.y > dimensions.height + 20
    ) this.reset();
  }

  draw() {
    const color = currentPalette.colors[this.colorIndex];
    context.beginPath();
    context.strokeStyle = `rgba(${color.join(',')}, ${this.alpha})`;
    context.lineWidth = 1.1;
    context.moveTo(this.prevX, this.prevY);
    context.lineTo(this.x, this.y);
    context.stroke();
  }
}

function resize() {
  const bounds = artboard.getBoundingClientRect();
  dimensions.width = Math.floor(bounds.width);
  dimensions.height = Math.floor(bounds.height);
  dimensions.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = dimensions.width * dimensions.dpr;
  canvas.height = dimensions.height * dimensions.dpr;
  context.setTransform(dimensions.dpr, 0, 0, dimensions.dpr, 0, 0);
}

function populate() {
  const target = Number(densityInput.value);
  while (particles.length < target) particles.push(new Particle());
  particles.length = target;
}

function frame() {
  const speedMult = Number(speedInput.value) / 42;

  context.fillStyle = reduceMotion ? '#0c1012' : 'rgba(12, 16, 18, 0.035)';
  context.fillRect(0, 0, dimensions.width, dimensions.height);

  if (!paused) {
    particles.forEach((p) => p.update(speedMult));
    zOffset += 0.00042;
  }
  particles.forEach((p) => p.draw());

  requestAnimationFrame(frame);
}

function updateRange(input, output) {
  output.value = input.value;
  input.style.setProperty('--value', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
}

function setPaused(next) {
  paused = next;
  pauseButton.textContent = paused ? 'Resume flow' : 'Pause flow';
  pauseButton.setAttribute('aria-pressed', String(paused));
  statusText.textContent = paused ? 'Flow paused' : 'Flow active';
}

function reseed() {
  seedNoise();
  particles.forEach((p) => p.reset());
  context.fillStyle = '#0c1012';
  context.fillRect(0, 0, dimensions.width, dimensions.height);
  statusText.textContent = 'New seed';
  window.setTimeout(() => { statusText.textContent = paused ? 'Flow paused' : 'Flow active'; }, 1200);
}

// --- Events ---
densityInput.addEventListener('input', () => { updateRange(densityInput, densityValue); populate(); });
speedInput.addEventListener('input', () => updateRange(speedInput, speedValue));
pauseButton.addEventListener('click', () => setPaused(!paused));
reseedButton.addEventListener('click', reseed);
exportButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'flow-field.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

document.querySelectorAll('.swatch').forEach((button) => {
  button.addEventListener('click', () => {
    currentPalette = palettes[button.dataset.palette];
    document.documentElement.style.setProperty('--accent', currentPalette.accent);
    document.documentElement.style.setProperty('--accent-rgb', currentPalette.colors[0].join(', '));
    document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s === button));
  });
});

// --- Init ---
new ResizeObserver(() => resize()).observe(artboard);
updateRange(densityInput, densityValue);
updateRange(speedInput, speedValue);
seedNoise();
resize();
populate();
setPaused(paused);
requestAnimationFrame(frame);
