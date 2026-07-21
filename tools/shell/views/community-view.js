// tools/community.html 이관. 구인/구직/자유게시판 + 댓글/신고/공지 관리까지 포함된
// 두 번째로 큰 화면. 원본은 게시글 상세를 열 때 history.pushState({feederDetail:true})로
// "뒤로가기 = 상세 닫기"를 구현했는데, 이것도 home-view.js와 같은 이유로 셸 라우터의
// popstate 처리와 충돌한다. 그래서 여기서도 history API 대신 로컬 상태(showDetailArea/
// hideDetailArea)로만 상세 열기/닫기를 처리하고, "← 목록으로" 버튼으로만 닫도록 했다
// (하드웨어 뒤로가기로 상세를 닫는 동작만 이번 이관에서 빠짐 — home-view.js와 동일한 트레이드오프).

import { auth, db, onProfile } from '../firebase-shell.js';

const STYLE_ID = 'view-style-community';
const STYLE = `
:root {
  --orange: #FF6B2B; --orange-dark: #E05520;
  --bg: #F4F3F0; --card-bg: #FFFFFF; --border: #ECEBE7;
  --text: #1C1E27; --text-dim: #767A85;
  --give-bg: #E5F5EC; --give-text: #1E8E56;
  --muted-bg: #F1F0EC; --muted-text: #8B8F9C;
}
/* 커뮤니티는 다크/화이트 테마 구분 없이 항상 화이트 톤인 예외 화면이라, 셸 공용
   body 배경(--steel, 다크/화이트에 따라 바뀜)을 이 화면이 떠있는 동안만 덮어쓴다.
   이 <style>은 mount() 때마다 head에 나중에 추가되므로 shell-base.css의 body 규칙보다
   소스 순서상 뒤에 와서(!important 없이도) 자연스럽게 우선 적용된다. */
body { background: var(--bg); color: var(--text); }
.community-root { font-family: 'Noto Sans KR', sans-serif; color: var(--text); }
.community-root .container { max-width: 480px; margin: 0 auto; }
.community-root .site-header { position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:rgba(244,243,240,0.85); border-bottom:1px solid var(--border); padding:0 20px; height:52px; display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.community-root .brand { font-size:15px; font-weight:700; color:var(--text); text-decoration:none; }
.community-root .brand span { color:var(--orange); }
.community-root .hamburger-btn { width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:none; border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:17px; cursor:pointer; flex-shrink:0; }
.community-root .hamburger-btn:hover { border-color:var(--orange); color:var(--orange); }
.community-root .menu-overlay { display:none; position:fixed; inset:0; z-index:200; background:rgba(28,30,39,0.35); justify-content:flex-end; }
.community-root .menu-overlay.show { display:flex; }
.community-root .menu-sheet { width:78%; max-width:300px; height:100%; background:var(--card-bg); border-left:1px solid var(--border); padding:20px 16px; display:flex; flex-direction:column; animation: comm-menuSlideIn 0.22s cubic-bezier(0.2,0.9,0.3,1); overflow-y:auto; }
@keyframes comm-menuSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.community-root .menu-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding:0 2px; }
.community-root .menu-title { font-size:15px; font-weight:900; color:var(--text-dim); letter-spacing:0.5px; }
.community-root .menu-close { width:32px; height:32px; border-radius:8px; background:none; border:none; color:var(--text-dim); font-size:16px; cursor:pointer; }
.community-root .menu-close:hover { color:var(--orange); }
.community-root .menu-item { display:flex; align-items:center; gap:12px; padding:14px 10px; border-radius:12px; background:none; border:none; color:var(--text); font-family:inherit; font-size:15px; font-weight:700; text-align:left; cursor:pointer; width:100%; }
.community-root .menu-item:hover { background:var(--bg); }
.community-root .menu-item-icon { font-size:17px; width:22px; text-align:center; flex-shrink:0; }
.community-root .menu-item--logout { margin-top:auto; color:#D3453F; }
.community-root .menu-badge { margin-left:auto; background:#D3453F; color:#fff; font-size:11px; font-weight:800; padding:2px 7px; border-radius:10px; flex-shrink:0; }
.community-root .report-overlay { display:none; position:fixed; inset:0; z-index:220; background:rgba(28,30,39,0.45); align-items:center; justify-content:center; padding:20px; }
.community-root .report-overlay.show { display:flex; }
.community-root .report-modal { width:100%; max-width:340px; background:var(--card-bg); border-radius:16px; padding:20px 16px; animation: comm-fadeIn 0.2s ease; }
.community-root .report-reason-list { display:flex; flex-direction:column; gap:8px; }
.community-root .report-reason-opt { display:flex; align-items:center; gap:8px; padding:10px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:13.5px; cursor:pointer; }
.community-root .report-reason-opt:has(input:checked) { border-color:var(--orange); background:rgba(255,107,43,0.06); }
.community-root .view { display:none; }
.community-root .view.active { display:block; animation: comm-fadeIn 0.25s ease; }
@keyframes comm-fadeIn { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
.community-root .loading-brand { text-align:center; padding-top:60px; }
.community-root .loading-brand-title { font-size:22px; font-weight:900; color:var(--text); letter-spacing:-0.5px; }
.community-root .loading-brand-sub { font-size:13px; color:var(--text-dim); margin-top:8px; }
.community-root .card { background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:20px; }
.community-root .notice-strip { background:var(--give-bg); color:var(--give-text); font-size:12px; font-weight:700; text-align:center; padding:8px 12px; border-radius:10px; margin-bottom:16px; }
.community-root .tabs { display:flex; align-items:center; gap:20px; border-bottom:1px solid var(--border); margin-bottom:16px; padding-top:4px; }
.community-root .tab { font-size:14px; font-weight:700; color:#9A9DA8; padding-bottom:12px; border-bottom:2px solid transparent; background:none; border-left:none; border-right:none; border-top:none; font-family:inherit; cursor:pointer; flex-shrink:0; }
.community-root .tab.active { color:var(--text); border-bottom-color:var(--orange); }
.community-root .search-bar { display:flex; gap:8px; margin-bottom:10px; }
.community-root .search-input { flex:1; min-width:0; padding:9px 12px; background:#FAFAF8; border:1.5px solid var(--border); border-radius:8px; color:var(--text); font-family:inherit; font-size:13px; outline:none; -webkit-appearance:none; }
.community-root .search-input:focus { border-color:var(--orange); }
.community-root .filter-btn { flex-shrink:0; width:38px; height:38px; display:flex; align-items:center; justify-content:center; background:#FAFAF8; border:1.5px solid var(--border); border-radius:8px; font-size:14px; cursor:pointer; }
.community-root .filter-btn.active { border-color:var(--orange); background:rgba(255,107,43,0.08); }
.community-root .filter-panel { background:var(--card-bg); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:14px; }
.community-root .filter-group { display:flex; flex-wrap:wrap; gap:8px; }
.community-root .filter-group select { flex:1 1 calc(50% - 4px); min-width:100px; padding:8px 10px; background:#FAFAF8; border:1.5px solid var(--border); border-radius:8px; color:var(--text); font-family:inherit; font-size:12.5px; outline:none; -webkit-appearance:none; }
.community-root .filter-group select:focus { border-color:var(--orange); }
.community-root .filter-range { flex:1 1 100%; display:flex; align-items:center; gap:6px; }
.community-root .filter-range input { flex:1; min-width:0; padding:8px 10px; background:#FAFAF8; border:1.5px solid var(--border); border-radius:8px; color:var(--text); font-family:inherit; font-size:12.5px; outline:none; -webkit-appearance:none; }
.community-root .filter-range input:focus { border-color:var(--orange); }
.community-root .filter-range span { font-size:12px; color:var(--text-dim); flex-shrink:0; }
.community-root .filter-reset-btn { width:100%; margin-top:10px; padding:8px; background:#fff; border:1.5px solid var(--border); border-radius:8px; color:var(--text-dim); font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; }
.community-root .filter-reset-btn:hover { border-color:var(--orange); color:var(--orange); }
.community-root .board-panel { display:none; }
.community-root .board-panel.active { display:block; }
.community-root .empty-state { text-align:center; padding:48px 20px; color:var(--text-dim); font-size:14px; line-height:1.7; }
.community-root .empty-state .empty-icon { font-size:30px; display:block; margin-bottom:10px; opacity:0.5; }
.community-root .new-btn { width:100%; padding:13px; background:var(--orange); border:none; border-radius:10px; color:#fff; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; margin-bottom:14px; }
.community-root .new-btn:hover { background:var(--orange-dark); }
.community-root .form-card { margin-bottom:16px; }
.community-root .field { margin-bottom:14px; }
.community-root .field:last-child { margin-bottom:0; }
.community-root .field label { display:block; font-size:12px; font-weight:700; color:var(--text-dim); letter-spacing:0.4px; margin-bottom:6px; }
.community-root .field input, .community-root .field select, .community-root .field textarea { width:100%; padding:12px 14px; background:#FAFAF8; border:1.5px solid var(--border); border-radius:10px; color:var(--text); font-family:inherit; font-size:14px; outline:none; -webkit-appearance:none; }
.community-root .field textarea { resize:vertical; min-height:72px; }
.community-root .field input:focus, .community-root .field select:focus, .community-root .field textarea:focus { border-color:var(--orange); }
.community-root .field-row { display:flex; gap:10px; }
.community-root .field-row .field { flex:1 1 0; min-width:0; }
.community-root .check-row { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-dim); font-weight:500; cursor:pointer; }
.community-root .check-row input { width:auto; }
.community-root .form-actions { display:flex; gap:8px; margin-top:18px; }
.community-root .form-actions .submit-btn { flex:1; }
.community-root .cancel-btn { padding:13px 18px; background:#FFFFFF; border:1.5px solid var(--border); border-radius:10px; color:var(--text-dim); font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; }
.community-root .submit-btn { width:100%; padding:14px; background:var(--orange); border:none; border-radius:10px; color:#fff; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; }
.community-root .submit-btn:hover { background:var(--orange-dark); }
.community-root .submit-btn:disabled { opacity:0.5; cursor:not-allowed; }
.community-root .list { display:flex; flex-direction:column; gap:10px; }
.community-root .job-card { background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:14px; }
.community-root .job-card.is-closed { opacity:0.55; }
.community-root .job-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:8px; }
.community-root .job-site { font-size:14px; font-weight:700; }
.community-root .job-region { font-size:12px; color:var(--text-dim); margin-top:2px; }
.community-root .badge { flex-shrink:0; font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px; }
.community-root .badge.stay-yes { background:var(--give-bg); color:var(--give-text); }
.community-root .badge.stay-no { background:var(--muted-bg); color:var(--muted-text); }
.community-root .badge.stay-negotiable { background:rgba(255,107,43,0.1); color:var(--orange-dark); }
.community-root .badge.closed { background:var(--muted-bg); color:var(--muted-text); }
.community-root .job-meta { font-size:12px; color:var(--text-dim); line-height:1.9; }
.community-root .job-meta b { color:var(--text); font-weight:700; }
.community-root .job-desc { font-size:13px; color:var(--text); margin-top:8px; line-height:1.6; white-space:pre-wrap; }
.community-root .job-card-foot { display:flex; align-items:center; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid var(--muted-bg); }
.community-root .job-wage { font-size:14px; font-weight:700; color:var(--orange); }
.community-root .job-contact { font-size:12px; color:var(--text-dim); }
.community-root .card-counts { font-size:11.5px; color:var(--text-dim); }
.community-root .admin-actions { display:flex; gap:6px; margin-top:10px; }
.community-root .mini-btn { flex:1; padding:8px; font-size:12px; font-weight:700; border-radius:8px; cursor:pointer; font-family:inherit; border:1.5px solid var(--border); background:#fff; color:var(--text-dim); }
.community-root .mini-btn:hover { border-color:var(--orange); color:var(--orange); }
.community-root .mini-btn.danger:hover { border-color:#E24B4A; color:#E24B4A; }
.community-root .post-card { background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:14px; }
.community-root .post-card-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; }
.community-root .post-cat { font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px; background:var(--muted-bg); color:var(--muted-text); }
.community-root .post-title { font-size:14px; font-weight:700; margin:6px 0 4px; }
.community-root .post-content { font-size:13px; color:var(--text); line-height:1.6; white-space:pre-wrap; }
.community-root .post-content a, .community-root .job-desc a { color:var(--orange); text-decoration:underline; word-break:break-all; }
.community-root .post-meta { font-size:11.5px; color:var(--text-dim); margin-top:8px; }
.community-root .post-del { font-size:11.5px; color:var(--text-dim); background:none; border:none; font-family:inherit; cursor:pointer; padding:0; }
.community-root .post-del:hover { color:#E24B4A; }
`;

