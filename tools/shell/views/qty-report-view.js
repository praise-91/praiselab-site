// tools/qty-report.html 이관. 대분류→종류/그룹→규격→수량입력으로 이어지는 드릴다운 전체가
// history.pushState/history.back()/history.go(-n)에 깊게 의존하던 화면이라, 다른 화면들보다
// 훨씬 더 확실하게 브라우저 history API를 완전히 손절하고 로컬 스택(viewStack)으로
// 대체해야 했다 — 셸 라우터의 popstate 처리와 충돌하는 문제는 물론이고, 원본처럼
// captureState/applyState/pushHistory 패턴을 그대로 로컬 배열에 옮기면 동작도 100% 동일하게
// 재현된다(뒤로가기 버튼 클릭 시 이전 단계로, 저장 후 drillDepth만큼 한번에 여러 단계 복귀 등).
// 다만 폰 하드웨어 뒤로가기로 이 드릴다운을 빠져나가는 동작만 이번 이관에서 빠졌다
// (다른 이관 화면들과 동일한 트레이드오프 — 화면 안의 "‹" 버튼은 전부 동일하게 동작함).

import { auth, db, onProfile } from '../firebase-shell.js?v=24';

const STYLE_ID = 'view-style-qty-report';
const STYLE = `
:root {
  --orange: #FF6B2B; --orange-dark: #E05520;
  --steel: #1A1E2E; --steel-mid: #252A3D; --steel-light: #2E3450;
  --text: #F0F2FF; --text-dim: #8892B0; --give: #3BE88A;
  --border: rgba(255,255,255,0.08);
  --header-bg: rgba(26, 30, 46, 0.8);
}
:root[data-theme="light"] {
  --orange: #FF6B2B; --orange-dark: #E05520;
  --steel: #F4F3F0; --steel-mid: #FFFFFF; --steel-light: #F0EFEA;
  --text: #1C1E27; --text-dim: #767A85; --give: #1E8E56;
  --border: rgba(0,0,0,0.08);
  --header-bg: rgba(244, 243, 240, 0.8);
}
.qty-root { font-family: 'Noto Sans KR', sans-serif; color: var(--text); }
.qty-root .container { max-width: 480px; margin: 0 auto; }
.qty-root .site-header { position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:var(--header-bg); border-bottom:1px solid var(--border); padding:0 20px; height:52px; display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.qty-root .brand { font-size:15px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px; text-decoration:none; }
.qty-root .hamburger-btn { width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:none; border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:17px; cursor:pointer; flex-shrink:0; }
.qty-root .hamburger-btn:hover { border-color:var(--orange); color:var(--orange); }
.qty-root .menu-overlay { display:none; position:fixed; inset:0; z-index:200; background:rgba(0,0,0,0.5); justify-content:flex-end; }
.qty-root .menu-overlay.show { display:flex; }
.qty-root .menu-sheet { width:78%; max-width:300px; height:100%; background:var(--steel-mid); border-left:1px solid var(--border); padding:20px 16px; display:flex; flex-direction:column; animation: qty-menuSlideIn 0.22s cubic-bezier(0.2,0.9,0.3,1); overflow-y:auto; }
@keyframes qty-menuSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.qty-root .menu-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding:0 2px; }
.qty-root .menu-title { font-size:15px; font-weight:900; color:var(--text-dim); letter-spacing:0.5px; }
.qty-root .menu-close { width:32px; height:32px; border-radius:8px; background:none; border:none; color:var(--text-dim); font-size:16px; cursor:pointer; }
.qty-root .menu-close:hover { color:var(--orange); }
.qty-root .theme-quickswitch { display:inline-flex; border-radius:16px; background:var(--steel-light); border:1px solid var(--border); padding:2px; gap:2px; }
.qty-root .theme-quickswitch-opt { width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:12px; border-radius:12px; border:none; background:transparent; cursor:pointer; opacity:0.4; }
.qty-root .theme-quickswitch-opt.is-active { background:var(--orange); opacity:1; }
.qty-root .theme-toggle { display:flex; gap:8px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:12px; padding:4px; }
.qty-root .theme-toggle-opt { flex:1; padding:12px 0; border:none; border-radius:9px; background:none; color:var(--text-dim); font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; }
.qty-root .theme-toggle-opt.is-on { background:var(--orange); color:#fff; }
.qty-root .menu-item { display:flex; align-items:center; gap:12px; padding:14px 10px; border-radius:12px; background:none; border:none; color:var(--text); font-family:inherit; font-size:15px; font-weight:700; text-align:left; cursor:pointer; width:100%; }
.qty-root .menu-item:hover { background:var(--steel-light); }
.qty-root .menu-item-icon { font-size:17px; width:22px; text-align:center; flex-shrink:0; }
.qty-root .menu-item--logout { margin-top:auto; color:#ff8a8a; }
.qty-root .locked-link { display:block; padding:16px; background:#fff; border-radius:12px; color:var(--orange); text-align:center; text-decoration:none; font-weight:900; }
.qty-root .locked-link:hover { background:rgba(255,107,43,0.08); }
.qty-root header.page-head { text-align:center; padding:28px 0 24px; }
.qty-root .header-icon { font-size:40px; display:block; margin-bottom:12px; filter:drop-shadow(0 0 12px rgba(255,107,43,0.5)); }
.qty-root header.page-head h1 { font-size:22px; font-weight:900; letter-spacing:-0.5px; }
.qty-root .page-sub { font-size:13px; color:var(--text-dim); margin-top:6px; }
.qty-root .view { display:none; }
.qty-root .view.active { display:block; animation: qty-fadeIn 0.25s ease; }
@keyframes qty-fadeIn { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
.qty-root .loading-brand { text-align:center; padding-top:60px; }
.qty-root .loading-brand-title { font-size:22px; font-weight:900; color:var(--text); letter-spacing:-0.5px; }
.qty-root .loading-brand-sub { font-size:13px; color:var(--text-dim); margin-top:8px; }
.qty-root .view-head { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
.qty-root .back-btn { width:38px; height:38px; border:1px solid var(--border); border-radius:10px; background:var(--steel-mid); color:var(--text); font-size:18px; cursor:pointer; flex-shrink:0; }
.qty-root .view-head h2 { font-size:18px; font-weight:900; }
.qty-root .card { background:var(--steel-mid); border:1px solid var(--border); border-radius:16px; padding:20px; margin-bottom:16px; }
.qty-root .section-label { font-size:12px; font-weight:700; color:var(--text-dim); letter-spacing:0.8px; margin-bottom:12px; }
.qty-root .del-btn { width:38px; height:38px; border:1px solid rgba(255,68,68,0.25); border-radius:10px; background:transparent; color:rgba(255,68,68,0.5); font-size:14px; cursor:pointer; flex-shrink:0; }
.qty-root .del-btn:hover { background:rgba(255,68,68,0.1); color:#ff4444; }
.qty-root .add-row { display:flex; gap:8px; margin-top:12px; }
.qty-root .add-row input { flex:1; padding:13px 14px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:10px; color:var(--text); font-family:inherit; font-size:15px; outline:none; -webkit-appearance:none; }
.qty-root .add-row input:focus { border-color:var(--orange); }
.qty-root .add-btn { padding:0 18px; background:var(--orange); border:none; border-radius:10px; color:white; font-family:inherit; font-size:14px; font-weight:900; cursor:pointer; white-space:nowrap; }
.qty-root .add-btn:hover { background:var(--orange-dark); }
.qty-root .add-btn:disabled { opacity:0.5; cursor:not-allowed; }
.qty-root .cat-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.qty-root .cat-btn { padding:22px 12px; border:1.5px solid var(--border); border-radius:14px; background:var(--steel-mid); color:var(--text); font-family:inherit; font-size:15px; font-weight:700; cursor:pointer; transition:all 0.15s; display:flex; flex-direction:column; align-items:center; gap:6px; }
.qty-root .cat-btn:hover { border-color:var(--orange); transform:translateY(-1px); }
.qty-root .cat-btn .cat-emoji { font-size:24px; }
.qty-root .cat-btn .cat-unit { font-size:11px; color:var(--text-dim); }
.qty-root .search-input { width:100%; padding:13px 14px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:10px; color:var(--text); font-family:inherit; font-size:15px; outline:none; margin-bottom:12px; -webkit-appearance:none; }
.qty-root .search-input:focus { border-color:var(--orange); }
.qty-root .item-list { display:flex; flex-direction:column; gap:8px; }
.qty-root .item-row { display:flex; gap:8px; align-items:center; }
.qty-root .item-btn { flex:1; padding:14px 16px; border:1.5px solid var(--border); border-radius:12px; background:var(--steel-light); color:var(--text); font-family:inherit; font-size:15px; font-weight:500; cursor:pointer; text-align:left; display:flex; justify-content:space-between; align-items:center; transition:all 0.15s; }
.qty-root .item-btn:hover { border-color:var(--orange); }
.qty-root .item-unit { font-size:11px; font-weight:700; color:var(--orange); background:rgba(255,107,43,0.12); padding:2px 8px; border-radius:20px; }
.qty-root .empty-state { text-align:center; padding:36px 20px; color:var(--text-dim); font-size:14px; }
.qty-root .empty-state .empty-icon { font-size:32px; display:block; margin-bottom:10px; opacity:0.4; }
.qty-root .field { margin-bottom:18px; }
.qty-root .field label { display:block; font-size:12px; font-weight:700; color:var(--text-dim); letter-spacing:0.8px; margin-bottom:8px; }
.qty-root .field input { width:100%; padding:14px 16px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:10px; color:var(--text); font-family:inherit; font-size:20px; font-weight:700; outline:none; -webkit-appearance:none; }
.qty-root .field input:focus { border-color:var(--orange); }
.qty-root .field-select { width:100%; padding:13px 14px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:10px; color:var(--text); font-family:inherit; font-size:15px; font-weight:700; outline:none; -webkit-appearance:none; }
.qty-root .field-select:focus { border-color:var(--orange); }
.qty-root .submit-btn { width:100%; padding:16px; background:var(--orange); border:none; border-radius:12px; color:white; font-family:inherit; font-size:16px; font-weight:900; cursor:pointer; transition:all 0.2s; }
.qty-root .submit-btn:hover { background:var(--orange-dark); }
.qty-root .submit-btn:disabled { opacity:0.5; cursor:not-allowed; }
.qty-root .entry-list { display:flex; flex-direction:column; gap:8px; }
.qty-root .entry-card { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:12px 14px; background:var(--steel-mid); border:1px solid var(--border); border-radius:12px; }
.qty-root .entry-info { flex:1; min-width:0; }
.qty-root .entry-name { font-size:14px; font-weight:700; }
.qty-root .entry-meta { font-size:12px; color:var(--text-dim); margin-top:2px; }
.qty-root .entry-qty { font-size:15px; font-weight:900; color:var(--orange); white-space:nowrap; }
.qty-root .summary-link-btn { width:100%; padding:14px; margin-bottom:20px; background:#fff; border:none; border-radius:12px; color:var(--orange); font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; transition:all 0.15s; }
.qty-root .summary-link-btn:hover { background:rgba(255,107,43,0.08); }
.qty-root .date-range-row { display:flex; gap:10px; }
.qty-root .date-range-row .field { flex:1 1 0; min-width:0; }
.qty-root .date-range-row .field input { width:100%; font-size:14px; font-weight:600; padding:12px 8px; }
.qty-root .summary-list { display:flex; flex-direction:column; gap:6px; }
.qty-root .summary-group-title { font-size:13px; font-weight:900; color:var(--orange); margin:16px 0 8px; }
.qty-root .summary-group-title:first-child { margin-top:0; }
.qty-root .summary-row { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--steel-mid); border:1px solid var(--border); border-radius:10px; font-size:14px; }
.qty-root .summary-item-name { font-weight:500; }
.qty-root .summary-qty { font-weight:900; color:var(--give); white-space:nowrap; }
.qty-root .manage-card { margin-bottom:12px; }
.qty-root .manage-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:15px; font-weight:900; }
.qty-root .manage-card-count { font-size:12px; font-weight:700; color:var(--text-dim); }
.qty-root .manage-row { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); }
.qty-root .manage-row:last-child { border-bottom:none; padding-bottom:0; }
.qty-root .manage-row-info { flex:1; min-width:0; }
.qty-root .manage-row-name { font-size:14px; font-weight:700; }
.qty-root .manage-row-meta { font-size:12px; color:var(--text-dim); margin-top:2px; }
.qty-root .manage-row-qty { font-size:14px; font-weight:900; color:var(--give); white-space:nowrap; }
.qty-root .del-btn-green { border-color:rgba(59,232,138,0.3); color:rgba(59,232,138,0.7); }
.qty-root .del-btn-green:hover { background:rgba(59,232,138,0.1); color:var(--give); }
.qty-root .export-btn { width:100%; padding:13px; background:transparent; border:1.5px solid var(--border); border-radius:10px; color:var(--text-dim); font-family:inherit; font-size:13px; font-weight:700; cursor:pointer; margin-top:14px; transition:all 0.2s; letter-spacing:0.3px; }
.qty-root .export-btn:hover { border-color:var(--orange); color:var(--orange); }
.qty-root .export-btn-preview { border-color:var(--orange); color:var(--orange); }
.qty-root .export-btn-preview:hover { background:rgba(255,107,43,0.08); }
.qty-root .tab-bar { display:flex; gap:8px; margin-bottom:16px; }
.qty-root .tab-btn { flex:1; padding:12px; border:1.5px solid transparent; border-radius:10px; background:#fff; color:var(--orange); font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; transition:all 0.15s; }
.qty-root .tab-btn.active { background:#fff; color:var(--orange); }
.qty-root .field textarea { width:100%; padding:14px 16px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:10px; color:var(--text); font-family:inherit; font-size:15px; line-height:1.6; outline:none; resize:vertical; }
.qty-root .field textarea:focus { border-color:var(--orange); }
.qty-root .recent-list { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
.qty-root .recent-btn { padding:10px 14px; border:1.5px solid rgba(255,107,43,0.4); border-radius:20px; background:rgba(255,107,43,0.08); color:var(--text); font-family:inherit; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.15s; }
.qty-root .recent-btn:hover { border-color:var(--orange); color:var(--orange); }
.qty-root .spec-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
.qty-root .spec-btn { padding:20px 8px; border:1.5px solid var(--border); border-radius:12px; background:var(--steel-mid); color:var(--text); font-family:inherit; font-size:16px; font-weight:700; cursor:pointer; transition:all 0.15s; }
.qty-root .spec-btn:hover { border-color:var(--orange); transform:translateY(-1px); }
.qty-root .chev { color:var(--text-dim); font-weight:900; margin-left:6px; }
.qty-root .group-count { font-size:11px; color:var(--text-dim); }
.qty-root .toast { position:fixed; top:24px; left:50%; transform:translateX(-50%) translateY(-80px); background:var(--give); color:#0a1a0f; padding:12px 24px; border-radius:50px; font-size:14px; font-weight:700; transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1); white-space:nowrap; z-index:999; }
.qty-root .toast.show { transform:translateX(-50%) translateY(0); }
`;

