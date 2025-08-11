import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import HostCard from '../components/HostCard';
import InfiniteScroll from 'react-infinite-scroll-component';
import axios from 'axios';
import '../css/subscribe.css';

/** 여기만 바꾸면 모드 전환됨 */
const DEV_MOCK = true; // 🔄 UI 확인: true / API 모드: false

const PAGE_SIZE = 20;
const baseURL = process.env.REACT_APP_API_URL ?? '';

const MOCK_HOSTS = [
  { id: 1, name: '라이언 스튜디오', description: '디자인/IT 커뮤니티 이벤트를 주최합니다', category: ['디자인','IT'], profileImage: null },
  { id: 2, name: '코드팩토리',   description: '프로그래밍 및 개발자 커뮤니티 운영',       category: ['개발','교육'], profileImage: null },
  { id: 3, name: '트래블메이커', description: '여행 관련 모임과 이벤트 기획',             category: ['여행','문화'], profileImage: null },
  { id: 4, name: '푸드하우스',   description: '맛집 탐방과 요리 클래스 진행',             category: ['요리','맛집'], profileImage: null },
];

export default function SubscribePage() {
  const [organizers, setOrganizers] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(!DEV_MOCK); // 목은 더 불러올 것 없음
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const isFetchingRef = useRef(false);

  // API 모드일 때만 호출되는 fetch
  const fetchOrganizers = useCallback(async (nextPage = 1) => {
    if (DEV_MOCK) return;                 // 목 모드면 API 호출 X
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    setLoading(true);
    setErrMsg('');
    try {
      const res = await axios.get(`${baseURL}/api/organizers`, {
        params: { page: nextPage, size: PAGE_SIZE },
      });

      // 응답 구조에 맞춰 배열 추출
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
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (DEV_MOCK) {
      setOrganizers(MOCK_HOSTS);  // UI 확인용
    } else {
      fetchOrganizers(1);         // API 모드
    }
  }, [fetchOrganizers]);

  const loadMore = async () => {
    if (DEV_MOCK) return;         // 목 모드면 더 불러오기 없음
    const next = page + 1;
    await fetchOrganizers(next);
    setPage(next);
  };

  const isEmpty = (organizers?.length ?? 0) === 0 && !loading && !errMsg;

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
              {(organizers ?? []).map((org) => (
                <HostCard key={org.id} host={org} />
              ))}
            </ul>
          </InfiniteScroll>
        )}
      </div>
    </Layout>
  );
}
