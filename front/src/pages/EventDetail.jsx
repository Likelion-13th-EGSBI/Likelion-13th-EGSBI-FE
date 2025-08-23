// src/pages/EventDetail.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../css/eventdetail.css';
import Layout from '../components/Layout';
import HostCard from '../components/HostCard';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaWonSign, FaRegHeart, FaHeart } from 'react-icons/fa';

const API_BASE = 'https://gateway.gamja.cloud';

const getUserId = () => {
  const raw = localStorage.getItem('userId') || '';
  const onlyDigits = (raw.match(/\d+/g) || []).join('');
  const n = onlyDigits ? parseInt(onlyDigits, 10) : null;
  return Number.isFinite(n) && n > 0 ? n : null;
};

const isAiEndpoint = (url) => {
  try { return new URL(url, API_BASE).pathname.startsWith('/api/ai/'); }
  catch { return false; }
};

const requiresUserHeader = (url) => {
  try {
    const p = new URL(url, API_BASE).pathname;
    // 이 화면에서 인증이 꼭 필요한 엔드포인트만 지정
    return p.startsWith('/api/activity/bookmark/toggle');
  } catch { return false; }
};

// 🔐 토큰 갱신
async function renewAccessToken() {
  const uid = getUserId();
  if (!uid) { const e = new Error('401'); e.status = 401; throw e; }
  const headers = new Headers();
  headers.set('X-User-Id', String(uid));
  const res = await fetch(`${API_BASE}/api/user/renew`, { method: 'POST', headers, mode: 'cors', cache: 'no-store' });
  if (!res.ok) { const e = new Error(String(res.status)); e.status = res.status; throw e; }
  const j = await res.json();
  if (!j?.accessToken) { const e = new Error('no_token'); e.status = 401; throw e; }
  localStorage.setItem('accessToken', j.accessToken);
  return j.accessToken;
}

const buildHeaders = (url, init) => {
  const h = new Headers(init?.headers || {});
  const method = (init?.method || 'GET').toUpperCase();
  const needsUser = requiresUserHeader(url);

  h.set('Accept', isAiEndpoint(url) ? '*/*' : 'application/json');

  if (needsUser) {
    const uid = getUserId();
    if (!uid) { const e = new Error('401'); e.status = 401; throw e; }
    h.set('X-User-Id', String(uid));
    const token = localStorage.getItem('accessToken');
    if (token && !h.has('Authorization')) h.set('Authorization', `Bearer ${token}`);
  }

  if (method !== 'GET' && !h.has('Content-Type') && init?.body) {
    h.set('Content-Type', 'application/json');
  }
  return h;
};

async function requestJson(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || '';
  const needsUser = requiresUserHeader(url);

  const doFetch = async () => {
    const headers = buildHeaders(url, init);
    return fetch(url, { ...init, headers, mode: 'cors', cache: 'no-store' });
  };

  // 1차 요청
  let res = await doFetch();

  // 401 또는 WWW-Authenticate가 있고 사용자 인증이 필요한 요청이면 → 토큰 갱신 후 1회 재시도
  const hasWwwAuth = !!res.headers.get('WWW-Authenticate');
  if (needsUser && (res.status === 401 || hasWwwAuth)) {
    try {
      await renewAccessToken();
      res = await doFetch(); // 갱신된 토큰으로 재시도
    } catch (e) {
      // 갱신 자체 실패 → 그대로 에러 처리
    }
  }

  const ct = res.headers.get('content-type') || '';
  const parse = async () => {
    if (ct.includes('application/json')) return res.json();
    const t = await res.text();
    try { return JSON.parse(t); } catch { return t; }
  };

  if (!res.ok) {
    const body = await parse().catch(() => ({}));
    const err = new Error(String(res.status));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return parse();
}

const getJson = (url) => requestJson(url, { method: 'GET' });
const postJson = (url, body) => requestJson(url, { method: 'POST', body: JSON.stringify(body ?? {}) });
const postEmpty = (url) => requestJson(url, { method: 'POST' });

const toDateText = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const toTimeRange = (sISO, eISO) => {
  const f = (x) => x?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) ?? '';
  const s = sISO ? new Date(sISO) : null;
  const e = eISO ? new Date(eISO) : null;
  if (s && e) return `${f(s)} - ${f(e)}`;
  if (s) return f(s);
  return '-';
};

