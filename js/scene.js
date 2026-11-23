/* =========================================================
   Background 3D scene — real extruded tool logos
   Blender, Houdini, Cinema 4D, Three.js, Unity, Unreal.
   Each logo is extruded from its vector path into 3D
   geometry, lit with studio lights + reflections, and
   floats / slowly spins in space.
   ========================================================= */

(function () {
  'use strict';

  const canvas = document.getElementById('bg-canvas');
  if (!canvas || !window.THREE || !window.POLY_LOGOS) return;

  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = reduceQuery.matches;

  /* ---------- SVG path -> THREE.Shape ---------- */

  function arcToPoints(x1, y1, rx, ry, phiDeg, largeArc, sweep, x2, y2) {
    const phi = (phiDeg * Math.PI) / 180;
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (rx === 0 || ry === 0) return [{ x: x2, y: y2 }];

    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const x1p = Math.cos(phi) * dx + Math.sin(phi) * dy;
    const y1p = -Math.sin(phi) * dx + Math.cos(phi) * dy;

    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
      const s = Math.sqrt(lambda);
      rx *= s;
      ry *= s;
    }

    const sign = largeArc === sweep ? -1 : 1;
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const coef = sign * Math.sqrt(Math.max(0, num / den));

    const cxp = coef * ((rx * y1p) / ry);
    const cyp = coef * (-(ry * x1p) / rx);

    const cx = Math.cos(phi) * cxp - Math.sin(phi) * cyp + (x1 + x2) / 2;
    const cy = Math.sin(phi) * cxp + Math.cos(phi) * cyp + (y1 + y2) / 2;

    function angle(ux, uy, vx, vy) {
      const dot = ux * vx + uy * vy;
      const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
      let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
      if (ux * vy - uy * vx < 0) a = -a;
      return a;
    }

    const ux = (x1p - cxp) / rx;
    const uy = (y1p - cyp) / ry;
    const vx = (-x1p - cxp) / rx;
    const vy = (-y1p - cyp) / ry;

    let theta1 = angle(1, 0, ux, uy);
    let dtheta = angle(ux, uy, vx, vy);
    if (!sweep && dtheta > 0) dtheta -= Math.PI * 2;
    if (sweep && dtheta < 0) dtheta += Math.PI * 2;

    const segments = Math.max(8, Math.ceil(Math.abs(dtheta) / (Math.PI / 24)));
    const pts = [];
    for (let k = 1; k < segments; k++) {
      const t = theta1 + (dtheta * k) / segments;
      pts.push({
        x: cx + rx * Math.cos(t) * Math.cos(phi) - ry * Math.sin(t) * Math.sin(phi),
        y: cy + rx * Math.cos(t) * Math.sin(phi) + ry * Math.sin(t) * Math.cos(phi)
      });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  function svgToShapes(d) {
    const shapes = [];
    let shape = null;
    let i = 0;
    let cx = 0, cy = 0; // current point (SVG y-down)
    let sx = 0, sy = 0;
    let lastCubic = null;
    let lastQuad = null;

    function skipWs() {
      while (i < d.length && /[\s,]/.test(d[i])) i++;
    }
    function readNum() {
      skipWs();
      const m = d.slice(i).match(/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/);
      if (!m) return NaN;
      i += m[0].length;
      return parseFloat(m[0]);
    }
    function readFlag() {
      skipWs();
      if (d[i] === '0' || d[i] === '1') {
        const f = d[i] === '1' ? 1 : 0;
        i++;
        return f;
      }
      return 0;
    }
    function peekNum() {
      let j = i;
      while (j < d.length && /[\s,]/.test(d[j])) j++;
      return j < d.length && /[-+.0-9]/.test(d[j]);
    }

    while (i < d.length) {
      skipWs();
      if (i >= d.length) break;
      const c = d[i];
      if (!/[A-Za-z]/.test(c)) { i++; continue; }
      i++;

      const C = c.toUpperCase();
      const rel = c !== C;

      if (C === 'Z') {
        if (shape) shape.closePath();
        cx = sx; cy = sy;
        continue;
      }

      if (C === 'M') {
        let x = readNum(), y = readNum();
        if (rel) { x += cx; y += cy; }
        shape = new THREE.Shape();
        shape.moveTo(x, -y);
        shapes.push(shape);
        sx = x; sy = y; cx = x; cy = y;
        while (peekNum()) {
          x = readNum(); y = readNum();
          if (isNaN(x) || isNaN(y)) break;
          if (rel) { x += cx; y += cy; }
          shape.lineTo(x, -y); cx = x; cy = y;
        }
        continue;
      }
      if (C === 'L') {
        while (peekNum()) {
          let x = readNum(), y = readNum();
          if (isNaN(x) || isNaN(y)) break;
          if (rel) { x += cx; y += cy; }
          shape.lineTo(x, -y); cx = x; cy = y;
        }
        continue;
      }
      if (C === 'H') {
        while (peekNum()) {
          let x = readNum();
          if (isNaN(x)) break;
          if (rel) x += cx;
          shape.lineTo(x, -cy); cx = x;
        }
        continue;
      }
      if (C === 'V') {
        while (peekNum()) {
          let y = readNum();
          if (isNaN(y)) break;
          if (rel) y += cy;
          shape.lineTo(cx, -y); cy = y;
        }
        continue;
      }
      if (C === 'C') {
        while (peekNum()) {
          let x1 = readNum(), y1 = readNum(), x2 = readNum(), y2 = readNum(), x = readNum(), y = readNum();
          if (isNaN(x) || isNaN(y)) break;
          if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
          shape.bezierCurveTo(x1, -y1, x2, -y2, x, -y);
          lastCubic = { x: x2, y: y2 };
          cx = x; cy = y;
        }
        continue;
      }
      if (C === 'S') {
        while (peekNum()) {
          let x2 = readNum(), y2 = readNum(), x = readNum(), y = readNum();
          if (isNaN(x) || isNaN(y)) break;
          if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
          const x1 = lastCubic ? 2 * cx - lastCubic.x : cx;
          const y1 = lastCubic ? 2 * cy - lastCubic.y : cy;
          shape.bezierCurveTo(x1, -y1, x2, -y2, x, -y);
          lastCubic = { x: x2, y: y2 };
          cx = x; cy = y;
        }
        continue;
      }
      if (C === 'Q') {
        while (peekNum()) {
          let x1 = readNum(), y1 = readNum(), x = readNum(), y = readNum();
          if (isNaN(x) || isNaN(y)) break;
          if (rel) { x1 += cx; y1 += cy; x += cx; y += cy; }
          shape.quadraticCurveTo(x1, -y1, x, -y);
          lastQuad = { x: x1, y: y1 };
          cx = x; cy = y;
        }
        continue;
      }
      if (C === 'T') {
        while (peekNum()) {
          let x = readNum(), y = readNum();
          if (isNaN(x) || isNaN(y)) break;
          if (rel) { x += cx; y += cy; }
          const x1 = lastQuad ? 2 * cx - lastQuad.x : cx;
          const y1 = lastQuad ? 2 * cy - lastQuad.y : cy;
          shape.quadraticCurveTo(x1, -y1, x, -y);
          lastQuad = { x: x1, y: y1 };
          cx = x; cy = y;
        }
        continue;
      }
      if (C === 'A') {
        while (peekNum()) {
          const rx = readNum(), ry = readNum(), rot = readNum();
          const laf = readFlag(), sf = readFlag();
          let x = readNum(), y = readNum();
          if (isNaN(x) || isNaN(y)) break;
          if (rel) { x += cx; y += cy; }
          const pts = arcToPoints(cx, cy, rx, ry, rot, laf, sf, x, y);
          for (let k = 0; k < pts.length; k++) shape.lineTo(pts[k].x, -pts[k].y);
          cx = x; cy = y;
        }
        continue;
      }
    }
    return shapes;
  }

  function pointInPoly(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      if ((yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  function shapeBounds(shapes) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < shapes.length; i++) {
      const pts = shapes[i].getPoints(64);
      for (let k = 0; k < pts.length; k++) {
        if (pts[k].x < minX) minX = pts[k].x;
        if (pts[k].x > maxX) maxX = pts[k].x;
        if (pts[k].y < minY) minY = pts[k].y;
        if (pts[k].y > maxY) maxY = pts[k].y;
      }
    }
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }

  function splitOutersAndHoles(shapes) {
    const polys = shapes.map(function (s) { return s.getPoints(200); });
    const parentOf = shapes.map(function (s, si) {
      let best = -1, bestArea = 0;
      for (let j = 0; j < shapes.length; j++) {
        if (j === si) continue;
        const b = shapeBounds([shapes[j]]);
        const area = b.w * b.h;
        if (area > bestArea && pointInPoly(polys[si][0], polys[j])) {
          bestArea = area;
          best = j;
        }
      }
      return best;
    });

    const outers = [];
    const holes = {};
    shapes.forEach(function (s, si) {
      if (parentOf[si] === -1) {
        outers.push({ shape: s, index: si });
      }
    });
    shapes.forEach(function (s, si) {
      const p = parentOf[si];
      if (p !== -1 && !holes[p]) holes[p] = [];
      if (p !== -1) holes[p].push(s);
    });
    return { outers: outers, holes: holes };
  }

  /* ---------- renderer / scene ---------- */

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    document.body.classList.add('no-webgl');
    return;
  }
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 13);

  const group = new THREE.Group();
  scene.add(group);

  function makeEnvironment() {
    try {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 512;
      const ctx = c.getContext('2d');
      const base = ctx.createLinearGradient(0, 0, 0, 512);
      base.addColorStop(0, '#fbf7ef');
      base.addColorStop(0.42, '#eadccb');
      base.addColorStop(0.7, '#b98a64');
      base.addColorStop(1, '#3b2a22');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 1024, 512);

      const sun = ctx.createRadialGradient(300, 120, 0, 300, 120, 230);
      sun.addColorStop(0, 'rgba(255,255,255,1)');
      sun.addColorStop(0.3, 'rgba(255,255,255,0.6)');
      sun.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, 1024, 512);

      const warm = ctx.createRadialGradient(820, 360, 0, 820, 360, 280);
      warm.addColorStop(0, 'rgba(176,86,57,0.5)');
      warm.addColorStop(1, 'rgba(176,86,57,0)');
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, 1024, 512);

      const cool = ctx.createRadialGradient(190, 400, 0, 190, 400, 280);
      cool.addColorStop(0, 'rgba(42,76,60,0.3)');
      cool.addColorStop(1, 'rgba(42,76,60,0)');
      ctx.fillStyle = cool;
      ctx.fillRect(0, 0, 1024, 512);

      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const env = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      pmrem.dispose();
      return env;
    } catch (err) {
      return null;
    }
  }

  const environment = makeEnvironment();

  function makeGlow() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255, 236, 214, 0.9)');
    g.addColorStop(0.4, 'rgba(224, 168, 120, 0.32)');
    g.addColorStop(1, 'rgba(224, 168, 120, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(10);
    sprite.position.z = -1.5;
    return sprite;
  }

  group.add(makeGlow());

  /* ---------- build extruded logos ---------- */

  const CONFIG = {
    'Blender':    { size: 1.95, radius: 1.35, baseY: 1.0,  phase: 0.0 },
    'Houdini':    { size: 1.35, radius: 2.1,  baseY: 0.4,  phase: 1.05 },
    'Cinema 4D':  { size: 1.25, radius: 1.85, baseY: -1.0, phase: 2.1 },
    'Three.js':   { size: 1.15, radius: 1.5,  baseY: -1.45, phase: 3.15 },
    'Unity':      { size: 1.3,  radius: 2.4,  baseY: -0.35, phase: 4.2 },
    'Unreal':     { size: 1.4,  radius: 1.2,  baseY: 1.75, phase: 5.25 }
  };

  const DEPTH_WORLD = 0.32;
  const BEVEL_WORLD = 0.05;

  const logos = [];

  window.POLY_LOGOS.forEach(function (logo) {
    const cfg = CONFIG[logo.name];
    if (!cfg) return;

    let shapes;
    try {
      shapes = svgToShapes(logo.d);
    } catch (err) {
      return;
    }
    if (!shapes.length) return;

    const { outers, holes } = splitOutersAndHoles(shapes);
    const bounds = shapeBounds(shapes);
    const maxDim = Math.max(bounds.w, bounds.h) || 1;
    const scale = cfg.size / maxDim;
    const depth = DEPTH_WORLD / scale;
    const bevel = BEVEL_WORLD / scale;

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const logoGroup = new THREE.Group();

    const color = new THREE.Color(logo.color);
    const material = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0.45,
      roughness: 0.3,
      clearcoat: 0.65,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.9,
      emissive: color,
      emissiveIntensity: 0.12
    });
    if (environment) material.envMap = environment;

    outers.forEach(function (outer) {
      const holeShapes = holes[outer.index] || [];
      outer.shape.holes = holeShapes;

      let geo;
      try {
        geo = new THREE.ExtrudeGeometry(outer.shape, {
          depth: depth,
          bevelEnabled: true,
          bevelThickness: bevel,
          bevelSize: bevel,
          bevelSegments: 3,
          curveSegments: 32
        });
      } catch (err) {
        return;
      }

      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(-centerX, -centerY, -depth / 2);
      logoGroup.add(mesh);
    });

    if (logoGroup.children.length === 0) return;

    logoGroup.scale.setScalar(scale);
    logoGroup.userData = {
      name: logo.name,
      radius: cfg.radius,
      baseY: cfg.baseY,
      angle: cfg.phase,
      phase: cfg.phase,
      orbitSpeed: 0.1 + Math.random() * 0.12,
      spinSpeed: 0.22 + Math.random() * 0.22,
      levSpeed: 0.4 + Math.random() * 0.3,
      levAmp: 0.15 + Math.random() * 0.15,
      tiltAmp: 0.12 + Math.random() * 0.1
    };

    group.add(logoGroup);
    logos.push(logoGroup);
  });

  /* ---------- lights ---------- */

  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x3a2a20, 0.7));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(5, 6, 6);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0xb05639, 0.8, 30);
  rimLight.position.set(-5, 1.5, 2.5);
  scene.add(rimLight);

  const tealLight = new THREE.PointLight(0x2a4c3c, 0.9, 30);
  tealLight.position.set(4.6, -2.8, -3.8);
  scene.add(tealLight);

  const fillLight = new THREE.PointLight(0xf4e7d5, 0.4, 26);
  fillLight.position.set(5, -4, 5);
  scene.add(fillLight);

  /* ---------- layout / interaction ---------- */

  let scrollTarget = 0;
  let scrollSmooth = 0;
  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let running = false;
  let rafId = 0;

  const clock = new THREE.Clock();

  function baseX() {
    if (window.innerWidth < 760) return 1.6;
    if (window.innerWidth < 1200) return 2.9;
    return 3.1;
  }
  function baseY() {
    if (window.innerWidth < 760) return 0.9;
    if (window.innerWidth < 1200) return 0.15;
    return 0;
  }
  function baseScale() {
    if (window.innerWidth < 760) return 0.6;
    if (window.innerWidth < 1200) return 0.8;
    return 0.95;
  }
  function baseCameraZ() {
    if (window.innerWidth < 760) return 15;
    if (window.innerWidth < 1200) return 13.6;
    return 13;
  }

  function updateScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    scrollTarget = Math.min(Math.max(ratio, 0), 1);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 760 ? 1.5 : 2));
    renderer.setSize(w, h);
    updateScroll();
  }

  function renderFrame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    scrollSmooth += (scrollTarget - scrollSmooth) * 0.07;
    smoothX += (pointerX - smoothX) * 0.05;
    smoothY += (pointerY - smoothY) * 0.05;

    group.position.x = baseX() - scrollSmooth * 0.45 + (reduceMotion ? 0 : smoothX * 0.18);
    group.position.y = baseY() - scrollSmooth * 1.15 + (reduceMotion ? 0 : smoothY * 0.12);
    group.scale.setScalar(baseScale());
    group.rotation.y = scrollSmooth * 0.35 + (reduceMotion ? 0 : smoothX * 0.06);

    camera.position.z = baseCameraZ() + scrollSmooth * 1.1;
    camera.lookAt(0, 0, 0);

    for (let i = 0; i < logos.length; i++) {
      const logo = logos[i];
      const u = logo.userData;

      if (!reduceMotion) {
        u.angle += dt * u.orbitSpeed;
      }

      logo.position.x = Math.cos(u.angle) * u.radius;
      logo.position.z = Math.sin(u.angle) * u.radius * 0.55;
      logo.position.y = u.baseY + (reduceMotion ? 0 : Math.sin(t * u.levSpeed + u.phase) * u.levAmp);

      if (!reduceMotion) {
        logo.rotation.y = t * u.spinSpeed;
        logo.rotation.x = Math.sin(t * 0.4 + u.phase) * u.tiltAmp;
        logo.rotation.z = Math.cos(t * 0.3 + u.phase) * u.tiltAmp;
      }
    }

    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    rafId = window.requestAnimationFrame(loop);
    renderFrame();
  }

  function start() {
    if (running) return;
    running = true;
    clock.getDelta();
    rafId = window.requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (event) {
      pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  reduceQuery.addEventListener('change', function (event) {
    reduceMotion = event.matches;
    if (reduceMotion) { smoothX = 0; smoothY = 0; }
  });

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateScroll, { passive: true });

  resize();
  updateScroll();
  renderFrame();

  window.requestAnimationFrame(function () {
    document.body.classList.add('scene-ready');
  });

  start();
})();
