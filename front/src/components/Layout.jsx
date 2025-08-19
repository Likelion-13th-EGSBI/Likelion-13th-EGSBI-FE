// src/components/Layout.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import BottomBar from './BottomBar';
import '../css/layout.css';

const Layout = ({ children, pageTitle = '페이지 제목', activeMenuItem, showLayout = true }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const location = useLocation();

  // 창 크기 변경 감지
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isPc = windowWidth >= 1025;
  const isTablet = windowWidth >= 821 && windowWidth <= 1024;
  const isMobile = windowWidth <= 820;

  const containerClass = `layout-container ${isPc ? 'pc' : isTablet ? 'tablet' : 'mobile'}`;

  // 경로 → 메뉴 id 매핑
  const routeToId = useMemo(
    () =>
      new Map([
        ['/', 'home'],
        ['/dashboard', 'home'],
        ['/event-upload', 'event-upload'],
        ['/subscribe', 'subscriptions'],
        ['/bookmarks', 'bookmarks'],
        ['/my-upload-event', 'my-uploads'],
        ['/joined', 'my-participations'],
        ['/mypage', 'mypage'],
        ['/location', 'location'],
        ['/subscribepage', 'subscriptions'],
      ]),
    []
  );

  const resolvedActive = activeMenuItem || routeToId.get(location.pathname) || 'home';

  return (
    <div className={containerClass}>
      {showLayout && (
        <>
          <TopBar />

          {/* PC, 테블릿(아이패드 프로 포함): 사이드바 렌더 */}
          {(isPc || isTablet) && <Sidebar activeMenuItem={resolvedActive} />}

          {/* 모바일(820px 이하): 하단바 */}
          {isMobile && <BottomBar />}
        </>
      )}

      <main className={`layout-main-content ${showLayout ? 'with-layout' : 'without-layout'}`}>
        <div className="layout-inner">{children}</div>

        {/* 모바일: 하단바 높이만큼 여백 */}
        {isMobile && <div className="bottombar-spacer" />}
      </main>
    </div>
  );
};

export default Layout;