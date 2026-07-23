// 여러 view가 공유하는 상단 브랜드 헤더 + 햄버거 메뉴(프로필 카드/메뉴 항목/로그아웃).
// 원래 각 tool html이 페이지마다 따로 갖고 있던 헤더+메뉴 마크업을 여기 하나로 모으고,
// 로그인 상태(hamburger 노출·프로필 카드)는 셸의 onProfile()에 얹혀서 자동 갱신한다.
// 로그아웃은 항상 공통이라 메뉴 항목엔 넣지 않고 이 모듈이 마지막 줄에 고정으로 추가한다.

import { auth, onProfile } from './firebase-shell.js?v=7';
import { navigate } from './router.js?v=7';

const STYLE_ID = 'shell-header-style';
const STYLE = `
.shellhdr-bar {
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  background: var(--header-bg, rgba(26,30,46,0.8));
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
  padding: 0 20px; height: 52px;
  display: flex; align-items: center; justify-content: space-between;
  margin: 0 -16px 20px;
}
.shellhdr-brand { font-size: 15px; font-weight: 700; color: var(--text, #F0F2FF); text-decoration: none; }
.shellhdr-hamburger {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 10px;
  color: var(--text, #F0F2FF); font-size: 17px; cursor: pointer; flex-shrink: 0;
}
.shellhdr-hamburger:hover { border-color: var(--orange, #FF6B2B); color: var(--orange, #FF6B2B); }
.shellhdr-overlay { display: none; position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.5); justify-content: flex-end; }
.shellhdr-overlay.show { display: flex; }
.shellhdr-sheet {
  width: 78%; max-width: 300px; height: 100%;
  background: var(--steel-mid, #252A3D); border-left: 1px solid var(--border, rgba(255,255,255,0.08));
  padding: 20px 16px; display: flex; flex-direction: column;
  animation: shellhdrSlideIn 0.22s cubic-bezier(0.2,0.9,0.3,1);
}
@keyframes shellhdrSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.shellhdr-menu-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 0 2px; }
.shellhdr-menu-title { font-size: 15px; font-weight: 900; color: var(--text-dim, #8892B0); letter-spacing: 0.5px; }
.shellhdr-menu-close { width: 32px; height: 32px; border-radius: 8px; background: none; border: none; color: var(--text-dim, #8892B0); font-size: 16px; cursor: pointer; }
.shellhdr-menu-close:hover { color: var(--orange, #FF6B2B); }
.shellhdr-profile { display: flex; align-items: center; gap: 12px; padding: 14px 10px; margin-bottom: 10px; border-radius: 12px; background: var(--steel-light, #2E3450); }
.shellhdr-profile-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--orange, #FF6B2B); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; flex-shrink: 0; }
.shellhdr-profile-info { flex: 1; min-width: 0; }
.shellhdr-profile-name { font-size: 15px; font-weight: 900; color: var(--text, #F0F2FF); }
.shellhdr-profile-role { font-size: 12px; color: var(--text-dim, #8892B0); margin-top: 2px; }
.shellhdr-profile-code { font-size: 11px; font-weight: 700; color: var(--orange, #FF6B2B); margin-top: 3px; }
.shellhdr-item {
  display: flex; align-items: center; gap: 12px; padding: 14px 10px; border-radius: 12px;
  background: none; border: none; color: var(--text, #F0F2FF); font-family: inherit;
  font-size: 15px; font-weight: 700; text-align: left; cursor: pointer; width: 100%;
}
.shellhdr-item:hover { background: var(--steel-light, #2E3450); }
.shellhdr-item-icon { font-size: 17px; width: 22px; text-align: center; flex-shrink: 0; }
.shellhdr-item--logout { margin-top: auto; color: #ff8a8a; }
.shellhdr-theme-quickswitch { display: inline-flex; border-radius: 16px; background: var(--steel-light, #2E3450); border: 1px solid var(--border, rgba(255,255,255,0.08)); padding: 2px; gap: 2px; }
.shellhdr-theme-quickswitch-opt { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 12px; border-radius: 12px; border: none; background: transparent; cursor: pointer; opacity: 0.4; }
.shellhdr-theme-quickswitch-opt.is-active { background: var(--orange, #FF6B2B); opacity: 1; }
`;

