
import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, ThumbsUp, Heart, UploadCloud, CalendarCheck, User, MapPin, LogOut } from 'lucide-react';
import logo from '../imgs/mainlogo.png';
import '../css/sidebar.css';

const Sidebar = ({ activeMenuItem, user = { name: '김민지' } }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const mainMenuItems = useMemo(
    () => [
      { id: 'home',              icon: Home,        label: '홈',               route: '/' },
      { id: 'event-upload',      icon: FileText,    label: '행사 업로드',       route: '/event-upload' },
      { id: 'subscriptions',     icon: ThumbsUp,    label: '구독',             route: '/subscribe' },
      { id: 'bookmarks',         icon: Heart,       label: '내가 관심있는 행사', route: '/bookmarks' },
      { id: 'my-uploads',        icon: UploadCloud, label: '내가 업로드한 행사', route: '/my-upload-event' },
      { id: 'my-participations', icon: CalendarCheck,label: '내가 참여한 행사',  route: '/my-participations' },
    ],
    []
  );

  const personalMenuItems = [
    { id: 'mypage',   icon: User,   label: '마이페이지', route: '/mypage' },
    { id: 'location', icon: MapPin, label: '위치 설정',  route: '/location' },
  ];

  const routeToId = useMemo(() => {
    const map = new Map();
    [...mainMenuItems, ...personalMenuItems].forEach(m => map.set(m.route, m.id));
    return map;
  }, [mainMenuItems]);

  const activeFromPath = routeToId.get(location.pathname);
  const active = activeMenuItem || activeFromPath || 'home';

  const go = (route) => route && navigate(route);

  return (
    <aside className="sidebar-container" aria-label="사이드바">
      {/* 상단: 로고 + 프로필 */}
      <div className="sidebar-top">
        <div className="sidebar-brand" onClick={() => go('/dashboard')} role="button" tabIndex={0}>
          <img src={logo} alt="서비스 로고" className="sidebar-logo" />
        </div>

  
        <div className="sidebar-user-card rich">
          <div className="sidebar-user-avatar xl">김</div>
          <div className="sidebar-user-details">
            <span className="sidebar-user-name xl">{user?.name ?? '사용자'}</span>
            <span className="sidebar-meta-text strong">온라인</span>
          </div>
        </div>
      </div>

      {/* 메인 메뉴 */}
      <nav className="sidebar-nav" aria-label="메인 메뉴">
        {mainMenuItems.map(({ id, icon: Icon, label, route }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-nav-item ${active === id ? 'active' : ''}`}
            onClick={() => go(route)}
            aria-current={active === id ? 'page' : undefined}
          >
            <Icon size={18} />
            <span className="sidebar-nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* 개인 메뉴 */}
      <div className="sidebar-section compact">
        <h3 className="sidebar-section-title">개인</h3>
        {personalMenuItems.map(({ id, icon: Icon, label, route }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-nav-item ${active === id ? 'active' : ''}`}
            onClick={() => go(route)}
            aria-current={active === id ? 'page' : undefined}
          >
            <Icon size={18} />
            <span className="sidebar-nav-label">{label}</span>
          </button>
        ))}
      </div>

      {/* 하단 로그아웃 */}
      <div className="sidebar-bottom">
        <button type="button" className="sidebar-logout-btn" onClick={() => go('/login')}>
          <LogOut size={16} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
