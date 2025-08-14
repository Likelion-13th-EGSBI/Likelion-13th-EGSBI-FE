// src/components/Layout.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import BottomBar from './BottomBar';
import '../css/layout.css';

const Layout = ({ children, pageTitle = '페이지 제목', activeMenuItem, showLayout = true }) => {
  const [isPc, setIsPc] = useState(() => window.innerWidth >= 1024);
  const location = useLocation();

  useEffect(() => {
    const onResize = () => setIsPc(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 경로 → 메뉴 id 매핑
  const routeToId = useMemo(
    () =>
      new Map([
        ['/', 'home'],
        ['/dashboard', 'home'],
        ['/event-upload', 'event-upload'],
        ['/subscribe', 'subscriptions'],
        ['/bookmarks', 'bookmarks'],
        ['/my-uploads', 'my-uploads'],
        ['/my-participations', 'my-participations'],
        ['/mypage', 'mypage'],
        ['/location', 'location'],

        // 과거 경로 호환
        ['/subscribepage', 'subscriptions'],
      ]),
    []
  );

  const resolvedActive = activeMenuItem || routeToId.get(location.pathname) || 'home';
  const containerClass = `layout-container ${isPc ? 'pc' : 'mobile'}`;

  return (
    <div className={containerClass}>
      {showLayout && (
        <>
          <TopBar />
          {isPc && <Sidebar activeMenuItem={resolvedActive} />}
          {/* ✅ 모바일에서만 하단바 렌더 */}
          {!isPc && <BottomBar />}
        </>
      )}

      <main className={`layout-main-content ${showLayout ? 'with-layout' : 'without-layout'}`}>
        <div className="layout-inner">{children}</div>

        {/* ✅ 모바일에서만 하단바 높이만큼 여백 확보 */}
        {!isPc && <div className="bottombar-spacer" />}
      </main>
    </div>
  );
};

export default Layout;
