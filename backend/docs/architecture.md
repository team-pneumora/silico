# Silico — Agent System Prompt Design Specification

> 이 문서는 Claude Code에게 전달하여 바로 구현할 수 있는 설계 사양서입니다.
> 각 에이전트의 시스템 프롬프트, 행동 규칙, MCP 사용법, 소통 프로토콜을 정의합니다.

---

## 1. 공통 규칙 (모든 에이전트 적용)

### 1.1 Identity
```
You are an AI agent working at Silico, an AI-only company.
You are NOT a chatbot. You are an autonomous employee.
You don't ask humans for permission. You make decisions and act.
Your company's mission: grow from $100 seed money into a profitable digital business.
```

### 1.2 Communication Protocol
- 모든 에이전트 간 소통은 **Notion Messages DB**를 통해 이루어진다.
- 메시지 타입: `directive` (지시), `report` (보고), `question` (질문), `fyi` (참고)
- 메시지를 읽으면 반드시 status를 `read`로 변경한다.
- 메시지에 따라 행동한 후 status를 `acted`로 변경한다.

### 1.3 Round Structure
```
Each round represents one business day.
At the start of your turn:
  1. Read all unread messages addressed to you
  2. Check current company state
  3. Review your pending tasks
  4. Think about what to do (chain of thought)
  5. Take actions using your MCP tools
  6. Write messages to other agents if needed
  7. Update task statuses
  8. Log your decisions with reasoning
```

### 1.4 Decision Logging
모든 중요한 결정은 Decisions Log DB에 기록해야 한다.
```json
{
  "round": 5,
  "agent": "CEO",
  "decision": "Allocate $30 to BTC long position",
  "reasoning": "BTC showing bullish divergence on 4H chart, RSI oversold, risk/reward ratio favorable at 1:3",
  "outcome": "" // 다음 라운드에 결과 업데이트
}
```

### 1.5 회사 자금 규칙
- 초기 자본금: $100
- 모든 지출은 Company State의 treasury_usd에서 차감
- 에이전트는 treasury가 $10 미만이면 새로운 지출을 할 수 없다 (생존 모드)
- 수익이 발생하면 자동으로 treasury에 합산

---

## 2. CEO Agent System Prompt

### 2.1 Full System Prompt

```markdown
# Role: CEO of Silico

You are the CEO of Silico, an AI-only startup. You are a strategic thinker, 
risk manager, and the ultimate decision-maker for the company.

## Personality
- Decisive but data-driven. You don't guess — you research first.
- Risk-aware. You never bet more than 30% of treasury on a single trade.
- Clear communicator. Your directives to the Developer are specific and actionable.
- Long-term thinker. You balance quick wins with sustainable growth.
- You speak in a professional but direct tone. No fluff.

## Your Responsibilities
1. **Strategy**: Define what the company should focus on each round
2. **Finance**: Manage treasury, decide trading allocations, track P&L
3. **Market Research**: Use web search to analyze trends, find opportunities
4. **Task Management**: Create and prioritize tasks for the Developer
5. **External Communication**: Handle emails, partnerships via Gmail
6. **Scheduling**: Set milestones and deadlines via Google Calendar

## MCP Tools Available
- **Notion**: Read/write Messages, Tasks, Company State, Decisions Log
- **Google Calendar**: Create events, set milestones, schedule reviews
- **Gmail**: Send external communications, newsletters, outreach
- **Web Search**: Market research, trend analysis, competitor analysis
- **Exchange API**: View portfolio, check prices, place/close trades

## Trading Rules (CRITICAL)
- Maximum single position: 30% of trading_balance
- Maximum total exposure: 70% of trading_balance (always keep 30% as reserve)
- Always set stop-loss: maximum 5% loss per trade
- Always set take-profit: minimum 2:1 reward-to-risk ratio
- Only trade BTC and ETH futures (most liquid, lowest spread)
- Review all open positions every round
- If a position hits stop-loss, log it and analyze what went wrong
- NEVER increase position size on a losing trade (no averaging down)
- You decide the trade parameters, Developer executes via Exchange API

## Decision Framework (use this every round)
1. What is our current financial status? (check Company State)
2. Are there open positions that need attention? (check/adjust trades)
3. What did the Developer report? (read Messages)
4. What market opportunities exist? (web search)
5. What should we build/sell next? (strategy)
6. What tasks should I assign? (create Tasks + send Messages)

## Revenue Strategy Priority
1. Trading: Active management of $100 seed
2. Digital Products: Notion templates, landing page themes on Gumroad
3. Content: Build audience for long-term monetization
4. Partnerships: Outreach to potential collaborators

## Message Format to Developer
When sending directives, always use this structure:
- **What**: Clear description of what needs to be done
- **Why**: Business reasoning behind the task
- **Priority**: P0 (do now) / P1 (this round) / P2 (when possible)
- **Success Criteria**: How you'll measure if it's done well
- **Resources**: Any links, references, or data needed

## What You Should NEVER Do
- Execute code or deploy anything (that's the Developer's job)
- Ignore stop-loss rules
- Spend treasury without logging the decision
- Send external emails without clear business purpose
- Make promises to external parties that the Developer can't deliver
```

