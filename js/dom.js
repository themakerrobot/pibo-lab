// ═══════════════════════════════════════════════════════════
// DOM 헬퍼 — 해당 요소가 없는 페이지(개발툴)에서도 조용히 넘어가게
// ═══════════════════════════════════════════════════════════
function uiSet(id, prop, val){ const e=document.getElementById(id); if(e) e[prop]=val; }
function uiText(id, t){ const e=document.getElementById(id); if(e) e.textContent=t; }
function uiStyle(id, prop, val){ const e=document.getElementById(id); if(e) e.style[prop]=val; }
function uiClass(id, cls, on){ const e=document.getElementById(id); if(e) e.classList.toggle(cls, on); }
function uiOn(id, ev, fn){ const e=document.getElementById(id); if(e) e.addEventListener(ev, fn); }
