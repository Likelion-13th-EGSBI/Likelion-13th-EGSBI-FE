// src/pages/LocationSettings.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import Layout from "../components/Layout";
import BottomBar from "../components/BottomBar";
import "../css/location-settings.css";

/* ===============================
   ✅ API & Auth 유틸
   =============================== */
const BASE_URL = "https://likelion-att.o-r.kr/v1";

// 로컬스토리지 키(두 형태 모두 지원)
function getAccessToken() {
  return localStorage.getItem("Token") || localStorage.getItem("accessToken") || "";
}
function getUserId() {
  const v = localStorage.getItem("userid") ?? localStorage.getItem("userId");
  return v ? Number(v) : null;
}
function getEmail() {
  return localStorage.getItem("userEmail") || localStorage.getItem("email") || "";
}

async function ensureIdentity() {
  return { userId: getUserId(), email: getEmail(), accessToken: getAccessToken() };
}

// 공통 fetch(JSON/텍스트)
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg = (isJson && (body?.message || body?.error)) || body || `HTTP ${res.status}`;
    const err = new Error(String(msg));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// GET /user/location/{id}
async function apiGetUserLocationById(userId) {
  const token = getAccessToken();
  const url = `${BASE_URL}/user/location/${userId}`;
  return fetchJson(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// POST /user/location  (body: {email, latitude, longitude, address})
async function apiSaveUserLocation({ email, latitude, longitude, address }) {
  const token = getAccessToken();
  const url = `${BASE_URL}/user/location`;
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, latitude, longitude, address }),
  });
}

