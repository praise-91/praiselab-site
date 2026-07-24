// tools/gongsu-admin.html 이관. 팀장(isAdmin) 전용 — 현장/팀원 단가/휴무일 관리.

import { auth, db, onProfile } from '../firebase-shell.js?v=14';

const STYLE_ID = 'view-style-gongsu-admin';
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
.gadmin-root { font-family: 'Noto Sans KR', sans-serif; color: var(--text); }
.gadmin-root .container { max-width: 560px; margin: 0 auto; }
.gadmin-root .site-header { position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:var(--header-bg); border-bottom:1px solid var(--border); padding:0 20px; height:52px; display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.gadmin-root .brand { font-size:15px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px; text-decoration:none; }
.gadmin-root .hamburger-btn { width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:none; border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:17px; cursor:pointer; flex-shrink:0; }
.gadmin-root .hamburger-btn:hover { border-color:var(--orange); color:var(--orange); }
.gadmin-root .menu-overlay { display:none; position:fixed; inset:0; z-index:200; background:rgba(0,0,0,0.5); justify-content:flex-end; }
.gadmin-root .menu-overlay.show { display:flex; }
.gadmin-root .menu-sheet { width:78%; max-width:300px; height:100%; background:var(--steel-mid); border-left:1px solid var(--border); padding:20px 16px; display:flex; flex-direction:column; animation: gadmin-menuSlideIn 0.22s cubic-bezier(0.2,0.9,0.3,1); }
@keyframes gadmin-menuSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.gadmin-root .menu-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding:0 2px; }
.gadmin-root .menu-title { font-size:15px; font-weight:900; color:var(--text-dim); letter-spacing:0.5px; }
.gadmin-root .menu-close { width:32px; height:32px; border-radius:8px; background:none; border:none; color:var(--text-dim); font-size:16px; cursor:pointer; }
.gadmin-root .menu-close:hover { color:var(--orange); }
.gadmin-root .menu-item { display:flex; align-items:center; gap:12px; padding:14px 10px; border-radius:12px; background:none; border:none; color:var(--text); font-family:inherit; font-size:15px; font-weight:700; text-align:left; cursor:pointer; width:100%; }
.gadmin-root .menu-item:hover { background:var(--steel-light); }
.gadmin-root .menu-item-icon { font-size:17px; width:22px; text-align:center; flex-shrink:0; }
.gadmin-root .menu-item--logout { margin-top:auto; color:#ff8a8a; }
.gadmin-root .site-header-title { position:absolute; left:50%; top:50%; transform:translate(-50%, -50%); font-size:15px; font-weight:700; color:var(--text); white-space:nowrap; }
.gadmin-root .view { display:none; }
.gadmin-root .view.active { display:block; }
.gadmin-root .locked-wrap { text-align:center; padding:60px 20px; }
.gadmin-root .locked-wrap .header-icon { font-size:40px; }
.gadmin-root .locked-wrap h1 { font-size:18px; font-weight:800; margin-bottom:8px; }
.gadmin-root .locked-wrap p { font-size:13.5px; color:var(--text-dim); margin-bottom:20px; }
.gadmin-root .locked-wrap a { display:inline-block; padding:12px 22px; background:#fff; color:var(--orange); border-radius:10px; text-decoration:none; font-weight:700; font-size:14px; }
.gadmin-root .locked-wrap a:hover { background:rgba(255,107,43,0.08); }
.gadmin-root .card { background:var(--steel-mid); border:1px solid var(--border); border-radius:14px; padding:18px; margin-bottom:14px; }
.gadmin-root .card-title { font-size:12px; font-weight:700; color:var(--text-dim); letter-spacing:0.6px; margin-bottom:12px; text-transform:uppercase; }
.gadmin-root .field { margin-bottom:14px; }
.gadmin-root .field:last-child { margin-bottom:0; }
.gadmin-root .field label { display:block; font-size:12px; font-weight:700; color:var(--text-dim); margin-bottom:6px; }
.gadmin-root .field input, .gadmin-root .field select { width:100%; padding:12px 14px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:9px; color:var(--text); font-family:inherit; font-size:14.5px; outline:none; -webkit-appearance:none; }
.gadmin-root .field input:focus, .gadmin-root .field select:focus { border-color:var(--orange); }
.gadmin-root .row2 { display:flex; gap:10px; }
.gadmin-root .row2 .field { flex:1 1 0; min-width:0; }
.gadmin-root .row2 .btn.block { flex:1 1 0; width:auto; min-width:0; }
.gadmin-root .btn { padding:12px 18px; background:#fff; border:none; border-radius:10px; color:var(--orange); font-family:inherit; font-size:14px; font-weight:800; cursor:pointer; }
.gadmin-root .btn:hover { background:rgba(255,107,43,0.08); }
.gadmin-root .btn:disabled { opacity:0.5; cursor:not-allowed; }
.gadmin-root .btn.block { width:100%; }
.gadmin-root .btn.danger { background:var(--orange); color:#fff; flex:0 0 auto; white-space:nowrap; }
.gadmin-root .btn.danger:hover { background:var(--orange-dark); }
.gadmin-root .btn.small { padding:8px 12px; font-size:12.5px; }
.gadmin-root .btn.fit { flex:0 0 auto; white-space:nowrap; }
.gadmin-root .preset-row { display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
.gadmin-root .preset-btn { padding:8px 14px; border-radius:20px; border:1.5px solid transparent; background:#fff; color:var(--orange); font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; }
.gadmin-root .preset-btn.active { border-color:var(--orange); }
.gadmin-root .empty-state { text-align:center; padding:30px 16px; color:var(--text-dim); font-size:13.5px; }
.gadmin-root .loading-brand { text-align:center; padding-top:60px; }
.gadmin-root .loading-brand-title { font-size:22px; font-weight:900; color:var(--text); letter-spacing:-0.5px; }
.gadmin-root .loading-brand-sub { font-size:13px; color:var(--text-dim); margin-top:8px; }
.gadmin-root .cal-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.gadmin-root .cal-nav-label { font-size:14px; font-weight:800; }
.gadmin-root .cal-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; }
.gadmin-root .cal-dow { text-align:center; font-size:11px; color:var(--text-dim); font-weight:700; padding-bottom:4px; }
.gadmin-root .cal-day { aspect-ratio:1; display:flex; align-items:center; justify-content:center; border-radius:8px; background:var(--steel-light); color:var(--text); font-size:12.5px; cursor:pointer; border:1.5px solid transparent; }
.gadmin-root .cal-day:hover { border-color:var(--orange); }
.gadmin-root .cal-day.empty { visibility:hidden; cursor:default; }
.gadmin-root .cal-day.rest { background:rgba(255,107,43,0.18); color:var(--orange); font-weight:800; }
.gadmin-root .cal-day.today { border-color:var(--text-dim); }
.gadmin-root .cal-hint { font-size:11.5px; color:var(--text-dim); margin-top:10px; }
.gadmin-root table.member-table { width:100%; border-collapse:collapse; font-size:13px; }
.gadmin-root table.member-table th { text-align:left; font-size:11px; font-weight:700; color:var(--text-dim); padding:6px 6px; border-bottom:1px solid var(--border); white-space:nowrap; }
.gadmin-root table.member-table td { padding:8px 6px; border-bottom:1px solid var(--border); vertical-align:middle; }
.gadmin-root table.member-table tr:last-child td { border-bottom:none; }
.gadmin-root table.member-table input[type="number"] { width:78px; padding:6px 8px; background:var(--steel-light); border:1.5px solid var(--border); border-radius:7px; color:var(--text); font-family:inherit; font-size:13px; }
.gadmin-root .mt-name { font-weight:700; white-space:nowrap; }
.gadmin-root .mt-joined-input { display:block; margin-top:4px; width:108px; padding:3px 4px; background:none; border:none; color:var(--text-dim); font-family:inherit; font-size:10.5px; }
.gadmin-root .mt-cal-link { display:block; margin-top:4px; font-size:11px; font-weight:700; color:var(--orange); text-decoration:none; white-space:nowrap; }
.gadmin-root .mt-cal-link:hover { text-decoration:underline; }
.gadmin-root .mt-profit { font-weight:800; }
.gadmin-root .mt-profit.pos { color:var(--give); }
.gadmin-root .mt-profit.neg { color:var(--loss); }
.gadmin-root .mt-absent { color:var(--text-dim); }
.gadmin-root .mt-absent.warn { color:var(--loss); }
.gadmin-root .mt-lodging-badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:700; }
.gadmin-root .mt-lodging-badge.stay { background:rgba(255,107,107,0.15); color:var(--loss); }
.gadmin-root .mt-lodging-badge.paid { background:rgba(59,232,138,0.15); color:var(--give); }
.gadmin-root .mt-lodging-badge.voucher { background:rgba(136,146,176,0.2); color:var(--text-dim); }
.gadmin-root .mt-del { background:none; border:none; color:var(--text-dim); font-size:15px; cursor:pointer; padding:4px; }
.gadmin-root .mt-del:hover { color:var(--loss); }
.gadmin-root .mt-checkbox-row { display:flex; align-items:center; gap:8px; margin-top:4px; }
.gadmin-root .mt-checkbox-row input { width:auto; }
.gadmin-root .mt-checkbox-row label { margin:0; font-size:12.5px; color:var(--text-dim); font-weight:500; }
.gadmin-root .summary-total { display:flex; justify-content:space-between; align-items:baseline; padding-top:12px; margin-top:4px; border-top:1px solid var(--border); }
.gadmin-root .summary-total .label { font-size:13px; color:var(--text-dim); font-weight:700; }
.gadmin-root .summary-total .value { font-size:22px; font-weight:900; }
.gadmin-root .toast { position:fixed; top:24px; left:50%; transform:translateX(-50%) translateY(-80px); background:var(--give); color:#0a1a0f; padding:12px 24px; border-radius:50px; font-size:14px; font-weight:700; transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1); white-space:nowrap; z-index:999; }
.gadmin-root .toast.show { transform:translateX(-50%) translateY(0); }
`;

const TEMPLATE = `
<div class="gadmin-root">
  <div class="toast" id="gadmin-toast">저장 완료</div>
  <header class="site-header">
    <a href="/tools/index.html" class="brand" data-route="home">Feeder</a>
    <span class="site-header-title">공수달력 관리</span>
    <button class="hamburger-btn" id="hamburger-btn" onclick="window.__gadmin.openMenu()" style="display:none;" aria-label="메뉴">☰</button>
  </header>
  <div class="menu-overlay" id="menu-overlay" onclick="window.__gadmin.closeMenu()">
    <div class="menu-sheet" onclick="event.stopPropagation()">
      <div class="menu-head">
        <span class="menu-title">메뉴</span>
        <button class="menu-close" onclick="window.__gadmin.closeMenu()" aria-label="닫기">✕</button>
      </div>
      <button class="menu-item" onclick="window.__gadmin.closeMenu(); window.__gadmin.showToast('⚙️ 설정 기능은 준비 중이에요');">
        <span class="menu-item-icon">⚙️</span><span>설정</span>
      </button>
      <button class="menu-item menu-item--logout" onclick="window.__gadmin.closeMenu(); window.__gadmin.logout();">
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
        <span class="header-icon">⛔</span><h1>팀장만 볼 수 있어요</h1>
        <p>이 화면은 팀장 계정으로만 접근 가능해요</p>
        <a href="/tools/gongsu-calendar.html">공수달력으로 →</a>
      </div>
    </div>
    <div class="view" id="view-main">
      <div class="card">
        <div class="card-title">현장 선택</div>
        <div class="row2">
          <div class="field" style="margin-bottom:0;"><select id="site-select" onchange="window.__gadmin.onSiteSelectChange()"></select></div>
          <button class="btn fit" onclick="window.__gadmin.startNewSite()">+ 새 현장</button>
        </div>
      </div>
      <div class="card" id="period-card" style="display:none;">
        <div class="card-title">기간</div>
        <div class="preset-row" id="preset-row"></div>
        <div class="row2">
          <div class="field"><input type="date" id="period-start" onchange="window.__gadmin.onCustomRangeChange()" /></div>
          <div class="field"><input type="date" id="period-end" onchange="window.__gadmin.onCustomRangeChange()" /></div>
        </div>
      </div>
      <div class="card" id="member-table-card" style="display:none;">
        <div class="card-title">팀원별 공수·차익금</div>
        <div style="overflow-x:auto;">
          <table class="member-table" id="member-table">
            <thead><tr><th>이름</th><th>공수</th><th>개인단가</th><th>차익금</th><th>결근율</th><th>숙식비</th><th></th></tr></thead>
            <tbody id="member-table-body"></tbody>
          </table>
        </div>
        <div class="summary-total"><span class="label">총 차익금</span><span class="value" id="total-profit">0원</span></div>
      </div>
      <div class="card" id="site-settings-card" style="display:none;">
        <div class="card-title" id="site-settings-title">현장 설정</div>
        <div class="field"><label>현장명</label><input type="text" id="site-name" placeholder="예: 거제 조선소" /></div>
        <div class="field"><label>회사단가 (1인 인건비)</label><input type="number" id="site-company-rate" placeholder="180000" /></div>
        <div class="field">
          <label>숙식비</label>
          <select id="site-lodging-type" onchange="window.__gadmin.onLodgingTypeChange()">
            <option value="none">없음</option>
            <option value="cash">현금 지급</option>
            <option value="voucher">식권 지급</option>
          </select>
        </div>
        <div class="field" id="site-lodging-amount-field" style="display:none;"><label>숙식비 금액</label><input type="number" id="site-lodging-amount" placeholder="200000" /></div>
        <div class="row2" style="margin-top: 4px;">
          <button class="btn block" id="site-save-btn" onclick="window.__gadmin.saveSite()">저장</button>
          <button class="btn danger" id="site-delete-btn" onclick="window.__gadmin.deleteSite()" style="display:none;">삭제</button>
        </div>
      </div>
      <div class="card" id="rest-days-card" style="display:none;">
        <div class="card-title">휴무일 관리</div>
        <div class="cal-nav">
          <button class="btn small" onclick="window.__gadmin.shiftCalMonth(-1)">‹ 이전달</button>
          <span class="cal-nav-label" id="cal-nav-label"></span>
          <button class="btn small" onclick="window.__gadmin.shiftCalMonth(1)">다음달 ›</button>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
        <div class="cal-hint">날짜를 누르면 휴무일로 표시/해제돼요. 결근율 계산에서 휴무일은 제외돼요.</div>
      </div>
      <div class="card" id="add-member-card" style="display:none;">
        <div class="card-title">팀원 추가</div>
        <div class="field"><select id="member-picker"></select></div>
        <div class="field"><label>입사일 (선택, 결근율 계산 시작일)</label><input type="date" id="member-joined-input" /></div>
        <button class="btn block" onclick="window.__gadmin.addMember()">이 현장에 추가</button>
      </div>
      <div class="empty-state" id="no-site-msg">현장을 선택하거나 새로 추가해주세요</div>
    </div>
  </div>
</div>
`;

const colToolsUsers = db.collection('tools_users');
const colSites = db.collection('gongsu_sites');
const colLeaderboard = db.collection('gongsu_leaderboard');
const colGongsuCalendars = db.collection('gongsu_calendars');
const colSiteRestDays = db.collection('gongsu_site_restdays');

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtWon(n) {
  const v = Math.round(n || 0);
  return (v < 0 ? '-' : '') + Math.abs(v).toLocaleString('ko-KR') + '원';
}
function dateStr(y, m, d) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function rangePreset(kind) {
  const now = new Date();
  if (kind === 'lastMonth') {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    return [dateStr(y, m, 1), dateStr(y, m, new Date(y, m + 1, 0).getDate())];
  }
  if (kind === 'all') return ['0001-01-01', '9999-12-31'];
  return [dateStr(now.getFullYear(), now.getMonth(), 1), dateStr(now.getFullYear(), now.getMonth(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())];
}
const PRESETS = [
  { kind: 'month', label: '이번달' },
  { kind: 'lastMonth', label: '지난달' },
  { kind: 'all', label: '전체' },
];

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
  function openMenu() { $('menu-overlay').classList.add('show'); }
  function closeMenu() { $('menu-overlay').classList.remove('show'); }
  function showToast(msg) {
    const t = $('gadmin-toast');
    t.textContent = msg || '저장 완료';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  let sites = [];
  let toolsUsersAll = [];
  let leaderboardAll = [];
  let currentSiteId = localStorage.getItem('gongsuAdminSite') || '';
  let currentSite = null;
  let siteMembers = [];
  let siteMembersUnsub = null;
  let periodKind = 'month';
  let periodStart = rangePreset('month')[0];
  let periodEnd = rangePreset('month')[1];

  function renderPresetRow() {
    $('preset-row').innerHTML = PRESETS.map((p) => `
      <button class="preset-btn${periodKind === p.kind ? ' active' : ''}" onclick="window.__gadmin.applyPreset('${p.kind}')">${p.label}</button>
    `).join('');
  }
  function applyPreset(kind) {
    periodKind = kind;
    const [s, e] = rangePreset(kind);
    periodStart = s; periodEnd = e;
    $('period-start').value = s; $('period-end').value = e;
    renderPresetRow(); renderMemberTable();
  }
  function onCustomRangeChange() {
    periodKind = '';
    periodStart = $('period-start').value;
    periodEnd = $('period-end').value;
    renderPresetRow(); renderMemberTable();
  }
  function workdaysFor(uid) {
    const lb = leaderboardAll.find((l) => l.id === uid);
    if (!lb || !lb.gongsuByDate) return 0;
    let sum = 0;
    Object.entries(lb.gongsuByDate).forEach(([date, g]) => { if (date >= periodStart && date <= periodEnd) sum += g || 0; });
    return sum;
  }
  function todayStr() { const now = new Date(); return dateStr(now.getFullYear(), now.getMonth(), now.getDate()); }
  function daysBetween(a, b) {
    const toUTC = (s) => Date.UTC(...s.split('-').map(Number));
    return Math.round((toUTC(b) - toUTC(a)) / 86400000);
  }
  function expectedWorkDays(site, member) {
    const joined = member.joinedAt || '';
    const effStart = joined && joined > periodStart ? joined : periodStart;
    const today = todayStr();
    const effEnd = today < periodEnd ? today : periodEnd;
    if (effStart > effEnd) return 0;
    const totalDays = daysBetween(effStart, effEnd) + 1;
    const rest = site.restDays || {};
    const restCount = Object.keys(rest).filter((d) => d >= effStart && d <= effEnd).length;
    return Math.max(0, totalDays - restCount);
  }
  function attendedDaysFor(uid) {
    const joined = (siteMembers.find((m) => m.id === uid) || {}).joinedAt || '';
    const effStart = joined && joined > periodStart ? joined : periodStart;
    const today = todayStr();
    const effEnd = today < periodEnd ? today : periodEnd;
    const lb = leaderboardAll.find((l) => l.id === uid);
    if (!lb || !lb.gongsuByDate) return 0;
    return Object.keys(lb.gongsuByDate).filter((d) => d >= effStart && d <= effEnd).length;
  }

  let calYear = 0, calMonth = 0;
  function ensureCalInit() {
    if (calYear) return;
    const now = new Date();
    calYear = now.getFullYear(); calMonth = now.getMonth();
  }
  function shiftCalMonth(delta) {
    ensureCalInit();
    calMonth += delta;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
    renderRestCalendar();
  }
  function renderRestCalendar() {
    if (!currentSite) return;
    ensureCalInit();
    $('cal-nav-label').textContent = `${calYear}년 ${calMonth + 1}월`;
    const rest = currentSite.restDays || {};
    const today = todayStr();
    const firstWeekday = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const dows = ['일', '월', '화', '수', '목', '금', '토'].map((d) => `<div class="cal-dow">${d}</div>`).join('');
    const blanks = Array.from({ length: firstWeekday }, () => '<div class="cal-day empty"></div>').join('');
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const ds = dateStr(calYear, calMonth, day);
      const isRest = !!rest[ds];
      const isToday = ds === today;
      return `<div class="cal-day${isRest ? ' rest' : ''}${isToday ? ' today' : ''}" onclick="window.__gadmin.toggleRestDay('${ds}')">${day}</div>`;
    }).join('');
    $('cal-grid').innerHTML = dows + blanks + days;
  }
  function toggleRestDay(ds) {
    if (!currentSiteId || !currentSite) return;
    const isRest = !!(currentSite.restDays && currentSite.restDays[ds]);
    const value = isRest ? firebase.firestore.FieldValue.delete() : true;
    const patch = {};
    patch[`restDays.${ds}`] = value;
    colSites.doc(currentSiteId).update(patch).catch(() => alert('저장 실패. 인터넷 연결을 확인해주세요.'));
    colSiteRestDays.doc(currentSiteId).set({ teamCode: myAdminTeamCode, restDays: { [ds]: value } }, { merge: true }).catch(() => {});
  }

  function renderSiteSelect() {
    const sel = $('site-select');
    sel.innerHTML = '<option value="">현장을 선택하세요</option>' +
      sites.map((s) => `<option value="${s.id}"${s.id === currentSiteId ? ' selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
  }
  function onSiteSelectChange() { selectSite($('site-select').value); }
  function selectSite(id) {
    currentSiteId = id;
    localStorage.setItem('gongsuAdminSite', id || '');
    currentSite = sites.find((s) => s.id === id) || null;
    if (siteMembersUnsub) { siteMembersUnsub(); siteMembersUnsub = null; }
    siteMembers = [];

    if (!currentSite) {
      $('site-settings-card').style.display = 'none';
      $('rest-days-card').style.display = 'none';
      $('period-card').style.display = 'none';
      $('add-member-card').style.display = 'none';
      $('member-table-card').style.display = 'none';
      $('no-site-msg').style.display = '';
      renderSiteSelect();
      return;
    }

    $('no-site-msg').style.display = 'none';
    $('site-settings-card').style.display = '';
    $('rest-days-card').style.display = '';
    $('period-card').style.display = '';
    $('add-member-card').style.display = '';
    $('member-table-card').style.display = '';
    $('site-settings-title').textContent = '현장 설정';
    $('site-delete-btn').style.display = '';
    fillSiteForm(currentSite);
    renderSiteSelect();
    renderPresetRow();
    renderRestCalendar();

    siteMembersUnsub = colSites.doc(id).collection('members').onSnapshot((snap) => {
      siteMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderMemberPicker(); renderMemberTable();
    });
  }
  function fillSiteForm(site) {
    $('site-name').value = site.name || '';
    $('site-company-rate').value = site.companyRate || '';
    $('site-lodging-type').value = site.lodgingType || 'none';
    $('site-lodging-amount').value = site.lodgingAmount || '';
    onLodgingTypeChange();
  }
  function onLodgingTypeChange() {
    const type = $('site-lodging-type').value;
    $('site-lodging-amount-field').style.display = type === 'cash' ? '' : 'none';
  }
  function startNewSite() {
    currentSiteId = '';
    currentSite = null;
    if (siteMembersUnsub) { siteMembersUnsub(); siteMembersUnsub = null; }
    siteMembers = [];
    $('site-select').value = '';
    $('site-settings-title').textContent = '새 현장';
    $('site-name').value = '';
    $('site-company-rate').value = '';
    $('site-lodging-type').value = 'none';
    $('site-lodging-amount').value = '';
    onLodgingTypeChange();
    $('site-settings-card').style.display = '';
    $('site-delete-btn').style.display = 'none';
    $('rest-days-card').style.display = 'none';
    $('period-card').style.display = 'none';
    $('add-member-card').style.display = 'none';
    $('member-table-card').style.display = 'none';
    $('no-site-msg').style.display = 'none';
  }
  function saveSite() {
    const name = $('site-name').value.trim();
    if (!name) { alert('현장명을 입력해주세요!'); return; }
    const companyRate = Number($('site-company-rate').value) || 0;
    const lodgingType = $('site-lodging-type').value;
    const lodgingAmount = lodgingType === 'cash' ? (Number($('site-lodging-amount').value) || 0) : 0;
    const btn = $('site-save-btn');
    btn.disabled = true;
    const data = { name, companyRate, lodgingType, lodgingAmount, teamCode: myAdminTeamCode };
    const promise = currentSiteId
      ? colSites.doc(currentSiteId).set(data, { merge: true })
      : colSites.add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
          .then((ref) => { currentSiteId = ref.id; localStorage.setItem('gongsuAdminSite', ref.id); });
    promise.then(() => { showToast('현장 저장 완료'); selectSite(currentSiteId); })
      .catch(() => alert('저장 실패. 인터넷 연결을 확인해주세요.'))
      .finally(() => { btn.disabled = false; });
  }
  function deleteSite() {
    if (!currentSiteId) return;
    if (!confirm('이 현장과 소속 팀원 설정을 모두 삭제할까요? 되돌릴 수 없어요.')) return;
    const id = currentSiteId;
    colSites.doc(id).collection('members').get().then((snap) => {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(colSites.doc(id));
      return batch.commit();
    }).then(() => { showToast('현장 삭제 완료'); selectSite(''); })
      .catch(() => alert('삭제 실패. 인터넷 연결을 확인해주세요.'));
  }

  function renderMemberPicker() {
    const sel = $('member-picker');
    const addedUids = new Set(siteMembers.map((m) => m.id));
    const candidates = toolsUsersAll.filter((u) => u.status === 'approved' && !addedUids.has(u.id));
    sel.innerHTML = candidates.length
      ? candidates.map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')
      : '<option value="">추가할 수 있는 팀원이 없어요</option>';
  }
  function addMember() {
    if (!currentSiteId) return;
    const uid = $('member-picker').value;
    if (!uid) return;
    const user = toolsUsersAll.find((u) => u.id === uid);
    const joinedAt = $('member-joined-input').value || '';
    colSites.doc(currentSiteId).collection('members').doc(uid).set({
      name: user ? user.name : '', personalRate: 0, usesLodging: false, joinedAt, memo: '',
      addedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).then(() => {
      $('member-joined-input').value = '';
      showToast('팀원 추가 완료');
      colToolsUsers.doc(uid).update({ gongsuSiteId: currentSiteId }).catch(() => {});
    }).catch(() => alert('추가 실패. 인터넷 연결을 확인해주세요.'));
  }
  function removeMember(uid) {
    if (!confirm('이 팀원을 현장에서 제거할까요?')) return;
    colSites.doc(currentSiteId).collection('members').doc(uid).delete()
      .then(() => { colToolsUsers.doc(uid).update({ gongsuSiteId: firebase.firestore.FieldValue.delete() }).catch(() => {}); })
      .catch(() => alert('삭제 실패. 인터넷 연결을 확인해주세요.'));
  }

  const debounceTimers = {};
  function updateMemberField(uid, field, value) {
    const key = uid + ':' + field;
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(() => {
      colSites.doc(currentSiteId).collection('members').doc(uid).set({ [field]: value }, { merge: true })
        .catch(() => alert('저장 실패. 인터넷 연결을 확인해주세요.'));
    }, 500);
  }
  async function syncRateToCalendar(uid, rate) {
    try {
      const doc = await colGongsuCalendars.doc(uid).get();
      if (!doc.exists || doc.data().data == null) return;
      const state = JSON.parse(doc.data().data);
      if (state.defaultUnitPrice === rate) return;
      state.defaultUnitPrice = rate;
      await colGongsuCalendars.doc(uid).set({ data: JSON.stringify(state), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) { /* 관리자 화면 자체 저장(personalRate)은 이미 끝난 상태라 이 동기화는 조용히 실패 처리 */ }
  }
  function onRateInput(uid, el) {
    const rate = Number(el.value) || 0;
    updateMemberField(uid, 'personalRate', rate);
    syncRateToCalendar(uid, rate);
  }
  function onLodgingCheck(uid, el) { updateMemberField(uid, 'usesLodging', el.checked); }
  function onJoinedInput(uid, el) { updateMemberField(uid, 'joinedAt', el.value || ''); }

  function renderMemberTable() {
    if (!currentSite) return;
    const tbody = $('member-table-body');
    if (!siteMembers.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px 0;">아직 추가된 팀원이 없어요</td></tr>';
      $('total-profit').textContent = fmtWon(0);
      return;
    }
    const companyRate = currentSite.companyRate || 0;
    const lodgingType = currentSite.lodgingType || 'none';
    const lodgingAmount = currentSite.lodgingAmount || 0;
    let totalProfit = 0;
    tbody.innerHTML = siteMembers.map((m) => {
      const workdays = workdaysFor(m.id);
      const personalRate = m.personalRate || 0;
      const profit = (companyRate - personalRate) * workdays;
      totalProfit += profit;
      const expected = expectedWorkDays(currentSite, m);
      const attended = attendedDaysFor(m.id);
      const absentRate = expected > 0 ? Math.max(0, (expected - attended) / expected) * 100 : 0;
      let lodgingBadge = '<span style="color:var(--text-dim);">-</span>';
      if (lodgingType === 'voucher') lodgingBadge = '<span class="mt-lodging-badge voucher">식권</span>';
      else if (lodgingType === 'cash') {
        lodgingBadge = m.usesLodging ? '<span class="mt-lodging-badge stay">숙소이용</span>' : `<span class="mt-lodging-badge paid">${fmtWon(lodgingAmount)}</span>`;
      }
      return `
        <tr>
          <td>
            <div class="mt-name">${escapeHtml(m.name)}</div>
            <input type="date" class="mt-joined-input" value="${m.joinedAt || ''}" title="입사일 (결근율 계산 시작일)" onchange="window.__gadmin.onJoinedInput('${m.id}', this)" />
            <a class="mt-cal-link" href="/tools/gongsu-calendar.html?as=${m.id}" target="_blank" rel="noopener">📅 공수 보기</a>
          </td>
          <td>${workdays}</td>
          <td><input type="number" value="${personalRate}" onchange="window.__gadmin.onRateInput('${m.id}', this)" /></td>
          <td class="mt-profit ${profit >= 0 ? 'pos' : 'neg'}">${fmtWon(profit)}</td>
          <td class="mt-absent${absentRate > 0 ? ' warn' : ''}">${absentRate.toFixed(1)}%</td>
          <td>
            ${lodgingBadge}
            ${lodgingType === 'cash' ? `<div class="mt-checkbox-row"><input type="checkbox" id="lodge-${m.id}" ${m.usesLodging ? 'checked' : ''} onchange="window.__gadmin.onLodgingCheck('${m.id}', this)" /><label for="lodge-${m.id}">숙소이용</label></div>` : ''}
          </td>
          <td><button class="mt-del" onclick="window.__gadmin.removeMember('${m.id}')">✕</button></td>
        </tr>`;
    }).join('');
    $('total-profit').textContent = fmtWon(totalProfit);
    $('total-profit').style.color = totalProfit >= 0 ? 'var(--give)' : 'var(--loss)';
  }

  let myAdminTeamCode = null;
  let myOwnProfile = null;
  let dataUnsubs = [];

  function startApp() {
    $('period-start').value = periodStart;
    $('period-end').value = periodEnd;
    renderPresetRow();

    dataUnsubs.push(colToolsUsers.where('teamCode', '==', myAdminTeamCode).onSnapshot((snap) => {
      const teamMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (myOwnProfile && !teamMembers.some((u) => u.id === myOwnProfile.id)) teamMembers.push(myOwnProfile);
      toolsUsersAll = teamMembers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      renderMemberPicker();
    }));
    dataUnsubs.push(colLeaderboard.where('teamCode', '==', myAdminTeamCode).onSnapshot((snap) => {
      leaderboardAll = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderMemberTable();
    }));
    dataUnsubs.push(colSites.where('teamCode', '==', myAdminTeamCode).onSnapshot((snap) => {
      sites = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt ? a.createdAt.toMillis() : 0) - (b.createdAt ? b.createdAt.toMillis() : 0));
      renderSiteSelect();
      if (currentSiteId && sites.some((s) => s.id === currentSiteId)) selectSite(currentSiteId);
      else selectSite('');
    }));
  }

  const unsubProfile = onProfile((profile, user) => {
    dataUnsubs.forEach((u) => u()); dataUnsubs = [];
    if (!user) { $('hamburger-btn').style.display = 'none'; closeMenu(); go('view-locked'); return; }
    if (!profile || profile.status !== 'approved') { $('hamburger-btn').style.display = 'none'; closeMenu(); go('view-locked'); return; }
    myAdminTeamCode = profile.adminTeamCode || null;
    myOwnProfile = { id: user.uid, ...profile };
    if (!profile.isAdmin) { $('hamburger-btn').style.display = 'none'; closeMenu(); go('view-forbidden'); return; }
    $('hamburger-btn').style.display = '';
    go('view-main');
    startApp();
  });

  window.__gadmin = {
    openMenu, closeMenu, logout, showToast, onSiteSelectChange, startNewSite, applyPreset, onCustomRangeChange,
    onLodgingTypeChange, saveSite, deleteSite, shiftCalMonth, toggleRestDay, addMember, removeMember,
    onRateInput, onLodgingCheck, onJoinedInput,
  };

  return function unmount() {
    unsubProfile();
    dataUnsubs.forEach((u) => u());
    if (siteMembersUnsub) siteMembersUnsub();
    Object.values(debounceTimers).forEach((t) => clearTimeout(t));
    delete window.__gadmin;
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    console.log('[gongsu-admin-view] unmounted — 구독/스타일 정리 완료');
  };
}
