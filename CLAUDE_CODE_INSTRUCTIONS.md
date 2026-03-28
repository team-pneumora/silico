# Silico — Claude Code 구현 지시서

> 이 문서를 순서대로 따라가면 Silico 프로젝트가 완성됩니다.
> 각 Step을 하나씩 실행하고, 완료 후 다음 Step으로 넘어가세요.
> 설계 사양서: `docs/architecture.md` (이 파일과 함께 제공됨)

---

## 사전 준비

아래 값이 필요합니다 (.env에 넣을 것):
- `ANTHROPIC_API_KEY`: Claude API 키 (console.anthropic.com)
- `GITHUB_TOKEN`: GitHub Personal Access Token (repo 권한)
- `EXCHANGE_API_KEY` / `EXCHANGE_API_SECRET`: Bybit 선물 테스트넷 키
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY`: Supabase 프로젝트 키

아래 값은 고정입니다:
```
SILICO_PAGE_ID=32a08ff1-6241-8016-bfdd-dd0bddb501c8
COMPANY_REGISTRY_DS_ID=a81e01f7-f919-4dfb-b87e-7fbf818b743a
```

---

## Step 1: 프로젝트 초기화

```
GitHub에 public repo "silico"를 생성하고, 아래 구조로 TypeScript + Node.js 프로젝트를 초기화해줘.

패키지 매니저: pnpm
런타임: Node.js 20+
언어: TypeScript (strict mode)

파일 구조:
silico/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore            # .env, node_modules, logs/ 포함
│
├── src/
│   ├── orchestrator/
│   │   ├── index.ts
│   │   ├── round-manager.ts
│   │   ├── initializer.ts
│   │   ├── action-executor.ts
│   │   ├── state-manager.ts
│   │   └── validators.ts
│   │
│   ├── agents/
│   │   ├── ceo/
│   │   │   ├── system-prompt.ts
│   │   │   └── context-builder.ts
│   │   ├── developer/
│   │   │   ├── system-prompt.ts
│   │   │   └── context-builder.ts
│   │   └── base-agent.ts
│   │
│   ├── mcp/
│   │   ├── notion.ts
│   │   ├── exchange.ts
│   │   ├── supabase.ts
│   │   ├── github.ts
│   │   ├── vercel.ts
│   │   ├── gmail.ts
│   │   └── calendar.ts
│   │
│   ├── schemas/
│   │   ├── messages.ts
│   │   ├── tasks.ts
│   │   ├── company-state.ts
│   │   ├── decisions.ts
│   │   └── round-log.ts
│   │
│   ├── types/
│   │   ├── actions.ts
│   │   ├── agent.ts
│   │   └── state.ts
│   │
│   └── utils/
│       ├── logger.ts
│       └── config.ts
│
├── logs/
└── docs/
    └── architecture.md    # 설계 사양서 (별도 제공)

.env.example 내용:
ANTHROPIC_API_KEY=sk-ant-...
SILICO_PAGE_ID=32a08ff1-6241-8016-bfdd-dd0bddb501c8
COMPANY_REGISTRY_DS_ID=a81e01f7-f919-4dfb-b87e-7fbf818b743a
EXCHANGE_API_KEY=xxx
EXCHANGE_API_SECRET=xxx
EXCHANGE_BASE_URL=https://api-testnet.bybit.com
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
GITHUB_TOKEN=ghp_xxx
ROUND_INTERVAL_MINUTES=60
MAX_ROUNDS_PER_DAY=24
AGENT_MODEL=claude-sonnet-4-20250514

필요한 npm 패키지:
- @anthropic-ai/sdk (Claude API)
- @supabase/supabase-js (Supabase Storage + DB)
- dotenv
- winston (로깅)
- node-cron (스케줄링)
- typescript, ts-node, @types/node

README.md에는 프로젝트 설명, 설치 방법, 실행 방법을 포함해줘.
```

---

## Step 2: 타입 정의

```
docs/architecture.md를 읽고, src/types/ 폴더에 타입 정의를 만들어줘.

src/types/state.ts:
- CompanyConfig: 회사 설정 (이름, pageId, 모든 DB의 dataSourceId)
- CompanyState: 회사 현재 상태 (round, treasury, tradingBalance, openPositions, activeProducts, totalRevenue)
- RoundLog: 라운드 기록

