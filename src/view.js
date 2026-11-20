// The scenery: ground, road, kerbs, walls, start line, banner, far hills and whatever stands
// around, all made in code from the track's theme.
import * as THREE from '../vendor/three.module.min.js';
import { locate, pointAt } from './sim/track.js';
import { makeRng } from './sim/rng.js';

// Small drawn textures, smoothed when stretched (the blurry look of the era) and never mipmapped.
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A strip that follows the track between two sideways offsets (and two heights).
function ribbon(tr, offA, offB, yA, yB, vLen, mat) {
  const N = tr.N, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const k = i % N, x = tr.px[k], z = tr.pz[k], rx = tr.tz[k], rz = -tr.tx[k], v = (i * tr.step) / vLen;
    pos.push(x + rx * offA, yA, z + rz * offA, x + rx * offB, yB, z + rz * offB);
    uv.push(0, v, 1, v);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// Flat cut-outs that always face the camera. Each: [width, height, how to draw it on a 32x48 canvas].
const PROPS = {
  tree: [0.67, [6, 10], (c) => {
    c.fillStyle = '#6a4020'; c.fillRect(13, 30, 6, 18);
    c.fillStyle = '#1f7a28'; c.beginPath(); c.arc(16, 18, 15, 0, 7); c.fill();
    c.fillStyle = '#2f9a38'; c.beginPath(); c.arc(13, 14, 9, 0, 7); c.fill();
  }],
  palm: [0.67, [8, 12], (c) => {
    c.strokeStyle = '#8a6030'; c.lineWidth = 4; c.beginPath(); c.moveTo(14, 48); c.quadraticCurveTo(12, 28, 17, 14); c.stroke();
    c.strokeStyle = '#2a9a40'; c.lineWidth = 4; c.lineCap = 'round';
    for (const [x, y] of [[2, 16], [5, 5], [16, 1], [28, 6], [31, 17]]) { c.beginPath(); c.moveTo(17, 13); c.quadraticCurveTo((17 + x) / 2, y - 5, x, y); c.stroke(); }
  }],
  cactus: [0.67, [4, 7], (c) => {
    c.strokeStyle = '#2f8a48'; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(16, 46); c.lineTo(16, 8); c.stroke();
    c.lineWidth = 5; c.beginPath(); c.moveTo(16, 30); c.lineTo(5, 30); c.lineTo(5, 18); c.moveTo(16, 24); c.lineTo(27, 24); c.lineTo(27, 12); c.stroke();
  }],
  cow: [1.4, [2.2, 2.8], (c) => {
    c.fillStyle = '#f4f0e8'; c.fillRect(4, 20, 22, 14); c.fillRect(22, 14, 9, 10); c.fillRect(6, 34, 4, 12); c.fillRect(20, 34, 4, 12);
    c.fillStyle = '#181818'; c.fillRect(8, 22, 7, 6); c.fillRect(17, 27, 6, 5); c.fillRect(28, 17, 2, 2);
    c.fillStyle = '#f0a0a8'; c.fillRect(27, 21, 4, 3);
  }],
  hay: [1.3, [2.4, 3], (c) => {
    c.fillStyle = '#e0b840'; c.beginPath(); c.arc(16, 30, 15, 0, 7); c.fill();
    c.strokeStyle = '#b89028'; c.lineWidth = 2; c.beginPath(); c.arc(16, 30, 9, 0, 7); c.stroke(); c.beginPath(); c.arc(16, 30, 3, 0, 7); c.stroke();
  }],
  rock: [1.3, [2, 5], (c) => {
    c.fillStyle = '#9a5a38'; c.beginPath(); c.moveTo(1, 47); c.lineTo(6, 22); c.lineTo(16, 14); c.lineTo(27, 24); c.lineTo(31, 47); c.fill();
    c.fillStyle = '#b87048'; c.beginPath(); c.moveTo(6, 22); c.lineTo(16, 14); c.lineTo(15, 47); c.lineTo(1, 47); c.fill();
  }],
};

export function buildWorld(tr) {
  const th = tr.def.theme;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.fog, 50, 230);
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
  sun.position.set(40, 80, 20);
  scene.add(sun);
  const rng = makeRng(64 + tr.N);
  const lam = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, ...o });

  // The ground, in the two-tone squares every racing game of the time had. It sits well below the
  // road, in many pieces and nudged back in depth: as one huge square just under the road it could
  // win the depth test from some angles and paint over the whole track.
  const groundTex = canvasTex(16, 16, (c) => {
    c.fillStyle = th.ground[0]; c.fillRect(0, 0, 16, 16);
    c.fillStyle = th.ground[1]; c.fillRect(0, 0, 8, 8); c.fillRect(8, 8, 8, 8);
  });
  const groundMat = lam({ map: groundTex, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });
  let ground;
  if (th.sea) {
    // An island: a disc of sand with the sea beneath and beyond it.
    groundTex.repeat.set(18, 18);
    ground = new THREE.Mesh(new THREE.RingGeometry(0.01, 120, 40, 10), groundMat);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 12, 12), lam({ color: th.sea }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6;
    scene.add(sea);
  } else {
    groundTex.repeat.set(50, 50);
    ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 28, 28), groundMat);
  }
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.15;
  scene.add(ground);

  const roadTex = canvasTex(32, 32, (c) => {
    c.fillStyle = th.road[0]; c.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 120; i++) {
      c.fillStyle = th.road[rng() < 0.5 ? 1 : 2];
      c.fillRect(Math.floor(rng() * 32), Math.floor(rng() * 32), 1, 1);
    }
    if (th.line) { c.fillStyle = th.line; c.fillRect(15, 0, 2, 16); }
  });
  scene.add(ribbon(tr, -tr.hw, tr.hw, 0, 0, 6, lam({ map: roadTex })));

  const kerbTex = canvasTex(4, 8, (c) => {
    c.fillStyle = th.kerb[0]; c.fillRect(0, 0, 4, 8);
    c.fillStyle = th.kerb[1]; c.fillRect(0, 0, 4, 4);
  });
  const kerbMat = lam({ map: kerbTex });
  const wallTex = canvasTex(16, 8, (c) => {
    c.fillStyle = th.wall[0]; c.fillRect(0, 0, 16, 8);
    c.fillStyle = th.wall[1]; c.fillRect(0, 0, 16, 4);
    c.fillStyle = '#202020'; c.fillRect(0, 7, 16, 1);
  });
  wallTex.rotation = Math.PI / 2;
  const wallMat = lam({ map: wallTex });
  for (const s of [-1, 1]) {
    scene.add(ribbon(tr, s * tr.hw, s * (tr.hw + 1), 0.01, 0.01, 3, kerbMat));
    scene.add(ribbon(tr, s * (tr.hw + 1), s * (tr.hw + 1), -0.2, 0.9, 4, wallMat));
  }

  // Start line and the banner over it.
  const st = pointAt(tr, 0, 0), yaw = Math.atan2(st.tx, st.tz);
  const chk = canvasTex(16, 4, (c) => {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; c.fillRect(x, y, 1, 1); }
  });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(tr.hw * 2, 1.6), lam({ map: chk }));
  line.rotation.set(-Math.PI / 2, 0, 0);
  const lineG = new THREE.Group();
  lineG.add(line); lineG.position.set(st.x, 0.02, st.z); lineG.rotation.y = yaw;
  scene.add(lineG);
  const banTex = canvasTex(256, 32, (c) => {
    c.fillStyle = '#c82020'; c.fillRect(0, 0, 256, 32);
    c.fillStyle = '#f8e030'; c.fillRect(0, 0, 256, 3); c.fillRect(0, 29, 256, 3);
    c.font = 'italic 900 22px "Arial Black", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#201008'; c.fillText('WORM SQUIRM 64', 130, 18);
    c.fillStyle = '#fff8d0'; c.fillText('WORM SQUIRM 64', 128, 16);
  });
  const ban = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.BoxGeometry(tr.hw * 2 + 4, 2, 0.4),
    [0, 1, 2, 3].map(() => lam({ color: 0x901818 })).concat([lam({ map: banTex }), lam({ map: banTex })]));
  beam.position.y = 7;
  ban.add(beam);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), lam({ color: 0xd8d8e0 }));
    post.position.set(s * (tr.hw + 1.7), 4, 0);
    ban.add(post);
  }
  ban.position.set(st.x, 0, st.z); ban.rotation.y = yaw;
  scene.add(ban);

  // Things standing around, kept clear of the road.
  for (const [kind, count] of th.props) {
    const [aspect, [h0, h1], draw] = PROPS[kind];
    const mat = new THREE.SpriteMaterial({ map: canvasTex(32, 48, (c) => { c.clearRect(0, 0, 32, 48); draw(c); }), alphaTest: 0.5 });
    for (let i = 0, made = 0; i < count * 6 && made < count; i++) {
      const x = rng.range(-95, 95), z = rng.range(-85, 85), l = locate(tr, x, z, -1);
      if (Math.hypot(x - tr.px[l.i], z - tr.pz[l.i]) < tr.hw + 4) continue;
      const s = new THREE.Sprite(mat), h = rng.range(h0, h1);
      s.scale.set(h * aspect, h, 1); s.position.set(x, h / 2 - 0.1, z);
      scene.add(s); made++;
    }
  }
  const hillMat = new THREE.MeshLambertMaterial({ color: th.hill, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rng.range(-0.15, 0.15), r = rng.range(150, 200), h = rng.range(25, 55);
    const hill = new THREE.Mesh(th.mesa ? new THREE.CylinderGeometry(h * 0.6, h * 0.9, h * 0.7, 7) : new THREE.ConeGeometry(h * 1.4, h, 6), hillMat);
    hill.position.set(Math.cos(a) * r, (th.mesa ? h * 0.35 : h / 2) - 1, Math.sin(a) * r); hill.rotation.y = rng() * 3;
    scene.add(hill);
  }
  return scene;
}

// Frees what a scene holds on the graphics card, when a race is thrown away.
export function disposeWorld(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}
