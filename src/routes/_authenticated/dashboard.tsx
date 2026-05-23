import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload, MessageSquare, Trash2, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { deleteDocument } from "@/lib/documents.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Library — Lumen" },
      { name: "description", content: "Your document intelligence library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const del = useServerFn(deleteDocument);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document and all its data?")) return;
    try {
      await del({ data: { documentId: id } });
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const stats = {
    total: docs?.length ?? 0,
    ready: docs?.filter((d) => d.status === "ready").length ?? 0,
    processing: docs?.filter((d) => d.status === "processing" || d.status === "pending").length ?? 0,
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl">Library</h1>
          <p className="mt-1 text-muted-foreground">Your uploaded documents and their AI summaries.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-elevated"
          >
            <MessageSquare className="h-4 w-4" /> Chat
          </Link>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Upload className="h-4 w-4" /> Upload
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Stat label="Total documents" value={stats.total} />
        <Stat label="Indexed" value={stats.ready} accent />
        <Stat label="Processing" value={stats.processing} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !docs?.length ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {docs.map((d) => (
            <div key={d.id} className="group rounded-xl border border-border bg-card p-5 transition hover:border-primary/40">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{d.filename}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(d.file_size / 1024).toFixed(0)} KB · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <StatusBadge status={d.status} />
              {d.summary && (
                <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
                  {d.summary}
                </p>
              )}
              {d.error_message && (
                <p className="mt-3 text-sm text-destructive">{d.error_message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-4xl ${accent ? "gradient-text" : ""}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: typeof Clock; label: string; cls: string }> = {
    pending: { icon: Clock, label: "Pending", cls: "bg-muted text-muted-foreground" },
    processing: { icon: Loader2, label: "Processing", cls: "bg-accent text-accent-foreground" },
    ready: { icon: CheckCircle2, label: "Ready", cls: "bg-primary/15 text-primary" },
    error: { icon: AlertCircle, label: "Error", cls: "bg-destructive/15 text-destructive" },
  };
  const cfg = map[status] ?? map.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.cls}`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-16 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="font-display text-2xl">Your library is empty</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Upload your first document — a PDF, DOCX, or text file — and start chatting with it.
      </p>
      <Link
        to="/upload"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Upload className="h-4 w-4" /> Upload your first document
      </Link>
    </div>
  );
}
