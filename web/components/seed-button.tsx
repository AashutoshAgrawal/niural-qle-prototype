"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
import { Loader2, Sparkles, RotateCw } from "lucide-react";

export function SeedButton({ seeded }: { seeded: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  async function handle(reset: boolean) {
    setLoading(true);
    try {
      await api.seed(reset);
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  if (!seeded) {
    return (
      <Button variant="primary" size="lg" onClick={() => handle(false)} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Load PRD scenarios
      </Button>
    );
  }

  return (
    <Button variant="secondary" onClick={() => handle(true)} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : <RotateCw />}
      Reset &amp; reseed
    </Button>
  );
}
