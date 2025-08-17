import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard"; // EventCard 컴포넌트 import
import '../css/myuploadevent.css';
import { useNavigate } from "react-router-dom";

const MyUploadEvent = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [pageSize] = useState(10); // 페이지당 아이템 수

    // 현재 사용자의 조직자 ID를 가져오는 함수 (실제 구현에서는 인증 시스템에서 가져와야 함)
    const getCurrentOrganizerId = () => {
        // TODO: 실제 구현에서는 로그인한 사용자의 조직자 ID를 반환
        // 예: localStorage, context, 또는 API 호출을 통해 가져오기
        return localStorage.getItem('organizerId') || '0'; // 기본값으로 1 사용
    };

    const fetchEvents = useCallback(async (page = 0, isLoadMore = false) => {
        try {
            if (!isLoadMore) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const organizerId = getCurrentOrganizerId();
            
            // URL 파라미터 구성
            const params = new URLSearchParams({
                page: page.toString(),
                size: pageSize.toString(),
                sort: 'createTime,DESC' // 최신순 정렬
            });

            const response = await fetch(
                `https://gateway.gamja.cloud/api/event/${organizerId}?${params}`, 
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        // 필요시 인증 헤더 추가
                        // 'Authorization': `Bearer ${getAuthToken()}`
                    },
                }
            );

            if (!response.ok) {
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
            
            // 에러 처리 - 사용자에게 알림 (선택사항)
            // alert('행사 목록을 불러오는데 실패했습니다.');
        } finally {
            if (!isLoadMore) {
                setLoading(false);
            } else {
                setLoadingMore(false);
            }
        }
    }, [pageSize]);

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

    // 초기 데이터 로드
    useEffect(() => {
        fetchEvents(0, false);
    }, [fetchEvents]);

    // HTML 태그를 안전하게 처리하는 함수
    const processDescription = (description) => {
        if (!description) return '설명이 없습니다.';
        
        // HTML 엔티티 디코딩
        let processed = description
            .replace(/&lt;/g, '<')           // &lt; → <
            .replace(/&gt;/g, '>')           // &gt; → >
            .replace(/&amp;/g, '&')          // &amp; → &
            .replace(/&quot;/g, '"')         // &quot; → "
            .replace(/&#39;/g, "'")          // &#39; → '
            .replace(/&nbsp;/g, ' ')         // &nbsp; → 공백
            .trim();

        // 위험한 태그들 제거 (XSS 방지)
        const allowedTags = ['br', 'p', 'strong', 'b', 'em', 'i', 'u'];
        const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
        
        processed = processed.replace(tagRegex, (match, tagName) => {
            if (allowedTags.includes(tagName.toLowerCase())) {
                // br 태그는 줄바꿈으로 변환
                if (tagName.toLowerCase() === 'br') {
                    return '\n';
                }
                // 다른 허용된 태그들은 텍스트 장식으로 변환
                const lowerTag = tagName.toLowerCase();
                if (lowerTag === 'strong' || lowerTag === 'b') {
                    return match.includes('/') ? '' : '**';
                }
                if (lowerTag === 'em' || lowerTag === 'i') {
                    return match.includes('/') ? '' : '_';
                }
                if (lowerTag === 'u') {
                    return '';
                }
                if (lowerTag === 'p') {
                    return match.includes('/') ? '\n' : '';
                }
                return '';
            }
            // 허용되지 않은 태그는 제거
            return '';
        });

        return processed;
    };

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
        navigate(`/event/${eventId}`);
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

    const handleViewReviews = (eventId) => {
        // 리뷰 보기 페이지로 이동
        console.log('리뷰 보기:', eventId);
        navigate(`/event/${eventId}/reviews`);
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
            <Layout pageTitle="내가 등록한 행사" activeMenuItem="myuploadevent">
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
        <Layout pageTitle="내가 등록한 행사" activeMenuItem="myuploadevent">
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
                        🔄 새로고침
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
                        <div className="myuploadevent-events-grid">
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
                                            summary={processDescription(event.description)}
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
                                                    onClick={() => handleViewReviews(event.id)}
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
        </Layout>
    );
};

export default MyUploadEvent;