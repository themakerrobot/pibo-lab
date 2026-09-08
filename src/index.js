// src/index.js — 파이보 랩 앞단 인증 (파이보 랩 통합 계정)
//   POST /signin        → 토큰 발급, 세션 쿠키에 저장 (HTTP 200 + data.isValid=true 만 성공)
//   GET  /auth/check    → 로그인 직후 1회 + CHECK_MINUTES 마다 재검증 (body.result=true 만 유효)
//   POST /signout       → 로그아웃 시 서버 세션 종료
// 토큰 서명은 검증하지 않는다(비밀키 없음) — auth/check 에 위임.
const COOKIE = "pibo_lab_session";
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// 세션 = { u: userId, t: 토큰, exp: 유휴 만료(활동마다 연장), chk: 마지막 검증 시각 }
async function signSession(data, env) {
  const p = b64u(enc.encode(JSON.stringify(data)));
  const sig = b64u(await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), enc.encode(p)));
  return `${p}.${sig}`;
}

async function readSession(request, env) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [p, sig] = decodeURIComponent(m[1]).split(".");
  if (!p || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(env.SESSION_SECRET), fromB64u(sig), enc.encode(p));
  if (!ok) return null;
  const data = JSON.parse(dec.decode(fromB64u(p)));
  if (!data.exp || Math.floor(Date.now() / 1000) >= data.exp) return null;
  return data;
}

const cookieHeader = (value, maxAge) =>
  `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// 로그에 토큰 값이 남지 않게 가린다
const redact = (s) => String(s).replace(/"(token|accessToken|access_token|jwt)"\s*:\s*"[^"]*"/g, '"$1":"***"');

function extractToken(body) {
  if (!body || typeof body !== "object") return null;
  for (const k of ["token", "accessToken", "access_token", "jwt"]) if (typeof body[k] === "string" && body[k]) return body[k];
  if (body.data) return extractToken(body.data);
  if (body.result) return extractToken(body.result);
  return null;
}

// signin 결과: token 이 비면 실패. expired 는 200 이지만 data.isValid=false (이용 기간 종료)
async function apiSignin(userId, password, env) {
  const r = await fetch(`${env.API_BASE}/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "x-client-id": env.CLIENT_ID },
    body: JSON.stringify({ userId, password, unique: env.UNIQUE || "" }),
  });
  const raw = await r.text();
  let body = null;
  try { body = JSON.parse(raw); } catch {}
  const res = { token: null, expired: false, endDate: "", code: r.status };
  if (r.status !== 200) { console.log(`signin body: ${redact(raw)}`); return res; }
  if (env.DEBUG === "1") console.log(`signin body: ${redact(raw)}`);
  res.token = extractToken(body);
  if (!res.token) console.log(`signin 200 but no token field: ${redact(raw)}`);
  const d = body && body.data;
  if (d && typeof d === "object") {
    if (d.isValid === false) res.expired = true;
    if (d.date && typeof d.date.end === "string") res.endDate = d.date.end;
  }
  return res;
}

// auth/check: HTTP 200 이어도 body.result=false 면 무효 (비활성화·비밀번호 변경 등)
async function apiCheck(token, env) {
  const r = await fetch(`${env.API_BASE}/auth/check`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "x-client-id": env.CLIENT_ID } });
  const raw = await r.text();
  let body = null;
  try { body = JSON.parse(raw); } catch {}
  if (r.status !== 200) { console.log(`auth/check -> ${r.status} ${redact(raw)}`); return false; }
  if (!body || body.result !== true) { console.log(`auth/check -> 200 result=false: ${body?.message ?? redact(raw)}`); return false; }
  console.log("auth/check -> 200 ok");
  return true;
}

