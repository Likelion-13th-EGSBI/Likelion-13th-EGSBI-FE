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

  /* 로컬스토리지에서 사용자 정보 가져오기 (원래 로직) */
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    const userId = localStorage.getItem("userId");
    if (userEmail && userId) {
      setUser({
        id: userId,
        email: userEmail,
        name: userEmail.split("@")[0],
        rating: 0, // API로 덮어씀
      });
    } else {
      navigate("/login");
    }
  }, [navigate]);

  /* ✅ 평균 평점 API 연결 (X-User-Id 필수, 빈 응답 안전 처리) */
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

        // 명세: 배열(리뷰 목록) 가정. 숫자만 내려와도 수용.
        let avg = 0;
        if (Array.isArray(data)) {
          const ratings = data
            .map((r) => Number(r?.rating))
            .filter((n) => Number.isFinite(n));
          avg = ratings.length
            ? ratings.reduce((a, b) => a + b, 0) / ratings.length
            : 0;
        } else if (typeof data === "number" && Number.isFinite(data)) {
          avg = data;
        } else {
          avg = 0; // null/빈 본문 등
        }

        setUser((prev) => (prev ? { ...prev, rating: avg } : prev));
      } catch (err) {
        console.error("[rating] API 오류:", err);
        // 실패 시 0 유지
      }
    };
    fetchRating();
  }, [user?.id]);

  const displayName = user?.name || "사용자";
  const email = user?.email || "email@example.com";
  const initial = useMemo(() => (displayName ? displayName[0] : "U"), [displayName]);

  // 별점 계산 (카운트 사용 안 함)
  const rating = typeof user?.rating === "number" ? user.rating : 0;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  /* 로그아웃 처리 (원본 유지) */
  const handleLogout = () => {
    const confirmLogout = window.confirm("정말 로그아웃 하시겠습니까?");
    if (!confirmLogout) return;
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userId");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("tokenExpiration");
      navigate("/login");
      window.location.reload();
    } catch (error) {
      console.error("로그아웃 처리 중 오류:", error);
      navigate("/login");
    }
  };

  /* 메뉴 라우팅 (원본 유지) */
  const handleMenuClick = (key) => {
    switch (key) {
      case "bookmarks": navigate("/bookmarks"); break;
      case "subscriptions": navigate("/subscribes"); break;
      case "joined": navigate("/joined"); break;
      case "uploaded": navigate("/my-upload-event"); break;
      default: onPageChange?.(key); break;
    }
  };

  /* 로딩 상태 */
  if (!user) {
    return (
      <Layout pageTitle="마이페이지" activeMenuItem="mypage">
        <div className="mypage-page">
          <div className="mypage-loading">
            <p>사용자 정보를 불러오는 중...</p>
          </div>
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
                {user?.avatarUrl ? (
                  <img
                    className="profile-avatar-image"
                    src={user.avatarUrl}
                    alt={`${displayName} 프로필`}
                  />
                ) : (
                  <div className="profile-avatar" aria-hidden="true">
                    {initial}
                  </div>
                )}

                <div className="profile-meta">
                  <h2 className="profile-name">{displayName}</h2>
                  <p className="profile-email">{email}</p>

                  {/* ⭐ 평균 별점만 표시: 0이면 "평점 없음" */}
                  {rating > 0 ? (
                    <div
                      className="profile-rating compact"
                      aria-label={`평점 ${rating.toFixed(1)}점`}
                    >
                      <div className="rating-stars" aria-hidden="true">
                        {Array.from({ length: full }).map((_, i) => (
                          <span key={`f${i}`} className="star full">★</span>
                        ))}
                        {hasHalf && <span className="star half">★</span>}
                        {Array.from({ length: empty }).map((_, i) => (
                          <span key={`e${i}`} className="star empty">★</span>
                        ))}
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
                <button
                  className="profile-edit-button"
                  onClick={() => navigate("/mypage/edit")}
                >
                  📝 프로필 수정
                </button>
              </div>
            </section>

            {/* 데스크톱: 가운데 정렬 2×2 느낌 */}
            <section className="desktop-tile-grid" role="list">
              {MENU_ITEMS.map((m) => (
                <button
                  key={m.key}
                  className="tile-button"
                  onClick={() => handleMenuClick(m.key)}
                >
                  <div
                    className={`tile-icon ${
                      m.key === "bookmarks"
                        ? "tile-icon-bookmark"
                        : m.key === "subscriptions"
                        ? "tile-icon-subscription"
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
                <button
                  key={m.key}
                  className="mobile-list-row"
                  onClick={() => handleMenuClick(m.key)}
                >
                  <div
                    className={`mobile-list-icon ${
                      m.key === "bookmarks"
                        ? "list-icon-bookmark"
                        : m.key === "subscriptions"
                        ? "list-icon-subscription"
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
                  {idx < MENU_ITEMS.length - 1 && (
                    <div className="mobile-list-divider" />
                  )}
                </button>
              ))}
            </section>

            {/* 로그아웃 */}
            <section className="logout-section" aria-label="로그아웃">
              <button className="logout-button" onClick={handleLogout}>
                ↪ 로그아웃
              </button>
            </section>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default MyPage;