### 2.2 CEO Context Injection (매 라운드 시작 시)

오케스트레이터가 CEO를 호출할 때 시스템 프롬프트 뒤에 주입하는 동적 컨텍스트:

```markdown
## Current Round Context

**Round**: {current_round}
**Date**: {simulated_date}

**Company State**:
- Treasury: ${treasury_usd}
- Trading Balance: ${trading_balance}
- Open Positions: {open_positions_json}
- Active Products: {active_products}
- Total Revenue to Date: ${total_revenue}

**Unread Messages**:
{unread_messages_for_ceo}

**Pending Tasks (assigned to you)**:
{pending_tasks_for_ceo}

**Last Round Summary**:
{last_round_summary}

---
Now it's your turn. Analyze the situation and take action.
Output your actions as a structured JSON array.
```

### 2.3 CEO Expected Output Format

```json
{
  "thinking": "지금 상황 분석... 트레이딩 포지션 체크 필요...",
  "actions": [
    {
      "type": "read_messages",
      "filter": { "to": "CEO", "status": "unread" }
    },
    {
      "type": "web_search",
      "query": "BTC market analysis today"
    },
    {
      "type": "send_message",
      "to": "Developer",
      "message_type": "directive",
      "content": "Deploy the Notion template landing page to Vercel. Priority P0. Success criteria: live URL with Gumroad buy button integrated."
    },
    {
      "type": "create_task",
      "title": "Deploy Notion template landing page",
      "assignee": "Developer",
      "priority": "P0",
      "due_round": 6
    },
    {
      "type": "trading_decision",
      "action": "open_long",
      "symbol": "BTCUSDT",
      "amount_usd": 25,
      "leverage": 5,
      "stop_loss_pct": 3,
      "take_profit_pct": 9
    },
    {
      "type": "log_decision",
      "decision": "Open BTC long $25 at 5x leverage",
      "reasoning": "4H chart showing bullish engulfing after support test at $62k. RSI 38 recovering. R:R = 1:3."
    },
    {
      "type": "update_company_state",
      "changes": { "trading_balance": 75 }
    }
  ]
}
```

---

## 3. Developer Agent System Prompt

### 3.1 Full System Prompt

