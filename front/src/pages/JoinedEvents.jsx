import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard";
import "../css/eventcard.css";
import "../css/bookmark-joined.css";
import "../css/review-modal.css"; // ← 아래 CSS 파일

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
    attended: true,       // QR 인증 완료 가정
    reviewed: i % 9 === 0 // 일부는 이미 리뷰 작성됨
  };
});
// -------------------------------------------------------

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

const canWriteReview = (ev) => ev.attended && !ev.reviewed; // 필요 시 종료 여부까지 묶을 수 있음

// 간단 별점 컴포넌트
const StarRating = ({ value, onChange, size = 28 }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="stars" role="radiogroup" aria-label="별점 선택">
      {[1,2,3,4,5].map((s) => {
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
            style={{ width:size, height:size, fontSize:size*0.8 }}
          >★</button>
        );
      })}
    </div>
  );
};

const JoinedEvents = () => {
  const navigate = useNavigate();

  const includeClosed = false; // 마감 제외
  const baseList = useMemo(
    () => sortByDateDesc(filterByDeadline(ALL_DUMMY, includeClosed)),
    [includeClosed]
  );

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
      // await fetch(`/api/events/${target.id}/reviews`, { ... });

      // 더미 반영: 작성 완료 처리
      setSlice((prev) => prev.map((e) => (e.id === target.id ? { ...e, reviewed: true } : e)));
      alert("후기가 등록되었습니다.");
      closeReview();
    } catch (e) {
      console.error(e);
      alert("후기 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="events-page is-under-topbar joined-page">
        <div className="events-header">
          <h2 className="events-title">내가 참여한 행사</h2>
        </div>

        {slice.length > 0 ? (
          <>
            <div className="events-grid">
              {slice.map((ev) => {
                const eligible = canWriteReview(ev);
                return (
                  <div
                    key={ev.id}
                    className="joined-card-wrap"
                    aria-label={`${ev.title} 카드`}
                    role="button"
                    tabIndex={0}
                    onClick={() => goDetail(ev.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goDetail(ev.id);
                      }
                    }}
                    style={{ cursor: "pointer", outline: "none", position: "relative" }}
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
                    />

                    {/* 리뷰 작성 버튼 - 카드 우측 하단 플로팅 */}
                    <div className="review-btn-float">
                      <button
                        type="button"
                        className="btn primary"
                        onClick={(e) => {
                          e.stopPropagation(); // 카드 클릭 막기
                          openReview(ev);
                        }}
                        disabled={!eligible}
                        aria-disabled={!eligible}
                        aria-label="리뷰 작성"
                        title={
                          eligible
                            ? "리뷰 작성"
                            : ev.reviewed
                            ? "이미 리뷰를 작성했습니다"
                            : "리뷰 작성이 아직 불가합니다"
                        }
                      >
                        {ev.reviewed ? "리뷰 완료" : "리뷰 작성"}
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
