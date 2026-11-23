/* =========================================================
   POLY — локальный статический сервер
   Запуск: node server.js [порт] [--no-open]
   Автор: Arseniy Socolov
   ========================================================= */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const ROOT = path.resolve(__dirname);
const START_PORT = Number.parseInt(process.env.PORT || process.argv[2], 10) || 8080;
const MAX_PORT = START_PORT + 10;
const OPEN_BROWSER = !process.argv.includes('--no-open') && process.env.NO_OPEN !== '1';
let activePort = START_PORT;

const DATA_DIR = path.join(__dirname, 'data');
const VISITS_FILE = path.join(DATA_DIR, 'visits.json');
const visits = loadVisits();

function loadVisits() {
  try {
    const raw = fs.readFileSync(VISITS_FILE, 'utf8');
    const data = JSON.parse(raw);
    const stored = Array.isArray(data.visitors) ? data.visitors : [];
    const valid = stored.filter(function (id) {
      return typeof id === 'string' && /^[a-z0-9-]{8,64}$/i.test(id);
    });
    const unique = Array.from(new Set(valid));
    const storedCount = Number.isFinite(Number(data.count)) ? Math.trunc(Number(data.count)) : 0;

    return {
      count: Math.max(storedCount, unique.length),
      visitors: new Set(unique)
    };
  } catch (err) {
    return { count: 0, visitors: new Set() };
  }
}

function saveVisits() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    const payload = JSON.stringify({
      count: visits.count,
      visitors: Array.from(visits.visitors),
      updatedAt: new Date().toISOString()
    }, null, 2);
    const temporary = VISITS_FILE + '.tmp';

    fs.writeFileSync(temporary, payload, 'utf8');
    fs.renameSync(temporary, VISITS_FILE);
  } catch (err) {
    console.error('  Не удалось сохранить счётчик посещений: ' + err.message);
  }
}

function recordVisit(id) {
  if (typeof id !== 'string' || !/^[a-z0-9-]{8,64}$/i.test(id)) {
    return { error: 'bad-id' };
  }

  const isNew = !visits.visitors.has(id);

  if (isNew) {
    visits.visitors.add(id);
    visits.count += 1;
    saveVisits();
  }

  return { count: visits.count, isNew: isNew };
}

function readJsonBody(req, callback) {
  let body = '';
  let finished = false;
  let tooLarge = false;

  req.setEncoding('utf8');

  req.on('data', function (chunk) {
    if (finished || tooLarge) return;
    body += chunk;
    if (body.length > 4096) {
      tooLarge = true;
      finished = true;
      callback(new Error('too-large'));
    }
  });

  req.on('end', function () {
    if (finished) return;
    finished = true;

    if (!body) {
      callback(new Error('empty'));
      return;
    }

    try {
      callback(null, JSON.parse(body));
    } catch (err) {
      callback(new Error('invalid-json'));
    }
  });

  req.on('error', function (err) {
    if (finished) return;
    finished = true;
    callback(err);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function isPrivateIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;

  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

function isVirtualInterface(name) {
  return /radmin|vpn|virtual|vmware|vbox|hyper-v|vethernet|tailscale|zerotier|wsl|docker|loopback|npcap|tap|tun|xray|happ|clash|wireguard|openvpn|shadowsocks|v2ray|sing-box/i.test(name);
}

function getLanUrls(port) {
  const interfaces = os.networkInterfaces();
  const entries = [];

  Object.keys(interfaces).forEach(function (name) {
    (interfaces[name] || []).forEach(function (info) {
      const isIPv4 = info.family === 'IPv4' || info.family === 4;
      if (!isIPv4 || info.internal) return;
      if (info.address.startsWith('127.') || info.address.startsWith('169.254.')) return;

      entries.push({
        name: name,
        address: info.address,
        private: isPrivateIPv4(info.address),
        virtual: isVirtualInterface(name)
      });
    });
  });

  let usable = entries.filter((entry) => entry.private && !entry.virtual);
  if (!usable.length) usable = entries.filter((entry) => entry.private);
  if (!usable.length) usable = entries;

  const seen = new Set();
  return usable
    .filter(function (entry) {
      if (seen.has(entry.address)) return false;
      seen.add(entry.address);
      return true;
    })
    .map(function (entry) {
      return {
        name: entry.name,
        url: 'http://' + entry.address + ':' + port
      };
    });
}

function printBanner(port) {
  const lanUrls = getLanUrls(port);
  const lines = [
    '',
    '  ============================================================',
    '   POLY — сайт запущен',
    '  ============================================================',
    '',
    '   На этом компьютере:',
    '   http://localhost:' + port,
    '',
    '   Для гостей — покажите экран с QR-кодом:',
    '   http://localhost:' + port + '/qr',
    '   (на этом экране нет IP-адреса)',
    ''
  ];

  if (lanUrls.length) {
    lines.push('   Резервные адреса в локальной сети:');
    lanUrls.forEach(function (item) {
      lines.push('   [' + item.name + ']  ' + item.url);
    });
  } else {
    lines.push('   Сетевой адрес не найден. Подключите Wi-Fi или Ethernet.');
  }

  lines.push(
    '',
    '   Интернет не нужен — сайт отдаётся с этого компьютера.',
    '   Если другие устройства не открывают сайт, разрешите',
    '   Node.js в брандмауэре Windows (allow-firewall.bat).',
    '',
    '   Остановка: Ctrl+C',
    '  ============================================================',
    ''
  );

  console.log(lines.join('\n'));
}

function openBrowser(url) {
  if (!OPEN_BROWSER) return;

  const command = process.platform === 'win32'
    ? 'start "" "' + url + '"'
    : process.platform === 'darwin'
      ? 'open "' + url + '"'
      : 'xdg-open "' + url + '"';

  exec(command, function () {
    /* открыть браузер не критично */
  });
}

function resolveRequestPath(requestUrl) {
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch (err) {
    return { error: 400 };
  }

  if (pathname.includes('\0')) return { error: 400 };
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  if (pathname === '/data' || pathname.startsWith('/data/')) return { error: 403 };

  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..')) {
    return { error: 403 };
  }

  const filePath = path.resolve(ROOT, '.' + pathname);
  const relative = path.relative(ROOT, filePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { error: 403 };
  }

  return { filePath: filePath, pathname: pathname };
}

function logRequest(req, status, route) {
  const remote = (req.socket.remoteAddress || 'local').replace(/^::ffff:/, '');
  const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
  console.log('   ' + time + '  ' + remote + '  ' + status + '  ' + route);
}

function sendText(res, status, message) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(message);
}

function sendJson(req, res, status, data, route) {
  const body = JSON.stringify(data);

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });

  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(body);
  }

  logRequest(req, status, route);
}

