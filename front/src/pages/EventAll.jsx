import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import { MOCK_EVENTS as RAW_EVENTS } from "./MockList";
import "../css/eventall.css";

function toDateFromYMDHM(ymd, hm) {
  const d = new Date(ymd);
  const [h, m] = (hm || "00:00").split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
function distanceKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad((b.lat ?? 0) - (a.lat ?? 0));
  const dLon = toRad((b.lng ?? 0) - (a.lng ?? 0));
  const lat1 = toRad(a.lat ?? 0);
  const lat2 = toRad(b.lat ?? 0);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

// 페이지 번호 축약(…)
function getPageRange(totalPages, current, delta = 2) {
  const range = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(totalPages - 1, current + delta);
  range.push(1);
  if (left > 2) range.push("…");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < totalPages - 1) range.push("…");
  if (totalPages > 1) range.push(totalPages);
  return range;
}

export default function EventAll() {
  const navigate = useNavigate();

  const [sort, setSort] = useState("latest");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [bookmarks, setBookmarks] = useState({});
  const [userPos, setUserPos] = useState({ lat: 37.5663, lng: 126.9779 });

  const PER_PAGE = 40;
  const [page, setPage] = useState(1);

  const goTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 3000 }
    );
  }, []);

  const now = new Date();

  const normalized = useMemo(() => {
    return RAW_EVENTS.map((e) => {
      const start = e.startsAt ? new Date(e.startsAt) : toDateFromYMDHM(e.date, e.time);
      const end = e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const lat = e.lat ?? 37.5663;
      const lng = e.lng ?? 126.9779;
      return {
        ...e,
        _start: start,
        _end: end,
        _distance: distanceKm(userPos, { lat, lng }),
        _isOngoing: now >= start && now <= end,
      };
    });
  }, [userPos, now]);

  const filteredAndSorted = useMemo(() => {
    let arr = normalized;
    if (!includeClosed) arr = arr.filter((e) => e._isOngoing || e._end >= now);
    if (sort === "latest") arr = [...arr].sort((a, b) => b._start - a._start);
    if (sort === "popular") arr = [...arr].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    if (sort === "distance") arr = [...arr].sort((a, b) => (a._distance ?? 1e9) - (b._distance ?? 1e9));
    return arr;
  }, [normalized, includeClosed, sort, now]);

  const total = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filteredAndSorted.slice(start, start + PER_PAGE);
  }, [filteredAndSorted, page]);

  // 페이지 바뀔 때 "페이지 맨 위"로
  useEffect(() => {
    goTop();
  }, [page]);

  const toggleBookmark = (id) =>
    setBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));
  const onCardClick = (id) => navigate(`/events/${id}`);

  const changePage = (p) => setPage(p);

  return (
    <Layout pageTitle="전체 행사" activeMenuItem="home">
      <div className="eventall-page">
        <div className="eventall-head">
          <div className="eventall-count">
            <strong className="count-num">{total.toLocaleString()}</strong>
            개의 행사가 당신을 기다립니다
          </div>

          <div className="eventall-controls">
            <div className="eventall-filters">
              <button
                type="button"
                className={`chip ${!includeClosed ? "on" : ""}`}
                onClick={() => {
                  setIncludeClosed(false);
                  setPage(1);
                  goTop();
                }}
              >
                진행중만
              </button>
              <button
                type="button"
                className={`chip ${includeClosed ? "on" : ""}`}
                onClick={() => {
                  setIncludeClosed(true);
                  setPage(1);
                  goTop();
                }}
              >
                마감 포함
              </button>
            </div>

            <div className="eventall-sort">
              {[
                { key: "latest", label: "최신" },
                { key: "popular", label: "인기" },
                { key: "distance", label: "거리순" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`sort-tab ${sort === t.key ? "active" : ""}`}
                  onClick={() => {
                    setSort(t.key);
                    setPage(1);
                    goTop();
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="eventall-grid event-grid">
          {pageItems.map((e) => (
            <EventCard
              key={e.id}
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
          ))}
        </div>

        {total === 0 && <div className="eventall-empty">조건에 맞는 행사가 없어요.</div>}

        {totalPages > 1 && (
          <div className="eventall-pagination" role="navigation" aria-label="페이지">
            <button
              type="button"
              className="page-btn nav"
              disabled={page === 1}
              onClick={() => changePage(Math.max(1, page - 1))}
            >
              ◀
            </button>

            <div className="page-list">
              {getPageRange(totalPages, page).map((p, idx) =>
                p === "…" ? (
                  <span key={`dots-${idx}`} className="page-dots">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`page-btn ${p === page ? "active" : ""}`}
                    onClick={() => changePage(p)}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="page-btn nav"
              disabled={page === totalPages}
              onClick={() => changePage(Math.min(totalPages, page + 1))}
            >
              ▶
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
