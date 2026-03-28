import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { CompanyHeader } from "@/components/dashboard/CompanyHeader";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { AgentChat } from "@/components/dashboard/AgentChat";
import { OpenPositions } from "@/components/dashboard/OpenPositions";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { PnlChart } from "@/components/dashboard/PnlChart";
import { CompanyControls } from "@/components/dashboard/CompanyControls";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function CompanyDashboardPage({ params }: Props) {
  const { companyId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch company
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company) notFound();

  // Fetch agents
  const { data: agents } = await supabase
    .from("agents")
    .select("id, role, name, status, execution_order")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("execution_order");

  // Fetch latest snapshot
  const { data: snapshots } = await supabase
    .from("company_snapshots")
    .select("*")
    .eq("company_id", companyId)
    .order("round", { ascending: true });

  // Fetch initial messages
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch open positions
  const { data: positions } = await supabase
    .from("trading_history")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "open");

  // Fetch recent actions
  const { data: actions } = await supabase
    .from("agent_actions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  const latestSnapshot = snapshots?.[snapshots.length - 1];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
        <Link
          href={`/dashboard/${companyId}/journal`}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Agent Journals"
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
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            <path d="M8 7h6" />
            <path d="M8 11h8" />
          </svg>
        </Link>
        <Link
          href={`/dashboard/${companyId}/board`}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Shared Board"
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
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M12 11h4" />
            <path d="M12 16h4" />
            <path d="M8 11h.01" />
            <path d="M8 16h.01" />
          </svg>
        </Link>
        <Link
          href={`/dashboard/${companyId}/team`}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Team"
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
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </Link>
        <Link
          href={`/dashboard/${companyId}/settings`}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Settings"
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
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
        </div>
        <CompanyHeader
          company={company}
          agents={agents ?? []}
        />
      </div>

      {/* Controls */}
      <CompanyControls
        companyId={companyId}
        status={company.status}
        round={company.current_round}
      />

      {/* Metric Cards */}
      <MetricCards
        company={company}
        snapshot={latestSnapshot ?? null}
      />

      {/* PnL Chart */}
      <PnlChart snapshots={snapshots ?? []} />

      {/* Main Grid: Chat + Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentChat
          companyId={companyId}
          initialMessages={(messages ?? []).reverse()}
        />
        <OpenPositions
          companyId={companyId}
          initialTrades={positions ?? []}
        />
      </div>

      {/* Activity Timeline */}
      <ActivityTimeline
        companyId={companyId}
        initialActions={actions ?? []}
      />
    </div>
  );
}
