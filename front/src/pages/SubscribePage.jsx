import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import HostCard from '../components/HostCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import axios from 'axios';
import '../css/subscribe.css';

const PAGE_SIZE = 20;
const baseURL = process.env.REACT_APP_API_URL ?? '';
const DEV_MOCK = true; 

const MOCK_ORGANIZERS = [
  { id: 1, name: '라이언 스튜디오', profileImage: null },
  { id: 2, name: '사자 아카데미', profileImage: null },
  { id: 3, name: '오렌지 랩', profileImage: null },
];

export default function SubscribePage() {
  const [organizers, setOrganizers] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const fetchOrganizers = useCallback(
    async (nextPage = 1) => {
      if (loading) return;
      setLoading(true);
      setErrMsg('');

      try {
        // 개발 모드에서는 목업 데이터 사용
        if (DEV_MOCK || !baseURL) {
          setOrganizers(MOCK_ORGANIZERS);
          setHasMore(false);
          return;
        }

        // 실 API
        const res = await axios.get(`${baseURL}/api/organizers`, {
          params: { page: nextPage, size: PAGE_SIZE },
        });

        const items = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.data)
          ? res.data
          : [];

        setOrganizers(prev => (nextPage === 1 ? items : [...prev, ...items]));
        setHasMore(items.length === PAGE_SIZE);
      } catch (e) {
        console.error(e);
        setErrMsg('구독 목록을 불러오는 중 문제가 발생했어요.');
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  useEffect(() => {
    fetchOrganizers(1);
  }, [fetchOrganizers]);

  const loadMore = async () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    await fetchOrganizers(next);
    setPage(next);
  };

  // 구독 해제 핸들러
  // 실제 API 호출은 없고, 목업 데이터에서만 동작
  const handleUnsubscribe = (id) => {
    setOrganizers(prev => prev.filter(o => (o?.id ?? o?.organizerId) !== id));
  };

  const count = organizers?.length ?? 0;
  const isEmpty = count === 0 && !loading && !errMsg;

  return (
    <Layout pageTitle="구독" activeMenuItem="subscrib">
      <div className="subscribe-page">
        <div className="subscribe-header">
          <h2>구독한 주최자</h2>
          <span className="subscribe-count">{count}명</span>
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
              >
                <ul className="org-grid">
                  {(Array.isArray(organizers) ? organizers : []).map((org, idx) => (
                    <HostCard
                      key={org?.id ?? idx}
                      host={{
                        id: org?.id ?? org?.organizerId ?? null,
                        name: org?.name ?? org?.organizerName ?? '이름 없음',
                        profileImage: org?.profileImage ?? org?.image ?? null,
                      }}
                      onUnsubscribe={handleUnsubscribe}
                    />
                  ))}
                </ul>
              </InfiniteScroll>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
