import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

function App() {
  return (
    //페이지 라우팅
    // 페이지가 추가될때마다 어떤 페이지인지 넣어주고 path에 url이 어떻게 보일지 작성
    <Router>
      <Routes>
        <Route path="/" element={<></>} />
      </Routes>
    </Router>
  );
}

export default App;
