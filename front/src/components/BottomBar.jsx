import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MapPin, ThumbsUp, User, Plus } from 'lucide-react'; // ← Plus 추가
import '../css/bottombar.css';

export default function BottomBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items = useMemo(
    () => [
      { id: 'home',         icon: Home,     label: '홈',   route: '/dashboard' },
      { id: 'location',     icon: MapPin,   label: '위치', route: '/location' },
      { id: 'event-upload', icon: Plus,     label: '업로드', route: '/event-upload' }, // ← 여기!
      { id: 'subscribe',    icon: ThumbsUp, label: '구독', route: '/subscribe' },
      { id: 'mypage',       icon: User,     label: '마이', route: '/mypage' },
    ],
    []
  );

  const routeToId = useMemo(
    () =>
      new Map([
        ['/dashboard', 'home'],
        ['/location', 'location'],
        ['/event-upload', 'event-upload'],
        ['/subscribe', 'subscribe'],
        ['/mypage', 'mypage'],
      ]),
    []
  );

  const activeId = routeToId.get(pathname);

  return (
    <>
      <nav className="bottombar" role="navigation" aria-label="하단 내비게이션">
        {items.map(({ id, icon: Icon, label, route }) => (
          <button
            key={id}
            type="button"
            className={`bottombar-item ${activeId === id ? 'active' : ''}`}
            onClick={() => navigate(route)}
            aria-current={activeId === id ? 'page' : undefined}
          >
            <span className="bottombar-icon-wrap">
              <Icon size={22} />
            </span>
            <span className="bottombar-label">{label}</span>
            <span className="bottombar-indicator" aria-hidden="true" />
          </button>
        ))}
      </nav>
      <div className="bottombar-spacer" />
    </>
  );
}
