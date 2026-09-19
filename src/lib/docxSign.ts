import JSZip from "jszip";
import { File } from "expo-file-system";
import { toByteArray } from "base64-js";

const EMU_PER_INCH = 914400;
const SIGNATURE_WIDTH_IN = 2.2;
const SIGNATURE_HEIGHT_IN = 0.9;

/**
 * Un .docx no tiene coordenadas fijas de página (se re-fluye), así que el
 * usuario elige después de qué párrafo va la firma en vez de un punto exacto.
 * El bloque de firma (imagen + "Firmado por / fecha") se inserta ahí,
 * manipulando directamente word/document.xml dentro del paquete OOXML. Sin
 * párrafo indicado, se agrega al final del documento.
 */
export async function appendSignatureToDocx(
  docxFile: File,
  signaturePngBase64: string,
  signerName: string,
  targetParagraphIndex?: number | null
): Promise<Uint8Array> {
  const docxBytes = await docxFile.arrayBuffer();
  const zip = await JSZip.loadAsync(docxBytes);

  const documentXmlPath = "word/document.xml";
  const relsPath = "word/_rels/document.xml.rels";
  const contentTypesPath = "[Content_Types].xml";

  const documentXml = await requireText(zip, documentXmlPath);
  const relsXml = await requireText(zip, relsPath);
  const contentTypesXml = await requireText(zip, contentTypesPath);

  // Agrega la imagen de la firma al paquete y registra la relación imagen -> id.
  const pngBytes = toByteArray(
    signaturePngBase64.replace(/^data:image\/png;base64,/, "")
  );
  zip.file("word/media/firmalock_signature.png", pngBytes);

  const usedIds = Array.from(relsXml.matchAll(/Id="rId(\d+)"/g)).map((m) =>
    parseInt(m[1], 10)
  );
  const nextId = (usedIds.length ? Math.max(...usedIds) : 0) + 1;
  const relId = `rId${nextId}`;
  const newRel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/firmalock_signature.png"/>`;
  const updatedRelsXml = relsXml.replace(
    "</Relationships>",
    `${newRel}</Relationships>`
  );
  zip.file(relsPath, updatedRelsXml);

  // Asegura que [Content_Types].xml declare la extensión png.
  let updatedContentTypesXml = contentTypesXml;
  if (!/Extension="png"/i.test(contentTypesXml)) {
    updatedContentTypesXml = contentTypesXml.replace(
      "</Types>",
      `<Default Extension="png" ContentType="image/png"/></Types>`
    );
  }
  zip.file(contentTypesPath, updatedContentTypesXml);

  // Construye el bloque XML (imagen + texto) y decide dónde insertarlo.
  const cx = Math.round(SIGNATURE_WIDTH_IN * EMU_PER_INCH);
  const cy = Math.round(SIGNATURE_HEIGHT_IN * EMU_PER_INCH);
  const dateLabel = new Date().toLocaleString();
  const signatureBlock = buildSignatureParagraphs(relId, cx, cy, signerName, dateLabel);

  // Posición por defecto: justo antes de <w:sectPr> (el cierre de sección
  // debe seguir siendo el último hijo del body), o antes de </w:body> si el
  // documento no tiene sectPr explícito.
  const sectPrIndex = documentXml.lastIndexOf("<w:sectPr");
  const endOfBodyPos = sectPrIndex !== -1 ? sectPrIndex : documentXml.indexOf("</w:body>");

  let insertPos = endOfBodyPos;
  if (typeof targetParagraphIndex === "number" && targetParagraphIndex >= 0) {
    // Mismo criterio de partición que extractDocxParagraphs (docxRead.ts).
    const paragraphStarts = findParagraphStarts(documentXml);
    const nextParagraphIndex = targetParagraphIndex + 1;
    if (nextParagraphIndex < paragraphStarts.length) {
      insertPos = paragraphStarts[nextParagraphIndex];
    }
  }

  const updatedDocumentXml =
    documentXml.slice(0, insertPos) + signatureBlock + documentXml.slice(insertPos);
  zip.file(documentXmlPath, updatedDocumentXml);

  return zip.generateAsync({ type: "uint8array" });
}

/** Offset de cada apertura de párrafo (<w:p> o <w:p ...>) dentro de documentXml. */
function findParagraphStarts(documentXml: string): number[] {
  const regex = /<w:p[ >]/g;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(documentXml))) {
    starts.push(match.index);
  }
  return starts;
}

async function requireText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`El .docx no tiene la estructura esperada (falta ${path}).`);
  }
  return entry.async("text");
}

function buildSignatureParagraphs(
  relId: string,
  cx: number,
  cy: number,
  signerName: string,
  dateLabel: string
): string {
  const drawingId = 100000 + Math.floor(Math.random() * 900000);
  return `
<w:p>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="${drawingId}" name="FirmaLock Signature"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="${drawingId}" name="firmalock_signature.png"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                <a:stretch>
                  <a:fillRect/>
                </a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="${cx}" cy="${cy}"/>
                </a:xfrm>
                <a:prstGeom prst="rect">
                  <a:avLst/>
                </a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>
<w:p>
  <w:r>
    <w:rPr><w:i/><w:sz w:val="16"/><w:color w:val="595959"/></w:rPr>
    <w:t xml:space="preserve">Firmado digitalmente por ${escapeXml(signerName)} · ${escapeXml(dateLabel)}</w:t>
  </w:r>
</w:p>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
