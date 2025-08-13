import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import HostCard from '../components/HostCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import axios from 'axios';
import '../css/subscribe.css';

const PAGE_SIZE = 20;
const baseURL = process.env.REACT_APP_API_URL ?? '';

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
    const next = page + 1;
    await fetchOrganizers(next);
    setPage(next);
  };

  const isEmpty = (Array.isArray(organizers) ? organizers.length : 0) === 0 && !loading && !errMsg;

  return (
    <Layout pageTitle="구독" activeMenuItem="home">
      <div className="subscribe-page">
        <div className="subscribe-header">
          <h2>구독한 주최자</h2>
          <span className="subscribe-count">{organizers?.length ?? 0}명</span>
        </div>

        {errMsg && <div className="state state--error">{errMsg}</div>}

        {isEmpty ? (
          <div className="empty">
            <div className="empty__emoji">🫥</div>
            <div className="empty__title">구독 중인 주최자가 없어요</div>
            <div className="empty__desc">관심 있는 주최자를 구독하면 여기에서 모아볼 수 있어요.</div>
          </div>
        ) : (
          <InfiniteScroll
            dataLength={organizers?.length ?? 0}
            next={loadMore}
            hasMore={hasMore}
            loader={<div className="state state--loading">불러오는 중…</div>}
            endMessage={<div className="state state--end">마지막입니다.</div>}
          >
            <ul className="org-grid">
              {(Array.isArray(organizers) ? organizers : []).map((org, idx) => (
                <HostCard key={org?.id ?? idx} host={org} />
              ))}
            </ul>
          </InfiniteScroll>
        )}
      </div>
    </Layout>
  );
}
