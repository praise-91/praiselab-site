// tools/gongsu-calendar.html 이관. 다른 9개 화면과 달리 이 화면은 React를 통째로 minify해서
// 박아넣은 미니 SPA(세금/공수 계산 + 팀 랭킹)라서 이관 방식이 근본적으로 다르다:
//  - React/ReactDOM 라이브러리 코드(react.production.min.js, react-dom.production.min.js)는
//    수정할 필요가 전혀 없어서 원본에서 그대로 잘라 tools/shell/vendor/에 정적 파일로 분리해두고
//    이 뷰가 마운트될 때만 classic <script>로 로드한다(window.React/window.ReactDOM UMD 전역).
//  - 실제 앱 컴포넌트 코드(세율 상수, computeSummary, App 컴포넌트 등 1500여 줄)는
//    tools/shell/views/gongsu-calendar-app.js로 그대로 옮기고 맨 끝에 `export { App }`만 추가함
//    — React.createElement 호출부는 원본과 100% 동일, 로직은 전혀 안 건드림.
//  - CSS도 gg-*/gc-* 접두사라 다른 화면과 충돌 위험이 거의 없어서 스코프 접두사 없이
//    tools/shell/views/gongsu-calendar.css로 그대로 분리, <link> 태그로 로드/제거.
//  - 원본은 이 화면 자체가 auth.onAuthStateChanged를 직접 구독해서 window.gcMyUid 등
//    전역을 채운 뒤 window.gcStartApp()(=ReactDOM.createRoot(...).render(...))를 불렀는데,
//    여기선 셸의 onProfile()에서 똑같은 전역들을 채우고 React 루트를 만든다.

import { auth, db, onProfile } from '../firebase-shell.js?v=5';

const STYLE_HREF = '/tools/shell/views/gongsu-calendar.css';
const STYLE_ID = 'view-style-gongsu-calendar';

const TEMPLATE = `
<div class="gc-locked" id="gc-loading" style="display:flex;">
  <span class="gc-locked-icon">📅</span>
  <h1 id="gc-loading-title">불러오는 중…</h1>
  <p id="gc-loading-sub">잠시만 기다려주세요</p>
  <a href="javascript:void(0)" id="gc-loading-retry" style="display:none;">다시 시도 →</a>
</div>
<div class="gc-locked" id="gc-locked" style="display:none;">
  <span class="gc-locked-icon">🔒</span>
  <h1>로그인이 필요해요</h1>
  <p>피더 홈에서 로그인 후 다시 들어와주세요</p>
  <a href="/tools/index.html" data-route="home">피더 홈으로 →</a>
</div>
<div class="gc-admin-banner" id="gc-admin-banner" style="display:none;">
  🔧 팀장 모드: <span id="gc-admin-target-name"></span>님의 공수달력 수정 중
  <a href="/tools/gongsu-admin.html">← 팀장 화면으로</a>
</div>
<div id="gc-react-root"></div>
`;

const colToolsUsers = db.collection('tools_users');
const colGongsuCalendars = db.collection('gongsu_calendars');
const colGongsuLeaderboard = db.collection('gongsu_leaderboard');
const colGongsuSiteRestDays = db.collection('gongsu_site_restdays');

