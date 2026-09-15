"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listKBChunks, type KBChunk } from "@/lib/api";

export default function KBChunksPage() {
  const [chunks, setChunks] = useState<KBChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listKBChunks();
      setChunks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">KB Chunks</h1>
            <p className="text-xs text-muted-foreground">
              Every chunk currently sitting in the in-memory knowledge base.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Refresh
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/kb">
                <ArrowLeft />
                Knowledge Base
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading chunks...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && chunks.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No chunks yet — ingest something on the{" "}
            <Link href="/kb" className="text-primary hover:underline">
              Knowledge Base
            </Link>{" "}
            page first.
          </div>
        )}

        {chunks.map((c) => (
          <Card key={c.chunkId}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                <span className="font-mono">{c.chunkId}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {c.source} · chunk {c.chunkIndex + 1}/{c.totalChunks} ·{" "}
                  {c.tokenCount} tokens
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                {c.content}
              </pre>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
