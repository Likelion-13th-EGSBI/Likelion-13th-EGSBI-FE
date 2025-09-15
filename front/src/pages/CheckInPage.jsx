import React, { useState, useEffect, useCallback } from 'react';
import '../css/checkinpage.css';

const CheckInPage = () => {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [posterImageUrl, setPosterImageUrl] = useState(null);

  // 마크다운 렌더링 함수
  const renderMarkdown = useCallback((text) => {
    if (!text) return '';
    
    return text
      .replace(/^### (.*$)/gim, '<h3 class="markdown-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="markdown-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="markdown-h1">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="markdown-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="markdown-italic">$1</em>')
      .replace(/__(.*?)__/g, '<strong class="markdown-bold">$1</strong>')
      .replace(/_(.*?)_/g, '<em class="markdown-italic">$1</em>')
      .replace(/~~(.*?)~~/g, '<del class="markdown-strikethrough">$1</del>')
      .replace(/`([^`]+)`/g, '<code class="markdown-code">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="markdown-link">$1</a>')
      .replace(/^[\s]*[-*+][\s]+(.*$)/gim, '<li class="markdown-list-item">$1</li>')
      .replace(/^[\s]*\d+\.[\s]+(.*$)/gim, '<li class="markdown-ordered-item">$1</li>')
      .replace(/(<li class="markdown-list-item">.*?<\/li>)/gs, '<ul class="markdown-list">$1</ul>')
      .replace(/(<li class="markdown-ordered-item">.*?<\/li>)/gs, '<ol class="markdown-ordered-list">$1</ol>')
      .replace(/^> (.*$)/gim, '<blockquote class="markdown-blockquote">$1</blockquote>')
      .replace(/\n/g, '<br class="markdown-br">');
  }, []);

  // 로그인 상태 확인
  const checkLoginStatus = () => {
    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');
    return accessToken && userId;
  };

  // 로그인 페이지로 리다이렉트
  const redirectToLogin = () => {
    const currentUrl = window.location.href;
    localStorage.setItem('redirectAfterLogin', currentUrl);
    window.location.href = '/login';
  };

  // URL에서 이벤트 ID 추출 및 로그인 상태 확인
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const eParam = urlParams.get('e');
    
    if (!eParam) {
      setError('유효하지 않은 링크입니다.');
      setLoading(false);
      return;
    }

    setEventId(eParam);
    setIsLoggedIn(checkLoginStatus());
    fetchEventInfo(eParam);
  }, []);

  // 로그인 상태 변화 감지
  useEffect(() => {
    const handleStorageChange = () => {
      const newLoginStatus = checkLoginStatus();
      if (newLoginStatus !== isLoggedIn) {
        setIsLoggedIn(newLoginStatus);
        // 로그인 성공 시 redirectAfterLogin 삭제
        if (newLoginStatus) {
          localStorage.removeItem('redirectAfterLogin');
        }
      }
    };

    const handleFocus = () => {
      const newLoginStatus = checkLoginStatus();
      if (newLoginStatus !== isLoggedIn) {
        setIsLoggedIn(newLoginStatus);
        // 로그인 성공 시 redirectAfterLogin 삭제
        if (newLoginStatus) {
          localStorage.removeItem('redirectAfterLogin');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoggedIn]);

  // 이벤트 정보 조회
  const fetchEventInfo = async (id) => {
    try {
      setLoading(true);
      const response = await fetch(`https://likelion-att.o-r.kr/v1/event/info/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('이벤트 정보를 불러올 수 없습니다.');
      }

      const data = await response.json();
      setEventData(data);

      if (data.posterId) {
        loadPosterImage(data.posterId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 포스터 이미지 로드
  const loadPosterImage = async (posterId) => {
    try {
      const response = await fetch(`https://likelion-att.o-r.kr/v1/image/${posterId}`, {
        method: 'GET'
      });

      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setPosterImageUrl(imageUrl);
      }
    } catch (err) {
      console.error('포스터 이미지 로드 실패:', err);
    }
  };

  // 체크인 처리
  const handleCheckIn = async () => {
    if (!isLoggedIn) {
      redirectToLogin();
      return;
    }

    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');

    try {
      setCheckingIn(true);
      const response = await fetch('https://likelion-att.o-r.kr/v1/activity/participation/join', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
           'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId: parseInt(eventId),
        })
      });

      if (response.ok) {
        setCheckInStatus('success');
      } else if (response.status === 409) {
        setCheckInStatus('already');
      } else {
        throw new Error('체크인에 실패했습니다.');
      }
    } catch (err) {
      setCheckInStatus('error');
      console.error('체크인 오류:', err);
    } finally {
      setCheckingIn(false);
    }
  };

  // 날짜 포맷팅
  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
      }),
      time: date.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit'
      })
    };
  };

  // 공유하기
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: eventData.name,
          text: `${eventData.name} 이벤트에 참여해보세요!`,
          url: window.location.href
        });
      } catch (error) {
        console.log('공유 취소됨');
      }
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('링크가 클립보드에 복사되었습니다!');
      });
    }
  };

  if (loading) {
    return (
      <div className="checkin-container">
        <div className="checkin-loading-card">
          <div className="checkin-spinner"></div>
          <h2 className="checkin-loading-title">행사 정보 로딩 중...</h2>
          <p className="checkin-loading-text">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="checkin-container">
        <div className="checkin-error-card">
          <div className="checkin-error-icon">!</div>
          <h2 className="checkin-error-title">오류가 발생했습니다</h2>
          <p className="checkin-error-text">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="checkin-retry-button"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!eventData) {
    return null;
  }

  const startDateTime = formatDateTime(eventData.startTime);
  const endDateTime = formatDateTime(eventData.endTime);

  return (
    <div className="checkin-page-container">
      <div className="checkin-content">
        <div className="checkin-header">
          <div className="checkin-header-badge">
            <span className="checkin-heart-icon">♥</span>
            <span className="checkin-badge-text">행사 참여</span>
          </div>
          <p className="checkin-page-subtitle">아래 정보를 확인하고 체크인해주세요</p>
        </div>

        <div className="checkin-event-card">
          {posterImageUrl && (
            <div className="checkin-poster-container">
              <img 
                src={posterImageUrl}
                alt={eventData.name}
                className="checkin-poster-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="checkin-poster-overlay"></div>
              <div className="checkin-poster-title">
                <h2 className="checkin-event-title">{eventData.name}</h2>
              </div>
            </div>
          )}

          <div className="checkin-card-content">
            {!posterImageUrl && (
              <h2 className="checkin-event-title-no-image">{eventData.name}</h2>
            )}

            <div className="checkin-info-container">
              <div className="checkin-info-item">
                <div className="checkin-info-icon">📅</div>
                <div className="checkin-info-content">
                  <div className="checkin-info-label">시작: {startDateTime.date}</div>
                  <div className="checkin-info-value">{startDateTime.time}</div>
                  <div className="checkin-info-label">종료: {endDateTime.date}</div>
                  <div className="checkin-info-value">{endDateTime.time}</div>
                </div>
              </div>

              <div className="checkin-info-item">
                <div className="checkin-info-icon">📍</div>
                <div className="checkin-info-content">
                  <div className="checkin-info-label">장소</div>
                  <div className="checkin-info-value">{eventData.address}</div>
                </div>
              </div>

              <div className="checkin-info-item">
                <div className="checkin-info-icon">💰</div>
                <div className="checkin-info-content">
                  <div className="checkin-info-label">참가비</div>
                  <div className="checkin-info-value">
                    {eventData.entryFee === 0 ? '무료' : `${eventData.entryFee.toLocaleString()}원`}
                  </div>
                </div>
              </div>

              {eventData.description && (
                <div className="checkin-description-container">
                  <div className="checkin-description-label">이벤트 설명</div>
                  <div 
                    className="checkin-description-text"
                    dangerouslySetInnerHTML={{ 
                      __html: renderMarkdown(eventData.description)
                    }}
                  />
                </div>
              )}

              {eventData.hashtags && eventData.hashtags.length > 0 && (
                <div className="checkin-hashtag-container">
                  <div className="checkin-hashtag-label">태그</div>
                  <div className="checkin-hashtag-list">
                    {eventData.hashtags.map((tag, index) => (
                      <span key={index} className="checkin-hashtag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="checkin-action-container">
          {!isLoggedIn && (
            <div className="checkin-login-prompt">
              <div className="checkin-login-icon">🔐</div>
              <h3 className="checkin-login-title">로그인이 필요합니다</h3>
              <p className="checkin-login-text">이벤트 체크인을 위해 먼저 로그인해주세요.</p>
              <button
                onClick={redirectToLogin}
                className="checkin-login-button"
              >
                로그인하기
              </button>
            </div>
          )}

          {isLoggedIn && checkInStatus === 'success' && (
            <div className="checkin-status checkin-success-status">
              <div className="checkin-status-icon">✅</div>
              <h3 className="checkin-status-title">체크인 완료!</h3>
              <p className="checkin-status-text">성공적으로 이벤트에 참여하셨습니다.</p>
            </div>
          )}

          {isLoggedIn && checkInStatus === 'already' && (
            <div className="checkin-status checkin-warning-status">
              <div className="checkin-status-icon">⚠️</div>
              <h3 className="checkin-status-title">이미 참여 중</h3>
              <p className="checkin-status-text">이미 이 이벤트에 참여하고 계십니다.</p>
            </div>
          )}

          {isLoggedIn && checkInStatus === 'error' && (
            <div className="checkin-status checkin-error-status">
              <div className="checkin-status-icon">❌</div>
              <h3 className="checkin-status-title">체크인 실패</h3>
              <p className="checkin-status-text">다시 시도해주세요.</p>
            </div>
          )}

          {isLoggedIn && !checkInStatus && (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className={`checkin-button ${checkingIn ? 'checkin-button-disabled' : ''}`}
            >
              {checkingIn ? (
                <>
                  <div className="checkin-button-spinner"></div>
                  체크인 중...
                </>
              ) : (
                '이벤트 체크인'
              )}
            </button>
          )}
        </div>

        <div className="checkin-footer">
          <p className="checkin-footer-text">Eventory와 함께하는 특별한 경험</p>
        </div>
      </div>
    </div>
  );
};

export default CheckInPage;