import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard"; // EventCard 컴포넌트 import
import '../css/myuploadevent.css';
import { useNavigate } from "react-router-dom";

// ReviewModal 컴포넌트
const ReviewModal = ({ isOpen, onClose, eventId, eventName }) => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 액세스 토큰을 localStorage에서 가져오는 함수
    const getAccessToken = () => {
        return localStorage.getItem('accessToken');
    };

    // 리뷰 데이터 가져오기
    const fetchReviews = async () => {
        if (!eventId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const accessToken = getAccessToken();
            if (!accessToken) {
                throw new Error('인증 토큰이 없습니다.');
            }

            const response = await fetch(
                `https://gateway.gamja.cloud/api/activity/review/eventlist?eventId=${eventId}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
                } else if (response.status === 404) {
                    throw new Error('해당 행사의 리뷰를 찾을 수 없습니다.');
                }
                throw new Error(`서버 오류: ${response.status}`);
            }

            const data = await response.json();
            
            // API 응답이 배열인 경우와 객체 형태인 경우 모두 처리
            if (Array.isArray(data)) {
                setReviews(data);
            } else if (data && Array.isArray(data.content)) {
                setReviews(data.content);
            } else {
                setReviews([]);
            }
            
        } catch (error) {
            console.error('리뷰 조회 오류:', error);
            setError(error.message);
            setReviews([]);
        } finally {
            setLoading(false);
        }
    };

    // 모달이 열릴 때 리뷰 데이터 가져오기
    useEffect(() => {
        if (isOpen && eventId) {
            fetchReviews();
        }
    }, [isOpen, eventId]);

    // 모달이 닫힐 때 상태 초기화
    useEffect(() => {
        if (!isOpen) {
            setReviews([]);
            setError(null);
        }
    }, [isOpen]);

    // 별점 렌더링
    const renderStars = (rating) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;
        
        for (let i = 0; i < fullStars; i++) {
            stars.push(<span key={i} className="review-star review-star-filled">★</span>);
        }
        
        if (hasHalfStar) {
            stars.push(<span key="half" className="review-star review-star-half">★</span>);
        }
        
        const remainingStars = 5 - Math.ceil(rating);
        for (let i = 0; i < remainingStars; i++) {
            stars.push(<span key={`empty-${i}`} className="review-star review-star-empty">☆</span>);
        }
        
        return stars;
    };

    // 날짜 포맷팅
    const formatDate = (dateString) => {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    };

    // 평균 별점 계산
    const calculateAverageRating = () => {
        if (reviews.length === 0) return 0;
        const total = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
        return (total / reviews.length).toFixed(1);
    };

    // ESC 키로 모달 닫기
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.keyCode === 27) {
                onClose();
            }
        };
        
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden'; // 스크롤 방지
        }
        
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="review-modal-overlay" onClick={onClose}>
            <div className="review-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* 헤더 */}
                <div className="review-modal-header">
                    <div className="review-modal-title-section">
                        <h2 className="review-modal-main-title">리뷰</h2>
                        <p className="review-modal-event-name">{eventName}</p>
                    </div>
                    <button className="review-modal-close-button" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* 리뷰 통계 */}
                {!loading && !error && reviews.length > 0 && (
                    <div className="review-modal-statistics">
                        <div className="review-stats-rating-section">
                            <span className="review-average-rating-number">{calculateAverageRating()}</span>
                            <div className="review-stars-container">
                                {renderStars(parseFloat(calculateAverageRating()))}
                            </div>
                        </div>
                        <div className="review-stats-count-section">
                            총 <strong className="review-count-number">{reviews.length}</strong>개의 리뷰
                        </div>
                    </div>
                )}

                {/* 콘텐츠 */}
                <div className="review-modal-body">
                    {loading && (
                        <div className="review-modal-loading-state">
                            <div className="review-loading-spinner"></div>
                            <p className="review-loading-text">리뷰를 불러오는 중...</p>
                        </div>
                    )}

                    {error && (
                        <div className="review-modal-error-state">
                            <div className="review-error-icon">⚠️</div>
                            <p className="review-error-message">{error}</p>
                            <button 
                                className="review-error-retry-button"
                                onClick={fetchReviews}
                            >
                                다시 시도
                            </button>
                        </div>
                    )}

                    {!loading && !error && reviews.length === 0 && (
                        <div className="review-modal-empty-state">
                            <div className="review-empty-icon">📝</div>
                            <h3 className="review-empty-title">아직 리뷰가 없어요</h3>
                        </div>
                    )}

                    {!loading && !error && reviews.length > 0 && (
                        <div className="review-modal-list-container">
                            {reviews.map((review, index) => (
                                <div key={review.id || index} className="review-list-item">
                                    <div className="review-item-header-section">
                                        <div className="review-user-information">
                                            <span className="review-user-id-text">
                                                사용자 {review.userId || '익명'}
                                            </span>
                                            <span className="review-created-date">
                                                {formatDate(review.createdAt)}
                                            </span>
                                        </div>
                                        <div className="review-rating-section">
                                            <div className="review-rating-stars">
                                                {renderStars(review.rating || 0)}
                                            </div>
                                            <span className="review-rating-number-text">
                                                ({review.rating || 0})
                                            </span>
                                        </div>
                                    </div>
                                    {review.content && (
                                        <div className="review-content-section">
                                            <p className="review-content-text">{review.content}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="review-modal-footer">
                    <button className="review-modal-close-footer-button" onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

const MyUploadEvent = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [pageSize] = useState(10); // 페이지당 아이템 수
    
    // 리뷰 모달 상태
    const [reviewModal, setReviewModal] = useState({
        isOpen: false,
        eventId: null,
        eventName: ''
    });

    // 현재 사용자의 ID를 localStorage에서 가져오는 함수
    const getCurrentUserId = () => {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            console.error('사용자 ID가 없습니다. 로그인이 필요합니다.');
            navigate('/login');
            return null;
        }
        return userId;
    };

    // 액세스 토큰을 localStorage에서 가져오는 함수
    const getAccessToken = () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            console.error('액세스 토큰이 없습니다. 로그인이 필요합니다.');
            navigate('/login');
            return null;
        }
        return token;
    };

    // 마크다운을 HTML로 변환하는 함수
    const markdownToHtml = (markdown) => {
        if (!markdown) return '설명이 없습니다.';
        
        let html = markdown
            // 헤더
            .replace(/^### (.*$)/gim, '<h3 class="md-heading md-heading-3">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="md-heading md-heading-2">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="md-heading md-heading-1">$1</h1>')
            // 굵은 글씨
            .replace(/\*\*(.*?)\*\*/gim, '<strong class="md-bold">$1</strong>')
            .replace(/__(.*?)__/gim, '<strong class="md-bold">$1</strong>')
            // 기울임
            .replace(/\*(.*?)\*/gim, '<em class="md-italic">$1</em>')
            .replace(/_(.*?)_/gim, '<em class="md-italic">$1</em>')
            // 코드 블록
            .replace(/```([\s\S]*?)```/gim, '<pre class="md-code-block"><code class="md-code-block-content">$1</code></pre>')
            // 인라인 코드
            .replace(/`(.*?)`/gim, '<code class="md-code-inline">$1</code>')
            // 링크
            .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>')
            // 이미지
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="md-image" />')
            // 인용구
            .replace(/^> (.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>')
            // 순서없는 리스트
            .replace(/^\* (.*$)/gim, '<li class="md-list-item">$1</li>')
            .replace(/^- (.*$)/gim, '<li class="md-list-item">$1</li>')
            // 순서있는 리스트
            .replace(/^\d+\. (.*$)/gim, '<li class="md-list-item md-list-item-ordered">$1</li>');

        // 줄바꿈을 단락으로 처리
        const lines = html.split('\n');
        const processedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 빈 줄은 단락 구분자로 사용
            if (line === '') {
                processedLines.push('');
                continue;
            }
            
            // 이미 HTML 태그로 처리된 줄은 그대로 유지
            if (line.match(/^<(h[1-3]|blockquote|pre|li)/)) {
                processedLines.push(line);
            } else if (line.length > 0) {
                // 일반 텍스트는 단락으로 감싸기
                processedLines.push(`<p class="md-paragraph">${line}</p>`);
            }
        }

        // 리스트 아이템들을 ul/ol로 감싸기
        const finalHtml = processedLines.join('\n')
            .replace(/(<li class="md-list-item"[^>]*>.*?<\/li>\s*)+/gs, (match) => {
                return `<ul class="md-list">${match}</ul>`;
            })
            .replace(/(<li class="md-list-item md-list-item-ordered"[^>]*>.*?<\/li>\s*)+/gs, (match) => {
                return `<ol class="md-list md-list-ordered">${match}</ol>`;
            });

        return finalHtml;
    };

    // 마크다운 설명을 텍스트로만 변환 (요약용)
    const markdownToText = (markdown) => {
        if (!markdown) return '설명이 없습니다.';
        
        // 마크다운 문법 제거하고 텍스트만 추출
        let text = markdown
            .replace(/^#{1,6}\s+/gm, '') // 헤더 제거
            .replace(/\*\*(.*?)\*\*/g, '$1') // 굵은 글씨
            .replace(/__(.*?)__/g, '$1') // 굵은 글씨
            .replace(/\*(.*?)\*/g, '$1') // 기울임
            .replace(/_(.*?)_/g, '$1') // 기울임
            .replace(/```[\s\S]*?```/g, '[코드]') // 코드 블록
            .replace(/`(.*?)`/g, '$1') // 인라인 코드
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 링크
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[이미지]') // 이미지
            .replace(/^>\s+/gm, '') // 인용구
            .replace(/^[\*\-\+]\s+/gm, '• ') // 순서없는 리스트
            .replace(/^\d+\.\s+/gm, '• ') // 순서있는 리스트
            .replace(/\n{2,}/g, ' ') // 여러 줄바꿈을 공백으로
            .replace(/\n/g, ' ') // 줄바꿈을 공백으로
            .trim();
        
        // 길이 제한 (요약용)
        if (text.length > 100) {
            text = text.substring(0, 97) + '...';
        }
        
        return text;
    };

    const fetchEvents = useCallback(async (page = 0, isLoadMore = false) => {
        try {
            if (!isLoadMore) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const userId = getCurrentUserId();
            const accessToken = getAccessToken();
            
            // 토큰이나 사용자 ID가 없으면 요청하지 않음
            if (!userId || !accessToken) {
                return;
            }
            
            // URL 파라미터 구성
            const params = new URLSearchParams({
                page: page.toString(),
                size: pageSize.toString(),
                sort: 'createTime,DESC' // 최신순 정렬
            });

            const response = await fetch(
                `https://gateway.gamja.cloud/api/event/${userId}?${params}`, 
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${accessToken}` // 인증 헤더 추가
                    },
                }
            );

            if (!response.ok) {
                // 401 Unauthorized 처리
                if (response.status === 401) {
                    console.error('인증이 만료되었습니다.');
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('userId');
                    localStorage.removeItem('userEmail');
                    localStorage.removeItem('tokenExpiration');
                    navigate('/login');
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // API가 페이징된 응답을 반환하는 경우
            if (data && typeof data === 'object' && 'content' in data) {
                const newEvents = data.content || [];
                
                if (isLoadMore) {
                    setEvents(prevEvents => {
                        // 중복 제거: 기존 이벤트 ID들과 새 이벤트 ID들을 비교
                        const existingIds = new Set(prevEvents.map(event => event.id));
                        const uniqueNewEvents = newEvents.filter(event => !existingIds.has(event.id));
                        return [...prevEvents, ...uniqueNewEvents];
                    });
                } else {
                    setEvents(newEvents);
                }
                
                // 더 가져올 데이터가 있는지 확인
                const isLastPage = data.last || false;
                const totalPages = data.totalPages || 0;
                setHasMore(!isLastPage && page + 1 < totalPages);
                setCurrentPage(data.number || 0);
            } 
            // API가 배열을 직접 반환하는 경우 (기존 방식)
            else if (Array.isArray(data)) {
                if (isLoadMore) {
                    setEvents(prevEvents => {
                        // 중복 제거: 기존 이벤트 ID들과 새 이벤트 ID들을 비교
                        const existingIds = new Set(prevEvents.map(event => event.id));
                        const uniqueNewEvents = data.filter(event => !existingIds.has(event.id));
                        return [...prevEvents, ...uniqueNewEvents];
                    });
                } else {
                    setEvents(data);
                }
                
                // 배열 방식에서는 반환된 데이터 길이로 판단
                setHasMore(data.length === pageSize);
            } 
            else {
                if (!isLoadMore) {
                    setEvents([]);
                }
                setHasMore(false);
            }

        } catch (error) {
            console.error('Error fetching events:', error);
            if (!isLoadMore) {
                setEvents([]);
            }
            setHasMore(false);
            
            // 네트워크 오류나 서버 오류 시 사용자에게 알림
            if (error.message.includes('fetch')) {
                alert('네트워크 연결을 확인해주세요.');
            } else {
                alert('행사 목록을 불러오는데 실패했습니다.');
            }
        } finally {
            if (!isLoadMore) {
                setLoading(false);
            } else {
                setLoadingMore(false);
            }
        }
    }, [pageSize, navigate]);

    // 컴포넌트 마운트 시 로그인 상태 확인
    useEffect(() => {
        const userId = localStorage.getItem('userId');
        const accessToken = localStorage.getItem('accessToken');
        const tokenExpiration = localStorage.getItem('tokenExpiration');
        
        // 로그인 상태 확인
        if (!userId || !accessToken || !tokenExpiration) {
            console.log('로그인 정보가 없습니다. 로그인 페이지로 이동합니다.');
            navigate('/login');
            return;
        }
        
        // 토큰 만료 확인
        const now = Date.now();
        const expiration = parseInt(tokenExpiration);
        
        if (now >= expiration) {
            console.log('토큰이 만료되었습니다. 로그인 페이지로 이동합니다.');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('tokenExpiration');
            navigate('/login');
            return;
        }
        
        // 로그인 상태가 유효하면 데이터 로드
        fetchEvents(0, false);
    }, [navigate, fetchEvents]);

    // 무한 스크롤을 위한 스크롤 이벤트 핸들러
    const handleScroll = useCallback(() => {
        // 로딩 중이거나 더 가져올 데이터가 없으면 return
        if (loadingMore || !hasMore) return;

        // 스크롤이 바닥에 가까이 갔는지 확인 (100px 여유)
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;

        if (scrollTop + clientHeight >= scrollHeight - 100) {
            // 다음 페이지 로드
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            fetchEvents(nextPage, true);
        }
    }, [loadingMore, hasMore, currentPage, fetchEvents]);

    // 스크롤 이벤트 리스너 등록/해제
    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}.${day}`;
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const handleAddEvent = () => {
        navigate('/event-upload');
    };

    const handleEventClick = (eventId) => {
        // 행사 상세페이지로 이동
        console.log('행사 상세:', eventId);
        navigate(`/events/${eventId}`);
    };

    const handleBookmarkToggle = (eventId) => {
        // 북마크 토글 로직 (현재는 로그만 출력)
        console.log('북마크 토글:', eventId);
    };

    const handleEditEvent = (event) => {
        // 행사 수정 페이지로 이동 - 행사 데이터를 state로 전달
        console.log('행사 수정:', event);
        navigate(`/event-edit/${event.id}`, { 
            state: { eventData: event } 
        });
    };

    const handleViewReviews = (eventId, eventName) => {
        // 리뷰 모달 열기
        console.log('리뷰 보기:', eventId, eventName);
        setReviewModal({
            isOpen: true,
            eventId: eventId,
            eventName: eventName || '행사'
        });
    };

    const handleCloseReviewModal = () => {
        setReviewModal({
            isOpen: false,
            eventId: null,
            eventName: ''
        });
    };

    const isEventEnded = (endTime) => {
        if (!endTime) return false;
        const now = new Date();
        const eventEndTime = new Date(endTime);
        return now > eventEndTime;
    };

    // 새로고침 함수 (pull-to-refresh 등에서 사용 가능)
    const handleRefresh = () => {
        setCurrentPage(0);
        setHasMore(true);
        fetchEvents(0, false);
    };

    if (loading) {
        return (
            <Layout pageTitle="내가 등록한 행사" activeMenuItem="my-uploads">
                <div className="myuploadevent-container">
                    <div className="myuploadevent-loading">
                        <div className="myuploadevent-loading-dot"></div>
                        <div className="myuploadevent-loading-dot"></div>
                        <div className="myuploadevent-loading-dot"></div>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout pageTitle="내가 등록한 행사" activeMenuItem="my-uploads">
            <div className="myuploadevent-container">
                {/* 통합 헤더 */}
                <div className="myuploadevent-header">
                    <h1 className="myuploadevent-title">
                        내가 등록한 행사 
                        <span className="myuploadevent-count">({events.length})</span>
                    </h1>
                    <button 
                        className="myuploadevent-add-btn"
                        onClick={handleAddEvent}
                    >
                        + 새 행사
                    </button>
                </div>

                {/* 새로고침 버튼 (선택사항) */}
                <div className="myuploadevent-refresh">
                    <button 
                        className="myuploadevent-refresh-btn"
                        onClick={handleRefresh}
                        disabled={loading || loadingMore}
                    >
                        새로고침
                    </button>
                </div>

                {/* 메인 콘텐츠 */}
                {events.length === 0 && !loading ? (
                    <div className="myuploadevent-empty">
                        <div className="myuploadevent-empty-icon">📅</div>
                        <h2 className="myuploadevent-empty-title">등록된 행사가 없어요</h2>
                        <p className="myuploadevent-empty-desc">새로운 행사를 등록해 보세요!</p>
                        <button 
                            className="myuploadevent-empty-button"
                            onClick={handleAddEvent}
                        >
                            첫 행사 만들기
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="myuploadevent-events-container">
                            {events.map((event, index) => {
                                const eventEnded = isEventEnded(event.endTime);
                                // 고유한 key 생성: ID가 있으면 ID 사용, 없으면 index와 다른 속성 조합
                                const uniqueKey = event.id ? `event-${event.id}` : `event-${index}-${event.name}-${event.createTime}`;
                                
                                return (
                                    <div key={uniqueKey} className="myuploadevent-event-wrapper">
                                        <EventCard
                                            id={event.id}
                                            image={event.posterId ? `https://gateway.gamja.cloud/api/image/${event.posterId}` : null}
                                            title={event.name || '행사명 없음'}
                                            summary={markdownToText(event.description)}
                                            hashtags={event.hashtags || []}
                                            date={event.startTime ? formatDate(event.startTime) : '날짜 미정'}
                                            time={event.startTime ? formatTime(event.startTime) : '시간 미정'}
                                            location={event.address || '장소 미정'}
                                            fee={event.entryFee ? `${event.entryFee.toLocaleString()}원` : '무료'}
                                            bookmarked={false}
                                            onBookmarkToggle={() => handleBookmarkToggle(event.id)}
                                            onClick={handleEventClick}
                                        />
                                        
                                        {/* 행사 종료 여부에 따른 버튼 */}
                                        <div className="myuploadevent-action-buttons">
                                            {eventEnded ? (
                                                <button 
                                                    className="myuploadevent-action-btn review-btn"
                                                    onClick={() => handleViewReviews(event.id, event.name)}
                                                >
                                                    리뷰 보기
                                                </button>
                                            ) : (
                                                <button 
                                                    className="myuploadevent-action-btn edit-btn"
                                                    onClick={() => handleEditEvent(event)}
                                                >
                                                    수정하기
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* 무한 스크롤 로딩 인디케이터 */}
                        {loadingMore && (
                            <div className="myuploadevent-loading-more">
                                <div className="myuploadevent-loading-spinner"></div>
                                <p>더 많은 행사를 불러오는 중...</p>
                            </div>
                        )}
                        
                        {/* 더 이상 불러올 데이터가 없을 때 */}
                        {!hasMore && events.length > 0 && (
                            <div className="myuploadevent-no-more">
                                <p>모든 행사를 불러왔습니다</p>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {/* 리뷰 모달 */}
            <ReviewModal 
                isOpen={reviewModal.isOpen}
                onClose={handleCloseReviewModal}
                eventId={reviewModal.eventId}
                eventName={reviewModal.eventName}
            />
        </Layout>
    );
};

export default MyUploadEvent;