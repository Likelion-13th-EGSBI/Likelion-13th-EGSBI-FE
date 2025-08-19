import React, { useState, useEffect } from 'react';
import { Search, Bell, QrCode, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../css/topbar.css';
import logo from '../imgs/mainlogo.png';

const TopBar = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 820);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 820);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isHome = location.pathname === '/' || location.pathname === '/dashboard';
  const goBack = () => navigate(-1);
  const goQR = () => navigate('/qr');

  /* ===== 모바일 ===== */
  if (isMobile) {
    return (
      <div className="topbar-mobile-container">
        <div className="topbar-mobile-content">
          {/* 좌측: 홈이면 로고, 그 외엔 뒤로가기 */}
          {isHome ? (
            <button
              className="topbar-mobile-logo-btn"
              aria-label="홈"
              onClick={() => navigate('/')}
            >
              <img src={logo} alt="로고" className="topbar-mobile-logo" />
            </button>
          ) : (
            <button className="topbar-icon-btn" aria-label="뒤로가기" onClick={goBack}>
              <ArrowLeft size={22} />
            </button>
          )}

          {/* 중앙: 짧은 검색 (모바일 아이콘 20px 고정) */}
          <div className="topbar-search topbar-search--mobile">
            <Search size={20} className="topbar-search-icon" />
            <input type="text" placeholder="검색" aria-label="검색" />
          </div>

          {/* 우측: 알림/QR */}
          <div className="topbar-mobile-right">
            <button className="topbar-icon-btn" aria-label="QR" onClick={goQR}>
              <QrCode size={21} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ===== 데스크탑 ===== */
  return (
    <div className="topbar-container">
      <div className="topbar-content">
        <div className="topbar-center">
          <div className="topbar-search topbar-search--desktop">
            <Search size={18} className="topbar-search-icon" />
            <input type="text" placeholder="검색" aria-label="검색" />
          </div>
        </div>
        <div className="topbar-right">
          <button className="topbar-icon-btn" aria-label="QR" onClick={goQR}>
            <QrCode size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
