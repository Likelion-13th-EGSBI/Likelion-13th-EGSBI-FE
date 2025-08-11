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
  bio: "한 줄 자기소개가 여기에 들어갑니다. 간단하게 나를 표현해보세요.",
};

const EditProfile = () => {
  const originalRef = useRef(MOCK_USER);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");

  const [editing, setEditing] = useState({
    name: false,
    phone: false,
    nickname: false,
    password: false,
    bio: false,
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
    setBio(data.bio || "");
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
    if (key === "bio") setBio(orig.bio || "");
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
    if (key === "bio") next.bio = bio;
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

        {/* ✅ 상단 프로필 카드: 좌(아바타+업로드) | 우(닉네임/이메일 표시 + 자기소개 편집) */}
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
                  프로필 이미지 업로드
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

            {/* RIGHT: 이름/닉네임/이메일 '표시만' + 자기소개(인라인 편집) */}
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

              {/* 자기소개: 보기/편집 토글 + 카운터 */}
              {!editing.bio ? (
                <div className="edit-profile-preview-bio-row">
                  <p className="edit-profile-preview-bio">
                    {bio || "자기소개가 없습니다."}
                  </p>
                  <button
                    type="button"
                    className="edit-profile-button edit-profile-button-ghost edit-profile-inline-edit"
                    onClick={() => startEdit("bio")}
                  >
                    자기소개 수정
                  </button>
                </div>
              ) : (
                <div className="edit-profile-preview-bio-editor">
                  <textarea
                    className="edit-profile-textarea"
                    rows={3}
                    maxLength={200}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="자기소개를 입력하세요. (최대 200자)"
                  />
                  <div
                    className={`edit-profile-bio-counter ${
                      bio.length >= 180 ? "edit-profile-bio-counter-warning" : ""
                    }`}
                  >
                    {bio.length} / 200
                  </div>
                  <div className="edit-profile-inline-actions">
                    <button
                      type="button"
                      className="edit-profile-button edit-profile-button-secondary"
                      onClick={() => cancelEdit("bio")}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="edit-profile-button"
                      onClick={() => saveEdit("bio")}
                    >
                      저장
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ✅ 필드 섹션: 순서 = 이메일 → 비번 → 닉네임 → 이름 → 번호 */}
        <div className="edit-profile-grid">
          <section className="edit-profile-fields">
            {/* 이메일 */}
            <div className="edit-profile-row">
              <div className="edit-profile-label">이메일</div>
              <div className="edit-profile-control">
                <input
                  className="edit-profile-input"
                  type="email"
                  value={email}
                  readOnly
                  aria-readonly="true"
                  placeholder="이메일"
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
                  aria-readonly={!editing.nickname ? "true" : "false"}
                  placeholder="닉네임"
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
                  aria-readonly={!editing.name ? "true" : "false"}
                  placeholder="이름"
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
                  aria-readonly={!editing.phone ? "true" : "false"}
                  placeholder="010-0000-0000"
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
