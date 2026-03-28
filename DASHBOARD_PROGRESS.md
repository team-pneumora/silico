# Silico Dashboard — 작업 진행 상황

> 마지막 작업: 2026-03-25
> 상태: D1~D3 완료, D4 진행 중

---

## 완료된 작업

### D1: 프로젝트 초기화 ✅
- `silico-dashboard/` Next.js 15 프로젝트 생성
- 패키지 설치: @supabase/supabase-js, @supabase/ssr, recharts
- shadcn/ui 초기화 + 컴포넌트 추가 (card, badge, separator, avatar, scroll-area, input, label, tabs)

### D2: Supabase 클라이언트 + 타입 ✅
- `src/lib/supabase/client.ts` — 브라우저 클라이언트
- `src/lib/supabase/server.ts` — 서버 컴포넌트 클라이언트
- `src/lib/supabase/middleware.ts` — 인증 미들웨어 헬퍼
- `src/types/database.ts` — 10개 엔티티 타입 정의

### D3: 인증 ✅
- `src/middleware.ts` — /dashboard/* 보호
- `src/app/login/page.tsx` — Magic Link 로그인
- `src/app/login/actions.ts` — signIn, signOut 서버 액션
- `src/app/auth/callback/route.ts` — OAuth 콜백

### D4: 대시보드 레이아웃 (부분 완료)
- `src/app/layout.tsx` — 루트 레이아웃 (다크 테마) ✅
- `src/app/page.tsx` — 랜딩 페이지 ✅
- `src/app/dashboard/layout.tsx` — 사이드바 + 회사 목록 ✅

---

## 남은 작업

### D4: 대시보드 컴포넌트 (에이전트가 생성 중이었음 — 확인 필요)

아래 파일들 생성 완료 ✅ (에이전트 작업 완료됨):
- [x] `src/components/dashboard/CompanyHeader.tsx`
- [x] `src/components/dashboard/MetricCards.tsx`
- [x] `src/components/dashboard/AgentChat.tsx`
- [x] `src/components/dashboard/OpenPositions.tsx`
- [x] `src/components/dashboard/ActivityTimeline.tsx`
- [x] `src/components/dashboard/PnlChart.tsx`
- [x] `src/components/dashboard/CompanyList.tsx`
- [x] `src/lib/hooks/useMessages.ts`
- [x] `src/lib/hooks/usePositions.ts`
- [x] `src/lib/hooks/useTimeline.ts`

### D4: 페이지 조립

생성 필요:
- [ ] `src/app/dashboard/page.tsx` — 회사 목록 페이지
- [ ] `src/app/dashboard/[companyId]/page.tsx` — 회사 모니터링 (메인 대시보드)
- [ ] `src/app/dashboard/new/page.tsx` — 새 회사 생성

### D5: 빌드 검증
- [ ] `pnpm build` 통과 확인
- [ ] 로컬 `pnpm dev`로 UI 확인

### D6: GitHub 레포 + 배포
- [ ] `silico-dashboard` GitHub 레포 생성
- [ ] 첫 커밋 + 푸시
- [ ] `.env.local` 설정 (SUPABASE_URL, SUPABASE_ANON_KEY)

---

## 환경 설정

silico-dashboard/.env.local에 넣어야 할 값:
```
NEXT_PUBLIC_SUPABASE_URL=<silico 백엔드와 동일한 Supabase URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon key>
```

---

## 재개 시 명령어

```
"DASHBOARD_PROGRESS.md를 읽고 남은 작업부터 이어서 진행해줘"
```
