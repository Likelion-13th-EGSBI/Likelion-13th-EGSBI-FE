import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/eventcard.css";
import "../css/bookmark-joined.css";

// 더미 데이터 (이미지 제거)
const DUMMY = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  image: "",
  title: `북마크 행사 ${i + 1}`,
  summary: `이것은 북마크한 행사 ${i + 1}의 설명입니다.`,
  hashtags: ["#문화", "#전시"],
  date: `2025-09-${(i % 30 + 1).toString().padStart(2, "0")}`,
  location: "서울시 강남구",
  lat: 37.5665 + Math.random() * 0.02,
  lng: 126.978 + Math.random() * 0.02,
  time: "14:00",
  fee: i % 2 === 0 ? 0 : 5000,
  bookmarked: true,
}));

const BookmarkedEvents = () => {
  const [events, setEvents] = useState([]);
  const [view, setView] = useState("list");
  const navigate = useNavigate();
  const overlayRef = useRef(null);

  useEffect(() => setEvents(DUMMY), []);

  const sortedByDeadline = useMemo(
    () => [...events].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [events]
  );

  const handleBookmarkToggle = (id) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, bookmarked: !e.bookmarked } : e))
    );
  };

  useEffect(() => {
    if (view !== "map") return;

    const primary =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        ?.trim() || "#5E936C";

    const initMap = () => {
      const { kakao } = window;
      if (!kakao || !kakao.maps) return;

      const container = document.getElementById("map");
      if (!container) return;
      container.style.minHeight = "60vh";
      container.style.touchAction = "auto";

      const map = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(37.5665, 126.978),
        level: 6,
      });
      map.setDraggable(true);
      map.setZoomable(true);

      kakao.maps.event.addListener(map, "click", () => {
        overlayRef.current?.setMap(null);
      });

      const bounds = new kakao.maps.LatLngBounds();

      sortedByDeadline.forEach((ev) => {
        if (typeof ev.lat !== "number" || typeof ev.lng !== "number") return;
        const pos = new kakao.maps.LatLng(ev.lat, ev.lng);
        bounds.extend(pos);

        // 마커 (기본 이미지 없음)
        const wrap = document.createElement("div");
        wrap.className = "km-pin-wrap";
        wrap.innerHTML = `
          <div class="km-pin" style="--pin:${primary};">
            <svg width="40" height="52" viewBox="0 0 40 52">
              <path fill="var(--pin)" d="M20 52s16-15.5 16-26C36 12.536 28.836 5 20 5S4 12.536 4 26c0 10.5 16 26 16 26z"/>
              <circle cx="20" cy="23" r="9" fill="white"/>
            </svg>
          </div>
        `;
        const marker = new kakao.maps.CustomOverlay({
          position: pos,
          content: wrap,
          xAnchor: 0.5,
          yAnchor: 1.0,
        });
        marker.setMap(map);

        // 마커 클릭 → CustomOverlay로 InfoWindow 구현
        wrap.querySelector(".km-pin").addEventListener("click", (e) => {
          e.stopPropagation();
          const content = document.createElement("div");
          content.className = "custom-infowindow";
          content.innerHTML = `
            <div class="meta">
              <div class="title">${ev.title}</div>
              <div class="desc">${ev.location ?? ""}</div>
              <div class="sub">${ev.date} · ${ev.time ?? ""} · ${ev.fee ? ev.fee.toLocaleString() + "원" : "무료"}</div>
              <button class="outline-btn" data-id="${ev.id}">상세보기</button>
            </div>
          `;
          content.querySelector(".outline-btn").addEventListener("click", () => {
            navigate(`/events/${ev.id}`);
          });

          overlayRef.current?.setMap(null);
          overlayRef.current = new kakao.maps.CustomOverlay({
            position: pos,
            content: content,
            yAnchor: 1.47, // 마커보다 위
            xAnchor: 0.29, // 왼쪽으로 이동
            zIndex: 10000,
          });
          overlayRef.current.setMap(map);
        });
      });

      if (!bounds.isEmpty()) map.setBounds(bounds);
    };

    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(initMap);
      return;
    }
    const existed = document.querySelector('script[data-kakao-map="true"]');
    if (existed) {
      existed.addEventListener("load", () => window.kakao?.maps?.load(initMap), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.setAttribute("data-kakao-map", "true");
    script.src =
      "https://dapi.kakao.com/v2/maps/sdk.js?appkey=cd740dc5ce8717cd9146f5c91861511a&autoload=false";
    script.async = true;
    script.onload = () => window.kakao?.maps?.load(initMap);
    document.head.appendChild(script);
  }, [view, sortedByDeadline, navigate]);

  return (
    <Layout>
      <div className="events-page is-under-topbar">
        <div className="events-header" style={{ display: "flex", gap: 8 }}>
          <button
            className={`pill-btn ${view === "list" ? "active" : ""}`}
            onClick={() => setView("list")}
          >
            북마크 행사보기
          </button>
          <button
            className={`pill-btn ${view === "map" ? "active" : ""}`}
            onClick={() => setView("map")}
          >
            지도보기
          </button>
        </div>

        {view === "list" ? (
          <div className="events-grid">
            {sortedByDeadline.map((ev) => (
              <div
                key={ev.id}
                onClick={() => navigate(`/events/${ev.id}`)}
                style={{ cursor: "pointer" }}
              >
                <EventCard
                  image=""
                  title={ev.title}
                  summary={ev.summary}
                  hashtags={ev.hashtags}
                  date={ev.date}
                  location={ev.location}
                  time={ev.time}
                  fee={ev.fee}
                  bookmarked={ev.bookmarked}
                  onBookmarkToggle={(e) => {
                    e.stopPropagation?.();
                    handleBookmarkToggle(ev.id);
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div id="map" className="map-box" />
        )}
      </div>
    </Layout>
  );
};

export default BookmarkedEvents;
