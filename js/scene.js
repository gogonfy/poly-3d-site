/* =========================================================
   Background 3D scene вЂ” rotation is driven by page scroll
   Author: Arseniy Socolov
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9.6);

  const group = new THREE.Group();
  scene.add(group);

  /* ---------- environment for glossy reflections ---------- */

  function makeEnvironment() {
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
    sun.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    sun.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 1024, 512);

    const warm = ctx.createRadialGradient(820, 360, 0, 820, 360, 280);
    warm.addColorStop(0, 'rgba(176,86,57,0.55)');
    warm.addColorStop(1, 'rgba(176,86,57,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, 1024, 512);

    const cool = ctx.createRadialGradient(190, 400, 0, 190, 400, 280);
    cool.addColorStop(0, 'rgba(42,76,60,0.34)');
    cool.addColorStop(0.55, 'rgba(42,76,60,0.1)');
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
  }

  try {
    scene.environment = makeEnvironment();
  } catch (err) {
    /* environment is a nice-to-have */
  }

  /* ---------- materials ---------- */

  const orangeMat = new THREE.MeshPhysicalMaterial({
    color: 0x8f432b,
    metalness: 0.18,
    roughness: 0.33,
    clearcoat: 0.5,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.5,
    emissive: 0x180704,
    emissiveIntensity: 0.12
  });

  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0e6d6,
    metalness: 0.06,
    roughness: 0.36,
    clearcoat: 0.5,
    clearcoatRoughness: 0.24,
    envMapIntensity: 0.5
  });

  const tealMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a4c3c,
    metalness: 0.12,
    roughness: 0.38,
    clearcoat: 0.4,
    clearcoatRoughness: 0.24,
    envMapIntensity: 0.45,
    emissive: 0x06120d,
    emissiveIntensity: 0.12
  });

  const figureMat = new THREE.MeshPhysicalMaterial({
    color: 0x7c3827,
    metalness: 0.22,
    roughness: 0.29,
    clearcoat: 0.58,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.55,
    emissive: 0x130604,
    emissiveIntensity: 0.12
  });

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xb08a52,
    wireframe: true,
    transparent: true,
    opacity: 0.09,
    depthWrite: false
  });

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xb08a52,
    transparent: true,
    opacity: 0.34,
    depthWrite: false
  });

  /* ---------- main object ---------- */

  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.32, 0.4, 230, 34, 2, 3), figureMat);
  group.add(knot);

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), whiteMat);
  group.add(core);

  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.7, 1), wireMat);
  group.add(shell);

  const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.016, 8, 180), ringMat);
  orbitRing.rotation.set(1.24, 0.2, 0.36);
  group.add(orbitRing);

  const orbitRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.58, 0.009, 8, 180), ringMat);
  orbitRing2.rotation.set(-0.88, 0.6, -0.42);
  group.add(orbitRing2);

  const coreLight = new THREE.PointLight(0xffd9bd, 0.5, 5.5);
  group.add(coreLight);

  /* ---------- orbiting shards ---------- */

  const shardGeometries = [
    new THREE.TetrahedronGeometry(0.17),
    new THREE.OctahedronGeometry(0.14),
    new THREE.IcosahedronGeometry(0.12),
    new THREE.BoxGeometry(0.19, 0.19, 0.19)
  ];

  const shards = [];
  const shardCount = 12;

  for (let i = 0; i < shardCount; i++) {
    const geo = shardGeometries[i % shardGeometries.length];
    const palette = [whiteMat, orangeMat, orangeMat, tealMat, orangeMat];
    const mesh = new THREE.Mesh(geo, palette[i % palette.length]);
    const angle = (i / shardCount) * Math.PI * 2;
    const radius = 2.05 + Math.random() * 1.05;

    mesh.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 2.4, Math.sin(angle) * radius);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    mesh.userData.angle = angle;
    mesh.userData.radius = radius;
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.speed = 0.05 + Math.random() * 0.07;
    mesh.userData.spinX = 0.25 + Math.random() * 0.6;
    mesh.userData.spinY = 0.2 + Math.random() * 0.5;

    group.add(mesh);
    shards.push(mesh);
  }

  /* ---------- particles ---------- */

  const particleCount = window.innerWidth < 760 ? 120 : 280;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const warmParticle = new THREE.Color(0xc98b68);
  const coolParticle = new THREE.Color(0x6f8c7c);
  const paleParticle = new THREE.Color(0xf0e4d2);

  for (let i = 0; i < particleCount; i++) {
    const radius = 3.4 + Math.random() * 4.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particlePositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    particlePositions[i * 3 + 1] = Math.cos(phi) * radius * 0.7;
    particlePositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;

    const chance = Math.random();
    const color = chance < 0.22 ? coolParticle : chance < 0.36 ? paleParticle : warmParticle;
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
      vertexColors: true,
      color: 0xffffff,
      size: 0.035,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true
    })
  );
  scene.add(particles);

  /* ---------- lights ---------- */

  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x3a2a20, 0.6));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(5, 6, 6);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0xb05639, 0.7, 26);
  rimLight.position.set(-5, 1.5, 2);
  scene.add(rimLight);

  const tealLight = new THREE.PointLight(0x2a4c3c, 0.8, 30);
  tealLight.position.set(4.6, -2.8, -3.8);
  scene.add(tealLight);

  const fillLight = new THREE.PointLight(0xf4e7d5, 0.4, 26);
  fillLight.position.set(5, -4, 5);
  scene.add(fillLight);

  /* ---------- layout / scroll ---------- */

  let scrollTarget = 0;
  let scrollSmooth = 0;
  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let idle = 0;
  let running = false;
  let rafId = 0;

  const clock = new THREE.Clock();

  function baseX() {
    if (window.innerWidth < 760) return 2.0;
    if (window.innerWidth < 981) return 1.2;
    if (window.innerWidth < 1200) return 3.3;
    return 3.0;
  }

  function baseScale() {
    if (window.innerWidth < 760) return 0.65;
    if (window.innerWidth < 981) return 0.62;
    if (window.innerWidth < 1200) return 0.7;
    return 0.8;
  }

  function baseY() {
    if (window.innerWidth < 760) return 2.4;
    if (window.innerWidth < 981) return 1.15;
    if (window.innerWidth < 1200) return 0.25;
    return 0;
  }

  function baseCameraZ() {
    if (window.innerWidth < 760) return 13.5;
    if (window.innerWidth < 981) return 13.5;
    if (window.innerWidth < 1200) return 12.5;
    return 9.6;
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

    if (!reduceMotion) {
      idle += dt * 0.16;
    }

    const scrollAmount = reduceMotion ? scrollSmooth * Math.PI * 1.2 : scrollSmooth * Math.PI * 2.2;

    group.rotation.y = scrollAmount + idle + smoothX * (reduceMotion ? 0 : 0.16);
    group.rotation.x = Math.sin(scrollSmooth * Math.PI) * 0.42 + smoothY * (reduceMotion ? 0 : 0.1);
    group.rotation.z = Math.sin(scrollSmooth * Math.PI * 2) * 0.1;
    group.position.x = baseX() - scrollSmooth * 0.35;
    group.position.y = baseY() - scrollSmooth * 1.05 + (reduceMotion ? 0 : Math.sin(t * 0.6) * 0.045);

    const s = baseScale();
    group.scale.setScalar(s);

    camera.position.z = baseCameraZ() + scrollSmooth * 1.0;
    camera.lookAt(0, 0, 0);

    knot.rotation.z += dt * 0.06;
    knot.rotation.x = Math.sin(t * 0.35) * 0.08;
    core.rotation.y -= dt * 0.25;
    shell.rotation.y = -scrollSmooth * Math.PI * 0.8;
    shell.rotation.x = scrollSmooth * 0.6;
    orbitRing.rotation.z += dt * 0.08;
    orbitRing2.rotation.z -= dt * 0.05;

    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i];
      const data = shard.userData;
      data.angle += dt * data.speed;
      shard.position.x = Math.cos(data.angle) * data.radius;
      shard.position.z = Math.sin(data.angle) * data.radius;
      shard.position.y = data.baseY + Math.sin(t * 0.7 + i) * 0.16;
      shard.rotation.x += dt * data.spinX;
      shard.rotation.y += dt * data.spinY;
    }

    if (!reduceMotion) {
      particles.rotation.y = t * 0.012;
      particles.rotation.x = Math.sin(t * 0.1) * 0.05;
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
    if (document.hidden) {
      stop();
    } else {
      start();
    }
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
      idle = 0;
      smoothX = 0;
      smoothY = 0;
    }
  });

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateScroll, { passive: true });

  resize();
  updateScroll();
  renderFrame();

  // let the canvas fade in after the first successful frame
  window.requestAnimationFrame(function () {
    document.body.classList.add('scene-ready');
  });

  start();
})();

