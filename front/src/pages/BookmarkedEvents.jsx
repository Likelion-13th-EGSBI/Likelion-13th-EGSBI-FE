// src/pages/BookmarkedEvents.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import BottomBar from "../components/BottomBar";
import "../css/eventcard.css";
import "../css/bookmark-joined.css";

// --------- 더미 데이터 ----------
const DUMMY = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  image: "https://via.placeholder.com/400x250?text=Event+" + (i + 1),
  imageUrl: "https://via.placeholder.com/400x250?text=Event+" + (i + 1),
  title: `북마크 행사 ${i + 1}`,
  summary: `이것은 북마크한 행사 ${i + 1}의 설명입니다.`,
  description: "행사 상세 설명(더미). 실제에선 서버에서 받아옵니다.",
  hashtags: ["문화", "전시"],
  date: `2025-09-${(i % 30 + 1).toString().padStart(2, "0")}`,
  time: "14:00 - 17:00",
  location: "서울시 강남구",
  lat: 37.5665 + Math.random() * 0.02,
  lng: 126.978 + Math.random() * 0.02,
  fee: i % 2 === 0 ? "무료" : (5000 + i * 100).toLocaleString() + "원",
  endDate: i % 4 === 0 ? "2025-07-31" : "2025-12-31",
  ownerId: 123,
  ownerName: "라이언 스튜디오",
  ownerProfile: null,
  bookmarked: true,
}));
// ---------------------------------

const haversineKm = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
};

// 기존 브릿지는 중복 방지 위해 끔 (Layout이 iPad에서 BottomBar 직접 렌더)
const useTabletBridge = () => false;

const BookmarkedEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const [view, setView] = useState("list");
  const [sortMode, setSortMode] = useState("recent");
  const [includeClosed, setIncludeClosed] = useState(false);

  const [myPos, setMyPos] = useState(null);
  const [geoError, setGeoError] = useState("");

  const tabletBridge = useTabletBridge();

  const navigate = useNavigate();
  const location = useLocation();
  const observerTarget = useRef(null);
  const loadingRef = useRef(false);

  // 지도 관련 ref들
  const overlayRef = useRef(null);
  const mapBoxRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const focusMyPosRef = useRef(false);
  const sessionRef = useRef(0);
  const navBlockRef = useRef(false);
  const geoRequestedRef = useRef(false);

  /* =========================
     (A) 페이지 플래그 & 리스너
     ========================= */
  useEffect(() => {
    const html = document.documentElement;
    const setFlag = () => { html.dataset.page = "bookmarked"; };
    const clearFlag = () => { if (html.dataset.page === "bookmarked") delete html.dataset.page; };
    setFlag();

    const nudge = () => {
      document.body.style.transform = "translateZ(0)";
      requestAnimationFrame(() => (document.body.style.transform = ""));
    };
    const onOrient = () => { nudge(); };

    window.addEventListener("orientationchange", onOrient);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") clearFlag();
      if (document.visibilityState === "visible") setFlag();
    });
    window.addEventListener("pagehide", clearFlag);
    window.addEventListener("beforeunload", clearFlag);

    return () => {
      clearFlag();
      window.removeEventListener("orientationchange", onOrient);
      window.removeEventListener("pagehide", clearFlag);
      window.removeEventListener("beforeunload", clearFlag);
    };
  }, []);

  // 라우트 변할 때 플래그 유지
  useEffect(() => {
    const html = document.documentElement;
    if (location.pathname.includes("bookmark")) html.dataset.page = "bookmarked";
    else if (html.dataset.page === "bookmarked") delete html.dataset.page;
  }, [location.pathname]);

  /* =========================
     (B) 내 위치 파란점 CSS 주입
     ========================= */
  const myPosCssInjectedRef = useRef(false);
  const injectMyPosCSS = () => {
    if (myPosCssInjectedRef.current) return;
    const style = document.createElement("style");
    style.id = "mypos-style";
    style.textContent = `
      .mypos-marker{position:relative;width:24px;height:24px;pointer-events:none}
      .mypos-marker .dot{
        position:absolute;left:50%;top:50%;width:12px;height:12px;margin-left:-6px;margin-top:-6px;
        background:#1E88E5;border-radius:50%;box-shadow:0 0 4px rgba(30,136,229,.6)
      }
      .mypos-marker .pulse{
        position:absolute;left:50%;top:50%;width:20px;height:20px;margin-left:-10px;margin-top:-10px;
        background:rgba(30,136,229,.35);border-radius:50%;
        animation:mypos-pulse 1.8s ease-out infinite
      }
      @keyframes mypos-pulse{
        0%{transform:translate(-50%,-50%) scale(.55);opacity:.75}
        70%{transform:translate(-50%,-50%) scale(1.8);opacity:0}
        100%{opacity:0}
      }
    `;
    document.head.appendChild(style);
    myPosCssInjectedRef.current = true;
  };

  const loadEvents = async (opts = {}) => {
    if (loadingRef.current && opts.page > 1) return;
    loadingRef.current = true;
    setLoading(true);

    const flag = opts.includeClosed ?? includeClosed;
    const sort = opts.sortMode ?? sortMode;
    const pos = opts.pos ?? myPos;
    const currentPage = opts.page ?? 1;
    const perPage = 12;

    try {
      const allData = [...(flag ? DUMMY : DUMMY.filter((e) => {
        const end = new Date(e.endDate || e.date); end.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return +end >= +today;
      }))].filter((e) => e.bookmarked);

      if (sort === "distance" && pos) {
        allData.sort((a, b) => {
          const distA = typeof a.lat === "number" && typeof a.lng === "number" ? haversineKm(pos, { lat: a.lat, lng: a.lng }) : Infinity;
          const distB = typeof b.lat === "number" && typeof b.lng === "number" ? haversineKm(pos, { lat: b.lat, lng: b.lng }) : Infinity;
          return distA - distB;
        });
      } else if (sort === "recent") {
        allData.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      const startIndex = (currentPage - 1) * perPage;
      const paginatedData = allData.slice(startIndex, startIndex + perPage);

      if (currentPage === 1) setEvents(paginatedData);
      else setEvents((prev) => [...prev, ...paginatedData]);

      setHasMore(startIndex + perPage < allData.length);
    } catch (e) {
      console.error(e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  // 최초 로드
  useEffect(() => { loadEvents({ includeClosed, sortMode, pos: myPos, page: 1 }); }, []);

  // 마감 포함 토글 감지
  useEffect(() => {
    setPage(1); setHasMore(true);
    loadEvents({ includeClosed, sortMode, pos: myPos, page: 1 });
  }, [includeClosed]);

  // 정렬 기준 변경 감지
  useEffect(() => {
    setPage(1); setHasMore(true);
    if (sortMode === "distance" && !myPos && !geoRequestedRef.current) {
      geoRequestedRef.current = true;
      fetchMyLocation(false, (p) => {
        loadEvents({ includeClosed, sortMode: "distance", pos: p, page: 1 });
      });
    } else {
      loadEvents({ includeClosed, sortMode, pos: myPos, page: 1 });
    }
  }, [sortMode]);

  // 내 위치 확보 후 거리 정렬 재요청
  useEffect(() => {
    if (sortMode === "distance" && myPos) {
      setPage(1); setHasMore(true);
      loadEvents({ includeClosed, sortMode: "distance", pos: myPos, page: 1 });
    }
  }, [myPos]);

  // 페이지 변경 시 데이터 로드 (무한 스크롤)
  useEffect(() => { if (page > 1) loadEvents({ page }); }, [page]);

  // 무한 스크롤 옵저버 설정
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loading && hasMore) setPage((prev) => prev + 1); },
      { threshold: 1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [loading, hasMore]);

  const goDetail = (id) => navigate(`/events/${id}`);

  const removeFromBookmarks = (id) => {
    navBlockRef.current = true;
    const ok = window.confirm("삭제하시겠습니까?");
    if (!ok) { setTimeout(() => (navBlockRef.current = false), 0); return; }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    window.alert("삭제가 완료되었습니다.");
    setTimeout(() => (navBlockRef.current = false), 0);
  };

  // 위치 가져오기
  const fetchMyLocation = (silent = false, onSuccessOnce) => {
    if (!navigator.geolocation) { if (!silent) setGeoError("이 브라우저에서는 위치를 지원하지 않습니다."); return; }
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => { const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setMyPos(p); onSuccessOnce && onSuccessOnce(p); },
      (err) => { if (!silent) setGeoError(err.code === err.PERMISSION_DENIED ? "위치 권한이 거부되었습니다." : "내 위치를 가져오지 못했습니다."); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  };

  /* =========================
     (C) 스크롤 잠금 / 높이 보정
     ========================= */

  // 지도 뷰에서 스크롤 잠금
  useEffect(() => {
    if (view === "map") {
      document.documentElement.classList.add("lock-scroll");
      document.body.classList.add("lock-scroll");
    } else {
      document.documentElement.classList.remove("lock-scroll");
      document.body.classList.remove("lock-scroll");
    }
    return () => {
      document.documentElement.classList.remove("lock-scroll");
      document.body.classList.remove("lock-scroll");
    };
  }, [view]);

  // 지도 뷰에서 토글/하단바 실측 → --map-offset 주입 + relayout
  useEffect(() => {
    if (view !== "map") return;

    const applyMapOffset = () => {
      const toggleEl = document.querySelector(".events-toggle");
      const bottomEl =
        document.querySelector(".bottom-bar") ||
        document.querySelector(".bottombar") ||
        document.querySelector(".BottomBar");

      const toggleH = toggleEl ? toggleEl.getBoundingClientRect().height : 0;
      const bottomH = bottomEl ? bottomEl.getBoundingClientRect().height : 0;
      const extra = 12;
      const offset = Math.round(toggleH + bottomH + extra);

      document.documentElement.style.setProperty("--map-offset", `${offset}px`);
      requestAnimationFrame(() => { window.kakao && mapInstanceRef.current?.relayout(); });
    };

    applyMapOffset();
    const onResize = () => applyMapOffset();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", () => {
      applyMapOffset();
      setTimeout(applyMapOffset, 240);
      setTimeout(applyMapOffset, 800);
    });

    const roTargets = [
      document.querySelector(".events-toggle"),
      document.querySelector(".bottom-bar") ||
        document.querySelector(".bottombar") ||
        document.querySelector(".BottomBar"),
    ].filter(Boolean);

    const ro = new ResizeObserver(() => applyMapOffset());
    roTargets.forEach((el) => ro.observe(el));

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      document.documentElement.style.removeProperty("--map-offset");
    };
  }, [view]);

  // 지도 진입 시 권한 한번만
  const requestGeoAtMapEnter = () => {
    if (geoRequestedRef.current) return;
    geoRequestedRef.current = true;

    const after = (p) => {
      if (sortMode === "distance") {
        loadEvents({ includeClosed, sortMode: "distance", pos: p, page: 1 });
      }
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (status.state === "granted") fetchMyLocation(true, after);
          else if (status.state === "prompt") fetchMyLocation(false, after);
        })
        .catch(() => fetchMyLocation(false, after));
    } else {
      fetchMyLocation(false, after);
    }
  };

  // list 전환 시 지도 cleanup
  useEffect(() => {
    if (view !== "list") return;
    sessionRef.current += 1;
    overlayRef.current?.setMap?.(null);
    overlayRef.current = null;
    const box = mapBoxRef.current;
    if (box) {
      box.innerHTML = "";
      box.style.display = "none";
      box.style.height = "0";
    }
  }, [view]);

  // map 전환/데이터 변경 시 지도 초기화
  useEffect(() => {
    if (view !== "map") return;

    requestGeoAtMapEnter();

    const mySession = ++sessionRef.current;
    const isAlive = () => sessionRef.current === mySession;

    const showBox = () => {
      const box = mapBoxRef.current;
      if (!box) return false;
      box.style.display = "block";
      box.style.height = "";
      box.innerHTML = "";
      box.style.touchAction = "pan-x pan-y";
      return true;
    };

    const initMap = () => {
      if (!isAlive()) return;
      const { kakao } = window;
      if (!kakao?.maps) return;

      const mapContainer = mapBoxRef.current;
      if (!mapContainer || !isAlive()) return;

      mapContainer.innerHTML = "";
      mapContainer.style.touchAction = "pan-x pan-y";

      // 파란점 CSS 주입
      injectMyPosCSS();

      const primary =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          ?.trim() || "#5E936C";

      const map = new kakao.maps.Map(mapContainer, {
        center: new kakao.maps.LatLng(37.5665, 126.978),
        level: 6,
      });
      mapInstanceRef.current = map;

      requestAnimationFrame(() => mapInstanceRef.current?.relayout());

      kakao.maps.event.addListener(map, "click", () => {
        overlayRef.current?.setMap(null);
        overlayRef.current = null;
      });

      const bounds = new kakao.maps.LatLngBounds();

      // 행사 마커
      events.forEach((ev) => {
        if (!isAlive()) return;
        if (typeof ev.lat !== "number" || typeof ev.lng !== "number") return;

        const pos = new kakao.maps.LatLng(ev.lat, ev.lng);
        bounds.extend(pos);

        const wrap = document.createElement("div");
        wrap.className = "km-pin-wrap";
        wrap.innerHTML = `
          <div class="km-pin" style="--pin:${primary};">
            <svg width="40" height="52" viewBox="0 0 40 52" aria-hidden="true">
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
          zIndex: 10,
          clickable: true,
        });
        marker.setMap(map);

        // 마커 클릭 → 인포윈도우
        wrap.querySelector(".km-pin")?.addEventListener("click", () => {
          if (!isAlive()) return;

          const content = document.createElement("div");
          content.className = "custom-infowindow";
          const feeText =
            typeof ev.fee === "string"
              ? ev.fee
              : ev.fee
              ? `${Number(ev.fee).toLocaleString()}원`
              : "무료";

          content.innerHTML = `
            <div class="inner">
              <div class="meta">
                <div class="title">${ev.title}</div>
                <div class="desc">${ev.location ?? ""}</div>
                <div class="sub">${ev.date} · ${ev.time ?? ""} · ${feeText}</div>
                <button class="outline-btn" type="button">상세보기</button>
              </div>
              <div class="arrow" aria-hidden="true"></div>
            </div>
          `;

          const btn = content.querySelector(".outline-btn");
          btn?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            kakao?.maps?.event?.preventMap?.(e);
            try { navigate(`/events/${ev.id}`); }
            catch { window.location.assign(`/events/${ev.id}`); }
          });

          overlayRef.current?.setMap(null);
          overlayRef.current = new kakao.maps.CustomOverlay({
            position: pos,
            content,
            yAnchor: 1.08,
            xAnchor: 0.5,
            zIndex: 10000,
            clickable: true,
          });
          overlayRef.current.setMap(map);
        });
      });

      const wantFocus = focusMyPosRef.current;

      // 내 위치 파란점(오버레이)
      if (myPos) {
        const pos = new kakao.maps.LatLng(myPos.lat, myPos.lng);

        const el = document.createElement("div");
        el.className = "mypos-marker";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", "내 위치");
        el.innerHTML = `<div class="pulse"></div><div class="dot"></div>`;

        const meOverlay = new kakao.maps.CustomOverlay({
          position: pos,
          content: el,
          xAnchor: 0.5,
          yAnchor: 0.48,
          zIndex: 10001,
          clickable: false
        });
        meOverlay.setMap(map);

        if (wantFocus) { map.setLevel(6); map.setCenter(pos); }
        else { bounds.extend(pos); }
      }

      if (!bounds.isEmpty() && !wantFocus) { map.setBounds(bounds); }
      focusMyPosRef.current = false;

      // 지도 우측 상단 컨트롤: 내 위치 버튼
      const ctrl = document.createElement("div");
      ctrl.style.position = "absolute";
      ctrl.style.top = "12px";
      ctrl.style.right = "12px";
      ctrl.style.zIndex = "10001";
      ctrl.innerHTML = `
        <button class="pill-btn" aria-label="내 위치 가져오기" style="padding:0 12px;">
          내 위치
        </button>
      `;
      mapContainer.appendChild(ctrl);
      const ctrlBtn = ctrl.querySelector("button");
      ctrlBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        focusMyPosRef.current = true;
        fetchMyLocation(false, (p) => {
          if (sortMode === "distance") {
            loadEvents({ includeClosed, sortMode: "distance", pos: p, page: 1 });
          }
          if (window.kakao?.maps && mapInstanceRef.current) {
            const latlng = new window.kakao.maps.LatLng(p.lat, p.lng);
            mapInstanceRef.current.setLevel(6);
            mapInstanceRef.current.setCenter(latlng);
          }
        });
      });
    };

    if (!showBox()) return;

    const boot = () => {
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => { if (!isAlive()) return; initMap(); });
      }
    };

    if (window.kakao?.maps) boot();
    else {
      const existed = document.querySelector('script[data-kakao-map="true"]');
      if (existed) {
        const onLoad = () => {
          if (!isAlive()) return;
          window.kakao?.maps?.load(() => { if (!isAlive()) return; initMap(); });
        };
        existed.addEventListener("load", onLoad, { once: true });
        return () => existed.removeEventListener("load", onLoad);
      } else {
        const script = document.createElement("script");
        script.setAttribute("data-kakao-map", "true");
        script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=cd740dc5ce8717cd9146f5c91861511a&autoload=false";
        script.async = true;
        script.onload = () => { window.kakao?.maps?.load(() => { initMap(); }); };
        document.head.appendChild(script);
      }
    }

    return () => {
      sessionRef.current += 1;
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      const box = mapBoxRef.current;
      if (box) {
        box.innerHTML = "";
        box.style.display = "none";
        box.style.height = "0";
      }
    };
  }, [view, events, myPos, sortMode, includeClosed]);

  return (
    <Layout>
      <div className={`events-page events-page--bookmarked is-under-topbar has-mobile-bottom-nav ${view === "map" ? "is-map" : ""}`}>
        <div className="events-toggle">
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`pill-btn ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>
              북마크 행사보기
            </button>
            <button className={`pill-btn ${view === "map" ? "active" : ""}`} onClick={() => setView("map")}>
              지도보기
            </button>
          </div>

          <div className="toggle-options">
            <label htmlFor="sortMode" className="sr-only">정렬</label>
            <select id="sortMode" className="pill-select" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="recent">최신순</option>
              <option value="distance">거리순</option>
            </select>

            <label
              htmlFor="toggleClosed"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}
              title="마감된 행사 포함/제외"
            >
              <input id="toggleClosed" type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} />
              <span>마감 포함</span>
            </label>
          </div>
        </div>

        {sortMode === "distance" && !myPos && (
          <div className="hint-bar" style={{ marginTop: 8, padding: "10px 12px", border: "1px dashed #ccc", borderRadius: 12, background: "rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span>거리순 정렬을 위해 내 위치가 필요합니다.</span>
              <button
                className="pill-btn"
                onClick={() => {
                  if (!geoRequestedRef.current) geoRequestedRef.current = true;
                  fetchMyLocation(false, (p) => loadEvents({ includeClosed, sortMode: "distance", pos: p, page: 1 }));
                }}
              >
                내 위치 가져오기
              </button>
            </div>
            {geoError && <div style={{ marginTop: 6, color: "#C62828" }}>{geoError}</div>}
          </div>
        )}

        {view === "list" && (
          <>
            <div className="events-grid">
              {events.length === 0 && !loading ? (
                <div className="events-empty" style={{ gridColumn: "1 / -1" }}>
                  <div className="emoji">📌</div>
                  <div className="title">표시할 행사가 없어요</div>
                  <div className="desc">필터 또는 정렬을 바꿔보세요.</div>
                </div>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (navBlockRef.current) { navBlockRef.current = false; return; }
                      goDetail(ev.id);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goDetail(ev.id); } }}
                    style={{ cursor: "pointer", outline: "none" }}
                    aria-label={`${ev.title} 상세보기`}
                  >
                    <EventCard
                      image={ev.image}
                      title={ev.title}
                      summary={ev.summary}
                      hashtags={ev.hashtags?.map((t) => `#${t}`)}
                      date={ev.date}
                      location={ev.location}
                      time={ev.time}
                      fee={ev.fee}
                      bookmarked={ev.bookmarked}
                      onBookmarkToggle={() => removeFromBookmarks(ev.id)}
                    />
                  </div>
                ))
              )}
            </div>
            {loading && <div className="events-empty" style={{ gridColumn: "1 / -1" }}>불러오는 중…</div>}
            <div ref={observerTarget} style={{ height: "1px" }} />
          </>
        )}

        <div
          id="map"
          ref={mapBoxRef}
          className="map-box"
          style={{
            display: view === "map" ? "block" : "none",
            height: view === "map" ? undefined : "0",
            pointerEvents: view === "map" ? "auto" : "none",
          }}
        />
      </div>

      {/* 브릿지 끔: Layout이 iPad에서 BottomBar를 직접 렌더함 */}
      {false && (
        <div className="tablet-bottom-bridge">
          <BottomBar />
        </div>
      )}
    </Layout>
  );
};

export default BookmarkedEvents;
