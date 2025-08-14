// BookmarkedEvents.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/eventcard.css";
import "../css/bookmark-joined.css";

// --------- 더미 데이터 (백엔드 없을 때만 사용) ----------
const DUMMY = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  image: "",
  imageUrl: "",
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
// -------------------------------------------------------

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

const BookmarkedEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState("list"); // 'list' | 'map'
  const [sortMode, setSortMode] = useState("recent"); // 'recent' | 'distance'
  const [includeClosed, setIncludeClosed] = useState(false);

  const [myPos, setMyPos] = useState(null); // {lat, lng}
  const [geoError, setGeoError] = useState("");

  const navigate = useNavigate();

  // 지도 관련 ref들
  const overlayRef = useRef(null);
  const mapBoxRef = useRef(null);
  const mapInstanceRef = useRef(null);   // 현재 지도 인스턴스
  const focusMyPosRef = useRef(false);   // 내 위치로 포커스 여부(버튼 눌렀을 때 true)
  const sessionRef = useRef(0);
  const navBlockRef = useRef(false);
  const geoRequestedRef = useRef(false); // 지도 진입 시 권한요청 1회 가드

  // 내 위치 마커 CSS 1회 주입
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

  // 인포윈도우(커스텀 오버레이) CSS 1회 주입
  const infoCssInjectedRef = useRef(false);
  const injectInfoCSS = () => {
    if (infoCssInjectedRef.current) return;
    const style = document.createElement("style");
    style.id = "infowindow-style";
    style.textContent = `
      .custom-infowindow{
        position:relative;
        max-width: 280px;
        background: var(--card, #fff);
        color: var(--fg, #111);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,.18);
        padding: 12px 12px 12px 12px;
        touch-action: auto;
      }
      .custom-infowindow::after{
        content:"";
        position:absolute; left:24px; bottom:-10px;
        width: 0; height: 0;
        border-left:10px solid transparent;
        border-right:10px solid transparent;
        border-top:10px solid var(--card, #fff);
        filter: drop-shadow(0 -1px 0 rgba(0,0,0,.05));
      }
      .custom-infowindow .title{
        font-weight: 700; line-height: 1.3; margin-bottom: 4px;
      }
      .custom-infowindow .desc{
        font-size: .9rem; color: #666; margin-bottom: 2px;
      }
      .custom-infowindow .sub{
        font-size: .85rem; color: #888; margin-bottom: 10px;
      }
      .custom-infowindow .outline-btn{
        padding: 6px 10px;
        border:1px solid #ddd; border-radius: 999px;
        background: transparent; cursor: pointer;
      }
      @media (max-width:640px){
        .custom-infowindow{max-width: 84vw;}
      }
    `;
    document.head.appendChild(style);
    infoCssInjectedRef.current = true;
  };

  // 서버에서 가져오기 (정렬/마감 포함/거리 정렬 시 좌표 전달)
  const loadEvents = async (opts = {}) => {
    const flag = opts.includeClosed ?? includeClosed;
    const sort = opts.sortMode ?? sortMode;
    const pos = opts.pos ?? myPos;

    setLoading(true);
    try {
      // 실제 API로 교체:
      // const qs = new URLSearchParams({
      //   includeClosed: flag ? "1" : "0",
      //   sort,
      //   ...(sort === "distance" && pos ? { lat: pos.lat, lng: pos.lng } : {}),
      // });
      // const res = await fetch(`/api/bookmarks?${qs}`, { credentials: "include" });
      // if (!res.ok) throw new Error("failed");
      // const data = await res.json();

      // 백엔드 없을 때는 더미 + 클라이언트 정렬 흉내
      let data = [...(flag ? DUMMY : DUMMY.filter((e) => {
        const end = new Date(e.endDate || e.date); end.setHours(0,0,0,0);
        const today = new Date(); today.setHours(0,0,0,0);
        return +end >= +today;
      }))];

      if (sort === "distance" && pos) {
        data = data
          .map((e) => ({
            ...e,
            _distanceKm:
              typeof e.lat === "number" && typeof e.lng === "number"
                ? haversineKm(pos, { lat: e.lat, lng: e.lng })
                : Infinity,
          }))
          .sort((a, b) => (a._distanceKm ?? Infinity) - (b._distanceKm ?? Infinity));
      } else if (sort === "recent") {
        data.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      setEvents(data);
    } catch (e) {
      console.error(e);
      setEvents(flag ? DUMMY : DUMMY.filter((e) => {
        const end = new Date(e.endDate || e.date); end.setHours(0,0,0,0);
        const today = new Date(); today.setHours(0,0,0,0);
        return +end >= +today;
      }));
    } finally {
      setLoading(false);
    }
  };

  // 최초 로드
  useEffect(() => {
    loadEvents({ includeClosed, sortMode, pos: myPos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마감 포함 토글 바뀔 때마다 재요청
  useEffect(() => {
    loadEvents({ includeClosed, sortMode, pos: myPos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeClosed]);

  // 정렬 기준 바뀔 때마다 재요청 (+ 거리순이면 좌표 필요 시 1회 권한 팝업)
  useEffect(() => {
    if (sortMode === "distance" && !myPos && !geoRequestedRef.current) {
      geoRequestedRef.current = true;
      fetchMyLocation(false, (p) => {
        loadEvents({ includeClosed, sortMode: "distance", pos: p });
      });
    } else {
      loadEvents({ includeClosed, sortMode, pos: myPos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode]);

  // myPos 확보되면 거리 정렬일 때 한 번 더 서버 재요청
  useEffect(() => {
    if (sortMode === "distance" && myPos) {
      loadEvents({ includeClosed, sortMode: "distance", pos: myPos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPos]);

  // 북마크만
  const bookmarkedOnly = useMemo(() => events.filter((e) => e.bookmarked), [events]);

  // 클라측 방어 정렬
  const displayedEvents = useMemo(() => {
    const arr = [...bookmarkedOnly];
    if (sortMode === "distance" && typeof arr[0]?._distanceKm === "number") {
      arr.sort((a, b) => (a._distanceKm ?? Infinity) - (b._distanceKm ?? Infinity));
    } else if (sortMode === "recent") {
      arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return arr;
  }, [bookmarkedOnly, sortMode]);

  const goDetail = (id) => navigate(`/events/${id}`);

  const removeFromBookmarks = (id) => {
    navBlockRef.current = true;
    const ok = window.confirm("삭제하시겠습니까?");
    if (!ok) {
      setTimeout(() => (navBlockRef.current = false), 0);
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, bookmarked: false } : e)));
    window.alert("삭제가 완료되었습니다.");
    setTimeout(() => (navBlockRef.current = false), 0);
  };

  // 위치 가져오기
  const fetchMyLocation = (silent = false, onSuccessOnce) => {
    if (!navigator.geolocation) {
      if (!silent) setGeoError("이 브라우저에서는 위치를 지원하지 않습니다.");
      return;
    }
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPos(p);
        onSuccessOnce && onSuccessOnce(p);
      },
      (err) => {
        if (!silent) {
          setGeoError(
            err.code === err.PERMISSION_DENIED
              ? "위치 권한이 거부되었습니다."
              : "내 위치를 가져오지 못했습니다."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  };

  // 지도 들어갈 때 권한 한번만 시도 (Permissions API)
  const requestGeoAtMapEnter = () => {
    if (geoRequestedRef.current) return;
    geoRequestedRef.current = true;

    const after = (p) => {
      if (sortMode === "distance") {
        loadEvents({ includeClosed, sortMode: "distance", pos: p });
      }
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (status.state === "granted") {
            fetchMyLocation(true, after);
          } else if (status.state === "prompt") {
            fetchMyLocation(false, after);
          } else {
            // denied → 우상단 버튼으로 재시도 가능
          }
        })
        .catch(() => fetchMyLocation(false, after));
    } else {
      fetchMyLocation(false, after);
    }
  };

  // list 전환 시 지도 흔적 제거
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

    // 권한 1회 시도
    requestGeoAtMapEnter();

    const mySession = ++sessionRef.current;
    const isAlive = () => sessionRef.current === mySession;

    const showBox = () => {
      const box = mapBoxRef.current;
      if (!box) return false;
      box.style.display = "block";
      box.style.height = "";
      box.innerHTML = "";
      return true;
    };

    const initMap = () => {
      if (!isAlive()) return;
      const { kakao } = window;
      if (!kakao?.maps) return;

      const container = mapBoxRef.current;
      if (!container || !isAlive()) return;

      container.innerHTML = "";
      injectMyPosCSS();
      injectInfoCSS();

      const primary =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          ?.trim() || "#5E936C";

      const map = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(37.5665, 126.978),
        level: 6,
      });
      mapInstanceRef.current = map;

      kakao.maps.event.addListener(map, "click", () => {
        overlayRef.current?.setMap(null);
        overlayRef.current = null;
      });

      const bounds = new kakao.maps.LatLngBounds();

      // 행사 마커
      displayedEvents.forEach((ev) => {
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
        });
        marker.setMap(map);

        // 🔔 마커 클릭 → 인포윈도우(커스텀 오버레이) 오픈
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
            <div class="meta">
              <div class="title">${ev.title}</div>
              <div class="desc">${ev.location ?? ""}</div>
              <div class="sub">${ev.date} · ${ev.time ?? ""} · ${feeText}</div>
              <button class="outline-btn" type="button">상세보기</button>
            </div>
          `;

          // 지도 제스처와 버블링 차단
          const block = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.kakao?.maps?.event?.preventMap?.(e);
          };
          ["click","mousedown","mouseup","touchstart","touchend"].forEach((t) => {
            content.addEventListener(t, block);
          });

          // 상세보기 버튼 → SPA 네비
          content.querySelector(".outline-btn")?.addEventListener("click", (e) => {
            block(e);
            try {
              navigate(`/events/${ev.id}`);
            } catch {
              window.location.assign(`/events/${ev.id}`);
            }
          });

          // 기존 오버레이 닫고 새로 열기
          overlayRef.current?.setMap(null);
          overlayRef.current = new window.kakao.maps.CustomOverlay({
            position: pos,
            content,
            yAnchor: 1.47, // 말풍선 꼬리 보정(상단 배치)
            xAnchor: 0.29,
            zIndex: 10000,
            clickable: false,
          });
          overlayRef.current.setMap(map);
        });
      });

      // --- 내 위치 렌더 & 뷰 결정 ---
      const wantFocus = focusMyPosRef.current;

      if (myPos) {
        const pos = new kakao.maps.LatLng(myPos.lat, myPos.lng);

        // dot + pulse 오버레이
        const el = document.createElement("div");
        el.className = "mypos-marker";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", "내 위치");
        el.innerHTML = `<div class="pulse"></div><div class="dot"></div>`;

        const meOverlay = new kakao.maps.CustomOverlay({
          position: pos,
          content: el,
          xAnchor: 0.5,
          yAnchor: 0.48, // ★ 중심 보정
          zIndex: 10001,
        });
        meOverlay.setMap(map);

        if (wantFocus) {
          map.setLevel(6);
          map.setCenter(pos);
        } else {
          bounds.extend(pos);
        }
      }

      if (!bounds.isEmpty() && !wantFocus) {
        map.setBounds(bounds);
      }

      // 한 번 쓰고 끄기
      focusMyPosRef.current = false;

      // 지도 우측 상단 컨트롤: 내 위치 버튼(수동 재시도 + 즉시 포커스)
      const ctrl = document.createElement("div");
      ctrl.style.position = "absolute";
      ctrl.style.top = "12px";
      ctrl.style.right = "12px";
      ctrl.style.zIndex = "10001";
      ctrl.innerHTML = `
        <button class="pill-btn" aria-label="내 위치 가져오기" style="padding:8px 12px;border-radius:20px;">
          내 위치
        </button>
      `;
      container.appendChild(ctrl);
      const ctrlBtn = ctrl.querySelector("button");
      ctrlBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        focusMyPosRef.current = true; // 이번에는 내 위치로 포커스
        fetchMyLocation(false, (p) => {
          // 거리순이면 서버 데이터도 갱신
          if (sortMode === "distance") {
            loadEvents({ includeClosed, sortMode: "distance", pos: p });
          }
          // 지도 즉시 센터 이동(UX 보강)
          if (window.kakao?.maps && mapInstanceRef.current) {
            const latlng = new window.kakao.maps.LatLng(p.lat, p.lng);
            mapInstanceRef.current.setLevel(6);
            mapInstanceRef.current.setCenter(latlng);
          }
        });
      });
    };

    if (!showBox()) return;

    // SDK 로딩 후 init
    const boot = () => {
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => {
          if (!isAlive()) return;
          initMap();
        });
      }
    };

    if (window.kakao?.maps) {
      boot();
    } else {
      // 이미 로딩 중인 스크립트가 있으면 그 onload에 연결
      const existed = document.querySelector('script[data-kakao-map="true"]');
      if (existed) {
        const onLoad = () => {
          if (!isAlive()) return;
          window.kakao?.maps?.load(() => {
            if (!isAlive()) return;
            initMap();
          });
        };
        existed.addEventListener("load", onLoad, { once: true });
        return () => existed.removeEventListener("load", onLoad);
      } else {
        // 새로 삽입
        const script = document.createElement("script");
        script.setAttribute("data-kakao-map", "true");
        script.src =
          "https://dapi.kakao.com/v2/maps/sdk.js?appkey=cd740dc5ce8717cd9146f5c91861511a&autoload=false";
        script.async = true;
        script.onload = () => {
          window.kakao?.maps?.load(() => {
            if (!isAlive()) return;
            initMap();
          });
        };
        document.head.appendChild(script);
      }
    }

    // cleanup
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
  }, [view, displayedEvents, myPos, sortMode, includeClosed]); // deps OK

  return (
    <Layout>
      <div className="events-page is-under-topbar">
        {/* 상단 토글 + 우측 정렬/마감 포함 */}
        <div
          className="events-toggle"
          style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}
        >
          <div style={{ display: "flex", gap: 8 }}>
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

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label htmlFor="sortMode" className="sr-only">정렬</label>
            <select
              id="sortMode"
              className="pill-select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)} // 바뀌면 useEffect에서 서버 재요청
              style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #ddd", background: "var(--card)" }}
            >
              <option value="recent">최신순</option>
              <option value="distance">거리순</option>
            </select>

            {/* 마감 포함: 온오프 시마다 서버 재요청 */}
            <label
              htmlFor="toggleClosed"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}
              title="마감된 행사 포함/제외 (변경 시 새로 불러옵니다)"
            >
              <input
                id="toggleClosed"
                type="checkbox"
                checked={includeClosed}
                onChange={(e) => setIncludeClosed(e.target.checked)}
              />
              <span>마감 포함</span>
            </label>
          </div>
        </div>

        {/* 거리순 안내/버튼 (리스트에서 필요 시) */}
        {sortMode === "distance" && !myPos && (
          <div
            className="hint-bar"
            style={{
              marginTop: 8,
              padding: "10px 12px",
              border: "1px dashed #ccc",
              borderRadius: 12,
              background: "rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span>거리순 정렬을 위해 내 위치가 필요합니다.</span>
              <button
                className="pill-btn"
                onClick={() => {
                  if (!geoRequestedRef.current) geoRequestedRef.current = true;
                  fetchMyLocation(false, (p) =>
                    loadEvents({ includeClosed, sortMode: "distance", pos: p })
                  );
                }}
              >
                내 위치 가져오기
              </button>
            </div>
            {geoError && (
              <div style={{ marginTop: 6, color: "#C62828" }}>{geoError}</div>
            )}
          </div>
        )}

        {/* 리스트 */}
        {view === "list" && (
          <div className="events-grid">
            {loading ? (
              <div className="events-empty">
                <div className="title">불러오는 중…</div>
              </div>
            ) : displayedEvents.length === 0 ? (
              <div className="events-empty">
                <div className="emoji">📌</div>
                <div className="title">표시할 행사가 없어요</div>
                <div className="desc">필터 또는 정렬을 바꿔보세요.</div>
              </div>
            ) : (
              displayedEvents.map((ev) => (
                <div
                  key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (navBlockRef.current) {
                      navBlockRef.current = false;
                      return;
                    }
                    goDetail(ev.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goDetail(ev.id);
                    }
                  }}
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
                    // extraRight={typeof ev._distanceKm === "number" ? `${ev._distanceKm.toFixed(1)}km` : undefined}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* 지도 */}
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
    </Layout>
  );
};

export default BookmarkedEvents;
