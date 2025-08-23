import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/eventall.css";

const BASE_URL = "https://gateway.gamja.cloud";

function getAuth() {
  try {
    const obj = JSON.parse(localStorage.getItem("auth") || "{}");
    const idRaw = obj?.id ?? localStorage.getItem("userId") ?? localStorage.getItem("userid") ?? "";
    const idParsed = parseInt(String(idRaw).replace(/[^\d]/g, ""), 10);
    const accessToken =
      obj?.accessToken ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("Token") ||
      localStorage.getItem("token") ||
      "";
    return { id: Number.isFinite(idParsed) && idParsed > 0 ? idParsed : null, accessToken: accessToken || "" };
  } catch {
    const idRaw = localStorage.getItem("userId") ?? localStorage.getItem("userid") ?? "";
    const idParsed = parseInt(String(idRaw).replace(/[^\d]/g, ""), 10);
    const token =
      localStorage.getItem("accessToken") ||
      localStorage.getItem("Token") ||
      localStorage.getItem("token") ||
      "";
    return { id: Number.isFinite(idParsed) && idParsed > 0 ? idParsed : null, accessToken: token || "" };
  }
}
function userHeaders() {
  const { id, accessToken } = getAuth();
  const h = {};
  if (id != null) h["X-User-Id"] = String(id);
  if (accessToken) h["Authorization"] = `Bearer ${accessToken}`;
  return h;
}

