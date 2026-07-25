// tools/team-ladder.html 이관. roulette-view.js와 거의 같은 구조(팀 room 실시간 공유 +
// runTransaction)라 같은 패턴을 한 번 더 검증하는 목적. 로그인 게이트는 셸의 onProfile()에 위임.

import { auth, db, onProfile } from '../firebase-shell.js?v=19';
import { mountShellHeader } from '../shell-header.js?v=19';
import { navigate } from '../router.js?v=19';

const STYLE_ID = 'view-style-team-ladder';
const STYLE = `
:root {
  --orange: #FF6B2B; --orange-dark: #E05520;
  --steel: #1A1E2E; --steel-mid: #252A3D; --steel-light: #2E3450;
  --text: #F0F2FF; --text-dim: #8892B0; --give: #3BE88A;
  --border: rgba(255,255,255,0.08);
  --nav-btn-bg: #fff; --nav-btn-border: transparent;
  --header-bg: rgba(26, 30, 46, 0.8);
  --chip-btn-bg: rgba(255,255,255,0.14); --chip-btn-bg-hover: rgba(255,255,255,0.28);
}
:root[data-theme="light"] {
  --orange: #FF6B2B; --orange-dark: #E05520;
  --steel: #F4F3F0; --steel-mid: #FFFFFF; --steel-light: #F0EFEA;
  --text: #1C1E27; --text-dim: #767A85; --give: #1E8E56;
  --border: rgba(0,0,0,0.08);
  --nav-btn-bg: #fff; --nav-btn-border: rgba(0,0,0,0.08);
  --header-bg: rgba(244, 243, 240, 0.8);
  --chip-btn-bg: rgba(0,0,0,0.06); --chip-btn-bg-hover: rgba(0,0,0,0.12);
}
.tld-root { font-family: 'Noto Sans KR', sans-serif; color: var(--text); }
.tld-root .container { max-width: 480px; margin: 0 auto; }
.tld-root .locked-link { display: block; padding: 16px; background: var(--nav-btn-bg); border: 1.5px solid var(--nav-btn-border); border-radius: 12px; color: var(--orange); text-align: center; text-decoration: none; font-weight: 900; }
.tld-root .locked-link:hover { background: rgba(255,107,43,0.08); }
.tld-root header.page-head { text-align: center; padding: 28px 0 24px; }
.tld-root .header-icon { font-size: 40px; display: block; margin-bottom: 12px; filter: drop-shadow(0 0 12px rgba(255,107,43,0.5)); }
.tld-root header.page-head h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
.tld-root .page-sub { font-size: 13px; color: var(--text-dim); margin-top: 6px; }
.tld-root .sync-indicator { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; font-size: 11px; color: var(--text-dim); }
.tld-root .sync-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--give); animation: tld-pulse 2s infinite; }
@keyframes tld-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
.tld-root .view { display: none; }
.tld-root .view.active { display: block; animation: tld-fadeIn 0.25s ease; }
@keyframes tld-fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.tld-root .loading-brand { text-align: center; padding-top: 60px; }
.tld-root .loading-brand-title { font-size: 22px; font-weight: 900; color: var(--text); letter-spacing: -0.5px; }
.tld-root .loading-brand-sub { font-size: 13px; color: var(--text-dim); margin-top: 8px; }
.tld-root .card { background: var(--steel-mid); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
.tld-root .section-label { font-size: 12px; font-weight: 700; color: var(--text-dim); letter-spacing: 0.8px; margin-bottom: 12px; }
.tld-root .empty-state { text-align: center; padding: 32px 16px; color: var(--text-dim); font-size: 14px; line-height: 1.7; }
.tld-root .empty-icon { font-size: 30px; display: block; margin-bottom: 10px; opacity: 0.6; }
.tld-root .submit-btn { width: 100%; padding: 16px; background: var(--orange); border: none; border-radius: 12px; color: white; font-family: inherit; font-size: 16px; font-weight: 900; cursor: pointer; }
.tld-root .submit-btn:hover { background: var(--orange-dark); }
.tld-root .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tld-root .white-btn { width: 100%; padding: 14px; background: var(--nav-btn-bg); border: 1.5px solid var(--nav-btn-border); border-radius: 12px; color: var(--orange); font-family: inherit; font-size: 15px; font-weight: 900; cursor: pointer; }
.tld-root .white-btn:hover { background: var(--steel-light); }
.tld-root .cancel-link { display: block; text-align: center; margin-top: 12px; font-size: 13px; color: var(--text-dim); background: none; border: none; font-family: inherit; cursor: pointer; }
.tld-root .cancel-link:hover { color: var(--text); }
.tld-root .field { margin-bottom: 16px; }
.tld-root .field label { display: block; font-size: 12px; font-weight: 700; color: var(--text-dim); letter-spacing: 0.4px; margin-bottom: 8px; }
.tld-root .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.tld-root .preset-chip { padding: 9px 14px; background: var(--steel-light); border: 1.5px solid var(--border); border-radius: 20px; color: var(--text); font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.tld-root .preset-chip:hover { border-color: var(--orange); }
.tld-root .custom-add-row { display: flex; gap: 8px; margin-top: 10px; }
.tld-root .custom-add-row input { flex: 1; min-width: 0; padding: 12px 14px; background: var(--steel-light); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-family: inherit; font-size: 14px; outline: none; }
.tld-root .custom-add-row input:focus { border-color: var(--orange); }
.tld-root .custom-add-btn { padding: 0 18px; background: var(--steel-light); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.tld-root .custom-add-btn:hover { border-color: var(--orange); color: var(--orange); }
.tld-root .draft-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.tld-root .draft-chip { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(255,107,43,0.12); border: 1px solid rgba(255,107,43,0.3); border-radius: 20px; font-size: 13px; font-weight: 700; color: var(--text); }
.tld-root .draft-chip button { width: 20px; height: 20px; border-radius: 50%; border: none; background: var(--chip-btn-bg); color: var(--text); font-size: 13px; font-weight: 900; line-height: 1; cursor: pointer; }
.tld-root .draft-chip button:hover { background: var(--chip-btn-bg-hover); }
.tld-root .capacity-badge { display: inline-block; font-size: 12px; font-weight: 900; color: var(--orange); background: rgba(255,107,43,0.12); padding: 4px 12px; border-radius: 20px; margin-bottom: 14px; }
.tld-root .participant-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.tld-root .participant-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--steel-light); border-radius: 10px; font-size: 14px; font-weight: 700; }
.tld-root .participant-row .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tld-root .participant-row .me-tag { margin-left: auto; font-size: 11px; color: var(--give); font-weight: 900; }
.tld-root .participant-empty-row { padding: 10px 14px; border: 1.5px dashed var(--border); border-radius: 10px; font-size: 13px; color: var(--text-dim); text-align: center; }
.tld-root .ladder-wrap { overflow-x: auto; overflow-y: auto; max-height: 62vh; margin-bottom: 16px; }
.tld-root .ladder-svg { display: block; margin: 0 auto; }
.tld-root .ladder-line { stroke: var(--border); stroke-width: 2; }
.tld-root .ladder-rung { stroke: var(--border); stroke-width: 2; }
.tld-root .ladder-marker { transition: cx 0.14s linear, cy 0.14s linear; }
.tld-root .ladder-item-label { fill: var(--text-dim); }
.tld-root .legend-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.tld-root .legend-chip { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--text-dim); }
.tld-root .legend-chip .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.tld-root .result-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.tld-root .result-row { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: var(--steel-light); border-radius: 10px; font-size: 14px; animation: tld-slideIn 0.3s ease; }
@keyframes tld-slideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.tld-root .result-row .name-row { display: flex; align-items: center; gap: 8px; }
.tld-root .result-row .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tld-root .result-row .name { font-weight: 700; word-break: break-word; }
.tld-root .result-row .item-row { display: flex; align-items: center; gap: 6px; padding-left: 16px; }
.tld-root .result-row .arrow { color: var(--text-dim); flex-shrink: 0; }
.tld-root .result-row .item { font-weight: 900; color: var(--orange); word-break: break-word; }
.tld-root .result-actions { display: flex; flex-direction: column; gap: 10px; }
.tld-root .history-list { display: flex; flex-direction: column; gap: 14px; }
.tld-root .history-card { padding: 16px; }
.tld-root .history-date { font-size: 12px; font-weight: 700; color: var(--text-dim); margin-bottom: 10px; }
`;

