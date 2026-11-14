// Tampilan 3D (Three.js). Fisika tetap 2D: posisi diambil dari snapshot yang sama dengan render2d.
// Bidang permainan = bidang XY (y ke atas), kamera melihat dari +Z dengan sedikit miring.
// Bentuknya sama dengan render2d: createRenderer(canvas) -> { draw(view), dispose() }.
//
// Tekstur NASA dibaca dari public/assets/textures/ (bumi.jpg, bulan.jpg). Kalau belum ada, planet berwarna polos.

import { EARTH, ROCKET_TUNING } from '../engine/flight.js';
import { CISLUNAR } from '../engine/cislunar.js';
import { LAUNCH_SITE } from '../data/levels.js';

const TEXTURES = { earth: '/assets/textures/bumi.jpg', moon: '/assets/textures/bulan.jpg' };
const COLORS = {
  earth: 0x2a6bc0,
  atmosphere: 0x7fb6ff,
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
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH.radius * 1.06, 48, 24),
    new THREE.MeshBasicMaterial({ color: COLORS.atmosphere, transparent: true, opacity: 0.16, side: THREE.BackSide }),
  );
  scene.add(atmosphere);
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

  // Stasiun Bumi Level 1
  const station = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), new THREE.MeshBasicMaterial({ color: COLORS.station }));
  scene.add(station);
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

  const craft = new THREE.Group();
  craft.add(rocket, capsule, cubesat);
  scene.add(craft);

  function showCraft(kind, v, x, y, angle, thrusting) {
    rocket.visible = kind === 'rocket';
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
    controls.update();
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

  let nominalSet = false;
  function draw(v) {
    resize();
    const cislunar = v.level === 2 && v.phase !== 'launch';
    // Putaran Bumi mengikuti fisika (landasan dan stasiun Bumi ikut berputar).
    const ea = v.flight && v.flight.earthAngle !== undefined ? v.flight.earthAngle : v.earthAngle;
    if (ea !== undefined) localEarthAngle = ea;
    else localEarthAngle += EARTH.spin / 60;
    earthSpin.rotation.z = -localEarthAngle;
    const stationAngle = Math.PI / 4 + localEarthAngle;
    station.position.set(Math.sin(stationAngle) * EARTH.radius, Math.cos(stationAngle) * EARTH.radius, 0);

    if (cislunar) {
      frame('moon', -112, 535, 400, 820);
      ringBand.visible = ringLine.visible = station.visible = false;
      moon.visible = true;
      if (!nominalSet && v.nominal && v.nominal.length) {
        nominal.set(v.nominal);
        nominalSet = true;
      }
      nominal.line.visible = true;
      trail.set(v.trail);
      prediction.set(v.prediction);
      stationLink.set(null);
      showCraft('capsule', v, v.craft.x, v.craft.y, v.craft.angle, v.craft.thrusting);
    } else {
      frame('earth', 0, 0, EARTH.orbitRadius * 1.3, EARTH.orbitRadius * 1.3);
      moon.visible = false;
      nominal.line.visible = false;
      prediction.set(null);
      ringBand.visible = ringLine.visible = true;
      ringBand.material.color.set(v.flight && v.flight.inRing ? COLORS.ringOk : COLORS.ring);
      const stationOn = v.level === 1 && ['countdown', 'deploy', 'transmit'].includes(v.phase);
      station.visible = stationOn;
      stationLink.set(stationOn && v.inPass ? [station.position, v.flight] : null);
      trail.set(v.flight ? v.flight.trail : null);
      showCraft(v.released ? 'cubesat' : 'rocket', v, v.flight.x, v.flight.y, v.flight.angle, v.flight.thrusting);
    }

    // Model diperbesar saat kamera jauh (Level 2) supaya wahana tetap terlihat. Tidak sesuai skala.
    const d = camera.position.distanceTo(craft.position);
    const s = Math.max(1, d / 650);
    craft.scale.set(s, s, s);

    controls.update();
    renderer.render(scene, camera);
  }

  function dispose() {
    controls.dispose();
    renderer.dispose();
  }

  return { draw, dispose };
}
