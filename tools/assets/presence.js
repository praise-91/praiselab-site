// 사이트 전체 실시간 접속자 카운트용 공용 하트비트.
// firebase.initializeApp()이 이미 호출된 뒤에 이 스크립트를 로드해야 한다.
// 문서 키를 "세션(탭)"이 아니라 "신원"으로 잡는다 — 로그인 사용자는 uid,
// 게스트는 이 브라우저에 저장해두는 고정 id. 같은 사람이 탭 여러 개나 페이지
// 여러 개를 동시에 열어도 전부 같은 문서에 하트비트를 남겨서 1명으로 집계된다
// (탭마다 새 문서를 만들면 관리자 화면에 같은 사람이 중복으로 여러 줄 나오는
// 문제가 있었음, 2026-07-13).
// 25초 간격으로 lastSeen을 갱신하고, 운영자 화면은 최근 90초 안에 갱신된
// 문서만 "접속 중"으로 센다(브라우저 종료를 100% 감지할 방법이 없어서
// staleness 기준으로 판단). since는 이 신원이 끊기지 않고 접속을 유지해온
// 시작 시각 — 90초 넘게 하트비트가 끊겼다 재개되면 새 접속으로 보고 다시 찍는다.
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

      if (sinceReady) {
        ref.set({
          uid: user ? user.uid : null,
          lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch(function () {});
        return;
      }
      // 이 신원으로 첫 하트비트 — 기존 문서가 90초 이내로 아직 살아있으면 since를
      // 유지(같은 사람이 새 탭을 하나 더 연 것뿐), 끊겼다 재접속이면 since를 새로 찍음
      sinceReady = true;
      ref.get().then(function (doc) {
        var cutoff = Date.now() - 90000;
        var d = doc.exists ? doc.data() : null;
        var keepSince = d && d.since && d.lastSeen && d.lastSeen.toMillis() > cutoff;
        ref.set({
          uid: user ? user.uid : null,
          since: keepSince ? d.since : firebase.firestore.FieldValue.serverTimestamp(),
          lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(function () {});
      }).catch(function () {});
    }

    function loop() {
      clearInterval(timer);
      beat();
      timer = setInterval(beat, 25000);
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
      // 이후 실제 로그인/로그아웃 등 상태 변화에는 즉시 반영
      firebase.auth().onAuthStateChanged(function () { beat(); });
    });
  }

  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) start();
  else setTimeout(start, 500);
})();
