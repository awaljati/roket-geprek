// Tampilan 3D (Three.js). Fisika tetap 2D: posisi diambil dari snapshot yang sama dengan render2d.
// Bidang permainan = bidang XY (y ke atas), kamera melihat dari +Z dengan sedikit miring.
// Bentuknya sama dengan render2d: createRenderer(canvas) -> { draw(view), dispose() }.
//
// Tekstur NASA dibaca dari public/assets/textures/ (bumi.jpg, bulan.jpg). Kalau belum ada, planet berwarna polos.

import { EARTH, ROCKET_TUNING } from '../engine/flight.js';
import { CISLUNAR } from '../engine/cislunar.js';

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
  earth.rotation.set(-Math.PI / 2, 0, 0);
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

  // ---------- Wahana (gambar datar yang selalu menghadap kamera) ----------
  const craftCanvas = document.createElement('canvas');
  craftCanvas.width = craftCanvas.height = 128;
  const craftTex = new THREE.CanvasTexture(craftCanvas);
  craftTex.colorSpace = THREE.SRGBColorSpace;
  const craftMat = new THREE.SpriteMaterial({ map: craftTex, depthTest: false, transparent: true });
  const craft = new THREE.Sprite(craftMat);
  craft.renderOrder = 10;
  scene.add(craft);
  let craftKey = '';

  function drawCraft(kind, v) {
    const thrust = kind === 'capsule' ? v.craft.thrusting : v.flight && v.flight.thrusting;
    const flicker = thrust ? Math.floor(performance.now() / 60) % 3 : 0;
    const key = [kind, thrust, flicker, v.panelsOpen, v.antennaOpen, v.phase].join('|');
    // Roket berdiri di ekornya (titik posisi = ekor); CubeSat dan kapsul di tengahnya.
    craft.center.set(0.5, kind === 'rocket' ? 1 - 92 / 128 : 0.5);
    if (key === craftKey) return;
    craftKey = key;
    const c = craftCanvas.getContext('2d');
    c.clearRect(0, 0, 128, 128);
    c.save();
    c.translate(64, 64);
    const flame = (y) => {
      c.fillStyle = '#ff8a3d';
      c.beginPath();
      c.moveTo(-8, y);
      c.lineTo(8, y);
      c.lineTo(0, y + 22 + flicker * 6);
      c.fill();
    };
    if (kind === 'cubesat') {
      c.fillStyle = '#c9c9c9';
      c.fillRect(-12, -12, 24, 24);
      c.strokeStyle = '#777';
      c.strokeRect(-12, -12, 24, 24);
      if (v.panelsOpen) {
        c.fillStyle = '#3a6fd8';
        c.fillRect(-46, -6, 30, 12);
        c.fillRect(16, -6, 30, 12);
      }
      if (v.antennaOpen) {
        c.strokeStyle = '#eee';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(0, -12);
        c.lineTo(0, -40);
        c.stroke();
      }
    } else if (kind === 'capsule') {
      if (thrust) flame(24);
      if (v.phase === 'entry') {
        c.fillStyle = 'rgba(255,140,40,0.85)';
        c.beginPath();
        c.arc(0, 28, 26, 0, Math.PI);
        c.fill();
      }
      c.fillStyle = '#f2f2f2';
      c.beginPath();
      c.moveTo(0, -24);
      c.lineTo(18, 20);
      c.lineTo(-18, 20);
      c.closePath();
      c.fill();
      c.fillStyle = '#7a4a2a';
      c.fillRect(-18, 20, 36, 7);
    } else {
      if (thrust) flame(28);
      c.fillStyle = '#f2f2f2';
      c.beginPath();
      c.moveTo(0, -36);
      c.lineTo(12, -12);
      c.lineTo(12, 28);
      c.lineTo(-12, 28);
      c.lineTo(-12, -12);
      c.closePath();
      c.fill();
      c.fillStyle = '#ff8a3d';
      c.fillRect(-12, 18, 24, 5);
    }
    c.restore();
    craftTex.needsUpdate = true;
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
      drawCraft('capsule', v);
      craft.position.set(v.craft.x, v.craft.y, 0);
      craftMat.rotation = -v.craft.angle;
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
      drawCraft(v.released ? 'cubesat' : 'rocket', v);
      craft.position.set(v.flight.x, v.flight.y, 0);
      craftMat.rotation = -v.flight.angle;
    }

    // Ukuran wahana tetap terbaca berapa pun jarak kamera
    const d = camera.position.distanceTo(craft.position);
    const s = d * 0.045;
    craft.scale.set(s, s, 1);

    controls.update();
    renderer.render(scene, camera);
  }

  function dispose() {
    controls.dispose();
    renderer.dispose();
  }

  return { draw, dispose };
}
