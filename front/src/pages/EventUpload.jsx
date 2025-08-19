import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock, MapPin, Users, DollarSign, FileText, ArrowLeft, Check, ChevronRight, Upload, X, Hash, Bold, Italic, List, Link2, Eye, Edit3 } from 'lucide-react';
import Layout from '../components/Layout';
import '../css/eventupload.css';

// 카카오맵 SDK 설정
const KAKAO_MAP_SCRIPT_ID = 'kakao-map-script';
const KAKAO_APP_KEY = '084b4a076cd976847f592a5fea5ea24d';

// 전역 로딩 플래그 (다중 마운트/StrictMode 대비)
let kakaoSdkLoadingPromise = null;

// 카카오 SDK 한 번만 로드하는 함수
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
          else reject(new Error('기존 스크립트 로드 후 kakao 정의되지 않음'));
        });
        existing.addEventListener('error', () => reject(new Error('카카오 SDK 스크립트 오류 (기존)')));
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
        reject(new Error('스크립트 로드 후 window.kakao가 정의되지 않음'));
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
      console.error('카카오맵 SDK 네트워크 오류, 도메인 및 JS 키 및 차단기 확인', e);
      reject(new Error('카카오맵 SDK 네트워크 오류'));
    };
    document.head.appendChild(script);
  });

  return kakaoSdkLoadingPromise;
}

