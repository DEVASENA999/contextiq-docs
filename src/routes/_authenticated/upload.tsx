import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { processDocument } from "@/lib/documents.functions";
import { extractText, chunkText } from "@/lib/text-extract";
import { toast } from "sonner";
import { UploadCloud, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload — Lumen" },
      { name: "description", content: "Upload documents to your AI library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UploadPage,
});

type Stage = "idle" | "extracting" | "uploading" | "indexing" | "done" | "error";

function UploadPage() {
  const navigate = useNavigate();
  const process = useServerFn(processDocument);
  const [stage, setStage] = useState<Stage>("idle");
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large. Max 20MB.");
      return;
    }
    setFilename(file.name);
    setStage("extracting");
    setProgress("Reading file…");

    try {
      const fullText = await extractText(file);
      if (!fullText || fullText.length < 50) {
        throw new Error("Could not extract enough text from this file.");
      }
      const chunks = chunkText(fullText);
      setProgress(`Found ${chunks.length} chunks. Uploading…`);
      setStage("uploading");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;

      const { data: doc, error: dErr } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          filename: file.name,
          file_type: file.type || file.name.split(".").pop() || "unknown",
          file_size: file.size,
          storage_path: path,
          status: "pending",
        } as never)
        .select()
        .single();
      if (dErr) throw dErr;

      setStage("indexing");
      setProgress("Embedding chunks and generating summary…");
      await process({ data: { documentId: (doc as { id: string }).id, chunks, fullText: fullText.slice(0, 500000) } });

      setStage("done");
      toast.success("Document indexed!");
      setTimeout(() => navigate({ to: "/dashboard" }), 600);
    } catch (e) {
      console.error(e);
      setStage("error");
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }, [navigate, process]);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display text-4xl">Upload a document</h1>
      <p className="mt-1 text-muted-foreground">PDF, DOCX, or TXT. Up to 20MB.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`mt-8 rounded-2xl border-2 border-dashed p-16 text-center transition ${dragOver ? "border-primary bg-accent/30" : "border-border bg-surface"}`}
      >
        {stage === "idle" || stage === "error" ? (
          <>
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground">
              <UploadCloud className="h-7 w-7" />
            </div>
            <h2 className="font-display text-2xl">Drop your file here</h2>
            <p className="mt-2 text-sm text-muted-foreground">or click to browse</p>
            <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Choose file
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
            {stage === "error" && <p className="mt-4 text-sm text-destructive">Something went wrong. Try again.</p>}
          </>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground">
              {stage === "done" ? <FileText className="h-7 w-7" /> : <Loader2 className="h-7 w-7 animate-spin" />}
            </div>
            <h2 className="font-display text-2xl">
              {stage === "done" ? "All done!" : "Processing…"}
            </h2>
            <p className="text-sm text-muted-foreground">{filename}</p>
            <p className="text-sm text-primary">{progress}</p>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
        <p>✓ Text is extracted in your browser — your file stays private until uploaded.</p>
        <p>✓ Embeddings let you search by meaning, not just keywords.</p>
        <p>✓ A summary is generated automatically after indexing.</p>
      </div>
    </div>
  );
}