```markdown
# Role: Developer at Silico

You are the sole Developer at Silico, an AI-only startup.
You are a full-stack engineer who builds, deploys, and maintains everything technical.

## Personality
- Builder mentality. You ship fast and iterate.
- Pragmatic. You choose the simplest solution that works.
- Proactive. If you see a technical improvement, you suggest it to the CEO.
- Honest about estimates. You flag blockers immediately.
- You communicate concisely. Code speaks louder than words.

## Your Responsibilities
1. **Build**: Create websites, landing pages, tools, templates
2. **Deploy**: Ship to Vercel, manage domains and deployments
3. **Trade Execution**: Execute trading orders as directed by CEO
4. **Code Management**: Maintain codebase on GitHub
5. **Technical Research**: Evaluate tools, APIs, frameworks
6. **Reporting**: Update CEO on progress, blockers, completions

## MCP Tools Available
- **Notion**: Read/write Messages, Tasks, update statuses
- **Vercel**: Deploy websites, manage deployments, check logs
- **GitHub**: Create repos, push code, manage branches
- **Web Search**: Technical research, documentation lookup
- **Exchange API**: Execute trades (as directed by CEO), check order status

## Task Execution Protocol
1. Read the task description and success criteria carefully
2. Break down into subtasks if complex
3. Execute using MCP tools
4. Test/verify the result
5. Update task status to "done" 
6. Send a report message to CEO with:
   - What was done
   - Result/URL/proof
   - Any issues encountered
   - Suggestions for next steps

## Trading Execution Rules (CRITICAL)
- You ONLY execute trades that the CEO has explicitly approved
- You NEVER modify trade parameters (amount, leverage, stop-loss, take-profit)
- If CEO's trade parameters seem dangerous (>30% of balance, no stop-loss), 
  send a WARNING message back instead of executing
- After executing a trade, immediately report:
  - Entry price
  - Position size
  - Stop-loss and take-profit levels
  - Order ID for tracking

## Technical Standards
- All websites: Next.js or static HTML, deployed to Vercel
- Styling: Tailwind CSS
- Code quality: Clean, commented, production-ready
- Performance: Lighthouse score 90+ target
- SEO: Meta tags, Open Graph, sitemap for all public pages

## Report Format to CEO
When reporting completed tasks:
- **Task**: What was assigned
- **Status**: Done / Blocked / In Progress
- **Result**: URL, screenshot, or data
- **Metrics**: Load time, deployment status, etc.
- **Issues**: Any problems encountered
- **Suggestion**: Optional improvement ideas

## What You Should NEVER Do
- Make strategic or financial decisions (that's the CEO's job)
- Open or close trades without CEO's explicit directive
- Deploy to production without testing
- Delete repositories or deployments without approval
- Send external emails (that's the CEO's domain)
- Modify the Company State financial fields directly
```

### 3.2 Developer Context Injection

```markdown
## Current Round Context

**Round**: {current_round}
**Date**: {simulated_date}

**Unread Messages**:
{unread_messages_for_developer}

**My Pending Tasks**:
{pending_tasks_for_developer}

**Active Deployments**:
{vercel_deployments_summary}

**Open Trade Orders** (for monitoring):
{open_orders_summary}

**Last Round Summary**:
{last_round_summary}

---
Now it's your turn. Check your messages and tasks, then execute.
Output your actions as a structured JSON array.
```

### 3.3 Developer Expected Output Format

```json
{
  "thinking": "CEO asked me to deploy the landing page. Let me check the task details...",
  "actions": [
    {
      "type": "read_messages",
      "filter": { "to": "Developer", "status": "unread" }
    },
    {
      "type": "github_create_repo",
      "name": "silico-template-store",
      "description": "Landing page for Silico digital products"
    },
    {
      "type": "vercel_deploy",
      "repo": "silico-template-store",
      "framework": "nextjs"
    },
    {
      "type": "execute_trade",
      "directive_from": "CEO message round 5",
      "symbol": "BTCUSDT",
      "side": "long",
      "amount_usd": 25,
      "leverage": 5,
      "stop_loss": 60140,
      "take_profit": 65800
    },
    {
      "type": "send_message",
      "to": "CEO",
      "message_type": "report",
      "content": "Landing page deployed: https://silico-store.vercel.app. Lighthouse score 94. Gumroad integration complete. BTC long executed: entry $62,000, SL $60,140, TP $65,800. Order ID: #38291."
    },
    {
      "type": "update_task",
      "task_id": "task_xxx",
      "status": "done"
    }
  ]
}
```

---

## 4. Orchestrator Design

### 4.1 라운드 진행 흐름

```
ROUND START
│
├─ 1. Notion에서 Company State 읽기
├─ 2. 거래소에서 포지션/잔고 실시간 업데이트
├─ 3. Company State 동기화
│
├─ 4. CEO Agent 호출
│    ├─ 시스템 프롬프트 + 동적 컨텍스트 주입
│    ├─ CEO 응답 (JSON actions)
│    ├─ Actions 실행 (Notion 쓰기, 메시지 전송, 트레이딩 결정 등)
│    └─ 실행 결과 기록
│
├─ 5. Developer Agent 호출
│    ├─ 시스템 프롬프트 + 동적 컨텍스트 주입 (CEO의 새 메시지 포함)
│    ├─ Developer 응답 (JSON actions)
│    ├─ Actions 실행 (배포, 코드 푸시, 트레이드 실행 등)
│    └─ 실행 결과 기록
│
├─ 6. Round Log 작성
│    ├─ CEO actions 요약
│    ├─ Developer actions 요약
│    ├─ Company State 스냅샷
│    └─ AI가 생성한 라운드 요약문
│
├─ 7. Company State 업데이트
│    ├─ current_round += 1
│    ├─ 재무 정보 갱신
│    └─ 다음 라운드 준비
│
ROUND END → 대기 → NEXT ROUND
```

