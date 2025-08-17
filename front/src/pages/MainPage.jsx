import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import { MOCK_EVENTS as RAW_EVENTS } from "./MockList";
import "../css/mainpage.css";

export default function MainPage() {
  const navigate = useNavigate();
  const userName = "김민지";

  const [bookmarks, setBookmarks] = useState({});
  const toggleBookmark = (id) =>
    setBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));

  const recommended = useMemo(
    () =>
      [...RAW_EVENTS]
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, 12),
    []
  );

  const myTown = RAW_EVENTS[0]?.location ?? "우리동네";
  const localPopular = useMemo(() => {
    const filtered = RAW_EVENTS.filter((e) => e.location === myTown);
    const base = filtered.length ? filtered : RAW_EVENTS;
    return [...base]
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 12);
  }, [myTown]);

  const onCardClick = (id) => navigate(`/events/${id}`);

  return (
    <Layout pageTitle="홈" activeMenuItem="home">
      <div className="mainpage">
        <section className="mainhero-card">
          <div className="mainhero-text">
            <div className="mainhero-hello">
              <strong>{userName}</strong> 님, 반가워요!  👋
            </div>
            <h1 className="mainhero-title">
              <span className="nowrap">
                <span className="eventory brand-strong">Eventory</span>와 함께
              </span>
              <br />
              우리동네 행사에 참여해보세요 🎉
            </h1>
            <p className="mainhero-sub">
              <strong>{userName}</strong>님이 좋아하는 테마로 딱 맞는 행사를 추천해드릴게요.
            </p>
          </div>
        </section>

        <SectionHeader
          title={<>🫶 적극 추천 행사</>}
          subtitle={`AI가 “${userName}”님 취향을 분석해 골라드렸어요!`}
        />
        <HorizontalScroller>
          {recommended.map((e, idx) => (
            <div
              className="hcell fade-slide-in"
              style={{ animationDelay: `${idx * 40}ms` }}
              key={e.id}
            >
              <EventCard
                id={e.id}
                image={e.image}
                title={e.title}
                summary={e.summary}
                hashtags={e.hashtags}
                date={e.date}
                time={e.time}
                location={e.location}
                fee={e.fee}
                bookmarked={!!bookmarks[e.id]}
                onBookmarkToggle={() => toggleBookmark(e.id)}
                onClick={onCardClick}
              />
            </div>
          ))}
        </HorizontalScroller>

        <SectionHeader
          title={<>🔥 우리동네 인기 행사</>}
          subtitle={`${userName}님 동네의 인기 행사를 만나보세요!`}
          cta={{ label: "전체 행사 보기", onClick: () => navigate("/event-all") }}
          plainLink
        />
        <HorizontalScroller>
          {localPopular.map((e, idx) => (
            <div
              className="hcell fade-slide-in"
              style={{ animationDelay: `${idx * 40}ms` }}
              key={e.id}
            >
              <EventCard
                id={e.id}
                image={e.image}
                title={e.title}
                summary={e.summary}
                hashtags={e.hashtags}
                date={e.date}
                time={e.time}
                location={e.location}
                fee={e.fee}
                bookmarked={!!bookmarks[e.id]}
                onBookmarkToggle={() => toggleBookmark(e.id)}
                onClick={onCardClick}
              />
            </div>
          ))}
        </HorizontalScroller>
      </div>
    </Layout>
  );
}

function SectionHeader({ title, subtitle, cta, plainLink = false }) {
  return (
    <div className="section-head">
      <div className="section-left">
        <h2 className="section-title">{title}</h2>
        <p className="section-sub">{subtitle}</p>
      </div>
      {cta &&
        (plainLink ? (
          <button type="button" className="section-link-plain" onClick={cta.onClick}>
            {cta.label}
          </button>
        ) : (
          <button type="button" className="section-link" onClick={cta.onClick}>
            {cta.label} <span className="arrow">›</span>
          </button>
        ))}
    </div>
  );
}

function HorizontalScroller({ children }) {
  const ref = useRef(null);
  return (
    <div className="hwrap">
      <div className="hscroll" ref={ref}>
        {children}
      </div>
      {/* 커스텀 화살표 완전 제거 */}
    </div>
  );
}
