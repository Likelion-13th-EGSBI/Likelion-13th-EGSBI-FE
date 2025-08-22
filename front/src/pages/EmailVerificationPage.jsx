import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/emailverification.css";
import logo from '../imgs/mainlogo.png';

const EmailVerificationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 이전 페이지에서 전달된 이메일 주소
  const emailFromState = location.state?.email || "";
  const fromSignup = location.state?.fromSignup || false;

  const [email, setEmail] = useState(emailFromState);
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeTimer, setCodeTimer] = useState(0);
  const [isVerified, setIsVerified] = useState(false);

  // 유효성 검사 함수
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 인증 코드 전송
  const sendVerificationCode = async () => {
    if (!validateEmail(email)) {
      alert('올바른 이메일 주소를 입력해주세요.');
      return;
    }

    setIsSendingCode(true);

    try {
      const response = await fetch(`https://gateway.gamja.cloud/api/user/email/send/code?email=${encodeURIComponent(email.trim())}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // response의 content-type을 확인하여 적절한 파싱 방법 선택
      const contentType = response.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('application/json')) {
        try {
          result = await response.json();
        } catch (jsonError) {
          result = await response.text();
        }
      } else {
        result = await response.text();
      }

      if (!response.ok) {
        let errorMessage;
        if (typeof result === 'object' && result !== null) {
          errorMessage = result.message || result.error || `HTTP ${response.status}`;
        } else {
          errorMessage = result || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      console.log('인증 코드 전송 성공:', result);
      
      setIsCodeSent(true);
      setCodeTimer(180); // 3분 타이머 시작
      alert('인증 코드가 이메일로 전송되었습니다. 3분 내에 입력해주세요.');

      // 타이머 시작
      const timer = setInterval(() => {
        setCodeTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsCodeSent(false);
            setVerificationCode("");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (error) {
      console.error('인증 코드 전송 실패:', error);
      alert(`인증 코드 전송에 실패했습니다: ${error.message}`);
    } finally {
      setIsSendingCode(false);
    }
  };

  // 인증 코드 확인
  const verifyCode = async () => {
    if (!verificationCode.trim()) {
      alert('인증 코드를 입력해주세요.');
      return;
    }

    setIsVerifyingCode(true);

    try {
      const response = await fetch(`https://gateway.gamja.cloud/api/user/email/verify/code?email=${encodeURIComponent(email.trim())}&inputCode=${encodeURIComponent(verificationCode.trim())}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // response의 content-type을 확인하여 적절한 파싱 방법 선택
      const contentType = response.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('application/json')) {
        try {
          result = await response.json();
        } catch (jsonError) {
          result = await response.text();
        }
      } else {
        result = await response.text();
      }

      if (!response.ok) {
        let errorMessage;
        if (typeof result === 'object' && result !== null) {
          errorMessage = result.message || result.error || `HTTP ${response.status}`;
        } else {
          errorMessage = result || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      console.log('이메일 인증 성공:', result);
      
      setIsVerified(true);
      setCodeTimer(0);
      alert('이메일 인증이 완료되었습니다!');

      setTimeout(() => {
        navigate('/login');
      }, 1000);

    } catch (error) {
      console.error('이메일 인증 실패:', error);
      alert(`인증에 실패했습니다: ${error.message}`);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // 타이머 포맷팅 (MM:SS)
  const formatTimer = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 이메일 변경 시 상태 초기화
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (isCodeSent) {
      setIsCodeSent(false);
      setVerificationCode("");
      setCodeTimer(0);
    }
  };

  return (
    <div className="emailverification-container">
      <div className="emailverification-header">
        <img src={logo} alt="로고" />
      </div>
      
      <div className="emailverification-inner">
        <h1 className="emailverification-title">이메일 인증</h1>
        
        {!isVerified ? (
          <>
            <p className="emailverification-description">
              회원가입을 완료하기 위해 이메일 인증이 필요합니다.
            </p>

            <div className="emailverification-form">
              <div className="emailverification-email-section">
                <input
                  className="emailverification-email-input"
                  type="email"
                  placeholder="이메일 주소"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isVerified}
                />
                
                <button
                  className="emailverification-send-btn"
                  onClick={sendVerificationCode}
                  disabled={!email || isSendingCode || codeTimer > 0}
                >
                  {isSendingCode ? '전송 중...' : 
                   codeTimer > 0 ? `재전송 (${formatTimer(codeTimer)})` : 
                   '인증 코드 전송'}
                </button>
              </div>

              {isCodeSent && (
                <div className="emailverification-code-section">
                  <input
                    className="emailverification-code-input"
                    type="text"
                    placeholder="인증 코드 입력 (6자리)"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    disabled={isVerifyingCode}
                    maxLength={6}
                  />
                  
                  <button
                    className="emailverification-verify-btn"
                    onClick={verifyCode}
                    disabled={!verificationCode || isVerifyingCode}
                  >
                    {isVerifyingCode ? '확인 중...' : '인증 확인'}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="emailverification-success-section">
            <div className="emailverification-success-icon">✓</div>
            <h2 className="emailverification-success-title">이메일 인증 완료!</h2>
            <p className="emailverification-success-description">
              인증이 성공적으로 완료되었습니다.<br />
              잠시 후 로그인 페이지로 이동합니다.
            </p>
          </div>
        )}

        <div className="emailverification-footer">
          <p>
            다른 계정으로 로그인하시겠습니까?{' '}
            <button 
              className="emailverification-login-btn"
              onClick={() => navigate('/login')}
            >
              로그인
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;