function serve404(req, res, route) {
  fs.readFile(path.join(ROOT, '404.html'), function (err, data) {
    if (err) {
      sendText(res, 404, '404 — файл не найден');
      logRequest(req, 404, route);
      return;
    }

    res.writeHead(404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': data.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });

    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(data);
    }

    logRequest(req, 404, route);
  });
}

function serveFile(req, res, filePath, route) {
  fs.stat(filePath, function (statError, stat) {
    if (statError || !stat.isFile()) {
      serve404(req, res, route);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    });

    if (req.method === 'HEAD') {
      res.end();
      logRequest(req, 200, route);
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', function () {
      res.destroy();
    });
    stream.pipe(res);

    res.on('finish', function () {
      logRequest(req, 200, route);
    });
  });
}

function handleRequest(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname;
  } catch (err) {
    sendText(res, 400, '400 — некорректный адрес');
    logRequest(req, 400, req.url || '/');
    return;
  }

  if (pathname === '/api/visit') {
    if (req.method !== 'POST') {
      sendJson(req, res, 405, { error: 'method-not-allowed' }, '/api/visit');
      return;
    }

    readJsonBody(req, function (err, payload) {
      if (err) {
        const status = err.message === 'too-large' ? 413 : 400;
        sendJson(req, res, status, { error: err.message }, '/api/visit');
        return;
      }

      const result = recordVisit(payload && payload.id);
      if (result.error) {
        sendJson(req, res, 400, { error: result.error }, '/api/visit');
        return;
      }

      sendJson(req, res, 200, {
        count: result.count,
        isNew: result.isNew
      }, '/api/visit');
    });
    return;
  }

  if (pathname === '/api/visits') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(req, res, 405, { error: 'method-not-allowed' }, '/api/visits');
      return;
    }

    sendJson(req, res, 200, { count: visits.count }, '/api/visits');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, '405 — метод не поддерживается');
    logRequest(req, 405, req.url || '/');
    return;
  }

  if (pathname === '/api/share') {
    const lanUrls = getLanUrls(activePort);
    const primary = lanUrls[0];

    sendJson(req, res, 200, {
      url: primary ? primary.url + '/' : null,
      network: primary ? primary.name : null
    }, '/api/share');
    return;
  }

  if (pathname === '/qr/') {
    res.writeHead(302, {
      Location: '/qr',
      'Cache-Control': 'no-store'
    });
    res.end();
    logRequest(req, 302, '/qr/');
    return;
  }

  if (pathname === '/qr') {
    serveFile(req, res, path.join(ROOT, 'qr.html'), '/qr');
    return;
  }

  const resolved = resolveRequestPath(req.url || '/');

  if (resolved.error === 400) {
    sendText(res, 400, '400 — некорректный адрес');
    logRequest(req, 400, req.url || '/');
    return;
  }

  if (resolved.error) {
    sendText(res, resolved.error === 403 ? 403 : 404, '403 — доступ запрещён');
    logRequest(req, resolved.error, req.url || '/');
    return;
  }

  fs.stat(resolved.filePath, function (err, stat) {
    if (err) {
      serve404(req, res, resolved.pathname);
      return;
    }

    if (stat.isDirectory()) {
      const indexPath = path.join(resolved.filePath, 'index.html');
      serveFile(req, res, indexPath, resolved.pathname.replace(/\/?$/, '/index.html'));
      return;
    }

    serveFile(req, res, resolved.filePath, resolved.pathname);
  });
}

function listen(port) {
  const server = http.createServer(handleRequest);

  server.on('error', function (err) {
    if (err.code === 'EADDRINUSE' && port < MAX_PORT) {
      console.log('  Порт ' + port + ' занят, пробую ' + (port + 1) + '...');
      server.close(function () {
        listen(port + 1);
      });
      return;
    }

    console.error('  Не удалось запустить сервер: ' + err.message);
    process.exit(1);
  });

  server.listen(port, '0.0.0.0', function () {
    activePort = port;
    printBanner(port);
    openBrowser('http://localhost:' + port);
  });
}

process.on('SIGINT', function () {
  console.log('\n  Сервер остановлен.\n');
  process.exit(0);
});

listen(START_PORT);