async function http(path, { method = "GET", headers = {}, body, signal } = {}) {
  const isJsonBody = body && !(body instanceof FormData);
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { ...(isJsonBody ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? (isJsonBody ? JSON.stringify(body) : body) : undefined,
    signal,
    credentials: "omit",
  });
  if (res.status === 401) {
    alert("로그인이 필요합니다.");
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${txt}`);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${txt}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) { try { return await res.json(); } catch { return null; } }
  try { return JSON.parse(await res.text()); } catch { return null; }
}
const api = {
  pubGet: (p, opt = {}) => http(p, { ...opt, method: "GET", headers: { ...(opt.headers || {}) } }),
  uGet: (p, opt = {}) => http(p, { ...opt, method: "GET", headers: { ...userHeaders(), ...(opt.headers || {}) } }),
  uPost: (p, body, opt = {}) => http(p, { ...opt, method: "POST", body, headers: { ...userHeaders(), ...(opt.headers || {}) } }),
};

function distanceKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad((b.lat ?? 0) - (a.lat ?? 0));
  const dLon = toRad((b.lng ?? 0) - (a.lng ?? 0));
  const lat1 = toRad(a.lat ?? 0);
  const lat2 = toRad(b.lat ?? 0);
  const s = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}
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
function normalizeEventOne(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lat = raw.latitude ?? null;
  const lng = raw.longitude ?? null;
  return {
    id: raw.id ?? null,
    organizerId: raw.organizerId ?? null,
    name: raw.name ?? "",
    description: raw.description ?? "",
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    address: raw.address ?? "",
    entryFee: Number.isFinite(raw.entryFee) ? raw.entryFee : 0,
    posterId: raw.posterId ?? null,
    qrImage: raw.qrImage ?? null,
    hashtags: raw.hashtags ?? [],
    createdAt: raw.createTime ?? null,
    lat: typeof lat === "number" ? lat : lat ? Number(lat) : null,
    lng: typeof lng === "number" ? lng : lng ? Number(lng) : null,
    imageUrl: raw.imageUrl ?? null,
    bookmarkCount: Number.isFinite(raw.bookmarkCount) ? raw.bookmarkCount : 0,
  };
}
const normalizeEventArray = (payload) => {
  const base = payload?.data ?? payload ?? [];
  const arr = Array.isArray(base) ? base : (Array.isArray(base?.items) ? base.items : []);
  return (arr || []).map(normalizeEventOne).filter(Boolean);
};
const toCardProps = (e) => ({
  id: e.id,
  image: e.imageUrl || (e.posterId ? `${BASE_URL}/api/image/${e.posterId}` : null),
  title: e.name,
  summary: (e.description ?? "").replace(/<br\s*\/?>/gi, "\n"),
  hashtags: e.hashtags,
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
  bookmarkCount: e.bookmarkCount ?? 0,
});

async function fetchEventsLatest({ includeClosed, page = 0, size = 40 }) {
  const params = new URLSearchParams({ deadline: includeClosed ? "true" : "false", page: String(page), size: String(size), sort: "createTime,DESC" });
  const payload = await api.pubGet(`/api/event?${params.toString()}`);
  return normalizeEventArray(payload);
}
async function fetchEventsByDistance({ includeClosed, lat, lng, page = 0, size = 40 }) {
  const params = new URLSearchParams({ deadline: includeClosed ? "true" : "false", latitude: String(lat), longitude: String(lng), page: String(page), size: String(size) });
  const payload = await api.pubGet(`/api/event/loc?${params.toString()}`);
  return normalizeEventArray(payload);
}
async function fetchEventsPopular() {
  try {
    const payload = await api.pubGet(`/api/event/popular`);
    const list = normalizeEventArray(payload);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.startsWith("404")) return [];
    throw e;
  }
}
async function fetchMyBookmarkList() {
  try {
    const list = await api.uGet(`/api/activity/bookmark/list`);
    const arr = Array.isArray(list) ? list : list ? [list] : [];
    const map = {};
    for (const b of arr) if (b?.eventId != null) map[Number(b.eventId)] = true;
    return map;
  } catch {
    return {};
  }
}
async function toggleBookmarkOnServer(eventId) {
  await api.uPost(`/api/activity/bookmark/toggle`, { eventId });
}
async function fetchBookmarkCount(eventId) {
  const payload = await api.pubGet(`/api/activity/bookmark/count?eventId=${encodeURIComponent(eventId)}`);
  const num = Number(payload?.data ?? payload);
  return Number.isFinite(num) ? num : 0;
}

export default function EventAll() {
  const navigate = useNavigate();
  const [sort, setSort] = useState("latest");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [bookmarks, setBookmarks] = useState({});
  const [userPos, setUserPos] = useState({ lat: 37.5663, lng: 126.9779 });
  const [page, setPage] = useState(1);
  const PER_PAGE = 40;
  const [allEvents, setAllEvents] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const goTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  useEffect(() => {
    const handler = () => navigate("/login");
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, [navigate]);

  useEffect(() => {
    let alive = true;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => alive && setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, maximumAge: 600000, timeout: 3000 }
      );
    }
    return () => { alive = false; };
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const zeroPage = Math.max(0, page - 1);
    try {
      let list = [];
      if (sort === "distance") {
        list = await fetchEventsByDistance({ includeClosed, lat: userPos.lat, lng: userPos.lng, page: zeroPage, size: PER_PAGE });
      } else if (sort === "popular") {
        list = await fetchEventsPopular();
      } else {
        list = await fetchEventsLatest({ includeClosed, page: zeroPage, size: PER_PAGE });
      }
      setAllEvents(list ?? []);
      setHasNext(sort !== "popular" && Array.isArray(list) && list.length === PER_PAGE);

      let bm = {};
      const { id } = getAuth();
      if (id != null) bm = await fetchMyBookmarkList();
      setBookmarks(bm);
    } catch (e) {
      setErr(e?.message || "행사 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [sort, includeClosed, page, userPos.lat, userPos.lng]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadPage();
      if (!alive) return;
    })();
    return () => { alive = false; };
  }, [loadPage]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const normalized = useMemo(() => {
    return (allEvents || []).map((e) => {
      const s = e.startTime ? new Date(e.startTime) : null;
      const ed = e.endTime ? new Date(e.endTime) : null;
      const start = s && !isNaN(s.getTime()) ? s : null;
      const end = ed && !isNaN(ed.getTime()) ? ed : start ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : null;
      const dist = Number.isFinite(e.lat) && Number.isFinite(e.lng) ? distanceKm(userPos, { lat: e.lat, lng: e.lng }) : Number.POSITIVE_INFINITY;
      return { ...e, _start: start, _end: end, _distance: dist, _isOngoing: start && end ? now >= start && now <= end : false };
    });
  }, [allEvents, userPos, now]);

  const filtered = useMemo(() => {
    if (includeClosed) return normalized;
    return normalized.filter((e) => e._isOngoing || (e._end ? e._end >= now : true));
  }, [normalized, includeClosed, now]);

  const visibleCount = filtered.length;
  const totalPages = Math.max(1, page + (hasNext ? 1 : 0));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  useEffect(() => { goTop(); }, [page]);

  const pageItems = filtered;

  const toggleBookmark = async (id) => {
    const { id: uid } = getAuth();
    if (uid == null) {
      alert("로그인이 필요합니다. 로그인 후 다시 시도해주세요.");
      return;
    }
    const prev = !!bookmarks[id];
    setBookmarks((p) => ({ ...p, [id]: !prev }));
    try {
      await toggleBookmarkOnServer(id);
      const [latestMap, newCount] = await Promise.all([fetchMyBookmarkList(), fetchBookmarkCount(id)]);
      setBookmarks(latestMap);
      setAllEvents((prevEvents) => {
        const updated = prevEvents.map((ev) => (ev.id === id ? { ...ev, bookmarkCount: newCount } : ev));
        if (sort === "popular") return [...updated];
        return updated;
      });
    } catch (e) {
      setBookmarks((p) => ({ ...p, [id]: prev }));
      const msg = String(e?.message || "");
      if (msg.includes("로그인이") || msg.includes("401")) {
        alert("로그인이 필요합니다. 로그인 후 다시 시도해주세요.");
      } else {
        alert("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    }
  };

  const onCardClick = (id) => navigate(`/events/${id}`);
  const changePage = (p) => setPage(Math.max(1, Math.min(totalPages, p)));

  return (
    <Layout pageTitle="전체 행사" activeMenuItem="home">
      <div className="eventall-page">
        <div className="eventall-head">
          <div className="eventall-controls">
            <div className="eventall-filters">
              <button
                type="button"
                className={`chip ${!includeClosed ? "on" : ""}`}
                onClick={() => { setIncludeClosed(false); setPage(1); goTop(); }}
              >
                진행중만
              </button>
              <button
                type="button"
                className={`chip ${includeClosed ? "on" : ""}`}
                onClick={() => { setIncludeClosed(true); setPage(1); goTop(); }}
              >
                마감 포함
              </button>
            </div>
            <div className="eventall-sort">
              {[
                { key: "latest", label: "최신" },
                { key: "distance", label: "거리순" },
                { key: "popular", label: "인기순" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`sort-tab ${sort === t.key ? "active" : ""}`}
                  onClick={() => { setSort(t.key); setPage(1); goTop(); }}
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
                    bookmarkCount={props.bookmarkCount}
                    onBookmarkToggle={() => toggleBookmark(e.id)}
                    onClick={onCardClick}
                  />
                );
              })}
            </div>

            {visibleCount === 0 && <div className="eventall-empty">조건에 맞는 행사가 없어요.</div>}

            <div className="eventall-pagination" role="navigation" aria-label="페이지">
              <button
                type="button"
                className="page-btn nav"
                disabled={page === 1}
                onClick={() => changePage(page - 1)}
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
                disabled={!hasNext}
                onClick={() => changePage(page + 1)}
              >
                ▶
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
