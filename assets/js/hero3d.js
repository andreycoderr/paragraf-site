/* ============================================================
   ПАРАГРАФ — 3D-сцена для hero (Three.js)
   Документ, у которого страницы по очереди ПЛАВНО переворачиваются
   у корешка и ЗАГИБАЮТСЯ как бумага (не пересекаясь друг с другом).
   + золотая пыль, параллакс за курсором.
   Подгружается с CDN; без сети — без сцены.
   Пропускается на мобильных и при prefers-reduced-motion.
   ============================================================ */
(async function () {
  "use strict";

  const host = document.getElementById("hero-3d");
  if (!host) return;
  if (window.innerWidth < 760) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return;
  } catch (e) { return; }

  let THREE, RoomEnvironment;
  try {
    THREE = await import("three");
    ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js"));
  } catch (e) { return; }

  const GOLD_SOFT = 0xE8C57E;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffe8c2, 2.3); key.position.set(5, 7, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xD9A441, 1.1); rim.position.set(-7, -1, -4); scene.add(rim);
  const glint = new THREE.PointLight(GOLD_SOFT, 0.9, 50); glint.position.set(-1, 4, 6); scene.add(glint);

  const group = new THREE.Group();
  scene.add(group);

  /* ---------- Текстура страницы (с золотой рамкой) ---------- */
  function pageTexture(seed) {
    const c = document.createElement("canvas"); c.width = 560; c.height = 740;
    const x = c.getContext("2d");
    x.fillStyle = "#F5F1E9"; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = "#D9A441"; x.lineWidth = 10; x.strokeRect(7, 7, c.width - 14, c.height - 14);
    x.fillStyle = "#C99A3A"; x.font = "bold 120px Georgia, 'Times New Roman', serif"; x.fillText("§", 56, 178);
    x.fillStyle = "#D9A441"; x.fillRect(56, 206, 150, 7);
    x.fillStyle = "rgba(20,22,30,0.16)";
    let y = 262;
    for (let i = 0; i < 13; i++) {
      const w = (i % 4 === 3) ? 150 : (320 + ((seed * 53 + i * 89) % 170));
      x.fillRect(56, y, w, 12); y += 33;
    }
    x.strokeStyle = "rgba(201,154,58,0.5)"; x.lineWidth = 4;
    x.beginPath(); x.arc(452, 648, 50, 0, Math.PI * 2); x.stroke();
    x.fillStyle = "rgba(201,154,58,0.5)"; x.font = "bold 52px Georgia, serif"; x.fillText("§", 432, 667);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  /* ---------- Документ ---------- */
  const book = new THREE.Group();
  group.add(book);

  const PAGE_W = 2.3, PAGE_H = 3.05, SEG = 30;
  function makePage(seed) {
    const geo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, SEG, 1);
    geo.translate(PAGE_W / 2, 0, 0);            // корешок в локальном x = 0
    const mat = new THREE.MeshStandardMaterial({ map: pageTexture(seed), roughness: 0.85, metalness: 0.04, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.base = Float32Array.from(geo.attributes.position.array);
    mesh.userData.bent = false;
    return mesh;
  }

  // нижний (всегда видимый) лист
  const basePage = makePage(7);
  book.add(basePage);

  // перелистываемые листы (поворачиваются по очереди)
  const P = 5;
  const flips = [];
  for (let i = 0; i < P; i++) {
    const p = makePage(i + 1);
    p.position.z = (i + 1) * 0.022;
    book.add(p); flips.push(p);
  }

  book.position.set(-PAGE_W / 2, 0, 0);
  book.rotation.set(-0.32, 0, 0.06);

  function bendPage(p, prog) {
    const turning = prog > 0.001 && prog < 0.999;
    const pos = p.geometry.attributes.position, b = p.userData.base;
    if (!turning) {
      if (p.userData.bent) {
        for (let k = 0; k < pos.count; k++) pos.setZ(k, b[k * 3 + 2]);
        pos.needsUpdate = true; p.geometry.computeVertexNormals(); p.userData.bent = false;
      }
      return;
    }
    const amp = Math.sin(prog * Math.PI) * 0.6;        // загиб максимален в середине переворота
    for (let k = 0; k < pos.count; k++) {
      const u = b[k * 3] / PAGE_W;                      // 0..1 вдоль ширины (от корешка)
      pos.setZ(k, Math.sin(u * Math.PI) * amp);         // лист выгибается дугой и проходит НАД стопкой
    }
    pos.needsUpdate = true; p.geometry.computeVertexNormals(); p.userData.bent = true;
  }

  /* ---------- Фоновые листы (глубина) ---------- */
  const bg = [];
  [{ x: 3.0, y: 1.7, z: -2.3, r: 0.25, s: 0.66 }, { x: -1.9, y: -1.2, z: -2.1, r: -0.3, s: 0.56 }].forEach((d, i) => {
    const m = makePage(20 + i);
    m.material.metalness = 0; m.position.set(d.x, d.y, d.z); m.rotation.set(0.05, d.r, d.r * 0.4); m.scale.setScalar(d.s);
    m.userData.baseY = d.y; m.userData.phase = i * 2.1; m.userData.amp = 0.16;
    group.add(m); bg.push(m);
  });

  /* ---------- Золотая пыль ---------- */
  const N = 130;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i*3] = (Math.random()-0.35)*11; pos[i*3+1] = (Math.random()-0.5)*9; pos[i*3+2] = (Math.random()-0.5)*6; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: GOLD_SOFT, size: 0.05, transparent: true, opacity: 0.7, sizeAttenuation: true, depthWrite: false }));
  scene.add(particles);

  /* ---------- Раскладка ---------- */
  function layout() {
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    group.position.set(w < 1024 ? 0.4 : 1.5, w < 1024 ? 0.3 : 0.4, 0);
    camera.position.z = w < 1024 ? 11 : 9.2;
    camera.updateProjectionMatrix();
  }
  layout();
  window.addEventListener("resize", layout);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const finePtr = window.matchMedia("(pointer:fine)").matches;
  if (finePtr) {
    window.addEventListener("mousemove", (e) => {
      pointer.tx = e.clientX / window.innerWidth - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  let flipPos = 0;          // «сколько страниц перевёрнуто» — следует за курсором
  const clock = new THREE.Clock();
  let raf = null;
  function frame() {
    const t = clock.getElapsedTime();
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    group.rotation.y = pointer.x * 0.45 + Math.sin(t * 0.1) * 0.04;
    group.rotation.x = pointer.y * 0.3;

    book.position.y = Math.sin(t * 0.5) * 0.08;

    // листание следует за курсором: положение X → сколько страниц перевёрнуто.
    // в любой момент переворачивается лишь одна страница → без столкновений.
    const target = finePtr
      ? Math.max(0, Math.min(P, (0.5 + pointer.tx) * P))
      : (0.5 - 0.5 * Math.cos(t * 0.5)) * P;     // если мыши нет — мягкое авто
    flipPos += (target - flipPos) * 0.09;
    const fi = Math.min(P - 1, Math.floor(flipPos));
    const pr = flipPos - fi;
    flips.forEach((p, i) => {
      const prog = i < fi ? 1 : (i > fi ? 0 : pr);
      const eased = prog * prog * (3 - 2 * prog);
      p.rotation.y = -eased * Math.PI;
      bendPage(p, prog);
    });

    bg.forEach((m) => {
      m.position.y = m.userData.baseY + Math.sin(t * 0.5 + m.userData.phase) * m.userData.amp;
      m.rotation.y = Math.sin(t * 0.3 + m.userData.phase) * 0.12;
    });

    particles.rotation.y = t * 0.02;
    particles.position.y = Math.sin(t * 0.1) * 0.2;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  if (reduceMotion) { renderer.render(scene, camera); }
  else {
    frame();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
      else if (!raf) { clock.getDelta(); frame(); }
    });
  }

  window.__hero3d = { ok: true, flipping: P, bend: true, bg: bg.length, particles: N };
})();
