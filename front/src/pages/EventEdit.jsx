import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock, MapPin, Users, DollarSign, FileText, Upload, X, Hash, Save, ArrowLeft } from 'lucide-react';
import Layout from '../components/Layout';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import '../css/eventedit.css';

const KAKAO_MAP_SCRIPT_ID = 'kakao-map-script';
const KAKAO_APP_KEY = 'cd740dc5ce8717cd9146f5c91861511a';

// 전역 로딩 플래그
let kakaoSdkLoadingPromise = null;

function loadKakaoSdkOnce() {
  if (typeof window !== 'undefined' && window.kakao?.maps) {
    return Promise.resolve();
  }
  if (kakaoSdkLoadingPromise) return kakaoSdkLoadingPromise;

  kakaoSdkLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(KAKAO_MAP_SCRIPT_ID);
    if (existing) {
      if (window.kakao?.maps) {
        resolve();
      } else {
        existing.addEventListener('load', () => {
          if (window.kakao?.maps) resolve();
          else reject(new Error('kakao undefined after existing script load'));
        });
        existing.addEventListener('error', () => reject(new Error('Kakao SDK script error (existing)')));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = KAKAO_MAP_SCRIPT_ID;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (!window.kakao) {
        reject(new Error('window.kakao is undefined after script load'));
        return;
      }
      try {
        window.kakao.maps.load(() => resolve());
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = (e) => {
      console.error('Kakao Maps SDK network error', e);
      reject(new Error('Kakao Maps SDK network error'));
    };
    document.head.appendChild(script);
  });

  return kakaoSdkLoadingPromise;
}

// LocalDateTime 형식 변환 함수
const formatToLocalDateTime = (date, time) => {
  if (!date || !time) {
    throw new Error('날짜와 시간이 모두 필요합니다.');
  }
  
  const dateTime = new Date(`${date}T${time}:00`);
  
  if (isNaN(dateTime.getTime())) {
    throw new Error('유효하지 않은 날짜/시간 형식입니다.');
  }
  
  return dateTime.toISOString().slice(0, 19);
};

// 날짜/시간 유효성 검사 함수
const validateDateTime = (startDate, startTime, endDate, endTime) => {
  try {
    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(`${endDate}T${endTime}:00`);
    
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return { isValid: false, message: '유효하지 않은 날짜/시간 형식입니다.' };
    }
    
    if (endDateTime <= startDateTime) {
      return { isValid: false, message: '종료일시는 시작일시보다 늦어야 합니다.' };
    }
    
    return { isValid: true };
  } catch (error) {
    return { isValid: false, message: '날짜/시간 검증 중 오류가 발생했습니다.' };
  }
};

// DateTime 문자열을 날짜와 시간으로 분리하는 함수
const parseDateTime = (dateTimeString) => {
  if (!dateTimeString) return { date: '', time: '' };
  
  const dateTime = new Date(dateTimeString);
  const date = dateTime.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = dateTime.toTimeString().slice(0, 5); // HH:mm
  
  return { date, time };
};