const TEMPLATE = `
<div class="qty-root">
  <div class="toast" id="qty-toast">✅ 저장 완료!</div>
  <header class="site-header">
    <a href="/tools/index.html" class="brand" data-route="home">Feeder</a>
    <button class="hamburger-btn" id="hamburger-btn" onclick="window.__qty.openMenu()" style="display:none;" aria-label="메뉴">☰</button>
  </header>
  <div class="menu-overlay" id="menu-overlay" onclick="window.__qty.closeMenu()">
    <div class="menu-sheet" onclick="event.stopPropagation()">
      <div class="menu-head">
        <span class="menu-title">메뉴</span>
        <div style="display:flex; align-items:center; gap:2px;">
          <div class="theme-quickswitch" onclick="event.stopPropagation()">
            <button class="theme-quickswitch-opt" id="theme-quick-dark" onclick="window.__qty.setTheme('dark')" aria-label="다크 테마">🌙</button>
            <button class="theme-quickswitch-opt" id="theme-quick-light" onclick="window.__qty.setTheme('light')" aria-label="화이트 테마">☀️</button>
          </div>
          <button class="menu-close" onclick="window.__qty.closeMenu()" aria-label="닫기">✕</button>
        </div>
      </div>
      <button class="menu-item" id="menu-admin" onclick="window.__qty.closeMenu(); location.href='/tools/index.html?admin=1';" style="display:none;">
        <span class="menu-item-icon">🔑</span><span>팀장 기능</span>
      </button>
      <button class="menu-item" onclick="window.__qty.closeMenu(); window.__qty.go('view-settings'); window.__qty.renderSettings();">
        <span class="menu-item-icon">⚙️</span><span>설정</span>
      </button>
      <button class="menu-item menu-item--logout" onclick="window.__qty.closeMenu(); window.__qty.logout();">
        <span class="menu-item-icon">🚪</span><span>로그아웃</span>
      </button>
    </div>
  </div>

  <div class="container">
    <div class="view active" id="view-checking">
      <div class="loading-brand"><div class="loading-brand-title">Feeder</div><div class="loading-brand-sub">불러오는 중…</div></div>
    </div>

    <div class="view" id="view-locked">
      <header class="page-head">
        <span class="header-icon">🔒</span><h1>로그인이 필요해요</h1>
        <div class="page-sub">피더 홈에서 로그인 후 다시 들어와주세요</div>
      </header>
      <div class="card"><a href="/tools/index.html?login=1" class="locked-link">로그인하러 가기 →</a></div>
    </div>

    <div class="view" id="view-home">
      <button class="summary-link-btn" onclick="window.__qty.openSummary()">합산 보기</button>
      <div id="recent-wrap" style="display:none;">
        <div class="section-label">⚡ 최근 입력 — 누르면 바로 수량 입력</div>
        <div class="recent-list" id="recent-list"></div>
      </div>
      <div class="section-label">작업 대분류 선택</div>
      <div class="cat-grid" id="cat-grid"></div>
      <div class="card" style="margin-top:14px;">
        <div class="section-label">대분류가 없어요?</div>
        <div class="add-row" style="margin-top:0;">
          <input type="text" id="new-category" placeholder="대분류명 (예: 접지)" />
          <select class="field-select" id="new-category-unit" style="flex:none;width:76px;">
            <option value="M">M</option>
            <option value="EA">EA</option>
          </select>
        </div>
        <div class="add-row" style="margin-top:8px;">
          <button class="add-btn" id="add-category-btn" onclick="window.__qty.addCategory()" style="flex:1;padding:13px;">+ 대분류 추가</button>
        </div>
      </div>
      <div class="section-label" style="margin-top:24px;">오늘 입력한 물량</div>
      <div class="entry-list" id="today-list"></div>
    </div>

    <div class="view" id="view-items">
      <div class="view-head">
        <button class="back-btn" onclick="window.__qty.itemsBack()">‹</button>
        <h2 id="items-title"></h2>
      </div>
      <input type="text" class="search-input" id="item-search" placeholder="자재 검색" oninput="window.__qty.renderItems()" />
      <div class="item-list" id="item-list"></div>
      <div class="card" style="margin-top:14px;">
        <div class="section-label">목록에 없어요?</div>
        <div class="add-row" style="margin-top:0;">
          <input type="text" id="new-item" placeholder="자재명 입력 (예: 새들 22mm)" />
          <button class="add-btn" id="add-item-btn" onclick="window.__qty.addItem()">+ 추가</button>
        </div>
      </div>
    </div>

    <div class="view" id="view-spec">
      <div class="view-head">
        <button class="back-btn" onclick="window.__qty.specBack()">‹</button>
        <h2 id="spec-title"></h2>
      </div>
      <div class="section-label" id="spec-step-label"></div>
      <div class="spec-grid" id="spec-grid"></div>
    </div>

    <div class="view" id="view-entry">
      <div class="view-head">
        <button class="back-btn" onclick="window.__qty.goBack()">‹</button>
        <h2 id="entry-title"></h2>
      </div>
      <div class="card">
        <div class="field">
          <label id="entry-qty-label">수량</label>
          <input type="number" id="entry-qty" inputmode="decimal" step="0.1" min="0" placeholder="0" />
        </div>
        <button class="submit-btn" id="entry-save-btn" onclick="window.__qty.saveEntry()">저장 →</button>
      </div>
    </div>

    <div class="view" id="view-summary">
      <div class="view-head">
        <button class="back-btn" onclick="window.__qty.goBack()">‹</button>
        <h2 id="summary-title">합산 보기</h2>
      </div>
      <div class="tab-bar">
        <button class="tab-btn active" id="tab-total" onclick="window.__qty.switchSummaryTab('total')">합산 보기</button>
        <button class="tab-btn" id="tab-manage" onclick="window.__qty.switchSummaryTab('manage')">전체 기록 관리</button>
      </div>
      <div id="summary-tab-total">
        <div class="card">
          <div class="date-range-row">
            <div class="field" style="margin-bottom:0;"><label>시작일</label><input type="date" id="summary-start" onchange="window.__qty.renderSummary()" /></div>
            <div class="field" style="margin-bottom:0;"><label>종료일</label><input type="date" id="summary-end" onchange="window.__qty.renderSummary()" /></div>
          </div>
        </div>
        <div class="section-label">자재별 합계</div>
        <div class="summary-list" id="summary-list"></div>
        <button class="export-btn export-btn-preview" onclick="window.__qty.openPreview()">미리보기/공유하기</button>
        <button class="export-btn" onclick="window.__qty.openTemplateEditor()">양식 설정</button>
      </div>
      <div id="summary-tab-manage" style="display:none;">
        <div class="card">
          <div class="field"><label>작업자</label><select class="field-select" id="manage-worker" onchange="window.__qty.renderManage()"></select></div>
          <div class="date-range-row">
            <div class="field" style="margin-bottom:0;"><label>시작일</label><input type="date" id="manage-start" onchange="window.__qty.renderManage()" /></div>
            <div class="field" style="margin-bottom:0;"><label>종료일</label><input type="date" id="manage-end" onchange="window.__qty.renderManage()" /></div>
          </div>
        </div>
        <div class="section-label">기록 목록</div>
        <div class="entry-list" id="manage-list"></div>
      </div>
    </div>

    <div class="view" id="view-preview">
      <div class="view-head">
        <button class="back-btn" onclick="window.__qty.goBack()">‹</button>
        <h2>미리보기</h2>
      </div>
      <div class="card">
        <div class="field" style="margin-bottom:0;">
          <label>공유될 내용 — 바뀐 부분만 직접 수정하세요</label>
          <textarea id="preview-text" rows="16"></textarea>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-dim);margin:-8px 2px 14px;line-height:1.6;">
        여기서 수정한 내용은 다음에 열 때 그대로 남아있어요. 자재 목록과 날짜만 그때그때 최신 값으로 자동 교체돼요.
      </div>
      <button class="submit-btn" onclick="window.__qty.sharePreview()">공유하기</button>
    </div>

    <div class="view" id="view-template">
      <div class="view-head">
        <button class="back-btn" onclick="window.__qty.goBack()">‹</button>
        <h2>양식 설정</h2>
      </div>
      <div class="card">
        <div class="section-label">사용 가능한 자리표시자</div>
        <div style="font-size:13px;color:var(--text-dim);line-height:1.7;margin-bottom:16px;">
          {날짜} → 오늘 날짜 (요일 포함, 자동)<br>{목록} → 대분류별 자재 합계 목록 (자동)<br>그 외 나머지는 전부 자유롭게 작성하세요. 필요 없는 항목은 그냥 지우면 돼요.
        </div>
        <div class="field">
          <label>내 양식 (비워두면 기본 양식 사용)</label>
          <textarea id="template-input" rows="14" placeholder="예)
{날짜} 현장명
김찬양팀

총원 :  0명
출근 :  0명
결근 :  0명

유도원 : 0명

작업 위치 :
사용 장비 :
사용자재 :
{목록}
작업 내용 :

팀리더 전화번호"></textarea>
        </div>
        <button class="submit-btn" id="template-save-btn" onclick="window.__qty.saveTemplate()">저장</button>
        <button class="export-btn" onclick="window.__qty.resetTemplate()">기본 양식으로 되돌리기</button>
      </div>
    </div>

    <div class="view" id="view-settings">
      <div class="view-head">
        <button class="back-btn" onclick="window.__qty.goBack()">‹</button>
        <h2>설정</h2>
      </div>
      <div class="card">
        <div class="field" style="margin-bottom:0;">
          <label>화면 테마</label>
          <div class="theme-toggle">
            <button class="theme-toggle-opt" id="theme-opt-dark" onclick="window.__qty.setTheme('dark')">다크</button>
            <button class="theme-toggle-opt" id="theme-opt-light" onclick="window.__qty.setTheme('light')">화이트</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const colToolsUsers = db.collection('tools_users');
const colCategories = db.collection('qty_categories');
const colItems = db.collection('qty_items');
const colEntries = db.collection('qty_entries');
const colSettings = db.collection('qty_settings');

const DEFAULT_CATEGORIES = [
  { name: '트레이',     unit: 'M',  emoji: '🪜', order: 1 },
  { name: '덕트',       unit: 'M',  emoji: '📦', order: 2 },
  { name: '부스덕트',   unit: 'M',  emoji: '🔌', order: 3 },
  { name: '배관',       unit: 'M',  emoji: '🧵', order: 4 },
  { name: '레이스웨이', unit: 'M',  emoji: '🛤️', order: 5 },
  { name: '단말',       unit: 'EA', emoji: '🔗', order: 6 },
  { name: '포설',       unit: 'M',  emoji: '🪢', order: 7 },
  { name: '기타',       unit: 'EA', emoji: '📁', order: 8 },
];

const TRAY_WIDTHS = ['W100', 'W200', 'W300', 'W400', 'W600', 'W900', 'W1200'];
const DEGREES = ['15°', '30°', '45°', '90°'];
const STEEL_SIZES = ['16mm', '22mm', '28mm', '36mm', '42mm', '54mm'];
const EMT_SIZES = ['E15', 'E19', 'E25', 'E31', 'E39', 'E51', 'E63', 'E75'];
const RW_WIDTHS = ['70mm', '110mm'];
const HFIX_SIZES = ['2.5sq', '4sq'];
const HFIX_COLORS = ['흑', '백', '청', '녹', '적', '황'];
const SQ_SIZES = ['1.5sq', '2sq', '4sq', '6sq', '10sq', '16sq', '35sq', '50sq', '75sq', '90sq', '120sq', '150sq', '240sq', '300sq'];
const CABLE_SQ_SIZES = ['1.5sq', '2.5sq', '4sq', '6sq', '10sq', '16sq', '35sq', '50sq', '70sq', '95sq', '120sq', '150sq', '185sq', '240sq', '300sq'];
const CABLE_SQ_SIZES_CUSTOM = [...CABLE_SQ_SIZES, '__CUSTOM__'];
const HFIX_POSEOL_SIZES = ['1.5sq', '2.5sq', '4sq', '6sq'];
const CABLE_CORES = ['2C', '3C', '4C'];

function trayDuctTypes(category, withAccessories) {
  const types = [
    { category, name: '스트레이트', unit: 'M', hideTypeInName: true, spec1: { label: '폭', options: TRAY_WIDTHS }, order: 1 },
    { category, name: 'H-엘보', unit: 'EA', group: '피팅류', spec1: { label: '폭', options: TRAY_WIDTHS }, spec2: { label: '각도', options: DEGREES }, order: 2 },
    { category, name: 'V-엘보', unit: 'EA', group: '피팅류', spec1: { label: '폭', options: TRAY_WIDTHS }, spec2: { label: '각도', options: DEGREES }, order: 3 },
    { category, name: 'Cross', unit: 'EA', group: '피팅류', spec1: { label: '폭', options: TRAY_WIDTHS }, order: 4 },
  ];
  if (withAccessories) {
    types.push(
      { category, name: '본딩접지', unit: 'EA', order: 5 },
      { category, name: '홀다운클램프', unit: 'EA', order: 6 },
      { category, name: '이형조인트', unit: 'EA', order: 7 },
    );
  }
  return types;
}

const PIPE_ACCESSORIES = ['레듀샤', '환형박스', '풀박스', '곤지레다', '찬넬클램프', '원형클램프'];
const ANGLE_SIZES = ['50mm', '75mm'];
function angleType(category, order) { return { category, name: 'ㄱ앵글', unit: 'M', spec1: { label: '사이즈', options: ANGLE_SIZES }, order }; }
const BOLT_SIZES = ['산부(3/8)', '연부(1/2)'];
function boltType(category, order) { return { category, name: '전산볼트', unit: 'EA', spec1: { label: '규격', options: BOLT_SIZES }, order }; }

const DEFAULT_TYPES = [
  ...trayDuctTypes('트레이', true),
  angleType('트레이', 8),
  boltType('트레이', 9),
  ...trayDuctTypes('덕트', false),
  angleType('덕트', 5),
  boltType('덕트', 6),
  angleType('부스덕트', 1),
  boltType('부스덕트', 2),
  { category: '배관', name: '강제전선관', unit: 'M', spec1: { label: '사이즈', options: STEEL_SIZES }, order: 1 },
  { category: '배관', name: 'EMT-무나사', unit: 'M', spec1: { label: '사이즈', options: EMT_SIZES }, order: 2 },
  ...PIPE_ACCESSORIES.map((n, i) => ({ category: '배관', name: n, unit: 'EA', spec1: { label: '사이즈', options: STEEL_SIZES }, order: 3 + i })),
  boltType('배관', 9),
  { category: '레이스웨이', name: '바디', unit: 'M', spec1: { label: '폭', options: RW_WIDTHS }, order: 1 },
  { category: '레이스웨이', name: '커버', unit: 'M', spec1: { label: '폭', options: RW_WIDTHS }, order: 2 },
  ...['엘보박스', 'T박스', 'Cross박스'].map((n, i) => ({ category: '레이스웨이', name: n, unit: 'EA', spec1: { label: '폭', options: RW_WIDTHS }, order: 3 + i })),
  { category: '레이스웨이', name: 'Offset', unit: 'EA', spec1: { label: '각도', options: DEGREES }, spec2: { label: '폭', options: RW_WIDTHS }, order: 6 },
  { category: '레이스웨이', name: 'HFIX', unit: 'M', spec1: { label: '굵기', options: HFIX_SIZES }, spec2: { label: '색상', options: HFIX_COLORS }, order: 7 },
  boltType('레이스웨이', 8),
  { category: '단말', name: 'HFIX', unit: 'M', group: '케이블', spec1: { label: 'SQ', options: HFIX_POSEOL_SIZES }, order: 1 },
  { category: '단말', name: 'CV', unit: 'M', group: '케이블', spec1: { label: 'SQ', options: CABLE_SQ_SIZES }, spec2: { label: '코어', options: CABLE_CORES }, order: 2 },
  { category: '단말', name: 'FCV', unit: 'M', group: '케이블', spec1: { label: 'SQ', options: CABLE_SQ_SIZES_CUSTOM }, spec2: { label: '코어', options: CABLE_CORES }, order: 3 },
  { category: '단말', name: 'TFR-CV', unit: 'M', group: '케이블', spec1: { label: 'SQ', options: CABLE_SQ_SIZES }, spec2: { label: '코어', options: CABLE_CORES }, order: 4 },
  { category: '단말', name: 'GV', unit: 'M', group: '케이블', spec1: { label: 'SQ', options: CABLE_SQ_SIZES }, spec2: { label: '코어', options: CABLE_CORES }, order: 5 },
  { category: '단말', name: 'TFR-GV', unit: 'M', group: '케이블', spec1: { label: 'SQ', options: CABLE_SQ_SIZES }, spec2: { label: '코어', options: CABLE_CORES }, order: 6 },
  { category: '단말', name: '터미널', unit: 'EA', spec1: { label: '굵기', options: SQ_SIZES }, order: 7 },
  { category: '단말', name: '터미널 (2홀)', unit: 'EA', spec1: { label: '굵기', options: ['120sq', '150sq', '240sq', '300sq'] }, order: 8 },
  { category: '포설', name: 'HFIX', spec1: { label: 'SQ', options: HFIX_POSEOL_SIZES }, order: 1 },
  { category: '포설', name: 'CV', spec1: { label: 'SQ', options: CABLE_SQ_SIZES }, spec2: { label: '코어', options: CABLE_CORES }, order: 2 },
  { category: '포설', name: 'FCV', spec1: { label: 'SQ', options: CABLE_SQ_SIZES_CUSTOM }, spec2: { label: '코어', options: CABLE_CORES }, order: 3 },
  { category: '포설', name: 'TFR-CV', spec1: { label: 'SQ', options: CABLE_SQ_SIZES }, spec2: { label: '코어', options: CABLE_CORES }, order: 4 },
  { category: '포설', name: 'GV', spec1: { label: 'SQ', options: CABLE_SQ_SIZES }, spec2: { label: '코어', options: CABLE_CORES }, order: 5 },
  { category: '포설', name: 'TFR-GV', spec1: { label: 'SQ', options: CABLE_SQ_SIZES }, spec2: { label: '코어', options: CABLE_CORES }, order: 6 },
  { category: '포설', name: 'CAT6', order: 7 },
  { category: '포설', name: 'UTP', order: 8 },
];

const DEFAULT_TYPE_KEYS = new Set(DEFAULT_TYPES.map((t) => `${t.category}||${t.name}`));
function isDefaultItem(item) { return item.isDefault === true || DEFAULT_TYPE_KEYS.has(`${item.category}||${item.name}`); }

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
function formatKoreanDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS_KO[d.getDay()]})`;
}
const DEFAULT_EXPORT_TEMPLATE = `{날짜} 현장명
김찬양팀

총원 :  0명
출근 :  0명
결근 :  0명

유도원 : 0명

작업 위치 :
사용 장비 :
사용자재 :
{목록}
작업 내용 :

팀리더 전화번호`;