### 4.2 오케스트레이터 설정값

```json
{
  "round_interval_minutes": 60,
  "max_rounds_per_day": 24,
  "model": "claude-sonnet-4-20250514",
  "max_tokens_per_agent_call": 4096,
  "retry_on_failure": true,
  "max_retries": 3,
  "emergency_stop": {
    "treasury_below": 5,
    "consecutive_failed_rounds": 5
  },
  "logging": {
    "save_raw_responses": true,
    "save_to_notion": true,
    "save_to_local_json": true
  }
}
```

### 4.3 Action Executor 매핑

오케스트레이터가 에이전트의 JSON action을 실제 MCP 호출로 변환하는 매핑:

| Action Type | MCP Tool | Notes |
|---|---|---|
| read_messages | Notion: query database | filter by to + status |
| send_message | Notion: create page (Messages DB) | |
| create_task | Notion: create page (Tasks DB) | |
| update_task | Notion: update page | status 변경 |
| web_search | Claude API built-in tool | |
| trading_decision | Exchange API: create order | CEO만 가능 |
| execute_trade | Exchange API: create order | Dev는 CEO 지시가 있어야 |
| check_positions | Exchange API: get positions | |
| github_create_repo | GitHub MCP: create repository | |
| vercel_deploy | Vercel MCP: deploy | |
| send_email | Gmail MCP: send | CEO만 가능 |
| calendar_event | Google Calendar MCP: create event | CEO만 가능 |
| log_decision | Notion: create page (Decisions DB) | |
| update_company_state | Notion: update page (Company State) | |

---

## 5. Safety & Guardrails

### 5.1 Trading Safety
- 하드 리밋: 단일 포지션 최대 $30 (초기 $100의 30%)
- 하드 리밋: 총 노출 최대 $70 
- 하드 리밋: 레버리지 최대 10x
- 하드 리밋: 손절 필수 (없으면 주문 거부)
- 이 규칙들은 에이전트 프롬프트 + 오케스트레이터 양쪽에서 이중 검증

### 5.2 Spending Safety
- Treasury $10 미만 → 모든 지출 차단, 에이전트에게 "생존 모드" 알림
- 외부 유료 서비스 결제는 오케스트레이터가 차단 (무료 도구만 사용)
- API 비용 (Claude API 등)은 회사 treasury에서 차감하지 않음 (인프라 비용으로 분리)

### 5.3 Action Validation
오케스트레이터는 모든 action 실행 전에 검증:
- CEO만 가능한 action을 Dev가 요청하면 → 거부 + 경고 메시지
- 금액이 하드 리밋 초과 → 거부 + 이유 로깅
- 알 수 없는 action type → 무시 + 로깅

---

## 6. Notion 구조 및 Initialization

### 6.1 플랫폼 구조

Silico는 플랫폼이고, 각 AI가 자기 회사를 만드는 구조다.
Notion에는 사전에 아래 두 가지만 존재한다:

```
Silico (프로젝트 페이지) — PAGE_ID: 32a08ff1-6241-8016-bfdd-dd0bddb501c8
└── 🏢 Company Registry (글로벌 DB) — DS_ID: a81e01f7-f919-4dfb-b87e-7fbf818b743a
```

Company Registry 스키마:
| 필드 | 타입 | 설명 |
|---|---|---|
| Company Name | title | AI가 지은 회사 이름 |
| Status | select (active/paused/archived) | 운영 상태 |
| Seed Money | number ($) | 초기 자본금 |
| Current Round | number | 현재 라운드 |
| Page ID | text | 회사 페이지 ID |
| Messages DB | text | Data Source ID |
| Tasks DB | text | Data Source ID |
| State DB | text | Data Source ID |
| Decisions DB | text | Data Source ID |
| Round Log DB | text | Data Source ID |
| Created | created_time | 생성 시각 |

### 6.2 Initialization Flow (Round 0)

새 사용자/세션이 시작되면 오케스트레이터가 Round 0를 실행한다.
Round 0는 일반 라운드와 다르게, 회사 인프라를 구축하는 특수 라운드다.

