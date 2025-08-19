// src/pages/EventAll.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/eventall.css";

/* ======================= API base & utils ======================= */
const API_BASE = "https://gateway.gamja.cloud";

const getAuthHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getUserId = () => {
  const idStr = localStorage.getItem("userId");
  const id = idStr ? parseInt(idStr, 10) : null;
  return Number.isFinite(id) ? id : null;
};

const getJson = async (url, opts = {}) => {
  const mergedHeaders = {
    Accept: "application/json",
    ...getAuthHeaders(),
    ...(opts.headers || {}),
  };
  const res = await fetch(url, {
    mode: "cors",
    cache: "no-store",
    headers: mergedHeaders,
    ...opts,
  });

  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    let bodyText = "";
    let bodyJson = null;
    try {
      if (ct.includes("application/json")) {
        bodyJson = await res.json();
        bodyText = JSON.stringify(bodyJson);
      } else {
        bodyText = await res.text();
        try { bodyJson = JSON.parse(bodyText); } catch { }
      }
    } catch { }
    const err = new Error(`${url} 실패 (${res.status})`);
    err.status = res.status;
    err.body = bodyText;
    err.bodyJson = bodyJson;
    err.url = url;
    throw err;
  }
  if (ct.includes("application/json")) return res.json();
  try { return JSON.parse(await res.text()); } catch { return res.text(); }
};

const postJson = async (url, bodyObj, extraHeaders = {}) => {
  return getJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(bodyObj ?? {}),
  });
};

/* ======================= helpers ======================= */
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

/* ======================= normalizers ======================= */
function normalizeEventOne(rawLike) {
  const raw = rawLike?.data ?? rawLike?.event ?? rawLike;
  if (!raw || typeof raw !== "object") return null;

  const lat =
    raw.latitude ?? raw.lat ?? raw.y ?? raw.locationLat ?? null;
  const lng =
    raw.longitude ?? raw.lng ?? raw.lon ?? raw.x ?? raw.locationLng ?? null;

  return {
    id: raw.id ?? raw.eventId ?? null,
    organizerId: raw.organizerId ?? null,
    name: raw.name ?? raw.title ?? "",
    description: raw.description ?? raw.summary ?? raw.content ?? "",
    startTime: raw.startTime ?? raw.start_date ?? raw.start ?? raw.startsAt ?? null,
    endTime: raw.endTime ?? raw.end_date ?? raw.end ?? raw.endsAt ?? null,
    address: raw.address ?? raw.location ?? "",
    entryFee: Number.isFinite(raw.entryFee)
      ? raw.entryFee
      : raw.fee === "무료"
        ? 0
        : parseInt(raw.fee, 10) || 0,
    posterId: raw.posterId ?? raw.imageId ?? raw.qrImage ?? null,
    hashtags: raw.hashtags ?? raw.tags ?? [],
    // 정렬용 필드
    popularity: raw.popularity ?? raw.score ?? raw.rankScore ?? 0,
    createdAt:
      raw.createdAt ?? raw.created_at ?? raw.createDate ?? raw.createTime ?? null, // ✅ createTime 매핑
    // 좌표(거리 정렬용)
    lat: typeof lat === "number" ? lat : lat ? Number(lat) : null,
    lng: typeof lng === "number" ? lng : lng ? Number(lng) : null,
    // 북마크 관련
    bookmarked: !!raw.bookmarked,
    bookmarkCount: Number.isFinite(raw.bookmarkCount)
      ? raw.bookmarkCount
      : (raw.stats?.bookmarkCount ?? null),
    imageUrl: raw.imageUrl ?? raw.posterUrl ?? null,
  };
}

const normalizeEventArray = (payload) => {
  const base =
    payload?.data ??
    payload?.result ??
    payload?.events ??
    payload?.content ??
    payload?.list ??
    payload ??
    [];
  const arr = Array.isArray(base) ? base : Array.isArray(base?.items) ? base.items : [];
  return arr.map(normalizeEventOne).filter(Boolean);
};

