// src/pages/EventDetail.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../css/eventdetail.css';
import Layout from '../components/Layout';
import HostCard from '../components/HostCard';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaWonSign, FaRegHeart, FaHeart } from 'react-icons/fa';

const API_BASE = 'https://gateway.gamja.cloud';

/* ======================= auth & utils ======================= */
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const getUserId = () => {
  const idStr = localStorage.getItem('userId');
  const id = idStr ? parseInt(idStr, 10) : null;
  return Number.isFinite(id) ? id : null;
};

const isValidId = (v) => Number.isFinite(v) && v > 0;
const toIntOrNull = (v) => {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const extractDate = (isoString) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};
const extractTimeRange = (startISO, endISO) => {
  const s = startISO ? new Date(startISO) : null;
  const e = endISO ? new Date(endISO) : null;
  const f = (x) =>
    x?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) ?? '';
  if (s && e) return `${f(s)} - ${f(e)}`;
  if (s) return f(s);
  return '-';
};

const getJson = async (url, opts = {}) => {
  const mergedHeaders = { Accept: 'application/json', ...getAuthHeaders(), ...(opts.headers || {}) };
  const res = await fetch(url, { mode: 'cors', cache: 'no-store', headers: mergedHeaders, ...opts });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    let bodyText = '', bodyJson = null;
    try {
      if (ct.includes('application/json')) { bodyJson = await res.json(); bodyText = JSON.stringify(bodyJson); }
      else { bodyText = await res.text(); try { bodyJson = JSON.parse(bodyText); } catch { } }
    } catch { }
    const err = new Error(`${url} 실패 (${res.status})`);
    Object.assign(err, { status: res.status, body: bodyText, bodyJson, url });
    throw err;
  }
  if (ct.includes('application/json')) return res.json();
  try { return JSON.parse(await res.text()); } catch { return res.text(); }
};
const postJson = async (url, bodyObj, extraHeaders = {}) =>
  getJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(bodyObj ?? {}) });
const postNoBody = async (url, extraHeaders = {}) =>
  getJson(url, { method: 'POST', headers: { ...extraHeaders } });

/* ======================= normalizer ======================= */
const normalizeEvent = (payload) => {
  const base = payload?.data ?? payload?.result ?? payload?.event ?? payload;
  const raw = Array.isArray(base) ? base[0] : base;
  if (!raw || typeof raw !== 'object') return null;

  const id = toIntOrNull(raw.id ?? raw.eventId);
  const orgIdNum = toIntOrNull(raw.organizerId ?? raw.ownerId);
  const organizerId = isValidId(orgIdNum) ? orgIdNum : 0;

  return {
    id,
    organizerId,
    name: raw.name ?? raw.title ?? '',
    description: raw.description ?? raw.content ?? '',
    startTime: raw.startTime ?? raw.start_date ?? raw.start ?? null,
    endTime: raw.endTime ?? raw.end_date ?? raw.end ?? null,
    address: raw.address ?? raw.location ?? '',
    entryFee: Number.isFinite(raw.entryFee) ? raw.entryFee : (raw.fee === '무료' ? 0 : (parseInt(raw.fee, 10) || 0)),
    posterId: toIntOrNull(raw.posterId ?? raw.imageId ?? raw.qrImage),
    hashtags: raw.hashtags ?? raw.tags ?? [],
    bookmarked: typeof raw.bookmarked === 'boolean' ? raw.bookmarked : null,

    // 선택: 주최자명/링크가 오면 사용
    organizerName: raw.organizerName ?? raw.hostName ?? null,
    sourceUrl: raw.sourceUrl ?? raw.url ?? raw.link ?? null,
  };
};

/* ======================= bookmark helpers ======================= */
const bmKey = (uid, eid) => `bm:${uid}:${eid}`;
const writeBm = (uid, eid, val) => {
  try { localStorage.setItem(bmKey(uid, eid), JSON.stringify({ v: !!val, t: Date.now() })); } catch { }
};
const readBm = (uid, eid, maxAge = 7 * 24 * 60 * 60 * 1000) => {
  try {
    const raw = localStorage.getItem(bmKey(uid, eid));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (typeof o?.v !== 'boolean') return null;
    if (typeof o?.t === 'number' && Date.now() - o.t > maxAge) return null;
    return o.v;
  } catch { return null; }
};

