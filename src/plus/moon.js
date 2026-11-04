/*
 * 3D 달 — NASA SVS CGI Moon Kit (LROC 컬러 모자이크 + LOLA 고도 노멀맵, 퍼블릭 도메인)
 * 드래그로 회전, 휠/핀치로 확대, 가만히 두면 천천히 자전
 * 조명: 달 표면 특유의 평평한 밝기(Lommel–Seeliger) + 옆에서 들어오는 태양 → 사실적인 명암 경계
 */
import * as THREE from 'three';
import color4k from './tex/moon-color-4k.jpg';
import color2k from './tex/moon-color-2k.jpg';
import normal4k from './tex/moon-normal-4k.jpg';
import normal2k from './tex/moon-normal-2k.jpg';

const MOON_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
void main(){ vUv=uv; vObj=normalize(position); vN=normalize(mat3(modelMatrix)*normal);
  vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;

const MOON_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map; uniform sampler2D nmap; uniform float ready;
uniform vec3 sun; uniform vec3 camPos; uniform mat3 rot; uniform float bump;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
void main(){
  vec3 n=normalize(vObj);
  vec3 T=normalize(vec3(n.z,0.,-n.x)+vec3(1e-5,0.,0.));   // 동쪽(경도 증가)
  vec3 B=cross(n,T);                                       // 북쪽
  vec3 t=texture2D(nmap,vUv).xyz*2.-1.;
  vec3 nb=normalize(T*t.x*bump+B*t.y*bump+n*t.z);
  vec3 N=normalize(rot*nb);
  vec3 Ng=normalize(vN);
  vec3 V=normalize(camPos-vW);
  float mu0=max(dot(N,sun),0.);
  float mu=max(dot(Ng,V),0.05);
  float ls=mu0/(mu0+mu)*2.;                     // Lommel–Seeliger
  float lam=mu0;
  float shade=mix(lam,ls,.55);
  shade*=smoothstep(-.02,.12,dot(Ng,sun));       // 명암 경계를 날카롭게
  float alb=texture2D(map,vUv).r;
  alb=pow(alb,1.15)*1.12;
  vec3 col=vec3(alb)*vec3(1.,.985,.96)*shade*1.05; // 아주 약간 따뜻한 회색
  col+=vec3(alb)*vec3(.010,.012,.016);              // 어두운 면: 거의 검정
  col=mix(vec3(0.),col,ready);
  gl_FragColor=vec4(col,1.);
}`;

const toRad = (d) => (d * Math.PI) / 180;
export const latLngToVec = (lat, lng, r = 1) => {
  const a = toRad(lat), b = toRad(lng);
  return new THREE.Vector3(Math.cos(a) * Math.cos(b) * r, Math.sin(a) * r, -Math.cos(a) * Math.sin(b) * r);
};

export function createMoon(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  const big = renderer.capabilities.maxTextureSize >= 4096 && window.innerWidth > 800;
  const loader = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const uniforms = {
    map: { value: null },
    nmap: { value: null },
    ready: { value: 0 },
    sun: { value: new THREE.Vector3(-0.92, 0.28, 0.3).normalize() },
    camPos: { value: camera.position },
    rot: { value: new THREE.Matrix3() },
    bump: { value: 1.6 },
  };
  let loaded = 0;
  const onTex = (tex, key) => {
    tex.anisotropy = aniso;
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    uniforms[key].value = tex;
    loaded++;
  };
  loader.load(big ? color4k : color2k, (t) => onTex(t, 'map'));
  loader.load(big ? normal4k : normal2k, (t) => onTex(t, 'nmap'));

  const group = new THREE.Group();
  scene.add(group);
  const mat = new THREE.ShaderMaterial({ vertexShader: MOON_VERT, fragmentShader: MOON_FRAG, uniforms });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 144), mat);
  moon.visible = false;
  group.add(moon);

  // 별: 드물고 어둡게
  {
    const n = 1400, pos = new Float32Array(n * 3), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(40);
      pos.set([v.x, v.y, v.z], i * 3);
      sz[i] = Math.random() ** 4 * 1.8 + 0.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    scene.add(new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { dpr: { value: renderer.getPixelRatio() } },
      vertexShader: 'attribute float size; uniform float dpr; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*dpr; vA=.18+.5*fract(sin(dot(position.xy,vec2(12.9,78.2)))*43758.); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying float vA; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(.92),smoothstep(.5,.1,d)*vA); }',
    })));
  }

  const st = { yaw: 0.6, pitch: 0.18, vy: 0, vp: 0, dist: 4.2, distTo: 4.2, auto: true };
  let tween = null;
  const applyRot = () => group.quaternion.setFromEuler(new THREE.Euler(st.pitch, st.yaw, 0, 'XYZ'));

  // 입력
  let drag = null;
  let lastInteract = 0;
  const onDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    tween = null;
  };
  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const s = 0.0036 * (st.dist / 4.2);
    st.yaw += dx * s; st.pitch += dy * s;
    st.vy = dx * s; st.vp = dy * s;
    st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch));
    lastInteract = performance.now();
  };
  const onUp = () => { drag = null; lastInteract = performance.now(); };
  const ZMIN = 2.1, ZMAX = 9;
  const onWheel = (e) => {
    e.preventDefault();
    st.distTo = Math.max(ZMIN, Math.min(ZMAX, st.distTo * (1 + e.deltaY * 0.0012)));
    lastInteract = performance.now();
  };
  const touches = new Map();
  let pinch0 = 0;
  const onTouch = (e) => {
    [...e.changedTouches].forEach((t) => (e.type === 'touchend' || e.type === 'touchcancel' ? touches.delete(t.identifier) : touches.set(t.identifier, t)));
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (e.type === 'touchstart') pinch0 = d;
      else if (pinch0) { st.distTo = Math.max(ZMIN, Math.min(ZMAX, st.distTo * (pinch0 / d))); pinch0 = d; drag = null; }
    } else pinch0 = 0;
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((t) => canvas.addEventListener(t, onTouch, { passive: true }));

  let W = 1, H = 1;
  function resize() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const view = { x: 0, y: 0 };
  const setViewShift = (x, y) => { view.x = x; view.y = y; };

  function focus(lat, lng, { dist, duration = 1.6, tilt = 0 } = {}) {
    const v = latLngToVec(lat, lng);
    const yaw = -Math.atan2(v.x, v.z);
    const pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(v.y, Math.hypot(v.x, v.z)) + tilt));
    let dy = yaw - st.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    tween = { y0: st.yaw, y1: st.yaw + dy, p0: st.pitch, p1: pitch, t0: performance.now(), dur: duration * 1000 };
    if (dist) st.distTo = dist;
    st.vy = st.vp = 0;
    lastInteract = performance.now();
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tmp = new THREE.Vector3();
  const qInv = new THREE.Quaternion();
  let running = false;
  let raf = 0;
  let last = performance.now();
  let fadeIn = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (loaded >= 2) {
      moon.visible = true;
      fadeIn = Math.min(1, fadeIn + dt / 1.6);
      uniforms.ready.value = 1 - Math.pow(1 - fadeIn, 3);
    }
    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.dur);
      const e = ease(t);
      st.yaw = tween.y0 + (tween.y1 - tween.y0) * e;
      st.pitch = tween.p0 + (tween.p1 - tween.p0) * e;
      if (t >= 1) tween = null;
    } else if (!drag) {
      st.yaw += st.vy; st.pitch += st.vp;
      st.vy *= 0.94; st.vp *= 0.94;
      st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch));
      if (st.auto && now - lastInteract > 2500) st.yaw += dt * 0.025;
    }
    st.dist += (st.distTo - st.dist) * Math.min(1, dt * 6);
    applyRot();
    camera.position.set(0, 0, st.dist);
    camera.setViewOffset(W, H, -view.x * W, -view.y * H, W, H);
    camera.updateMatrixWorld();
    group.updateMatrixWorld();
    uniforms.rot.value.setFromMatrix4(group.matrixWorld);
    renderer.render(scene, camera);
    onFrame?.();
  }

  function project(lat, lng, out = {}) {
    tmp.copy(latLngToVec(lat, lng, 1.0)).applyQuaternion(group.quaternion);
    const facing = tmp.dot(new THREE.Vector3().copy(camera.position).sub(tmp).normalize());
    const p = tmp.clone().project(camera);
    out.x = (p.x * 0.5 + 0.5) * W;
    out.y = (-p.y * 0.5 + 0.5) * H;
    out.facing = facing;
    return out;
  }
  const radiusPx = () => H / (2 * Math.tan(toRad(camera.fov / 2)) * st.dist);
  // 화면 정면에 있는 달 위 좌표
  function viewCenter() {
    qInv.copy(group.quaternion).invert();
    const v = new THREE.Vector3(0, 0, 1).applyQuaternion(qInv);
    return { lat: (Math.asin(Math.max(-1, Math.min(1, v.y))) * 180) / Math.PI, lng: (Math.atan2(-v.z, v.x) * 180) / Math.PI };
  }

  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize, focus, project, radiusPx, setViewShift, viewCenter,
    setDist(d) { st.distTo = d; },
    zoom: () => 4.2 / st.dist,
    heading: () => st.yaw,
  };
}
