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

  Array.prototype.forEach.call(document.querySelectorAll('[data-buy]'), function (link) {
    link.setAttribute('href', config.buyUrl || '#courses');
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener');
  });

  if (!bar) return;

  const STATES = {
    ok: { label: 'Сайт работает', tone: 'ok' },
    maintenance: { label: 'Технические работы', tone: 'warn' },
    down: { label: 'Сайт недоступен', tone: 'down' },
    demo: { label: 'Демо-режим', tone: 'demo' },
    offline: { label: 'Открыт с файла', tone: 'demo' }
  };

  const stateEl = bar.querySelector('[data-status-state]');
  const onlineEl = bar.querySelector('[data-status-online]');
  const visitsEl = bar.querySelector('[data-status-visits]');

  function setState(key, note) {
    const info = STATES[key] || STATES.demo;
    bar.dataset.tone = info.tone;
    stateEl.textContent = note || info.label;
  }

  function setNumber(el, value) {
    el.textContent = value === null || value === undefined ? '—' : String(value);
  }

  if (!isConfigured || !isWeb) {
    setState(isWeb ? 'demo' : 'offline');
    setNumber(onlineEl, null);
    setNumber(visitsEl, null);
    return;
  }

  firebase.initializeApp(fbConfig);
  const db = firebase.database();

  Array.prototype.forEach.call(document.querySelectorAll('[data-buy]'), function (link) {
    link.addEventListener('click', function () {
      db.ref('purchases').push({
        course: link.dataset.buy,
        page: window.location.pathname,
        t: firebase.database.ServerValue.TIMESTAMP
      });
    });
  });

  db.ref('status').on('value', function (snap) {
    const value = snap.val() || {};
    const key = STATES[value.state] ? value.state : (STATES[config.status] ? config.status : 'ok');
    setState(key, value.note || config.statusNote || null);
  }, function () {
    setState(config.status || 'ok', config.statusNote || null);
  });

  const visitorKey = 'poly-fb-visit-v1';
  if (localStorage.getItem(visitorKey) !== '1') {
    db.ref('stats/visits').transaction(function (current) {
      return (current || 0) + 1;
    }, function (error, committed) {
      if (!error && committed) localStorage.setItem(visitorKey, '1');
    });
  }

  db.ref('stats/visits').on('value', function (snap) {
    setNumber(visitsEl, snap.val() || 0);
  }, function () {
    setNumber(visitsEl, null);
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
    setNumber(onlineEl, snap.numChildren());
  }, function () {
    setNumber(onlineEl, null);
  });
})();