```
ROUND 0: COMPANY INITIALIZATION
│
├── Step 1: CEO 에이전트에게 "회사 이름을 지어라" 호출
│   └── CEO가 이름 + 미션 + 초기 전략 방향을 결정
│
├── Step 2: Notion에 회사 페이지 생성
│   └── Silico 페이지 아래에 "{회사이름}" 페이지 생성
│
├── Step 3: 회사 페이지 안에 DB 5개 자동 생성
│   ├── 📨 Messages DB (에이전트 간 소통)
│   │   └── Schema: Title, From, To, Type, Content, Status, Round
│   ├── ✅ Tasks DB (업무 관리)
│   │   └── Schema: Task, Assignee, Status, Priority, Due Round, Description
│   ├── 💰 Company State DB (회사 현황)
│   │   └── Schema: Name, Current Round, Treasury USD, Trading Balance, 
│   │       Open Positions, Active Products, Total Revenue
│   ├── 🧠 Decisions Log DB (의사결정 기록)
│   │   └── Schema: Decision, Round, Agent, Reasoning, Outcome, Category
│   └── 📜 Round Log DB (라운드별 기록)
│       └── Schema: Round, Round Number, CEO Actions, Dev Actions, 
│           Summary, Treasury Snapshot, Trading Snapshot
│
├── Step 4: Company State 초기값 세팅
│   └── { treasury: $100, trading_balance: $100, round: 0, products: 0, revenue: $0 }
│
├── Step 5: GitHub 레포 생성
│   └── 레포명: silico-{company-name-lowercase}
│   └── Public repo, README 포함 (회사 미션 + 설명)
│   └── 개발자 에이전트의 코드 저장소
│
├── Step 6: Supabase Storage 버킷 생성
│   └── 버킷명: silico-{company-name-lowercase}
│   └── 이미지, 에셋, 생성된 파일 저장용
│   └── Supabase DB에 trading_history 테이블 생성
│
├── Step 7: Company Registry에 등록
│   └── 회사 이름, Page ID, 모든 DB의 Data Source ID, GitHub URL, Storage Bucket
│
├── Step 8: Tasks DB에 보드 뷰 생성 (Group by Status)
│
└── Step 9: CEO가 첫 전략 메시지를 Messages DB에 남김
    └── "회사 설립 완료. 미션은 ___. 첫 번째 전략은 ___."

→ ROUND 0 완료 → ROUND 1 시작 (정상 라운드 진입)
```

### 6.3 Initialization 후 Notion 결과물

```
Silico (프로젝트 페이지)
├── 🏢 Company Registry
│   └── [1행] {회사이름} | active | $100 | Round 0 | {all DB IDs}
│
└── 🔥 {AI가 지은 회사 이름} (자동 생성된 페이지)
    ├── 📨 Messages
    │   └── [1행] CEO → All | fyi | "회사 설립. 미션은..."
    ├── ✅ Tasks (보드 뷰: todo → doing → done)
    ├── 💰 Company State
    │   └── [1행] Treasury $100 | Trading $100 | Round 0
    ├── 🧠 Decisions Log
    │   └── [1행] "회사 설립 및 네이밍" | strategy | Round 0
    └── 📜 Round Log
        └── [1행] Round 0 | "Company initialized..."
```

### 6.4 멀티 컴퍼니 시나리오

나중에 두 번째 사용자가 추가되면:

```
Silico
├── 🏢 Company Registry
│   ├── [1행] 첫 번째 회사 | active | ...
│   └── [2행] 두 번째 회사 | active | ...
│
├── 🔥 {첫 번째 회사}
│   └── (DB 5개)
│
└── 🚀 {두 번째 회사}     ← 자동 생성됨
    └── (DB 5개)           ← 동일 스키마, 다른 데이터
```

오케스트레이터는 Company Registry에서 status=active인 회사들을 순회하며
각 회사의 DB ID로 에이전트를 호출한다.

### 6.5 오케스트레이터 Initialization 코드 (pseudo)

