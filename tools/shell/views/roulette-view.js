// tools/roulette.html 이관. 실시간 다인원 동기화(팀 룰렛 방을 여러 명이 동시에 보고 참여)와
// db.runTransaction()을 쓰는 화면이라, tool-rental-view.js(단순 CRUD)와는 다른 패턴을 검증하는
// 목적도 겸함. 원본의 내부 SPA(go(viewId)로 .view들을 토글하는 방식)는 그대로 유지하고,
// 로그인 게이트만 셸의 onProfile()에 위임했다.

import { auth, db, onProfile } from '../firebase-shell.js?v=25';
import { mountShellHeader } from '../shell-header.js?v=25';
import { navigate } from '../router.js?v=25';

const STYLE_ID = 'view-style-roulette';
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
.rlt-root { font-family: 'Noto Sans KR', sans-serif; color: var(--text); }
.rlt-root .container { max-width: 480px; margin: 0 auto; }
.rlt-root .locked-link { display: block; padding: 16px; background: var(--nav-btn-bg); border: 1.5px solid var(--nav-btn-border); border-radius: 12px; color: var(--orange); text-align: center; text-decoration: none; font-weight: 900; }
.rlt-root .locked-link:hover { background: rgba(255,107,43,0.08); }
.rlt-root header.page-head { text-align: center; padding: 28px 0 24px; }
.rlt-root .header-icon { font-size: 40px; display: block; margin-bottom: 12px; filter: drop-shadow(0 0 12px rgba(255,107,43,0.5)); }
.rlt-root header.page-head h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
.rlt-root .page-sub { font-size: 13px; color: var(--text-dim); margin-top: 6px; }
.rlt-root .sync-indicator { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; font-size: 11px; color: var(--text-dim); }
.rlt-root .sync-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--give); animation: rlt-pulse 2s infinite; }
@keyframes rlt-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
.rlt-root .view { display: none; }
.rlt-root .view.active { display: block; animation: rlt-fadeIn 0.25s ease; }
@keyframes rlt-fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.rlt-root .loading-brand { text-align: center; padding-top: 60px; }
.rlt-root .loading-brand-title { font-size: 22px; font-weight: 900; color: var(--text); letter-spacing: -0.5px; }
.rlt-root .loading-brand-sub { font-size: 13px; color: var(--text-dim); margin-top: 8px; }
.rlt-root .card { background: var(--steel-mid); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
.rlt-root .section-label { font-size: 12px; font-weight: 700; color: var(--text-dim); letter-spacing: 0.8px; margin-bottom: 12px; }
.rlt-root .empty-state { text-align: center; padding: 32px 16px; color: var(--text-dim); font-size: 14px; line-height: 1.7; }
.rlt-root .empty-icon { font-size: 30px; display: block; margin-bottom: 10px; opacity: 0.6; }
.rlt-root .submit-btn { width: 100%; padding: 16px; background: var(--orange); border: none; border-radius: 12px; color: white; font-family: inherit; font-size: 16px; font-weight: 900; cursor: pointer; }
.rlt-root .submit-btn:hover { background: var(--orange-dark); }
.rlt-root .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.rlt-root .white-btn { width: 100%; padding: 14px; background: var(--nav-btn-bg); border: 1.5px solid var(--nav-btn-border); border-radius: 12px; color: var(--orange); font-family: inherit; font-size: 15px; font-weight: 900; cursor: pointer; }
.rlt-root .white-btn:hover { background: var(--steel-light); }
.rlt-root .cancel-link { display: block; text-align: center; margin-top: 12px; font-size: 13px; color: var(--text-dim); background: none; border: none; font-family: inherit; cursor: pointer; }
.rlt-root .cancel-link:hover { color: var(--text); }
.rlt-root .field { margin-bottom: 16px; }
.rlt-root .field label { display: block; font-size: 12px; font-weight: 700; color: var(--text-dim); letter-spacing: 0.4px; margin-bottom: 8px; }
.rlt-root .title-input { width: 100%; padding: 12px 14px; background: var(--steel-light); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-family: inherit; font-size: 14px; outline: none; }
.rlt-root .title-input:focus { border-color: var(--orange); }
.rlt-root .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.rlt-root .preset-chip { padding: 9px 14px; background: var(--steel-light); border: 1.5px solid var(--border); border-radius: 20px; color: var(--text); font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.rlt-root .preset-chip:hover { border-color: var(--orange); }
.rlt-root .custom-add-row { display: flex; gap: 8px; margin-top: 10px; }
.rlt-root .custom-add-row input { flex: 1; min-width: 0; padding: 12px 14px; background: var(--steel-light); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-family: inherit; font-size: 14px; outline: none; }
.rlt-root .custom-add-row input:focus { border-color: var(--orange); }
.rlt-root .custom-add-btn { padding: 0 18px; background: var(--steel-light); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.rlt-root .custom-add-btn:hover { border-color: var(--orange); color: var(--orange); }
.rlt-root .draft-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.rlt-root .draft-chip { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(255,107,43,0.12); border: 1px solid rgba(255,107,43,0.3); border-radius: 20px; font-size: 13px; font-weight: 700; color: var(--text); }
.rlt-root .draft-chip button { width: 20px; height: 20px; border-radius: 50%; border: none; background: var(--chip-btn-bg); color: var(--text); font-size: 13px; font-weight: 900; line-height: 1; cursor: pointer; }
.rlt-root .draft-chip button:hover { background: var(--chip-btn-bg-hover); }
.rlt-root .menu-profile { display: flex; align-items: center; gap: 12px; padding: 14px 10px; margin-bottom: 10px; border-radius: 12px; background: var(--steel-light); }
.rlt-root .menu-profile-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--orange); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; flex-shrink: 0; }
.rlt-root .menu-profile-info { flex: 1; min-width: 0; }
.rlt-root .menu-profile-name { font-size: 15px; font-weight: 900; color: var(--text); }
.rlt-root .menu-profile-role { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
.rlt-root .menu-profile-code { font-size: 11px; font-weight: 700; color: var(--orange); margin-top: 3px; }
.rlt-root .room-title { font-size: 16px; font-weight: 900; margin-bottom: 14px; text-align: center; }
.rlt-root .capacity-badge { display: inline-block; font-size: 12px; font-weight: 900; color: var(--orange); background: rgba(255,107,43,0.12); padding: 4px 12px; border-radius: 20px; margin-bottom: 14px; }
.rlt-root .collect-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.rlt-root .collect-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--steel-light); border-radius: 10px; font-size: 14px; font-weight: 700; }
.rlt-root .collect-row .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.rlt-root .collect-row .who { margin-left: auto; font-size: 11px; color: var(--text-dim); font-weight: 700; }
.rlt-root .collect-row .remove-btn { width: 22px; height: 22px; border-radius: 50%; border: none; background: var(--chip-btn-bg); color: var(--text); font-size: 13px; font-weight: 900; line-height: 1; cursor: pointer; flex-shrink: 0; }
.rlt-root .collect-row .remove-btn:hover { background: var(--chip-btn-bg-hover); }
.rlt-root .collect-empty-row { padding: 10px 14px; border: 1.5px dashed var(--border); border-radius: 10px; font-size: 13px; color: var(--text-dim); text-align: center; }
.rlt-root .wheel-wrap { position: relative; display: flex; justify-content: center; margin-bottom: 18px; }
.rlt-root .wheel-svg { display: block; max-width: 100%; height: auto; }
.rlt-root .wheel-group { transform-origin: 150px 160px; transition: transform 4.5s cubic-bezier(0.17,0.67,0.12,0.99); }
.rlt-root .result-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.rlt-root .result-row { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: var(--steel-light); border-radius: 10px; font-size: 14px; animation: rlt-slideIn 0.3s ease; }
@keyframes rlt-slideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.rlt-root .winner-card { text-align: center; padding: 24px 16px; }
.rlt-root .winner-label { font-size: 12px; font-weight: 700; color: var(--text-dim); letter-spacing: 0.6px; margin-bottom: 8px; }
.rlt-root .winner-text { font-size: 26px; font-weight: 900; color: var(--orange); word-break: break-word; }
.rlt-root .result-actions { display: flex; flex-direction: column; gap: 10px; }
.rlt-root .history-list { display: flex; flex-direction: column; gap: 14px; }
.rlt-root .history-card { padding: 16px; }
.rlt-root .history-date { font-size: 12px; font-weight: 700; color: var(--text-dim); margin-bottom: 10px; }
.rlt-root .history-winner { font-size: 16px; font-weight: 900; color: var(--orange); margin-bottom: 8px; }
.rlt-root .history-items { font-size: 12px; color: var(--text-dim); line-height: 1.6; }
`;

const TEMPLATE = `
<div class="rlt-root">
  <div class="container">
    <div class="view active" id="view-checking">
      <div class="loading-brand">
        <div class="loading-brand-title">Feeder</div>
        <div class="loading-brand-sub">불러오는 중…</div>
      </div>
    </div>
    <div class="view" id="view-locked">
      <header class="page-head">
        <span class="header-icon">🔒</span>
        <h1>로그인이 필요해요</h1>
        <div class="page-sub">피더 홈에서 로그인 후 다시 들어와주세요</div>
      </header>
      <div class="card"><a href="/tools/index.html?login=1" class="locked-link">로그인하러 가기 →</a></div>
    </div>
    <div class="view" id="view-no-team">
      <header class="page-head">
        <span class="header-icon">🎡</span><h1>룰렛돌리기</h1>
        <div class="page-sub">팀 코드가 있어야 팀원들과 같이 즐길 수 있어요</div>
      </header>
      <div class="card"><a href="/tools/index.html" class="locked-link" data-route="home">피더 홈으로 →</a></div>
    </div>
    <div class="view" id="view-app">
      <header class="page-head">
        <span class="header-icon">🎡</span><h1>룰렛돌리기</h1>
        <div class="sync-indicator"><span class="sync-dot"></span>실시간 공유 중</div>
      </header>
      <div id="no-room-block">
        <div class="card"><div class="empty-state"><span class="empty-icon">🎡</span>진행중인 룰렛이 없어요</div></div>
        <button class="submit-btn" id="rlt-open-create">+ 새 룰렛 만들기</button>
      </div>
      <div class="card" id="create-form" style="display:none;">
        <div class="field">
          <label>제목 (선택)</label>
          <input type="text" id="room-title-input" class="title-input" placeholder="예: 오늘 저녁 뭐 먹지" maxlength="30" />
        </div>
        <div class="field">
          <label>룰렛 항목 고르기</label>
          <div class="chip-row" id="preset-chip-row"></div>
          <div class="custom-add-row">
            <input type="text" id="custom-item-input" placeholder="직접 입력 (예: 순두부찌개)" />
            <button class="custom-add-btn" onclick="window.__rlt.addCustomItem()">추가</button>
          </div>
        </div>
        <div class="field" id="draft-list-field" style="display:none;">
          <label>추가된 항목</label>
          <div class="draft-list" id="draft-list"></div>
        </div>
        <button class="submit-btn" id="create-submit-btn" onclick="window.__rlt.createRoom()">룰렛 만들기 →</button>
        <button class="cancel-link" onclick="window.__rlt.closeCreateForm()">취소</button>
      </div>
      <div id="room-block" style="display:none;"></div>
    </div>
    <div class="view" id="view-history">
      <header class="page-head"><span class="header-icon">🗂️</span><h1>지난 기록</h1></header>
      <div id="history-block"></div>
      <button class="white-btn" onclick="window.__rlt.go('view-app')">‹ 룰렛돌리기로</button>
    </div>
  </div>
