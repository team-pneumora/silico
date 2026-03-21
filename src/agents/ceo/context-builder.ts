import type { AgentContext } from "../../types/agent.js";

export function buildCeoContext(ctx: AgentContext): string {
  const positionsJson =
    ctx.companyState.open_positions.length > 0
      ? JSON.stringify(ctx.companyState.open_positions, null, 2)
      : "None";

  const unreadMessages =
    ctx.unreadMessages.length > 0
      ? ctx.unreadMessages
          .map(
            (m) =>
              `- [${m.type}] from ${m.from} (Round ${m.round}): ${m.content}`
          )
          .join("\n")
      : "No unread messages.";

  const pendingTasks =
    ctx.pendingTasks.length > 0
      ? ctx.pendingTasks
          .map(
            (t) =>
              `- [${t.priority}] ${t.title} (status: ${t.status}, due: round ${t.due_round})`
          )
          .join("\n")
      : "No pending tasks.";

  return `## Current Round Context

**Round**: ${ctx.currentRound}
**Date**: ${ctx.simulatedDate}

**Company State**:
- Treasury: $${ctx.companyState.treasury_usd}
- Trading Balance: $${ctx.companyState.trading_balance}
- Open Positions: ${positionsJson}
- Active Products: ${ctx.companyState.active_products.join(", ") || "None"}
- Total Revenue to Date: $${ctx.companyState.total_revenue}

**Unread Messages**:
${unreadMessages}

**Pending Tasks (assigned to you)**:
${pendingTasks}

**Last Round Summary**:
${ctx.lastRoundSummary || "This is the first round."}

---
Now it's your turn. Analyze the situation and take action.
Output your actions as a structured JSON array.`;
}
