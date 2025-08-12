import React from "react";
import "../css/notification.css";


const notifications = [
  {
    id: 1,
    title: "행사 참여가 확정되었습니다",
    message: "OOO 행사에 성공적으로 참여 신청되었습니다.",
    date: "2025-08-12",
    read: false,
  },
  {
    id: 2,
    title: "새로운 댓글이 달렸습니다",
    message: "당신의 게시물에 새로운 댓글이 있습니다.",
    date: "2025-08-11",
    read: true,
  },
];

const NotificationPage = () => {
  return (
    <div className="notification-page">
      {/* 상단바 */}
      <header className="notification-header">
        <h2>알림</h2>
        <button className="more-btn">⋮</button>
      </header>

      {/* 알림 리스트 */}
      <ul className="notification-list">
        {notifications.map((noti) => (
          <li
            key={noti.id}
            className={`notification-item ${!noti.read ? "unread" : ""}`}
          >
            <div className="noti-icon">🔔</div>
            <div className="noti-content">
              <h4>{noti.title}</h4>
              <p>{noti.message}</p>
              <span className="noti-date">{noti.date}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationPage;
