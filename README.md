# Back2U 프론트엔드

대학 분실물 AI 매칭 서비스의 모바일 중심 프론트엔드 시안입니다. 자연어·사진을 이용한 AI 매칭 흐름과, 사용자가 목록에서 직접 물건을 찾는 흐름을 함께 제공합니다. Next.js App Router, Tailwind CSS, Zustand로 구성했습니다.

## 실행

Node.js 20 이상과 pnpm을 준비한 뒤 저장소를 복제하고 실행합니다.

```bash
git clone https://github.com/glocal-macaron/Back2U.git
cd Back2U
pnpm install
pnpm dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다. `pnpm build`로 프로덕션 빌드를 확인할 수 있습니다.
개발 서버와 프로덕션 빌드는 각각 `.next-dev`, `.next` 폴더를 사용하므로 빌드 중 열린 개발 화면의 청크가 교체되지 않습니다.

## Backend (FastAPI + AI)

Python 3.13 기준이며 저장소 루트(`Back2U/`)에서 실행합니다. 프론트엔드(3000)와 백엔드(8000)를 터미널 두 개에서 각각 띄웁니다.

1. `.env.example`을 `.env`로 복사하고 `AI_*` 값을 채웁니다. `.env`는 Git에서 제외됩니다.
2. 의존성 설치와 실행:

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000   # 터미널 1
pnpm dev                                         # 터미널 2
```

- Swagger: `http://localhost:8000/docs`, 상태 확인: `http://localhost:8000/health` (`ai_mode`, `persistence` 표시)
- 프론트엔드는 `NEXT_PUBLIC_API_BASE_URL`(비우면 `http://localhost:8000`)로 백엔드를 호출합니다. 3000이 아닌 포트로 뜨면 백엔드 `CORS_ORIGINS`에 그 주소를 추가하세요.
- AI 단독 테스트: `python -m ai.test_ai [이미지경로 ...]`. API 호출 없이 확인하려면 `AI_MOCK_MODE=true`.
- 단위 테스트(AI·Supabase 호출 없음): `python -m unittest ai.test_matcher backend.test_verification backend.test_catalog_claims`

### 저장 방식 (`PERSISTENCE_MODE`)

- `memory`(기본): 설정 없이 바로 동작하지만 백엔드를 재시작하면 등록한 물건이 사라지고, 습득물 사진은 등록한 브라우저 세션에서만 보입니다.
- `supabase`: 물건은 Supabase `items` 테이블, 습득물 사진은 private bucket `found-items`에 영구 저장됩니다. 사진은 백엔드가 만든 1시간짜리 Signed URL로만 내려갑니다.

Supabase를 쓰려면 프로젝트당 한 번만 아래를 수행합니다.

1. Supabase Dashboard > SQL Editor에서 [`001_create_items.sql`](./supabase/migrations/001_create_items.sql), [`002_add_ownership_verification.sql`](./supabase/migrations/002_add_ownership_verification.sql)을 순서대로 실행합니다. (`items` 테이블, RLS, private bucket, 소유 확인 컬럼. 재실행해도 안전)
2. Project Settings > API에서 Project URL과 service_role 키(또는 `sb_secret_...` secret 키)를 확인합니다.
3. `.env`에 `PERSISTENCE_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 채우고 백엔드를 재시작합니다. `/health`의 `persistence`가 `supabase`이면 연결된 것입니다.

service_role/secret 키는 백엔드 전용입니다. `NEXT_PUBLIC_` 변수로 만들거나 채팅·GitHub에 올리지 마세요. 현장에서 Supabase에 문제가 생기면 `PERSISTENCE_MODE=memory`로 바꿔 재시작하면 됩니다.

## 카카오 로그인 설정

홈 상단의 **카카오 로그인**은 Kakao OAuth 인증 코드 방식으로 작동합니다. Back2U의 별도 회원가입 화면은 없습니다. 현재 저장소에는 카카오 앱 키가 포함되어 있지 않으므로, 각 개발자는 다음을 설정해야 실제 로그인을 사용할 수 있습니다.

1. [Kakao Developers](https://developers.kakao.com/)에서 앱을 만들고 카카오 로그인을 활성화합니다.
2. Redirect URI에 `http://localhost:3000/api/auth/kakao/callback`을 정확히 등록합니다.
3. REST API 키와 Client Secret을 확인합니다. JavaScript 키와 혼동하지 마세요.
4. `.env.example`을 `.env.local`로 복사하고 `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`, `KAKAO_SESSION_SECRET`을 채웁니다. 마지막 값은 임의의 32자 이상 비밀 문자열을 사용합니다.
5. 개발 서버를 다시 시작합니다. 운영 배포 시에는 HTTPS 도메인의 Callback URI를 추가 등록하고 배포 환경 변수의 `KAKAO_REDIRECT_URI`를 해당 주소로 설정합니다.

