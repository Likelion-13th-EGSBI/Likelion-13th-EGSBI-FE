import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import EventCard from "../components/EventCard"; // EventCard 컴포넌트 import
import '../css/myuploadevent.css';
import { useNavigate } from "react-router-dom";

const MyUploadEvent = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response = await fetch(
                    `https://gateway.gamja.cloud/api/event/1`, 
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (Array.isArray(data)) {
                    // createTime 기준으로 최신순 정렬 (내림차순)
                    const sortedEvents = data.sort((a, b) => {
                        const dateA = new Date(a.createTime);
                        const dateB = new Date(b.createTime);
                        return dateB - dateA; // 최신이 먼저 오도록
                    });
                    setEvents(sortedEvents);
                } else {
                    setEvents([]);
                }

            } catch (error) {
                console.error('Error fetching events:', error);
                setEvents([]);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

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
        // navigate(`/event/${eventId}`);
    };

    const handleBookmarkToggle = (eventId) => {
        // 북마크 토글 로직 (현재는 로그만 출력)
        console.log('북마크 토글:', eventId);
    };

    const handleEditEvent = (eventId) => {
        // 행사 수정 페이지로 이동
        console.log('행사 수정:', eventId);
        navigate(`/event-edit/${eventId}`);
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

                {/* 메인 콘텐츠 */}
                {events.length === 0 ? (
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
                    <div className="myuploadevent-events-grid">
                        {events.map((event, index) => {
                            const eventEnded = isEventEnded(event.endTime);
                            
                            return (
                                <div key={event.id || index} className="myuploadevent-event-wrapper">
                                    <EventCard
                                        id={event.id}
                                        image={event.posterId ? `https://gateway.gamja.cloud/api/image/${event.posterId}` : null}
                                        title={event.name || '행사명 없음'}
                                        summary={event.description || '설명이 없습니다.'}
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
                                                onClick={() => handleEditEvent(event.id)}
                                            >
                                                수정하기
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default MyUploadEvent;