// 셸이 딱 1번만 로드/실행하는 Firebase 초기화 모듈.
// ES 모듈이라 이 파일 자체는 브라우저가 URL 기준으로 캐시하고 재실행하지 않는다 —
// 화면(view)이 몇 번을 왔다갔다 해도 이 파일의 top-level 코드(initializeApp,
// appCheck().activate())는 셸 페이지가 살아있는 동안 정확히 1회만 돈다.
// firebase-*-compat.js는 이 모듈이 로드되기 전에 classic <script>로 먼저 로드돼있어야 함(prototype.html 참고).

firebase.initializeApp({
  apiKey: "AIzaSyAIPHUtjoIEjVDmgMgXD3-Moq5oz--2_xY",
  authDomain: "healingcamp-51eb0.firebaseapp.com",
  projectId: "healingcamp-51eb0",
  storageBucket: "healingcamp-51eb0.firebasestorage.app",
  appId: "1:147368194254:web:bb087f46ff60f4db62e09f",
});

let appCheckActivations = 0;
firebase.appCheck().activate(
  new firebase.appCheck.ReCaptchaV3Provider('6LeODVMtAAAAANkeTWgPXGpHO168GqdwwMFQzh7J'),
  true
);
appCheckActivations++;

export function getAppCheckActivationCount() {
  return appCheckActivations;
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const colUsers = db.collection('tools_users');

let _resolveAuthReady;
let _authReadyResolved = false;
export const authReady = new Promise((resolve) => { _resolveAuthReady = resolve; });

let _user = null;
let _profile = null;
let _profileUnsub = null;
export function getUser() { return _user; }
export function getProfile() { return _profile; }

let authChangeCount = 0;
export function getAuthChangeCount() { return authChangeCount; }

// tools_users 문서를 실시간 구독해서(onSnapshot) 승인 상태 변경(예: 관리자가 방금 승인)이
// 화면을 새로고침하지 않아도 바로 반영되게 함 — 기존 각 tool html이 페이지마다 따로
// 갖고 있던 "로그인 게이트" 구독을 셸이 1번만 소유하고, 뷰들은 onProfile()로 구독한다.
const profileListeners = new Set();
function notifyProfileListeners() {
  profileListeners.forEach((fn) => {
    try { fn(_profile, _user); } catch (e) { console.error(e); }
  });
}
// 반환값은 구독 해제 함수. 뷰는 unmount 시 반드시 호출해야 함.
export function onProfile(fn) {
  profileListeners.add(fn);
  if (_authReadyResolved) fn(_profile, _user);
  return () => profileListeners.delete(fn);
}

auth.onAuthStateChanged((user) => {
  authChangeCount++;
  _user = user;
  if (_profileUnsub) { _profileUnsub(); _profileUnsub = null; }

  if (!user) {
    _profile = null;
    _authReadyResolved = true;
    _resolveAuthReady({ user: null, profile: null });
    notifyProfileListeners();
    window.dispatchEvent(new CustomEvent('shell:auth-changed', { detail: { user: null, profile: null } }));
    return;
  }

  _profileUnsub = colUsers.doc(user.uid).onSnapshot((doc) => {
    _profile = doc.exists ? doc.data() : null;
    const detail = { user, profile: _profile };
    if (!_authReadyResolved) {
      _authReadyResolved = true;
      _resolveAuthReady(detail);
    }
    notifyProfileListeners();
    window.dispatchEvent(new CustomEvent('shell:auth-changed', { detail }));
  });
});
