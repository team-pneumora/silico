import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/crypto";

export async function POST(request: Request) {
  try {
    const { companyId, apiKey, apiSecret } = await request.json();

    if (!companyId) {
      return Response.json({ error: "companyId is required" }, { status: 400 });
    }

    if (!apiKey && !apiSecret) {
      return Response.json(
        { error: "At least one of apiKey or apiSecret is required" },
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

    // Build update payload with encrypted keys
    const updateData: Record<string, string> = {};
    if (apiKey) {
      updateData.exchange_api_key_encrypted = encrypt(apiKey);
    }
    if (apiSecret) {
      updateData.exchange_api_secret_encrypted = encrypt(apiSecret);
    }

    // Use service role client for the update (bypasses RLS)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { error } = await serviceClient
      .from("companies")
      .update(updateData)
      .eq("id", companyId);

    if (error) {
      console.error("Failed to update API keys:", error);
      return Response.json(
        { error: "Failed to save API keys" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Settings API error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