키와 비밀값을 채팅이나 GitHub에 올리지 마세요. `.env.local`은 Git에서 제외됩니다. 키가 없으면 로그인 버튼을 누를 때 설정 안내가 표시됩니다. 로그인 후에는 카카오 닉네임을 표시하고, 로그아웃 시 Back2U의 세션 쿠키를 삭제합니다. 현재 세션은 서명된 쿠키 기반이며 서버 데이터베이스에 사용자 프로필을 저장하지 않습니다.

## 화면

- `/`: 분실 등록과 습득 등록 진입
- `/items`: 습득물·분실물 목록, 키워드 검색, 품목별 필터
- `/items/[id]`: 등록된 물건 상세 정보 (`found-wallet`은 별도 시연 경로)
- `/lost`: 자연어 설명 입력 → 실제 AI 분석 후 등록
- `/found`: 사진·습득 장소·시간 입력 → 실제 Vision 분석 후 등록
- `/waiting`: 매칭 대기, 시연용 교내 광고 배너, 선택형 광고 시청과 데모 노출 부스트
- `/match/[id]`: 등록 물건 ID 기준 실제 의미 기반 매칭 점수, 사진 비교, 근거 막대그래프

`/lost`, `/found`, `/match/[id]`는 백엔드 API와 실제 AI로 동작합니다. 데모 흐름은 `/lost` 등록 → `/found` 등록 → `/match/{습득물 ID}`입니다. `/items` 목록과 상세는 백엔드에 등록된 데이터를 읽습니다. `/waiting`의 건국대학교 카페 레스티오 광고는 시연용 시안이며 실제 제휴나 할인 혜택을 뜻하지 않습니다. 광고 시청 후 표시되는 노출 부스트도 실제 푸시 알림을 보내지 않습니다. 클라이언트 등록 상태는 `src/store/use-registration-store.ts`에 모았습니다.

소유 확인: 분실 등록 때 선택적으로 '소유 확인 질문'과 '비공개 정답'을 입력하면, `/match/[id]`에서 질문에 답해 소유를 확인할 수 있습니다. 정답은 서버에서 salt + SHA-256 해시로만 저장·판정되며 어떤 API 응답에도 포함되지 않고, 확인 상태는 해당 분실물·습득물 쌍에만 저장됩니다. 시도 횟수 제한과 연락처 연결·수령 안내는 아직 구현되지 않았습니다.

별도 시연 경로 `/items/found-wallet`에는 수동 클레임 퀴즈가 있습니다. 프론트는 `GET /api/v1/catalog-claims/found-wallet`로 문제와 선택지를 받고, `POST /api/v1/catalog-claims/found-wallet/verify`로 선택한 답을 보냅니다. 정답 판정과 보관 장소 응답은 백엔드에서 처리하며, 오답에는 장소를 내려주지 않습니다. 이 샘플 퀴즈는 로그인 사용자나 실제 등록 물건과 연결되지 않고 확인 상태도 DB에 저장하지 않으므로, 실제 수령 권한으로 사용하면 안 됩니다. 실제 등록 물건의 소유 확인은 `/api/v1/items/verify`를 사용합니다.

## 코드 위치와 협업

- `src/app`: 화면과 경로. 등록 흐름은 `/lost`, `/found`, `/waiting`, `/match/[id]`에 있습니다.
- `src/components`: 공통 UI와 광고 시안 컴포넌트.
- `src/lib`: 백엔드 API 클라이언트(`api.ts`)와 목록 시연 데이터.
- `src/store`: Zustand의 클라이언트 등록 상태.
- `public`: 화면 시연용 이미지.
- [팀원 공유용 기획·개발 가이드](./Back2U_해커톤_팀원공유용_가이드.md): 역할, API 명세, MVP 범위.

- `backend`: FastAPI(`/api/v1/items/lost`, `/api/v1/items/found`, `/api/v1/items/match/{item_id}`)와 memory/Supabase 저장소.
- `ai`: 텍스트·Vision 특징 추출과 의미 기반 매칭.
- `supabase/migrations`: Supabase SQL.

각자 최신 `main`에서 작업 브랜치를 만들고, 기능 단위로 커밋한 뒤 Pull Request로 합치는 방식을 권장합니다. 실행에 필요한 비밀값은 저장소에 커밋하지 말고 환경 변수로 관리하세요.
