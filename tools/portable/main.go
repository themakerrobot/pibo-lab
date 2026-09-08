// Pibo Lab portable — the whole site embedded in one exe, behind 파이보 랩 통합 계정 로그인.
//
//	POST /signin → 토큰 저장, GET /auth/check 로 로그인 직후 1회 + 주기 재검증, POST /signout 로 로그아웃
//	사용법: PiboLab.exe [-port 50030] [-secret ...] [-hours 2] [-check 10] [-api ...] [-client-id pibolab] [-unique ""] [-debug]
//	토큰 서명은 검증하지 않는다(비밀키 없음) — auth/check 에 위임.
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"embed"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"html"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"
)

//go:embed all:site
var siteFS embed.FS

const (
	basePort   = 50030
	cookieName = "pibo_lab_session"
)

var (
	port     = flag.Int("port", basePort, "listen port (사용 중이면 다음 포트를 차례로 시도)")
	apiBase  = flag.String("api", "https://api-intgr.circul.us/v1", "인증 API base URL")
	clientID = flag.String("client-id", "pibolab", "x-client-id 헤더 값")
	unique   = flag.String("unique", "", "signin unique 값 (빈 문자열 고정)")
	secret   = flag.String("secret", "", "session signing secret (기본: 실행마다 랜덤 → 재시작 시 재로그인)")
	hours    = flag.Int("hours", 2, "유휴 만료: 마지막 활동 후 N시간 (하트비트로 연장)")
	checkMin = flag.Int("check", 10, "auth/check 재검증 주기 (minutes)")
	noOpen   = flag.Bool("no-open", false, "브라우저 자동 열기 끄기")
	debug    = flag.Bool("debug", false, "signin 응답 body 를 콘솔에 출력 (토큰은 가림)")
	hmacKey  []byte
	client   = &http.Client{Timeout: 10 * time.Second}
	tokenRe  = regexp.MustCompile(`"(token|accessToken|access_token|jwt)"\s*:\s*"[^"]*"`)
)

type session struct {
	U   string `json:"u"`
	T   string `json:"t"`
	Exp int64  `json:"exp"`
	Chk int64  `json:"chk"`
}

func b64u(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

// 로그에 토큰 값이 남지 않게 가린다
func redact(raw []byte) string { return tokenRe.ReplaceAllString(string(raw), `"$1":"***"`) }

func signSession(s session) string {
	p, _ := json.Marshal(s)
	ps := b64u(p)
	m := hmac.New(sha256.New, hmacKey)
	m.Write([]byte(ps))
	return ps + "." + b64u(m.Sum(nil))
}

func readSession(r *http.Request) *session {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return nil
	}
	parts := strings.SplitN(c.Value, ".", 2)
	if len(parts) != 2 {
		return nil
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil
	}
	m := hmac.New(sha256.New, hmacKey)
	m.Write([]byte(parts[0]))
	if !hmac.Equal(sig, m.Sum(nil)) {
		return nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil
	}
	var s session
	if json.Unmarshal(raw, &s) != nil || s.Exp == 0 || time.Now().Unix() >= s.Exp {
		return nil
	}
	return &s
}

// exe 는 http://localhost 로 서빙되므로 Secure 없음
func setCookie(w http.ResponseWriter, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: value, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: maxAge})
}

func extractToken(v interface{}) string {
	m, ok := v.(map[string]interface{})
	if !ok {
		return ""
	}
	for _, k := range []string{"token", "accessToken", "access_token", "jwt"} {
		if s, ok := m[k].(string); ok && s != "" {
			return s
		}
	}
	for _, k := range []string{"data", "result"} {
		if inner, ok := m[k]; ok {
			if t := extractToken(inner); t != "" {
				return t
			}
		}
	}
	return ""
}

// signin 결과: token 이 비면 실패. expired 는 200 이지만 data.isValid=false (이용 기간 종료)
type signinResult struct {
	token   string
	expired bool
	endDate string
	code    int
}

