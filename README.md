# FirmaLock

Aplicación móvil de firma electrónica con verificación biométrica. Permite importar un documento PDF o Word (.docx), visualizarlo dentro de la app y, antes de estampar la firma, solicita huella dactilar o Face ID para confirmar la identidad del usuario.

## Alcance

- Firma **dibujada a mano** (no es firma digital criptográfica con certificado).
- **PDF**: visor completo basado en pdf.js dentro de un WebView. El usuario toca el punto exacto de la página donde desea la firma, confirma con biometría, dibuja su firma y esta se estampa en esa posición usando `pdf-lib`, con coordenadas reales del PDF.
- **DOCX**: se muestra el texto extraído del documento (solo lectura, sin formato enriquecido) y la firma se agrega como bloque de cierre al final (imagen de la firma + "Firmado por / fecha"), manipulando directamente el paquete OOXML del `.docx`. Colocar la firma en un punto arbitrario del documento requeriría un motor de layout completo, fuera del alcance de este proyecto.

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior y npm
- JDK 21
- Para Android: [Android Studio](https://developer.android.com/studio) (SDK y herramientas de línea de comandos) o un dispositivo físico con depuración USB habilitada
- Para iOS (solo macOS): Xcode y un simulador o dispositivo físico

## Instalación

```bash
git clone <url-del-repositorio>
cd FirmaLock
npm install
```

## Generar el proyecto nativo de Android

```bash
npx expo prebuild -p android
```

Si el `prebuild` sobrescribe la configuración de Gradle, añade en `android/settings.gradle`, dentro del bloque `plugins { }`:

```
id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
```

Si aparece un error de "restricted method" o de toolchain de Java:

```bash
cd android
./gradlew.bat updateDaemonJvm --jvm-version 21
cd ..
```

## Ejecución en desarrollo

```bash
npm start          # inicia el servidor de Expo
npm run android     # ejecuta en Android (emulador o dispositivo conectado por USB)
npm run ios         # ejecuta en iOS (solo macOS)
npm run web         # ejecuta en navegador
```

## Estructura del código

- `src/lib/biometrics.ts`, `relockGuard.ts` — autenticación biométrica y bloqueo automático de la app.
- `src/lib/db.ts` — base de datos SQLite, tabla `documents` (pendiente/firmado).
- `src/lib/docStorage.ts` — importa PDF/DOCX al almacenamiento privado de la app.
- `src/lib/pdfSign.ts` — estampa la firma en el PDF con `pdf-lib`.
- `src/lib/docxSign.ts` — agrega el bloque de firma al `.docx` editando su XML (vía `jszip`).
- `src/lib/docxRead.ts` — extrae texto plano del `.docx` para su lectura.
- `src/lib/pdfjsRuntime.ts` — escribe pdf.js (embebido en base64 en `src/assets/`) a disco para que el WebView lo cargue mediante `file://`.
- `src/screens/PdfSignScreen.tsx` — visor de PDF y flujo de firma por coordenadas.
- `src/screens/DocxSignScreen.tsx` — visor de texto y firma al final del documento.
- `src/components/SignaturePadModal.tsx` — pizarra de firma táctil.

## Limitación conocida

La conversión de coordenadas del toque en el PDF (evento de clic sobre el canvas de pdf.js, convertido a coordenadas del PDF con `convertToPdfPoint`, usado luego por `pdfSign.ts` para dibujar la firma) puede requerir ajuste fino según el dispositivo. Si la firma no queda exactamente donde se tocó, revisar el offset en `pdfSign.ts` (`SIGNATURE_WIDTH_PT` / `SIGNATURE_HEIGHT_PT` y el cálculo de `x`/`y`).

## Licencia

Ver el archivo [LICENSE](./LICENSE).
