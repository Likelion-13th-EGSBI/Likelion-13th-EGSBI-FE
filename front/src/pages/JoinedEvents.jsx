// src/pages/JoinedEvents.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/eventcard.css";
import "../css/joinedevents.css";
import "../css/review-modal.css";

/* ================================
   API 연결
   ================================ */
const API_BASE = "https://likelion-att.o-r.kr/v1"; // 프록시 쓰면 "" 로
const IMAGE_REQUIRES_AUTH = false; // 이미지 엔드포인트가 인증 필요하면 true

// ---- Auth/Storage 유틸 ----
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
function authHeaders(extra = {}) {
  const token = getAccessToken();
  const uid = getUserId();
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(uid ? { "X-User-Id": String(uid) } : {}),
    ...extra,
  };
}
// 이미지 blob 요청용(불필요한 Accept 제거)
function authHeadersImage(extra = {}) {
  const token = getAccessToken();
  const uid = getUserId();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(uid ? { "X-User-Id": String(uid) } : {}),
    ...extra,
  };
}
async function safeJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/* ================================
   포맷 & 매핑 유틸
   ================================ */
function pad2(n) { return String(n).padStart(2, "0"); }
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtTimeRange(startIso, endIso) {
  if (!startIso && !endIso) return "";
  const s = startIso ? new Date(startIso) : null;
  const e = endIso ? new Date(endIso) : null;
  const toHHMM = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (s && e) return `${toHHMM(s)} - ${toHHMM(e)}`;
  if (s) return `${toHHMM(s)}`;
  if (e) return `${toHHMM(e)}`;
  return "";
}

// ★ 포스터 이미지 URL 규칙
function toPosterUrl(posterId) {
  if (!posterId && posterId !== 0) return "";
  return `${API_BASE}/image/${posterId}`;
}

// Participation → 카드 플레이스홀더(단건조회 전 기본값)
function toSkeletonFromParticipation(eventId) {
  return {
    id: eventId,
    image: "",
    title: `행사 #${eventId}`,
    summary: "참여하신 행사입니다.",
    description: "",
    hashtags: ["참여"],
    date: "",
    time: "",
    location: "",
    fee: "",
    attended: true,
    reviewed: false,
  };
}

// EventDTO → 카드 데이터 매핑
function mapEventDtoToCard(dto) {
  return {
    id: dto?.id,
    image: dto?.posterId ? toPosterUrl(dto.posterId) : "",
    title: dto?.name || `행사 #${dto?.id ?? ""}`,
    summary: dto?.description || "",
    description: dto?.description || "",
    hashtags: dto?.hashtags || [],
    date: fmtDate(dto?.startTime),
    time: fmtTimeRange(dto?.startTime, dto?.endTime),
    location: dto?.address || "",
    fee: typeof dto?.entryFee === "number"
      ? (dto.entryFee === 0 ? "무료" : `${dto.entryFee.toLocaleString()}원`)
      : "",
  };
}

