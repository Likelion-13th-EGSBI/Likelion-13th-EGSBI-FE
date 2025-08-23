import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/mainpage.css";


const API_BASE = 'https://gateway.gamja.cloud';

function abs(path) {
  if (!path) return path;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

/** 공통 fetch: 공개 API는 헤더 없음, 사용자 API만 X-User-Id. 401/WWW-Authenticate 시 /api/user/renew 후 1회 재시도 */
async function apiFetch(path, init = {}, opts = {}) {
  const { requireUser = false, retryOnAuth = true } = opts;
  const raw = localStorage.getItem("userId");
  const uid = Number(raw);

  const headers = new Headers(init.headers || {});
  if (requireUser) {
    if (!Number.isFinite(uid)) throw new Error("로그인이 필요합니다.");
    headers.set("X-User-Id", String(uid));
  }
  headers.set("Accept", "application/json");

  const doFetch = (h) =>
    fetch(abs(path), {
      ...init,
      headers: h || headers,
      credentials: "include", // 쿠키 세션 동반
    });

  let resp = await doFetch(headers);
  const expired = resp.status === 401 || resp.headers.get("WWW-Authenticate");

  if (expired && retryOnAuth && requireUser) {
    try {
      const rHeaders = new Headers();
      rHeaders.set("X-User-Id", String(uid));
      const renew = await fetch(abs("/api/user/renew"), {
        method: "POST",
        headers: rHeaders,
        credentials: "include",
      });
      if (!renew.ok) throw new Error("토큰 갱신 실패");
      const j = await renew.json();
      if (!j?.accessToken) throw new Error("토큰 저장 실패");
      localStorage.setItem("accessToken", j.accessToken);

      const retryHeaders = new Headers(init.headers || {});
      retryHeaders.set("X-User-Id", String(uid));
      retryHeaders.set("Accept", "application/json");
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

function mapEventToCardProps(ev) {
  const { date, time } = formatKSTDateTime(ev?.startTime);
  return {
    id: ev.id,
    image: toImageUrl(ev.posterId),
    title: ev.name,
    summary: ev.description,
    hashtags: ev.hashtags || [],
    date,
    time,
    location: ev.address,
    fee: ev.entryFee,
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

export default function MainPage() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState("");
  const [geo, setGeo] = useState(null);
  const [recommended, setRecommended] = useState([]);
  const [localPopular, setLocalPopular] = useState([]);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [errMsg, setErrMsg] = useState("");

  const userId = useMemo(() => localStorage.getItem("userId"), []);

  const loadUserInfo = useCallback(async () => {
    if (!userId) return;
    try {
      const qs = new URLSearchParams({ userId: String(userId) }).toString();
      const resp = await apiFetch(`/api/user/info?${qs}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setUserName(data?.name || "");
    } catch {}
  }, [userId]);

  const loadUserLocation = useCallback(async () => {
    if (!userId) return;
    try {
      const resp = await apiFetch(`/api/user/location/${userId}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setGeo({ latitude: data?.latitude, longitude: data?.longitude, address: data?.address });
    } catch {}
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
      setBookmarks(new Set((list || []).map((b) => b.eventId)));
    } catch {}
  }, [userId]);

  async function fetchPopular(size = 12) {
    const resp = await apiFetch("/api/event/popular");
    if (!resp.ok) return [];
    const list = await resp.json();
    if (Array.isArray(list) && list.length > 0) {
      const any = list.some((e) => (e?.bookmarkCount || 0) > 0);
      if (!any) return []; // 북마크 집계가 전부 0 → 최신으로 폴백
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

  const loadRecommended = useCallback(async () => {
    try {
      if (userId) {
        const r = await apiFetch("/api/event/recommend", {}, { requireUser: true });
        if (r.ok) {
          const j = await r.json();
          const events = Array.isArray(j?.events) ? j.events : [];
          if (events.length) {
            setRecommended(events);
            return;
          }
        }
      }
      const rnd = await fetchRandomFromLatest();
      if (rnd.length) {
        setRecommended(rnd);
        return;
      }
      const pop = await fetchPopular(12);
      if (pop.length) setRecommended(pop);
      else setRecommended(await fetchLatest(12));
    } catch {
      const rnd = await fetchRandomFromLatest();
      if (rnd.length) setRecommended(rnd);
      else {
        const pop = await fetchPopular(12);
        setRecommended(pop.length ? pop : await fetchLatest(12));
      }
    }
  }, [userId]);

  const loadLocalPopular = useCallback(async () => {
    try {
      if (geo?.latitude != null && geo?.longitude != null) {
        const qs = new URLSearchParams({
          deadline: "true",
          latitude: String(geo.latitude),
          longitude: String(geo.longitude),
          page: "0",
          size: "12",
        }).toString();
        const resp = await apiFetch(`/api/event/loc?${qs}`);
        if (resp.ok) {
          const list = await resp.json();
          if (Array.isArray(list) && list.length > 0) {
            setLocalPopular(list);
            return;
          }
        }
      }
      const pop = await fetchPopular(12);
      if (pop.length) setLocalPopular(pop);
      else setLocalPopular(await fetchLatest(12));
    } catch {
      const pop = await fetchPopular(12);
      if (pop.length) setLocalPopular(pop);
      else setLocalPopular(await fetchLatest(12));
    }
  }, [geo]);

  const toggleBookmark = useCallback(
    async (eventId) => {
      const raw = localStorage.getItem("userId");
      if (!Number.isFinite(Number(raw))) {
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

        // 서버 상태와 재동기화(실패 무시)
        apiFetch("/api/activity/bookmark/list", {}, { requireUser: true })
          .then((r) => (r.ok ? r.json() : null))
          .then((list) => {
            if (Array.isArray(list)) setBookmarks(new Set(list.map((b) => b.eventId)));
          })
          .catch(() => {});
      } catch {
        setErrMsg("네트워크 오류가 발생했어요");
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setErrMsg("");
      await Promise.all([loadUserInfo(), loadUserLocation(), loadBookmarks()]);
      await Promise.all([loadRecommended(), loadLocalPopular()]);
      if (!mounted) return;
      if (recommended.length === 0 && localPopular.length === 0) {
        setErrMsg("네트워크 오류가 발생했어요");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadUserInfo, loadUserLocation, loadBookmarks, loadRecommended, loadLocalPopular]); // eslint OK

  const myTownLabel = useMemo(() => (geo?.address ? geo.address : "내 주변"), [geo]);
  const onCardClick = useCallback((id) => navigate(`/events/${id}`), [navigate]);

  const recommendedCards = useMemo(() => recommended.map(mapEventToCardProps), [recommended]);
  const localPopularCards = useMemo(() => localPopular.map(mapEventToCardProps), [localPopular]);

  const noRecoData = recommendedCards.length === 0;
  const noLocalData = localPopularCards.length === 0;

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
          subtitle={userName ? `AI가 “${userName}”님 취향을 분석해 골라드렸어요!` : "AI 추천을 확인해보세요!"}
        />
        {noRecoData ? (
          <EmptyRow />
        ) : (
          <HorizontalScroller>
            {recommendedCards.map((e, idx) => (
              <div className="hcell fade-slide-in" style={{ animationDelay: `${idx * 40}ms` }} key={e.id}>
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
                  onBookmarkToggle={() => toggleBookmark(e.id)}
                  onClick={onCardClick}
                />
              </div>
            ))}
          </HorizontalScroller>
        )}

        <SectionHeader
          title={<>🔥 우리동네 인기 행사</>}
          subtitle={`${myTownLabel}의 인기 행사를 만나보세요!`}
          cta={{ label: "전체 행사 보기", onClick: () => navigate("/event-all") }}
          plainLink
        />
        {noLocalData ? (
          <EmptyRow notFound />
        ) : (
          <HorizontalScroller>
            {localPopularCards.map((e, idx) => (
              <div className="hcell fade-slide-in" style={{ animationDelay: `${idx * 40}ms` }} key={e.id}>
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
  return <div className="empty-row">{notFound ? "조건에 맞는 행사가 없어요" : "표시할 데이터가 없어요"}</div>;
}
