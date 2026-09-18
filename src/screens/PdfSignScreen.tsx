import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { authenticate } from "../lib/biometrics";
import { withRelockPaused } from "../lib/relockGuard";
import { embedSignatureInPdf, type SignaturePlacement } from "../lib/pdfSign";
import { ensurePdfjsRuntime } from "../lib/pdfjsRuntime";
import { markSigned, type DocumentItem } from "../lib/db";
import { saveSignedCopy } from "../lib/docStorage";
import SignaturePadModal from "../components/SignaturePadModal";
import { COLORS } from "../theme";

type Props = {
  document: DocumentItem;
  onClose: () => void;
  onSignedUpdate: (updated: DocumentItem) => void;
};

type WebMsg =
  | { type: "ready" }
  | { type: "loaded"; numPages: number }
  | { type: "pageRendered"; page: number; numPages: number }
  | { type: "tap"; page: number; pdfX: number; pdfY: number; pageWidthPt: number; pageHeightPt: number }
  | { type: "error"; message: string };

export default function PdfSignScreen({ document: doc, onClose, onSignedUpdate }: Props) {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingPlacement, setPendingPlacement] = useState<{
    page: number;
    pdfX: number;
    pdfY: number;
  } | null>(null);
  const [signaturePadVisible, setSignaturePadVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentDoc, setCurrentDoc] = useState(doc);

  const sendToWeb = useCallback((obj: unknown) => {
    webviewRef.current?.postMessage(JSON.stringify(obj));
  }, []);

  const loadCurrentFile = useCallback(
    async (uri: string, gotoPage = 1) => {
      const file = new File(uri);
      const base64 = await file.base64();
      sendToWeb({ type: "load", base64, page: gotoPage });
    },
    [sendToWeb]
  );

  useEffect(() => {
    (async () => {
      const uri = await ensurePdfjsRuntime();
      setViewerUri(uri);
    })();
  }, []);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let msg: WebMsg;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (msg.type === "ready") {
        setReady(true);
        loadCurrentFile(currentDoc.uri, currentPage);
      } else if (msg.type === "loaded") {
        setNumPages(msg.numPages);
      } else if (msg.type === "pageRendered") {
        setCurrentPage(msg.page);
      } else if (msg.type === "tap") {
        setPendingPlacement({ page: msg.page, pdfX: msg.pdfX, pdfY: msg.pdfY });
      } else if (msg.type === "error") {
        Alert.alert("No se pudo mostrar el PDF", msg.message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentDoc.uri, currentPage, loadCurrentFile]
  );

  const confirmPlacement = useCallback(async () => {
    if (!pendingPlacement) return;
    const success = await withRelockPaused(() =>
      authenticate("Confirma tu identidad para firmar este documento")
    );
    if (!success) {
      Alert.alert("Verificación fallida", "No se pudo confirmar tu identidad.");
      return;
    }
    setSignaturePadVisible(true);
  }, [pendingPlacement]);

  const handleSigned = useCallback(
    async (base64Png: string) => {
      if (!pendingPlacement) return;
      setSignaturePadVisible(false);
      setBusy(true);
      try {
        const placement: SignaturePlacement = {
          pageIndex: pendingPlacement.page - 1,
          pdfX: pendingPlacement.pdfX,
          pdfY: pendingPlacement.pdfY,
          signerName: "Bryan Fernando Medina Zavala",
        };
        const original = new File(currentDoc.uri);
        const signedBytes = await embedSignatureInPdf(original, base64Png, placement);
        const signedFile = saveSignedCopy(currentDoc, signedBytes);
        await markSigned(currentDoc.id, signedFile.uri);
        const updated: DocumentItem = {
          ...currentDoc,
          uri: signedFile.uri,
          status: "firmado",
          signedAt: Date.now(),
        };
        setCurrentDoc(updated);
        onSignedUpdate(updated);
        setPendingPlacement(null);
        await loadCurrentFile(signedFile.uri, placement.pageIndex + 1);
        Alert.alert("Documento firmado", "La firma se aplicó correctamente.");
      } catch (e) {
        Alert.alert("No se pudo firmar", String(e));
      } finally {
        setBusy(false);
      }
    },
    [pendingPlacement, currentDoc, onSignedUpdate, loadCurrentFile]
  );

  const handleShare = useCallback(async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("No disponible", "Compartir no está disponible en este dispositivo.");
      return;
    }
    await withRelockPaused(() => Sharing.shareAsync(currentDoc.uri));
  }, [currentDoc.uri]);

  const goToPage = useCallback(
    (delta: number) => {
      const next = Math.min(numPages, Math.max(1, currentPage + delta));
      sendToWeb({ type: "goToPage", page: next });
    },
    [currentPage, numPages, sendToWeb]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>Cerrar</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {currentDoc.name}
        </Text>
        <Pressable onPress={handleShare} hitSlop={12}>
          <Text style={styles.shareText}>Compartir</Text>
        </Pressable>
      </View>

      <Text style={styles.helper}>
        {currentDoc.status === "firmado"
          ? "Documento firmado. Toca de nuevo para agregar otra firma si lo necesitas."
          : "Toca el punto exacto del documento donde quieres colocar tu firma."}
      </Text>

      <View style={styles.webviewWrap}>
        {viewerUri ? (
          <WebView
            ref={webviewRef}
            source={{ uri: viewerUri }}
            originWhitelist={["*"]}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            javaScriptEnabled
            onMessage={handleMessage}
            style={{ backgroundColor: "transparent" }}
          />
        ) : (
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} />
        )}
        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color={COLORS.panel} />
            <Text style={styles.busyText}>Firmando…</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.pagerRow}>
        <Pressable onPress={() => goToPage(-1)} disabled={currentPage <= 1}>
          <Text style={[styles.pagerText, currentPage <= 1 && styles.pagerDisabled]}>‹ Anterior</Text>
        </Pressable>
        <Text style={styles.pagerLabel}>
          Página {currentPage} / {numPages}
        </Text>
        <Pressable onPress={() => goToPage(1)} disabled={currentPage >= numPages}>
          <Text style={[styles.pagerText, currentPage >= numPages && styles.pagerDisabled]}>
            Siguiente ›
          </Text>
        </Pressable>
      </View>

      {pendingPlacement ? (
        <View style={styles.confirmBar}>
          <Text style={styles.confirmText}>
            Punto seleccionado en página {pendingPlacement.page}.
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable style={styles.confirmCancel} onPress={() => setPendingPlacement(null)}>
              <Text style={styles.confirmCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={confirmPlacement}>
              <Text style={styles.confirmButtonText}>Firmar aquí</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <SignaturePadModal
        visible={signaturePadVisible}
        onCancel={() => setSignaturePadVisible(false)}
        onSigned={handleSigned}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeText: { color: COLORS.inkMuted, fontSize: 14, fontWeight: "600" },
  title: { color: COLORS.ink, fontSize: 14, fontWeight: "700", flex: 1, marginHorizontal: 10, textAlign: "center" },
  shareText: { color: COLORS.accent, fontSize: 14, fontWeight: "700" },
  helper: { color: COLORS.inkMuted, fontSize: 12, marginTop: 8, marginBottom: 8, textAlign: "center" },
  webviewWrap: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
  },
  busyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(30,42,58,0.65)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  busyText: { color: COLORS.panel, fontWeight: "600" },
  pagerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  pagerText: { color: COLORS.accent, fontWeight: "700", fontSize: 13 },
  pagerDisabled: { color: COLORS.inkMuted },
  pagerLabel: { color: COLORS.inkMuted, fontSize: 12 },
  confirmBar: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    gap: 8,
  },
  confirmText: { color: COLORS.ink, fontSize: 12 },
  confirmCancel: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  confirmCancelText: { color: COLORS.inkMuted, fontWeight: "600", fontSize: 13 },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmButtonText: { color: COLORS.panel, fontWeight: "700", fontSize: 13 },
});
