// src/pages/MyPage.jsx
import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import "../css/mypage.css";

/* ===== 고정 메뉴 ===== */
const MENU_ITEMS = [
  { key: "bookmarks", icon: "🔖", title: "북마크한 행사", desc: "관심 있는 행사" },
  { key: "subscriptions", icon: "👥", title: "구독한 주최자", desc: "팔로우한 주최자" },
  { key: "joined", icon: "✅", title: "내가 참여한 행사", desc: "참여 내역" },
  { key: "uploaded", icon: "📌", title: "내가 업로드한 행사", desc: "등록한 행사 관리" },
];

const BASE_URL = "https://gateway.gamja.cloud";

/** 빈 본문/비 JSON도 안전하게 파싱 */
async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  if (!text || !text.trim()) return null;
  if (ct.includes("application/json")) {
    try { return JSON.parse(text); } catch { return null; }
  }
  try { return JSON.parse(text); } catch { return null; }
}

const MyPage = ({ onPageChange }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  /* 1) 로컬스토리지 캐시로 즉시 표기 (닉네임/이미지/리비전 포함) */
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    const userId = localStorage.getItem("userId");
    const nicknameLS = localStorage.getItem("nickname") || "";
    const avatarUrlLS = localStorage.getItem("profileImageUrl") || "";
    const avatarRevLS = localStorage.getItem("profileImageRev") || "";

    if (userEmail && userId) {
      setUser({
        id: userId,
        email: userEmail,
        name: nicknameLS || userEmail.split("@")[0], // 닉네임 우선
        nickname: nicknameLS || "",
        avatarUrl: avatarUrlLS || "",
        profileImageRev: avatarRevLS || "",
        rating: 0, // API로 덮어씀
      });
    } else {
      navigate("/login");
    }
  }, [navigate]);

  /* 2) EditProfile 저장 직후 실시간 반영 (커스텀 이벤트) */
  useEffect(() => {
    const handler = (e) => {
      const { nickname, profileImageUrl, profileImageRev } = e.detail || {};
      setUser((prev) => {
        if (!prev) return prev;
        const nextName = nickname ?? prev.nickname ?? prev.name;
        return {
          ...prev,
          nickname: nickname ?? prev.nickname,
          name: nextName,
          avatarUrl: profileImageUrl ?? prev.avatarUrl,
          profileImageRev: profileImageRev ?? prev.profileImageRev,
        };
      });
    };
    window.addEventListener("user:profileUpdated", handler);
    return () => window.removeEventListener("user:profileUpdated", handler);
  }, []);

  /* 3) 다른 탭 동기화 (storage 이벤트) */
  useEffect(() => {
    const onStorage = (e) => {
      if (!["nickname", "profileImageUrl", "profileImageRev"].includes(e.key)) return;
      setUser((prev) => {
        if (!prev) return prev;
        const nick = localStorage.getItem("nickname") || prev.nickname || "";
        const img  = localStorage.getItem("profileImageUrl") || prev.avatarUrl || "";
        const rev  = localStorage.getItem("profileImageRev") || prev.profileImageRev || "";
        return {
          ...prev,
          nickname: nick,
          name: nick || prev.name,
          avatarUrl: img,
          profileImageRev: rev,
        };
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* 4) 서버에서 최신 프로필 조회해서 덮어쓰기 (항상 최신 유지) */
  useEffect(() => {
    if (!user?.email) return;
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem("accessToken") || "";
        const res = await fetch(
          `${BASE_URL}/api/user/info?email=${encodeURIComponent(user.email)}&_=${Date.now()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: "no-store",
          }
        );
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.message || `사용자 정보 조회 실패 (${res.status})`);

        const nextNick   = data?.nickname ?? "";
        const nextAvatar = data?.profileImageUrl ?? "";
        const nextRev    = String(Date.now()); // 새로 내려받았으니 캐시버스터 갱신

        if (!alive) return;

        setUser((prev) => {
          if (!prev) return prev;
          const nextName = nextNick || prev.nickname || prev.name;
          return {
            ...prev,
            nickname: nextNick || prev.nickname || "",
            name: nextName,
            avatarUrl: nextAvatar || prev.avatarUrl || "",
            profileImageRev: nextRev || prev.profileImageRev || "",
          };
        });

        // 캐시 갱신(다음 진입/다른 화면 반영용)
        localStorage.setItem("nickname", nextNick || "");
        localStorage.setItem("profileImageUrl", nextAvatar || "");
        localStorage.setItem("profileImageRev", nextRev);
      } catch (err) {
        console.error("[user/info] API 오류:", err);
      }
    })();
    return () => { alive = false; };
  }, [user?.email]);

  /* 5) 평균 평점 API 연결 */
  useEffect(() => {
    const fetchRating = async () => {
      if (!user?.id) return;
      try {
        const accessToken = localStorage.getItem("accessToken") || "";
        const res = await fetch(`${BASE_URL}/api/activity/review/rating`, {
          method: "GET",
          headers: {
            "X-User-Id": String(user.id),
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
        if (!res.ok) throw new Error(`평균 평점 조회 실패 (${res.status})`);

        const data = await safeJson(res);

        let avg = 0;
        if (Array.isArray(data)) {
          const ratings = data.map((r) => Number(r?.rating)).filter((n) => Number.isFinite(n));
          avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        } else if (typeof data === "number" && Number.isFinite(data)) {
          avg = data;
        } else {
          avg = 0;
        }

        setUser((prev) => (prev ? { ...prev, rating: avg } : prev));
      } catch (err) {
        console.error("[rating] API 오류:", err);
      }
    };
    fetchRating();
  }, [user?.id]);

  /* --- 표시용 파생값 --- */
  const email = user?.email || "email@example.com";
  const nickname = user?.nickname || localStorage.getItem("nickname") || "";
  const rawName = user?.name || ""; // 이름(없으면 이메일 prefix)
  const titleName = rawName || (email ? email.split("@")[0] : "사용자"); // 큰 제목은 이름 우선
  const showNicknameLine = nickname && nickname !== titleName;

  // 프로필 이미지 + 캐시버스터 쿼리 파라미터
  const avatarBase = user?.avatarUrl || localStorage.getItem("profileImageUrl") || "";
  const imgRev = user?.profileImageRev || localStorage.getItem("profileImageRev") || "";
  const avatarUrl = (avatarBase && imgRev)
    ? `${avatarBase}${avatarBase.includes("?") ? "&" : "?"}_=${encodeURIComponent(imgRev)}`
    : avatarBase;

  const initial = useMemo(() => (titleName ? titleName[0] : "U"), [titleName]);

  const rating = typeof user?.rating === "number" ? user.rating : 0;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  /* 로그아웃 */
  const handleLogout = () => {
    const confirmLogout = window.confirm("정말 로그아웃 하시겠습니까?");
    if (!confirmLogout) return;
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userId");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("tokenExpiration");
      localStorage.removeItem("nickname");
      localStorage.removeItem("profileImageUrl");
      localStorage.removeItem("profileImageRev");
      navigate("/login");
      window.location.reload();
    } catch (error) {
      console.error("로그아웃 처리 중 오류:", error);
      navigate("/login");
    }
  };

  /* 메뉴 라우팅 */
  const handleMenuClick = (key) => {
    switch (key) {
      case "bookmarks": navigate("/bookmarks"); break;
      case "subscriptions": navigate("/subscribes"); break;
      case "joined": navigate("/joined"); break;
      case "uploaded": navigate("/my-upload-event"); break;
      default: onPageChange?.(key); break;
    }
  };

  /* 로딩 */
  if (!user) {
    return (
      <Layout pageTitle="마이페이지" activeMenuItem="mypage">
        <div className="mypage-page">
          <div className="mypage-loading"><p>사용자 정보를 불러오는 중...</p></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="마이페이지" activeMenuItem="mypage">
      <div className="mypage-page">
        <main className="mypage-main">
          <div className="mypage-wrapper">
            {/* 상단 요약 카드 */}
            <section className="profile-summary-card" aria-label="프로필 요약">
              <div className="profile-summary-left">
                {avatarUrl ? (
                  <img
                    key={avatarUrl} // 캐시버스터 반영 강제 리렌더
                    className="profile-avatar-image"
                    src={avatarUrl}
                    alt={`${titleName} 프로필`}
                  />
                ) : (
                  <div className="profile-avatar" aria-hidden="true">{initial}</div>
                )}

                <div className="profile-meta">
                  <h2 className="profile-name">{titleName}</h2>
                  {showNicknameLine && <span className="profile-nickname">{nickname}</span>}
                  <p className="profile-email">{email}</p>

                  {/* ⭐ 평균 별점만 표시 */}
                  {rating > 0 ? (
                    <div className="profile-rating compact" aria-label={`평점 ${rating.toFixed(1)}점`}>
                      <div className="rating-stars" aria-hidden="true">
                        {Array.from({ length: full }).map((_, i) => <span key={`f${i}`} className="star full">★</span>)}
                        {hasHalf && <span className="star half">★</span>}
                        {Array.from({ length: empty }).map((_, i) => <span key={`e${i}`} className="star empty">★</span>)}
                      </div>
                      <span className="rating-value">{rating.toFixed(1)}</span>
                    </div>
                  ) : (
                    <div className="profile-rating compact" aria-label="평점 정보 없음">
                      <span className="rating-empty">평점 없음</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 우측 정보 수정 버튼 */}
              <div className="profile-actions">
                <button className="profile-edit-button" onClick={() => navigate("/mypage/edit")}>
                  📝 프로필 수정
                </button>
              </div>
            </section>

            {/* 데스크톱 타일 */}
            <section className="desktop-tile-grid" role="list">
              {MENU_ITEMS.map((m) => (
                <button key={m.key} className="tile-button" onClick={() => handleMenuClick(m.key)}>
                  <div
                    className={`tile-icon ${
                      m.key === "bookmarks" ? "tile-icon-bookmark"
                      : m.key === "subscriptions" ? "tile-icon-subscription"
                      : "tile-icon-upload"
                    }`}
                  >
                    {m.icon}
                  </div>
                  <div className="tile-text">
                    <strong>{m.title}</strong>
                    <span>{m.desc}</span>
                  </div>
                </button>
              ))}
            </section>

            {/* 모바일 리스트 */}
            <section className="mobile-list-card">
              {MENU_ITEMS.map((m, idx) => (
                <button key={m.key} className="mobile-list-row" onClick={() => handleMenuClick(m.key)}>
                  <div
                    className={`mobile-list-icon ${
                      m.key === "bookmarks" ? "list-icon-bookmark"
                      : m.key === "subscriptions" ? "list-icon-subscription"
                      : "list-icon-upload"
                    }`}
                  >
                    {m.icon}
                  </div>
                  <div className="mobile-list-text">
                    <p className="mobile-list-title">{m.title}</p>
                    <p className="mobile-list-description">{m.desc}</p>
                  </div>
                  <span className="mobile-list-chevron" aria-hidden="true">›</span>
                  {idx < MENU_ITEMS.length - 1 && <div className="mobile-list-divider" />}
                </button>
              ))}
            </section>

            {/* 로그아웃 */}
            <section className="logout-section" aria-label="로그아웃">
              <button className="logout-button" onClick={handleLogout}>↪ 로그아웃</button>
            </section>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default MyPage;
