import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "react-avatar";
import { FaUserCircle } from "react-icons/fa";
import "../css/signuppage.css"; 
import logo from '../imgs/mainlogo.png';

const SignupPage = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [profileFile, setProfileFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginClick = () => {
    navigate("/login");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setProfileFile(file);

    if (file) {
      // 파일 크기 검증 (10MB 제한)
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB를 초과할 수 없습니다.');
        return;
      }
      
      // 파일 타입 검증
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => setPreviewURL(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewURL("");
    }
  };

  // 유효성 검사 함수들
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };



  const validatePassword = (password) => {
    return password.length >= 8;
  };

  // 폼 유효성 검사
  const validateForm = () => {
    if (!name.trim()) {
      alert('이름을 입력해주세요.');
      return false;
    }


    if (!validateEmail(email)) {
      alert('올바른 이메일 주소를 입력해주세요.');
      return false;
    }

    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.');
      return false;
    }

    if (!validatePassword(password)) {
      alert('비밀번호는 최소 8자 이상이어야 합니다.');
      return false;
    }

    return true;
  };

  // 회원가입 API 호출
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // FormData 객체 생성 (멀티파트 폼 데이터)
      const formData = new FormData();
      
      // 사용자 정보 JSON 객체 생성
      const userJson = {
        name: name.trim(),
        email: email.trim(),
        password: password,
        phone: phone,
        nickname: nickname.trim()
      };
      
      console.log('User JSON:', userJson);
      
      // FormData에 사용자 정보를 JSON 문자열로 추가 (Content-Type 명시)
      formData.append('user', new Blob([JSON.stringify(userJson)], {
        type: 'application/json'
      }));
      
      // 프로필 이미지가 있는 경우에만 추가
      if (profileFile) {
        console.log('Adding profile image:', profileFile.name, 'Size:', profileFile.size);
        formData.append('image', profileFile);
      } else {
        console.log('No profile image selected - appending empty file');
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
      const response = await fetch('https://gateway.gamja.cloud/api/user/signup', {
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
        throw new Error(`회원가입 실패 (${response.status}): ${errorMessage}`);
      }
      
      const result = await response.json();
      console.log('Signup successful:', result);
      
      alert('회원가입이 완료되었습니다!');
      
      // 회원가입 성공 후 로그인 페이지로 이동
      navigate('/login');
      
    } catch (error) {
      console.error('회원가입 실패:', error);
      alert(`회원가입에 실패했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-header">
        <img src={logo} className="signup-header-logo" alt="로고" />
      </div>
      <div className="signup-inner">
        <h1 className="signup-title">회원가입</h1>
        <form className="signup-input-form" onSubmit={handleSubmit}>
          <div className="signup-profile-section">
            {previewURL ? (
              <img
                src={previewURL}
                alt="프로필 미리보기"
                className="signup-profile-image"
              />
            ) : (
              <FaUserCircle className="signup-profile-icon" />
            )}

            <div className="signup-profile-upload-wrapper">
              <label htmlFor="profile-upload" className="signup-profile-btn">
                프로필 이미지 업로드
              </label>
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="signup-profile-input"
              />
            </div>
          </div>

          <input
            className="signup-name"
            type="text"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <input
            className="signup-phone"
            type="tel"
            placeholder="전화번호"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <input
            className="signup-email"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <input
            className="signup-nickname"
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <input
            className="signup-password"
            type="password"
            placeholder="비밀번호 (최소 8자)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <button 
            className="signup-btn" 
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? '회원가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="signup-login-link">
          <p>
            이미 계정이 있으신가요?{' '}
            <button 
              type="button" 
              onClick={handleLoginClick}
              className="signup-login-btn"
              disabled={isSubmitting}
            >
              로그인
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;