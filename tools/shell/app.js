import { authReady, getAppCheckActivationCount } from './firebase-shell.js?v=3';
import { registerView, navigate, currentViewFromUrl } from './router.js?v=3';

registerView('home', () => import('./views/home-view.js?v=3'));
registerView('community', () => import('./views/community-view.js?v=3'));
registerView('tool-rental', () => import('./views/tool-rental-view.js?v=3'));
registerView('roulette', () => import('./views/roulette-view.js?v=3'));
registerView('team-ladder', () => import('./views/team-ladder-view.js?v=3'));
registerView('games', () => import('./views/games-view.js?v=3'));
registerView('qty-report', () => import('./views/qty-report-view.js?v=3'));
registerView('admin-dashboard', () => import('./views/admin-dashboard-view.js?v=3'));
registerView('gongsu-admin', () => import('./views/gongsu-admin-view.js?v=3'));
registerView('gongsu-calendar', () => import('./views/gongsu-calendar-view.js?v=3'));

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-route]');
  if (!a) return;
  e.preventDefault();
  navigate(a.dataset.route);
});

const statusEl = document.getElementById('shell-status');
authReady.then(() => {
  statusEl.textContent = `Firebase 초기화 완료 (App Check activate 호출 횟수: ${getAppCheckActivationCount()})`;
});

// 페이지 전체가 새로고침되면 언제든 찍히는 마커 — 셸 안에서 화면만 전환할 땐
// 절대 다시 안 찍혀야 "진짜 리로드 없이 전환됐다"는 증거가 됨
console.log('[shell] app.js 최초 1회 실행 시각:', new Date().toISOString());

navigate(currentViewFromUrl(), false);
