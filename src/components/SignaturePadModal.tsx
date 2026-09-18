import React, { useRef, useState } from "react";
import { View, Text, Modal, StyleSheet, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SignatureCanvas, { type SignatureViewRef } from "react-native-signature-canvas";
import { COLORS } from "../theme";

type Props = {
  visible: boolean;
  onCancel: () => void;
  onSigned: (base64Png: string) => void;
};

const PEN_COLORS = [
  { label: "Negro", value: "#0A0A0A" },
  { label: "Azul", value: "#1E3A8A" },
  { label: "Rojo", value: "#8B2E2E" },
  { label: "Blanco", value: "#FFFFFF" },
];

export default function SignaturePadModal({ visible, onCancel, onSigned }: Props) {
  const insets = useSafeAreaInsets();
  const padRef = useRef<SignatureViewRef>(null);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);

  const handlePickColor = (color: string) => {
    padRef.current?.clearSignature();
    setPenColor(color);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <Text style={styles.title}>Dibuja tu firma</Text>
        <Text style={styles.helper}>
          Ya verificamos tu identidad con biometría. Firma con el dedo dentro del recuadro.
        </Text>

        <View style={styles.colorRow}>
          {PEN_COLORS.map((c) => (
            <Pressable
              key={c.value}
              onPress={() => handlePickColor(c.value)}
              style={[
                styles.swatch,
                { backgroundColor: c.value },
                penColor === c.value && styles.swatchSelected,
              ]}
              accessibilityLabel={`Color de tinta ${c.label}`}
            />
          ))}
        </View>

        <View style={styles.padWrap}>
          <SignatureCanvas
            ref={padRef}
            key={penColor}
            onOK={(sig) => onSigned(sig)}
            onEmpty={() => Alert.alert("Firma vacía", "Dibuja tu firma dentro del recuadro antes de continuar.")}
            autoClear={false}
            descriptionText=""
            webStyle={signaturePadWebStyle}
            backgroundColor="transparent"
            penColor={penColor}
            minWidth={2.5}
            maxWidth={4.5}
          />
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => padRef.current?.clearSignature()}
          >
            <Text style={styles.secondaryButtonText}>Borrar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => padRef.current?.readSignature()}
          >
            <Text style={styles.primaryButtonText}>Usar esta firma</Text>
          </Pressable>
        </View>

        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const signaturePadWebStyle = `
  .m-signature-pad { box-shadow: none; border: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; margin: 0; }
  body,html { background-color: #F5F5F5; height: 100%; }
`;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },
  title: { color: COLORS.ink, fontSize: 18, fontWeight: "700" },
  helper: { color: COLORS.inkMuted, fontSize: 13, marginTop: 6, marginBottom: 12 },
  colorRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchSelected: {
    borderColor: COLORS.accent,
  },
  padWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    backgroundColor: "#F5F5F5",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    alignItems: "center",
  },
  secondaryButtonText: { color: COLORS.inkMuted, fontWeight: "700", fontSize: 14 },
  primaryButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    alignItems: "center",
  },
  primaryButtonText: { color: COLORS.panel, fontWeight: "700", fontSize: 14 },
  pressed: { opacity: 0.85 },
  cancelButton: { alignItems: "center", paddingVertical: 14 },
  cancelText: { color: COLORS.inkMuted, fontSize: 14, fontWeight: "600" },
});
