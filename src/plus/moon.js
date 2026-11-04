/*
 * 3D 달 — 드래그로 회전, 휠/핀치로 확대, 가만히 두면 천천히 자전
 * 표면은 절차적으로 한 번 구워(bake) 텍스처로 사용: 바다(어두운 평원) + 여러 크기의 크레이터
 * 사방위표 핀은 HTML 요소로 화면에 투영 (선명한 SVG + 클릭)
 */
import * as THREE from 'three';

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec3 hash3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453123);}
// 크레이터 층: 셀마다 무작위 크기의 그릇 + 테두리
float craters(vec3 p, float scale, float density){
  p*=scale;vec3 ip=floor(p);vec3 fp=fract(p);float h=0.;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){
    vec3 o=vec3(x,y,z);vec3 r=hash3(ip+o);
    if(r.z>density) continue;
    vec3 c=o+.15+.7*r-fp;float d=length(c);
    float R=.18+.32*fract(r.x*7.31+r.y*3.7);
    float t=d/R;
    float bowl=(t<1.)?(t*t-1.)*.9:0.;
    float rim=exp(-pow((t-1.)*4.,2.))*.35;
    float ray=(t<1.6)?exp(-t*2.)*.05:0.;
    h+=(bowl+rim+ray)*R;
  }
  return h;
}
`;

const BAKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
${NOISE}
void main(){
  float lon=(vUv.x-.5)*6.2831853; float lat=(vUv.y-.5)*3.1415926;
  vec3 p=vec3(cos(lat)*cos(lon),sin(lat),-cos(lat)*sin(lon));
  // 바다: 크고 부드러운 어두운 평원
  float maria=smoothstep(.12,.32,snoise(p*1.3+vec3(2.1,0.,1.))*.6+snoise(p*2.7)*.3+snoise(p*9.)*.1);
  float fbm=snoise(p*6.)*.5+snoise(p*13.)*.25+snoise(p*27.)*.125+snoise(p*55.)*.07;
  float h=craters(p,3.,.55)*1.4+craters(p+7.,7.,.6)*.8+craters(p+13.,16.,.7)*.45+craters(p+29.,34.,.75)*.25;
  h+=fbm*.08-maria*.12;
  float albedo=.56+fbm*.09-maria*.3+clamp(h,-1.,1.)*.14;
  gl_FragColor=vec4(clamp(albedo,0.,1.),h*.5+.5,0.,1.);
}`;

