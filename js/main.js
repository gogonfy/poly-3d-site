/* =========================================================
   UI behaviour: nav, scroll progress, reveals, counters
   Author: Arseniy Socolov
   ========================================================= */

(function () {
  'use strict';

  const body = document.body;
  const docEl = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- entrance ---------- */

  let entranceStarted = false;

  function startEntrance() {
    if (entranceStarted) return;
    entranceStarted = true;

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        body.classList.add('is-loaded');
      });
    });
  }

  if (!document.getElementById('preloader')) {
    startEntrance();
  } else {
    document.addEventListener('poly:ready', startEntrance, { once: true });
    window.setTimeout(startEntrance, 5200);
    if (body.classList.contains('is-ready')) startEntrance();
  }

  /* ---------- mobile navigation ---------- */

  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  function setMenu(open, returnFocus) {
    if (!navToggle) return;
    const isOpen = body.classList.contains('nav-open');
    if (isOpen === open) return;

    body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');

    if (!open && returnFocus) {
      navToggle.focus();
    }
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      setMenu(!body.classList.contains('nav-open'));
    });

    navMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setMenu(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && body.classList.contains('nav-open')) {
        setMenu(false, true);
      }
    });

    document.addEventListener('pointerdown', function (event) {
      if (body.classList.contains('nav-open') && header && !header.contains(event.target)) {
        setMenu(false);
      }
    });

    const desktopQuery = window.matchMedia('(min-width: 981px)');
    const onDesktop = function (event) {
      if (event.matches) setMenu(false);
    };

    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener('change', onDesktop);
    } else if (desktopQuery.addListener) {
      desktopQuery.addListener(onDesktop);
    }
  }

  /* ---------- reveal on scroll ---------- */

  const revealElements = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  function reveal(element) {
    const delay = Number(element.dataset.delay || 0);
    if (delay) element.style.setProperty('--reveal-delay', delay + 'ms');
    element.classList.add('in');
  }

  if ('IntersectionObserver' in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reveal(entry.target);
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -6% 0px'
    });

    revealElements.forEach(function (element) {
      element.classList.add('will-reveal');
      revealObserver.observe(element);
    });
  }

  /* ---------- counters ---------- */

  const counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));

  function animateCounter(element) {
    const target = Number(element.dataset.count);
    if (!Number.isFinite(target)) return;

    if (reduceMotion) {
      element.textContent = target.toLocaleString('ru-RU');
      return;
    }

    const duration = 1250;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(target * eased).toLocaleString('ru-RU');

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        element.textContent = target.toLocaleString('ru-RU');
      }
    }

    window.requestAnimationFrame(tick);
  }

  counters.forEach(function (counter) {
    if (!reduceMotion) counter.textContent = '0';
  });

  if ('IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    counters.forEach(function (counter) {
      counterObserver.observe(counter);
    });
  } else {
    counters.forEach(animateCounter);
  }

  /* ---------- scroll state ---------- */

  const progressBar = document.getElementById('scroll-progress-bar');
  const toTopButton = document.getElementById('to-top');
  const heroCopy = document.getElementById('hero-copy');
  const navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));

  const navSections = navLinks.map(function (link) {
    return {
      link: link,
      section: document.querySelector(link.getAttribute('href'))
    };
  }).filter(function (item) {
    return Boolean(item.section);
  });

  let scrollTicking = false;

  function updateActiveNav() {
    const mark = window.innerHeight * 0.4;
    let currentId = null;

    for (let i = 0; i < navSections.length; i++) {
      const rect = navSections[i].section.getBoundingClientRect();
      if (rect.top <= mark && rect.bottom > mark) {
        currentId = navSections[i].section.id;
        break;
      }
    }

    navSections.forEach(function (item) {
      item.link.classList.toggle('active', item.section.id === currentId);
    });
  }

  function updateOnScroll() {
    scrollTicking = false;

    const y = window.scrollY;
    const maxScroll = docEl.scrollHeight - window.innerHeight;

    if (header) {
      header.classList.toggle('is-scrolled', y > 20);
    }

    body.classList.toggle('scene-past-hero', y > window.innerHeight * 0.62);

    if (progressBar) {
      const progress = maxScroll > 0 ? Math.min(y / maxScroll, 1) : 0;
      progressBar.style.transform = 'scaleX(' + progress + ')';
    }

    if (toTopButton) {
      toTopButton.classList.toggle('is-visible', y > window.innerHeight * 0.85);
    }

    updateActiveNav();

    if (heroCopy && !reduceMotion) {
      const fadeProgress = Math.min(y / (window.innerHeight * 1.15), 1);
      heroCopy.style.transform = 'translateY(' + Math.min(y * 0.1, 90) + 'px)';
      heroCopy.style.opacity = String(Math.max(0, 1 - fadeProgress * 0.95));
    }
  }

  function requestScrollUpdate() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateOnScroll);
  }

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate);
  updateOnScroll();

  if (toTopButton) {
    toTopButton.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    });
  }

  /* ---------- seamless marquee ---------- */

  const marqueeTrack = document.querySelector('.marquee-track');
  if (marqueeTrack) {
    marqueeTrack.innerHTML += marqueeTrack.innerHTML;
  }

  /* ---------- QR for guests (server mode) ---------- */

  const footerQr = document.getElementById('footer-qr');
  if (footerQr && (location.protocol === 'http:' || location.protocol === 'https:')) {
    footerQr.hidden = false;
  }
})();
