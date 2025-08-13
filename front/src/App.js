import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import EventUpload from './pages/EventUpload';
import MyPage from './pages/MyPage';
import SubscribePage from './pages/SubscribePage';
import EventCard from './components/EventCard';
import EventDetail from './pages/EventDetail';
import HostCard from './components/HostCard';
import HostDetail from './pages/HostDetail';



function App() {
  return (
    //페이지 라우팅
    // 페이지가 추가될때마다 어떤 페이지인지 넣어주고 path에 url이 어떻게 보일지 작성
    <Router>
      <Routes>
        <Route path="/" element={<></>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/event-upload" element={<EventUpload />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/host/:id" element={<HostDetail />} />
        <Route path="/event-card" element={<EventCard />} />
        <Route path="/host-card" element={<HostCard />} />
        <Route path="/events/:id" element={<EventDetail />} />
        

      </Routes>
    </Router>
  );
}

export default App;
