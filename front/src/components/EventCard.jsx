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

// HTML 엔티티 디코딩 함수
const decodeHTML = (html) => {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

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
  bookmarked = false,   // 하트 상태
  bookmarking = false,  // 토글 중(선택)
  onBookmarkToggle,     // 부모에서 전달
  onClick,              // 카드 클릭(상세 이동)
}) => {
  const handleCardClick = () => {
    if (typeof onClick === "function") onClick(id);
  };

  const handleBookmarkClick = (e) => {
    e.stopPropagation();           // 카드 클릭 전파 방지
    if (bookmarking) return;       // 토글 중 무시
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
        title={bookmarking ? "처리 중..." : (bookmarked ? "북마크 해제" : "북마크")}
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
        <h3 className="event-title">{decodeHTML(title)}</h3>
        <p className="event-summary">{decodeHTML(summary)}</p>

        {/* 해시태그 */}
        <div className="hashtags">
          {hashtags.map((tag, index) => (
            <span key={index} className="hashtag">#{decodeHTML(tag)}</span>
          ))}
        </div>

        {/* 상세 정보 (2x2) */}
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
