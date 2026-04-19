# APP-002 — Migración a Firebase Hosting

Fecha: 2026-04-19
Rama: `feature/firebase-hosting`

## Resumen

El sitio estático de APP-002 se sirve ahora desde Firebase Hosting,
proyecto `antigravity-app007`, en la ruta:

- **URL oficial**: https://antigravity-app007.web.app/app002/
- **URL alterna**: https://antigravity-app007.firebaseapp.com/app002/

## Archivos desplegados

Se copiaron **sin modificaciones** (el frontend ya era 100% estático y
usa únicamente rutas relativas, compatibles con Firebase):

- `index.html`
- `style.css`
- `app.js`
- `drive-reader.js`
- `data/CPVA_*.json` (9 módulos)

## Ubicación del deploy

El hub de deploy vive en:

```
C:/Automatizaciones/firebase-hosting-hub/public/app002/
```

Para re-desplegar tras cambios en este repo:

```bash
# 1) Copiar archivos modificados al hub
cp index.html style.css app.js drive-reader.js \
   C:/Automatizaciones/firebase-hosting-hub/public/app002/
cp data/*.json \
   C:/Automatizaciones/firebase-hosting-hub/public/app002/data/

# 2) Desplegar
cd C:/Automatizaciones/firebase-hosting-hub
firebase deploy --only hosting
```

## Fallback

GitHub Pages se mantiene activo como fallback — no se elimina.

## Pendiente (acción manual Luis)

La API key de Drive (`AIzaSyCnszcj3XPvSca_oNGJtDyMZuYpYlwD99k`)
está restringida a referrers `*.github.io`. Para que siga funcionando
desde Firebase, añade también:

- `*.web.app/*`
- `*.firebaseapp.com/*`

en Google Cloud Console → APIs & Services → Credentials → API key → Website restrictions.

Si no se actualiza, las funciones de listado Drive fallarán en Firebase,
aunque el contenido local (`data/CPVA_*.json`) y los audios
`uc?export=download` seguirán funcionando sin key.
