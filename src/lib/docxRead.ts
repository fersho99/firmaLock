import JSZip from "jszip";
import { File } from "expo-file-system";

export type DocxParagraph = {
  // Posición 0-based del párrafo en la secuencia <w:p> del XML; se usa como
  // targetParagraphIndex en appendSignatureToDocx (docxSign.ts).
  index: number;
  text: string;
};

/** Extrae el texto plano de un .docx, párrafo por párrafo (sin formato). */
export async function extractDocxParagraphs(docxFile: File): Promise<DocxParagraph[]> {
  const bytes = await docxFile.arrayBuffer();
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file("word/document.xml");
  if (!entry) return [{ index: 0, text: "(No se pudo leer el contenido del documento)" }];
  const xml = await entry.async("text");

  const bodyMatch = xml.match(/<w:body>([\s\S]*)<\/w:body>/);
  const body = bodyMatch ? bodyMatch[1] : xml;

  const paragraphs = body.split(/<w:p[ >]/).slice(1);
  const all: DocxParagraph[] = paragraphs.map((p, index) => {
    const texts = Array.from(p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)).map(
      (m) => decodeXmlEntities(m[1])
    );
    return { index, text: texts.join("") };
  });

  // Se filtran párrafos vacíos de la vista, pero se conserva el índice original.
  return all.filter((p, i) => p.text.trim().length > 0 || i === 0);
}

/** Compatibilidad: solo el texto, sin los índices (para vistas simples). */
export async function extractDocxText(docxFile: File): Promise<string[]> {
  const paragraphs = await extractDocxParagraphs(docxFile);
  return paragraphs.map((p) => p.text);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
