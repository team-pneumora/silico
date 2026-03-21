import type { AgentContext } from "../../types/agent.js";

export function buildDeveloperContext(ctx: AgentContext): string {
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

  const openOrders =
    ctx.companyState.open_positions.length > 0
      ? ctx.companyState.open_positions
          .map(
            (p) =>
              `- ${p.symbol} ${p.side} $${p.amount_usd} @ ${p.entry_price} (SL: ${p.stop_loss}, TP: ${p.take_profit})`
          )
          .join("\n")
      : "No open orders.";

  return `## Current Round Context

**Round**: ${ctx.currentRound}
**Date**: ${ctx.simulatedDate}

**Unread Messages**:
${unreadMessages}

**My Pending Tasks**:
${pendingTasks}

**Active Deployments**:
(check Vercel for latest)

**Open Trade Orders** (for monitoring):
${openOrders}

**Last Round Summary**:
${ctx.lastRoundSummary || "This is the first round."}

---
Now it's your turn. Check your messages and tasks, then execute.
Output your actions as a structured JSON array.`;
}
