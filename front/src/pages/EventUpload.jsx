import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, Users, DollarSign, FileText, ArrowLeft, Check, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import '../css/eventupload.css';

const EventUpload = () => {
  const [selectedMode, setSelectedMode] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    eventName: '',
    date: '',
    time: '',
    location: '',
    description: '',
    participantLimit: '',
    fee: ''
  });
  const [aiGeneratedContent, setAiGeneratedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showStep, setShowStep] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isRegistered = useRef(false); // 등록 완료 여부

  const steps = [
    { id: 'mode', title: '어떻게 행사를 만드실건가요?', type: 'mode' },
    { id: 'eventName', title: '행사 이름을 알려주세요', type: 'text', placeholder: '예: 동네 플리마켓' },
    { id: 'date', title: '언제 진행하시나요?', type: 'date' },
    { id: 'time', title: '몇 시에 시작하나요?', type: 'time' },
    { id: 'location', title: '어디서 진행하시나요?', type: 'text', placeholder: '예: 홍익대학교 앞 공원' },
    { id: 'participantLimit', title: '몇 명까지 참여할 수 있나요?', type: 'number', placeholder: '예: 50' },
    { id: 'fee', title: '참가비가 있나요?', type: 'text', placeholder: '무료인 경우 0 입력' }
  ];

  // 모바일 체크
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 스텝 보여주기 토글
  useEffect(() => {
    setShowStep(true);
  }, [currentStep]);

  // 뒤로가기 이벤트 (스텝 단위로 동작하게)
  useEffect(() => {
    const onPopState = (e) => {
      if (isRegistered.current) {
        // 등록 완료 후에는 브라우저 기본 동작 허용
        return;
      }

      e.preventDefault();
      if (currentStep > 0) {
        setShowStep(false);
        setTimeout(() => {
          setCurrentStep((prev) => Math.max(prev - 1, 0));
        }, 200);
        // 히스토리 상태 조작
        window.history.pushState(null, '');
      }
    };

    // 처음 로드 시 히스토리 스택에 상태 추가 (브라우저 뒤로가기 방지)
    if (!isRegistered.current) {
      window.history.pushState(null, '');
    }

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [currentStep]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (selectedMode === 'ai' && currentStep === steps.length - 1) {
      handleAiGenerate();
    } else if (currentStep < steps.length - 1) {
      setShowStep(false);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        // 히스토리 스택 추가 (뒤로가기 가능하도록)
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
        // 히스토리 스택 추가 (뒤로가기 가능하도록)
        window.history.pushState(null, '');
      }, 200);
    }
  };

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
  };

  const handleDirectSubmit = () => {
    console.log('직접 입력 완료:', formData);
    alert('행사가 등록되었습니다!');
    resetAll();
  };

  const handleAiGenerate = () => {
    const aiDescription = `${formData.eventName}는 ${formData.location}에서 진행되는 특별한 행사입니다. 
참가자들에게 새로운 경험과 네트워킹 기회를 제공하며, 
전문적이고 체계적인 프로그램으로 구성되어 있습니다. 
많은 분들의 참여를 기다립니다.`;

    setAiGeneratedContent(aiDescription);
    setCurrentStep('ai-result');
  };

  const handleAiConfirm = () => {
    setFormData(prev => ({
      ...prev,
      description: aiGeneratedContent
    }));
    console.log('AI 생성 완료:', { ...formData, description: aiGeneratedContent });
    alert('행사가 등록되었습니다!');
    resetAll();
  };

  const resetAll = () => {
    // 등록 완료 상태 표시
    isRegistered.current = true;

    // 모든 상태 초기화
    setSelectedMode(null);
    setCurrentStep(0);
    setFormData({
      eventName: '',
      date: '',
      time: '',
      location: '',
      description: '',
      participantLimit: '',
      fee: ''
    });
    setAiGeneratedContent('');
    setIsEditing(false);
    setShowStep(true);

    // 히스토리 스택도 초기화 (뒤로가기 기본 동작 복구 위해)
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
      case 'date':
        return formData.date !== '';
      case 'time':
        return formData.time !== '';
      case 'location':
        return formData.location.trim() !== '';
      case 'participantLimit':
        return formData.participantLimit !== '';
      case 'fee':
        return formData.fee !== '';
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
                  <span className="eventupload-summary-label">일시</span>
                  <span className="eventupload-summary-value">{formData.date} {formData.time}</span>
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
                  <span className="eventupload-summary-value">{formData.fee === '0' ? '무료' : `${formData.fee}원`}</span>
                </div>
              </div>
            </div>

            <button onClick={handleAiConfirm} className="eventupload-submit-button">
              행사 등록하기
            </button>
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
                <div>
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
                <div>
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

          {currentStepData.type === 'date' && (
            <div className="eventupload-input-group">
              <input
                className="eventupload-input"
                type="text"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                placeholder="YYYY-MM-DD"
                autoFocus
              />
            </div>
          )}

          {currentStepData.type === 'time' && (
            <div className="eventupload-input-group">
              <input
                className="eventupload-input"
                type="text"
                placeholder="HH:MM"
                value={formData.time}
                onChange={(e) => handleInputChange('time', e.target.value)}
                autoFocus
              />
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

        <div className="eventupload-bottom" style={{ display: 'flex', gap: '12px' }}>
  {currentStep !== 0 ? (
    <>
      <button
        className="eventupload-next-button"
        onClick={handleBack}
        style={{
            flex: 1,
            border: '1px solid #5E936C',
            color: '#5E936C',
            cursor: 'pointer',
            backgroundColor: 'transparent',
        }}

      >
        이전
      </button>

      <button
        className={`eventupload-next-button ${canProceed() ? 'active' : ''}`}
        onClick={handleNext}
        disabled={!canProceed()}
        style={{ flex: 1 }}
      >
        {selectedMode === 'ai' && currentStep === steps.length - 1
          ? 'AI로 생성하기'
          : currentStep === steps.length - 1
            ? '행사 등록하기'
            : '다음'}
      </button>
    </>
  ) : (
    <button
      className={`eventupload-next-button ${canProceed() ? 'active' : ''}`}
      onClick={handleNext}
      disabled={!canProceed()}
      style={{ width: '100%' }}  // 가로 100% 꽉 채우기
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
    </div>
  );


  return (
    <Layout pageTitle="행사 등록" activeMenuItem="event-upload" showLayout={true}>
      {content}
    </Layout>
  );
};

export default EventUpload;