export function mount(container) {
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
  }
  container.innerHTML = TEMPLATE;

  const $ = (id) => document.getElementById(id);

  let toolsUsers = [];
  let categories = [];
  let items = [];
  let entries = [];
  let currentWorker = '';
  let isAdminFlag = false;
  let appStarted = false;
  let currentCategory = null;
  let currentItem = null;
  let currentType = null;
  let pickedSpec1 = null;
  let currentGroup = null;
  let drillDepth = 0;
  let currentSummaryTab = 'total';
  let exportTemplate = '';
  let categoriesLoaded = false, itemsLoaded = false, entriesLoaded = false;
  let toolsUsersUnsub = null, categoriesUnsub = null, itemsUnsub = null, entriesUnsub = null, settingsUnsub = null;

  function isAdmin() { return isAdminFlag; }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function showToast(msg) {
    const t = $('qty-toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  let currentTheme = localStorage.getItem('feederTheme') === 'dark' ? 'dark' : 'light';
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

  function go(viewId) {
    container.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = $(viewId);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
  }

  // ── 로컬 히스토리 스택 (셸 라우터의 popstate와 충돌 방지 — 파일 상단 설명) ──
  let viewStack = [];
  function captureState(view) {
    return { view, category: currentCategory, group: currentGroup, type: currentType, specStep1: pickedSpec1, item: currentItem, drillDepth };
  }
  function pushHistory(view) { viewStack.push(captureState(view)); }
  function applyState(state) {
    if (!state) return;
    currentCategory = state.category || null;
    currentGroup = state.group || null;
    currentType = state.type || null;
    pickedSpec1 = state.specStep1 || null;
    currentItem = state.item || null;
    drillDepth = state.drillDepth || 0;

    switch (state.view) {
      case 'view-home':
        renderTodayEntries(); renderRecent(); go('view-home'); break;
      case 'view-items':
        if (currentCategory) $('items-title').textContent = currentGroup ? `${currentCategory.name} · ${currentGroup}` : currentCategory.name;
        $('item-search').value = '';
        renderItems(); go('view-items'); break;
      case 'view-spec':
        renderSpec(); go('view-spec'); break;
      case 'view-entry':
        if (currentItem) { $('entry-title').textContent = currentItem.name; $('entry-qty-label').textContent = `수량 (${currentItem.unit})`; }
        $('entry-qty').value = '';
        go('view-entry'); break;
      case 'view-summary':
        switchSummaryTab('total'); go('view-summary'); break;
      case 'view-preview':
        fillPreview(); go('view-preview'); break;
      case 'view-template':
        $('template-input').value = exportTemplate; go('view-template'); break;
      default:
        go('view-home');
    }
  }
  function goBack(steps = 1) {
    for (let i = 0; i < steps && viewStack.length > 1; i++) viewStack.pop();
    applyState(viewStack[viewStack.length - 1]);
  }

  function openMenu() { $('menu-overlay').classList.add('show'); }
  function closeMenu() { $('menu-overlay').classList.remove('show'); }
  function updateWhoami() {
    const hamburger = $('hamburger-btn');
    const menuAdmin = $('menu-admin');
    if (currentWorker) { hamburger.style.display = ''; menuAdmin.style.display = isAdminFlag ? '' : 'none'; }
    else { hamburger.style.display = 'none'; closeMenu(); }
  }
  function logout() { auth.signOut(); }

  function openCategory(name, unit) {
    currentCategory = { name, unit }; currentGroup = null;
    $('items-title').textContent = name; $('item-search').value = '';
    renderItems(); go('view-items');
    drillDepth = 0; pushHistory('view-items');
  }
  function openGroup(name) {
    currentGroup = name;
    $('items-title').textContent = `${currentCategory.name} · ${name}`; $('item-search').value = '';
    renderItems(); drillDepth = 0; pushHistory('view-items');
  }
  function itemsBack() { goBack(); }

  function renderCategories() {
    const grid = $('cat-grid');
    if (!categories.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">⏳</span>목록 불러오는 중…</div>'; return; }
    grid.innerHTML = categories.map((c) => `
      <button class="cat-btn" onclick="window.__qty.openCategory('${escapeHtml(c.name)}', '${escapeHtml(c.unit)}')">
        ${escapeHtml(c.name)}<span class="cat-unit">${escapeHtml(c.unit)} 단위</span>
      </button>`).join('');
  }

  function addCategory() {
    const nameInput = $('new-category');
    const unitSelect = $('new-category-unit');
    const name = nameInput.value.trim();
    const unit = unitSelect.value;
    if (!name) { alert('대분류명을 입력해주세요!'); return; }
    if (categories.some((c) => c.name === name)) { alert('이미 있는 대분류예요.'); return; }
    const btn = $('add-category-btn');
    btn.disabled = true;
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.order || 0), 0);
    colCategories.add({ name, unit, order: maxOrder + 1, ts: firebase.firestore.FieldValue.serverTimestamp() })
      .then(() => { nameInput.value = ''; showToast('✅ 대분류 추가 완료! 팀 전체에 공유됐어요'); })
      .catch(() => alert('추가 실패. 인터넷 연결을 확인해주세요.'))
      .finally(() => { btn.disabled = false; });
  }

  function addItem() {
    const input = $('new-item');
    const name = input.value.trim();
    if (!name) { alert('자재명을 입력해주세요!'); return; }
    if (items.some((i) => i.category === currentCategory.name && i.name === name)) { alert('이미 등록된 자재예요.'); return; }
    const btn = $('add-item-btn');
    btn.disabled = true;
    colItems.add({ category: currentCategory.name, name, ts: firebase.firestore.FieldValue.serverTimestamp() })
      .then(() => { input.value = ''; showToast('✅ 자재 추가 완료! 팀 전체에 공유됐어요'); })
      .catch(() => alert('추가 실패. 인터넷 연결을 확인해주세요.'))
      .finally(() => { btn.disabled = false; });
  }

  function selectItem(name, unit) {
    currentItem = { name, unit };
    $('entry-title').textContent = name;
    $('entry-qty-label').textContent = `수량 (${unit})`;
    $('entry-qty').value = '';
    go('view-entry');
    drillDepth += 1; pushHistory('view-entry');
    $('entry-qty').focus();
  }

  function composeItemName(type, s1, s2) {
    const parts = [];
    if (!type.hideTypeInName) parts.push(type.name);
    if (s1) parts.push(s1);
    if (s2) parts.push(s2);
    return parts.join(' ');
  }

  function selectType(typeId) {
    const type = items.find((t) => t.id === typeId);
    if (!type) return;
    currentType = type; pickedSpec1 = null;
    const unit = type.unit || currentCategory.unit;
    if (!type.spec1) { selectItem(composeItemName(type), unit); return; }
    renderSpec(); go('view-spec');
    drillDepth += 1; pushHistory('view-spec');
  }

  function pickSpec(option) {
    if (option === '__CUSTOM__') {
      const input = window.prompt('SQ 규격을 직접 입력하세요 (예: 400)');
      const trimmed = input && input.trim();
      if (!trimmed) return;
      option = /sq$/i.test(trimmed) ? trimmed : `${trimmed}sq`;
    }
    const type = currentType;
    const unit = type.unit || currentCategory.unit;
    if (type.spec2 && pickedSpec1 === null) {
      pickedSpec1 = option; renderSpec();
      drillDepth += 1; pushHistory('view-spec');
      return;
    }
    if (type.spec2) selectItem(composeItemName(type, pickedSpec1, option), unit);
    else selectItem(composeItemName(type, option), unit);
  }
  function specBack() { goBack(); }

  function renderSpec() {
    const type = currentType;
    const onSpec2 = type.spec2 && pickedSpec1 !== null;
    const spec = onSpec2 ? type.spec2 : type.spec1;
    $('spec-title').textContent = onSpec2 ? `${type.name} ${pickedSpec1}` : type.name;
    $('spec-step-label').textContent = `${spec.label} 선택`;
    $('spec-grid').innerHTML = spec.options.map((o) => {
      const label = o === '__CUSTOM__' ? '✏️ 직접입력' : o;
      return `<button class="spec-btn" onclick="window.__qty.pickSpec('${escapeHtml(o)}')">${escapeHtml(label)}</button>`;
    }).join('');
  }

  function renderRecent() {
    const wrap = $('recent-wrap');
    if (!wrap) return;
    const seen = new Set();
    const recent = [];
    for (const e of entries) {
      if (e.worker !== currentWorker || seen.has(e.item)) continue;
      seen.add(e.item); recent.push(e);
      if (recent.length >= 5) break;
    }
    if (!recent.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    $('recent-list').innerHTML = recent.map((e) => `
      <button class="recent-btn" onclick="window.__qty.selectRecent('${escapeHtml(e.item)}', '${escapeHtml(e.unit)}', '${escapeHtml(e.category)}')">${escapeHtml(e.item)}</button>
    `).join('');
  }

  function selectRecent(name, unit, category) {
    const c = categories.find((x) => x.name === category);
    currentCategory = { name: category, unit: c ? c.unit : unit };
    currentGroup = null;
    $('items-title').textContent = category;
    $('item-search').value = '';
    renderItems();
    selectItem(name, unit);
  }

  function typeButtonHtml(t) {
    const unit = t.unit || currentCategory.unit;
    const canDel = !isDefaultItem(t);
    return `
      <div class="item-row">
        <button class="item-btn" onclick="window.__qty.selectType('${t.id}')">
          ${escapeHtml(t.name)}
          <span><span class="item-unit">${escapeHtml(unit)}</span>${t.spec1 ? '<span class="chev">›</span>' : ''}</span>
        </button>
        ${canDel ? `<button class="del-btn" onclick="window.__qty.deleteItem('${t.id}', '${escapeHtml(t.name)}')">✕</button>` : ''}
      </div>`;
  }

  function deleteItem(id, name) {
    if (!confirm(`'${name}' 자재를 삭제할까요? 지금까지 입력된 물량 기록은 그대로 남아요.`)) return;
    colItems.doc(id).delete().catch(() => alert('삭제 실패. 다시 시도해주세요.'));
  }

  function renderItems() {
    if (!currentCategory) return;
    const list = $('item-list');
    const keyword = $('item-search').value.trim();
    const inCategory = items.filter((i) => i.category === currentCategory.name);

    if (keyword) {
      const found = inCategory.filter((i) => i.name.includes(keyword));
      if (!found.length) { list.innerHTML = '<div class="empty-state"><span class="empty-icon">🗂️</span>검색 결과가 없어요</div>'; return; }
      found.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ko'));
      list.innerHTML = found.map(typeButtonHtml).join('');
      return;
    }
    if (currentGroup) {
      const grouped = inCategory.filter((i) => i.group === currentGroup);
      grouped.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ko'));
      list.innerHTML = grouped.map(typeButtonHtml).join('');
      return;
    }
    const top = inCategory.filter((i) => !i.group);
    const groupNames = [...new Set(inCategory.filter((i) => i.group).map((i) => i.group))];
    if (!top.length && !groupNames.length) { list.innerHTML = '<div class="empty-state"><span class="empty-icon">🗂️</span>등록된 자재가 없어요.<br>아래에서 추가해주세요.</div>'; return; }
    top.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ko'));
    const groupButtons = groupNames.map((g) => {
      const count = inCategory.filter((i) => i.group === g).length;
      return `<button class="item-btn" onclick="window.__qty.openGroup('${escapeHtml(g)}')">${escapeHtml(g)}<span><span class="group-count">${count}종</span><span class="chev">›</span></span></button>`;
    });
    list.innerHTML = top.map(typeButtonHtml).join('') + groupButtons.join('');
  }

  function saveEntry() {
    const qtyInput = $('entry-qty');
    const qty = parseFloat(qtyInput.value);
    if (!qty || qty <= 0) { alert('수량을 입력해주세요!'); return; }
    const btn = $('entry-save-btn');
    btn.disabled = true;
    colEntries.add({ worker: currentWorker, category: currentCategory.name, item: currentItem.name, unit: currentItem.unit, qty, date: todayStr(), ts: firebase.firestore.FieldValue.serverTimestamp() })
      .then(() => {
        showToast(`✅ ${currentItem.name} ${qty}${currentItem.unit} 저장 완료!`);
        go('view-items');
        const stepsBack = drillDepth;
        drillDepth = 0;
        if (stepsBack > 0) goBack(stepsBack);
      })
      .catch(() => alert('저장 실패. 인터넷 연결을 확인해주세요.'))
      .finally(() => { btn.disabled = false; });
  }

  function deleteEntry(id) {
    if (!confirm('이 입력 내역을 삭제할까요?')) return;
    colEntries.doc(id).delete().catch(() => alert('삭제 실패. 다시 시도해주세요.'));
  }

  function renderTodayEntries() {
    const list = $('today-list');
    if (!list) return;
    const today = todayStr();
    const mine = entries.filter((e) => e.worker === currentWorker && e.date === today);
    if (!mine.length) { list.innerHTML = '<div class="empty-state"><span class="empty-icon">📋</span>아직 입력한 물량이 없어요</div>'; return; }
    list.innerHTML = mine.map((e) => `
      <div class="entry-card">
        <div class="entry-info"><div class="entry-name">${escapeHtml(e.item)}</div><div class="entry-meta">${escapeHtml(e.category)}</div></div>
        <div class="entry-qty">${e.qty}${escapeHtml(e.unit)}</div>
        <button class="del-btn" onclick="window.__qty.deleteEntry('${e.id}')">✕</button>
      </div>`).join('');
  }

  function openSummary() {
    const today = todayStr();
    $('summary-start').value = today; $('summary-end').value = today;
    $('manage-start').value = today; $('manage-end').value = today;
    switchSummaryTab('total'); go('view-summary'); pushHistory('view-summary');
  }

  function switchSummaryTab(tab) {
    currentSummaryTab = tab;
    $('tab-total').classList.toggle('active', tab === 'total');
    $('tab-manage').classList.toggle('active', tab === 'manage');
    $('summary-tab-total').style.display = tab === 'total' ? '' : 'none';
    $('summary-tab-manage').style.display = tab === 'manage' ? '' : 'none';
    $('summary-title').textContent = tab === 'total' ? '합산 보기' : '전체 기록 관리';
    if (tab === 'manage') { renderManageWorkerOptions(); renderManage(); }
    else { renderSummary(); }
  }

  function formatQty(n) { return Math.round(n * 100) / 100; }

  function getSummaryData() {
    const start = $('summary-start').value || todayStr();
    const end = $('summary-end').value || todayStr();
    const filtered = entries.filter((e) => e.date >= start && e.date <= end);
    const map = new Map();
    filtered.forEach((e) => {
      const key = `${e.category}||${e.item}||${e.unit}`;
      if (!map.has(key)) map.set(key, { category: e.category, item: e.item, unit: e.unit, qty: 0 });
      map.get(key).qty += e.qty;
    });
    const catOrder = new Map(categories.map((c) => [c.name, c.order]));
    return [...map.values()].sort((a, b) => {
      const oa = catOrder.get(a.category) ?? 999;
      const ob = catOrder.get(b.category) ?? 999;
      if (oa !== ob) return oa - ob;
      return a.item.localeCompare(b.item, 'ko');
    });
  }

  function renderSummary() {
    const list = $('summary-list');
    const rows = getSummaryData();
    if (!rows.length) { list.innerHTML = '<div class="empty-state"><span class="empty-icon">📊</span>선택한 기간에 입력된 물량이 없어요</div>'; return; }
    let currentCat = null;
    let html = '';
    rows.forEach((r) => {
      if (r.category !== currentCat) { currentCat = r.category; html += `<div class="summary-group-title">${escapeHtml(currentCat)}</div>`; }
      html += `<div class="summary-row"><span class="summary-item-name">${escapeHtml(r.item)}</span><span class="summary-qty">${formatQty(r.qty)}${escapeHtml(r.unit)}</span></div>`;
    });
    list.innerHTML = html;
  }

  function buildSummaryCSVBlob(rows) {
    const header = '대분류,자재명,단위,합계수량\n';
    const body = rows.map((r) => `${r.category},${r.item},${r.unit},${formatQty(r.qty)}`).join('\n');
    return new Blob(['﻿' + header + body], { type: 'text/csv;charset=utf-8;' });
  }
  function buildListText(rows) {
    let text = '';
    let cat = null;
    rows.forEach((r) => {
      if (r.category !== cat) { cat = r.category; text += (text ? '\n' : '') + `[${cat}]\n`; }
      text += `${r.item} ${formatQty(r.qty)}${r.unit}\n`;
    });
    return text.trim();
  }

  let lastPreviewDate = '';
  let lastPreviewList = '';
  function fillPreview() {
    const rows = getSummaryData();
    lastPreviewDate = formatKoreanDate(todayStr());
    lastPreviewList = buildListText(rows) || '(입력된 자재 없음)';
    const template = exportTemplate || DEFAULT_EXPORT_TEMPLATE;
    $('preview-text').value = template.replaceAll('{날짜}', lastPreviewDate).replaceAll('{목록}', lastPreviewList);
  }
  function openPreview() { fillPreview(); go('view-preview'); pushHistory('view-preview'); }

  function saveExportTemplate(val) {
    return colSettings.doc('export_template').set({ template: val, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
      .catch(() => alert('저장 실패. 인터넷 연결을 확인해주세요.'));
  }
  function openTemplateEditor() { $('template-input').value = exportTemplate; go('view-template'); pushHistory('view-template'); }
  function saveTemplate() {
    const val = $('template-input').value;
    saveExportTemplate(val.trim());
    showToast('✅ 양식 저장 완료! 팀 전체에 공유됐어요');
    goBack();
  }
  function resetTemplate() {
    if (!confirm('기본 양식으로 되돌릴까요? (팀 전체에 적용돼요)')) return;
    saveExportTemplate('');
    $('template-input').value = '';
    showToast('✅ 기본 양식으로 되돌렸어요');
  }

  async function sharePreview() {
    const finalText = $('preview-text').value;
    let toSave = finalText;
    if (lastPreviewList && toSave.includes(lastPreviewList)) toSave = toSave.replace(lastPreviewList, '{목록}');
    if (lastPreviewDate && toSave.includes(lastPreviewDate)) toSave = toSave.replace(lastPreviewDate, '{날짜}');
    if (toSave !== exportTemplate) saveExportTemplate(toSave);

    const rows = getSummaryData();
    const start = $('summary-start').value;
    const end = $('summary-end').value;
    const fileName = `물량합산_${start}_${end}.csv`;
    const file = new File([buildSummaryCSVBlob(rows)], fileName, { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '물량 보고', text: finalText }); }
      catch (e) { if (e.name !== 'AbortError') alert('공유에 실패했어요.'); }
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: '물량 보고', text: finalText }); }
      catch (e) { if (e.name !== 'AbortError') alert('공유에 실패했어요.'); }
      return;
    }
    alert('이 브라우저는 공유하기를 지원하지 않아요.');
  }

  function renderManageWorkerOptions() {
    const sel = $('manage-worker');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">전체 작업자</option>' + toolsUsers.map((w) => `<option value="${escapeHtml(w.name)}">${escapeHtml(w.name)}</option>`).join('');
    sel.value = prev;
  }

  function renderManage() {
    const list = $('manage-list');
    if (!list) return;
    const worker = $('manage-worker').value;
    const start = $('manage-start').value || todayStr();
    const end = $('manage-end').value || todayStr();
    const filtered = entries.filter((e) => e.date >= start && e.date <= end && (!worker || e.worker === worker));
    if (!filtered.length) { list.innerHTML = '<div class="empty-state"><span class="empty-icon">🗂️</span>선택한 조건에 기록이 없어요</div>'; return; }
    const groups = new Map();
    filtered.forEach((e) => { if (!groups.has(e.worker)) groups.set(e.worker, []); groups.get(e.worker).push(e); });
    let html = '';
    groups.forEach((rows, workerName) => {
      const workerIsAdmin = toolsUsers.some((u) => u.name === workerName && u.isAdmin);
      html += `
        <div class="card manage-card">
          <div class="manage-card-header"><span>${workerIsAdmin ? '⭐' : '👷'} ${escapeHtml(workerName)}</span><span class="manage-card-count">${rows.length}건</span></div>
          ${rows.map((e) => {
            const canDel = isAdmin() || e.worker === currentWorker;
            return `
            <div class="manage-row">
              <div class="manage-row-info"><div class="manage-row-name">${escapeHtml(e.item)}</div><div class="manage-row-meta">${escapeHtml(e.category)} · ${escapeHtml(e.date)}</div></div>
              <div class="manage-row-qty">${e.qty}${escapeHtml(e.unit)}</div>
              ${canDel ? `<button class="del-btn del-btn-green" onclick="window.__qty.deleteEntry('${e.id}')">✕</button>` : '<div style="width:38px;flex-shrink:0;"></div>'}
            </div>`;
          }).join('')}
        </div>`;
    });
    list.innerHTML = html;
  }

  function seedIfEmpty() {
    const lockRef = colCategories.doc('_seed_lock');
    db.runTransaction((tx) => tx.get(lockRef).then((lockSnap) => {
      if (lockSnap.exists) return;
      tx.set(lockRef, { seededAt: firebase.firestore.FieldValue.serverTimestamp() });
      DEFAULT_CATEGORIES.forEach((c) => tx.set(colCategories.doc(), c));
      DEFAULT_TYPES.forEach((t) => tx.set(colItems.doc(), { ...t, isDefault: true, ts: firebase.firestore.FieldValue.serverTimestamp() }));
    })).catch(() => {});
  }

  function maybeFixHfixPoseolSpec() {
    const hfix = items.find((i) => i.category === '포설' && i.name === 'HFIX');
    if (!hfix || !hfix.spec1) return;
    if (JSON.stringify(hfix.spec1.options) === JSON.stringify(HFIX_POSEOL_SIZES)) return;
    colItems.doc(hfix.id).update({ 'spec1.options': HFIX_POSEOL_SIZES }).catch(() => {});
  }

  function maybeMigrateDanmalCable() {
    if (!itemsLoaded) return;
    const old = items.find((i) => i.category === '단말' && i.name === '케이블' && !i.group);
    if (!old) return;
    const lockRef = colCategories.doc('_migrate_danmal_cable_lock');
    db.runTransaction((tx) => tx.get(lockRef).then((lockSnap) => {
      if (lockSnap.exists) return;
      tx.set(lockRef, { migratedAt: firebase.firestore.FieldValue.serverTimestamp() });
      tx.delete(colItems.doc(old.id));
      DEFAULT_TYPES.filter((t) => t.category === '단말' && t.group === '케이블').forEach((t) => tx.set(colItems.doc(), { ...t, isDefault: true, ts: firebase.firestore.FieldValue.serverTimestamp() }));
    })).catch(() => {});
  }

  function maybeMigratePoseol() {
    if (!categoriesLoaded || !itemsLoaded || !entriesLoaded) return;
    const cat = categories.find((c) => c.name === '기구설치');
    const lockRef = colCategories.doc('_migrate_poseol_lock');
    db.runTransaction((tx) => tx.get(lockRef).then((lockSnap) => {
      if (lockSnap.exists) return;
      tx.set(lockRef, { migratedAt: firebase.firestore.FieldValue.serverTimestamp() });
      if (cat) {
        tx.update(colCategories.doc(cat.id), { name: '포설', unit: 'M', emoji: '🪢' });
        items.filter((i) => i.category === '기구설치').forEach((i) => tx.update(colItems.doc(i.id), { category: '포설' }));
        entries.filter((e) => e.category === '기구설치').forEach((e) => tx.update(colEntries.doc(e.id), { category: '포설' }));
      }
      DEFAULT_TYPES.filter((t) => t.category === '포설').forEach((t) => tx.set(colItems.doc(), { ...t, isDefault: true, ts: firebase.firestore.FieldValue.serverTimestamp() }));
    })).catch(() => {});
  }

  function startApp() {
    if (appStarted) return;
    appStarted = true;
    seedIfEmpty();

    toolsUsersUnsub = colToolsUsers.orderBy('name').onSnapshot((snap) => {
      toolsUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderManageWorkerOptions();
    });
    categoriesUnsub = colCategories.orderBy('order').onSnapshot((snap) => {
      categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCategories();
      categoriesLoaded = true;
      maybeMigratePoseol();
    });
    itemsUnsub = colItems.orderBy('name').onSnapshot((snap) => {
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderItems();
      itemsLoaded = true;
      maybeMigratePoseol();
      maybeFixHfixPoseolSpec();
      maybeMigrateDanmalCable();
    });
    entriesUnsub = colEntries.orderBy('ts', 'desc').onSnapshot((snap) => {
      entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodayEntries(); renderRecent(); renderManage();
      entriesLoaded = true;
      maybeMigratePoseol();
    });
    settingsUnsub = colSettings.doc('export_template').onSnapshot((doc) => {
      exportTemplate = (doc.exists && doc.data().template) || '';
      if ($('view-template')?.classList.contains('active')) $('template-input').value = exportTemplate;
    });

    renderTodayEntries();
    renderRecent();
    go('view-home');
    viewStack = [captureState('view-home')];
  }

  renderSettings();

  const unsubProfile = onProfile((profile, user) => {
    if (!user || !profile || profile.status !== 'approved') {
      currentWorker = '';
      updateWhoami();
      go('view-locked');
      return;
    }
    currentWorker = profile.name;
    isAdminFlag = !!profile.isAdmin;
    updateWhoami();
    startApp();
  });

  window.__qty = {
    openMenu, closeMenu, setTheme, renderSettings, logout, go, goBack,
    openCategory, openGroup, itemsBack, addCategory, addItem, selectType, pickSpec, specBack,
    selectRecent, deleteItem, renderItems, saveEntry, deleteEntry,
    openSummary, switchSummaryTab, renderSummary, renderManage, openPreview, openTemplateEditor,
    saveTemplate, resetTemplate, sharePreview,
  };

  return function unmount() {
    unsubProfile();
    if (toolsUsersUnsub) toolsUsersUnsub();
    if (categoriesUnsub) categoriesUnsub();
    if (itemsUnsub) itemsUnsub();
    if (entriesUnsub) entriesUnsub();
    if (settingsUnsub) settingsUnsub();
    delete window.__qty;
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    console.log('[qty-report-view] unmounted — 구독/스타일 정리 완료');
  };
}
