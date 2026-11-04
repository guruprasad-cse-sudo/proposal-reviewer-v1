import mammoth from "mammoth";
// pdf-parse's index runs a self-test on import; load the library file directly.
// (types come from server/src/types.d.ts)
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function extractText(name: string, buf: Buffer): Promise<string> {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) {
    const r = await pdfParse(buf);
    return String(r.text || "").replace(/\n{3,}/g, "\n\n").trim();
  }
  if (n.endsWith(".docx")) {
    const r = await mammoth.extractRawText({ buffer: buf });
    return r.value.trim();
  }
  if (n.endsWith(".txt") || n.endsWith(".md")) return buf.toString("utf8").trim();
  if (n.endsWith(".doc")) throw new Error("Old .doc files cannot be read. Save it as .docx and upload again.");
  throw new Error("Upload a .pdf, .docx or .txt file.");
}
