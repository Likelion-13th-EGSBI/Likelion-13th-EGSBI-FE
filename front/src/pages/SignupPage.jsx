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

  const handleLoginClick = () => {
    navigate("/login");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setProfileFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewURL(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewURL("");
    }
  };


  return (
    <div className="signup-container">
        <div className="signup-header">
            <img src={logo} className="signup-header-logo" alt="로고" />
        </div>
      <div className="signup-inner">
        <h1 className="signup-title">회원가입</h1>
        <form className="signup-input-form">
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
          />

          <input
            className="signup-phone"
            type="tel"
            placeholder="전화번호"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            className="signup-email"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="signup-nickname"
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
          <input
            className="signup-password"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="signup-btn" type="submit">
            회원가입
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;
