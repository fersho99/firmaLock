import { Directory, File, Paths } from "expo-file-system";
import { toByteArray } from "base64-js";
import { DOCX_VIEWER_HTML_B64 } from "../assets/docxViewerHtmlB64";
import { JSZIP_MIN_JS_B64 } from "../assets/jszipMinJsB64";
import { DOCX_PREVIEW_MIN_JS_B64 } from "../assets/docxPreviewMinJsB64";

const RUNTIME_DIR_NAME = "docxpreview_runtime";

/**
 * docx-preview y jszip.min.js viajan embebidos como base64 en el bundle,
 * igual que pdf.js en pdfjsRuntime.ts. Se decodifican y escriben a disco
 * para que viewer.html los cargue por file://.
 */
let ensurePromise: Promise<string> | null = null;

export function ensureDocxPreviewRuntime(): Promise<string> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const dir = new Directory(Paths.document, RUNTIME_DIR_NAME);
      if (!dir.exists) {
        dir.create({ intermediates: true });
      }

      const viewerFile = new File(dir, "viewer.html");
      const jszipFile = new File(dir, "jszip.min.js");
      const docxPreviewFile = new File(dir, "docx-preview.min.js");

      // Se reescriben siempre (no solo si faltan), mismo criterio que pdfjsRuntime.ts.
      viewerFile.write(decodeUtf8(DOCX_VIEWER_HTML_B64));
      jszipFile.write(toByteArray(JSZIP_MIN_JS_B64));
      docxPreviewFile.write(toByteArray(DOCX_PREVIEW_MIN_JS_B64));

      return viewerFile.uri;
    })();
  }
  return ensurePromise;
}

function decodeUtf8(base64: string): string {
  const bytes = toByteArray(base64);
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  try {
    return decodeURIComponent(escape(result));
  } catch {
    return result;
  }
}
