import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EventCard from '../components/EventCard';
import '../css/eventcard.css';

// 테스트용 50개 데이터 생성
export const MOCK_EVENTS = Array.from({ length: 50 }, (_, i) => {
  const id = 101 + i;
  return {
    id,
    title: `행사 ${id}`,
    summary: `행사 ${id}의 요약 텍스트입니다. 두 줄까지 표시되고 넘으면 ... 처리됩니다.`,
    image: null,
    date: `2025-12-${String((i % 28) + 1).padStart(2, "0")}`,
    time: `${String((i % 24)).padStart(2, "0")}:${(i % 2 === 0 ? "00" : "30")}`,
    location: ["서울", "부산", "대구", "인천", "광주"][i % 5],
    fee: i % 3 === 0 ? "무료" : `${(i + 1) * 1000}원`,
    hashtags: i % 2 === 0 ? ["커뮤니티", "IT"] : ["디자인"],
    popularity: Math.floor(Math.random() * 500),
    lat: 37.5663 + (i % 5) * 0.1,
    lng: 126.9779 + (i % 5) * 0.1,
  };
});

export default function MockList() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState({});
  const toggleBookmark = (id) =>
    setBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ padding: 24 }}>
      <h2>카드 클릭 → 상세로 이동 테스트</h2>
      <div
        className="event-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, 280px)",
          gap: 16,
        }}
      >
        {MOCK_EVENTS.map((ev) => (
          <EventCard
            key={ev.id}
            id={ev.id}
            {...ev}
            bookmarked={!!bookmarks[ev.id]}
            onBookmarkToggle={() => toggleBookmark(ev.id)}
            onClick={() => navigate(`/events/${ev.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
