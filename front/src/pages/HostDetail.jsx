// src/pages/HostDetail.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import EventCard from '../components/EventCard';
import axios from 'axios';
import '../css/hostdetail.css';

const BASE_URL = 'https://likelion-att.o-r.kr/v1';

/* ---------- 공통 유틸 ---------- */
async function safeJson(res) {
  const text = await res.text?.().catch?.(() => '') ?? '';
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}
const toProfileUrl = (id) => {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? `${BASE_URL}/image/${n}` : '';
};
const imgUrl = (id) => (id ? `${BASE_URL}/image/${id}` : null);
const toExcerpt = (s, n = 120) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n).trim()}…` : t;
};

/* ---------- 인증 공통 ---------- */
function getAuth() {
  try {
    const obj = JSON.parse(localStorage.getItem('auth') || '{}');
    const idRaw = obj?.id ?? localStorage.getItem('userId') ?? localStorage.getItem('userid') ?? '';
    const idParsed = parseInt(String(idRaw).replace(/[^\d]/g, ''), 10);
    const accessToken =
      obj?.accessToken ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('Token') ||
      localStorage.getItem('token') ||
      '';
    return { id: Number.isFinite(idParsed) && idParsed > 0 ? idParsed : null, accessToken: accessToken || '' };
  } catch {
    const idRaw = localStorage.getItem('userId') ?? localStorage.getItem('userid') ?? '';
    const idParsed = parseInt(String(idRaw).replace(/[^\d]/g, ''), 10);
    const accessToken =
      localStorage.getItem('accessToken') ||
      localStorage.getItem('Token') ||
      localStorage.getItem('token') ||
      '';
    return { id: Number.isFinite(idParsed) && idParsed > 0 ? idParsed : null, accessToken: accessToken || '' };
  }
}
function saveAuth(patch) {
  const prev = getAuth();
  const next = { ...prev, ...patch };
  localStorage.setItem('auth', JSON.stringify(next));
  if (Number.isFinite(next.id)) localStorage.setItem('userId', String(next.id));
  if (next.accessToken) localStorage.setItem('accessToken', next.accessToken);
  return next;
}
function isLoggedIn() {
  const { id } = getAuth();
  return Number.isFinite(Number(id));
}

/* ---------- axios 인스턴스 ---------- */
function makeAxios() {
  const inst = axios.create({ baseURL: BASE_URL, withCredentials: false });

  inst.interceptors.request.use((config) => {
    const { id, accessToken } = getAuth();
    config.headers = config.headers || {};
    if (id != null) config.headers['X-User-Id'] = String(id);
    if (accessToken) config.headers['Authorization'] = `Bearer ${accessToken}`;
    config.headers['Accept'] = 'application/json';
    return config;
  });

  let renewing = null;
  inst.interceptors.response.use(
    (res) => res,
    async (error) => {
      const status = error?.response?.status;
      const www = error?.response?.headers?.['www-authenticate'];
      const original = error.config || {};
      if ((status === 401 || www) && !original.__retried) {
        if (!renewing) {
          const { id } = getAuth();
          if (id == null) throw error;
          renewing = axios
            .post(`${BASE_URL}/user/renew`, null, {
              headers: { 'X-User-Id': String(id) },
              withCredentials: false,
            })
            .then((r) => {
              const tok = r?.data?.accessToken;
              if (tok) saveAuth({ accessToken: tok });
            })
            .finally(() => (renewing = null));
        }
        await renewing;
        const fresh = getAuth();
        original.headers = { ...(original.headers || {}), 'X-User-Id': String(fresh.id) };
        if (fresh.accessToken) original.headers['Authorization'] = `Bearer ${fresh.accessToken}`;
        original.__retried = true;
        original.withCredentials = false;
        return inst.request(original);
      }
      throw error;
    }
  );

  return inst;
}
const api = makeAxios();

/* ---------- 기타 헬퍼 ---------- */
function pickOrganizerProfile(src, organizerId) {
  if (!src) return null;
  const name =
    src.organizerName ?? src.organizerNickname ?? src.name ?? `Organizer #${organizerId}`;
  const nickname = src.organizerNickname ?? src.nickname ?? null;
  const profileImageId =
    src.organizerProfileImageId ?? src.profileImageId ?? src.imageId ?? null;
  const profileImageUri =
    src.organizerProfileImageUri ?? src.profileImageUri ?? src.imageUri ?? null;
  return {
    id: organizerId,
    name,
    nickname,
    profileImageId: Number.isFinite(profileImageId) ? profileImageId : null,
    profileImageUri: profileImageUri || null,
    avatarUrl: profileImageUri || toProfileUrl(profileImageId),
  };
}

