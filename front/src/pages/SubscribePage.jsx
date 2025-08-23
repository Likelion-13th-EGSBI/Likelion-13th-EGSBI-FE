// src/pages/SubscribePage.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/Layout';
import HostCard from '../components/HostCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import axios from 'axios';
import '../css/subscribe.css';

const PAGE_SIZE = 20;
const baseURL = process.env.REACT_APP_API_URL ?? '';

function getUserIdFromStorage() {
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    if (Number.isFinite(auth?.id)) return Number(auth.id);
  } catch {}
  const raw = localStorage.getItem('userId') || '';
  const onlyDigits = (raw.match(/\d+/g) || []).join('');
  const n = onlyDigits ? parseInt(onlyDigits, 10) : null;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function SubscribePage() {
  const [all, setAll] = useState([]);
  const [visible, setVisible] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const userId = getUserIdFromStorage();

  const axiosInstance = useMemo(() => {
    const inst = axios.create({ baseURL });
    if (userId != null) inst.defaults.headers['X-User-Id'] = String(userId);
    return inst;
  }, [userId]);

  const fetchAll = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setErrMsg('');
    try {
      if (!baseURL) throw new Error('API URL이 설정되지 않았습니다 (REACT_APP_API_URL).');
      if (userId == null) throw new Error('사용자 식별이 필요합니다 (X-User-Id).');

      const res = await axiosInstance.get('/api/user/subscription/getAll', {
        validateStatus: s => (s >= 200 && s < 300) || s === 204,
      });

      const list = Array.isArray(res.data) ? res.data : [];
      setAll(list);

      const first = list.slice(0, PAGE_SIZE);
      setVisible(first);
      setPage(0);
      setHasMore(list.length > first.length);
    } catch (e) {
      console.error(e);
      setErrMsg(
        e?.message?.includes('X-User-Id')
          ? '로그인이 필요해요. 로그인 후 다시 시도해 주세요.'
          : '구독 목록을 불러오는 중 문제가 발생했어요.'
      );
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [axiosInstance, loading, userId]);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    fetchAll();
  }, [fetchAll]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    const nextSlice = all.slice(0, (nextPage + 1) * PAGE_SIZE);
    setVisible(nextSlice);
    setPage(nextPage);
    setHasMore(all.length > nextSlice.length);
  }, [all, hasMore, loading, page]);

  const handleUnsubscribe = useCallback(
    async (organizerId) => {
      try {
        if (userId == null) throw new Error('사용자 식별이 필요합니다 (X-User-Id).');

        await axiosInstance.delete('/api/user/subscription/delete', {
          data: { userId, organizerId },
        });

        const nextAll = all.filter(item => item?.organizerId !== organizerId);
        setAll(nextAll);

        const maxCount = (page + 1) * PAGE_SIZE;
        const nextVisible = nextAll.slice(0, Math.min(maxCount, nextAll.length));
        setVisible(nextVisible);
        setHasMore(nextAll.length > nextVisible.length);
      } catch (e) {
        console.error(e);
        setErrMsg('구독 해제 중 문제가 발생했어요.');
      }
    },
    [all, axiosInstance, page, userId]
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

        {!baseURL && (
          <div className="state state--error">
            환경변수 <code>REACT_APP_API_URL</code>이 비어 있어요.
          </div>
        )}
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
                  {visible.map((org, idx) => (
                    <HostCard
                      key={org?.organizerId ?? idx}
                      host={{
                        id: org?.organizerId ?? null,
                        name: org?.organizerName ?? org?.organizerNickname ?? '이름 없음',
                        profileImage: org?.profileImageUri ?? null,
                      }}
                      onUnsubscribe={handleUnsubscribe}
                    />
                  ))}
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
