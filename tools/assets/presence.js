// 사이트 전체 실시간 접속자 카운트용 공용 하트비트.
// firebase.initializeApp()이 이미 호출된 뒤에 이 스크립트를 로드해야 한다.
// 문서 키를 "세션(탭)"이 아니라 "신원"으로 잡는다 — 로그인 사용자는 uid,
// 게스트는 이 브라우저에 저장해두는 고정 id. 같은 사람이 탭 여러 개나 페이지
// 여러 개를 동시에 열어도 전부 같은 문서에 하트비트를 남겨서 1명으로 집계된다
// (탭마다 새 문서를 만들면 관리자 화면에 같은 사람이 중복으로 여러 줄 나오는
// 문제가 있었음, 2026-07-13).
// 25초 간격으로 lastSeen을 갱신하고, 운영자 화면은 최근 90초 안에 갱신된
// 문서만 "접속 중"으로 센다(브라우저 종료를 100% 감지할 방법이 없어서
// staleness 기준으로 판단). since는 이 페이지에서 이 신원으로 하트비트가 처음
// 뛴 시각(=페이지 로드/재접속 시각). tools_presence 읽기는 운영자만 가능해서
// 기존 문서를 조회해 "끊기지 않았으면 since 유지"하는 방식은 쓸 수 없다.
(function () {
  function start() {
    var db = firebase.firestore();
    var timer = null;
    var docId = null;
    var sinceReady = false;

    function guestId() {
      var id = localStorage.getItem('gc_presence_guest_id');
      if (!id) {
        id = 'guest_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('gc_presence_guest_id', id);
      }
      return id;
    }

    function beat() {
      var user = firebase.auth().currentUser;
      var id = user ? user.uid : guestId();
      var ref = db.collection('tools_presence').doc(id);

      if (id !== docId) { docId = id; sinceReady = false; }

      // tools_presence 읽기는 운영자만 허용(보안규칙)이라, 일반 사용자는 기존 문서를
      // 미리 조회해서 since를 이어붙이는 방식을 쓸 수 없다(항상 permission-denied로
      // 조용히 실패해 since가 영영 안 찍히는 버그가 있었음, 2026-07-13). 대신 이
      // 신원으로 이 페이지에서 처음 뛰는 하트비트에만 since를 새로 찍고, 이후엔
      // lastSeen만 갱신 — 읽기 없이 항상 merge 쓰기 하나로 끝난다.
      var payload = {
        uid: user ? user.uid : null,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (!sinceReady) {
        sinceReady = true;
        payload.since = firebase.firestore.FieldValue.serverTimestamp();
      }
      ref.set(payload, { merge: true }).catch(function () {});
    }

    function loop() {
      clearInterval(timer);
      beat();
      timer = setInterval(beat, 25000);
    }

    // 누적 방문 카운터 — 실시간 접속자(현재 이 순간)와 별개로, 사이트가 지금까지
    // 총 몇 번 열렸는지 세는 값. 같은 브라우저 탭에서 새로고침을 반복해도 중복
    // 집계되지 않게 sessionStorage 플래그로 탭 세션당 1회만 증가시킨다(완벽한
    // 어뷰징 방지는 아니지만 팀 내부 도구 수준에선 충분).
    // 날짜별 문서(visits_YYYY-MM-DD)에도 같이 +1 해서, 운영자 대시보드가 "최근 7일
    // 일평균 방문자"를 계산할 수 있게 한다(2026-07-14, 평균 접속자 카드용).
    function todayKey() {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function bumpVisitCount() {
      if (sessionStorage.getItem('gc_visit_counted')) return;
      sessionStorage.setItem('gc_visit_counted', '1');
      db.collection('tools_stats').doc('visits').set({
        total: firebase.firestore.FieldValue.increment(1),
      }, { merge: true }).catch(function () {});
      db.collection('tools_stats').doc('visits_' + todayKey()).set({
        total: firebase.firestore.FieldValue.increment(1),
      }, { merge: true }).catch(function () {});
      bumpDauCount();
    }

    // DAU(고유 방문자) 집계 — visits 카운터는 세션(탭)마다 늘어나서 같은 사람이
    // 여러 탭/기기로 접속하면 중복 집계되지만, 이건 신원(uid 또는 게스트id) 배열에
    // arrayUnion으로 추가해서 서버 쪽에서 자동으로 중복 제거된다(2026-07-15 대시보드
    // DAU 카드용). 세션당 1회만 호출해도 arrayUnion이 멱등이라 여러 세션이 겹쳐도 안전.
    function bumpDauCount() {
      var user = firebase.auth().currentUser;
      var id = user ? user.uid : guestId();
      db.collection('tools_stats').doc('dau_' + todayKey()).set({
        uids: firebase.firestore.FieldValue.arrayUnion(id),
      }, { merge: true }).catch(function () {});
    }

    var started = false;
    document.addEventListener('visibilitychange', function () {
      if (!started) return;
      // 탭이 백그라운드로 가면 하트비트를 멈춰서 불필요한 쓰기를 줄이고, 다시 보이면 바로 갱신
      if (document.hidden) clearInterval(timer);
      else loop();
    });

    // firebase.auth().currentUser는 로그인 세션 복원 여부와 무관하게 항상 null로
    // 시작한다 — 여기서 바로 beat()를 치면 실제 로그인 사용자도 잠깐 게스트로 잘못
    // 잡히고, 새로고침할 때마다 유령 게스트 하트비트가 남는 문제가 있었음(2026-07-13).
    // 최초 상태가 확정될 때까지 기다렸다가 첫 하트비트를 친다
    var unsubInit = firebase.auth().onAuthStateChanged(function () {
      unsubInit();
      started = true;
      loop();
      bumpVisitCount();
      // 이후 실제 로그인/로그아웃 등 상태 변화에는 즉시 반영
      firebase.auth().onAuthStateChanged(function () { beat(); });
    });
  }

  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) start();
  else setTimeout(start, 500);
})();
