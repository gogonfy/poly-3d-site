/* =========================================================
   Background 3D scene — floating tool logos
   Blender, Houdini, Cinema 4D, Three.js, Unity, Unreal:
   levitating cards that slowly orbit and sway in 3D,
   with subtle pointer / scroll parallax.
   ========================================================= */

(function () {
  'use strict';

  const canvas = document.getElementById('bg-canvas');
  if (!canvas || !window.THREE) return;

  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = reduceQuery.matches;

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

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 12);

  const group = new THREE.Group();
  scene.add(group);

  /* Each logo orbits an elliptical ring around the cluster centre. */
  const TOOLS = [
    { file: 'assets/tools/blender.svg',      radius: 1.35, baseY: 1.05, scale: 1.15, phase: 0.0 },
    { file: 'assets/tools/houdini.svg',      radius: 2.05, baseY: 0.45, scale: 0.95, phase: 1.05 },
    { file: 'assets/tools/cinema4d.svg',     radius: 1.85, baseY: -0.95, scale: 0.9, phase: 2.1 },
    { file: 'assets/tools/threedotjs.svg',   radius: 1.55, baseY: -1.45, scale: 0.85, phase: 3.15 },
    { file: 'assets/tools/unity.svg',        radius: 2.35, baseY: -0.35, scale: 0.9, phase: 4.2 },
    { file: 'assets/tools/unrealengine.svg', radius: 1.25, baseY: 1.75, scale: 0.9, phase: 5.25 }
  ];

  const cards = [];

  function loadLogo(file) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        try {
          const size = 256;
          const pad = 22;
          const c = document.createElement('canvas');
          c.width = size;
          c.height = size;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);

          const tex = new THREE.CanvasTexture(c);
          tex.encoding = THREE.sRGBEncoding;
          tex.anisotropy = 4;
          tex.minFilter = THREE.LinearFilter;
          resolve(tex);
        } catch (err) {
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = file;
    });
  }

  Promise.all(TOOLS.map(function (tool) { return loadLogo(tool.file); })).then(function (textures) {
    TOOLS.forEach(function (tool, index) {
      const tex = textures[index];
      if (!tex) return;

      const geo = new THREE.PlaneGeometry(1.5 * tool.scale, 1.5 * tool.scale);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        opacity: 0.96
      });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.userData = {
        radius: tool.radius,
        baseY: tool.baseY,
        angle: tool.phase,
        phase: tool.phase,
        orbitSpeed: 0.12 + Math.random() * 0.1,
        levSpeed: 0.45 + Math.random() * 0.35,
        levAmp: 0.16 + Math.random() * 0.14,
        swaySpeed: 0.35 + Math.random() * 0.25,
        swayAmp: 0.42 + Math.random() * 0.18
      };

      group.add(mesh);
      cards.push(mesh);
    });
  });

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
    if (window.innerWidth < 760) return 1.7;
    if (window.innerWidth < 1200) return 3.0;
    return 3.1;
  }

  function baseY() {
    if (window.innerWidth < 760) return 1.0;
    if (window.innerWidth < 1200) return 0.15;
    return 0;
  }

  function baseScale() {
    if (window.innerWidth < 760) return 0.62;
    if (window.innerWidth < 1200) return 0.78;
    return 0.92;
  }

  function baseCameraZ() {
    if (window.innerWidth < 760) return 14.5;
    if (window.innerWidth < 1200) return 13.2;
    return 12;
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

    camera.position.z = baseCameraZ() + scrollSmooth * 1.1;
    camera.lookAt(0, 0, 0);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const u = card.userData;

      if (!reduceMotion) {
        u.angle += dt * u.orbitSpeed;
      }

      card.position.x = Math.cos(u.angle) * u.radius;
      card.position.z = Math.sin(u.angle) * u.radius * 0.55;
      card.position.y = u.baseY + (reduceMotion ? 0 : Math.sin(t * u.levSpeed + u.phase) * u.levAmp);

      /* face the camera, then add a gentle side-to-side sway */
      card.lookAt(camera.position);
      if (!reduceMotion) {
        card.rotateY(Math.sin(t * u.swaySpeed + u.phase) * u.swayAmp);
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
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
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
    if (reduceMotion) {
      smoothX = 0;
      smoothY = 0;
    }
  });

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateScroll, { passive: true });

  resize();
  updateScroll();
  renderFrame();

  /* fade the canvas in once the first frame has been drawn */
  window.requestAnimationFrame(function () {
    document.body.classList.add('scene-ready');
  });

  start();
})();
