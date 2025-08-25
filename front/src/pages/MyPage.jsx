import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import "../css/mypage.css";

const BASE_URL = "https://gateway.gamja.cloud";

/* ===== 공통 ===== */
const toImageUrl = (id) => {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${BASE_URL}/api/image/${n}`;
};
const toProfileUrl = (id) => toImageUrl(id);

async function safeJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}
const buildHeaders = () => {
  const token = localStorage.getItem("accessToken") || "";
  const uid = localStorage.getItem("userId") || "";
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(uid ? { "X-User-Id": String(uid) } : {}),
  };
};

/* ===== 별점 ===== */
function coerceNumber(val) {
  if (typeof val === "number") return val;
  if (val == null) return NaN;
  const n = parseFloat(String(val).trim().replace(",", ".").replace(/[^\d.+-]/g, ""));
  return n;
}
function computeStars(r) {
  const n = coerceNumber(r);
  const rating = Math.max(0, Math.min(5, Number.isFinite(n) ? n : 0));
  if (rating >= 5) return { rating, full: 5, hasHalf: false };
  const full = Math.floor(rating);
  const hasHalf = rating > full;
  return { rating, full, hasHalf };
}
function formatRatingLabel(r) {
  const n = coerceNumber(r);
  const rating = Math.max(0, Math.min(5, Number.isFinite(n) ? n : 0));
  return rating.toFixed(1);
}

/* ===== 이벤트 파서 ===== */
const pick = (obj, keys, fallback = undefined) => {
  for (const k of keys) if (obj && obj[k] != null) return obj[k];
  return fallback;
};
const getEventId = (ev) =>
  String(ev?.id ?? ev?.eventId ?? ev?._event?.id ?? ev?._event?.eventId ?? "");

const getEventTitle = (ev) => pick(ev, ["title", "name", "eventName"], "제목 없음");
const getOrganizerName = (ev) => pick(ev, ["organizerName", "hostName", "organizer"], "주최자");
const getImageId = (ev) => pick(ev, ["imageId", "posterId", "thumbnailId"], null);

const asDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};
const getStart = (ev) => asDate(pick(ev, ["startTime", "startAt", "startDateTime", "start_date"]));
const getEnd = (ev) => asDate(pick(ev, ["endTime", "endAt", "endDateTime", "end_date"]));
const getDeadline = (ev) =>
  asDate(pick(ev, ["applyEndAt", "registrationDeadline", "closeTime", "rsvpDeadline"]));

const getVenueText = (ev) => {
  let v = pick(ev, ["place","venue","locationName","placeName","venueName","spot","spotName"]);
  if (!v) {
    const loc = ev?.location;
    if (typeof loc === "string") v = loc;
    else if (loc && typeof loc === "object") {
      v = loc.name || loc.placeName || loc.venueName || loc.addressName || loc.address ||
          [loc.city, loc.district, loc.detail].filter(Boolean).join(" ");
    }
  }
  if (!v) v = pick(ev, ["roadAddress","roadAddressName","address","addressLine","addressDetail","addr"], "");
  return (v || "").toString().trim();
};

const num = (x) => (Number.isFinite(+x) ? +x : NaN);
const getIsFree = (ev) => {
  const v = pick(ev, ["isFree", "free", "freeAdmission"], null);
  if (typeof v === "boolean") return v;
  const p = num(pick(ev, ["price", "fee", "ticketPrice"], NaN));
  return Number.isFinite(p) ? p <= 0 : false;
};
const getPriceMin = (ev) => num(pick(ev, ["minPrice","priceMin","lowestPrice"], NaN));
const getPriceMax = (ev) => num(pick(ev, ["maxPrice","priceMax","highestPrice"], NaN));
const getPriceSingle = (ev) => num(pick(ev, ["price","fee","cost","ticketPrice","admissionFee"], NaN));
const fmtKRW = (v) => Number.isFinite(v)
  ? new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(v)
  : null;
const getFeeLabel = (ev) => {
  if (getIsFree(ev)) return "무료";
  const lo = getPriceMin(ev);
  const hi = getPriceMax(ev);
  const one = getPriceSingle(ev);
  if (Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo) return `${fmtKRW(lo)} ~ ${fmtKRW(hi)}`;
  if (Number.isFinite(one)) return fmtKRW(one);
  if (Number.isFinite(lo)) return `${fmtKRW(lo)}~`;
  if (Number.isFinite(hi)) return `~${fmtKRW(hi)}`;
  const raw = pick(ev, ["priceText","feeText","admission","ticketInfo"], "");
  return raw || "요금정보 없음";
};

const fmtDateTime = (d) =>
  d ? d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "미정";

function getStatusBadge(ev, context) {
  const now = Date.now();
  if (context === "joined") return { text: "참여완료", cls: "badge-done" };
  const end = getEnd(ev);
  const deadline = getDeadline(ev);
  const closed = (deadline && deadline.getTime() < now) || (end && end.getTime() < now);
  if (closed) return { text: "마감", cls: "badge-closed" };
  const start = getStart(ev);
  if (start) {
    const days = Math.ceil((start.getTime() - now) / (1000 * 60 * 60 * 24));
    if (days > 0) return { text: `D-${days}`, cls: "badge-dday" };
    if (days === 0) return { text: "D-DAY", cls: "badge-dday" };
    return { text: "진행중", cls: "badge-live" };
  }
  return { text: "", cls: "" };
}

const MyPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ bookmarks: 0, subscribes: 0, joinedUpcoming: 0, uploads: 0 });
  const [bookmarksAll, setBookmarksAll] = useState([]);
  const [joinedMerged, setJoinedMerged] = useState([]);
  const [uploadsList, setUploadsList] = useState([]);
  const [hostReviewSummary, setHostReviewSummary] = useState("");

  /* 1) 로컬 로그인 체크 */
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    const userId = localStorage.getItem("userId");
    const nicknameLS = localStorage.getItem("nickname") || "";
    if (userEmail && userId) {
      setUser({
        id: userId,
        email: userEmail,
        name: nicknameLS || userEmail.split("@")[0],
        nickname: nicknameLS || "",
        profileId: null,
        avatarUrl: "",
        rating: 0,
      });
    } else {
      navigate("/login");
    }
  }, [navigate]);

  /* 2) 프로필 수정 이벤트 반영 */
  useEffect(() => {
    const handler = (e) => {
      const { nickname, profileId, profileImageUrl } = e.detail || {};
      setUser((prev) => {
        if (!prev) return prev;
        const nextName = (nickname ?? prev.nickname) || prev.name;
        return {
          ...prev,
          nickname: nickname ?? prev.nickname,
          name: nextName,
          profileId: profileId ?? prev.profileId,
          avatarUrl: profileImageUrl ?? (profileId ? toProfileUrl(profileId) : prev.avatarUrl),
        };
      });
    };
    window.addEventListener("user:profileUpdated", handler);
    return () => window.removeEventListener("user:profileUpdated", handler);
  }, []);

  /* 3) 서버 최신 프로필 */
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/user/info?userId=${encodeURIComponent(user.id)}`,
          { headers: buildHeaders(), cache: "no-store" }
        );
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.message || `사용자 정보 조회 실패 (${res.status})`);
        if (!alive) return;

        const nextNick = data?.nickname ?? "";
        const nextProfileId = data?.profileId ?? null;
        setUser((prev) => {
          if (!prev) return prev;
          const nextName = nextNick || prev.nickname || prev.name;
          return {
            ...prev,
            nickname: nextNick || prev.nickname || "",
            name: nextName,
            profileId: nextProfileId,
            avatarUrl: toProfileUrl(nextProfileId),
          };
        });
        localStorage.setItem("nickname", nextNick || "");
      } catch (err) {
        console.error("[user/info] API 오류:", err);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  /* 4) 평균 평점 — 상세 리뷰로 계산 */
  useEffect(() => {
    const fetchRating = async () => {
      if (!user?.id) return;
      try {
        const url = `${BASE_URL}/api/activity/review/all/detail?targetId=${encodeURIComponent(
          user.id
        )}`;
        const res = await fetch(url, { headers: buildHeaders() });
        if (!res.ok) throw new Error(`리뷰 상세 조회 실패 (${res.status})`);
        const data = await safeJson(res);
        const ratings = Array.isArray(data)
          ? data.map((r) => Number(r?.rating)).filter((n) => Number.isFinite(n))
          : [];
        const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        setUser((prev) => (prev ? { ...prev, rating: avg } : prev));
      } catch (err) {
        console.error("[rating] API 오류:", err);
        setUser((prev) => (prev ? { ...prev, rating: 0 } : prev));
      }
    };
    fetchRating();
  }, [user?.id]);

  /* 5) 대시보드 데이터 */
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    setLoading(true);

    const loadBookmarks = async () => {
      const res = await fetch(`${BASE_URL}/api/event/bookmarks`, { headers: buildHeaders() });
      const data = await safeJson(res);
      if (!res.ok) throw new Error("bookmarks fail");
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const key = list[0]?.updatedAt ? "updatedAt" : list[0]?.createdAt ? "createdAt" : list[0]?.startTime ? "startTime" : null;
      const sorted = key ? [...list].sort((a, b) => new Date(b[key]) - new Date(a[key])) : list;
      return sorted;
    };

    const loadSubscriptions = async () => {
      const res = await fetch(`${BASE_URL}/api/user/subscription/getAll`, { headers: buildHeaders() });
      if (!res.ok) throw new Error("subscribes fail");
      const data = await safeJson(res);
      return Array.isArray(data) ? data : Array.isArray(data?.subscriptions) ? data.subscriptions : [];
    };

    const loadParticipationWithEvent = async () => {
      const res = await fetch(`${BASE_URL}/api/activity/participation/list`, { headers: buildHeaders() });
      if (!res.ok) throw new Error("participation fail");
      const plist = await safeJson(res);
      const arr = Array.isArray(plist) ? plist : [];
      const ids = [...new Set(arr.map((p) => p?.eventId).filter(Boolean))];

      const fetchEventInfo = async (id) => {
        const r = await fetch(`${BASE_URL}/api/event/info/${encodeURIComponent(id)}`, { headers: buildHeaders() });
        if (!r.ok) return null;
        const d = await safeJson(r);
        return d?.event || d?.data || d;
      };

      const batch = async (list, size = 5) => {
        const out = [];
        for (let i = 0; i < list.length; i += size) {
          const part = await Promise.all(list.slice(i, i + size).map(fetchEventInfo));
          out.push(...part);
        }
        return out;
      };
      const events = await batch(ids);
      const byId = new Map();
      events.forEach((e) => { if (e?.id || e?.eventId) byId.set(String(e.id ?? e.eventId), e); });

      const merged = arr.map((p) => ({ ...p, _event: byId.get(String(p?.eventId ?? "")) || null }));

      const now = Date.now();
      const upcomingCount = merged.filter((m) => {
        const t = getStart(m._event);
        return t ? t.getTime() >= now : false;
      }).length;

      const sorted = [...merged].sort((a, b) => {
        const ta = getStart(a._event)?.getTime() ?? new Date(a?.joinedAt || 0).getTime();
        const tb = getStart(b._event)?.getTime() ?? new Date(b?.joinedAt || 0).getTime();
        return tb - ta;
      });

      return { merged: sorted, upcomingCount };
    };

    const loadUploads = async (organizerId) => {
      const url = `${BASE_URL}/api/event/${encodeURIComponent(organizerId)}?size=50&page=0&sort=createTime,DESC`;
      const res = await fetch(url, { headers: buildHeaders() });
      if (!res.ok) throw new Error("uploads fail");
      const data = await safeJson(res);
      const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
      const total = typeof data?.totalElements === "number" ? data.totalElements : list.length;
      return { list, total };
    };

    const loadHostReviewSummary = async () => {
      const res = await fetch(`${BASE_URL}/api/ai/review/summary`, { headers: buildHeaders() });
      if (!res.ok) throw new Error("ai summary fail");
      const data = await safeJson(res);
      const text = (typeof data === "string") ? data : (data?.summaryText ?? data?.summary ?? "");
      return (text || "").trim();
    };

    (async () => {
      try {
        const [bm, subs, part, up, hostSum] = await Promise.all([
          loadBookmarks(), loadSubscriptions(), loadParticipationWithEvent(), loadUploads(user.id), loadHostReviewSummary()
        ]);
        if (!alive) return;
        setBookmarksAll(bm);
        setJoinedMerged(part.merged);
        setUploadsList(up.list);
        setKpi({ bookmarks: bm.length, subscribes: subs.length, joinedUpcoming: part.upcomingCount, uploads: up.total });
        setHostReviewSummary(hostSum);
      } catch (err) {
        console.error("[dashboard] load error:", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [user?.id]);

  /* ===== 표시 파생 ===== */
  const email = user?.email || "email@example.com";
  const rawName = user?.name || "";
  const titleName = rawName || (email ? email.split("@")[0] : "사용자");
  const avatarUrl = user?.avatarUrl || "";
  const initial = useMemo(() => (titleName ? titleName[0] : "U"), [titleName]);

  const star = computeStars(user?.rating);
  const ratingLabel = formatRatingLabel(user?.rating);
  const fillValue = useMemo(() => star.full + (star.hasHalf ? 0.5 : 0), [star.full, star.hasHalf]);
  const fillPct = useMemo(() => Math.round((fillValue / 5) * 100), [fillValue]);

  /* ===== 카드 ===== */
  const EventCard = ({ ev, joinedAt, context }) => {
    const eid = getEventId(ev);
    const title = getEventTitle(ev);
    const org = getOrganizerName(ev);
    const start = getStart(ev);
    const end = getEnd(ev);
    const deadline = getDeadline(ev);
    const venue = getVenueText(ev);
    const feeLabel = getFeeLabel(ev);
    const img = toImageUrl(getImageId(ev));
    const badge = getStatusBadge(ev, context);

    return (
      <button className="yt-card" onClick={() => { if (eid) navigate(`/events/${eid}`); }} title={title}>
        <div className={`thumb ${img ? "thumb-hasimg" : ""}`} style={img ? { backgroundImage: `url(${img})` } : undefined}>
          {!img && <div className="thumb-fallback">NO IMAGE</div>}
          {badge.text && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
        </div>

        <div className="ec-title-row">
          {img
            ? <div className="ec-title-avatar" style={{ backgroundImage: `url(${img})` }} />
            : <div className="ec-title-avatar ec-fallback">{(org || "주").toString().slice(0, 1)}</div>}
          <div className="ec-title-text">{title}</div>
        </div>

        <div className="ec-divider" />

        <div className="ec-chips">
          <span className="ec-chip">
            🕒 {fmtDateTime(start)}{end ? ` ~ ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
          {deadline && <span className="ec-chip">⏳ 마감 {fmtDateTime(deadline)}</span>}
          <span className="ec-chip">📍 {venue || "장소 미정"}</span>
          <span className="ec-chip">💳 {feeLabel}</span>
          {joinedAt && <span className="ec-chip">✅ 참여 {new Date(joinedAt).toLocaleDateString()}</span>}
        </div>
      </button>
    );
  };

  /* ===== 핸들러 ===== */
  const handleLogout = () => {
    if (!window.confirm("정말 로그아웃 하시겠습니까?")) return;
    try {
      ["accessToken","userId","userEmail","tokenExpiration","nickname"].forEach(k => localStorage.removeItem(k));
      navigate("/login");
      window.location.reload();
    } catch (e) {
      console.error("로그아웃 처리 중 오류:", e);
      navigate("/login");
    }
  };

  const SectionHead = ({ title, onMore }) => (
    <div className="section-head">
      <h3 className="section-title">{title}</h3>
      <button className="more-btn" onClick={onMore}>더보기</button>
    </div>
  );

  if (!user) {
    return (
      <Layout pageTitle="마이페이지" activeMenuItem="mypage">
        <div className="mypage-page">
          <div className="mypage-loading"><p>사용자 정보를 불러오는 중...</p></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="마이페이지" activeMenuItem="mypage">
      <div className="mypage-page">

        {/* ▶ 모바일 전용: 프로필 요약 (데스크탑에서는 숨김) */}
        <section className="profile-summary-card mobile-only" aria-label="프로필 요약">
          <button className="profile-edit-mini" onClick={() => navigate("/mypage/edit")} title="프로필 수정">프로필 수정</button>

          <div className="profile-summary-left">
            {avatarUrl
              ? <img className="profile-avatar-image" src={avatarUrl} alt={`${titleName} 프로필`} onError={(e) => { e.currentTarget.src = "/imgs/profile-fallback.png"; }} />
              : <div className="profile-avatar" aria-hidden="true">{initial}</div>}
            <div className="profile-meta">
              <h2 className="profile-name">{titleName}</h2>
              <p className="profile-email">{email}</p>

              <div className="mr-inline">
                <span className="mr-inline-title">받은 평점</span>
                <div className="profile-rating compact">
                  <div className="rating-stars overlay" aria-hidden="true" style={{ "--fill": `${(computeStars(user?.rating).full + (computeStars(user?.rating).hasHalf ? 0.5 : 0))}` }} />
                  <span className="rating-value">{ratingLabel}</span>
                </div>
                <div className="mr-meter small">
                  <div className="mr-fill" style={{ "--pct": `${fillPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ▶ 모바일 전용: 호스트 리뷰 요약 */}
        <section className="mobile-host-summary mobile-only">
          <h4>호스트 리뷰 요약</h4>
          <p>{hostReviewSummary || "아직 요약할 리뷰가 없어요"}</p>
        </section>

        {/* 공통(모바일/데스크탑): 대시보드 */}
        <section className="yt-shell">
          <div className="yt-layout">
            <main className="yt-main">

              {/* === 최근 북마크 === */}
              <div className="yt-section">
                <SectionHead
                  title="최근 북마크"
                  onMore={() => navigate("/bookmarks")}
                />

                <div className="card-grid desktop-only">
                  {loading ? (
                    [1,2].map((k) => (
                      <div className="yt-card skeleton" key={`bm-s-${k}`}>
                        <div className="thumb" />
                        <div className="ec-title-row"><div className="ec-title-text" /></div>
                        <div className="ec-divider" />
                        <div className="ec-chips" />
                      </div>
                    ))
                  ) : bookmarksAll.length ? (
                    bookmarksAll.slice(0,2).map((ev, i) => (
                      <EventCard ev={ev} context="bookmarks" key={`bm-${i}`} />
                    ))
                  ) : (
                    <div className="empty-block">최근 북마크가 없어요</div>
                  )}
                </div>

                <div className={`stack-wrap mobile-only ${(!loading && bookmarksAll.length > 1) ? "has-more" : ""}`}>
                  {loading ? (
                    <div className="yt-card skeleton">
                      <div className="thumb" />
                      <div className="ec-title-row"><div className="ec-title-text" /></div>
                      <div className="ec-divider" />
                      <div className="ec-chips" />
                    </div>
                  ) : bookmarksAll.length ? (
                    <EventCard ev={bookmarksAll[0]} context="bookmarks" />
                  ) : (
                    <div className="empty-block">최근 북마크가 없어요</div>
                  )}
                </div>
              </div>

              {/* === 최근 참여 === */}
              <div className="yt-section">
                <SectionHead
                  title="최근 참여"
                  onMore={() => navigate("/joined")}
                />

                <div className="card-grid desktop-only">
                  {loading ? (
                    [1,2].map((k) => (
                      <div className="yt-card skeleton" key={`jn-s-${k}`}>
                        <div className="thumb" />
                        <div className="ec-title-row"><div className="ec-title-text" /></div>
                        <div className="ec-divider" />
                        <div className="ec-chips" />
                      </div>
                    ))
                  ) : joinedMerged.length ? (
                    joinedMerged.slice(0,2).map((m, i) => (
                      <EventCard ev={m._event || {}} joinedAt={m.joinedAt} context="joined" key={`jn-${i}`} />
                    ))
                  ) : (
                    <div className="empty-block">최근 참여 내역이 없어요</div>
                  )}
                </div>

                <div className={`stack-wrap mobile-only ${(!loading && joinedMerged.length > 1) ? "has-more" : ""}`}>
                  {loading ? (
                    <div className="yt-card skeleton">
                      <div className="thumb" />
                      <div className="ec-title-row"><div className="ec-title-text" /></div>
                      <div className="ec-divider" />
                      <div className="ec-chips" />
                    </div>
                  ) : joinedMerged.length ? (
                    <EventCard ev={joinedMerged[0]._event || {}} joinedAt={joinedMerged[0].joinedAt} context="joined" />
                  ) : (
                    <div className="empty-block">최근 참여 내역이 없어요</div>
                  )}
                </div>
              </div>

              {/* === 내가 등록한 행사 === */}
              <div className="yt-section">
                <SectionHead
                  title="내가 등록한 행사"
                  onMore={() => navigate("/my-upload-event")}
                />

                <div className="card-grid desktop-only">
                  {loading ? (
                    [1,2].map((k) => (
                      <div className="yt-card skeleton" key={`up-s-${k}`}>
                        <div className="thumb" />
                        <div className="ec-title-row"><div className="ec-title-text" /></div>
                        <div className="ec-divider" />
                        <div className="ec-chips" />
                      </div>
                    ))
                  ) : uploadsList.length ? (
                    uploadsList.slice(0,2).map((ev, i) => (
                      <EventCard ev={ev} context="uploaded" key={`up-${i}`} />
                    ))
                  ) : (
                    <div className="empty-block">등록한 행사가 아직 없어요</div>
                  )}
                </div>

                <div className={`stack-wrap mobile-only ${(!loading && uploadsList.length > 1) ? "has-more" : ""}`}>
                  {loading ? (
                    <div className="yt-card skeleton">
                      <div className="thumb" />
                      <div className="ec-title-row"><div className="ec-title-text" /></div>
                      <div className="ec-divider" />
                      <div className="ec-chips" />
                    </div>
                  ) : uploadsList.length ? (
                    <EventCard ev={uploadsList[0]} context="uploaded" />
                  ) : (
                    <div className="empty-block">등록한 행사가 아직 없어요</div>
                  )}
                </div>
              </div>

            </main>

            {/* ▶ 데스크탑 전용 우측 레일 (여기에 ‘프로필 수정’ 버튼 추가) */}
            <aside className="yt-rail desktop-only" aria-label="마이페이지 빠른 메뉴">
              <div className="rail-edit">
                <button
                  className="rail-edit-btn"
                  onClick={() => navigate("/mypage/edit")}
                  title="프로필 수정"
                >
                  프로필 수정
                </button>
              </div>

              <div className="rail-card">
                <h4 className="rail-title">내 지표</h4>
                <div className="kpi-list">
                  <div className="kpi-row"><span className="kpi-icon">🔖</span><span className="kpi-label">북마크</span><span className="kpi-count">{kpi.bookmarks}</span></div>
                  <div className="kpi-row"><span className="kpi-icon">👥</span><span className="kpi-label">구독</span><span className="kpi-count">{kpi.subscribes}</span></div>
                  <div className="kpi-row"><span className="kpi-icon">✅</span><span className="kpi-label">다가오는 참여</span><span className="kpi-count">{kpi.joinedUpcoming}</span></div>
                  <div className="kpi-row"><span className="kpi-icon">📌</span><span className="kpi-label">등록한 행사</span><span className="kpi-count">{kpi.uploads}</span></div>
                </div>
              </div>

              <div className="rail-card">
                <h4 className="rail-title">호스트 리뷰 요약</h4>
                <div className="rail-summary">{hostReviewSummary || "아직 요약할 리뷰가 없어요"}</div>
              </div>
            </aside>
          </div>
        </section>

        {/* ▶ 모바일 전용: 로그아웃 */}
        <section className="logout-section mobile-only" aria-label="로그아웃">
          <button className="logout-button" onClick={handleLogout}>↪ 로그아웃</button>
        </section>
      </div>
    </Layout>
  );
};

export default MyPage;
