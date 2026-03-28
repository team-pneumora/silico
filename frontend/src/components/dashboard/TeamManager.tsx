"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface TeamAgent {
  id: string;
  company_id: string;
  role: string;
  name: string;
  status: "active" | "inactive" | "fired";
  execution_order: number;
  created_at: string;
  model?: string;
  personality?: string;
  system_prompt?: string;
  max_tokens?: number;
}

interface PromptTemplate {
  id: string;
  role: string;
  name: string;
  system_prompt: string;
  default_tools: string[];
  description: string;
}

interface Props {
  companyId: string;
  agents: TeamAgent[];
  templates: PromptTemplate[];
}

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
  CEO: "bg-amber-600",
  Developer: "bg-blue-600",
  Trader: "bg-green-600",
  Marketer: "bg-pink-600",
  Analyst: "bg-purple-600",
  Custom: "bg-neutral-600",
};

const ROLE_OPTIONS = ["CEO", "Developer", "Trader", "Marketer", "Analyst", "Custom"];

const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-haiku-4-5-20250414", label: "Claude Haiku 4.5" },
];

const TOOL_OPTIONS = [
  "web_search",
  "exchange",
  "github",
  "vercel",
  "notion",
  "gmail",
  "calendar",
];

type FormMode = "idle" | "hire" | "edit";

interface AgentForm {
  role: string;
  name: string;
  model: string;
  personality: string;
  execution_order: number;
  tools: string[];
  system_prompt: string;
}

