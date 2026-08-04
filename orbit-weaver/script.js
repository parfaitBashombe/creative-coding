const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const artboard = document.querySelector('.artboard');
const densityInput = document.querySelector('#density');
const energyInput = document.querySelector('#energy');
const densityValue = document.querySelector('#density-value');
const energyValue = document.querySelector('#energy-value');
const pauseButton = document.querySelector('#pause');
const randomizeButton = document.querySelector('#randomize');
const exportButton = document.querySelector('#export');
const statusText = document.querySelector('#status-text');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const palettes = {
  ember: { accent: '#dd6e46', rgb: [221, 110, 70], glow: [246, 172, 120] },
  tide: { accent: '#6bb7c7', rgb: [107, 183, 199], glow: [170, 222, 231] },
  moss: { accent: '#a6bf68', rgb: [166, 191, 104], glow: [218, 230, 164] },
};

let currentPalette = palettes.ember;
let particles = [];
let paused = reduceMotion;
let pointer = { x: -9999, y: -9999, active: false };
let dimensions = { width: 0, height: 0, dpr: 1 };

class Particle {
  constructor() { this.reset(true); }
  reset(initial = false) {
    const { width, height } = dimensions;
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 2.8 + 1.6;
    this.phase = Math.random() * Math.PI * 2;
    if (!initial) this.alpha = 0;
    else this.alpha = 0.4 + Math.random() * 0.55;
  }
  update(time) {
    const energy = Number(energyInput.value) / 42;
    this.vx += Math.cos(time * 0.00045 + this.phase) * 0.0025 * energy;
    this.vy += Math.sin(time * 0.00035 + this.phase) * 0.0025 * energy;
    if (pointer.active) {
      const dx = this.x - pointer.x;
      const dy = this.y - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 180 && distance > 0) {
        const force = (1 - distance / 180) * 0.075 * energy;
        this.vx += (dx / distance) * force;
        this.vy += (dy / distance) * force;
      }
    }
    this.vx *= 0.992;
    this.vy *= 0.992;
    this.x += this.vx * energy;
    this.y += this.vy * energy;
    if (this.x < -40) this.x = dimensions.width + 40;
    if (this.x > dimensions.width + 40) this.x = -40;
    if (this.y < -40) this.y = dimensions.height + 40;
    if (this.y > dimensions.height + 40) this.y = -40;
    this.alpha = Math.min(0.95, this.alpha + 0.012);
  }
  draw() {
    context.beginPath();
    context.fillStyle = `rgba(${currentPalette.rgb.join(',')}, ${this.alpha})`;
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    context.fill();
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

function drawConnections() {
  const distanceLimit = 158;
  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const a = particles[i];
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.hypot(dx, dy);
      if (distance < distanceLimit) {
        const opacity = (1 - distance / distanceLimit) * 0.42;
        context.beginPath();
        context.strokeStyle = `rgba(${currentPalette.glow.join(',')}, ${opacity})`;
        context.lineWidth = 1.45;
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
    }
  }
}

function frame(time) {
  context.clearRect(0, 0, dimensions.width, dimensions.height);
  if (!paused) particles.forEach((particle) => particle.update(time));
  drawConnections();
  particles.forEach((particle) => particle.draw());
  requestAnimationFrame(frame);
}

function updateRange(input, output) {
  output.value = input.value;
  input.style.setProperty('--value', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
}

function setPaused(next) {
  paused = next;
  pauseButton.textContent = paused ? 'Resume field' : 'Pause field';
  pauseButton.setAttribute('aria-pressed', String(paused));
  statusText.textContent = paused ? 'Field paused' : 'Field active';
}

function recompose() {
  particles.forEach((particle) => particle.reset());
  statusText.textContent = 'New composition';
  window.setTimeout(() => { statusText.textContent = paused ? 'Field paused' : 'Field active'; }, 1200);
}

artboard.addEventListener('pointermove', (event) => {
  const bounds = artboard.getBoundingClientRect();
  pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top, active: true };
});
artboard.addEventListener('pointerleave', () => { pointer.active = false; });

densityInput.addEventListener('input', () => { updateRange(densityInput, densityValue); populate(); });
energyInput.addEventListener('input', () => updateRange(energyInput, energyValue));
pauseButton.addEventListener('click', () => setPaused(!paused));
randomizeButton.addEventListener('click', recompose);
exportButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'orbit-weaver.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

document.querySelectorAll('.swatch').forEach((button) => {
  button.addEventListener('click', () => {
    currentPalette = palettes[button.dataset.palette];
    document.documentElement.style.setProperty('--accent', currentPalette.accent);
    document.documentElement.style.setProperty('--accent-rgb', currentPalette.rgb.join(', '));
    document.querySelectorAll('.swatch').forEach((swatch) => swatch.classList.toggle('active', swatch === button));
  });
});

new ResizeObserver(() => { resize(); }).observe(artboard);
updateRange(densityInput, densityValue);
updateRange(energyInput, energyValue);
resize();
populate();
setPaused(paused);
requestAnimationFrame(frame);
