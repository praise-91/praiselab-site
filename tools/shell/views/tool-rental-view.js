// tools/tool-rental.html을 셸 안에서 돌아가는 실제(플레이스홀더 아님) 첫 이관 화면으로 포팅.
// 원본과 로직은 동일하되:
//  - firebase.initializeApp / appCheck.activate / auth.onAuthStateChanged 게이트를 제거하고
//    firebase-shell.js가 이미 갖고 있는 auth/db/onProfile을 그대로 재사용
//  - 원본의 "로그인 게이트"(tools_users 문서 onSnapshot으로 승인 여부 확인)는 셸의
//    onProfile()에 위임 — 여러 화면이 각자 같은 문서를 중복 구독하던 걸 셸이 1번만 구독
//  - 인라인 onclick="save()" 같은 핸들러가 전역 함수를 찾는 문제를 피하려고
//    window.__trv 네임스페이스에만 노출하고 unmount 시 지움(다른 뷰와 이름 충돌 방지)

import { auth, db, onProfile } from '../firebase-shell.js?v=12';
import { mountShellHeader } from '../shell-header.js?v=12';

const STYLE_ID = 'view-style-tool-rental';
const STYLE = `
:root {
  --orange: #FF6B2B;
  --orange-dark: #E05520;
  --steel: #1A1E2E;
  --steel-mid: #252A3D;
  --steel-light: #2E3450;
  --text: #F0F2FF;
  --text-dim: #8892B0;
  --give: #3BE88A;
  --take: #FF6B2B;
  --border: rgba(255,255,255,0.08);
  --header-bg: rgba(26, 30, 46, 0.8);
}
:root[data-theme="light"] {
  --orange: #FF6B2B;
  --orange-dark: #E05520;
  --steel: #F4F3F0;
  --steel-mid: #FFFFFF;
  --steel-light: #F0EFEA;
  --text: #1C1E27;
  --text-dim: #767A85;
  --give: #1E8E56;
  --take: #FF6B2B;
  --border: rgba(0,0,0,0.08);
  --header-bg: rgba(244, 243, 240, 0.8);
}
.trv-root { font-family: 'Noto Sans KR', sans-serif; color: var(--text); }
.trv-root::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,107,43,0.04) 39px, rgba(255,107,43,0.04) 40px),
    repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,107,43,0.04) 39px, rgba(255,107,43,0.04) 40px);
  pointer-events: none;
  z-index: 0;
}
.trv-root .container { max-width: 480px; margin: 0 auto; position: relative; z-index: 1; }
.trv-root .form-card { background: var(--steel-mid); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-bottom: 16px; }
.trv-root .toggle-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
.trv-root .toggle-btn { padding: 14px; border: 2px solid var(--border); border-radius: 12px; background: var(--steel-light); color: var(--text-dim); font-family: inherit; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.trv-root .toggle-btn span.emoji { font-size: 22px; }
.trv-root .toggle-btn.give.active { background: rgba(59,232,138,0.12); border-color: var(--give); color: var(--give); }
.trv-root .toggle-btn.take.active { background: rgba(255,107,43,0.12); border-color: var(--take); color: var(--take); }
.trv-root .field { margin-bottom: 18px; }
.trv-root .field label { display: block; font-size: 12px; font-weight: 700; color: var(--text-dim); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px; }
.trv-root .field input { width: 100%; padding: 14px 16px; background: var(--steel-light); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-family: inherit; font-size: 15px; outline: none; transition: border-color 0.2s; -webkit-appearance: none; }
.trv-root .field input:focus { border-color: var(--orange); }
.trv-root .submit-btn { width: 100%; padding: 16px; background: var(--orange); border: none; border-radius: 12px; color: white; font-family: inherit; font-size: 16px; font-weight: 900; cursor: pointer; letter-spacing: -0.3px; transition: all 0.2s; margin-top: 4px; }
.trv-root .submit-btn:hover { background: var(--orange-dark); transform: translateY(-1px); }
.trv-root .submit-btn:active { transform: translateY(0); }
.trv-root .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.trv-root .toast { position: fixed; top: 24px; left: 50%; transform: translateX(-50%) translateY(-80px); background: var(--give); color: #0a1a0f; padding: 12px 24px; border-radius: 50px; font-size: 14px; font-weight: 700; transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); white-space: nowrap; z-index: 999; }
.trv-root .toast.show { transform: translateX(-50%) translateY(0); }
.trv-root .tab-wrap { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; }
.trv-root .tab-btn { flex: 1; padding: 10px 0; border: 1.5px solid var(--border); border-radius: 10px; background: var(--steel-mid); color: var(--text-dim); font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
.trv-root .tab-btn.active { background: rgba(255,107,43,0.12); border-color: var(--orange); color: var(--text); }
.trv-root .tab-count { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 20px; background: rgba(255,255,255,0.08); }
.trv-root .tab-btn.active .tab-count { background: var(--orange); color: white; }
.trv-root .clear-btn { font-size: 12px; color: #ff4444; background: none; border: 1px solid rgba(255,68,68,0.3); border-radius: 10px; padding: 10px 12px; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.trv-root .clear-btn:hover { background: rgba(255,68,68,0.1); }
.trv-root .record-list { display: flex; flex-direction: column; gap: 10px; }
.trv-root .record-card { background: var(--steel-mid); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; animation: trv-slideIn 0.3s ease; transition: opacity 0.3s; }
.trv-root .record-card.returned { opacity: 0.6; }
.trv-root .card-top { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 12px; }
.trv-root .card-actions { display: flex; gap: 8px; align-items: center; }
.trv-root .return-btn { flex: 1; padding: 7px 0; border-radius: 8px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; border: 1.5px solid rgba(59,232,138,0.4); background: rgba(59,232,138,0.06); color: var(--give); }
.trv-root .return-btn:hover { background: rgba(59,232,138,0.15); }
.trv-root .return-btn.is-returned { border-color: rgba(136,146,176,0.3); background: transparent; color: var(--text-dim); }
.trv-root .return-btn.is-returned:hover { background: rgba(255,255,255,0.04); }
.trv-root .delete-btn { padding: 7px 12px; border-radius: 8px; font-family: inherit; font-size: 13px; cursor: pointer; transition: all 0.2s; border: 1.5px solid rgba(255,68,68,0.25); background: transparent; color: rgba(255,68,68,0.5); flex-shrink: 0; }
.trv-root .delete-btn:hover { background: rgba(255,68,68,0.1); color: #ff4444; border-color: rgba(255,68,68,0.5); }
@keyframes trv-slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.trv-root .record-badge { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
.trv-root .badge-give { background: rgba(59,232,138,0.15); color: var(--give); }
.trv-root .badge-take { background: rgba(255,107,43,0.15); color: var(--take); }
.trv-root .record-info { flex: 1; min-width: 0; }
.trv-root .record-item { font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 4px; word-break: break-all; }
.trv-root .record-meta { font-size: 12px; color: var(--text-dim); }
.trv-root .record-time { font-size: 11px; color: var(--text-dim); white-space: nowrap; flex-shrink: 0; }
.trv-root .empty-state { text-align: center; padding: 40px 20px; color: var(--text-dim); font-size: 14px; }
.trv-root .empty-state .empty-icon { font-size: 36px; display: block; margin-bottom: 12px; opacity: 0.4; }
.trv-root .export-btn { width: 100%; padding: 13px; background: transparent; border: 1.5px solid var(--border); border-radius: 10px; color: var(--text-dim); font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; margin-top: 14px; transition: all 0.2s; letter-spacing: 0.3px; }
.trv-root .export-btn:hover { border-color: var(--orange); color: var(--orange); }
.trv-root .loading-brand { text-align: center; padding-top: 60px; }
.trv-root .loading-brand-title { font-size: 22px; font-weight: 900; color: var(--text); letter-spacing: -0.5px; }
.trv-root .loading-brand-sub { font-size: 13px; color: var(--text-dim); margin-top: 8px; }
.trv-root .locked-wrap { text-align: center; padding: 60px 20px; }
.trv-root .locked-icon { font-size: 40px; display: block; margin-bottom: 16px; }
.trv-root .locked-msg { font-size: 15px; color: var(--text-dim); margin-bottom: 24px; line-height: 1.6; }
.trv-root .locked-link { display: inline-block; padding: 14px 28px; background: #fff; border-radius: 12px; color: var(--orange); text-decoration: none; font-weight: 900; }
.trv-root .locked-link:hover { background: rgba(255,107,43,0.08); }
`;

