"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUp, Loader2 } from "lucide-react";

export function ResubmitForm({ qleId }: { qleId: number }) {
  const router = useRouter();
  const [filename, setFilename] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.resubmit(qleId, filename);
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a new document</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex gap-2">
          <Input
            type="text"
            placeholder="marriage_certificate.pdf"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" disabled={submitting || !filename}>
            {submitting ? <Loader2 className="animate-spin" /> : <FileUp />}
            Resubmit
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