async function apiSignout(token, env) {
  try {
    await fetch(`${env.API_BASE}/signout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-client-id": env.CLIENT_ID },
      body: "{}",
    });
  } catch {}
}

const escapeHTML = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function loginPage(next, error) {
  return new Response(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>파이보 랩 — 로그인</title>
<link rel="stylesheet" href="/fonts/pretendard.css">
<link rel="icon" type="image/png" href="/img/favicon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#FBF7EF">
<link rel="apple-touch-icon" href="/img/icon-192.png">
<style>
  :root{
    --paper:#FBF7EF;--line-d:#4A3F2E;--pen-blue:#1F5F7A;--pen-blue-d:#12455C;--pen-red:#B4451C;
    --panel:#FFFFFF;--panel2:#FBFAF5;--line:#9A8F7D;--line-soft:#DCD5C6;--ink:#2A2620;--ink2:#4A423A;--ink3:#6B6255;--acc-soft:#E6EEF6;
    --sans:'Gowun Dodum','Pretendard Variable',Pretendard,-apple-system,'Segoe UI',sans-serif;
    --serif:'Gowun Batang','Nanum Myeongjo','Apple SD Gothic Neo',serif;
  }
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;padding:8px;color:var(--ink);font-family:var(--sans);
    background-color:var(--paper);background-image:radial-gradient(rgba(31,95,122,.07) 1px,transparent 1px);background-size:22px 22px}
  header{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:var(--panel);
    border:2px solid var(--line-d);border-radius:3px;box-shadow:0 1px 0 rgba(44,74,124,.18)}
  header h1{margin:0;display:flex;align-items:center;gap:10px;font-family:var(--serif);font-weight:700;font-size:1.15rem;letter-spacing:.02em}
  header h1 img{height:30px}
  .hbtn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid var(--line);border-radius:999px;
    background:var(--panel);color:var(--ink2);font:inherit;font-size:13px;cursor:pointer;transition:all .12s;flex-shrink:0}
  .hbtn:hover{border-color:var(--pen-blue);color:var(--pen-blue-d);background:var(--acc-soft)}
  main{display:flex;justify-content:center;align-items:flex-start;gap:28px;padding:64px 16px 40px;flex-wrap:wrap}
  .char{width:150px;flex:none;margin-top:18px}
  .char img{width:100%;display:block;filter:drop-shadow(0 2px 0 rgba(44,74,124,.15))}
  .sheet{width:min(400px,100%);background:var(--panel);border:2px solid var(--line-d);border-radius:3px;box-shadow:0 1px 0 rgba(44,74,124,.18)}
  .sheet-head{padding:14px 20px 12px;border-bottom:2px solid var(--line-d);background:var(--panel2);display:flex;align-items:baseline;justify-content:space-between}
  .sheet-head b{font-family:var(--serif);font-size:1.05rem;color:var(--ink)}
  .sheet-head span{font-size:12px;color:var(--ink3)}
  .sheet-body{padding:20px 20px 22px}
  .row{display:grid;grid-template-columns:86px 1fr;align-items:center;border-bottom:1px solid var(--line-soft)}
  .row:first-of-type{border-top:1px solid var(--line-soft)}
  .row label{font-size:13px;color:var(--ink2);padding:0 10px;border-right:1px solid var(--line-soft);height:44px;display:flex;align-items:center;background:var(--panel2)}
  .row input{border:0;outline:0;background:transparent;height:44px;padding:0 12px;font:inherit;font-size:15px;color:var(--pen-blue-d);font-weight:700;width:100%}
  .row input:focus{background:var(--acc-soft)}
  button.go{width:100%;margin-top:18px;height:42px;border:2px solid var(--pen-blue-d);border-radius:6px;background:var(--pen-blue);color:#fff;
    font:inherit;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 1px 0 rgba(44,74,124,.18)}
  button.go:hover{background:var(--pen-blue-d)}
  .err{margin-top:14px;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--pen-red);background:#FBEFEA;border:1px solid #E8C9BC;border-radius:6px;padding:8px 10px}
  .err img{width:26px;height:auto}
  .note{margin:14px 0 0;font-size:12px;color:var(--ink3);line-height:1.6}
  @media (max-width:640px){.char{display:none}}
</style></head><body>
<header>
  <h1><img src="/img/pibo-logo.png" alt=""><span data-t>파이보 랩</span></h1>
  <button type="button" class="hbtn" id="langToggle" title="한국어 / English">EN</button>
</header>
<main>
  <div class="char"><img src="/img/pibo-hello.png" alt=""></div>
  <form class="sheet" method="post" action="/login">
    <div class="sheet-head"><b data-t>로그인</b><span data-t>파이보 랩</span></div>
    <div class="sheet-body">
      <input type="hidden" name="next" value="${escapeHTML(next)}">
      <div class="row"><label for="id" data-t>아이디</label><input id="id" name="id" autocomplete="username" required autofocus></div>
      <div class="row"><label for="pw" data-t>비밀번호</label><input id="pw" name="pw" type="password" autocomplete="current-password" required></div>
      <button type="submit" class="go" data-t>입장하기</button>
      ${error ? `<div class="err"><img src="/img/pibo-oops.png" alt=""><span data-t>${escapeHTML(error)}</span></div>` : ""}
      <p class="note" data-t>아이디와 비밀번호를 입력하면 파이보 랩에 들어갈 수 있어요.</p>
    </div>
  </form>
</main>
<script>
(function(){
  // 파이보 랩 i18n 과 같은 규칙: 한국어 원문이 키, localStorage 'language' 공유
  var T={
    '파이보 랩':'Pibo Lab','로그인':'Sign in','아이디':'ID','비밀번호':'Password','입장하기':'Enter',
    '아이디와 비밀번호를 입력하면 파이보 랩에 들어갈 수 있어요.':'Enter your ID and password to get into Pibo Lab.',
    '아이디와 비밀번호를 입력하세요.':'Please enter your ID and password.',
    '아이디 또는 비밀번호가 올바르지 않습니다.':'Incorrect ID or password.',
    '인증 서버에 연결할 수 없습니다.':'Could not reach the sign-in server.',
    '사용할 수 없는 계정입니다.':'This account cannot be used.',
    '이용 기간이 만료된 계정입니다.':'This account has expired.',
    '서버 설정이 완료되지 않았습니다.':'The server is not fully configured yet.',
    '로그인 — 파이보 랩':'Sign in — Pibo Lab'
  };
  var lang='ko';
  try{var s=localStorage.getItem('language'); if(s==='ko'||s==='en') lang=s; else if(((navigator.language||'ko')+'').toLowerCase().indexOf('ko')!==0) lang='en';}catch(e){}
  function apply(){
    document.documentElement.lang=lang;
    document.querySelectorAll('[data-t]').forEach(function(el){
      if(!el.dataset.ko) el.dataset.ko=el.textContent.trim();
      el.textContent=(lang==='en'&&T[el.dataset.ko])?T[el.dataset.ko]:el.dataset.ko;
    });
    document.title=(lang==='en')?'Pibo Lab — Sign in':'파이보 랩 — 로그인';
    document.getElementById('langToggle').textContent=(lang==='ko')?'EN':'한';
  }
  document.getElementById('langToggle').onclick=function(){
    lang=(lang==='ko')?'en':'ko';
    try{localStorage.setItem('language',lang);}catch(e){}
    apply();
  };
  apply();
})();
</script>
</body></html>
`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// 오픈 리다이렉트 방지: '/' 로 시작하고 '//' 로 시작하지 않는 값만 허용
const safeNext = (v) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/");
const toLogin = (url) => new Response(null, { status: 302, headers: { Location: `/login?next=${encodeURIComponent(url.pathname + url.search)}` } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const hours = Number(env.SESSION_HOURS || 2); // 유휴 만료 (마지막 활동 후 N시간)

    if (url.pathname === "/healthz") return new Response("ok");
    // 로그인 화면이 쓰는 에셋(로고·캐릭터·폰트)은 세션 없이도 서빙
    if (url.pathname.startsWith("/img/") || url.pathname.startsWith("/fonts/") || url.pathname === "/manifest.webmanifest") return env.ASSETS.fetch(request);

    if (url.pathname === "/login") {
      if (request.method === "GET") return loginPage(safeNext(url.searchParams.get("next")), null);
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      const form = await request.formData();
      const id = (form.get("id") || "").toString().trim();
      const pw = (form.get("pw") || "").toString();
      const next = safeNext(form.get("next")?.toString());
      if (!id || !pw) return loginPage(next, "아이디와 비밀번호를 입력하세요.");
      // SESSION_SECRET 이 아직 등록되지 않았으면 세션을 만들 수 없다 (1101 대신 안내)
      if (!env.SESSION_SECRET) { console.log("SESSION_SECRET is not set"); return loginPage(next, "서버 설정이 완료되지 않았습니다."); }
      let sr;
      try { sr = await apiSignin(id, pw, env); } catch (e) { console.log(`signin ${id} -> error ${e}`); return loginPage(next, "인증 서버에 연결할 수 없습니다."); }
      console.log(`signin ${id} -> ${sr.code} (expired=${sr.expired} end=${sr.endDate})`);
      if (!sr.token) return loginPage(next, "아이디 또는 비밀번호가 올바르지 않습니다.");
      if (sr.expired) return loginPage(next, "이용 기간이 만료된 계정입니다.");
      const token = sr.token;
      // 로그인 직후 1회 검증: signin 은 통과해도 auth/check 에서 거르는 계정 처리 (네트워크 오류면 통과)
      let ok = true;
      try { ok = await apiCheck(token, env); } catch (e) { console.log(`auth/check error ${e}`); ok = true; }
      if (!ok) return loginPage(next, "사용할 수 없는 계정입니다.");
      const sess = await signSession({ u: id, t: token, exp: now + hours * 3600, chk: now }, env);
      return new Response(null, { status: 303, headers: { Location: next, "Set-Cookie": cookieHeader(sess, hours * 3600) } });
    }

    if (url.pathname === "/logout") {
      const s = await readSession(request, env).catch(() => null);
      if (s?.t) await apiSignout(s.t, env);
      return new Response(null, { status: 303, headers: { Location: "/login", "Set-Cookie": cookieHeader("", 0) } });
    }

    let session = await readSession(request, env).catch(() => null);
    if (!session) return toLogin(url);

    // 주기적 재검증 + 유휴 만료 연장 (쓰는 동안은 exp 가 계속 밀린다. 토큰 자체 만료는 auth/check 가 걸러낸다)
    let refreshed = null;
    if (now - (session.chk || 0) >= Number(env.CHECK_MINUTES || 10) * 60) {
      let ok = false;
      try { ok = await apiCheck(session.t, env); } catch { ok = true; } // 서버 장애 시엔 통과, 다음 주기에 재시도
      if (!ok) return new Response(null, { status: 302, headers: { Location: "/login", "Set-Cookie": cookieHeader("", 0) } });
      session.chk = now;
      session.exp = now + hours * 3600;
      refreshed = await signSession(session, env);
    } else if (url.pathname === "/me") {
      // 하트비트: 검증 주기가 아니어도 유휴 만료는 연장
      session.exp = now + hours * 3600;
      refreshed = await signSession(session, env);
    }

    let res;
    if (url.pathname === "/me") {
      res = new Response(JSON.stringify({ u: session.u, exp: session.exp, chk: session.chk }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    } else {
      res = await env.ASSETS.fetch(request);
      // HTML 은 항상 서버까지 오게 (캐시에서 열리면 check 가 실행되지 않음)
      if (url.pathname === "/" || url.pathname.endsWith("/") || url.pathname.endsWith(".html")) {
        res = new Response(res.body, res);
        res.headers.set("Cache-Control", "no-cache");
      }
    }
    if (refreshed) {
      res = new Response(res.body, res);
      res.headers.append("Set-Cookie", cookieHeader(refreshed, session.exp - now));
    }
    return res;
  },
};
