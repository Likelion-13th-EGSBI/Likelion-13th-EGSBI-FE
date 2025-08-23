// src/pages/EventDetail.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../css/eventdetail.css';
import Layout from '../components/Layout';
import HostCard from '../components/HostCard';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaWonSign, FaRegHeart, FaHeart } from 'react-icons/fa';

const API_BASE = 'https://gateway.gamja.cloud';

function getAccessToken() {
  return (
    localStorage.getItem('accessToken') ||
    localStorage.getItem('Token') ||
    localStorage.getItem('token') ||
    ''
  );
}
function getUserId() {
  const raw = localStorage.getItem('userId') ?? localStorage.getItem('userid') ?? '';
  const onlyDigits = (raw.match(/\d+/g) || []).join('');
  const n = onlyDigits ? parseInt(onlyDigits, 10) : null;
  return Number.isFinite(n) && n > 0 ? n : null;
}
function baseAuthHeaders() {
  const token = getAccessToken();
  const uid = getUserId();
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (uid) h['X-User-Id'] = String(uid);
  return h;
}

const api = axios.create({ baseURL: API_BASE });
async function apiRequest(config, { retry = true } = {}) {
  const headers = { ...(config.headers || {}), ...baseAuthHeaders() };
  try {
    return await api.request({ ...config, headers, withCredentials: false });
  } catch (err) {
    const is401 = axios.isAxiosError(err) && err.response?.status === 401;
    if (is401 && retry) {
      const uid = getUserId();
      if (!uid) throw err;
      try {
        const renew = await axios.post(`${API_BASE}/api/user/renew`, null, {
          headers: { ...baseAuthHeaders(), 'X-User-Id': String(uid) },
          withCredentials: false,
        });
        const token = renew?.data?.accessToken;
        if (token) localStorage.setItem('accessToken', token);
      } catch {
        throw err;
      }
      const headers2 = { ...(config.headers || {}), ...baseAuthHeaders() };
      return api.request({ ...config, headers: headers2, withCredentials: false });
    }
    throw err;
  }
}

