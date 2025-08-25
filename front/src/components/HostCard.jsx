import React from 'react';
import '../css/hostcard.css';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function HostCard({ host, onUnsubscribe }) {

  const navigate = useNavigate();

  // host 유무와 상관없이 안전한 값 준비
  const id = host?.id ?? null;
  const name = host?.name ?? '이름 없음';
  const image = host?.profileImage ?? host?.image ?? null;

  const handleCardClick = () => {
    if (id != null) navigate(`/host/${id}`); // 실제 라우트
  };

  const handleCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  const handleUnsubscribe = async (e) => {
    e.stopPropagation(); // 카드 클릭 방지
    if (id == null) return; // 목업/빈카드면 무시

    const apiBase = process.env.REACT_APP_API_URL ?? '';
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
    <li
      className={`org-card ${id == null ? 'is-mock' : ''}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role={id != null ? 'button' : 'group'}
      tabIndex={0}
      aria-label={`${name} 카드`}
    >
      <div className="org-card__header">
        <div className="org-card__info">
          <div className="org-card__avatar">
            {image ? <img src={image} alt={`${name} 프로필`} /> : (name?.[0] ?? '호')}
          </div>
          <div className="org-card__name" title={name}>{name}</div>
        </div>

        <button
          type="button"
          className="unsubscribe-btn"
          onClick={handleUnsubscribe}
          aria-live="polite"
          aria-label="구독 상태"
        >
          <span className="label-default">구독중</span>
          <span className="label-hover">구독 해제</span>
        </button>
      </div>
    </li>
  );
}
