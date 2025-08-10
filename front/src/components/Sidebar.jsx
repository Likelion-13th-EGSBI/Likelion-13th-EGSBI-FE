import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, FileText, QrCode, Calendar, User, MapPin, LogOut, Bell } from 'lucide-react';
import '../css/sidebar.css';

const Sidebar = ({ activeMenuItem = 'home' }) => {
  const [activeMenu, setActiveMenu] = useState(activeMenuItem);
  const navigate = useNavigate();

  // 사진 메뉴 전체 정리
  const mainMenuItems = [
    { id: 'home', icon: Home, label: '홈', route: '/dashboard' },
    { id: 'event-upload', icon: FileText, label: '행사 등록', route: '/event-upload' },
    { id: 'qr', icon: QrCode, label: 'QR 체크인', route: '/qr' },
    { id: 'notifications', icon: Bell, label: '알림', route: '/notifications', badge: 3 },
  ];

  const myMenuItems = [
    { id: 'mypage', icon: User, label: '마이페이지', route: '/mypage' },
    { id: 'event-manage', icon: Calendar, label: '내 행사 관리', route: '/event-manage' },
    { id: 'location', icon: MapPin, label: '위치 설정', route: '/location' },
  ];

  const handleMenuClick = (menuId, route) => {
    setActiveMenu(menuId);
    if(route) navigate(route);
  };

  return (
    <div className="sidebar-container">
      {/* 사용자 정보 헤더 */}
      <div className="sidebar-header">
        <div className="sidebar-user-info">
          <div className="sidebar-user-avatar">김</div>
          <div className="sidebar-user-details">
            <span className="sidebar-user-name">김민지</span>
          </div>
        </div>
      </div>

      {/* 행사 등록 버튼(사진 기준 강조) */}
      <div className="sidebar-section">
        <button
          className="sidebar-create-btn"
          onClick={() => handleMenuClick('event-upload', '/event-upload')}
        >
          <FileText size={16} />
          <span>행사 등록</span>
        </button>
      </div>

      {/* 메인 메뉴 */}
      <nav className="sidebar-nav">
        {mainMenuItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-nav-item ${activeMenu === item.id ? 'active' : ''}`}
            onClick={() => handleMenuClick(item.id, item.route)}
          >
            <item.icon size={20} />
            <span className="sidebar-nav-label">{item.label}</span>
            {item.badge && (
              <span className="sidebar-nav-badge">{item.badge}</span>
            )}
          </div>
        ))}
      </nav>

      {/* 개인 설정 및 행사 관리 메뉴 */}
      <div className="sidebar-section">
        <h3 className="sidebar-section-title">개인 설정</h3>
        {myMenuItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-nav-item ${activeMenu === item.id ? 'active' : ''}`}
            onClick={() => handleMenuClick(item.id, item.route)}
          >
            <item.icon size={20} />
            <span className="sidebar-nav-label">{item.label}</span>
          </div>
        ))}
      </div>

      {/* 하단 로그아웃 */}
      <div className="sidebar-footer">
        <button className="sidebar-logout-btn" onClick={() => navigate('/login')}>
          <LogOut size={16} />
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
