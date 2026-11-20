// The scenery: road, kerbs, walls, start line, banner, trees and hills, all made in code.
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

export function buildWorld(tr) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x78b8f8);
  scene.fog = new THREE.Fog(0xa8d0f8, 50, 230);
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
  sun.position.set(40, 80, 20);
  scene.add(sun);
  const rng = makeRng(64);
  const lam = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, ...o });

  // Grass, in the two-tone squares every racing game of the time had.
  const grassTex = canvasTex(16, 16, (c) => {
    c.fillStyle = '#3fa838'; c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#4cb843'; c.fillRect(0, 0, 8, 8); c.fillRect(8, 8, 8, 8);
  });
  grassTex.repeat.set(50, 50);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), lam({ map: grassTex }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.03;
  scene.add(grass);

  const roadTex = canvasTex(32, 32, (c) => {
    c.fillStyle = '#6a6a72'; c.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 120; i++) {
      c.fillStyle = rng() < 0.5 ? '#5e5e66' : '#767680';
      c.fillRect(Math.floor(rng() * 32), Math.floor(rng() * 32), 1, 1);
    }
    c.fillStyle = '#e8e0a0'; c.fillRect(15, 0, 2, 16);
  });
  scene.add(ribbon(tr, -tr.hw, tr.hw, 0, 0, 6, lam({ map: roadTex })));

  const kerbTex = canvasTex(4, 8, (c) => {
    c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, 4, 8);
    c.fillStyle = '#d83028'; c.fillRect(0, 0, 4, 4);
  });
  const kerbMat = lam({ map: kerbTex });
  const wallTex = canvasTex(16, 8, (c) => {
    c.fillStyle = '#f0d020'; c.fillRect(0, 0, 16, 8);
    c.fillStyle = '#2850c8'; c.fillRect(0, 0, 16, 4);
    c.fillStyle = '#202020'; c.fillRect(0, 7, 16, 1);
  });
  wallTex.rotation = Math.PI / 2;
  const wallMat = lam({ map: wallTex });
  for (const s of [-1, 1]) {
    scene.add(ribbon(tr, s * tr.hw, s * (tr.hw + 1), 0.01, 0.01, 3, kerbMat));
    scene.add(ribbon(tr, s * (tr.hw + 1), s * (tr.hw + 1), 0, 0.9, 4, wallMat));
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

  // Flat cut-out trees that always face the camera, and a ring of far hills.
  const treeTex = canvasTex(32, 48, (c) => {
    c.clearRect(0, 0, 32, 48);
    c.fillStyle = '#6a4020'; c.fillRect(13, 30, 6, 18);
    c.fillStyle = '#1f7a28'; c.beginPath(); c.arc(16, 18, 15, 0, 7); c.fill();
    c.fillStyle = '#2f9a38'; c.beginPath(); c.arc(13, 14, 9, 0, 7); c.fill();
  });
  const treeMat = new THREE.SpriteMaterial({ map: treeTex, alphaTest: 0.5 });
  for (let i = 0, made = 0; i < 400 && made < 70; i++) {
    const x = rng.range(-95, 95), z = rng.range(-85, 85), l = locate(tr, x, z, -1);
    if (Math.hypot(x - tr.px[l.i], z - tr.pz[l.i]) < tr.hw + 5) continue;
    const t = new THREE.Sprite(treeMat), h = rng.range(6, 10);
    t.scale.set(h * 0.67, h, 1); t.position.set(x, h / 2, z);
    scene.add(t); made++;
  }
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x2f8a40, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rng.range(-0.15, 0.15), r = rng.range(150, 200), h = rng.range(25, 55);
    const hill = new THREE.Mesh(new THREE.ConeGeometry(h * 1.4, h, 6), hillMat);
    hill.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r); hill.rotation.y = rng() * 3;
    scene.add(hill);
  }
  return scene;
}
