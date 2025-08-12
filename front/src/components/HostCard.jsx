import React from 'react';
import '../css/subscribe.css';
import { useNavigate } from 'react-router-dom';

export default function HostCard(props) {
  const host = props.host ?? props ?? {};

  const id = host.id ?? null;
  const name = host.name ?? '이름 없음';
  const description = host.description ?? '';
  const category = host.category ?? host.categories ?? [];
  const image = host.profileImage ?? host.image ?? null;

  const navigate = useNavigate();
  const onClick = () => {
    if (id != null) navigate(`/host/${id}`);
  };

  return (
    <li className="org-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="org-card__header">
        <div className="org-card__avatar">
          {image ? <img src={image} alt={`${name} 프로필`} /> : (name?.[0] ?? '호')}
        </div>
        <div className="org-card__meta">
          <div className="org-card__name">{name}</div>
          <div className="org-card__desc">{description || '소개가 없습니다.'}</div>
        </div>
      </div>
      <div className="org-card__tags">
        {(Array.isArray(category) ? category : category ? [category] : [])
          .slice(0, 3)
          .map((c, i) => (
            <span key={i} className="org-card__tag">#{c}</span>
          ))}
      </div>
    </li>
  );
}