const mdToHtml = (src = '') => {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) =>
    esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const lines = String(src).split(/\r?\n/);
  let inList = false;
  const out = [];
  for (let raw of lines) {
    const t = raw.trim();
    if (!t) { if (inList) { out.push('</ul>'); inList = false; } continue; }
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) { if (inList) { out.push('</ul>'); inList = false; } const lv = Math.min(h[1].length, 6); out.push(`<h${lv}>${inline(h[2])}</h${lv}>`); continue; }
    const li = t.match(/^-+\s+(.*)$/);
    if (li) { if (!inList) out.push('<ul>'); inList = true; out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (inList) { out.push('</ul>'); inList = false; }
    out.push(`<p>${inline(t)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
};

const EventDetail = () => {
  const { id } = useParams();
  const eventId = useMemo(() => {
    const n = id ? parseInt(id, 10) : null;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [id]);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarking, setBookmarking] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!eventId) { setError('잘못된 이벤트 ID 입니다.'); setLoading(false); return; }
      try {
        setLoading(true);
        setError(null);
        const data = await getJson(`${API_BASE}/api/event/info/${eventId}`);
        if (!active) return;
        setEvent(data || null);
      } catch (e) {
        if (!active) return;
        if (e?.status === 404) setError('조건에 맞는 행사가 없어요');
        else setError('네트워크 오류가 발생했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    let active = true;
    if (!event?.id) return () => { active = false; };
    (async () => {
      try {
        setLoadingSummary(true);
        const resp = await postEmpty(`${API_BASE}/api/ai/${event.id}`);
        if (!active) return;
        const text = typeof resp === 'string' ? resp : (resp?.data ?? resp ?? '');
        setAiSummary(String(text));
      } catch (e) {
        if (!active) return;
        setAiSummary('');
        console.warn('AI 요약 실패:', e?.status, e?.body);
      } finally {
        if (active) setLoadingSummary(false);
      }
    })();
    return () => { active = false; };
  }, [event]);

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

  const onToggleBookmark = async () => {
    if (!event?.id || bookmarking) return;
    const uid = getUserId();
    if (!uid) { alert('로그인이 필요합니다.'); return; }

    const optimistic = !bookmarked;
    setBookmarking(true);
    setBookmarked(optimistic);
    try {
      await postJson(`${API_BASE}/api/activity/bookmark/toggle`, { eventId: event.id });
    } catch (e) {
      setBookmarked(!optimistic);
      if (e?.status === 401) alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      else alert('네트워크 오류가 발생했습니다.');
    } finally {
      setBookmarking(false);
    }
  };

  return (
    <Layout pageTitle="행사 상세" activeMenuItem="events">
      <div className="event-detail-container">
        {error && (
          <div className="error-box">
            <p className="error-detail" style={{ whiteSpace: 'pre-wrap' }}>{error}</p>
          </div>
        )}

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
                  dangerouslySetInnerHTML={{ __html: loadingSummary ? '요약 생성 중...' : mdToHtml(aiSummary) }}
                />
              </section>
            )}

            {event?.organizerId ? (
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
            ) : null}

            <section className="ed-body">
              <h2 className="ed-h2">상세 설명</h2>
              <div
                className="event-description"
                dangerouslySetInnerHTML={{
                  __html: (event?.description ?? '').replace(/<br\s*\/?>/gi, '<br/>'),
                }}
              />
            </section>

            <section className="event-actions">
              {isOwner && <button className="btn edit-btn" disabled>행사 수정하기</button>}
              {isFinished && (
                <button className="btn review-btn" onClick={() => setShowReviewPopup(true)}>
                  행사 리뷰 보기
                </button>
              )}
            </section>

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
