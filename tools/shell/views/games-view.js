// tools/games.html 이관. firebase도 인증도 없는 순수 정적 메뉴라 셸 화면들 중 가장 간단함.
// 원본은 team-ladder.html/roulette.html로 <a href>가 걸려있었는데, 이제 둘 다 셸 안의
// 라우트라서 data-route로 바꿔 셸 라우터가 처리하게 한다(페이지 리로드 없이 전환됨).
// 원본엔 브랜드 링크만 있고 햄버거 메뉴는 없었지만, 공용 헤더로 통일한다(로그인 중이면
// 다른 화면과 똑같이 메뉴/로그아웃 접근 가능 — 로그아웃 상태면 원본처럼 브랜드만 보임).

import { mountShellHeader } from '../shell-header.js?v=16';

const STYLE_ID = 'view-style-games';
const STYLE = `
.games-root { font-family: 'Noto Sans KR', sans-serif; color: var(--text, #F0F2FF); }
.games-root .container { max-width: 480px; margin: 0 auto; }
.games-root header.page-head { text-align: center; padding: 28px 0 24px; }
.games-root .header-icon { font-size: 40px; display: block; margin-bottom: 12px; filter: drop-shadow(0 0 12px rgba(255,107,43,0.5)); }
.games-root header.page-head h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
.games-root .page-sub { font-size: 13px; color: var(--text-dim, #8892B0); margin-top: 6px; }
.games-root .tool-card {
  background: var(--steel-mid, #252A3D);
  border: 1.5px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 16px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  text-decoration: none;
  color: var(--text, #F0F2FF);
  transition: all 0.15s;
  margin-bottom: 12px;
  cursor: pointer;
}
.games-root .tool-card:hover { border-color: var(--orange, #FF6B2B); transform: translateY(-2px); }
.games-root .tool-icon {
  width: 50px; height: 50px; border-radius: 13px;
  background: var(--steel-light, #2E3450);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  display: flex; align-items: center; justify-content: center;
  font-size: 23px; flex-shrink: 0;
}
.games-root .tool-icon--amber { background: #F59E0B; border-color: #F59E0B; }
.games-root .tool-icon--pink { background: #EC4899; border-color: #EC4899; }
.games-root .tool-info { flex: 1; min-width: 0; }
.games-root .tool-name { font-size: 15px; font-weight: 900; margin-bottom: 4px; }
.games-root .tool-desc { font-size: 13px; color: var(--text-dim, #8892B0); line-height: 1.5; }
.games-root .tool-arrow { color: var(--text-dim, #8892B0); font-size: 22px; font-weight: 900; flex-shrink: 0; transition: all 0.15s; }
.games-root .tool-card:hover .tool-arrow { color: var(--orange, #FF6B2B); transform: translateX(2px); }
`;

const TEMPLATE = `
<div class="games-root">
  <div class="container">
    <header class="page-head">
      <span class="header-icon">🎮</span>
      <h1>게임모음</h1>
      <div class="page-sub">팀원들과 실시간으로 같이 즐겨보세요</div>
    </header>
    <a class="tool-card" data-route="team-ladder">
      <div class="tool-icon tool-icon--amber">🪜</div>
      <div class="tool-info">
        <div class="tool-name">사다리타기</div>
        <div class="tool-desc">벌칙 · 결과 항목 정해서 같이 타기</div>
      </div>
      <span class="tool-arrow">›</span>
    </a>
    <a class="tool-card" data-route="roulette">
      <div class="tool-icon tool-icon--pink">🎡</div>
      <div class="tool-info">
        <div class="tool-name">룰렛돌리기</div>
        <div class="tool-desc">항목 같이 모아서 돌려보기</div>
      </div>
      <span class="tool-arrow">›</span>
    </a>
  </div>
</div>
`;

export function mount(container) {
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
  }
  container.innerHTML = TEMPLATE;
  // data-route 클릭은 셸의 전역 클릭 델리게이터(app.js)가 이미 처리하므로 별도 리스너 불필요
  const unmountHeader = mountShellHeader(container.querySelector('.games-root'), { menuItems: [] });

  return function unmount() {
    unmountHeader();
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
  };
}
