// 사이트 전체 실시간 접속자 카운트용 공용 하트비트.
// firebase.initializeApp()이 이미 호출된 뒤에 이 스크립트를 로드해야 한다.
// 세션(탭)마다 문서 1개를 25초 간격으로 갱신하고, 운영자 화면은 최근 90초 안에
// 갱신된 문서만 "접속 중"으로 센다(브라우저 종료를 100% 감지할 방법이 없어서
// staleness 기준으로 판단).
(function () {
  function start() {
    var db = firebase.firestore();
    var docRef = db.collection('tools_presence').doc(
      Math.random().toString(36).slice(2) + Date.now().toString(36)
    );
    var timer = null;

    function beat() {
      var user = firebase.auth().currentUser;
      docRef.set({
        uid: user ? user.uid : null,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(function () {});
    }

    function loop() {
      clearInterval(timer);
      beat();
      timer = setInterval(beat, 25000);
    }

    loop();
    // 탭이 백그라운드로 가면 하트비트를 멈춰서 불필요한 쓰기를 줄이고,
    // 다시 보이면 바로 갱신
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearInterval(timer);
      else loop();
    });
    // 최초 beat()는 Firebase Auth가 로그인 세션을 복원하기 전에 실행될 수 있어서
    // 로그인 사용자가 잠깐 게스트로 잡힐 수 있음 — 로그인 상태가 확정되는 순간 한 번 더 갱신
    firebase.auth().onAuthStateChanged(function () { beat(); });
  }

  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) start();
  else setTimeout(start, 500);
})();
