// tools/admin-dashboard.html 이관. 운영자(isOperator) 전용 통계 대시보드.
// 다른 화면들과 달리 게이트가 "승인된 회원"이 아니라 "운영자"라서 onProfile() 콜백에서
// profile.isOperator를 직접 확인한다.

import { auth, db, onProfile } from '../firebase-shell.js?v=4';
import { navigate } from '../router.js?v=4';

const STYLE_ID = 'view-style-admin-dashboard';
const STYLE = `
:root {
  --orange: #FF6B2B; --orange-dark: #E05520;
  --steel: #1A1E2E; --steel-mid: #252A3D; --steel-light: #2E3450;
  --text: #F0F2FF; --text-dim: #8892B0; --give: #3BE88A; --loss: #FF6B6B;
  --border: rgba(255,255,255,0.08);
  --header-bg: rgba(26, 30, 46, 0.8);
}
:root[data-theme="light"] {
  --orange: #FF6B2B; --orange-dark: #E05520;
  --steel: #F4F3F0; --steel-mid: #FFFFFF; --steel-light: #F0EFEA;
  --text: #1C1E27; --text-dim: #767A85; --give: #1E8E56; --loss: #E0483A;
  --border: rgba(0,0,0,0.08);
  --header-bg: rgba(244, 243, 240, 0.8);
}
.admin-dash-root { font-family: 'Noto Sans KR', sans-serif; color: var(--text); }
.admin-dash-root .container { max-width: 560px; margin: 0 auto; }
.admin-dash-root .site-header { position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:var(--header-bg); border-bottom:1px solid var(--border); padding:0 20px; height:52px; display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.admin-dash-root .brand { font-size:15px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px; text-decoration:none; }
.admin-dash-root .hamburger-btn { width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:none; border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:17px; cursor:pointer; flex-shrink:0; }
.admin-dash-root .hamburger-btn:hover { border-color:var(--orange); color:var(--orange); }
.admin-dash-root .menu-overlay { display:none; position:fixed; inset:0; z-index:200; background:rgba(0,0,0,0.5); justify-content:flex-end; }
.admin-dash-root .menu-overlay.show { display:flex; }
.admin-dash-root .menu-sheet { width:78%; max-width:300px; height:100%; background:var(--steel-mid); border-left:1px solid var(--border); padding:20px 16px; display:flex; flex-direction:column; animation: admdash-menuSlideIn 0.22s cubic-bezier(0.2,0.9,0.3,1); }
@keyframes admdash-menuSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.admin-dash-root .menu-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding:0 2px; }
.admin-dash-root .menu-title { font-size:15px; font-weight:900; color:var(--text-dim); letter-spacing:0.5px; }
.admin-dash-root .menu-close { width:32px; height:32px; border-radius:8px; background:none; border:none; color:var(--text-dim); font-size:16px; cursor:pointer; }
.admin-dash-root .menu-close:hover { color:var(--orange); }
.admin-dash-root .menu-item { display:flex; align-items:center; gap:12px; padding:14px 10px; border-radius:12px; background:none; border:none; color:var(--text); font-family:inherit; font-size:15px; font-weight:700; text-align:left; cursor:pointer; width:100%; }
.admin-dash-root .menu-item:hover { background:var(--steel-light); }
.admin-dash-root .menu-item-icon { font-size:17px; width:22px; text-align:center; flex-shrink:0; }
.admin-dash-root .menu-item--logout { margin-top:auto; color:#ff8a8a; }
.admin-dash-root .site-header-title { position:absolute; left:50%; top:50%; transform:translate(-50%, -50%); font-size:15px; font-weight:700; color:var(--text); white-space:nowrap; }
.admin-dash-root .view { display:none; }
.admin-dash-root .view.active { display:block; }
.admin-dash-root .locked-wrap { text-align:center; padding:60px 20px; }
.admin-dash-root .locked-wrap .header-icon { font-size:40px; }
.admin-dash-root .locked-wrap h1 { font-size:18px; font-weight:800; margin-bottom:8px; }
.admin-dash-root .locked-wrap p { font-size:13.5px; color:var(--text-dim); margin-bottom:20px; }
.admin-dash-root .locked-wrap a { display:inline-block; padding:12px 22px; background:#fff; color:var(--orange); border-radius:10px; text-decoration:none; font-weight:700; font-size:14px; }
.admin-dash-root .locked-wrap a:hover { background:rgba(255,107,43,0.08); }
.admin-dash-root .card { background:var(--steel-mid); border:1px solid var(--border); border-radius:14px; padding:18px; margin-bottom:14px; }
.admin-dash-root .card-title { font-size:12px; font-weight:700; color:var(--text-dim); letter-spacing:0.6px; margin-bottom:12px; text-transform:uppercase; }
.admin-dash-root .section-label { font-size:12px; font-weight:700; color:var(--text-dim); letter-spacing:0.8px; margin-bottom:4px; }
.admin-dash-root .stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.admin-dash-root .stat-value { font-size:20px; font-weight:900; margin-top:2px; }
.admin-dash-root .field { margin-bottom:14px; }
.admin-dash-root .field:last-child { margin-bottom:0; }
.admin-dash-root .field label { display:block; font-size:12px; font-weight:700; color:var(--text-dim); margin-bottom:6px; }
.admin-dash-root .field input, .admin-dash-root .field select { width:100%; padding:12px 14px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:9px; color:var(--text); font-family:inherit; font-size:14.5px; outline:none; -webkit-appearance:none; }
.admin-dash-root .field input:focus, .admin-dash-root .field select:focus { border-color:var(--orange); }
.admin-dash-root .btn { padding:12px 18px; background:#fff; border:none; border-radius:10px; color:var(--orange); font-family:inherit; font-size:14px; font-weight:800; cursor:pointer; }
.admin-dash-root .btn:hover { background:rgba(255,107,43,0.08); }
.admin-dash-root .btn:disabled { opacity:0.5; cursor:not-allowed; }
.admin-dash-root .btn.small { padding:8px 12px; font-size:12.5px; }
.admin-dash-root .preset-row { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
.admin-dash-root .preset-btn { padding:8px 14px; border-radius:20px; border:1.5px solid transparent; background:var(--steel-light); color:var(--text-dim); font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; }
.admin-dash-root .preset-btn.active { border-color:var(--orange); background:rgba(255,107,43,0.1); color:var(--orange); }
.admin-dash-root .empty-state { text-align:center; padding:30px 16px; color:var(--text-dim); font-size:13.5px; }
.admin-dash-root .empty-icon { font-size:28px; display:block; margin-bottom:8px; opacity:0.5; }
.admin-dash-root .loading-brand { text-align:center; padding-top:60px; }
.admin-dash-root .loading-brand-title { font-size:22px; font-weight:900; color:var(--text); letter-spacing:-0.5px; }
.admin-dash-root .loading-brand-sub { font-size:13px; color:var(--text-dim); margin-top:8px; }
.admin-dash-root .tool-badge { font-size:11px; font-weight:700; color:var(--text-dim); background:var(--steel-light); border:1px solid var(--border); border-radius:20px; padding:2px 10px; }
.admin-dash-root .notify-badge { font-size:11px; font-weight:800; color:#fff; background:#D3453F; border-radius:20px; padding:2px 8px; margin-left:8px; }
.admin-dash-root .approve-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 0; border-bottom:1px solid var(--border); }
.admin-dash-root .approve-row:last-child { border-bottom:none; padding-bottom:0; }
.admin-dash-root .approve-name { font-size:15px; font-weight:700; }
.admin-dash-root table.member-table { width:100%; border-collapse:collapse; font-size:13px; }
.admin-dash-root table.member-table th { text-align:left; font-size:11px; font-weight:700; color:var(--text-dim); padding:6px 6px; border-bottom:1px solid var(--border); white-space:nowrap; }
.admin-dash-root table.member-table td { padding:8px 6px; border-bottom:1px solid var(--border); vertical-align:middle; }
.admin-dash-root table.member-table tr:last-child td { border-bottom:none; }
.admin-dash-root .toast { position:fixed; top:24px; left:50%; transform:translateX(-50%) translateY(-80px); background:var(--give); color:#0a1a0f; padding:12px 24px; border-radius:50px; font-size:14px; font-weight:700; transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1); white-space:nowrap; z-index:999; }
.admin-dash-root .toast.show { transform:translateX(-50%) translateY(0); }
`;

