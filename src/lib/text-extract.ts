// Client-side text extraction for uploaded files.
// Keeps Worker bundle small and avoids Node-only deps on the server.

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return await file.text();
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await pdfExtract(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n\n") : text;
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }
  throw new Error("Unsupported file type. Upload PDF, DOCX, or TXT.");
}

export function chunkText(text: string, target = 1000, overlap = 150): string[] {
  const clean = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= target) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + target, clean.length);
    if (end < clean.length) {
      const lastBreak = clean.lastIndexOf("\n\n", end);
      const lastPeriod = clean.lastIndexOf(". ", end);
      const cut = Math.max(lastBreak, lastPeriod);
      if (cut > i + target * 0.5) end = cut + 1;
    }
    chunks.push(clean.slice(i, end).trim());
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks.filter((c) => c.length > 20);
}