const EventEdit = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // MyUploadEvent에서 전달받은 행사 데이터
  const eventData = location.state?.eventData;
  
  const [formData, setFormData] = useState({
    eventName: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    participantLimit: '',
    fee: '',
    address: '',
    latitude: null,
    longitude: null,
    hashtags: []
  });
  
  const [hashtagInput, setHashtagInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPostcode, setShowPostcode] = useState(false);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [addressResults, setAddressResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const fileInputRef = useRef(null);

  // 전달받은 행사 데이터로 폼 초기화
  useEffect(() => {
    if (!eventData) {
      alert('행사 데이터가 없습니다.');
      navigate('/my-upload-event');
      return;
    }

    console.log('전달받은 행사 데이터:', eventData);
    
    // 시작/종료 시간 파싱
    const startDateTime = parseDateTime(eventData.startTime);
    const endDateTime = parseDateTime(eventData.endTime);
    
    console.log('파싱된 날짜/시간:', { 
      start: startDateTime, 
      end: endDateTime,
      originalStart: eventData.startTime,
      originalEnd: eventData.endTime
    });
    
    // 폼 데이터 설정
    const newFormData = {
      eventName: eventData.name || '',
      startDate: startDateTime.date,
      endDate: endDateTime.date,
      startTime: startDateTime.time,
      endTime: endDateTime.time,
      location: eventData.address || '',
      description: eventData.description || '',
      participantLimit: eventData.participantLimit?.toString() || '',
      fee: eventData.entryFee?.toString() || '0',
      address: eventData.address || '',
      latitude: eventData.latitude,
      longitude: eventData.longitude,
      hashtags: eventData.hashtags || []
    };
    
    console.log('설정할 폼 데이터:', newFormData);
    setFormData(newFormData);

    // 기존 이미지 설정
    if (eventData.posterId) {
      const imageUrl = `https://gateway.gamja.cloud/api/image/${eventData.posterId}`;
      console.log('기존 이미지 URL:', imageUrl);
      setOriginalImageUrl(imageUrl);
      setImagePreview(imageUrl);
    }

    setIsLoading(false);
  }, [eventData, navigate]);

  // Kakao SDK 로드
  useEffect(() => {
    let mounted = true;
    loadKakaoSdkOnce()
      .then(() => {
        if (!mounted) return;
        setKakaoReady(true);
      })
      .catch((err) => {
        console.error('Kakao SDK load failed:', err);
        setKakaoReady(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 해시태그 관련 함수들
  const addHashtag = useCallback((tag) => {
    const cleanTag = tag.replace(/^#/, '').trim();
    if (cleanTag && !formData.hashtags.includes(cleanTag) && formData.hashtags.length < 5) {
      setFormData(prev => ({
        ...prev,
        hashtags: [...prev.hashtags, cleanTag]
      }));
    }
  }, [formData.hashtags]);

  const removeHashtag = useCallback((tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      hashtags: prev.hashtags.filter(tag => tag !== tagToRemove)
    }));
  }, []);

  const handleHashtagInput = useCallback((value) => {
    setHashtagInput(value);
  }, []);

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const handleHashtagKeyDown = useCallback((e) => {
    if (isComposing) return;
    
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      e.stopPropagation();
      
      const value = e.target.value.trim();
      if (value) {
        addHashtag(value);
        setHashtagInput('');
      }
    } else if (e.key === 'Backspace' && !e.target.value && formData.hashtags.length > 0) {
      removeHashtag(formData.hashtags[formData.hashtags.length - 1]);
    }
  }, [addHashtag, removeHashtag, formData.hashtags, isComposing]);

  // 주소 검색 관련 함수들
  const searchAddress = async (query) => {
    if (!query.trim() || query.length < 2) {
      setAddressResults([]);
      return;
    }
    if (!kakaoReady) return;
    
    setIsSearching(true);

    try {
      const { kakao } = window;
      if (!kakao?.maps?.services) {
        setIsSearching(false);
        return;
      }
      
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(query, (data, status) => {
        setIsSearching(false);
        if (status === kakao.maps.services.Status.OK) {
          const results = data.slice(0, 5).map((place) => ({
            id: place.id,
            placeName: place.place_name,
            addressName: place.address_name,
            roadAddressName: place.road_address_name,
            latitude: parseFloat(place.y),
            longitude: parseFloat(place.x),
            phone: place.phone,
            categoryName: place.category_name
          }));
          setAddressResults(results);
        } else {
          setAddressResults([]);
        }
      });
    } catch (error) {
      console.error('주소 검색 중 오류:', error);
      setAddressResults([]);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (addressSearchQuery) {
        searchAddress(addressSearchQuery);
      } else {
        setAddressResults([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [addressSearchQuery, kakaoReady]);

  const handleAddressSelect = (selectedAddress) => {
    const fullAddress = selectedAddress.roadAddressName || selectedAddress.addressName;
    setFormData((prev) => ({
      ...prev,
      location: fullAddress,
      address: fullAddress,
      latitude: selectedAddress.latitude,
      longitude: selectedAddress.longitude
    }));
    setAddressSearchQuery('');
    setAddressResults([]);
    setShowPostcode(false);
  };

  // 이미지 관련 함수들
  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(originalImageUrl || null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (field, value) => {
    // 수정 모드에서는 과거 날짜도 허용 (기존 행사 날짜 유지 가능)
    if (field === 'endDate' && formData.startDate && value < formData.startDate) {
      alert('종료날짜는 시작날짜보다 이후여야 합니다.');
      return;
    }
    
    if (field === 'startDate' && formData.endDate && value > formData.endDate) {
      // 시작일을 변경할 때 종료일도 같이 조정
      setFormData((prev) => ({
        ...prev,
        [field]: value,
        endDate: value
      }));
      return;
    }
    
    const newFormData = { ...formData, [field]: value };
    
    if (field === 'endTime' || field === 'startTime') {
      if (newFormData.startDate && newFormData.endDate && 
          newFormData.startTime && (field === 'endTime' ? value : newFormData.endTime)) {
        
        const validation = validateDateTime(
          newFormData.startDate, 
          newFormData.startTime, 
          newFormData.endDate, 
          field === 'endTime' ? value : newFormData.endTime
        );
        
        if (!validation.isValid) {
          alert(validation.message);
          return;
        }
      }
    }
    
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // 멀티파트 폼 데이터로 API 호출하는 함수 (LocalDateTime 형식)
  const submitEventToAPI = async (eventData, imageFile) => {
    setIsSubmitting(true);
    try {
      // 최종 날짜/시간 유효성 검사
      const validation = validateDateTime(
        eventData.startDate, 
        eventData.startTime, 
        eventData.endDate, 
        eventData.endTime
      );
      
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // FormData 객체 생성 (멀티파트 폼 데이터)
      const formData = new FormData();
      
      // LocalDateTime 형식으로 변환
      const startDateTime = formatToLocalDateTime(eventData.startDate, eventData.startTime);
      const endDateTime = formatToLocalDateTime(eventData.endDate, eventData.endTime);
      
      console.log('Formatted DateTime:', { startDateTime, endDateTime });
      
      // 이벤트 데이터 JSON 객체 생성 (해시태그 포함)
      const eventJson = {
        id: parseInt(eventId), // 수정할 이벤트 ID 추가
        name: eventData.eventName,
        startTime: startDateTime,
        endTime: endDateTime,
        organizerId: 1,
        latitude: parseFloat(eventData.latitude) || 37.5665,
        longitude: parseFloat(eventData.longitude) || 126.978,
        entryFee: parseInt(eventData.fee) || 0,
        address: eventData.address || eventData.location,
        description: eventData.description || '',
        participantLimit: parseInt(eventData.participantLimit) || 0,
        hashtags: eventData.hashtags || [] // 해시태그 배열 추가
      };
      
      console.log('Event JSON:', eventJson);
      
      // FormData에 이벤트 정보를 JSON 문자열로 추가 (Content-Type 명시)
      formData.append('event', new Blob([JSON.stringify(eventJson)], {
        type: 'application/json'
      }));
      
      // 이미지 파일이 있는 경우에만 추가
      if (imageFile) {
        console.log('Adding image file:', imageFile.name, 'Size:', imageFile.size);
        formData.append('image', imageFile);
      } else {
        console.log('No image file selected - appending empty file');
        // 빈 이미지 파일 추가 (서버에서 요구하는 경우)
        formData.append('image', new Blob([], { type: 'application/octet-stream' }));
      }
      
      // FormData 내용 확인 (디버깅용)
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
        } else if (value instanceof Blob) {
          console.log(`${key}: Blob(${value.size} bytes, ${value.type})`);
        } else {
          console.log(`${key}:`, value);
        }
      }
      
      // 멀티파트 폼 데이터로 PATCH 요청
      const response = await fetch('https://gateway.gamja.cloud/api/event', {
        method: 'PATCH',
        body: formData,
        // Content-Type 헤더를 설정하지 않음 - 브라우저가 자동으로 multipart/form-data로 설정
      });
      
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        } catch {
          errorMessage = await response.text() || `HTTP ${response.status}`;
        }
        throw new Error(`서버 오류 (${response.status}): ${errorMessage}`);
      }
      
      const result = await response.json();
      console.log('API Response:', result);
      return result;
    } catch (error) {
      console.error('API 호출 실패:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // 행사 수정 처리 함수
  const submitEventUpdate = async () => {
    try {
      // 필수 필드 검증
      if (!formData.eventName.trim()) {
        throw new Error('행사 이름을 입력해주세요.');
      }
      
      if (!formData.startDate || !formData.endDate || 
          !formData.startTime || !formData.endTime) {
        throw new Error('날짜와 시간을 모두 입력해주세요.');
      }

      if (!formData.latitude || !formData.longitude) {
        throw new Error('주소 검색을 통해 정확한 위치를 선택해주세요.');
      }

      // API 호출
      await submitEventToAPI(formData, selectedImage);
      
      alert('행사가 성공적으로 수정되었습니다!');
      navigate('/my-upload-event');
      
    } catch (error) {
      console.error('행사 수정 실패:', error);
      alert(`행사 수정에 실패했습니다: ${error.message}`);
    }
  };

  const handleBack = () => {
    navigate('/my-upload-event');
  };

  if (isLoading) {
    return (
      <Layout pageTitle="행사 수정" activeMenuItem="myuploadevent">
        <div className="event-edit-container">
          <div className="event-edit-loading">
            <div className="event-edit-loading-dot"></div>
            <div className="event-edit-loading-dot"></div>
            <div className="event-edit-loading-dot"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="행사 수정" activeMenuItem="myuploadevent">
      <div className="event-edit-container">
        {/* 헤더 */}
        <div className="event-edit-header">
          <h1 className="event-edit-title">행사 수정</h1>
        </div>

        {/* 폼 섹션들 */}
        <div className="event-edit-form">
          
          {/* 기본 정보 */}
          <div className="event-edit-section">
            <h2 className="event-edit-section-title">기본 정보</h2>
            
            <div className="event-edit-field-group">
              <label className="event-edit-label">행사 이름</label>
              <input
                className="event-edit-input"
                type="text"
                placeholder="예: 동네 플리마켓"
                value={formData.eventName}
                onChange={(e) => handleInputChange('eventName', e.target.value)}
              />
            </div>

            <div className="event-edit-field-row">
              <div className="event-edit-field">
                <label className="event-edit-label">시작 날짜</label>
                <input
                  className="event-edit-input"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                />
              </div>
              <div className="event-edit-field">
                <label className="event-edit-label">종료 날짜</label>
                <input
                  className="event-edit-input"
                  type="date"
                  value={formData.endDate}
                  min={formData.startDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                />
              </div>
            </div>

            <div className="event-edit-field-row">
              <div className="event-edit-field">
                <label className="event-edit-label">시작 시간</label>
                <input
                  className="event-edit-input"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                />
              </div>
              <div className="event-edit-field">
                <label className="event-edit-label">종료 시간</label>
                <input
                  className="event-edit-input"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 장소 정보 */}
          <div className="event-edit-section">
            <h2 className="event-edit-section-title">장소 정보</h2>
            
            <div className="event-edit-field-group">
              <label className="event-edit-label">장소</label>
              <div className="event-edit-address-container">
                <input
                  className="event-edit-input"
                  type="text"
                  placeholder={kakaoReady ? '주소를 검색하세요' : '카카오맵 준비 중...'}
                  value={addressSearchQuery}
                  onChange={(e) => setAddressSearchQuery(e.target.value)}
                  onFocus={() => setShowPostcode(true)}
                  disabled={!kakaoReady}
                />
                {formData.location && (
                  <div className="event-edit-selected-address">
                    <MapPin size={16} />
                    <span className="event-edit-address-text">{formData.location}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          location: '',
                          address: '',
                          latitude: null,
                          longitude: null
                        }));
                      }}
                      className="event-edit-clear-address"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 행사 상세 */}
          <div className="event-edit-section">
            <h2 className="event-edit-section-title">행사 상세</h2>
            
            <div className="event-edit-field-row">
              <div className="event-edit-field">
                <label className="event-edit-label">참가 인원</label>
                <input
                  className="event-edit-input"
                  type="number"
                  placeholder="예: 50"
                  value={formData.participantLimit}
                  onChange={(e) => handleInputChange('participantLimit', e.target.value)}
                />
              </div>
              <div className="event-edit-field">
                <label className="event-edit-label">참가비</label>
                <input
                  className="event-edit-input"
                  type="text"
                  placeholder="무료인 경우 0 입력"
                  value={formData.fee}
                  onChange={(e) => handleInputChange('fee', e.target.value)}
                />
              </div>
            </div>

            <div className="event-edit-field-group">
              <label className="event-edit-label">해시태그</label>
              <div className="event-edit-hashtag-container">
                <div className="event-edit-hashtag-input-wrapper">
                  <div className="event-edit-hashtag-list">
                    {formData.hashtags.map((tag, index) => (
                      <div key={index} className="event-edit-hashtag-tag">
                        <Hash size={12} />
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeHashtag(tag)}
                          className="event-edit-hashtag-remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <input
                      className="event-edit-hashtag-input"
                      type="text"
                      placeholder={formData.hashtags.length === 0 ? "예: 음악, 축제, 무료" : "더 추가하려면 입력하세요"}
                      value={hashtagInput}
                      onChange={(e) => handleHashtagInput(e.target.value)}
                      onKeyDown={handleHashtagKeyDown}
                      onCompositionStart={handleCompositionStart}
                      onCompositionEnd={handleCompositionEnd}
                      disabled={formData.hashtags.length >= 5}
                    />
                  </div>
                </div>
                <div className="event-edit-hashtag-info">
                  <p className="event-edit-hashtag-tip">
                    💡 엔터나 쉼표로 구분하여 입력하세요 (최대 5개)
                  </p>
                  <p className="event-edit-hashtag-count">
                    {formData.hashtags.length}/5
                  </p>
                </div>
              </div>
            </div>

            <div className="event-edit-field-group">
              <label className="event-edit-label">행사 설명</label>
              <textarea
                className="event-edit-textarea"
                placeholder="참가자들이 알아야 할 내용을 작성해주세요"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={6}
              />
            </div>
          </div>

          {/* 포스터 이미지 */}
          <div className="event-edit-section">
            <h2 className="event-edit-section-title">포스터 이미지</h2>
            
            <div className="event-edit-image-upload">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="event-edit-file-input"
              />

              {!imagePreview ? (
                <div className="event-edit-upload-area" onClick={() => fileInputRef.current?.click()}>
                  <div className="event-edit-upload-icon">
                    <Upload size={48} />
                  </div>
                  <p className="event-edit-upload-text">클릭하여 이미지를 선택하세요</p>
                  <p className="event-edit-upload-desc">JPG, PNG 파일 (최대 10MB)</p>
                </div>
              ) : (
                <div className="event-edit-image-preview">
                  <img className="event-edit-preview-image" src={imagePreview} alt="선택된 이미지" />
                  <button className="event-edit-remove-image" onClick={removeImage}>
                    <X size={20} />
                  </button>
                  <button className="event-edit-change-image" onClick={() => fileInputRef.current?.click()}>
                    <span className="event-edit-change-text">이미지 변경</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="event-edit-actions">
            <button
              onClick={handleBack}
              className="event-edit-cancel-button"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              onClick={submitEventUpdate}
              disabled={isSubmitting}
              className="event-edit-submit-button"
            >
              <Save size={16} />
              {isSubmitting ? '수정 중...' : '수정 완료'}
            </button>
          </div>
        </div>

        {/* 주소 검색 모달 */}
        {showPostcode && (
          <div className="event-edit-postcode-overlay">
            <div className="event-edit-postcode-container">
              <div className="event-edit-postcode-header">
                <h3 className="event-edit-postcode-title">주소 검색</h3>
                <button className="event-edit-postcode-close" onClick={() => setShowPostcode(false)}>
                  <X size={24} />
                </button>
              </div>

              <div className="event-edit-address-search-content">
                <input
                  type="text"
                  placeholder={kakaoReady ? '장소명이나 주소를 입력하세요' : '카카오맵 준비 중입니다.'}
                  value={addressSearchQuery}
                  onChange={(e) => setAddressSearchQuery(e.target.value)}
                  className="event-edit-address-search-input"
                  disabled={!kakaoReady}
                  autoFocus
                />

                {isSearching && <div className="event-edit-search-loading">검색 중...</div>}

                <div className="event-edit-address-results">
                  {addressResults.map((result) => (
                    <div
                      key={result.id}
                      className="event-edit-address-result-item"
                      onClick={() => handleAddressSelect(result)}
                    >
                      <div className="event-edit-address-result-main">
                        <h4 className="event-edit-place-name">{result.placeName}</h4>
                        <p className="event-edit-address-result-address">
                          {result.roadAddressName || result.addressName}
                        </p>
                        {result.phone && <p className="event-edit-address-result-phone">{result.phone}</p>}
                      </div>
                      <div className="event-edit-address-result-category">{result.categoryName}</div>
                    </div>
                  ))}

                  {!isSearching && kakaoReady && addressSearchQuery && addressResults.length === 0 && (
                    <div className="event-edit-no-results">
                      <p className="event-edit-no-results-text">검색 결과가 없습니다.</p>
                      <p className="event-edit-no-results-desc">
                        직접 주소를 입력하려면 아래 버튼을 클릭하세요.
                      </p>
                      <button
                        className="event-edit-manual-address-btn"
                        onClick={() => {
                          const manualAddress = prompt('주소를 직접 입력하세요:');
                          if (manualAddress) {
                            setFormData((prev) => ({
                              ...prev,
                              location: manualAddress,
                              address: manualAddress,
                              latitude: 37.5665,
                              longitude: 126.978
                            }));
                            setShowPostcode(false);
                            setAddressSearchQuery('');
                          }
                        }}
                      >
                        수동으로 주소 입력
                      </button>
                    </div>
                  )}

                  {addressSearchQuery.length === 0 && (
                    <div className="event-edit-search-guide">
                      <p className="event-edit-guide-title">💡 검색 팁:</p>
                      <ul className="event-edit-guide-list">
                        <li className="event-edit-guide-item">• 장소명: "강남역", "홍대입구"</li>
                        <li className="event-edit-guide-item">• 건물명: "롯데월드타워", "63빌딩"</li>
                        <li className="event-edit-guide-item">• 주소: "서울시 강남구 테헤란로"</li>
                      </ul>
                    </div>
                  )}

                  {!kakaoReady && (
                    <div className="event-edit-search-guide">
                      <p className="event-edit-sdk-error">
                        카카오맵 SDK가 아직 준비되지 않았습니다. 도메인/키 설정 또는 네트워크 차단 여부를 확인하세요.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EventEdit;