const TEMPLATE = `
<div class="tld-root">
  <div class="container">
    <div class="view active" id="view-checking">
      <div class="loading-brand">
        <div class="loading-brand-title">Feeder</div>
        <div class="loading-brand-sub">불러오는 중…</div>
      </div>
    </div>
    <div class="view" id="view-locked">
      <header class="page-head">
        <span class="header-icon">🔒</span><h1>로그인이 필요해요</h1>
        <div class="page-sub">피더 홈에서 로그인 후 다시 들어와주세요</div>
      </header>
      <div class="card"><a href="/tools/index.html?login=1" class="locked-link">로그인하러 가기 →</a></div>
    </div>
    <div class="view" id="view-no-team">
      <header class="page-head">
        <span class="header-icon">🪜</span><h1>사다리타기</h1>
        <div class="page-sub">팀 코드가 있어야 팀원들과 같이 즐길 수 있어요</div>
      </header>
      <div class="card"><a href="/tools/index.html" class="locked-link" data-route="home">피더 홈으로 →</a></div>
    </div>
    <div class="view" id="view-app">
      <header class="page-head">
        <span class="header-icon">🪜</span><h1>사다리타기</h1>
        <div class="sync-indicator"><span class="sync-dot"></span>실시간 공유 중</div>
      </header>
      <div id="no-room-block">
        <div class="card"><div class="empty-state"><span class="empty-icon">🪜</span>진행중인 사다리가 없어요</div></div>
        <button class="submit-btn" id="tld-open-create">+ 새 사다리 만들기</button>
      </div>
      <div class="card" id="create-form" style="display:none;">
        <div class="field">
          <label>벌칙/결과 항목 고르기</label>
          <div class="chip-row" id="preset-chip-row"></div>
          <div class="custom-add-row">
            <input type="text" id="custom-item-input" placeholder="직접 입력 (예: 오늘 밥값 내기)" />
            <button class="custom-add-btn" onclick="window.__tld.addCustomItem()">추가</button>
          </div>
        </div>
        <div class="field" id="draft-list-field" style="display:none;">
          <label>추가된 항목 (= 정원)</label>
          <div class="draft-list" id="draft-list"></div>
        </div>
        <button class="submit-btn" id="create-submit-btn" onclick="window.__tld.createRoom()">사다리 만들기 →</button>
        <button class="cancel-link" onclick="window.__tld.closeCreateForm()">취소</button>
      </div>
      <div id="room-block" style="display:none;"></div>
    </div>
    <div class="view" id="view-history">
      <header class="page-head"><span class="header-icon">🗂️</span><h1>지난 기록</h1></header>
      <div id="history-block"></div>
      <button class="white-btn" onclick="window.__tld.go('view-app')">‹ 사다리타기로</button>
    </div>
  </div>
</div>
`;

const colTeamLadders = db.collection('team_ladders');
const PRESET_ITEMS = ['☕ 커피사기', '🧹 청소당번', '🙋 막내가쏜다', '🚬 담배사기', '🍿 간식사기', '💨 꽝'];
const MARKER_COLORS = ['#FF6B2B','#3BE88A','#4FC3F7','#FFD54F','#BA68C8','#FF8A80','#81C784','#F06292','#90A4AE','#FFB74D'];

export function mount(container) {
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
  }
  container.innerHTML = TEMPLATE;
  const unmountHeader = mountShellHeader(container.querySelector('.tld-root'), {
    menuItems: [
      { icon: '🏠', label: '피더 홈', onClick: () => navigate('home') },
      { icon: '🗂️', label: '지난 기록', onClick: () => openHistory() },
    ],
  });

  const $ = (id) => document.getElementById(id);

  let myUid = null, myName = '', myTeamCode = null;
  let roomUnsub = null;
  let currentRoom = null;
  let draftItems = [];
  let creatingFormOpen = false;
  let renderedPlayingRoomId = null;
  let dismissedRoomId = null;

  function hasActiveRoom() { return !!currentRoom && currentRoom.id !== dismissedRoomId; }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function go(viewId) {
    container.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = $(viewId);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
  }

  function logout() { auth.signOut().then(() => { location.href = '/tools/index.html'; }); }

  function renderPresetChips() {
    const row = $('preset-chip-row');
    row.innerHTML = PRESET_ITEMS.map((item) =>
      `<button class="preset-chip" onclick="window.__tld.addDraftItem('${item.replace(/'/g,"\\'")}')">${escapeHtml(item)}</button>`
    ).join('');
  }

  function addDraftItem(item) {
    const existing = draftItems.find((d) => d.name === item);
    if (existing) existing.count++;
    else draftItems.push({ name: item, count: 1 });
    renderDraftList();
  }

  function addCustomItem() {
    const input = $('custom-item-input');
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    addDraftItem(val);
  }

  function incDraftItem(idx) { draftItems[idx].count++; renderDraftList(); }
  function decDraftItem(idx) {
    draftItems[idx].count--;
    if (draftItems[idx].count <= 0) draftItems.splice(idx, 1);
    renderDraftList();
  }
  function draftTotal() { return draftItems.reduce((sum, d) => sum + d.count, 0); }

  function renderDraftList() {
    const field = $('draft-list-field');
    const list = $('draft-list');
    if (!draftItems.length) {
      field.style.display = 'none';
      list.innerHTML = '';
    } else {
      field.style.display = 'block';
      list.innerHTML = draftItems.map((d, i) => `
        <span class="draft-chip">
          <button onclick="window.__tld.decDraftItem(${i})" aria-label="빼기">−</button>
          <span>${escapeHtml(d.name)} ×${d.count}</span>
          <button onclick="window.__tld.incDraftItem(${i})" aria-label="더하기">+</button>
        </span>`).join('');
    }
    $('create-submit-btn').disabled = draftTotal() < 2;
  }

  function openCreateForm() {
    if (hasActiveRoom()) return;
    draftItems = [];
    renderPresetChips();
    renderDraftList();
    creatingFormOpen = true;
    renderApp();
  }

  function closeCreateForm() { creatingFormOpen = false; renderApp(); }

  function createRoom() {
    const items = draftItems.flatMap((d) => Array(d.count).fill(d.name));
    if (items.length < 2) { alert('벌칙 항목을 2개 이상 추가해주세요!'); return; }
    const btn = $('create-submit-btn');
    btn.disabled = true;
    colTeamLadders.add({
      teamCode: myTeamCode, status: 'waiting', items,
      participants: [{ uid: myUid, name: myName }],
      createdBy: myUid, createdByName: myName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).then(() => {
      creatingFormOpen = false;
      dismissedRoomId = null;
    }).catch((err) => {
      console.error('createRoom failed:', err);
      alert('만들기 실패 (' + (err.code || err.message) + ')');
      btn.disabled = false;
    });
  }

  function joinRoom() {
    if (!currentRoom) return;
    const ref = colTeamLadders.doc(currentRoom.id);
    db.runTransaction((tx) => tx.get(ref).then((doc) => {
      if (!doc.exists) return;
      const data = doc.data();
      if (data.status !== 'waiting') return;
      const participants = data.participants || [];
      if (participants.some((p) => p.uid === myUid)) return;
      if (participants.length >= data.items.length) { throw new Error('full'); }
      participants.push({ uid: myUid, name: myName });
      tx.update(ref, { participants });
    })).catch((err) => {
      if (err && err.message === 'full') { alert('정원이 다 찼어요!'); return; }
      console.error('joinRoom failed:', err);
      alert('참가 실패 (' + (err.code || err.message) + ')');
    });
  }

  function startRoom() {
    if (!currentRoom) return;
    const ref = colTeamLadders.doc(currentRoom.id);
    db.runTransaction((tx) => tx.get(ref).then((doc) => {
      if (!doc.exists) return;
      const data = doc.data();
      if (data.status !== 'waiting') return;
      const n = (data.participants || []).length;
      if (n < 2 || n !== data.items.length) { throw new Error('not-full'); }
      const rungs = generateRungs(n);
      tx.update(ref, { status: 'playing', rungs, startedAt: firebase.firestore.FieldValue.serverTimestamp() });
    })).catch((err) => {
      if (err && err.message === 'not-full') { alert('정원이 다 차야 시작할 수 있어요!'); return; }
      console.error('startRoom failed:', err);
      alert('시작 실패 (' + (err.code || err.message) + ')');
    });
  }

  function closeRoom() {
    if (!currentRoom) return;
    if (!confirm('이 사다리를 닫을까요?')) return;
    colTeamLadders.doc(currentRoom.id).delete().catch(() => alert('처리 실패. 다시 시도해주세요.'));
  }

  function dismissRoom() {
    if (currentRoom) dismissedRoomId = currentRoom.id;
    renderApp();
  }

  function openHistory() { go('view-history'); loadHistory(); }

  function fmtRoomDate(room) {
    const t = room.startedAt || room.createdAt;
    if (!t) return '';
    return t.toDate().toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function loadHistory() {
    const block = $('history-block');
    block.innerHTML = '<div class="card"><div class="empty-state">불러오는 중…</div></div>';
    colTeamLadders.where('teamCode', '==', myTeamCode).where('status', '==', 'done').get()
      .then((snap) => {
        const rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rooms.sort((a, b) => {
          const ta = (a.startedAt || a.createdAt);
          const tb = (b.startedAt || b.createdAt);
          return (tb ? tb.toMillis() : 0) - (ta ? ta.toMillis() : 0);
        });
        if (!rooms.length) {
          block.innerHTML = '<div class="card"><div class="empty-state"><span class="empty-icon">🗂️</span>아직 완료된 사다리 기록이 없어요</div></div>';
          return;
        }
        block.innerHTML = `<div class="history-list">${rooms.map(renderHistoryCard).join('')}</div>`;
      })
      .catch(() => {
        block.innerHTML = '<div class="card"><div class="empty-state">⚠️ 기록을 불러오지 못했어요.</div></div>';
      });
  }

  function renderHistoryCard(room) {
    const participants = room.participants || [];
    const n = participants.length;
    const rows = participants.map((p, i) => {
      const { endCol } = traceColumn(i, room.rungs || [], n);
      const item = room.items && room.items[endCol] != null ? room.items[endCol] : '';
      const color = MARKER_COLORS[i % MARKER_COLORS.length];
      return `
        <div class="result-row">
          <div class="name-row"><span class="dot" style="background:${color}"></span><span class="name">${escapeHtml(p.name)}</span></div>
          <div class="item-row"><span class="arrow">→</span><span class="item">${escapeHtml(item)}</span></div>
        </div>`;
    }).join('');
    return `
      <div class="card history-card">
        <div class="history-date">${escapeHtml(fmtRoomDate(room))}</div>
        <div class="result-list" style="margin-bottom:0;">${rows}</div>
      </div>`;
  }

  function hasRung(rungs, r, gap) { return ((rungs[r] >> gap) & 1) === 1; }

  function generateRungs(n) {
    const rows = 8 + Math.floor(Math.random() * 3);
    const rungs = [];
    for (let r = 0; r < rows; r++) {
      let mask = 0;
      let gap = 0;
      while (gap < n - 1) {
        if (Math.random() < 0.35) { mask |= (1 << gap); gap += 2; }
        else { gap += 1; }
      }
      rungs.push(mask);
    }
    return rungs;
  }

  function traceColumn(startCol, rungs, n) {
    let col = startCol;
    const pts = [{ x: startCol, y: 0 }];
    for (let r = 0; r < rungs.length; r++) {
      if (col < n - 1 && hasRung(rungs, r, col)) { pts.push({ x: col, y: r + 1 }); col += 1; pts.push({ x: col, y: r + 1 }); }
      else if (col > 0 && hasRung(rungs, r, col - 1)) { pts.push({ x: col, y: r + 1 }); col -= 1; pts.push({ x: col, y: r + 1 }); }
      else { pts.push({ x: col, y: r + 1 }); }
    }
    pts.push({ x: col, y: rungs.length + 1 });
    return { endCol: col, gridPts: pts };
  }

  function renderApp() {
    const hasRoom = hasActiveRoom();
    $('no-room-block').style.display = (!hasRoom && !creatingFormOpen) ? 'block' : 'none';
    $('create-form').style.display = (!hasRoom && creatingFormOpen) ? 'block' : 'none';
    $('room-block').style.display = hasRoom ? 'block' : 'none';
    if (hasRoom) renderRoomBlock();
  }

  function renderRoomBlock() {
    const room = currentRoom;
    const block = $('room-block');

    if (room.status === 'waiting') {
      renderedPlayingRoomId = null;
      const participants = room.participants || [];
      const full = participants.length >= room.items.length;
      const iJoined = participants.some((p) => p.uid === myUid);

      const rows = participants.map((p, i) => `
        <div class="participant-row">
          <span class="dot" style="background:${MARKER_COLORS[i % MARKER_COLORS.length]}"></span>
          <span>${escapeHtml(p.name)}</span>
          ${p.uid === myUid ? '<span class="me-tag">나</span>' : ''}
        </div>`).join('');
      const emptySlots = Array.from({ length: Math.max(0, room.items.length - participants.length) })
        .map(() => `<div class="participant-empty-row">대기 중…</div>`).join('');

      block.innerHTML = `
        <div class="card">
          <span class="capacity-badge">${participants.length} / ${room.items.length}명 참가</span>
          <div class="participant-list">${rows}${emptySlots}</div>
          ${!iJoined ? `<button class="submit-btn" onclick="window.__tld.joinRoom()" ${full ? 'disabled' : ''}>${full ? '정원이 다 찼어요' : '참가하기'}</button>` : ''}
          ${iJoined && !full ? `<div class="empty-state" style="padding:8px 0 0;">참가 완료! 다른 팀원을 기다리는 중…</div>` : ''}
          ${full ? `<button class="submit-btn" onclick="window.__tld.startRoom()" style="margin-top:${iJoined ? '0' : '10px'};">시작하기 →</button>` : ''}
          <button class="cancel-link" onclick="window.__tld.closeRoom()">이 사다리 취소하기</button>
        </div>`;
      return;
    }

    if (room.status === 'playing' || room.status === 'done') {
      if (renderedPlayingRoomId === room.id) return;
      renderedPlayingRoomId = room.id;
      renderLadder(room);
      return;
    }
  }

  function renderLadder(room) {
    const block = $('room-block');
    const participants = room.participants;
    const items = room.items;
    const rungs = room.rungs;
    const n = participants.length;

    const colW = 56, topPad = 20, rowH = 22, sidePad = 36;
    const width = sidePad * 2 + colW * (n - 1);
    const height = topPad * 2 + rowH * (rungs.length + 1) + 30;

    function px(col) { return sidePad + col * colW; }
    function py(rowIdx) { return topPad + rowIdx * rowH; }

    let linesSvg = '';
    for (let c = 0; c < n; c++) {
      linesSvg += `<line class="ladder-line" x1="${px(c)}" y1="${py(0)}" x2="${px(c)}" y2="${py(rungs.length + 1)}" />`;
    }
    for (let r = 0; r < rungs.length; r++) {
      for (let g = 0; g < n - 1; g++) {
        if (hasRung(rungs, r, g)) {
          linesSvg += `<line class="ladder-rung" x1="${px(g)}" y1="${py(r + 1)}" x2="${px(g + 1)}" y2="${py(r + 1)}" />`;
        }
      }
    }

    let markersSvg = '';
    const traces = [];
    for (let c = 0; c < n; c++) {
      const { endCol, gridPts } = traceColumn(c, rungs, n);
      traces.push({ startCol: c, endCol, gridPts, color: MARKER_COLORS[c % MARKER_COLORS.length] });
      markersSvg += `<circle class="ladder-marker" id="marker-${c}" cx="${px(c)}" cy="${py(0)}" r="6" fill="${MARKER_COLORS[c % MARKER_COLORS.length]}" stroke="#1A1E2E" stroke-width="1.5" />`;
    }

    let labelsSvg = '';
    for (let c = 0; c < n; c++) {
      labelsSvg += `<text class="ladder-item-label" x="${px(c)}" y="${py(rungs.length + 1) + 22}" text-anchor="middle" font-size="10">${escapeHtml(items[c] || '')}</text>`;
    }

    const legend = participants.map((p, i) =>
      `<span class="legend-chip"><span class="dot" style="background:${MARKER_COLORS[i % MARKER_COLORS.length]}"></span>${escapeHtml(p.name)}</span>`
    ).join('');

    block.innerHTML = `
      <div class="card">
        <div class="legend-list">${legend}</div>
        <div class="ladder-wrap">
          <svg class="ladder-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            ${linesSvg}
            ${labelsSvg}
            ${markersSvg}
          </svg>
        </div>
        <div id="ladder-result-area"></div>
      </div>`;

    const stepDuration = 130;
    traces.forEach((t) => {
      const el = $('marker-' + t.startCol);
      let i = 0;
      function step() {
        if (i >= t.gridPts.length) return;
        const pt = t.gridPts[i];
        el.setAttribute('cx', px(pt.x));
        el.setAttribute('cy', py(pt.y));
        i++;
        if (i < t.gridPts.length) setTimeout(step, stepDuration);
      }
      step();
    });

    const totalDuration = stepDuration * Math.max(...traces.map((t) => t.gridPts.length)) + 300;
    setTimeout(() => showLadderResult(room, traces), totalDuration);
  }

  function showLadderResult(room, traces) {
    const area = $('ladder-result-area');
    if (!area) return;
    const rows = traces.map((t) => {
      const p = room.participants[t.startCol];
      const item = room.items[t.endCol];
      const color = MARKER_COLORS[t.startCol % MARKER_COLORS.length];
      return `
        <div class="result-row">
          <div class="name-row"><span class="dot" style="background:${color}"></span><span class="name">${escapeHtml(p.name)}</span></div>
          <div class="item-row"><span class="arrow">→</span><span class="item">${escapeHtml(item)}</span></div>
        </div>`;
    }).join('');
    area.innerHTML = `
      <div class="result-list" style="margin-top:16px;">${rows}</div>
      <div class="result-actions">
        <button class="white-btn" onclick="window.__tld.shareLadderResult()">📤 결과 공유하기</button>
        <button class="submit-btn" onclick="window.__tld.dismissRoom()">닫기</button>
      </div>`;
    if (room.status !== 'done') {
      colTeamLadders.doc(room.id).update({ status: 'done' }).catch(() => {});
    }
  }

  async function shareLadderResult() {
    if (!currentRoom || !currentRoom.participants || !currentRoom.items) return;
    const n = currentRoom.participants.length;
    const lines = currentRoom.participants.map((p, i) => {
      const { endCol } = traceColumn(i, currentRoom.rungs || [], n);
      const item = currentRoom.items[endCol] != null ? currentRoom.items[endCol] : '';
      return `${p.name} → ${item}`;
    });
    const text = `🪜 피더 사다리타기 결과\n\n${lines.join('\n')}`;
    if (navigator.share) {
      try { await navigator.share({ title: '피더 사다리타기 결과', text }); }
      catch (e) { if (e.name !== 'AbortError') alert('공유에 실패했어요.'); }
      return;
    }
    alert('이 브라우저는 공유하기를 지원하지 않아요.');
  }

  function startRoomFeed() {
    if (roomUnsub) return;
    roomUnsub = colTeamLadders.where('teamCode', '==', myTeamCode).onSnapshot((snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
      currentRoom = docs[0] || null;
      if (!currentRoom) renderedPlayingRoomId = null;
      renderApp();
    }, () => {
      $('room-block').innerHTML = '<div class="card"><div class="empty-state">⚠️ 연결 오류. 새로고침 해주세요.</div></div>';
    });
  }

  const unsubProfile = onProfile((profile, user) => {
    if (!user) { myUid = null; go('view-locked'); return; }
    if (!profile || profile.status !== 'approved') { myUid = null; go('view-locked'); return; }
    const teamCode = profile.teamCode || profile.adminTeamCode || null;
    if (!teamCode) { go('view-no-team'); return; }
    myUid = user.uid;
    myName = profile.name;
    myTeamCode = teamCode;
    startRoomFeed();
    go('view-app');
  });

  $('tld-open-create')?.addEventListener('click', openCreateForm);

  window.__tld = {
    go, addCustomItem, closeCreateForm, createRoom, addDraftItem, incDraftItem, decDraftItem,
    joinRoom, startRoom, closeRoom, dismissRoom, shareLadderResult, openHistory, logout,
  };

  return function unmount() {
    unsubProfile();
    unmountHeader();
    if (roomUnsub) roomUnsub();
    delete window.__tld;
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    console.log('[team-ladder-view] unmounted — 구독/스타일 정리 완료');
  };
}
