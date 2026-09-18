import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listDocuments, deleteDocument, type DocumentItem } from "../lib/db";
import { pickAndImportDocument, deleteDocumentFile } from "../lib/docStorage";
import { withRelockPaused } from "../lib/relockGuard";
import { COLORS } from "../theme";

type Props = {
  onOpenDocument: (doc: DocumentItem) => void;
};

export default function DocumentsScreen({ onOpenDocument }: Props) {
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(async () => {
    setDocuments(await listDocuments());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const item = await withRelockPaused(() => pickAndImportDocument());
      if (item) {
        setDocuments((prev) => [item, ...prev]);
      }
    } catch (e) {
      Alert.alert("No se pudo importar", String(e));
    } finally {
      setImporting(false);
    }
  }, []);

  const handleDelete = useCallback((doc: DocumentItem) => {
    Alert.alert("Eliminar documento", `¿Eliminar "${doc.name}" de la bóveda?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          deleteDocumentFile(doc.uri);
          await deleteDocument(doc.id);
          setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        },
      },
    ]);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.wordmark}>FIRMALOCK</Text>
          <Text style={styles.helper}>Documentos protegidos por biometría</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.importButton, pressed && styles.pressed]}
          onPress={handleImport}
          disabled={importing}
        >
          <Text style={styles.importButtonText}>{importing ? "…" : "+ Importar"}</Text>
        </Pressable>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Importa un PDF o Word (.docx) para empezar. Se guarda cifrado detrás de tu huella/Face ID.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => onOpenDocument(item)}
            onLongPress={() => handleDelete(item)}
          >
            <View style={styles.rowIcon}>
              <Text style={styles.rowIconText}>{item.type === "pdf" ? "PDF" : "DOC"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowSub}>
                {item.status === "firmado"
                  ? `Firmado · ${item.signedAt ? new Date(item.signedAt).toLocaleString() : ""}`
                  : "Pendiente de firma"}
              </Text>
            </View>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: item.status === "firmado" ? COLORS.success : COLORS.gold },
              ]}
            />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  wordmark: { color: COLORS.ink, fontSize: 20, fontWeight: "700", letterSpacing: 2 },
  helper: { color: COLORS.inkMuted, fontSize: 12, marginTop: 2 },
  importButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pressed: { opacity: 0.85 },
  importButtonText: { color: COLORS.panel, fontWeight: "700", fontSize: 13 },
  emptyText: { color: COLORS.inkMuted, fontSize: 13, lineHeight: 19, marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    marginBottom: 10,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: { color: COLORS.accent, fontWeight: "800", fontSize: 11 },
  rowName: { color: COLORS.ink, fontSize: 14, fontWeight: "600" },
  rowSub: { color: COLORS.inkMuted, fontSize: 12, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
