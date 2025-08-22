import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock, MapPin, Users, DollarSign, FileText, Upload, X, Hash, Save, ArrowLeft, Eye, Edit3, Bold, Italic, List, Link, Code, Quote, Image } from 'lucide-react';
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

// 마크다운 에디터 컴포넌트
const MarkdownEditor = ({ value, onChange, placeholder }) => {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef(null);

  // 마크다운을 HTML로 변환하는 간단한 함수
  const markdownToHtml = (markdown) => {
    let html = markdown
      // 헤더
      .replace(/^### (.*)$/gim, '<h3 class="md-heading md-heading-3">$1</h3>')
      .replace(/^## (.*)$/gim, '<h2 class="md-heading md-heading-2">$1</h2>')
      .replace(/^# (.*)$/gim, '<h1 class="md-heading md-heading-1">$1</h1>')
      // 굵은 글씨
      .replace(/\*\*(.*)\*\*/gim, '<strong class="md-bold">$1</strong>')
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
      .replace(/^> (.*)$/gim, '<blockquote class="md-blockquote">$1</blockquote>')
      // 순서없는 리스트
      .replace(/^\* (.*)$/gim, '<li class="md-list-item">$1</li>')
      .replace(/^- (.*)$/gim, '<li class="md-list-item">$1</li>')
      // 순서있는 리스트
      .replace(/^\d+\. (.*)$/gim, '<li class="md-list-item md-list-item-ordered">$1</li>');

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

  // 텍스트 삽입 함수
  const insertText = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);

    const newText = beforeText + before + selectedText + after + afterText;
    onChange(newText);

    // 커서 위치 조정
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // 툴바 버튼들 (모바일용으로 순서 조정)
  const toolbarButtons = [
    { icon: Bold, action: () => insertText('**', '**'), title: '굵게', key: 'bold' },
    { icon: Italic, action: () => insertText('*', '*'), title: '기울임', key: 'italic' },
    { icon: Code, action: () => insertText('`', '`'), title: '코드', key: 'code' },
    { icon: Quote, action: () => insertText('> '), title: '인용구', key: 'quote' },
    { icon: List, action: () => insertText('- '), title: '리스트', key: 'list' },
    { icon: Link, action: () => insertText('[링크](', ')'), title: '링크', key: 'link' },
    { icon: Image, action: () => insertText('![이미지](', ')'), title: '이미지', key: 'image' },
  ];

  // 키보드 단축키 처리
  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          insertText('**', '**');
          break;
        case 'i':
          e.preventDefault();
          insertText('*', '*');
          break;
        case 'k':
          e.preventDefault();
          insertText('[', '](url)');
          break;
      }
    }
  };

  return (
    <div className="markdown-editor">
      {/* 툴바 */}
      <div className="markdown-toolbar">
        {/* 편집/미리보기 토글 (모바일에서 상단에 표시) */}
        <div className="toolbar-section">
          <button
            type="button"
            className={`toolbar-button ${!isPreview ? 'active' : ''}`}
            onClick={() => setIsPreview(false)}
            title="편집 모드"
          >
            <Edit3 size={16} />
            <span>편집</span>
          </button>
          <button
            type="button"
            className={`toolbar-button ${isPreview ? 'active' : ''}`}
            onClick={() => setIsPreview(true)}
            title="미리보기 모드"
          >
            <Eye size={16} />
            <span>미리보기</span>
          </button>
        </div>
        
        {/* 포맷팅 버튼들 */}
        <div className="toolbar-section">
          {toolbarButtons.map((button) => (
            <button
              key={button.key}
              type="button"
              className="toolbar-button"
              onClick={button.action}
              title={button.title}
              disabled={isPreview}
            >
              <button.icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* 에디터 영역 */}
      <div className="markdown-content">
        {!isPreview ? (
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={12}
          />
        ) : (
          <div className="markdown-preview">
            {value ? (
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: markdownToHtml(value) 
                }} 
              />
            ) : (
              <p className="preview-placeholder">미리볼 내용이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* 도움말 (간소화) */}
      <div className="markdown-help">
        <details className="help-details">
          <summary className="help-summary">마크다운 사용법</summary>
          <div className="help-content">
            <div className="help-grid">
              <div className="help-item">
                <code># 제목</code>
                <span>큰 제목</span>
              </div>
              <div className="help-item">
                <code>**굵게**</code>
                <span><strong>굵은글씨</strong></span>
              </div>
              <div className="help-item">
                <code>*기울임*</code>
                <span><em>기울임</em></span>
              </div>
              <div className="help-item">
                <code>`코드`</code>
                <span><code>코드</code></span>
              </div>
              <div className="help-item">
                <code>- 리스트</code>
                <span>• 리스트</span>
              </div>
              <div className="help-item">
                <code>[링크](URL)</code>
                <span>링크</span>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

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
  const userId = localStorage.getItem('userId');
  const accessToken = localStorage.getItem('accessToken');
  
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
  const [imageDeleted, setImageDeleted] = useState(false); // 이미지 삭제 상태 추가

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
    if (cleanTag && !formData.hashtags.includes(cleanTag) && formData.hashtags.length < 10) {
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
    setImageDeleted(false); // 새 이미지 선택시 삭제 상태 해제
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result);
    reader.readAsDataURL(file);
  };

  // 이미지 삭제 함수 (UI에서만 제거)
  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setImageDeleted(true); // 이미지 삭제 상태로 설정
    setOriginalImageUrl(null); // 기존 이미지 URL도 제거
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

  // 멀티파트 폼 데이터로 API 호출하는 함수
  const submitEventToAPI = async (eventData, imageFile) => {
    setIsSubmitting(true);
    try {
      // 토큰과 사용자 ID 확인
      if (!accessToken || !userId) {
        throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
      }

      // 토큰 만료 확인
      const tokenExpiration = localStorage.getItem('tokenExpiration');
      if (tokenExpiration && new Date() > new Date(tokenExpiration)) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('tokenExpiration');
        throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
      }

      console.log('사용할 토큰:', accessToken.substring(0, 20) + '...');
      console.log('사용자 ID:', userId);

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
      
      // 이미지 상태 분석
      const hasNewImage = selectedImage !== null;
      const wasImageDeleted = imageDeleted === true;
      const hasPosterChange = hasNewImage || wasImageDeleted;
      
      console.log('이미지 상태 분석:', {
        hasNewImage: hasNewImage,
        wasImageDeleted: wasImageDeleted,
        hasPosterChange: hasPosterChange
      });
      
      // poster 플래그 결정 (API 문서에 따라)
      let posterFlag;
      if (wasImageDeleted) {
        posterFlag = false; // 삭제 시: false
        console.log('이미지 삭제됨 -> poster: false');
      } else if (hasNewImage) {
        posterFlag = true; // 변경 시: true
        console.log('이미지 변경됨 -> poster: true');
      } else {
        posterFlag = true; // 유지 시: true (기본값)
        console.log('이미지 유지됨 -> poster: true');
      }
      
      // 이벤트 데이터 JSON 객체 생성
      const eventJson = {
        hashtags: eventData.hashtags || [],
        endTime: endDateTime,
        name: eventData.eventName,
        latitude: parseFloat(eventData.latitude) || 37.5665,
        longitude: parseFloat(eventData.longitude) || 126.978,
        startTime: startDateTime,
        entryFee: parseInt(eventData.fee) || 0,
        address: eventData.address || eventData.location,
        id: parseInt(eventId),
        description: eventData.description || '',
        poster: posterFlag // 포스터 유무 플래그
      };
      
      console.log('최종 이벤트 JSON:', eventJson);
      console.log('poster 플래그 최종값:', eventJson.poster);
      
      // JSON 데이터를 Blob으로 만들어 Content-Type 명시적으로 설정
      const eventBlob = new Blob([JSON.stringify(eventJson)], {
        type: 'application/json'
      });
      
      // FormData에 이벤트 정보를 Blob으로 추가
      formData.append('event', eventBlob);
      
      // 이미지 처리 로직
      if (hasNewImage) {
        // 새 이미지가 있는 경우
        console.log('새 이미지 파일 추가:', selectedImage.name, '크기:', selectedImage.size);
        formData.append('image', selectedImage);
      } else if (wasImageDeleted) {
        // 이미지가 삭제된 경우 - 빈 값 전송 (Send empty value)
        console.log('이미지 삭제됨 - 빈 image 필드 전송');
        formData.append('image', new Blob(), ''); // 빈 파일로 전송
      }
      // 이미지 변경이 없는 경우: image 필드를 추가하지 않음
      
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
      
      // Bearer 토큰과 함께 멀티파트 폼 데이터로 PATCH 요청
      const apiUrl = process.env.REACT_APP_API_URL || 'https://gateway.gamja.cloud';
      const response = await fetch(`${apiUrl}/api/event`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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

      if (!userId || isNaN(parseInt(userId))) {
        throw new Error('유효하지 않은 사용자 ID입니다. 다시 로그인해주세요.');
      }

      if (!eventId || isNaN(parseInt(eventId))) {
        throw new Error('유효하지 않은 이벤트 ID입니다.');
      }

      // API 호출
      await submitEventToAPI({
        ...formData,
        posterId: eventData.posterId
      }, selectedImage);
      
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
                      disabled={formData.hashtags.length >= 10}
                    />
                  </div>
                </div>
                <div className="event-edit-hashtag-info">
                  <p className="event-edit-hashtag-tip">
                    엔터나 쉼표로 구분하여 입력하세요 (최대 10개)
                  </p>
                  <p className="event-edit-hashtag-count">
                    {formData.hashtags.length}/10
                  </p>
                </div>
              </div>
            </div>

            <div className="event-edit-field-group">
              <label className="event-edit-label">행사 설명</label>
              <MarkdownEditor
                value={formData.description}
                onChange={(value) => handleInputChange('description', value)}
                placeholder="참가자들이 알아야 할 내용을 마크다운으로 작성해주세요.&#10;&#10;예시:&#10;# 행사 소개&#10;이번 행사는 **지역 주민들**이 함께하는 플리마켓입니다.&#10;&#10;## 참가 방법&#10;- 참가비: 무료&#10;- 준비물: 개인 텀블러&#10;- 문의: [연락처](tel:010-1234-5678)&#10;&#10;> 우천시에는 행사가 취소될 수 있습니다."
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