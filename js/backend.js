/* =========================================================
   POLY — статус сайта, онлайн, посещения и учёт покупок
   Данные хранятся в Firebase Realtime Database.
   Без настроек (js/config.js) блок показывает демо-режим.
   ========================================================= */

(function () {
  'use strict';

  const config = window.POLY_CONFIG || {};
  const fbConfig = config.firebase || {};
  const bar = document.getElementById('status-bar');

  const isWeb = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  const isConfigured = Boolean(fbConfig.databaseURL) &&
    fbConfig.databaseURL.indexOf('YOUR-PROJECT') === -1 &&
    typeof window.firebase !== 'undefined';

  const els = bar ? {
    dot: bar.querySelector('[data-status-dot]'),
    state: bar.querySelector('[data-status-state]'),
    online: bar.querySelector('[data-status-online]'),
    visits: bar.querySelector('[data-status-visits]')
  } : null;

  const STATES = {
    ok: { label: 'Сайт работает', tone: 'ok' },
    maintenance: { label: 'Технические работы', tone: 'warn' },
    down: { label: 'Сайт недоступен', tone: 'down' },
    demo: { label: 'Демо-режим', tone: 'demo' },
    offline: { label: 'Открыт с файла', tone: 'demo' }
  };

  function setState(key, note) {
    if (!els) return;
    const info = STATES[key] || STATES.demo;
    bar.dataset.tone = info.tone;
    els.state.textContent = note || info.label;
  }

  function setNumber(el, value) {
    if (!el) return;
    el.textContent = value === null ? '—' : String(value);
  }

  function renderDemo() {
    setState(isWeb ? 'demo' : 'offline');
    setNumber(els && els.online, null);
    setNumber(els && els.visits, null);
  }

  /* ---------- buy links (work without Firebase) ---------- */

  function bindBuyLinks(db) {
    const links = document.querySelectorAll('[data-buy]');
    Array.prototype.forEach.call(links, function (link) {
      link.setAttribute('href', config.buyUrl || '#courses');
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');

      link.addEventListener('click', function () {
        if (!db) return;
        db.ref('purchases').push({
          course: link.dataset.buy,
          page: window.location.pathname,
          t: firebase.database.ServerValue.TIMESTAMP
        });
      });
    });
  }

  if (!isConfigured || !isWeb) {
    renderDemo();
    bindBuyLinks(null);
    return;
  }

  /* ---------- Firebase ---------- */

  firebase.initializeApp(fbConfig);
  const db = firebase.database();

  bindBuyLinks(db);

  db.ref('status').on('value', function (snap) {
    const value = snap.val() || {};
    const key = STATES[value.state] ? value.state : 'ok';
    setState(key, value.note || null);
  });

  const visitorKey = 'poly-fb-visit-v1';
  if (!localStorage.getItem(visitorKey)) {
    db.ref('stats/visits').transaction(function (current) {
      return (current || 0) + 1;
    }, function (error, committed) {
      if (!error && committed) localStorage.setItem(visitorKey, '1');
    });
  }

  db.ref('stats/visits').on('value', function (snap) {
    setNumber(els && els.visits, snap.val() || 0);
  });

  const connectedRef = db.ref('.info/connected');
  connectedRef.on('value', function (snap) {
    if (snap.val() !== true) return;
    const presenceRef = db.ref('presence').push();
    presenceRef.onDisconnect().remove();
    presenceRef.set({
      page: window.location.pathname,
      t: firebase.database.ServerValue.TIMESTAMP
    });
  });

  db.ref('presence').on('value', function (snap) {
    setNumber(els && els.online, snap.numChildren());
  });
})();
