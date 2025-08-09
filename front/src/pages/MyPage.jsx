import React, { useMemo } from "react";
import "../css/mypage.css";
import mainLogo from "../imgs/mainlogo.png";

const MyPage = ({ onPageChange, onLogout, user }) => {
  const displayName = user?.name || "사용자";
  const email = user?.email || "email@example.com";
  const initial = useMemo(() => (displayName ? displayName[0] : "U"), [displayName]);

  return (
    <div className="mp-layout">
      {/* Sidebar (항상 펼침) */}
      <aside className="mp-sidebar" aria-label="주 메뉴">
        <div className="sb-logo-wrap">
          <img src={mainLogo} alt="Main Logo" className="sb-logo-img" />
        </div>

        <div className="sb-usercard">
          <div className="sb-avatar">{initial}</div>
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
          <button className="sb-item sb-item--active" onClick={() => onPageChange?.("mypage")}>👤 마이페이지</button>
          <button className="sb-item" onClick={() => onPageChange?.("my-events")}>🗂️ 내 행사 관리</button>
          <button className="sb-item" onClick={() => onPageChange?.("location")}>📍 위치 설정</button>
        </nav>

        <div className="sb-footer">
          <button className="sb-logout" onClick={onLogout}>↪ 로그아웃</button>
        </div>
      </aside>

      {/* Main */}
      <main className="mp-main">
        {/* 브레드크럼 */}
        <div className="mypage-breadcrumb">
          <span className="crumb-home" onClick={() => onPageChange?.("main")}>이벤토리</span>
          <span className="crumb-sep">·</span>
          <span className="crumb-current">마이페이지</span>
        </div>

        <div className="mypage-wrap">
          {/* 상단 요약 카드 (프로필 편집 버튼 제거) */}
          <section className="hero-card">
            <div className="hero-left">
              <div className="hero-avatar" aria-hidden="true">{initial}</div>
              <div className="hero-meta">
                <h2 className="hero-name">{displayName}</h2>
                <p className="hero-mail">{email}</p>
              </div>
            </div>
          </section>

          {/* 액션 타일: 데스크톱=카드 그리드 / 반틈~모바일=하나의 카드 안 리스트 */}
          <section className="tile-row tile-stackable">
            <button className="tile" onClick={() => onPageChange?.("profile")}>
              <div className="tile-icon tile-edit">📝</div>
              <div className="tile-text">
                <strong>프로필 편집</strong>
                <span>개인정보 수정</span>
              </div>
            </button>

            <button className="tile" onClick={() => onPageChange?.("my-events")}>
              <div className="tile-icon tile-upload">📌</div>
              <div className="tile-text">
                <strong>내가 참여한 행사</strong>
                <span>참여한 행사 관리</span>
              </div>
            </button>

            <button className="tile" onClick={() => onPageChange?.("bookmarks")}>
              <div className="tile-icon tile-bookmark">🔖</div>
              <div className="tile-text">
                <strong>북마크</strong>
                <span>관심있는 행사</span>
              </div>
            </button>

            <button className="tile" onClick={() => onPageChange?.("subscriptions")}>
              <div className="tile-icon tile-sub">👥</div>
              <div className="tile-text">
                <strong>구독한 주최자</strong>
                <span>구독 중인 주최자</span>
              </div>
            </button>
          </section>

          {/* 계정 카드 */}
          <section className="account-card">
            <div className="account-left">
              <h3>계정 관리</h3>
              <p>로그아웃 및 계정 설정</p>
            </div>
            <div className="account-right">
              <button className="btn-danger-outline" onClick={onLogout}>↪ 로그아웃</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default MyPage;
