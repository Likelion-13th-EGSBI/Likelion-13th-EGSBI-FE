import React, { useState, useEffect } from 'react';
import { Search, Bell, QrCode, ArrowLeft, LogIn } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../css/topbar.css';
import logo from '../imgs/mainlogo.png';

const TopBar = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 820);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  // 로그인 여부 판단
  const accessToken = localStorage.getItem('accessToken');
  const userId = localStorage.getItem('userId');
  const isLoggedIn = !!(accessToken && userId);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 820);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isHome = location.pathname === '/' || location.pathname === '/dashboard';
  const goBack = () => navigate(-1);
  const goQR = () => navigate('/qr');
  const goLogin = () => navigate('/login');
  
  // 검색 실행
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('/search', { state: { query: searchQuery.trim() } });
    }
  };


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

          {/* 중앙: 검색 입력 (모바일) */}
          <form onSubmit={handleSearch} className="topbar-search-form">
            <div className="topbar-search topbar-search--mobile">
              <Search size={20} className="topbar-search-icon" />
              <input
                type="text"
                placeholder="검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>

          {/* 우측: 로그인 상태에 따른 버튼 */}
          <div className="topbar-mobile-right">
            {isLoggedIn ? (
              <button className="topbar-icon-btn" aria-label="QR" onClick={goQR}>
                <QrCode size={21} />
              </button>
            ) : (
              <button className="topbar-icon-btn" aria-label="로그인" onClick={goLogin}>
                <LogIn size={21} />
              </button>
            )}
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
          <form onSubmit={handleSearch} className="topbar-search-form">
            <div className="topbar-search topbar-search--desktop">
              <Search size={18} className="topbar-search-icon" />
              <input
                type="text"
                placeholder="검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>
        </div>
        <div className="topbar-right">
          {isLoggedIn ? (
            <button className="topbar-icon-btn" aria-label="QR" onClick={goQR}>
              <QrCode size={22} />
            </button>
          ) : (
            <button className="topbar-icon-btn" aria-label="로그인" onClick={goLogin}>
              <LogIn size={22} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;