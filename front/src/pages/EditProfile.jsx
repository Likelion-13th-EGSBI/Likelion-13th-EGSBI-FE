import React, { useEffect, useRef, useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import Layout from "../components/Layout";
import "../css/editprofile.css";

const MOCK_USER = {
  name: "김민지",
  phone: "010-1234-5678",
  email: "test@example.com",
  nickname: "미미민지",
  profileImageUrl: "",
};

const EditProfile = () => {
  const originalRef = useRef(MOCK_USER);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");

  const [editing, setEditing] = useState({
    name: false,
    phone: false,
    nickname: false,
    password: false,
  });

  const [profileFile, setProfileFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  useEffect(() => {
    const data = MOCK_USER;
    originalRef.current = data;
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

  const startEdit = (key) => setEditing((s) => ({ ...s, [key]: true }));
  const cancelEdit = (key) => {
    const orig = originalRef.current;
    if (key === "name") setName(orig.name || "");
    if (key === "phone") setPhone(orig.phone || "");
    if (key === "nickname") setNickname(orig.nickname || "");
    if (key === "password") {
      setNewPassword("");
      setNewPasswordConfirm("");
    }
    setEditing((s) => ({ ...s, [key]: false }));
  };
  const saveEdit = (key) => {
    if (!window.confirm("변경하시겠습니까?")) return;
    const next = { ...originalRef.current };
    if (key === "name") next.name = name;
    if (key === "phone") next.phone = phone;
    if (key === "nickname") next.nickname = nickname;
    originalRef.current = next;
    setEditing((s) => ({ ...s, [key]: false }));
    alert("변경되었습니다.");
  };

  const savePassword = () => {
    if (!newPassword || !newPasswordConfirm) {
      alert("새 비밀번호를 입력해주세요.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      alert("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (!window.confirm("변경하시겠습니까?")) return;

    console.log("[UI ONLY] Password change payload:", { email, newPassword });
    setNewPassword("");
    setNewPasswordConfirm("");
    setEditing((s) => ({ ...s, password: false }));
    alert("변경되었습니다.");
  };

  return (
    <Layout pageTitle="프로필 수정" activeMenuItem="mypage">
      <div className="edit-profile-container">

        {/* ✅ 상단 프로필 카드 */}
        <section className="edit-profile-preview-card">
          <div className="edit-profile-preview-banner" />
          <div className="edit-profile-preview-body">

            {/* LEFT: 아바타 + 업로드 */}
            <div className="edit-profile-preview-left">
              {previewURL ? (
                <img
                  src={previewURL}
                  alt="프로필"
                  className="edit-profile-preview-avatar-large"
                />
              ) : (
                <div className="edit-profile-preview-avatar-large edit-profile-preview-avatar-placeholder">
                  <FaUserCircle />
                </div>
              )}
              <div className="edit-profile-upload">
                <label htmlFor="profile-upload" className="edit-profile-button">
                  이미지 수정하기
                </label>
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="edit-profile-file-input"
                />
                {previewURL && (
                  <button
                    type="button"
                    className="edit-profile-button edit-profile-button-ghost"
                    onClick={handleRemoveImage}
                  >
                    이미지 제거
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT: 이름/닉네임/이메일 표시 */}
            <div className="edit-profile-preview-right">
              <div className="edit-profile-preview-texts">
                <h2 className="edit-profile-preview-name" style={{ margin: 0 }}>
                  {name || "사용자 이름"}
                </h2>
                {nickname && (
                  <span className="edit-profile-preview-nickname">{nickname}</span>
                )}
                <p className="edit-profile-preview-email" style={{ marginTop: 4 }}>
                  {email || "email@example.com"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ✅ 필드 섹션 */}
        <div className="edit-profile-grid">
          <section className="edit-profile-fields">

            {/* 이메일 (변경 불가) */}
            <div className="edit-profile-row">
              <div className="edit-profile-label">이메일</div>
              <div className="edit-profile-control">
                <input
                  className="edit-profile-input"
                  type="email"
                  value={email}
                  disabled
                />
              </div>
              <div className="edit-profile-actions" />
            </div>

            {/* 비밀번호 */}
            <div className="edit-profile-row edit-profile-row-stack">
              <div className="edit-profile-label">비밀번호</div>
              <div className="edit-profile-control edit-profile-control-stack">
                {!editing.password ? (
                  <input
                    className="edit-profile-input"
                    type="password"
                    value="********"
                    readOnly
                    aria-readonly="true"
                  />
                ) : (
                  <>
                    <input
                      className="edit-profile-input"
                      type="password"
                      placeholder="새 비밀번호"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <input
                      className="edit-profile-input"
                      type="password"
                      placeholder="새 비밀번호 확인"
                      autoComplete="new-password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    />
                  </>
                )}
              </div>
              <div className="edit-profile-actions">
                {!editing.password ? (
                  <button
                    className="edit-profile-button"
                    type="button"
                    onClick={() => startEdit("password")}
                  >
                    변경
                  </button>
                ) : (
                  <>
                    <button
                      className="edit-profile-button edit-profile-button-secondary"
                      type="button"
                      onClick={() => cancelEdit("password")}
                    >
                      취소
                    </button>
                    <button
                      className="edit-profile-button"
                      type="button"
                      onClick={savePassword}
                    >
                      저장
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 닉네임 */}
            <div className="edit-profile-row">
              <div className="edit-profile-label">닉네임</div>
              <div className="edit-profile-control">
                <input
                  className="edit-profile-input"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  readOnly={!editing.nickname}
                />
              </div>
              <div className="edit-profile-actions">
                {!editing.nickname ? (
                  <button
                    className="edit-profile-button"
                    type="button"
                    onClick={() => startEdit("nickname")}
                  >
                    변경
                  </button>
                ) : (
                  <>
                    <button
                      className="edit-profile-button edit-profile-button-secondary"
                      type="button"
                      onClick={() => cancelEdit("nickname")}
                    >
                      취소
                    </button>
                    <button
                      className="edit-profile-button"
                      type="button"
                      onClick={() => saveEdit("nickname")}
                    >
                      저장
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 이름 */}
            <div className="edit-profile-row">
              <div className="edit-profile-label">이름</div>
              <div className="edit-profile-control">
                <input
                  className="edit-profile-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={!editing.name}
                />
              </div>
              <div className="edit-profile-actions">
                {!editing.name ? (
                  <button
                    className="edit-profile-button"
                    type="button"
                    onClick={() => startEdit("name")}
                  >
                    변경
                  </button>
                ) : (
                  <>
                    <button
                      className="edit-profile-button edit-profile-button-secondary"
                      type="button"
                      onClick={() => cancelEdit("name")}
                    >
                      취소
                    </button>
                    <button
                      className="edit-profile-button"
                      type="button"
                      onClick={() => saveEdit("name")}
                    >
                      저장
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 번호 */}
            <div className="edit-profile-row">
              <div className="edit-profile-label">번호</div>
              <div className="edit-profile-control">
                <input
                  className="edit-profile-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  readOnly={!editing.phone}
                />
              </div>
              <div className="edit-profile-actions">
                {!editing.phone ? (
                  <button
                    className="edit-profile-button"
                    type="button"
                    onClick={() => startEdit("phone")}
                  >
                    변경
                  </button>
                ) : (
                  <>
                    <button
                      className="edit-profile-button edit-profile-button-secondary"
                      type="button"
                      onClick={() => cancelEdit("phone")}
                    >
                      취소
                    </button>
                    <button
                      className="edit-profile-button"
                      type="button"
                      onClick={() => saveEdit("phone")}
                    >
                      저장
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default EditProfile;
