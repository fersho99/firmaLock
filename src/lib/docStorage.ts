import { Directory, File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { insertDocument, type DocumentItem, type DocType } from "./db";

const VAULT_DIR_NAME = "firmalock_vault";

function getVaultDir(): Directory {
  const dir = new Directory(Paths.document, VAULT_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

function inferType(name: string, mimeType?: string | null): DocType | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (
    lower.endsWith(".docx") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return null;
}

export async function pickAndImportDocument(): Promise<DocumentItem | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const type = inferType(asset.name, asset.mimeType);
  if (!type) return null;

  const vaultDir = getVaultDir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const ext = type === "pdf" ? "pdf" : "docx";
  const dest = new File(vaultDir, `${id}.${ext}`);

  const src = new File(asset.uri);
  src.copy(dest);

  const item: DocumentItem = {
    id,
    name: asset.name,
    type,
    uri: dest.uri,
    status: "pendiente",
    signedAt: null,
    createdAt: Date.now(),
  };
  await insertDocument(item);
  return item;
}

/** Archivo original (sin firmar) de un documento, tal como se importó. */
export function getOriginalFile(item: { id: string; type: DocType }): File {
  const vaultDir = getVaultDir();
  const ext = item.type === "pdf" ? "pdf" : "docx";
  return new File(vaultDir, `${item.id}.${ext}`);
}

export function saveSignedCopy(
  original: { id: string; type: DocType },
  bytes: Uint8Array
): File {
  const vaultDir = getVaultDir();
  const ext = original.type === "pdf" ? "pdf" : "docx";
  const dest = new File(vaultDir, `${original.id}_firmado.${ext}`);
  dest.write(bytes);
  return dest;
}

export function deleteDocumentFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