async function bmList() {
  const r = await api.get('/activity/bookmark/list', { validateStatus: (s) => s >= 200 && s < 300 });
  const arr = Array.isArray(r.data) ? r.data : [];
  const map = {};
  for (const b of arr) if (b?.eventId != null) map[Number(b.eventId)] = true;
  return map;
}
async function bmToggle(eventId) { await api.post('/activity/bookmark/toggle', { eventId }); }
async function bmCount(eventId) {
  const r = await api.get('/activity/bookmark/count', { params: { eventId } });
  const n = Number(r?.data);
  return Number.isFinite(n) ? n : 0;
}

async function subGetAll() {
  const r = await api.get('/user/subscription/getAll', { validateStatus: (s) => (s >= 200 && s < 300) || s === 204 });
  return Array.isArray(r.data) ? r.data : [];
}
async function subCreate(userId, organizerId) { await api.post('/user/subscription/create', { userId, organizerId }); }
async function subDelete(userId, organizerId) { await api.delete('/user/subscription/delete', { data: { userId, organizerId } }); }

async function fetchAiReviewSummary(targetId) {
  try {
    const r = await api.get('/ai/review/summary', {
      params: { targetId },
      validateStatus: (s) => s === 200 || s === 404,
    });
    
    console.log('AI Review Summary API Response:', r.data); // 디버깅용 로그
    
    if (r.status === 200 && r.data != null) {
      const summary = typeof r.data === 'string' ? r.data : String(r.data);
      return summary.trim() || null;
    }
    return null;
  } catch (error) { 
    console.error('AI Review Summary API Error:', error);
    return null; 
  }
}

/* ---------- ⭐ 호스트 평점 API ---------- */
const fetchHostRating = async (targetId) => {
  try {
    const r = await api.get('/activity/review/rating', {
      params: { targetId },
      validateStatus: (s) => s === 200 || s === 400 || s === 500,
    });
    if (r.status === 200 && r.data != null) {
      return {
        avg: Number(r.data.average ?? r.data ?? 0),
        count: Number(r.data.count ?? 0)
      };
    }
    return { avg: null, count: 0 };
  } catch {
    return { avg: null, count: 0 };
  }
};

