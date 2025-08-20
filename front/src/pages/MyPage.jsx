// src/pages/MyPage.jsx
import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import "../css/mypage.css";

/* ===== 고정 메뉴 ===== */
const MENU_ITEMS = [
  { key: "bookmarks", icon: "🔖", title: "북마크한 행사", desc: "관심 있는 행사" },
  { key: "subscriptions", icon: "👥", title: "구독한 주최자", desc: "팔로우한 주최자" },
  { key: "joined", icon: "✅", title: "내가 참여한 행사", desc: "참여 내역" },
  { key: "uploaded", icon: "📌", title: "내가 업로드한 행사", desc: "등록한 행사 관리" },
];

const BASE_URL = "https://gateway.gamja.cloud";

/** 빈 본문/비 JSON도 안전하게 파싱 */
async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  if (!text || !text.trim()) return null;
  if (ct.includes("application/json")) {
    try { return JSON.parse(text); } catch { return null; }
  }
  try { return JSON.parse(text); } catch { return null; }
}

/* ===== 공통 헬퍼 ===== */
const getAuthHeaders = () => {
  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("Token") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/* ===== 이미지 도우미 ===== */
// 캐시버스터 안전 판별
const shouldAppendRev = (u) => {
  if (!u) return false;
  if (/^(data:|blob:)/i.test(u)) return false; // 프리뷰/로컬
  if (/[?&](X-Amz-|X-Goog-Signature|GoogleAccessId|Signature=|Token=|Expires=)/i.test(u)) return false; // 서명 URL
  return true;
};
// 절대 URL 변환
const absoluteUrl = (base, pathOrUrl) => {
  if (!pathOrUrl) return "";
  if (/^(https?:|data:|blob:)/i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith("/")) return `${base}${pathOrUrl}`;
  return `${base}/${pathOrUrl}`;
};
// 다양한 형태에서 imageId 추출 (숫자/문자/URL)
const extractImageId = (v) => {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const onlyDigits = v.trim();
    if (/^\d+$/.test(onlyDigits)) return Number(onlyDigits);
    const m = onlyDigits.match(/\/api\/image\/(\d+)(?:\D|$)/);
    if (m) return Number(m[1]);
  }
  return null;
};