const toCardProps = (e) => ({
  id: e.id,
  image: e.imageUrl || (e.posterId ? `${API_BASE}/api/image/${e.posterId}` : null),
  title: e.name,
  summary: (e.description ?? '').replace(/<br\s*\/?>/gi, '\n'), hashtags: e.hashtags,
  date: e.startTime ? new Date(e.startTime).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-",
  time: (() => {
    const s = e.startTime ? new Date(e.startTime) : null;
    const ed = e.endTime ? new Date(e.endTime) : null;
    const f = (x) => x?.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) ?? "";
    if (s && ed) return `${f(s)} - ${f(ed)}`;
    if (s) return f(s);
    return "-";
  })(),
  location: e.address || "-",
  fee: Number.isFinite(e.entryFee) ? `${e.entryFee.toLocaleString()}원` : "-",
});

/* ======================= fetching strategies ======================= */
// 리스트 엔드포인트 후보들 (페이지네이션까지 자동 시도)
const LIST_CANDIDATES = [
  (q) => `${API_BASE}/api/event/all?size=${q.limit}`,
  (q) => `${API_BASE}/api/event/list?size=${q.limit}`,
  (q) => `${API_BASE}/api/event/search?size=${q.limit}`,
  // 흔한 REST 패턴들
  (q) => `${API_BASE}/api/events?size=${q.limit}`,
  (q) => `${API_BASE}/api/event?size=${q.limit}`,
];

async function tryLoadFromListEndpoints(limit = 500) {
  for (const makeUrl of LIST_CANDIDATES) {
    // 1) 단발 시도
    try {
      const payload = await getJson(makeUrl({ limit }));
      const list = normalizeEventArray(payload);
      if (list?.length) return list;
    } catch (_) { }

    // 2) page/size 패턴 시도 (page = 0부터 증가)
    let page = 0;
    const pageSize = Math.min(200, limit);
    let acc = [];
    let hit = false;

    // 최대 10페이지까지만 (과호출 방지)
    for (; page < 10 && acc.length < limit; page++) {
      const urlWithPage = makeUrl({ limit: pageSize }) + `&page=${page}`;
      try {
        const payload = await getJson(urlWithPage);
        const list = normalizeEventArray(payload);
        if (list.length === 0) break;
        acc = acc.concat(list);
        hit = true;
      } catch {
        break;
      }
    }
    if (hit && acc.length) return acc.slice(0, limit);
  }
  return null;
}

// 단건 조회 엔드포인트 후보들
const INFO_CANDIDATES = [
  (id) => `${API_BASE}/api/event/info/${id}`,
  (id) => `${API_BASE}/api/event/${id}`,
  (id) => `${API_BASE}/api/events/${id}`,
];

// 후보 경로를 돌며 첫 성공을 반환
async function fetchEventById(id) {
  for (const makeUrl of INFO_CANDIDATES) {
    try {
      const payload = await getJson(makeUrl(id));
      const one = normalizeEventOne(payload);
      if (one?.id) return one;
    } catch (e) {
      // 404 등은 다음 후보로 계속 진행
      if (e?.status && e.status !== 404) {
        // 다른 에러면 굳이 더 시도하지 않고 다음 후보로
      }
    }
  }
  return null;
}

/**
 * 동적 크롤링 (상세조회 경로를 후보로 순회)
 * - batchSize 단위로 id를 올리며 조회
 * - 연속 emptyBatchLimit 번 빈 배치가 나오면 종료
 * - maxRequests로 과호출 방지
 */
