# Silico — Company & Agent Management Design

> 회사 생성, 관리, 직원(에이전트) 관리 전체 설계

---

## 1. 회사 생성 플로우

### 1.1 회사 유형 프리셋

사용자가 선택할 수 있는 대표 유형 4개 + 커스텀:

| 유형 | 설명 | 기본 에이전트 | 기본 도구 | 시드머니 용도 |
|------|------|-------------|----------|-------------|
| **Trading Firm** | AI 트레이딩 회사 | CEO + Trader | exchange, web_search | Bybit 선물 트레이딩 |
| **SaaS Startup** | 디지털 프로덕트 빌더 | CEO + Developer | github, vercel, web_search | 도메인, 호스팅, 서비스 |
| **Content Agency** | 콘텐츠/마케팅 회사 | CEO + Marketer | web_search, gmail, notion | 마케팅, 광고 |
| **Full-Stack Company** | 종합 AI 스타트업 | CEO + Developer + Trader | 전부 | 트레이딩 + 프로덕트 |
| **Custom** | AI 대화형 설정 | 사용자 정의 | 사용자 정의 | 사용자 정의 |

### 1.2 생성 페이지 UI 플로우

```
Step 1: 회사 유형 선택
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 📈       │ │ 💻       │ │ 📝       │ │ 🏢       │ │ ✨       │
│ Trading  │ │ SaaS     │ │ Content  │ │ Full     │ │ Custom   │
│ Firm     │ │ Startup  │ │ Agency   │ │ Stack    │ │          │
│          │ │          │ │          │ │          │ │ AI가 도움│
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

Step 2: 기본 설정
├── 시드머니 ($10 ~ $10,000)
├── Exchange 연동 (선택)
│   ├── Bybit Testnet / Live 토글
│   ├── API Key
│   └── API Secret
└── 추가 도구 활성화 (체크박스)
    ├── ☑ Web Search
    ├── ☐ GitHub
    ├── ☐ Vercel
    ├── ☐ Notion
    ├── ☐ Gmail
    ├── ☐ Google Calendar
    └── ☐ + Custom MCP Server

Step 3: 확인 + 생성
├── CEO AI가 회사 이름/미션 자동 생성
├── 선택한 에이전트 자동 배치
└── "Launch Company" 버튼
```

### 1.3 커스텀 모드 (v2 — AI 대화형)

```
사용자: "AI 아트 생성해서 NFT로 파는 회사 만들어줘"
AI: 회사 유형을 분석했습니다:
    - 회사명 제안: ArtForge AI
    - 에이전트 구성: CEO, Artist(Stable Diffusion 연동), Marketer
    - 도구: web_search, notion, 커스텀 MCP(이미지 생성)
    - 시드머니 추천: $200
    이대로 생성할까요?
```

MVP에서는 프리셋 4개만 구현. 커스텀은 Phase 2.

---

## 2. 회사 관리

### 2.1 회사 상태

```
active    ──── 라운드 자동 실행 중 (▶ 재생 상태)
paused    ──── 일시정지 (⏸ 라운드 실행 안 함, 데이터 유지)
archived  ──── 아카이브 (📦 읽기 전용, 복원 가능)
deleted   ──── 삭제 (🗑 소프트 삭제, 30일 후 영구 삭제)
```

### 2.2 회사 대시보드 상단 컨트롤

```
┌─────────────────────────────────────────────────────────┐
│ 🧬 Synthetiq          ▶⏸  active        Round 7       │
│                        ⚙️  🗑️                          │
│ Mission: To democratize AI creativity...               │
├─────────────────────────────────────────────────────────┤
│ [▶ Resume] [⏸ Pause] [📦 Archive] [🗑 Delete]         │
└─────────────────────────────────────────────────────────┘
```

### 2.3 회사 설정 페이지 (`/dashboard/[id]/settings`)

```
General
├── 회사 이름 (수정 가능)
├── 미션 (수정 가능)
├── 상태: active / paused / archived
├── 라운드 간격: 30min / 1hr / 2hr / 6hr / 24hr
└── 최대 일일 라운드 수

Exchange
├── 연동 상태: ✅ Connected / ❌ Not connected
├── 네트워크: Testnet ⇄ Live 토글
├── API Key: ****...0KEw [변경]
├── API Secret: ****...zOYJ [변경]
└── 잔고: $10,000 USDT (실시간)

Tools (MCP)
├── ☑ Web Search        (기본)
├── ☑ Exchange - Bybit   [설정]
├── ☐ GitHub             [연결]
├── ☐ Vercel             [연결]
├── ☐ Notion             [연결]
├── ☐ Gmail              [연결]
├── ☐ Google Calendar    [연결]
└── + Add Custom MCP Server
    ├── Name: ___
    ├── URL: ___
    └── Auth Token: ___

Danger Zone
├── [📦 Archive Company] — 읽기 전용으로 전환
└── [🗑 Delete Company]  — 30일 후 영구 삭제
```

---

## 3. 직원(에이전트) 관리

### 3.1 직원 목록 UI (`/dashboard/[id]/team`)

