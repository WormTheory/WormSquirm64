// A small, chunky picture of each worm for the select screens: the real model, drawn tiny
// (40 pixels square) so that it comes out pixelated when shown larger.
import * as THREE from '../vendor/three.module.min.js';
import { CHARS } from './characters.js';
import { WormView } from './wormview.js';

const SIZE = 40;

export function makePortraits(renderer, bufW, bufH) {
  const size = Math.min(SIZE, bufW, bufH), out = [];
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  cam.position.set(1.9, 2.6, 4.3);
  cam.lookAt(-0.55, 0.3, -0.45);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c2 = cv.getContext('2d');
  for (const char of CHARS) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c2c50);
    scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.8);
    sun.position.set(2, 5, 4);
    scene.add(sun);
    const view = new WormView(char, scene), w = { x: 0.5, z: 0.6, aim: 0, count: 0, taps: 0, idx: 0, action: null };
    view.reset(w);
    // Curl the body round behind the head, so all of it fits in the picture.
    for (let i = 0; i < view.px.length; i++) { const a = i * 0.36; view.px[i] = 0.5 - 1.4 * (1 - Math.cos(a)); view.pz[i] = 0.6 - 1.4 * Math.sin(a); }
    view.update(w, 0.4);
    renderer.setViewport(0, 0, size, size); renderer.setScissor(0, 0, size, size);
    renderer.render(scene, cam);
    // Copied straight off the game's own picture, before anything else is drawn over it.
    c2.drawImage(renderer.domElement, 0, bufH - size, size, size, 0, 0, size, size);
    out.push(cv.toDataURL());
    scene.traverse((o) => { if (o.material && o.geometry && o.geometry.type !== 'SphereGeometry' && o.geometry.type !== 'CircleGeometry') o.geometry.dispose(); });
  }
  return out;
}
