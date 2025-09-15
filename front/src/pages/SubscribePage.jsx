// src/pages/SubscribePage.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/Layout';
import HostCard from '../components/HostCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import axios from 'axios';
import '../css/subscribe.css';

const PAGE_SIZE = 20;
const API_BASE = 'https://likelion-att.o-r.kr/v1';

const toProfileUrl = (id) => {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? `${API_BASE}/image/${n}` : '';
};
const imgUrl = (id) => (id ? `${API_BASE}/image/${id}` : null);

function pickOrganizerProfile(src, organizerId) {
  if (!src) return null;
  const name =
    src.organizerName ??
    src.organizerNickname ??
    src.name ??
    `Organizer #${organizerId}`;

  const nickname = src.organizerNickname ?? src.nickname ?? null;

  const profileImageId =
    src.organizerProfileImageId ??
    src.profileImageId ??
    src.imageId ??
    null;

  const profileImageUri =
    src.organizerProfileImageUri ??
    src.profileImageUri ??
    src.imageUri ??
    null;

  return {
    id: organizerId,
    name,
    nickname,
    profileImageId: Number.isFinite(profileImageId) ? profileImageId : null,
    profileImageUri: profileImageUri || null,
    avatarUrl: profileImageUri || toProfileUrl(profileImageId),
  };
}

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

