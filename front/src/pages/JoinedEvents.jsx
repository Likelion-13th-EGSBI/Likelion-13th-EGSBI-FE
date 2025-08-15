import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/eventcard.css";
import "../css/joinedevents.css";
import "../css/review-modal.css";

/* ================================
   API 연결 준비(ENV 없이도 안전)
   - 실제 연동 시 ENABLE_QR_VERIFY 를 true로
   - fetch 주석 해제하고 API_BASE 필요시 채우기
   ================================ */
const API_BASE = "";              // 같은 도메인 프록시라면 비워두세요 (예: "/api/...")
const ENABLE_QR_VERIFY = false;   // ← 나중에 true로 바꾸면 QR 검증 동작

// --------- 더미 데이터: 15개 ----------
const ALL_DUMMY = Array.from({ length: 15 }, (_, i) => {
  const endPast = i % 7 === 0;
  return {
    id: 10_000 + i + 1,
    image: "",
    imageUrl: "",
    title: `내가 참여한 행사 ${i + 1}`,
    summary: `참여한 행사 ${i + 1}의 간단 설명입니다.`,
    description: "행사 상세(더미). 실제에선 서버에서 받아옵니다.",
    hashtags: ["참여", "커뮤니티"],
    date: `2025-09-${((i % 28) + 1).toString().padStart(2, "0")}`,
    endDate: endPast
      ? "2025-07-31"
      : `2025-12-${((i % 27) + 1).toString().padStart(2, "0")}`,
    time: "14:00 - 17:00",
    location: i % 2 ? "서울 강남구" : "부산 해운대구",
    fee: i % 2 === 0 ? "무료" : `${(5000 + (i % 5) * 1000).toLocaleString()}원`,
    ownerId: 123,
    ownerName: "라이언 스튜디오",
    ownerProfile: null,
    attended: true,       // ← 배포 테스트용 더미. QR 게이팅 테스트하려면 false로 바꿔보세요.
    reviewed: i % 9 === 0 // 일부는 이미 리뷰 작성됨
  };
});

// ----- 유틸 -----
const filterByDeadline = (arr, includeClosed = false) => {
  const today = new Date(); today.setHours(0,0,0,0);
  if (includeClosed) return arr;
  return arr.filter((e) => {
    const end = new Date(e.endDate || e.date); end.setHours(0,0,0,0);
    return +end >= +today;
  });
};
const sortByDateDesc = (arr) =>
  [...arr].sort((a, b) => new Date(b.date) - new Date(a.date));
const PAGE_SIZE = 18;

const canWriteReview = (ev) => ev.attended && !ev.reviewed;

/* ================================
   (준비만) 참석 인증 API 래퍼
   - 현재는 비활성(ENABLE_QR_VERIFY=false)
   - 실제 연결 시 fetch 주석 해제
   ================================ */
async function verifyAttendanceToken(attendToken) {
  if (!ENABLE_QR_VERIFY) return null;

  // ▼ 실제 API 나오면 이 블록의 주석을 해제하세요.
  /*
  const res = await fetch(
    `${API_BASE}/api/attendance/verify?token=${encodeURIComponent(attendToken)}`,
    {
      method: "GET", // 필요 시 "POST"
      headers: { "Content-Type": "application/json" },
      credentials: "include", // 쿠키 인증 시
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VERIFY_FAILED ${res.status} ${text}`);
  }
  // 기대 응답: { ok: true, eventId, alreadyAttended, reviewed }
  return await res.json();
  */

  return null;
}

// ----- 간단 별점 컴포넌트 (로컬 정의) -----
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

