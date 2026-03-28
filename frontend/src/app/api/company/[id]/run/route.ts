import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const model = process.env.AGENT_MODEL ?? "claude-sonnet-4-20250514";

/**
 * POST /api/company/[id]/run
 * Execute a single round for a company.
 * Runs each active agent in execution_order, stores results in Supabase.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;

    // ── Auth ──
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (!company || company.user_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (company.status !== "active") {
      return Response.json({ error: "Company is not active" }, { status: 400 });
    }

    const db = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const round = company.current_round;
    const startTime = Date.now();

    // ── Load agents ──
    const { data: agents } = await db
      .from("agents")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("execution_order");

    if (!agents || agents.length === 0) {
      return Response.json({ error: "No active agents" }, { status: 400 });
    }

    // ── Run each agent ──
    const agentSummaries: Record<string, string> = {};

    for (const agent of agents) {
      // Get unread messages for this agent
      const { data: messages } = await db
        .from("messages")
        .select("*")
        .eq("company_id", companyId)
        .or(`to_role.eq.${agent.role},to_role.is.null`)
        .eq("status", "unread")
        .order("created_at");

      // Get pending tasks
      const { data: tasks } = await db
        .from("tasks")
        .select("*")
        .eq("company_id", companyId)
        .or(`assignee_role.eq.${agent.role},assignee_role.is.null`)
        .in("status", ["todo", "doing"])
        .order("created_at");

      // Load this agent's tools
      const { data: agentToolRows } = await db
        .from("agent_tools")
        .select("tool_id, permissions, tools(name, description)")
        .eq("agent_id", agent.id);

      const agentTools = (agentToolRows ?? []).map((row: any) => ({
        name: row.tools?.name ?? "unknown",
        description: row.tools?.description ?? "",
        permissions: row.permissions,
      }));

      // Fetch this agent's recent journal entries (long-term memory)
      const { data: journalEntries } = await db
        .from("agent_journals")
        .select("title, content, round, tags")
        .eq("agent_id", agent.id)
        .order("round", { ascending: false })
        .limit(10);

      // Fetch shared board posts (team knowledge base)
      const { data: boardPosts } = await db
        .from("shared_board")
        .select("title, content, author_role, category, round, pinned")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch additional context for CEO: recent decisions + last round summary
      let recentDecisions = "";
      let lastRoundSummary = "";

      if (agent.role === "CEO") {
        const { data: decisions } = await db
          .from("decisions")
          .select("decision, reasoning, category, round")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (decisions && decisions.length > 0) {
          recentDecisions = decisions
            .map((d) => `- [R${d.round}] ${d.decision} (${d.category})`)
            .join("\n");
        }

        const { data: lastLog } = await db
          .from("round_logs")
          .select("ai_summary, round_number")
          .eq("company_id", companyId)
          .order("round_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastLog) {
          lastRoundSummary = `Round ${lastLog.round_number}: ${lastLog.ai_summary}`;
        }
      }

      // Build context with full self-awareness
      const context = `
## You Are
- Name: ${agent.name}
- Role: ${agent.role}
- Company: ${company.name} (${company.emoji ?? ""})
- Model: ${agent.model ?? model}

## Company Identity
- Type: ${(company as any).company_type ?? "full_stack"}
- Mission: ${company.mission ?? "Not defined"}
- Strategy: ${company.strategy ?? "Not defined"}
- Founded with: $${company.seed_money} seed money
${agent.role === "CEO" ? `
## Your Recent Decisions
${recentDecisions || "No decisions logged yet — this may be the first round."}

## Last Round Summary
${lastRoundSummary || "No previous rounds — this is the beginning."}
` : ""}
## Company State
- Round: ${round}
- Treasury: $${company.treasury_usd}
- Trading Balance: $${company.trading_balance}
- Total Revenue: $${company.total_revenue}

## Your Available Tools
${agentTools.length > 0 ? agentTools.map((t: any) => `- ${t.name}: ${t.description} (${t.permissions?.write ? "read/write" : "read-only"})`).join("\n") : "No external tools assigned"}

## Available Actions
You can use these actions in your response:
- send_message: Send a message to another team member (to_role, message_type, content)
- create_task: Create a task for someone (title, assignee_role, priority, description)
- update_task: Update task status (task_id, status)
- log_decision: Log an important decision (decision, reasoning, category)
- write_journal: Write to your personal work journal for future reference (title, content, tags[])
- post_to_board: Post to the shared team board (title, content, category: general|research|strategy|technical|trading|report)
${agentTools.some((t: any) => t.name === "web_search") ? "- web_search: Search the web (query)" : ""}
${agentTools.some((t: any) => t.name === "exchange") ? "- trading_decision: Make a trading decision (action, symbol, amount_usd, leverage, stop_loss_pct, take_profit_pct)\n- check_positions: Check open positions" : ""}

## Unread Messages
${(messages ?? []).map((m) => `[${m.from_role}→${m.to_role ?? "All"}] ${m.content}`).join("\n") || "None"}

## Pending Tasks
${(tasks ?? []).map((t) => `[${t.priority}] ${t.title} — assigned to ${t.assignee_role ?? "unassigned"} (${t.status})`).join("\n") || "None"}

## Team
${agents.map((a) => `- ${a.name} (${a.role})${a.id === agent.id ? " ← YOU" : ""}`).join("\n")}

## Your Journal (Past Notes)
${(journalEntries ?? []).length > 0
  ? (journalEntries ?? []).map((j: any) => `[R${j.round}] **${j.title}**: ${j.content.slice(0, 300)}${j.content.length > 300 ? "..." : ""}`).join("\n\n")
  : "No journal entries yet. Use write_journal to save notes for future rounds."}

## Shared Board (Team Knowledge Base)
${(boardPosts ?? []).length > 0
  ? (boardPosts ?? []).map((p: any) => `${p.pinned ? "📌 " : ""}[${p.category}] ${p.author_role} (R${p.round}): **${p.title}** — ${p.content.slice(0, 200)}${p.content.length > 200 ? "..." : ""}`).join("\n\n")
  : "Board is empty. Use post_to_board to share knowledge with your team."}
`;

      // Call Claude
      try {
        const response = await anthropic.messages.create({
          model: agent.model ?? model,
          max_tokens: agent.max_tokens ?? 4096,
          system: agent.system_prompt,
          messages: [{ role: "user", content: context }],
        });

        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text).join("");

        // Parse actions
        let parsed: { thinking?: string; actions?: Array<Record<string, unknown>> } = { thinking: text, actions: [] };
        try {
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
          parsed = JSON.parse(jsonMatch[1]?.trim() ?? text.trim());
        } catch {}

        agentSummaries[agent.role] = parsed.thinking?.slice(0, 200) ?? "No thinking";

        // Execute actions
        for (const action of parsed.actions ?? []) {
          const actionType = action.type as string;

          // Log action to timeline
          await db.from("agent_actions").insert({
            company_id: companyId,
            round,
            agent_id: agent.id,
            agent_role: agent.role,
            action_type: actionType,
            description: describeAction(agent.role, action),
            status: "success",
          });

          // Handle specific actions
          switch (actionType) {
            case "send_message":
              await db.from("messages").insert({
                company_id: companyId,
                round,
                from_agent_id: agent.id,
                from_role: agent.role,
                to_role: action.to_role ?? action.to ?? null,
                message_type: action.message_type ?? "fyi",
                content: action.content as string,
              });
              break;

            case "create_task":
              await db.from("tasks").insert({
                company_id: companyId,
                title: action.title as string,
                description: (action.description as string) ?? null,
                assignee_role: action.assignee_role ?? action.assignee ?? null,
                priority: action.priority ?? "P2",
                due_round: action.due_round ?? null,
                round_created: round,
              });
              break;

            case "update_task":
              if (action.task_id) {
                await db.from("tasks")
                  .update({ status: action.status as string })
                  .eq("id", action.task_id);
              }
              break;

            case "log_decision":
              await db.from("decisions").insert({
                company_id: companyId,
                round,
                agent_id: agent.id,
                agent_role: agent.role,
                decision: action.decision as string,
                reasoning: action.reasoning as string ?? null,
                category: ["trading", "product", "strategy", "technical", "hiring", "other"].includes(action.category as string)
                  ? action.category
                  : "other",
              });
              break;

            case "web_search":
              // Execute web search via Claude
              try {
                const searchRes = await anthropic.messages.create({
                  model,
                  max_tokens: 1024,
                  messages: [{ role: "user", content: `Search the web for: ${action.query}` }],
                  tools: [{ type: "web_search_20250305", name: "web_search" }],
                });
                const searchText = searchRes.content
                  .filter((b): b is Anthropic.TextBlock => b.type === "text")
                  .map((b) => b.text).join("");

                await db.from("agent_actions").insert({
                  company_id: companyId,
                  round,
                  agent_id: agent.id,
                  agent_role: agent.role,
                  action_type: "web_search_result",
                  description: `searched: "${action.query}"`,
                  result: { summary: searchText.slice(0, 500) },
                  status: "success",
                });
              } catch {}
              break;

            case "write_journal":
              await db.from("agent_journals").insert({
                company_id: companyId,
                agent_id: agent.id,
                agent_role: agent.role,
                round,
                title: action.title as string,
                content: action.content as string,
                tags: Array.isArray(action.tags) ? action.tags : [],
              });
              break;

            case "post_to_board":
              await db.from("shared_board").insert({
                company_id: companyId,
                author_agent_id: agent.id,
                author_role: agent.role,
                round,
                title: action.title as string,
                content: action.content as string,
                category: ["general", "research", "strategy", "technical", "trading", "report"].includes(action.category as string)
                  ? action.category
                  : "general",
              });
              break;
          }
        }

        // Mark messages as read
        if (messages && messages.length > 0) {
          await db.from("messages")
            .update({ status: "read" })
            .in("id", messages.map((m) => m.id));
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        agentSummaries[agent.role] = `Error: ${msg}`;

        await db.from("agent_actions").insert({
          company_id: companyId,
          round,
          agent_id: agent.id,
          agent_role: agent.role,
          action_type: "agent_error",
          description: `Agent failed: ${msg.slice(0, 200)}`,
          status: "failed",
        });
      }
    }

    // ── Write round log + snapshot ──
    const durationSec = Math.round((Date.now() - startTime) / 1000);

    await db.from("round_logs").insert({
      company_id: companyId,
      round_number: round,
      agent_summaries: agentSummaries,
      ai_summary: Object.entries(agentSummaries).map(([k, v]) => `${k}: ${v}`).join(" | "),
      treasury_snapshot: company.treasury_usd,
      trading_snapshot: company.trading_balance,
      duration_seconds: durationSec,
    });

    await db.from("company_snapshots").insert({
      company_id: companyId,
      round,
      treasury_usd: company.treasury_usd,
      trading_balance: company.trading_balance,
      active_products: 0,
      total_revenue: company.total_revenue,
      total_pnl: 0,
      agent_count: agents.length,
    });

    // ── Advance round ──
    await db.from("companies")
      .update({ current_round: round + 1 })
      .eq("id", companyId);

    return Response.json({
      success: true,
      round,
      duration: durationSec,
      summaries: agentSummaries,
    });

  } catch (err) {
    console.error("Run round error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function describeAction(role: string, action: Record<string, unknown>): string {
  const type = action.type as string;
  switch (type) {
    case "send_message":
    case "message":
      return `sent ${action.message_type ?? "message"} to ${action.to_role ?? action.to ?? "All"}`;
    case "create_task":
    case "task":
      return `created task "${action.title}" for ${action.assignee_role ?? action.assignee ?? "team"}`;
    case "update_task":
    case "task_update":
      return `updated task status to ${action.status}`;
    case "web_search":
    case "search":
      return `searched: "${action.query}"`;
    case "log_decision":
    case "decision":
      return `logged decision: ${(action.decision as string)?.slice(0, 80)}`;
    case "trading_decision":
    case "trade":
      return `trading: ${action.action} ${action.symbol}`;
    case "check_positions":
      return "checked open positions";
    case "write_journal":
      return `wrote journal: "${action.title}"`;
    case "post_to_board":
      return `posted to board: "${action.title}" [${action.category ?? "general"}]`;
    case "design_architecture":
      return `designed architecture: ${(action.description as string)?.slice(0, 80) ?? type}`;
    default:
      // Try to extract a meaningful description
      if (action.content) return `${type}: ${(action.content as string).slice(0, 80)}`;
      if (action.description) return `${type}: ${(action.description as string).slice(0, 80)}`;
      return type;
  }
}
