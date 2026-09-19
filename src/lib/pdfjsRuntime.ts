import { Directory, File, Paths } from "expo-file-system";
import { toByteArray } from "base64-js";
import { VIEWER_HTML_B64 } from "../assets/viewerHtmlB64";
import { PDF_MIN_JS_B64 } from "../assets/pdfMinJsB64";
import { PDF_WORKER_MIN_JS_B64 } from "../assets/pdfWorkerMinJsB64";

const RUNTIME_DIR_NAME = "pdfjs_runtime";

/**
 * pdf.js (viewer.html + pdf.min.js + pdf.worker.min.js) viaja embebido como
 * base64 dentro del bundle de JS de la app (ver src/assets/*.ts) para evitar
 * por completo el pipeline de "assets" de Metro (que trataría un .js suelto
 * como código a empaquetar, no como archivo binario). En el primer uso se
 * decodifica UNA vez y se escribe a disco, los tres archivos en la misma
 * carpeta, para que las referencias relativas <script src="pdf.min.js">
 * dentro de viewer.html funcionen al cargarse por file://.
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

      // Siempre se reescriben (no solo si faltan): estos archivos viajan
      // embebidos en el bundle de JS, así que si cambia viewer.html (p. ej.
      // al retocar colores) hay que reflejarlo en disco cada vez que la app
      // arranca, no solo la primera vez que se instaló.
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
  // decodeURIComponent + escape del array de bytes es un truco clásico y
  // confiable para pasar de bytes UTF-8 a un string JS en RN sin depender
  // de TextDecoder (no siempre disponible en Hermes según la versión).
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  try {
    return decodeURIComponent(escape(result));
  } catch {
    return result;
  }
}
