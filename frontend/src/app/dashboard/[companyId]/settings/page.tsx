"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export default function SettingsPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [maskedSecret, setMaskedSecret] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    async function loadCompany() {
      const supabase = createClient();
      const { data } = await supabase
        .from("companies")
        .select(
          "name, exchange_api_key_encrypted, exchange_api_secret_encrypted"
        )
        .eq("id", companyId)
        .single();

      if (data) {
        setCompanyName(data.name);
        if (data.exchange_api_key_encrypted) {
          setMaskedKey(maskKey(data.exchange_api_key_encrypted));
        }
        if (data.exchange_api_secret_encrypted) {
          setMaskedSecret(maskKey(data.exchange_api_secret_encrypted));
        }
      }
    }
    loadCompany();
  }, [companyId]);

  async function handleSave() {
    if (!apiKey && !apiSecret) {
      setStatus({ type: "error", message: "Enter at least one field to update." });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, apiKey, apiSecret }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save settings");
      }

      setStatus({ type: "success", message: "API keys saved successfully." });
      if (apiKey) setMaskedKey(maskKey(apiKey));
      if (apiSecret) setMaskedSecret(maskKey(apiSecret));
      setApiKey("");
      setApiSecret("");
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-xl mx-auto space-y-6">
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

        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-xl text-white">
              Settings{companyName ? ` — ${companyName}` : ""}
            </CardTitle>
            <p className="text-neutral-400 text-sm">
              Configure your Bybit exchange API keys for automated trading.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-neutral-300">
                Exchange API Key
              </Label>
              <Input
                id="apiKey"
                type="text"
                placeholder={maskedKey ?? "Enter your API key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                disabled={loading}
              />
              {maskedKey && !apiKey && (
                <p className="text-xs text-neutral-500">
                  Current: {maskedKey}
                </p>
              )}
            </div>

            {/* API Secret */}
            <div className="space-y-2">
              <Label htmlFor="apiSecret" className="text-neutral-300">
                Exchange API Secret
              </Label>
              <Input
                id="apiSecret"
                type="password"
                placeholder={maskedSecret ?? "Enter your API secret"}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                disabled={loading}
              />
              {maskedSecret && !apiSecret && (
                <p className="text-xs text-neutral-500">
                  Current: {maskedSecret}
                </p>
              )}
            </div>

            {/* Info */}
            <div className="rounded-lg bg-neutral-800/50 border border-neutral-700/50 p-3">
              <p className="text-xs text-neutral-400">
                Keys are encrypted with AES-256-GCM before storage. Only provide
                keys with trading permissions — never enable withdrawal access.
              </p>
            </div>

            {/* Save */}
            <Button
              onClick={handleSave}
              disabled={loading || (!apiKey && !apiSecret)}
              className="w-full"
            >
              {loading ? "Saving..." : "Save API Keys"}
            </Button>

            {/* Status */}
            {status && (
              <p
                className={`text-sm text-center ${
                  status.type === "error" ? "text-red-400" : "text-green-400"
                }`}
              >
                {status.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