async function crawlEventsDynamically({
  startId = 1,
  batchSize = 20,
  emptyBatchLimit = 5,
  maxRequests = 5000,
} = {}) {
  const results = [];
  let current = startId;
  let emptyBatchCount = 0;
  let totalRequests = 0;

  while (totalRequests < maxRequests && emptyBatchCount < emptyBatchLimit) {
    const ids = Array.from({ length: batchSize }, (_, i) => current + i);
    const batch = await Promise.all(ids.map(fetchEventById));
    totalRequests += ids.length;

    const found = batch.filter(Boolean);
    if (found.length) {
      results.push(...found);
      emptyBatchCount = 0;
    } else {
      emptyBatchCount += 1;
    }
    current += batchSize;
  }

  results.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  return results;
}

async function loadAllEvents(limitForList = 500) {
  const list = await tryLoadFromListEndpoints(limitForList);
  if (list && list.length) return list;

  // 리스트가 안 되면 상세 조회 동적 크롤링
  return await crawlEventsDynamically({
    startId: 1,
    batchSize: 20,
    emptyBatchLimit: 5,
    maxRequests: 5000,
  });
}

async function fetchBookmarkCount(eventId) {
  const candidates = [
    `${API_BASE}/api/activity/bookmark/count/${eventId}`,
    `${API_BASE}/api/activity/bookmark/count?eventId=${eventId}`,
    `${API_BASE}/api/bookmark/count/${eventId}`,
  ];
  for (const url of candidates) {
    try {
      const p = await getJson(url);
      const obj = p?.data ?? p;
      const n =
        obj?.bookmarkCount ??
        obj?.count ??
        (typeof obj === "number" ? obj : null);
      if (Number.isFinite(n)) return Number(n);
    } catch (_) { }
  }
  return null;
}

