/**
 * Celebration — lightweight positive reinforcement on document generation.
 * Shows a brief toast with the document type and a subtle confetti burst.
 * Respects prefers-reduced-motion. Self-initialises on import.
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('bik:document_generated', (e) => {
  showToast();
  if (!REDUCED_MOTION) confettiBurst();
});

function showToast() {
  const existing = document.getElementById('bik-celebration-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'bik-celebration-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `<span aria-hidden="true">✓</span> Document ready`;

  injectToastStyles();
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('visible'));
  });

  // Auto-dismiss after 2.5s
  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 2500);
}

function confettiBurst() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none; z-index: 9999;
  `;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const COLOURS = ['#D85A30', '#252320', '#f5a623', '#4caf50', '#2196f3', '#e91e63'];
  const particles = Array.from({ length: 60 }, () => ({
    x: canvas.width * (0.3 + Math.random() * 0.4),
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 8,
    vy: -(Math.random() * 6 + 3),
    size: Math.random() * 7 + 3,
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.3,
    alpha: 1,
  }));

  const gravity = 0.25;
  let frame;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.alpha -= 0.012;
      if (p.alpha <= 0) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (alive) {
      frame = requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }

  frame = requestAnimationFrame(draw);

  // Safety cleanup after 4s
  setTimeout(() => {
    cancelAnimationFrame(frame);
    canvas.remove();
  }, 4000);
}

let _toastStylesInjected = false;
function injectToastStyles() {
  if (_toastStylesInjected) return;
  _toastStylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    #bik-celebration-toast {
      position: fixed;
      bottom: 72px;
      left: 50%;
      transform: translateX(-50%) translateY(16px);
      background: #252320;
      color: #fff;
      padding: 10px 20px;
      border-radius: 24px;
      font-size: 0.85rem;
      font-weight: 600;
      font-family: inherit;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      opacity: 0;
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: none;
      z-index: 9998;
      white-space: nowrap;
    }
    #bik-celebration-toast span {
      color: #4caf50;
      margin-right: 6px;
    }
    #bik-celebration-toast.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;
  document.head.appendChild(style);
}
