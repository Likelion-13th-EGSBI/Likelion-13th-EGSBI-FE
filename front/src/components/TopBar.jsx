import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, LogIn } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../css/topbar.css';
import logo from '../imgs/mainlogo.png';

const TopBar = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 820);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

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
  const goLogin = () => navigate('/login');

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

          <div className="topbar-mobile-right">
            {!isLoggedIn && (
              <button className="topbar-icon-btn" aria-label="로그인" onClick={goLogin}>
                <LogIn size={21} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ===== 데스크톱 ===== */
  return (
    <div className="topbar-container">
      {/* 로그인 상태면 오른쪽 컬럼 제거해서 진짜 풀폭 */}
      <div className={`topbar-content ${isLoggedIn ? 'no-right' : ''}`}>
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

        {/* 비로그인일 때만 버튼 렌더 */}
        {!isLoggedIn && (
          <div className="topbar-right">
            <button className="topbar-icon-btn" aria-label="로그인" onClick={goLogin}>
              <LogIn size={22} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;
