import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { JournalViewer } from "@/components/dashboard/JournalViewer";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function JournalPage({ params }: Props) {
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

  // Fetch active agents
  const { data: agents } = await supabase
    .from("agents")
    .select("id, role, name")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("execution_order");

  // Fetch journal entries
  const { data: journals } = await supabase
    .from("agent_journals")
    .select("*")
    .eq("company_id", companyId)
    .order("round", { ascending: false });

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/${companyId}`}
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Back to Dashboard"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-xl font-semibold text-white">Agent Journals</h1>
          </div>
          <span className="text-sm text-zinc-500">{company.name}</span>
        </div>

        {/* Journal viewer */}
        {agents && agents.length > 0 ? (
          <JournalViewer agents={agents} journals={journals ?? []} />
        ) : (
          <div className="text-center py-12 text-zinc-500">
            No active agents found.
          </div>
        )}
      </div>
    </div>
  );
}
