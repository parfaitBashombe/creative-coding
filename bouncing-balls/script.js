const canvas = document.getElementById("canvas1");
const ctx = canvas.getContext("2d");
const countControl = document.getElementById("countControl");
const speedControl = document.getElementById("speedControl");
const countOutput = document.getElementById("countOutput");
const speedOutput = document.getElementById("speedOutput");
const resetButton = document.getElementById("resetButton");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const pointer = { x: 0, y: 0, active: false };

class Ball {
  constructor(effect) {
    this.effect = effect;
    this.radius = 7 + Math.random() * 17;
    this.x = this.radius + Math.random() * (effect.width - this.radius * 2);
    this.y = this.radius + Math.random() * (effect.height - this.radius * 2);
    this.vx = (Math.random() - 0.5) * 2.8;
    this.vy = (Math.random() - 0.5) * 2.8;
    this.color = effect.palette[Math.floor(Math.random() * effect.palette.length)];
  }

  draw(context) {
    context.beginPath();
    context.fillStyle = this.color;
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    context.fill();
  }

  update(speed) {
    this.x += this.vx * speed;
    this.y += this.vy * speed;
    this.keepInsideCanvas();
    this.avoidPointer();
  }

  keepInsideCanvas() {
    if (this.x + this.radius >= this.effect.width || this.x - this.radius <= 0) {
      this.vx *= -1;
      this.x = Math.max(this.radius, Math.min(this.effect.width - this.radius, this.x));
    }
    if (this.y + this.radius >= this.effect.height || this.y - this.radius <= 0) {
      this.vy *= -1;
      this.y = Math.max(this.radius, Math.min(this.effect.height - this.radius, this.y));
    }
  }

  avoidPointer() {
    if (!pointer.active) return;
    const dx = this.x - pointer.x;
    const dy = this.y - pointer.y;
    const distance = Math.hypot(dx, dy) || 0.01;
    const reach = 130;

    if (distance < reach) {
      const force = (1 - distance / reach) * 0.42;
      this.vx += (dx / distance) * force;
      this.vy += (dy / distance) * force;
    }
  }
}

class Effect {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.balls = [];
    this.palette = ["#d8a74d", "#c86455", "#81a59b", "#a984bd", "#d8d1b2"];
    this.count = Number(countControl.value);
    this.speed = Number(speedControl.value);
    this.resize();
    this.createBalls();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * ratio;
    this.canvas.height = this.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.balls.forEach((ball) => ball.keepInsideCanvas());
  }

  createBalls() {
    this.balls = Array.from({ length: this.count }, () => new Ball(this));
  }

  collideBalls() {
    for (let i = 0; i < this.balls.length; i += 1) {
      for (let j = i + 1; j < this.balls.length; j += 1) {
        const first = this.balls[i];
        const second = this.balls[j];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distance = Math.hypot(dx, dy) || 0.01;
        const minimumDistance = first.radius + second.radius;

        if (distance >= minimumDistance) continue;

        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = (minimumDistance - distance) / 2;
        first.x -= nx * overlap;
        first.y -= ny * overlap;
        second.x += nx * overlap;
        second.y += ny * overlap;

        const velocityAlongNormal = (first.vx - second.vx) * nx + (first.vy - second.vy) * ny;
        if (velocityAlongNormal <= 0) continue;
        first.vx -= velocityAlongNormal * nx;
        first.vy -= velocityAlongNormal * ny;
        second.vx += velocityAlongNormal * nx;
        second.vy += velocityAlongNormal * ny;
      }
    }
  }

  render() {
    ctx.fillStyle = reducedMotion ? "#171715" : "rgb(23 23 21 / 12%)";
    ctx.fillRect(0, 0, this.width, this.height);
    this.balls.forEach((ball) => ball.update(this.speed));
    this.collideBalls();
    this.balls.forEach((ball) => ball.draw(ctx));
  }
}

const effect = new Effect(canvas);

function animate() {
  effect.render();
  if (!reducedMotion) requestAnimationFrame(animate);
}

countControl.addEventListener("input", () => {
  effect.count = Number(countControl.value);
  countOutput.value = effect.count;
  effect.createBalls();
  if (reducedMotion) effect.render();
});

speedControl.addEventListener("input", () => {
  effect.speed = Number(speedControl.value);
  speedOutput.value = `${effect.speed.toFixed(1)}×`;
  if (reducedMotion) effect.render();
});

resetButton.addEventListener("click", () => {
  effect.createBalls();
  if (reducedMotion) effect.render();
});
window.addEventListener("resize", () => effect.resize());
canvas.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
});
canvas.addEventListener("pointerleave", () => { pointer.active = false; });

animate();