const TEMPLATE = `
<div class="admin-dash-root">
  <div class="toast" id="admdash-toast">저장 완료</div>
  <header class="site-header">
    <a href="/tools/index.html" class="brand" data-route="home">Feeder</a>
    <span class="site-header-title">운영자 대시보드</span>
    <button class="hamburger-btn" id="hamburger-btn" onclick="window.__admdash.openMenu()" style="display:none;" aria-label="메뉴">☰</button>
  </header>
  <div class="menu-overlay" id="menu-overlay" onclick="window.__admdash.closeMenu()">
    <div class="menu-sheet" onclick="event.stopPropagation()">
      <div class="menu-head">
        <span class="menu-title">메뉴</span>
        <button class="menu-close" onclick="window.__admdash.closeMenu()" aria-label="닫기">✕</button>
      </div>
      <button class="menu-item" onclick="window.__admdash.closeMenu(); window.__admdash.goHome();">
        <span class="menu-item-icon">🏠</span><span>피더 홈</span>
      </button>
      <button class="menu-item menu-item--logout" onclick="window.__admdash.closeMenu(); window.__admdash.logout();">
        <span class="menu-item-icon">🚪</span><span>로그아웃</span>
      </button>
    </div>
  </div>

  <div class="container">
    <div class="view active" id="view-checking">
      <div class="loading-brand"><div class="loading-brand-title">Feeder</div><div class="loading-brand-sub">불러오는 중…</div></div>
    </div>
    <div class="view" id="view-locked">
      <div class="locked-wrap">
        <span class="header-icon">🔒</span><h1>로그인이 필요해요</h1>
        <p>피더 홈에서 로그인 후 다시 들어와주세요</p>
        <a href="/tools/index.html?login=1">로그인하러 가기 →</a>
      </div>
    </div>
    <div class="view" id="view-forbidden">
      <div class="locked-wrap">
        <span class="header-icon">⛔</span><h1>운영자만 볼 수 있어요</h1>
        <p>이 화면은 사이트 운영자 계정으로만 접근 가능해요</p>
        <a href="/tools/index.html" data-route="home">피더 홈으로 →</a>
      </div>
    </div>
    <div class="view" id="view-app">
      <div class="card" style="margin-top:20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <div class="card-title" style="margin-bottom:0;">실시간 접속자</div>
          <button class="btn small" onclick="window.__admdash.refreshPresenceNow()">↻ 새로고침</button>
        </div>
        <div id="presence-count" style="font-size:20px; font-weight:900; margin:10px 0 4px;">-</div>
        <div id="presence-list"></div>
      </div>
      <div class="card">
        <div class="stat-grid">
          <div><div class="section-label">누적 가입자</div><div class="stat-value" id="stat-members">-</div></div>
          <div><div class="section-label">오늘 방문</div><div class="stat-value" id="stat-today">-</div></div>
          <div><div class="section-label">오늘 DAU (고유 방문자)</div><div class="stat-value" id="stat-dau">-</div></div>
          <div><div class="section-label">최근 7일 일평균</div><div class="stat-value" id="stat-avg7">-</div></div>
          <div><div class="section-label">최근 30일 합계</div><div class="stat-value" id="stat-sum30">-</div></div>
          <div><div class="section-label">팀 전환율</div><div class="stat-value" id="stat-team-conv">-</div></div>
          <div><div class="section-label">신규가입 (오늘 · 이번주)</div><div class="stat-value" id="stat-new-signups">-</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">일자별 방문 (최근 14일)</div>
        <div id="daily-visits-list"></div>
      </div>
      <div class="card">
        <div class="card-title">팀 목록 (<span id="teams-count">-</span>)</div>
        <div id="teams-list"></div>
      </div>
      <div class="card">
        <div class="card-title">문의함<span class="notify-badge" id="inquiry-badge" style="display:none;"></span></div>
        <div class="preset-row">
          <button class="preset-btn active" id="inq-filter-all" onclick="window.__admdash.setInquiryFilter('all')">전체</button>
          <button class="preset-btn" id="inq-filter-open" onclick="window.__admdash.setInquiryFilter('open')">접수됨</button>
          <button class="preset-btn" id="inq-filter-closed" onclick="window.__admdash.setInquiryFilter('closed')">처리완료</button>
        </div>
        <div id="dashboard-inquiry-list"></div>
      </div>
      <div class="card">
        <div class="card-title">가입자 목록 (<span id="user-count">-</span>)</div>
        <div class="field"><input type="text" id="user-search-input" placeholder="이름 검색" oninput="window.__admdash.renderUserTable()" /></div>
        <div style="overflow-x:auto;">
          <table class="member-table">
            <thead><tr><th>이름</th><th>소속</th><th>등급</th><th>가입일</th></tr></thead>
            <tbody id="user-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
`;

