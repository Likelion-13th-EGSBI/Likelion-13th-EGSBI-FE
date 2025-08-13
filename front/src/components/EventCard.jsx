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
  bookmarked,
  onBookmarkToggle,
  onClick,
}) => {
  return (
    <div
      className="event-card"
      onClick={typeof onClick === "function" ? () => onClick(id) : undefined}
      role={typeof onClick === "function" ? "button" : undefined}
      tabIndex={typeof onClick === "function" ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(id);
        }
      }}
    >
      {/* 북마크 버튼 */}
      <button
        className={`bookmark-btn ${bookmarked ? "bookmarked" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onBookmarkToggle && onBookmarkToggle();
        }}
        aria-label="bookmark"
      >
        {bookmarked ? <FaHeart className="icon" /> : <FaRegHeart className="icon" />}
      </button>

      {/* 이미지 or 기본 배경 */}
      <div
        className="event-image"
        style={{
          background: image ? `url(${image}) center/cover no-repeat` : "#5E936C",
        }}
      >
        {!image && <span className="placeholder-text">No Image</span>}
      </div>

      {/* 행사 정보 */}
      <div className="event-info">
        <h3 className="event-title">{title}</h3>
        <p className="event-summary">{summary}</p>

        {/* 해시태그 */}
        <div className="hashtags">
          {hashtags.map((tag, index) => (
            <span key={index} className="hashtag">
              #{tag}
            </span>
          ))}
        </div>

        {/* 상세 정보 (2x2) */}
        <div className="event-details">
          <div className="detail-item">
            <FaCalendarAlt /> <span>{date}</span>
          </div>
          <div className="detail-item">
            <FaClock /> <span>{time}</span>
          </div>
          <div className="detail-item">
            <FaMapMarkerAlt /> <span>{location}</span>
          </div>
          <div className="detail-item">
            <FaWonSign /> <span>{fee}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
