import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import "../css/profile-edit.css";
import logo from "../imgs/mainlogo.png";

const MOCK_USER = {
  name: "김민지",
  phone: "010-1234-5678",
  email: "test@example.com",
  nickname: "미미민지",
  profileImageUrl: "",
};

const ProfileEdit = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");

  const [profileFile, setProfileFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  useEffect(() => {
    const data = MOCK_USER;
    setName(data.name || "");
    setPhone(data.phone || "");
    setEmail(data.email || "");
    setNickname(data.nickname || "");
    if (data.profileImageUrl) setPreviewURL(data.profileImageUrl);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setProfileFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewURL(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewURL("");
    }
  };

  const handleRemoveImage = () => {
    setProfileFile(null);
    setPreviewURL("");
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (window.confirm("변경하시겠습니까?")) {
      console.log("[UI ONLY] Profile save payload:", {
        name,
        phone,
        email,
        nickname,
        hasImage: !!profileFile,
      });
      alert("저장되었습니다.");
    }
  };

  const handleChangePassword = () => {
    if (newPassword !== newPasswordConfirm) {
      alert("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (window.confirm("변경하시겠습니까?")) {
      console.log("[UI ONLY] Password change payload:", { email, newPassword });
      alert("변경되었습니다.");
      setNewPassword("");
      setNewPasswordConfirm("");
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-header">
        <img src={logo} className="signup-header-logo" alt="로고" />
      </div>

      <div className="signup-inner">
        <h1 className="signup-title">프로필 수정</h1>

        {/* 프로필 이미지 */}
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
            {previewURL && (
              <button
                type="button"
                className="signup-profile-btn"
                onClick={handleRemoveImage}
                style={{ marginTop: 8 }}
              >
                이미지 제거
              </button>
            )}
          </div>
        </div>

        {/* 기본 정보 */}
        <form className="signup-input-form" onSubmit={handleSaveProfile}>
          <input
            className="signup-name"
            type="text"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="signup-phone"
            type="tel"
            placeholder="전화번호"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            className="signup-email"
            type="email"
            placeholder="이메일"
            value={email}
            readOnly
            style={{ opacity: 0.85, cursor: "not-allowed" }}
          />

          <input
            className="signup-nickname"
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />

          <div className="signup-actions">
            <button className="signup-btn" type="submit">
              변경사항 저장
            </button>
            <button
              type="button"
              className="signup-btn signup-btn-secondary"
              onClick={() => navigate(-1)}
            >
              취소
            </button>
          </div>
        </form>

        {/* 비밀번호 변경 */}
        <div className="field-group">
          <h2 className="field-title">비밀번호 변경</h2>
          <input
            className="signup-password"
            type="password"
            placeholder="새 비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            className="signup-password"
            type="password"
            placeholder="새 비밀번호 확인"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            style={{ marginTop: 8 }}
          />

          <div className="signup-actions">
            <button
              type="button"
              className="signup-btn"
              onClick={handleChangePassword}
            >
              비밀번호 변경
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfileEdit;