const colToolsUsers = db.collection('tools_users');
const colTeams = db.collection('tools_teams');
const colPresence = db.collection('tools_presence');
const colStats = db.collection('tools_stats');
const colInquiries = db.collection('tools_inquiries');
const INQUIRY_TYPE_LABEL = { bug: '🐛 버그 신고', suggest: '💡 건의사항' };
const STALE_LEADER_DAYS = 14;

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function displayName(u) { return (u && (u.nickname || u.name || u.username)) || '이름없음'; }
function formatDateShort(ts) {
  if (!ts) return '-';
  const d = ts.toDate();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
function dateKeyDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

  function go(viewId) {
    container.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = $(viewId);
    if (target) target.classList.add('active');
  }
  function logout() { auth.signOut(); }
  function goHome() { navigate('home'); }
  function openMenu() { $('menu-overlay').classList.add('show'); }
  function closeMenu() { $('menu-overlay').classList.remove('show'); }
  function showToast(msg) {
    const t = $('admdash-toast');
    t.textContent = msg || '저장 완료';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  let users = [];
  let usersUnsub = null;
  function startUsersWatch() {
    if (usersUnsub) return;
    usersUnsub = colToolsUsers.onSnapshot((snap) => {
      users = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
      $('stat-members').textContent = users.length.toLocaleString('ko-KR');
      $('user-count').textContent = users.length.toLocaleString('ko-KR');
      renderTeamConversion(); renderNewSignups(); renderUserTable(); renderTeamsList();
    }, () => {});
  }

  function renderTeamConversion() {
    const el = $('stat-team-conv');
    if (!el || !users.length) { if (el) el.textContent = '-'; return; }
    const converted = users.filter((u) => u.teamCode || u.isAdmin).length;
    el.textContent = Math.round((converted / users.length) * 100) + '%';
  }
  function renderNewSignups() {
    const el = $('stat-new-signups');
    if (!el) return;
    const now = Date.now();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 86400000;
    const today = users.filter((u) => u.createdAt && u.createdAt.toMillis() >= todayStart.getTime()).length;
    const week = users.filter((u) => u.createdAt && u.createdAt.toMillis() >= weekStart).length;
    el.textContent = `${today}명 · ${week}명`;
  }
  function userRoleLabel(u) { if (u.isOperator) return '운영자'; if (u.isAdmin) return '팀장'; return '회원'; }
  function renderUserTable() {
    const q = $('user-search-input').value.trim().toLowerCase();
    const filtered = q ? users.filter((u) => displayName(u).toLowerCase().includes(q)) : users;
    const body = $('user-table-body');
    if (!filtered.length) { body.innerHTML = `<tr><td colspan="4"><div class="empty-state">검색 결과가 없어요</div></td></tr>`; return; }
    body.innerHTML = filtered.map((u) => `
      <tr>
        <td>${escapeHtml(displayName(u))}</td>
        <td>${escapeHtml(u.teamCode || u.adminTeamCode || '-')}</td>
        <td>${userRoleLabel(u)}</td>
        <td>${formatDateShort(u.createdAt)}</td>
      </tr>`).join('');
  }

  let teamsAll = [];
  let teamsUnsub = null;
  function startTeamsWatch() {
    if (teamsUnsub) return;
    teamsUnsub = colTeams.onSnapshot((snap) => { teamsAll = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderTeamsList(); }, () => {});
  }
  function leaderLastSeenLabel(adminUid) {
    const p = presenceDocs.find((x) => x.id === adminUid);
    if (!p || !p.lastSeen) return { label: '접속 기록 없음', stale: true };
    const ms = p.lastSeen.toMillis();
    const days = Math.floor((Date.now() - ms) / 86400000);
    const label = days <= 0 ? '오늘 접속' : `${days}일 전 접속`;
    return { label, stale: days >= STALE_LEADER_DAYS };
  }
  function renderTeamsList() {
    const listEl = $('teams-list');
    const countEl = $('teams-count');
    if (!listEl || !countEl) return;
    const rows = teamsAll.map((t) => {
      const leader = users.find((u) => u.id === t.adminUid);
      const memberCount = users.filter((u) => u.teamCode === t.id).length;
      const lastSeen = leaderLastSeenLabel(t.adminUid);
      return { code: t.id, leaderName: leader ? displayName(leader) : '알 수 없음', memberCount, active: t.active !== false, lastSeen };
    }).sort((a, b) => b.memberCount - a.memberCount || a.code.localeCompare(b.code));
    countEl.textContent = rows.length.toLocaleString('ko-KR');
    listEl.innerHTML = rows.map((t) => `
      <div class="approve-row">
        <span class="approve-name">${escapeHtml(t.code)} <span style="color:var(--text-dim); font-weight:400;">· ${escapeHtml(t.leaderName)}</span>${t.active ? '' : ' <span class="tool-badge">비활성</span>'}</span>
        <span style="font-size:12px; text-align:right;">
          <span style="color:var(--text-dim);">팀원 ${t.memberCount}명</span><br>
          <span style="${t.lastSeen.stale ? 'color:var(--loss); font-weight:700;' : 'color:var(--text-dim);'}">팀장 ${escapeHtml(t.lastSeen.label)}</span>
        </span>
      </div>`).join('') || '<div class="empty-state"><span class="empty-icon">👥</span>운영중인 팀이 없어요</div>';
  }

  let presenceUnsub = null;
  let presenceTimer = null;
  let presenceDocs = [];
  function startPresenceWatch() {
    if (presenceUnsub) return;
    presenceUnsub = colPresence.onSnapshot((snap) => {
      presenceDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderPresence(); renderTeamsList();
    }, () => {});
    if (!presenceTimer) presenceTimer = setInterval(renderPresence, 15000);
  }
  function refreshPresenceNow() {
    colPresence.get().then((snap) => {
      presenceDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderPresence(); renderTeamsList();
    }).catch(() => {});
  }
  function isValidPresenceDoc(p) { return p.uid ? p.id === p.uid : String(p.id).indexOf('guest_') === 0; }
  function presenceSinceLabel(p) {
    const t = p.since || p.lastSeen;
    if (!t) return '';
    return new Date(t.toMillis()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function renderPresence() {
    const countEl = $('presence-count');
    const listEl = $('presence-list');
    if (!countEl || !listEl) return;
    const cutoff = Date.now() - 90000;
    const online = presenceDocs.filter((p) => isValidPresenceDoc(p) && p.lastSeen && p.lastSeen.toMillis() > cutoff);
    const rows = online.map((p) => {
      const u = p.uid && users.find((x) => x.id === p.uid);
      return { name: p.uid ? (u ? displayName(u) : '알 수 없음') : '게스트', since: presenceSinceLabel(p), isGuest: !p.uid };
    }).sort((a, b) => (a.isGuest - b.isGuest) || a.name.localeCompare(b.name, 'ko'));
    countEl.textContent = `${online.length}명 접속 중`;
    listEl.innerHTML = rows.map((r) => `
      <div class="approve-row">
        <span class="approve-name"${r.isGuest ? ' style="color:var(--text-dim);"' : ''}>${escapeHtml(r.name)}</span>
        <span style="font-size:12px;color:var(--text-dim);">${escapeHtml(r.since)}부터</span>
      </div>`).join('') || '<div class="empty-state"><span class="empty-icon">👀</span>접속 중인 사람이 없어요</div>';
  }

  function loadVisitStats() {
    const keys = Array.from({ length: 30 }, (_, i) => dateKeyDaysAgo(i));
    Promise.all(keys.map((k) => colStats.doc('visits_' + k).get()))
      .then((docs) => {
        const counts = keys.map((k, i) => ({ date: k, total: docs[i].exists ? (docs[i].data().total || 0) : 0 }));
        const today = counts[0].total;
        const sum7 = counts.slice(0, 7).reduce((a, c) => a + c.total, 0);
        const sum30 = counts.reduce((a, c) => a + c.total, 0);
        $('stat-today').textContent = today.toLocaleString('ko-KR');
        $('stat-avg7').textContent = Math.round(sum7 / 7).toLocaleString('ko-KR') + '명';
        $('stat-sum30').textContent = sum30.toLocaleString('ko-KR');
        $('daily-visits-list').innerHTML = counts.slice(0, 14).map((c) => `
          <div class="approve-row">
            <span style="font-size:13px; color:var(--text-dim);">${escapeHtml(c.date)}</span>
            <span style="font-size:14px; font-weight:700;">${c.total.toLocaleString('ko-KR')}명</span>
          </div>`).join('');
      }).catch(() => {});
    colStats.doc('dau_' + keys[0]).get()
      .then((doc) => { $('stat-dau').textContent = (doc.exists ? (doc.data().uids || []) : []).length.toLocaleString('ko-KR'); })
      .catch(() => {});
  }

  let inquiriesAll = [];
  let inquiriesUnsub = null;
  let inquiryFilter = 'all';
  function startInquiriesWatch() {
    if (inquiriesUnsub) return;
    inquiriesUnsub = colInquiries.onSnapshot((snap) => {
      inquiriesAll = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
      renderInquiryList();
      const openCount = inquiriesAll.filter((q) => q.status === 'open').length;
      const badge = $('inquiry-badge');
      if (openCount > 0) { badge.textContent = openCount; badge.style.display = ''; } else { badge.style.display = 'none'; }
    }, () => {});
  }
  function setInquiryFilter(f) {
    inquiryFilter = f;
    $('inq-filter-all').classList.toggle('active', f === 'all');
    $('inq-filter-open').classList.toggle('active', f === 'open');
    $('inq-filter-closed').classList.toggle('active', f === 'closed');
    renderInquiryList();
  }
  function formatInquiryDate(ts) {
    if (!ts) return '';
    const d = ts.toDate();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function renderInquiryList() {
    const listEl = $('dashboard-inquiry-list');
    const filtered = inquiryFilter === 'all' ? inquiriesAll : inquiriesAll.filter((q) => q.status === inquiryFilter);
    if (!filtered.length) { listEl.innerHTML = '<div class="empty-state"><span class="empty-icon">📮</span>문의가 없어요</div>'; return; }
    listEl.innerHTML = filtered.map((q) => `
      <div class="approve-row" style="align-items:flex-start; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="tool-badge">${INQUIRY_TYPE_LABEL[q.type] || q.type}</span>
          <span style="font-size:11px; color:var(--text-dim);">${escapeHtml(q.authorName || '')} · ${formatInquiryDate(q.createdAt)}</span>
        </div>
        <div style="font-size:13px; line-height:1.5; white-space:pre-wrap;">${escapeHtml(q.content)}</div>
        <button class="btn small" onclick="window.__admdash.toggleInquiryStatus('${q.id}', '${q.status}')">${q.status === 'open' ? '처리완료로 표시' : '다시 열기'}</button>
      </div>`).join('');
  }
  function toggleInquiryStatus(id, currentStatus) {
    colInquiries.doc(id).update({ status: currentStatus === 'open' ? 'closed' : 'open' })
      .then(() => showToast('상태를 변경했어요'))
      .catch(() => alert('변경 실패. 다시 시도해주세요.'));
  }

  const unsubProfile = onProfile((profile, user) => {
    if (!user) { $('hamburger-btn').style.display = 'none'; closeMenu(); go('view-locked'); return; }
    if (!profile || !profile.isOperator) { $('hamburger-btn').style.display = 'none'; closeMenu(); go('view-forbidden'); return; }
    $('hamburger-btn').style.display = '';
    go('view-app');
    startUsersWatch(); startTeamsWatch(); startPresenceWatch(); startInquiriesWatch(); loadVisitStats();
  });

  window.__admdash = {
    openMenu, closeMenu, logout, goHome, refreshPresenceNow, setInquiryFilter, renderUserTable, toggleInquiryStatus,
  };

  return function unmount() {
    unsubProfile();
    if (usersUnsub) usersUnsub();
    if (teamsUnsub) teamsUnsub();
    if (presenceUnsub) presenceUnsub();
    if (presenceTimer) clearInterval(presenceTimer);
    if (inquiriesUnsub) inquiriesUnsub();
    delete window.__admdash;
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    console.log('[admin-dashboard-view] unmounted — 구독/타이머/스타일 정리 완료');
  };
}
