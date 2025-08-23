// src/pages/MainPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/mainpage.css";

const API_BASE = "https://gateway.gamja.cloud";

function abs(path) {
  if (!path) return path;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

function getAccessToken() {
  try {
    const obj = JSON.parse(localStorage.getItem("auth") || "{}");
    const t =
      obj?.accessToken ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("Token") ||
      localStorage.getItem("token") ||
      "";
    return t || "";
  } catch {
    return (
      localStorage.getItem("accessToken") ||
      localStorage.getItem("Token") ||
      localStorage.getItem("token") ||
      ""
    );
  }
}
function saveAccessToken(tok) {
  if (!tok) return;
  try {
    const obj = JSON.parse(localStorage.getItem("auth") || "{}");
    obj.accessToken = tok;
    localStorage.setItem("auth", JSON.stringify(obj));
  } catch {}
  localStorage.setItem("accessToken", tok);
}
function getUserIdNum() {
  const raw = localStorage.getItem("userId") ?? localStorage.getItem("userid") ?? "";
  const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function apiFetch(path, init = {}, opts = {}) {
  const { requireUser = false, retryOnAuth = true } = opts;
  const uid = getUserIdNum();
  const token = getAccessToken();

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  const hasJsonBody = init.body && !(init.body instanceof FormData);
  if (hasJsonBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  if (requireUser) {
    if (!uid || !token) throw new Error("로그인이 필요합니다.");
    headers.set("X-User-Id", String(uid));
    headers.set("Authorization", `Bearer ${token}`);
  }

  const doFetch = (h) =>
    fetch(abs(path), {
      ...init,
      headers: h || headers,
      credentials: "omit",
    });

  let resp = await doFetch(headers);
  const expired = resp.status === 401 || resp.headers.get("WWW-Authenticate");

  if (expired && retryOnAuth && requireUser) {
    try {
      const rh = new Headers();
      rh.set("X-User-Id", String(uid));
      if (token) rh.set("Authorization", `Bearer ${token}`);
      const renew = await fetch(abs("/api/user/renew"), {
        method: "POST",
        headers: rh,
        credentials: "omit",
      });
      if (!renew.ok) throw new Error("토큰 갱신 실패");
      let j = null;
      try {
        j = await renew.json();
      } catch {}
      if (!j?.accessToken) throw new Error("토큰 저장 실패");
      saveAccessToken(j.accessToken);

      const retryHeaders = new Headers(init.headers || {});
      retryHeaders.set("Accept", "application/json");
      if (hasJsonBody && !retryHeaders.has("Content-Type"))
        retryHeaders.set("Content-Type", "application/json");
      retryHeaders.set("X-User-Id", String(uid));
      retryHeaders.set("Authorization", `Bearer ${j.accessToken}`);
      resp = await doFetch(retryHeaders);
    } catch (e) {
      alert("다시 로그인해 주세요.");
      throw e;
    }
  }
  return resp;
}

function formatKSTDateTime(iso) {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).format(d);
    const time = new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    return { date, time };
  } catch {
    return { date: "", time: "" };
  }
}

function toImageUrl(posterId) {
  if (posterId == null) return undefined;
  return abs(`/api/image/${posterId}`);
}

function normalizeMDText(s) {
  return String(s ?? "").replace(/<br\s*\/?>/gi, "\n").trim();
}

function mapEventToCardProps(ev) {
  const { date, time } = formatKSTDateTime(ev?.startTime);
  return {
    id: ev.id,
    image: toImageUrl(ev.posterId),
    title: normalizeMDText(ev?.name),
    summary: normalizeMDText(ev?.description),
    hashtags: ev.hashtags || [],
    date,
    time,
    location: ev.address,
    fee: ev.entryFee,
    bookmarkCount: ev.bookmarkCount ?? 0,
  };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchBookmarkCount(eventId) {
  try {
    const r = await apiFetch(`/api/activity/bookmark/count?eventId=${encodeURIComponent(eventId)}`);
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    const n = Number(d?.data ?? d);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

const Spinner = ({ label = "불러오는 중…" }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "14px 16px",
      margin: "8px 16px 12px",
      borderRadius: 12,
      border: "1px solid #e8eaf2",
      background: "#f9fafc",
      color: "#2b2f36",
      fontSize: 14,
    }}
    role="status"
    aria-live="polite"
  >
    <svg width="22" height="22" viewBox="0 0 50 50" aria-hidden="true">
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="31.4 188.4"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 25 25"
          to="360 25 25"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
    <span>{label}</span>
  </div>
);

export default function MainPage() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState("");
  const [geo, setGeo] = useState(null);

  const [recommended, setRecommended] = useState([]);
  const [localPopular, setLocalPopular] = useState([]);
  const [bookmarks, setBookmarks] = useState(new Set());

  const [loadingReco, setLoadingReco] = useState(true);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [aiComment, setAiComment] = useState("");

  const userId = useMemo(() => getUserIdNum(), []);

  const didFetchReco = useRef(false);
  const didFetchLocal = useRef(false);

  const loadUserInfo = useCallback(async () => {
    if (!userId) return null;
    try {
      const qs = new URLSearchParams({ userId: String(userId) }).toString();
      const resp = await apiFetch(`/api/user/info?${qs}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      const name = data?.name || "";
      setUserName(name);
      return { name };
    } catch {
      return null;
    }
  }, [userId]);

  const loadUserLocation = useCallback(async () => {
    if (!userId) return null;
    try {
      const resp = await apiFetch(`/api/user/location/${userId}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      const loc = {
        latitude: data?.latitude ?? null,
        longitude: data?.longitude ?? null,
        address: data?.address ?? "",
      };
      setGeo(loc);
      return loc;
    } catch {
      return null;
    }
  }, [userId]);

  const loadBookmarks = useCallback(async () => {
    if (!userId) {
      setBookmarks(new Set());
      return;
    }
    try {
      const resp = await apiFetch("/api/activity/bookmark/list", {}, { requireUser: true });
      if (!resp.ok) return;
      const list = await resp.json();
      setBookmarks(new Set((list || []).map((b) => Number(b.eventId))));
    } catch {}
  }, [userId]);

  async function fetchPopular(size = 12) {
    const resp = await apiFetch("/api/event/popular");
    if (!resp.ok) return [];
    const list = await resp.json();
    if (Array.isArray(list) && list.length > 0) {
      const any = list.some((e) => (e?.bookmarkCount || 0) > 0);
      if (!any) return [];
      return list.slice(0, size);
    }
    return [];
  }
  async function fetchLatest(size = 12) {
    const qs = new URLSearchParams({
      deadline: "true",
      page: "0",
      size: String(size),
      sort: "createTime,DESC",
    }).toString();
    const resp = await apiFetch(`/api/event?${qs}`);
    if (!resp.ok) return [];
    return (await resp.json()) || [];
  }
  async function fetchRandomFromLatest() {
    const latest = await fetchLatest(60);
    if (!Array.isArray(latest) || latest.length === 0) return [];
    return shuffle(latest).slice(0, 12);
  }

  const loadRecommendedOnce = useCallback(async () => {
    if (didFetchReco.current) return;
    setLoadingReco(true);
    try {
      let events = [];
      let comment = "";

      if (userId) {
        const r = await apiFetch("/api/event/recommend", {}, { requireUser: true });
        if (r.ok) {
          const j = await r.json();
          events = Array.isArray(j?.events) ? j.events : [];
          comment = typeof j?.comment === "string" ? j.comment : "";
        }
      }

      if (!events || events.length === 0) {
        const rnd = await fetchRandomFromLatest();
        if (rnd.length) events = rnd;
        else {
          const pop = await fetchPopular(12);
          events = pop.length ? pop : await fetchLatest(12);
        }
      }

      if (Array.isArray(events) && events.length > 0) {
        setRecommended(events);
      }
      setAiComment(comment || "");
    } finally {
      didFetchReco.current = true;
      setLoadingReco(false);
    }
  }, [userId]);

  const loadLocalPopularOnce = useCallback(
    async (loc) => {
      if (didFetchLocal.current) return;
      setLoadingLocal(true);
      try {
        let list = [];
        const latitude = loc?.latitude ?? geo?.latitude ?? null;
        const longitude = loc?.longitude ?? geo?.longitude ?? null;

        if (latitude != null && longitude != null) {
          const qs = new URLSearchParams({
            deadline: "true",
            latitude: String(latitude),
            longitude: String(longitude),
            page: "0",
            size: "12",
          }).toString();
          const resp = await apiFetch(`/api/event/loc?${qs}`);
          if (resp.ok) list = (await resp.json()) || [];
        }

        if (!list || list.length === 0) {
          const pop = await fetchPopular(12);
          list = pop.length ? pop : await fetchLatest(12);
        }

        if (Array.isArray(list) && list.length > 0) {
          setLocalPopular(list);
        }
      } finally {
        didFetchLocal.current = true;
        setLoadingLocal(false);
      }
    },
    [geo]
  );

  const toggleBookmark = useCallback(async (eventId) => {
    const uid = getUserIdNum();
    if (!uid) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      const resp = await apiFetch(
        "/api/activity/bookmark/toggle",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        },
        { requireUser: true }
      );
      if (resp.status === 401) {
        alert("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      if (!resp.ok) {
        setErrMsg("네트워크 오류가 발생했어요");
        return;
      }

      setBookmarks((prev) => {
        const next = new Set(prev);
        if (next.has(eventId)) next.delete(eventId);
        else next.add(eventId);
        return next;
      });

      const [listResp, cnt] = await Promise.all([
        apiFetch("/api/activity/bookmark/list", {}, { requireUser: true })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetchBookmarkCount(eventId),
      ]);
      if (Array.isArray(listResp)) setBookmarks(new Set(listResp.map((b) => Number(b.eventId))));
      if (cnt != null) {
        setRecommended((prev) =>
          prev.map((it) => (it.id === eventId ? { ...it, bookmarkCount: cnt } : it))
        );
        setLocalPopular((prev) =>
          prev.map((it) => (it.id === eventId ? { ...it, bookmarkCount: cnt } : it))
        );
      }
    } catch {
      setErrMsg("네트워크 오류가 발생했어요");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setErrMsg("");
      const [_, loc] = await Promise.all([loadUserInfo(), loadUserLocation()]);
      await loadBookmarks();
      if (!mounted) return;
      await Promise.all([loadRecommendedOnce(), loadLocalPopularOnce(loc)]);
    })();
    return () => {
      mounted = false;
    };
 
  }, []);

  const myTownLabel = useMemo(() => (geo?.address ? geo.address : "내 주변"), [geo]);
  const onCardClick = useCallback((id) => navigate(`/events/${id}`), [navigate]);

  const recommendedCards = useMemo(() => recommended.map(mapEventToCardProps), [recommended]);
  const localPopularCards = useMemo(() => localPopular.map(mapEventToCardProps), [localPopular]);

  const showRecoSpinner = loadingReco && recommendedCards.length === 0;
  const showLocalSpinner = loadingLocal && localPopularCards.length === 0;

  const noRecoData = !showRecoSpinner && recommendedCards.length === 0;
  const noLocalData = !showLocalSpinner && localPopularCards.length === 0;

  return (
    <Layout pageTitle="홈" activeMenuItem="home">
      <div className="mainpage">
        <section className="mainhero-card">
          <div className="mainhero-text">
            <div className="mainhero-hello">
              <strong>{userName || "회원"}</strong> 님, 반가워요! 👋
            </div>
            <h1 className="mainhero-title">
              <span className="nowrap">
                <span className="eventory brand-strong">Eventory</span>와 함께
              </span>
              <br />
              우리동네 행사에 참여해보세요 🎉
            </h1>
            <p className="mainhero-sub">
              <strong>{userName || "회원"}</strong>님이 좋아하는 테마로 딱 맞는 행사를 추천해드릴게요.
            </p>
          </div>
        </section>

        <SectionHeader
          title={<>🫶 적극 추천 행사</>}
          subtitle={
            userName ? `AI가 “${userName}”님 취향을 분석해 골라드렸어요!` : "AI 추천을 확인해보세요!"
          }
        />
        {showRecoSpinner ? (
          <Spinner label="추천 행사를 불러오는 중…" />
        ) : noRecoData ? (
          <EmptyRow />
        ) : (
          <>
            {aiComment ? (
              <div
                className="ai-comment"
                style={{
                  margin: "8px 16px 0",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#f6f7fb",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "#2b2f36",
                  border: "1px solid #e8eaf2",
                }}
              >
                {aiComment}
              </div>
            ) : null}

            <HorizontalScroller>
              {recommendedCards.map((e, idx) => (
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
                    bookmarked={bookmarks.has(e.id)}
                    bookmarkCount={e.bookmarkCount}
                    onBookmarkToggle={() => toggleBookmark(e.id)}
                    onClick={onCardClick}
                  />
                </div>
              ))}
            </HorizontalScroller>
          </>
        )}

        <SectionHeader
          title={<>🔥 우리동네 인기 행사</>}
          subtitle={`${myTownLabel}의 인기 행사를 만나보세요!`}
          cta={{ label: "전체 행사 보기", onClick: () => navigate("/event-all") }}
          plainLink
        />
        {showLocalSpinner ? (
          <Spinner label="인기 행사를 불러오는 중…" />
        ) : noLocalData ? (
          <EmptyRow notFound />
        ) : (
          <HorizontalScroller>
            {localPopularCards.map((e, idx) => (
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
                  bookmarked={bookmarks.has(e.id)}
                  bookmarkCount={e.bookmarkCount}
                  onBookmarkToggle={() => toggleBookmark(e.id)}
                  onClick={onCardClick}
                />
              </div>
            ))}
          </HorizontalScroller>
        )}

        {errMsg && <p className="neterr">{errMsg}</p>}
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
    </div>
  );
}

function EmptyRow({ notFound = false }) {
  return (
    <div className="empty-row">
      {notFound ? "조건에 맞는 행사가 없어요" : "표시할 데이터가 없어요"}
    </div>
  );
}
