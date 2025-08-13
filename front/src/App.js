import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import MyPage from './pages/MyPage';
import EditProfile from './pages/EditProfile';
import NotificationPage from './pages/NotificationPage';

import SubscribePage from './pages/SubscribePage';        
import BookmarkedEvents from './pages/BookmarkedEvents';  
import JoinedEvents from './pages/JoinedEvents';

function App() {
  return (
    <Router>
      <Routes>
        {/* 메인 */}
        <Route path="/" element={<></>} />

        {/* 인증 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* 마이페이지 & 프로필 */}
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/profile" element={<EditProfile />} />
        <Route path="/bookmarks" element={<BookmarkedEvents />} />
        <Route path="/subscribes" element={<SubscribePage />} />
        <Route path="/joined" element={<JoinedEvents />} />


        {/* 알림 */}
        <Route path="/notifications" element={<NotificationPage />} />

      </Routes>
    </Router>
  );
}

export default App;
