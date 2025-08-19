// src/pages/EditProfile.jsx
import React, { useEffect, useRef, useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import Layout from "../components/Layout";
import "../css/editprofile.css";

/* 고정 베이스 URL (.env 쓰지 말라 했으니 상수) */
const BASE_URL = "https://gateway.gamja.cloud";

/* 로컬스토리지 헬퍼 (필요 최소) */
const getToken = () =>
  localStorage.getItem("Token") || localStorage.getItem("accessToken") || "";
const getEmailLS = () =>
  localStorage.getItem("userEmail") || localStorage.getItem("email") || "";

/* 안전 JSON 파서 */
async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return ct.includes("application/json") ? JSON.parse(text) : text;
  } catch {
    return text;
  }
}

const EditProfile = () => {
  // 원본 보관
  const originalRef = useRef({
    name: "",
    phone: "",
    email: "",
    nickname: "",
    profileImageUrl: "",
  });

  // 화면 상태
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");

  // 전역 수정모드
  const [editMode, setEditMode] = useState(false);

  // 비밀번호(선택)
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  // 프로필 이미지
  const [profileFile, setProfileFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const fileInputRef = useRef(null);

  // UX 상태
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  /* 1) 초기 로딩 */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const targetEmail = getEmailLS();
        if (!targetEmail) throw new Error("이메일을 찾을 수 없습니다.");

        const res = await fetch(
          `${BASE_URL}/api/user/info?email=${encodeURIComponent(targetEmail)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
            },
          }
        );
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.message || "사용자 정보 조회 실패");

        const next = {
          name: body?.name ?? "",
          phone: body?.phone ?? body?.phoneNumber ?? "",
          email: body?.email ?? targetEmail,
          nickname: body?.nickname ?? "",
          profileImageUrl: body?.profileImageUrl ?? "",
        };
        originalRef.current = next;

        setName(next.name);
        setPhone(next.phone);
        setEmail(next.email);
        setNickname(next.nickname);
        setPreviewURL(next.profileImageUrl || "");
      } catch (e) {
        console.error(e);
        setErr(e.message || "초기화 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* 2) 수정모드 토글 */
  const enterEdit = () => {
    setErr("");
    setEditMode(true);
    setNewPassword("");
    setNewPasswordConfirm("");
    setProfileFile(null);
    setPreviewURL(originalRef.current.profileImageUrl || "");
  };
  const cancelEdit = () => {
    setErr("");
    setEditMode(false);
    const o = originalRef.current;
    setNickname(o.nickname || "");
    setNewPassword("");
    setNewPasswordConfirm("");
    setProfileFile(null);
    setPreviewURL(o.profileImageUrl || "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* 3) 파일 선택(수정모드에서만 버튼 렌더 & 동작) */
  const openFilePicker = () => {
    if (!editMode) return;
    fileInputRef.current?.click();
  };
  const handleFileChange = (e) => {
    if (!editMode) return;
    const file = e.target.files?.[0] || null;
    setProfileFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewURL(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewURL(originalRef.current.profileImageUrl || "");
    }
  };
  const handleRemoveImage = () => {
    if (!editMode) return;
    setProfileFile(null);
    setPreviewURL("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* 4) 저장(멀티파트) */
  const onSaveAll = async () => {
    const wantChangePw = newPassword || newPasswordConfirm;
    if (wantChangePw) {
      if (newPassword.length < 8) return alert("새 비밀번호는 8자 이상이어야 합니다.");
      if (newPassword !== newPasswordConfirm) return alert("비밀번호 확인이 일치하지 않습니다.");
    }
    if (!window.confirm("수정 내용을 저장하시겠습니까?")) return;

    setSaving(true);
    setErr("");
    try {
      const payload = {
        name: originalRef.current.name,
        email: email,
        phone: originalRef.current.phone,
        nickname: nickname,
        ...(wantChangePw ? { password: newPassword } : {}),
      };

      const form = new FormData();
      form.append("user", new Blob([JSON.stringify(payload)], { type: "application/json" }));
      if (profileFile) {
        form.append("image", profileFile, profileFile.name || "image");
      } else {
        form.append("image", new Blob([], { type: "application/octet-stream" }), "");
      }

      const headers = { Accept: "application/json" };
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/api/user/update`, {
        method: "PATCH",
        headers,
        body: form, // Content-Type 수동 설정 금지
      });

      const body = await safeJson(res);
      if (!res.ok) {
        console.error("Update failed", res.status, body);
        throw new Error(body?.message || `회원 정보 수정 실패 (status ${res.status})`);
      }

      // 성공
      originalRef.current.nickname = nickname;
      if (profileFile) {
        const newUrl = body?.profileImageUrl ?? null;
        originalRef.current.profileImageUrl = newUrl || previewURL || originalRef.current.profileImageUrl;
      }
      setEditMode(false);
      setNewPassword("");
      setNewPasswordConfirm("");
      setProfileFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      alert("저장되었습니다.");
    } catch (e) {
      console.error(e);
      setErr(e.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  /* 5) 렌더링 */
  if (loading) {
    return (
      <Layout pageTitle="프로필 수정" activeMenuItem="mypage">
        <div className="edit-profile-container">
          <p>불러오는 중…</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="프로필 수정" activeMenuItem="mypage">
      <div className="edit-profile-container">
        {err && <div className="edit-profile-alert">{err}</div>}

        {/* 상단 미리보기 카드 (닉네임 → 이름 → 이메일) */}
        <section className="edit-profile-preview-card">
          <div className="edit-profile-preview-banner" />
          <div className="edit-profile-preview-body">
            {/* LEFT: 아바타 */}
            <div className="edit-profile-preview-left">
              {previewURL ? (
                <img src={previewURL} alt="프로필" className="edit-profile-preview-avatar-large" />
              ) : (
                <div className="edit-profile-preview-avatar-large edit-profile-preview-avatar-placeholder">
                  <FaUserCircle />
                </div>
              )}

              {/* 수정모드일 때만 이미지 버튼 노출 */}
              {editMode && (
                <div className="edit-profile-upload">
                  <button type="button" className="edit-profile-button" onClick={openFilePicker}>
                    이미지 수정하기
                  </button>
                  <input
                    ref={fileInputRef}
                    id="profile-upload"
                    type="file"
                    accept="image/*"
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
              )}
            </div>

            {/* RIGHT: 텍스트 */}
            <div className="edit-profile-preview-right">
              <div className="edit-profile-preview-texts">
                <h2 className="edit-profile-preview-name">
                  {nickname || "닉네임"}
                </h2>
                <span className="edit-profile-preview-nickname">
                  {name || "이름"}
                </span>
                <p className="edit-profile-preview-email">
                  {email || "email@example.com"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 입력 필드 */}
        <div className="edit-profile-grid">
          <section className="edit-profile-fields">
            {/* 이메일 (read-only) */}
            <div className="edit-profile-row">
              <div className="edit-profile-label">이메일</div>
              <div className="edit-profile-control">
                <input className="edit-profile-input" type="email" value={email} disabled />
              </div>
            </div>

            {/* 이름 (read-only) */}
            <div className="edit-profile-row">
              <div className="edit-profile-label">이름</div>
              <div className="edit-profile-control">
                <input className="edit-profile-input" type="text" value={name} disabled />
              </div>
            </div>

            {/* 번호 (read-only) */}
            <div className="edit-profile-row">
              <div className="edit-profile-label">번호</div>
              <div className="edit-profile-control">
                <input className="edit-profile-input" type="tel" value={phone} disabled />
              </div>
            </div>

            {/* 닉네임 (수정모드에서만 편집 가능) */}
            <div className="edit-profile-row">
              <div className="edit-profile-label">닉네임</div>
              <div className="edit-profile-control">
                <input
                  className="edit-profile-input"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  readOnly={!editMode}
                />
              </div>
            </div>

            {/* 비밀번호 (수정모드에서만 입력) */}
            <div className="edit-profile-row edit-profile-row-stack">
              <div className="edit-profile-label">비밀번호</div>
              <div className="edit-profile-control edit-profile-control-stack">
                {!editMode ? (
                  <input className="edit-profile-input" type="password" value="********" readOnly aria-readonly="true" />
                ) : (
                  <>
                    <input
                      className="edit-profile-input"
                      type="password"
                      placeholder="새 비밀번호 (선택, 8자 이상)"
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
            </div>
          </section>
        </div>

        {/* 하단 액션바: 항상 렌더링 / 가운데 정렬 */}
        <div className="edit-profile-actionbar">
          {!editMode ? (
            <button className="edit-profile-button" type="button" onClick={enterEdit} disabled={saving}>
              수정
            </button>
          ) : (
            <>
              <button
                className="edit-profile-button edit-profile-button-secondary"
                type="button"
                onClick={cancelEdit}
                disabled={saving}
              >
                취소
              </button>
              <button
                className="edit-profile-button"
                type="button"
                onClick={onSaveAll}
                aria-busy={saving}
                disabled={saving}
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default EditProfilㄷ;
