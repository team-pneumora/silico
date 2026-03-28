"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ───────────────────────── types ───────────────────────── */

type CompanyType = "trading" | "saas" | "content" | "fullstack";

interface CompanyPreset {
  type: CompanyType;
  icon: string;
  name: string;
  description: string;
  agents: string[];
  defaultSeed: number;
  tools: string[];
  hasExchange: boolean;
}

/* ───────────────────────── data ────────────────────────── */

const PRESETS: CompanyPreset[] = [
  {
    type: "trading",
    icon: "📈",
    name: "Trading Firm",
    description: "AI trading company focused on crypto futures",
    agents: ["CEO", "Trader"],
    defaultSeed: 500,
    tools: ["Web Search", "Exchange"],
    hasExchange: true,
  },
  {
    type: "saas",
    icon: "💻",
    name: "SaaS Startup",
    description: "Build and ship digital products",
    agents: ["CEO", "Developer"],
    defaultSeed: 200,
    tools: ["Web Search", "GitHub", "Vercel", "Notion"],
    hasExchange: false,
  },
  {
    type: "content",
    icon: "📝",
    name: "Content Agency",
    description: "Content creation and marketing",
    agents: ["CEO", "Marketer"],
    defaultSeed: 100,
    tools: ["Web Search", "Notion", "Gmail", "Calendar"],
    hasExchange: false,
  },
  {
    type: "fullstack",
    icon: "🏢",
    name: "Full-Stack Company",
    description: "Trading + Products + Marketing",
    agents: ["CEO", "Developer", "Trader"],
    defaultSeed: 1000,
    tools: ["Web Search", "Exchange", "GitHub", "Vercel", "Notion", "Gmail", "Calendar"],
    hasExchange: true,
  },
];

const ALL_TOOLS = [
  "Web Search",
  "Exchange",
  "GitHub",
  "Vercel",
  "Notion",
  "Gmail",
  "Calendar",
];

/* ───────────────────────── page ────────────────────────── */

