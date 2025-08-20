// src/pages/BookmarkedEvents.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import BottomBar from "../components/BottomBar";
import "../css/eventcard.css";
import "../css/bookmarkedevents.css";

/* ===============================
   ✅ API & Auth 유틸
   =============================== */
const EVENT_BASE = "https://gateway.gamja.cloud";
const ACTIVITY_BASE = "https://gateway.gamja.cloud";
const IMAGE_BASE = "https://gateway.gamja.cloud";
const PER_PAGE = 12;

function getAccessToken() {
  return (
    localStorage.getItem("Token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}
function getUserId() {
  const v = localStorage.getItem("userid") ?? localStorage.getItem("userId");
  return v ? Number(v) : null;
}
function authHeaders() {
  const token = getAccessToken();
  const uid = getUserId();
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "X-User-Id": uid ?? "",
  };
}

const eventApi = axios.create({ baseURL: EVENT_BASE });
const activityApi = axios.create({ baseURL: ACTIVITY_BASE });
const imageApi = axios.create({ baseURL: IMAGE_BASE });

/* DTO 내 이미지 id 키 유연 처리 */
function pickImageId(ev) {
  return (
    ev?.posterId ??
    ev?.imageId ??
    ev?.poster_id ??
    ev?.poster?.id ??
    null
  );
}

/* EventDTO → 화면 모델 매핑 (이미지 id만 보관) */
function mapEventDTO(ev) {
  const startDateStr = ev?.startTime ? new Date(ev.startTime).toISOString().slice(0, 10) : "";
  const endDateStr = ev?.endTime ? new Date(ev.endTime).toISOString().slice(0, 10) : "";
  const fee =
    typeof ev?.entryFee === "number"
      ? ev.entryFee === 0
        ? "무료"
        : `${Number(ev.entryFee).toLocaleString()}원`
      : "";

  return {
    id: ev.id,
    // 🔽 이미지 관련
    imageId: pickImageId(ev),   // ← 여기 저장
    image: "",                  // (하위 호환)
    imageUrl: "",               // blob object URL 채울 자리

    title: ev.name ?? `이벤트 #${ev.id}`,
    summary: ev.description ?? "",
    description: ev.description ?? "",
    hashtags: Array.isArray(ev.hashtags) ? ev.hashtags : [],
    date: startDateStr,
    time: "",
    location: ev.address ?? "",
    lat: typeof ev.latitude === "number" ? ev.latitude : undefined,
    lng: typeof ev.longitude === "number" ? ev.longitude : undefined,
    fee,
    endDate: endDateStr,
    ownerId: ev.organizerId,
    ownerName: "",
    ownerProfile: null,
    bookmarked: true,

    // 정렬용 키
    _start: ev?.startTime ? new Date(ev.startTime).getTime() : Number.POSITIVE_INFINITY,
    _end: ev?.endTime ? new Date(ev.endTime).getTime() : Number.NaN,
  };
}

// 거리 계산
const haversineKm = (a, b) => {
  if (!a || !b || typeof b.lat !== "number" || typeof b.lng !== "number") return Infinity;
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

// 마감 판정
const isClosed = (e) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = e.endDate ? new Date(e.endDate) : null;
  const start = e.date ? new Date(e.date) : null;
  if (end) { end.setHours(0, 0, 0, 0); return +end < +today; }
  if (start) { start.setHours(0, 0, 0, 0); return +start < +today; }
  return true; // 날짜 없으면 마감 취급
};

// 기존 브릿지 끔
const useTabletBridge = () => false;

const BookmarkedEvents = () => {
  /* ===============================
     상태
     =============================== */
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // 보기/범위/정렬
  const [view, setView] = useState("list");          // 'list' | 'map'
  const [scope, setScope] = useState("active");      // 'active' | 'closed'
  const [sortMode, setSortMode] = useState("recent");// 'recent' | 'distance'

  const [myPos, setMyPos] = useState(null);
  const [geoError, setGeoError] = useState("");

  const [bookmarkCount, setBookmarkCount] = useState(0);

  // 전체 캐시
  const allEventsRef = useRef([]);

  const tabletBridge = useTabletBridge();
  const navigate = useNavigate();
  const location = useLocation();
  const observerTarget = useRef(null);
  const loadingRef = useRef(false);

  // 지도 관련
  const overlayRef = useRef(null);
  const mapBoxRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const focusMyPosRef = useRef(false);
  const sessionRef = useRef(0);
  const navBlockRef = useRef(false);
  const geoRequestedRef = useRef(false);

  // 🔵 이미지 캐시 (imageId -> objectURL), 중복요청 방지, 정리용
  const imgUrlCacheRef = useRef(new Map());     // imageId -> objectURL
  const imgPendingRef = useRef(new Set());      // imageId 로딩 중
  const createdUrlsRef = useRef(new Set());     // revoke용

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

  /* ===============================
     (B) Event 서버 API
     =============================== */
  async function fetchBookmarksFromEventServer() {
    const headers = authHeaders();
    if (!headers.Authorization || !headers["X-User-Id"]) {
      navigate("/login");
      return [];
    }
    try {
      const res = await eventApi.get("/api/event/bookmarks", { headers });
      const arr = Array.isArray(res.data) ? res.data : [];
      const mapped = arr.map(mapEventDTO);
      setBookmarkCount(mapped.length);
      return mapped;
    } catch (err) {
      console.error("GET /api/event/bookmarks error:", err);
      if (axios.isAxiosError(err) && err.response?.status === 401) navigate("/login");
      setBookmarkCount(0);
      return [];
    }
  }

  // 이미지 조회: blob → objectURL (보안 헤더 필요하므로 fetch 사용)
  async function fetchImageObjectUrl(imageId) {
    if (!imageId) return "";

    // 캐시
    if (imgUrlCacheRef.current.has(imageId)) {
      return imgUrlCacheRef.current.get(imageId);
    }
    if (imgPendingRef.current.has(imageId)) {
      // 이미 로딩 중이면 잠깐 대기(간단 폴링)
      await new Promise((r) => setTimeout(r, 120));
      return imgUrlCacheRef.current.get(imageId) || "";
    }

    try {
      imgPendingRef.current.add(imageId);
      const headers = authHeaders();

      // axios로 blob 요청
      const res = await imageApi.get(`/api/image/${imageId}`, {
        headers,
        responseType: "blob",
      });

      const blob = res.data;
      if (!(blob instanceof Blob)) return "";

      const url = URL.createObjectURL(blob);
      imgUrlCacheRef.current.set(imageId, url);
      createdUrlsRef.current.add(url);
      return url;
    } catch (e) {
      console.error("GET /api/image/{id} error:", imageId, e);
      return "";
    } finally {
      imgPendingRef.current.delete(imageId);
    }
  }

  // 토글(낙관적 업데이트)
  async function toggleBookmarkOnServer(eventId) {
    const headers = authHeaders();
    try {
      await activityApi.post(
        "/api/activity/bookmark/toggle",
        { eventId: Number(eventId) },
        { headers }
      );
      return true;
    } catch (err) {
      console.error("POST /api/activity/bookmark/toggle error:", err);
      return false;
    }
  }

  /* ===============================
     (C) 정렬/필터/페이지 적용
     =============================== */
  const applySortAndFilter = (list, opts = {}) => {
    const s = opts.scope ?? scope;
    const sort = opts.sortMode ?? sortMode;
    const pos = opts.pos ?? myPos;

    // 1) 범위 필터
    let data =
      s === "closed"
        ? list.filter((e) => isClosed(e))
        : list.filter((e) => !isClosed(e));

    // 2) 정렬
    if (sort === "distance" && pos) {
      data.sort((a, b) => {
        const da = haversineKm(pos, { lat: a.lat, lng: a.lng });
        const db = haversineKm(pos, { lat: b.lat, lng: b.lng });
        return da - db;
      });
    } else if (sort === "recent") {
      if (s === "closed") {
        // 최근 마감순 (endTime 없으면 startTime 사용)
        data.sort((a, b) => {
          const ae = a._end ?? Number.NaN;
          const be = b._end ?? Number.NaN;
          const aKey = Number.isNaN(ae) ? a._start : ae;
          const bKey = Number.isNaN(be) ? b._start : be;
          return bKey - aKey; // 내림차순
        });
      } else {
        // 다가오는 순 (오름차순)
        data.sort((a, b) => (a._start ?? Infinity) - (b._start ?? Infinity));
      }
    }

    return data;
  };

  const slicePage = (list, pageNum) => {
    const startIndex = (pageNum - 1) * PER_PAGE;
    const pageData = list.slice(startIndex, startIndex + PER_PAGE);
    const more = startIndex + PER_PAGE < list.length;
    return { pageData, more };
  };

  async function loadEvents(opts = {}) {
    const currentPage = opts.page ?? 1;
    if (loadingRef.current && currentPage > 1) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      if (currentPage === 1) {
        const serverList = await fetchBookmarksFromEventServer();
        allEventsRef.current = serverList;
      }

      const sorted = applySortAndFilter(allEventsRef.current, opts);
      const { pageData, more } = slicePage(sorted, currentPage);

      if (currentPage === 1) setEvents(pageData);
      else setEvents((prev) => [...prev, ...pageData]);

      setHasMore(more);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  /* ===============================
     (D) 초기 로드 & 반응
     =============================== */
  useEffect(() => { loadEvents({ scope, sortMode, pos: myPos, page: 1 }); }, []);

  // 탭(진행중/마감) 전환
  useEffect(() => {
    setPage(1); setHasMore(true);
    loadEvents({ scope, sortMode, pos: myPos, page: 1 });
  }, [scope]);

  // 정렬 변경
  useEffect(() => {
    setPage(1); setHasMore(true);
    if (sortMode === "distance" && !myPos && !geoRequestedRef.current) {
      geoRequestedRef.current = true;
      fetchMyLocation(false, (p) => {
        loadEvents({ scope, sortMode: "distance", pos: p, page: 1 });
      });
    } else {
      loadEvents({ scope, sortMode, pos: myPos, page: 1 });
    }
  }, [sortMode]);

  // 내 위치 확보 후 거리 정렬 재요청
  useEffect(() => {
    if (sortMode === "distance" && myPos) {
      setPage(1); setHasMore(true);
      loadEvents({ scope, sortMode: "distance", pos: myPos, page: 1 });
    }
  }, [myPos]);

  // 무한 스크롤
  useEffect(() => { if (page > 1) loadEvents({ page, scope, sortMode, pos: myPos }); }, [page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loading && hasMore) setPage((prev) => prev + 1); },
      { threshold: 1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [loading, hasMore]);

  const goDetail = (id) => navigate(`/events/${id}`);

  const removeFromBookmarks = async (id) => {
    navBlockRef.current = true;
    const ok = window.confirm("해당 행사를 북마크에서 해제하시겠습니까?");
    if (!ok) { setTimeout(() => (navBlockRef.current = false), 0); return; }

    // 낙관적 업데이트
    setEvents((prev) => prev.filter((e) => e.id !== id));
    allEventsRef.current = allEventsRef.current.filter((e) => e.id !== id);
    setBookmarkCount((c) => Math.max(0, c - 1));

    const success = await toggleBookmarkOnServer(id);
    if (!success) {
      await loadEvents({ page: 1, scope, sortMode, pos: myPos });
      window.alert("해제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
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

  /* ===============================
     (E) 이미지 로딩 훅
     - 화면에 올라온 이벤트들 중 imageId가 있고 imageUrl이 비어있으면 blob으로 수신
     =============================== */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const targets = events.filter((e) => e.imageId && !e.imageUrl);
      if (targets.length === 0) return;

      for (const ev of targets) {
        const url = await fetchImageObjectUrl(ev.imageId);
        if (cancelled) return;
        if (!url) continue;

        // 해당 ev.id에만 url 주입 (불필요한 리렌더 최소화)
        setEvents((prev) =>
          prev.map((x) => (x.id === ev.id && !x.imageUrl ? { ...x, imageUrl: url } : x))
        );
      }
    })();

    return () => { cancelled = true; };
  }, [events]);

  // 언마운트 시 blob URL 정리
  useEffect(() => {
    return () => {
      for (const url of createdUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      createdUrlsRef.current.clear();
      imgUrlCacheRef.current.clear();
      imgPendingRef.current.clear();
    };
  }, []);

  /* =========================
     (F) 지도 관련 (기존 코드 유지)
     ========================= */

  // 내 위치 파란점 CSS
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

  // 지도 뷰에서 토글/하단바 높이 반영
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

  // 지도 들어갈 때 한 번만 위치 요청
  const requestGeoAtMapEnter = () => {
    if (geoRequestedRef.current) return;
    geoRequestedRef.current = true;

    const after = (p) => {
      if (sortMode === "distance") {
        loadEvents({ scope, sortMode: "distance", pos: p, page: 1 });
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
          const feeText = ev.fee || "무료";

          content.innerHTML = `
            <div class="inner">
              <div class="meta">
                <div class="title">${ev.title}</div>
                <div class="desc">${ev.location ?? ""}</div>
                <div class="sub">${ev.date ?? ""}${ev.time ? " · " + ev.time : ""}${feeText ? " · " + feeText : ""}</div>
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

      // 내 위치 파란점
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

      // 우측 상단 위치 버튼
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
            loadEvents({ scope, sortMode: "distance", pos: p, page: 1 });
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
        script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=084b4a076cd976847f592a5fea5ea24d&autoload=false";
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
  }, [view, events, myPos, sortMode, scope]);

  /* ===============================
     (G) 렌더
     =============================== */
  return (
    <Layout>
      <div className={`events-page events-page--bookmarked is-under-topbar has-mobile-bottom-nav ${view === "map" ? "is-map" : ""}`}>
        <div className="events-toggle">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* 기존 패턴 유지: 북마크 보기 / 지도보기 */}
            <button
              className={`pill-btn ${view === "list" && scope === "active" ? "active" : ""}`}
              onClick={() => { setScope("active"); setView("list"); }}
            >
              북마크 행사보기
            </button>

            {/* 마감된 행사만 보기 */}
            <button
              className={`pill-btn ${view === "list" && scope === "closed" ? "active" : ""}`}
              onClick={() => { setScope("closed"); setView("list"); }}
            >
              마감된 행사
            </button>

            <button
              className={`pill-btn ${view === "map" ? "active" : ""}`}
              onClick={() => setView("map")}
              title="지도보기"
            >
              지도보기
            </button>
          </div>

          <div className="toggle-options" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="pill-badge" title="북마크 개수">북마크 {bookmarkCount}개</div>

            <label htmlFor="sortMode" className="sr-only">정렬</label>
            <select
              id="sortMode"
              className="pill-select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
            >
              <option value="recent">
                {scope === "closed" ? "최근 마감순" : "다가오는 순"}
              </option>
              <option value="distance">거리순</option>
            </select>
          </div>
        </div>

        {/* 거리순 힌트 */}
        {sortMode === "distance" && !myPos && (
          <div className="hint-bar" style={{ marginTop: 8, padding: "10px 12px", border: "1px dashed #ccc", borderRadius: 12, background: "rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span>거리순 정렬을 위해 내 위치가 필요합니다.</span>
              <button
                className="pill-btn"
                onClick={() => {
                  if (!geoRequestedRef.current) geoRequestedRef.current = true;
                  fetchMyLocation(false, (p) => loadEvents({ scope, sortMode: "distance", pos: p, page: 1 }));
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
                  <div className="desc">
                    {scope === "closed" ? "마감된 행사가 없어요." : "다가오는 북마크 행사가 없어요."}
                  </div>
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
                      image={ev.imageUrl || ev.image}  // ← blob URL 우선 사용
                      title={ev.title}
                      summary={ev.summary}
                      hashtags={Array.isArray(ev.hashtags) ? ev.hashtags.map((t) => ("" + t).startsWith("#") ? t : `#${t}`) : []}
                      date={ev.date}
                      location={ev.location}
                      time={ev.time}
                      fee={ev.fee}
                      bookmarked={true}
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
