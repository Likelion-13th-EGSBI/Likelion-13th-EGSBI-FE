// src/pages/LocationSettings.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import Layout from "../components/Layout";
import BottomBar from "../components/BottomBar";
import "../css/location-settings.css";

const KAKAO_SDK_URL =
  "https://dapi.kakao.com/v2/maps/sdk.js?appkey=cd740dc5ce8717cd9146f5c91861511a&autoload=false&libraries=services";

const kakaoLoadError = { msg: null };

/** Kakao SDK 로더 (싱글톤) */
function loadKakaoOnce(timeoutMs = 12000) {
  if (window.kakao?.maps) return Promise.resolve(window.kakao);
  if (window.__kakaoLoadPromise) return window.__kakaoLoadPromise;

  window.__kakaoLoadPromise = new Promise((resolve, reject) => {
    let timedOut = false;
    let retried = false;

    const done = () => {
      try {
        if (!window.kakao || !window.kakao.maps) {
          kakaoLoadError.msg = "kakao.maps 미초기화";
          return reject(new Error(kakaoLoadError.msg));
        }
        window.kakao.maps.load(() => {
          clearTimeout(timer);
          resolve(window.kakao);
        });
      } catch (err) {
        clearTimeout(timer);
        kakaoLoadError.msg = "kakao.maps.load 중 예외";
        reject(err);
      }
    };

    const attachLoader = (scriptEl) => {
      const onReady = () => {
        if (timedOut) return;
        scriptEl.setAttribute("data-loaded", "1");
        done();
      };
      scriptEl.onload = onReady;
      scriptEl.onreadystatechange = () => {
        const rs = scriptEl.readyState;
        if (rs === "loaded" || rs === "complete") onReady();
      };
      scriptEl.onerror = (e) => {
        if (timedOut) return;
        if (!retried) {
          retried = true;
          scriptEl.remove();
          const retry = document.createElement("script");
          retry.dataset.kakao = "sdk";
          retry.src = KAKAO_SDK_URL;
          retry.async = true;
          retry.type = "text/javascript";
          attachLoader(retry);
          document.head.appendChild(retry);
        } else {
          clearTimeout(timer);
          kakaoLoadError.msg = "지도 SDK 스크립트 로드 실패";
          reject(e);
        }
      };
    };

    const timer = setTimeout(() => {
      timedOut = true;
      kakaoLoadError.msg = "지도 SDK 로딩 시간 초과";
      reject(new Error(kakaoLoadError.msg));
    }, timeoutMs);

    let script = document.querySelector('script[data-kakao="sdk"]');
    if (!script) {
      script = document.createElement("script");
      script.dataset.kakao = "sdk";
      script.src = KAKAO_SDK_URL;
      script.async = true;
      script.type = "text/javascript";
      attachLoader(script);
      document.head.appendChild(script);
    } else {
      attachLoader(script);
      if (script.getAttribute("data-loaded") === "1" && window.kakao?.maps) {
        done();
      }
    }
  });

  return window.__kakaoLoadPromise;
}

/** CSS 변수 --primary 읽기 */
function getPrimaryHex() {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  return v || "#5E936C";
}

/** 핀 SVG dataURL (외곽선+중앙점, 메인컬러) */
function makePinDataUrl(hex) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="44" viewBox="0 0 40 44">
      <path d="M20 2C10.06 2 2 10.06 2 20.0c0 12.2 14.9 20.9 17.6 22.4a1.5 1.5 0 0 0 1.6 0C23.9 40.9 38 32.2 38 20.0 38 10.06 29.94 2 20 2z"
            fill="${hex}" stroke="white" stroke-width="2" />
      <circle cx="20" cy="20" r="5.5" fill="white"/>
      <circle cx="20" cy="20" r="3.5" fill="${hex}"/>
    </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/** 문자열 정규화 (중복 체크용) */
