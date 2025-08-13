import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import '../css/eventdetail.css';
import axios from 'axios';
import Layout from '../components/Layout';
import HostCard from '../components/HostCard';
import {
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaWonSign,
  FaRegHeart,
  FaHeart,
} from 'react-icons/fa';

const DEV_MOCK = true;
const DEV_MOCK_FORCE_REVIEW = true; // ✅ DEV 모드에서 리뷰 버튼 강제 노출 (UI 확인용)
const baseURL = process.env.REACT_APP_API_URL ?? '';

const MOCK_EVENT = {
  id: 1,
  title: "2025 라이언 스튜디오 오픈 네트워킹",
  summary: "디자인·IT 실무자들을 위한 네트워킹과 라이트닝 토크 세션",
  description:
    "라이언 스튜디오에서 진행하는 오픈 네트워킹입니다. 다양한 분야의 실무자들이 프로젝트를 소개하고 협업 파트너를 찾는 자리예요.",
  imageUrl: null,
  ownerId: 123,
  ownerName: "라이언 스튜디오",
  ownerProfile: null,
  date: "2025-11-15",
  time: "14:00 - 17:00",
  location: "서울 마포구 어딘가 123",
  fee: "무료",
  hashtags: ["디자인", "IT", "네트워킹"],
  endDate: "2025-12-31",
  reviews: [
    { userName: "홍길동", text: "분위기가 좋아서 네트워킹하기 편했어요." },
    { userName: "김영희", text: "라이트닝 토크가 알찼습니다!" },
  ],
  bookmarked: false,
};

