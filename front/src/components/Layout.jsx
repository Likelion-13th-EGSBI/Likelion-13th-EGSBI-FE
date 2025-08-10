import React, { useState, useEffect } from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import '../css/layout.css';

const Layout = ({ 
  children, 
  pageTitle = "페이지 제목", 
  activeMenuItem = "dashboard",
  showLayout = true // 전체 레이아웃 표시 여부
}) => {
  const [isPc, setIsPc] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsPc(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="layout-container">
      {showLayout && (
        <>
          {/* TopBar는 항상 표시 */}
          <TopBar title={pageTitle} />

          {/* Sidebar는 PC일 때만 표시 */}
          {isPc && <Sidebar activeMenuItem={activeMenuItem} />}
        </>
      )}

      <main className={`layout-main-content ${showLayout ? 'with-layout' : 'without-layout'}`}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