const JoinedEvents = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 기본 목록
  const includeClosed = false; // 마감 제외
  const baseList = useMemo(
    () => sortByDateDesc(filterByDeadline(ALL_DUMMY, includeClosed)),
    [includeClosed]
  );

  // 페이지네이션/무한스크롤
  const [page, setPage] = useState(1);
  const [slice, setSlice] = useState(() => baseList.slice(0, PAGE_SIZE));
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(baseList.length > PAGE_SIZE);
  const sentinelRef = useRef(null);

  // 리뷰 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 참석 인증 결과를 UI에 반영하기 위한 override 맵 (id -> partial)
  const [overridesById, setOverridesById] = useState({});
  // QR 검증 상태 배너
  const [verifyState, setVerifyState] = useState({
    phase: "idle", // idle|checking|success|error
    message: "",
    eventId: null,
  });

  // 쿼리/상태에서 토큰 추출 (둘 다 지원)
  const searchParams = new URLSearchParams(location.search);
  const attendToken =
    searchParams.get("attend_token") || (location.state && location.state.attendToken) || null;

  // 기본 목록이 바뀌면 페이지 초기화
  useEffect(() => {
    setPage(1);
    setSlice(baseList.slice(0, PAGE_SIZE));
    setHasMore(baseList.length > PAGE_SIZE);
  }, [baseList]);

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
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "400px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const goDetail = (id) => navigate(`/events/${id}`);

  const openReview = (ev) => {
    setTarget(ev);
    setRating(0);
    setContent("");
    setModalOpen(true);
  };
  const closeReview = () => {
    setModalOpen(false);
    setTarget(null);
    setRating(0);
    setContent("");
  };

  const submitReview = async () => {
    if (!target) return;
    if (rating === 0) { alert("별점을 선택해 주세요."); return; }
    if (!content.trim()) { alert("후기 내용을 입력해 주세요."); return; }
    setSubmitting(true);
    try {
      // 실제 API 연동 지점
      // await fetch(`${API_BASE}/api/events/${target.id}/reviews`, { ... });

      // 더미 반영: 작성 완료 처리
      setSlice((prev) => prev.map((e) => (e.id === target.id ? { ...e, reviewed: true } : e)));
      setOverridesById((prev) => ({
        ...prev,
        [target.id]: { ...(prev[target.id] || {}), reviewed: true },
      }));
      alert("후기가 등록되었습니다.");
      closeReview();
    } catch (e) {
      console.error(e);
      alert("후기 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // ===== QR 참석 인증 처리 (현재 비활성: ENABLE_QR_VERIFY=false) =====
  useEffect(() => {
    let cancelled = false;
    async function runVerify() {
      if (!attendToken) return;

      // 플래그 꺼져있으면: 토큰은 조용히 제거만(중복 검증 방지)
      if (!ENABLE_QR_VERIFY) {
        navigate(location.pathname, { replace: true });
        return;
      }

      setVerifyState({ phase: "checking", message: "참석 인증 확인 중…", eventId: null });

      try {
        const res = await verifyAttendanceToken(attendToken); // 현재는 null 반환
        if (cancelled) return;

        if (!res || !res.ok) {
          setVerifyState({ phase: "error", message: "참석 인증에 실패했어요.", eventId: null });
        } else {
          const { eventId, reviewed, alreadyAttended } = res;
          setOverridesById((prev) => ({
            ...prev,
            [eventId]: { ...(prev[eventId] || {}), attended: true, reviewed: !!reviewed },
          }));
          setVerifyState({
            phase: "success",
            message: alreadyAttended ? "이미 참석 인증된 행사예요." : "참석 인증 완료!",
            eventId,
          });
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setVerifyState({ phase: "error", message: "참석 인증에 실패했어요.", eventId: null });
        }
      } finally {
        if (!cancelled) {
          // URL 정리
          navigate(location.pathname, { replace: true });
          // 배너 자동 숨김
          setTimeout(() => {
            if (!cancelled) setVerifyState((s) => ({ ...s, phase: "idle", message: "" }));
          }, 2400);
        }
      }
    }
    runVerify();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendToken]);

  return (
    <Layout>
      <div className="events-page is-under-topbar joined-page">
        {/* QR 배너: 플래그 켜졌을 때만 의미가 있음 */}
        {ENABLE_QR_VERIFY && verifyState.phase !== "idle" && (
          <div
            role="status"
            aria-live="polite"
            style={{
              margin: "8px 12px 0",
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              background:
                verifyState.phase === "checking"
                  ? "#F3F4F6"
                  : verifyState.phase === "success"
                  ? "#E8F5E9"
                  : "#FDECEA",
              color:
                verifyState.phase === "checking"
                  ? "#374151"
                  : verifyState.phase === "success"
                  ? "#2E7D32"
                  : "#C62828",
              border:
                verifyState.phase === "checking"
                  ? "1px solid #e5e7eb"
                  : verifyState.phase === "success"
                  ? "1px solid #c8e6c9"
                  : "1px solid #f5c6cb",
            }}
          >
            {verifyState.message}
          </div>
        )}

        {slice.length > 0 ? (
          <>
            <div className="events-grid">
              {slice.map((ev) => {
                // 참석 인증/리뷰 상태를 overrides로 병합해서 사용
                const merged = overridesById[ev.id]
                  ? { ...ev, ...overridesById[ev.id] }
                  : ev;

                const eligible = canWriteReview(merged);
                return (
                  <div
                    key={ev.id}
                    className="joined-card"
                    aria-label={`${merged.title} 카드`}
                    role="group"
                  >
                    {/* 카드 탭 영역(상세 이동) */}
                    <div
                      className="joined-card-tap"
                      role="button"
                      tabIndex={0}
                      onClick={() => goDetail(merged.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goDetail(merged.id);
                        }
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

                    {/* 하단 액션 */}
                    <div className="joined-card-actions">
                      <button
                        type="button"
                        className="btn primary joined-card-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReview(merged);
                        }}
                        disabled={!eligible}
                        aria-disabled={!eligible}
                        aria-label={merged.reviewed ? "리뷰 완료" : "리뷰 작성"}
                        title={
                          eligible
                            ? "리뷰 작성"
                            : merged.reviewed
                            ? "이미 리뷰를 작성했습니다"
                            : "리뷰 작성이 아직 불가합니다"
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

            {loading && (
              <div className="events-empty" style={{ padding: "16px 0" }}>
                <div className="title">불러오는 중…</div>
              </div>
            )}
            {!hasMore && (
              <div className="events-empty" style={{ padding: "8px 0" }}>
                <div className="desc">마지막 행사까지 모두 보셨어요.</div>
              </div>
            )}
          </>
        ) : (
          <div className="events-empty">
            <div className="emoji">🗓️</div>
            <div className="title">표시할 행사가 없어요</div>
            <div className="desc">마감 제외 옵션으로 인해 비어있을 수 있어요.</div>
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
                <button className="btn outline" onClick={closeReview} disabled={submitting}>
                  취소
                </button>
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
