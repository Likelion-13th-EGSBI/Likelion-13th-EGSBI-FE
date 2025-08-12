import React from 'react';
import '../css/subscribe.css';
import { useNavigate } from 'react-router-dom';

export default function HostCard(props) {
  const host = props.host ?? props ?? {};

  const id = host.id ?? props.id ?? null;
  const name = host.name ?? props.name ?? '이름 없음';
  const image = host.profileImage ?? host.image ?? props.image ?? null;

  const navigate = useNavigate();
  const onClick = () => {
    if (id != null) navigate(`/host/${id}`);
  };

  return (
    <li className="org-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="org-card__header">
        <div className="org-card__avatar">
          {image ? (
            <img src={image} alt={`${name} 프로필`} />
          ) : (
            name?.[0] ?? '호'
          )}
        </div>
        <div className="org-card__meta">
          <div className="org-card__name">{name}</div>
        </div>
      </div>
    </li>
  );
}
