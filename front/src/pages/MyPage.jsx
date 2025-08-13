import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout"; 
import "../css/mypage.css";

const MENU_ITEMS = [
  { key: "bookmarks", icon: "🔖", title: "북마크한 행사", desc: "관심 있는 행사" },
  { key: "subscriptions", icon: "👥", title: "구독한 주최자", desc: "팔로우한 주최자" },
  { key: "joined", icon: "✅", title: "내가 참여한 행사", desc: "참여 내역" },
  { key: "uploaded", icon: "📌", title: "내가 업로드한 행사", desc: "등록한 행사 관리" },
];

const MyPage = ({ onPageChange, onLogout, user }) => {
  const navigate = useNavigate();

  const displayName = user?.name || "사용자";
  const email = user?.email || "email@example.com";
  const initial = useMemo(() => (displayName ? displayName[0] : "U"), [displayName]);

  const rating = typeof user?.rating === "number" ? user.rating : 4.5;
  const reviewCount = typeof user?.reviewCount === "number" ? user.reviewCount : 23;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  // 메뉴 클릭 시 라우팅
  const handleMenuClick = (key) => {
    switch (key) {
      case "bookmarks":
        navigate("/bookmarks");
        break;
      case "subscriptions":
        navigate("/subscribe");
        break;
      case "joined":
        navigate("/joined");
        break;
      default:
        onPageChange?.(key);
        break;
    }
  };

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
                  <div
                    className="profile-rating"
                    aria-label={`평점 ${rating.toFixed(1)}점, 리뷰 ${reviewCount}개`}
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
                    <span className="review-count">리뷰 {reviewCount}개</span>
                  </div>
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
              <button className="logout-button" onClick={onLogout}>
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
