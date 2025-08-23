import React from "react";
import "../css/eventcard.css";
import {
  FaRegHeart,
  FaHeart,
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaWonSign,
} from "react-icons/fa";

// HTML 엔티티 디코딩(상세/해시태그 등 평문에만 사용)
const decodeHTML = (html) => {
  const txt = document.createElement("textarea");
  txt.innerHTML = html ?? "";
  return txt.value;
};

/* ========== 최소 Markdown → 안전한 HTML ========== */
// 1) HTML 이스케이프
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
// 2) URL 화이트리스트
function isSafeUrl(url) {
  try {
    const u = new URL(url, document.baseURI);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol);
  } catch {
    return false;
  }
}
// 3) 인라인 마크다운 처리
function mdInline(input = "") {
  let s = escapeHtml(input);

  // 링크 [text](url)
  s = s.replace(/\[([^[\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    return isSafeUrl(url)
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
      : escapeHtml(text);
  });

  // 코드 `code`
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);

  // 굵게 **bold**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 취소선 ~~del~~
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // 기울임 *em* 또는 _em_
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).]|$)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).]|$)/g, "$1<em>$2</em>");

  return s;
}

// 4) 블록(요약) 처리: 헤딩/목록/줄바꿈
function mdBlock(input = "") {
  const lines = String(input).split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    // 헤딩
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(
        `<span class="md-h${level}"><strong>${mdInline(h[2])}</strong></span>`
      );
      continue;
    }

    // 순서/비순서 목록(간단 표시)
    const ul = /^\s*[-*]\s+(.+)$/.exec(line);
    if (ul) {
      out.push(`• ${mdInline(ul[1])}`);
      continue;
    }
    const ol = /^\s*(\d+)\.\s+(.+)$/.exec(line);
    if (ol) {
      out.push(`${ol[1]}. ${mdInline(ol[2])}`);
      continue;
    }

    // 일반 문장
    out.push(mdInline(line));
  }

  // 줄바꿈은 <br>로
  return out.join("<br>");
}

// 렌더러
const MarkdownInline = ({ text }) => (
  <span dangerouslySetInnerHTML={{ __html: mdInline(text) }} />
);
const MarkdownBlock = ({ text }) => (
  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: mdBlock(text) }} />
);

const EventCard = ({
  id,
  image,
  title,
  summary,
  hashtags = [],
  date,
  location,
  time,
  fee,
  bookmarked = false,
  bookmarking = false,
  onBookmarkToggle,
  onClick,
}) => {
  const handleCardClick = () => {
    if (typeof onClick === "function") onClick(id);
  };

  const handleBookmarkClick = (e) => {
    e.stopPropagation();
    if (bookmarking) return;
    if (typeof onBookmarkToggle === "function") onBookmarkToggle();
  };

  return (
    <div
      className="event-card"
      onClick={handleCardClick}
      role={typeof onClick === "function" ? "button" : undefined}
      tabIndex={typeof onClick === "function" ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* 북마크 버튼 */}
      <button
        type="button"
        className={`bookmark-btn ${bookmarked ? "bookmarked" : ""}`}
        onClick={handleBookmarkClick}
        aria-label={bookmarked ? "북마크 해제" : "북마크"}
        aria-pressed={bookmarked}
        disabled={bookmarking}
        title={bookmarking ? "처리 중..." : bookmarked ? "북마크 해제" : "북마크"}
      >
        {bookmarked ? <FaHeart className="icon" /> : <FaRegHeart className="icon" />}
      </button>

      {/* 이미지 or 기본 배경 */}
      <div
        className="event-image"
        style={{ background: image ? `url(${image}) center/cover no-repeat` : "#5E936C" }}
      >
        {!image && <span className="placeholder-text">No Image</span>}
      </div>

      {/* 행사 정보 */}
      <div className="event-info">
        {/* 제목: 인라인 마크다운 */}
        <h3 className="event-title">
          <MarkdownInline text={title} />
        </h3>

        {/* 요약: 블록 마크다운 */}
        <div className="event-summary">
          <MarkdownBlock text={summary} />
        </div>

        {/* 해시태그 */}
        <div className="hashtags">
          {hashtags.map((tag, index) => (
            <span key={index} className="hashtag">#{decodeHTML(tag)}</span>
          ))}
        </div>

        {/* 상세 정보 (2x2) — 평문 유지 */}
        <div className="event-details">
          <div className="detail-item">
            <FaCalendarAlt /> <span>{decodeHTML(date)}</span>
          </div>
          <div className="detail-item">
            <FaClock /> <span>{decodeHTML(time)}</span>
          </div>
          <div className="detail-item">
            <FaMapMarkerAlt /> <span>{decodeHTML(location)}</span>
          </div>
          <div className="detail-item">
            <FaWonSign /> <span>{decodeHTML(fee)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
