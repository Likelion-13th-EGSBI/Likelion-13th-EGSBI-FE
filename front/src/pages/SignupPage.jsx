import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import "../css/signuppage.css";
import logo from "../imgs/mainlogo.png";

const SignupPage = () => {
  const navigate = useNavigate();

  // 회원 정보 상태
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [profileFile, setProfileFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  // 이메일 인증 관련 상태
  const [verificationCode, setVerificationCode] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isCodeSending, setIsCodeSending] = useState(false);
  const [isCodeVerifying, setIsCodeVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 유효성 검사
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (pw) => pw.length >= 8;

  // 프로필 파일 핸들러
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setProfileFile(file);
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("파일 크기는 10MB를 초과할 수 없습니다.");
        return;
      }
      if (!file.type.startsWith("image/")) {
        alert("이미지 파일만 업로드할 수 있습니다.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setPreviewURL(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewURL("");
    }
  };

  // 이메일 인증코드 발송
// 이메일 인증코드 발송 (쿼리 파라미터로 email 전달)
const sendVerificationCode = async () => {
  if (!validateEmail(email)) {
    alert("올바른 이메일을 입력해주세요.");
    return;
  }
  setIsCodeSending(true);
  try {
    const response = await fetch(
      `https://likelion-att.o-r.kr/v1/user/email/send/code?email=${encodeURIComponent(email.trim())}`,
      { method: "POST" }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`인증코드 발송 실패: ${errorText}`);
    }
    setCodeSent(true);
    alert("인증코드가 이메일로 발송되었습니다.");
  } catch (error) {
    alert(error.message);
  } finally {
    setIsCodeSending(false);
  }
};

// 이메일 인증코드 검증 (쿼리 파라미터로 email, inputCode 전달)
const verifyCode = async () => {
  if (!verificationCode.trim()) {
    alert("인증코드를 입력하세요.");
    return;
  }
  setIsCodeVerifying(true);
  try {
    const response = await fetch(
      `https://likelion-att.o-r.kr/v1/user/email/verify/code?email=${encodeURIComponent(email.trim())}&inputCode=${encodeURIComponent(verificationCode.trim())}`,
      { method: "POST" }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`인증 실패: ${errorText}`);
    }
    setIsEmailVerified(true);
    alert("이메일 인증이 완료되었습니다!");
  } catch (error) {
    alert(error.message);
  } finally {
    setIsCodeVerifying(false);
  }
};


  // 회원가입 API
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    if (!validateEmail(email)) {
      alert("올바른 이메일을 입력해주세요.");
      return;
    }
    if (!nickname.trim()) {
      alert("닉네임을 입력해주세요.");
      return;
    }
    if (!validatePassword(password)) {
      alert("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (!isEmailVerified) {
      alert("이메일 인증을 완료해주세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      const userJson = {
        name: name.trim(),
        email: email.trim(),
        password,
        phone,
        nickname: nickname.trim()
      };
      formData.append("user", new Blob([JSON.stringify(userJson)], { type: "application/json" }));
      if (profileFile) {
        formData.append("image", profileFile);
      } else {
        formData.append("image", new Blob([], { type: "application/octet-stream" }));
      }
      const response = await fetch("https://likelion-att.o-r.kr/v1/user/signup", {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`회원가입 실패: ${errorText}`);
      }
      alert("회원가입이 완료되었습니다!");
      navigate("/login");
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로그인 링크
  const handleLoginClick = () => navigate("/login");

  return (
    <div className="signup-container">
      <div className="signup-header">
        <img src={logo} alt="로고" className="signup-header-img" />
      </div>
      <div className="signup-inner">
        <h1 className="signup-title">회원가입</h1>
        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="signup-profile-section">
            {previewURL ? (
              <img src={previewURL} alt="프로필 미리보기" className="signup-profile-image" />
            ) : (
              <FaUserCircle className="signup-profile-icon" />
            )}
            <div className="signup-upload-wrapper">
              <label htmlFor="profile-upload" className="signup-upload-label">
                프로필 이미지 업로드
              </label>
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="signup-upload-input"
              />
            </div>
          </div>

          <input
            className="signup-input-field"
            type="text"
            placeholder="이름"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <input
            className="signup-input-field"
            type="tel"
            placeholder="전화번호"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            disabled={isSubmitting}
          />

          {/* 이메일 입력란과 보내기 버튼 */}
          <div className="signup-email-group">
            <input
              className="signup-input-field-with-button"
              type="email"
              placeholder="이메일"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                setIsEmailVerified(false);
                setCodeSent(false);
                setVerificationCode("");
              }}
              required
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="signup-send-button"
              onClick={sendVerificationCode}
              disabled={isCodeSending || !validateEmail(email) || isSubmitting}
            >
              {isCodeSending ? "발송중..." : "보내기"}
            </button>
          </div>

          {/* 인증코드 발송 후 나타나는 영역 */}
          {codeSent && (
            <div className="signup-verification-section">
              <div className="signup-verification-group">
                <input
                  className="signup-input-field-with-button"
                  type="text"
                  placeholder="인증번호 입력"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value)}
                  disabled={isEmailVerified || isSubmitting}
                />
                <button
                  type="button"
                  className="signup-verify-button"
                  onClick={verifyCode}
                  disabled={isCodeVerifying || isEmailVerified || !verificationCode || isSubmitting}
                >
                  {isCodeVerifying ? "인증중..." : "인증하기"}
                </button>
              </div>
              {isEmailVerified && (
                <div className="signup-verification-success">
                  ✅ 이메일 인증이 완료되었습니다!
                </div>
              )}
            </div>
          )}

          <input
            className="signup-input-field"
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <input
            className="signup-input-field"
            type="password"
            placeholder="비밀번호 (최소 8자)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <button
            className="signup-submit-btn"
            type="submit"
            disabled={isSubmitting || !isEmailVerified}
          >
            {isSubmitting ? "회원가입 중..." : "회원가입"}
          </button>
        </form>

        <div className="signup-login-link">
          <p className="signup-login-link-text">
            이미 계정이 있으신가요?{" "}
            <span className="signup-login-btn" onClick={handleLoginClick}>
              로그인
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
