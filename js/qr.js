/* =========================================================
   POLY — экран с QR-кодом
   Локальный сервер: QR ведёт на адрес в Wi-Fi.
   GitHub Pages / обычный хостинг: QR ведёт на публичный сайт.
   ========================================================= */

(function () {
  'use strict';

  const frame = document.getElementById('qr-frame');
  const fullscreenButton = document.getElementById('qr-fullscreen');
  if (!frame) return;

  function isLocalHost() {
    const host = window.location.hostname;
    return host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  }

  function publicSiteUrl() {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';

    let path = url.pathname;

    if (path.endsWith('/qr.html')) {
      path = path.slice(0, -7);
    } else if (path.endsWith('/qr')) {
      path = path.slice(0, -2);
    }

    if (!path.endsWith('/')) path += '/';
    url.pathname = path;

    return url.href;
  }

  function setPublicCopy() {
    const badge = document.getElementById('qr-badge-label');
    const lead = document.getElementById('qr-lead');
    const foot = document.getElementById('qr-foot');

    if (badge) badge.textContent = 'Онлайн-версия';
    if (lead) lead.textContent = 'Откройте сайт на телефоне за пару секунд. QR-код ведёт на опубликованную версию сайта.';
    if (foot) foot.textContent = 'Если камера не срабатывает, откройте сайт по ссылке на компьютере и передайте адрес вручную.';
  }

  function showError(message) {
    frame.innerHTML = '<div class="qr-error">' + message + '</div>';
    frame.setAttribute('aria-label', 'QR-код недоступен');
  }

  function renderQr(url) {
    if (!window.qrcode) {
      showError('Не удалось загрузить генератор QR. Проверьте файл vendor/qrcode.js.');
      return;
    }

    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();

      const svg = qr
        .createSvgTag({ cellSize: 8, margin: 4, scalable: true })
        .replace(/fill="black"/g, 'fill="currentColor"');

      frame.innerHTML = svg;
      frame.setAttribute('aria-label', 'QR-код для открытия сайта на телефоне');
    } catch (err) {
      showError('Не удалось построить QR-код. Обновите страницу.');
    }
  }

  async function getShareUrl() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      throw new Error('offline');
    }

    if (!isLocalHost()) {
      setPublicCopy();
      return publicSiteUrl();
    }

    const response = await fetch('/api/share', {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) throw new Error('server');

    const data = await response.json();
    if (!data || typeof data.url !== 'string' || !data.url) {
      throw new Error('no-lan');
    }

    return data.url;
  }

  getShareUrl()
    .then(renderQr)
    .catch(function (err) {
      if (err && err.message === 'offline') {
        showError('QR работает через <b>start-server.bat</b>: запустите его и откройте <b>http://localhost:8080/qr</b>.');
      } else if (err && err.message === 'no-lan') {
        showError('Не удалось найти сетевой адрес. Подключите Wi-Fi или Ethernet и перезапустите сервер.');
      } else {
        showError('Сервер не отвечает. Перезапустите <b>start-server.bat</b>.');
      }
    });

  if (fullscreenButton && document.fullscreenEnabled) {
    fullscreenButton.hidden = false;

    fullscreenButton.addEventListener('click', function () {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function () {});
      } else {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    });

    document.addEventListener('fullscreenchange', function () {
      fullscreenButton.textContent = document.fullscreenElement ? 'Выйти' : 'На весь экран';
    });
  }
})();
