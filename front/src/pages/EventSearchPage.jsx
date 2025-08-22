import React, { useState, useRef, useEffect } from 'react';
import { Search, Calendar, MapPin, Users, Filter, X, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import EventCard from '../components/EventCard';
import '../css/eventsearch.css';

const EventSearchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    sort: 'startTime,desc',
    page: 0,
    size: 20
  });
  const searchTimeoutRef = useRef(null);

  // TopBar에서 전달받은 검색어가 있으면 자동 검색
  useEffect(() => {
    const queryFromState = location.state?.query;
    if (queryFromState) {
      setSearchQuery(queryFromState);
      searchEvents(queryFromState);
    }
  }, [location.state]);

  // 검색 결과 포맷팅 함수들
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 이벤트 데이터 변환 함수
  const formatEventForCard = (event) => {
    return {
      id: event.id,
      image: event.posterId ? `https://gateway.gamja.cloud/api/image/${event.posterId}` : null,
      title: event.name,
      summary: event.description,
      hashtags: event.hashtags || [],
      date: formatDate(event.startTime),
      location: event.address,
      time: formatTime(event.startTime),
      fee: event.entryFee ? `${event.entryFee.toLocaleString()}원` : '무료',
      bookmarked: false, // TODO: 북마크 상태 확인 필요
      bookmarking: false
    };
  };

  // 검색 API 호출
  const searchEvents = async (query, currentFilters = filters) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        page: currentFilters.page,
        size: currentFilters.size,
        sort: currentFilters.sort
      });

      const response = await fetch(`https://gateway.gamja.cloud/api/event/search?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        const events = Array.isArray(data) ? data : [];
        
        // 현재 시간보다 이후의 행사들만 필터링
        const currentTime = new Date();
        const futureEvents = events.filter(event => {
          if (!event.endTime) {
            // endTime이 없으면 startTime을 기준으로 판단
            return new Date(event.startTime) > currentTime;
          }
          // endTime이 있으면 endTime을 기준으로 판단
          return new Date(event.endTime) > currentTime;
        });
        
        setSearchResults(futureEvents);
      } else {
        console.error('검색 실패:', response.status);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('검색 API 호출 실패:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 검색어 변경 핸들러
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchEvents(value);
    }, 500);
  };

  // 검색 실행
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchEvents(searchQuery);
  };

  // 필터 변경
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value, page: 0 };
    setFilters(newFilters);
    if (searchQuery.trim()) {
      searchEvents(searchQuery, newFilters);
    }
  };

  // 뒤로가기 핸들러
  const handleGoBack = () => {
    navigate(-1);
  };

  // 북마크 토글 핸들러
  const handleBookmarkToggle = (eventId) => {
    // TODO: 북마크 API 호출
    console.log('북마크 토글:', eventId);
  };

  // 이벤트 카드 클릭 핸들러
  const handleEventCardClick = (eventId) => {
    navigate(`/events/${eventId}`);
  };

  return (
    <div className="event-search-container">
      <div className="event-search-header">
        <div className="event-search-header-top">
          <button 
            className="event-search-back-btn"
            onClick={handleGoBack}
            aria-label="뒤로가기"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="event-search-title">이벤트 검색</h1>
        </div>
        
        <form className="event-search-form" onSubmit={handleSearch}>
          <div className="event-search-input-wrapper">
            <Search className="event-search-icon" size={20} />
            <input
              type="text"
              className="event-search-input"
              placeholder="이벤트명, 장소, 태그로 검색하세요"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button
                type="button"
                className="event-search-clear"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setHasSearched(false);
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <button
            type="button"
            className={`event-search-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            필터
          </button>
        </form>

        {showFilters && (
          <div className="event-search-filters">
            <div className="event-search-filter-item">
              <label className="event-search-filter-label">정렬</label>
              <select
                className="event-search-filter-select"
                value={filters.sort}
                onChange={(e) => handleFilterChange('sort', e.target.value)}
              >
                <option value="startTime,desc">최신순</option>
                <option value="startTime,asc">날짜 빠른순</option>
                <option value="createdTime,desc">등록순</option>
              </select>
            </div>
            
            <div className="event-search-filter-item">
              <label className="event-search-filter-label">페이지 크기</label>
              <select
                className="event-search-filter-select"
                value={filters.size}
                onChange={(e) => handleFilterChange('size', parseInt(e.target.value))}
              >
                <option value={10}>10개씩</option>
                <option value={20}>20개씩</option>
                <option value={50}>50개씩</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="event-search-content">
        {isSearching && (
          <div className="event-search-loading">
            <div className="event-search-spinner"></div>
            <p>검색 중...</p>
          </div>
        )}

        {!isSearching && hasSearched && searchResults.length === 0 && (
          <div className="event-search-empty">
            <Search size={48} className="event-search-empty-icon" />
            <h3>검색 결과가 없습니다</h3>
            <p>다른 키워드로 검색해보세요</p>
          </div>
        )}

        {!isSearching && !hasSearched && (
          <div className="event-search-guide">
            <Search size={48} className="event-search-guide-icon" />
            <h3>이벤트를 검색해보세요</h3>
            <p>이벤트명, 장소, 태그 등으로 원하는 이벤트를 찾을 수 있습니다</p>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="event-search-results">
            <div className="event-search-results-header">
              <h2>검색 결과 ({searchResults.length}개)</h2>
            </div>
            
            <div className="event-search-results-grid">
              {searchResults.map((event) => (
                <EventCard
                  key={event.id}
                  {...formatEventForCard(event)}
                  onBookmarkToggle={() => handleBookmarkToggle(event.id)}
                  onClick={handleEventCardClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventSearchPage;