"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ingestKB, askKB, type IngestResult, type KBAskResult } from "@/lib/api";

const DEFAULT_K = 4;

export default function KnowledgeBasePage() {
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [k, setK] = useState(String(DEFAULT_K));
  const [asking, setAsking] = useState(false);
  const [askResult, setAskResult] = useState<KBAskResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  function handleReset() {
    setSource("");
    setText("");
    setIngestResult(null);
    setIngestError(null);
  }

  async function handleIngest() {
    const trimmed = text.trim();
    if (!trimmed || ingesting) return;

    setIngesting(true);
    setIngestError(null);
    setIngestResult(null);

    try {
      const result = await ingestKB(trimmed, source.trim() || undefined);
      setIngestResult(result);
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIngesting(false);
    }
  }

  async function handleAsk() {
    const trimmed = query.trim();
    if (!trimmed || asking) return;

    const parsedK = Number(k);

    setAsking(true);
    setAskError(null);
    setAskResult(null);

    try {
      const result = await askKB(
        trimmed,
        Number.isFinite(parsedK) && parsedK > 0 ? parsedK : undefined
      );
      setAskResult(result);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Knowledge Base (KB)</h1>
            <p className="text-xs text-muted-foreground">
              Light RAG Demo. Add you own docs, then ask questions. Model must answer
              from what you ingested
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/kb/chunks">
                <Layers />
                View Chunks
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft />
                Search
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add to KB</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="source" className="text-xs text-muted-foreground">
                Source Label
              </label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="policy"
                disabled={ingesting}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="text" className="text-xs text-muted-foreground">
                Text / Markdown
              </label>
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste text or markdown to add to the knowledge base..."
                rows={12}
                className="font-mono text-sm"
                disabled={ingesting}
              />
            </div>

            {ingestResult && (
              <p className="text-xs text-muted-foreground">
                Ingested {ingestResult.chunkCount} chunk(s) from &quot;
                {ingestResult.source}&quot;.
              </p>
            )}
            {ingestError && <p className="text-xs text-destructive">{ingestError}</p>}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={ingesting}
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={handleIngest}
                disabled={ingesting || !text.trim()}
              >
                {ingesting && <Loader2 className="animate-spin" />}
                Ingest to KB
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Question/Query</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="query" className="text-xs text-muted-foreground">
                Your Query
              </label>
              <Input
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Add your question here..."
                disabled={asking}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="k" className="text-xs text-muted-foreground">
                Top K Answers
              </label>
              <Input
                id="k"
                type="number"
                min={1}
                max={20}
                value={k}
                onChange={(e) => setK(e.target.value)}
                disabled={asking}
                className="max-w-24"
              />
            </div>

            <Button
              type="button"
              onClick={handleAsk}
              disabled={asking || !query.trim()}
              className="self-start"
            >
              {asking && <Loader2 className="animate-spin" />}
              Ask KB
            </Button>

            {askError && <p className="text-xs text-destructive">{askError}</p>}

            {askResult && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {askResult.answer}
                  </p>

                  {askResult.sources.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Sources
                      </p>
                      <ul className="flex flex-col gap-1">
                        {askResult.sources.map((s) => (
                          <li key={s.chunkId} className="text-xs text-muted-foreground">
                            {s.source}{" "}
                            <span className="text-muted-foreground/70">
                              · {s.chunkId}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    Confidence: {(askResult.cofidence * 100).toFixed(0)}%
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
