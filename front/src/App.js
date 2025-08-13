import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
// import EventUpload from './pages/EventUpload'; // 업로드 페이지 (나중에 추가)
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
        <Route path="/" element={<></>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/mypage/edit" element={<EditProfile />} />
        <Route path="/notifications" element={<NotificationPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/bookmarks" element={<BookmarkedEvents />} />
        <Route path="/joined" element={<JoinedEvents />} />
        {/* 업로드 페이지 — 나중에 필요하면 주석 해제 */}
        {/* <Route path="/event-upload" element={<EventUpload />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
