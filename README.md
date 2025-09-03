# Eventory Frontend - 맞춤형 행사 추천 서비스

## 📋 프로젝트 개요
Eventory Frontend는 React 기반의 위치 기반 맞춤형 행사 추천 서비스 웹 애플리케이션입니다. 사용자 친화적인 UI/UX를 통해 행사 검색, 등록, 관리, 리뷰 시스템 등 종합적인 행사 관리 기능을 제공합니다.

## 🎨 주요 페이지 및 기능

### 🏠 메인 페이지 (`/`)
- **적극 추천 행사**: 
  -  AI 기반 개인화 추천

- **우리동네 인기 행사**:
  - `대구문화예술진흥원` 공연_전시 API 기반 인기 행사 표시
  - 사용자 행사 업로드 표시

### 📝 행사 등록 시스템 (`/event-upload`)
- **다단계 폼 시스템**: 기본 정보 → 상세 정보 → 위치 정보 단계별 진행
- **위치 기반 서비스**:
  - 카카오 맵 API 연동
  - 장소 검색 및 지도 마커 표시
  - GPS 위치 기반 현재 위치 확인
  - **동네 검증 시스템**: 사용자 거주지 vs 행사 위치 같은 동 확인
- **고급 마크다운 에디터**: 
  - 실시간 편집/미리보기 모드 전환
  - 툴바: Bold, Italic, Code, Quote, List, Link, Image 지원
  - Ctrl+B, Ctrl+I, Ctrl+K 키보드 단축키 지원
  - 커스텀 마크다운 → HTML 변환 엔진
- **커스텀 UI 컴포넌트**:
  - 스크롤 가능한 시간 선택기 (시/분 별도 선택)
  - 드래그 앤 드롭 이미지 다중 업로드 및 미리보기
  - 해시태그 시스템 (최대 10개, IME 조합 처리)
- **QR 코드 자동 생성**:
  - 행사 등록 완료 시 참여용 QR 코드 자동 생성
  - QR 이미지 다운로드 및 Web Share API 네이티브 공유
  - 모달 UI로 QR 코드 표시 및 관리

### ✏️ 행사 수정 페이지 (`/event-edit/:eventId`)
- **기존 데이터 로드**: URL 파라미터로 행사 ID 받아 데이터 자동 로드
- **마크다운 에디터**: 고급 에디터 툴바와 실시간 미리보기
- **이미지 관리**: 기존 이미지 유지/삭제/추가 기능

### 👤 마이페이지 시스템 (`/mypage`)
- **통합 대시보드**:
  - 프로필 요약 카드 (모바일 전용)
  - 받은 평점 시각화 (5점 만점 별점 시스템)
  - 호스트 리뷰 AI 요약 표시
- **활동 관리**:
  - 최근 북마크한 행사 목록
  - 등록한 행사 관리
  - 참여한 행사 히스토리
- **반응형 레이아웃**: 모바일/데스크톱 구분된 UI 컴포넌트

### 📱 개인 행사 관리 (`/my-upload-event`)
- **무한 스크롤**: Intersection Observer 기반 페이지네이션
- **행사 카드 시스템**: 
  - 썸네일 이미지, 제목, 날짜/시간 정보 표시
  - 커스텀 마크다운 → HTML 변환 렌더링
  - 리뷰 모달 연동 (별점, 댓글 표시)
- **JWT 인증**: localStorage 기반 토큰 검증 및 자동 갱신
- **상태 관리**: 로딩, 에러, 빈 상태 UI 처리

### 🔧 프로필 관리 (`/mypage/edit`)
- **라이브 미리보기**: 상단 그라데이션 배너와 아바타 실시간 반영
- **이미지 시스템**: 프로필 사진 업로드, 변경, 삭제 기능
- **폼 검증**: 실시간 유효성 검사 및 에러 메시지
- **그리드 레이아웃**: 720px 기준 반응형 2열 레이아웃

