import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { authenticate, checkBiometricSupport } from "../lib/biometrics";
import { COLORS } from "../theme";

type Props = {
  onUnlock: () => void;
};

export default function LockScreen({ onUnlock }: Props) {
  const [supportChecked, setSupportChecked] = useState(false);
  const [canUse, setCanUse] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tryUnlock = useCallback(async () => {
    setError(null);
    setAuthenticating(true);
    try {
      const success = await authenticate("Desbloquea FirmaLock");
      if (success) {
        onUnlock();
      } else {
        setError("No se pudo verificar tu identidad.");
      }
    } finally {
      setAuthenticating(false);
    }
  }, [onUnlock]);

  useEffect(() => {
    (async () => {
      const support = await checkBiometricSupport();
      setCanUse(support.canUse);
      setSupportChecked(true);
      if (support.canUse) {
        tryUnlock();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.seal}>
        <Text style={styles.sealMark}>F</Text>
      </View>
      <Text style={styles.title}>FIRMALOCK</Text>
      <Text style={styles.subtitle}>Firma electrónica con verificación biométrica</Text>

      {!supportChecked ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 32 }} />
      ) : !canUse ? (
        <Text style={styles.warning}>
          Este dispositivo no tiene biometría configurada. Activa huella o Face ID en los
          ajustes del sistema para usar FirmaLock.
        </Text>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={tryUnlock}
            disabled={authenticating}
          >
            {authenticating ? (
              <ActivityIndicator color={COLORS.panel} />
            ) : (
              <Text style={styles.buttonText}>Desbloquear</Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  seal: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    backgroundColor: COLORS.accentDim,
  },
  sealMark: {
    color: COLORS.accent,
    fontSize: 30,
    fontWeight: "800",
  },
  title: {
    color: COLORS.ink,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 3,
  },
  subtitle: {
    color: COLORS.inkMuted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 12,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  warning: {
    color: COLORS.danger,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 12,
  },
  error: {
    color: COLORS.danger,
    marginBottom: 12,
  },
  button: {
    marginTop: 28,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 200,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: COLORS.panel,
    fontWeight: "700",
    fontSize: 16,
  },
});
