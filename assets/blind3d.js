/* Indo Home Collective — 3D timber slat blind.
 *
 * One procedural blind model (slats, cords, rails, a roll that winds up like the
 * real thing) shared by two views:
 *   createHero()   — transparent canvas over the home-page hero; scroll raises it
 *   createViewer() — orbitable preview on the product page with a garden backdrop
 *
 * Loaded on demand with import() — never part of the first page load. Needs
 * /assets/vendor/three.module.min.js (three.js r160, MIT licence).
 * Units are arbitrary: pixels in the hero, centimetres in the viewer.
 */
import * as THREE from '/assets/vendor/three.module.min.js';

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- support */
export function webglOk(){
  try{
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if(!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if(lose) lose.loseContext();
    return true;
  }catch(e){ return false; }
}

/* ---------------------------------------------------------------- palette */
const PAL = {
  Natural:{ base:'#9a6340', dark:'#58361f', light:'#c68f60', tint:0.09, rail:'#6a4125', cord:'#3b2618' },
  White:  { base:'#ebe8e1', dark:'#b9b4a8', light:'#fcfbf8', tint:0.035, rail:'#d6d1c6', cord:'#cfc9bb' },
  Black:  { base:'#2b2724', dark:'#0f0d0c', light:'#4b4540', tint:0.05, rail:'#171412', cord:'#0c0b0a' }
};
export const COLOURS = Object.keys(PAL);

function hexToRgb(h){ const n = parseInt(h.slice(1), 16); return [(n>>16)&255, (n>>8)&255, n&255]; }
function rgba(h, a){ const [r,g,b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h, k){ // k in [-1,1]: darker .. lighter
  const [r,g,b] = hexToRgb(h);
  const f = c => Math.max(0, Math.min(255, Math.round(k >= 0 ? c + (255-c)*k : c*(1+k))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function mulberry32(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* A strip of timber: 1024x64 canvas covering ~120 units of slat length. */
function woodTexture(name, seed){
  const p = PAL[name];
  const rnd = mulberry32(seed * 7919 + name.length * 104729);
  const w = 1024, h = 64;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = shade(p.base, (rnd() - 0.5) * 2 * p.tint);
  g.fillRect(0, 0, w, h);
  // broad tonal bands, like growth rings seen side-on
  for(let i = 0; i < 7; i++){
    const y = rnd() * h, hh = 5 + rnd() * 17;
    const gr = g.createLinearGradient(0, y - hh, 0, y + hh);
    const col = rnd() < 0.5 ? p.dark : p.light;
    gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, 0.13 + rnd() * 0.12)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, y - hh, w, hh * 2);
  }
  // fine grain streaks
  for(let i = 0; i < 230; i++){
    const y = rnd() * h, x = rnd() * w, len = 50 + rnd() * 540, t = 0.4 + rnd() * 1.3;
    g.fillStyle = rgba(rnd() < 0.62 ? p.dark : p.light, 0.05 + rnd() * 0.17);
    g.fillRect(x, y, len, t);
    if(x + len > w) g.fillRect(x - w, y, len, t);
  }
  // an occasional knot
  if(rnd() < 0.4 && name !== 'Black'){
    const kx = 80 + rnd() * (w - 160), ky = 14 + rnd() * (h - 28);
    g.save(); g.translate(kx, ky); g.scale(1, 0.3);
    const kg = g.createRadialGradient(0, 0, 1, 0, 0, 26);
    kg.addColorStop(0, rgba(p.dark, 0.55)); kg.addColorStop(0.55, rgba(p.dark, 0.25)); kg.addColorStop(1, rgba(p.dark, 0));
    g.fillStyle = kg; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill(); g.restore();
  }
  // softly rounded edges so neighbouring slats read as separate pieces
  const top = g.createLinearGradient(0, 0, 0, 7);
  top.addColorStop(0, 'rgba(0,0,0,0.30)'); top.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = top; g.fillRect(0, 0, w, 7);
  const bot = g.createLinearGradient(0, h - 9, 0, h);
  bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = bot; g.fillRect(0, h - 9, w, 9);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/* ------------------------------------------------------------------ blind */
const BOX = new THREE.BoxGeometry(1, 1, 1);

class Blind{
  /* o: {W, D, P, th, colour, aniso} — width, drop (cloth length), slat pitch, slat thickness */
  constructor(o){
    this.o = o;
    this.group = new THREE.Group();
    this.colour = o.colour in PAL ? o.colour : 'Natural';
    this.raise = 0;
    this._build();
  }

  _build(){
    const {W, D, P, th} = this.o;
    this.W = W; this.P = P; this.th = th;
    this.sh = P * 0.8;                       // slat height (the rest of the pitch is the gap)
    this.railH = P * 1.15;
    this.n = Math.max(2, Math.floor((D - this.railH) / P));
    this.D = this.n * P + this.railH;        // cloth length actually built
    this.R0 = P * 0.55 + th * 0.4;           // core radius of the roll
    this.Tw = th * 1.3;                      // radial growth per wrap when rolled
    this.headroom = P * 0.9;
    // largest roll that still fits under the head rail:  A + Rout(A) <= D - headroom
    let lo = 0, hi = this.D;
    for(let i = 0; i < 40; i++){ const m = (lo + hi) / 2; (m + this._rout(m) <= this.D - this.headroom) ? lo = m : hi = m; }
    this.Amax = lo;

    this._mats = this._makeMats(this.colour);
    this.slats = [];
    for(let i = 0; i < this.n; i++){
      const m = new THREE.Mesh(BOX, this._mats.slat[i % this._mats.slat.length]);
      m.userData.s = i * P + P / 2; m.userData.len = this.sh; m.castShadow = true; m.receiveShadow = true;
      m.scale.set(W, this.sh, th);
      this.group.add(m); this.slats.push(m);
    }
    this.rail = new THREE.Mesh(BOX, this._mats.rail);
    this.rail.userData.s = this.n * P + this.railH / 2; this.rail.userData.len = this.railH;
    this.rail.scale.set(W, this.railH, th * 1.9); this.rail.castShadow = true; this.rail.receiveShadow = true;
    this.group.add(this.rail);

    const cw = Math.max(P * 0.07, 0.12);
    const k = Math.max(2, Math.round(W / (P * 22)));
    this.cords = [];
    for(let j = 0; j < k; j++){
      const c = new THREE.Mesh(BOX, this._mats.cord);
      c.userData.x = -W / 2 + W * (j + 0.5) / k; c.scale.x = cw; c.scale.z = cw;
      this.group.add(c); this.cords.push(c);
    }
    this.head = new THREE.Mesh(BOX, this._mats.rail);   // head rail the blind hangs from
    this.head.scale.set(W + P * 1.5, P * 1.3, th * 3.2);
    this.head.position.set(0, P * 0.65, -th * 0.4);
    this.head.castShadow = true;
    this.group.add(this.head);
    this._applyTextureRepeat();
    this.setRaise(this.raise);
  }

  _rout(A){ return Math.sqrt(this.R0 * this.R0 + A * this.Tw / Math.PI); }

  _makeMats(name){
    const p = PAL[name];
    const tex = [], slat = [];
    for(let i = 0; i < 6; i++){
      const t = woodTexture(name, i + 1);
      if(this.o.aniso) t.anisotropy = this.o.aniso;
      tex.push(t);
      slat.push(new THREE.MeshStandardMaterial({ map: t, roughness: 0.74, metalness: 0 }));
    }
    return {
      tex, slat,
      rail: new THREE.MeshStandardMaterial({ color: p.rail, roughness: 0.62, metalness: 0 }),
      cord: new THREE.MeshStandardMaterial({ color: p.cord, roughness: 0.9, metalness: 0 })
    };
  }

  _disposeMats(m){
    m.tex.forEach(t => t.dispose()); m.slat.forEach(x => x.dispose()); m.rail.dispose(); m.cord.dispose();
  }

  _applyTextureRepeat(){ this._mats.tex.forEach(t => t.repeat.set(this.W / (this.o.texSpan || 120), 1)); }

  setColour(name){
    if(!(name in PAL) || name === this.colour) return;
    const old = this._mats;
    this.colour = name;
    this._mats = this._makeMats(name);
    this._applyTextureRepeat();
    this.slats.forEach((m, i) => { m.material = this._mats.slat[i % this._mats.slat.length]; });
    this.rail.material = this._mats.rail; this.head.material = this._mats.rail;
    this.cords.forEach(c => { c.material = this._mats.cord; });
    this._disposeMats(old);
  }

  /* r: 0 = fully lowered, 1 = rolled up as far as it goes */
  setRaise(r){
    r = Math.max(0, Math.min(1, r));
    this.raise = r;
    const A = r * this.Amax, L = this.D - A, R = this._rout(A);
    const place = (m) => {
      const s = m.userData.s;
      if(s <= L){ m.position.set(0, -s, 0); m.rotation.x = 0; return; }
      const a = s - L;
      const ra = Math.sqrt(Math.max(R * R - a * this.Tw / Math.PI, this.R0 * this.R0));
      const t = TAU * (R - ra) / this.Tw;
      m.position.set(0, -L - ra * Math.sin(t), R - ra * Math.cos(t));
      m.rotation.x = -t;
    };
    this.slats.forEach(place); place(this.rail);
    this.cords.forEach(c => {
      c.scale.y = Math.max(L, 0.001);
      c.position.set(c.userData.x, -L / 2, this.th * 0.5 + c.scale.x * 0.5);
    });
  }

  /* rebuild at a new size, keeping colour and raise */
  resize(W, D, P, th){
    const r = this.raise;
    this.group.remove(...this.group.children);
    this._disposeMats(this._mats);
    Object.assign(this.o, { W, D, P: P || this.o.P, th: th || this.o.th });
    this.raise = r;
    this._build();
  }

  dispose(){ this._disposeMats(this._mats); }
}

/* ------------------------------------------------------- shared renderer */
function makeRenderer(canvas, { alpha, shadows, pixelRatioCap }){
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: !!alpha, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap || 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if(alpha) renderer.setClearColor(0x000000, 0);
  if(shadows){ renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  return renderer;
}

const prefersReduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.max(0, Math.min(1, t));

/* Frame loop that only runs while something is moving. */
function makeLoop(step){
  let raf = 0, last = 0, visible = true;
  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const more = step(dt);
    if(more && visible && !document.hidden) raf = requestAnimationFrame(frame); else last = 0;
  };
  return {
    wake(){ if(!raf && visible && !document.hidden){ last = 0; raf = requestAnimationFrame(frame); } },
    setVisible(v){ visible = v; if(v) this.wake(); },
    stop(){ if(raf) cancelAnimationFrame(raf); raf = 0; }
  };
}

/* ------------------------------------------------------------------ HERO */
/* The blind covers the hero stage; progress 0..1 (scroll) rolls it up. */
export function createHero(canvas, stage, opts = {}){
  const FOV = 24;
  const renderer = makeRenderer(canvas, { alpha: true, pixelRatioCap: 1.6 });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0xb99a7c, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(-0.55, 0.9, 1.1); scene.add(sun);

  let blind = null, w = 0, h = 0, dist = 1;
  let target = 1, cur = 1, age = 0;             // start rolled up, then lower into place
  let px = 0, py = 0, tpx = 0, tpy = 0;         // pointer parallax
  const colour = opts.colour || 'Natural';
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const toRaise = p => smooth(clamp01(p / 0.94));

  function layout(){
    const r = stage.getBoundingClientRect();
    const nw = Math.max(280, Math.round(r.width)), nh = Math.max(280, Math.round(r.height));
    if(nw === w && nh === h && blind) return;
    w = nw; h = nh;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    dist = (h / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.near = dist * 0.2; camera.far = dist * 3;
    camera.updateProjectionMatrix();
    const P = Math.round(Math.min(30, Math.max(17, h / 30)));
    const spec = { W: w * 1.14, D: h * 0.965, P, th: P * 0.55, colour, aniso, texSpan: 140 };
    if(blind){ scene.remove(blind.group); blind.dispose(); }
    blind = new Blind(spec);
    blind.group.position.set(0, h / 2, 0);
    scene.add(blind.group);
    blind.setRaise(cur);
  }

  function step(dt){
    age += dt;
    const k = age < 2.4 ? 2.3 : 7;               // gentle drop on arrival, then follow the scroll closely
    cur += (target - cur) * (1 - Math.exp(-dt * k));
    px += (tpx - px) * (1 - Math.exp(-dt * 4)); py += (tpy - py) * (1 - Math.exp(-dt * 4));
    blind.setRaise(cur);
    camera.position.set(px * dist * 0.03, py * dist * 0.02 + dist * 0.05, dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return Math.abs(target - cur) > 0.0006 || Math.abs(tpx - px) > 0.0008 || Math.abs(tpy - py) > 0.0008 || age < 2.4;
  }
  const loop = makeLoop(step);

  layout();
  const ro = new ResizeObserver(() => { layout(); loop.wake(); });
  ro.observe(stage);
  const io = new IntersectionObserver(es => loop.setVisible(es[0].isIntersecting), { threshold: 0 });
  io.observe(stage);
  const onVis = () => { if(!document.hidden) loop.wake(); };
  document.addEventListener('visibilitychange', onVis);
  const fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  const onMove = e => {
    if(prefersReduced()) return;
    tpx = (e.clientX / window.innerWidth - 0.5) * 2; tpy = -(e.clientY / window.innerHeight - 0.5) * 2; loop.wake();
  };
  if(fine) window.addEventListener('pointermove', onMove, { passive: true });
  loop.wake();

  return {
    setProgress(p){ target = toRaise(p); loop.wake(); },
    setColour(c){ blind.setColour(c); loop.wake(); },
    dispose(){
      loop.stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      if(blind) blind.dispose();
      renderer.dispose(); const x = renderer.getContext().getExtension('WEBGL_lose_context'); if(x) x.loseContext();
    }
  };
}

/* ---------------------------------------------------------------- VIEWER */
/* Orbitable preview in centimetres, in front of a real garden photo.
 * opts: {colour, W, D, backdrop, raise}   W, D in cm. */
export function createViewer(canvas, host, opts = {}){
  const FOV = 30;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = makeRenderer(canvas, { alpha: false, shadows: true, pixelRatioCap: small ? 1.5 : 2 });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e0d2);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 4000);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab4a0, 1.3));
  const sun = new THREE.DirectionalLight(0xfff9f0, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.bias = -0.0004; sun.shadow.radius = 5; sun.shadow.normalBias = 0.2;
  scene.add(sun, sun.target);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const colour = opts.colour || 'Natural';
  let W = opts.W || 120, D = opts.D || 200;
  let blind = null, frame = null, backdrop = null, shadowCatcher = null, bdTex = null;
  let yaw = 0, pitch = 0.04, tyaw = 0, tpitch = 0.04, vyaw = 0;
  let cw = 0, ch = 0, dist = 300;
  let target = opts.raise == null ? 0 : opts.raise, cur = target;
  let touched = false, age = 0, dragging = false, lx = 0, ly = 0;

  const bdAspect = 2000 / 679;
  if(opts.backdrop){
    new THREE.TextureLoader().load(opts.backdrop, t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; bdTex = t;
      if(backdrop) backdrop.material.map = t, backdrop.material.needsUpdate = true;
      loop.wake();
    });
  }

  function buildScene(){
    if(blind){ scene.remove(blind.group); blind.dispose(); }
    if(frame){ scene.remove(frame); frame.traverse(o => { if(o.material) o.material.dispose?.(); }); }
    const P = 2.6, th = 0.62;
    blind = new Blind({ W, D, P, th, colour: blind ? blind.colour : colour, aniso, texSpan: 120 });
    blind.group.position.set(0, blind.D / 2, 0);
    blind.setRaise(cur);
    scene.add(blind.group);

    // painted timber beam and posts the blind is mounted to
    frame = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0xded8ca, roughness: 0.78 });
    const Dd = blind.D;
    const beam = new THREE.Mesh(BOX, paint); beam.scale.set(W + 30, 9, 9);
    beam.position.set(0, Dd / 2 + 5 + 2.7, -5.5); beam.castShadow = beam.receiveShadow = true;
    const postL = new THREE.Mesh(BOX, paint), postR = new THREE.Mesh(BOX, paint);
    for(const [p, sx] of [[postL, -1], [postR, 1]]){
      p.scale.set(8, Dd + 28, 8); p.position.set(sx * (W / 2 + 10), 3, -5.5); p.castShadow = p.receiveShadow = true;
    }
    frame.add(beam, postL, postR);
    scene.add(frame);

    // garden backdrop, big enough to stay covered while orbiting
    if(!backdrop){
      backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: bdTex ? 0xffffff : 0xcfd6c2, map: bdTex || null }));
      scene.add(backdrop);
      // invisible plane that only shows the blind's shadow, so the slats stripe the garden behind
      shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.42 }));
      shadowCatcher.receiveShadow = true;
      scene.add(shadowCatcher);
    }
    sizeCamera();
  }

  function sizeCamera(){
    if(!cw) return;
    camera.aspect = cw / ch;
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const needH = (blind.D + 34) / 2, needW = (W + 52) / 2;
    dist = Math.max(needH / t, needW / (t * camera.aspect)) * 1.16;
    camera.updateProjectionMatrix();
    // light follows the blind
    sun.position.set(-0.55 * dist, 0.8 * dist, 1.0 * dist);
    sun.target.position.set(0, 0, 0);
    const ext = Math.max(W, blind.D) * 0.85;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: dist * 4 });
    sun.shadow.camera.updateProjectionMatrix();
    // backdrop
    const bd = -52;
    const fh = 2 * t * (dist - bd), fw = fh * camera.aspect;
    const bh = Math.max(fh, fw / bdAspect) * 1.5, bw = bh * bdAspect;
    backdrop.scale.set(bw, bh, 1);
    backdrop.position.set(0, -bh * 0.1 + blind.D * 0.04, bd);
    shadowCatcher.scale.set(bw, bh, 1);
    shadowCatcher.position.set(0, backdrop.position.y, bd + 0.6);
  }

  function layout(){
    const r = host.getBoundingClientRect();
    const nw = Math.max(240, Math.round(r.width)), nh = Math.max(240, Math.round(r.height));
    if(nw === cw && nh === ch) return;
    cw = nw; ch = nh;
    renderer.setSize(cw, ch, false);
    if(blind) sizeCamera();
  }

  function step(dt){
    age += dt;
    cur += (target - cur) * (1 - Math.exp(-dt * 4.2));
    if(Math.abs(target - cur) < 0.0005) cur = target;
    blind.setRaise(cur);
    let moving = Math.abs(target - cur) > 0.0005;
    if(!touched && !prefersReduced() && age < 7){ tyaw = Math.sin(age * 0.9) * 0.16 * Math.min(1, age / 1.2); moving = true; }
    if(!dragging){
      tyaw += vyaw_step(dt);
    }
    yaw += (tyaw - yaw) * (1 - Math.exp(-dt * 9)); pitch += (tpitch - pitch) * (1 - Math.exp(-dt * 9));
    if(Math.abs(tyaw - yaw) > 0.0005 || Math.abs(tpitch - pitch) > 0.0005 || Math.abs(vyaw) > 0.0005) moving = true;
    const cy = Math.cos(pitch), sy = Math.sin(pitch);
    camera.position.set(Math.sin(yaw) * cy * dist, sy * dist, Math.cos(yaw) * cy * dist);
    camera.lookAt(0, -blind.D * 0.1, 0);       // aim a little low so the blind clears the control bar
    renderer.render(scene, camera);
    return moving || dragging;
  }
  function vyaw_step(dt){            // release momentum
    const d = vyaw * dt * 60; vyaw *= Math.exp(-dt * 4);
    const next = Math.max(-0.75, Math.min(0.75, tyaw + d));
    const applied = next - tyaw; if(applied === 0) vyaw = 0; return applied;
  }
  const loop = makeLoop(step);

  /* pointer: horizontal drag orbits (vertical drag only with a mouse, so a thumb can still scroll the page) */
  const onDown = e => { dragging = true; touched = true; lx = e.clientX; ly = e.clientY; vyaw = 0; canvas.setPointerCapture?.(e.pointerId); loop.wake(); };
  const onMoveP = e => {
    if(!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    tyaw = Math.max(-0.75, Math.min(0.75, tyaw - dx * 0.006)); vyaw = -dx * 0.006 * 0.6;
    if(e.pointerType === 'mouse') tpitch = Math.max(-0.12, Math.min(0.38, tpitch + dy * 0.004));
    loop.wake();
  };
  const onUp = e => { dragging = false; canvas.releasePointerCapture?.(e.pointerId); loop.wake(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMoveP);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  layout(); buildScene();
  const ro = new ResizeObserver(() => { layout(); loop.wake(); }); ro.observe(host);
  const io = new IntersectionObserver(es => loop.setVisible(es[0].isIntersecting), { threshold: 0 }); io.observe(host);
  const onVis = () => { if(!document.hidden) loop.wake(); };
  document.addEventListener('visibilitychange', onVis);
  loop.wake();

  return {
    setColour(c){ blind.setColour(c); loop.wake(); },
    setSize(nw, nd){ W = nw; D = nd; buildScene(); loop.wake(); },
    setRaise(r, animate = true){ target = clamp01(r); if(!animate) cur = target; loop.wake(); },
    getRaise(){ return target; },
    dispose(){
      loop.stop(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMoveP);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      if(blind) blind.dispose(); if(bdTex) bdTex.dispose();
      renderer.dispose(); const x = renderer.getContext().getExtension('WEBGL_lose_context'); if(x) x.loseContext();
    }
  };
}