async function toggleBookmarkOnServer(eventId) {
  const uid = getUserId();
  const resp = await postJson(`${API_BASE}/api/activity/bookmark/toggle`, { eventId, userId: uid });
  const d = resp?.data ?? resp ?? {};

  const text = (typeof d === 'string' ? d : (d.message || d.status || '')).toString().toLowerCase();
  const byCreatedAt = !!d.createdAt;
  const byDeleted = !!d.deletedAt || /unbookmark|removed|deleted/i.test(text);
  const byCount = Number.isFinite(d.bookmarkCount) ? d.bookmarkCount > 0 : null;

  let bookmarkedNow = null;
  if (byCreatedAt) bookmarkedNow = true;
  else if (byDeleted) bookmarkedNow = false;
  else if (byCount !== null) bookmarkedNow = byCount;

  return { bookmarkedNow };
}

/* ======================= component ======================= */
const EventDetail = () => {
  const { id } = useParams();
  const eventId = useMemo(() => {
    const n = id ? parseInt(id, 10) : null;
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarking, setBookmarking] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState(null);

  // load event
  useEffect(() => {
    if (!eventId || eventId <= 0) { setError('잘못된 이벤트 ID 입니다.'); setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        setLoading(true); setError(null);
        const payload = await getJson(`${API_BASE}/api/event/info/${eventId}`);
        const data = normalizeEvent(payload);
        if (!data || !data.id) throw new Error('응답에서 이벤트 데이터를 찾지 못했습니다.');
        if (!active) return;

        setEvent(data);

        const uid = getUserId();
        let initial = uid ? readBm(uid, data.id) : null;
        if (initial === null && typeof data.bookmarked === 'boolean') initial = data.bookmarked;
        setBookmarked(Boolean(initial));
      } catch (err) {
        console.error('이벤트 조회 실패:', err);
        if (active) {
          const msg = (err?.bodyJson?.message || err?.body || '').toString();
          const notFoundLike = /event\s*not\s*found/i.test(msg);
          if (err?.status === 404 || notFoundLike) setError(`존재하지 않는 이벤트입니다. (ID: ${eventId})`);
          else if (err?.status === 401 || err?.status === 403) setError('로그인이 필요합니다.');
          else if (err?.status === 500) {
            const extra = process.env.NODE_ENV === 'development' && (err?.bodyJson?.message || err?.body)
              ? `\n${String(err?.bodyJson?.message || err.body).slice(0, 300)}` : '';
            setError(`서버 오류로 이벤트를 불러오지 못했습니다. (500)${extra}`);
          } else setError(err?.message || '이벤트를 불러오지 못했습니다.');
        }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [eventId]);

  // view history
  useEffect(() => {
    if (!event) return;
    const uid = getUserId(); if (!uid) return;
    const payload = {
      userId: uid,
      eventId: event.id,
      eventName: event.name,
      eventThumbnail: event.posterId ? `${API_BASE}/api/image/${event.posterId}` : null,
      viewedAt: new Date().toISOString().slice(0, 19),
    };
    postJson(`${API_BASE}/api/activity/history/add`, payload).catch(() => { });
  }, [event]);

  // AI summary (prod only & logged in)
  useEffect(() => {
    let active = true;
    if (!eventId) return () => { active = false; };
    const origin = window.location.origin;
    const isLocal = origin.startsWith('http://127.0.0.1') || origin.startsWith('http://localhost');
    const token = localStorage.getItem('accessToken');
    if (isLocal || !token) return () => { active = false; };
    (async () => {
      try {
        setLoadingSummary(true);
        const resp = await postNoBody(`${API_BASE}/api/ai/${eventId}`);
        const text = typeof resp === 'string' ? resp : (resp?.data ?? resp ?? '');
        if (!active) return;
        setAiSummary(String(text));
      } catch { } finally { if (active) setLoadingSummary(false); }
    })();
    return () => { active = false; };
  }, [eventId]);

  const isOwner = useMemo(() => {
    const uid = getUserId();
    return isValidId(uid) && isValidId(event?.organizerId) ? uid === event.organizerId : false;
  }, [event]);

  const isFinished = useMemo(() => {
    if (!event?.endTime && !event?.startTime) return false;
    const end = event?.endTime ? new Date(event.endTime) : new Date(event.startTime);
    if (Number.isNaN(end.getTime())) return false;
    return Date.now() > end.getTime();
  }, [event]);

  const dateText = useMemo(() => extractDate(event?.startTime), [event]);
  const timeText = useMemo(() => extractTimeRange(event?.startTime, event?.endTime), [event]);

  const onToggleBookmark = async () => {
    if (!event?.id) return;
    const uid = getUserId();
    if (!uid) { alert('로그인이 필요합니다.'); return; }
    if (bookmarking) return;

    const next = !bookmarked;
    setBookmarking(true);
    setBookmarked(next);

    try {
      const { bookmarkedNow } = await toggleBookmarkOnServer(event.id);
      const final = (typeof bookmarkedNow === 'boolean') ? bookmarkedNow : next;
      setBookmarked(final);
      writeBm(uid, event.id, final);
    } catch (e) {
      console.warn('북마크 토글 실패:', e?.status || e?.message);
      setBookmarked(!next);
      if (e?.status === 401) {
        localStorage.clear();
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      }
    } finally {
      setBookmarking(false);
    }
  };

  return (
    <Layout pageTitle="행사 상세" activeMenuItem="events">
      <div className="event-detail-container">
        {error && (
          <div className="error-box">
            <p>이벤트를 불러오지 못했습니다.</p>
            <p className="error-detail" style={{ whiteSpace: 'pre-wrap' }}>{error}</p>
          </div>
        )}

        {/* Hero */}
        <section className="ed-hero">
          <div className={`ed-cover ${event?.posterId ? '' : 'is-placeholder'}`}>
            {event?.posterId ? (
              <img src={`${API_BASE}/api/image/${event.posterId}`} alt={event?.name ?? '이벤트 이미지'} />
            ) : (
              <div className="ed-cover-fallback">EVENT</div>
            )}
            <button
              className={`ed-bookmark ${bookmarked ? 'bookmarked' : ''}`}
              aria-label="bookmark"
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
              disabled={bookmarking}
              title={bookmarking ? '처리 중...' : (bookmarked ? '북마크 해제' : '북마크')}
            >
              {bookmarked ? <FaHeart className="icon" /> : <FaRegHeart className="icon" />}
            </button>
          </div>
          <div className="ed-cover-caption">이미지를 클릭하면 크게 볼 수 있어요</div>
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
            {/* Title & tags */}
            <section className="ed-head">
              <h1
                className="event-title"
                dangerouslySetInnerHTML={{ __html: event?.name ?? '이벤트' }}
              />
              {Array.isArray(event?.hashtags) && event.hashtags.length > 0 && (
                <div className="ed-tags">
                  {event.hashtags.map((t, i) => (
                    <span key={i} className="ed-tag">#{t}</span>
                  ))}
                </div>
              )}
            </section>


            {/* Meta */}
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

            {/* AI summary */}
            {(aiSummary || loadingSummary) && (
              <section className="ed-ai-summary">
                <span className="ai-badge">AI 요약</span>
                <p className="ai-text">{loadingSummary ? '요약 생성 중...' : aiSummary}</p>
              </section>
            )}

            {/* Organizer: 내부 행사만 표시 (organizerId > 0) */}
            {isValidId(event?.organizerId) && (
              <section className="ed-organizer">
                <div className="ed-org-card">
                  <ul className="org-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    <HostCard
                      host={{
                        id: event.organizerId,
                        name: event.organizerName || `Organizer #${event.organizerId}`,
                        profileImage: null,
                      }}
                    />
                  </ul>
                </div>
              </section>
            )}

            {/* Description */}
            <section className="ed-body">
              <h2 className="ed-h2">상세 설명</h2>
              <div
                className="event-description"
                dangerouslySetInnerHTML={{
                  __html: (event?.description ?? '').replace(/<br\s*\/?>/gi, '<br/>'),
                }}
              />
            </section>


            {/* Actions */}
            <section className="event-actions">
              {isOwner && <button className="btn edit-btn" disabled>행사 수정하기</button>}
              {isFinished && (
                <button className="btn review-btn" onClick={() => setShowReviewPopup(true)}>
                  행사 리뷰 보기
                </button>
              )}
            </section>

            {/* Review popup */}
            {showReviewPopup && (
              <div className="review-popup" role="dialog" aria-modal="true" aria-label="행사 리뷰">
                <div className="review-content">
                  <button className="close-btn" onClick={() => setShowReviewPopup(false)} aria-label="닫기">
                    ✕
                  </button>
                  <h2>리뷰</h2>
                  <div className="review-list">
                    <div className="review-item">
                      <p className="review-user">(준비중)</p>
                      <p className="review-text">리뷰 API 연결 후 표시됩니다.</p>
                    </div>
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
