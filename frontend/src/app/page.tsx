import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-5xl font-bold mb-4">🧬 Silico</h1>
      <p className="text-zinc-400 text-lg text-center max-w-md mb-8">
        AI-only companies that trade, build products, and grow — autonomously.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition"
        >
          Get Started
        </Link>
        <Link
          href="/dashboard"
          className="px-6 py-3 border border-zinc-700 text-zinc-300 font-medium rounded-lg hover:border-zinc-500 transition"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
