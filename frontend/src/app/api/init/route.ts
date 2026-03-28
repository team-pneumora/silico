import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  try {
    const { seedMoney = 100 } = await request.json();

    // ── 1. Authenticate user ──
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. CEO AI names the company ──
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const model = process.env.AGENT_MODEL ?? "claude-sonnet-4-20250514";

    const foundingResponse = await client.messages.create({
      model,
      max_tokens: 1024,
      system: "You are an AI entrepreneur founding a new AI-only company. Be creative and bold.",
      messages: [{
        role: "user",
        content: `You are founding a new AI company. Choose a creative, memorable name.
Define the mission. Outline your initial strategy for growing $${seedMoney} into a profitable business.
Respond ONLY with JSON:
{ "company_name": "...", "emoji": "...", "mission": "...", "strategy": "..." }`,
      }],
    });

    const foundingText = foundingResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text).join("");

    let founding: { company_name: string; emoji: string; mission: string; strategy: string };
    try {
      const jsonMatch = foundingText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, foundingText];
      founding = JSON.parse(jsonMatch[1]?.trim() ?? foundingText.trim());
    } catch {
      founding = {
        company_name: "Silico Ventures",
        emoji: "🚀",
        mission: "Build profitable digital products with AI",
        strategy: "Start with trading and digital products",
      };
    }

    // ── 3. Create company in Supabase ──
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: company, error: companyError } = await serviceClient
      .from("companies")
      .insert({
        user_id: user.id,
        name: founding.company_name,
        emoji: founding.emoji,
        mission: founding.mission,
        strategy: founding.strategy,
        seed_money: seedMoney,
        treasury_usd: seedMoney,
        trading_balance: seedMoney,
      })
      .select()
      .single();

    if (companyError) {
      return Response.json({ error: companyError.message }, { status: 500 });
    }

    // ── 4. Get default prompt templates ──
    const { data: templates } = await serviceClient
      .from("agent_prompt_templates")
      .select("*")
      .eq("is_default", true);

    const ceoTemplate = templates?.find((t) => t.role === "CEO");
    const devTemplate = templates?.find((t) => t.role === "Developer");

    // ── 5. Create agents ──
    const { data: ceo } = await serviceClient
      .from("agents")
      .insert({
        company_id: company.id,
        role: "CEO",
        name: `${founding.company_name} CEO`,
        system_prompt: ceoTemplate?.system_prompt ?? "You are the CEO.",
        execution_order: 0,
      })
      .select("id")
      .single();

    const { data: dev } = await serviceClient
      .from("agents")
      .insert({
        company_id: company.id,
        role: "Developer",
        name: `${founding.company_name} Developer`,
        system_prompt: devTemplate?.system_prompt ?? "You are the Developer.",
        execution_order: 10,
      })
      .select("id")
      .single();

    // ── 6. Assign tools ──
    const { data: tools } = await serviceClient.from("tools").select("id, name");
    const toolMap = new Map((tools ?? []).map((t) => [t.name, t.id]));

    const ceoTools = ceoTemplate?.default_tools ?? ["web_search", "exchange"];
    const devTools = devTemplate?.default_tools ?? ["web_search", "github", "vercel"];

    for (const toolName of ceoTools) {
      const toolId = toolMap.get(toolName);
      if (toolId && ceo) {
        await serviceClient.from("agent_tools").insert({ agent_id: ceo.id, tool_id: toolId });
      }
    }
    for (const toolName of devTools) {
      const toolId = toolMap.get(toolName);
      if (toolId && dev) {
        await serviceClient.from("agent_tools").insert({ agent_id: dev.id, tool_id: toolId });
      }
    }

    // ── 7. Founding message + decision + snapshot + round log ──
    if (ceo) {
      await serviceClient.from("messages").insert({
        company_id: company.id,
        round: 0,
        from_agent_id: ceo.id,
        from_role: "CEO",
        to_role: null,
        message_type: "system",
        content: `${founding.company_name} is live! Mission: ${founding.mission}. Strategy: ${founding.strategy}`,
      });

      await serviceClient.from("decisions").insert({
        company_id: company.id,
        round: 0,
        agent_id: ceo.id,
        agent_role: "CEO",
        decision: `Company founded: ${founding.company_name}`,
        reasoning: `${founding.mission} — ${founding.strategy}`,
        category: "strategy",
      });
    }

    await serviceClient.from("company_snapshots").insert({
      company_id: company.id,
      round: 0,
      treasury_usd: seedMoney,
      trading_balance: seedMoney,
      active_products: 0,
      total_revenue: 0,
      total_pnl: 0,
      agent_count: 2,
    });

    await serviceClient.from("round_logs").insert({
      company_id: company.id,
      round_number: 0,
      agent_summaries: { CEO: "Founded company", Developer: "N/A (Round 0)" },
      ai_summary: `${founding.company_name} founded with $${seedMoney}. ${founding.mission}`,
      treasury_snapshot: seedMoney,
      trading_snapshot: seedMoney,
      duration_seconds: 0,
    });

    return Response.json({ companyId: company.id, name: founding.company_name });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
