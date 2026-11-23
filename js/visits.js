/* =========================================================
   POLY — уникальные посетители
   Счётчик хранится на сервере в data/visits.json
   ========================================================= */

(function () {
  'use strict';

  const counters = Array.prototype.slice.call(document.querySelectorAll('[data-visit-counter]'));
  if (!counters.length) return;

  const STORAGE_KEY = 'poly-visitor-id-v1';

  function makeId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (err) {
      /* fall through */
    }

    const bytes = new Uint8Array(16);
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
    } catch (err) {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }

    return Array.prototype.map.call(bytes, function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function getVisitorId() {
    try {
      let id = window.localStorage.getItem(STORAGE_KEY);
      if (!id || !/^[a-z0-9-]{8,64}$/i.test(id)) {
        id = makeId();
        window.localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch (err) {
      return makeId();
    }
  }

  function plural(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) return 'посетитель';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'посетителя';
    return 'посетителей';
  }

  async function ping() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      return;
    }

    const host = location.hostname;
    const isLocal = host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);

    if (!isLocal) {
      return;
    }

    const response = await fetch('/api/visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ id: getVisitorId() }),
      cache: 'no-store'
    });

    if (!response.ok) throw new Error('visit-failed');

    const data = await response.json();
    if (!data || typeof data.count !== 'number') throw new Error('bad-count');

    const formatted = data.count.toLocaleString('ru-RU');

    document.querySelectorAll('[data-visit-count]').forEach(function (el) {
      el.textContent = formatted;
    });

    document.querySelectorAll('[data-visit-label]').forEach(function (el) {
      el.textContent = plural(data.count);
    });

    counters.forEach(function (el) {
      el.hidden = false;
    });
  }

  ping().catch(function () {
    counters.forEach(function (el) {
      el.hidden = true;
    });
  });
})();