// DELETE /user/delete/location?email=...
async function apiDeleteUserLocationByEmail(email) {
  const token = getAccessToken();
  const url = `${BASE_URL}/user/delete/location?email=${encodeURIComponent(email)}`;
  return fetchJson(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/* ===============================
   Kakao 지도 로더/유틸
   =============================== */
const KAKAO_APP_KEY = "084b4a076cd976847f592a5fea5ea24d";
const KAKAO_SDK_URL =
  `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false&libraries=services`;

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
        console.error("[Kakao SDK] load error:", scriptEl.src, e);
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

/** 핀 SVG dataURL */
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

/** 문자열 정규화 */
function norm(s = "") {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/* ===============================
   🔧 기본(Mock) 동 & 원 반경
   =============================== */
const DEFAULT_AREA = {
  name: "신촌",
  address: "서울 서대문구 신촌동",
  lat: 37.555,   // 신촌역 부근
  lng: 126.936,
  key: "sinchon_default",
};
const CIRCLE_RADIUS_M = 1000; // ✅ 10km

/* ===============================
   컴포넌트
   =============================== */
const LocationSettings = () => {
  const mapBoxRef = useRef(null);
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);

  const myMarkerRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const circlesRef = useRef([]); // 10km 원 오버레이들

  const [loadingMap, setLoadingMap] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [query, setQuery] = useState("");
  const [suggests, setSuggests] = useState([]);
  const [showSuggests, setShowSuggests] = useState(false);
  const suggestBoxRef = useRef(null);

  const [selectedAreas, setSelectedAreas] = useState([]); // [{name,address,lat,lng,key}]
  const [pendingArea, setPendingArea] = useState(null);   // {name,address,lat,lng}

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingServerLoc, setLoadingServerLoc] = useState(false);

  const [mapHostReady, setMapHostReady] = useState(false);
  const setMapBoxEl = useCallback((el) => {
    mapBoxRef.current = el;
    setMapHostReady(!!el);
  }, []);

  // 지도 생성
  const ensureMap = useCallback(
    async (center) => {
      if (!mapHostReady) return null;
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
          setLoadingMap(false);
          return null;
        }

        if (box.getBoundingClientRect().height < 40) {
          box.style.minHeight = "420px";
          await new Promise((r) => requestAnimationFrame(r));
        }

        const map = new kakao.maps.Map(box, {
          center: new kakao.maps.LatLng(
            center?.lat ?? DEFAULT_AREA.lat,
            center?.lng ?? DEFAULT_AREA.lng
          ),
          level: 8, // 🔎 10km 원이 보이도록 살짝 더 멀리
        });
        mapRef.current = map;

        geocoderRef.current = new kakao.maps.services.Geocoder();

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

  // 초기화: 지도 → 서버 위치 로드
  useEffect(() => {
    (async () => {
      if (!mapHostReady) return;
      await ensureMap();
      await loadServerLocationAndDraw();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapHostReady]);

  /** 좌표 → 주소로 pendingArea 갱신 */
  const reverseGeocodeToPending = (lat, lng) => {
    const kakao = window.kakao;
    if (!kakao || !geocoderRef.current) return;
    geocoderRef.current.coord2Address(lng, lat, (data, status) => {
      if (status === kakao.maps.services.Status.OK && data && data[0]) {
        const addr =
          data[0].road_address?.address_name ||
          data[0].address?.address_name ||
          "";
        const name =
          data[0].road_address?.region_3depth_name ||
          data[0].address?.region_3depth_name ||
          addr;
        setPendingArea({ name, address: addr, lat, lng });
      }
    });
  };

  /** 검색/클릭용 핀 마커 */
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

      kakao.maps.event.addListener(searchMarkerRef.current, "dragend", () => {
        const pos = searchMarkerRef.current.getPosition();
        reverseGeocodeToPending(pos.getLat(), pos.getLng());
      });
    } else {
      searchMarkerRef.current.setImage(image);
      searchMarkerRef.current.setPosition(latLng);
    }
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
        map.setLevel(8); // 🔎 10km 보기 좋게

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

  /** 원 프리뷰(10km) */
  const drawCircles = (areas) => {
    if (!window.kakao || !mapRef.current) return;
    const kakao = window.kakao;
    (circlesRef.current || []).forEach((c) => c.setMap(null));
    circlesRef.current = [];

    const primary = getPrimaryHex();
    areas.forEach((s) => {
      const circle = new kakao.maps.Circle({
        center: new kakao.maps.LatLng(s.lat, s.lng),
        radius: CIRCLE_RADIUS_M, // ✅ 10km
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

  /** 서버 저장 위치 불러오기 (없으면 신촌 Mock) */
  const loadServerLocationAndDraw = useCallback(async () => {
    const userId = getUserId();

    // 로그인 안했거나 userId 없으면 신촌 mock
    if (!userId) {
      setSelectedAreas([]);          // 저장된 건 없음
      setPendingArea(DEFAULT_AREA);  // 신촌을 기본 후보로
      const map = await ensureMap({ lat: DEFAULT_AREA.lat, lng: DEFAULT_AREA.lng });
      if (map) drawCircles([DEFAULT_AREA]); // 기본 원 그려주기
      return;
    }

    setLoadingServerLoc(true);
    try {
      const data = await apiGetUserLocationById(userId);
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      const address = data.address || "";
      const name = address;

      const area = { name, address, lat, lng, key: `${lat}_${lng}` };

      const map = await ensureMap({ lat, lng });
      if (map) drawCircles([area]);
      setSelectedAreas([area]);
      setPendingArea(area);
    } catch (e) {
      if (e.status === 404) {
        // 서버에 저장값 없으면 신촌 mock
        setSelectedAreas([]);
        setPendingArea(DEFAULT_AREA);
        const map = await ensureMap({ lat: DEFAULT_AREA.lat, lng: DEFAULT_AREA.lng });
        if (map) drawCircles([DEFAULT_AREA]);
      } else {
        console.error("서버 위치 조회 실패:", e);
      }
    } finally {
      setLoadingServerLoc(false);
    }
  }, [ensureMap]);

  /** 검색 선택 → 카메라/핀 이동 (미리보기 텍스트만) */
  const moveCameraTo = async (item) => {
    const kakao = await loadKakaoOnce().catch(() => null);
    const map = await ensureMap({ lat: item.lat, lng: item.lng });
    if (!map || !kakao) return;

    const ll = new kakao.maps.LatLng(item.lat, item.lng);
    map.setCenter(ll);
    map.setLevel(8); // 🔎 10km

    ensureSearchMarker(ll);
    setPendingArea(item);
  };

  /** “내 동네로 설정” — 서버 저장 성공 시에만 UI 반영 */
  const confirmPendingAsArea = async () => {
    if (!pendingArea) return;

    const addrKey = norm(pendingArea.address || pendingArea.name);
    const exists = selectedAreas.some(
      (s) => norm(s.address || s.name) === addrKey
    );
    if (exists) {
      alert("이미 같은 주소가 등록되어 있습니다.");
      return;
    }

    const { email } = await ensureIdentity();
    if (!email) {
      alert("로그인 정보가 없어 서버 저장을 건너뜁니다. (userEmail 없음)");
      return;
    }

    setSaving(true);
    try {
      await apiSaveUserLocation({
        email,
        latitude: pendingArea.lat,
        longitude: pendingArea.lng,
        address: pendingArea.address || pendingArea.name,
      });

      await loadServerLocationAndDraw(); // 성공 후 서버 상태 기준으로 원 다시 그림
      alert("서버에 동네가 저장되었습니다.");
    } catch (e) {
      console.error("서버 저장 실패:", e);
      alert(`서버 저장 실패: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  /** 태그 클릭 → 확인 → 서버 삭제 성공 시 UI 갱신 (단일 저장 정책) */
  const handleTagDelete = async () => {
    const email = getEmail();
    if (!email) {
      alert("로그인 후 삭제할 수 있습니다.");
      return;
    }
    const ok = window.confirm("삭제하시겠습니까?");
    if (!ok) return;

    setDeleting(true);
    try {
      await apiDeleteUserLocationByEmail(email);
      setSelectedAreas([]);
      drawCircles([]);
      setPendingArea(DEFAULT_AREA); // 삭제 후엔 다시 신촌 mock
      const map = await ensureMap({ lat: DEFAULT_AREA.lat, lng: DEFAULT_AREA.lng });
      if (map) drawCircles([DEFAULT_AREA]);
      alert("삭제되었습니다");
    } catch (e) {
      console.error("삭제 실패:", e);
      alert(`삭제 실패: ${e.message}`);
    } finally {
      setDeleting(false);
    }
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
    <Layout pageTitle="위치 설정" activeMenuItem="location">
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

          {/* 좌상단: 서버 동기화 상태 */}
          {!loadError && (
            <div className="map-ctrl top-left">
              <div className="sync-indicator" aria-live="polite">
                {loadingServerLoc
                  ? "서버 위치 불러오는 중…"
                  : deleting
                  ? "삭제 중…"
                  : saving
                  ? "저장 중…"
                  : ""}
              </div>
            </div>
          )}

          {/* 하단 가운데: 선택 미리보기 칩 */}
          {hasPending && !loadError && (
            <div className="pending-chip bottom-center" aria-live="polite">
              <div className="pc-name">{pendingArea.name}</div>
              <div className="pc-addr">{pendingArea.address}</div>
            </div>
          )}

          {/* 우하단: 내 동네로 설정 */}
          {hasPending && !loadError && (
            <button
              className="fab br"
              onClick={confirmPendingAsArea}
              aria-label="내 동네로 설정"
              disabled={saving}
            >
              {saving ? "저장 중..." : "내 동네로 설정"}
            </button>
          )}
        </div>

        {/* 검색 & 내 동네 카드 */}
        <div className="panel">
          <div className="search-wrap" ref={suggestBoxRef}>
            <label htmlFor="dong-input" className="sr-only">
              동/주소/건물 검색
            </label>
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
                onFocus={() => {
                  if (suggests.length) setShowSuggests(true);
                }}
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

          <div className="areas-wrap">
            <div className="areas-head">
              <strong>내 동네 (단일)</strong>
              <span className="areas-hint">태그 클릭 시 삭제</span>
            </div>
            <ul className="taglist" role="list">
              {selectedAreas.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    className="tag chip"
                    title="클릭하면 삭제"
                    onClick={handleTagDelete}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleTagDelete();
                      }
                    }}
                  >
                    <div className="chip-main">
                      <span className="tag-name">{s.name}</span>
                      <span className="tag-addr">{s.address}</span>
                    </div>
                    <span className="chip-del" aria-hidden>
                      삭제
                    </span>
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
