import React from 'react';
import '../css/subscribe.css';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function HostCard({ host, onUnsubscribe }) {
  const id = host?.id ?? null;
  const name = host?.name ?? '이름 없음';
  const image = host?.profileImage ?? host?.image ?? null;

  const navigate = useNavigate();

  const handleCardClick = () => {
    if (id != null) navigate(`/host/${id}`);
  };

  const handleUnsubscribe = async (e) => {
    e.stopPropagation(); // 카드 클릭 방지
    const apiBase = process.env.REACT_APP_API_URL ?? '';
    // MOCK 모드나 API 미설정이면 즉시 제거만
    if (!apiBase) {
      onUnsubscribe?.(id);
      return;
    }
    try {
      await axios.delete(`${apiBase}/api/subscribe/${id}`);
      onUnsubscribe?.(id);
    } catch (err) {
      console.error(err);
      alert('구독 해제 중 오류가 발생했습니다.');
    }
  };

  return (
    <li className="org-card" onClick={handleCardClick} role="button" tabIndex={0}>
      <div className="org-card__header">
        {/* 왼쪽: 아바타 + 이름(긴 경우 … 처리) */}
        <div className="org-card__info">
          <div className="org-card__avatar">
            {image ? <img src={image} alt={`${name} 프로필`} /> : (name?.[0] ?? '호')}
          </div>
          <div className="org-card__name" title={name}>{name}</div>
        </div>

        {/* 오른쪽: 구독 해제 버튼 */}
        <button className="unsubscribe-btn" onClick={handleUnsubscribe}>
          구독 해제
        </button>
      </div>
    </li>
  );
}