const MyPage = ({ onPageChange }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // blob ObjectURL (GET /api/image/{id}로 받은 바이너리)
  const [avatarObjectUrl, setAvatarObjectUrl] = useState("");

  /* 1) 로컬스토리지 캐시로 즉시 표기 (닉네임/이미지/리비전/이미지ID 포함) */
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    const userId = localStorage.getItem("userId");

    const nicknameLS = localStorage.getItem("nickname") || "";
    const avatarUrlLS = localStorage.getItem("profileImageUrl") || "";
    const avatarRevLS = localStorage.getItem("profileImageRev") || "";
    const avatarIdLS = localStorage.getItem("profileImageId");

    if (userEmail && userId) {
      setUser({
        id: userId,
        email: userEmail,
        name: nicknameLS || userEmail.split("@")[0], // 닉네임 우선
        nickname: nicknameLS || "",
        avatarUrl: avatarUrlLS || "",
        profileImageRev: avatarRevLS || "",
        profileImageId: avatarIdLS ? Number(avatarIdLS) : null,
        rating: 0, // API로 덮어씌움
      });
    } else {
      navigate("/login");
    }
  }, [navigate]);

  /* 2) EditProfile 저장 직후 실시간 반영 (커스텀 이벤트) */
  useEffect(() => {
    const handler = (e) => {
      const { nickname, profileImageUrl, profileImageRev, profileImageId } = e.detail || {};
      setUser((prev) => {
        if (!prev) return prev;
        const nextName = nickname ?? prev.nickname ?? prev.name;
        return {
          ...prev,
          nickname: nickname ?? prev.nickname,
          name: nextName,
          avatarUrl: profileImageUrl ?? prev.avatarUrl,
          profileImageRev: profileImageRev ?? prev.profileImageRev,
          profileImageId: profileImageId != null ? profileImageId : prev.profileImageId,
        };
      });
    };
    window.addEventListener("user:profileUpdated", handler);
    return () => window.removeEventListener("user:profileUpdated", handler);
  }, []);

  /* 3) 다른 탭 동기화 (storage 이벤트) */
  useEffect(() => {
    const onStorage = (e) => {
      if (!["nickname", "profileImageUrl", "profileImageRev", "profileImageId"].includes(e.key)) return;
      setUser((prev) => {
        if (!prev) return prev;
        const nick = localStorage.getItem("nickname") || prev.nickname || "";
        const img  = localStorage.getItem("profileImageUrl") || prev.avatarUrl || "";
        const rev  = localStorage.getItem("profileImageRev") || prev.profileImageRev || "";
        const idLS = localStorage.getItem("profileImageId");
        const id   = idLS != null ? Number(idLS) : prev.profileImageId ?? null;
        return { ...prev, nickname: nick, name: nick || prev.name, avatarUrl: img, profileImageRev: rev, profileImageId: id };
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* 4) 서버에서 최신 프로필 조회해서 덮어쓰기 (항상 최신 유지) */
  useEffect(() => {
    if (!user?.email) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/user/info?email=${encodeURIComponent(user.email)}&_=${Date.now()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              ...getAuthHeaders(),
            },
            cache: "no-store",
          }
        );
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.message || `사용자 정보 조회 실패 (${res.status})`);

        const nextNick    = data?.nickname ?? "";
        const nextAvatar  = data?.profileImageUrl ?? data?.avatarUrl ?? ""; // 문자열 URL일 수도
        const nextImageId = extractImageId(data?.profileImageId ?? data?.imageId ?? data?.avatarImageId ?? nextAvatar);
        const nextRev     = String(Date.now()); // 새 조회 시 캐시버스터 갱신

        if (!alive) return;

        setUser((prev) => {
          if (!prev) return prev;
          const nextName = nextNick || prev.nickname || prev.name;
          return {
            ...prev,
            nickname: nextNick || prev.nickname || "",
            name: nextName,
            avatarUrl: nextAvatar || prev.avatarUrl || "",
            profileImageId: nextImageId != null ? nextImageId : (prev.profileImageId ?? null),
            profileImageRev: nextRev || prev.profileImageRev || "",
          };
        });

        // 캐시 갱신(다음 진입/다른 화면 반영용) — 빈값이면 정리
        localStorage.setItem("nickname", nextNick || "");
        if (typeof nextAvatar === "string") {
          if (nextAvatar) localStorage.setItem("profileImageUrl", nextAvatar);
          else localStorage.removeItem("profileImageUrl");
        }
        if (nextImageId != null) localStorage.setItem("profileImageId", String(nextImageId));
        else localStorage.removeItem("profileImageId");
        localStorage.setItem("profileImageRev", nextRev);
      } catch (err) {
        console.error("[user/info] API 오류:", err);
      }
    })();
    return () => { alive = false; };
  }, [user?.email]);

  /* 4-1) 이미지 ID가 있으면: GET /api/image/{id} → blob URL 생성 */
  useEffect(() => {
    const imageId = user?.profileImageId ?? extractImageId(user?.avatarUrl);
    if (!imageId) {
      // 이미지ID 없으면 기존 objectUrl 정리
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
      setAvatarObjectUrl("");
      return;
    }

    let cancelled = false;
    const fetchBlob = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/image/${imageId}`, {
          method: "GET",
          headers: { ...getAuthHeaders() },
        });
        if (!res.ok) throw new Error(`이미지 조회 실패 (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (!cancelled) {
          // 기존 URL 정리 후 교체
          if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
          setAvatarObjectUrl(url);
        }
      } catch (err) {
        console.error("[image:get] 오류:", err);
        if (!cancelled) {
          if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
          setAvatarObjectUrl("");
        }
      }
    };
    fetchBlob();
    return () => { cancelled = true; };
  }, [user?.profileImageId, user?.avatarUrl]); // id나 url이 바뀌면 다시 시도

  // 컴포넌트 언마운트 시 blob URL 정리(누수 방지)
  useEffect(() => {
    return () => { if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl); };
  }, [avatarObjectUrl]);

  /* 5) 평균 평점 API 연결 */
  useEffect(() => {
    const fetchRating = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`${BASE_URL}/api/activity/review/rating`, {
          method: "GET",
          headers: {
            "X-User-Id": String(user.id),
            ...getAuthHeaders(),
          },
        });
        if (!res.ok) throw new Error(`평균 평점 조회 실패 (${res.status})`);

        const data = await safeJson(res);

        let avg = 0;
        if (Array.isArray(data)) {
          const ratings = data.map((r) => Number(r?.rating)).filter((n) => Number.isFinite(n));
          avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        } else if (typeof data === "number" && Number.isFinite(data)) {
          avg = data;
        } else {
          avg = 0;
        }

        setUser((prev) => (prev ? { ...prev, rating: avg } : prev));
      } catch (err) {
        console.error("[rating] API 오류:", err);
      }
    };
    fetchRating();
  }, [user?.id]);

  /* --- 표시용 파생값 --- */
  const email = user?.email || "email@example.com";
  const nickname = user?.nickname || localStorage.getItem("nickname") || "";
  const rawName = user?.name || ""; // 이름(없으면 이메일 prefix)
  const titleName = rawName || (email ? email.split("@")[0] : "사용자"); // 큰 제목은 이름 우선
  const showNicknameLine = nickname && nickname !== titleName;

  // 우선순위: blob ObjectURL > HTTP URL(+rev)
  const imgRev = user?.profileImageRev || localStorage.getItem("profileImageRev") || "";
  const httpBaseRaw = user?.avatarUrl || localStorage.getItem("profileImageUrl") || "";
  const httpBaseAbs = absoluteUrl(BASE_URL, httpBaseRaw);
  const httpUrl = (httpBaseAbs && imgRev && shouldAppendRev(httpBaseAbs))
    ? `${httpBaseAbs}${httpBaseAbs.includes("?") ? "&" : "?"}_=${encodeURIComponent(imgRev)}`
    : httpBaseAbs;

  const finalAvatarSrc = avatarObjectUrl || httpUrl;
  const initial = useMemo(() => (titleName ? titleName[0] : "U"), [titleName]);

  const rating = typeof user?.rating === "number" ? user.rating : 0;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  /* 로그아웃 */
  const handleLogout = () => {
    const confirmLogout = window.confirm("정말 로그아웃 하시겠습니까?");
    if (!confirmLogout) return;
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("Token");
      localStorage.removeItem("userId");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("tokenExpiration");
      localStorage.removeItem("nickname");
      localStorage.removeItem("profileImageUrl");
      localStorage.removeItem("profileImageRev");
      localStorage.removeItem("profileImageId");
      navigate("/login");
      window.location.reload();
    } catch (error) {
      console.error("로그아웃 처리 중 오류:", error);
      navigate("/login");
    }
  };

  /* 메뉴 라우팅 */
  const handleMenuClick = (key) => {
    switch (key) {
      case "bookmarks": navigate("/bookmarks"); break;
      case "subscriptions": navigate("/subscribes"); break;
      case "joined": navigate("/joined"); break;
      case "uploaded": navigate("/my-upload-event"); break;
      default: onPageChange?.(key); break;
    }
  };

  /* 로딩 */
  if (!user) {
    return (
      <Layout pageTitle="마이페이지" activeMenuItem="mypage">
        <div className="mypage-page">
          <div className="mypage-loading"><p>사용자 정보를 불러오는 중...</p></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle="마이페이지" activeMenuItem="mypage">
      <div className="mypage-page">
        <main className="mypage-main">
          <div className="mypage-wrapper">
            {/* 상단 요약 카드 */}
            <section className="profile-summary-card" aria-label="프로필 요약">
              <div className="profile-summary-left">
                {finalAvatarSrc ? (
                  <img
                    key={finalAvatarSrc} // 소스 변경 시 강제 리렌더
                    className="profile-avatar-image"
                    src={finalAvatarSrc}
                    alt={`${titleName} 프로필`}
                  />
                ) : (
                  <div className="profile-avatar" aria-hidden="true">{initial}</div>
                )}

                <div className="profile-meta">
                  <h2 className="profile-name">{titleName}</h2>
                  {showNicknameLine && <span className="profile-nickname">{nickname}</span>}
                  <p className="profile-email">{email}</p>

                  {/* ⭐ 평균 별점만 표시 */}
                  {rating > 0 ? (
                    <div className="profile-rating compact" aria-label={`평점 ${rating.toFixed(1)}점`}>
                      <div className="rating-stars" aria-hidden="true">
                        {Array.from({ length: full }).map((_, i) => <span key={`f${i}`} className="star full">★</span>)}
                        {hasHalf && <span className="star half">★</span>}
                        {Array.from({ length: empty }).map((_, i) => <span key={`e${i}`} className="star empty">★</span>)}
                      </div>
                      <span className="rating-value">{rating.toFixed(1)}</span>
                    </div>
                  ) : (
                    <div className="profile-rating compact" aria-label="평점 정보 없음">
                      <span className="rating-empty">평점 없음</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 우측 정보 수정 버튼 */}
              <div className="profile-actions">
                <button className="profile-edit-button" onClick={() => navigate("/mypage/edit")}>
                  📝 프로필 수정
                </button>
              </div>
            </section>

            {/* 데스크톱 타일 */}
            <section className="desktop-tile-grid" role="list">
              {MENU_ITEMS.map((m) => (
                <button key={m.key} className="tile-button" onClick={() => handleMenuClick(m.key)}>
                  <div
                    className={`tile-icon ${
                      m.key === "bookmarks" ? "tile-icon-bookmark"
                      : m.key === "subscriptions" ? "tile-icon-subscription"
                      : "tile-icon-upload"
                    }`}
                  >
                    {m.icon}
                  </div>
                  <div className="tile-text">
                    <strong>{m.title}</strong>
                    <span>{m.desc}</span>
                  </div>
                </button>
              ))}
            </section>

            {/* 모바일 리스트 */}
            <section className="mobile-list-card">
              {MENU_ITEMS.map((m, idx) => (
                <button key={m.key} className="mobile-list-row" onClick={() => handleMenuClick(m.key)}>
                  <div
                    className={`mobile-list-icon ${
                      m.key === "bookmarks" ? "list-icon-bookmark"
                      : m.key === "subscriptions" ? "list-icon-subscription"
                      : "list-icon-upload"
                    }`}
                  >
                    {m.icon}
                  </div>
                  <div className="mobile-list-text">
                    <p className="mobile-list-title">{m.title}</p>
                    <p className="mobile-list-description">{m.desc}</p>
                  </div>
                  <span className="mobile-list-chevron" aria-hidden="true">›</span>
                  {idx < MENU_ITEMS.length - 1 && <div className="mobile-list-divider" />}
                </button>
              ))}
            </section>

            {/* 로그아웃 */}
            <section className="logout-section" aria-label="로그아웃">
              <button className="logout-button" onClick={handleLogout}>↪ 로그아웃</button>
            </section>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default MyPage;