const MOON_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
void main(){ vUv=uv; vObj=normalize(position); vN=normalize(mat3(modelMatrix)*normal);
  vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;

const MOON_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map; uniform vec2 texel; uniform vec3 sun; uniform vec3 camPos; uniform mat3 rot;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
void main(){
  vec4 s=texture2D(map,vUv);
  float hL=texture2D(map,vUv-vec2(texel.x,0.)).g, hR=texture2D(map,vUv+vec2(texel.x,0.)).g;
  float hD=texture2D(map,vUv-vec2(0.,texel.y)).g, hU=texture2D(map,vUv+vec2(0.,texel.y)).g;
  vec3 n=normalize(vObj);
  vec3 T=normalize(cross(vec3(0.,1.,0.),n)+1e-5); vec3 B=cross(n,T);
  float k=7.;
  vec3 nb=normalize(n-k*((hR-hL)*T+(hU-hD)*B));
  vec3 N=normalize(rot*nb);
  vec3 V=normalize(camPos-vW);
  float dif=max(dot(N,sun),0.);
  dif=pow(dif,.85);
  float term=smoothstep(-.18,.28,dot(normalize(vN),sun));     // 부드러운 명암 경계
  vec3 base=vec3(s.r)*vec3(.92,.95,1.);
  vec3 col=base*dif*term*1.35;
  col+=base*vec3(.025,.06,.085)*(1.-term);                                  // 어두운 면의 지구광
  float fr=pow(1.-max(dot(normalize(vN),V),0.),3.);
  col+=vec3(.35,.85,1.)*fr*(.35+.65*term)*.45;                  // 가장자리 #97F9FF 빛
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

  // 1) 표면 굽기
  const SIZE = renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE / 2, { type: THREE.UnsignedByteType, wrapS: THREE.RepeatWrapping, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  {
    const bs = new THREE.Scene();
    const bc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    bs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.); }',
      fragmentShader: BAKE_FRAG,
    })));
    renderer.setRenderTarget(rt);
    renderer.render(bs, bc);
    renderer.setRenderTarget(null);
  }

  // 2) 달
  const group = new THREE.Group();
  scene.add(group);
  const sun = new THREE.Vector3(-0.85, 0.32, 0.42).normalize();
  const mat = new THREE.ShaderMaterial({
    vertexShader: MOON_VERT,
    fragmentShader: MOON_FRAG,
    uniforms: {
      map: { value: rt.texture },
      texel: { value: new THREE.Vector2(1 / SIZE, 2 / SIZE) },
      sun: { value: sun },
      camPos: { value: camera.position },
      rot: { value: new THREE.Matrix3() },
    },
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), mat);
  group.add(moon);

  // 3) 대기처럼 번지는 빛
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      uniforms: { sun: { value: sun } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float r=dot(vN,vV); float g=pow(clamp(1.0+r*1.6,0.,1.),3.); gl_FragColor=vec4(vec3(.2,.65,1.)*g*.32,1.); }',
    }),
  );
  scene.add(halo);

  // 4) 별
  {
    const n = 2600, pos = new Float32Array(n * 3), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20);
      pos.set([v.x, v.y, v.z], i * 3);
      sz[i] = Math.random() ** 3 * 2.2 + 0.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    const stars = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { dpr: { value: renderer.getPixelRatio() }, time: { value: 0 } },
      vertexShader: 'attribute float size; uniform float dpr; uniform float time; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*dpr; vA=.35+.65*fract(sin(dot(position.xy,vec2(12.9,78.2)))*43758.)*(.75+.25*sin(time*1.3+position.x)); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying float vA; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(.85,.95,1.),smoothstep(.5,0.,d)*vA); }',
    }));
    scene.add(stars);
    scene.userData.stars = stars;
  }

  // 회전 상태 (yaw/pitch) + 관성
  const st = { yaw: 0.4, pitch: 0.12, vy: 0, vp: 0, dist: 4.2, distTo: 4.2, shiftX: 0, shiftY: 0, auto: true };
  let tween = null;
  const q = new THREE.Quaternion();
  const applyRot = () => {
    q.setFromEuler(new THREE.Euler(st.pitch, st.yaw, 0, 'XYZ'));
    group.quaternion.copy(q);
  };

  // 입력
  let drag = null;
  let lastInteract = 0;
  const onDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() };
    tween = null;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const s = 0.0042 * (st.dist / 4.2);
    st.yaw += dx * s; st.pitch += dy * s;
    st.vy = dx * s; st.vp = dy * s;
    st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch));
    lastInteract = performance.now();
  };
  const onUp = () => { drag = null; lastInteract = performance.now(); };
  const onWheel = (e) => {
    e.preventDefault();
    st.distTo = Math.max(2.15, Math.min(9, st.distTo * (1 + e.deltaY * 0.0012)));
    lastInteract = performance.now();
  };
  // 핀치
  const touches = new Map();
  let pinch0 = 0;
  const onTouch = (e) => {
    [...e.changedTouches].forEach((t) => (e.type === 'touchend' || e.type === 'touchcancel' ? touches.delete(t.identifier) : touches.set(t.identifier, t)));
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (e.type === 'touchstart') pinch0 = d;
      else if (pinch0) { st.distTo = Math.max(2.15, Math.min(9, st.distTo * (pinch0 / d))); pinch0 = d; drag = null; }
    } else pinch0 = 0;
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((t) => canvas.addEventListener(t, onTouch, { passive: true }));

  // 크기
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

  // 달 중심을 화면에서 옮기기 (패널이 열리면 오른쪽으로)
  const view = { x: 0, y: 0 };
  function setViewShift(x, y) { view.x = x; view.y = y; }

  // 특정 좌표를 정면으로
  function focus(lat, lng, { dist, duration = 1.6, tilt = 0 } = {}) {
    const v = latLngToVec(lat, lng);
    // v를 카메라 쪽(+z)으로 돌리는 yaw/pitch
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
  const normal3 = new THREE.Matrix3();
  let running = false;
  let raf = 0;
  let last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
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
      if (st.auto && now - lastInteract > 2500) st.yaw += dt * 0.05;    // 천천히 자전
    }
    st.dist += (st.distTo - st.dist) * Math.min(1, dt * 6);
    applyRot();
    camera.position.set(0, 0, st.dist);
    camera.setViewOffset(W, H, -view.x * W, -view.y * H, W, H);
    camera.updateMatrixWorld();
    group.updateMatrixWorld();
    normal3.setFromMatrix4(group.matrixWorld);
    mat.uniforms.rot.value.copy(normal3);
    scene.userData.stars.material.uniforms.time.value = now / 1000;
    renderer.render(scene, camera);
    onFrame?.();
  }

  // 핀 투영: 좌표 → 화면 위치, 앞면 여부
  function project(lat, lng, out = {}) {
    tmp.copy(latLngToVec(lat, lng, 1.0)).applyQuaternion(group.quaternion);
    const facing = tmp.dot(new THREE.Vector3().copy(camera.position).sub(tmp).normalize());
    const p = tmp.clone().project(camera);
    out.x = (p.x * 0.5 + 0.5) * W;
    out.y = (-p.y * 0.5 + 0.5) * H;
    out.facing = facing;
    return out;
  }
  // 화면 지름(px)
  const radiusPx = () => {
    const h = 2 * Math.tan(toRad(camera.fov / 2)) * st.dist;
    return (H / h) * 1;
  };

  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize, focus, project, radiusPx, setViewShift,
    setDist(d) { st.distTo = d; },
    isDragging: () => !!drag && drag.moved > 6,
    wasDrag: () => false,
    dragMoved: () => (drag ? drag.moved : 0),
  };
}
