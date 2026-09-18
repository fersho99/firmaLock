# FirmaLock

Aplicación móvil (Expo / React Native) para firmar documentos PDF y DOCX de forma local, protegida con autenticación biométrica (huella / Face ID).

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
- npm (incluido con Node.js)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (se ejecuta automáticamente con `npx`, no requiere instalación global)
- Para ejecutar en Android:
  - [Android Studio](https://developer.android.com/studio) con un emulador configurado, o un dispositivo Android físico con depuración USB habilitada
  - JDK 17
- Para ejecutar en iOS (solo macOS):
  - Xcode y un simulador de iOS, o un dispositivo físico
- Alternativamente, la app [Expo Go](https://expo.dev/go) instalada en tu teléfono para probar rápidamente sin compilar de forma nativa

## Instalación

1. Clona el repositorio:
   ```bash
   git clone <url-del-repositorio>
   cd FirmaLock
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

## Ejecución en desarrollo

Inicia el servidor de desarrollo de Expo:

```bash
npm start
```

Desde ahí puedes:
- Presionar `a` para abrir en un emulador/dispositivo Android
- Presionar `i` para abrir en un simulador/dispositivo iOS (solo macOS)
- Escanear el código QR con la app **Expo Go** en tu teléfono

También puedes usar directamente:

```bash
npm run android   # Ejecutar en Android
npm run ios        # Ejecutar en iOS
npm run web        # Ejecutar en navegador
```

## Generar APK / build nativo de Android

El proyecto ya incluye la carpeta `android/` con el proyecto nativo generado. Para compilar un APK/AAB:

```bash
cd android
./gradlew assembleDebug       # Genera un APK de depuración
# o
./gradlew assembleRelease     # Genera un APK de producción
```

El APK resultante se encuentra en `android/app/build/outputs/apk/`.

## Funcionalidades principales

- Bloqueo de la app mediante autenticación biométrica (huella / Face ID)
- Importación y firma de documentos PDF
- Importación y firma de documentos DOCX
- Almacenamiento local de documentos y firmas (SQLite + almacenamiento seguro del dispositivo)

## Licencia

Ver el archivo [LICENSE](./LICENSE).