function norm(s = "") {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

const LocationSettings = () => {
  // refs
  const mapBoxRef = useRef(null);
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);

  const myMarkerRef = useRef(null);       // 내 위치(파란 펄스, CustomOverlay)
  const searchMarkerRef = useRef(null);   // 선택/검색 마커(핀, draggable)
  const circlesRef = useRef([]);

  // 상태
  const [loadingMap, setLoadingMap] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [query, setQuery] = useState("");
  const [suggests, setSuggests] = useState([]);
  const [showSuggests, setShowSuggests] = useState(false);
  const suggestBoxRef = useRef(null);

  const [selectedAreas, setSelectedAreas] = useState([]); // [{name,address,lat,lng,key}]
  const [pendingArea, setPendingArea] = useState(null);   // {name,address,lat,lng}

  // 콜백 ref로 "컨테이너 준비" 상태 추적
  const [mapHostReady, setMapHostReady] = useState(false);
  const setMapBoxEl = useCallback((el) => {
    mapBoxRef.current = el;
    setMapHostReady(!!el);
  }, []);

  // 지도 생성 보장 (컨테이너가 준비된 뒤에만)
  const ensureMap = useCallback(
    async (center) => {
      if (!mapHostReady) {
        // 컨테이너가 아직 없음: 초기 호출을 무시 (오류 던지지 않음)
        return null;
      }
      if (mapRef.current) {
        if (center && window.kakao) {
          const ll = new window.kakao.maps.LatLng(center.lat, center.lng);
          mapRef.current.setCenter(ll);
          requestAnimationFrame(() => mapRef.current?.relayout());
        }
        return mapRef.current;
      }

      setLoadingMap(true);
      setLoadError(null);
      try {
        const kakao = await loadKakaoOnce();

        const box = mapBoxRef.current;
        if (!box) {
          // 극히 드물게 ref가 사라진 경우 다시 시도
          setLoadingMap(false);
          return null;
        }

        if (box.getBoundingClientRect().height < 40) {
          box.style.minHeight = "420px";
          await new Promise((r) => requestAnimationFrame(r));
        }

        const map = new kakao.maps.Map(box, {
          center: new kakao.maps.LatLng(
            center?.lat ?? 37.5662952, // 서울시청
            center?.lng ?? 126.9779451
          ),
          level: 5,
        });
        mapRef.current = map;

        geocoderRef.current = new kakao.maps.services.Geocoder();

        // 지도 클릭 → 마커 이동 + 역지오코딩 + pending 업데이트
        kakao.maps.event.addListener(map, "click", (mouseEvent) => {
          const ll = mouseEvent.latLng;
          ensureSearchMarker(ll);
          reverseGeocodeToPending(ll.getLat(), ll.getLng());
          map.setCenter(ll);
        });

        requestAnimationFrame(() => map?.relayout());
        setLoadingMap(false);
        return map;
      } catch (e) {
        console.error("[ensureMap] 실패:", e, kakaoLoadError.msg);
        setLoadError(kakaoLoadError.msg || "지도 로딩 실패");
        setLoadingMap(false);
        return null;
      }
    },
    [mapHostReady]
  );

  // 컨테이너가 준비되면 최초 1회 지도 초기화
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mapHostReady && !mapRef.current) {
        await ensureMap();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mapHostReady, ensureMap]);

  /** 검색/클릭용 ‘핀’ 마커 보장 + 이동 (draggable) */
  const ensureSearchMarker = (latLng) => {
    const kakao = window.kakao;
    if (!kakao || !mapRef.current) return;

    const primary = getPrimaryHex();
    const image = new kakao.maps.MarkerImage(
      makePinDataUrl(primary),
      new kakao.maps.Size(40, 44),
      { offset: new kakao.maps.Point(20, 44) }
    );

    if (!searchMarkerRef.current) {
      searchMarkerRef.current = new kakao.maps.Marker({
        position: latLng,
        image,
        draggable: true,
        zIndex: 10,
      });
      searchMarkerRef.current.setMap(mapRef.current);

      // 드래그 종료 시 역지오코딩 → pendingArea 갱신
      kakao.maps.event.addListener(searchMarkerRef.current, "dragend", () => {
        const pos = searchMarkerRef.current.getPosition();
        reverseGeocodeToPending(pos.getLat(), pos.getLng());
      });
    } else {
      searchMarkerRef.current.setImage(image);   // 최신 primary 반영
      searchMarkerRef.current.setPosition(latLng);
    }
  };

  /** 좌표 → 주소로 pendingArea 갱신 */
  const reverseGeocodeToPending = (lat, lng) => {
    const kakao = window.kakao;
    if (!kakao || !geocoderRef.current) return;
    geocoderRef.current.coord2Address(
      lng, lat,
      (data, status) => {
        if (status === kakao.maps.services.Status.OK && data && data[0]) {
          const addr =
            data[0].road_address?.address_name || data[0].address?.address_name || "";
          const name =
            data[0].road_address?.region_3depth_name ||
            data[0].address?.region_3depth_name ||
            addr;
          setPendingArea({ name, address: addr, lat, lng });
        }
      }
    );
  };

  /** 내 위치 (파란 펄스) */
  const getCurrent = () => {
    if (!navigator.geolocation) {
      alert("브라우저가 위치 정보를 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const map = await ensureMap(p);
        if (!map || !window.kakao) return;

        const ll = new window.kakao.maps.LatLng(p.lat, p.lng);
        map.setCenter(ll);
        map.setLevel(6);

        // 파란 펄스 CustomOverlay (정중앙 앵커)
        myMarkerRef.current?.setMap?.(null);
        const el = document.createElement("div");
        el.className = "mypos-marker";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", "내 위치");
        el.innerHTML = `<span class="pulse"></span><span class="dot"></span>`;
        myMarkerRef.current = new window.kakao.maps.CustomOverlay({
          position: ll,
          content: el,
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: 99999,
          clickable: false,
        });
        myMarkerRef.current.setMap(map);

        requestAnimationFrame(() => map?.relayout());
      },
      () => alert("위치 권한을 확인해주세요."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  };

  /** 검색 */
  const searchDong = async (q) => {
    const kakao = await loadKakaoOnce().catch(() => null);
    if (!kakao?.maps?.services) return [];
    const places = new kakao.maps.services.Places();
    const geocoder = new kakao.maps.services.Geocoder();

    const results = await new Promise((resolve) => {
      places.keywordSearch(
        q,
        (data, status) =>
          resolve(status === kakao.maps.services.Status.OK ? data : []),
        { size: 10 }
      );
    });

    const candidates = results.map((r) => ({
      name: r.place_name,
      address: r.road_address_name || r.address_name,
      lat: parseFloat(r.y),
      lng: parseFloat(r.x),
    }));

    const extra = await new Promise((resolve) => {
      geocoder.addressSearch(q, (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
          resolve(
            data.map((d) => ({
              name:
                d.address?.region_3depth_name ||
                d.road_address?.region_3depth_name ||
                d.address_name,
              address: d.address_name,
              lat: parseFloat(d.y),
              lng: parseFloat(d.x),
            }))
          );
        } else resolve([]);
      });
    });

    const merged = [...candidates, ...extra]
      .filter((x) => x.name)
      .reduce(
        (acc, cur) => {
          const key = `${cur.name}_${cur.address}_${cur.lat.toFixed(6)}_${cur.lng.toFixed(6)}`;
          if (!acc._set.has(key)) {
            acc._set.add(key);
            acc.list.push(cur);
          }
          return acc;
        },
        { _set: new Set(), list: [] }
      ).list
      .slice(0, 10);

    setSuggests(merged);
    setShowSuggests(true);
    return merged;
  };

  /** 검색 선택 → 카메라 이동 + 핀 마커 이동 + pending */
  const moveCameraTo = async (item) => {
    const kakao = await loadKakaoOnce().catch(() => null);
    const map = await ensureMap({ lat: item.lat, lng: item.lng });
    if (!map || !kakao) return;

    const ll = new kakao.maps.LatLng(item.lat, item.lng);
    map.setCenter(ll);
    map.setLevel(5);

    ensureSearchMarker(ll);
    setPendingArea(item);
  };

  /** “내 동네로 설정” 확정 (중복 방지 포함) */
  const confirmPendingAsArea = () => {
    if (!pendingArea) return;

    const max = 2;
    if (selectedAreas.length >= max) {
      alert("동네는 최대 2곳까지 설정 가능합니다. 기존 동네를 삭제하세요.");
      return;
    }

    const addrKey = norm(pendingArea.address || pendingArea.name);
    const exists = selectedAreas.some(
      (s) => norm(s.address || s.name) === addrKey
    );
    if (exists) {
      alert("이미 같은 주소가 등록되어 있습니다.");
      return;
    }

    const next = [
      ...selectedAreas,
      { ...pendingArea, key: `${pendingArea.lat}_${pendingArea.lng}` },
    ];
    setSelectedAreas(next);
    drawCircles(next);
  };

  /** 동네 삭제 */
  const removeArea = (key) => {
    const next = selectedAreas.filter((s) => s.key !== key);
    setSelectedAreas(next);
    drawCircles(next);
  };

  /** 원 프리뷰(1km) */
  const drawCircles = (areas) => {
    if (!window.kakao || !mapRef.current) return;
    const kakao = window.kakao;
    (circlesRef.current || []).forEach((c) => c.setMap(null));
    circlesRef.current = [];

    const primary = getPrimaryHex();
    areas.forEach((s) => {
      const circle = new kakao.maps.Circle({
        center: new kakao.maps.LatLng(s.lat, s.lng),
        radius: 1000,
        strokeWeight: 2,
        strokeColor: primary,
        strokeOpacity: 0.7,
        fillColor: primary,
        fillOpacity: 0.15,
      });
      circle.setMap(mapRef.current);
      circlesRef.current.push(circle);
    });
  };

  /** 추천 상자 외부 클릭 닫기 */
  useEffect(() => {
    const onDown = (e) => {
      if (!suggestBoxRef.current) return;
      if (!suggestBoxRef.current.contains(e.target)) setShowSuggests(false);
    };
    if (showSuggests) document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [showSuggests]);

  const hasPending = !!pendingArea;

  return (
    <Layout pageTitle="위치 설정" activeMenuItem="mypage">
      <div className="location-page container">
        {/* 지도 */}
        <div className="map-wrap">
          {loadingMap ? (
            <div className="map-skeleton">지도를 불러오는 중…</div>
          ) : loadError ? (
            <div className="map-error">{String(loadError)}</div>
          ) : (
            <div
              ref={setMapBoxEl}
              className="mapbox"
              aria-label="지도"
              style={{ minHeight: 420 }}
            />
          )}

          {/* 우상단: 내 위치 */}
          {!loadError && (
            <div className="map-ctrl top-right">
              <button className="pill-btn" onClick={getCurrent}>
                내 위치
              </button>
            </div>
          )}

          {/* 하단 가운데: 선택 미리보기 칩 */}
          {hasPending && !loadError && (
            <div className="pending-chip bottom-center" aria-live="polite">
              <div className="pc-name">{pendingArea.name}</div>
              <div className="pc-addr">{pendingArea.address}</div>
            </div>
          )}

          {/* 우하단: 내 동네로 설정 (pending 있을 때만) */}
          {hasPending && !loadError && (
            <button
              className="fab br"
              onClick={confirmPendingAsArea}
              aria-label="내 동네로 설정"
            >
              내 동네로 설정
            </button>
          )}
        </div>

        {/* 세로 스택: 검색바 → 내 동네 카드 */}
        <div className="panel">
          {/* 검색 */}
          <div className="search-wrap" ref={suggestBoxRef}>
            <label htmlFor="dong-input" className="sr-only">동/주소/건물 검색</label>
            <div className="search-row" role="group" aria-label="검색 폼">
              <input
                id="dong-input"
                name="dong"
                className="input"
                placeholder="동/주소/건물로 검색 (예: 각산동, 스타벅스 신사)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && query.trim()) {
                    const list = await searchDong(query.trim());
                    if (list.length) setShowSuggests(true);
                  }
                }}
                onFocus={() => { if (suggests.length) setShowSuggests(true); }}
                autoComplete="address-level3"
                inputMode="search"
              />
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  if (!query.trim()) return;
                  const list = await searchDong(query.trim());
                  if (list.length) setShowSuggests(true);
                }}
              >
                검색
              </button>
            </div>

            {showSuggests && suggests.length > 0 && (
              <div className="suggest-box" role="listbox" aria-label="검색 결과">
                {suggests.map((s, i) => (
                  <button
                    key={`${s.name}_${s.lat}_${s.lng}_${i}`}
                    className="suggest-item"
                    role="option"
                    onClick={() => {
                      setQuery(s.name);
                      setShowSuggests(false);
                      moveCameraTo(s);
                    }}
                  >
                    <div className="s-name">{s.name}</div>
                    <div className="s-addr">{s.address}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 내 동네 카드 */}
          <div className="areas-wrap">
            <div className="areas-head">
              <strong>내 동네 (최대 2곳)</strong>
              <span className="areas-hint">태그 클릭 시 삭제</span>
            </div>
            <ul className="taglist" role="list">
              {selectedAreas.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    className="tag chip"
                    title="클릭하면 삭제"
                    onClick={() => removeArea(s.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        removeArea(s.key);
                      }
                    }}
                  >
                    <div className="chip-main">
                      <span className="tag-name">{s.name}</span>
                      <span className="tag-addr">{s.address}</span>
                    </div>
                    <span className="chip-del" aria-hidden>삭제</span>
                  </button>
                </li>
              ))}
              {selectedAreas.length === 0 && (
                <li className="empty">아직 설정된 동네가 없습니다.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <BottomBar />
    </Layout>
  );
};

export default LocationSettings;
