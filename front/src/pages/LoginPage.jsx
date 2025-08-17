import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/login.css";
import logo from '../imgs/mainlogo.png';

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 토큰 갱신 함수
  const renewToken = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        throw new Error('사용자 ID가 없습니다.');
      }

      console.log('토큰 갱신 요청:', userId);

      const response = await fetch(`https://gateway.gamja.cloud/api/user/renew?userId=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`토큰 갱신 실패: ${response.status}`);
      }

      const tokenData = await response.json();
      console.log('토큰 갱신 성공:', tokenData);
      
      // 새 토큰 저장
      localStorage.setItem('accessToken', tokenData.accessToken);
      localStorage.setItem('userId', tokenData.id.toString());
      localStorage.setItem('userEmail', tokenData.email);
      
      // 새로운 만료 시간 계산하여 저장
      const expirationTime = Date.now() + (tokenData.expiresIn * 1000);
      localStorage.setItem('tokenExpiration', expirationTime.toString());
      
      return tokenData;
      
    } catch (error) {
      console.error('토큰 갱신 실패:', error);
      // 갱신 실패 시 로그아웃
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('tokenExpiration');
      window.location.href = '/login';
      throw error;
    }
  };

  // 토큰 자동 갱신 관리
  useEffect(() => {
    const checkAndRenewToken = async () => {
      const token = localStorage.getItem('accessToken');
      const expirationTime = localStorage.getItem('tokenExpiration');
      
      if (!token || !expirationTime) return;
      
      const now = Date.now();
      const expiration = parseInt(expirationTime);
      
      // 만료 5분 전부터 갱신 시도
      const fiveMinutesInMs = 5 * 60 * 1000;
      
      if (now >= (expiration - fiveMinutesInMs)) {
        if (now >= expiration) {
          // 완전히 만료된 경우
          console.log('토큰이 완전히 만료됨 - 로그아웃');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userId');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('tokenExpiration');
          window.location.href = '/login';
        } else {
          // 만료 5분 전 - 갱신 시도
          try {
            await renewToken();
            console.log('토큰 자동 갱신 완료');
          } catch (error) {
            console.error('토큰 자동 갱신 실패:', error);
          }
        }
      }
    };

    // 초기 체크
    checkAndRenewToken();

    // 5분마다 토큰 상태 확인
    const interval = setInterval(checkAndRenewToken, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // 이미 로그인된 사용자 체크
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const expirationTime = localStorage.getItem('tokenExpiration');
    
    if (token && expirationTime) {
      const now = Date.now();
      const expiration = parseInt(expirationTime);
      
      if (now < expiration) {
        console.log('이미 로그인된 사용자 - 리다이렉트 처리');
        // redirect 파라미터가 있으면 해당 URL로, 없으면 메인 페이지로
        const urlParams = new URLSearchParams(location.search);
        const redirectUrl = urlParams.get('redirect');
        
        if (redirectUrl) {
          window.location.href = decodeURIComponent(redirectUrl);
        } else {
          navigate('/');
        }
      }
    }
  }, [navigate, location]);

  const handleSignupClick = () => {
    navigate('/signup');
  };

  const changeEmail = (e) => setEmail(e.target.value);
  const changePassword = (e) => setPassword(e.target.value);

  // 유효성 검사
  const validateForm = () => {
    if (!email.trim()) {
      alert('이메일을 입력해주세요.');
      return false;
    }

    if (!password.trim()) {
      alert('비밀번호를 입력해주세요.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('올바른 이메일 주소를 입력해주세요.');
      return false;
    }

    return true;
  };

  // 로그인 처리
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const loginData = {
        email: email.trim(),
        password: password
      };

      console.log('로그인 요청:', { email: loginData.email });

      const response = await fetch('https://gateway.gamja.cloud/api/user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData)
      });

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error;
        } catch {
          errorMessage = await response.text();
        }
        throw new Error(`로그인 실패: ${errorMessage}`);
      }

      const tokenData = await response.json();
      console.log('로그인 성공:', {
        id: tokenData.id,
        name: tokenData.name,
        email: tokenData.email
      });

      // 토큰, id, 이메일과 만료시간 저장
      localStorage.setItem('accessToken', tokenData.accessToken);
      localStorage.setItem('userId', tokenData.id.toString());
      localStorage.setItem('userEmail', tokenData.email);
      
      // 만료 시간 계산하여 저장 (현재 시간 + expiresIn초)
      const expirationTime = Date.now() + (tokenData.expiresIn * 1000);
      localStorage.setItem('tokenExpiration', expirationTime.toString());

      // 로그인 성공 후 리다이렉트 처리
      const redirectUrl = localStorage.getItem('redirectAfterLogin');
      
      console.log('localStorage에서 가져온 redirect URL:', redirectUrl);
      
      if (redirectUrl) {
        console.log('리다이렉트 URL로 이동:', redirectUrl);
        // 사용한 redirect URL 삭제
        localStorage.removeItem('redirectAfterLogin');
        // 전체 페이지 새로고침으로 이동
        window.location.href = redirectUrl;
      } else {
        console.log('redirect URL이 없음 - 메인 페이지로 이동');
        // 메인 페이지는 navigate 사용
        navigate('/');
      }

    } catch (error) {
      console.error('로그인 실패:', error);
      alert(error.message || '로그인에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-header">
        <img src={logo} className="login-header-logo" alt="로고" />
      </div>

      <div className="login-container">
        <div className="login-inner">
          <div className='loginlogo-con'>
            <img src={logo} className='loginlogo' alt="로그인로고" />
          </div>

          <div className="login-slogan">
            <p className="slogan-main">이메일로 로그인 하세요.</p>
            <p className="slogan-sub">맞춤형 행사 추천 서비스, <strong>Eventory</strong></p>
          </div>

          <form className="login-input-form" onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              className="login-email"
              placeholder="이메일"
              onChange={changeEmail}
              required
              disabled={isSubmitting}
            />
            <input
              type="password"
              value={password}
              className="login-password"
              placeholder="비밀번호"
              onChange={changePassword}
              required
              disabled={isSubmitting}
            />
            <button 
              type="submit" 
              className="login-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="signup-link">
            아직 회원이 아니신가요?{" "}
            <span 
              onClick={handleSignupClick} 
              className="login-to-signup"
              style={{ 
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1 
              }}
            >
              회원가입
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;