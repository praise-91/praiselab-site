// 페이지 전체 리로드 없이 화면만 바꿔치기하는 최소 클라이언트 라우터.
// 화면 전환 시 이전 view의 unmount()를 반드시 호출해서 setInterval/onSnapshot 같은
// 리스너가 계속 쌓이는 걸(메모리 누수) 막는다.

const routes = new Map();
let currentUnmount = null;
let currentView = null;

// 컷오버 완료된 view만 여기 등록한다 — 실제 파일(예: /tools/roulette.html)이 셸 부트스트랩으로
// 바뀐 화면만 실제 경로로 pushState하고, 아직 안 바뀐 화면(예: home)은 기존처럼 ?view= 로 남는다.
const VIEW_PATHS = {
  games: '/tools/games.html',
  roulette: '/tools/roulette.html',
  'team-ladder': '/tools/team-ladder.html',
  'tool-rental': '/tools/tool-rental.html',
  'qty-report': '/tools/qty-report.html',
};

function mountEl() {
  return document.getElementById('view-mount');
}

export function registerView(name, loader) {
  routes.set(name, loader);
}

function pathForView(name) {
  return VIEW_PATHS[name] || (location.pathname + '?view=' + name);
}

// 로컬 미리보기 서버(npx serve)는 클린 URL이라 /tools/games.html이 /tools/games로
// 리다이렉트된다 — 운영(GitHub Pages)은 .html이 그대로 유지되므로, 비교할 땐 양쪽 다
// .html을 떼고 맞춰서 로컬/운영 어디서든 같은 view로 매칭되게 한다.
function stripHtml(p) {
  return p.replace(/\.html$/, '');
}

function viewForPath(pathname) {
  const target = stripHtml(pathname);
  const found = Object.entries(VIEW_PATHS).find(([, p]) => stripHtml(p) === target);
  return found ? found[0] : null;
}

export async function navigate(name, push = true) {
  if (!routes.has(name)) {
    mountEl().innerHTML = `<p>알 수 없는 화면: ${name}</p>`;
    return;
  }
  if (currentUnmount) {
    try { currentUnmount(); } catch (e) { console.error('unmount 실패', e); }
    currentUnmount = null;
  }
  const el = mountEl();
  el.innerHTML = '<p class="route-loading">불러오는 중…</p>';
  const mod = await routes.get(name)();
  el.innerHTML = '';
  currentUnmount = mod.mount(el);
  currentView = name;
  if (push) history.pushState({ view: name }, '', pathForView(name));
  document.querySelectorAll('[data-route]').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === name);
  });
}

window.addEventListener('popstate', (e) => {
  const view = (e.state && e.state.view) || currentViewFromUrl();
  navigate(view, false);
});

export function currentViewFromUrl() {
  return viewForPath(location.pathname) || new URLSearchParams(location.search).get('view') || 'home';
}
