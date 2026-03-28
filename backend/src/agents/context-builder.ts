import type { AgentContext } from "../types/agent.js";

/**
 * Build a context prompt string for any agent role.
 * Injects company state, messages, tasks, and team info.
 */
export function buildAgentContext(ctx: AgentContext): string {
  const sections: string[] = [];

  // 1. Round info
  sections.push(`## Current Round: ${ctx.currentRound}`);

  // 2. Your role
  sections.push(`## You Are: ${ctx.agentConfig.name} (${ctx.agentConfig.role})`);

  // 3. Team roster
  const teamList = ctx.allAgents
    .map((a) => `- ${a.name} (${a.role}) [${a.status}]`)
    .join("\n");
  sections.push(`## Team\n${teamList}`);

  // 4. Available tools
  const toolList = ctx.agentConfig.tools
    .map((t) => {
      const perms = [];
      if (t.permissions.read) perms.push("read");
      if (t.permissions.write) perms.push("write");
      return `- ${t.tool_name} [${perms.join(", ")}]`;
    })
    .join("\n");
  sections.push(`## Your Tools\n${toolList || "- (none)"}`);

  // 5. Company state
  const s = ctx.companyState;
  sections.push(`## Company State
- Treasury: $${s.treasury_usd.toFixed(2)}
- Trading Balance: $${s.trading_balance.toFixed(2)}
- Open Positions: ${s.open_positions.length > 0
    ? s.open_positions.map((p) => `${p.side} ${p.symbol} $${p.amount_usd} @${p.leverage}x`).join(", ")
    : "None"}
- Active Products: ${s.active_products}
- Total Revenue: $${s.total_revenue.toFixed(2)}`);

  // 6. Unread messages
  if (ctx.unreadMessages.length > 0) {
    const msgs = ctx.unreadMessages
      .map((m) => `[Round ${m.round}] ${m.from_role} → ${m.to_role ?? "All"} (${m.message_type}): ${m.content}`)
      .join("\n");
    sections.push(`## Unread Messages\n${msgs}`);
  } else {
    sections.push("## Unread Messages\nNone");
  }

  // 7. Pending tasks
  if (ctx.pendingTasks.length > 0) {
    const tasks = ctx.pendingTasks
      .map((t) => `- [${t.priority}] ${t.title} (id: ${t.id}) (${t.status})${t.description ? ": " + t.description : ""}`)
      .join("\n");
    sections.push(`## Your Pending Tasks\n${tasks}`);
  } else {
    sections.push("## Your Pending Tasks\nNone");
  }

  // 8. Trading guide + history (only for agents with exchange tool)
  const hasExchange = ctx.agentConfig.tools.some((t) => t.tool_name === "exchange");
  if (hasExchange) {
    sections.push(`## Trading Guide
You have access to the exchange. You SHOULD actively trade to grow the company's capital.
- Use check_positions to see current positions and balance
- Use trading_decision to open/close positions on BTCUSDT or ETHUSDT
- Symbols must be exact: "BTCUSDT" or "ETHUSDT"
- Max 30% of trading balance per position, leverage 1-10x
- Stop-loss required (1-5%), take_profit must be >= 2x stop_loss
- Do NOT just research and wait. If you see an opportunity, TRADE.
- Close losing positions early. Take profits on winners.
- WARNING: BTCUSDT may fail on testnet due to price limits. Prefer ETHUSDT for reliable execution.`);

    // Trading history feedback
    if (ctx.recentTrades.length > 0) {
      const trades = ctx.recentTrades
        .map((t) => `- R${t.round}: ${t.side} ${t.symbol} $${t.amount_usd} @${t.leverage}x` +
          (t.entry_price ? ` entry=$${t.entry_price}` : "") +
          (t.pnl != null ? ` P&L=$${t.pnl}` : "") +
          ` [${t.status}]`)
        .join("\n");
      sections.push(`## Recent Trading History\n${trades}`);
    } else {
      sections.push(`## Recent Trading History\nNo trades yet. You MUST open a position this round.`);
    }
  }

  // 9. Last round summary
  if (ctx.lastRoundSummary) {
    sections.push(`## Last Round Summary\n${ctx.lastRoundSummary}`);
  }

  // 9. Response format reminder
  sections.push(`## Response Format
Respond with a JSON object:
\`\`\`json
{
  "thinking": "your analysis and reasoning",
  "actions": [
    { "type": "action_type", ...params }
  ]
}
\`\`\`

Available action types:
- send_message: { to_role, message_type, content }
- create_task: { title, assignee_role, priority, description? }
- update_task: { task_id: "<uuid from task list above>", status: "todo"|"doing"|"done"|"blocked" }
- web_search: { query }
- trading_decision: { action: "open_long"|"open_short"|"close", symbol: "BTCUSDT"|"ETHUSDT", amount_usd: number, leverage: 1-10, stop_loss_pct: 1-5, take_profit_pct: 2-50 }
  Example: { "type": "trading_decision", "action": "open_long", "symbol": "BTCUSDT", "amount_usd": 20, "leverage": 3, "stop_loss_pct": 3, "take_profit_pct": 9 }
  Rules: max 30% of balance per trade, reward:risk >= 2:1, stop_loss required
- execute_trade: { directive_from, symbol, side: "long"|"short", amount_usd, leverage, stop_loss, take_profit }
- check_positions: {}
- github_create_repo: { name, description }
- vercel_deploy: { repo, framework }
- send_email: { to, subject, body }
- calendar_event: { title, date, description }
- log_decision: { decision, reasoning, category? }
- update_company_state: { changes }
- hire_agent: { role, name, template_id? }
- fire_agent: { agent_id, reason }`);

  return sections.join("\n\n");
}