</div>
`;

const colTeamRoulettes = db.collection('team_roulettes');
const PRESET_ITEMS = ['🍗 치킨', '🍕 피자', '🍜 중식', '🍚 국밥', '🍔 버거', '🍲 찌개'];
const MARKER_COLORS = ['#FF6B2B','#3BE88A','#4FC3F7','#FFD54F','#BA68C8','#FF8A80','#81C784','#F06292','#90A4AE','#FFB74D'];

export function mount(container) {
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
  }
  container.innerHTML = TEMPLATE;
  const unmountHeader = mountShellHeader(container.querySelector('.rlt-root'), {
    menuItems: [
      { icon: '🎮', label: '게임모음', onClick: () => navigate('games') },
      { icon: '🗂️', label: '지난 기록', onClick: () => openHistory() },
    ],
  });

  const $ = (id) => document.getElementById(id);

  let myUid = null, myName = '', myTeamCode = null;
  let roomUnsub = null;
  let currentRoom = null;
  let draftItems = [];
  let creatingFormOpen = false;
  let renderedSpinningRoomId = null;
  let dismissedRoomId = null;

  function hasActiveRoom() {
    return !!currentRoom && currentRoom.id !== dismissedRoomId;
  }

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
      `<button class="preset-chip" onclick="window.__rlt.addDraftItem('${item.replace(/'/g,"\\'")}')">${escapeHtml(item)}</button>`
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
          <button onclick="window.__rlt.decDraftItem(${i})" aria-label="빼기">−</button>
          <span>${escapeHtml(d.name)} ×${d.count}</span>
          <button onclick="window.__rlt.incDraftItem(${i})" aria-label="더하기">+</button>
        </span>`).join('');
    }
    $('create-submit-btn').disabled = draftTotal() < 2;
  }

  function openCreateForm() {
    if (hasActiveRoom()) return;
    draftItems = [];
    $('room-title-input').value = '';
    renderPresetChips();
    renderDraftList();
    creatingFormOpen = true;
    renderApp();
  }

  function closeCreateForm() { creatingFormOpen = false; renderApp(); }

  function createRoom() {
    const flatNames = draftItems.flatMap((d) => Array(d.count).fill(d.name));
    if (flatNames.length < 2) { alert('룰렛 항목을 2개 이상 추가해주세요!'); return; }
    const title = $('room-title-input').value.trim();
    const items = flatNames.map((name) => ({ text: name, addedByUid: myUid, addedByName: myName }));
    const btn = $('create-submit-btn');
    btn.disabled = true;
    colTeamRoulettes.add({
      teamCode: myTeamCode, title, status: 'collecting', items,
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

  function addItemLive(text) {
    if (!currentRoom) return;
    const ref = colTeamRoulettes.doc(currentRoom.id);
    db.runTransaction((tx) => tx.get(ref).then((doc) => {
      if (!doc.exists) return;
      const data = doc.data();
      if (data.status !== 'collecting') return;
      const items = data.items || [];
      items.push({ text, addedByUid: myUid, addedByName: myName });
      tx.update(ref, { items });
    })).catch((err) => {
      console.error('addItemLive failed:', err);
      alert('추가 실패 (' + (err.code || err.message) + ')');
    });
  }

  function addLiveCustomItem() {
    const input = $('live-item-input');
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    addItemLive(val);
  }

  function removeItemLive(idx) {
    if (!currentRoom) return;
    const ref = colTeamRoulettes.doc(currentRoom.id);
    db.runTransaction((tx) => tx.get(ref).then((doc) => {
      if (!doc.exists) return;
      const data = doc.data();
      if (data.status !== 'collecting') return;
      const items = data.items || [];
      const item = items[idx];
      if (!item) return;
      const canRemove = item.addedByUid === myUid || data.createdBy === myUid;
      if (!canRemove) return;
      items.splice(idx, 1);
      tx.update(ref, { items });
    })).catch((err) => {
      console.error('removeItemLive failed:', err);
      alert('삭제 실패 (' + (err.code || err.message) + ')');
    });
  }

  function spinRoom() {
    if (!currentRoom) return;
    const ref = colTeamRoulettes.doc(currentRoom.id);
    db.runTransaction((tx) => tx.get(ref).then((doc) => {
      if (!doc.exists) return;
      const data = doc.data();
      if (data.status !== 'collecting') return;
      const items = data.items || [];
      if (items.length < 2) { throw new Error('not-enough'); }
      const winnerIndex = Math.floor(Math.random() * items.length);
      tx.update(ref, { status: 'spinning', winnerIndex, spunAt: firebase.firestore.FieldValue.serverTimestamp() });
    })).catch((err) => {
      if (err && err.message === 'not-enough') { alert('항목이 2개 이상이어야 돌릴 수 있어요!'); return; }
      console.error('spinRoom failed:', err);
      alert('돌리기 실패 (' + (err.code || err.message) + ')');
    });
  }

  function closeRoom() {
    if (!currentRoom) return;
    if (!confirm('이 룰렛을 취소할까요?')) return;
    colTeamRoulettes.doc(currentRoom.id).delete().catch(() => alert('처리 실패. 다시 시도해주세요.'));
  }

  function dismissRoom() {
    if (currentRoom) dismissedRoomId = currentRoom.id;
    renderApp();
  }

  function rematchRoom() {
    if (!currentRoom) return;
    const items = currentRoom.items || [];
    if (items.length < 2) return;
    dismissedRoomId = currentRoom.id;
    colTeamRoulettes.add({
      teamCode: myTeamCode, title: currentRoom.title || '', status: 'collecting', items,
      createdBy: myUid, createdByName: myName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch((err) => {
      console.error('rematchRoom failed:', err);
      alert('처리 실패 (' + (err.code || err.message) + ')');
    });
  }

  function openHistory() { go('view-history'); loadHistory(); }

  function fmtRoomDate(room) {
    const t = room.spunAt || room.createdAt;
    if (!t) return '';
    return t.toDate().toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function loadHistory() {
    const block = $('history-block');
    block.innerHTML = '<div class="card"><div class="empty-state">불러오는 중…</div></div>';
    colTeamRoulettes.where('teamCode', '==', myTeamCode).where('status', '==', 'done').get()
      .then((snap) => {
        const rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rooms.sort((a, b) => {
          const ta = (a.spunAt || a.createdAt);
          const tb = (b.spunAt || b.createdAt);
          return (tb ? tb.toMillis() : 0) - (ta ? ta.toMillis() : 0);
        });
        if (!rooms.length) {
          block.innerHTML = '<div class="card"><div class="empty-state"><span class="empty-icon">🗂️</span>아직 완료된 룰렛 기록이 없어요</div></div>';
          return;
        }
        block.innerHTML = `<div class="history-list">${rooms.map(renderHistoryCard).join('')}</div>`;
      })
      .catch(() => {
        block.innerHTML = '<div class="card"><div class="empty-state">⚠️ 기록을 불러오지 못했어요.</div></div>';
      });
  }

  function renderHistoryCard(room) {
    const items = room.items || [];
    const winner = items[room.winnerIndex] ? items[room.winnerIndex].text : '';
    const itemsText = items.map((it) => it.text).join(', ');
    return `
      <div class="card history-card">
        <div class="history-date">${escapeHtml(fmtRoomDate(room))}${room.title ? ' · ' + escapeHtml(room.title) : ''}</div>
        <div class="history-winner">🎉 ${escapeHtml(winner)}</div>
        <div class="history-items">${escapeHtml(itemsText)}</div>
      </div>`;
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

    if (room.status === 'collecting') {
      renderedSpinningRoomId = null;
      const items = room.items || [];
      const rows = items.map((it, i) => `
        <div class="collect-row">
          <span class="dot" style="background:${MARKER_COLORS[i % MARKER_COLORS.length]}"></span>
          <span>${escapeHtml(it.text)}</span>
          <span class="who">${escapeHtml(it.addedByName || '')}</span>
          <button class="remove-btn" onclick="window.__rlt.removeItemLive(${i})" aria-label="삭제">✕</button>
        </div>`).join('');
      const empty = !items.length ? `<div class="collect-empty-row">아직 항목이 없어요</div>` : '';

      block.innerHTML = `
        <div class="card">
          ${room.title ? `<div class="room-title">${escapeHtml(room.title)}</div>` : ''}
          <span class="capacity-badge">${items.length}개 항목</span>
          <div class="collect-list">${rows}${empty}</div>
          <div class="field">
            <label>항목 추가</label>
            <div class="chip-row" id="live-preset-chip-row">${PRESET_ITEMS.map((p) => `<button class="preset-chip" onclick="window.__rlt.addItemLive('${p.replace(/'/g,"\\'")}')">${escapeHtml(p)}</button>`).join('')}</div>
            <div class="custom-add-row">
              <input type="text" id="live-item-input" placeholder="직접 입력" />
              <button class="custom-add-btn" onclick="window.__rlt.addLiveCustomItem()">추가</button>
            </div>
          </div>
          <button class="submit-btn" onclick="window.__rlt.spinRoom()" ${items.length < 2 ? 'disabled' : ''}>🎡 돌리기</button>
          <button class="cancel-link" onclick="window.__rlt.closeRoom()">이 룰렛 취소하기</button>
        </div>`;
      return;
    }

    if (room.status === 'spinning' || room.status === 'done') {
      if (renderedSpinningRoomId === room.id) return;
      renderedSpinningRoomId = room.id;
      renderWheel(room);
      return;
    }
  }

  function truncateLabel(text) { return text.length > 7 ? text.slice(0, 6) + '…' : text; }
  function polarPoint(cx, cy, r, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
  }

  function buildWheelSvg(items) {
    const cx = 150, cy = 160, r = 120;
    const n = items.length;
    const sliceAngle = 360 / n;
    let slicesSvg = '';
    for (let i = 0; i < n; i++) {
      const start = i * sliceAngle, end = (i + 1) * sliceAngle;
      const large = sliceAngle > 180 ? 1 : 0;
      const p0 = polarPoint(cx, cy, r, start);
      const p1 = polarPoint(cx, cy, r, end);
      const color = MARKER_COLORS[i % MARKER_COLORS.length];
      slicesSvg += `<path d="M ${cx},${cy} L ${p0.x.toFixed(2)},${p0.y.toFixed(2)} A ${r},${r} 0 ${large} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)} Z" fill="${color}" stroke="#1A1E2E" stroke-width="1.5" />`;
      const mid = start + sliceAngle / 2;
      slicesSvg += `<text transform="rotate(${mid.toFixed(2)} ${cx} ${cy})" x="${cx}" y="${(cy - r * 0.62).toFixed(2)}" text-anchor="middle" font-size="12" font-weight="700" fill="#1A1E2E">${escapeHtml(truncateLabel(items[i].text))}</text>`;
    }
    return `
      <svg class="wheel-svg" width="300" height="320" viewBox="0 0 300 320">
        <g class="wheel-group" id="wheel-group">
          <circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="#1A1E2E" stroke-width="2" />
          ${slicesSvg}
        </g>
        <circle cx="${cx}" cy="${cy}" r="10" fill="#1A1E2E" stroke="${MARKER_COLORS[0]}" stroke-width="2" />
        <polygon points="140,22 160,22 150,44" fill="var(--orange)" stroke="#1A1E2E" stroke-width="1.5" />
      </svg>`;
  }

  function renderWheel(room) {
    const block = $('room-block');
    const items = room.items || [];
    const n = items.length;

    block.innerHTML = `
      <div class="card">
        ${room.title ? `<div class="room-title">${escapeHtml(room.title)}</div>` : ''}
        <div class="wheel-wrap">${buildWheelSvg(items)}</div>
        <div id="roulette-result-area"></div>
      </div>`;

    const group = $('wheel-group');
    const sliceAngle = 360 / n;
    const winnerMid = room.winnerIndex * sliceAngle + sliceAngle / 2;
    const extraSpins = 5;
    const rotation = extraSpins * 360 + ((360 - winnerMid) % 360);

    group.style.transform = 'rotate(0deg)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { group.style.transform = `rotate(${rotation}deg)`; });
    });
    group.addEventListener('transitionend', () => showRouletteResult(room), { once: true });
  }

  function showRouletteResult(room) {
    const area = $('roulette-result-area');
    if (!area) return;
    const items = room.items || [];
    const winner = items[room.winnerIndex] ? items[room.winnerIndex].text : '';
    area.innerHTML = `
      <div class="winner-card">
        <div class="winner-label">당첨</div>
        <div class="winner-text">🎉 ${escapeHtml(winner)}</div>
      </div>
      <div class="result-actions">
        <button class="white-btn" onclick="window.__rlt.shareRouletteResult()">📤 결과 공유하기</button>
        <button class="white-btn" onclick="window.__rlt.rematchRoom()">🔁 같은 항목으로 다시 돌리기</button>
        <button class="submit-btn" onclick="window.__rlt.dismissRoom()">닫기</button>
      </div>`;
    if (room.status !== 'done') {
      colTeamRoulettes.doc(room.id).update({ status: 'done' }).catch(() => {});
    }
  }

  async function shareRouletteResult() {
    if (!currentRoom) return;
    const items = currentRoom.items || [];
    const winner = items[currentRoom.winnerIndex] ? items[currentRoom.winnerIndex].text : '';
    const title = currentRoom.title ? `[${currentRoom.title}] ` : '';
    const text = `🎡 ${title}피더 룰렛 결과\n\n🎉 당첨: ${winner}`;
    if (navigator.share) {
      try { await navigator.share({ title: '피더 룰렛 결과', text }); }
      catch (e) { if (e.name !== 'AbortError') alert('공유에 실패했어요.'); }
      return;
    }
    alert('이 브라우저는 공유하기를 지원하지 않아요.');
  }

  function startRoomFeed() {
    if (roomUnsub) return;
    roomUnsub = colTeamRoulettes.where('teamCode', '==', myTeamCode).onSnapshot((snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
      currentRoom = docs[0] || null;
      if (!currentRoom) renderedSpinningRoomId = null;
      renderApp();
    }, () => {
      $('room-block').innerHTML = '<div class="card"><div class="empty-state">⚠️ 연결 오류. 새로고침 해주세요.</div></div>';
    });
  }

  // 셸의 공용 프로필 구독에 얹혀서 승인 여부/팀코드만 확인 — 문서 구독 자체는 셸이 1번만 함
  const unsubProfile = onProfile((profile, user) => {
    if (!user) {
      myUid = null;
      go('view-locked');
      return;
    }
    if (!profile || profile.status !== 'approved') {
      myUid = null;
      go('view-locked');
      return;
    }
    const teamCode = profile.teamCode || (profile.isAdmin ? profile.adminTeamCode : null) || null;
    if (!teamCode) {
      go('view-no-team');
      return;
    }
    myUid = user.uid;
    myName = profile.name;
    myTeamCode = teamCode;

    startRoomFeed();
    go('view-app');
  });

  $('rlt-open-create')?.addEventListener('click', openCreateForm);

  window.__rlt = {
    go, addCustomItem, closeCreateForm, createRoom, addDraftItem, incDraftItem, decDraftItem,
    addItemLive, addLiveCustomItem, removeItemLive, spinRoom, closeRoom, dismissRoom, rematchRoom,
    shareRouletteResult, openHistory, logout,
  };

  return function unmount() {
    unsubProfile();
    unmountHeader();
    if (roomUnsub) roomUnsub();
    delete window.__rlt;
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    console.log('[roulette-view] unmounted — 구독/스타일 정리 완료');
  };
}
