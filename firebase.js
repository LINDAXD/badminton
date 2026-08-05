// firebase.js — Birdie Club 공통 Firebase 초기화
// 기존 프로젝트(badminton-42968)를 그대로 사용합니다. (데이터 유지)
const firebaseConfig = {
  apiKey: "AIzaSyDn5tgqFHAKNbiSBwxyrxyhKgFR9w1jf8E",
  authDomain: "badminton-42968.firebaseapp.com",
  projectId: "badminton-42968",
  storageBucket: "badminton-42968.firebasestorage.app",
  messagingSenderId: "1079190230967",
  appId: "1:1079190230967:web:82c8c22b7f84fa5ea23a32"
};

firebase.initializeApp(firebaseConfig);

window.db = firebase.firestore();
window.storage = firebase.storage();

// ---- 익명 인증 ----
// Firebase Storage 기본 보안 규칙은 로그인(인증)된 사용자만 업로드를 허용해요.
// 회원가입/로그인 화면이 따로 없으므로, 사진 업로드가 필요한 페이지에서
// 실제 업로드 전에 `await window.authReady`로 이 익명 인증이 끝나길 기다려야 해요.
window.authReady = new Promise((resolve) => {
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      resolve(user);
    } else {
      firebase.auth().signInAnonymously().catch((err) => {
        console.error("Firebase 익명 인증 실패:", err);
        resolve(null);
      });
    }
  });
});


// ---- 공통 Firestore 문서 참조 (컬렉션 "badminton" 유지) ----
window.REFS = {
  roster: db.collection("badminton").doc("roster"),         // 회원 명단
  notices: db.collection("badminton").doc("notices"),       // 공지사항
  checkin: db.collection("badminton").doc("checkin"),       // 오늘 참석 체크인
  restwish: db.collection("badminton").doc("restwish"),     // 랜덤매칭 휴식 희망
  suggestions: db.collection("badminton").doc("suggestions"), // 건의사항
  schedule: db.collection("badminton").doc("schedule"),     // 일정
  checkinlog: db.collection("badminton").doc("checkinlog"), // 출석 이력(출석왕 계산용)
  reviews: db.collection("badminton").doc("reviews"),       // 모임 후기
  matchhistory: db.collection("badminton").doc("matchhistory"), // 랜덤매칭 경기 기록 (내 정보용)
};

// ---- 공통 상수 ----
window.GRADES = [
  { key: "운영진", emoji: "👑", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "MVP", emoji: "🏆", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { key: "일반회원", emoji: "🏸", color: "bg-green-100 text-green-700 border-green-200" },
  { key: "신입회원", emoji: "🌱", color: "bg-lime-100 text-lime-700 border-lime-200" },
];

window.ADMIN_PIN = "1234";
