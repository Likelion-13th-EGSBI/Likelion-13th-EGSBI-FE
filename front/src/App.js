import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import EventUpload from './pages/EventUpload';
import MyPage from './pages/MyPage';
import SubscribePage from './pages/SubscribePage';
import EventDetail from './pages/EventDetail';
import HostDetail from './pages/HostDetail';
import EventCard from './components/EventCard';
import HostCard from './components/HostCard';
import MyUploadEvent from './pages/MyUploadEvent';

function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<></>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/event-upload" element={<EventUpload />} />
      <Route path="/mypage" element={<MyPage />} />
      <Route path="/mypage/edit" element={<EditProfile />} />
      <Route path="/bookmarks" element={<BookmarkedEvents />} />
      <Route path="/subscribes" element={<SubscribePage />} />
      <Route path="/joined" element={<JoinedEvents />} />
      <Route path="/notifications" element={<NotificationPage />} />
      <Route path="/subscribe" element={<SubscribePage />} />
      <Route path="/host/:id" element={<HostDetail />} />
      <Route path="/events/:id" element={<EventDetail />} />
      <Route path="/event-card" element={<EventCard />} />
      <Route path="/host-card" element={<HostCard />} />
      <Route path="/my-upload-event" element={<MyUploadEvent/>} />









      </Routes>
    </Router>
  );
}

export default App;