const toDateText = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};
const toTimeRange = (sISO, eISO) => {
  const f = (x) =>
    x?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) ?? '';
  const s = sISO ? new Date(sISO) : null;
  const e = eISO ? new Date(eISO) : null;
  if (s && e) return `${f(s)} - ${f(e)}`;
  if (s) return f(s);
  return '-';
};
const toDateTimeText = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
};

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function isSafeUrl(url) {
  try {
    const u = new URL(url, document.baseURI);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol);
  } catch {
    return false;
  }
}
function mdInline(input = '') {
  let s = escapeHtml(input);
  s = s.replace(/\[([^[\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    return isSafeUrl(url)
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
      : escapeHtml(text);
  });
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).]|$)/g, '$1<em>$2</em>');
  return s;
}
function mdBlock(input = '') {
  const src = String(input ?? '').replace(/<br\s*\/?>/gi, '\n');
  const lines = src.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${mdInline(h[2])}</h${level}>`);
      continue;
    }
    const ul = /^\s*[-*]\s+(.+)$/.exec(line);
    if (ul) {
      out.push(`<p>• ${mdInline(ul[1])}</p>`);
      continue;
    }
    const ol = /^\s*(\d+)\.\s+(.+)$/.exec(line);
    if (ol) {
      out.push(`<p>${ol[1]}. ${mdInline(ol[2])}</p>`);
      continue;
    }
    if (line.trim() === '') {
      out.push('<br/>');
      continue;
    }
    out.push(`<p>${mdInline(line)}</p>`);
  }
  return out.join('');
}
const mdToHtml = (src = '') => mdBlock(src);

const toImageUrl = (id) => (Number.isFinite(Number(id)) && Number(id) > 0 ? `${API_BASE}/api/image/${id}` : '');

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const eventId = useMemo(() => {
    const n = id ? parseInt(id, 10) : null;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [id]);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const [bookmarking, setBookmarking] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState(null);
  const [posterUrl, setPosterUrl] = useState('');

  const [organizerProfile, setOrganizerProfile] = useState(null); 

  useEffect(() => {
    let active = true;
    (async () => {
      if (!eventId) {
        setError('잘못된 이벤트 ID 입니다.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await apiRequest({ method: 'GET', url: `/api/event/info/${eventId}` });
        if (!active) return;
        setEvent(res.data || null);
      } catch (e) {
        if (!active) return;
        if (axios.isAxiosError(e) && e.response?.status === 404) setError('조건에 맞는 행사가 없어요');
        else setError('네트워크 오류가 발생했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    let created = '';
    (async () => {
      const pid = event?.posterId;
      if (!pid) {
        setPosterUrl('');
        return;
      }
      try {
        const res = await apiRequest({
          method: 'GET',
          url: `/api/image/${pid}`,
          responseType: 'blob',
        });
        if (cancelled) return;
        const blob = res.data;
        if (blob instanceof Blob) {
          const url = URL.createObjectURL(blob);
          created = url;
          setPosterUrl(url);
        } else {
          setPosterUrl(toImageUrl(pid));
        }
      } catch {
        setPosterUrl(toImageUrl(pid));
      }
    })();
    return () => {
      if (created) URL.revokeObjectURL(created);
    };
  }, [event?.posterId]);

  useEffect(() => {
    let active = true;
    if (!event?.id) return () => { active = false; };
    (async () => {
      try {
        setLoadingSummary(true);
        const resp = await apiRequest({ method: 'POST', url: `/api/ai/${event.id}` });
        if (!active) return;
        const text = typeof resp.data === 'string' ? resp.data : (resp.data?.data ?? resp.data ?? '');
        setAiSummary(String(text || ''));
      } catch {
        if (!active) return;
        setAiSummary('');
      } finally {
        if (active) setLoadingSummary(false);
      }
    })();
    return () => { active = false; };
  }, [event?.id]);

  const isOwner = useMemo(() => {
    const uid = getUserId();
    return uid && event?.organizerId ? uid === event.organizerId : false;
  }, [event]);
  const isFinished = useMemo(() => {
    if (!event?.endTime && !event?.startTime) return false;
    const end = event?.endTime ? new Date(event.endTime) : new Date(event.startTime);
    return Number.isNaN(end.getTime()) ? false : Date.now() > end.getTime();
  }, [event]);

  const dateText = useMemo(() => toDateText(event?.startTime), [event]);
  const timeText = useMemo(() => toTimeRange(event?.startTime, event?.endTime), [event]);

  const refreshBookmarkState = useCallback(async (eid) => {
    try {
      const [listRes, cntRes] = await Promise.all([
        apiRequest({ method: 'GET', url: '/api/activity/bookmark/list' }),
        apiRequest({ method: 'GET', url: '/api/activity/bookmark/count', params: { eventId: eid } }),
      ]);
      const list = Array.isArray(listRes.data) ? listRes.data : [];
      const has = list.some((b) => Number(b?.eventId) === Number(eid));
      setBookmarked(has);
      const c = Number(cntRes?.data);
      setBookmarkCount(Number.isFinite(c) ? c : 0);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;
    const uid = getUserId();
    const token = getAccessToken();
    if (!uid || !token) {
      setBookmarked(false);
      setBookmarkCount(0);
      return;
    }
    refreshBookmarkState(eventId);
  }, [eventId, refreshBookmarkState]);

  const onToggleBookmark = async () => {
    if (!event?.id || bookmarking) return;
    const uid = getUserId();
    const token = getAccessToken();
    if (!uid || !token) {
      alert('로그인이 필요합니다.');
      return;
    }
    const optimistic = !bookmarked;
    setBookmarking(true);
    setBookmarked(optimistic);
    setBookmarkCount((v) => Math.max(0, v + (optimistic ? 1 : -1)));
    try {
      await apiRequest({
        method: 'POST',
        url: '/api/activity/bookmark/toggle',
        data: { eventId: Number(event.id) },
      });
      await refreshBookmarkState(event.id);
    } catch (e) {
      setBookmarked(!optimistic);
      setBookmarkCount((v) => Math.max(0, v + (optimistic ? -1 : 1)));
      if (axios.isAxiosError(e) && e.response?.status === 401)
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      else alert('네트워크 오류가 발생했습니다.');
    } finally {
      setBookmarking(false);
    }
  };

  const openReviewPopup = async () => {
    if (!eventId) return;
    setShowReviewPopup(true);
    setLoadingReviews(true);
    try {
      const res = await apiRequest({
        method: 'GET',
        url: '/api/activity/review/eventlist',
        params: { eventId },
      });
      setReviews(Array.isArray(res.data) ? res.data : []);
    } catch {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };
  const closeReviewPopup = () => setShowReviewPopup(false);

  const avgRating = useMemo(() => {
    if (!reviews?.length) return null;
    const sum = reviews.reduce((acc, r) => acc + (Number(r?.rating) || 0), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  const fetchOrganizerProfile = useCallback(async (organizerId) => {
    try {
      const r = await apiRequest({ method: 'GET', url: '/api/user/info', params: { userId: organizerId } });
      const data = r?.data ?? null;
      const nickname = data?.nickname ?? '';
      const profileId = data?.profileId ?? null;
      const displayName = nickname || `Organizer #${organizerId}`;
      return {
        id: organizerId,
        name: displayName,
        nickname: nickname || null,
        avatarUrl: toImageUrl(profileId),
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const oid = event?.organizerId;
      if (!oid) { setOrganizerProfile(null); return; }
      const prof = await fetchOrganizerProfile(oid);
      if (!alive) return;
      if (prof) setOrganizerProfile(prof);
      else {
        setOrganizerProfile({
          id: oid,
          name: event?.organizerName || `Organizer #${oid}`,
          nickname: null,
          avatarUrl: '',
        });
      }
    })();
    return () => { alive = false; };
  }, [event?.organizerId, event?.organizerName, fetchOrganizerProfile]);

  return (
    <Layout pageTitle="행사 상세" activeMenuItem="events">
      <div className="event-detail-container">
        {error && (
          <div className="error-box">
            <p className="error-detail" style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </p>
          </div>
        )}

        <section className="ed-hero">
          <div className={`ed-cover ${event?.posterId ? '' : 'is-placeholder'}`}>
            {event?.posterId ? (
              posterUrl ? (
                <img src={posterUrl} alt={event?.name ?? '이벤트 이미지'} />
              ) : (
                <div className="ed-cover-fallback">EVENT</div>
              )
            ) : (
              <div className="ed-cover-fallback">EVENT</div>
            )}
            <button
              className={`ed-bookmark ${bookmarked ? 'bookmarked' : ''}`}
              aria-label="bookmark"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark();
              }}
              disabled={bookmarking}
              title={bookmarking ? '처리 중...' : bookmarked ? '북마크 해제' : '북마크'}
            >
              {bookmarked ? <FaHeart className="icon" /> : <FaRegHeart className="icon" />}
            </button>
          </div>
          <div className="ed-cover-caption">
            {Number.isFinite(bookmarkCount) ? ` · 북마크 ${bookmarkCount}` : ''}
          </div>
        </section>

        {loading && !error && (
          <div className="ed-skeleton">
            <div className="sk-title" />
            <div className="sk-meta" />
            <div className="sk-block" />
            <div className="sk-block" />
          </div>
        )}

        {!loading && event && !error && (
          <>
            <section className="ed-head">
              <h1
                className="event-title"
                dangerouslySetInnerHTML={{ __html: mdToHtml(event?.name ?? '이벤트') }}
              />
              {Array.isArray(event?.hashtags) && event.hashtags.length > 0 && (
                <div className="ed-tags">
                  {event.hashtags.map((t, i) => (
                    <span key={i} className="ed-tag">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="ed-meta-grid two-by-two">
              <div className="meta-item">
                <FaCalendarAlt aria-hidden />
                <div className="meta-text">
                  <span className="meta-label">날짜</span>
                  <span className="meta-value">{dateText}</span>
                </div>
              </div>
              <div className="meta-item">
                <FaClock aria-hidden />
                <div className="meta-text">
                  <span className="meta-label">시간</span>
                  <span className="meta-value">{timeText}</span>
                </div>
              </div>
              <div className="meta-item">
                <FaMapMarkerAlt aria-hidden />
                <div className="meta-text">
                  <span className="meta-label">장소</span>
                  <span className="meta-value">{event?.address ?? '-'}</span>
                </div>
              </div>
              <div className="meta-item">
                <FaWonSign aria-hidden />
                <div className="meta-text">
                  <span className="meta-label">참가비</span>
                  <span className="meta-value">
                    {Number.isFinite(event?.entryFee) ? `${event.entryFee.toLocaleString()}원` : '-'}
                  </span>
                </div>
              </div>
            </section>

            {(aiSummary || loadingSummary) && (
              <section className="ed-ai-summary">
                <span className="ai-badge"> 🤖 AI 요약</span>
                <div
                  className="ai-text"
                  dangerouslySetInnerHTML={{
                    __html: loadingSummary ? '요약 생성 중...' : mdToHtml(aiSummary),
                  }}
                />
              </section>
            )}

            {event?.organizerId ? (
              <section className="ed-organizer">
                <div className="ed-org-card">
                  <ul className="org-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    <HostCard
                      host={{
                        id: organizerProfile?.id ?? event.organizerId,
                        name: organizerProfile?.name ?? (event.organizerName || `Organizer #${event.organizerId}`),
                        nickname: organizerProfile?.nickname ?? null,
                        profileImage: organizerProfile?.avatarUrl || '',
                      }}
                    />
                  </ul>
                </div>
              </section>
            ) : null}

            <section className="ed-body">
              <h2 className="ed-h2">상세 설명</h2>
              <div
                className="event-description"
                dangerouslySetInnerHTML={{
                  __html: mdToHtml(event?.description ?? ''),
                }}
              />
            </section>

            <section className="event-actions">
              {isOwner && (
                <button
                  className="btn edit-btn"
                  onClick={() => {
                    if (!eventId) return;
                    navigate(`/events/${eventId}/edit`);
                  }}
                >
                  행사 수정하기
                </button>
              )}

              {isFinished && (
                <button className="btn review-btn" onClick={openReviewPopup}>
                  행사 리뷰 보기
                </button>
              )}
            </section>

            {showReviewPopup && (
              <div
                className="review-popup"
                role="dialog"
                aria-modal="true"
                aria-label="행사 리뷰"
                onClick={(e) => {
                  if (e.target.classList.contains('review-popup')) closeReviewPopup();
                }}
              >
                <div className="review-content">
                  <button className="close-btn" onClick={closeReviewPopup} aria-label="닫기">
                    ✕
                  </button>
                  <h2>리뷰</h2>

                  <div className="review-stats" style={{ marginBottom: 12 }}>
                    {loadingReviews ? (
                      <span>리뷰 불러오는 중...</span>
                    ) : reviews.length > 0 ? (
                      <span>
                        평균 평점 <strong>{avgRating}</strong> / 5 · 총 {reviews.length}개
                      </span>
                    ) : (
                      <span>아직 등록된 리뷰가 없어요.</span>
                    )}
                  </div>

                  <div className="review-list">
                    {!loadingReviews &&
                      reviews.map((r, idx) => (
                        <div key={`${r.userId}-${idx}`} className="review-item">
                          <p className="review-user">
                            사용자 #{r.userId}{' '}
                            <span className="review-date">· {toDateTimeText(r.createdAt)}</span>
                          </p>
                          <p className="review-rating">평점: {r.rating} / 5</p>
                          <p className="review-text">{r.content}</p>
                        </div>
                      ))}
                    {loadingReviews && (
                      <div className="review-item">
                        <p className="review-text">불러오는 중...</p>
                      </div>
                    )}
                  </div>
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
