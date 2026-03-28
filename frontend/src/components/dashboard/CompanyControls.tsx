"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CompanyControlsProps {
  companyId: string;
  status: string;
  round: number;
}

export function CompanyControls({ companyId, status: initialStatus, round }: CompanyControlsProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [message, setMessage] = useState("");
  const [currentStatus, setCurrentStatus] = useState(initialStatus);

  async function handleRunRound() {
    setRunning(true);
    setMessage("Running round...");

    try {
      const res = await fetch(`/api/company/${companyId}/run`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setMessage(`Round ${data.round} complete (${data.duration}s)`);
      router.refresh();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  async function handlePause() {
    setPausing(true);
    setMessage("");
    try {
      const res = await fetch(`/api/company/${companyId}/pause`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to pause");
      setCurrentStatus("paused");
      setMessage("Paused");
      router.refresh();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPausing(false);
    }
  }

  async function handleResume() {
    setPausing(true);
    setMessage("");
    try {
      const res = await fetch(`/api/company/${companyId}/resume`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resume");
      setCurrentStatus("active");
      setMessage("Resumed");
      router.refresh();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPausing(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Are you sure you want to archive this company?")) return;
    try {
      const res = await fetch(`/api/company/${companyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive");
      router.push("/dashboard");
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const isActive = currentStatus === "active";
  const isPaused = currentStatus === "paused";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Run Round */}
      <Button
        onClick={handleRunRound}
        disabled={running || !isActive}
        className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm gap-2"
        size="sm"
      >
        {running ? (
          <>
            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Running...
          </>
        ) : (
          <>
            <span>▶</span>
            Run Round {round}
          </>
        )}
      </Button>

      {/* Pause / Resume */}
      {isActive ? (
        <Button
          onClick={handlePause}
          disabled={pausing}
          variant="outline"
          size="sm"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm gap-2"
        >
          <span>⏸</span> Pause
        </Button>
      ) : isPaused ? (
        <Button
          onClick={handleResume}
          disabled={pausing}
          variant="outline"
          size="sm"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm gap-2"
        >
          <span>▶</span> Resume
        </Button>
      ) : null}

      {/* Archive */}
      <Button
        onClick={handleArchive}
        variant="outline"
        size="sm"
        className="border-zinc-700 text-zinc-500 hover:bg-red-950 hover:text-red-400 hover:border-red-800 text-sm gap-2"
      >
        <span>📦</span> Archive
      </Button>

      {/* Status message */}
      {message && (
        <span className={`text-xs ${message.startsWith("Error") ? "text-red-400" : "text-zinc-400"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
