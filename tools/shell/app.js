// ⚠️ 셸 버전 관리 규칙: tools/shell/ 아래 JS를 하나라도 수정하면 ?v=N을 **모든 참조에서
// 한꺼번에** 올려야 한다(진입 HTML 10개의 script 태그 + 모든 정적/동적 import). 일부만
// 올리면 옛날 캐시 모듈과 새 모듈이 한 페이지에 섞여 라우터 인스턴스가 쪼개지는 사고가
// 난다(2026-07-22 "알 수 없는 화면" 백지 장애). 올린 뒤엔 반드시 grep으로 버전 안 붙은
// 셸 참조가 0건인지 확인할 것.
import { authReady, getAppCheckActivationCount } from './firebase-shell.js?v=21';
import { registerView, navigate, currentViewFromUrl, flagShellUpdate } from './router.js?v=21';

registerView('home', () => import('./views/home-view.js?v=21'));
registerView('community', () => import('./views/community-view.js?v=21'));
registerView('tool-rental', () => import('./views/tool-rental-view.js?v=21'));
registerView('roulette', () => import('./views/roulette-view.js?v=21'));
registerView('team-ladder', () => import('./views/team-ladder-view.js?v=21'));
registerView('games', () => import('./views/games-view.js?v=21'));
registerView('qty-report', () => import('./views/qty-report-view.js?v=21'));
registerView('admin-dashboard', () => import('./views/admin-dashboard-view.js?v=21'));
registerView('gongsu-admin', () => import('./views/gongsu-admin-view.js?v=21'));
registerView('gongsu-calendar', () => import('./views/gongsu-calendar-view.js?v=21'));

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-route]');
  if (!a) return;
  e.preventDefault();
  navigate(a.dataset.route);
});

// ── 새 배포 자동 감지 ──
// 이 파일 URL의 ?v= 값이 곧 지금 실행 중인 셸 버전. 진입 HTML은 캐시가 안 되므로
// (max-age=0) 서버 HTML을 다시 읽어 script 태그의 버전과 비교하면 새 배포를 알 수 있다.
// 감지되면 flagShellUpdate()로 표시만 해두고, 실제 리로드는 라우터가 다음 화면 이동 때
// 수행(입력 중 데이터 보호 — router.js의 updatePending 설명 참고). 체크 시점은 탭이
// 다시 보일 때(폰에서 백그라운드 탭 복귀 — 제일 흔한 장수 탭 패턴) + 10분 간격.
const RUNNING_V = new URL(import.meta.url).searchParams.get('v');
let lastUpdateCheck = Date.now(); // 방금 로드된 HTML과는 같을 수밖에 없으니 첫 체크는 5분 뒤부터
async function checkForShellUpdate() {
  if (Date.now() - lastUpdateCheck < 5 * 60 * 1000) return;
  lastUpdateCheck = Date.now();
  try {
    const res = await fetch(location.pathname, { cache: 'no-store' });
    const m = (await res.text()).match(/shell\/app\.js\?v=([0-9]+)/);
    if (m && RUNNING_V && m[1] !== RUNNING_V) {
      console.log(`[shell] 새 배포 감지 (v${RUNNING_V} → v${m[1]}) — 다음 화면 이동 때 새로고침`);
      flagShellUpdate();
    }
  } catch (_) { /* 오프라인 등 — 다음 체크 때 다시 시도 */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForShellUpdate();
});
setInterval(checkForShellUpdate, 10 * 60 * 1000);

const statusEl = document.getElementById('shell-status');
authReady.then(() => {
  statusEl.textContent = `Firebase 초기화 완료 (App Check activate 호출 횟수: ${getAppCheckActivationCount()})`;
});

// 페이지 전체가 새로고침되면 언제든 찍히는 마커 — 셸 안에서 화면만 전환할 땐
// 절대 다시 안 찍혀야 "진짜 리로드 없이 전환됐다"는 증거가 됨
console.log('[shell] app.js 최초 1회 실행 시각:', new Date().toISOString());

navigate(currentViewFromUrl(), false);
