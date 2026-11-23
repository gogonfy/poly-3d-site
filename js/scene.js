/* =========================================================
   Background 3D scene — a single large Blender logo,
   extruded from its vector path into detailed 3D geometry.
   Around it: a slow dust cloud, an orbital spark band,
   fast flying embers with streak accents, tumbling brass
   shards, two orbit rings and a faint wireframe shell.
   Lit with studio lights + reflections.
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
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(15);
    sprite.position.z = -1.5;
    return sprite;
  }

  const glow = makeGlow();
  group.add(glow);

  /* ---------- build extruded logo ---------- */

  const CONFIG = {
    'Blender': { size: 6.0 }
  };

  const DEPTH_WORLD = 0.42;
  const BEVEL_WORLD = 0.06;

  let logoGroup = null;

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

    logoGroup = new THREE.Group();

    const color = new THREE.Color(logo.color);
    const material = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0.45,
      roughness: 0.28,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.9,
      emissive: color,
      emissiveIntensity: 0.16
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
          bevelSegments: 5,
          curveSegments: 48
        });
      } catch (err) {
        return;
      }

      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(-centerX, -centerY, -depth / 2);
      logoGroup.add(mesh);
    });

    if (logoGroup.children.length === 0) { logoGroup = null; return; }

    logoGroup.scale.setScalar(scale);
    logoGroup.userData = {
      spinSpeed: 0.3,
      levSpeed: 0.5,
      levAmp: 0.22,
      tiltAmp: 0.14
    };

    group.add(logoGroup);
  });

  /* ---------- particle fields ---------- */

  const isMobile = window.innerWidth < 760;

  function makeDotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.58, 'rgba(255,255,255,1)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  const dotTexture = makeDotTexture();

  const particlePalette = [
    { color: new THREE.Color(0x1c372b).convertSRGBToLinear(), weight: 0.2 },
    { color: new THREE.Color(0x2a4c3c).convertSRGBToLinear(), weight: 0.26 },
    { color: new THREE.Color(0x0f7a52).convertSRGBToLinear(), weight: 0.3 },
    { color: new THREE.Color(0x11966a).convertSRGBToLinear(), weight: 0.16 },
    { color: new THREE.Color(0x2fae75).convertSRGBToLinear(), weight: 0.08 }
  ];

  function pickParticleColor() {
    let r = Math.random();
    for (let i = 0; i < particlePalette.length; i++) {
      r -= particlePalette[i].weight;
      if (r <= 0) return particlePalette[i].color;
    }
    return particlePalette[0].color;
  }

  /* slow dust cloud */
  const particleCount = isMobile ? 170 : 400;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const r = 3.2 + Math.random() * 2.4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particlePositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    particlePositions[i * 3 + 1] = Math.cos(phi) * r * 0.9;
    particlePositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;

    const color = pickParticleColor();
    particleColors[i * 3] = color.r;
    particleColors[i * 3 + 1] = color.g;
    particleColors[i * 3 + 2] = color.b;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      map: dotTexture,
      vertexColors: true,
      size: isMobile ? 0.21 : 0.15,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      sizeAttenuation: true
    })
  );
  particles.frustumCulled = false;
  group.add(particles);

  /* orbital spark band */
  const bandCount = isMobile ? 36 : 84;
  const bandPositions = new Float32Array(bandCount * 3);
  const bandColors = new Float32Array(bandCount * 3);

  for (let i = 0; i < bandCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3.7 + Math.random() * 0.8;
    bandPositions[i * 3] = Math.cos(angle) * radius;
    bandPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.16;
    bandPositions[i * 3 + 2] = Math.sin(angle) * radius;

    const color = Math.random() < 0.55 ? particlePalette[2].color : particlePalette[4].color;
    bandColors[i * 3] = color.r;
    bandColors[i * 3 + 1] = color.g;
    bandColors[i * 3 + 2] = color.b;
  }

  const bandGeometry = new THREE.BufferGeometry();
  bandGeometry.setAttribute('position', new THREE.BufferAttribute(bandPositions, 3));
  bandGeometry.setAttribute('color', new THREE.BufferAttribute(bandColors, 3));

  const band = new THREE.Points(
    bandGeometry,
    new THREE.PointsMaterial({
      map: dotTexture,
      vertexColors: true,
      size: isMobile ? 0.13 : 0.09,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true
    })
  );
  band.frustumCulled = false;

  const bandGroup = new THREE.Group();
  bandGroup.rotation.set(0.95, 0.15, 0.32);
  bandGroup.add(band);
  group.add(bandGroup);

  /* fast flying embers (individual orbits) */
  const emberCount = isMobile ? 52 : 120;
  const emberPositions = new Float32Array(emberCount * 3);
  const emberColors = new Float32Array(emberCount * 3);
  const embersData = [];

  for (let i = 0; i < emberCount; i++) {
    const radius = 3.6 + Math.random() * 2.2;
    const angle = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * 5.6;
    const orbitSpeed = (0.16 + Math.random() * 0.38) * (Math.random() < 0.16 ? -1 : 1);
    const bobAmp = 0.2 + Math.random() * 0.55;
    const bobSpeed = 0.5 + Math.random() * 1.0;
    const phase = Math.random() * Math.PI * 2;
    embersData.push({ radius, angle, height, orbitSpeed, bobAmp, bobSpeed, phase });

    emberPositions[i * 3] = Math.cos(angle) * radius;
    emberPositions[i * 3 + 1] = height;
    emberPositions[i * 3 + 2] = Math.sin(angle) * radius * 0.84;

    const color = pickParticleColor();
    emberColors[i * 3] = color.r;
    emberColors[i * 3 + 1] = color.g;
    emberColors[i * 3 + 2] = color.b;
  }

  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  emberGeometry.setAttribute('color', new THREE.BufferAttribute(emberColors, 3));

  const embers = new THREE.Points(
    emberGeometry,
    new THREE.PointsMaterial({
      map: dotTexture,
      vertexColors: true,
      size: isMobile ? 0.28 : 0.21,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: true
    })
  );
  embers.frustumCulled = false;
  group.add(embers);

  /* thin speed streaks */
  const streakCount = isMobile ? 24 : 52;
  const streakPositions = new Float32Array(streakCount * 6);

  for (let i = 0; i < streakCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3.9 + Math.random() * 1.8;
    const y = (Math.random() - 0.5) * 5.2;
    const length = 0.2 + Math.random() * 0.4;
    const o = i * 6;
    streakPositions[o] = Math.cos(angle) * radius;
    streakPositions[o + 1] = y;
    streakPositions[o + 2] = Math.sin(angle) * radius * 0.84;
    streakPositions[o + 3] = streakPositions[o] - Math.sin(angle) * length;
    streakPositions[o + 4] = y + (Math.random() - 0.5) * 0.06;
    streakPositions[o + 5] = streakPositions[o + 2] + Math.cos(angle) * length * 0.84;
  }

  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));

  const streakColor = new THREE.Color(0x15573a).convertSRGBToLinear();
  const streaks = new THREE.LineSegments(
    streakGeometry,
    new THREE.LineBasicMaterial({
      color: streakColor,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    })
  );
  streaks.frustumCulled = false;
  group.add(streaks);

  /* tumbling brass shards */
  const shardCount = isMobile ? 4 : 8;
  const shardGeometry = new THREE.OctahedronGeometry(1, 0);
  const shardColor = new THREE.Color(0x15573a).convertSRGBToLinear();
  const shardEmissive = new THREE.Color(0x0a2a1d).convertSRGBToLinear();
  const shardMaterial = new THREE.MeshPhysicalMaterial({
    color: shardColor,
    metalness: 0.55,
    roughness: 0.4,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    emissive: shardEmissive,
    emissiveIntensity: 0.3
  });
  if (environment) shardMaterial.envMap = environment;

  const shards = [];
  for (let i = 0; i < shardCount; i++) {
    const mesh = new THREE.Mesh(shardGeometry, shardMaterial);
    const data = {
      radius: 4.0 + Math.random() * 1.7,
      angle: Math.random() * Math.PI * 2,
      height: (Math.random() - 0.5) * 4.8,
      orbitSpeed: (0.08 + Math.random() * 0.18) * (Math.random() < 0.2 ? -1 : 1),
      bobAmp: 0.15 + Math.random() * 0.3,
      bobSpeed: 0.4 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      spin: 0.4 + Math.random() * 0.8
    };
    mesh.userData = data;
    mesh.scale.setScalar(0.07 + Math.random() * 0.1);
    mesh.position.set(
      Math.cos(data.angle) * data.radius,
      data.height,
      Math.sin(data.angle) * data.radius * 0.84
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    shards.push(mesh);
    group.add(mesh);
  }

  /* ---------- orbit rings + wireframe shell ---------- */

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xd3b98f,
    transparent: true,
    opacity: 0.4,
    depthWrite: false
  });

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.014, 8, 180), ringMat);
  ring1.rotation.set(1.2, 0.2, 0.4);
  group.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.01, 8, 180), ringMat);
  ring2.rotation.set(-0.9, 0.55, -0.5);
  group.add(ring2);

  const ring3 = new THREE.Mesh(
    new THREE.TorusGeometry(5.35, 0.007, 8, 200),
    new THREE.MeshBasicMaterial({
      color: 0xb97a46,
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    })
  );
  ring3.rotation.set(0.35, -0.45, 1.0);
  group.add(ring3);

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(5.15, 1),
    new THREE.MeshBasicMaterial({
      color: 0xb08a52,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
      depthWrite: false
    })
  );
  group.add(shell);

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

  let layoutX = 0;
  let layoutScale = 1;

  function computeLayoutX() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const halfW = Math.tan((camera.fov * Math.PI) / 360) * baseCameraZ() * (w / h);
    const rawScale = baseScaleRaw();

    if (w < 1100) {
      layoutScale = rawScale;
      const logoHalfFrac = (3.0 * rawScale) / (2 * halfW);
      let centerFrac;
      if (w < 760) {
        centerFrac = 0.7;
      } else {
        const panel = document.querySelector('.hero-panel');
        centerFrac = panel ? panel.getBoundingClientRect().right / w + 0.02 + logoHalfFrac : 0.78;
        centerFrac = Math.max(centerFrac, 0.78);
      }
      centerFrac = Math.min(centerFrac, 0.965 - logoHalfFrac);
      layoutX = (centerFrac * 2 - 1) * halfW;
      return;
    }

    const panel = document.querySelector('.hero-panel');
    const panelRight = panel ? panel.getBoundingClientRect().right : w * 0.45;
    const gap = Math.max(20, Math.round(w * 0.02));
    const railReserve = w >= 2000 ? 220 : (w >= 1200 ? 135 : 30);
    const safeRight = w - railReserve;
    const pxPerWorld = w / (2 * halfW);

    let scale = rawScale;
    let logoPx = 6.0 * scale * pxPerWorld;
    const available = safeRight - panelRight - gap;
    if (available > 80 && logoPx > available) {
      scale *= (available / logoPx) * 0.98;
      logoPx = 6.0 * scale * pxPerWorld;
    }
    layoutScale = scale;

    let centerPx = safeRight - logoPx / 2;
    const minCenter = panelRight + gap + logoPx / 2;
    if (centerPx < minCenter) centerPx = minCenter;
    centerPx = Math.min(centerPx, w - 8 - logoPx / 2);
    layoutX = ((centerPx / w) * 2 - 1) * halfW;
  }

  function baseX() {
    return layoutX;
  }
  function baseY() {
    if (window.innerWidth < 760) return 0.9;
    if (window.innerWidth < 1200) return 0.15;
    return 0;
  }
  function baseScaleRaw() {
    if (window.innerWidth < 760) return 0.5;
    if (window.innerWidth < 1000) return 0.6;
    if (window.innerWidth < 1200) return 0.68;
    return 1.1;
  }
  function baseScale() {
    return layoutScale;
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
    computeLayoutX();
  }

  function renderFrame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    scrollSmooth += (scrollTarget - scrollSmooth) * 0.07;
    smoothX += (pointerX - smoothX) * 0.05;
    smoothY += (pointerY - smoothY) * 0.05;

    group.position.x = baseX() - scrollSmooth * 0.45 + (reduceMotion ? 0 : smoothX * 0.42);
    group.position.y = baseY() - scrollSmooth * 1.15 + (reduceMotion ? 0 : smoothY * 0.3);
    group.scale.setScalar(baseScale());
    group.rotation.y = scrollSmooth * 0.35 + (reduceMotion ? 0 : smoothX * 0.12);
    group.rotation.x = reduceMotion ? 0 : -smoothY * 0.08;

    camera.position.z = baseCameraZ() + scrollSmooth * 1.1;
    camera.lookAt(0, 0, 0);

    if (logoGroup) {
      const u = logoGroup.userData;
      logoGroup.position.y = reduceMotion ? 0 : Math.sin(t * u.levSpeed) * u.levAmp;
      if (!reduceMotion) {
        logoGroup.rotation.y = Math.sin(t * 0.35) * 0.5;
        logoGroup.rotation.x = Math.sin(t * 0.3) * 0.12;
        logoGroup.rotation.z = Math.cos(t * 0.25) * 0.08;
      }
    }

    if (!reduceMotion) {
      particles.rotation.y += dt * 0.09;
      particles.rotation.x = Math.sin(t * 0.1) * 0.07;

      band.rotation.y += dt * 0.24;
      bandGroup.rotation.z = 0.32 + Math.sin(t * 0.22) * 0.05;

      for (let i = 0; i < embersData.length; i++) {
        const d = embersData[i];
        d.angle += dt * d.orbitSpeed;
        const o = i * 3;
        emberPositions[o] = Math.cos(d.angle) * d.radius;
        emberPositions[o + 1] = d.height + Math.sin(t * d.bobSpeed + d.phase) * d.bobAmp;
        emberPositions[o + 2] = Math.sin(d.angle) * d.radius * 0.84;
      }
      emberGeometry.attributes.position.needsUpdate = true;
      embers.material.opacity = 0.88 + Math.sin(t * 1.6) * 0.12;

      streaks.rotation.y -= dt * 0.18;
      streaks.rotation.x = Math.sin(t * 0.14) * 0.08;

      for (let i = 0; i < shards.length; i++) {
        const s = shards[i];
        const d = s.userData;
        d.angle += dt * d.orbitSpeed;
        s.position.x = Math.cos(d.angle) * d.radius;
        s.position.y = d.height + Math.sin(t * d.bobSpeed + d.phase) * d.bobAmp;
        s.position.z = Math.sin(d.angle) * d.radius * 0.84;
        s.rotation.x += dt * d.spin;
        s.rotation.y += dt * d.spin * 0.83;
        s.rotation.z += dt * d.spin * 0.41;
      }

      ring1.rotation.z += dt * 0.1;
      ring2.rotation.z -= dt * 0.07;
      ring3.rotation.z += dt * 0.045;
      shell.rotation.y -= dt * 0.03;
      shell.rotation.x = Math.sin(t * 0.08) * 0.1;

      glow.material.opacity = 0.55 + Math.sin(t * 0.9) * 0.06;
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
