import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { authenticate } from "../lib/biometrics";
import { withRelockPaused } from "../lib/relockGuard";
import { extractDocxParagraphs, type DocxParagraph } from "../lib/docxRead";
import { appendSignatureToDocx } from "../lib/docxSign";
import { ensureDocxPreviewRuntime } from "../lib/docxPreviewRuntime";
import { markSigned, markUnsigned, type DocumentItem } from "../lib/db";
import { saveSignedCopy, getOriginalFile, deleteDocumentFile } from "../lib/docStorage";
import SignaturePadModal from "../components/SignaturePadModal";
import { COLORS } from "../theme";

type Props = {
  document: DocumentItem;
  onClose: () => void;
  onSignedUpdate: (updated: DocumentItem) => void;
};

type ViewMode = "texto" | "vista";

export default function DocxSignScreen({ document: doc, onClose, onSignedUpdate }: Props) {
  const insets = useSafeAreaInsets();
  const [paragraphs, setParagraphs] = useState<DocxParagraph[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signaturePadVisible, setSignaturePadVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentDoc, setCurrentDoc] = useState(doc);
  // Índice del párrafo elegido por el usuario para firmar justo después.
  // null = comportamiento por defecto (firmar al final del documento).
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("texto");
  const webviewRef = useRef<WebView>(null);
  const [previewViewerUri, setPreviewViewerUri] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const file = new File(currentDoc.uri);
        const parsed = await extractDocxParagraphs(file);
        setParagraphs(parsed);
        setTargetIndex(null);
      } catch (e) {
        setLoadError(String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDoc.uri]);

  useEffect(() => {
    (async () => {
      const uri = await ensureDocxPreviewRuntime();
      setPreviewViewerUri(uri);
    })();
  }, []);

  const sendPreviewLoad = useCallback(async () => {
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      const file = new File(currentDoc.uri);
      const base64 = await file.base64();
      webviewRef.current?.postMessage(JSON.stringify({ type: "load", base64 }));
    } catch (e) {
      setPreviewLoading(false);
      setPreviewError(String(e));
    }
  }, [currentDoc.uri]);

  // Cuando se entra a "Vista previa" (y el visor ya está listo), o cuando el
  // documento cambia (por ejemplo, tras firmar) estando ya en ese modo, se
  // manda a renderizar el .docx actual dentro del WebView.
  useEffect(() => {
    if (viewMode === "vista" && previewReady) {
      sendPreviewLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, previewReady, currentDoc.uri]);

  const handlePreviewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === "ready") {
          setPreviewReady(true);
        } else if (msg.type === "rendered") {
          setPreviewLoading(false);
        } else if (msg.type === "error") {
          setPreviewLoading(false);
          setPreviewError(msg.message || "No se pudo mostrar la vista previa.");
        }
      } catch {
        // ignora mensajes que no son JSON válido
      }
    },
    []
  );

  const startSignFlow = useCallback(async () => {
    const success = await withRelockPaused(() =>
      authenticate("Confirma tu identidad para firmar este documento")
    );
    if (!success) {
      Alert.alert("Verificación fallida", "No se pudo confirmar tu identidad.");
      return;
    }
    setSignaturePadVisible(true);
  }, []);

  const handleSigned = useCallback(
    async (base64Png: string) => {
      setSignaturePadVisible(false);
      setBusy(true);
      try {
        const original = new File(currentDoc.uri);
        const signedBytes = await appendSignatureToDocx(
          original,
          base64Png,
          "Bryan Fernando Medina Zavala",
          targetIndex
        );
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
        const parsed = await extractDocxParagraphs(signedFile);
        setParagraphs(parsed);
        setTargetIndex(null);
        Alert.alert("Documento firmado", "Se agregó tu firma en el lugar seleccionado.");
      } catch (e) {
        Alert.alert("No se pudo firmar", String(e));
      } finally {
        setBusy(false);
      }
    },
    [currentDoc, onSignedUpdate, targetIndex]
  );

  const handleShare = useCallback(async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("No disponible", "Compartir no está disponible en este dispositivo.");
      return;
    }
    if (currentDoc.status !== "firmado") {
      Alert.alert(
        "Documento sin firmar",
        "Este documento todavía no tiene tu firma. ¿Seguro que quieres compartirlo así?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Compartir de todos modos",
            onPress: () => withRelockPaused(() => Sharing.shareAsync(currentDoc.uri)),
          },
        ]
      );
      return;
    }
    await withRelockPaused(() => Sharing.shareAsync(currentDoc.uri));
  }, [currentDoc.uri, currentDoc.status]);

  const removeSignature = useCallback(() => {
    Alert.alert(
      "Quitar firma",
      "Se eliminará la firma y el documento volverá a su versión original, sin firmar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar firma",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const original = getOriginalFile(currentDoc);
              const signedUri = currentDoc.uri;
              await markUnsigned(currentDoc.id, original.uri);
              if (signedUri !== original.uri) {
                deleteDocumentFile(signedUri);
              }
              const updated: DocumentItem = {
                ...currentDoc,
                uri: original.uri,
                status: "pendiente",
                signedAt: null,
              };
              setCurrentDoc(updated);
              onSignedUpdate(updated);
              setTargetIndex(null);
              const parsed = await extractDocxParagraphs(original);
              setParagraphs(parsed);
            } catch (e) {
              Alert.alert("No se pudo quitar la firma", String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }, [currentDoc, onSignedUpdate]);

  const selectedParagraph =
    targetIndex != null ? paragraphs?.find((p) => p.index === targetIndex) : null;

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

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeButton, viewMode === "texto" && styles.modeButtonActive]}
          onPress={() => setViewMode("texto")}
        >
          <Text style={[styles.modeButtonText, viewMode === "texto" && styles.modeButtonTextActive]}>
            Elegir dónde firmar
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeButton, viewMode === "vista" && styles.modeButtonActive]}
          onPress={() => setViewMode("vista")}
        >
          <Text style={[styles.modeButtonText, viewMode === "vista" && styles.modeButtonTextActive]}>
            Vista previa
          </Text>
        </Pressable>
      </View>

      {currentDoc.status === "firmado" ? (
        <Pressable onPress={removeSignature} disabled={busy} style={styles.removeSignatureButton}>
          <Text style={styles.removeSignatureText}>Quitar firma</Text>
        </Pressable>
      ) : null}

      {viewMode === "texto" ? (
        <>
          <Text style={styles.helper}>
            {currentDoc.status === "firmado" && targetIndex == null
              ? "Ya se agregó tu firma. Toca un párrafo si quieres firmar de nuevo en otro lugar."
              : "Toca el párrafo o renglón después del cual quieres que aparezca tu firma."}
          </Text>

          <View style={styles.docPanel}>
            {loadError ? (
              <Text style={styles.errorText}>{loadError}</Text>
            ) : !paragraphs ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {paragraphs.map((p) => {
                  const selected = p.index === targetIndex;
                  return (
                    <Pressable
                      key={p.index}
                      onPress={() => setTargetIndex(selected ? null : p.index)}
                      style={[styles.paragraphRow, selected && styles.paragraphRowSelected]}
                    >
                      <Text style={[styles.paragraph, selected && styles.paragraphSelected]}>
                        {p.text || "(renglón en blanco)"}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={styles.targetBar}>
            <Text style={styles.targetText} numberOfLines={2}>
              {selectedParagraph
                ? `Firma justo después de: "${selectedParagraph.text || "(renglón en blanco)"}"`
                : "Sin selección: la firma se agregará al final del documento."}
            </Text>
            {targetIndex != null ? (
              <Pressable onPress={() => setTargetIndex(null)} hitSlop={10}>
                <Text style={styles.targetClear}>Quitar</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.helper}>
            Así se ve el documento real (formato, tablas y saltos). Solo para consultar — para
            elegir dónde firmar usa "Elegir dónde firmar".
          </Text>
          <View style={styles.docPanel}>
            {previewViewerUri ? (
              <WebView
                ref={webviewRef}
                source={{ uri: previewViewerUri }}
                originWhitelist={["*"]}
                allowFileAccess
                allowFileAccessFromFileURLs
                allowUniversalAccessFromFileURLs
                javaScriptEnabled
                onMessage={handlePreviewMessage}
                style={{ backgroundColor: "transparent" }}
              />
            ) : (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} />
            )}
            {previewLoading ? (
              <View style={styles.previewLoadingOverlay}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : null}
            {previewError ? (
              <View style={styles.previewLoadingOverlay}>
                <Text style={styles.errorText}>{previewError}</Text>
              </View>
            ) : null}
          </View>
        </>
      )}

      <Pressable
        style={({ pressed }) => [styles.signButton, pressed && styles.pressed]}
        onPress={startSignFlow}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={COLORS.panel} />
        ) : (
          <Text style={styles.signButtonText}>
            {currentDoc.status === "firmado" ? "Firmar de nuevo" : "Firmar documento"}
          </Text>
        )}
      </Pressable>

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
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: COLORS.accentDim,
    borderColor: COLORS.accent,
  },
  modeButtonText: { color: COLORS.inkMuted, fontSize: 12, fontWeight: "700" },
  modeButtonTextActive: { color: COLORS.accent },
  removeSignatureButton: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  removeSignatureText: { color: COLORS.danger, fontSize: 12, fontWeight: "700" },
  helper: { color: COLORS.inkMuted, fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: "center" },
  docPanel: {
    flex: 1,
    marginTop: 6,
    backgroundColor: COLORS.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    overflow: "hidden",
  },
  previewLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    padding: 16,
  },
  paragraphRow: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  paragraphRowSelected: {
    backgroundColor: COLORS.accentDim,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  paragraph: { color: COLORS.ink, fontSize: 14, lineHeight: 21 },
  paragraphSelected: { color: COLORS.accent, fontWeight: "700" },
  errorText: { color: COLORS.danger, padding: 16, textAlign: "center" },
  targetBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  targetText: { color: COLORS.inkMuted, fontSize: 12, flex: 1 },
  targetClear: { color: COLORS.danger, fontSize: 12, fontWeight: "700" },
  signButton: {
    marginTop: 12,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  pressed: { opacity: 0.85 },
  signButtonText: { color: COLORS.panel, fontWeight: "700", fontSize: 15 },
});
