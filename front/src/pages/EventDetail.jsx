import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import '../css/eventdetail.css';
import axios from 'axios';
import Layout from '../components/Layout';

const DEV_MOCK = true;
const baseURL = process.env.REACT_APP_API_URL ?? '';

const MOCK_EVENT = {
  id: 1,
  title: "임시 이벤트",
  summary: "이벤트 요약입니다.",
  description: "상세 설명입니다.",
  imageUrl: null,
  ownerId: 123,
  ownerName: "라이언",
  ownerProfile: null,
  endDate: "2025-12-31",
  reviews: [{ userName: "홍길동", text: "좋아요!" }],
};

const EventDetail = ({ user }) => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [showReviewPopup, setShowReviewPopup] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchEvent = async () => {
      try {
        if (DEV_MOCK || !baseURL) {
          if (!isMounted) return;
          const mock = { ...MOCK_EVENT, id: Number(id) || MOCK_EVENT.id };
          setEvent(mock);
          return;
        }
        const res = await axios.get(`${baseURL}/api/events/${id}`);
        const data = res.data?.data ?? res.data ?? null;
        if (!isMounted) return;
        setEvent(data);
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setEvent({ ...MOCK_EVENT, id: Number(id) || MOCK_EVENT.id });
      }
    };

    fetchEvent();
    return () => { isMounted = false; };
  }, [id]);

  if (!event) return <div>로딩 중...</div>;

  const isOwner = user?.id === event?.ownerId;
  const isFinished = event?.endDate ? new Date() > new Date(event.endDate) : false;

  return (
    <Layout pageTitle="행사 상세" activeMenuItem="events">
      <div className="event-detail-container">
        <div className="event-image">
          {event?.imageUrl && <img src={event.imageUrl} alt={event?.title ?? '이벤트 이미지'} />}
        </div>

        <div className="event-owner">
          {event?.ownerProfile && (
            <img className="owner-avatar" src={event.ownerProfile} alt={event?.ownerName ?? '주최자'} />
          )}
          <Link to={`/profile/${event?.ownerId ?? ''}`} className="owner-name">
            {event?.ownerName ?? '주최자'}
          </Link>
        </div>

        <div className="event-info">
          <h1 className="event-title">{event?.title ?? '이벤트'}</h1>
          <p className="event-summary">{event?.summary ?? ''}</p>
          <div className="event-description">{event?.description ?? ''}</div>
        </div>

        <div className="event-actions">
          {isOwner && <button className="btn edit-btn">행사 수정하기</button>}
          {!isOwner && isFinished && (
            <button className="btn review-btn" onClick={() => setShowReviewPopup(true)}>
              행사 리뷰 보기
            </button>
          )}
        </div>

        {showReviewPopup && (
          <div className="review-popup">
            <div className="review-content">
              <button className="close-btn" onClick={() => setShowReviewPopup(false)}>✕</button>
              <h2>리뷰</h2>
              <div className="review-list">
                {(event?.reviews ?? []).map((review, idx) => (
                  <div key={idx} className="review-item">
                    <p className="review-user">{review?.userName ?? '익명'}</p>
                    <p className="review-text">{review?.text ?? ''}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EventDetail;