const TEMPLATE = `
<div class="community-root">
  <header class="site-header">
    <a href="/tools/index.html" class="brand">Fee<span>der</span> · 커뮤니티</a>
    <button class="hamburger-btn" id="hamburger-btn" onclick="window.__community.openMenu()" aria-label="메뉴">☰</button>
  </header>

  <div class="menu-overlay" id="menu-overlay" onclick="window.__community.closeMenu()">
    <div class="menu-sheet" onclick="event.stopPropagation()">
      <div class="menu-head">
        <span class="menu-title">메뉴</span>
        <button class="menu-close" onclick="window.__community.closeMenu()" aria-label="닫기">✕</button>
      </div>
      <button class="menu-item" id="menu-user" onclick="window.__community.closeMenu(); location.href='/tools/index.html?profile=1';" style="display:none;">
        <span class="menu-item-icon">👤</span><span id="menu-user-name"></span>
      </button>
      <button class="menu-item" id="menu-inquiry" onclick="window.__community.closeMenu(); location.href='/tools/index.html?inquiry=1';" style="display:none;">
        <span class="menu-item-icon">📮</span><span>문의하기</span>
      </button>
      <button class="menu-item" id="menu-guest" onclick="window.__community.closeMenu(); location.href='/tools/index.html?login=1';" style="display:none;">
        <span class="menu-item-icon">🔑</span><span>로그인 / 회원가입</span>
      </button>
      <button class="menu-item" id="menu-admin" onclick="window.__community.closeMenu(); location.href='/tools/index.html?admin=1';" style="display:none;">
        <span class="menu-item-icon">🔑</span><span>팀장 기능</span>
      </button>
      <button class="menu-item" id="menu-announce" onclick="window.__community.closeMenu(); window.__community.openAnnounceForm();" style="display:none;">
        <span class="menu-item-icon">📢</span><span>공지 관리</span>
      </button>
      <button class="menu-item" id="menu-reports" onclick="window.__community.closeMenu(); window.__community.openReportsView();" style="display:none;">
        <span class="menu-item-icon">🚩</span><span>신고 관리</span><span class="menu-badge" id="reports-badge" style="display:none;"></span>
      </button>
      <button class="menu-item menu-item--logout" id="menu-logout" onclick="window.__community.closeMenu(); window.__community.logout();" style="display:none;">
        <span class="menu-item-icon">🚪</span><span>로그아웃</span>
      </button>
    </div>
  </div>

  <div class="report-overlay" id="report-overlay" onclick="window.__community.closeReportModal()">
    <div class="report-modal" onclick="event.stopPropagation()">
      <div class="menu-head">
        <span class="menu-title">🚩 신고하기</span>
        <button class="menu-close" onclick="window.__community.closeReportModal()" aria-label="닫기">✕</button>
      </div>
      <div class="field">
        <label>신고 사유</label>
        <div class="report-reason-list">
          <label class="report-reason-opt"><input type="radio" name="report-reason" value="스팸·광고" onchange="window.__community.onReportReasonChange()"> 스팸·광고</label>
          <label class="report-reason-opt"><input type="radio" name="report-reason" value="허위정보" onchange="window.__community.onReportReasonChange()"> 허위정보</label>
          <label class="report-reason-opt"><input type="radio" name="report-reason" value="욕설·비방" onchange="window.__community.onReportReasonChange()"> 욕설·비방</label>
          <label class="report-reason-opt"><input type="radio" name="report-reason" value="기타" onchange="window.__community.onReportReasonChange()"> 기타</label>
        </div>
      </div>
      <div class="field" id="report-detail-field" style="display:none;">
        <textarea id="report-detail-input" placeholder="구체적으로 알려주세요" rows="3"></textarea>
      </div>
      <button class="submit-btn" id="report-submit-btn" onclick="window.__community.submitReport()" disabled>신고하기</button>
    </div>
  </div>

  <div class="container">
    <div class="view active" id="view-checking">
      <div class="loading-brand">
        <div class="loading-brand-title">Feeder</div>
        <div class="loading-brand-sub">불러오는 중…</div>
      </div>
    </div>

    <div class="view" id="view-app">
      <div class="tabs">
        <button class="tab active" id="tab-jobs" onclick="window.__community.switchTab('jobs')">구인</button>
        <button class="tab" id="tab-seekers" onclick="window.__community.switchTab('seekers')">구직</button>
        <button class="tab" id="tab-free" onclick="window.__community.switchTab('free')">자유게시판</button>
      </div>

      <div class="card" id="announcement-banner" style="display:none; border-left:3px solid var(--orange); align-items:flex-start; gap:10px; cursor:pointer;" onclick="window.__community.openAnnouncementDetail(event)">
        <span style="font-size:15px;">📢</span>
        <div style="flex:1; font-size:13.5px; line-height:1.5; white-space:pre-wrap;" id="announcement-text"></div>
        <button class="menu-item-icon" id="announce-edit-btn" onclick="event.stopPropagation(); window.__community.openAnnounceForm()" style="display:none; background:none; border:none; cursor:pointer; font-size:14px; color:var(--text-dim);" aria-label="공지 수정">✎</button>
      </div>

      <div class="card form-card" id="announce-form" style="display:none;">
        <div class="field">
          <label>공지 내용</label>
          <textarea id="announce-content" rows="4" placeholder="전체 회원에게 보여줄 공지 내용을 입력하세요"></textarea>
        </div>
        <div class="form-actions">
          <button class="cancel-btn" onclick="window.__community.closeAnnounceForm()">취소</button>
          <button class="submit-btn" id="announce-save-btn" onclick="window.__community.saveAnnouncement()">저장</button>
        </div>
        <button class="new-btn" id="announce-clear-btn" style="background:none; color:#c1584c; border:1px solid rgba(193,88,76,0.35); margin-top:10px;" onclick="window.__community.clearAnnouncement()">공지 내리기</button>
      </div>

      <div class="search-bar">
        <input type="text" id="search-input" class="search-input" placeholder="검색" oninput="window.__community.onSearchInput()" />
        <button class="filter-btn" id="filter-toggle-btn" onclick="window.__community.toggleFilterPanel()" aria-label="필터">🎚️</button>
      </div>

      <div class="filter-panel" id="filter-panel" style="display:none;">
        <div class="filter-group" id="filter-jobs">
          <select id="filter-job-worktype" onchange="window.__community.onJobFilterChange()">
            <option value="">공종 전체</option>
            <option value="전기(내선)">전기(내선)</option>
            <option value="전기(플랜트·고압)">전기(플랜트·고압)</option>
            <option value="통신">통신</option>
            <option value="소방">소방</option>
            <option value="설비">설비</option>
            <option value="기타">기타</option>
          </select>
          <select id="filter-job-sido" onchange="window.__community.onJobFilterChange()"><option value="">지역 전체</option></select>
          <select id="filter-job-stay" onchange="window.__community.onJobFilterChange()">
            <option value="">숙소 전체</option>
            <option value="yes">숙소제공</option>
            <option value="no">숙소미제공</option>
            <option value="negotiable">숙소협의</option>
          </select>
          <select id="filter-job-status" onchange="window.__community.onJobFilterChange()">
            <option value="">상태 전체</option>
            <option value="open">모집중</option>
            <option value="closed">마감</option>
          </select>
          <div class="filter-range">
            <input type="number" id="filter-job-wage-min" placeholder="최소 단가" oninput="window.__community.onJobFilterChange()" />
          </div>
        </div>
        <div class="filter-group" id="filter-seekers" style="display:none;">
          <select id="filter-seeker-worktype" onchange="window.__community.onSeekerFilterChange()">
            <option value="">공종 전체</option>
            <option value="전기(내선)">전기(내선)</option>
            <option value="전기(플랜트·고압)">전기(플랜트·고압)</option>
            <option value="통신">통신</option>
            <option value="소방">소방</option>
            <option value="설비">설비</option>
            <option value="기타">기타</option>
          </select>
          <select id="filter-seeker-region" onchange="window.__community.onSeekerFilterChange()"><option value="">지역 전체</option></select>
          <select id="filter-seeker-stay" onchange="window.__community.onSeekerFilterChange()">
            <option value="">숙소 전체</option>
            <option value="needed">숙소필요</option>
            <option value="not_needed">숙소불필요</option>
            <option value="negotiable">숙소협의</option>
          </select>
          <select id="filter-seeker-status" onchange="window.__community.onSeekerFilterChange()">
            <option value="">상태 전체</option>
            <option value="available">구직중</option>
            <option value="matched">완료</option>
          </select>
        </div>
        <div class="filter-group" id="filter-free" style="display:none;">
          <select id="filter-post-category" onchange="window.__community.onPostFilterChange()">
            <option value="">카테고리 전체</option>
            <option value="현장후기">현장후기</option>
            <option value="정보·꿀팁">정보·꿀팁</option>
            <option value="질문">질문</option>
            <option value="자유">자유</option>
          </select>
        </div>
        <button class="filter-reset-btn" onclick="window.__community.resetFilters()">필터 초기화</button>
      </div>

      <div id="list-area">
      <div class="board-panel active" id="panel-jobs">
        <button class="new-btn" id="job-new-btn" style="display:none;" onclick="window.__community.openJobForm()">+ 구인 등록</button>
        <div class="card form-card" id="job-form" style="display:none;">
          <div class="field"><label>제목</label><input type="text" id="job-title" placeholder="예: 전기 기능공 급구" /></div>
          <div class="field"><label>현장명</label><input type="text" id="job-site" placeholder="예: 김포 물류센터 신축" /></div>
          <div class="field-row">
            <div class="field"><label>시/도</label><select id="job-sido"></select></div>
            <div class="field"><label>시/군/구</label><input type="text" id="job-sigungu" placeholder="예: 김포시" /></div>
          </div>
          <div class="field">
            <label>공종</label>
            <select id="job-worktype">
              <option value="전기(내선)">전기(내선)</option>
              <option value="전기(플랜트·고압)">전기(플랜트·고압)</option>
              <option value="통신">통신</option>
              <option value="소방">소방</option>
              <option value="설비">설비</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div class="field"><label>모집인원</label><input type="number" id="job-headcount" min="1" placeholder="숫자만 입력" /></div>
          <div class="field">
            <label>공사기간</label>
            <label class="check-row" style="margin-bottom:8px;"><input type="checkbox" id="job-period-negotiable" onchange="window.__community.togglePeriodInputs()" /> 협의</label>
            <div class="field-row" id="job-period-dates">
              <input type="date" id="job-period-start" />
              <input type="date" id="job-period-end" />
            </div>
          </div>
          <div class="field">
            <label>숙소 제공 여부</label>
            <select id="job-stay" onchange="window.__community.toggleStayDetail()">
              <option value="yes">제공</option>
              <option value="no">미제공</option>
              <option value="negotiable">협의</option>
            </select>
          </div>
          <div id="job-stay-detail">
            <div class="field"><label>숙소 형태</label><input type="text" id="job-stay-type" placeholder="예: 원룸, 2인1실" /></div>
            <div class="field">
              <label>숙식비</label>
              <select id="job-meal-cost">
                <option value="free">무료</option>
                <option value="partial">일부 부담</option>
                <option value="cash">현금 지급</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>일당 / 단가</label>
            <label class="check-row" style="margin-bottom:8px;"><input type="checkbox" id="job-wage-negotiable" onchange="window.__community.toggleWageInput()" /> 협의</label>
            <input type="number" id="job-wage" placeholder="숫자만 입력 (원)" />
          </div>
          <div class="field"><label>세부작업 내용</label><textarea id="job-desc" placeholder="작업 내용을 적어주세요"></textarea></div>
          <div class="field">
            <label>연락방법</label>
            <select id="job-contact-method" style="margin-bottom:8px;">
              <option value="phone">전화번호</option>
              <option value="kakao">카톡 오픈채팅 링크</option>
            </select>
            <input type="text" id="job-contact-value" placeholder="연락처를 입력해주세요" />
          </div>
          <div class="form-actions">
            <button class="cancel-btn" onclick="window.__community.closeJobForm()">취소</button>
            <button class="submit-btn" id="job-save-btn" onclick="window.__community.saveJob()">등록하기</button>
          </div>
        </div>
        <div class="list" id="job-list"></div>
      </div>

      <div class="board-panel" id="panel-seekers">
        <button class="new-btn" id="seeker-new-btn" style="display:none;" onclick="window.__community.openSeekerForm()">+ 구직 등록</button>
        <div class="card form-card" id="seeker-form" style="display:none;">
          <div class="field"><label>제목</label><input type="text" id="seeker-title" placeholder="예: 전기 기능공 자리 구합니다" /></div>
          <div class="field">
            <label>희망 공종</label>
            <select id="seeker-worktype">
              <option value="전기(내선)">전기(내선)</option>
              <option value="전기(플랜트·고압)">전기(플랜트·고압)</option>
              <option value="통신">통신</option>
              <option value="소방">소방</option>
              <option value="설비">설비</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div class="field"><label>경력</label><input type="text" id="seeker-career" placeholder="예: 3년, 신입 가능 등" /></div>
          <div class="field"><label>이동 가능 지역</label><select id="seeker-region"></select></div>
          <div class="field">
            <label>숙소 필요 여부</label>
            <select id="seeker-stay">
              <option value="needed">필요</option>
              <option value="not_needed">불필요</option>
              <option value="negotiable">협의</option>
            </select>
          </div>
          <div class="field"><label>자기소개</label><textarea id="seeker-intro" placeholder="경력, 보유 자격증, 원하는 조건 등을 자유롭게 적어주세요"></textarea></div>
          <div class="field">
            <label>연락방법</label>
            <select id="seeker-contact-method" style="margin-bottom:8px;">
              <option value="phone">전화번호</option>
              <option value="kakao">카톡 오픈채팅 링크</option>
            </select>
            <input type="text" id="seeker-contact-value" placeholder="연락처를 입력해주세요" />
          </div>
          <div class="form-actions">
            <button class="cancel-btn" onclick="window.__community.closeSeekerForm()">취소</button>
            <button class="submit-btn" id="seeker-save-btn" onclick="window.__community.saveSeeker()">등록하기</button>
          </div>
        </div>
        <div class="list" id="seeker-list"></div>
      </div>

      <div class="board-panel" id="panel-free">
        <button class="new-btn" id="post-new-btn" style="display:none;" onclick="window.__community.openPostForm()">+ 글쓰기</button>
        <div class="card form-card" id="post-form" style="display:none;">
          <div class="field"><label>제목</label><input type="text" id="post-title" placeholder="제목을 입력해주세요" /></div>
          <div class="field">
            <label>카테고리</label>
            <select id="post-category">
              <option value="현장후기">현장후기</option>
              <option value="정보·꿀팁">정보·꿀팁</option>
              <option value="질문">질문</option>
              <option value="자유">자유</option>
            </select>
          </div>
          <div class="field"><label>내용</label><textarea id="post-content" placeholder="내용을 입력해주세요" style="min-height:120px;"></textarea></div>
          <div class="field">
            <label>사진 (선택, 1장)</label>
            <input type="file" id="post-image-input" accept="image/*" style="display:none;" onchange="window.__community.onPostImageSelected(event)" />
            <div id="post-image-preview-wrap" style="display:none; position:relative; margin-bottom:8px;">
              <img id="post-image-preview" alt="" style="width:100%; border-radius:10px; display:block;" />
              <button type="button" class="mini-btn danger" style="position:absolute; top:6px; right:6px;" onclick="window.__community.removePostImage()">✕ 제거</button>
            </div>
            <button type="button" class="mini-btn" id="post-image-pick-btn" onclick="document.getElementById('post-image-input').click()">📷 사진 추가</button>
          </div>
          <div class="form-actions">
            <button class="cancel-btn" onclick="window.__community.closePostForm()">취소</button>
            <button class="submit-btn" id="post-save-btn" onclick="window.__community.savePost()">등록하기</button>
          </div>
        </div>
        <div class="list" id="post-list"></div>
      </div>
      </div>

      <div id="detail-area" style="display:none;">
        <div style="padding:0 0 12px;">
          <button class="cancel-btn" onclick="window.__community.closePostDetail()">← 목록으로</button>
        </div>
        <div class="card">
          <div id="detail-post-card"></div>
          <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
            <div style="font-size:13px; font-weight:700; color:var(--text-dim); margin-bottom:12px;">댓글</div>
            <div class="list" id="comment-list" style="margin-bottom:14px;"></div>
            <div id="comment-form-member" style="display:none;">
              <div class="field" style="margin-bottom:8px;"><textarea id="comment-input" placeholder="댓글을 입력해주세요" style="min-height:60px;"></textarea></div>
              <div style="display:flex; gap:8px; align-items:center;">
                <button class="submit-btn" id="comment-save-btn" onclick="window.__community.addComment()" style="flex:1;">댓글 등록</button>
                <button class="post-del" id="comment-cancel-edit-btn" onclick="window.__community.cancelCommentEdit()" style="display:none;">취소</button>
              </div>
            </div>
            <div id="comment-form-guest" style="display:none;">
              <button class="new-btn" onclick="location.href='/tools/index.html?login=1';">로그인하고 댓글 남기기</button>
            </div>
          </div>
        </div>
      </div>

      <div id="reports-area" style="display:none;">
        <div style="padding:0 0 12px;"><button class="cancel-btn" onclick="window.__community.hideReportsArea()">← 목록으로</button></div>
        <div class="card">
          <div style="font-size:13px; font-weight:700; color:var(--text-dim); margin-bottom:12px;">🚩 신고 관리</div>
          <div id="reports-list"></div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const colToolsUsers = db.collection('tools_users');
const colJobs = db.collection('community_jobs');
const colPosts = db.collection('community_posts');
const colSeekers = db.collection('community_seekers');
const colComments = db.collection('community_comments');
const colViews = db.collection('community_views');
const colAnnouncement = db.collection('community_announcements');
const colReports = db.collection('community_reports');
const storage = firebase.storage();

const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도',
  '경상남도', '제주특별자치도',
];
const STAY_LABEL = { yes: '숙소제공', no: '숙소미제공', negotiable: '숙소협의' };
const MEAL_LABEL = { free: '숙식비 무료', partial: '숙식비 일부 부담', cash: '숙식비 현금 지급' };
const STAY_NEED_LABEL = { needed: '숙소필요', not_needed: '숙소불필요', negotiable: '숙소협의' };
const REPORT_TARGET_LABEL = { job: '구인', seeker: '구직', post: '자유게시판' };

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function linkify(escapedText) {
  return escapedText.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    let trail = '';
    const m = url.match(/[.,!?)\]]+$/);
    if (m) { trail = m[0]; url = url.slice(0, url.length - trail.length); }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`;
  });
}
function displayName(profile) { return profile.nickname || profile.name || profile.username || '이름없음'; }

