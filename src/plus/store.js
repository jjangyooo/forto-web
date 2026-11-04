/*
 * 등록 저장소
 * - Supabase가 연결돼 있으면(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) 공용 DB에 저장·조회
 * - 연결 전에는 데모 모드: 예시 사방위표 + 이 브라우저에만 저장
 * Supabase 테이블 구조는 supabase/schema.sql 참고
 */
import { KEYWORD_LIST, PICK } from './keywords.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const LIVE = !!(URL_ && KEY);
const TABLE = 'fortos';
const LOCAL = 'forto-plus-mine';

const headers = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
});

// 데모: 고정 시드로 만든 예시 등록 (연결 후에는 사용하지 않음)
function demoEntries() {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const names = ['Mina', 'Jun', 'Hana', 'Theo', 'Seo', 'Lumi', 'Ari', 'Noah', 'Yuna', 'Kai', 'Rin', 'Eden', 'Sol', 'Dami', 'Leo', 'Ivy', 'Haru', 'Nara', 'Juno', 'Ola', 'Bom', 'Ian', 'Ga-eun', 'Max'];
  return names.map((name, i) => {
    const pool = [...KEYWORD_LIST];
    const keywords = Array.from({ length: PICK }, () => pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return {
      id: `demo-${i}`,
      name,
      keywords,
      lat: Math.asin(rnd() * 1.6 - 0.8) * (180 / Math.PI),
      lng: rnd() * 360 - 180,
      created_at: new Date(Date.UTC(2048, 0, 1 + i)).toISOString(),
      demo: true,
    };
  });
}

function mine() {
  try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { return []; }
}

export async function listFortos() {
  if (!LIVE) return [...demoEntries(), ...mine()];
  const r = await fetch(`${URL_}/rest/v1/${TABLE}?select=id,name,keywords,lat,lng,created_at&order=created_at.asc&limit=5000`, { headers: headers() });
  if (!r.ok) throw new Error(`load ${r.status}`);
  return r.json();
}

export async function addForto({ name, keywords, lat, lng }) {
  const row = { name: name.trim().slice(0, 20), keywords, lat: +lat.toFixed(4), lng: +lng.toFixed(4) };
  if (!LIVE) {
    const saved = { ...row, id: `local-${Date.now()}`, created_at: new Date().toISOString() };
    try { localStorage.setItem(LOCAL, JSON.stringify([...mine(), saved])); } catch { /* 저장 불가 환경 */ }
    return saved;
  }
  const r = await fetch(`${URL_}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`save ${r.status}`);
  const [saved] = await r.json();
  return saved;
}

// 다른 사방위표와 겹치지 않는 달 위 좌표 고르기 (위도 ±60° 안)
export function pickSpot(existing) {
  const toV = (lat, lng) => {
    const a = (lat * Math.PI) / 180, b = (lng * Math.PI) / 180;
    return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
  };
  const vs = existing.map((e) => toV(e.lat, e.lng));
  let best = null;
  let bestD = -1;
  for (let i = 0; i < 80; i++) {
    const lat = (Math.asin(Math.random() * 1.72 - 0.86) * 180) / Math.PI;
    const lng = Math.random() * 360 - 180;
    const v = toV(lat, lng);
    const minD = vs.reduce((m, w) => Math.min(m, 1 - (v[0] * w[0] + v[1] * w[1] + v[2] * w[2])), 2);
    if (minD > bestD) { bestD = minD; best = { lat, lng }; }
    if (minD > 0.02) break;
  }
  return best;
}
