import React from 'react';
import Layout from '../components/Layout';
import { Calendar, MapPin, Users, Clock, Sparkles, Heart, Star } from 'lucide-react';
import '../css/initmain.css';

const MainPage = () => {
  return (
    <Layout pageTitle="메인" activeMenuItem="home">
      <div className="main-container">
        {/* 헤더 섹션 */}
        <div className="main-header">
          <div className="main-hero">
            <div className="main-hero-content">
              <div className="main-hero-icon">
                <Sparkles size={48} />
              </div>
              <h1 className="main-hero-title">
                메인페이지 작업중
              </h1>
              <p className="main-hero-subtitle">
                곧 더 멋진 모습으로 찾아뵙겠습니다
              </p>
              <div className="main-hero-decorations">
                <div className="main-decoration main-decoration-1">
                  <Heart size={20} />
                </div>
                <div className="main-decoration main-decoration-2">
                  <Star size={16} />
                </div>
                <div className="main-decoration main-decoration-3">
                  <Sparkles size={18} />
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* 푸터 메시지 */}
        <div className="main-footer">
          <div className="main-footer-content">
            <div className="main-footer-icon">
              <Heart size={24} />
            </div>
            <p className="main-footer-text">
              더 나은 서비스를 위해 열심히 개발하고 있어요
            </p>
            <div className="main-footer-dots">
              <div className="main-dot main-dot-1"></div>
              <div className="main-dot main-dot-2"></div>
              <div className="main-dot main-dot-3"></div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MainPage;