import { Directory, File, Paths } from "expo-file-system";
import { toByteArray } from "base64-js";
import { VIEWER_HTML_B64 } from "../assets/viewerHtmlB64";
import { PDF_MIN_JS_B64 } from "../assets/pdfMinJsB64";
import { PDF_WORKER_MIN_JS_B64 } from "../assets/pdfWorkerMinJsB64";

const RUNTIME_DIR_NAME = "pdfjs_runtime";

/**
 * pdf.js viaja embebido como base64 en el bundle (src/assets/*.ts) para evitar
 * el pipeline de "assets" de Metro. Se decodifica y escribe a disco para que
 * viewer.html lo cargue por file://.
 */
let ensurePromise: Promise<string> | null = null;

export function ensurePdfjsRuntime(): Promise<string> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const dir = new Directory(Paths.document, RUNTIME_DIR_NAME);
      if (!dir.exists) {
        dir.create({ intermediates: true });
      }

      const viewerFile = new File(dir, "viewer.html");
      const pdfJsFile = new File(dir, "pdf.min.js");
      const workerFile = new File(dir, "pdf.worker.min.js");

      // Se reescriben siempre (no solo si faltan) para reflejar cambios del bundle.
      viewerFile.write(VIEWER_HTML_B64.length ? decodeUtf8(VIEWER_HTML_B64) : "");
      pdfJsFile.write(toByteArray(PDF_MIN_JS_B64));
      workerFile.write(toByteArray(PDF_WORKER_MIN_JS_B64));

      return viewerFile.uri;
    })();
  }
  return ensurePromise;
}

function decodeUtf8(base64: string): string {
  const bytes = toByteArray(base64);
  let result = "";
  // Convierte bytes UTF-8 a string sin depender de TextDecoder (no siempre disponible en Hermes).
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  try {
    return decodeURIComponent(escape(result));
  } catch {
    return result;
  }
}
