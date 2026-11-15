// Tampilan 3D (Three.js). Fisika tetap 2D: posisi diambil dari snapshot yang sama dengan render2d.
// Bidang permainan = bidang XY (y ke atas), kamera melihat dari +Z dengan sedikit miring.
// Bentuknya sama dengan render2d: createRenderer(canvas) -> { draw(view), dispose() }.
//
// Tekstur NASA dibaca dari public/assets/textures/ (bumi.jpg, bulan.jpg). Kalau belum ada, planet berwarna polos.
//
// draw(view) mengembalikan false kalau tampilan ini tidak didukung (Level 3 setelah masuk orbit Bulan:
// tampilan samping pendaratan). view.js lalu menggambar frame itu dengan render2d.

import { EARTH, ROCKET_TUNING } from '../engine/flight.js';
import { CISLUNAR } from '../engine/cislunar.js';
import { LAUNCH_SITE } from '../data/levels.js';
import { ROCKET_SPRITE, rocketSpriteSize } from './sprites.js';

const TEXTURES = { earth: '/assets/textures/bumi.jpg', moon: '/assets/textures/bulan.jpg' };
const COLORS = {
  earth: 0x2a6bc0,
  atmosphere: 0x9fd4ff, // biru muda
  moon: 0xa0a0a0,
  ring: 0x3fd17a,
  ringOk: 0x9cffc4,
  nominal: 0x3fd17a,
  trail: 0xffc878,
  prediction: 0xffffff,
  station: 0xffd54a,
};
// Kamera tegak lurus bidang permainan, supaya posisi roket di tepi Bumi tepat seperti fisikanya.
// Planet tetap terlihat 3D dari tekstur dan cahaya; pemain bisa memutar pandangan sendiri.
const TILT = 0;

