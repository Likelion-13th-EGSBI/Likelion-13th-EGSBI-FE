import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import '../css/hostdetail.css';
import EventCard from "../components/EventCard";

const DEV_MOCK = true;
const baseURL = process.env.REACT_APP_API_URL ?? '';

const MOCK_HOST = {
  id: 1,
  name: '라이언 스튜디오',
  profileImage: null,
  rating: 4.4,
  reviewsCount: 128,
  aiSummary:
    '디자인/IT 분야의 전문 커뮤니티로, 실무 중심 워크숍과 네트워킹이 강점입니다. 친절한 진행과 알찬 자료가 호평을 받습니다. 재참여 의사가 높고, 운영팀 소통이 빠르다는 의견이 많습니다.',
};
const MOCK_EVENTS = [
  { id: 1, title: "행사 1", image: null, date: "2025-10-01", time: "10:00", location: "서울", fee: "무료", hashtag: ["디자인", "IT", "커뮤니티"] },
  { id: 2, title: "행사 2", image: null, date: "2025-11-01", time: "15:00", location: "부산", fee: "10,000원" },
  { id: 3, title: "행사 3", image: null, date: "2025-12-10", time: "09:00", location: "대구", fee: "무료" },
  { id: 4, title: "행사 4", image: null, date: "2026-01-15", time: "13:00", location: "광주", fee: "5,000원" },
  { id: 5, title: "행사 5", image: null, date: "2026-02-20", time: "14:00", location: "인천", fee: "무료" },
  { id: 6, title: "행사 6", image: null, date: "2026-03-05", time: "11:00", location: "제주", fee: "무료" },
];


export default function HostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [host, setHost] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [bookmarks, setBookmarks] = useState({});
  const toggleBookmark = (id) => {
    setBookmarks(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const Stars = ({ value = 0 }) => {
    const full = Math.floor(value);
    const half = value - full >= 0.5;
    const total = 5;
    return (
      <div className="stars" aria-label={`평점 ${value} / 5`}>
        {Array.from({ length: total }).map((_, i) => {
          if (i < full) return <span key={i}>★</span>;
          if (i === full && half) return <span key={i}>☆</span>;
          return <span key={i}>☆</span>;
        })}
      </div>
    );
  };

  const shortSummary = useMemo(() => {
    const raw =
      host?.aiSummary ??
      '아직 리뷰 요약이 준비되지 않았습니다. 행사 참가 후 첫 리뷰의 주인공이 되어보세요!';
    return raw.length <= 140 ? raw : raw.slice(0, 140).trim() + '…';
  }, [host?.aiSummary]);

  const fetchHost = useCallback(async () => {
    if (DEV_MOCK) return;
    const res = await axios.get(`${baseURL}/api/hosts/${id}`);
    const data = res.data?.data ?? res.data ?? null;
    setHost(data);
    setIsSubscribed(!!data?.isSubscribed);
  }, [id]);

  useEffect(() => {
    if (DEV_MOCK) {
      setHost(MOCK_HOST);
      setIsSubscribed(true);
    } else {
      fetchHost();
    }
  }, [fetchHost]);

  const toggleSubscribe = async () => {
    if (!host?.id) return;
    if (DEV_MOCK || !baseURL) {
      setIsSubscribed(s => !s);
      return;
    }
    try {
      setSubscribing(true);
      if (isSubscribed) {
        await axios.delete(`${baseURL}/api/subscribe/${host.id}`);
        setIsSubscribed(false);
      } else {
        await axios.post(`${baseURL}/api/subscribe/${host.id}`);
        setIsSubscribed(true);
      }
    } finally {
      setSubscribing(false);
    }
  };

  const goEventsPage = () => {
    navigate(`/host/${id}/events`, { state: { hostName: host?.name } });
  };

  return (
    <Layout pageTitle="주최자" activeMenuItem="subscribe">
      <div className="host-detail">
        <div className="hd-inner">
          {/* 프로필 카드: 아바타가 카드 바깥으로 살짝 겹치도록 */}
          <section className="hero-card card-overlap">
            <div className="avatar-xxl">
              {host?.profileImage ? (
                <img src={host.profileImage} alt={`${host?.name ?? '주최자'} 프로필`} />
              ) : (
                (host?.name?.[0] ?? '호')
              )}
            </div>

            <div className="hero-content">
              <h1 className="host-title" title={host?.name}>
                {host?.name ?? '주최자'}
              </h1>
              <div className="host-stars-row">
                <Stars value={host?.rating ?? 0} />
              </div>
            </div>

            <button
              className={`pill-subscribe ${isSubscribed ? 'on' : ''}`}
              onClick={toggleSubscribe}
              disabled={subscribing}
            >
              {isSubscribed ? '구독 중' : '구독하기'}
            </button>
          </section>

          {/* AI 요약 카드 */}
          <section className="ai-summary-card">
            <div className="ai-badge">
              <strong>{host?.name ?? '주최자'}</strong>님의 행사를 다녀간 사람들의 리뷰를 AI가 요약했어요
            </div>
            <p className="ai-summary-txt">{shortSummary}</p>
          </section>

          {/* 🆕 주최자 행사 목록 */}
          <section className="host-events-section">
            <h2 className="section-title">주최한 행사</h2>
            <div className="event-grid">
              {MOCK_EVENTS.map((event) => (
                <EventCard key={event.id} {...event} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
