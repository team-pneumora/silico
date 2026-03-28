import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { TeamManager } from "@/components/dashboard/TeamManager";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function TeamPage({ params }: Props) {
  const { companyId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch company
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();

  if (!company) notFound();

  // Fetch all agents (including inactive/fired for history)
  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .eq("company_id", companyId)
    .order("execution_order");

  // Fetch prompt templates
  const { data: templates } = await supabase
    .from("prompt_templates")
    .select("id, role, name, system_prompt, default_tools, description")
    .order("role");

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <TeamManager
        companyId={companyId}
        agents={agents ?? []}
        templates={templates ?? []}
      />
    </div>
  );
}
