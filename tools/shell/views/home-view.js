// tools/index.html 이관 — 셸에서 가장 크고 복잡한 화면(로그인/회원가입/구글로그인/비밀번호
//찾기/팀 참가/직위 변경/내 정보/설정/문의하기/승인대기/도구목록/팀장허브/팀원관리 13개
// 서브뷰가 전부 이 파일 하나에 들어있던 원본 구조를 그대로 유지).
//
// 원본은 브라우저 history(pushState/popstate)로 서브뷰 뒤로가기를 구현했는데, 셸의
// 라우터(router.js)도 popstate를 전역으로 듣고 있어서 그대로 가져오면 둘이 충돌한다
// (서브뷰 이동이 history를 쌓으면 라우터가 그걸 "다른 화면으로 이동"으로 오인해서
// 홈 전체를 리마운트해버림). 그래서 이 화면 안에서는 history API 대신 로컬 스택
// (viewStack)으로 "‹ 뒤로" 버튼을 구현했다 — 버튼 클릭은 원본과 동일하게 동작하지만,
// 폰 하드웨어 뒤로가기로 서브뷰를 단계별로 빠져나가는 동작은 이번 이관에서 빠졌다
// (셸 전체를 벗어나는 뒤로가기만 라우터가 처리). 실사용 임팩트가 크면 다음 단계에서
// 라우터와 통합된 서브라우팅으로 다시 다듬을 것.
//
// 로그인 게이트(무엇을 볼 수 있는지)는 이 화면 자체가 "로그인 제공자"라 셸의 onProfile()
// 패턴과는 조금 다르게 쓴다 — onProfile()로 프로필 변화를 구독하되, 여기서 로그인/가입/
// 팀 참가 등 실제 auth 상태를 "쓰는" 주체이기도 하다.

import { auth, db, colUsers, onProfile } from '../firebase-shell.js';
import { navigate as routerNavigate } from '../router.js';

const STYLE_ID = 'view-style-home';
const STYLE = `
:root {
  --orange: #FF6B2B; --orange-dark: #E05520;
  --steel: #1A1E2E; --steel-mid: #252A3D; --steel-light: #2E3450;
  --text: #F0F2FF; --text-dim: #8892B0; --give: #3BE88A;
  --border: rgba(255,255,255,0.08);
  --nav-btn-bg: #fff; --nav-btn-border: transparent;
  --header-bg: rgba(26, 30, 46, 0.8);
}
:root[data-theme="light"] {
  --orange: #FF6B2B; --orange-dark: #E05520;
  --steel: #F4F3F0; --steel-mid: #FFFFFF; --steel-light: #F0EFEA;
  --text: #1C1E27; --text-dim: #767A85; --give: #1E8E56;
  --border: rgba(0,0,0,0.08);
  --nav-btn-bg: #fff; --nav-btn-border: rgba(0,0,0,0.08);
  --header-bg: rgba(244, 243, 240, 0.8);
}
.home-root { font-family: 'Noto Sans KR', sans-serif; color: var(--text); word-break: keep-all; }
.home-root .container { max-width: 480px; margin: 0 auto; }
.home-root .site-header { position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:var(--header-bg); border-bottom:1px solid var(--border); padding:0 20px; height:60px; display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.home-root .brand { font-size:18px; font-weight:900; letter-spacing:-0.3px; color:var(--text); display:flex; align-items:baseline; gap:8px; text-decoration:none; }
.home-root .brand-sub { font-size:11px; font-weight:700; color:var(--text-dim); letter-spacing:-0.2px; }
.home-root .hamburger-btn { width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:none; border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:17px; cursor:pointer; flex-shrink:0; }
.home-root .hamburger-btn:hover { border-color:var(--orange); color:var(--orange); }
.home-root .menu-overlay { display:none; position:fixed; inset:0; z-index:200; background:rgba(0,0,0,0.5); justify-content:flex-end; }
.home-root .menu-overlay.show { display:flex; }
.home-root .menu-sheet { width:78%; max-width:300px; height:100%; background:var(--steel-mid); border-left:1px solid var(--border); padding:20px 16px; display:flex; flex-direction:column; animation: home-menuSlideIn 0.22s cubic-bezier(0.2,0.9,0.3,1); overflow-y:auto; }
@keyframes home-menuSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.home-root .menu-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding:0 2px; }
.home-root .menu-title { font-size:15px; font-weight:900; color:var(--text-dim); letter-spacing:0.5px; }
.home-root .menu-close { width:32px; height:32px; border-radius:8px; background:none; border:none; color:var(--text-dim); font-size:16px; cursor:pointer; }
.home-root .menu-close:hover { color:var(--orange); }
.home-root .theme-quickswitch { display:inline-flex; border-radius:16px; background:var(--steel-light); border:1px solid var(--border); padding:2px; gap:2px; }
.home-root .theme-quickswitch-opt { width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:12px; border-radius:12px; border:none; background:transparent; cursor:pointer; opacity:0.4; }
.home-root .theme-quickswitch-opt.is-active { background:var(--orange); opacity:1; }
.home-root .menu-item { display:flex; align-items:center; gap:12px; padding:14px 10px; border-radius:12px; background:none; border:none; color:var(--text); font-family:inherit; font-size:15px; font-weight:700; text-align:left; cursor:pointer; width:100%; }
.home-root .menu-item:hover { background:var(--steel-light); }
.home-root .menu-item-icon { font-size:17px; width:22px; text-align:center; flex-shrink:0; }
.home-root .menu-item .tool-badge { margin-left:auto; }
.home-root .menu-item--logout { margin-top:auto; color:#ff8a8a; }
.home-root .menu-profile { display:flex; align-items:center; gap:12px; padding:14px 10px; margin-bottom:10px; border-radius:12px; background:var(--steel-light); border:none; width:100%; text-align:left; cursor:pointer; font-family:inherit; }
.home-root .menu-profile:hover { background:rgba(255,107,43,0.12); }
.home-root .menu-profile-avatar { width:40px; height:40px; border-radius:50%; background:var(--orange); color:#fff; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:900; flex-shrink:0; }
.home-root .menu-profile-info { flex:1; min-width:0; }
.home-root .menu-profile-name { font-size:15px; font-weight:900; color:var(--text); }
.home-root .menu-profile-role { font-size:12px; color:var(--text-dim); margin-top:2px; }
.home-root .menu-profile-code { font-size:11px; font-weight:700; color:var(--orange); margin-top:3px; }
.home-root header.page-head { text-align:center; padding:28px 0 24px; }
.home-root .header-icon { font-size:40px; display:block; margin-bottom:12px; filter:drop-shadow(0 0 12px rgba(255,107,43,0.5)); }
.home-root header.page-head h1 { font-size:22px; font-weight:900; letter-spacing:-0.5px; }
.home-root .page-sub { font-size:13px; color:var(--text-dim); margin-top:6px; }
.home-root .view { display:none; }
.home-root .view.active { display:block; animation: home-fadeIn 0.25s ease; }
@keyframes home-fadeIn { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
.home-root .view-head { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
.home-root .back-btn { width:38px; height:38px; border:1px solid var(--border); border-radius:10px; background:var(--steel-mid); color:var(--text); font-size:18px; cursor:pointer; flex-shrink:0; }
.home-root .view-head h2 { font-size:18px; font-weight:900; }
.home-root .card { background:var(--steel-mid); border:1px solid var(--border); border-radius:16px; padding:20px; margin-bottom:16px; }
.home-root .section-label { font-size:12px; font-weight:700; color:var(--text-dim); letter-spacing:0.8px; margin-bottom:12px; }
.home-root .toggle-link { display:block; text-align:center; margin-top:16px; font-size:13px; color:var(--text-dim); background:none; border:none; font-family:inherit; cursor:pointer; width:100%; padding:8px; }
.home-root .toggle-link:hover { color:var(--orange); }
.home-root .theme-toggle { display:flex; gap:8px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:12px; padding:4px; }
.home-root .theme-toggle-opt { flex:1; padding:12px 0; border:none; border-radius:9px; background:none; color:var(--text-dim); font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; }
.home-root .theme-toggle-opt.is-on { background:var(--orange); color:#fff; }
.home-root .field { margin-bottom:18px; }
.home-root .field label { display:block; font-size:12px; font-weight:700; color:var(--text-dim); letter-spacing:0.8px; margin-bottom:8px; }
.home-root .field input, .home-root .field textarea { width:100%; padding:14px 16px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:10px; color:var(--text); font-family:inherit; font-size:15px; outline:none; -webkit-appearance:none; }
.home-root .field input:focus, .home-root .field textarea:focus { border-color:var(--orange); }
.home-root #login-pw, .home-root #reg-pw-input, .home-root #reg-pw-input2 { font-size:26px; text-align:center; letter-spacing:8px; }
.home-root .submit-btn { width:100%; padding:16px; background:var(--orange); border:none; border-radius:12px; color:white; font-family:inherit; font-size:16px; font-weight:900; cursor:pointer; transition:all 0.2s; }
.home-root .submit-btn:hover { background:var(--orange-dark); }
.home-root .submit-btn:disabled { opacity:0.5; cursor:not-allowed; }
.home-root #login-btn { background:var(--nav-btn-bg); color:var(--orange); border:1.5px solid var(--nav-btn-border); }
.home-root #login-btn:hover { background:#f0f0f0; }
.home-root .error-msg { color:#ff4444; text-align:center; margin-top:14px; font-size:14px; display:none; }
.home-root .empty-state { text-align:center; padding:36px 20px; color:var(--text-dim); font-size:14px; }
.home-root .empty-state .empty-icon { font-size:32px; display:block; margin-bottom:10px; opacity:0.4; }
.home-root .loading-brand { text-align:center; padding-top:60px; }
.home-root .loading-brand-title { font-size:22px; font-weight:900; color:var(--text); letter-spacing:-0.5px; }
.home-root .loading-brand-sub { font-size:13px; color:var(--text-dim); margin-top:8px; }
.home-root .tool-list { display:flex; flex-direction:column; }
.home-root .section-label.tool-section { margin:20px 0 10px; }
.home-root .section-label.tool-section:first-of-type { margin-top:4px; }
.home-root .tool-card { background:var(--steel-mid); border:1.5px solid var(--border); border-radius:16px; padding:18px; display:flex; align-items:center; gap:16px; text-decoration:none; color:var(--text); transition:all 0.15s; margin-bottom:12px; cursor:pointer; }
.home-root .tool-card:hover { border-color:var(--orange); transform:translateY(-2px); }
.home-root .tool-icon { width:50px; height:50px; border-radius:13px; background:var(--steel-light); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:23px; flex-shrink:0; }
.home-root .tool-icon--blue { background:#2E7DFF; border-color:#2E7DFF; }
.home-root .tool-icon--purple { background:#8B5CF6; border-color:#8B5CF6; }
.home-root .tool-icon--teal { background:#14B8A6; border-color:#14B8A6; }
.home-root .tool-icon--amber { background:#F59E0B; border-color:#F59E0B; }
.home-root .tool-info { flex:1; min-width:0; }
.home-root .tool-name { font-size:15px; font-weight:900; margin-bottom:4px; }
.home-root .tool-desc { font-size:13px; color:var(--text-dim); line-height:1.5; }
.home-root .tool-arrow { color:var(--text-dim); font-size:22px; font-weight:900; flex-shrink:0; transition:all 0.15s; }
.home-root .tool-card:hover .tool-arrow { color:var(--orange); transform:translateX(2px); }
.home-root .tool-card--soon { opacity:0.55; cursor:default; }
.home-root .tool-card--soon:hover { border-color:var(--border); transform:none; }
.home-root .tool-card--hero { padding:20px; border-color:var(--orange); background:linear-gradient(135deg, rgba(255,107,43,0.22), var(--steel-mid) 60%); }
.home-root .tool-card--hero .tool-icon { width:56px; height:56px; font-size:26px; background:var(--orange); border-color:var(--orange); }
.home-root .tool-card--hero .tool-name { font-size:17px; }
.home-root .tool-card--hero .tool-arrow { color:var(--orange); }
.home-root .hero-chip { display:inline-block; margin-top:8px; font-size:11px; font-weight:700; color:#1A1E2E; background:#FFB98A; border:1px solid #FFB98A; border-radius:20px; padding:2px 10px; }
.home-root .tool-duo { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
.home-root .tool-duo .tool-card { flex-direction:column; align-items:flex-start; gap:10px; padding:16px; margin-bottom:0; }
.home-root .tool-duo .tool-icon { width:42px; height:42px; font-size:20px; }
.home-root .tool-duo .tool-name { font-size:15px; }
.home-root .tool-duo .tool-desc { font-size:12px; }
.home-root .tool-badge { font-size:11px; font-weight:700; color:var(--text-dim); background:var(--steel-light); border:1px solid var(--border); border-radius:20px; padding:2px 10px; margin-left:8px; }
.home-root .notify-badge { font-size:11px; font-weight:800; color:#fff; background:#D3453F; border-radius:20px; padding:2px 8px; margin-left:8px; }
.home-root .tool-card--admin { border-color:rgba(255,107,43,0.35); background:rgba(255,107,43,0.06); }
.home-root .approve-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 0; border-bottom:1px solid var(--border); }
.home-root .approve-row:last-child { border-bottom:none; padding-bottom:0; }
.home-root .approve-name { font-size:15px; font-weight:700; }
.home-root .approve-actions { display:flex; gap:8px; flex-shrink:0; }
.home-root .approve-btn { padding:8px 14px; border-radius:10px; font-family:inherit; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid rgba(59,232,138,0.4); background:rgba(59,232,138,0.08); color:var(--give); }
.home-root .approve-btn:hover { background:rgba(59,232,138,0.18); }
.home-root .reject-btn { padding:8px 14px; border-radius:10px; font-family:inherit; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid rgba(255,68,68,0.3); background:transparent; color:rgba(255,68,68,0.7); }
.home-root .reject-btn:hover { background:rgba(255,68,68,0.1); }
.home-root .transfer-btn { padding:8px 14px; border-radius:10px; font-family:inherit; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid rgba(255,107,43,0.4); background:rgba(255,107,43,0.08); color:var(--orange); }
.home-root .transfer-btn:hover { background:rgba(255,107,43,0.18); }
.home-root .app-footer { display:flex; align-items:center; justify-content:center; gap:10px; margin-top:28px; padding-top:18px; border-top:1px solid var(--border); flex-wrap:wrap; }
.home-root .app-footer a { font-size:11px; color:var(--text-dim); text-decoration:none; }
.home-root .app-footer a:hover { color:var(--orange); }
.home-root .app-footer-sep { font-size:11px; color:var(--border); }
.home-root .toast { position:fixed; top:24px; left:50%; transform:translateX(-50%) translateY(-80px); background:var(--give); color:#0a1a0f; padding:12px 24px; border-radius:50px; font-size:14px; font-weight:700; transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1); white-space:nowrap; z-index:999; }
.home-root .toast.show { transform:translateX(-50%) translateY(0); }
`;

