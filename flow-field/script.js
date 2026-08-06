const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const artboard = document.querySelector('.artboard');

let dimensions = { width: 0, height: 0, dpr: 1 };

function resize() {
  const bounds = artboard.getBoundingClientRect();
  dimensions.width = Math.floor(bounds.width);
  dimensions.height = Math.floor(bounds.height);
  dimensions.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = dimensions.width * dimensions.dpr;
  canvas.height = dimensions.height * dimensions.dpr;
  context.setTransform(dimensions.dpr, 0, 0, dimensions.dpr, 0, 0);
  context.fillStyle = '#0c1012';
  context.fillRect(0, 0, dimensions.width, dimensions.height);
}

new ResizeObserver(() => resize()).observe(artboard);
resize();