```
┌─────────────────────────────────────────────────────────┐
│ 👥 Team                                [+ Hire Agent]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ C  CEO      │  │ D  Developer│  │ +            │    │
│  │ Alice       │  │ Bob         │  │ Hire New     │    │
│  │ ● active    │  │ ● active    │  │ Agent        │    │
│  │ sonnet 4    │  │ sonnet 4    │  │              │    │
│  │ Order: 0    │  │ Order: 10   │  │              │    │
│  │ [Edit][Fire]│  │ [Edit][Fire]│  │              │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 직원 추가 (Hire Agent)

```
┌─────────────────────────────────────────┐
│ Hire New Agent                          │
├─────────────────────────────────────────┤
│                                         │
│ Role Template:                          │
│ ┌────────┐ ┌────────┐ ┌────────┐       │
│ │Developer│ │ Trader │ │Marketer│ ...   │
│ └────────┘ └────────┘ └────────┘       │
│ ☐ Custom Role: ___________              │
│                                         │
│ Name: _______________                   │
│                                         │
│ Model:                                  │
│ ○ Claude Sonnet 4  (빠름, 저렴)         │
│ ○ Claude Opus 4    (강력, 비쌈)         │
│ ○ Claude Haiku 4.5 (초고속, 최저가)     │
│                                         │
│ Personality / Instructions:             │
│ ┌─────────────────────────────────────┐ │
│ │ e.g. "공격적인 트레이더. 기술적     │ │
│ │ 분석에 강하고 단기 트레이딩 선호.   │ │
│ │ 리스크 허용 범위가 높다."           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Execution Order: [15] (낮을수록 먼저)   │
│                                         │
│ Tools:                                  │
│ ☑ Web Search                            │
│ ☑ Exchange (read-only / read-write)     │
│ ☐ GitHub                                │
│ ☐ Vercel                                │
│ ☐ Custom MCP...                         │
│                                         │
│ System Prompt: (자동 생성 / 직접 편집)  │
│ ┌─────────────────────────────────────┐ │
│ │ # Role: Trader                      │ │
│ │ You are an aggressive day trader... │ │
│ │ (auto-generated from template +     │ │
│ │  personality)                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│        [Cancel]  [Hire Agent]           │
└─────────────────────────────────────────┘
```

### 3.3 직원 편집

Hire와 동일한 폼이지만:
- 이름, 모델, 페르소나, 도구, 시스템 프롬프트 수정 가능
- Role은 변경 불가 (새로 고용해야 함)

### 3.4 직원 해고 (Fire)

```
"Are you sure you want to fire Bob (Developer)?
 This agent will be deactivated and won't participate in future rounds.
 Past actions and messages will be preserved."

[Cancel] [Fire Agent]
```

→ agents.status = 'fired' (소프트 삭제)
→ 해고 메시지가 company messages에 기록됨

### 3.5 Role Templates (agent_prompt_templates)

| Role | 설명 | 기본 도구 |
|------|------|----------|
| CEO | 전략, 의사결정, 외부 소통 | web_search, exchange, gmail, calendar |
| Developer | 코드, 배포, 기술 구현 | web_search, github, vercel |
| Trader | 매매 실행, 시장 분석 | web_search, exchange |
| Marketer | 마케팅, 콘텐츠, SNS | web_search, gmail, notion |
| Analyst | 데이터 분석, 리서치 | web_search, notion |
| Designer | 디자인, 에셋 생성 | web_search, notion |
| Custom | 사용자 정의 | 사용자 선택 |

---

## 4. DB 변경사항

### 4.1 companies 테이블 추가 컬럼

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  company_type TEXT DEFAULT 'full_stack'
  CHECK (company_type IN ('trading', 'saas', 'content', 'full_stack', 'custom'));

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  exchange_network TEXT DEFAULT 'testnet'
  CHECK (exchange_network IN ('testnet', 'live'));

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  round_interval_minutes INTEGER DEFAULT 60;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  max_rounds_per_day INTEGER DEFAULT 24;
```

### 4.2 custom_mcp_servers 테이블 (새로)

```sql
CREATE TABLE custom_mcp_servers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  auth_token_encrypted TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_mcp_company ON custom_mcp_servers(company_id);

ALTER TABLE custom_mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_custom_mcp" ON custom_mcp_servers
  FOR ALL USING (is_company_owner(company_id));
```

---

## 5. API 엔드포인트

### Dashboard API Routes

```
POST   /api/init              — 회사 생성 (유형 + 설정)
PATCH  /api/company/[id]      — 회사 수정 (이름, 미션, 상태, 설정)
DELETE /api/company/[id]      — 회사 삭제 (소프트)
POST   /api/company/[id]/pause   — 일시정지
POST   /api/company/[id]/resume  — 재개

POST   /api/agent/hire        — 에이전트 고용
PATCH  /api/agent/[id]        — 에이전트 수정
POST   /api/agent/[id]/fire   — 에이전트 해고

POST   /api/settings          — Exchange 키 저장 (기존)
POST   /api/mcp/custom        — 커스텀 MCP 추가
DELETE /api/mcp/custom/[id]   — 커스텀 MCP 삭제
```

---

## 6. 페이지 구조

```
/dashboard
├── page.tsx                     — 회사 목록
├── new/page.tsx                 — 회사 생성 (Step 1~3)
└── [companyId]/
    ├── page.tsx                 — 실시간 모니터링 (메인)
    ├── settings/page.tsx        — 회사 설정 (General + Exchange + Tools + Danger)
    └── team/page.tsx            — 직원 관리 (목록 + 고용 + 편집 + 해고)
```

---

## 7. 구현 우선순위 (MVP)

### Phase 1 (지금)
1. 회사 생성 — 프리셋 4개 + 시드머니 + 도구 선택
2. 회사 관리 — pause/resume/archive/delete
3. 직원 관리 — hire/edit/fire + 모델 선택 + 도구 할당

### Phase 2 (나중)
4. 커스텀 회사 — AI 대화형 설정
5. 커스텀 MCP — URL + 토큰으로 외부 MCP 연결
6. Exchange Live 모드 — 실계좌 연동 + 보안 강화
7. 에이전트 페르소나 — AI가 personality 기반으로 프롬프트 자동 생성
