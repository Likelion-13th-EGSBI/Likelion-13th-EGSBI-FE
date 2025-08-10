import React, { useMemo } from "react";
import "../css/mypage.css";

const MENU_ITEMS = [
  { key: "bookmarks", icon: "🔖", title: "북마크한 행사", desc: "관심 있는 행사" },
  { key: "subscriptions", icon: "👥", title: "구독한 주최자", desc: "팔로우한 주최자" },
  { key: "joined", icon: "✅", title: "내가 참여한 행사", desc: "참여 내역" },
  { key: "uploaded", icon: "📌", title: "내가 업로드한 행사", desc: "등록한 행사 관리" },
];

const MyPage = ({ onPageChange, onLogout, user }) => {
  const displayName = user?.name || "사용자";
  const email = user?.email || "email@example.com";
  const initial = useMemo(() => (displayName ? displayName[0] : "U"), [displayName]);

  const rating = typeof user?.rating === "number" ? user.rating : 4.5;
  const reviewCount = typeof user?.reviewCount === "number" ? user.reviewCount : 23;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <div className="mp-page">
      <main className="mp-main">
        <div className="mypage-wrap">
          {/* 상단 요약 카드 */}
          <section className="hero-card" aria-label="프로필 요약">
            <div className="hero-left">
              {user?.avatarUrl ? (
                <img className="hero-avatar-img" src={user.avatarUrl} alt={`${displayName} 프로필`} />
              ) : (
                <div className="hero-avatar" aria-hidden="true">{initial}</div>
              )}

              <div className="hero-meta">
                <h2 className="hero-name">{displayName}</h2>
                <p className="hero-mail">{email}</p>
                <div className="hero-rating" aria-label={`평점 ${rating.toFixed(1)}점, 리뷰 ${reviewCount}개`}>
                  <div className="stars" aria-hidden="true">
                    {Array.from({ length: full }).map((_, i) => <span key={`f${i}`} className="star full">★</span>)}
                    {hasHalf && <span className="star half">★</span>}
                    {Array.from({ length: empty }).map((_, i) => <span key={`e${i}`} className="star empty">★</span>)}
                  </div>
                  <span className="rating-value">{rating.toFixed(1)}</span>
                  <span className="review-count">리뷰 {reviewCount}개</span>
                </div>
              </div>
            </div>

            {/* 우측 정보 수정 버튼 */}
            <div className="hero-actions">
              <button
                className="hero-edit-btn"
                onClick={() => onPageChange?.("profile")}
              >
                📝 정보 수정
              </button>
            </div>
          </section>

          {/* 데스크톱: 가운데 정렬 2×2 느낌 */}
          <section className="tile-row desktop-tiles" role="list">
            {MENU_ITEMS.map((m) => (
              <button key={m.key} className="tile" onClick={() => onPageChange?.(m.key)}>
                <div className={`tile-icon ${m.key === "bookmarks" ? "tile-bookmark" :
                                           m.key === "subscriptions" ? "tile-sub" : "tile-upload"}`}>
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
          <section className="list-card mobile-list">
            {MENU_ITEMS.map((m, idx) => (
              <button
                key={m.key}
                className="list-row"
                onClick={() => onPageChange?.(m.key)}
              >
                <div className={`list-icon ${m.key === "bookmarks" ? "li-bookmark" :
                                            m.key === "subscriptions" ? "li-sub" : "li-upload"}`}>
                  {m.icon}
                </div>
                <div className="list-text">
                  <p className="list-title">{m.title}</p>
                  <p className="list-desc">{m.desc}</p>
                </div>
                <span className="list-chev" aria-hidden="true">›</span>
                {idx < MENU_ITEMS.length - 1 && <div className="list-divider" />}
              </button>
            ))}
          </section>

          {/* 로그아웃 (독립 섹션) */}
          <section className="logout-section" aria-label="로그아웃">
            <button className="sb-logout" onClick={onLogout}>↪ 로그아웃</button>
          </section>
        </div>
      </main>
    </div>
  );
};

export default MyPage;
