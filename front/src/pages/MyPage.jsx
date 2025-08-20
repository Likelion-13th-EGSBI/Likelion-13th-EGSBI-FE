// src/pages/MyPage.jsx
import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import "../css/mypage.css";

const MENU_ITEMS = [
  { key: "bookmarks", icon: "🔖", title: "북마크한 행사", desc: "관심 있는 행사" },
  { key: "subscriptions", icon: "👥", title: "구독한 주최자", desc: "팔로우한 주최자" },
  { key: "joined", icon: "✅", title: "내가 참여한 행사", desc: "참여 내역" },
  { key: "uploaded", icon: "📌", title: "내가 업로드한 행사", desc: "등록한 행사 관리" },
];

const BASE_URL = "https://gateway.gamja.cloud";

/** profileId -> 이미지 URL */
const toProfileUrl = (id) => {
  if (!id && id !== 0) return "";
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${BASE_URL}/api/image/${n}`;
};

async function safeJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const MyPage = ({ onPageChange }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  /** 1) 로컬 로그인 체크 (이미지 URL은 저장/사용하지 않음) */
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    const userId = localStorage.getItem("userId");
    const nicknameLS = localStorage.getItem("nickname") || "";

    if (userEmail && userId) {
      setUser({
        id: userId,
        email: userEmail,
        name: nicknameLS || userEmail.split("@")[0],
        nickname: nicknameLS || "",
        profileId: null,
        avatarUrl: "",
        rating: 0,
      });
    } else {
      navigate("/login");
    }
  }, [navigate]);

  /** 2) EditProfile 저장 직후 실시간 반영 */
  useEffect(() => {
    const handler = (e) => {
      const { nickname, profileId, profileImageUrl } = e.detail || {};
      setUser((prev) => {
        if (!prev) return prev;
        const nextName = (nickname ?? prev.nickname) || prev.name;
        return {
          ...prev,
          nickname: nickname ?? prev.nickname,
          name: nextName,
          profileId: profileId ?? prev.profileId,
          avatarUrl: profileImageUrl ?? (profileId ? toProfileUrl(profileId) : prev.avatarUrl),
        };
      });
    };
    window.addEventListener("user:profileUpdated", handler);
    return () => window.removeEventListener("user:profileUpdated", handler);
  }, []);

  /** 3) 서버에서 최신 프로필 조회 */
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem("accessToken") || "";
        const res = await fetch(
          `${BASE_URL}/api/user/info?userId=${encodeURIComponent(user.id)}`,
          {
            headers: {
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: "no-store",
          }
        );
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.message || `사용자 정보 조회 실패 (${res.status})`);

        if (!alive) return;

        const nextNick = data?.nickname ?? "";
        const nextProfileId = data?.profileId ?? null;

        setUser((prev) => {
          if (!prev) return prev;
          const nextName = nextNick || prev.nickname || prev.name;
          return {
            ...prev,
            nickname: nextNick || prev.nickname || "",
            name: nextName,
            profileId: nextProfileId,
            avatarUrl: toProfileUrl(nextProfileId),
          };
        });

        // 닉네임만 캐시
        localStorage.setItem("nickname", nextNick || "");
      } catch (err) {
        console.error("[user/info] API 오류:", err);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  /** 4) 평균 평점 */
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

  /** 표시 파생값 */
  const email = user?.email || "email@example.com";
  const nickname = user?.nickname || localStorage.getItem("nickname") || "";
  const rawName = user?.name || "";
  const titleName = rawName || (email ? email.split("@")[0] : "사용자");
  const showNicknameLine = nickname && nickname !== titleName;

  const avatarUrl = user?.avatarUrl || "";
  const initial = useMemo(() => (titleName ? titleName[0] : "U"), [titleName]);

  const rating = typeof user?.rating === "number" ? user.rating : 0;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  const handleLogout = () => {
    const confirmLogout = window.confirm("정말 로그아웃 하시겠습니까?");
    if (!confirmLogout) return;
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userId");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("tokenExpiration");
      localStorage.removeItem("nickname");
      navigate("/login");
      window.location.reload();
    } catch (error) {
      console.error("로그아웃 처리 중 오류:", error);
      navigate("/login");
    }
  };

  const handleMenuClick = (key) => {
    switch (key) {
      case "bookmarks": navigate("/bookmarks"); break;
      case "subscriptions": navigate("/subscribes"); break;
      case "joined": navigate("/joined"); break;
      case "uploaded": navigate("/my-upload-event"); break;
      default: onPageChange?.(key); break;
    }
  };

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
                    className="profile-avatar-image"
                    src={avatarUrl}
                    alt={`${titleName} 프로필`}
                    onError={(e) => { e.currentTarget.src = "/imgs/profile-fallback.png"; }}
                  />
                ) : (
                  <div className="profile-avatar" aria-hidden="true">{initial}</div>
                )}

                <div className="profile-meta">
                  <h2 className="profile-name">{titleName}</h2>
                  {showNicknameLine && <span className="profile-nickname">{nickname}</span>}
                  <p className="profile-email">{email}</p>

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
