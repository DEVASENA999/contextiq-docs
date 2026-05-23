import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1";

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(`${LOVABLE_AI_URL}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-embedding-001",
      input: inputs,
      dimensions: 1536,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embedding failed: ${res.status} ${t}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function summarize(text: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const truncated = text.slice(0, 30000);
  const res = await fetch(`${LOVABLE_AI_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You write crisp, structured executive summaries. Use 3–6 bullet points capturing the key topics, findings, and conclusions. No preamble." },
        { role: "user", content: `Summarize this document:\n\n${truncated}` },
      ],
    }),
  });
  if (!res.ok) return "";
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
}

export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      documentId: z.string().uuid(),
      chunks: z.array(z.string().min(1).max(8000)).min(1).max(500),
      fullText: z.string().min(1).max(500000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await supabase.from("documents").update({ status: "processing" }).eq("id", data.documentId);

    try {
      // Embed in batches of 64
      const batchSize = 64;
      const rows: { document_id: string; user_id: string; chunk_index: number; content: string; embedding: number[] }[] = [];
      for (let i = 0; i < data.chunks.length; i += batchSize) {
        const batch = data.chunks.slice(i, i + batchSize);
        const embs = await embedBatch(batch);
        embs.forEach((emb, j) => {
          rows.push({
            document_id: data.documentId,
            user_id: userId,
            chunk_index: i + j,
            content: batch[j],
            embedding: emb,
          });
        });
      }

      // Insert in DB-friendly chunks
      for (let i = 0; i < rows.length; i += 100) {
        const slice = rows.slice(i, i + 100);
        const { error } = await supabase.from("document_chunks").insert(slice as never);
        if (error) throw new Error(error.message);
      }

      const summary = await summarize(data.fullText);

      await supabase
        .from("documents")
        .update({ status: "ready", summary, updated_at: new Date().toISOString() })
        .eq("id", data.documentId);

      return { ok: true, chunks: rows.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("documents")
        .update({ status: "error", error_message: msg })
        .eq("id", data.documentId);
      throw new Error(msg);
    }
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: doc } = await supabase
      .from("documents")
      .select("storage_path")
      .eq("id", data.documentId)
      .single();
    if (doc?.storage_path) {
      await supabase.storage.from("documents").remove([doc.storage_path]);
    }
    const { error } = await supabase.from("documents").delete().eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
