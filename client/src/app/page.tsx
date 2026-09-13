"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search as SearchIcon, ExternalLink, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { search, type ChatMessage } from "@/lib/api";

type Turn = ChatMessage & { sources?: string[] };

// how many prior turns to send back to the agent as conversation context
const MAX_HISTORY_TURNS = 10;

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Turn[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;

    const history: ChatMessage[] = messages
      .slice(-MAX_HISTORY_TURNS)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      const result = await search(q, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer, sources: result.sources },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setError(null);
    setQuery("");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-4 py-4">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Search Tool</h1>
            <p className="text-xs text-muted-foreground">
              Ask a question — follow-ups remember what you asked before.
            </p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw />
              New chat
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        {messages.length === 0 && !loading && (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Ask anything to start the conversation.
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] min-w-0 overflow-hidden rounded-lg px-4 py-3 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">
                  {m.content}
                </p>

                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Sources
                      </p>
                      <ul className="flex min-w-0 flex-col gap-1">
                        {m.sources.map((url) => (
                          <li key={url} className="min-w-0">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-w-0 items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="size-3 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">{url}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 border-t bg-background px-4 py-4"
      >
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to know?"
            disabled={loading}
            autoFocus
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="animate-spin" /> : <SearchIcon />}
            Search
          </Button>
        </div>
      </form>
    </div>
  );
}