src/types/agent.ts:
- AgentRole: 'CEO' | 'Developer'
- AgentResponse: 에이전트 응답 (thinking + actions 배열)
- AgentContext: 에이전트에게 주입할 동적 컨텍스트

src/types/actions.ts:
- 모든 Action 타입을 discriminated union으로 정의
- Action 타입 목록:
  - ReadMessagesAction
  - SendMessageAction  
  - CreateTaskAction
  - UpdateTaskAction
  - WebSearchAction
  - TradingDecisionAction (CEO 전용)
  - ExecuteTradeAction (Developer 전용, CEO 지시 필요)
  - CheckPositionsAction
  - GitHubCreateRepoAction
  - VercelDeployAction
  - SendEmailAction (CEO 전용)
  - CalendarEventAction (CEO 전용)
  - LogDecisionAction
  - UpdateCompanyStateAction
  - NameCompanyAction (Round 0 전용)
```

---

## Step 3: DB 스키마 상수 정의

```
src/schemas/ 폴더에 Notion DB 생성용 DDL 상수를 만들어줘.
이 스키마들은 Initialization 시 회사 페이지 안에 DB를 만들 때 사용됩니다.

src/schemas/messages.ts:
export const MESSAGES_SCHEMA = `CREATE TABLE (
  "Title" TITLE, 
  "From" SELECT('CEO':orange, 'Developer':green), 
  "To" SELECT('CEO':orange, 'Developer':green, 'All':blue), 
  "Type" SELECT('directive':red, 'report':blue, 'question':yellow, 'fyi':gray), 
  "Content" RICH_TEXT, 
  "Status" SELECT('unread':red, 'read':orange, 'acted':green), 
  "Round" NUMBER
)`;

src/schemas/tasks.ts:
export const TASKS_SCHEMA = `CREATE TABLE (
  "Task" TITLE, 
  "Assignee" SELECT('CEO':orange, 'Developer':green), 
  "Status" SELECT('todo':red, 'doing':blue, 'done':green, 'blocked':gray), 
  "Priority" SELECT('P0':red, 'P1':orange, 'P2':gray), 
  "Due Round" NUMBER, 
  "Description" RICH_TEXT
)`;

src/schemas/company-state.ts:
export const COMPANY_STATE_SCHEMA = `CREATE TABLE (
  "Name" TITLE, 
  "Current Round" NUMBER, 
  "Treasury USD" NUMBER FORMAT 'dollar', 
  "Trading Balance" NUMBER FORMAT 'dollar', 
  "Open Positions" RICH_TEXT, 
  "Active Products" NUMBER, 
  "Total Revenue" NUMBER FORMAT 'dollar'
)`;

src/schemas/decisions.ts:
export const DECISIONS_SCHEMA = `CREATE TABLE (
  "Decision" TITLE, 
  "Round" NUMBER, 
  "Agent" SELECT('CEO':orange, 'Developer':green), 
  "Reasoning" RICH_TEXT, 
  "Outcome" RICH_TEXT, 
  "Category" SELECT('trading':red, 'product':blue, 'strategy':purple, 'technical':green)
)`;

src/schemas/round-log.ts:
export const ROUND_LOG_SCHEMA = `CREATE TABLE (
  "Round" TITLE, 
  "Round Number" NUMBER, 
  "CEO Actions" RICH_TEXT, 
  "Dev Actions" RICH_TEXT, 
  "Summary" RICH_TEXT, 
  "Treasury Snapshot" NUMBER FORMAT 'dollar', 
  "Trading Snapshot" NUMBER FORMAT 'dollar'
)`;

각 파일에서 export하고, src/schemas/index.ts에서 모두 re-export 해줘.
```

---

## Step 4: 유틸리티

```
src/utils/config.ts:
- dotenv로 환경 변수 로드
- 필수 환경 변수 검증 (없으면 에러 + 안내 메시지)
- 타입 안전한 config 객체 export