export async function createRenderer(canvas) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070f);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 20000);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // HP: satu jari tetap untuk menggulir halaman, dua jari untuk memutar/zoom pandangan.
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  canvas.style.touchAction = 'pan-y';

  // Cahaya Matahari dari kiri depan
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-1, 0.4, 1.2);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // Latar bintang
  {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = 8000;
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(t), r * s * Math.sin(t), r * u], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
  }

  // ---------- Planet ----------
  const loader = new THREE.TextureLoader();
  function planet(radius, color, textureUrl) {
    const mat = new THREE.MeshPhongMaterial({ color, shininess: 8 });
    loader.load(
      textureUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
      },
      undefined,
      () => {}, // tekstur belum ada: tetap warna polos
    );
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), mat);
    mesh.rotation.x = Math.PI / 2 - 0.4; // kutub utara condong ke kamera, supaya benua terlihat
    return mesh;
  }
  // Bumi dilihat dari atas kutub selatan: bidang orbit = bidang ekuator, dan Bumi berputar searah jarum jam,
  // sama dengan arah orbit di game (peluncuran ke timur memanfaatkan rotasi Bumi).
  const earth = planet(EARTH.radius, COLORS.earth, TEXTURES.earth);
  // Ekuator ada di tepi bola. Putar tekstur pada porosnya supaya bujur landasan (Biak) tepat di puncak
  // saat misi mulai. Peta equirectangular: bujur λ ada di sudut (λ + 180°) pada bola Three.js,
  // dan puncak layar ada di sudut 90°, jadi putarannya 90° − (λ + 180°).
  earth.rotation.set(-Math.PI / 2, ((-90 - LAUNCH_SITE.lon) * Math.PI) / 180, 0);
  const earthSpin = new THREE.Group();
  earthSpin.add(earth);
  scene.add(earthSpin);
  // Pendaran atmosfer: bidang datar di pusat Bumi yang selalu menghadap kamera. Paling terang tepat di
  // tepi Bumi yang terlihat, lalu memudar ke luar. Tipis (sampai ~1,1 jari-jari) supaya tidak mencapai
  // cincin orbit, dan ditambahkan (additive) tanpa menulis depth supaya roket tetap terlihat di atasnya.
  const ATMO_WIDTH = EARTH.radius * 0.1;
  const atmosphere = new THREE.Mesh(
    new THREE.PlaneGeometry(EARTH.radius * 2.6, EARTH.radius * 2.6),
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(COLORS.atmosphere) },
        uInner: { value: EARTH.radius },
        uWidth: { value: ATMO_WIDTH },
        uStrength: { value: 0.7 },
      },
      vertexShader: `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uInner;
        uniform float uWidth;
        uniform float uStrength;
        varying vec2 vPos;
        void main() {
          float t = (length(vPos) - uInner) / uWidth;
          if (t < 0.0 || t > 1.0) discard;
          float a = pow(1.0 - t, 2.2) * uStrength;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  atmosphere.renderOrder = -1;
  scene.add(atmosphere);
  function updateAtmosphere() {
    // Tepi Bumi yang terlihat (dari kamera perspektif) sedikit lebih besar dari jari-jarinya di bidang pusat.
    atmosphere.quaternion.copy(camera.quaternion);
    const d = camera.position.distanceTo(atmosphere.position);
    const R = EARTH.radius;
    atmosphere.material.uniforms.uInner.value = d > R * 1.01 ? (R * d) / Math.sqrt(d * d - R * R) : R;
  }
  const moon = planet(CISLUNAR.moon.radius, COLORS.moon, TEXTURES.moon);
  moon.position.set(CISLUNAR.moon.x, CISLUNAR.moon.y, 0);
  scene.add(moon);

  // ---------- Garis ----------
  function dynamicLine(max, color, dashed = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setDrawRange(0, 0);
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 10, gapSize: 8 })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(g, mat);
    line.frustumCulled = false;
    scene.add(line);
    return {
      line,
      set(points) {
        const arr = g.attributes.position.array;
        const n = Math.min(points ? points.length : 0, max);
        for (let i = 0; i < n; i++) {
          arr[i * 3] = points[i].x;
          arr[i * 3 + 1] = points[i].y;
          arr[i * 3 + 2] = 0;
        }
        g.attributes.position.needsUpdate = true;
        g.setDrawRange(0, n);
        if (dashed && n > 1) line.computeLineDistances();
        line.visible = n > 1;
      },
    };
  }
  const trail = dynamicLine(800, COLORS.trail);
  const prediction = dynamicLine(600, COLORS.prediction, true);
  const nominal = dynamicLine(1200, COLORS.nominal);
  nominal.line.material.opacity = 0.6;
  const stationLink = dynamicLine(2, COLORS.station, true);

  // Cincin orbit Level 1
  const ringBand = new THREE.Mesh(
    new THREE.RingGeometry(EARTH.orbitRadius - ROCKET_TUNING.orbitRadiusTol, EARTH.orbitRadius + ROCKET_TUNING.orbitRadiusTol, 128),
    new THREE.MeshBasicMaterial({ color: COLORS.ring, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  scene.add(ringBand);
  const ringLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 180 }, (_, i) => {
        const a = (i / 180) * Math.PI * 2;
        return new THREE.Vector3(Math.sin(a) * EARTH.orbitRadius, Math.cos(a) * EARTH.orbitRadius, 0);
      }),
    ),
    new THREE.LineDashedMaterial({ color: COLORS.ring, dashSize: 8, gapSize: 8 }),
  );
  ringLine.computeLineDistances();
  scene.add(ringLine);

  // Cincin orbit polar Bulan (Level 3), dibuat saat pertama dibutuhkan karena ukurannya dari snapshot.
  let moonRing = null;
  function moonRingMesh(r, tol) {
    const band = new THREE.Mesh(
      new THREE.RingGeometry(r - tol, r + tol, 96),
      new THREE.MeshBasicMaterial({ color: COLORS.ring, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    );
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 120 }, (_, i) => {
          const a = (i / 120) * Math.PI * 2;
          return new THREE.Vector3(Math.sin(a) * r, Math.cos(a) * r, 0);
        }),
      ),
      new THREE.LineDashedMaterial({ color: COLORS.ring, dashSize: 4, gapSize: 4 }),
    );
    line.computeLineDistances();
    const g = new THREE.Group();
    g.add(band, line);
    g.position.set(CISLUNAR.moon.x, CISLUNAR.moon.y, 0);
    g.userData = { band, key: `${r}/${tol}` };
    scene.add(g);
    return g;
  }

  // Stasiun Bumi Level 1
  const station = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), new THREE.MeshBasicMaterial({ color: COLORS.station }));
  scene.add(station);
  let coverage = null; // wilayah jangkauan antena stasiun, dibuat saat pertama dibutuhkan
  function coverageMesh(cov) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(EARTH.radius, EARTH.orbitRadius + 20, 48, 1, Math.PI / 2 - cov, 2 * cov),
      new THREE.MeshBasicMaterial({ color: COLORS.station, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    );
    scene.add(m);
    return m;
  }
  let localEarthAngle = 0;

  // ---------- Wahana (model 3D sederhana) ----------
  // Model menghadap +Y (hidung ke atas). Posisi = titik fisika; roket berdiri di ekornya.
  // Karena benda 3D sungguhan, tampilannya ikut berubah saat pandangan kamera diputar.
  const white = new THREE.MeshPhongMaterial({ color: 0xf2f2f2, shininess: 40 });
  const orange = new THREE.MeshPhongMaterial({ color: 0xff8a3d });
  const grey = new THREE.MeshPhongMaterial({ color: 0xb8b8b8, shininess: 30 });
  const solar = new THREE.MeshPhongMaterial({ color: 0x2f5fc4, shininess: 60, side: THREE.DoubleSide });
  const shieldMat = new THREE.MeshPhongMaterial({ color: 0x7a4a2a });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.7 });
  const part = (geo, mat, x, y, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  };
  const flame = (y, r, h) => {
    const f = part(new THREE.ConeGeometry(r, h, 16), flameMat, 0, y - h / 2);
    f.rotation.z = Math.PI; // ujung api menghadap ke bawah
    return f;
  };

  // Roket: tinggi sekitar 20 satuan, ekor di y = 0
  const rocket = new THREE.Group();
  rocket.add(part(new THREE.CylinderGeometry(2.2, 2.2, 14, 20), white, 0, 7));
  rocket.add(part(new THREE.ConeGeometry(2.2, 6, 20), white, 0, 17));
  rocket.add(part(new THREE.CylinderGeometry(2.25, 2.25, 1.2, 20), orange, 0, 11));
  for (let i = 0; i < 4; i++) {
    const fin = part(new THREE.BoxGeometry(0.4, 4, 2.6), orange, 0, 2);
    const a = (i * Math.PI) / 2;
    fin.position.set(Math.sin(a) * 2.6, 2, Math.cos(a) * 2.6);
    fin.rotation.y = a;
    rocket.add(fin);
  }
  const rocketFlame = flame(0, 1.8, 8);
  rocket.add(rocketFlame);

  // Kapsul: kerucut dengan pelindung panas di bawah, pusat di tengah
  const capsule = new THREE.Group();
  capsule.add(part(new THREE.CylinderGeometry(1.2, 4.5, 6, 24), white, 0, 1));
  capsule.add(part(new THREE.CylinderGeometry(4.7, 4.7, 1.2, 24), shieldMat, 0, -2.6));
  const capsuleFlame = flame(-3.2, 1.6, 6);
  capsule.add(capsuleFlame);
  const entryGlow = part(new THREE.SphereGeometry(6, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glowMat, 0, -3);
  capsule.add(entryGlow);

  // CubeSat: kubus dengan panel lipat dan antena
  const cubesat = new THREE.Group();
  cubesat.add(part(new THREE.BoxGeometry(5, 5, 5), grey, 0, 0));
  const panels = new THREE.Group();
  panels.add(part(new THREE.BoxGeometry(8, 0.3, 4.6), solar, -6.6, 0));
  panels.add(part(new THREE.BoxGeometry(8, 0.3, 4.6), solar, 6.6, 0));
  cubesat.add(panels);
  const antenna = part(new THREE.CylinderGeometry(0.2, 0.2, 9, 8), white, 0, 7);
  cubesat.add(antenna);

  // Roket bergambar dari DKV: bidang datar yang berputar di sumbu roket supaya selalu menghadap kamera.
  // Kalau kamera melihat searah sumbu roket (dari hidung), dipakai gambar tampak atas.
  // Kalau gambar gagal dimuat, model 3D sederhana di atas tetap dipakai.
  const spriteTex = {};
  let spriteReady = false;
  const loadSprite = (key, url) =>
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        spriteTex[key] = tex;
        if (spriteTex.off && spriteTex.on) spriteReady = true;
      },
      undefined,
      () => {},
    );
  loadSprite('off', ROCKET_SPRITE.off);
  loadSprite('on', ROCKET_SPRITE.on);
  loadSprite('top', ROCKET_SPRITE.top);
  const sz = rocketSpriteSize();
  const sideMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const side = new THREE.Mesh(new THREE.PlaneGeometry(sz.w, sz.h), sideMat);
  side.position.y = sz.tail - sz.h / 2; // ekor di y = 0, api di bawahnya
  const sidePivot = new THREE.Group(); // berputar di sumbu Y (sumbu roket)
  sidePivot.add(side);
  const topSize = sz.w * 1.1;
  const topMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const topView = new THREE.Mesh(new THREE.PlaneGeometry(topSize, topSize / ROCKET_SPRITE.topAspect), topMat);
  topView.position.y = sz.tail * 0.6;
  const rocketSprite = new THREE.Group();
  rocketSprite.add(sidePivot, topView);
  const camLocal = new THREE.Vector3();

  const craft = new THREE.Group();
  craft.add(rocket, capsule, cubesat, rocketSprite);
  scene.add(craft);

  function updateRocketSprite(thrusting) {
    const map = thrusting ? spriteTex.on : spriteTex.off;
    if (sideMat.map !== map) {
      sideMat.map = map;
      sideMat.needsUpdate = true;
    }
    // Arah kamera dilihat dari wahana (koordinat lokal: sumbu roket = +Y).
    craft.updateMatrixWorld();
    camLocal.copy(camera.position);
    craft.worldToLocal(camLocal);
    camLocal.sub(new THREE.Vector3(0, sz.tail * 0.5, 0)).normalize();
    const alongAxis = Math.abs(camLocal.y) > 0.9 && spriteTex.top;
    sidePivot.visible = !alongAxis;
    topView.visible = !!alongAxis;
    if (alongAxis) {
      if (topMat.map !== spriteTex.top) {
        topMat.map = spriteTex.top;
        topMat.needsUpdate = true;
      }
      topView.lookAt(craft.localToWorld(camLocal.clone().multiplyScalar(1000)));
    } else sidePivot.rotation.y = Math.atan2(camLocal.x, camLocal.z);
  }

  function showCraft(kind, v, x, y, angle, thrusting) {
    const useSprite = kind === 'rocket' && spriteReady;
    rocket.visible = kind === 'rocket' && !useSprite;
    rocketSprite.visible = useSprite;
    capsule.visible = kind === 'capsule';
    cubesat.visible = kind === 'cubesat';
    const flicker = 0.8 + Math.random() * 0.4;
    rocketFlame.visible = capsuleFlame.visible = !!thrusting;
    rocketFlame.scale.set(1, flicker, 1);
    capsuleFlame.scale.set(1, flicker, 1);
    entryGlow.visible = kind === 'capsule' && v.phase === 'entry';
    panels.visible = !!v.panelsOpen;
    antenna.visible = !!v.antennaOpen;
    craft.position.set(x, y, 0);
    craft.rotation.set(0, 0, -angle); // sudut game searah jarum jam dari atas
    if (useSprite) updateRocketSprite(!!thrusting);
  }

  // ---------- Kamera ----------
  let frameKey = '';
  function frame(key, cx, cy, halfW, halfH) {
    if (key === frameKey) return;
    frameKey = key;
    const aspect = camera.aspect;
    const vfov = (camera.fov * Math.PI) / 180;
    const needH = Math.max(halfH, halfW / aspect);
    const dist = needH / Math.tan(vfov / 2);
    camera.position.set(cx, cy - Math.sin(TILT) * dist, Math.cos(TILT) * dist);
    controls.target.set(cx, cy, 0);
    controls.minDistance = dist * 0.3;
    controls.maxDistance = dist * 2.5;
    camera.up.set(0, 1, 0);
    home.pos.copy(camera.position);
    home.target.copy(controls.target);
    lookTarget.copy(controls.target);
    if (intro.mode === 'done') controls.update(); // selama adegan pembuka, kamera diatur stepIntro()
  }

  // ---------- Adegan pembuka peluncuran ----------
  // Sebelum lepas landas: kamera rendah dari arah selatan, menghadap utara ke Indonesia, roket berdiri di
  // Biak. Setelah Gas + pertama: pindah halus (~2 detik) ke tampilan atas biasa. Hanya kamera; fisika tidak tahu.
  const INTRO = {
    centerLat: 4, // sedikit di utara Indonesia: dari kamera yang miring, Indonesia jadi tepat di tengah layar
    centerLon: 118,
    elevationDeg: 35, // sudut pandang kamera dari permukaan
    halfW: 85, // lebar yang harus terlihat (u), cukup untuk Indonesia dan roket di Biak
    halfH: 62,
    moveMs: 2000,
    // Layar tegak (HP): kamera lebih tegak dan titik tengah lebih ke utara, supaya Indonesia di tengah
    // layar dan tidak tertutup HUD di atas.
    portrait: { centerLat: 12, elevationDeg: 50 },
  };
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const home = { pos: new THREE.Vector3(), target: new THREE.Vector3() }; // tampilan atas biasa (dari frame())
  const intro = { mode: 'intro', t0: 0, fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), fromUp: new THREE.Vector3() };
  const lookTarget = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  // Selama adegan pembuka dan perpindahan, kontrol kamera mati: klik/geser/zoom pemain tidak boleh
  // membuat kamera tertinggal menghadap Indonesia. Kontrol aktif lagi setelah tiba di tampilan atas.
  controls.enabled = false;
  // Arah dari pusat Bumi ke (lintang, bujur). Bidang orbit = ekuator, selatan = +z (kamera atas melihat kutub
  // selatan), timur searah jarum jam. Bujur Biak ada di sudut putar Bumi (landasan).
  function surfaceDir(latDeg, lonDeg, earthAngle) {
    const D = Math.PI / 180;
    const th = earthAngle + (lonDeg - LAUNCH_SITE.lon) * D;
    const c = Math.cos(latDeg * D);
    return new THREE.Vector3(c * Math.sin(th), c * Math.cos(th), -Math.sin(latDeg * D));
  }
  function introPose(earthAngle) {
    const D = Math.PI / 180;
    const cfg = camera.aspect < 1 ? { ...INTRO, ...INTRO.portrait } : INTRO;
    const radial = surfaceDir(cfg.centerLat, cfg.centerLon, earthAngle);
    const target = radial.clone().multiplyScalar(EARTH.radius);
    const south = new THREE.Vector3(0, 0, 1).addScaledVector(radial, -radial.z).normalize(); // arah selatan di permukaan
    const e = cfg.elevationDeg * D;
    const vfov = (camera.fov * Math.PI) / 180;
    const dist = Math.max(INTRO.halfH, INTRO.halfW / camera.aspect) / Math.tan(vfov / 2);
    const offset = south.multiplyScalar(Math.cos(e)).addScaledVector(radial, Math.sin(e));
    return { pos: target.clone().addScaledVector(offset, dist), target, up: radial };
  }
  function applyCamera(pos, target, up) {
    camera.position.copy(pos);
    camera.up.copy(up);
    lookTarget.copy(target);
    camera.lookAt(target);
  }
  // Dipanggil setiap frame tampilan orbit Bumi, sesudah frame(). true = kamera diatur di sini (lewati controls).
  function stepIntro(f, earthAngle) {
    if (intro.mode === 'done') return false;
    const onPad = f && f.status === 'pad' && !f.thrusting;
    if (intro.mode === 'intro') {
      if (onPad) {
        const p = introPose(earthAngle);
        applyCamera(p.pos, p.target, p.up);
        return true;
      }
      if (reducedMotion || !f) return finishIntro();
      intro.mode = 'moving';
      intro.t0 = performance.now();
      intro.fromPos.copy(camera.position);
      intro.fromTarget.copy(lookTarget);
      intro.fromUp.copy(camera.up);
    }
    const k = Math.min(1, (performance.now() - intro.t0) / INTRO.moveMs);
    if (k >= 1) return finishIntro();
    const s = k * k * (3 - 2 * k); // mulai dan berhenti pelan
    applyCamera(
      intro.fromPos.clone().lerp(home.pos, s),
      intro.fromTarget.clone().lerp(home.target, s),
      intro.fromUp.clone().lerp(WORLD_UP, s).normalize(),
    );
    return true;
  }
  function finishIntro() {
    intro.mode = 'done';
    controls.enabled = true;
    camera.up.copy(WORLD_UP);
    camera.position.copy(home.pos);
    controls.target.copy(home.target);
    lookTarget.copy(home.target);
    camera.lookAt(home.target);
    return false;
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      frameKey = ''; // bingkai ulang setelah ukuran berubah
    }
  }

  let nominalFor = null; // jalur target berbeda per level, jadi diisi ulang saat level berganti
  function draw(v) {
    // Level 3 setelah masuk orbit Bulan (tampilan samping) belum ada versi 3D.
    if (v.level === 3 && !v.space) return false;
    // Level 4 setelah peluncuran (perjalanan ke Mars sampai permukaan) belum ada versi 3D.
    if (v.level === 4 && !v.flight) return false;
    resize();
    // Level 3: peluncuran = tampilan orbit Bumi (ada v.flight), sesudahnya tampilan Bumi-Bulan.
    const cislunar = (v.level === 2 && v.phase !== 'launch') || (v.level === 3 && !v.flight);
    // Putaran Bumi mengikuti fisika (landasan dan stasiun Bumi ikut berputar).
    const ea = v.flight && v.flight.earthAngle !== undefined ? v.flight.earthAngle : v.earthAngle;
    if (ea !== undefined) localEarthAngle = ea;
    else localEarthAngle += EARTH.spin / 60;
    earthSpin.rotation.z = -localEarthAngle;
    const stationAngle = v.station ? v.station.angle : localEarthAngle; // cadangan: stasiun di landasan (Biak)
    station.position.set(Math.sin(stationAngle) * EARTH.radius, Math.cos(stationAngle) * EARTH.radius, 0);

    let introCam = false;
    if (cislunar && intro.mode !== 'done') {
      intro.mode = 'done'; // adegan pembuka hanya untuk peluncuran
      controls.enabled = true;
      camera.up.copy(WORLD_UP);
      frameKey = '';
    }
    if (cislunar) {
      // Level 3 mengirim kamera sendiri (mendekat ke Bulan saat masuk orbit). Bingkai diatur ulang hanya
      // saat kamera berubah, jadi pemain tetap bisa memutar pandangan saat kamera diam.
      const cam = v.camera;
      if (cam) frame(`moon3/${Math.round(cam.x)}/${Math.round(cam.y)}/${Math.round(cam.spanY)}`, cam.x, cam.y, (cam.spanX / 2) * 1.05, (cam.spanY / 2) * 1.03);
      else frame('moon', -112, 535, 400, 820);
      ringBand.visible = ringLine.visible = station.visible = false;
      if (coverage) coverage.visible = false;
      moon.visible = true;
      if (v.moonRing) {
        if (!moonRing || moonRing.userData.key !== `${v.moonRing.r}/${v.moonRing.tol}`) {
          if (moonRing) scene.remove(moonRing);
          moonRing = moonRingMesh(v.moonRing.r, v.moonRing.tol);
        }
        moonRing.visible = true;
        moonRing.userData.band.material.color.set(v.moonRing.ok ? COLORS.ringOk : COLORS.ring);
      } else if (moonRing) moonRing.visible = false;
      if (nominalFor !== v.level && v.nominal && v.nominal.length) {
        nominal.set(v.nominal);
        nominalFor = v.level;
      }
      nominal.line.visible = nominalFor === v.level;
      trail.set(v.trail);
      prediction.set(v.prediction);
      stationLink.set(null);
      showCraft(v.level === 3 ? 'rocket' : 'capsule', v, v.craft.x, v.craft.y, v.craft.angle, v.craft.thrusting);
    } else {
      if (moonRing) moonRing.visible = false;
      frame('earth', 0, 0, EARTH.orbitRadius * 1.3, EARTH.orbitRadius * 1.3);
      introCam = stepIntro(v.flight, localEarthAngle);
      moon.visible = false;
      nominal.line.visible = false;
      prediction.set(null);
      ringBand.visible = ringLine.visible = true;
      ringBand.material.color.set(v.flight && v.flight.inRing ? COLORS.ringOk : COLORS.ring);
      const stationOn = v.level === 1 && ['countdown', 'deploy', 'transmit'].includes(v.phase);
      station.visible = stationOn;
      if (stationOn && v.station && !coverage) coverage = coverageMesh(v.station.coverage);
      if (coverage) {
        coverage.visible = stationOn;
        coverage.rotation.z = -stationAngle;
        coverage.material.opacity = v.inPass ? 0.25 : 0.1;
      }
      stationLink.set(stationOn && v.inPass ? [station.position, v.flight] : null);
      trail.set(v.flight ? v.flight.trail : null);
      showCraft(v.released ? 'cubesat' : 'rocket', v, v.flight.x, v.flight.y, v.flight.angle, v.flight.thrusting);
    }

    // Model diperbesar saat kamera jauh (Level 2) supaya wahana tetap terlihat. Tidak sesuai skala.
    const d = camera.position.distanceTo(craft.position);
    const s = Math.max(1, d / 650);
    craft.scale.set(s, s, s);

    if (!introCam) controls.update();
    updateAtmosphere();
    renderer.render(scene, camera);
    return true;
  }

  function dispose() {
    controls.dispose();
    renderer.dispose();
  }

  return { draw, dispose };
}
