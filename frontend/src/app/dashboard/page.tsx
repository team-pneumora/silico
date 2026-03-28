import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CompanyList } from "@/components/dashboard/CompanyList";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">My Companies</h1>
        <p className="text-neutral-400 mt-1">
          Monitor your AI-powered companies in real-time
        </p>
      </div>
      <CompanyList companies={companies ?? []} />
    </div>
  );
}
