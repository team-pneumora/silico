import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;

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

    // Set status to 'active'
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { error } = await serviceClient
      .from("companies")
      .update({ status: "active" })
      .eq("id", companyId);

    if (error) {
      console.error("Failed to resume company:", error);
      return Response.json(
        { error: "Failed to resume company" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Company resume error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