const HEADER_HTML = `
<header class="shellhdr-bar">
  <a href="/tools/index.html" class="shellhdr-brand" data-route="home">Feeder</a>
  <button type="button" class="shellhdr-hamburger" style="display:none;" aria-label="메뉴">☰</button>
</header>
<div class="shellhdr-overlay">
  <div class="shellhdr-sheet">
    <div class="shellhdr-menu-head">
      <span class="shellhdr-menu-title">메뉴</span>
      <div style="display:flex; align-items:center; gap:2px;">
        <div class="shellhdr-theme-quickswitch" style="display:none;">
          <button type="button" class="shellhdr-theme-quickswitch-opt" data-theme-opt="dark" aria-label="다크 테마">🌙</button>
          <button type="button" class="shellhdr-theme-quickswitch-opt" data-theme-opt="light" aria-label="화이트 테마">☀️</button>
        </div>
        <button type="button" class="shellhdr-menu-close" aria-label="닫기">✕</button>
      </div>
    </div>
    <div class="shellhdr-profile">
      <div class="shellhdr-profile-avatar">-</div>
      <div class="shellhdr-profile-info">
        <div class="shellhdr-profile-name">-</div>
        <div class="shellhdr-profile-role">-</div>
        <div class="shellhdr-profile-code" style="display:none;"></div>
      </div>
    </div>
    <div class="shellhdr-menu-items"></div>
  </div>
</div>
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = STYLE;
  document.head.appendChild(el);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// menuItems: [{ icon, label, onClick, visible?: (profile) => boolean }]
// 로그아웃 항목은 이 함수가 항상 마지막에 고정으로 붙이므로 menuItems엔 넣지 않는다.
// showThemeSwitch: 메뉴 안에 다크/화이트 테마 퀵스위치를 보여줄지 (원본에서 index.html/
// qty-report.html/tool-rental.html 3개만 갖고 있던 기능이라 기본은 꺼둔다).
export function mountShellHeader(rootEl, { menuItems = [], showThemeSwitch = false } = {}) {
  ensureStyle();
  rootEl.insertAdjacentHTML('afterbegin', HEADER_HTML);

  const header = rootEl.querySelector(':scope > .shellhdr-bar');
  const overlay = rootEl.querySelector(':scope > .shellhdr-overlay');
  const hamburgerBtn = header.querySelector('.shellhdr-hamburger');
  const closeBtn = overlay.querySelector('.shellhdr-menu-close');
  const itemsBox = overlay.querySelector('.shellhdr-menu-items');
  const avatarEl = overlay.querySelector('.shellhdr-profile-avatar');
  const nameEl = overlay.querySelector('.shellhdr-profile-name');
  const roleEl = overlay.querySelector('.shellhdr-profile-role');
  const codeEl = overlay.querySelector('.shellhdr-profile-code');
  const themeSwitchEl = overlay.querySelector('.shellhdr-theme-quickswitch');
  const themeDarkBtn = overlay.querySelector('[data-theme-opt="dark"]');
  const themeLightBtn = overlay.querySelector('[data-theme-opt="light"]');

  function openMenu() { overlay.classList.add('show'); }
  function closeMenu() { overlay.classList.remove('show'); }
  function logout() { auth.signOut().then(() => { navigate('home'); }); }

  function renderTheme() {
    const t = localStorage.getItem('feederTheme') === 'dark' ? 'dark' : 'light';
    themeDarkBtn.classList.toggle('is-active', t !== 'light');
    themeLightBtn.classList.toggle('is-active', t === 'light');
  }
  function setTheme(t) {
    localStorage.setItem('feederTheme', t);
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    renderTheme();
  }
  if (showThemeSwitch) {
    themeSwitchEl.style.display = '';
    renderTheme();
    themeDarkBtn.addEventListener('click', (e) => { e.stopPropagation(); setTheme('dark'); });
    themeLightBtn.addEventListener('click', (e) => { e.stopPropagation(); setTheme('light'); });
  }

  function renderItems(profile) {
    const visibleItems = menuItems.filter((item) => !item.visible || item.visible(profile));
    itemsBox.innerHTML = visibleItems.map((item, i) =>
      `<button type="button" class="shellhdr-item" data-idx="${i}"><span class="shellhdr-item-icon">${item.icon}</span><span>${escapeHtml(item.label)}</span></button>`
    ).join('') + `<button type="button" class="shellhdr-item shellhdr-item--logout" data-action="logout"><span class="shellhdr-item-icon">🚪</span><span>로그아웃</span></button>`;

    itemsBox.querySelectorAll('[data-idx]').forEach((btn) => {
      const item = visibleItems[Number(btn.dataset.idx)];
      btn.addEventListener('click', () => { closeMenu(); item.onClick(); });
    });
    itemsBox.querySelector('[data-action="logout"]').addEventListener('click', () => { closeMenu(); logout(); });
  }

  hamburgerBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMenu(); });

  const unsubProfile = onProfile((profile) => {
    if (!profile) {
      hamburgerBtn.style.display = 'none';
      closeMenu();
      return;
    }
    hamburgerBtn.style.display = '';
    const dn = profile.nickname || profile.name || profile.username || '이름없음';
    const roleText = profile.isOperator ? '운영자' : (profile.isAdmin ? '팀장' : '반장');
    const code = profile.isAdmin ? profile.adminTeamCode : profile.teamCode;
    nameEl.textContent = dn;
    roleEl.textContent = roleText;
    avatarEl.textContent = dn.charAt(0);
    codeEl.textContent = code ? `코드 ${code}` : '';
    codeEl.style.display = code ? '' : 'none';
    renderItems(profile);
  });

  return function unmountShellHeader() {
    unsubProfile();
    header.remove();
    overlay.remove();
  };
}
