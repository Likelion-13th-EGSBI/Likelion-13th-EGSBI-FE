import React, { useState, useEffect } from 'react';
import { Search, Bell, QrCode, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../css/topbar.css';
import logo from '../imgs/mainlogo.png';

const TopBar = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // switch문으로 경로별 제목 결정
  const getTitle = (path) => {
    const isEventDetail = /^\/events\/\d+$/.test(path); // /events/숫자

    switch (true) {
      case path === '/':
        return '메인페이지';
      case path === '/event-upload':
        return '행사 등록';
      case path === '/mypage':
        return '마이페이지';
      case path === '/mypage/edit':
        return '프로필 수정';
      case path === '/notifications':
        return '알림';
      case path === '/settings':
        return '설정';
      case path === '/bookmarks':
        return '북마크한 행사';
      case path === '/events': // 행사 목록
        return '행사 목록';
      case isEventDetail: // 행사 상세
        return '행사 상세';
      default:
        return '페이지 제목';
    }
  };

  const title = getTitle(location.pathname);

  if (isMobile) {
    if (location.pathname === '/') {
      return (
        <div className="topbar-mobile-container">
          <div className="topbar-mobile-content">
            <button className="topbar-mobile-btn topbar-mobile-qr">
              <QrCode size={22} />
            </button>
            <div className="topbar-mobile-search">
              <Search size={18} />
              <input type="text" placeholder="행사 검색..." />
            </div>
            <button
              className="topbar-mobile-btn topbar-mobile-bell"
              onClick={() => navigate('/notifications')}
            >
              <Bell size={21} />
              <span className="topbar-notification-badge">5</span>
            </button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="topbar-mobile-container">
          <div
            className="topbar-mobile-content"
            style={{ justifyContent: 'flex-start' }}
          >
            <button
              className="topbar-mobile-btn"
              onClick={() => navigate(-1)}
              style={{ marginRight: 12 }}
              aria-label="뒤로가기"
            >
              <ArrowLeft size={22} />
            </button>
            <h1 className="topbar-mobile-page-title">{title}</h1>
          </div>
        </div>
      );
    }
  }

  // PC 레이아웃
  return (
    <div className="topbar-container">
      <div className="topbar-content">
        <div className="topbar-left">
          <div className="topbar-logo">
            <img src={logo} alt="로고" className="topbar-logo-img" />
          </div>
        </div>
        <div className="topbar-center">
          <h1 className="topbar-page-title">{title}</h1>
        </div>
        <div className="topbar-right">
          <div className="topbar-search-bar">
            <Search size={18} />
            <input type="text" placeholder="행사를 검색해보세요..." />
          </div>
          <button
            className="topbar-notification-btn"
            onClick={() => navigate('/notifications')}
          >
            <Bell size={20} />
            <span className="topbar-notification-badge">5</span>
          </button>
          <button className="topbar-qr-btn">
            <QrCode size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
