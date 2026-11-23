/* =========================================================
   POLY — site chrome: preloader, section rail, transitions
   ========================================================= */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- preloader ---------- */

  function initPreloader() {
    const preloader = document.getElementById('preloader');
    const bar = document.getElementById('preloader-bar');
    const percent = document.getElementById('preloader-percent');
    if (!preloader || !bar) return;

    document.body.classList.add('preloading');

    let loaded = document.readyState === 'complete';
    let done = false;
    const start = performance.now();
    const minimum = reduceMotion ? 80 : 680;

    function setProgress(value) {
      const clamped = Math.max(0, Math.min(100, value));
      bar.style.transform = 'scaleX(' + (clamped / 100) + ')';
      if (percent) percent.textContent = Math.round(clamped) + '%';
    }

    function finish() {
      if (done) return;
      done = true;
      setProgress(100);
      document.body.classList.add('is-ready');
      document.body.classList.remove('preloading');
      preloader.classList.add('is-done');
      document.dispatchEvent(new CustomEvent('poly:ready'));

      window.setTimeout(function () {
        preloader.remove();
      }, 700);
    }

    function frame(now) {
      if (done) return;
      const elapsed = now - start;
      const ratio = Math.min(elapsed / minimum, 1);
      const value = loaded
        ? 58 + ratio * 42
        : Math.min(90, 8 + ratio * 82);

      setProgress(value);

      if (loaded && ratio >= 1) {
        finish();
        return;
      }

      window.requestAnimationFrame(frame);
    }

    window.addEventListener('load', function () {
      loaded = true;
    }, { once: true });

    window.setTimeout(function () {
      loaded = true;
      finish();
    }, 2400);

    window.requestAnimationFrame(frame);
  }

  if (document.getElementById('preloader')) initPreloader();

  /* ---------- section rail ---------- */

  function initRail() {
    const items = [
      ['hero', 'Главная'],
      ['about', 'Основа'],
      ['pipeline', 'Пайплайн'],
      ['demo', 'Демо'],
      ['rendering', 'Рендеринг'],
      ['tools', 'Инструменты'],
      ['future', 'Будущее'],
      ['game', 'Мини-игра']
    ];

    const sections = items
      .map(function (item) {
        return { id: item[0], label: item[1], element: document.getElementById(item[0]) };
      })
      .filter(function (item) {
        return Boolean(item.element);
      });

    if (sections.length < 4) return;

    const nav = document.createElement('nav');
    nav.className = 'section-rail';
    nav.setAttribute('aria-label', 'Разделы страницы');

    sections.forEach(function (item, index) {
      const link = document.createElement('a');
      link.href = '#' + item.id;
      link.dataset.section = item.id;

      const label = document.createElement('span');
      label.className = 'rail-label';
      label.textContent = item.label;

      const number = document.createElement('span');
      number.className = 'rail-num';
      number.textContent = String(index + 1).padStart(2, '0');

      const dot = document.createElement('span');
      dot.className = 'rail-dot';
      dot.setAttribute('aria-hidden', 'true');

      link.appendChild(label);
      link.appendChild(number);
      link.appendChild(dot);

      link.addEventListener('click', function (event) {
        if (!reduceMotion) return;
        event.preventDefault();
        item.element.scrollIntoView({ behavior: 'auto', block: 'start' });
      });

      nav.appendChild(link);
    });

    document.body.appendChild(nav);

    const links = Array.prototype.slice.call(nav.querySelectorAll('a'));
    let ticking = false;

    function update() {
      ticking = false;
      const mark = window.innerHeight * 0.42;
      let current = sections[0].id;

      sections.forEach(function (item) {
        if (item.element.getBoundingClientRect().top <= mark) current = item.id;
      });

      links.forEach(function (link) {
        const active = link.dataset.section === current;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    update();
  }

  initRail();

  /* ---------- page transition veil ---------- */

  function initTransitions() {
    if (reduceMotion) return;

    const veil = document.createElement('div');
    veil.className = 'page-veil';
    veil.setAttribute('aria-hidden', 'true');
    veil.innerHTML = '<div class="veil-lockup">' +
      '<span class="veil-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 21 7.6v8.8L12 21.2 3 16.4V7.6l9-4.8Z"/><path d="m3 7.6 9 4.9 9-4.9M12 12.5v8.7"/></svg></span>' +
      '<span class="veil-name">POLY<span>.</span></span>' +
      '<span class="veil-line"></span>' +
      '</div>';
    document.body.appendChild(veil);

    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest('a[href]');
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      const href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;

      let url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (err) {
        return;
      }

      if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'file:') return;
      if (url.href === window.location.href) return;
      if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (url.origin !== window.location.origin && window.location.protocol !== 'file:') return;

      event.preventDefault();
      veil.classList.add('is-active');

      window.setTimeout(function () {
        window.location.href = url.href;
      }, 300);
    });

    window.addEventListener('pageshow', function () {
      veil.classList.remove('is-active');
    });
  }

  initTransitions();

  /* ---------- magnetic buttons ---------- */

  function initMagnetic() {
    if (!finePointer || reduceMotion) return;

    const buttons = document.querySelectorAll('.btn-primary, .nav-cta, .qr-open');
    Array.prototype.forEach.call(buttons, function (button) {
      button.classList.add('magnetic');

      button.addEventListener('pointermove', function (event) {
        const rect = button.getBoundingClientRect();
        const dx = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
        const dy = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
        button.style.translate = (dx * 7).toFixed(2) + 'px ' + (dy * 5).toFixed(2) + 'px';
      });

      function reset() {
        button.style.translate = '0px 0px';
      }

      button.addEventListener('pointerleave', reset);
      button.addEventListener('pointercancel', reset);
      button.addEventListener('blur', reset);
    });
  }

  initMagnetic();
})();