const EventDetail = ({ user }) => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  // 이미지 모달 ESC 닫기
  useEffect(() => {
    if (!showImageModal) return;
    const onKey = (e) => e.key === 'Escape' && setShowImageModal(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showImageModal]);

  // 이벤트 가져오기
  useEffect(() => {
    let isMounted = true;
    const fetchEvent = async () => {
      try {
        if (DEV_MOCK || !baseURL) {
          if (!isMounted) return;
          const mock = { ...MOCK_EVENT, id: Number(id) || MOCK_EVENT.id };
          setEvent(mock);
          setBookmarked(!!mock.bookmarked);
          setLoading(false);
          return;
        }
        const res = await axios.get(`${baseURL}/api/events/${id}`);
        const data = res.data?.data ?? res.data ?? null;
        if (!isMounted) return;
        setEvent(data);
        setBookmarked(!!data?.bookmarked);
        setLoading(false);
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        const mock = { ...MOCK_EVENT, id: Number(id) || MOCK_EVENT.id };
        setEvent(mock);
        setBookmarked(!!mock.bookmarked);
        setLoading(false);
      }
    };
    fetchEvent();
    return () => { isMounted = false; };
  }, [id]);

  // 종료 여부 계산(끝시간까지 고려)
  const isEventFinished = (evt) => {
    if (!evt) return false;
    const now = new Date();

    // 1) endDate가 있으면 그걸 우선
    if (evt.endDate) {
      const end = new Date(evt.endDate);
      if (!isNaN(end)) return now > end;
    }

    // 2) 아니면 date(+time 마지막 값) 기반
    if (evt.date) {
      const base = new Date(evt.date);
      if (isNaN(base)) return false;

      // time이 "14:00 - 17:00" 같은 형식이면 마지막 시간을 종료로 사용
      let hh = 23, mm = 59;
      if (evt.time) {
        const parts = String(evt.time).split('-');
        const last = parts[parts.length - 1].trim();
        const m = last.match(/^(\d{1,2}):(\d{2})$/);
        if (m) {
          hh = Math.min(23, parseInt(m[1], 10));
          mm = Math.min(59, parseInt(m[2], 10));
        }
      }
      base.setHours(hh, mm, 0, 0);
      return now > base;
    }

    return false;
  };

  const isOwner = user?.id === event?.ownerId;
  const isFinished = isEventFinished(event);

  // 리뷰 버튼 노출 판단 (DEV에서는 강제로 노출 가능)
  const showReviewButton =
    !isOwner && (isFinished || (DEV_MOCK && DEV_MOCK_FORCE_REVIEW));

  // 디테일에서도 북마크
  const toggleBookmark = async () => {
    if (!event?.id) return;
    setBookmarked((b) => !b); // UI 먼저

    if (!baseURL || DEV_MOCK) return;
    try {
      if (bookmarked) {
        await axios.delete(`${baseURL}/api/bookmarks/${event.id}`);
      } else {
        await axios.post(`${baseURL}/api/bookmarks/${event.id}`);
      }
    } catch (e) {
      console.error(e);
      setBookmarked((b) => !b); // 실패 시 원복
    }
  };

  // HostCard에 맞춘 데이터
  const hostForCard = event
    ? { id: event.ownerId, name: event.ownerName, profileImage: event.ownerProfile }
    : null;

  return (
    <Layout pageTitle="행사 상세" activeMenuItem="events">
      <div className="event-detail-container">
        {/* Hero: 커버 + 북마크 */}
        <section className="ed-hero">
          <div
            className={`ed-cover ${event?.imageUrl ? '' : 'is-placeholder'}`}
            onClick={() => event?.imageUrl && setShowImageModal(true)}
            role={event?.imageUrl ? 'button' : undefined}
            tabIndex={event?.imageUrl ? 0 : undefined}
            onKeyDown={(e) => {
              if (!event?.imageUrl) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowImageModal(true);
              }
            }}
          >
            {event?.imageUrl ? (
              <img src={event.imageUrl} alt={event?.title ?? '이벤트 이미지'} />
            ) : (
              <div className="ed-cover-fallback">EVENT</div>
            )}

            {/* 북마크 버튼 (커버 우상단) */}
            <button
              className={`ed-bookmark ${bookmarked ? 'bookmarked' : ''}`}
              aria-label="bookmark"
              onClick={(e) => {
                e.stopPropagation();
                toggleBookmark();
              }}
            >
              {bookmarked ? <FaHeart className="icon" /> : <FaRegHeart className="icon" />}
            </button>
          </div>
          <div className="ed-cover-caption">이미지를 클릭하면 크게 볼 수 있어요</div>
        </section>

        {/* 로딩 스켈레톤 */}
        {loading && (
          <div className="ed-skeleton">
            <div className="sk-title" />
            <div className="sk-meta" />
            <div className="sk-block" />
            <div className="sk-block" />
          </div>
        )}

        {/* 본문 */}
        {!loading && event && (
          <>
            {/* 타이틀 + 태그 */}
            <section className="ed-head">
              <h1 className="event-title">{event?.title ?? '이벤트'}</h1>
              {event?.hashtags?.length > 0 && (
                <div className="ed-tags">
                  {event.hashtags.map((t, i) => (
                    <span key={i} className="ed-tag">#{t}</span>
                  ))}
                </div>
              )}
            </section>

            {/* 메타 2x2 */}
            <section className="ed-meta-grid two-by-two">
              <div className="meta-item">
                <FaCalendarAlt aria-hidden />
                <div className="meta-text">
                  <span className="meta-label">날짜</span>
                  <span className="meta-value">{event?.date ?? '-'}</span>
                </div>
              </div>
              <div className="meta-item">
                <FaClock aria-hidden />
                <div className="meta-text">
                  <span className="meta-label">시간</span>
                  <span className="meta-value">{event?.time ?? '-'}</span>
                </div>
              </div>
              <div className="meta-item">
                <FaMapMarkerAlt aria-hidden />
                <div className="meta-text">
                  <span className="meta-label">장소</span>
                  <span className="meta-value">{event?.location ?? '-'}</span>
                </div>
              </div>
              <div className="meta-item">
                <FaWonSign aria-hidden />
                <div className="meta-text">
                  <span className="meta-label">참가비</span>
                  <span className="meta-value">{event?.fee ?? '-'}</span>
                </div>
              </div>
            </section>

            {/* AI 요약 */}
            <section className="ed-ai-summary">
              <span className="ai-badge">AI 요약</span>
              <p className="ai-text">{event?.summary ?? ''}</p>
            </section>

            {/* 주최자: HostCard 한 겹 카드로 감싸기 */}
            <section className="ed-organizer">
              <div className="ed-org-card">
                <ul className="org-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {hostForCard && <HostCard host={hostForCard} />}
                </ul>
              </div>
            </section>

            {/* 상세 설명 */}
            <section className="ed-body">
              <h2 className="ed-h2">상세 설명</h2>
              <div className="event-description">{event?.description ?? ''}</div>
            </section>

            {/* 액션: 리뷰 버튼 표시 조건 보강 */}
            <section className="event-actions">
              {isOwner && <button className="btn edit-btn">행사 수정하기</button>}
              {showReviewButton && (
                <button className="btn review-btn" onClick={() => setShowReviewPopup(true)}>
                  행사 리뷰 보기
                </button>
              )}
            </section>

            {/* 리뷰 모달 */}
            {showReviewPopup && (
              <div className="review-popup" role="dialog" aria-modal="true" aria-label="행사 리뷰">
                <div className="review-content">
                  <button className="close-btn" onClick={() => setShowReviewPopup(false)} aria-label="닫기">✕</button>
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

            {/* 이미지 라이트박스 */}
            {showImageModal && event?.imageUrl && (
              <div
                className="ed-img-modal"
                onClick={() => setShowImageModal(false)}
                role="dialog"
                aria-modal="true"
                aria-label="이미지 확대 보기"
              >
                <div className="ed-img-box" onClick={(e) => e.stopPropagation()}>
                  <img src={event.imageUrl} alt={event?.title ?? '이벤트 이미지 확대'} />
                  <button className="ed-img-close" onClick={() => setShowImageModal(false)} aria-label="닫기">✕</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default EventDetail;
