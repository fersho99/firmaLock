import JSZip from "jszip";
import { File } from "expo-file-system";

/**
 * Extrae el texto plano de un .docx para poder "leerlo" dentro de la app.
 * No es una renderización fiel (sin negritas/tablas/imagenes), pero permite
 * revisar el contenido antes de firmar sin salir de FirmaLock.
 */
export async function extractDocxText(docxFile: File): Promise<string[]> {
  const bytes = await docxFile.arrayBuffer();
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file("word/document.xml");
  if (!entry) return ["(No se pudo leer el contenido del documento)"];
  const xml = await entry.async("text");

  const bodyMatch = xml.match(/<w:body>([\s\S]*)<\/w:body>/);
  const body = bodyMatch ? bodyMatch[1] : xml;

  const paragraphs = body.split(/<w:p[ >]/).slice(1);
  const lines = paragraphs.map((p) => {
    const texts = Array.from(p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)).map(
      (m) => decodeXmlEntities(m[1])
    );
    return texts.join("");
  });

  return lines.filter((l, i) => l.trim().length > 0 || i === 0);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
