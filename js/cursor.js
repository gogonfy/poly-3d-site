/* =========================================================
   POLY вЂ” custom cursor for fine pointers
   Works on index, program pages and the QR screen
   ========================================================= */

(function () {
  'use strict';

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!finePointer.matches) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const style = document.createElement('style');
  style.textContent = [
    '@media (hover: hover) and (pointer: fine) {',
    '  html.cursor-ready,',
    '  html.cursor-ready body,',
    '  html.cursor-ready a,',
    '  html.cursor-ready button,',
    '  html.cursor-ready [role="button"],',
    '  html.cursor-ready canvas,',
    '  html.cursor-ready .card-hit,',
    '  html.cursor-ready .card-interactive,',
    '  html.cursor-ready .tool-card,',
    '  html.cursor-ready .range,',
    '  html.cursor-ready .seg-btn,',
    '  html.cursor-ready .switch,',
    '  html.cursor-ready .switch * { cursor: none; }',
    '  html.cursor-ready #game-canvas,',
    '  html.cursor-ready #demo-canvas,',
    '  html.cursor-ready .demo-stage,',
    '  html.cursor-ready .game-stage.is-dragging #game-canvas { cursor: none; }',
    '}',
    'html.cursor-native,',
    'html.cursor-native * { cursor: auto !important; }',
    '.cursor-dot,',
    '.cursor-ring {',
    '  position: fixed;',
    '  top: 0;',
    '  left: 0;',
    '  z-index: 2147483647;',
    '  pointer-events: none;',
    '  opacity: 0;',
    '  will-change: transform;',
    '}',
    '.cursor-dot {',
    '  width: 6px;',
    '  height: 6px;',
    '  border-radius: 50%;',
    '  background: var(--orange, #ff6a1a);',
    '  box-shadow: 0 0 0 3px rgba(255, 106, 26, 0.16), 0 0 18px rgba(15, 143, 114, 0.38);',
    '  transition: opacity 180ms ease, background-color 180ms ease, box-shadow 180ms ease;',
    '}',
    '.cursor-ring {',
    '  width: 34px;',
    '  height: 34px;',
    '  border: 1.5px solid rgba(15, 143, 114, 0.68);',
    '  border-radius: 50%;',
    '  background: rgba(255, 250, 245, 0.04);',
    '  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.28), 0 0 26px rgba(15, 143, 114, 0.14);',
    '  transition: width 220ms cubic-bezier(0.23, 1, 0.32, 1), height 220ms cubic-bezier(0.23, 1, 0.32, 1), border-color 220ms ease, background-color 220ms ease, opacity 180ms ease;',
    '}',
    '.cursor-ring.is-active {',
    '  width: 52px !important;',
    '  height: 52px !important;',
    '  border-color: rgba(15, 143, 114, 0.92) !important;',
    '  background: rgba(15, 143, 114, 0.07) !important;',
    '  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.36), 0 0 34px rgba(15, 143, 114, 0.22);',
    '}',
    '.cursor-ring.is-drag {',
    '  width: 60px;',
    '  height: 60px;',
    '  border-style: dashed;',
    '  border-color: rgba(99, 203, 177, 0.92);',
    '  background: rgba(15, 143, 114, 0.06);',
    '  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.24), 0 0 32px rgba(15, 143, 114, 0.2);',
    '}',
    '.cursor-dot.is-active {',
    '  background: var(--teal, #0f8f72);',
    '  box-shadow: 0 0 0 3px rgba(15, 143, 114, 0.18), 0 0 18px rgba(255, 106, 26, 0.4);',
    '}',
    '.cursor-ring.is-visible,',
    '.cursor-dot.is-visible { opacity: 1; }',
    '.cursor-ring.is-hidden,',
    '.cursor-dot.is-hidden { opacity: 0; }',
    '@media (prefers-reduced-motion: reduce) {',
    '  .cursor-dot, .cursor-ring { transition: none; }',
    '}',
    '@media print {',
    '  .cursor-dot, .cursor-ring { display: none; }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.setAttribute('aria-hidden', 'true');

  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.setAttribute('aria-hidden', 'true');

  document.body.appendChild(dot);
  document.body.appendChild(ring);

  const interactiveSelector = 'a, button, [role="button"], .card-hit, .card-interactive, .tool-card, .range, .seg-btn, .switch';
  const dragSelector = '#game-canvas, #demo-canvas, .demo-stage';

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let ringX = pointerX;
  let ringY = pointerY;
  let hasMoved = false;
  let pressed = false;
  let nativeMode = false;
  let raf = 0;

  function setNativeMode(value) {
    if (nativeMode === value) return;
    nativeMode = value;
    document.documentElement.classList.toggle('cursor-native', value);
    ring.classList.toggle('is-hidden', value);
    dot.classList.toggle('is-hidden', value);
  }

  function updateAppearance(target) {
    if (!target) return;
    const isNative = document.body.classList.contains('dialog-open') ||
      Boolean(target.closest('textarea, select, input:not([type="range"]), [contenteditable="true"]'));
    setNativeMode(isNative);
    if (isNative) return;

    const isDrag = Boolean(target.closest(dragSelector));
    const isActive = Boolean(target.closest(interactiveSelector));

    ring.classList.toggle('is-drag', isDrag);
    ring.classList.toggle('is-active', !isDrag && isActive);
    dot.classList.toggle('is-active', isDrag || isActive);
  }

  function render() {
    if (!hasMoved) return;
    raf = 0;

    if (!reduceMotion) {
      ringX += (pointerX - ringX) * 0.18;
      ringY += (pointerY - ringY) * 0.18;
    } else {
      ringX = pointerX;
      ringY = pointerY;
    }

    const scale = pressed ? 0.82 : 1;
    dot.style.transform = 'translate3d(' + pointerX + 'px,' + pointerY + 'px,0) translate(-50%,-50%) scale(' + scale + ')';
    ring.style.transform = 'translate3d(' + ringX + 'px,' + ringY + 'px,0) translate(-50%,-50%) scale(' + scale + ')';

    raf = window.requestAnimationFrame(render);
  }

  function onMove(event) {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

    pointerX = event.clientX;
    pointerY = event.clientY;

    if (!hasMoved) {
      hasMoved = true;
      ringX = pointerX;
      ringY = pointerY;
      document.documentElement.classList.add('cursor-ready');
      dot.classList.add('is-visible');
      ring.classList.add('is-visible');
    } else if (!dot.classList.contains('is-visible')) {
      dot.classList.add('is-visible');
      ring.classList.add('is-visible');
    }

    updateAppearance(event.target);
    if (!raf) raf = window.requestAnimationFrame(render);
  }

  function onDown() {
    pressed = true;
  }

  function onUp() {
    pressed = false;
  }

  function onLeave() {
    dot.classList.remove('is-visible');
    ring.classList.remove('is-visible');
  }

  function onEnter() {
    if (hasMoved) {
      dot.classList.add('is-visible');
      ring.classList.add('is-visible');
    }
  }

  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave, { passive: true });
  document.addEventListener('pointerenter', onEnter, { passive: true });
  window.addEventListener('blur', onLeave);

  const observer = new MutationObserver(function () {
    const dialogOpen = document.body.classList.contains('dialog-open');
    if (dialogOpen) setNativeMode(true);
    else if (!document.querySelector('textarea:hover, select:hover, input:not([type="range"]):hover, [contenteditable="true"]:hover')) {
      setNativeMode(false);
    }
  });

  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();