func apiSignin(userID, password string) (signinResult, error) {
	var res signinResult
	body, _ := json.Marshal(map[string]string{"userId": userID, "password": password, "unique": *unique})
	req, _ := http.NewRequest("POST", *apiBase+"/signin", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-client-id", *clientID)
	resp, err := client.Do(req)
	if err != nil {
		return res, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	res.code = resp.StatusCode
	if resp.StatusCode != 200 {
		log.Printf("signin body: %s", redact(raw))
		return res, nil
	}
	if *debug {
		log.Printf("signin body: %s", redact(raw))
	}
	var v interface{}
	_ = json.Unmarshal(raw, &v)
	res.token = extractToken(v)
	if res.token == "" {
		log.Printf("signin 200 but no token field: %s", redact(raw))
	}
	// data.isValid / data.date.end
	if m, ok := v.(map[string]interface{}); ok {
		if d, ok := m["data"].(map[string]interface{}); ok {
			if valid, ok := d["isValid"].(bool); ok && !valid {
				res.expired = true
			}
			if dt, ok := d["date"].(map[string]interface{}); ok {
				if e, ok := dt["end"].(string); ok {
					res.endDate = e
				}
			}
		}
	}
	return res, nil
}

// auth/check: HTTP 200 이어도 body.result=false 면 무효 (비활성화·비밀번호 변경 등)
func apiCheck(token string) (bool, error) {
	req, _ := http.NewRequest("GET", *apiBase+"/auth/check", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-client-id", *clientID)
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		log.Printf("auth/check -> %d %s", resp.StatusCode, redact(raw))
		return false, nil
	}
	var v struct {
		Result  bool   `json:"result"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(raw, &v); err != nil {
		log.Printf("auth/check -> 200 (parse error) %s", redact(raw))
		return false, nil
	}
	if !v.Result {
		log.Printf("auth/check -> 200 result=false: %s", v.Message)
		return false, nil
	}
	log.Printf("auth/check -> 200 ok")
	return true, nil
}

func apiSignout(token string) {
	req, _ := http.NewRequest("POST", *apiBase+"/signout", strings.NewReader("{}"))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-client-id", *clientID)
	if resp, err := client.Do(req); err == nil {
		resp.Body.Close()
	}
}

// 오픈 리다이렉트 방지: '/' 로 시작하고 '//' 로 시작하지 않는 값만 허용
func safeNext(v string) string {
	if strings.HasPrefix(v, "/") && !strings.HasPrefix(v, "//") {
		return v
	}
	return "/"
}

const loginHTML = `<!doctype html>
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
  .char img{width:100%%;display:block;filter:drop-shadow(0 2px 0 rgba(44,74,124,.15))}
  .sheet{width:min(400px,100%%);background:var(--panel);border:2px solid var(--line-d);border-radius:3px;box-shadow:0 1px 0 rgba(44,74,124,.18)}
  .sheet-head{padding:14px 20px 12px;border-bottom:2px solid var(--line-d);background:var(--panel2);display:flex;align-items:baseline;justify-content:space-between}
  .sheet-head b{font-family:var(--serif);font-size:1.05rem;color:var(--ink)}
  .sheet-head span{font-size:12px;color:var(--ink3)}
  .sheet-body{padding:20px 20px 22px}
  .row{display:grid;grid-template-columns:86px 1fr;align-items:center;border-bottom:1px solid var(--line-soft)}
  .row:first-of-type{border-top:1px solid var(--line-soft)}
  .row label{font-size:13px;color:var(--ink2);padding:0 10px;border-right:1px solid var(--line-soft);height:44px;display:flex;align-items:center;background:var(--panel2)}
  .row input{border:0;outline:0;background:transparent;height:44px;padding:0 12px;font:inherit;font-size:15px;color:var(--pen-blue-d);font-weight:700;width:100%%}
  .row input:focus{background:var(--acc-soft)}
  button.go{width:100%%;margin-top:18px;height:42px;border:2px solid var(--pen-blue-d);border-radius:6px;background:var(--pen-blue);color:#fff;
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
      <input type="hidden" name="next" value="%s">
      <div class="row"><label for="id" data-t>아이디</label><input id="id" name="id" autocomplete="username" required autofocus></div>
      <div class="row"><label for="pw" data-t>비밀번호</label><input id="pw" name="pw" type="password" autocomplete="current-password" required></div>
      <button type="submit" class="go" data-t>입장하기</button>
      %s
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
`

func loginPage(w http.ResponseWriter, next, errMsg string) {
	errHTML := ""
	if errMsg != "" {
		errHTML = `<div class="err"><img src="/img/pibo-oops.png" alt=""><span data-t>` + html.EscapeString(errMsg) + `</span></div>`
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprintf(w, loginHTML, html.EscapeString(next), errHTML)
}

func openBrowser(u string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", u)
	case "darwin":
		cmd = exec.Command("open", u)
	default:
		cmd = exec.Command("xdg-open", u)
	}
	_ = cmd.Start()
}

func main() {
	flag.Parse()
	if *secret == "" {
		b := make([]byte, 32)
		rand.Read(b)
		hmacKey = b
	} else {
		hmacKey = []byte(*secret)
	}

	sub, _ := fs.Sub(siteFS, "site")
	static := http.FileServer(http.FS(sub))

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	// 로그인 화면이 쓰는 에셋(로고·캐릭터·폰트)은 세션 없이도 서빙 (사이트 embed 에 이미 포함)
	mux.Handle("/img/", static)
	mux.Handle("/fonts/", static)
	mux.HandleFunc("/manifest.webmanifest", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/manifest+json")
		static.ServeHTTP(w, r)
	})

	mux.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			loginPage(w, safeNext(r.URL.Query().Get("next")), "")
		case http.MethodPost:
			r.ParseForm()
			id := strings.TrimSpace(r.FormValue("id"))
			pw := r.FormValue("pw")
			next := safeNext(r.FormValue("next"))
			if id == "" || pw == "" {
				loginPage(w, next, "아이디와 비밀번호를 입력하세요.")
				return
			}
			sr, err := apiSignin(id, pw)
			if err != nil {
				log.Printf("signin %s -> error %v", id, err)
				loginPage(w, next, "인증 서버에 연결할 수 없습니다.")
				return
			}
			log.Printf("signin %s -> %d (expired=%v end=%s)", id, sr.code, sr.expired, sr.endDate)
			if sr.token == "" {
				loginPage(w, next, "아이디 또는 비밀번호가 올바르지 않습니다.")
				return
			}
			if sr.expired {
				loginPage(w, next, "이용 기간이 만료된 계정입니다.")
				return
			}
			tok := sr.token
			// 로그인 직후 1회 검증: signin 은 통과해도 auth/check 에서 거르는 계정 처리 (네트워크 오류면 통과)
			if ok, err := apiCheck(tok); err == nil && !ok {
				loginPage(w, next, "사용할 수 없는 계정입니다.")
				return
			}
			now := time.Now().Unix()
			s := session{U: id, T: tok, Exp: now + int64(*hours)*3600, Chk: now}
			setCookie(w, signSession(s), *hours*3600)
			http.Redirect(w, r, next, http.StatusSeeOther)
		default:
			http.Error(w, "Method Not Allowed", 405)
		}
	})

	mux.HandleFunc("/logout", func(w http.ResponseWriter, r *http.Request) {
		if s := readSession(r); s != nil && s.T != "" {
			apiSignout(s.T)
		}
		setCookie(w, "", -1)
		http.Redirect(w, r, "/login", http.StatusSeeOther)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		s := readSession(r)
		if s == nil {
			http.Redirect(w, r, "/login?next="+url.QueryEscape(r.URL.RequestURI()), http.StatusFound)
			return
		}
		now := time.Now().Unix()
		// 주기적 재검증 + 유휴 만료 연장 (쓰는 동안은 Exp 가 계속 밀린다. 토큰 자체 만료는 auth/check 가 걸러낸다)
		if now-s.Chk >= int64(*checkMin)*60 {
			ok, err := apiCheck(s.T)
			if err != nil {
				ok = true // 서버 장애 시 통과, 다음 주기에 재시도
			}
			if !ok {
				setCookie(w, "", -1)
				http.Redirect(w, r, "/login", http.StatusFound)
				return
			}
			s.Chk = now
			s.Exp = now + int64(*hours)*3600
			setCookie(w, signSession(*s), *hours*3600)
		} else if r.URL.Path == "/me" {
			// 하트비트: 검증 주기가 아니어도 유휴 만료는 연장
			s.Exp = now + int64(*hours)*3600
			setCookie(w, signSession(*s), *hours*3600)
		}
		// HTML 은 항상 서버까지 오게 (캐시에서 열리면 check 가 실행되지 않음)
		if r.URL.Path == "/" || strings.HasSuffix(r.URL.Path, "/") || strings.HasSuffix(r.URL.Path, ".html") {
			w.Header().Set("Cache-Control", "no-cache")
		}
		if r.URL.Path == "/me" {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-store")
			json.NewEncoder(w).Encode(map[string]interface{}{"u": s.U, "exp": s.Exp, "chk": s.Chk})
			return
		}
		static.ServeHTTP(w, r)
	})

	// 기존과 같이 localhost 에만 바인딩, 포트가 사용 중이면 다음 포트를 차례로 시도
	p := *port
	var ln net.Listener
	var err error
	for i := 0; i < 10; i++ {
		ln, err = net.Listen("tcp", fmt.Sprintf("localhost:%d", p))
		if err == nil {
			break
		}
		p++
	}
	if ln == nil {
		fmt.Println("no free port found near", *port)
		fmt.Scanln()
		return
	}

	addr := fmt.Sprintf("http://localhost:%d", p)
	fmt.Println("Pibo Lab -", addr)
	fmt.Println("Close this window to stop.")
	log.Printf("인증 API: %s  x-client-id: %s  check: %dmin  session: %dh", *apiBase, *clientID, *checkMin, *hours)

	if !*noOpen {
		go func() {
			time.Sleep(600 * time.Millisecond)
			openBrowser(addr)
		}()
	}

	log.Fatal(http.Serve(ln, mux))
}
