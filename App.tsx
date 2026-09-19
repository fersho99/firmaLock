import "react-native-get-random-values";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LockScreen from "./src/screens/LockScreen";
import DocumentsScreen from "./src/screens/DocumentsScreen";
import PdfSignScreen from "./src/screens/PdfSignScreen";
import DocxSignScreen from "./src/screens/DocxSignScreen";
import { isRelockPaused } from "./src/lib/relockGuard";
import type { DocumentItem } from "./src/lib/db";
import { COLORS } from "./src/theme";

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [openDoc, setOpenDoc] = useState<DocumentItem | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (
        appState.current === "active" &&
        next === "background" &&
        !isRelockPaused()
      ) {
        setUnlocked(false);
        setOpenDoc(null);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const handleUnlock = useCallback(() => setUnlocked(true), []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      {unlocked ? (
        openDoc ? (
          openDoc.type === "pdf" ? (
            <PdfSignScreen
              document={openDoc}
              onClose={() => setOpenDoc(null)}
              onSignedUpdate={setOpenDoc}
            />
          ) : (
            <DocxSignScreen
              document={openDoc}
              onClose={() => setOpenDoc(null)}
              onSignedUpdate={setOpenDoc}
            />
          )
        ) : (
          <DocumentsScreen onOpenDocument={setOpenDoc} />
        )
      ) : (
        <LockScreen onUnlock={handleUnlock} />
      )}
    </SafeAreaProvider>
  );
}