const TEMPLATE = `
<div class="trv-root">
  <div class="toast" id="trv-toast">✅ 기록 저장 완료!</div>
  <div class="container">
    <div class="loading-brand" id="trv-view-loading">
      <div class="loading-brand-title">Feeder</div>
      <div class="loading-brand-sub">불러오는 중…</div>
    </div>
    <div class="locked-wrap" id="trv-view-locked" style="display:none;">
      <span class="locked-icon">🔒</span>
      <div class="locked-msg">로그인이 필요해요.<br>피더 홈에서 로그인 후 다시 들어와주세요.</div>
      <a href="/tools/index.html?login=1" class="locked-link">로그인하러 가기 →</a>
    </div>
    <div id="trv-view-app" style="display:none;">
      <div class="form-card">
        <div class="toggle-wrap">
          <button class="toggle-btn give active" id="trv-btn-give" onclick="window.__trv.setType('give')">
            <span class="emoji">📤</span>빌려줬어요
          </button>
          <button class="toggle-btn take" id="trv-btn-take" onclick="window.__trv.setType('take')">
            <span class="emoji">📥</span>빌려왔어요
          </button>
        </div>
        <div class="field">
          <label>상대 팀명</label>
          <input type="text" id="trv-team" />
        </div>
        <div class="field">
          <label id="trv-name-label">빌려준 사람 이름</label>
          <input type="text" id="trv-person" />
        </div>
        <div class="field">
          <label>물건 이름</label>
          <input type="text" id="trv-item" />
        </div>
        <button class="submit-btn" id="trv-submit-btn" onclick="window.__trv.save()">기록 저장 →</button>
      </div>
      <div class="tab-wrap">
        <button class="tab-btn active" id="trv-tab-active" onclick="window.__trv.switchTab('active')">
          대여중 <span class="tab-count" id="trv-count-active">0</span>
        </button>
        <button class="tab-btn" id="trv-tab-returned" onclick="window.__trv.switchTab('returned')">
          반납완료 <span class="tab-count" id="trv-count-returned">0</span>
        </button>
        <button class="clear-btn" onclick="window.__trv.clearAll()">삭제</button>
      </div>
      <div class="record-list" id="trv-record-list"></div>
      <button class="export-btn" onclick="window.__trv.shareRecords()">📤 공유하기</button>
    </div>
  </div>
</div>
`;

