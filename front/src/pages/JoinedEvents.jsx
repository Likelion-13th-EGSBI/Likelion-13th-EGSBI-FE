import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/eventcard.css";
import "../css/bookmark-joined.css";


const JoinedEvents = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // TODO: API 연동 전 임시 더미 데이터
    setEvents([
      {
        id: 11,
        image: "",
        title: "참여한 행사 1",
        summary: "이 행사는 내가 참여한 행사입니다.",
        hashtags: ["#봉사", "#환경"],
        date: "2025-09-20",
        location: "부산 해운대구",
        time: "09:00",
        fee: "무료",
        bookmarked: false,
      },
      {
        id: 12,
        image: "",
        title: "참여한 행사 2",
        summary: "이 행사는 내가 참여한 행사입니다.",
        hashtags: ["#교육", "#세미나"],
        date: "2025-09-25",
        location: "대구 달서구",
        time: "15:00",
        fee: "5,000원",
        bookmarked: true,
      },
    ]);
  }, []);

  return (
    <Layout>
      <div className="events-page is-under-topbar">
        <div className="events-header">
          <h2 className="events-title">내가 참여한 행사</h2>
        </div>

        {events.length > 0 ? (
          <div className="events-grid">
            {events.map((e) => (
              <EventCard
                key={e.id}
                {...e}
                onBookmarkToggle={() => console.log(`${e.title} 북마크 토글`)}
              />
            ))}
          </div>
        ) : (
          <div className="events-empty">
            <div className="emoji">🗓️</div>
            <div className="title">참여한 행사가 아직 없어요</div>
            <div className="desc">관심 있는 행사를 신청하면 여기서 확인할 수 있어요.</div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default JoinedEvents;
