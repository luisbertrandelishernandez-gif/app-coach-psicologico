# DIAGNÓSTICO APP-002 — BOTÓN AYUDA + TTS

**Fecha:** 2026-04-17
**Orquestador:** Opus 4.7
**Subagentes:** Sonnet 4.5 × 2 (paralelo, worktrees aislados)

## 1. Ruta del repo localizado

- Repo local: `E:\apps\app-coach-psicologico` (clonado en esta misión — no existía previamente).
- Remoto: `https://github.com/luisbertrandelishernandez-gif/app-coach-psicologico.git`
- Base: `main` en `c60ca5e feat: reconstrucción APP-002 con secciones Hoy + Aprendizaje CPVA`.
- Working tree limpio.

## 2. Mapa de archivos y funciones a tocar

### `index.html` (176 líneas)
- `<nav>` líneas 16-33: contiene `#btn-hoy` y `#btn-aprendizaje`. **AQUÍ se inyecta el botón "?" de Ayuda** (nuevo `#btn-ayuda`).
- Fin del `<body>` (antes de los `<script>`): se añade el markup del modal de Ayuda (`<div id="modal-ayuda">...</div>`).

### `app.js` (815 líneas)
- `renderizarEjercicios(ejercicios)` (línea 695): añade botón 🔊 TTS junto a cada ejercicio. Texto a leer = `nombre` + `pasos` concatenados + `indicaciones` + `contraindicaciones`.
- `renderizarFichas(fichas)` (línea 740): botón 🔊 junto a cada ficha. Texto = `titulo` + `contenido`.
- `cargarContenidoDelDia()` → bloque reflexión (líneas 347-356) y `renderizarJsonCPVA` (línea 496): botón 🔊 junto a la reflexión diaria / descripción de módulo.
- `DOMContentLoaded` (línea 805): inicializar carga de voces TTS (warmup) y enlazar botón Ayuda.
- Al final: nuevas funciones `abrirModalAyuda()`, `cerrarModalAyuda()`, `crearBotonTTS()`, `obtenerVozEspañola()`, gestión de `app002_tts_rate`.

### `style.css` (810 líneas)
- Bloque `.nav-btn` (líneas 462-492): añadir `.nav-btn-ayuda` circular (44×44 px) con símbolo "?".
- Nuevos bloques al final: `.modal-overlay`, `.modal-ayuda`, `.btn-tts` (44×44 px), selector de velocidad, responsive móvil.

## 3. Plan de inyección

### Fase 2A — Subagente A (Ayuda)
Rama: `feat/ayuda-20260417` desde `main`.
- Editar `index.html`: añadir botón `?` en `<nav>` + markup completo del modal al final.
- Editar `app.js`: añadir `abrirModalAyuda()`, `cerrarModalAyuda()`, gestión de foco (trap + retorno al trigger), escape, click-outside. Selector de velocidad TTS dentro del modal (radio buttons 0.75 / 1.0 / 1.25) que lee/escribe `localStorage.app002_tts_rate`.
- Editar `style.css`: estilos modal, overlay, responsive, focus-visible WCAG AAA.
- Commit: `feat(ayuda): modal de ayuda accesible con guía de uso`.

### Fase 2B — Subagente B (TTS)
Rama: `feat/tts-20260417` desde `main`.
- Editar `app.js`: añadir `crearBotonTTS(textoOFn, contenedor)`, control global `__ttsActive`, patrón `voiceschanged` + fallback. Inyectar llamadas en `renderizarEjercicios`, `renderizarFichas`, bloque reflexión y `renderizarJsonCPVA`. Registrar `beforeunload → speechSynthesis.cancel()`.
- Editar `style.css`: estilos `.btn-tts` (44×44 px).
- Commit: `feat(tts): lectura en voz alta accesible para reflexión, ejercicios y fichas`.

### Consolidación (Opus 4.7)
1. Rama integradora `feat/ayuda-tts-20260417` desde `main`.
2. Cherry-pick del commit Ayuda.
3. Cherry-pick del commit TTS.
4. Resolver conflictos (se esperan en `style.css` al final del archivo y en inyecciones de `app.js`).
5. Fast-forward merge a `main` + push.

## 4. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Conflicto al editar el final de `style.css` | Subagente A escribe un marcador `/* MODAL AYUDA START/END */` y Subagente B escribe `/* TTS START/END */`. Bloques separados. |
| Conflicto en `app.js` (ambos añaden helpers) | A añade código en la sección "MODAL AYUDA" al final; B añade en sección "TTS" al final. Ambos usan bloques delimitados por comentarios. |
| Modal choca con el selector de velocidad TTS | A crea el modal con un `<div id="tts-rate-selector">` listo. B (TTS) detecta ese contenedor en `DOMContentLoaded` y enlaza. |
| Regresión en Sección Hoy / CPVA | B solo añade botones al final de bloques renderizados; no modifica la lógica de filtrado/rotación. A no toca lógica de datos. |
| Bloqueo `speechSynthesis` al cambiar pestaña | `beforeunload` + llamada `cancel()` al iniciar nueva reproducción. |

## 5. Decisión metodológica

Se usan **worktrees git aislados** por subagente para permitir paralelismo real sin pisadas en el working tree. El orquestador consolida por cherry-pick en la rama integradora antes de tocar `main`.