export default function NewCompanyPage() {
  const router = useRouter();

  // step
  const [step, setStep] = useState(1);

  // step 1
  const [selectedType, setSelectedType] = useState<CompanyType | null>(null);

  // step 2
  const [seedMoney, setSeedMoney] = useState(500);
  const [tools, setTools] = useState<string[]>([]);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [network, setNetwork] = useState<"testnet" | "live">("testnet");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  // step 3
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const preset = PRESETS.find((p) => p.type === selectedType) ?? null;

  /* ── helpers ── */

  function selectPreset(type: CompanyType) {
    const p = PRESETS.find((pr) => pr.type === type)!;
    setSelectedType(type);
    setSeedMoney(p.defaultSeed);
    setTools([...p.tools]);
    setExchangeOpen(p.hasExchange);
  }

  function toggleTool(tool: string) {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool],
    );
  }

  async function handleLaunch() {
    setLoading(true);
    setStatus("CEO is naming your company...");

    try {
      const body: Record<string, unknown> = {
        seedMoney,
        companyType: selectedType,
        tools,
      };

      if (preset?.hasExchange) {
        body.exchange = { network, apiKey, apiSecret };
      }

      const res = await fetch("/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Init failed");
      }

      const { companyId } = await res.json();
      setStatus("Company created! Redirecting...");
      router.push(`/dashboard/${companyId}`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  }

  /* ── step indicators ── */

  function StepIndicator() {
    const steps = ["Company Type", "Configuration", "Launch"];
    return (
      <div className="flex items-center justify-center gap-2 mb-10">
        {steps.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${done ? "bg-white/40" : "bg-zinc-700"}`}
                />
              )}
              <div className="flex items-center gap-2">
                <span
                  className={`
                    flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold
                    transition-colors
                    ${active ? "bg-white text-black" : done ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-500"}
                  `}
                >
                  {done ? "✓" : n}
                </span>
                <span
                  className={`text-sm hidden sm:inline ${active ? "text-white font-medium" : "text-zinc-500"}`}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ── step 1 ── */

  function Step1() {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Choose Your Company Type</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            Each type comes with pre-configured AI agents and tools.
            Pick one to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {PRESETS.map((p) => {
            const selected = selectedType === p.type;
            return (
              <Card
                key={p.type}
                onClick={() => selectPreset(p.type)}
                className={`
                  cursor-pointer transition-all duration-200
                  bg-neutral-900 border
                  hover:border-zinc-500 hover:shadow-lg hover:shadow-white/5 hover:-translate-y-0.5
                  ${selected ? "border-white shadow-lg shadow-white/10" : "border-zinc-800"}
                `}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-2xl">{p.icon}</span>
                    {p.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-zinc-400 text-sm">{p.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.agents.map((a) => (
                      <span
                        key={a}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Coming Soon card */}
          <Card className="bg-neutral-900/50 border-zinc-800/60 opacity-50 cursor-not-allowed select-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-zinc-500">
                <span className="text-2xl">✨</span>
                Custom
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-600 text-sm">Coming soon</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center pt-2">
          <Button
            onClick={() => setStep(2)}
            disabled={!selectedType}
            className="px-8"
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  /* ── step 2 ── */

  function Step2() {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Configure Your Company</h2>
          <p className="text-zinc-400 text-sm">
            Fine-tune seed capital, tools, and integrations.
          </p>
        </div>

        {/* Seed Money */}
        <Card className="bg-neutral-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Seed Money (USD)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              type="number"
              min={10}
              max={10000}
              value={seedMoney}
              onChange={(e) => setSeedMoney(Number(e.target.value))}
              className="bg-zinc-800 border-zinc-700"
            />
            <p className="text-xs text-zinc-500">
              Min $10 — Max $10,000. The AI will manage this capital autonomously.
            </p>
          </CardContent>
        </Card>

        {/* Exchange Connection */}
        {preset?.hasExchange && (
          <Card className="bg-neutral-900 border-zinc-800">
            <CardHeader
              className="pb-2 cursor-pointer select-none"
              onClick={() => setExchangeOpen((o) => !o)}
            >
              <CardTitle className="text-sm font-medium text-zinc-300 flex items-center justify-between">
                Exchange Connection
                <span className="text-zinc-500 text-xs">
                  {exchangeOpen ? "▲" : "▼"}
                </span>
              </CardTitle>
            </CardHeader>
            {exchangeOpen && (
              <CardContent className="space-y-4">
                {/* Network toggle */}
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-xs">Network</Label>
                  <div className="flex rounded-lg overflow-hidden border border-zinc-700 w-fit">
                    <button
                      type="button"
                      onClick={() => setNetwork("testnet")}
                      className={`px-4 py-1.5 text-sm transition-colors ${
                        network === "testnet"
                          ? "bg-white text-black font-medium"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      Testnet
                    </button>
                    <button
                      type="button"
                      onClick={() => setNetwork("live")}
                      className={`px-4 py-1.5 text-sm transition-colors ${
                        network === "live"
                          ? "bg-white text-black font-medium"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      Live
                    </button>
                  </div>
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <Label htmlFor="apiKey" className="text-zinc-400 text-xs">
                    API Key
                  </Label>
                  <Input
                    id="apiKey"
                    type="text"
                    placeholder="Enter API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 font-mono text-sm"
                  />
                </div>

                {/* API Secret */}
                <div className="space-y-1.5">
                  <Label htmlFor="apiSecret" className="text-zinc-400 text-xs">
                    API Secret
                  </Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    placeholder="Enter API secret"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 font-mono text-sm"
                  />
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Tools */}
        <Card className="bg-neutral-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_TOOLS.map((tool) => {
                const checked = tools.includes(tool);
                return (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleTool(tool)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                      border transition-all duration-150
                      ${
                        checked
                          ? "bg-zinc-800 border-zinc-600 text-white"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                      }
                    `}
                  >
                    <span
                      className={`
                        flex items-center justify-center w-4 h-4 rounded border text-[10px]
                        ${checked ? "bg-white text-black border-white" : "border-zinc-600"}
                      `}
                    >
                      {checked && "✓"}
                    </span>
                    {tool}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setStep(1)}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Back
          </Button>
          <Button onClick={() => setStep(3)} className="px-8">
            Review
          </Button>
        </div>
      </div>
    );
  }

  /* ── step 3 ── */

  function Step3() {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Ready to Launch</h2>
          <p className="text-zinc-400 text-sm">
            Review your company configuration before launch.
          </p>
        </div>

        <Card className="bg-neutral-900 border-zinc-800">
          <CardContent className="pt-6 space-y-5">
            {/* Type */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Company Type</span>
              <span className="text-white font-medium flex items-center gap-2">
                <span>{preset?.icon}</span>
                {preset?.name}
              </span>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Agents */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">AI Agents</span>
              <div className="flex gap-1.5">
                {preset?.agents.map((a) => (
                  <span
                    key={a}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Seed */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Seed Money</span>
              <span className="text-white font-mono font-medium">
                ${seedMoney.toLocaleString()}
              </span>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Tools */}
            <div className="space-y-2">
              <span className="text-zinc-400 text-sm">Tools</span>
              <div className="flex flex-wrap gap-1.5">
                {tools.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Exchange */}
            {preset?.hasExchange && (
              <>
                <div className="h-px bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-sm">Exchange</span>
                  <span className="text-white text-sm capitalize">
                    {network}
                    {apiKey && " — Key configured"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Launch / status */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm animate-pulse">{status}</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Back
              </Button>
              <Button
                onClick={handleLaunch}
                className="px-8 bg-white text-black hover:bg-zinc-200 font-semibold"
              >
                Launch Company
              </Button>
            </div>

            {status && (
              <p
                className={`text-sm text-center ${
                  status.startsWith("Error") ? "text-red-400" : "text-zinc-400"
                }`}
              >
                {status}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  /* ── render ── */

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pt-12">
      <div className="max-w-3xl mx-auto">
        <StepIndicator />
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
      </div>
    </div>
  );
}
