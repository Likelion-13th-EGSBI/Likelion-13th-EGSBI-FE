import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import MyPage from './pages/MyPage';
import EventCard from './components/EventCard';
import EventDetail from './pages/EventDetail';
import HostCard from './components/HostCard';
import HostDetail from './pages/HostDetail';
import EditProfile from './pages/EditProfile';
import NotificationPage from './pages/NotificationPage';
import SubscribePage from './pages/SubscribePage';        
import BookmarkedEvents from './pages/BookmarkedEvents';  
import JoinedEvents from './pages/JoinedEvents';
import EventUpload from './pages/EventUpload';



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<></>} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/host/:id" element={<HostDetail />} />
        <Route path="/event-card" element={<EventCard />} />
        <Route path="/host-card" element={<HostCard />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/event-upload" element={<EventUpload />} /> 
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/mypage/edit" element={<EditProfile />} />
        <Route path="/bookmarks" element={<BookmarkedEvents />} />
        <Route path="/subscribes" element={<SubscribePage />} />
        <Route path="/joined" element={<JoinedEvents />} />
        <Route path="/notifications" element={<NotificationPage />} />













      </Routes>
    </Router>
  );
}

export default App;
