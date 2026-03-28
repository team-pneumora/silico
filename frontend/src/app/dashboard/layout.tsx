import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import type { Company } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, emoji, status, current_round, treasury_usd")
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111] border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <Link href="/dashboard" className="text-lg font-bold">
            🧬 Silico
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="text-xs text-zinc-500 uppercase tracking-wide px-2 mb-2">
            Companies
          </p>
          {(companies as Company[] | null)?.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/${c.id}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition"
            >
              <span>{c.emoji}</span>
              <span className="truncate flex-1">{c.name}</span>
              <span className="text-xs text-zinc-500">R{c.current_round}</span>
            </Link>
          ))}

          <Link
            href="/dashboard/new"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition"
          >
            <span>+</span>
            <span>New Company</span>
          </Link>
        </nav>

        <div className="p-3 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 mb-2 truncate">
            {user?.email}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