src/utils/logger.ts:
- winston으로 구조화된 로거 생성
- 콘솔 출력 + logs/ 폴더에 파일 저장
- 로그 레벨: info, warn, error, debug
- 라운드 번호와 에이전트 이름을 메타데이터로 포함
- 각 라운드의 전체 로그를 logs/round-{number}.json으로 저장
```

---

## Step 5: MCP 래퍼

```
docs/architecture.md의 Section 6 (Notion 구조)를 읽고 MCP 래퍼를 만들어줘.

src/mcp/notion.ts:
Notion MCP 서버 (https://mcp.notion.com/mcp)에 대한 래퍼.
Claude API의 mcp_servers 파라미터를 통해 호출.
주요 함수:
- createPage(parentPageId, title, icon?) → 페이지 생성
- createDatabase(parentPageId, title, schema) → DB 생성, dataSourceId 반환
- createPageInDB(dataSourceId, properties) → DB에 행 추가
- updatePageInDB(pageUrl, properties) → DB 행 수정
- queryDatabase(dataSourceId, filter?) → DB 조회
- createView(databaseId, dataSourceId, name, type, configure?) → 뷰 생성

중요: Notion MCP는 Claude API의 mcp_servers에 넣어서 Claude가 직접 호출하는 방식.
래퍼는 Claude API 호출 시 mcp_servers 배열에 Notion을 포함하고,
적절한 프롬프트로 원하는 작업을 지시하는 구조.

src/mcp/exchange.ts:
Bybit V5 API 래퍼 (직접 HTTP 호출).
테스트넷 URL: https://api-testnet.bybit.com
실서버 URL: https://api.bybit.com
주요 함수:
- getBalance() → USDT 잔고 조회
- getPositions() → 열린 포지션 목록
- openPosition(symbol, side, amount, leverage, stopLoss, takeProfit)
- closePosition(symbol)
- getOrderStatus(orderId)
- getPrice(symbol) → 현재가 조회
HMAC SHA256 서명 필요 (Bybit V5 API 인증 방식)
Bybit V5 API 문서: https://bybit-exchange.github.io/docs/v5/intro

src/mcp/supabase.ts:
Supabase Storage + DB 래퍼 (@supabase/supabase-js 사용).
npm 패키지: @supabase/supabase-js
주요 함수:
Storage:
- createBucket(name) → 버킷 생성
- uploadFile(bucket, path, file) → 파일 업로드
- getPublicUrl(bucket, path) → 공개 URL 반환
- listFiles(bucket, folder?) → 파일 목록
- deleteFile(bucket, path) → 파일 삭제
DB:
- createTradingHistoryTable(companyName) → 트레이딩 로그 테이블 생성
- logTrade(trade) → 트레이드 기록
- getTradingHistory(companyName, limit?) → 트레이딩 히스토리 조회
- logPortfolioSnapshot(snapshot) → 포트폴리오 스냅샷 기록

나머지 MCP (github.ts, vercel.ts, gmail.ts, calendar.ts)는 
Claude API mcp_servers를 통해 호출하므로, 각 MCP 서버 URL을 관리하는 
간단한 설정 객체만 만들어둬. 상세 구현은 나중에.
MCP 서버 URL:
- Vercel: https://mcp.vercel.com
- Gmail: https://gmail.mcp.claude.com/mcp  
- Google Calendar: https://gcal.mcp.claude.com/mcp
- Notion: https://mcp.notion.com/mcp
```

---

## Step 6: 에이전트 시스템 프롬프트

```
docs/architecture.md의 Section 2 (CEO)와 Section 3 (Developer)를 읽고
에이전트 프롬프트를 구현해줘.

src/agents/base-agent.ts:
- BaseAgent 클래스
- Claude API 호출 로직 (Anthropic SDK 사용)
- MCP 서버 목록 주입
- 시스템 프롬프트 + 동적 컨텍스트 → API 호출 → JSON 파싱
- 에러 핸들링, 재시도 로직 (최대 3회)
- 응답 포맷: { thinking: string, actions: Action[] }

src/agents/ceo/system-prompt.ts:
- 설계 문서 Section 2.1의 전체 시스템 프롬프트를 string으로 export
- 수정 금지: 설계 문서 그대로 사용

src/agents/ceo/context-builder.ts:
- buildCEOContext(companyState, unreadMessages, pendingTasks, lastRoundSummary) 
- 설계 문서 Section 2.2의 동적 컨텍스트 포맷 사용
- CompanyState, Messages, Tasks 데이터를 받아서 문자열로 조합

src/agents/developer/system-prompt.ts:
- 설계 문서 Section 3.1의 전체 시스템 프롬프트를 string으로 export

src/agents/developer/context-builder.ts:
- buildDeveloperContext(unreadMessages, pendingTasks, deployments, openOrders, lastRoundSummary)
- 설계 문서 Section 3.2의 동적 컨텍스트 포맷 사용
```

---

## Step 7: Safety Validators

```
docs/architecture.md의 Section 5 (Safety & Guardrails)를 읽고 구현해줘.

src/orchestrator/validators.ts:

트레이딩 안전장치:
- validateTrade(action, companyState) → { valid: boolean, reason?: string }
- 단일 포지션 최대: tradingBalance의 30%
- 총 노출 최대: tradingBalance의 70%  
- 레버리지 최대: 10x
- 손절 필수 (stop_loss가 없으면 거부)
- reward:risk 최소 2:1

지출 안전장치:
- validateSpending(amount, companyState) → { valid: boolean, reason?: string }
- treasury $10 미만이면 모든 지출 차단
- "생존 모드" 상태 반환

권한 안전장치:
- validatePermission(action, agentRole) → { valid: boolean, reason?: string }
- CEO 전용 action을 Developer가 요청하면 거부
- Developer의 트레이드 실행은 CEO directive 참조 필수

모든 검증 실패는 로그에 기록하고, 에이전트에게 거부 이유를 전달.
```

---

## Step 8: Initializer (Round 0)

```
docs/architecture.md의 Section 6.2와 6.5를 읽고 구현해줘.
이것이 가장 중요한 파일 중 하나임.

src/orchestrator/initializer.ts:

async function initializeCompany(userId: string, seedMoney: number = 100): Promise<CompanyConfig>
// userId: 요청한 사용자의 Supabase auth.uid()
// Supabase companies 테이블에 INSERT 시 user_id를 반드시 포함

플로우:
1. CEO 에이전트를 특수 프롬프트로 호출:
   "You are founding a new AI company. Choose a creative, memorable name. 
    Define the mission. Outline your initial strategy for growing 
    ${seedMoney} dollars into a profitable business.
    Respond in JSON: { company_name, emoji, mission, strategy }"
   
2. Notion에 회사 페이지 생성:
   - parent: SILICO_PAGE_ID
   - title: {company_name}
   - icon: {emoji}

3. 회사 페이지 안에 DB 5개 생성 (schemas/ 폴더의 상수 사용):
   - 📨 Messages (MESSAGES_SCHEMA)
   - ✅ Tasks (TASKS_SCHEMA) 
   - 💰 Company State (COMPANY_STATE_SCHEMA)
   - 🧠 Decisions Log (DECISIONS_SCHEMA)
   - 📜 Round Log (ROUND_LOG_SCHEMA)
   각 DB 생성 후 dataSourceId를 저장

4. Tasks DB에 보드 뷰 생성 (GROUP BY "Status")

5. Company State 초기값 세팅:
   { Name: "{company_name} HQ", Current Round: 0, Treasury USD: seedMoney,
     Trading Balance: seedMoney, Open Positions: "[]", Active Products: 0, Total Revenue: 0 }

6. GitHub 레포 생성:
   - 레포명: silico-{company_name_lowercase_kebab}
   - Public, README.md 포함 (회사 미션 + 설명)
   - GitHub MCP 또는 GitHub REST API로 생성

7. Supabase Storage 버킷 생성:
   - 버킷명: silico-{company_name_lowercase_kebab}
   - Public bucket (에셋 공개 접근 가능)
   - Supabase DB에 trading_history 테이블 생성:
     CREATE TABLE trading_history_{company} (
       id SERIAL PRIMARY KEY,
       round INTEGER,
       symbol TEXT,
       side TEXT,
       entry_price DECIMAL,
       exit_price DECIMAL,
       amount_usd DECIMAL,
       leverage INTEGER,
       pnl DECIMAL,
       status TEXT,
       created_at TIMESTAMPTZ DEFAULT NOW()
     );

8. Company Registry에 등록:
   { Company Name: {company_name}, Status: "active", Seed Money: seedMoney,
     Current Round: 0, Page ID: {pageId}, Messages DB: {dsId}, Tasks DB: {dsId}, 
     State DB: {dsId}, Decisions DB: {dsId}, Round Log DB: {dsId},
     GitHub Repo: "https://github.com/{owner}/silico-{name}",
     Storage Bucket: "silico-{name}" }

9. Messages DB에 첫 메시지 작성:
   { Title: "Company Founded", From: "CEO", To: "All", Type: "fyi",
     Content: "{company_name} is live. Mission: {mission}. Strategy: {strategy}",
     Status: "unread", Round: 0 }

10. Decisions Log에 첫 결정 기록:
    { Decision: "Company founded: {company_name}", Round: 0, Agent: "CEO",
      Reasoning: "{mission} - {strategy}", Category: "strategy" }

11. Round Log에 Round 0 기록

12. CompanyConfig 객체 반환 (GitHub URL, Storage Bucket 포함)

에러 처리: 어느 단계에서든 실패하면 이미 생성된 리소스를 로깅하고,
재시도 또는 수동 복구가 가능하도록 상태를 기록.
```

---

## Step 9: Action Executor

```
docs/architecture.md의 Section 4.3 (Action Executor 매핑)을 읽고 구현해줘.

src/orchestrator/action-executor.ts:

에이전트가 반환한 JSON action을 실제 MCP/API 호출로 변환하는 모듈.

async function executeAction(
  action: Action, 
  agentRole: AgentRole, 
  companyConfig: CompanyConfig,
  companyState: CompanyState
): Promise<ActionResult>

각 action type별 핸들러:
- read_messages → Notion queryDatabase (Messages DB, filter: to + status)
- send_message → Notion createPageInDB (Messages DB)
- create_task → Notion createPageInDB (Tasks DB)
- update_task → Notion updatePageInDB (Tasks DB)
- web_search → Claude API with web_search tool
- trading_decision → validators.validateTrade 먼저 → Exchange API
- execute_trade → 권한 검증 → validators.validateTrade → Exchange API
- check_positions → Exchange API getPositions
- github_create_repo → Claude API with GitHub MCP
- vercel_deploy → Claude API with Vercel MCP
- send_email → 권한 검증 (CEO만) → Claude API with Gmail MCP
- calendar_event → 권한 검증 (CEO만) → Claude API with Calendar MCP
- log_decision → Notion createPageInDB (Decisions DB)
- update_company_state → Notion updatePageInDB (State DB)

모든 action 실행 전에 validators를 거침.
모든 결과를 ActionResult로 반환 (success, data, error).
모든 실행을 로깅.
```

---

## Step 10: Round Manager

```
docs/architecture.md의 Section 4.1 (라운드 진행 흐름)을 읽고 구현해줘.

src/orchestrator/round-manager.ts:

async function runRound(companyConfig: CompanyConfig): Promise<RoundLog>

라운드 진행 순서:
1. Company State 읽기 (Notion에서)
2. Exchange에서 포지션/잔고 실시간 업데이트 → Company State 동기화
3. CEO 에이전트 호출:
   a. context-builder로 동적 컨텍스트 생성
   b. CEO system prompt + context로 Claude API 호출
   c. 응답 파싱 (JSON actions)
   d. 각 action을 action-executor로 실행
   e. 실행 결과 수집
4. Developer 에이전트 호출:
   a. context-builder로 동적 컨텍스트 생성 (CEO가 보낸 새 메시지 포함)
   b. Developer system prompt + context로 Claude API 호출
   c. 응답 파싱
   d. 각 action 실행
   e. 실행 결과 수집
5. Round Log 작성 (Notion Round Log DB):
   - CEO actions 요약
   - Developer actions 요약  
   - Company State 스냅샷
   - AI 생성 라운드 요약문 (별도 Claude 호출로 요약)
6. Company State 업데이트 (current_round += 1)
7. RoundLog 반환

에러 처리:
- 에이전트 호출 실패 → 3회 재시도 후 라운드 스킵 (로깅)
- action 실행 실패 → 개별 action만 스킵 (나머지 계속 진행)
- 5 라운드 연속 실패 → emergency stop
```

---

## Step 11: 메인 오케스트레이터

```
src/orchestrator/index.ts:

프로그램 진입점.

async function main():
1. config 로드, 로거 초기화
2. Company Registry에서 active 회사 목록 조회
3. 회사가 없으면 → initializer.initializeCompany() 실행
4. 각 active 회사에 대해:
   a. Company State 확인
   b. runRound(companyConfig) 실행
5. ROUND_INTERVAL_MINUTES만큼 대기
6. 반복 (node-cron 또는 setInterval)

CLI 옵션:
- `pnpm start` → 자동 반복 모드
- `pnpm start --init` → 새 회사 초기화만 실행
- `pnpm start --once` → 1라운드만 실행하고 종료 (테스트용)
- `pnpm start --round 5` → 특정 라운드 수만 실행

package.json scripts:
{
  "start": "ts-node src/orchestrator/index.ts",
  "dev": "ts-node src/orchestrator/index.ts --once",
  "init": "ts-node src/orchestrator/index.ts --init",
  "build": "tsc",
  "lint": "eslint src/"
}
```

---

## Step 12: 통합 테스트

```
모든 Step 완료 후, 아래 순서로 테스트해줘:

1. 환경 변수 검증:
   pnpm dev  → config 로드 성공 확인

2. Initialization 테스트:
   pnpm init
   → Notion에 회사 페이지 + DB 5개 생성 확인
   → Company Registry에 등록 확인
   → Company State 초기값 확인
   → 콘솔에 CompanyConfig 출력

3. 첫 라운드 테스트:
   pnpm dev
   → CEO 에이전트 호출 성공 확인
   → CEO actions 실행 확인 (Notion에 메시지/태스크 생성)
   → Developer 에이전트 호출 성공 확인
   → Round Log 기록 확인
   → Company State 업데이트 확인 (round = 1)

4. 에러 케이스 테스트:
   → 잘못된 API 키로 실행 → 에러 메시지 확인
   → 트레이딩 리밋 초과 → 거부 + 로그 확인

각 테스트 결과를 보고해줘.
```

---

## 구현 우선순위 요약

절대적 순서:
1. Step 1 (프로젝트 초기화) ← 먼저 해야 나머지가 가능
2. Step 2 (타입) + Step 3 (스키마) + Step 4 (유틸) ← 동시에 가능
3. Step 5 (MCP 래퍼) ← 외부 연동 기반
4. Step 6 (에이전트 프롬프트) ← 핵심 로직
5. Step 7 (Validators) ← 안전장치
6. Step 8 (Initializer) ← 회사 생성 플로우
7. Step 9 (Action Executor) ← action 실행
8. Step 10 (Round Manager) ← 라운드 순환
9. Step 11 (메인 오케스트레이터) ← 통합
10. Step 12 (테스트) ← 검증

---

## 주의사항

- 설계 사양서 (docs/architecture.md)를 반드시 먼저 읽고 참조할 것
- 시스템 프롬프트는 설계 문서 그대로 사용 (임의 수정 금지)
- 모든 Notion DB 생성은 src/schemas/의 상수를 사용할 것
- .env에 실제 키를 넣지 말 것 (GitHub public repo)
- Exchange API는 반드시 테스트넷(testnet)으로 시작할 것
- 모든 에러는 로깅하고 graceful하게 처리할 것
- 코드에 주석을 충분히 달아줄 것 (오픈소스 프로젝트)

---

## 중요: Supabase 미러링 추가사항

Step 5의 src/mcp/supabase.ts에 대시보드용 미러링 함수를 추가해야 합니다.
자세한 스키마와 함수는 docs/DASHBOARD_DESIGN.md의 Section 2, Section 4를 참조하세요.

핵심: 모든 Action Executor 실행 결과를 Supabase에도 기록해야 합니다.
- send_message → Supabase messages INSERT
- trading_decision/execute_trade → Supabase trading_history INSERT
- 모든 action → Supabase agent_actions INSERT
- 라운드 끝 → Supabase company_snapshots INSERT
- Initializer → Supabase companies INSERT

이렇게 해야 대시보드에서 실시간으로 모니터링이 가능합니다.