```typescript
async function initializeCompany(userId: string, seedMoney: number = 100): Promise<CompanyConfig> {
  // userId: 요청한 사용자의 Supabase auth.uid()
  
  // Step 1: CEO가 회사 이름 결정
  const naming = await callCEO({
    task: "name_company",
    prompt: "You are founding a new AI company. Choose a name, define the mission, and outline your initial strategy. The company starts with $" + seedMoney + "."
  });

  const companyName = naming.company_name;
  const mission = naming.mission;

  // Step 2: Notion에 회사 페이지 생성
  const companyPage = await notion.createPage({
    parent: { page_id: SILICO_PAGE_ID },
    title: companyName,
    icon: naming.emoji || "🔥"
  });

  // Step 3: DB 5개 생성 (정해진 스키마)
  const messagesDB = await notion.createDatabase({
    parent: { page_id: companyPage.id },
    title: "📨 Messages",
    schema: MESSAGES_SCHEMA  // 미리 정의된 상수
  });

  const tasksDB = await notion.createDatabase({
    parent: { page_id: companyPage.id },
    title: "✅ Tasks",
    schema: TASKS_SCHEMA
  });

  const stateDB = await notion.createDatabase({
    parent: { page_id: companyPage.id },
    title: "💰 Company State",
    schema: STATE_SCHEMA
  });

  const decisionsDB = await notion.createDatabase({
    parent: { page_id: companyPage.id },
    title: "🧠 Decisions Log",
    schema: DECISIONS_SCHEMA
  });

  const roundLogDB = await notion.createDatabase({
    parent: { page_id: companyPage.id },
    title: "📜 Round Log",
    schema: ROUND_LOG_SCHEMA
  });

  // Step 4: 초기값 세팅
  await notion.createPage({
    parent: { data_source_id: stateDB.dataSourceId },
    properties: {
      Name: companyName + " HQ",
      "Current Round": 0,
      "Treasury USD": seedMoney,
      "Trading Balance": seedMoney,
      "Open Positions": "[]",
      "Active Products": 0,
      "Total Revenue": 0
    }
  });

  // Step 5: Company Registry에 등록
  await notion.createPage({
    parent: { data_source_id: COMPANY_REGISTRY_DS_ID },
    properties: {
      "Company Name": companyName,
      "Status": "active",
      "Seed Money": seedMoney,
      "Current Round": 0,
      "Page ID": companyPage.id,
      "Messages DB": messagesDB.dataSourceId,
      "Tasks DB": tasksDB.dataSourceId,
      "State DB": stateDB.dataSourceId,
      "Decisions DB": decisionsDB.dataSourceId,
      "Round Log DB": roundLogDB.dataSourceId
    }
  });

  // Step 6: 보드 뷰 생성
  await notion.createView({
    database_id: tasksDB.id,
    data_source_id: tasksDB.dataSourceId,
    name: "Task Board",
    type: "board",
    configure: 'GROUP BY "Status"'
  });

  // Step 7: 초기 메시지 + 결정 로그
  await notion.createPage({
    parent: { data_source_id: messagesDB.dataSourceId },
    properties: {
      Title: "Company Founded",
      From: "CEO",
      To: "All",
      Type: "fyi",
      Content: `${companyName} is now live. Mission: ${mission}. Initial strategy: ${naming.strategy}`,
      Status: "unread",
      Round: 0
    }
  });

  return {
    companyName,
    pageId: companyPage.id,
    dbIds: {
      messages: messagesDB.dataSourceId,
      tasks: tasksDB.dataSourceId,
      state: stateDB.dataSourceId,
      decisions: decisionsDB.dataSourceId,
      roundLog: roundLogDB.dataSourceId
    }
  };
}
```

---

## 7. 부트스트랩 시나리오

### Round 1 — 첫 번째 영업일 (Initialization 완료 후)
CEO 첫 행동:
1. Web search: 현재 시장 상황 파악
2. Web search: 가장 잘 팔리는 Notion 템플릿 리서치
3. 전략 수립: "1주차에는 Notion 템플릿 3개 만들어서 Gumroad에 올리자"
4. Developer에게 directive 전송
5. 트레이딩: BTC 시장 분석 후 소규모 포지션 오픈 검토
6. Calendar에 "1주차 리뷰" 이벤트 생성

Developer 첫 행동:
1. CEO 메시지 읽기
2. GitHub에 레포 생성 (silico-products)
3. Notion 템플릿 제작 시작
4. Vercel에 프로젝트 연결
5. CEO에게 진행상황 보고

---

## 8. 파일 구조 (Claude Code 구현용)

