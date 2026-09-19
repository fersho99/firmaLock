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
    // Cambiar de color mientras hay trazo dibujado reinicia el pad: la
    // librería no permite recolorear un trazo ya hecho, así que evitamos
    // confusión borrando y avisando en vez de mezclar colores a medias.
    padRef.current?.clearSignature();
    setPenColor(color);
  };

  // Con tinta blanca, un fondo claro hace desaparecer el trazo mientras se
  // dibuja (aunque el PNG se exporte transparente, no se vería nada en
  // pantalla). Si se elige blanco, oscurecemos el fondo visible del pad
  // solo para que se pueda ver lo que se está firmando.
  const isWhitePen = penColor === "#FFFFFF";
  const padVisibleBg = isWhitePen ? "#1A1A1A" : "#F5F5F5";

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

        <View style={[styles.padWrap, { backgroundColor: padVisibleBg }]}>
          <SignatureCanvas
            ref={padRef}
            key={penColor}
            onOK={(sig) => onSigned(sig)}
            onEmpty={() => Alert.alert("Firma vacía", "Dibuja tu firma dentro del recuadro antes de continuar.")}
            autoClear={false}
            descriptionText=""
            webStyle={getSignaturePadWebStyle(padVisibleBg)}
            // Fondo transparente: el trazo se exporta sin ningún rectángulo
            // de color detrás, así se ve bien sobre cualquier documento sin
            // importar si la página es clara u oscura.
            backgroundColor="transparent"
            penColor={penColor}
            minWidth={2.5}
            maxWidth={4.5}
          />
        </View>

        {/* Botones nativos de RN, no los del footer HTML del componente
            (esos a veces no se ven bien dentro del WebView en un Modal). */}
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

// Ocultamos el footer HTML propio del componente (sus botones "Clear"/"Confirm")
// porque dentro de un WebView, en un Modal, a veces quedan recortados o
// invisibles; los reemplazamos por los botones nativos de arriba, que llaman
// a los mismos métodos (clearSignature / readSignature) por referencia.
// El fondo visible del body cambia según el color de tinta (ver padVisibleBg
// arriba): claro para tintas oscuras, oscuro para tinta blanca. Esto es solo
// visual dentro del WebView — el PNG que se exporta sigue siendo transparente
// (backgroundColor="transparent" en el SignatureCanvas), así que no afecta
// cómo se ve la firma ya estampada en el documento.
function getSignaturePadWebStyle(bgColor: string) {
  return `
    .m-signature-pad { box-shadow: none; border: none; margin: 0; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; margin: 0; }
    body,html { background-color: ${bgColor}; height: 100%; }
  `;
}

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