export default function HostDetail() {
  const { id } = useParams();
  const organizerId = Number(id);
  const navigate = useNavigate();

  const [host, setHost] = useState(null);
  const [events, setEvents] = useState([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const [bmMapState, setBmMapState] = useState({});
  const [bmCounts, setBmCounts] = useState({});

  const [avgRating, setAvgRating] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewSummary, setReviewSummary] = useState('');

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  const myUserId = useMemo(() => getAuth().id ?? null, []);
  const isSelf = myUserId != null && myUserId === organizerId;

  /* ---------- 프로필 로딩 ---------- */
  const fetchUserProfile = useCallback(async (targetUserId) => {
    try {
      const r = await api.get('/user/info', { params: { userId: targetUserId } });
      const data = r?.data ?? null;
      const nickname = data?.nickname ?? '';
      const profileId = data?.profileId ?? null;
      const displayName = nickname || `Organizer #${targetUserId}`;
      return {
        id: targetUserId,
        name: displayName,
        nickname: nickname || null,
        profileImageId: profileId,
        profileImageUri: null,
        avatarUrl: toProfileUrl(profileId),
      };
    } catch { return null; }
  }, []);

  const hydrateHostFromSources = useCallback(async (organizerId) => {
    let profile = await fetchUserProfile(organizerId);

    if (!profile && isLoggedIn()) {
      try {
        const subs = await subGetAll();
        const found = subs.find((x) => Number(x?.organizerId) === organizerId);
        if (found) profile = pickOrganizerProfile(found, organizerId);
      } catch { }
    }

    if (!profile) {
      try {
        const qs = new URLSearchParams({ page: '0', size: '12', sort: 'createTime,DESC' }).toString();
        const r = await api.get(`/event/${organizerId}?${qs}`);
        const list = Array.isArray(r.data) ? r.data : [];
        setEvents(list);
        if (list[0]) profile = pickOrganizerProfile(list[0], organizerId);
      } catch { }
    }

    if (!profile) {
      profile = {
        id: organizerId,
        name: `Organizer #${organizerId}`,
        nickname: null,
        profileImageId: null,
        profileImageUri: null,
        avatarUrl: '',
      };
    }
    setHost(profile);
  }, [fetchUserProfile]);

  const loadEventsIfNeeded = useCallback(async () => {
    if (Array.isArray(events) && events.length > 0) return;
    try {
      const qs = new URLSearchParams({ page: '0', size: '12', sort: 'createTime,DESC' }).toString();
      const r = await api.get(`/event/${organizerId}?${qs}`);
      const list = Array.isArray(r.data) ? r.data : [];
      setEvents(list);
    } catch { }
  }, [events, organizerId]);

  const refreshSubscribed = useCallback(async () => {
    if (isSelf) { setIsSubscribed(false); return; }
    if (!isLoggedIn()) { setIsSubscribed(false); return; }
    try {
      const subs = await subGetAll();
      setIsSubscribed(subs.some((x) => Number(x?.organizerId) === organizerId));
    } catch {
      setIsSubscribed(false);
    }
  }, [organizerId, isSelf]);

  const refreshBookmarks = useCallback(async (list) => {
    if (!Array.isArray(list) || list.length === 0) {
      setBmMapState({});
      setBmCounts({});
      return;
    }
    const ids = list.map((e) => e.id).filter((v) => Number.isFinite(v));
    try {
      const [mine, countsArr] = await Promise.all([
        isLoggedIn() ? bmList() : Promise.resolve({}),
        Promise.all(ids.map(async (eid) => [eid, await bmCount(eid)])),
      ]);
      setBmMapState(mine);
      setBmCounts(Object.fromEntries(countsArr));
    } catch {
      setBmMapState({});
      setBmCounts({});
    }
  }, []);

  const refreshAiSummary = useCallback(async () => {
    const ai = await fetchAiReviewSummary(organizerId);
    setReviewSummary(ai || '');
  }, [organizerId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErrMsg('');
      try {
        await hydrateHostFromSources(organizerId);
        await loadEventsIfNeeded();
        await refreshSubscribed();

        // 리뷰 요약 API 호출
        const summary = await fetchAiReviewSummary(organizerId);
        if (alive) setReviewSummary(summary || '');

        // ⭐ 평균 평점 API 호출 - 주최자 ID 사용
        const { avg, count } = await fetchHostRating(organizerId);
        if (alive) {
          setAvgRating(avg);
          setReviewCount(count);
        }

      } catch {
        if (alive) setErrMsg('네트워크 오류가 발생했어요.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [organizerId, isSelf, myUserId, hydrateHostFromSources, loadEventsIfNeeded, refreshSubscribed]);

  useEffect(() => {
    if (!events || events.length === 0) return;
    refreshBookmarks(events);
  }, [events, refreshBookmarks]);

  /* ---------- 구독 토글 ---------- */
  const onToggleSubscribe = async () => {
    if (isSelf) return;
    if (!isLoggedIn()) { alert('로그인이 필요합니다.'); return; }
    if (!host?.id || subscribing) return;
    setSubscribing(true);
    try {
      const { id: userId } = getAuth();
      if (isSubscribed) {
        await subDelete(userId, host.id);
        setIsSubscribed(false);
      } else {
        await subCreate(userId, host.id);
        setIsSubscribed(true);
      }
    } catch { alert('구독 처리 중 오류가 발생했어요.'); }
    finally { setSubscribing(false); }
  };

  const onToggleBookmark = async (eventId) => {
    if (!isLoggedIn()) { alert('로그인이 필요합니다.'); return; }
    const prevOn = !!bmMapState[eventId];
    setBmMapState((m) => ({ ...m, [eventId]: !prevOn }));
    setBmCounts((c) => ({ ...c, [eventId]: Math.max(0, (c[eventId] || 0) + (prevOn ? -1 : 1)) }));
    try {
      await bmToggle(eventId);
      bmList().then(setBmMapState).catch(() => { });
      bmCount(eventId).then((cnt) => setBmCounts((c) => ({ ...c, [eventId]: cnt }))).catch(() => { });
    } catch {
      setBmMapState((m) => ({ ...m, [eventId]: prevOn }));
      setBmCounts((c) => ({ ...c, [eventId]: Math.max(0, (c[eventId] || 0) + (prevOn ? 1 : -1)) }));
      alert('북마크 처리 중 오류가 발생했어요.');
    }
  };

  const titleName = host?.name || host?.nickname || `Organizer #${organizerId}`;
  const profileImg = host?.avatarUrl || host?.profileImageUri || imgUrl(host?.profileImageId);

  return (
    <Layout pageTitle="주최자">
      <div className="host-detail">
        <div className="hd-inner">
          <section className="hero-card card-overlap">
            <div className="avatar-xxl" aria-hidden="true">
              {profileImg ? (
                <img src={profileImg} alt={`${titleName} 프로필`} />
              ) : (
                (titleName || '호')[0]
              )}
            </div>
            <div className="hero-content">
              <h1 className="host-title">{titleName}</h1>
              <div className="host-sub">
                {host?.nickname && <span className="host-nick">@{host.nickname}</span>}
                {avgRating != null ? (
                  <span className="star-rating">
                    <span
                      className="rating-stars overlay"
                      style={{ '--fill': avgRating }}
                    />
                    <span className="rating-value">{avgRating.toFixed(1)}</span>
                  </span>
                ) : (
                  <span className="host-rating">· 리뷰 없음</span>
                )}

              </div>
            </div>

            {!isSelf && (
              <button
                className={`pill-subscribe ${isSubscribed ? 'on' : ''}`}
                onClick={onToggleSubscribe}
                disabled={subscribing}
                aria-live="polite"
                title={isSubscribed ? '구독 해제' : '구독하기'}
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
            )}
          </section>

          <section className="ai-summary-card">
            <div className="ai-badge">
              <strong>{titleName}</strong> 주최자의 리뷰 요약
            </div>
            <p className="ai-summary-txt">{reviewSummary || '리뷰 요약을 불러오는 중...'}</p>
          </section>

          {errMsg && <div className="state state--error">{errMsg}</div>}
          {loading && <div className="state state--loading">불러오는 중…</div>}

          {!loading && !errMsg && (
            <section className="host-events-section">
              <h2 className="section-title">주최한 행사</h2>
              <div className="event-grid">
                {(Array.isArray(events) ? events : []).map((ev) => {
                  const fee =
                    typeof ev.entryFee === 'number'
                      ? ev.entryFee === 0
                        ? '무료'
                        : `${ev.entryFee.toLocaleString()}원`
                      : ev.entryFee ?? '';
                  return (
                    <EventCard
                      key={ev.id}
                      id={ev.id}
                      title={ev.name}
                      image={imgUrl(ev.posterId)}
                      date={ev.startTime ? new Date(ev.startTime).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}
                      time={ev.startTime ? new Date(ev.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                      location={ev.address}
                      fee={fee}
                      hashtags={ev.hashtags}
                      summary={toExcerpt(ev.description)}
                      bookmarked={!!bmMapState[ev.id]}
                      bookmarkCount={bmCounts[ev.id] || 0}
                      onBookmarkToggle={() => onToggleBookmark(ev.id)}
                      onClick={() => navigate(`/events/${ev.id}`)}
                    />
                  );
                })}
              </div>
              {(!events || events.length === 0) && (
                <div className="state state--empty">등록된 행사가 아직 없어요.</div>
              )}
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}