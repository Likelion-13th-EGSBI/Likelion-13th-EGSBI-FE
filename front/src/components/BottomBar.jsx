// src/components/BottomBar.jsx
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MapPin, PlusCircle, ThumbsUp, User } from 'lucide-react';
import '../css/bottombar.css';

export default function BottomBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(
    () => [
      { id: 'home', label: '홈',        icon: Home,      route: '/' },
      { id: 'location', label: '위치',  icon: MapPin,    route: '/location' },   // 라우트 없으면 추가 필요
      { id: 'event-upload', label: '업로드', icon: PlusCircle, route: '/event-upload' },
      { id: 'subscriptions', label: '구독', icon: ThumbsUp, route: '/subscribe' },
      { id: 'mypage', label: '마이',    icon: User,      route: '/mypage' },
    ],
    []
  );

  const isActive = (route) => {
    if (route === '/') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname.startsWith(route);
  };

  return (
    <nav className="bottombar" aria-label="하단 내비게이션">
      {items.map(({ id, label, icon: Icon, route }) => (
        <button
          key={id}
          type="button"
          className={`bottombar-item ${isActive(route) ? 'active' : ''}`}
          onClick={() => navigate(route)}
          aria-label={label}
          aria-current={isActive(route) ? 'page' : undefined}
        >
          <span className="bottombar-icon-wrap">
            <Icon size={22} aria-hidden />
          </span>
          <span className="bottombar-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