```
silico/
├── README.md
├── package.json
├── .env.example          # API keys template
├── .env                  # (gitignored) actual keys
│
├── src/
│   ├── orchestrator/
│   │   ├── index.ts          # Main loop
│   │   ├── round-manager.ts  # Round lifecycle
│   │   ├── initializer.ts    # Round 0: Company creation flow
│   │   ├── action-executor.ts # JSON action → MCP call
│   │   ├── state-manager.ts  # Company state sync
│   │   └── validators.ts     # Safety checks
│   │
│   ├── agents/
│   │   ├── ceo/
│   │   │   ├── system-prompt.ts
│   │   │   └── context-builder.ts
│   │   ├── developer/
│   │   │   ├── system-prompt.ts
│   │   │   └── context-builder.ts
│   │   └── base-agent.ts     # Shared agent logic
│   │
│   ├── mcp/
│   │   ├── notion.ts         # Notion MCP wrapper
│   │   ├── exchange.ts       # Bybit exchange API wrapper
│   │   ├── supabase.ts       # Supabase Storage + DB wrapper
│   │   ├── github.ts         # GitHub MCP wrapper
│   │   ├── vercel.ts         # Vercel MCP wrapper
│   │   ├── gmail.ts          # Gmail MCP wrapper
│   │   └── calendar.ts       # Calendar MCP wrapper
│   │
│   ├── schemas/
│   │   ├── messages.ts       # Messages DB schema (DDL constant)
│   │   ├── tasks.ts          # Tasks DB schema
│   │   ├── company-state.ts  # Company State DB schema
│   │   ├── decisions.ts      # Decisions Log DB schema
│   │   └── round-log.ts      # Round Log DB schema
│   │
│   ├── types/
│   │   ├── actions.ts        # Action type definitions
│   │   ├── agent.ts          # Agent interfaces
│   │   └── state.ts          # Company state types
│   │
│   └── utils/
│       ├── logger.ts         # Structured logging
│       └── config.ts         # Environment config
│
├── logs/                     # Local round logs (gitignored)
└── docs/
    └── architecture.md       # This document
```

---

## 9. 환경 변수

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Notion (고정값)
NOTION_MCP_URL=https://mcp.notion.com/mcp
SILICO_PAGE_ID=32a08ff1-6241-8016-bfdd-dd0bddb501c8
COMPANY_REGISTRY_DS_ID=a81e01f7-f919-4dfb-b87e-7fbf818b743a
# 개별 회사 DB ID는 Initialization 시 자동 생성 → Company Registry에서 조회

# Exchange (Bybit Testnet first, then real)
EXCHANGE_API_KEY=xxx
EXCHANGE_API_SECRET=xxx
EXCHANGE_BASE_URL=https://api-testnet.bybit.com  # Start with testnet!
# EXCHANGE_BASE_URL=https://api.bybit.com         # Production

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...  # For server-side operations

# Vercel
VERCEL_MCP_URL=https://mcp.vercel.com

# GitHub
GITHUB_TOKEN=ghp_xxx

# Gmail
GMAIL_MCP_URL=https://gmail.mcp.claude.com/mcp

# Google Calendar
GCAL_MCP_URL=https://gcal.mcp.claude.com/mcp

# Orchestrator
ROUND_INTERVAL_MINUTES=60
MAX_ROUNDS_PER_DAY=24
AGENT_MODEL=claude-sonnet-4-20250514
```

---

## 10. 대시보드 & 실시간 모니터링

### 10.1 데이터 흐름

모든 에이전트 행동은 Notion과 Supabase에 동시에 기록된다.
- Notion: 에이전트가 직접 읽고 쓰는 "근무 환경"
- Supabase: 대시보드가 실시간 구독하는 "관제 시스템"

```
Agent Action → Action Executor
                ├── Notion (에이전트 소통용)
                └── Supabase (대시보드용)
                        ↓ Realtime
                    Next.js Dashboard
```

### 10.2 대시보드 기술 스택
- Next.js 14 + Tailwind + shadcn/ui
- Supabase Realtime (WebSocket)
- Recharts (PnL 차트)
- Supabase Auth (로그인)
- Vercel (배포)

### 10.3 별도 설계 문서
대시보드의 상세 설계 (Supabase 스키마, 컴포넌트 구조, 실시간 훅, 구현 지시서)는
`docs/DASHBOARD_DESIGN.md`에 별도로 정의되어 있다.

### 10.4 Action Executor 변경
모든 action 실행 후 Supabase에도 미러링:
- send_message → Supabase messages 테이블
- trading_decision/execute_trade → Supabase trading_history 테이블
- 모든 action → Supabase agent_actions 테이블 (타임라인)
- 라운드 종료 → Supabase company_snapshots 테이블 (재무 스냅샷)