// ---- 별점 ----
const StarRating = ({ value, onChange, size = 28 }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="stars" role="radiogroup" aria-label="별점 선택">
      {[1, 2, 3, 4, 5].map((s) => {
        const active = (hover || value) >= s;
        return (
          <button
            key={s}
            type="button"
            className={`star ${active ? "on" : ""}`}
            aria-checked={value === s}
            role="radio"
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(s)}
            style={{ width: size, height: size, fontSize: size * 0.8 }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};

const PAGE_SIZE = 18;
const canWriteReview = (ev) => ev.attended && !ev.reviewed;

const JoinedEvents = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 서버 원본 목록(Participation→eventId)
  const [baseList, setBaseList] = useState([]); // [{id, ...skeleton}]
  // 페이지네이션/무한스크롤
  const [page, setPage] = useState(1);
  const [slice, setSlice] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef(null);

  // 리뷰 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 상태 override & 캐시
  const [overridesById, setOverridesById] = useState({});
  const [reviewCache, setReviewCache] = useState({});
  const [eventInfoById, setEventInfoById] = useState({});
  const inFlightInfo = useRef(new Set());

  // 쿼리 토큰
  const searchParams = new URLSearchParams(location.search);
  const attendToken =
    searchParams.get("attend_token") || (location.state && location.state.attendToken) || null;

  /* ===== 참여 목록 불러오기 ===== */
  const loadParticipations = useCallback(async () => {
    const uid = getUserId();
    const token = getAccessToken();

    if (!uid || !token) {
      setBaseList([]);
      setSlice([]);
      setHasMore(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/activity/participation/list`, {
        method: "GET",
        headers: authHeaders(),
      });

      const body = await safeJson(res);
      if (!res.ok) throw new Error(`LIST_FAILED ${res.status}`);

      const arr = Array.isArray(body) ? body : [];
      const events = arr.map((p) => toSkeletonFromParticipation(p.eventId));
      setBaseList(events);

      setPage(1);
      const first = events.slice(0, PAGE_SIZE);
      setSlice(first);
      setHasMore(events.length > PAGE_SIZE);
    } catch (e) {
      console.error("[participation/list] 실패:", e);
      setBaseList([]);
      setSlice([]);
      setHasMore(false);
    }
  }, []);

  useEffect(() => { loadParticipations(); }, [loadParticipations]);

  /* ===== 무한 스크롤 ===== */
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    setTimeout(() => {
      const nextPage = page + 1;
      const next = baseList.slice(0, nextPage * PAGE_SIZE);
      setSlice(next);
      setPage(nextPage);
      setHasMore(next.length < baseList.length);
      setLoading(false);
    }, 250);
  }, [loading, hasMore, page, baseList]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      { root: null, rootMargin: "400px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  /* ===== 행사 단건 조회(상세) 캐싱 ===== */
  const ensureEventInfo = useCallback(async (eventId) => {
    if (eventInfoById[eventId]) return;
    if (inFlightInfo.current.has(eventId)) return;
    inFlightInfo.current.add(eventId);

    try {
      const res = await fetch(`${API_BASE}/event/info/${encodeURIComponent(eventId)}`, {
        method: "GET",
        headers: authHeaders(),
      });
      const dto = await safeJson(res);
      if (!res.ok) throw new Error(`EVENT_INFO_FAILED ${res.status}`);

      const mapped = mapEventDtoToCard(dto || {});

      if (IMAGE_REQUIRES_AUTH && dto?.posterId) {
        try {
          const imgRes = await fetch(`${API_BASE}/image/${dto.posterId}`, {
            method: "GET",
            headers: authHeadersImage(),
          });
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            mapped.image = URL.createObjectURL(blob);
          }
        } catch (e) {
          console.warn("이미지 blob 로드 실패:", e);
        }
      }

      setEventInfoById((prev) => ({ ...prev, [eventId]: mapped }));
    } catch (e) {
      console.warn(`[event/info] 실패(eventId=${eventId}):`, e);
    } finally {
      inFlightInfo.current.delete(eventId);
    }
  }, [eventInfoById]);

  useEffect(() => {
    slice.forEach((ev) => {
      if (!eventInfoById[ev.id]) ensureEventInfo(ev.id);
    });
  }, [slice, eventInfoById, ensureEventInfo]);

  /* ===== 리뷰 여부 채우기 ===== */
  const ensureReviewStatus = useCallback(async (eventId) => {
    if (reviewCache[eventId] !== undefined) return;
    try {
      const res = await fetch(
        `${API_BASE}/activity/review/eventlist?eventId=${encodeURIComponent(eventId)}`,
        { method: "GET", headers: authHeaders() }
      );
      const list = await safeJson(res);
      if (!res.ok) throw new Error(`REVIEW_LIST_FAILED ${res.status}`);
      const myId = getUserId();
      const iWrote = Array.isArray(list) && list.some((r) => Number(r?.userId) === myId);
      setReviewCache((prev) => ({ ...prev, [eventId]: !!iWrote }));
      if (iWrote) {
        setOverridesById((prev) => ({
          ...prev,
          [eventId]: { ...(prev[eventId] || {}), reviewed: true },
        }));
      }
    } catch (e) {
      console.warn(`[review/eventlist] 실패(eventId=${eventId}):`, e);
    }
  }, [reviewCache]);

  useEffect(() => {
    slice.forEach((ev) => {
      const merged = overridesById[ev.id] ? { ...ev, ...overridesById[ev.id] } : ev;
      if (!merged.reviewed) ensureReviewStatus(ev.id);
    });
  }, [slice, overridesById, ensureReviewStatus]);

  /* ===== 리뷰 작성 ===== */
  const submitReview = async () => {
    if (!target) return;
    if (rating === 0) return alert("별점을 선택해 주세요.");
    if (!content.trim()) return alert("후기 내용을 입력해 주세요.");
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/activity/review/${encodeURIComponent(target.id)}`,
        {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ content: content.trim(), rating }),
        }
      );
      if (!(res.status === 201 || res.ok)) {
        const txt = await res.text().catch(() => "");
        throw new Error(`REVIEW_CREATE_FAILED ${res.status} ${txt}`);
      }
      setSlice((prev) => prev.map((e) => (e.id === target.id ? { ...e, reviewed: true } : e)));
      setOverridesById((prev) => ({
        ...prev,
        [target.id]: { ...(prev[target.id] || {}), reviewed: true },
      }));
      setReviewCache((prev) => ({ ...prev, [target.id]: true }));
      alert("후기가 등록되었습니다.");
      closeReview();
    } catch (e) {
      console.error(e);
      alert("후기 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ===== QR 토큰: 지금은 비활성화. 토큰만 URL에서 제거 ===== */
  useEffect(() => {
    if (!attendToken) return;
    navigate(location.pathname, { replace: true });
  }, [attendToken, navigate, location.pathname]);

  // 네비/모달
  const goDetail = (id) => navigate(`/events/${id}`);
  const openReview = (ev) => { setTarget(ev); setRating(0); setContent(""); setModalOpen(true); };
  const closeReview = () => { setModalOpen(false); setTarget(null); setRating(0); setContent(""); };

  const uid = getUserId();
  const hasToken = !!getAccessToken();

  return (
    <Layout>
      <div className="events-page is-under-topbar joined-page">
        <header className="page-header joined-header">
          <h1 className="page-title">내가 참여한 행사</h1>
        </header>
        {/* 안내: 로그인 누락 */}
        {!uid || !hasToken ? (
          <div className="inline-alert error">
            로그인 정보가 없어 참여 목록을 불러올 수 없어요. (X-User-Id / Authorization 누락)
          </div>
        ) : null}

        {slice.length > 0 ? (
          <>
            <div className="events-grid">
              {slice.map((ev) => {
                const merged = {
                  ...ev,
                  ...(eventInfoById[ev.id] || {}),
                  ...(overridesById[ev.id] || {}),
                };
                const eligible = canWriteReview(merged);
                return (
                  <div key={ev.id} className="joined-card" aria-label={`${merged.title} 카드`} role="group">
                    <div
                      className="joined-card-tap"
                      role="button"
                      tabIndex={0}
                      onClick={() => goDetail(merged.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goDetail(merged.id); }
                      }}
                      style={{ cursor: "pointer", outline: "none" }}
                    >
                      <EventCard
                        image={merged.image}
                        title={merged.title}
                        summary={merged.summary}
                        hashtags={merged.hashtags?.map((t) => `#${t}`)}
                        date={merged.date}
                        location={merged.location}
                        time={merged.time}
                        fee={merged.fee}
                      />
                    </div>

                    <div className="joined-card-actions">
                      <button
                        type="button"
                        className="btn primary joined-card-action-btn"
                        onClick={(e) => { e.stopPropagation(); openReview(merged); }}
                        disabled={!eligible}
                        aria-disabled={!eligible}
                        aria-label={merged.reviewed ? "리뷰 완료" : "리뷰 작성"}
                        title={
                          eligible ? "리뷰 작성" : merged.reviewed ? "이미 리뷰를 작성했습니다" : "리뷰 작성이 아직 불가합니다"
                        }
                      >
                        {merged.reviewed ? "리뷰 완료" : "리뷰 작성"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div ref={sentinelRef} style={{ height: 1 }} />
            {loading && <div className="events-empty" style={{ padding: "16px 0" }}><div className="title">불러오는 중…</div></div>}
            {!hasMore && <div className="events-empty" style={{ padding: "8px 0" }}><div className="desc">마지막 행사까지 모두 보셨어요.</div></div>}
          </>
        ) : (
          <div className="events-empty simple">
            <div className="emoji" aria-hidden>📅</div>
            <div className="title">표시할 행사가 없어요</div>
            <div className="desc">
              {(!uid || !hasToken)
                ? "로그인 후 다시 시도해 주세요."
                : "참여한 행사가 없거나 아직 참여 처리를 하지 않았을 수 있어요."}
            </div>
          </div>
        )}

        {/* 리뷰 작성 모달 */}
        {modalOpen && target && (
          <div className="review-modal" role="dialog" aria-modal="true" aria-label="리뷰 작성">
            <div className="review-modal__backdrop" onClick={closeReview} />
            <div className="review-modal__panel">
              <div className="review-modal__header">
                <div className="title">리뷰 작성</div>
                <button className="icon-btn" onClick={closeReview} aria-label="닫기">✕</button>
              </div>
              <div className="review-modal__body">
                <div className="event-title">{target.title}</div>

                <label className="field-label">별점</label>
                <StarRating value={rating} onChange={setRating} />

                <label className="field-label" htmlFor="reviewText">후기</label>
                <textarea
                  id="reviewText"
                  className="review-textarea"
                  placeholder="행사에 대한 솔직한 후기를 남겨주세요."
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <div className="review-modal__footer">
                <button className="btn outline" onClick={closeReview} disabled={submitting}>취소</button>
                <button className="btn primary" onClick={submitReview} disabled={submitting}>
                  {submitting ? "제출 중..." : "제출"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default JoinedEvents;