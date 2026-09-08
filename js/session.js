// ═══════════════════════════════════════════════════════════
// 세션 — 상단 바에 아이디·로그아웃 버튼, 하트비트로 유휴 만료 연장, 만료 시 배너
// ═══════════════════════════════════════════════════════════
//  · 페이지가 뜨면 /me 를 불러 로그인 정보가 있을 때만 버튼을 붙인다
//    (인증 없이 정적으로 띄운 경우엔 /me 가 없으므로 아무것도 하지 않는다)
//  · 탭이 보이는 동안 HEARTBEAT_MIN 마다 /me 를 불러 서버 세션(유휴 만료)을 연장한다
//  · 세션이 끊기면 강제 이동 대신 배너를 띄운다 — 작업 중인 블록을 잃지 않게

(function () {
  const T = s => (typeof PIBO_T === 'function' ? PIBO_T(s) : s);
  const HEARTBEAT_MIN = 15;
  const bar = document.querySelector('header, #devTop, #cfTop, #gTop');
  if (!bar) return;

  let user = null, lastPing = 0, banner = null;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function loginURL() {
    return '/login?next=' + encodeURIComponent(location.pathname + location.search);
  }

  function mount(u) {
    if (document.getElementById('logoutBtn')) return;
    const tag = el('span', 'user-tag', bar);
    tag.id = 'userTag';
    tag.textContent = u;
    const b = el('button', 'hbtn', bar);
    b.id = 'logoutBtn';
    b.type = 'button';
    b.title = T('로그아웃');
    b.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i>';
    b.addEventListener('click', () => { location.href = '/logout'; });
  }

  function showExpired() {
    if (banner) return;
    banner = el('div', 'sess-banner');
    banner.id = 'sessBanner';
    el('span', null, banner).textContent = T('세션이 만료됐어요. 작업 내용을 저장한 뒤 다시 로그인하세요.');
    const a = el('a', 'sess-login', banner);
    a.href = loginURL();
    a.textContent = T('다시 로그인');
    document.body.appendChild(banner);
    const tag = document.getElementById('userTag');
    if (tag) tag.classList.add('off');
  }

  // /me → { u, exp, chk } 이면 로그인 상태. 302 → 로그인 화면(=세션 없음). 404 → 인증 없는 정적 서빙
  async function ping() {
    lastPing = Date.now();
    let r;
    try { r = await fetch('/me', { cache: 'no-store', redirect: 'manual', credentials: 'same-origin' }); }
    catch (e) { return; }                     // 네트워크 오류: 다음 주기에 재시도
    const isJSON = r.ok && (r.headers.get('content-type') || '').indexOf('json') >= 0;
    if (isJSON) {
      let d = null;
      try { d = await r.json(); } catch (e) {}
      if (d && d.u) { user = d.u; mount(d.u); if (banner) { banner.remove(); banner = null; } }
      return;
    }
    if (r.status === 404) return;             // 인증 서버가 아님 — 아무것도 하지 않는다
    if (user) showExpired();                  // 로그인돼 있었는데 끊김 (302/opaqueredirect 등)
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastPing >= HEARTBEAT_MIN * 60 * 1000) ping();
  });
  setInterval(() => { if (document.visibilityState === 'visible') ping(); }, HEARTBEAT_MIN * 60 * 1000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ping);
  else ping();

  window.PIBO_SESSION = { ping, get user() { return user; } };
})();