async function hydrateBookmarkCounts(events, concurrency = 10) {
  const out = [...events];
  let i = 0;
  async function worker() {
    while (i < out.length) {
      const idx = i++;
      const ev = out[idx];
      if (Number.isFinite(ev.bookmarkCount)) continue;
      const c = await fetchBookmarkCount(ev.id);
      out[idx] = { ...ev, bookmarkCount: Number.isFinite(c) ? c : 0 };
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

async function fetchUserLocation(uid) {
  if (!uid) return null;
  const candidates = [
    `${API_BASE}/api/user/location/${uid}`,
    `${API_BASE}/api/user/location?userId=${uid}`,
    `${API_BASE}/api/user/location/me`,
  ];
  for (const url of candidates) {
    try {
      const p = await getJson(url);
      const u = p?.data ?? p;
      const lat = u?.latitude;
      const lng = u?.longitude;
      if (typeof lat === "number" && typeof lng === "number") {
        return { lat, lng, address: u?.address ?? null };
      }
    } catch (_) { }
  }
  return null;
}

async function toggleBookmarkOnServer(eventId) {
  const uid = getUserId();
  if (!uid) throw new Error("로그인이 필요합니다.");
  const resp = await postJson(`${API_BASE}/api/activity/bookmark/toggle`, { eventId, userId: uid });
  const d = resp?.data ?? resp;
  const count = d?.bookmarkCount;
  return Number.isFinite(count) ? Number(count) : null;
}

export default function EventAll() {
  const navigate = useNavigate();

  const [sort, setSort] = useState("latest"); // latest | popular | distance
  const [includeClosed, setIncludeClosed] = useState(false);
  const [bookmarks, setBookmarks] = useState({});
  const [userPos, setUserPos] = useState({ lat: 37.5663, lng: 126.9779 }); // 서울시청 기본값

  const PER_PAGE = 40;
  const [page, setPage] = useState(1);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const goTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const uid = getUserId();
        const loc = await fetchUserLocation(uid);
        if (alive && loc) {
          setUserPos({ lat: loc.lat, lng: loc.lng });
        } else if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => alive && setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => { },
            { enableHighAccuracy: false, maximumAge: 600000, timeout: 3000 }
          );
        }
      } catch { }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        let list = await loadAllEvents(500);
        if (!alive) return;

        list = await hydrateBookmarkCounts(list, 10);
        if (!alive) return;

        setAllEvents(list);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "행사 목록을 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const now = useMemo(() => new Date(), []);
  const normalized = useMemo(() => {
    return allEvents.map((e) => {
      const s = e.startTime
        ? new Date(e.startTime)
        : e.date
          ? toDateFromYMDHM(e.date, e.time)
          : null;
      const start = s && !isNaN(s.getTime()) ? s : null;

      const ed = e.endTime ? new Date(e.endTime) : null;
      const end = ed && !isNaN(ed.getTime())
        ? ed
        : start
          ? new Date(start.getTime() + 2 * 60 * 60 * 1000)
          : null;

      const lat = Number.isFinite(e.lat) ? e.lat : null;
      const lng = Number.isFinite(e.lng) ? e.lng : null;
      const dist = lat != null && lng != null ? distanceKm(userPos, { lat, lng }) : Number.POSITIVE_INFINITY;

      let createdScore = null;
      if (e.createdAt) {
        const c = new Date(e.createdAt);
        createdScore = !isNaN(c.getTime()) ? c.getTime() : null;
      }

      return {
        ...e,
        _start: start,
        _end: end,
        _distance: dist,
        _isOngoing: start && end ? now >= start && now <= end : false,
        _createdScore: createdScore ?? (Number.isFinite(e.id) ? e.id : 0),
        _bookmarkCount: Number.isFinite(e.bookmarkCount) ? e.bookmarkCount : 0,
      };
    });
  }, [allEvents, userPos, now]);

  const filteredAndSorted = useMemo(() => {
    let arr = normalized;
    if (!includeClosed) {
      arr = arr.filter((e) => e._isOngoing || (e._end ? e._end >= now : true));
    }

    if (sort === "latest") {
      arr = [...arr].sort((a, b) => (b._createdScore ?? 0) - (a._createdScore ?? 0));
    } else if (sort === "popular") {
      arr = [...arr].sort((a, b) => (b._bookmarkCount ?? 0) - (a._bookmarkCount ?? 0));
    } else if (sort === "distance") {
      arr = [...arr].sort((a, b) => (a._distance ?? 1e9) - (b._distance ?? 1e9));
    }

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

  useEffect(() => { goTop(); }, [page]);

  const toggleBookmark = async (id) => {
    setBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));
    try {
      const newCount = await toggleBookmarkOnServer(id);
      if (Number.isFinite(newCount)) {
        setAllEvents((prev) =>
          prev.map((ev) => (ev.id === id ? { ...ev, bookmarkCount: newCount } : ev))
        );
      }
    } catch (e) {
      // 실패 시 롤백
      setBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));
      if (String(e?.message || "").includes("로그인이")) {
        alert("로그인이 필요합니다. 로그인 후 다시 시도해주세요.");
      } else {
        console.warn("북마크 토글 실패:", e?.status || e?.message);
      }
    }
  };

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

        {err && (
          <div className="error-box" style={{ margin: "8px 16px", whiteSpace: "pre-wrap" }}>
            {err}
          </div>
        )}

        {loading ? (
          <div className="eventall-grid event-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div className="hcell sk-card" key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="eventall-grid event-grid">
              {pageItems.map((e) => {
                const props = toCardProps(e);
                return (
                  <EventCard
                    key={e.id}
                    id={props.id}
                    image={props.image}
                    title={props.title}
                    summary={props.summary}
                    hashtags={props.hashtags}
                    date={props.date}
                    time={props.time}
                    location={props.location}
                    fee={props.fee}
                    bookmarked={!!bookmarks[e.id]}
                    onBookmarkToggle={() => toggleBookmark(e.id)}
                    onClick={onCardClick}
                  />
                );
              })}
            </div>

            {total === 0 && (
              <div className="eventall-empty">조건에 맞는 행사가 없어요.</div>
            )}

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
          </>
        )}
      </div>
    </Layout>
  );
}