function makeAxios() {
  const inst = axios.create({ baseURL: API_BASE, withCredentials: false });

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
            .post(`${API_BASE}/user/renew`, null, {
              headers: { 'X-User-Id': String(id) },
              withCredentials: false,
            })
            .then((r) => {
              const tok = r?.data?.accessToken;
              if (tok) saveAuth({ accessToken: tok });
            })
            .finally(() => {
              renewing = null;
            });
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

async function bookmarkList() {
  const res = await api.get('/activity/bookmark/list', { validateStatus: (s) => s >= 200 && s < 300 });
  const arr = Array.isArray(res.data) ? res.data : [];
  const map = {};
  for (const b of arr) if (b?.eventId != null) map[Number(b.eventId)] = true;
  return map;
}
async function bookmarkToggle(eventId) {
  await api.post('/activity/bookmark/toggle', { eventId });
}
async function bookmarkCount(eventId) {
  const res = await api.get('/activity/bookmark/count', { params: { eventId } });
  const n = Number(res?.data);
  return Number.isFinite(n) ? n : 0;
}

async function subscriptionGetAll() {
  const res = await api.get('/user/subscription/getAll', {
    validateStatus: (s) => (s >= 200 && s < 300) || s === 204,
  });
  return Array.isArray(res.data) ? res.data : [];
}
async function subscriptionCreate(userId, organizerId) {
  await api.post('/user/subscription/create', { userId, organizerId });
}
async function subscriptionDelete(userId, organizerId) {
  await api.delete('/user/subscription/delete', { data: { userId, organizerId } });
}

async function fetchUserProfile(organizerId) {
  try {
    const r = await api.get('/user/info', { params: { userId: organizerId } });
    const data = r?.data ?? null;

    const nickname = data?.nickname ?? '';
    const profileId = data?.profileId ?? null;
    const displayName = nickname || `Organizer #${organizerId}`;

    return {
      id: organizerId,
      name: displayName,
      nickname: nickname || null,
      profileImageId: profileId,
      profileImageUri: null, 
      avatarUrl: toProfileUrl(profileId),
    };
  } catch {
    return null;
  }
}


async function enrichSubscriptionsToHosts(subs) {
  const tasks = subs.map(async (org) => {
    const organizerId = Number(org?.organizerId);
    const fromUser = await fetchUserProfile(organizerId);
    const fallback = pickOrganizerProfile(org, organizerId);
    const prof = fromUser || fallback || {
      id: organizerId,
      name: `Organizer #${organizerId}`,
      nickname: null,
      profileImageId: null,
      profileImageUri: null,
      avatarUrl: '',
    };
    return {
      id: prof.id,
      name: prof.name,
      nickname: prof.nickname || undefined,
      profileImage: prof.avatarUrl || prof.profileImageUri || toProfileUrl(prof.profileImageId) || null,
    };
  });
  return Promise.all(tasks);
}

export default function SubscribePage() {
  const [all, setAll] = useState([]);            
  const [allHosts, setAllHosts] = useState([]);  
  const [visible, setVisible] = useState([]);  
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const [bmMap, setBmMap] = useState({});
  const user = getAuth();
  const userId = user.id;

  const fetchAll = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setErrMsg('');
    try {
      if (userId == null) throw new Error('로그인이 필요합니다.');

      const [subs, bookmarks] = await Promise.all([subscriptionGetAll(), bookmarkList()]);
      setAll(subs);

      const hosts = await enrichSubscriptionsToHosts(subs);
      setAllHosts(hosts);

      const first = hosts.slice(0, PAGE_SIZE);
      setVisible(first);
      setPage(0);
      setHasMore(hosts.length > first.length);

      setBmMap(bookmarks);
    } catch (e) {
      console.error(e);
      setErrMsg(
        e?.message?.includes('로그인')
          ? '로그인이 필요해요. 로그인 후 다시 시도해 주세요.'
          : '구독 목록을 불러오는 중 문제가 발생했어요.'
      );
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, userId]);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    fetchAll();
  }, [fetchAll]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    const nextSlice = allHosts.slice(0, (nextPage + 1) * PAGE_SIZE);
    setVisible(nextSlice);
    setPage(nextPage);
    setHasMore(allHosts.length > nextSlice.length);
  }, [allHosts, hasMore, loading, page]);

  const handleSubscribeToggle = useCallback(
    async (organizerId, subscribed) => {
      try {
        if (userId == null) throw new Error('로그인이 필요합니다.');
        if (subscribed) {
          await subscriptionDelete(userId, organizerId);
          const nextAll = all.filter((it) => Number(it?.organizerId) !== Number(organizerId));
          setAll(nextAll);

          const nextHosts = allHosts.filter((h) => Number(h?.id) !== Number(organizerId));
          setAllHosts(nextHosts);

          const maxCount = (page + 1) * PAGE_SIZE;
          setVisible(nextHosts.slice(0, Math.min(maxCount, nextHosts.length)));
          setHasMore(nextHosts.length > Math.min(maxCount, nextHosts.length));
        } else {
          await subscriptionCreate(userId, organizerId);
          const subs = await subscriptionGetAll();
          setAll(subs);

          const hosts = await enrichSubscriptionsToHosts(subs);
          setAllHosts(hosts);

          const maxCount = (page + 1) * PAGE_SIZE;
          setVisible(hosts.slice(0, Math.min(maxCount, hosts.length)));
          setHasMore(hosts.length > Math.min(maxCount, hosts.length));
        }
      } catch (e) {
        console.error(e);
        setErrMsg(subscribed ? '구독 해제 중 문제가 발생했어요.' : '구독 중 문제가 발생했어요.');
      }
    },
    [all, allHosts, page, userId]
  );

  const toggleBookmark = useCallback(
    async (eventId) => {
      if (userId == null) {
        alert('로그인이 필요합니다.');
        return;
      }
      const prev = !!bmMap[eventId];
      setBmMap((m) => ({ ...m, [eventId]: !prev })); 
      try {
        await bookmarkToggle(eventId);
        const latest = await bookmarkList();
        setBmMap(latest);
      } catch (e) {
        console.error(e);
        setBmMap((m) => ({ ...m, [eventId]: prev })); 
      }
    },
    [bmMap, userId]
  );

  const count = visible.length;
  const isEmpty = !loading && !errMsg && all.length === 0;

  return (
    <Layout pageTitle="구독">
      <div className="subscribe-page">
        <div className="subscribe-header">
          <h2>구독한 주최자</h2>
          <span className="subscribe-count">{all.length}명</span>
        </div>

        {errMsg && <div className="state state--error">{errMsg}</div>}

        {isEmpty ? (
          <div className="empty">
            <div className="empty__emoji">🫥</div>
            <div className="empty__title">구독 중인 주최자가 없어요</div>
            <div className="empty__desc">관심 있는 주최자를 구독하면 여기에서 모아볼 수 있어요.</div>
          </div>
        ) : (
          <>
            {count > 0 && (
              <InfiniteScroll
                dataLength={count}
                next={loadMore}
                hasMore={hasMore}
                loader={loading && hasMore ? <div className="state state--loading">불러오는 중…</div> : null}
                style={{ overflow: 'visible' }}
              >
                <ul className="org-grid">
                  {visible.map((host, idx) => {
                    const organizerId = host?.id ?? null;
                    return (
                      <HostCard
                        key={organizerId ?? idx}
                        host={{
                          id: organizerId,
                          name: host?.name || `Organizer #${organizerId}`,
                          nickname: host?.nickname || undefined,
                          profileImage: host?.profileImage || null,
                        }}
                        subscribed={true}
                        onSubscribeToggle={() =>
                          handleSubscribeToggle(organizerId, true)
                        }
                        bookmarkState={bmMap}
                        onBookmarkToggle={toggleBookmark}
                      />
                    );
                  })}
                </ul>
              </InfiniteScroll>
            )}
            {!hasMore && !loading && count > 0 && (
              <div className="state state--end">🌟 더 많은 주최자를 구독하고 다양한 행사를 만나보세요</div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
