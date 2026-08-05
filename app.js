// app.js — Birdie 공통 React 컴포넌트 & 훅
// 이 파일은 <script type="text/babel" src="./app.js"></script> 로 각 페이지에서 공유됩니다.
const { useState, useEffect } = React;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function todayMD() {
  const d = new Date();
  return String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
}

function fmtBirthday(b) {
  if (!b || b.length !== 4) return b || "";
  return `${b.slice(0, 2)}월 ${b.slice(2, 4)}일`;
}

function fmtMoney(n) {
  const num = Number(n);
  if (isNaN(num)) return "";
  return num.toLocaleString("ko-KR") + "원";
}

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${y}.${m}.${day}`;
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

function gradeInfo(grade) {
  return (window.GRADES && window.GRADES.find((g) => g.key === grade)) || window.GRADES[2];
}

function isOfficerOf(roster, myId) {
  const me = roster.find((m) => m.id === myId);
  return !!(me && me.grade === "운영진");
}

// 지정한 시간(ms) 안에 안 끝나면 강제로 실패 처리 — 업로드가 무한정 멈춰있는 것을 방지
function withTimeout(promise, ms, label) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label || "요청"} 응답이 없어요 (시간 초과). 설정을 확인해주세요.`)), ms)
    ),
  ]);
}

// ---------- 사진 업로드 (Cloudinary, 카드 등록 없이 무료) ----------
async function uploadToCloudinary(file) {
  const { cloudName, uploadPreset } = window.CLOUDINARY || {};
  if (!cloudName || cloudName.includes("여기에") || !uploadPreset || uploadPreset.includes("여기에")) {
    throw new Error("Cloudinary 설정이 안 되어있어요 (firebase.js의 CLOUDINARY 값을 채워주세요)");
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  const res = await withTimeout(
    fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    }),
    20000,
    "사진 업로드"
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody.error && errBody.error.message) || `업로드 실패 (${res.status})`);
  }
  const data = await res.json();
  return data.secure_url;
}

// ---------- 관리자 잠금 훅 ----------
// isOfficer: 로그인한 회원의 등급이 "운영진"이면 비밀번호 없이도 자동으로 관리자 권한을 가짐
function useAdmin(isOfficer) {
  const [pinOn, setPinOn] = useState(() => localStorage.getItem("bm_admin") === "1");
  const adminOn = pinOn || !!isOfficer;
  function tryUnlock(cb) {
    if (adminOn) { if (cb) cb(); return; }
    const pin = window.prompt("관리자 비밀번호를 입력하세요");
    if (pin === window.ADMIN_PIN) {
      localStorage.setItem("bm_admin", "1");
      setPinOn(true);
      if (cb) cb();
    } else if (pin !== null) {
      window.alert("비밀번호가 틀렸어요.");
    }
  }
  function lock() {
    localStorage.removeItem("bm_admin");
    setPinOn(false);
  }
  return { adminOn, tryUnlock, lock, isOfficer: !!isOfficer };
}

// ---------- 로그인(내 신원) 훅 ----------
function useIdentity() {
  const [myId, setMyId] = useState(() => localStorage.getItem("bm_myId") || null);
  const [myName, setMyName] = useState(() => localStorage.getItem("bm_myName") || null);
  function login(id, name) {
    localStorage.setItem("bm_myId", id);
    localStorage.setItem("bm_myName", name);
    setMyId(id);
    setMyName(name);
  }
  function logout() {
    localStorage.removeItem("bm_myId");
    localStorage.removeItem("bm_myName");
    setMyId(null);
    setMyName(null);
  }
  return { myId, myName, login, logout };
}

// ---------- 회원 명단 실시간 훅 ----------
function useRoster() {
  const [roster, setRoster] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = window.REFS.roster.onSnapshot((snap) => {
      const data = snap.data();
      setRoster(data && data.members ? data.members : []);
      setReady(true);
    }, () => setReady(true));
    return () => unsub();
  }, []);
  function persist(next) {
    setRoster(next);
    window.REFS.roster.set({ members: next }).catch(() => {});
  }
  return { roster, ready, setRoster, persist };
}

// ---------- 출석 이력 기록 (출석왕 계산용, 하루 1회만 기록) ----------
function logAttendance(memberId) {
  if (!memberId) return;
  const today = todayStr();
  REFS.checkinlog.get().then((snap) => {
    const data = snap.data() || {};
    const items = data.items || [];
    const already = items.some((it) => it.memberId === memberId && it.date === today);
    if (already) return;
    REFS.checkinlog.set({ items: [...items, { id: uid(), memberId, date: today }] }).catch(() => {});
  }).catch(() => {});
}

// ---------- 경기 결과 기록 (내 정보 > 경기 기록용) ----------
function logMatchResult(record) {
  REFS.matchhistory.get().then((snap) => {
    const data = snap.data() || {};
    const items = data.items || [];
    REFS.matchhistory.set({ items: [{ id: uid(), date: todayStr(), ...record }, ...items] }).catch(() => {});
  }).catch(() => {});
}

// ---------- 로그인 필요 화면 (비로그인 접근 제한) ----------
function RequireLogin({ myId, children }) {
  if (myId) return children;
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-8">
      <p className="text-4xl mb-3">🔒</p>
      <p className="text-sm font-semibold text-stone-700 mb-1">로그인이 필요해요</p>
      <p className="text-xs text-stone-400 mb-5">홈 화면에서 이름과 비밀번호로 입장한 뒤 이용할 수 있어요.</p>
      <a
        href="./index.html#login"
        className="text-white text-sm font-semibold px-6 py-2.5 rounded-full"
        style={{ backgroundColor: "#4CAF50" }}
      >
        🏠 홈으로 가서 입장하기
      </a>
    </div>
  );
}

// ---------- 하단 고정 내비게이션 ----------
function BottomNav({ active }) {
  const items = [
    { key: "home", href: "./index.html", icon: "🏠", label: "홈" },
    { key: "members", href: "./members.html", icon: "👥", label: "회원" },
    { key: "match", href: "./match.html", icon: "🎲", label: "매칭" },
    { key: "notices", href: "./notices.html", icon: "📢", label: "공지" },
    { key: "reviews", href: "./reviews.html", icon: "📸", label: "후기" },
    { key: "more", href: "./more.html", icon: "☰", label: "더보기" },
  ];
  return (
    <nav className="bc-bottomnav">
      {items.map((it) => (
        <a key={it.key} href={it.href} className={active === it.key ? "active" : ""}>
          <span className="icon">{it.icon}</span>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

// ---------- 상단 헤더 (공용) ----------
function TopHeader({ title, subtitle }) {
  return (
    <header className="px-5 pt-6 pb-4 max-w-2xl mx-auto">
      <a href="./index.html" className="headfont text-base" style={{ color: "#4CAF50" }}>🏸 Birdie</a>
      {title && <h1 className="headfont text-2xl text-stone-900 mt-2">{title}</h1>}
      {subtitle && <p className="text-sm text-stone-400 mt-1">{subtitle}</p>}
    </header>
  );
}

// ---------- 등급 배지 ----------
function GradeBadge({ grade }) {
  const g = gradeInfo(grade);
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${g.color}`}>
      {g.emoji} {g.key}
    </span>
  );
}

// ---------- 로딩 스켈레톤 ----------
function Skeleton({ className }) {
  return <div className={`shimmer rounded-xl ${className || "h-16 w-full"}`} />;
}