const TEMPLATE = `
<div class="home-root">
  <div class="toast" id="home-toast">✅ 완료!</div>

  <header class="site-header">
    <a href="https://praiselab.net/" class="brand">
      Feeder
      <span class="brand-sub">현장도구모음</span>
    </a>
    <button class="hamburger-btn" id="hamburger-btn" onclick="window.__home.openMenu()" aria-label="메뉴">☰</button>
  </header>

  <div class="menu-overlay" id="menu-overlay" onclick="window.__home.closeMenu()">
    <div class="menu-sheet" onclick="event.stopPropagation()">
      <div class="menu-head">
        <span class="menu-title">메뉴</span>
        <div style="display:flex; align-items:center; gap:2px;">
          <div class="theme-quickswitch" onclick="event.stopPropagation()">
            <button class="theme-quickswitch-opt" id="theme-quick-dark" onclick="window.__home.setTheme('dark')" aria-label="다크 테마">🌙</button>
            <button class="theme-quickswitch-opt" id="theme-quick-light" onclick="window.__home.setTheme('light')" aria-label="화이트 테마">☀️</button>
          </div>
          <button class="menu-close" onclick="window.__home.closeMenu()" aria-label="닫기">✕</button>
        </div>
      </div>
      <button class="menu-profile" id="menu-profile-btn" onclick="window.__home.closeMenu(); window.__home.go('view-my-profile');">
        <div class="menu-profile-avatar" id="menu-profile-avatar">-</div>
        <div class="menu-profile-info">
          <div class="menu-profile-name" id="menu-profile-name">-</div>
          <div class="menu-profile-role" id="menu-profile-role">-</div>
          <div class="menu-profile-code" id="menu-profile-code" style="display:none;"></div>
        </div>
        <span class="tool-arrow">›</span>
      </button>
      <button class="menu-item" id="menu-guest" onclick="window.__home.closeMenu(); window.__home.go('view-login');" style="display:none;">
        <span class="menu-item-icon">🔑</span><span>로그인 / 회원가입</span>
      </button>
      <button class="menu-item" id="menu-admin" onclick="window.__home.closeMenu(); window.__home.go('view-admin-hub');" style="display:none;">
        <span class="menu-item-icon">🔑</span><span>팀장 기능</span>
      </button>
      <button class="menu-item" id="menu-team-join" onclick="window.__home.closeMenu(); window.__home.go('view-team-join');">
        <span class="menu-item-icon">🔗</span><span>팀 참가</span>
      </button>
      <button class="menu-item" id="menu-admin-request" onclick="window.__home.closeMenu(); window.__home.go('view-admin-request');">
        <span class="menu-item-icon">📋</span><span>직위 변경</span>
      </button>
      <button class="menu-item" id="menu-inquiry" onclick="window.__home.closeMenu(); window.__home.go('view-inquiry'); window.__home.renderInquiryList();" style="display:none;">
        <span class="menu-item-icon">📮</span><span>문의하기</span>
      </button>
      <button class="menu-item" onclick="window.__home.closeMenu(); window.__home.go('view-settings'); window.__home.renderSettings();">
        <span class="menu-item-icon">⚙️</span><span>설정</span>
      </button>
      <button class="menu-item menu-item--logout" id="menu-logout-btn" onclick="window.__home.closeMenu(); window.__home.logout();">
        <span class="menu-item-icon">🚪</span><span>로그아웃</span>
      </button>
    </div>
  </div>

  <div class="container">

    <div class="view active" id="view-loading">
      <div class="loading-brand" id="loading-text">
        <div class="loading-brand-title">Feeder</div>
        <div class="loading-brand-sub">불러오는 중…</div>
      </div>
    </div>

    <div class="view" id="view-login">
      <div class="view-head" style="margin-bottom:-14px;">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
      </div>
      <header class="page-head" style="padding:10px 0 14px;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <h1 style="font-size:26px;">🧰 피더</h1>
          <span class="page-sub" style="margin-top:0;font-size:13px;">현장도구모음</span>
        </div>
      </header>
      <div class="card" id="login-join-banner" style="display:none; border-left:3px solid var(--orange); font-size:13px; line-height:1.6; color:var(--text-dim);">
        🔗 팀 초대 링크로 오셨어요 (코드 <b style="color:var(--text);" id="login-join-code"></b>). 로그인하거나 가입하면 바로 참가 확인창이 떠요.
      </div>
      <div class="card">
        <div class="field">
          <label>아이디</label>
          <input type="text" id="login-name" placeholder="아이디" autocomplete="username" />
        </div>
        <div class="field">
          <label>비밀번호 6자리</label>
          <input type="password" id="login-pw" inputmode="numeric" maxlength="6" placeholder="••••••" />
        </div>
        <button class="submit-btn" id="login-btn" onclick="window.__home.login()">로그인</button>
        <div class="error-msg" id="login-error">🔒 아이디 또는 비밀번호가 맞지 않아요</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;">
          <button class="toggle-link" style="margin-top:0;width:auto;padding:8px 4px;" onclick="window.__home.go('view-register')">회원가입</button>
          <span style="color:var(--border);font-size:13px;">|</span>
          <button class="toggle-link" style="margin-top:0;width:auto;padding:8px 4px;" onclick="window.__home.go('view-forgot-password')">비밀번호 찾기</button>
        </div>
        <div style="display:flex; align-items:center; gap:10px; margin:10px 0;">
          <div style="flex:1; height:1px; background:var(--border);"></div>
          <span style="font-size:12px; color:var(--text-dim);">또는</span>
          <div style="flex:1; height:1px; background:var(--border);"></div>
        </div>
        <button type="button" id="google-login-btn" onclick="window.__home.googleLogin()" style="width:100%; display:flex; align-items:center; justify-content:center; gap:10px; padding:12px; background:#fff; color:#3C4043; border:1px solid #dadce0; border-radius:10px; font-family:inherit; font-size:15px; font-weight:600; cursor:pointer;">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.5 29.6 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.9-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 6.5 29.6 4.5 24 4.5c-7.7 0-14.4 4.4-17.7 10.2z"/><path fill="#4CAF50" d="M24 44.5c5.5 0 10.4-1.9 14.1-5.1l-6.5-5.5c-2 1.4-4.6 2.3-7.6 2.3-5.3 0-9.7-3.1-11.3-7.6l-6.6 5.1C9.5 40 16.2 44.5 24 44.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.5 5.5C41.9 35.9 44.5 30.5 44.5 24c0-1.2-.1-2.4-.9-3.5z"/></svg>
          Google로 계속하기
        </button>
        <div class="error-msg" id="google-login-error"></div>
      </div>
    </div>

    <div class="view" id="view-forgot-password">
      <div class="view-head">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
        <h2>비밀번호 찾기</h2>
      </div>
      <div class="card">
        <div class="field">
          <label>아이디</label>
          <input type="text" id="forgot-username" placeholder="아이디" />
        </div>
        <button class="submit-btn" id="forgot-btn" onclick="window.__home.requestPasswordReset()">재설정 메일 보내기</button>
        <div class="error-msg" id="forgot-error"></div>
      </div>
    </div>

    <div class="view" id="view-register">
      <div class="view-head">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
        <h2>회원가입</h2>
      </div>
      <div class="card" id="register-join-banner" style="display:none; border-left:3px solid var(--orange); font-size:13px; line-height:1.6; color:var(--text-dim);">
        🔗 팀 초대 링크로 오셨어요 (코드 <b style="color:var(--text);" id="register-join-code"></b>). 가입하면 바로 참가 확인창이 떠요.
      </div>
      <div class="card">
        <div class="field"><label>아이디</label><input type="text" id="reg-username" placeholder="영문/숫자 4~20자" autocomplete="off" /></div>
        <div class="field"><label>비밀번호 6자리</label><input type="password" id="reg-pw-input" inputmode="numeric" maxlength="6" placeholder="••••••" /></div>
        <div class="field"><label>비밀번호 확인</label><input type="password" id="reg-pw-input2" inputmode="numeric" maxlength="6" placeholder="••••••" /></div>
        <div class="field"><label>닉네임</label><input type="text" id="reg-nickname" placeholder="현장에서 불릴 이름" /></div>
        <div class="field"><label>이메일</label><input type="email" id="reg-email" placeholder="example@email.com" /></div>
        <button class="submit-btn" id="reg-btn" onclick="window.__home.register()">등록하기</button>
        <div style="font-size:12px;color:var(--text-dim);margin-top:14px;line-height:1.6;text-align:center;">
          가입하면 바로 이용할 수 있어요. 팀에 들어가려면 가입 후 메뉴에서 팀 코드를 입력하세요.
        </div>
      </div>
    </div>

    <div class="view" id="view-team-join">
      <div class="view-head">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
        <h2>팀 참가</h2>
      </div>
      <div class="card" id="team-join-body"></div>
    </div>

    <div class="view" id="view-admin-request">
      <div class="view-head">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
        <h2>직위 변경</h2>
      </div>
      <div class="card" id="admin-request-body"></div>
    </div>

    <div class="view" id="view-my-profile">
      <div class="view-head">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
        <h2>내 정보</h2>
      </div>
      <div class="card" id="my-profile-body"></div>
      <div class="card" id="my-profile-team-body"></div>
      <div class="card" id="my-profile-delete-body"></div>
    </div>

    <div class="view" id="view-settings">
      <div class="view-head">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
        <h2>설정</h2>
      </div>
      <div class="card">
        <div class="field" style="margin-bottom:0;">
          <label>화면 테마</label>
          <div class="theme-toggle">
            <button class="theme-toggle-opt" id="theme-opt-dark" onclick="window.__home.setTheme('dark')">다크</button>
            <button class="theme-toggle-opt" id="theme-opt-light" onclick="window.__home.setTheme('light')">화이트</button>
          </div>
        </div>
      </div>
    </div>

    <div class="view" id="view-inquiry">
      <div class="view-head">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
        <h2>문의하기</h2>
      </div>
      <div class="card form-card">
        <div class="field">
          <label>유형</label>
          <div class="theme-toggle">
            <button type="button" class="theme-toggle-opt is-on" id="inquiry-type-bug" onclick="window.__home.setInquiryType('bug')">🐛 버그 신고</button>
            <button type="button" class="theme-toggle-opt" id="inquiry-type-suggest" onclick="window.__home.setInquiryType('suggest')">💡 건의사항</button>
          </div>
        </div>
        <div class="field">
          <label>내용</label>
          <textarea id="inquiry-content" rows="5" placeholder="어떤 문제가 있었는지, 어떤 기능이 있으면 좋을지 자유롭게 남겨주세요"></textarea>
        </div>
        <button class="submit-btn" id="inquiry-save-btn" onclick="window.__home.submitInquiry()">보내기</button>
        <div class="error-msg" id="inquiry-error"></div>
      </div>
      <div class="card">
        <div style="font-size:13px; font-weight:700; color:var(--text-dim); margin-bottom:12px;">내가 보낸 문의</div>
        <div class="list" id="inquiry-list"></div>
      </div>
    </div>

    <div class="view" id="view-pending">
      <header class="page-head">
        <span class="header-icon">⏳</span>
        <h1>승인 대기 중</h1>
        <div class="page-sub" id="pending-name"></div>
      </header>
      <div class="card">
        <div style="font-size:14px;color:var(--text-dim);line-height:1.7;text-align:center;">
          팀장 승인을 기다리고 있어요.<br>승인되면 이 화면이 자동으로 넘어가요.
        </div>
      </div>
    </div>

    <div class="view" id="view-app">
      <div class="card" id="signup-team-banner" style="display:none; border-left:3px solid var(--orange);">
        <div style="display:flex; align-items:flex-start; gap:10px;">
          <span style="font-size:16px;">🔑</span>
          <div style="flex:1;">
            <div style="font-size:13.5px; line-height:1.5;">팀장이신가요? 팀 코드를 발급받아 팀원을 초대해보세요.</div>
            <button class="submit-btn" style="margin-top:10px; width:auto; padding:9px 16px; font-size:13px;" onclick="window.__home.claimTeamCodeFromBanner()">팀 코드 발급받기 →</button>
          </div>
          <button onclick="window.__home.dismissSignupBanner()" style="background:none; border:none; color:var(--text-dim); font-size:14px; cursor:pointer; padding:4px;" aria-label="닫기">✕</button>
        </div>
      </div>
      <a href="#" class="tool-card tool-card--hero" data-route="gongsu-calendar">
        <div class="tool-icon">📅</div>
        <div class="tool-info">
          <div class="tool-name">공수달력</div>
          <div class="tool-desc">출력일수 · 예상 급여 계산</div>
          <span class="hero-chip" id="hero-chip" style="display:none;"></span>
        </div>
        <span class="tool-arrow">›</span>
      </a>
      <div class="section-label tool-section">팀 업무</div>
      <div class="tool-duo">
        <a href="#" class="tool-card" onclick="window.__home.goToolCard('qty-report', event)">
          <div class="tool-icon tool-icon--blue">🧾</div>
          <div class="tool-info"><div class="tool-name">물량작성</div><div class="tool-desc">입력 · 합산 · 공유</div></div>
        </a>
        <a href="#" class="tool-card" onclick="window.__home.goToolCard('tool-rental', event)">
          <div class="tool-icon tool-icon--purple">🔧</div>
          <div class="tool-info"><div class="tool-name">자재대여</div><div class="tool-desc">대여 기록 · 반납</div></div>
        </a>
      </div>
      <div class="section-label tool-section">팀 게임</div>
      <a href="#" class="tool-card" onclick="window.__home.goGamesCard(event)">
        <div class="tool-icon tool-icon--amber">🎮</div>
        <div class="tool-info"><div class="tool-name">게임모음</div><div class="tool-desc">사다리타기 · 룰렛돌리기</div></div>
        <span class="tool-arrow">›</span>
      </a>
      <div class="section-label tool-section">커뮤니티</div>
      <a href="#" class="tool-card" data-route="community" id="community-entry">
        <div class="tool-icon tool-icon--teal">💬</div>
        <div class="tool-info"><div class="tool-name">피더 커뮤니티</div><div class="tool-desc">구인 · 구직 · 자유게시판</div></div>
        <span class="tool-arrow">›</span>
      </a>
      <div class="app-footer">
        <a href="mailto:diget910@gmail.com">고객지원</a>
        <span class="app-footer-sep">·</span>
        <a href="/tools/terms.html">이용약관</a>
        <span class="app-footer-sep">·</span>
        <a href="/tools/privacy.html">개인정보처리방침</a>
      </div>
    </div>

    <div class="view" id="view-admin-hub">
      <div class="view-head">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
        <h2>팀장 기능</h2>
      </div>
      <div class="card">
        <div class="section-label">내 팀 코드</div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div id="admin-team-code" style="font-size:22px; font-weight:900; letter-spacing:2px;">-</div>
          <button class="approve-btn" style="margin-left:auto;" onclick="window.__home.copyTeamCode()">복사</button>
        </div>
        <button class="submit-btn" style="margin-top:12px;" onclick="window.__home.shareTeamInvite()">📤 초대링크 공유하기</button>
        <div style="font-size:12px; color:var(--text-dim); margin-top:10px; line-height:1.6;">
          초대링크를 카톡으로 보내면 팀원이 누르는 것만으로 바로 참가돼요. 코드만 따로 받은 팀원은 메뉴의 "팀 참가"에서 직접 입력해도 돼요.
        </div>
      </div>
      <a href="#" class="tool-card tool-card--admin" id="dashboard-entry" data-route="admin-dashboard" style="display:none; margin-bottom:16px;">
        <div class="tool-icon">📊</div>
        <div class="tool-info">
          <div class="tool-name">운영자 대시보드<span class="notify-badge" id="dashboard-inquiry-badge" style="display:none;"></span></div>
          <div class="tool-desc">방문 통계 · 가입자 · 접속자 · 문의함</div>
        </div>
        <span class="tool-arrow">›</span>
      </a>
      <div class="tool-list">
        <a href="#" class="tool-card tool-card--admin" onclick="window.__home.openAdminApprove(); return false;">
          <div class="tool-icon">🔑</div>
          <div class="tool-info"><div class="tool-name">팀원 관리</div><div class="tool-desc">소속 팀원 목록 · 내보내기</div></div>
          <span class="tool-arrow">›</span>
        </a>
        <a href="#" class="tool-card tool-card--admin" data-route="gongsu-admin">
          <div class="tool-icon">📊</div>
          <div class="tool-info"><div class="tool-name">공수달력 관리</div><div class="tool-desc">현장별 팀단가 · 숙식비 · 차익금 관리</div></div>
          <span class="tool-arrow">›</span>
        </a>
      </div>
    </div>

    <div class="view" id="view-admin-approve">
      <div class="view-head">
        <button class="back-btn" onclick="window.__home.goBack()">‹</button>
        <h2>팀원 관리</h2>
      </div>
      <div class="card">
        <div class="section-label">소속 팀원</div>
        <div id="member-list"></div>
      </div>
    </div>

  </div>
</div>
`;