### 🗺️ 위치 설정 (`/location`)
- **GPS 통합**: HTML5 Geolocation API 활용 현재 위치 검색
- **카카오 지도 서비스**:
  - Places API로 동네 검색 및 자동완성
  - Geocoder API로 주소 ↔ 좌표 변환  
  - 10km 반경 원형 영역 시각화
  - 커스텀 마커 및 오버레이 표시

### 🔍 검색 시스템 (`/search`)
- **실시간 검색**: 500ms 디바운싱으로 자동 검색
- **필터링**: 카테고리, 날짜, 지역 등 다중 필터 지원
- **검색 UI**: Search 아이콘, 클리어 버튼, 필터 토글
- **결과 표시**: 카드 형태로 검색 결과 렌더링

### ⭐ 리뷰 및 평점 시스템
- **별점 시스템**: 1~5점 별점 입력 및 평균 점수 계산
- **리뷰 CRUD**: 텍스트 리뷰 작성, 수정, 삭제 기능
- **호스트 평가**: 행사 주최자에 대한 평점 및 후기 시스템  
- **AI 리뷰 요약**: 다수 리뷰를 AI가 한 줄로 요약하여 표시
- **리뷰 모달**: 행사별 리뷰 목록 모달 창으로 표시

### 📚 북마크 & 구독 시스템
- **북마크 관리** (`/bookmarks`):
  - 관심 행사 즐겨찾기 토글 기능
  - 리스트/지도 뷰 전환 가능
  - 카테고리별 필터링 지원
- **구독 시스템** (`/subscribe`, `/subscribes`):
  - 관심 주최자 구독/구독해제
  - 구독한 주최자의 새 행사 알림
  - 구독자 수 실시간 표시

### 🎫 참여 및 체크인
- **참여 행사** (`/joined`): 사용자가 참여한 행사 목록 관리
- **QR 체크인** (`/join`): QR 코드 스캔을 통한 행사 체크인 시스템

### 📧 사용자 인증
- **로그인/회원가입** (`/login`, `/signup`): JWT 토큰 기반 인증
- **이메일 인증** (`/email-verification`): 회원가입 시 이메일 검증 절차

### 📋 행사 상세 정보
- **행사 상세** (`/events/:id`): 행사 정보, 참여자, 리뷰 등 종합 정보
- **호스트 상세** (`/host/:id`): 주최자 프로필, 개최 행사 목록
- **전체 행사** (`/event-all`): 대구 지역 행사 및 사용자 업로드 행사 조회, 진행 날짜 및 거리순 필터링

## 🛠️ 기술 스택

### 핵심 프레임워워크
- **React**: 18.x (함수형 컴포넌트, Hooks)
- **React Router**: 7.7.1 (클라이언트 사이드 라우팅)
- **Create React App**: 5.0.1 (프로젝트 부트스트래핑)

### 상태 관리 및 API
- **React Hooks**: useState, useEffect, useCallback, useMemo 기반 상태 관리
- **Axios**: 1.x HTTP 클라이언트 
- **LocalStorage**: JWT 토큰 및 사용자 정보 클라이언트 저장

### UI/UX 라이브러리
- **Lucide React**: 모던 아이콘 라이브러리 (ArrowLeft, Search, X, Heart 등)
- **Custom CSS**: CSS Variables 기반 일관된 디자인 시스템
- **Pretendard**: 한국어 최적화 웹폰트

### 지도 및 외부 서비스  
- **카카오 맵 API**: 
  - 지도 표시 및 장소 검색 (`dapi.kakao.com/v2/maps/sdk.js`)
  - Places API, Geocoder API 활용
- **HTML5 Geolocation**: GPS 기반 현재 위치 확인

### 에디터 및 렌더링
- **커스텀 마크다운 에디터**: 
  - 실시간 편집/미리보기 토글
  - 커스텀 툴바 (Bold, Italic, Code, Quote, List, Link, Image)
  - 키보드 단축키 (Ctrl+B, Ctrl+I, Ctrl+K)
