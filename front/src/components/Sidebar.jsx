import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, FileText, ThumbsUp, Heart, UploadCloud, CalendarCheck, User, MapPin, LogOut, LogIn } from 'lucide-react';
import logo from '../imgs/mainlogo.png';
import '../css/sidebar.css';

// 프로필 이미지 캐시를 위한 전역 변수
let profileImageCache = {};

const Sidebar = ({ activeMenuItem }) => {
  const navigate = useNavigate();
  const [profileImageUrl, setProfileImageUrl] = useState(null);

  // 로그인 여부 & 사용자 정보 → 토큰 유무로 판단
  const accessToken = localStorage.getItem('accessToken');
  const userId = localStorage.getItem('userId');
  const profileId = localStorage.getItem('profileId');
  const isLoggedIn = !!(accessToken && userId);

  // ✅ 표시 이름: 닉네임 우선
  const displayName =
    localStorage.getItem('nickname') ||            // MyPage에서 저장하는 키
    localStorage.getItem('userNickname') ||        // 이전(또는 다른) 키
    localStorage.getItem('userName') || '';        // 최후 폴백

  // 프로필 이미지 불러오기 함수
  const loadProfileImage = async () => {
    if (!profileId || !accessToken) return;

    // 캐시에서 먼저 확인
    if (profileImageCache[profileId]) {
      setProfileImageUrl(profileImageCache[profileId]);
      return;
    }

    try {
      const response = await fetch(`https://gateway.gamja.cloud/api/image/${profileId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        profileImageCache[profileId] = imageUrl; // 캐시에 저장
        setProfileImageUrl(imageUrl);
      }
    } catch (error) {
      console.error('프로필 이미지 로드 실패:', error);
    }
  };

  // 로그인된 상태에서 프로필 이미지가 없으면 바로 로드
  if (isLoggedIn && profileId && !profileImageUrl && !profileImageCache[profileId]) {
    loadProfileImage();
  }

  // 반드시 id 값이 Layout의 routeToId value와 100% 일치해야 함
  const mainMenuItems = useMemo(
    () => [
      { id: 'home',              icon: Home,        label: '홈',                route: '/' },
      { id: 'event-upload',      icon: FileText,    label: '행사 업로드',        route: '/event-upload' },
      { id: 'subscriptions',     icon: ThumbsUp,    label: '구독',              route: '/subscribe' },
      { id: 'bookmarks',         icon: Heart,       label: '내가 관심있는 행사',  route: '/bookmarks' },
      { id: 'my-uploads',        icon: UploadCloud, label: '내가 업로드한 행사',  route: '/my-upload-event' },
      { id: 'my-participations', icon: CalendarCheck, label: '내가 참여한 행사',  route: '/joined' },
    ],
    []
  );

  const personalMenuItems = [
    { id: 'mypage',   icon: User,   label: '마이페이지', route: '/mypage' },
    { id: 'location', icon: MapPin, label: '위치 설정',  route: '/location' },
  ];

  // 로그인 필요한 경로인지 확인
  const requiresAuth = (pathname) => {
    const publicPaths = ['/', '/login', '/signup'];
    return !publicPaths.includes(pathname);
  };

  // 네비게이션
  const go = (route, e) => {
    e?.stopPropagation();
    if (!route) return;
    if (requiresAuth(route) && !isLoggedIn) {
      navigate('/login', { state: { from: route } });
      return;
    }
    navigate(route);
  };

  const getUserInitial = () => {
    const name = displayName?.trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // activeMenuItem props만 신뢰
  const active = activeMenuItem || 'home';

  // 로그아웃
  const handleLogout = () => {
    // 캐시 정리
    Object.values(profileImageCache).forEach(url => URL.revokeObjectURL(url));
    profileImageCache = {};
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userNickname');
    localStorage.removeItem('userName');
    localStorage.removeItem('nickname');          // ✅ 닉네임 키도 정리
    localStorage.removeItem('profileId');
    localStorage.removeItem('tokenExpiration');
    setProfileImageUrl(null);
    navigate('/');
  };

  // 로그인 이동
  const handleLogin = () => navigate('/login');

  return (
    <aside className="sidebar-container" aria-label="사이드바">
      <div className="sidebar-top">
        <div className="sidebar-brand" onClick={() => go('/')} role="button" tabIndex={0}>
          <img src={logo} alt="서비스 로고" className="sidebar-logo" />
        </div>
        <div className="sidebar-user-card rich">
          {isLoggedIn ? (
            <div className="sidebar-user-logged-in">
              <div className="sidebar-user-avatar xl">
                {profileImageUrl || profileImageCache[profileId] ? (
                  <img 
                    src={profileImageUrl || profileImageCache[profileId]} 
                    alt="프로필 이미지" 
                    className="sidebar-profile-image"
                  />
                ) : (
                  getUserInitial()
                )}
              </div>
              <div className="sidebar-user-details">
                {/* ✅ 닉네임 표기 */}
                <span className="sidebar-user-name xl">{displayName || '사용자'}</span>
              </div>
            </div>
          ) : (
            <div className="sidebar-user-login" onClick={handleLogin} role="button" tabIndex={0}>
              <div className="sidebar-user-avatar xl"><LogIn size={20} /></div>
              <div className="sidebar-user-details">
                <span className="sidebar-user-name xl">로그인</span>
                <span className="sidebar-meta-text">클릭하여 로그인하세요</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="메인 메뉴">
        {mainMenuItems.map(({ id, icon: Icon, label, route }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-nav-item ${active === id ? 'active' : ''} ${!isLoggedIn && requiresAuth(route) ? 'disabled' : ''}`}
            onClick={(e) => go(route, e)}
            aria-current={active === id ? 'page' : undefined}
            disabled={!isLoggedIn && requiresAuth(route)}
          >
            <Icon size={18} />
            <span className="sidebar-nav-label">{label}</span>
            {!isLoggedIn && requiresAuth(route) && <span className="sidebar-login-required">🔒</span>}
          </button>
        ))}
      </nav>

      {isLoggedIn && (
        <div className="sidebar-section compact">
          <h3 className="sidebar-section-title">개인</h3>
          {personalMenuItems.map(({ id, icon: Icon, label, route }) => (
            <button
              key={id}
              type="button"
              className={`sidebar-nav-item ${active === id ? 'active' : ''}`}
              onClick={(e) => go(route, e)}
              aria-current={active === id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span className="sidebar-nav-label">{label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sidebar-bottom">
        {isLoggedIn ? (
          <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>로그아웃</span>
          </button>
        ) : (
          <button type="button" className="sidebar-login-btn" onClick={handleLogin}>
            <LogIn size={16} />
            <span>로그인</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;