export function mount(container) {
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
  }
  container.innerHTML = TEMPLATE;

  const $ = (id) => document.getElementById(id);

  let myUid = null;
  let myName = '';
  let myIsAdmin = false;
  let myIsOperator = false;
  let announcement = null;
  let announcementUnsub = null;

  let jobs = [];
  let jobsUnsub = null;
  let editingJobId = null;

  let seekers = [];
  let seekersUnsub = null;
  let editingSeekerId = null;

  let posts = [];
  let postsUnsub = null;
  let editingPostId = null;
  let selectedImageBlob = null;
  let existingImageUrl = null;
  let removeExistingImage = false;

  let currentTab = 'jobs';
  let searchQuery = '';
  let jobFilter = { workType: '', sido: '', stay: '', status: '', wageMin: null };
  let seekerFilter = { workType: '', region: '', stay: '', status: '' };
  let postFilter = { category: '' };

  let allCommentsUnsub = null;
  let commentCounts = {};

  let currentDetailId = null;
  let currentDetailType = null;
  let comments = [];
  let commentsUnsub = null;
  let editingCommentId = null;

  let reports = [];
  let reportsUnsub = null;
  let reportTarget = null;

  function go(viewId) {
    container.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = $(viewId);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
  }

  function showDetailArea() {
    $('list-area').style.display = 'none';
    $('reports-area').style.display = 'none';
    $('detail-area').style.display = 'block';
    window.scrollTo(0, 0);
  }
  function hideDetailArea() {
    $('detail-area').style.display = 'none';
    $('list-area').style.display = 'block';
    window.scrollTo(0, 0);
  }
  function showReportsArea() {
    $('list-area').style.display = 'none';
    $('detail-area').style.display = 'none';
    $('reports-area').style.display = 'block';
    window.scrollTo(0, 0);
  }
  function hideReportsArea() {
    $('reports-area').style.display = 'none';
    $('list-area').style.display = 'block';
    window.scrollTo(0, 0);
  }
  function openReportsView() {
    if (currentDetailId) closePostDetail();
    renderReports();
    showReportsArea();
  }
  function jumpToReportedItem(type, id) {
    hideReportsArea();
    if (type === 'job') openJobDetail(id);
    else if (type === 'seeker') openSeekerDetail(id);
    else openPostDetail(id);
  }

  function switchTab(name) {
    if (currentDetailId) closePostDetail();
    currentTab = name;
    $('tab-jobs').classList.toggle('active', name === 'jobs');
    $('tab-seekers').classList.toggle('active', name === 'seekers');
    $('tab-free').classList.toggle('active', name === 'free');
    $('panel-jobs').classList.toggle('active', name === 'jobs');
    $('panel-seekers').classList.toggle('active', name === 'seekers');
    $('panel-free').classList.toggle('active', name === 'free');
    $('filter-jobs').style.display = name === 'jobs' ? 'flex' : 'none';
    $('filter-seekers').style.display = name === 'seekers' ? 'flex' : 'none';
    $('filter-free').style.display = name === 'free' ? 'flex' : 'none';
  }

  function toggleFilterPanel() {
    const panel = $('filter-panel');
    const btn = $('filter-toggle-btn');
    const show = panel.style.display === 'none';
    panel.style.display = show ? 'block' : 'none';
    btn.classList.toggle('active', show);
  }

  function onSearchInput() {
    if (currentDetailId) closePostDetail();
    searchQuery = $('search-input').value.trim().toLowerCase();
    renderJobs(); renderSeekers(); renderPosts();
  }
  function onJobFilterChange() {
    const wageMinRaw = $('filter-job-wage-min').value;
    jobFilter = {
      workType: $('filter-job-worktype').value, sido: $('filter-job-sido').value,
      stay: $('filter-job-stay').value, status: $('filter-job-status').value,
      wageMin: wageMinRaw === '' ? null : parseInt(wageMinRaw, 10),
    };
    renderJobs();
  }
  function onSeekerFilterChange() {
    seekerFilter = {
      workType: $('filter-seeker-worktype').value, region: $('filter-seeker-region').value,
      stay: $('filter-seeker-stay').value, status: $('filter-seeker-status').value,
    };
    renderSeekers();
  }
  function onPostFilterChange() { postFilter = { category: $('filter-post-category').value }; renderPosts(); }

  function resetFilters() {
    if (currentTab === 'jobs') {
      jobFilter = { workType: '', sido: '', stay: '', status: '', wageMin: null };
      container.querySelectorAll('#filter-jobs select').forEach((s) => { s.value = ''; });
      container.querySelectorAll('#filter-jobs input').forEach((i) => { i.value = ''; });
      renderJobs();
    } else if (currentTab === 'seekers') {
      seekerFilter = { workType: '', region: '', stay: '', status: '' };
      container.querySelectorAll('#filter-seekers select').forEach((s) => { s.value = ''; });
      renderSeekers();
    } else {
      postFilter = { category: '' };
      container.querySelectorAll('#filter-free select').forEach((s) => { s.value = ''; });
      renderPosts();
    }
  }

  function matchesJobFilter(j) {
    if (jobFilter.workType && j.workType !== jobFilter.workType) return false;
    if (jobFilter.sido && j.regionSido !== jobFilter.sido) return false;
    if (jobFilter.stay && j.stay !== jobFilter.stay) return false;
    if (jobFilter.status && j.status !== jobFilter.status) return false;
    if (jobFilter.wageMin != null) {
      if (j.wageNegotiable || j.wage == null) return false;
      if (j.wage < jobFilter.wageMin) return false;
    }
    return true;
  }
  function matchesSeekerFilter(s) {
    if (seekerFilter.workType && s.workType !== seekerFilter.workType) return false;
    if (seekerFilter.region && s.region !== seekerFilter.region) return false;
    if (seekerFilter.stay && s.stay !== seekerFilter.stay) return false;
    if (seekerFilter.status && s.status !== seekerFilter.status) return false;
    return true;
  }
  function matchesPostFilter(p) { return !(postFilter.category && p.category !== postFilter.category); }

  function logout() { auth.signOut().then(() => { location.href = '/tools/index.html'; }); }
  function openMenu() { $('menu-overlay').classList.add('show'); }
  function closeMenu() { $('menu-overlay').classList.remove('show'); }

  function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  }
  function matchesSearch(item, fields) {
    if (!searchQuery) return true;
    return fields.some((f) => (item[f] || '').toString().toLowerCase().includes(searchQuery));
  }

  // ── 구인 게시판 ──
  function initSidoSelect() {
    const sel = $('job-sido');
    sel.innerHTML = SIDO_LIST.map((s) => `<option value="${s}">${s}</option>`).join('');
    const filterSel = $('filter-job-sido');
    filterSel.innerHTML = '<option value="">지역 전체</option>' + SIDO_LIST.map((s) => `<option value="${s}">${s}</option>`).join('');
  }
  function togglePeriodInputs() {
    const negotiable = $('job-period-negotiable').checked;
    $('job-period-dates').style.display = negotiable ? 'none' : 'flex';
  }
  function toggleStayDetail() {
    const stay = $('job-stay').value;
    $('job-stay-detail').style.display = stay === 'yes' ? 'block' : 'none';
  }
  function toggleWageInput() {
    const negotiable = $('job-wage-negotiable').checked;
    $('job-wage').style.display = negotiable ? 'none' : 'block';
  }
  function resetJobForm() {
    $('job-title').value = ''; $('job-site').value = ''; $('job-sigungu').value = '';
    $('job-headcount').value = ''; $('job-period-negotiable').checked = false;
    $('job-period-start').value = ''; $('job-period-end').value = '';
    $('job-stay').value = 'yes'; $('job-stay-type').value = '';
    $('job-wage-negotiable').checked = false; $('job-wage').value = '';
    $('job-desc').value = ''; $('job-contact-value').value = '';
    togglePeriodInputs(); toggleStayDetail(); toggleWageInput();
  }
  function openJobForm() {
    resetJobForm(); editingJobId = null;
    $('job-save-btn').textContent = '등록하기';
    $('job-form').style.display = 'block'; $('job-new-btn').style.display = 'none';
  }
  function closeJobForm() {
    $('job-form').style.display = 'none';
    $('job-new-btn').style.display = myIsAdmin ? 'block' : 'none';
    editingJobId = null;
  }
  function editJob(id) {
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    if (currentDetailId) closePostDetail();
    resetJobForm();
    $('job-title').value = j.title || ''; $('job-site').value = j.siteName;
    $('job-sido').value = j.regionSido; $('job-sigungu').value = j.regionSigungu;
    $('job-worktype').value = j.workType; $('job-headcount').value = j.headcount;
    $('job-period-negotiable').checked = j.periodType === 'negotiable';
    $('job-period-start').value = j.periodStart || ''; $('job-period-end').value = j.periodEnd || '';
    $('job-stay').value = j.stay; $('job-stay-type').value = j.stayType || '';
    $('job-meal-cost').value = j.mealCost || 'free';
    $('job-wage-negotiable').checked = j.wageNegotiable; $('job-wage').value = j.wage || '';
    $('job-desc').value = j.description; $('job-contact-method').value = j.contactMethod;
    $('job-contact-value').value = j.contactValue;
    togglePeriodInputs(); toggleStayDetail(); toggleWageInput();
    editingJobId = id;
    $('job-save-btn').textContent = '수정하기';
    $('job-form').style.display = 'block'; $('job-new-btn').style.display = 'none';
    go('view-app'); switchTab('jobs'); window.scrollTo(0, 0);
  }
  function saveJob() {
    const title = $('job-title').value.trim();
    const siteName = $('job-site').value.trim();
    const sigungu = $('job-sigungu').value.trim();
    const headcount = parseInt($('job-headcount').value, 10);
    const description = $('job-desc').value.trim();
    const contactValue = $('job-contact-value').value.trim();
    if (!title) { alert('제목을 입력해주세요!'); return; }
    if (!siteName) { alert('현장명을 입력해주세요!'); return; }
    if (!sigungu) { alert('시/군/구를 입력해주세요!'); return; }
    if (!headcount || headcount < 1) { alert('모집인원을 입력해주세요!'); return; }
    if (!description) { alert('세부작업 내용을 입력해주세요!'); return; }
    if (!contactValue) { alert('연락처를 입력해주세요!'); return; }
    const periodNegotiable = $('job-period-negotiable').checked;
    const wageNegotiable = $('job-wage-negotiable').checked;
    const stay = $('job-stay').value;
    const fields = {
      title, siteName, regionSido: $('job-sido').value, regionSigungu: sigungu,
      workType: $('job-worktype').value, headcount,
      periodType: periodNegotiable ? 'negotiable' : 'dates',
      periodStart: periodNegotiable ? null : ($('job-period-start').value || null),
      periodEnd: periodNegotiable ? null : ($('job-period-end').value || null),
      stay, stayType: stay === 'yes' ? $('job-stay-type').value.trim() : '',
      mealCost: stay === 'yes' ? $('job-meal-cost').value : '',
      wageNegotiable, wage: wageNegotiable ? null : (parseInt($('job-wage').value, 10) || null),
      description, contactMethod: $('job-contact-method').value, contactValue,
    };
    const btn = $('job-save-btn');
    btn.disabled = true;
    if (editingJobId) {
      colJobs.doc(editingJobId).update(fields)
        .then(() => { closeJobForm(); })
        .catch(() => alert('수정 실패. 인터넷 연결을 확인해주세요.'))
        .finally(() => { btn.disabled = false; });
    } else {
      colJobs.add({ ...fields, status: 'open', views: 0, authorUid: myUid, authorName: myName, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => { closeJobForm(); })
        .catch(() => alert('등록 실패. 인터넷 연결을 확인해주세요.'))
        .finally(() => { btn.disabled = false; });
    }
  }
  function toggleJobStatus(id, current) {
    colJobs.doc(id).update({ status: current === 'open' ? 'closed' : 'open' }).catch(() => alert('처리 실패. 다시 시도해주세요.'));
  }
  function deleteJob(id) {
    if (!confirm('이 구인글을 삭제할까요?')) return;
    colJobs.doc(id).delete().then(() => { if (currentDetailId === id) closePostDetail(); }).catch(() => alert('삭제 실패. 다시 시도해주세요.'));
  }
  function renderJobs() {
    const list = $('job-list');
    if (!jobs.length) { list.innerHTML = '<div class="card"><div class="empty-state"><span class="empty-icon">🧑‍🔧</span>아직 등록된 구인 글이 없어요</div></div>'; return; }
    const filtered = jobs.filter((j) => matchesSearch(j, ['siteName', 'regionSido', 'regionSigungu', 'workType', 'title', 'description']) && matchesJobFilter(j));
    if (!filtered.length) { list.innerHTML = '<div class="card"><div class="empty-state"><span class="empty-icon">🔍</span>검색 결과가 없어요</div></div>'; return; }
    list.innerHTML = filtered.map((j) => {
      const stayBadge = `<span class="badge stay-${j.stay}">${STAY_LABEL[j.stay] || ''}</span>`;
      const closedBadge = j.status === 'closed' ? '<span class="badge closed">마감</span>' : '';
      const period = j.periodType === 'negotiable' ? '협의' : `${j.periodStart || '미정'} ~ ${j.periodEnd || '미정'}`;
      const wage = j.wageNegotiable ? '협의' : (j.wage ? `${j.wage.toLocaleString()}원` : '협의');
      const commentCount = commentCounts[j.id] || 0;
      const adminActions = myIsAdmin ? `
        <div class="admin-actions" onclick="event.stopPropagation()">
          <button class="mini-btn" onclick="window.__community.editJob('${j.id}')">수정</button>
          <button class="mini-btn" onclick="window.__community.toggleJobStatus('${j.id}','${j.status}')">${j.status === 'open' ? '마감 처리' : '모집 재개'}</button>
          <button class="mini-btn danger" onclick="window.__community.deleteJob('${j.id}')">삭제</button>
        </div>` : '';
      return `
        <div class="job-card ${j.status === 'closed' ? 'is-closed' : ''}" style="cursor:pointer;" onclick="window.__community.openJobDetail('${j.id}')">
          <div class="job-card-top">
            <div>
              <div class="job-site">${escapeHtml(j.title || j.siteName)}</div>
              <div class="job-region">${escapeHtml(j.regionSido)} ${escapeHtml(j.regionSigungu)} · ${escapeHtml(j.workType)}</div>
            </div>
            <div style="display:flex;gap:4px;">${closedBadge}${stayBadge}</div>
          </div>
          <div class="job-meta">모집 <b>${j.headcount}명</b> · 기간 <b>${escapeHtml(period)}</b> · ${formatDate(j.createdAt)}</div>
          <div class="job-card-foot">
            <span class="job-wage">${escapeHtml(wage)}</span>
            <span class="card-counts">💬 ${commentCount} · 👁 ${j.views || 0}</span>
          </div>
          ${adminActions}
        </div>`;
    }).join('');
  }
  function startJobsFeed() {
    if (jobsUnsub) return;
    jobsUnsub = colJobs.orderBy('createdAt', 'desc').onSnapshot((snap) => {
      jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderJobs();
      if (currentDetailType === 'job' && currentDetailId) {
        const j = jobs.find((x) => x.id === currentDetailId);
        if (j) renderJobDetail(j);
      }
    }, () => { $('job-list').innerHTML = '<div class="card"><div class="empty-state">⚠️ 연결 오류. 새로고침 해주세요.</div></div>'; });
  }

  // ── 구직 게시판 ──
  function initSeekerRegionSelect() {
    const sel = $('seeker-region');
    sel.innerHTML = ['전국 가능', ...SIDO_LIST].map((s) => `<option value="${s}">${s}</option>`).join('');
    const filterSel = $('filter-seeker-region');
    filterSel.innerHTML = '<option value="">지역 전체</option>' + ['전국 가능', ...SIDO_LIST].map((s) => `<option value="${s}">${s}</option>`).join('');
  }
  function resetSeekerForm() {
    $('seeker-title').value = ''; $('seeker-career').value = ''; $('seeker-stay').value = 'needed';
    $('seeker-intro').value = ''; $('seeker-contact-value').value = '';
  }
  function openSeekerForm() {
    resetSeekerForm(); editingSeekerId = null;
    $('seeker-save-btn').textContent = '등록하기';
    $('seeker-form').style.display = 'block'; $('seeker-new-btn').style.display = 'none';
  }
  function closeSeekerForm() {
    $('seeker-form').style.display = 'none';
    $('seeker-new-btn').style.display = myUid ? 'block' : 'none';
    editingSeekerId = null;
  }
  function editSeeker(id) {
    const s = seekers.find((x) => x.id === id);
    if (!s) return;
    if (currentDetailId) closePostDetail();
    resetSeekerForm();
    $('seeker-title').value = s.title || ''; $('seeker-worktype').value = s.workType;
    $('seeker-career').value = s.career; $('seeker-region').value = s.region;
    $('seeker-stay').value = s.stay; $('seeker-intro').value = s.intro;
    $('seeker-contact-method').value = s.contactMethod; $('seeker-contact-value').value = s.contactValue;
    editingSeekerId = id;
    $('seeker-save-btn').textContent = '수정하기';
    $('seeker-form').style.display = 'block'; $('seeker-new-btn').style.display = 'none';
    go('view-app'); switchTab('seekers'); window.scrollTo(0, 0);
  }
  function saveSeeker() {
    const title = $('seeker-title').value.trim();
    const career = $('seeker-career').value.trim();
    const intro = $('seeker-intro').value.trim();
    const contactValue = $('seeker-contact-value').value.trim();
    if (!title) { alert('제목을 입력해주세요!'); return; }
    if (!career) { alert('경력을 입력해주세요!'); return; }
    if (!intro) { alert('자기소개를 입력해주세요!'); return; }
    if (!contactValue) { alert('연락처를 입력해주세요!'); return; }
    const fields = {
      title, workType: $('seeker-worktype').value, career, region: $('seeker-region').value,
      stay: $('seeker-stay').value, intro, contactMethod: $('seeker-contact-method').value, contactValue,
    };
    const btn = $('seeker-save-btn');
    btn.disabled = true;
    if (editingSeekerId) {
      colSeekers.doc(editingSeekerId).update(fields)
        .then(() => { closeSeekerForm(); })
        .catch(() => alert('수정 실패. 인터넷 연결을 확인해주세요.'))
        .finally(() => { btn.disabled = false; });
    } else {
      colSeekers.add({ ...fields, status: 'available', views: 0, authorUid: myUid, authorName: myName, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(() => { closeSeekerForm(); })
        .catch(() => alert('등록 실패. 인터넷 연결을 확인해주세요.'))
        .finally(() => { btn.disabled = false; });
    }
  }
  function toggleSeekerStatus(id, current) {
    colSeekers.doc(id).update({ status: current === 'available' ? 'matched' : 'available' }).catch(() => alert('처리 실패. 다시 시도해주세요.'));
  }
  function deleteSeeker(id) {
    if (!confirm('이 구직 글을 삭제할까요?')) return;
    colSeekers.doc(id).delete().then(() => { if (currentDetailId === id) closePostDetail(); }).catch(() => alert('삭제 실패. 다시 시도해주세요.'));
  }
  function renderSeekers() {
    const list = $('seeker-list');
    if (!seekers.length) { list.innerHTML = '<div class="card"><div class="empty-state"><span class="empty-icon">🙋</span>아직 등록된 구직 글이 없어요</div></div>'; return; }
    const filtered = seekers.filter((s) => matchesSearch(s, ['workType', 'region', 'intro', 'title']) && matchesSeekerFilter(s));
    if (!filtered.length) { list.innerHTML = '<div class="card"><div class="empty-state"><span class="empty-icon">🔍</span>검색 결과가 없어요</div></div>'; return; }
    list.innerHTML = filtered.map((s) => {
      const stayKey = s.stay === 'needed' ? 'yes' : (s.stay === 'not_needed' ? 'no' : 'negotiable');
      const stayBadge = `<span class="badge stay-${stayKey}">${STAY_NEED_LABEL[s.stay] || ''}</span>`;
      const matchedBadge = s.status === 'matched' ? '<span class="badge closed">구직완료</span>' : '';
      const commentCount = commentCounts[s.id] || 0;
      const canManage = myIsAdmin || s.authorUid === myUid;
      const actions = canManage ? `
        <div class="admin-actions" onclick="event.stopPropagation()">
          <button class="mini-btn" onclick="window.__community.editSeeker('${s.id}')">수정</button>
          <button class="mini-btn" onclick="window.__community.toggleSeekerStatus('${s.id}','${s.status}')">${s.status === 'available' ? '구직완료 처리' : '구직중으로 전환'}</button>
          <button class="mini-btn danger" onclick="window.__community.deleteSeeker('${s.id}')">삭제</button>
        </div>` : '';
      return `
        <div class="job-card ${s.status === 'matched' ? 'is-closed' : ''}" style="cursor:pointer;" onclick="window.__community.openSeekerDetail('${s.id}')">
          <div class="job-card-top">
            <div>
              <div class="job-site">${escapeHtml(s.title || s.authorName)}</div>
              <div class="job-region">${escapeHtml(s.region)} · ${escapeHtml(s.workType)}</div>
            </div>
            <div style="display:flex;gap:4px;">${matchedBadge}${stayBadge}</div>
          </div>
          <div class="job-meta">경력 <b>${escapeHtml(s.career)}</b> · ${formatDate(s.createdAt)}</div>
          <div class="job-card-foot">
            <span class="job-contact">${escapeHtml(s.authorName)}</span>
            <span class="card-counts">💬 ${commentCount} · 👁 ${s.views || 0}</span>
          </div>
          ${actions}
        </div>`;
    }).join('');
  }
  function startSeekersFeed() {
    if (seekersUnsub) return;
    seekersUnsub = colSeekers.orderBy('createdAt', 'desc').onSnapshot((snap) => {
      seekers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderSeekers();
      if (currentDetailType === 'seeker' && currentDetailId) {
        const s = seekers.find((x) => x.id === currentDetailId);
        if (s) renderSeekerDetail(s);
      }
    }, () => { $('seeker-list').innerHTML = '<div class="card"><div class="empty-state">⚠️ 연결 오류. 새로고침 해주세요.</div></div>'; });
  }

  // ── 자유게시판 ──
  function resetPostForm() {
    $('post-title').value = ''; $('post-category').value = '현장후기'; $('post-content').value = '';
    resetPostImageState();
  }
  function resetPostImageState() {
    selectedImageBlob = null; existingImageUrl = null; removeExistingImage = false;
    $('post-image-preview-wrap').style.display = 'none';
    $('post-image-preview').src = '';
    $('post-image-pick-btn').textContent = '📷 사진 추가';
  }
  function resizeImageFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxW = 1280;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
      img.src = url;
    });
  }
  function onPostImageSelected(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 첨부할 수 있어요.'); return; }
    resizeImageFile(file).then((blob) => {
      selectedImageBlob = blob; removeExistingImage = false;
      $('post-image-preview').src = URL.createObjectURL(blob);
      $('post-image-preview-wrap').style.display = 'block';
      $('post-image-pick-btn').textContent = '📷 사진 변경';
    }).catch(() => alert('이미지를 처리하지 못했어요. 다른 사진으로 시도해주세요.'));
  }
  function removePostImage() {
    selectedImageBlob = null; removeExistingImage = true;
    $('post-image-preview-wrap').style.display = 'none';
    $('post-image-preview').src = '';
    $('post-image-pick-btn').textContent = '📷 사진 추가';
  }
  function openPostForm() {
    resetPostForm(); editingPostId = null;
    $('post-save-btn').textContent = '등록하기';
    $('post-form').style.display = 'block'; $('post-new-btn').style.display = 'none';
  }
  function closePostForm() {
    $('post-form').style.display = 'none';
    $('post-new-btn').style.display = myUid ? 'block' : 'none';
    editingPostId = null;
  }
  function editPost(id) {
    const p = posts.find((x) => x.id === id);
    if (!p) return;
    if (currentDetailId) closePostDetail();
    $('post-title').value = p.title; $('post-category').value = p.category; $('post-content').value = p.content;
    resetPostImageState();
    if (p.imageUrl) {
      existingImageUrl = p.imageUrl;
      $('post-image-preview').src = p.imageUrl;
      $('post-image-preview-wrap').style.display = 'block';
      $('post-image-pick-btn').textContent = '📷 사진 변경';
    }
    editingPostId = id;
    $('post-save-btn').textContent = '수정하기';
    $('post-form').style.display = 'block'; $('post-new-btn').style.display = 'none';
    go('view-app'); switchTab('free'); window.scrollTo(0, 0);
  }
  function resolvePostImage() {
    if (selectedImageBlob) {
      const postId = editingPostId || colPosts.doc().id;
      const imgRef = storage.ref(`community_posts/${postId}/image.jpg`);
      return imgRef.put(selectedImageBlob, { contentType: 'image/jpeg' })
        .then(() => imgRef.getDownloadURL())
        .then((imageUrl) => ({ postId, imageUrl }));
    }
    if (removeExistingImage && editingPostId) {
      return storage.ref(`community_posts/${editingPostId}/image.jpg`).delete().catch(() => {})
        .then(() => ({ postId: editingPostId, imageUrl: null }));
    }
    return Promise.resolve({ postId: editingPostId, imageUrl: editingPostId ? existingImageUrl : null });
  }
  function savePost() {
    const title = $('post-title').value.trim();
    const content = $('post-content').value.trim();
    if (!title) { alert('제목을 입력해주세요!'); return; }
    if (!content) { alert('내용을 입력해주세요!'); return; }
    const btn = $('post-save-btn');
    btn.disabled = true;
    const category = $('post-category').value;
    const wasEditing = !!editingPostId;
    resolvePostImage().then(({ postId, imageUrl }) => {
      if (wasEditing) return colPosts.doc(postId).update({ title, category, content, imageUrl: imageUrl || null });
      return colPosts.doc(postId).set({
        title, category, content, imageUrl: imageUrl || null, views: 0,
        authorUid: myUid, authorName: myName, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    })
      .then(() => { closePostForm(); })
      .catch((err) => { console.error('[community] 게시글 저장 실패', err); alert((wasEditing ? '수정' : '등록') + ' 실패. 인터넷 연결을 확인해주세요.'); })
      .finally(() => { btn.disabled = false; });
  }
  function deletePost(id) {
    if (!confirm('이 글을 삭제할까요?')) return;
    const p = posts.find((x) => x.id === id);
    colPosts.doc(id).delete()
      .then(() => { closePostDetail(); if (p && p.imageUrl) storage.ref(`community_posts/${id}/image.jpg`).delete().catch(() => {}); })
      .catch(() => alert('삭제 실패. 다시 시도해주세요.'));
  }
  function renderPosts() {
    const list = $('post-list');
    if (!posts.length) { list.innerHTML = '<div class="card"><div class="empty-state"><span class="empty-icon">💬</span>아직 게시물이 없어요</div></div>'; return; }
    const filtered = posts.filter((p) => matchesSearch(p, ['title', 'content']) && matchesPostFilter(p));
    if (!filtered.length) { list.innerHTML = '<div class="card"><div class="empty-state"><span class="empty-icon">🔍</span>검색 결과가 없어요</div></div>'; return; }
    list.innerHTML = filtered.map((p) => {
      const commentCount = commentCounts[p.id] || 0;
      return `
        <div class="post-card" style="cursor:pointer;" onclick="window.__community.openPostDetail('${p.id}')">
          <div class="post-card-top">
            <span class="post-cat">${escapeHtml(p.category)}</span>
            <span class="card-counts">💬 ${commentCount} · 👁 ${p.views || 0}</span>
          </div>
          <div class="post-title">${escapeHtml(p.title)}${p.imageUrl ? ' 📷' : ''}</div>
          <div class="post-meta">${escapeHtml(p.authorName)} · ${formatDate(p.createdAt)}</div>
        </div>`;
    }).join('');
  }

  // ── 상세 + 댓글 ──
  function getViewIdentity() {
    if (myUid) return myUid;
    let gid = localStorage.getItem('feederGuestId');
    if (!gid) { gid = 'g_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('feederGuestId', gid); }
    return gid;
  }
  function incrementViewsOnce(colRef, type, id) {
    const identity = getViewIdentity();
    const viewId = `${type}_${id}_${identity}`;
    colViews.doc(viewId).set({ postId: id, identity })
      .then(() => { colRef.doc(id).update({ views: firebase.firestore.FieldValue.increment(1) }).catch(() => {}); })
      .catch(() => {});
  }
  function openPostDetail(id) {
    const p = posts.find((x) => x.id === id);
    if (!p) return;
    currentDetailId = id; currentDetailType = 'post';
    renderPostDetail(p); startCommentsFeed(id); incrementViewsOnce(colPosts, 'post', id);
    showDetailArea();
  }
  function openJobDetail(id) {
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    currentDetailId = id; currentDetailType = 'job';
    renderJobDetail(j); startCommentsFeed(id); incrementViewsOnce(colJobs, 'job', id);
    showDetailArea();
  }
  function openSeekerDetail(id) {
    const s = seekers.find((x) => x.id === id);
    if (!s) return;
    currentDetailId = id; currentDetailType = 'seeker';
    renderSeekerDetail(s); startCommentsFeed(id); incrementViewsOnce(colSeekers, 'seeker', id);
    showDetailArea();
  }
  // 원본은 history.pushState + popstate로 "뒤로가기=상세 닫기"를 구현했는데,
  // 셸 라우터의 popstate 처리와 충돌해서(파일 상단 설명) 이번 이관에선 버튼으로만 닫음
  function closePostDetail() {
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
    comments = []; currentDetailId = null; currentDetailType = null;
    hideDetailArea();
  }

  function renderPostDetail(p) {
    const canManage = myIsAdmin || p.authorUid === myUid;
    const manageActions = canManage ? `
      <div class="admin-actions">
        <button class="mini-btn" onclick="window.__community.editPost('${p.id}')">수정</button>
        <button class="mini-btn danger" onclick="window.__community.deletePost('${p.id}')">삭제</button>
      </div>` : '';
    const reportAction = (myUid && !canManage) ? `
      <div class="admin-actions"><button class="mini-btn" onclick="window.__community.openReportModal('post','${p.id}')">🚩 신고</button></div>` : '';
    const imageHtml = p.imageUrl ? `<img src="${p.imageUrl}" alt="" style="width:100%; border-radius:10px; margin:10px 0; display:block;" loading="lazy">` : '';
    $('detail-post-card').innerHTML = `
      <span class="post-cat">${escapeHtml(p.category)}</span>
      <div class="post-title" style="font-size:17px; margin-top:10px;">${escapeHtml(p.title)}</div>
      <div class="post-meta" style="margin-bottom:12px;">${escapeHtml(p.authorName)} · ${formatDate(p.createdAt)} · 👁 ${p.views || 0}</div>
      ${imageHtml}
      <div class="post-content">${linkify(escapeHtml(p.content))}</div>
      ${manageActions}${reportAction}`;
  }
  function renderJobDetail(j) {
    const stayBadge = `<span class="badge stay-${j.stay}">${STAY_LABEL[j.stay] || ''}</span>`;
    const closedBadge = j.status === 'closed' ? '<span class="badge closed">마감</span>' : '';
    const period = j.periodType === 'negotiable' ? '협의' : `${j.periodStart || '미정'} ~ ${j.periodEnd || '미정'}`;
    const wage = j.wageNegotiable ? '협의' : (j.wage ? `${j.wage.toLocaleString()}원` : '협의');
    const stayDetail = j.stay === 'yes' && (j.stayType || j.mealCost)
      ? `<div class="job-meta">${escapeHtml(j.stayType || '')}${j.stayType && j.mealCost ? ' · ' : ''}${MEAL_LABEL[j.mealCost] || ''}</div>` : '';
    const contactLabel = j.contactMethod === 'kakao' ? '카톡' : '전화';
    const manageActions = myIsAdmin ? `
      <div class="admin-actions">
        <button class="mini-btn" onclick="window.__community.editJob('${j.id}')">수정</button>
        <button class="mini-btn" onclick="window.__community.toggleJobStatus('${j.id}','${j.status}')">${j.status === 'open' ? '마감 처리' : '모집 재개'}</button>
        <button class="mini-btn danger" onclick="window.__community.deleteJob('${j.id}')">삭제</button>
      </div>` : '';
    const reportAction = (myUid && !myIsAdmin) ? `
      <div class="admin-actions"><button class="mini-btn" onclick="window.__community.openReportModal('job','${j.id}')">🚩 신고</button></div>` : '';
    $('detail-post-card').innerHTML = `
      <div class="job-card-top">
        <div>
          <div class="job-site" style="font-size:17px;">${escapeHtml(j.title || j.siteName)}</div>
          <div class="job-region">${escapeHtml(j.siteName)} · ${escapeHtml(j.regionSido)} ${escapeHtml(j.regionSigungu)} · ${escapeHtml(j.workType)}</div>
        </div>
        <div style="display:flex;gap:4px;">${closedBadge}${stayBadge}</div>
      </div>
      <div class="job-meta">모집 <b>${j.headcount}명</b> · 기간 <b>${escapeHtml(period)}</b> · ${formatDate(j.createdAt)} · 👁 ${j.views || 0}</div>
      ${stayDetail}
      <div class="job-desc">${linkify(escapeHtml(j.description))}</div>
      <div class="job-card-foot">
        <span class="job-wage">${escapeHtml(wage)}</span>
        <span class="job-contact">${contactLabel} · ${escapeHtml(j.contactValue)}</span>
      </div>
      ${manageActions}${reportAction}`;
  }
  function renderSeekerDetail(s) {
    const stayKey = s.stay === 'needed' ? 'yes' : (s.stay === 'not_needed' ? 'no' : 'negotiable');
    const stayBadge = `<span class="badge stay-${stayKey}">${STAY_NEED_LABEL[s.stay] || ''}</span>`;
    const matchedBadge = s.status === 'matched' ? '<span class="badge closed">구직완료</span>' : '';
    const contactLabel = s.contactMethod === 'kakao' ? '카톡' : '전화';
    const canManage = myIsAdmin || s.authorUid === myUid;
    const manageActions = canManage ? `
      <div class="admin-actions">
        <button class="mini-btn" onclick="window.__community.editSeeker('${s.id}')">수정</button>
        <button class="mini-btn" onclick="window.__community.toggleSeekerStatus('${s.id}','${s.status}')">${s.status === 'available' ? '구직완료 처리' : '구직중으로 전환'}</button>
        <button class="mini-btn danger" onclick="window.__community.deleteSeeker('${s.id}')">삭제</button>
      </div>` : '';
    const reportAction = (myUid && !canManage) ? `
      <div class="admin-actions"><button class="mini-btn" onclick="window.__community.openReportModal('seeker','${s.id}')">🚩 신고</button></div>` : '';
    $('detail-post-card').innerHTML = `
      <div class="job-card-top">
        <div>
          <div class="job-site" style="font-size:17px;">${escapeHtml(s.title || s.authorName)}</div>
          <div class="job-region">${escapeHtml(s.authorName)} · ${escapeHtml(s.region)} · ${escapeHtml(s.workType)}</div>
        </div>
        <div style="display:flex;gap:4px;">${matchedBadge}${stayBadge}</div>
      </div>
      <div class="job-meta">경력 <b>${escapeHtml(s.career)}</b> · ${formatDate(s.createdAt)} · 👁 ${s.views || 0}</div>
      <div class="job-desc">${linkify(escapeHtml(s.intro))}</div>
      <div class="job-card-foot"><span class="job-contact">${contactLabel} · ${escapeHtml(s.contactValue)}</span></div>
      ${manageActions}${reportAction}`;
  }
  function renderComments() {
    const list = $('comment-list');
    if (!comments.length) { list.innerHTML = '<div class="empty-state" style="padding:16px 0;">아직 댓글이 없어요</div>'; return; }
    list.innerHTML = comments.map((c) => {
      const canManage = myIsAdmin || c.authorUid === myUid;
      return `
        <div class="post-card" style="padding:10px 12px;">
          <div class="post-card-top" style="margin-bottom:2px;">
            <span style="font-size:12.5px; font-weight:700;">${escapeHtml(c.authorName)}</span>
            ${canManage ? `<span style="display:flex; gap:8px;">
              <button class="post-del" onclick="window.__community.editComment('${c.id}')">수정</button>
              <button class="post-del" onclick="window.__community.deleteComment('${c.id}')">삭제</button>
            </span>` : ''}
          </div>
          <div class="post-content" style="font-size:13px;">${linkify(escapeHtml(c.content))}</div>
          <div class="post-meta">${formatDate(c.createdAt)}</div>
        </div>`;
    }).join('');
  }
  function startCommentsFeed(postId) {
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
    comments = []; cancelCommentEdit(); renderComments();
    commentsUnsub = colComments.where('postId', '==', postId).orderBy('createdAt', 'asc').onSnapshot((snap) => {
      comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderComments();
    }, () => { $('comment-list').innerHTML = '<div class="empty-state">⚠️ 연결 오류. 새로고침 해주세요.</div>'; });
  }
  function addComment() {
    if (!myUid) { alert('로그인 후 댓글을 남길 수 있어요.'); return; }
    if (!currentDetailId) return;
    const input = $('comment-input');
    const content = input.value.trim();
    if (!content) { alert('댓글 내용을 입력해주세요!'); return; }
    const btn = $('comment-save-btn');
    btn.disabled = true;
    if (editingCommentId) {
      colComments.doc(editingCommentId).update({ content })
        .then(() => { cancelCommentEdit(); })
        .catch(() => alert('댓글 수정 실패. 인터넷 연결을 확인해주세요.'))
        .finally(() => { btn.disabled = false; });
      return;
    }
    colComments.add({ postId: currentDetailId, content, authorUid: myUid, authorName: myName, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
      .then(() => { input.value = ''; })
      .catch(() => alert('댓글 등록 실패. 인터넷 연결을 확인해주세요.'))
      .finally(() => { btn.disabled = false; });
  }
  function editComment(id) {
    const c = comments.find((x) => x.id === id);
    if (!c) return;
    editingCommentId = id;
    $('comment-input').value = c.content;
    $('comment-save-btn').textContent = '댓글 수정';
    $('comment-cancel-edit-btn').style.display = 'block';
    $('comment-input').focus();
  }
  function cancelCommentEdit() {
    editingCommentId = null;
    $('comment-input').value = '';
    $('comment-save-btn').textContent = '댓글 등록';
    $('comment-cancel-edit-btn').style.display = 'none';
  }
  function deleteComment(id) {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    colComments.doc(id).delete().then(() => { if (editingCommentId === id) cancelCommentEdit(); }).catch(() => alert('삭제 실패. 다시 시도해주세요.'));
  }
  function startAllCommentsFeed() {
    if (allCommentsUnsub) return;
    allCommentsUnsub = colComments.onSnapshot((snap) => {
      commentCounts = {};
      snap.docs.forEach((d) => { const postId = d.data().postId; commentCounts[postId] = (commentCounts[postId] || 0) + 1; });
      renderJobs(); renderSeekers(); renderPosts();
    });
  }
  function startPostsFeed() {
    if (postsUnsub) return;
    postsUnsub = colPosts.orderBy('createdAt', 'desc').onSnapshot((snap) => {
      posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderPosts();
    }, () => { $('post-list').innerHTML = '<div class="card"><div class="empty-state">⚠️ 연결 오류. 새로고침 해주세요.</div></div>'; });
  }

  // ── 공지사항 ──
  function startAnnouncementFeed() {
    if (announcementUnsub) return;
    announcementUnsub = colAnnouncement.doc('main').onSnapshot((doc) => {
      announcement = doc.exists ? doc.data() : null;
      renderAnnouncement();
    }, () => {});
  }
  function renderAnnouncement() {
    const banner = $('announcement-banner');
    const editBtn = $('announce-edit-btn');
    editBtn.style.display = myIsOperator ? '' : 'none';
    if (announcement && announcement.content) {
      $('announcement-text').textContent = announcement.content;
      banner.style.display = 'flex';
    } else { banner.style.display = 'none'; }
  }
  function openAnnouncementDetail(event) {
    if (event) event.stopPropagation();
    if (!announcement || !announcement.content) return;
    currentDetailId = 'announcement_main'; currentDetailType = 'announcement';
    renderAnnouncementDetail(); startCommentsFeed('announcement_main');
    showDetailArea();
  }
  function renderAnnouncementDetail() {
    const authorName = announcement.updatedByName || '운영자';
    $('detail-post-card').innerHTML = `
      <span class="post-cat">📢 공지</span>
      <div class="post-meta" style="margin-top:10px; margin-bottom:12px;">${escapeHtml(authorName)} · ${formatDate(announcement.updatedAt)}</div>
      <div class="post-content">${linkify(escapeHtml(announcement.content))}</div>`;
  }
  function openAnnounceForm() {
    $('announce-content').value = (announcement && announcement.content) || '';
    $('announce-clear-btn').style.display = (announcement && announcement.content) ? 'block' : 'none';
    $('announce-form').style.display = 'block';
    go('view-app'); window.scrollTo(0, 0);
  }
  function closeAnnounceForm() { $('announce-form').style.display = 'none'; }
  function saveAnnouncement() {
    const content = $('announce-content').value.trim();
    if (!content) { alert('공지 내용을 입력해주세요!'); return; }
    const btn = $('announce-save-btn');
    btn.disabled = true;
    colAnnouncement.doc('main').set({ content, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: myUid, updatedByName: myName })
      .then(() => { closeAnnounceForm(); })
      .catch(() => alert('저장 실패. 인터넷 연결을 확인해주세요.'))
      .finally(() => { btn.disabled = false; });
  }
  function clearAnnouncement() {
    if (!confirm('공지를 내릴까요?')) return;
    colAnnouncement.doc('main').delete().then(() => { closeAnnounceForm(); }).catch(() => alert('처리 실패. 다시 시도해주세요.'));
  }

  // ── 신고 ──
  function openReportModal(type, id) {
    if (!myUid) { alert('로그인 후 신고할 수 있어요.'); return; }
    let title = '';
    if (type === 'job') { const j = jobs.find((x) => x.id === id); title = j ? (j.title || j.siteName || '') : ''; }
    else if (type === 'seeker') { const s = seekers.find((x) => x.id === id); title = s ? (s.title || s.authorName || '') : ''; }
    else { const p = posts.find((x) => x.id === id); title = p ? (p.title || '') : ''; }
    reportTarget = { type, id, title };
    container.querySelectorAll('input[name="report-reason"]').forEach((r) => { r.checked = false; });
    $('report-detail-field').style.display = 'none';
    $('report-detail-input').value = '';
    $('report-submit-btn').disabled = true;
    $('report-overlay').classList.add('show');
  }
  function closeReportModal() { $('report-overlay').classList.remove('show'); reportTarget = null; }
  function onReportReasonChange() {
    const checked = container.querySelector('input[name="report-reason"]:checked');
    $('report-detail-field').style.display = (checked && checked.value === '기타') ? 'block' : 'none';
    $('report-submit-btn').disabled = !checked;
  }
  function submitReport() {
    if (!reportTarget || !myUid) return;
    const checked = container.querySelector('input[name="report-reason"]:checked');
    if (!checked) return;
    let reason = checked.value;
    if (reason === '기타') {
      const detail = $('report-detail-input').value.trim();
      if (!detail) { alert('상세 내용을 입력해주세요!'); return; }
      reason = detail;
    }
    const docId = `${reportTarget.type}_${reportTarget.id}_${myUid}`;
    const btn = $('report-submit-btn');
    btn.disabled = true;
    colReports.doc(docId).set({
      targetType: reportTarget.type, targetId: reportTarget.id, targetTitle: reportTarget.title || '',
      reason, reportedByUid: myUid, reportedByName: myName, status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).then(() => { closeReportModal(); alert('신고했어요. 확인 후 조치할게요.'); })
      .catch((err) => { if (err.code === 'permission-denied') alert('이미 신고한 게시글이에요.'); else alert('신고 실패. 다시 시도해주세요.'); })
      .finally(() => { btn.disabled = false; });
  }
  function resolveReport(id) { colReports.doc(id).update({ status: 'resolved' }).catch(() => alert('처리 실패. 다시 시도해주세요.')); }
  function renderReports() {
    const list = $('reports-list');
    if (!reports.length) { list.innerHTML = '<div class="empty-state">대기 중인 신고가 없어요</div>'; return; }
    list.innerHTML = reports.map((r) => `
      <div class="post-card" style="padding:10px 12px; margin-bottom:8px;">
        <div class="post-card-top" style="margin-bottom:2px;">
          <span style="font-size:12.5px; font-weight:700;">[${REPORT_TARGET_LABEL[r.targetType] || r.targetType}] ${escapeHtml(r.targetTitle || '(제목 없음)')}</span>
        </div>
        <div class="post-content" style="font-size:13px;">사유: ${escapeHtml(r.reason)}</div>
        <div class="post-meta">${escapeHtml(r.reportedByName || '')} 신고 · ${formatDate(r.createdAt)}</div>
        <div class="admin-actions">
          <button class="mini-btn" onclick="window.__community.jumpToReportedItem('${r.targetType}','${r.targetId}')">원글 보기</button>
          <button class="mini-btn" onclick="window.__community.resolveReport('${r.id}')">처리완료</button>
        </div>
      </div>`).join('');
  }
  function updateReportsBadge() {
    const badge = $('reports-badge');
    if (reports.length > 0) { badge.textContent = reports.length; badge.style.display = ''; }
    else { badge.style.display = 'none'; }
  }
  function startReportsFeed() {
    if (reportsUnsub) return;
    reportsUnsub = colReports.where('status', '==', 'pending').onSnapshot((snap) => {
      reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      reports.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
      renderReports(); updateReportsBadge();
    }, () => {});
  }
  function syncReportsFeed() {
    if (myIsAdmin) startReportsFeed();
    else { if (reportsUnsub) { reportsUnsub(); reportsUnsub = null; } reports = []; updateReportsBadge(); }
  }

  function updateMenuForAuth() {
    $('menu-user').style.display = myUid ? '' : 'none';
    $('menu-user-name').textContent = myName;
    $('menu-inquiry').style.display = myUid ? '' : 'none';
    $('menu-guest').style.display = myUid ? 'none' : '';
    $('menu-admin').style.display = myIsAdmin ? '' : 'none';
    $('menu-announce').style.display = myIsOperator ? '' : 'none';
    $('menu-reports').style.display = myIsAdmin ? '' : 'none';
    $('menu-logout').style.display = myUid ? '' : 'none';
    renderAnnouncement();
    syncReportsFeed();
    $('job-new-btn').style.display = myIsAdmin ? 'block' : 'none';
    $('seeker-new-btn').style.display = myUid ? 'block' : 'none';
    $('post-new-btn').style.display = myUid ? 'block' : 'none';
    $('comment-form-member').style.display = myUid ? 'block' : 'none';
    $('comment-form-guest').style.display = myUid ? 'none' : 'block';
  }

  function startFeeds() {
    startJobsFeed(); startSeekersFeed(); startPostsFeed(); startAllCommentsFeed(); startAnnouncementFeed();
  }

  initSidoSelect();
  initSeekerRegionSelect();
  togglePeriodInputs();
  toggleStayDetail();
  toggleWageInput();

  // 셸의 onProfile() 구독에 얹혀서 승인 여부만 확인 — 게스트도 열람은 전체 공개(원본 정책 그대로)
  const unsubProfile = onProfile((profile, user) => {
    if (!user || !profile || profile.status !== 'approved') {
      myUid = null; myName = ''; myIsAdmin = false; myIsOperator = false;
      updateMenuForAuth();
      startFeeds();
      go('view-app');
      return;
    }
    myUid = user.uid;
    myName = displayName(profile);
    myIsAdmin = !!profile.isAdmin;
    myIsOperator = !!profile.isOperator;
    updateMenuForAuth();
    startFeeds();
    go('view-app');
  });

  window.__community = {
    openMenu, closeMenu, logout, switchTab, onSearchInput, toggleFilterPanel,
    onJobFilterChange, onSeekerFilterChange, onPostFilterChange, resetFilters,
    openJobForm, closeJobForm, saveJob, editJob, toggleJobStatus, deleteJob,
    togglePeriodInputs, toggleStayDetail, toggleWageInput,
    openSeekerForm, closeSeekerForm, saveSeeker, editSeeker, toggleSeekerStatus, deleteSeeker,
    openPostForm, closePostForm, savePost, editPost, deletePost, onPostImageSelected, removePostImage,
    openPostDetail, openJobDetail, openSeekerDetail, closePostDetail,
    addComment, editComment, cancelCommentEdit, deleteComment,
    openAnnouncementDetail, openAnnounceForm, closeAnnounceForm, saveAnnouncement, clearAnnouncement,
    openReportModal, closeReportModal, onReportReasonChange, submitReport, resolveReport,
    openReportsView, hideReportsArea, jumpToReportedItem,
  };

  return function unmount() {
    unsubProfile();
    if (jobsUnsub) jobsUnsub();
    if (seekersUnsub) seekersUnsub();
    if (postsUnsub) postsUnsub();
    if (allCommentsUnsub) allCommentsUnsub();
    if (commentsUnsub) commentsUnsub();
    if (announcementUnsub) announcementUnsub();
    if (reportsUnsub) reportsUnsub();
    delete window.__community;
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    console.log('[community-view] unmounted — 구독/스타일 정리 완료');
  };
}
