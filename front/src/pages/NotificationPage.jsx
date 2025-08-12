import React, { useMemo, useState } from "react";
import Layout from "../components/Layout";
import "../css/notification.css";

// 샘플 데이터
const MOCK_NOTIFICATIONS = [
  { id: 101, type: "event",      icon: "🎉", title: "행사 참여가 확정되었어요", message: "‘전통시장 야간 페스티벌’ 참여가 확정되었습니다.", time: "2025-08-12T15:20:00+09:00", read: false },
  { id: 102, type: "subscribe",  icon: "🔔", title: "새 글이 올라왔어요",       message: "‘청년문화센터’가 새로운 행사 공지를 등록했어요.",   time: "2025-08-12T09:10:00+09:00", read: false },
  { id: 103, type: "event",      icon: "📍", title: "행사 시작 1시간 전",       message: "‘우리동네 플리마켓’ 1시간 후 시작합니다.",        time: "2025-08-11T18:00:00+09:00", read: true  },
  { id: 104, type: "subscribe",  icon: "💬", title: "댓글이 달렸어요",          message: "게시물에 새로운 댓글이 있습니다.",               time: "2025-08-10T12:40:00+09:00", read: true  },
];

const FILTERS = [
  { key: "all",       label: "전체"     },
  { key: "unread",    label: "읽지 않음" },
  { key: "event",     label: "행사"     },
  { key: "subscribe", label: "구독"     },
];

const formatTime = (iso) => {
  try {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd} ${hh}:${mi}`;
  } catch { return iso; }
};

const NotificationPage = () => {
  const [activeFilter, setActiveFilter] = useState("all");
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => new Date(b.time) - new Date(a.time));
    switch (activeFilter) {
      case "unread":    return sorted.filter(n => !n.read);
      case "event":     return sorted.filter(n => n.type === "event");
      case "subscribe": return sorted.filter(n => n.type === "subscribe");
      default:          return sorted;
    }
  }, [items, activeFilter]);

  const markAllAsRead = () => setItems(prev => prev.map(n => ({ ...n, read: true })));

  return (
    <Layout>
      <div className="notification-page">
        {/* 페이지 타이틀 */}
        <div className="page-title-row">
          <h2 className="page-title">알림</h2>
        </div>

        {/* ✅ 모바일 전용 필터 탭 (데스크톱에선 숨김) */}
        <div className="filter-tabs mobile-only">
          <div className="filter-scroll">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`filter-chip ${activeFilter === f.key ? "selected" : ""}`}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button className="mark-read-inline" onClick={markAllAsRead}>모두 읽음</button>
        </div>

        {/* ✅ 데스크톱 전용 툴바 (모바일에선 숨김) */}
        <div className="web-toolbar desktop-only">
          <div className="web-toolbar-inner">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`web-chip ${activeFilter === f.key ? "selected" : ""}`}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
            <button className="web-markread" onClick={markAllAsRead}>모두 읽음</button>
          </div>
        </div>

        {/* 알림 리스트 */}
        <ul className="noti-list">
          {filtered.map(n => (
            <li key={n.id} className={`noti-card ${!n.read ? "unread" : ""}`} role="button" tabIndex={0}>
              <div className="noti-icon">{n.icon}</div>
              <div className="noti-body">
                <div className="noti-title-row">
                  <h4 className="noti-title">{n.title}</h4>
                  {!n.read && <span className="noti-dot" />}
                </div>
                <p className="noti-message">{n.message}</p>
                <span className="noti-time">{formatTime(n.time)}</span>
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li className="noti-empty">표시할 알림이 없어요.</li>}
        </ul>
      </div>
    </Layout>
  );
};

export default NotificationPage;
