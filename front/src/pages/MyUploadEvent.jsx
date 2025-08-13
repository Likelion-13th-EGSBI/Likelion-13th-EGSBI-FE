import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
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
                    setEvents(data);
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
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${month}.${day} ${hours}:${minutes}`;
    };

    const handleAddEvent = () => {
        navigate('/event-upload');
    };

    const handleEditEvent = (eventId) => {
        // 행사 수정 로직
        console.log('행사 수정:', eventId);
    };

    const handleMenuClick = (eventId) => {
        // 상세페이지 이동
        console.log('메뉴 클릭:', eventId);
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
                    <div className="myuploadevent-events">
                        {events.map((event, index) => (
                            <div key={event.id || index} className="myuploadevent-card">
                                <div className="myuploadevent-card-image">
                                    <img 
                                        src={event.posterId ? `https://gateway.gamja.cloud/api/image/${event.posterId}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik0xMzAgODBIMTcwVjEyMEgxMzBWODBaIiBmaWxsPSIjRTlFQ0VGIi8+CjxwYXRoIGQ9Ik0xNDAgOTBIMTYwVjEwMEgxNDBWOTBaIiBmaWxsPSIjNUU5MzZDIi8+PC9zdmc+'}
                                        alt={event.name || '행사 이미지'}
                                        onError={(e) => {
                                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik0xMzAgODBIMTcwVjEyMEgxMzBWODBaIiBmaWxsPSIjRTlFQ0VGIi8+CjxwYXRoIGQ9Ik0xNDAgOTBIMTYwVjEwMEgxNDBWOTBaIiBmaWxsPSIjNUU5MzZDIi8+PC9zdmc+';
                                        }}
                                    />
                                </div>
                                
                                <div className="myuploadevent-card-content">
                                    <div className="myuploadevent-card-header">
                                        <h3 className="myuploadevent-card-title">
                                            {event.name || '행사명 없음'}
                                        </h3>
                                        <button 
                                            className="myuploadevent-menu-button"
                                            onClick={() => handleMenuClick(event.id)}
                                        >
                                            ⋯
                                        </button>
                                    </div>
                                    
                                    <p className="myuploadevent-card-description">
                                        {event.description || '설명이 없습니다.'}
                                    </p>
                                    
                                    <div className="myuploadevent-card-info">
                                        {event.startTime && (
                                            <div className="myuploadevent-info-item myuploadevent-info-date">
                                                <span>{formatDate(event.startTime)}</span>
                                            </div>
                                        )}
                                        
                                        {event.address && (
                                            <div className="myuploadevent-info-item myuploadevent-info-location">
                                                <span>{event.address}</span>
                                            </div>
                                        )}
                                        
                                        <div className="myuploadevent-info-item myuploadevent-info-price">
                                            <span>
                                                {event.entryFee ? `${event.entryFee.toLocaleString()}원` : '무료'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="myuploadevent-card-actions">
                                        <button 
                                            className="myuploadevent-action-button myuploadevent-edit"
                                            onClick={() => handleEditEvent(event.id)}
                                        >
                                            수정
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default MyUploadEvent;