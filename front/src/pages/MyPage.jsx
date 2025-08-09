import React, { useMemo } from "react";
import "../css/mypage.css";
import mainLogo from "../imgs/mainlogo.png";

const MENU_ITEMS = [
  { key: "profile", icon: "📝", title: "정보 수정", desc: "프로필·개인정보 변경" },
  { key: "bookmarks", icon: "🔖", title: "북마크한 행사", desc: "관심 있는 행사" },
  { key: "subscriptions", icon: "👥", title: "구독한 주최자", desc: "팔로우한 주최자" },
  { key: "joined", icon: "✅", title: "내가 참여한 행사", desc: "참여 내역" },
  { key: "uploaded", icon: "📌", title: "내가 업로드한 행사", desc: "등록한 행사 관리" },
];

const MyPage = ({ onPageChange, onLogout, user }) => {
  const displayName = user?.name || "사용자";
  const email = user?.email || "email@example.com";
  const initial = useMemo(() => (displayName ? displayName[0] : "U"), [displayName]);

  // 더미 평점/리뷰 (API 연동 전)
  const rating = typeof user?.rating === "number" ? user.rating : 4.5;
  const reviewCount = typeof user?.reviewCount === "number" ? user.reviewCount : 23;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <div className="mp-layout">
      {/* Sidebar */}
      <aside className="mp-sidebar" aria-label="주 메뉴">
        <div className="sb-logo-wrap">
          <img src={mainLogo} alt="Main Logo" className="sb-logo-img" />
        </div>

        <div className="sb-usercard">
          <div className="sb-avatar" aria-hidden="true">{initial}</div>
          <div className="sb-username">{displayName}님</div>
          <div className="sb-chip">일반 사용자</div>
        </div>

        <nav className="sb-nav">
          <div className="sb-section">탐색하기</div>
          <button className="sb-item" onClick={() => onPageChange?.("main")}>🏠 홈</button>
          <button className="sb-item" onClick={() => onPageChange?.("create")}>➕ 행사 등록</button>
          <button className="sb-item" onClick={() => onPageChange?.("qr")}>🪪 QR 체크인</button>
          <button className="sb-item" onClick={() => onPageChange?.("notifications")}>
            🔔 알림 <span className="sb-badge">3</span>
          </button>

          <div className="sb-section">개인 설정</div>
          <button className="sb-item sb-item--active" aria-current="page">👤 마이페이지</button>
          <button className="sb-item" onClick={() => onPageChange?.("my-events")}>🗂️ 내 행사 관리</button>
          {/* 위치 설정은 요구에 따라 제외 */}
        </nav>

        {/* ✅ 사이드바 하단 로그아웃 복구 */}
        <div className="sb-footer">
          <button className="sb-logout" onClick={onLogout}>↪ 로그아웃</button>
        </div>
      </aside>

      {/* Main */}
      <main className="mp-main">
        <div className="mypage-breadcrumb" aria-label="경로 표시">
          <span className="crumb-home" onClick={() => onPageChange?.("main")}>이벤토리</span>
          <span className="crumb-sep">·</span>
          <span className="crumb-current">마이페이지</span>
        </div>

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
          </section>

          {/* 데스크톱: 카드 그리드 */}
          <section className="tile-row desktop-tiles" role="list" aria-label="마이페이지 메뉴(데스크톱)">
            {MENU_ITEMS.map((m) => (
              <button key={m.key} className="tile" role="listitem" onClick={() => onPageChange?.(m.key)}>
                <div className={`tile-icon ${m.key === "profile" ? "tile-edit" :
                                           m.key === "bookmarks" ? "tile-bookmark" :
                                           m.key === "subscriptions" ? "tile-sub" : "tile-upload"}`} aria-hidden="true">
                  {m.icon}
                </div>
                <div className="tile-text">
                  <strong>{m.title}</strong>
                  <span>{m.desc}</span>
                </div>
              </button>
            ))}
          </section>

          {/* 모바일/중간폭: 단일 카드(박스) 안 세로 리스트 */}
          <section className="list-card mobile-list" aria-label="마이페이지 메뉴(리스트)">
            {MENU_ITEMS.map((m, idx) => (
              <button
                key={m.key}
                className="list-row"
                onClick={() => onPageChange?.(m.key)}
                aria-label={m.title}
              >
                <div className={`list-icon ${m.key === "profile" ? "li-edit" :
                                            m.key === "bookmarks" ? "li-bookmark" :
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
        </div>
      </main>
    </div>
  );
};

export default MyPage;
