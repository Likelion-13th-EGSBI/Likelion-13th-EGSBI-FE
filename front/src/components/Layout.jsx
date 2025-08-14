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

  const routeToId = useMemo(
    () =>
      new Map([
        ['/dashboard', 'home'],
        ['/event-upload', 'event-upload'],
        ['/subscribe', 'subscriptions'],
        ['/bookmarks', 'bookmarks'],
        ['/my-uploads', 'my-uploads'],
        ['/my-participations', 'my-participations'],
        ['/mypage', 'mypage'],
        ['/location', 'location'],
        ['/subscribepage', 'subscriptions'], // 과거 경로 호환
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
          {!isPc && <BottomBar />}
        </>
      )}

      <main className={`layout-main-content ${showLayout ? 'with-layout' : 'without-layout'}`}>
        <div className="layout-inner">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