- **마크다운 파서**: 자체 구현 정규표현식 기반 MD→HTML 변환
- **HTML 렌더링**: dangerouslySetInnerHTML을 통한 안전한 HTML 렌더링

### 폼 및 UI 컴포넌트
- **커스텀 폼 컴포넌트**: 
  - 시간 선택기 (스크롤 가능한 시/분 선택)
  - 파일 업로드 (드래그 앤 드롭, 다중 이미지)
  - 해시태그 입력 (IME 조합 상태 처리)
- **실시간 검증**: 클라이언트 사이드 폼 유효성 검사
- **모달 시스템**: QR 코드, 리뷰 등 다양한 모달 컴포넌트

### 성능 최적화
- **무한 스크롤**: Intersection Observer API 기반 페이지네이션
- **디바운싱**: 검색 입력 500ms 지연 처리
- **메모이제이션**: useCallback, useMemo로 불필요한 리렌더링 방지
- **이미지 최적화**: WebP 포맷 우선, lazy loading


## 🚀 핵심 컴포넌트

### Layout 시스템
- **반응형 레이아웃**: windowWidth 기반 PC/Tablet/Mobile 구분
- **TopBar**: 상단 고정 헤더
- **Sidebar**: PC/Tablet용 사이드 네비게이션
- **BottomBar**: 모바일용 하단 탭 네비게이션

### 마크다운 에디터
- **이중 뷰**: 편집 모드 ↔ 미리보기 모드 토글
- **툴바 버튼**: Bold, Italic, Code, Quote, List, Link, Image
- **키보드 지원**: Ctrl+B (굵게), Ctrl+I (기울임), Ctrl+K (링크)
- **구문 변환**: 정규표현식 기반 MD → HTML 실시간 변환

### 카카오 맵 통합
- **SDK 로드**: 중복 로드 방지 및 에러 핸들링
- **Places 검색**: 키워드 기반 장소 검색 (size: 10)
- **Geocoder**: 주소 ↔ 좌표 양방향 변환
- **마커 시스템**: 커스텀 오버레이 및 애니메이션 마커

### QR 코드 시스템  
- **자동 생성**: 행사 등록 완료 시 서버 API 호출
- **이미지 처리**: Blob → Object URL 변환
- **공유 기능**: Web Share API + 파일 공유 지원
- **다운로드**: 프로그래매틱 다운로드 링크 생성

### 무한 스크롤 구현
- **스크롤 감지**: document scroll 이벤트 리스너
- **임계점 계산**: scrollHeight - clientHeight - 100px
- **페이지네이션**: page 상태 기반 API 호출
- **로딩 상태**: 스켈레톤 UI 및 로딩 스피너


## ⚙️ 실행 조건

### 필수 요구사항
- **Node.js**: 16.x 이상
- **npm**: 8.x 이상  
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+

### 실행 방법

#### 개발 환경
```bash
# 의존성 설치
npm install

# 개발 서버 시작  
npm start
# → http://localhost:3000에서 자동 실행
```

#### 프로덕션 빌드
```bash
# 프로덕션 빌드
npm run build

# 정적 서버로 실행 (옵션)
npx serve -s build
```

## 📦 주요 의존성

### 프로덕션 의존성
```json
{
  "react": "^18.x",
  "react-dom": "^18.x", 
  "react-router-dom": "^7.7.1",
  "axios": "^1.x",
  "lucide-react": "latest"
}
```

### 개발 의존성  
```json
{
  "react-scripts": "5.0.1",
  "tailwindcss": "^3.x",
  "@testing-library/react": "^13.x",
  "web-vitals": "^3.x"
}
```

## 🔧 브라우저 지원
- **Chrome**: 90+ ✅  
- **Firefox**: 88+ ✅
- **Safari**: 14+ ✅
- **Edge**: 90+ ✅
- **Mobile Safari**: iOS 14+ ✅
- **Chrome Mobile**: Android 10+ ✅



## 📄 라이선스
This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 지원
문의사항이나 버그 리포트는 Issues 탭을 통해 제출해 주세요.
