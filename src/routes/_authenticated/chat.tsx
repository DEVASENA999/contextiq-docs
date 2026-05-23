import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askQuestion } from "@/lib/chat.functions";
import { toast } from "sonner";
import { Send, Plus, MessageSquare, FileText, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Lumen" },
      { name: "description", content: "Chat with your documents" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatPage,
});

type Source = { document_id: string; filename: string; similarity: number; excerpt: string };
type Message = { id: string; role: string; content: string; sources: Source[] | null; created_at: string };

function ChatPage() {
  const ask = useServerFn(askQuestion);
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: convos } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!activeId && convos?.length) setActiveId(convos[0].id);
  }, [convos, activeId]);

  const { data: messages } = useQuery({
    queryKey: ["messages", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Message[];
    },
    enabled: !!activeId,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const newChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New chat" } as never)
      .select()
      .single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setActiveId((data as { id: string }).id);
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    let convoId = activeId;
    if (!convoId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const title = input.slice(0, 60);
      const { data } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title } as never)
        .select()
        .single();
      convoId = (data as { id: string } | null)?.id ?? null;
      if (!convoId) return;
      setActiveId(convoId);
    } else if (messages?.length === 0) {
      await supabase.from("conversations").update({ title: input.slice(0, 60) }).eq("id", convoId);
    }

    const question = input;
    setInput("");
    setSending(true);
    qc.setQueryData(["messages", convoId], (old: Message[] = []) => [
      ...old,
      { id: "tmp-u", role: "user", content: question, sources: null, created_at: new Date().toISOString() },
    ]);
    try {
      await ask({ data: { conversationId: convoId, question } });
      qc.invalidateQueries({ queryKey: ["messages", convoId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Conversations sidebar */}
      <div className="flex w-72 flex-col border-r border-border bg-surface">
        <div className="p-3">
          <button
            onClick={newChat}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-auto px-2">
          {convos?.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition ${activeId === c.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/40"}`}
            >
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
              <div className="min-w-0 flex-1">
                <div className="truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                </div>
              </div>
            </button>
          ))}
          {!convos?.length && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No chats yet</p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl px-6 py-10">
            {!messages?.length ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="font-display text-3xl">Ask anything about your library</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  Lumen will search your documents and answer with citations.
                </p>
                <div className="mx-auto mt-6 grid max-w-xl gap-2">
                  {[
                    "Summarize the key findings across my uploads",
                    "What contradicts what in my documents?",
                    "Give me a timeline of events mentioned",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-md border border-border bg-card px-4 py-3 text-left text-sm hover:border-primary/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <Avatar role="assistant" />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border bg-surface p-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/40">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask a question about your documents…"
                className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Answers cite sources from your library
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: string }) {
  return role === "user" ? (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium">You</div>
  ) : (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
      <Sparkles className="h-4 w-4" />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className="flex gap-3">
      <Avatar role={message.role} />
      <div className="min-w-0 flex-1">
        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.sources.map((s, i) => (
              <div
                key={i}
                title={s.excerpt}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
              >
                <FileText className="h-3 w-3 text-primary" />
                <span className="max-w-[200px] truncate">{s.filename}</span>
                <span className="opacity-60">{(s.similarity * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
