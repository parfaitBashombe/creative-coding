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
// Named after print processes; kept to 2–3 colours so they feel deliberate.
const palettes = {
  riso:   { accent: '#e8c41a', colors: [[232, 196, 26], [218, 50, 36]] },
  offset: { accent: '#9b7ec8', colors: [[198, 175, 120], [108, 88, 192], [188, 80, 52]] },
  litho:  { accent: '#8bb4d4', colors: [[135, 178, 212], [212, 172, 96]] },
};

let currentPalette = palettes.riso;
let particles = [];
let paused = reduceMotion;
let pointer = { x: -9999, y: -9999, active: false };
let dimensions = { width: 0, height: 0, dpr: 1 };
let zOffset = 0;

const SCALE = 0.0022;

function noiseAngle(x, y) {
  // Two offset noise samples give curl-like vortices instead of plain drift.
  const primary   = noise(x * SCALE,       y * SCALE       + zOffset);
  const secondary = noise(x * SCALE * 2.1, y * SCALE * 2.1 + zOffset * 1.3) * 0.38;
  return (primary + secondary) * Math.PI * 4;
}

// --- Particle ---
class Particle {
  constructor() { this.reset(true); }

  reset(initial = false) {
    this.x = Math.random() * dimensions.width;
    this.y = Math.random() * dimensions.height;
    this.prevX = this.x;
    this.prevY = this.y;
    this.speed = 0.7 + Math.random() * 1.0;
    // Mix hairlines with regular strokes so the field looks hand-drawn.
    this.lineWidth = Math.random() < 0.28 ? 0.35 + Math.random() * 0.25 : 0.85 + Math.random() * 0.75;
    this.colorIndex = Math.floor(Math.random() * currentPalette.colors.length);
    this.life = 0;
    this.maxLife = 180 + Math.random() * 260;
    this.alpha = initial ? 0.25 + Math.random() * 0.45 : 0;
  }

  update(speedMult) {
    this.prevX = this.x;
    this.prevY = this.y;
    // Small per-frame jitter prevents paths from looking algorithmically smooth.
    let angle = noiseAngle(this.x, this.y) + (Math.random() - 0.5) * 0.07;

    if (pointer.active) {
      const dx = this.x - pointer.x;
      const dy = this.y - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 160 && dist > 0) {
        const pull = (1 - dist / 160) * 2.2;
        angle += pull * Math.atan2(dy, dx) * 0.45;
      }
    }

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
    context.lineWidth = this.lineWidth;
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

  context.fillStyle = reduceMotion ? '#0a0908' : 'rgba(10, 9, 8, 0.032)';
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
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(paused));
  statusText.textContent = paused ? 'paused' : 'running';
}

function reseed() {
  seedNoise();
  particles.forEach((p) => p.reset());
  context.fillStyle = '#0a0908';
  context.fillRect(0, 0, dimensions.width, dimensions.height);
  statusText.textContent = 'reseeded';
  window.setTimeout(() => { statusText.textContent = paused ? 'paused' : 'running'; }, 1200);
}

artboard.addEventListener('pointermove', (event) => {
  const bounds = artboard.getBoundingClientRect();
  pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top, active: true };
});
artboard.addEventListener('pointerleave', () => { pointer.active = false; });

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
document.documentElement.style.setProperty('--accent', currentPalette.accent);
document.documentElement.style.setProperty('--accent-rgb', currentPalette.colors[0].join(', '));
seedNoise();
resize();
populate();
setPaused(paused);
requestAnimationFrame(frame);
