// src/pages/EditProfile.jsx
import React, { useEffect, useRef, useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import Layout from "../components/Layout";
import "../css/editprofile.css";

const BASE_URL = "https://gateway.gamja.cloud";

/** 이미지 URL 생성: profileId -> /api/image/{id} */
const toProfileUrl = (id) => {
  if (!id && id !== 0) return "";
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${BASE_URL}/api/image/${n}`;
};

/** 안전 JSON 파서 */
async function safeJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const EditProfile = () => {
  const originalRef = useRef({
    userId: "",
    name: "",
    phone: "",
    email: "",
    nickname: "",
    profileId: null,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [profileFile, setProfileFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [profileEnabled, setProfileEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fileInputRef = useRef(null);

  /** 초기 로딩: /api/user/info?userId=... */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const userId = localStorage.getItem("userId");
        const accessToken = localStorage.getItem("accessToken") || "";
        if (!userId) throw new Error("로그인이 필요합니다.");

        const res = await fetch(
          `${BASE_URL}/api/user/info?userId=${encodeURIComponent(userId)}`,
          {
            headers: {
              Accept: "application/json",
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            cache: "no-store",
          }
        );
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.message || `사용자 정보 조회 실패 (${res.status})`);

        const next = {
          userId,
          name: body?.name ?? "",
          phone: body?.phone ?? "",
          email: body?.email ?? "",
          nickname: body?.nickname ?? "",
          profileId: body?.profileId ?? null,
        };
        originalRef.current = next;

        setName(next.name);
        setPhone(next.phone);
        setEmail(next.email);
        setNickname(next.nickname);
        setPreviewURL(toProfileUrl(next.profileId));
        setProfileEnabled(true);
      } catch (e) {
        console.error(e);
        setErr(e.message || "초기화 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** 수정모드 토글 */
  const enterEdit = () => {
    setErr("");
    setEditMode(true);
    setNewPassword("");
    setNewPasswordConfirm("");
    setProfileFile(null);
    setPreviewURL(toProfileUrl(originalRef.current.profileId));
    setProfileEnabled(true);
  };

  const cancelEdit = () => {
    setErr("");
    setEditMode(false);
    const o = originalRef.current;
    setNickname(o.nickname || "");
    setNewPassword("");
    setNewPasswordConfirm("");
    setProfileFile(null);
    setPreviewURL(toProfileUrl(o.profileId));
    if (fileInputRef.current) fileInputRef.current.value = "";
    setProfileEnabled(true);
  };

  /** 파일 선택 */
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
      reader.onloadend = () => setPreviewURL(reader.result); // data: URL 미리보기
      reader.readAsDataURL(file);
      setProfileEnabled(true);
    } else {
      setPreviewURL(toProfileUrl(originalRef.current.profileId));
      setProfileEnabled(true);
    }
  };

  const handleRemoveImage = () => {
    if (!editMode) return;
    setProfileFile(null);
    setPreviewURL("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setProfileEnabled(false); // 삭제 의사 표시
  };

  /** 저장 */
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
      const token = localStorage.getItem("accessToken") || "";

      // 서버 스펙: UserUpdateRequest
      const userPayload = {
        name: originalRef.current.name,
        email: email, // 스펙 상 존재
        phone: originalRef.current.phone,
        nickname: nickname,
        profileEnabled: profileEnabled,
        ...(wantChangePw ? { password: newPassword } : {}),
      };

      const form = new FormData();
      form.append("user", new Blob([JSON.stringify(userPayload)], { type: "application/json" }));
      if (profileEnabled && profileFile) {
        form.append("image", profileFile, profileFile.name || "image");
      }

      const res = await fetch(`${BASE_URL}/api/user/update`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });

      const body = await safeJson(res);
      if (!res.ok) {
        console.error("Update failed", res.status, body);
        throw new Error(body?.message || `회원 정보 수정 실패 (${res.status})`);
      }

      // 성공 시 **다시 조회**해서 최신 profileId/닉네임 반영
      const refetch = await fetch(
        `${BASE_URL}/api/user/info?userId=${encodeURIComponent(originalRef.current.userId)}`,
        {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        }
      );
      const fresh = await safeJson(refetch);
      if (refetch.ok && fresh) {
        originalRef.current.nickname = fresh?.nickname ?? nickname;
        originalRef.current.profileId = fresh?.profileId ?? originalRef.current.profileId;

        const nextUrl = toProfileUrl(originalRef.current.profileId);

        // 화면 반영
        setNickname(originalRef.current.nickname);
        setPreviewURL(nextUrl);

        // 다른 화면 갱신 신호
        window.dispatchEvent(
          new CustomEvent("user:profileUpdated", {
            detail: {
              nickname: originalRef.current.nickname,
              profileId: originalRef.current.profileId,
              profileImageUrl: nextUrl,
            },
          })
        );
      }

      // 폼 상태 초기화
      setEditMode(false);
      setNewPassword("");
      setNewPasswordConfirm("");
      setProfileFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setProfileEnabled(true);

      // 닉네임 정도만 캐시 (이미지 URL은 저장 안 함)
      localStorage.setItem("nickname", (fresh?.nickname ?? nickname) || "");

      alert("저장되었습니다.");
    } catch (e) {
      console.error(e);
      setErr(e.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout pageTitle="프로필 수정" activeMenuItem="mypage">
        <div className="edit-profile-container"><p>불러오는 중…</p></div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="프로필 수정" activeMenuItem="mypage">
      <div className="edit-profile-container">
        {err && <div className="edit-profile-alert">{err}</div>}

        {/* 상단 미리보기 카드 */}
        <section className="edit-profile-preview-card">
          <div className="edit-profile-preview-banner" />
          <div className="edit-profile-preview-body">
            <div className="edit-profile-preview-left">
              {previewURL ? (
                <img
                  src={previewURL}
                  alt="프로필"
                  className="edit-profile-preview-avatar-large"
                  onError={(e) => {
                    e.currentTarget.src = "/imgs/profile-fallback.png";
                  }}
                />
              ) : (
                <div className="edit-profile-preview-avatar-large edit-profile-preview-avatar-placeholder">
                  <FaUserCircle />
                </div>
              )}

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

            <div className="edit-profile-preview-right">
              <div className="edit-profile-preview-texts">
                <h2 className="edit-profile-preview-name">{nickname || "닉네임"}</h2>
                <span className="edit-profile-preview-nickname">{name || "이름"}</span>
                <p className="edit-profile-preview-email">{email || "email@example.com"}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 입력 필드 */}
        <div className="edit-profile-grid">
          <section className="edit-profile-fields">
            <div className="edit-profile-row">
              <div className="edit-profile-label">이메일</div>
              <div className="edit-profile-control">
                <input className="edit-profile-input" type="email" value={email} disabled />
              </div>
            </div>

            <div className="edit-profile-row">
              <div className="edit-profile-label">이름</div>
              <div className="edit-profile-control">
                <input className="edit-profile-input" type="text" value={name} disabled />
              </div>
            </div>

            <div className="edit-profile-row">
              <div className="edit-profile-label">번호</div>
              <div className="edit-profile-control">
                <input className="edit-profile-input" type="tel" value={phone} disabled />
              </div>
            </div>

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

        {/* 하단 액션바 */}
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

export default EditProfile;
