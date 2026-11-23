/* =========================================================
   Interactive polygon demo
   Author: Arseniy Socolov
   ========================================================= */

(function () {
  'use strict';

  const canvas = document.getElementById('demo-canvas');
  const stage = document.querySelector('.demo-stage');
  if (!canvas || !stage || !window.THREE) return;

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
    showFallback();
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 4.7);

  /* ---------- lights ---------- */

  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x2f241b, 0.52));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(3.5, 4.5, 4);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0xb05639, 0.95, 16);
  rimLight.position.set(-3.5, -1.5, 3);
  scene.add(rimLight);

  const backLight = new THREE.PointLight(0xa67c47, 0.55, 16);
  backLight.position.set(2, -3.5, -2);
  scene.add(backLight);

  /* ---------- object ---------- */

  const group = new THREE.Group();
  scene.add(group);

  const solidMaterial = new THREE.MeshStandardMaterial({
    color: 0x9d4a30,
    metalness: 0.14,
    roughness: 0.4,
    flatShading: true,
    emissive: 0x180703,
    emissiveIntensity: 0.25
  });

  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0xe7d3b0,
    wireframe: true,
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  });

  const counts = {
    0: { vertices: 12, faces: 20, cost: 'Низкая' },
    2: { vertices: 162, faces: 320, cost: 'Средняя' },
    4: { vertices: 2562, faces: 5120, cost: 'Высокая' }
  };

  const metricVertices = document.getElementById('metric-vertices');
  const metricFaces = document.getElementById('metric-faces');
  const metricCost = document.getElementById('metric-cost');
  const wireToggle = document.getElementById('wireframe-toggle');
  const segButtons = Array.prototype.slice.call(document.querySelectorAll('.seg-btn'));

  let mesh = null;
  let wireMesh = null;
  let geometry = null;
  let detail = 2;

  let dragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let targetRotX = 0.14;
  let targetRotY = -0.55;
  let autoSpin = 0;
  let scaleTarget = 1;
  let hasDragged = false;

  function formatNumber(value) {
    return value.toLocaleString('ru-RU');
  }

  function updateMetrics(nextDetail) {
    const data = counts[nextDetail];
    if (!data) return;

    if (metricVertices) metricVertices.textContent = formatNumber(data.vertices);
    if (metricFaces) metricFaces.textContent = formatNumber(data.faces);
    if (metricCost) metricCost.textContent = data.cost;
  }

  function setPressed(activeDetail) {
    segButtons.forEach(function (button) {
      const isActive = Number(button.dataset.detail) === activeDetail;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function buildGeometry(nextDetail, pop) {
    if (mesh) {
      group.remove(mesh);
    }
    if (wireMesh) {
      group.remove(wireMesh);
    }
    if (geometry) {
      geometry.dispose();
    }

    geometry = new THREE.IcosahedronGeometry(1.35, nextDetail);

    mesh = new THREE.Mesh(geometry, solidMaterial);
    group.add(mesh);

    wireMesh = new THREE.Mesh(geometry, wireMaterial);
    wireMesh.visible = Boolean(wireToggle && wireToggle.checked);
    group.add(wireMesh);

    if (pop) {
      group.scale.setScalar(0.93);
      scaleTarget = 1;
    }

    detail = nextDetail;
    updateMetrics(nextDetail);
    setPressed(nextDetail);
  }

  function setDetail(nextDetail, pop) {
    if (nextDetail === detail && geometry) return;
    buildGeometry(nextDetail, pop);
  }

  segButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const next = Number(button.dataset.detail);
      if (Number.isNaN(next)) return;
      setDetail(next, true);
    });
  });

  if (wireToggle) {
    wireToggle.addEventListener('change', function () {
      if (wireMesh) wireMesh.visible = wireToggle.checked;
    });
  }

  /* ---------- drag + keyboard ---------- */

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    stage.classList.add('is-dragging');

    if (!hasDragged) {
      hasDragged = true;
      stage.classList.add('is-dragged');
    }

    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
  }

  function onPointerMove(event) {
    if (!dragging) return;

    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;

    targetRotY += dx * 0.008;
    targetRotX += dy * 0.006;
    targetRotX = Math.max(-1.15, Math.min(1.15, targetRotX));

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');

    if (event && event.pointerId !== undefined && canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', function () {
    dragging = false;
    stage.classList.remove('is-dragging');
  });

  canvas.addEventListener('keydown', function (event) {
    const step = 0.16;
    let handled = true;

    switch (event.key) {
      case 'ArrowLeft':
        targetRotY -= step;
        break;
      case 'ArrowRight':
        targetRotY += step;
        break;
      case 'ArrowUp':
        targetRotX -= step;
        break;
      case 'ArrowDown':
        targetRotX += step;
        break;
      case 'Home':
        targetRotX = 0.14;
        targetRotY = -0.55;
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      targetRotX = Math.max(-1.15, Math.min(1.15, targetRotX));
    }
  });

  /* ---------- render loop ---------- */

  const clock = new THREE.Clock();
  let inView = false;
  let running = false;
  let rafId = 0;

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function renderFrame() {
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!reduceMotion && !dragging) {
      autoSpin += dt * 0.22;
    }

    group.rotation.y += (targetRotY + autoSpin - group.rotation.y) * 0.08;
    group.rotation.x += (targetRotX - group.rotation.x) * 0.08;

    const currentScale = group.scale.x;
    if (Math.abs(currentScale - scaleTarget) > 0.0005) {
      group.scale.setScalar(currentScale + (scaleTarget - currentScale) * 0.14);
    } else if (currentScale !== scaleTarget) {
      group.scale.setScalar(scaleTarget);
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

  function syncPlayback() {
    if (inView && !document.hidden) {
      start();
    } else {
      stop();
    }
  }

  document.addEventListener('visibilitychange', syncPlayback);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      syncPlayback();
    }, { threshold: 0.06 });

    observer.observe(stage);
  } else {
    inView = true;
    syncPlayback();
  }

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(function () {
      resize();
      if (!running) renderFrame();
    });
    resizeObserver.observe(stage);
  } else {
    window.addEventListener('resize', resize);
  }

  reduceQuery.addEventListener('change', function (event) {
    reduceMotion = event.matches;
    if (reduceMotion) autoSpin = 0;
  });

  /* ---------- init ---------- */

  function showFallback() {
    stage.classList.add('no-demo');
    const message = document.createElement('p');
    message.className = 'stage-fallback';
    message.textContent = '3D-демо недоступно в этом браузере';
    stage.appendChild(message);
  }

  buildGeometry(2, false);
  resize();

  group.rotation.set(0.14, -0.55, 0);

  if (inView) start();
})();

