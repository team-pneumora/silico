import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();

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

    // Use service role client for reads that need to join across tables
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get agent and verify user owns the company
    const { data: agent } = await serviceClient
      .from("agents")
      .select("id, company_id")
      .eq("id", agentId)
      .single();

    if (!agent) {
      return Response.json({ error: "Agent not found" }, { status: 404 });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id, user_id")
      .eq("id", agent.company_id)
      .single();

    if (!company || company.user_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build update payload — only allow specific fields
    const allowedFields = [
      "name",
      "model",
      "personality",
      "execution_order",
      "system_prompt",
      "max_tokens",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { error } = await serviceClient
      .from("agents")
      .update(updateData)
      .eq("id", agentId);

    if (error) {
      console.error("Failed to update agent:", error);
      return Response.json(
        { error: "Failed to update agent" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Agent PATCH error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

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

    // Use service role client for reads that need to join across tables
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get agent and verify user owns the company
    const { data: agent } = await serviceClient
      .from("agents")
      .select("id, company_id")
      .eq("id", agentId)
      .single();

    if (!agent) {
      return Response.json({ error: "Agent not found" }, { status: 404 });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id, user_id")
      .eq("id", agent.company_id)
      .single();

    if (!company || company.user_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete: set status to 'fired'
    const { error } = await serviceClient
      .from("agents")
      .update({ status: "fired" })
      .eq("id", agentId);

    if (error) {
      console.error("Failed to fire agent:", error);
      return Response.json(
        { error: "Failed to fire agent" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Agent DELETE error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
