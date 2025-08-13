import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, Users, DollarSign, FileText, ArrowLeft, Check, ChevronRight, Upload, X } from 'lucide-react';
import Layout from '../components/Layout';
import '../css/eventupload.css';

const KAKAO_MAP_SCRIPT_ID = 'kakao-map-script';
const KAKAO_APP_KEY = 'cd740dc5ce8717cd9146f5c91861511a';

// 전역 로딩 플래그(다중 마운트/StrictMode 대비)
let kakaoSdkLoadingPromise = null;

function loadKakaoSdkOnce() {
  if (typeof window !== 'undefined' && window.kakao?.maps) {
    return Promise.resolve();
  }
  if (kakaoSdkLoadingPromise) return kakaoSdkLoadingPromise;

  kakaoSdkLoadingPromise = new Promise((resolve, reject) => {
    // 중복 스크립트 방지
    const existing = document.getElementById(KAKAO_MAP_SCRIPT_ID);
    if (existing) {
      // 이미 붙어있으면 load 이벤트만 대기
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
    // autoload=false로 하고 load 콜백에서 kakao.maps.load 사용
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
      // 네트워크 탭에서 상태코드(401/403 등) 확인 필요
      console.error('Kakao Maps SDK network error, check domain & JS key & blockers', e);
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
  
  // date는 'YYYY-MM-DD' 형식, time은 'HH:mm' 형식
  // LocalDateTime은 'YYYY-MM-DDTHH:mm:ss' 형식을 요구
  const dateTime = new Date(`${date}T${time}:00`);
  
  // 유효한 날짜인지 확인
  if (isNaN(dateTime.getTime())) {
    throw new Error('유효하지 않은 날짜/시간 형식입니다.');
  }
  
  // ISO 형식으로 변환 후 'Z'를 제거하여 로컬 시간으로 처리
  // 예: '2024-01-15T10:30:00'
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
    
    const now = new Date();
    if (startDateTime < now) {
      return { isValid: false, message: '시작일시는 현재시간보다 늦어야 합니다.' };
    }
    
    return { isValid: true };
  } catch (error) {
    return { isValid: false, message: '날짜/시간 검증 중 오류가 발생했습니다.' };
  }
};

const EventUpload = () => {
  const [selectedMode, setSelectedMode] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
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
    longitude: null
  });
  const [aiGeneratedContent, setAiGeneratedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showStep, setShowStep] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPostcode, setShowPostcode] = useState(false);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [addressResults, setAddressResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Kakao SDK 준비 상태
  const [kakaoReady, setKakaoReady] = useState(true);

  const isRegistered = useRef(false);
  const fileInputRef = useRef(null);
  const effectGuardRef = useRef(false); // StrictMode 2회 호출 방지 보조

  const steps = [
    { id: 'mode', title: '어떻게 행사를 만드실건가요?', type: 'mode' },
    { id: 'eventName', title: '행사 이름을 알려주세요', type: 'text', placeholder: '예: 동네 플리마켓' },
    { id: 'startDate', title: '언제 시작하나요?', type: 'date' },
    { id: 'endDate', title: '언제 끝나나요?', type: 'date' },
    { id: 'startTime', title: '시작 시간을 선택하세요', type: 'time' },
    { id: 'endTime', title: '종료 시간을 선택하세요', type: 'time' },
    { id: 'location', title: '어디서 진행하시나요?', type: 'address', placeholder: '주소를 검색하세요' },
    { id: 'participantLimit', title: '몇 명까지 참여할 수 있나요?', type: 'number', placeholder: '예: 50' },
    { id: 'fee', title: '참가비가 있나요?', type: 'text', placeholder: '무료인 경우 0 입력' },
    { id: 'image', title: '행사 포스터 이미지를 선택해주세요', type: 'image' }
  ];

  // 모바일 체크
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 스텝 애니메이션 토글
  useEffect(() => {
    setShowStep(true);
  }, [currentStep]);

  // 뒤로가기 이벤트
  useEffect(() => {
    const onPopState = (e) => {
      if (isRegistered.current) return;
      e.preventDefault();
      if (currentStep > 0) {
        setShowStep(false);
        setTimeout(() => setCurrentStep((prev) => Math.max(prev - 1, 0)), 200);
        window.history.pushState(null, '');
      }
    };
    if (!isRegistered.current) {
      window.history.pushState(null, '');
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentStep]);

  // Kakao SDK 로드(안정화)
  useEffect(() => {
    if (effectGuardRef.current) return;
    effectGuardRef.current = true;

    let mounted = true;
    loadKakaoSdkOnce()
      .then(() => {
        if (!mounted) return;
        setKakaoReady(true);
        console.log('Kakao Maps SDK ready');
      })
      .catch((err) => {
        console.error('Kakao SDK load failed:', err);
        setKakaoReady(false);
      });

    // 언마운트 시 스크립트를 제거하지 않습니다(재사용)
    return () => {
      mounted = false;
    };
  }, []);

  // 주소 검색 함수 (Kakao Places 우선)
  const searchAddress = async (query) => {
    if (!query.trim() || query.length < 2) {
      setAddressResults([]);
      return;
    }
    if (!kakaoReady) {
      console.warn('Kakao SDK not ready yet. Preventing search.');
      return;
    }
    setIsSearching(true);

    try {
      const { kakao } = window;
      if (!kakao?.maps?.services) {
        console.warn('kakao.maps.services is unavailable.');
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
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
          setAddressResults([]);
          console.log('검색 결과가 없습니다.');
        } else {
          setAddressResults([]);
          console.error('검색 중 오류 상태:', status);
        }
      });
    } catch (error) {
      console.error('주소 검색 중 오류:', error);
      setAddressResults([]);
      setIsSearching(false);
    }
  };

  // 주소 검색 디바운스
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

  // 주소 선택 처리
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
    console.log('선택된 주소:', {
      address: fullAddress,
      latitude: selectedAddress.latitude,
      longitude: selectedAddress.longitude
    });
  };

  // 이미지 파일 선택
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
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (field, value) => {
    // 개선된 날짜/시간 유효성 검사
    if (field === 'endDate' && formData.startDate && value < formData.startDate) {
      alert('종료날짜는 시작날짜보다 이후여야 합니다.');
      return;
    }
    
    if (field === 'startDate' && formData.endDate && value > formData.endDate) {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
        endDate: value
      }));
      return;
    }
    
    // 시간 변경 시 실시간 검증
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

  const handleNext = () => {
    if (selectedMode === 'ai' && currentStep === steps.length - 1) {
      handleAiGenerate();
    } else if (currentStep < steps.length - 1) {
      setShowStep(false);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        window.history.pushState(null, '');
      }, 200);
    } else {
      handleDirectSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setShowStep(false);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        window.history.pushState(null, '');
      }, 200);
    }
  };

  const handleModeSelect = (mode) => setSelectedMode(mode);

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
      
      // 이벤트 데이터 JSON 객체 생성
      const eventJson = {
        name: eventData.eventName,
        startTime: startDateTime,
        endTime: endDateTime,
        organizerId: 1,
        latitude: parseFloat(eventData.latitude) || 37.5665,
        longitude: parseFloat(eventData.longitude) || 126.978,
        entryFee: parseInt(eventData.fee) || 0,
        address: eventData.address || eventData.location,
        description: eventData.description || '',
        participantLimit: parseInt(eventData.participantLimit) || 0
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
      
      // 멀티파트 폼 데이터로 POST 요청
      const response = await fetch('https://gateway.gamja.cloud/api/event', {
        method: 'POST',
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

  const handleDirectSubmit = async () => {
    try {
      const finalFormData = { ...formData };
      if (!finalFormData.latitude && !finalFormData.longitude) {
        alert('주소 검색을 통해 정확한 위치를 선택해주세요.');
        return;
      }
      
      // 필수 필드 검증
      if (!finalFormData.eventName.trim()) {
        alert('행사 이름을 입력해주세요.');
        return;
      }
      
      if (!finalFormData.startDate || !finalFormData.endDate || 
          !finalFormData.startTime || !finalFormData.endTime) {
        alert('날짜와 시간을 모두 입력해주세요.');
        return;
      }
      
      await submitEventToAPI(finalFormData, selectedImage);
      alert('행사가 성공적으로 등록되었습니다!');
      resetAll();
    } catch (error) {
      alert(`행사 등록에 실패했습니다: ${error.message}`);
    }
  };

  const handleAiGenerate = () => {
    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      
      const formatDateTime = (date) =>
        date.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      
      const aiDescription = `${formData.eventName}는 ${formData.location}에서 ${formatDateTime(
        startDateTime
      )}부터 ${formatDateTime(endDateTime)}까지 진행되는 특별한 행사입니다. 
최대 ${formData.participantLimit}명의 참가자들에게 새로운 경험과 네트워킹 기회를 제공하며, 
전문적이고 체계적인 프로그램으로 구성되어 있습니다. 
${formData.fee === '0' ? '무료로 진행되는' : `참가비 ${formData.fee}원으로 진행되는`} 이번 행사에 많은 분들의 참여를 기다립니다.`;

      setAiGeneratedContent(aiDescription);
      setCurrentStep('ai-result');
    } catch (error) {
      alert('AI 콘텐츠 생성 중 오류가 발생했습니다.');
      console.error('AI Generate Error:', error);
    }
  };

  const handleAiConfirm = async () => {
    try {
      const finalFormData = {
        ...formData,
        description: aiGeneratedContent
      };
      if (!finalFormData.latitude && !finalFormData.longitude) {
        alert('주소 검색을 통해 정확한 위치를 선택해주세요.');
        return;
      }
      await submitEventToAPI(finalFormData, selectedImage);
      alert('행사가 성공적으로 등록되었습니다!');
      resetAll();
    } catch (error) {
      alert(`행사 등록에 실패했습니다: ${error.message}`);
    }
  };

  const resetAll = () => {
    isRegistered.current = true;
    setSelectedMode(null);
    setCurrentStep(0);
    setFormData({
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
      longitude: null
    });
    setAiGeneratedContent('');
    setIsEditing(false);
    setShowStep(true);
    setSelectedImage(null);
    setImagePreview(null);
    setShowPostcode(false);
    setAddressSearchQuery('');
    setAddressResults([]);
    window.history.pushState(null, '');
    isRegistered.current = false;
  };

  const canProceed = () => {
    const step = steps[currentStep];
    if (!step) return false;
    switch (step.id) {
      case 'mode':
        return selectedMode !== null;
      case 'eventName':
        return formData.eventName.trim() !== '';
      case 'startDate':
        return formData.startDate !== '';
      case 'endDate':
        return formData.endDate !== '';
      case 'startTime':
        return formData.startTime !== '';
      case 'endTime':
        return formData.endTime !== '';
      case 'location':
        return formData.location.trim() !== '' && formData.latitude && formData.longitude;
      case 'participantLimit':
        return formData.participantLimit !== '';
      case 'fee':
        return formData.fee !== '';
      case 'image':
        return selectedImage !== null;
      default:
        return false;
    }
  };

  // AI 결과 페이지
  if (currentStep === 'ai-result') {
    const content = (
      <div className="eventupload-container">
        <div className="eventupload-header">
          <div className="eventupload-progress-bar">
            <div className="eventupload-progress-fill" style={{ width: '100%' }}></div>
          </div>
        </div>

        <div className={`eventupload-step-content ${showStep ? 'show' : ''}`}>
        <div className="eventupload-ai-result">
  <div className="eventupload-ai-scroll-container">
    <h1 className="eventupload-title">AI가 행사 소개를 작성했어요</h1>

    <div className="eventupload-ai-content-card">
      {isEditing ? (
        <div className="eventupload-edit-container">
          <textarea
            className="eventupload-edit-textarea"
            value={aiGeneratedContent}
            onChange={(e) => setAiGeneratedContent(e.target.value)}
            rows={6}
          />
          <div className="eventupload-edit-buttons">
            <button onClick={() => setIsEditing(false)} className="eventupload-edit-save">
              <Check size={16} />
              저장
            </button>
            <button onClick={() => setIsEditing(false)} className="eventupload-edit-cancel">
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="eventupload-ai-content">
          <p className="eventupload-ai-text">{aiGeneratedContent}</p>
          <button onClick={() => setIsEditing(true)} className="eventupload-edit-button">
            수정하기
          </button>
        </div>
      )}
    </div>

    <div className="eventupload-summary-card">
      <h3 className="eventupload-summary-title">행사 정보</h3>
      <div className="eventupload-summary-list">
        <div className="eventupload-summary-item">
          <span className="eventupload-summary-label">행사명</span>
          <span className="eventupload-summary-value">{formData.eventName}</span>
        </div>
        <div className="eventupload-summary-item">
          <span className="eventupload-summary-label">시작일시</span>
          <span className="eventupload-summary-value">
            {formData.startDate} {formData.startTime}
          </span>
        </div>
        <div className="eventupload-summary-item">
          <span className="eventupload-summary-label">종료일시</span>
          <span className="eventupload-summary-value">
            {formData.endDate} {formData.endTime}
          </span>
        </div>
        <div className="eventupload-summary-item">
          <span className="eventupload-summary-label">장소</span>
          <span className="eventupload-summary-value">{formData.location}</span>
        </div>
        <div className="eventupload-summary-item">
          <span className="eventupload-summary-label">참가인원</span>
          <span className="eventupload-summary-value">{formData.participantLimit}명</span>
        </div>
        <div className="eventupload-summary-item">
          <span className="eventupload-summary-label">참가비</span>
          <span className="eventupload-summary-value">
            {formData.fee === '0' ? '무료' : `${formData.fee}원`}
          </span>
        </div>
        {imagePreview && (
          <div className="eventupload-summary-item">
            <span className="eventupload-summary-label">포스터</span>
            <img src={imagePreview} alt="선택된 이미지" className="eventupload-summary-image" />
          </div>
        )}
      </div>
    </div>

    <div className="eventupload-bottom">
        <div className="eventupload-button-group">
          <button
            className="eventupload-back-button"
            onClick={() => {
              setCurrentStep(steps.length - 1); // 마지막 스텝(이미지 업로드)으로 돌아가기
              setShowStep(true);
            }}
          >
            이전
          </button>
          <button 
            onClick={handleAiConfirm} 
            className="eventupload-next-button active" 
            disabled={isSubmitting}
          >
            {isSubmitting ? '등록 중...' : '행사 등록하기'}
          </button>
        </div>
      </div>
  </div>
</div>

        </div>
      </div>
    );

    return (
      <Layout pageTitle="행사 등록" activeMenuItem="event-upload">
        {content}
      </Layout>
    );
  }

  const currentStepData = steps[currentStep];

  const content = (
    <div className="eventupload-container">
      <div className="eventupload-header">
        <div className="eventupload-progress-bar">
          <div
            className="eventupload-progress-fill"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className={`eventupload-step-content ${showStep ? 'show' : ''}`}>
        <div className="eventupload-question">
          <h1 className="eventupload-title">{currentStepData.title}</h1>

          {currentStepData.type === 'mode' && (
            <div className="eventupload-mode-selection">
              <div
                className={`eventupload-mode-card ${selectedMode === 'direct' ? 'selected' : ''}`}
                onClick={() => handleModeSelect('direct')}
              >
                <div className="eventupload-mode-icon">
                  <FileText size={32} />
                </div>
                <div className="eventupload-mode-content">
                  <p className="eventupload-mode-title">직접 입력하기</p>
                  <p className="eventupload-mode-desc">모든 내용을 직접 작성해요</p>
                </div>
              </div>

              <div
                className={`eventupload-mode-card ${selectedMode === 'ai' ? 'selected' : ''}`}
                onClick={() => handleModeSelect('ai')}
              >
                <div className="eventupload-mode-icon">
                  <span className="eventupload-ai-icon">✨</span>
                </div>
                <div className="eventupload-mode-content">
                  <p className="eventupload-mode-title">AI가 도와주기</p>
                  <p className="eventupload-mode-desc">AI가 행사 소개를 작성해드려요</p>
                </div>
              </div>
            </div>
          )}

          {(currentStepData.type === 'text' || currentStepData.type === 'number') && (
            <div className="eventupload-input-group">
              <input
                className="eventupload-input"
                type={currentStepData.type}
                placeholder={currentStepData.placeholder}
                value={formData[currentStepData.id]}
                onChange={(e) => handleInputChange(currentStepData.id, e.target.value)}
                autoFocus
              />
            </div>
          )}

          {currentStepData.type === 'address' && (
            <div className="eventupload-input-group">
              <div className="eventupload-address-container">
                <input
                  className="eventupload-input"
                  type="text"
                  placeholder={
                    kakaoReady
                      ? '주소를 검색하세요 (예: 강남역, 서울시청)'
                      : '카카오맵 준비 중... 잠시 후 검색 가능합니다'
                  }
                  value={addressSearchQuery}
                  onChange={(e) => setAddressSearchQuery(e.target.value)}
                  onFocus={() => setShowPostcode(true)}
                  disabled={!kakaoReady}
                  autoFocus
                />
                {formData.location && (
                  <div className="eventupload-selected-address">
                    <MapPin size={16} />
                    <span className="eventupload-address-text">{formData.location}</span>
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
                      className="eventupload-clear-address"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {!kakaoReady && (
                  <div className="eventupload-api-status">
                    <span className="eventupload-warning-text">
                      ⚠️ 카카오맵 SDK 로드 중입니다. 차단 프로그램(Adblock 등) 또는 도메인/키 설정을 확인하세요.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStepData.type === 'date' && (
            <div className="eventupload-input-group">
              <input
                className="eventupload-input"
                type="date"
                value={formData[currentStepData.id]}
                min={
                  currentStepData.id === 'endDate'
                    ? formData.startDate || new Date().toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0]
                }
                onChange={(e) => handleInputChange(currentStepData.id, e.target.value)}
                autoFocus
              />
            </div>
          )}

          {currentStepData.type === 'time' && (
            <div className="eventupload-input-group">
              <input
                className="eventupload-input"
                type="time"
                value={formData[currentStepData.id]}
                onChange={(e) => handleInputChange(currentStepData.id, e.target.value)}
                autoFocus
              />
            </div>
          )}

          {currentStepData.type === 'image' && (
            <div className="eventupload-image-upload">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="eventupload-file-input"
              />

              {!imagePreview ? (
                <div className="eventupload-upload-area" onClick={() => fileInputRef.current?.click()}>
                  <div className="eventupload-upload-icon">
                    <Upload size={48} />
                  </div>
                  <p className="eventupload-upload-text">클릭하여 이미지를 선택하세요</p>
                  <p className="eventupload-upload-desc">JPG, PNG 파일 (최대 10MB)</p>
                </div>
              ) : (
                <div className="eventupload-image-preview">
                  <img className="eventupload-preview-image" src={imagePreview} alt="선택된 이미지" />
                  <button className="eventupload-remove-image" onClick={removeImage}>
                    <X size={20} />
                  </button>
                  <button className="eventupload-change-image" onClick={() => fileInputRef.current?.click()}>
                    <span className="eventupload-change-text">이미지 변경</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedMode === 'direct' && currentStep === steps.length - 1 && (
            <div className="eventupload-input-group">
              <textarea
                className="eventupload-textarea"
                placeholder="행사에 대해 자세히 설명해주세요"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
              />
            </div>
          )}
        </div>

        <div className="eventupload-bottom">
          {currentStep !== 0 ? (
            <div className="eventupload-button-group">
              <button
                className="eventupload-back-button"
                onClick={handleBack}
              >
                이전
              </button>

              <button
                className={`eventupload-next-button ${canProceed() ? 'active' : ''}`}
                onClick={handleNext}
                disabled={!canProceed() || isSubmitting}
              >
                {isSubmitting
                  ? '처리 중...'
                  : selectedMode === 'ai' && currentStep === steps.length - 1
                  ? 'AI로 생성하기'
                  : currentStep === steps.length - 1
                  ? '행사 등록하기'
                  : '다음'}
              </button>
            </div>
          ) : (
            <button
              className={`eventupload-next-button ${canProceed() ? 'active' : ''}`}
              onClick={handleNext}
              disabled={!canProceed()}
            >
              {selectedMode === 'ai' && currentStep === steps.length - 1
                ? 'AI로 생성하기'
                : currentStep === steps.length - 1
                ? '행사 등록하기'
                : '다음'}
            </button>
          )}
        </div>
      </div>

      {showPostcode && (
        <div className="eventupload-postcode-overlay">
          <div className="eventupload-postcode-container">
            <div className="eventupload-postcode-header">
              <h3 className="eventupload-postcode-title">주소 검색</h3>
              <button className="eventupload-postcode-close" onClick={() => setShowPostcode(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="eventupload-address-search-content">
              <input
                type="text"
                placeholder={
                  kakaoReady ? '장소명이나 주소를 입력하세요' : '카카오맵 준비 중입니다. 잠시만 기다려주세요.'
                }
                value={addressSearchQuery}
                onChange={(e) => setAddressSearchQuery(e.target.value)}
                className="eventupload-address-search-input"
                disabled={!kakaoReady}
                autoFocus
              />

              {isSearching && <div className="eventupload-search-loading">검색 중...</div>}

              <div className="eventupload-address-results">
                {addressResults.map((result) => (
                  <div
                    key={result.id}
                    className="eventupload-address-result-item"
                    onClick={() => handleAddressSelect(result)}
                  >
                    <div className="eventupload-address-result-main">
                      <h4 className="eventupload-place-name">{result.placeName}</h4>
                      <p className="eventupload-address-result-address">
                        {result.roadAddressName || result.addressName}
                      </p>
                      {result.phone && <p className="eventupload-address-result-phone">{result.phone}</p>}
                    </div>
                    <div className="eventupload-address-result-category">{result.categoryName}</div>
                  </div>
                ))}

                {!isSearching && kakaoReady && addressSearchQuery && addressResults.length === 0 && (
                  <div className="eventupload-no-results">
                    <p className="eventupload-no-results-text">검색 결과가 없습니다.</p>
                    <p className="eventupload-no-results-desc">
                      직접 주소를 입력하려면 아래 버튼을 클릭하세요.
                    </p>
                    <button
                      className="eventupload-manual-address-btn"
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
                  <div className="eventupload-search-guide">
                    <p className="eventupload-guide-title">💡 검색 팁:</p>
                    <ul className="eventupload-guide-list">
                      <li className="eventupload-guide-item">• 장소명: "강남역", "홍대입구"</li>
                      <li className="eventupload-guide-item">• 건물명: "롯데월드타워", "63빌딩"</li>
                      <li className="eventupload-guide-item">• 주소: "서울시 강남구 테헤란로"</li>
                    </ul>
                  </div>
                )}

                {!kakaoReady && (
                  <div className="eventupload-search-guide">
                    <p className="eventupload-sdk-error">
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
  );

  return (
    <Layout pageTitle="행사 등록" activeMenuItem="event-upload" showLayout={true}>
      {content}
    </Layout>
  );
};

export default EventUpload;
