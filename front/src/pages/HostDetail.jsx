// src/pages/HostDetail.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import EventCard from '../components/EventCard';
import '../css/hostdetail.css';

const BASE_URL = 'https://gateway.gamja.cloud';

function getAuth() {
  try { return JSON.parse(localStorage.getItem('auth') || '{}'); } catch { return {}; }
}
function saveAuth(patch) {
  const curr = getAuth();
  const next = { ...curr, ...patch };
  localStorage.setItem('auth', JSON.stringify(next));
  return next;
}
function isLoggedIn() {
  const { id } = getAuth();
  return Number.isFinite(Number(id));
}
function userHeaders() {
  const { id } = getAuth();
  const h = {};
  if (id != null) h['X-User-Id'] = String(id);
  return h;
}
async function http(path, { method = 'GET', headers = {}, body, signal, _retried } = {}) {
  const isJsonBody = body && !(body instanceof FormData);
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}), ...headers, Accept: headers?.Accept || 'application/json, */*;q=0.8' },
      body: body ? (isJsonBody ? JSON.stringify(body) : body) : undefined,
      signal,
      credentials: 'include',
      cache: 'no-store',
      mode: 'cors',
    });
  } catch (e) {
    const err = new Error('0 network_error');
    err.status = 0;
    err.body = e?.message;
    throw err;
  }

  if ((res.status === 401 || res.headers.get('WWW-Authenticate')) && !_retried) {
    const { id } = getAuth();
    if (id == null) {
      alert('로그인이 필요합니다.');
      const txt = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText} ${txt}`);
    }
    const renew = await fetch(`${BASE_URL}/api/user/renew`, {
      method: 'POST',
      headers: { ...userHeaders(), Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      mode: 'cors',
    });
    if (!renew.ok) {
      alert('로그인이 필요합니다.');
      const txt = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText} ${txt}`);
    }
    try {
      const data = await renew.json();
      if (data && data.accessToken) saveAuth({ accessToken: data.accessToken });
    } catch {}
    return http(path, { method, headers, body, signal, _retried: true });
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} ${txt}`);
  }
  try { return await res.json(); } catch { return null; }
}

const api = {
  pubGet: (p, opt = {}) => http(p, { ...opt, method: 'GET', headers: { ...(opt.headers || {}) } }),
  uGet: (p, opt = {}) => http(p, { ...opt, method: 'GET', headers: { ...userHeaders(), ...(opt.headers || {}) } }),
  uPost: (p, body, opt = {}) => http(p, { ...opt, method: 'POST', body, headers: { ...userHeaders(), ...(opt.headers || {}) } }),
  uDel: (p, body, opt = {}) => http(p, { ...opt, method: 'DELETE', body, headers: { ...userHeaders(), ...(opt.headers || {}) } }),
};

const getImageUrl = (id) => (id ? `${BASE_URL}/api/image/${id}` : null);

function toExcerpt(text, max = 120) {
  if (!text) return '';
  try {
    const s = String(text).replace(/[\s\u00A0\u200B-\u200D\uFEFF]+/g, ' ').trim();
    return s.length > max ? `${s.slice(0, max).trim()}…` : s;
  } catch {
    return '';
  }
}

export default function HostDetail() {
  const { id } = useParams();
  const organizerId = Number(id);
  const navigate = useNavigate();

  const [host, setHost] = useState(null);
  const [events, setEvents] = useState([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [bookmarks, setBookmarks] = useState({});
  const [bookmarkCounts, setBookmarkCounts] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setHost({ id: organizerId, name: `주최자 #${organizerId}`, profileImageId: null });
  }, [organizerId]);

  const shortSummary = useMemo(() => {
    const raw = '아직 리뷰 요약이 준비되지 않았습니다. 행사 참가 후 첫 리뷰의 주인공이 되어보세요!';
    return raw.length <= 140 ? raw : `${raw.slice(0, 140).trim()}…`;
  }, []);

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams({ page: '0', size: '12', sort: 'createTime,DESC' }).toString();
    try {
      const data = await api.pubGet(`/api/event/${organizerId}?${params}`);
      setNotFound(false);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.startsWith('404')) {
        setNotFound(true);
        return [];
      }
      throw e;
    }
  }, [organizerId]);

  const fetchIsSubscribed = useCallback(async () => {
    if (!isLoggedIn()) return false;
    try {
      const res = await api.uGet('/api/user/subscription/getAll');
      const list = Array.isArray(res) ? res : (res ? [res] : []);
      return list.some((s) => Number(s?.organizerId) === organizerId);
    } catch {
      return false;
    }
  }, [organizerId]);

  const fetchBookmarkCounts = useCallback(async (visibleEventIds) => {
    if (!visibleEventIds.length) return {};
    try {
      const entries = await Promise.all(
        visibleEventIds.map(async (eid) => {
          try {
            const count = await api.pubGet(`/api/activity/bookmark/count?eventId=${eid}`);
            return [eid, Number(count) || 0];
          } catch {
            return [eid, 0];
          }
        })
      );
      return Object.fromEntries(entries);
    } catch {
      return {};
    }
  }, []);

  const fetchMyBookmarks = useCallback(async () => {
    if (!isLoggedIn()) return {};
    try {
      const list = await api.uGet('/api/activity/bookmark/list');
      const arr = Array.isArray(list) ? list : list ? [list] : [];
      const map = {};
      for (const b of arr) if (b?.eventId != null) map[Number(b.eventId)] = true;
      return map;
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const [items, subscribed] = await Promise.all([fetchEvents(), fetchIsSubscribed()]);
        if (!alive) return;
        setEvents(items);
        setIsSubscribed(subscribed);
        if (items.length > 0) {
          const ids = items.map((e) => e.id).filter((v) => Number.isFinite(v));
          const [counts, mine] = await Promise.all([fetchBookmarkCounts(ids), fetchMyBookmarks()]);
          if (!alive) return;
          setBookmarkCounts(counts);
          setBookmarks(mine);
        } else {
          setBookmarkCounts({});
          setBookmarks({});
        }
      } catch {
        if (!alive) return;
        setErrorMsg('네트워크 오류가 발생했어요.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fetchEvents, fetchIsSubscribed, fetchBookmarkCounts, fetchMyBookmarks]);

  const toggleSubscribe = async () => {
    if (!host?.id || subscribing) return;
    if (!isLoggedIn()) {
      alert('로그인이 필요합니다.');
      return;
    }
    setSubscribing(true);
    try {
      const { id: userId } = getAuth();
      const payload = { userId, organizerId: host.id };
      if (isSubscribed) {
        await api.uDel('/api/user/subscription/delete', payload);
        setIsSubscribed(false);
      } else {
        await api.uPost('/api/user/subscription/create', payload);
        setIsSubscribed(true);
      }
    } catch {
    } finally {
      setSubscribing(false);
    }
  };

  const toggleBookmark = async (eventId) => {
    const { id: userId } = getAuth();
    if (userId == null) {
      alert('로그인이 필요합니다.');
      return;
    }

    setBookmarks(prev => {
      const nextOn = !prev[eventId];
      setBookmarkCounts(prevC => ({
        ...prevC,
        [eventId]: Math.max(0, (prevC[eventId] || 0) + (nextOn ? 1 : -1)),
      }));
      return { ...prev, [eventId]: nextOn };
    });

    try {
      await api.uPost('/api/activity/bookmark/toggle', { eventId });
    } catch (e) {
      setBookmarks(prev => {
        const nextOn = !prev[eventId];
        setBookmarkCounts(prevC => ({
          ...prevC,
          [eventId]: Math.max(0, (prevC[eventId] || 0) + (nextOn ? 1 : -1)),
        }));
        return { ...prev, [eventId]: nextOn };
      });
      const msg = String(e?.message || '');
      if (msg.includes('401')) alert('로그인이 필요합니다.');
    }
  };

  return (
    <Layout pageTitle="주최자">
      <div className="host-detail">
        <div className="hd-inner">
          <section className="hero-card card-overlap">
            <div className="avatar-xxl" aria-hidden="true">
              {host?.profileImageId ? (
                <img src={getImageUrl(host.profileImageId)} alt={`${host?.name ?? '주최자'} 프로필`} />
              ) : (
                host?.name?.[0] ?? '호'
              )}
            </div>
            <div className="hero-content">
              <h1 className="host-title" title={host?.name}>
                {host?.name ?? '주최자'}
              </h1>
            </div>
            <button
              className={`pill-subscribe ${isSubscribed ? 'on' : ''}`}
              onClick={toggleSubscribe}
              disabled={subscribing}
              aria-live="polite"
            >
              {isSubscribed ? (
                <>
                  <span className="ps-label-default">구독 중</span>
                  <span className="ps-label-hover">구독 해제</span>
                </>
              ) : (
                '구독하기'
              )}
            </button>
          </section>

          <section className="ai-summary-card">
            <div className="ai-badge">
              <strong>{host?.name ?? '주최자'}</strong>님의 행사를 다녀간 사람들의 리뷰를 AI가 요약했어요
            </div>
            <p className="ai-summary-txt">{shortSummary}</p>
          </section>

          {errorMsg && <div className="state state--error">{errorMsg}</div>}
          {loading && <div className="state state--loading">불러오는 중…</div>}

          {!loading && !errorMsg && (
            <section className="host-events-section">
              <h2 className="section-title">주최한 행사</h2>
              {notFound ? (
                <div className="state state--empty">조건에 맞는 행사가 없어요.</div>
              ) : (
                <>
                  <div className="event-grid">
                    {(Array.isArray(events) ? events : []).map((ev) => (
                      <EventCard
                        key={ev.id}
                        id={ev.id}
                        title={ev.name}
                        image={getImageUrl(ev.posterId)}
                        date={ev.startTime?.slice(0, 10)}
                        time={ev.startTime?.slice(11, 16)}
                        location={ev.address}
                        fee={
                          typeof ev.entryFee === 'number'
                            ? ev.entryFee === 0
                              ? '무료'
                              : `${ev.entryFee.toLocaleString()}원`
                            : ev.entryFee ?? ''
                        }
                        hashtags={ev.hashtags}
                        desc={toExcerpt(ev.description)}
                        description={toExcerpt(ev.description)}
                        bookmarked={!!bookmarks[ev.id]}
                        bookmarkCount={bookmarkCounts[ev.id] || 0}
                        onBookmarkToggle={() => toggleBookmark(ev.id)}
                        onClick={() => navigate(`/events/${ev.id}`)}
                      />
                    ))}
                  </div>
                  {events.length === 0 && <div className="state state--empty">등록된 행사가 아직 없어요.</div>}
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
