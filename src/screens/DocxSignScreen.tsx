import React, { useCallback, useEffect, useState } from "react";
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
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { authenticate } from "../lib/biometrics";
import { withRelockPaused } from "../lib/relockGuard";
import { extractDocxText } from "../lib/docxRead";
import { appendSignatureToDocx } from "../lib/docxSign";
import { markSigned, type DocumentItem } from "../lib/db";
import { saveSignedCopy } from "../lib/docStorage";
import SignaturePadModal from "../components/SignaturePadModal";
import { COLORS } from "../theme";

type Props = {
  document: DocumentItem;
  onClose: () => void;
  onSignedUpdate: (updated: DocumentItem) => void;
};

export default function DocxSignScreen({ document: doc, onClose, onSignedUpdate }: Props) {
  const insets = useSafeAreaInsets();
  const [lines, setLines] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signaturePadVisible, setSignaturePadVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentDoc, setCurrentDoc] = useState(doc);

  useEffect(() => {
    (async () => {
      try {
        const file = new File(currentDoc.uri);
        const text = await extractDocxText(file);
        setLines(text);
      } catch (e) {
        setLoadError(String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDoc.uri]);

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
          "Bryan Fernando Medina Zavala"
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
        const text = await extractDocxText(signedFile);
        setLines(text);
        Alert.alert("Documento firmado", "Se agregó tu firma al final del documento.");
      } catch (e) {
        Alert.alert("No se pudo firmar", String(e));
      } finally {
        setBusy(false);
      }
    },
    [currentDoc, onSignedUpdate]
  );

  const handleShare = useCallback(async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("No disponible", "Compartir no está disponible en este dispositivo.");
      return;
    }
    await withRelockPaused(() => Sharing.shareAsync(currentDoc.uri));
  }, [currentDoc.uri]);

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

      <View style={styles.docPanel}>
        {loadError ? (
          <Text style={styles.errorText}>{loadError}</Text>
        ) : !lines ? (
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {lines.map((line, i) => (
              <Text key={i} style={styles.paragraph}>
                {line || " "}
              </Text>
            ))}
          </ScrollView>
        )}
      </View>

      <Text style={styles.helper}>
        {currentDoc.status === "firmado"
          ? "Ya se agregó tu firma al final del documento."
          : "La firma se agregará como bloque de cierre al final del documento."}
      </Text>

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
  docPanel: {
    flex: 1,
    marginTop: 10,
    backgroundColor: COLORS.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
  },
  paragraph: { color: COLORS.ink, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  errorText: { color: COLORS.danger, padding: 16 },
  helper: { color: COLORS.inkMuted, fontSize: 12, marginTop: 10, textAlign: "center" },
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