// 원본의 gcGuestStorage와 동일 — 게스트(비로그인)는 이 기기 로컬에만 저장
const gcGuestStorage = {
  async get(key) {
    const raw = localStorage.getItem('gc_guest_' + key);
    if (raw == null) throw new Error('not found');
    return { key, value: raw };
  },
  async set(key, value) {
    localStorage.setItem('gc_guest_' + key, value);
    return { key, value };
  },
};

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') { resolve(); return; }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => { s.dataset.loaded = '1'; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function mount(container) {
  // gongsu-calendar-app.js는 원본처럼 모듈 스코프가 아닌 전역 gcLogout()을 그대로 호출한다
  // (React 컴포넌트 코드는 원본과 100% 동일하게 유지) — 여기서 전역에 채워주고 unmount 때 지운다.
  window.gcLogout = () => auth.signOut();

  if (!document.getElementById(STYLE_ID)) {
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = STYLE_HREF;
    document.head.appendChild(link);
  }
  container.innerHTML = TEMPLATE;

  const $ = (id) => document.getElementById(id);

  let reactRoot = null;
  let appStarted = false;
  let cancelled = false;

  // firebase 로딩/렌더 자체가 오래 걸려도 "불러오는 중…"에 무한정 멈춰있지 않게(원본과 동일)
  const retryTimer = setTimeout(() => {
    if ($('gc-loading') && $('gc-loading').style.display !== 'none') {
      $('gc-loading-title').textContent = '연결이 지연되고 있어요';
      $('gc-loading-sub').textContent = '인터넷 연결을 확인해주세요';
      const retry = $('gc-loading-retry');
      retry.style.display = 'inline-block';
      retry.onclick = () => location.reload();
    }
  }, 12000);

  async function startReactApp() {
    if (appStarted) return;
    appStarted = true;
    await loadScriptOnce('/tools/shell/vendor/react.production.min.js');
    await loadScriptOnce('/tools/shell/vendor/react-dom.production.min.js');
    if (cancelled) return;
    const { App } = await import('./gongsu-calendar-app.js?v=5');
    if (cancelled) return;
    reactRoot = window.ReactDOM.createRoot($('gc-react-root'));
    reactRoot.render(window.React.createElement(App));
  }

  function showAppShell() {
    $('gc-loading').style.display = 'none';
    $('gc-locked').style.display = 'none';
  }

  async function startGuest() {
    showAppShell();
    window.gcMyUid = null;
    window.gcMyTeamCode = null;
    window.gcIsAdmin = false;
    window.gcIsGuest = true;
    window.gcTeamRestDays = {};
    window.storage = gcGuestStorage;
    await startReactApp();
  }

  const unsubProfile = onProfile(async (profile, user) => {
    if (cancelled) return;
    if (!user || !profile || profile.status !== 'approved') { await startGuest(); return; }

    showAppShell();
    window.gcIsGuest = false;
    window.gcMyUid = user.uid;
    window.gcMyName = profile.name;
    window.gcMyTeamCode = profile.teamCode || profile.adminTeamCode || null;
    window.gcIsAdmin = !!profile.isAdmin;
    window.colGongsuLeaderboard = colGongsuLeaderboard;

    // 관리자가 ?as=uid로 들어오면 자기 uid 대신 그 팀원의 달력을 보고 수정한다(원본과 동일)
    const asUid = new URLSearchParams(location.search).get('as');
    let targetUid = user.uid;
    let targetName = window.gcMyName;
    let targetTeamCode = window.gcMyTeamCode;
    let targetSiteId = profile.gongsuSiteId || null;
    if (asUid && asUid !== user.uid && profile.isAdmin) {
      try {
        const targetDoc = await colToolsUsers.doc(asUid).get();
        if (targetDoc.exists) {
          targetUid = asUid;
          targetName = targetDoc.data().name;
          targetTeamCode = targetDoc.data().teamCode || targetDoc.data().adminTeamCode || window.gcMyTeamCode;
          targetSiteId = targetDoc.data().gongsuSiteId || null;
          $('gc-admin-target-name').textContent = targetName;
          $('gc-admin-banner').style.display = 'flex';
        }
      } catch (_) { /* noop */ }
    }
    if (cancelled) return;

    window.gcTeamRestDays = {};
    if (targetSiteId) {
      try {
        const rdDoc = await colGongsuSiteRestDays.doc(targetSiteId).get();
        if (rdDoc.exists) window.gcTeamRestDays = rdDoc.data().restDays || {};
      } catch (_) { /* noop */ }
    }
    if (cancelled) return;

    window.gcSyncLeaderboard = async function (entries) {
      const gongsuByDate = {};
      Object.entries(entries || {}).forEach(([date, e]) => {
        if (e && e.gongsu) gongsuByDate[date] = e.gongsu;
      });
      await colGongsuLeaderboard.doc(targetUid).set({
        name: targetName,
        teamCode: targetTeamCode,
        gongsuByDate,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    };

    window.storage = {
      async get(key) {
        const doc = await colGongsuCalendars.doc(targetUid).get();
        if (!doc.exists || doc.data().data == null) throw new Error('not found');
        return { key, value: doc.data().data };
      },
      async set(key, value) {
        try {
          const state = JSON.parse(value);
          await colGongsuCalendars.doc(targetUid).set({
            data: value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          await window.gcSyncLeaderboard(state.entries).catch(() => {});
        } catch (e) {
          alert('저장 실패. 인터넷 연결을 확인해주세요.');
          throw e;
        }
        return { key, value };
      },
    };

    await startReactApp();
  });

  return function unmount() {
    cancelled = true;
    clearTimeout(retryTimer);
    unsubProfile();
    if (reactRoot) {
      try { reactRoot.unmount(); } catch (e) { /* noop */ }
      reactRoot = null;
    }
    delete window.gcMyUid;
    delete window.gcMyName;
    delete window.gcMyTeamCode;
    delete window.gcIsAdmin;
    delete window.gcIsGuest;
    delete window.gcTeamRestDays;
    delete window.gcSyncLeaderboard;
    delete window.colGongsuLeaderboard;
    delete window.storage;
    delete window.gcLogout;
    const link = document.getElementById(STYLE_ID);
    if (link) link.remove();
    console.log('[gongsu-calendar-view] unmounted — React 루트/구독/스타일 정리 완료');
  };
}
