import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = body.companyId;
    const role = body.role;
    const name = body.name;
    const model = body.model;
    const personality = body.personality;
    const executionOrder = body.executionOrder ?? body.execution_order;
    const systemPrompt = body.systemPrompt ?? body.system_prompt;
    const toolNames = body.tools;

    if (!companyId || !role || !name) {
      return Response.json(
        { error: "companyId, role, and name are required" },
        { status: 400 }
      );
    }

    // Authenticate the user via their session cookie
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignored in route handlers
            }
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user owns this company
    const { data: company } = await supabase
      .from("companies")
      .select("id, user_id")
      .eq("id", companyId)
      .single();

    if (!company || company.user_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role client for writes (bypasses RLS)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Insert the new agent
    const insertData: Record<string, unknown> = {
      company_id: companyId,
      role,
      name,
    };
    if (model !== undefined) insertData.model = model;
    if (personality !== undefined) insertData.personality = personality;
    if (executionOrder !== undefined) insertData.execution_order = executionOrder;
    if (systemPrompt !== undefined) insertData.system_prompt = systemPrompt;

    const { data: agent, error: agentError } = await serviceClient
      .from("agents")
      .insert(insertData)
      .select("*")
      .single();

    if (agentError) {
      console.error("Failed to create agent:", agentError);
      return Response.json(
        { error: "Failed to create agent" },
        { status: 500 }
      );
    }

    // Assign tools if provided
    if (Array.isArray(toolNames) && toolNames.length > 0) {
      const { data: tools } = await serviceClient
        .from("tools")
        .select("id, name");

      const toolMap = new Map((tools ?? []).map((t) => [t.name, t.id]));

      for (const toolName of toolNames) {
        const toolId = toolMap.get(toolName);
        if (toolId) {
          await serviceClient
            .from("agent_tools")
            .insert({ agent_id: agent.id, tool_id: toolId });
        }
      }
    }

    return Response.json({ success: true, agentId: agent.id, agent });
  } catch (err) {
    console.error("Agent hire error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