const EMPTY_FORM: AgentForm = {
  role: "",
  name: "",
  model: "claude-sonnet-4-20250514",
  personality: "",
  execution_order: 1,
  tools: [],
  system_prompt: "",
};

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function TeamManager({ companyId, agents: initialAgents, templates }: Props) {
  const router = useRouter();
  const [agents, setAgents] = useState<TeamAgent[]>(initialAgents);
  const [mode, setMode] = useState<FormMode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fireTarget, setFireTarget] = useState<TeamAgent | null>(null);

  // ---- helpers ----

  function getRoleColor(role: string) {
    return ROLE_COLORS[role] ?? ROLE_COLORS.Custom;
  }

  function getRoleInitial(role: string) {
    return role.charAt(0).toUpperCase();
  }

  function applyTemplate(role: string) {
    const tpl = templates.find((t) => t.role.toLowerCase() === role.toLowerCase());
    if (tpl) {
      setForm((f) => ({
        ...f,
        role,
        system_prompt: tpl.system_prompt,
        tools: [...tpl.default_tools],
      }));
    } else {
      setForm((f) => ({ ...f, role }));
    }
  }

  function openHireForm() {
    setForm({ ...EMPTY_FORM, execution_order: agents.length + 1 });
    setEditingId(null);
    setError(null);
    setMode("hire");
  }

  function openEditForm(agent: TeamAgent) {
    setForm({
      role: agent.role,
      name: agent.name,
      model: agent.model ?? "claude-sonnet-4-20250514",
      personality: agent.personality ?? "",
      execution_order: agent.execution_order,
      tools: [],
      system_prompt: agent.system_prompt ?? "",
    });
    setEditingId(agent.id);
    setError(null);
    setMode("edit");
  }

  function closeForm() {
    setMode("idle");
    setEditingId(null);
    setError(null);
  }

  function toggleTool(tool: string) {
    setForm((f) => ({
      ...f,
      tools: f.tools.includes(tool)
        ? f.tools.filter((t) => t !== tool)
        : [...f.tools, tool],
    }));
  }

  // ---- API calls ----

  async function handleHire() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to hire agent");
      // Add to local state immediately
      if (data.agent) {
        setAgents((prev) => [...prev, data.agent]);
      }
      closeForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update agent");
      setAgents((prev) => prev.map((a) => a.id === editingId ? { ...a, ...form } : a));
      closeForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleFire() {
    if (!fireTarget) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/${fireTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fire agent");
      setAgents((prev) => prev.filter((a) => a.id !== fireTarget.id));
      setFireTarget(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  // ---- render ----

  const activeAgents = agents.filter((a) => a.status === "active");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href={`/dashboard/${companyId}`}
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Dashboard
      </Link>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Team Management</h1>
        <p className="text-neutral-400 text-sm mt-1">
          {activeAgents.length} active agent{activeAgents.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeAgents.map((agent) => (
          <Card key={agent.id} className="bg-[#111] border-zinc-800">
            <CardContent className="p-5 space-y-4">
              {/* Top row: avatar + info */}
              <div className="flex items-start gap-3">
                <Avatar size="lg">
                  <AvatarFallback
                    className={`${getRoleColor(agent.role)} text-white font-semibold`}
                  >
                    {getRoleInitial(agent.role)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">{agent.name}</h3>
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" title="Active" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={`mt-1 text-[10px] px-1.5 ${getRoleColor(agent.role)} text-white border-0`}
                  >
                    {agent.role}
                  </Badge>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1 text-xs text-neutral-400">
                {agent.model && (
                  <p>
                    <span className="text-neutral-500">Model:</span>{" "}
                    {MODEL_OPTIONS.find((m) => m.value === agent.model)?.label ?? agent.model}
                  </p>
                )}
                <p>
                  <span className="text-neutral-500">Order:</span> {agent.execution_order}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 h-8 text-xs border-zinc-700 text-neutral-300 hover:text-white hover:bg-zinc-800"
                  onClick={() => openEditForm(agent)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-8 text-xs border-zinc-700 text-red-400 hover:text-red-300 hover:bg-red-950/30 hover:border-red-800"
                  onClick={() => setFireTarget(agent)}
                >
                  Fire
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Hire Agent Card */}
        <Card
          className="bg-[#111] border-zinc-800 border-dashed cursor-pointer hover:border-zinc-600 transition-colors"
          onClick={() => mode === "idle" && openHireForm()}
        >
          <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[180px] text-neutral-500 hover:text-neutral-300 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <span className="mt-2 text-sm font-medium">+ Hire Agent</span>
          </CardContent>
        </Card>
      </div>

      {/* ---- Hire / Edit Form ---- */}
      {(mode === "hire" || mode === "edit") && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white">
              {mode === "hire" ? "Hire New Agent" : "Edit Agent"}
            </h2>

            {/* Role */}
            <div className="space-y-2">
              <Label className="text-neutral-300">Role</Label>
              <select
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value;
                  setForm((f) => ({ ...f, role }));
                  applyTemplate(role);
                }}
                className="w-full h-9 rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
                disabled={loading}
              >
                <option value="">Select a role...</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-neutral-300">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Alex"
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                disabled={loading}
              />
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label className="text-neutral-300">Model</Label>
              <div className="flex flex-wrap gap-3">
                {MODEL_OPTIONS.map((m) => (
                  <label
                    key={m.value}
                    className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                      form.model === m.value
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={m.value}
                      checked={form.model === m.value}
                      onChange={() => setForm((f) => ({ ...f, model: m.value }))}
                      className="sr-only"
                      disabled={loading}
                    />
                    <span
                      className={`w-3 h-3 rounded-full border-2 ${
                        form.model === m.value
                          ? "border-blue-500 bg-blue-500"
                          : "border-neutral-500"
                      }`}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Personality */}
            <div className="space-y-2">
              <Label className="text-neutral-300">Personality</Label>
              <textarea
                value={form.personality}
                onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))}
                placeholder="e.g. Aggressive trader, risk-tolerant..."
                rows={2}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 resize-none"
                disabled={loading}
              />
            </div>

            {/* Execution Order */}
            <div className="space-y-2">
              <Label className="text-neutral-300">Execution Order</Label>
              <Input
                type="number"
                min={1}
                value={form.execution_order}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    execution_order: parseInt(e.target.value) || 1,
                  }))
                }
                className="bg-neutral-800 border-neutral-700 text-white w-24"
                disabled={loading}
              />
            </div>

            {/* Tools */}
            <div className="space-y-2">
              <Label className="text-neutral-300">Tools</Label>
              <div className="flex flex-wrap gap-2">
                {TOOL_OPTIONS.map((tool) => (
                  <label
                    key={tool}
                    className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      form.tools.includes(tool)
                        ? "border-emerald-600 bg-emerald-600/10 text-emerald-400"
                        : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.tools.includes(tool)}
                      onChange={() => toggleTool(tool)}
                      className="sr-only"
                      disabled={loading}
                    />
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                        form.tools.includes(tool)
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-neutral-500"
                      }`}
                    >
                      {form.tools.includes(tool) && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-white"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    {tool}
                  </label>
                ))}
              </div>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <Label className="text-neutral-300">System Prompt</Label>
              <textarea
                value={form.system_prompt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, system_prompt: e.target.value }))
                }
                placeholder="System prompt for this agent..."
                rows={6}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 resize-y"
                disabled={loading}
              />
              {form.role && templates.find((t) => t.role.toLowerCase() === form.role.toLowerCase()) && (
                <p className="text-xs text-neutral-500">
                  Auto-filled from {form.role} template. Feel free to edit.
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={closeForm}
                disabled={loading}
                className="border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800"
              >
                Cancel
              </Button>
              <Button
                onClick={mode === "hire" ? handleHire : handleUpdate}
                disabled={loading || !form.role || !form.name}
              >
                {loading
                  ? mode === "hire"
                    ? "Hiring..."
                    : "Saving..."
                  : mode === "hire"
                  ? "Hire Agent"
                  : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Fire Confirmation Dialog ---- */}
      {fireTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-sm mx-4">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Fire Agent?</h3>
              <p className="text-sm text-neutral-400">
                Are you sure you want to fire{" "}
                <span className="text-white font-medium">{fireTarget.name}</span> (
                {fireTarget.role})? This action will deactivate the agent.
              </p>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFireTarget(null);
                    setError(null);
                  }}
                  disabled={loading}
                  className="border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleFire}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {loading ? "Firing..." : "Fire Agent"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