const colGongsuCalendars = db.collection('gongsu_calendars');
const colInquiries = db.collection('tools_inquiries');
const colTeams = db.collection('tools_teams');
const EMAIL_DOMAIN = 'feeder.praiselab.internal';

const GC_DAILY_TAX_DEDUCTION = 150000;
const GC_INCOME_TAX_EFFECTIVE = 0.027;
const GC_MIN_WITHHOLDING = 1000;
const GC_LOCAL_TAX_RATE = 0.10;
const GC_PENSION_RATE = 0.0475;
const GC_HEALTH_RATE = 0.03595;
const GC_LTC_RATE_OF_HEALTH = 0.1314;
const GC_EMPLOYMENT_RATE = 0.009;
const GC_PENSION_HEALTH_MIN_DAYS = 8;
const GC_FREELANCE_TAX_RATE = 0.03;
const INQUIRY_TYPE_LABEL = { bug: '🐛 버그 신고', suggest: '💡 건의사항' };

function gcDailyIncomeTax(grossPay) {
  const taxable = grossPay - GC_DAILY_TAX_DEDUCTION;
  if (taxable <= 0) return 0;
  const tax = Math.floor(taxable * GC_INCOME_TAX_EFFECTIVE);
  return tax < GC_MIN_WITHHOLDING ? 0 : tax;
}
function gcFreelanceIncomeTax(grossPay) {
  const tax = Math.floor(grossPay * GC_FREELANCE_TAX_RATE);
  return tax < GC_MIN_WITHHOLDING ? 0 : tax;
}
function gcWon(n) { return Math.round(n || 0).toLocaleString('ko-KR') + '원'; }
function gcFmtG(g) {
  if (g === 0) return '0';
  const r = Math.round(g * 100) / 100;
  return Number.isInteger(r) ? r.toFixed(1) : String(r);
}
function computeHomeSummary(entries, start, end, defaultUnitPrice, taxMode) {
  let totalGongsu = 0, totalGross = 0, totalIncomeTax = 0, totalAllowance = 0, workDays = 0;
  Object.entries(entries || {}).forEach(([date, e]) => {
    if (date < start || date > end) return;
    const g = e.gongsu || 0;
    if (g <= 0) return;
    totalGongsu += g;
    workDays += 1;
    totalAllowance += e.allowance || 0;
    const unitPrice = e.unitPrice != null ? e.unitPrice : defaultUnitPrice;
    const grossDay = g * unitPrice;
    totalGross += grossDay;
    totalIncomeTax += taxMode === 'freelance33' ? gcFreelanceIncomeTax(grossDay) : gcDailyIncomeTax(grossDay);
  });
  const localIncomeTax = Math.floor(totalIncomeTax * GC_LOCAL_TAX_RATE);
  let pension = 0, health = 0, ltc = 0, employment = 0;
  if (taxMode !== 'freelance33' && workDays > 0) {
    employment = totalGross * GC_EMPLOYMENT_RATE;
    if (workDays >= GC_PENSION_HEALTH_MIN_DAYS) {
      pension = totalGross * GC_PENSION_RATE;
      health = totalGross * GC_HEALTH_RATE;
      ltc = health * GC_LTC_RATE_OF_HEALTH;
    }
  }
  const totalTax = totalIncomeTax + localIncomeTax;
  const totalInsurance = Math.floor(pension) + Math.floor(health) + Math.floor(ltc) + Math.floor(employment);
  const netPay = totalGross - totalTax - totalInsurance + totalAllowance;
  return { totalGongsu, netPay };
}
function currentMonthRange() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = new Date(y, m + 1, 0).getDate();
  return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(lastDay)}`, month: m + 1 };
}
function displayName(u) { return u.nickname || u.name || u.username || '이름없음'; }
function roleLabel(u) { if (u.isOperator) return '운영자'; if (u.isAdmin) return '팀장'; return '반장'; }
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function mount(container) {
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
  }
  container.innerHTML = TEMPLATE;

  const $ = (id) => document.getElementById(id);

  let users = [];
  let myProfile = null;
  let gongsuSummaryLoaded = false;
  let consumedAdminParam = false;
  let consumedSettingsParam = false;
  let consumedProfileParam = false;
  let consumedInquiryParam = false;
  let consumedJoinParam = false;
  let pendingJoinCode = null;
  let pendingJoinInfo = null;
  let inquiryType = 'bug';
  let myInquiries = [];
  let myInquiriesUnsub = null;
  let openInquiryUnsub = null;
  let viewStack = ['view-app'];

  function showView(viewId) {
    container.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = $(viewId);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
  }
  // 라우터의 popstate 처리와 충돌하는 걸 피하려고 history API 대신 로컬 스택을 씀(파일 상단 설명 참고)
  function syncView(viewId) { viewStack[viewStack.length - 1] = viewId; showView(viewId); }
  function go(viewId) { viewStack.push(viewId); showView(viewId); }
  function goBack() {
    if (viewStack.length > 1) viewStack.pop();
    showView(viewStack[viewStack.length - 1]);
  }

  function goToolCard(routeName, e) {
    if (e) e.preventDefault();
    if (!requireLogin()) return;
    routerNavigate(routeName);
  }
  function goGamesCard(e) {
    if (e) e.preventDefault();
    if (!checkTeamGameAccess()) return;
    routerNavigate('games');
  }

  function loadGongsuSummary(uid) {
    if (gongsuSummaryLoaded) return;
    gongsuSummaryLoaded = true;
    colGongsuCalendars.doc(uid).get().then((doc) => {
      if (!doc.exists || doc.data().data == null) return;
      const state = JSON.parse(doc.data().data);
      const { start, end, month } = currentMonthRange();
      const { totalGongsu, netPay } = computeHomeSummary(state.entries, start, end, state.defaultUnitPrice, state.taxMode);
      if (totalGongsu <= 0) return;
      const chip = $('hero-chip');
      if (!chip) return;
      chip.textContent = `${month}월 ${gcFmtG(totalGongsu)}공수 · 실수령 ${gcWon(netPay)}`;
      chip.style.display = '';
    }).catch(() => {});
  }

  function renderMyProfile() {
    const el = $('my-profile-body');
    if (!el || !myProfile) return;
    const rawEmail = myProfile.email || '';
    const emailDisplay = (!rawEmail || rawEmail.endsWith('@' + EMAIL_DOMAIN)) ? '등록된 이메일 없음' : rawEmail;
    const rows = [
      ['아이디', myProfile.username || myProfile.name || '-'],
      ['이메일', emailDisplay],
      ['역할', roleLabel(myProfile)],
    ];
    if (myProfile.isAdmin) rows.push(['내 팀 코드', myProfile.adminTeamCode || '아직 발급 전']);
    el.innerHTML = `
      <div class="field" style="margin-bottom:16px;">
        <label>닉네임</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="nickname-input" value="${escapeHtml(displayName(myProfile))}" style="flex:1;" />
          <button class="submit-btn" style="width:auto;padding:0 18px;" onclick="window.__home.saveNickname()">저장</button>
        </div>
      </div>
      ${rows.map(([label, value]) => `
        <div class="approve-row">
          <span style="font-size:13px;color:var(--text-dim);">${escapeHtml(label)}</span>
          <span style="font-size:14px;font-weight:700;">${escapeHtml(String(value))}</span>
        </div>
      `).join('')}`;
    renderMyProfileTeam();
    renderMyProfileDelete();
  }

  function saveNickname() {
    const input = $('nickname-input');
    const val = input.value.trim();
    if (!val) { alert('닉네임을 입력해주세요!'); return; }
    if (val.length > 30) { alert('닉네임은 30자 이내로 입력해주세요!'); return; }
    colUsers.doc(auth.currentUser.uid).update({ nickname: val })
      .then(() => showToast('닉네임을 변경했어요'))
      .catch(() => alert('변경 실패. 다시 시도해주세요.'));
  }

  function renderMyProfileTeam() {
    const el = $('my-profile-team-body');
    if (!el || !myProfile) return;
    if (myProfile.isAdmin) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = '';
    if (!myProfile.teamCode) {
      el.innerHTML = `
        <div style="font-size:14px;color:var(--text-dim);line-height:1.7;text-align:center;">아직 소속된 팀이 없어요.</div>
        <button class="submit-btn" style="margin-top:14px;" onclick="window.__home.go('view-team-join')">팀 참가하기 →</button>`;
    } else if (myProfile.memberStatus === 'approved') {
      el.innerHTML = `
        <div style="font-size:14px;color:var(--text-dim);line-height:1.7;text-align:center;">
          <b style="color:var(--text)">${escapeHtml(myProfile.teamCode)}</b> 팀 소속이에요.
        </div>
        <button class="submit-btn" style="background:transparent;border:1.5px solid var(--border);color:var(--text-dim);margin-top:16px;" onclick="window.__home.leaveTeam()">팀 탈퇴</button>`;
    } else {
      el.innerHTML = `
        <div style="font-size:14px;color:var(--text-dim);line-height:1.7;text-align:center;">
          <b style="color:var(--text)">${escapeHtml(myProfile.teamCode)}</b> 팀 참가 승인을 기다리고 있어요.
        </div>
        <button class="submit-btn" style="background:transparent;border:1.5px solid var(--border);color:var(--text-dim);margin-top:16px;" onclick="window.__home.cancelTeamJoin()">신청 취소</button>`;
    }
  }

  function renderMyProfileDelete() {
    const el = $('my-profile-delete-body');
    if (!el || !myProfile) return;
    if (myProfile.isAdmin) {
      el.innerHTML = `
        <div style="font-size:12px;color:var(--text-dim);line-height:1.7;text-align:center;">
          팀장 계정은 바로 탈퇴할 수 없어요.<br>팀장을 다른 사람에게 넘기거나 운영자에게 문의해주세요.
        </div>`;
      return;
    }
    el.innerHTML = `<button class="toggle-link" style="display:block;width:auto;margin:0 auto;padding:8px 20px;font-size:14px;font-weight:700;color:#ff8a8a;border:1px solid rgba(255,138,138,0.35);border-radius:10px;background:rgba(255,138,138,0.08);" onclick="window.__home.deleteAccount()">회원 탈퇴</button>`;
  }

  function runAccountDeletion(uid) {
    return db.collection('gongsu_calendars').doc(uid).delete().catch(() => {})
      .then(() => db.collection('gongsu_leaderboard').doc(uid).delete().catch(() => {}))
      .then(() => colUsers.doc(uid).delete())
      .then(() => auth.currentUser.delete());
  }

  function deleteAccount() {
    if (!myProfile || !auth.currentUser) return;
    if (myProfile.isAdmin) return;
    if (!confirm('정말 탈퇴하시겠어요?\n계정과 공수달력 데이터가 모두 삭제되고 되돌릴 수 없어요.')) return;
    const uid = auth.currentUser.uid;
    const email = myProfile.authEmail || myProfile.email;
    runAccountDeletion(uid)
      .then(() => showToast('탈퇴가 완료됐어요'))
      .catch((err) => {
        if (err.code !== 'auth/requires-recent-login') { alert('탈퇴 처리에 실패했어요. 다시 시도해주세요.'); return; }
        const pw = prompt('보안을 위해 비밀번호를 다시 입력해주세요');
        if (!pw) return;
        const cred = firebase.auth.EmailAuthProvider.credential(email, pw);
        auth.currentUser.reauthenticateWithCredential(cred)
          .then(() => runAccountDeletion(uid))
          .then(() => showToast('탈퇴가 완료됐어요'))
          .catch(() => alert('비밀번호가 맞지 않거나 처리에 실패했어요. 다시 시도해주세요.'));
      });
  }

  let currentTheme = localStorage.getItem('feederTheme') || 'light';
  function setTheme(t) {
    currentTheme = t;
    localStorage.setItem('feederTheme', t);
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    renderSettings();
  }
  function renderSettings() {
    $('theme-opt-dark')?.classList.toggle('is-on', currentTheme !== 'light');
    $('theme-opt-light')?.classList.toggle('is-on', currentTheme === 'light');
    $('theme-quick-dark')?.classList.toggle('is-active', currentTheme !== 'light');
    $('theme-quick-light')?.classList.toggle('is-active', currentTheme === 'light');
  }

  function setInquiryType(type) {
    inquiryType = type;
    $('inquiry-type-bug').classList.toggle('is-on', type === 'bug');
    $('inquiry-type-suggest').classList.toggle('is-on', type === 'suggest');
  }

  function submitInquiry() {
    const content = $('inquiry-content').value.trim();
    const errEl = $('inquiry-error');
    errEl.style.display = 'none';
    if (!content) { errEl.textContent = '내용을 입력해주세요!'; errEl.style.display = 'block'; return; }
    if (!myUidSafe()) { errEl.textContent = '로그인 후 이용할 수 있어요.'; errEl.style.display = 'block'; return; }
    const btn = $('inquiry-save-btn');
    btn.disabled = true;
    colInquiries.add({
      type: inquiryType, content, authorUid: auth.currentUser.uid,
      authorName: displayName(myProfile || {}), status: 'open',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
      .then(() => { $('inquiry-content').value = ''; showToast('문의가 접수됐어요. 확인 후 반영할게요!'); })
      .catch(() => { errEl.textContent = '전송 실패. 인터넷 연결을 확인해주세요.'; errEl.style.display = 'block'; })
      .finally(() => { btn.disabled = false; });
  }

  function myUidSafe() { return auth.currentUser && auth.currentUser.uid; }

  function formatInquiryDate(ts) {
    if (!ts) return '';
    const d = ts.toDate();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  }

  function renderInquiryList() {
    if (!myUidSafe()) return;
    if (!myInquiriesUnsub) {
      myInquiriesUnsub = colInquiries.where('authorUid', '==', auth.currentUser.uid).onSnapshot((snap) => {
        myInquiries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        myInquiries.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
        paintInquiryList();
      }, () => { $('inquiry-list').innerHTML = '<div class="empty-state">⚠️ 연결 오류. 새로고침 해주세요.</div>'; });
    }
  }

  function startOpenInquiryWatch() {
    if (openInquiryUnsub) return;
    openInquiryUnsub = colInquiries.where('status', '==', 'open').onSnapshot((snap) => {
      const badge = $('dashboard-inquiry-badge');
      if (!badge) return;
      if (snap.size > 0) { badge.textContent = snap.size; badge.style.display = ''; }
      else { badge.style.display = 'none'; }
    }, () => {});
  }
  function stopOpenInquiryWatch() {
    if (openInquiryUnsub) { openInquiryUnsub(); openInquiryUnsub = null; }
  }

  function paintInquiryList() {
    const list = $('inquiry-list');
    if (!myInquiries.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">📮</span>아직 보낸 문의가 없어요</div>';
      return;
    }
    list.innerHTML = myInquiries.map((q) => `
      <div class="approve-row" style="align-items:flex-start; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="tool-badge">${INQUIRY_TYPE_LABEL[q.type] || q.type}</span>
          <span style="font-size:11px; color:var(--text-dim);">${q.status === 'open' ? '접수됨' : '처리완료'} · ${formatInquiryDate(q.createdAt)}</span>
        </div>
        <div style="font-size:13px; line-height:1.5; white-space:pre-wrap;">${escapeHtml(q.content)}</div>
      </div>
    `).join('');
  }

  function showToast(msg) {
    const t = $('home-toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  function renderLoginJoinBanner() {
    const loginBanner = $('login-join-banner');
    const registerBanner = $('register-join-banner');
    if (!loginBanner || !registerBanner) return;
    if (pendingJoinCode) {
      $('login-join-code').textContent = pendingJoinCode;
      $('register-join-code').textContent = pendingJoinCode;
      loginBanner.style.display = '';
      registerBanner.style.display = '';
    } else {
      loginBanner.style.display = 'none';
      registerBanner.style.display = 'none';
    }
  }

  function login() {
    const input = $('login-name').value.trim();
    const pw = $('login-pw').value;
    const errorEl = $('login-error');
    errorEl.style.display = 'none';
    if (!input) { alert('아이디를 입력해주세요!'); return; }
    if (!/^\d{6}$/.test(pw)) { errorEl.textContent = '🔒 비밀번호는 숫자 6자리예요'; errorEl.style.display = 'block'; return; }
    const u = users.find((x) => x.username === input) || users.find((x) => x.name === input);
    if (!u) { errorEl.textContent = '🔒 아이디 또는 비밀번호가 맞지 않아요'; errorEl.style.display = 'block'; return; }
    const btn = $('login-btn');
    btn.disabled = true;
    auth.signInWithEmailAndPassword(u.authEmail || u.email, pw)
      .catch(() => {
        errorEl.textContent = '🔒 아이디 또는 비밀번호가 맞지 않아요';
        errorEl.style.display = 'block';
        $('login-pw').value = '';
      })
      .finally(() => { btn.disabled = false; });
  }

  function register() {
    const username = $('reg-username').value.trim();
    const pw = $('reg-pw-input').value;
    const pw2 = $('reg-pw-input2').value;
    const nickname = $('reg-nickname').value.trim();
    const email = $('reg-email').value.trim();
    if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) { alert('아이디는 영문/숫자 4~20자로 입력해주세요!'); return; }
    if (users.some((u) => u.username === username)) { alert('이미 등록된 아이디예요.'); return; }
    if (!/^\d{6}$/.test(pw)) { alert('비밀번호는 숫자 6자리로 입력해주세요!'); return; }
    if (pw !== pw2) { alert('비밀번호 확인이 일치하지 않아요.'); return; }
    if (!nickname) { alert('닉네임을 입력해주세요!'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('이메일 형식을 확인해주세요!'); return; }
    const btn = $('reg-btn');
    btn.disabled = true;
    auth.createUserWithEmailAndPassword(email, pw)
      .then((cred) => colUsers.doc(cred.user.uid).set({
        username, nickname, email, status: 'approved', isAdmin: false, role: 'member',
        teamCode: null, memberStatus: null, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }))
      .then(() => { sessionStorage.setItem('feederJustRegistered', '1'); showToast('✅ 가입 완료!'); })
      .catch((err) => {
        alert(err.code === 'auth/email-already-in-use' ? '이미 등록된 이메일이에요.' : '등록 실패. 인터넷 연결을 확인해주세요.');
      })
      .finally(() => { btn.disabled = false; });
  }

  function googleLogin() {
    const errorEl = $('google-login-error');
    errorEl.style.display = 'none';
    const btn = $('google-login-btn');
    btn.disabled = true;
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then((cred) => {
        const ref = colUsers.doc(cred.user.uid);
        return ref.get().then((doc) => {
          if (doc.exists) return;
          return ref.set({
            nickname: cred.user.displayName || '이름없음', email: cred.user.email || null,
            provider: 'google', status: 'approved', isAdmin: false, role: 'member',
            teamCode: null, memberStatus: null, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        });
      })
      .catch((err) => {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
        errorEl.textContent = (err.code === 'auth/operation-not-supported-in-this-environment' || err.code === 'auth/disallowed-useragent')
          ? '🔒 카톡 등 인앱 브라우저에서는 구글 로그인이 안 돼요. 우측 상단 메뉴에서 "다른 브라우저로 열기"를 눌러주세요.'
          : (err.code === 'auth/account-exists-with-different-credential')
            ? '🔒 이미 아이디/비번으로 가입된 이메일이에요. 그 방식으로 로그인해주세요.'
            : '🔒 구글 로그인에 실패했어요. 다시 시도해주세요.';
        errorEl.style.display = 'block';
      })
      .finally(() => { btn.disabled = false; });
  }

  function requestPasswordReset() {
    const input = $('forgot-username').value.trim();
    const errorEl = $('forgot-error');
    errorEl.style.display = 'none';
    if (!input) { alert('아이디를 입력해주세요!'); return; }
    const u = users.find((x) => x.username === input) || users.find((x) => x.name === input);
    if (!u) { errorEl.textContent = '🔒 해당 아이디를 찾을 수 없어요'; errorEl.style.display = 'block'; return; }
    const email = u.authEmail || u.email;
    if (!email || email.endsWith('@' + EMAIL_DOMAIN)) {
      errorEl.textContent = '이 계정은 등록된 이메일이 없어요. 운영자에게 문의해주세요.';
      errorEl.style.display = 'block';
      return;
    }
    const btn = $('forgot-btn');
    btn.disabled = true;
    auth.sendPasswordResetEmail(email)
      .then(() => showToast('✅ 재설정 메일을 보냈어요'))
      .catch(() => alert('전송 실패. 잠시 후 다시 시도해주세요.'))
      .finally(() => { btn.disabled = false; });
  }

  function renderTeamJoin() {
    const el = $('team-join-body');
    if (!el || !myProfile) return;
    if (!myProfile.teamCode && pendingJoinInfo) {
      el.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:15px; margin-bottom:8px;">🔗 초대 링크로 오셨어요</div>
          <div style="font-size:14px; color:var(--text-dim); line-height:1.6; margin-bottom:20px;">
            <b style="color:var(--text);">${escapeHtml(pendingJoinInfo.code)}</b> 팀 (팀장: ${escapeHtml(pendingJoinInfo.leaderName)})에 참가하시겠어요?
          </div>
          <button class="submit-btn" id="team-join-btn" onclick="window.__home.confirmPendingJoin()">참가하기</button>
          <button class="toggle-link" onclick="window.__home.dismissPendingJoin()">다른 코드로 참가하기</button>
        </div>`;
    } else if (!myProfile.teamCode) {
      el.innerHTML = `
        <div class="field">
          <label>팀 코드</label>
          <input type="text" id="team-code-input" placeholder="팀장에게 받은 코드" />
        </div>
        <button class="submit-btn" id="team-join-btn" onclick="window.__home.joinTeam()">참가 신청</button>
        <div style="font-size:12px;color:var(--text-dim);margin-top:14px;line-height:1.6;text-align:center;">팀 코드가 없어도 공수달력 등은 혼자 계속 쓸 수 있어요.</div>`;
    } else if (myProfile.memberStatus === 'approved') {
      el.innerHTML = `
        <div style="font-size:14px;color:var(--text-dim);line-height:1.7;text-align:center;">
          <b style="color:var(--text)">${escapeHtml(myProfile.teamCode)}</b> 팀 소속이에요.
        </div>
        <button class="submit-btn" style="background:transparent;border:1.5px solid var(--border);color:var(--text-dim);margin-top:16px;" onclick="window.__home.leaveTeam()">팀 탈퇴</button>`;
    } else {
      el.innerHTML = `
        <div style="font-size:14px;color:var(--text-dim);line-height:1.7;text-align:center;">
          <b style="color:var(--text)">${escapeHtml(myProfile.teamCode)}</b> 팀 참가 승인을 기다리고 있어요.
        </div>
        <button class="submit-btn" style="background:transparent;border:1.5px solid var(--border);color:var(--text-dim);margin-top:16px;" onclick="window.__home.cancelTeamJoin()">신청 취소</button>`;
    }
  }

  function joinTeam() {
    const codeInput = $('team-code-input');
    const code = codeInput.value.trim().toUpperCase();
    if (!code) { alert('팀 코드를 입력해주세요!'); return; }
    joinTeamWithCode(code);
  }

  function joinTeamWithCode(code) {
    const btn = $('team-join-btn');
    if (btn) btn.disabled = true;
    return colTeams.doc(code).get()
      .then((doc) => {
        if (!doc.exists || doc.data().active === false) { alert('존재하지 않거나 비활성화된 팀 코드예요.'); return; }
        return colUsers.doc(auth.currentUser.uid).update({ teamCode: code, memberStatus: 'approved' });
      })
      .then(() => showToast('✅ 팀에 참가했어요!'))
      .catch(() => alert('처리 실패. 다시 시도해주세요.'))
      .finally(() => { if (btn) btn.disabled = false; });
  }

  function promptJoinFromLink(code) {
    colTeams.doc(code).get()
      .then((doc) => {
        if (!doc.exists || doc.data().active === false) { showToast('유효하지 않은 초대 링크예요'); go('view-team-join'); return; }
        const leader = users.find((u) => u.id === doc.data().adminUid);
        pendingJoinInfo = { code, leaderName: leader ? displayName(leader) : '알 수 없음' };
        renderTeamJoin();
        go('view-team-join');
      })
      .catch(() => { go('view-team-join'); });
  }

  function confirmPendingJoin() {
    if (!pendingJoinInfo) return;
    const code = pendingJoinInfo.code;
    joinTeamWithCode(code).then(() => { pendingJoinInfo = null; syncView('view-app'); });
  }
  function dismissPendingJoin() { pendingJoinInfo = null; renderTeamJoin(); }
  function cancelTeamJoin() {
    if (!confirm('참가 신청을 취소할까요?')) return;
    colUsers.doc(auth.currentUser.uid).update({ teamCode: null, memberStatus: null })
      .then(() => showToast('취소했어요')).catch(() => alert('처리 실패. 다시 시도해주세요.'));
  }
  function leaveTeam() {
    if (!confirm('팀에서 탈퇴할까요?')) return;
    colUsers.doc(auth.currentUser.uid).update({ teamCode: null, memberStatus: null })
      .then(() => showToast('탈퇴했어요')).catch(() => alert('처리 실패. 다시 시도해주세요.'));
  }

  function generateTeamCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function renderAdminRequest() {
    const el = $('admin-request-body');
    if (!el || !myProfile) return;
    const isAdmin = !!myProfile.isAdmin;
    if (!isAdmin && myProfile.teamCode) {
      const teamAdmin = users.find((u) => u.isAdmin && u.adminTeamCode === myProfile.teamCode);
      const teamAdminName = teamAdmin ? displayName(teamAdmin) : '팀장';
      el.innerHTML = `
        <div style="font-size:13px;color:var(--text-dim);line-height:1.6;text-align:center;">
          <b style="color:var(--text)">${escapeHtml(teamAdminName)}(${escapeHtml(myProfile.teamCode)})</b> 팀 소속으로 활동 중이에요.<br>
          팀장으로 전환하려면 먼저 그 팀에서 탈퇴해주세요.
        </div>
        <button class="submit-btn" style="margin-top:16px;" onclick="window.__home.go('view-my-profile'); window.__home.renderMyProfile();">내 정보로 이동 →</button>`;
      return;
    }
    el.innerHTML = `
      <div style="font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:16px;">
        팀장이 되면 팀 코드를 발급받아 물량작성·공수달력 팀원을 직접 관리할 수 있어요.
      </div>
      <div class="theme-toggle">
        <button class="theme-toggle-opt${isAdmin ? '' : ' is-on'}" onclick="window.__home.setAdminMode(false)">반장</button>
        <button class="theme-toggle-opt${isAdmin ? ' is-on' : ''}" onclick="window.__home.setAdminMode(true)">팀장</button>
      </div>
      ${isAdmin ? `<div style="font-size:12px;color:var(--text-dim);margin-top:14px;text-align:center;">내 팀 코드: <b style="color:var(--text)">${escapeHtml(myProfile.adminTeamCode || '-')}</b></div>` : ''}`;
  }

  function setAdminMode(next) {
    if (!myProfile || !!myProfile.isAdmin === next) return;
    if (next) {
      if (myProfile.teamCode) { alert('이미 다른 팀에 소속돼 있어요. 팀장으로 전환하려면 먼저 그 팀에서 탈퇴해주세요.'); return; }
      if (myProfile.adminTeamCode) {
        colUsers.doc(auth.currentUser.uid).update({ isAdmin: true, role: 'admin' })
          .then(() => showToast('✅ 팀장으로 전환했어요')).catch(() => alert('처리 실패. 다시 시도해주세요.'));
        return;
      }
      const code = generateTeamCode();
      colTeams.doc(code).set({ adminUid: auth.currentUser.uid, active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => colUsers.doc(auth.currentUser.uid).update({ isAdmin: true, role: 'admin', adminTeamCode: code }))
        .then(() => showToast(`✅ 팀장으로 전환! 팀 코드: ${code}`))
        .catch(() => alert('처리 실패. 다시 시도해주세요.'));
    } else {
      if (!confirm('팀장에서 반장으로 전환할까요? (팀 코드는 유지돼요)')) return;
      colUsers.doc(auth.currentUser.uid).update({ isAdmin: false, role: 'member' })
        .then(() => showToast('반장으로 전환했어요')).catch(() => alert('처리 실패. 다시 시도해주세요.'));
    }
  }

  function renderSignupBanner() {
    const banner = $('signup-team-banner');
    if (!banner || !myProfile) return;
    const shouldShow = sessionStorage.getItem('feederJustRegistered') === '1' && !myProfile.teamCode && !myProfile.isAdmin;
    banner.style.display = shouldShow ? '' : 'none';
  }
  function claimTeamCodeFromBanner() { setAdminMode(true); dismissSignupBanner(); }
  function dismissSignupBanner() {
    sessionStorage.removeItem('feederJustRegistered');
    const banner = $('signup-team-banner');
    if (banner) banner.style.display = 'none';
  }

  function logout() { auth.signOut(); }

  function openAdminApprove() { renderMemberList(); go('view-admin-approve'); }

  function inScope(u) {
    if (myProfile && myProfile.isOperator) return !!u.teamCode;
    const myCode = myProfile && myProfile.adminTeamCode;
    return myCode && u.teamCode === myCode;
  }

  function renderMemberList() {
    const list = $('member-list');
    const isOp = myProfile && myProfile.isOperator;
    const approved = users.filter((u) => inScope(u) && u.memberStatus === 'approved');
    if (!approved.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">👷</span>소속된 팀원이 없어요</div>';
      return;
    }
    list.innerHTML = approved.map((u) => `
      <div class="approve-row">
        <span class="approve-name">${escapeHtml(displayName(u))}${isOp ? ` <span class="tool-badge">${escapeHtml(u.teamCode)}</span>` : ''}</span>
        <div class="approve-actions">
          ${isOp ? '' : `<button class="transfer-btn" onclick="window.__home.transferAdmin('${u.id}', '${escapeHtml(displayName(u))}')">팀장 인계</button>`}
          <button class="reject-btn" onclick="window.__home.deleteMember('${u.id}', '${escapeHtml(displayName(u))}')">내보내기</button>
        </div>
      </div>
    `).join('');
  }

  function transferAdmin(targetUid, targetName) {
    if (!myProfile || !myProfile.adminTeamCode) return;
    if (!confirm(`정말 '${targetName}' 님에게 팀장을 넘길까요?\n넘긴 뒤에는 회원님이 이 팀 소속 팀원으로 남고, ${targetName}님이 새 팀장이 돼요.`)) return;
    const myTeamCode = myProfile.adminTeamCode;
    const myUid = auth.currentUser.uid;
    const batch = db.batch();
    batch.update(colUsers.doc(targetUid), { isAdmin: true, role: 'admin', adminTeamCode: myTeamCode, teamCode: null, memberStatus: null });
    batch.update(colUsers.doc(myUid), { isAdmin: false, role: 'member', teamCode: myTeamCode, memberStatus: 'approved' });
    batch.update(colTeams.doc(myTeamCode), { adminUid: targetUid });
    batch.commit()
      .then(() => { showToast('팀장을 넘겼어요'); go('view-my-profile'); })
      .catch(() => alert('처리 실패. 다시 시도해주세요.'));
  }

  function deleteMember(id, name) {
    if (!confirm(`'${name}' 님을 팀에서 내보낼까요? (계정 자체는 유지돼요)`)) return;
    colUsers.doc(id).update({ teamCode: null, memberStatus: null })
      .then(() => showToast('내보냈어요')).catch(() => alert('처리 실패. 다시 시도해주세요.'));
  }

  function copyTeamCode() {
    const code = myProfile && myProfile.adminTeamCode;
    if (!code) { showToast('아직 발급된 팀 코드가 없어요'); return; }
    navigator.clipboard.writeText(code).then(() => showToast('✅ 복사했어요')).catch(() => alert(code));
  }

  async function shareTeamInvite() {
    const code = myProfile && myProfile.adminTeamCode;
    if (!code) { showToast('아직 발급된 팀 코드가 없어요'); return; }
    const url = `https://praiselab.net/join.html?code=${code}`;
    const text = `피더 팀에 초대할게요! 아래 링크 눌러서 로그인/가입하면 바로 참가돼요.\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: '피더 팀 초대', text, url }); }
      catch (e) { if (e.name !== 'AbortError') alert('공유에 실패했어요.'); }
      return;
    }
    navigator.clipboard.writeText(text).then(() => showToast('✅ 초대 문구를 복사했어요')).catch(() => alert(text));
  }

  function requireLogin() {
    if (auth.currentUser) return true;
    alert('로그인 후 이용할 수 있어요');
    go('view-login');
    return false;
  }

  function checkTeamGameAccess() {
    if (!requireLogin()) return false;
    if (myProfile && (myProfile.teamCode || myProfile.adminTeamCode)) return true;
    alert('팀 코드가 있어야 팀원들과 같이 즐길 수 있어요');
    return false;
  }

  function openMenu() { $('menu-overlay').classList.add('show'); }
  function closeMenu() { $('menu-overlay').classList.remove('show'); }

  function updateAdminEntry() {
    const menuAdmin = $('menu-admin');
    const menuAdminRequest = $('menu-admin-request');
    const menuTeamJoin = $('menu-team-join');
    const menuProfileBtn = $('menu-profile-btn');
    const menuGuest = $('menu-guest');
    const menuLogoutBtn = $('menu-logout-btn');
    const isGuest = !auth.currentUser;

    menuProfileBtn.style.display = isGuest ? 'none' : '';
    menuGuest.style.display = isGuest ? '' : 'none';
    menuLogoutBtn.style.display = isGuest ? 'none' : '';
    if (menuTeamJoin) menuTeamJoin.style.display = (!isGuest && myProfile && !myProfile.isAdmin) ? '' : 'none';
    if (menuAdminRequest) menuAdminRequest.style.display = (!isGuest && myProfile && !myProfile.isOperator) ? '' : 'none';

    const menuInquiry = $('menu-inquiry');
    if (menuInquiry) menuInquiry.style.display = isGuest ? 'none' : '';

    const dashboardEntry = $('dashboard-entry');
    const isOperatorNow = !isGuest && myProfile && myProfile.isOperator;
    if (dashboardEntry) dashboardEntry.style.display = isOperatorNow ? '' : 'none';
    if (isOperatorNow) { startOpenInquiryWatch(); } else { stopOpenInquiryWatch(); }

    if (isGuest || !myProfile || (!myProfile.isAdmin && !myProfile.isOperator)) {
      menuAdmin.style.display = 'none';
      return;
    }
    menuAdmin.style.display = '';
    const teamCodeEl = $('admin-team-code');
    if (teamCodeEl) teamCodeEl.textContent = myProfile.adminTeamCode || '아직 발급 전이에요';
  }

  // ── 이름 목록 실시간 구독 (로그인 화면 + 승인 화면 공용) — 셸에선 이 화면이 마운트돼있는
  // 동안만 구독하고 언마운트 시 정리(원본은 페이지가 살아있는 내내 구독).
  const usersUnsub = colUsers.onSnapshot((snap) => {
    users = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'ko'));
    if ($('view-admin-approve')?.classList.contains('active')) renderMemberList();
    updateAdminEntry();
  });

  // ── 로그인 상태 변화 — 셸의 onProfile()에 위임(프로필 문서 자체 구독은 셸이 1번만 함) ──
  const unsubProfile = onProfile((profile, user) => {
    if (!user) {
      myProfile = null;
      gongsuSummaryLoaded = false;
      consumedAdminParam = false;
      consumedSettingsParam = false;
      consumedProfileParam = false;
      consumedInquiryParam = false;
      consumedJoinParam = false;
      const chip = $('hero-chip');
      if (chip) chip.style.display = 'none';
      closeMenu();
      updateAdminEntry();
      const wantsLogin = new URLSearchParams(location.search).get('login') === '1';
      const joinCodeParam = new URLSearchParams(location.search).get('join');
      if (joinCodeParam) pendingJoinCode = joinCodeParam.toUpperCase();
      syncView('view-app');
      if (wantsLogin || pendingJoinCode) go('view-login');
      renderLoginJoinBanner();
      return;
    }

    if (!profile) { syncView('view-login'); return; }
    myProfile = profile;
    updateAdminEntry();
    renderTeamJoin();
    renderAdminRequest();
    renderMyProfile();
    const nameEl = $('menu-profile-name');
    const roleEl = $('menu-profile-role');
    const avatarEl = $('menu-profile-avatar');
    const codeEl = $('menu-profile-code');
    if (nameEl) {
      const dn = displayName(myProfile);
      nameEl.textContent = dn;
      roleEl.textContent = roleLabel(myProfile);
      avatarEl.textContent = dn.charAt(0);
      const code = myProfile.isAdmin ? myProfile.adminTeamCode : myProfile.teamCode;
      codeEl.textContent = code ? `코드 ${code}` : '';
      codeEl.style.display = code ? '' : 'none';
    }

    if (myProfile.status !== 'approved') {
      $('pending-name').textContent = displayName(myProfile);
      syncView('view-pending');
      return;
    }

    loadGongsuSummary(user.uid);

    const onAdminScreen = $('view-admin-approve')?.classList.contains('active')
      || $('view-admin-hub')?.classList.contains('active')
      || (pendingJoinInfo && $('view-team-join')?.classList.contains('active'));
    if (!onAdminScreen) {
      const wantsAdminHub = !consumedAdminParam && myProfile.isAdmin && new URLSearchParams(location.search).get('admin') === '1';
      const wantsSettings = !consumedSettingsParam && new URLSearchParams(location.search).get('settings') === '1';
      const wantsProfile = !consumedProfileParam && new URLSearchParams(location.search).get('profile') === '1';
      const wantsInquiry = !consumedInquiryParam && new URLSearchParams(location.search).get('inquiry') === '1';
      const joinCode = !consumedJoinParam && (pendingJoinCode || new URLSearchParams(location.search).get('join'));
      consumedAdminParam = true;
      consumedSettingsParam = true;
      consumedProfileParam = true;
      consumedInquiryParam = true;
      consumedJoinParam = true;
      pendingJoinCode = null;
      if (joinCode && !myProfile.teamCode && !myProfile.isAdmin) {
        promptJoinFromLink(String(joinCode).toUpperCase());
      } else if (wantsAdminHub) go('view-admin-hub');
      else if (wantsSettings) { go('view-settings'); renderSettings(); }
      else if (wantsProfile) go('view-my-profile');
      else if (wantsInquiry) { go('view-inquiry'); renderInquiryList(); }
      else { syncView('view-app'); renderSignupBanner(); }
    }
  });

  renderSettings();

  window.__home = {
    go, goBack, goToolCard, goGamesCard, openMenu, closeMenu, setTheme, setInquiryType,
    submitInquiry, renderInquiryList, login, register, googleLogin, requestPasswordReset,
    joinTeam, confirmPendingJoin, dismissPendingJoin, cancelTeamJoin, leaveTeam,
    setAdminMode, claimTeamCodeFromBanner, dismissSignupBanner, logout, openAdminApprove,
    transferAdmin, deleteMember, copyTeamCode, shareTeamInvite, requireLogin,
    checkTeamGameAccess, saveNickname, deleteAccount, renderMyProfile, renderSettings,
  };

  return function unmount() {
    unsubProfile();
    usersUnsub();
    if (myInquiriesUnsub) myInquiriesUnsub();
    stopOpenInquiryWatch();
    delete window.__home;
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    console.log('[home-view] unmounted — 구독/스타일 정리 완료');
  };
}