const col = db.collection('tool_rentals');

export function mount(container) {
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
  }
  container.innerHTML = TEMPLATE;
  const unmountHeader = mountShellHeader(container.querySelector('.trv-root'), {
    showThemeSwitch: true,
    menuItems: [
      {
        icon: '🔑',
        label: '팀장 기능',
        visible: (profile) => !!profile?.isAdmin,
        onClick: () => { location.href = '/tools/index.html?admin=1'; },
      },
    ],
  });

  let type = 'give';
  let records = [];
  let activeTab = 'active';
  let recordsUnsub = null;
  let appStarted = false;

  const $ = (id) => document.getElementById(id);
  const TOAST_DEFAULT_MSG = $('trv-toast').textContent;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg) {
    const t = $('trv-toast');
    if (!t) return;
    t.textContent = msg || TOAST_DEFAULT_MSG;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  function formatTime(ts) {
    if (!ts) return '저장 중…';
    const d = ts.toDate();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  }

  function render() {
    const list = $('trv-record-list');
    if (!list) return;
    const activeRecords = records.filter((r) => !r.returned);
    const returnedRecords = records.filter((r) => r.returned);
    $('trv-count-active').textContent = activeRecords.length;
    $('trv-count-returned').textContent = returnedRecords.length;
    const filtered = activeTab === 'active' ? activeRecords : returnedRecords;
    if (!filtered.length) {
      const msg = activeTab === 'active' ? '대여 중인 항목이 없어요' : '반납완료된 항목이 없어요';
      list.innerHTML = `<div class="empty-state"><span class="empty-icon">🗂️</span>${msg}</div>`;
      return;
    }
    list.innerHTML = filtered.map((r) => `
      <div class="record-card ${r.returned ? 'returned' : ''}">
        <div class="card-top">
          <span class="record-badge ${r.type === 'give' ? 'badge-give' : 'badge-take'}">
            ${r.type === 'give' ? '📤 빌려줌' : '📥 빌려옴'}
          </span>
          <div class="record-info">
            <div class="record-item">🔩 ${escapeHtml(r.item)}</div>
            <div class="record-meta">${escapeHtml(r.team)} · ${escapeHtml(r.person)}</div>
          </div>
          <div class="record-time">${formatTime(r.ts)}</div>
        </div>
        <div class="card-actions">
          <button class="return-btn ${r.returned ? 'is-returned' : ''}"
            onclick="window.__trv.toggleReturn('${r.id}', ${r.returned})">
            ${r.returned ? '↩ 반납취소' : '✅ 반납완료'}
          </button>
          <button class="delete-btn" onclick="window.__trv.deleteOne('${r.id}')">🗑</button>
        </div>
      </div>
    `).join('');
  }

  function setType(t) {
    type = t;
    $('trv-btn-give').classList.toggle('active', t === 'give');
    $('trv-btn-take').classList.toggle('active', t === 'take');
    $('trv-name-label').textContent = t === 'give' ? '빌려준 사람 이름' : '빌려온 사람 이름';
  }

  function save() {
    const team = $('trv-team').value.trim();
    const person = $('trv-person').value.trim();
    const item = $('trv-item').value.trim();
    if (!team || !person || !item) {
      alert('팀명, 이름, 물건 이름을 모두 입력해주세요!');
      return;
    }
    const btn = $('trv-submit-btn');
    btn.disabled = true;
    col.add({
      type, team, person, item, returned: false,
      ts: firebase.firestore.FieldValue.serverTimestamp(),
    })
      .then(() => {
        $('trv-team').value = '';
        $('trv-person').value = '';
        $('trv-item').value = '';
        showToast();
      })
      .catch(() => alert('저장 실패. 인터넷 연결을 확인해주세요.'))
      .finally(() => { btn.disabled = false; });
  }

  function switchTab(tab) {
    activeTab = tab;
    $('trv-tab-active').classList.toggle('active', tab === 'active');
    $('trv-tab-returned').classList.toggle('active', tab === 'returned');
    render();
  }

  function toggleReturn(id, isReturned) {
    col.doc(id).update({ returned: !isReturned }).catch(() => alert('변경 실패. 다시 시도해주세요.'));
  }

  function deleteOne(id) {
    if (!confirm('이 기록을 삭제할까요?')) return;
    col.doc(id).delete().catch(() => alert('삭제 실패. 다시 시도해주세요.'));
  }

  function clearAll() {
    const targets = records.filter((r) => (activeTab === 'active' ? !r.returned : r.returned));
    if (!targets.length) return;
    const label = activeTab === 'active' ? '대여중' : '반납완료';
    if (!confirm(`${label} 기록을 전부 삭제할까요?`)) return;
    const batch = db.batch();
    targets.forEach((r) => batch.delete(col.doc(r.id)));
    batch.commit().catch(() => alert('삭제 실패. 다시 시도해주세요.'));
  }

  function buildRecordsCSVBlob(rows) {
    const csvField = (v) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = '구분,팀명,이름,물건,시간,반납여부\n';
    const body = rows.map((r) => [
      r.type === 'give' ? '빌려줌' : '빌려옴', r.team, r.person, r.item, formatTime(r.ts), r.returned ? '반납완료' : '대여중',
    ].map(csvField).join(',')).join('\n');
    return new Blob(['﻿' + header + body], { type: 'text/csv;charset=utf-8;' });
  }

  function buildRecordsText(rows) {
    let text = '🔧 공구·자재 대여 기록\n';
    rows.forEach((r) => {
      text += `${r.type === 'give' ? '📤 빌려줌' : '📥 빌려옴'} ${r.item} - ${r.team} ${r.person} (${r.returned ? '반납완료' : '대여중'})\n`;
    });
    return text.trim();
  }

  async function shareRecords() {
    if (!records.length) { alert('공유할 데이터가 없어요!'); return; }
    const file = new File([buildRecordsCSVBlob(records)], '공구대여기록.csv', { type: 'text/csv' });
    const text = buildRecordsText(records);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '공구·자재 대여 기록', text }); }
      catch (e) { if (e.name !== 'AbortError') alert('공유에 실패했어요.'); }
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: '공구·자재 대여 기록', text }); }
      catch (e) { if (e.name !== 'AbortError') alert('공유에 실패했어요.'); }
      return;
    }
    alert('이 브라우저는 공유하기를 지원하지 않아요.');
  }

  function startApp() {
    if (appStarted) return;
    appStarted = true;
    $('trv-view-loading').style.display = 'none';
    $('trv-view-locked').style.display = 'none';
    $('trv-view-app').style.display = '';
    recordsUnsub = col.orderBy('ts', 'desc').onSnapshot((snapshot) => {
      records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      render();
    }, () => {
      const list = $('trv-record-list');
      if (list) list.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span>연결 오류. 새로고침 해주세요.</div>';
    });
  }

  function showLocked() {
    appStarted = false;
    if (recordsUnsub) { recordsUnsub(); recordsUnsub = null; }
    $('trv-view-loading').style.display = 'none';
    $('trv-view-locked').style.display = '';
    $('trv-view-app').style.display = 'none';
  }

  // 셸의 공용 프로필 구독에 얹혀서 승인 여부만 확인 — 문서 구독 자체는 셸이 1번만 함
  const unsubProfile = onProfile((profile, user) => {
    if (!user) { showLocked(); return; }
    if (profile && profile.status === 'approved') startApp();
    else showLocked();
  });

  window.__trv = {
    setType, save, switchTab, toggleReturn, deleteOne, clearAll, shareRecords,
  };

  return function unmount() {
    unsubProfile();
    unmountHeader();
    if (recordsUnsub) recordsUnsub();
    delete window.__trv;
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
    console.log('[tool-rental-view] unmounted — 구독/스타일 정리 완료');
  };
}