// 마크다운 렌더링 함수 - 더 많은 마크다운 문법 지원
const renderMarkdown = (text) => {
  return text
    .replace(/^### (.*$)/gim, '<h3 class="markdown-h3">$1</h3>')     // ### 제목
    .replace(/^## (.*$)/gim, '<h2 class="markdown-h2">$1</h2>')      // ## 제목
    .replace(/^# (.*$)/gim, '<h1 class="markdown-h1">$1</h1>')       // # 제목
    .replace(/\*\*(.*?)\*\*/g, '<strong class="markdown-bold">$1</strong>')  // **굵게**
    .replace(/\*(.*?)\*/g, '<em class="markdown-italic">$1</em>')     // *기울임*
    .replace(/__(.*?)__/g, '<strong class="markdown-bold">$1</strong>')  // __굵게__
    .replace(/_(.*?)_/g, '<em class="markdown-italic">$1</em>')       // _기울임_
    .replace(/~~(.*?)~~/g, '<del class="markdown-strikethrough">$1</del>')  // ~~취소선~~
    .replace(/`([^`]+)`/g, '<code class="markdown-code">$1</code>')   // `인라인 코드`
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="markdown-link">$1</a>') // [링크](url)
    .replace(/^[\s]*[-*+][\s]+(.*$)/gim, '<li class="markdown-list-item">$1</li>') // - 또는 * 또는 + 리스트
    .replace(/^[\s]*\d+\.[\s]+(.*$)/gim, '<li class="markdown-ordered-item">$1</li>') // 1. 숫자 리스트
    .replace(/(<li class="markdown-list-item">.*?<\/li>)/gs, '<ul class="markdown-list">$1</ul>') // ul 리스트 감싸기
    .replace(/(<li class="markdown-ordered-item">.*?<\/li>)/gs, '<ol class="markdown-ordered-list">$1</ol>') // ol 리스트 감싸기
    .replace(/^> (.*$)/gim, '<blockquote class="markdown-blockquote">$1</blockquote>') // > 인용문
    .replace(/\n/g, '<br class="markdown-br">');                     // 줄바꿈
};

// 마크다운 에디터 컴포넌트
const MarkdownEditor = ({ value, onChange, placeholder }) => {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef(null);

  const insertMarkdown = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange(newText);
    
    // 커서 위치 조정
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + before.length + selectedText.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const toolbarButtons = [
    {
      icon: Bold,
      title: '굵게 (Ctrl+B)',
      action: () => insertMarkdown('**', '**'),
      shortcut: 'Ctrl+B'
    },
    {
      icon: Italic,
      title: '기울임 (Ctrl+I)', 
      action: () => insertMarkdown('*', '*'),
      shortcut: 'Ctrl+I'
    },
    {
      icon: List,
      title: '리스트',
      action: () => insertMarkdown('- '),
    },
    {
      icon: Link2,
      title: '링크',
      action: () => insertMarkdown('[링크 텍스트](', ')'),
    }
  ];

  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          insertMarkdown('**', '**');
          break;
        case 'i':
          e.preventDefault();
          insertMarkdown('*', '*');
          break;
      }
    }
  };

  return (
    <div className="eventupload-markdown-editor">
      <div className="eventupload-markdown-toolbar">
        <div className="eventupload-toolbar-group">
          {toolbarButtons.map((button, index) => (
            <button
              key={index}
              type="button"
              className="eventupload-toolbar-btn"
              onClick={button.action}
              title={button.title}
            >
              <button.icon size={16} />
            </button>
          ))}
        </div>
        <div className="eventupload-toolbar-group">
          <button
            type="button"
            className={`eventupload-toolbar-btn ${!isPreview ? 'active' : ''}`}
            onClick={() => setIsPreview(false)}
            title="편집 모드"
          >
            <Edit3 size={16} />
            편집
          </button>
          <button
            type="button"
            className={`eventupload-toolbar-btn ${isPreview ? 'active' : ''}`}
            onClick={() => setIsPreview(true)}
            title="미리보기 모드"
          >
            <Eye size={16} />
            미리보기
          </button>
        </div>
      </div>

      {isPreview ? (
        <div className="eventupload-markdown-preview">
          {value ? (
            <div 
              className="eventupload-preview-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
            />
          ) : (
            <div className="eventupload-preview-empty">
              미리보기할 내용이 없습니다.
            </div>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className="eventupload-markdown-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={8}
        />
      )}

      <div className="eventupload-markdown-help">
        <div className="eventupload-help-item">
          <strong>**굵게**</strong> • <em>*기울임*</em> • <span>- 리스트</span> • <span>[링크](주소)</span>
        </div>
      </div>
    </div>
  );
};

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
  // 기본 상태들
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
    fee: '',
    address: '',
    latitude: null,
    longitude: null,
    hashtags: [] // 해시태그 배열
  });
  const [hashtagInput, setHashtagInput] = useState(''); // 해시태그 입력 상태
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
  
  // QR 코드 관련 상태 추가
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  
  const accessToken = localStorage.getItem('accessToken');

  // 카카오 SDK 준비 상태
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
    { id: 'fee', title: '참가비가 있나요?', type: 'text', placeholder: '무료인 경우 0 입력' },
    { id: 'hashtags', title: '행사를 표현하는 해시태그를 추가해주세요', type: 'hashtags', placeholder: '예: 음악, 축제, 무료' },
    { id: 'description', title: '행사에 대해 자세히 설명해주세요', type: 'markdown', placeholder: '참가자들이 알아야 할 내용을 작성해주세요\n\n**마크다운 사용법:**\n- **굵게**: **텍스트**\n- *기울임*: *텍스트*\n- 리스트: - 항목\n- 링크: [텍스트](URL)' },
    { id: 'image', title: '행사 포스터 이미지를 선택해주세요', type: 'image' }
  ];

  // QR 코드 생성 함수
  const generateQRCode = async (eventId, accessToken) => {
    try {
      console.log('QR 코드 생성 시작, 이벤트 ID:', eventId);
      const response = await fetch(`https://gateway.gamja.cloud/api/event/qr/join?eventId=${eventId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`QR 생성 실패 (${response.status})`);
      }

      const result = await response.json();
      console.log('QR 생성 결과:', result);
      return result;
    } catch (error) {
      console.error('QR 코드 생성 오류:', error);
      throw error;
    }
  };

  // QR 코드 이미지 조회 함수
  const getQRCodeImage = async (qrId, accessToken) => {
    try {
      console.log('QR 이미지 조회 시작, QR ID:', qrId);
      const response = await fetch(`https://gateway.gamja.cloud/api/image/${qrId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`QR 이미지 조회 실패 (${response.status})`);
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      console.log('QR 이미지 URL 생성 완료');
      return imageUrl;
    } catch (error) {
      console.error('QR 이미지 조회 오류:', error);
      throw error;
    }
  };

  // QR 코드 생성 및 표시 함수
  const generateAndShowQR = async (eventId) => {
    setQrLoading(true);
    try {
      console.log('이벤트 ID로 QR 생성:', eventId);
      
      // QR 코드 생성
      const qrResult = await generateQRCode(eventId, accessToken);
      console.log('QR 생성 결과:', qrResult);
      
      // 응답에서 QR ID 추출 (API 응답 구조에 따라 조정 필요)
      const qrId = qrResult.id || qrResult.qrId || qrResult;
      console.log('사용할 QR ID:', qrId);
      
      // QR 이미지 조회
      const qrImageUrl = await getQRCodeImage(qrId, accessToken);
      
      setQrCodeUrl(qrImageUrl);
      setShowQRModal(true);
    } catch (error) {
      console.error('QR 코드 생성/조회 실패:', error);
      alert(`QR 코드 생성에 실패했습니다: ${error.message}`);
    } finally {
      setQrLoading(false);
    }
  };

  // QR 코드 모달 컴포넌트
  const QRCodeModal = () => {
    if (!showQRModal) return null;

    const downloadQR = () => {
      if (qrCodeUrl) {
        const link = document.createElement('a');
        link.href = qrCodeUrl;
        link.download = `event-qr-code-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };

    const shareQR = async () => {
      if (navigator.share && qrCodeUrl) {
        try {
          const response = await fetch(qrCodeUrl);
          const blob = await response.blob();
          const file = new File([blob], 'event-qr-code.png', { type: 'image/png' });
          
          await navigator.share({
            title: '행사 QR 코드',
            text: '행사 참여를 위한 QR 코드입니다.',
            files: [file]
          });
        } catch (error) {
          console.error('공유 실패:', error);
          downloadQR();
        }
      } else {
        downloadQR();
      }
    };

    const closeModal = () => {
      setShowQRModal(false);
      if (qrCodeUrl) {
        URL.revokeObjectURL(qrCodeUrl);
        setQrCodeUrl(null);
      }
      resetAll();
    };

    return (
      <div className="eventupload-qr-modal-overlay">
        <div className="eventupload-qr-modal">
          <div className="eventupload-qr-header">
            <h2 className="eventupload-qr-title">행사가 성공적으로 등록되었습니다!</h2>
            <button className="eventupload-qr-close" onClick={closeModal}>
              <X size={24} />
            </button>
          </div>
          
          <div className="eventupload-qr-content">
            <div className="eventupload-qr-info">
              <p className="eventupload-qr-description">
                참가자들이 이 QR 코드를 스캔하여 행사에 참여할 수 있습니다.
              </p>
            </div>
            
            {qrLoading ? (
              <div className="eventupload-qr-loading">
                <div className="eventupload-loading-spinner"></div>
                <p>QR 코드 생성 중...</p>
              </div>
            ) : qrCodeUrl ? (
              <div className="eventupload-qr-image-container">
                <img 
                  src={qrCodeUrl} 
                  alt="행사 참여 QR 코드" 
                  className="eventupload-qr-image"
                />
              </div>
            ) : (
              <div className="eventupload-qr-error">
                <p>QR 코드를 불러오는데 실패했습니다.</p>
              </div>
            )}
            
            <div className="eventupload-qr-actions">
              <button 
                className="eventupload-qr-button eventupload-qr-download"
                onClick={downloadQR}
                disabled={!qrCodeUrl}
              >
                다운로드
              </button>
              <button 
                className="eventupload-qr-button eventupload-qr-share"
                onClick={shareQR}
                disabled={!qrCodeUrl}
              >
                공유하기
              </button>
              <button 
                className="eventupload-qr-button eventupload-qr-done"
                onClick={closeModal}
              >
                완료
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 해시태그 추가 함수
  const addHashtag = useCallback((tag) => {
    const cleanTag = tag.replace(/^#/, '').trim();
    if (cleanTag && !formData.hashtags.includes(cleanTag) && formData.hashtags.length < 10) {
      setFormData(prev => ({
        ...prev,
        hashtags: [...prev.hashtags, cleanTag]
      }));
    }
  }, [formData.hashtags]);

  // 해시태그 제거 함수
  const removeHashtag = useCallback((tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      hashtags: prev.hashtags.filter(tag => tag !== tagToRemove)
    }));
  }, []);

  // 해시태그 입력 처리
  const handleHashtagInput = useCallback((value) => {
    setHashtagInput(value);
  }, []);

  // IME 조합 상태 추적
  const [isComposing, setIsComposing] = useState(false);

  // 한글 조합 시작
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  // 한글 조합 끝
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  // 키 입력 처리 - IME 조합 상태 고려
  const handleHashtagKeyDown = useCallback((e) => {
    // IME 조합 중이면 Enter 키 무시
    if (isComposing) return;
    
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      e.stopPropagation();
      
      const value = e.target.value.trim();
      if (value) {
        addHashtag(value);
        setHashtagInput(''); // 여기서만 입력 필드 초기화
      }
    } else if (e.key === 'Backspace' && !e.target.value && formData.hashtags.length > 0) {
      removeHashtag(formData.hashtags[formData.hashtags.length - 1]);
    }
  }, [addHashtag, removeHashtag, formData.hashtags, isComposing]);

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

  // 카카오 SDK 로드(안정화)
  useEffect(() => {
    if (effectGuardRef.current) return;
    effectGuardRef.current = true;

    let mounted = true;
    loadKakaoSdkOnce()
      .then(() => {
        if (!mounted) return;
        setKakaoReady(true);
        console.log('카카오맵 SDK 준비 완료');
      })
      .catch((err) => {
        console.error('카카오 SDK 로드 실패:', err);
        setKakaoReady(false);
      });

    // 언마운트 시 스크립트를 제거하지 않습니다(재사용)
    return () => {
      mounted = false;
    };
  }, []);

  // 주소 검색 함수 (카카오 Places 우선)
  const searchAddress = async (query) => {
    if (!query.trim() || query.length < 2) {
      setAddressResults([]);
      return;
    }
    if (!kakaoReady) {
      console.warn('카카오 SDK가 아직 준비되지 않음. 검색 방지.');
      return;
    }
    setIsSearching(true);

    try {
      const { kakao } = window;
      if (!kakao?.maps?.services) {
        console.warn('kakao.maps.services를 사용할 수 없음.');
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

  // 멀티파트 폼 데이터로 API 호출하는 함수 (LocalDateTime 형식)
  const submitEventToAPI = async (eventData, imageFile) => {
    setIsSubmitting(true);
    try {
      // 토큰과 사용자 ID 확인
      const userId = localStorage.getItem('userId');
      
      if (!accessToken || !userId) {
        throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
      }

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
      
      console.log('변환된 날짜시간:', { startDateTime, endDateTime });
      
      // 이벤트 데이터 JSON 객체 생성 (로그인된 사용자 ID 사용)
      const eventJson = {
        name: eventData.eventName,
        startTime: startDateTime,
        endTime: endDateTime,
        organizerId: parseInt(userId), // 로컬스토리지의 userId 사용
        latitude: parseFloat(eventData.latitude) || 37.5665,
        longitude: parseFloat(eventData.longitude) || 126.978,
        entryFee: parseInt(eventData.fee) || 0,
        address: eventData.address || eventData.location,
        description: eventData.description || '',
        hashtags: eventData.hashtags || [] // 해시태그 배열
      };
      
      console.log('이벤트 JSON:', eventJson);
      
      // FormData에 이벤트 정보를 JSON 문자열로 추가 (Content-Type 명시)
      formData.append('event', new Blob([JSON.stringify(eventJson)], {
        type: 'application/json'
      }));
      
      // 이미지 파일이 있는 경우에만 추가
      if (imageFile) {
        console.log('이미지 파일 추가:', imageFile.name, '크기:', imageFile.size);
        formData.append('image', imageFile);
      } else {
        console.log('선택된 이미지 파일 없음 - 빈 파일 추가');
        // 빈 이미지 파일 추가 (서버에서 요구하는 경우)
        formData.append('image', new Blob([], { type: 'application/octet-stream' }));
      }
      
      // FormData 내용 확인 (디버깅용)
      console.log('FormData 내용:');
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`${key}: 파일(${value.name}, ${value.size} 바이트, ${value.type})`);
        } else if (value instanceof Blob) {
          console.log(`${key}: Blob(${value.size} 바이트, ${value.type})`);
        } else {
          console.log(`${key}:`, value);
        }
      }
      
      // Bearer 토큰과 함께 멀티파트 폼 데이터로 POST 요청
      const response = await fetch('https://gateway.gamja.cloud/api/event', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`, // Bearer 토큰 추가
        },
        body: formData,
      });
      
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        } catch {
          errorMessage = await response.text() || `HTTP ${response.status}`;
        }
        
        // 401 Unauthorized 처리
        if (response.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userId');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('tokenExpiration');
          throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
        }
        
        throw new Error(`서버 오류 (${response.status}): ${errorMessage}`);
      }
      
      const result = await response.json();
      console.log('API 응답:', result);
      
      // 이벤트 생성 성공 후 QR 코드 생성
      if (result.id || result.eventId) {
        const eventId = result.id || result.eventId;
        await generateAndShowQR(eventId);
      } else {
        // eventId가 없는 경우의 처리
        console.warn('응답에서 이벤트 ID를 찾을 수 없음:', result);
        alert('행사가 등록되었지만 QR 코드 생성에 실패했습니다.');
      }
      
      return result;
    } catch (error) {
      console.error('API 호출 실패:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (selectedMode === 'ai' && currentStep === steps.length - 1) {
      handleAiGenerate();
    } else if (currentStep < steps.length - 1) {
      // AI 모드에서는 해시태그 단계만 건너뛰기 (설명은 포함)
      if (selectedMode === 'ai') {
        const currentStepData = steps[currentStep];
        if (currentStepData.id === 'fee') {
          // 참가비 다음에는 행사 설명으로
          setShowStep(false);
          setTimeout(() => {
            setCurrentStep(steps.findIndex(step => step.id === 'description'));
            window.history.pushState(null, '');
          }, 200);
          return;
        }
        if (currentStepData.id === 'description') {
          // 행사 설명 다음에는 바로 이미지 업로드로
          setShowStep(false);
          setTimeout(() => {
            setCurrentStep(steps.findIndex(step => step.id === 'image'));
            window.history.pushState(null, '');
          }, 200);
          return;
        }
      }
      
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
      // AI 모드에서 뒤로가기 처리
      if (selectedMode === 'ai') {
        const currentStepData = steps[currentStep];
        if (currentStepData.id === 'image') {
          // 이미지 단계에서 뒤로가기시 설명 단계로
          setShowStep(false);
          setTimeout(() => {
            setCurrentStep(steps.findIndex(step => step.id === 'description'));
            window.history.pushState(null, '');
          }, 200);
          return;
        }
        if (currentStepData.id === 'description') {
          // 설명 단계에서 뒤로가기시 참가비 단계로
          setShowStep(false);
          setTimeout(() => {
            setCurrentStep(steps.findIndex(step => step.id === 'fee'));
            window.history.pushState(null, '');
          }, 200);
          return;
        }
      }
      
      setShowStep(false);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        window.history.pushState(null, '');
      }, 200);
    }
  };

  const handleModeSelect = (mode) => setSelectedMode(mode);

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
      // 성공 메시지는 QR 모달에서 표시되므로 제거
    } catch (error) {
      alert(`행사 등록에 실패했습니다: ${error.message}`);
    }
  };

  const handleAiGenerate = async () => {
    try {
      setIsSubmitting(true);
      
      // API 요청 데이터 준비
      const aiRequestData = {
        name: formData.eventName,
        description: formData.description || "", // 기존 설명이 있다면 포함
        startTime: `${formData.startDate}T${formData.startTime}:00`,
        endTime: `${formData.endDate}T${formData.endTime}:00`,
        address: formData.location,
        entryFee: parseInt(formData.fee) || 0
      };
      
      console.log('AI 생성 요청 데이터:', aiRequestData);
      
      // AI 서버에 요청
      const response = await fetch('https://gateway.gamja.cloud/api/event/ai/description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
           'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(aiRequestData)
      });
      
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        } catch {
          errorMessage = await response.text() || `HTTP ${response.status}`;
        }
        throw new Error(`AI 생성 실패 (${response.status}): ${errorMessage}`);
      }
      
      const aiResult = await response.json();
      console.log('AI 응답:', aiResult);
      
      // AI 결과 처리
      if (aiResult.description) {
        setAiGeneratedContent(aiResult.description);
      }
      
      // AI에서 받은 해시태그로 완전히 교체
      if (aiResult.hashtags && Array.isArray(aiResult.hashtags)) {
        const aiHashtags = aiResult.hashtags
          .map(tag => tag.replace(/^#/, '').trim())
          .filter(tag => tag.length > 0)
          .slice(0, 10); // 최대 10개 해시태그로 제한
        
        setFormData(prev => ({
          ...prev,
          hashtags: aiHashtags
        }));
      }
      
      setCurrentStep('ai-result');
    } catch (error) {
      console.error('AI 생성 오류:', error);
      alert(`AI 콘텐츠 생성에 실패했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
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
      // 성공 메시지는 QR 모달에서 표시되므로 제거
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
      fee: '',
      address: '',
      latitude: null,
      longitude: null,
      hashtags: []
    });
    setHashtagInput('');
    setAiGeneratedContent('');
    setIsEditing(false);
    setShowStep(true);
    setSelectedImage(null);
    setImagePreview(null);
    setShowPostcode(false);
    setAddressSearchQuery('');
    setAddressResults([]);
    // QR 관련 상태 초기화
    setQrCodeUrl(null);
    setShowQRModal(false);
    setQrLoading(false);
    window.history.pushState(null, '');
    isRegistered.current = false;
  };

  const canProceed = () => {
    const step = steps[currentStep];
    if (!step) return false;
    
    // AI 모드에서는 해시태그 단계만 건너뛰기 (설명은 필수)
    if (selectedMode === 'ai' && step.id === 'hashtags') {
      return true;
    }
    
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
      case 'fee':
        return formData.fee !== '';
      case 'hashtags':
        return selectedMode === 'ai' ? true : formData.hashtags.length > 0; // AI 모드에서는 항상 통과
      case 'description':
        return formData.description.trim() !== ''; // AI 모드에서도 설명 필수
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
                    <MarkdownEditor
                      value={aiGeneratedContent}
                      onChange={setAiGeneratedContent}
                      placeholder="AI가 생성한 내용을 수정해보세요..."
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
                    <div 
                      className="eventupload-ai-text"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(aiGeneratedContent) }}
                    />
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
                    <span className="eventupload-summary-label">참가비</span>
                    <span className="eventupload-summary-value">
                      {formData.fee === '0' ? '무료' : `${formData.fee}원`}
                    </span>
                  </div>
                  {formData.hashtags.length > 0 && (
                    <div className="eventupload-summary-item">
                      <span className="eventupload-summary-label">해시태그</span>
                      <div className="eventupload-hashtag-display">
                        {formData.hashtags.map((tag, index) => (
                          <span key={index} className="eventupload-hashtag-chip">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {formData.description && (
                    <div className="eventupload-summary-item">
                      <span className="eventupload-summary-label">행사 설명</span>
                      <span className="eventupload-summary-value eventupload-summary-description">
                        {formData.description.length > 100 
                          ? formData.description.slice(0, 100) + '...' 
                          : formData.description
                        }
                      </span>
                    </div>
                  )}
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
        <QRCodeModal />
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

          {currentStepData.type === 'textarea' && (
            <div className="eventupload-input-group">
              <textarea
                className="eventupload-textarea"
                placeholder={currentStepData.placeholder}
                value={formData[currentStepData.id]}
                onChange={(e) => handleInputChange(currentStepData.id, e.target.value)}
                rows={6}
                autoFocus
              />
            </div>
          )}

          {currentStepData.type === 'markdown' && (
            <div className="eventupload-input-group">
              <MarkdownEditor
                value={formData[currentStepData.id]}
                onChange={(value) => handleInputChange(currentStepData.id, value)}
                placeholder={currentStepData.placeholder}
              />
            </div>
          )}

          {currentStepData.type === 'hashtags' && (
            <div className="eventupload-input-group">
              <div className="eventupload-hashtag-container">
                <div className="eventupload-hashtag-input-wrapper">
                  <div className="eventupload-hashtag-list">
                    {formData.hashtags.map((tag, index) => (
                      <div key={index} className="eventupload-hashtag-tag">
                        <Hash size={12} />
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeHashtag(tag)}
                          className="eventupload-hashtag-remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <input
                      className="eventupload-hashtag-input"
                      type="text"
                      placeholder={formData.hashtags.length === 0 ? currentStepData.placeholder : "더 추가하려면 입력하세요"}
                      value={hashtagInput}
                      onChange={(e) => handleHashtagInput(e.target.value)}
                      onKeyDown={handleHashtagKeyDown}
                      onCompositionStart={handleCompositionStart}
                      onCompositionEnd={handleCompositionEnd}
                      disabled={formData.hashtags.length >= 10}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="eventupload-hashtag-info">
                  <p className="eventupload-hashtag-tip">
                    💡 엔터나 쉼표로 구분하여 입력하세요 (최대10개)
                  </p>
                  <p className="eventupload-hashtag-count">
                    {formData.hashtags.length}/10
                  </p>
                </div>
                {formData.hashtags.length > 0 && (
                  <div className="eventupload-hashtag-preview">
                    <p className="eventupload-hashtag-preview-title">미리보기:</p>
                    <div className="eventupload-hashtag-preview-list">
                      {formData.hashtags.map((tag, index) => (
                        <span key={index} className="eventupload-hashtag-preview-item">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
      <QRCodeModal />
      {content}
    </Layout>
  );
};

export default EventUpload;