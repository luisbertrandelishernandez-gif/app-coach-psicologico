/**
 * app.js — Coach Psicológico CPVA (APP-002)
 * Rotación secuencial cíclica de 11 cuadernos.
 * Podcasts: solo L/X/V. Reflexiones en texto: diarias.
 *
 * Tareas C1 + C3:
 *   - Validación de formato de API key (AIzaSy + 39 chars)
 *   - Test en vivo contra Drive API /about?fields=user
 *   - Mensajes de ayuda accesibles (aria-live)
 *   - Accesibilidad WCAG AAA (ver style.css)
 */

// Carpeta Drive principal de podcasts coach psicológico
const FOLDER_PODCASTS = '1p1Z3PnIhVrW_4t6l7CZgw7WocraSc_wc';

// 11 cuadernos en rotación secuencial cíclica
const CUADERNOS_CPVA = [
    'CPVA_01 TREC',
    'CPVA_03 Focusing',
    'CPVA_06 Ansiedad',
    'CPVA_11 Ira',
    'CPVA_12 Soledad',
    'CPVA_SAT_02 ACT',
    'CPVA_SAT_04 Logoterapia',
    'CPVA_SAT_05 Somática',
    'CPVA_SAT_07 Apego',
    'CPVA_SAT_08 TOC',
    'Resiliencia'
];

// Días con podcast (L=1, X=3, V=5)
const DIAS_PODCAST = [1, 3, 5];

/* ============================================================
   VALIDACIÓN Y GUARDADO DE API KEY
   ============================================================ */

/**
 * Valida el formato local de la API key de Google.
 * Debe empezar por "AIzaSy" y tener exactamente 39 caracteres.
 * @param {string} key
 * @returns {{ ok: boolean, mensaje: string }}
 */
function validarFormatoApiKey(key) {
    if (!key) {
        return { ok: false, mensaje: 'Introduce la API key para continuar.' };
    }
    if (!key.startsWith('AIzaSy')) {
        return { ok: false, mensaje: 'La key debe empezar por "AIzaSy".' };
    }
    if (key.length !== 39) {
        return {
            ok: false,
            mensaje: `Longitud incorrecta: tiene ${key.length} caracteres, debe tener 39.`
        };
    }
    return { ok: true, mensaje: '' };
}

/**
 * Hace una llamada mínima a Drive API para verificar que la key
 * es válida y la API está habilitada.
 *
 * IMPORTANTE: El endpoint /about?fields=user NO acepta API keys
 * (requiere OAuth2). Usamos /files con pageSize=1 que SÍ funciona
 * con API key para verificar la conexión.
 *
 * @param {string} key
 * @returns {Promise<{ ok: boolean, mensaje: string }>}
 */
async function testApiKeyEnVivo(key) {
    // Usamos files.list con pageSize=1 como test ligero — acepta API key
    const params = new URLSearchParams({
        key: key,
        pageSize: '1',
        fields: 'files(id)',
        q: `'${FOLDER_PODCASTS}' in parents and trashed=false`,
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true'
    });
    const url = `https://www.googleapis.com/drive/v3/files?${params}`;
    try {
        const resp = await fetch(url);
        if (resp.ok) {
            return {
                ok: true,
                mensaje: 'Conexión a Drive API correcta.'
            };
        }
        // Error HTTP: leer el cuerpo para dar un mensaje útil
        let errMsg = `Error ${resp.status}`;
        try {
            const errData = await resp.json();
            const detalle = errData?.error?.message || '';
            if (resp.status === 400) {
                errMsg = 'Key inválida. Revisa que hayas copiado la key completa.';
            } else if (resp.status === 403) {
                if (detalle.toLowerCase().includes('not been used') || detalle.toLowerCase().includes('disabled')) {
                    errMsg = 'La API de Google Drive no está habilitada en tu proyecto de Google Cloud. Ve a console.cloud.google.com → Biblioteca → Drive API → Habilitar.';
                } else if (detalle.toLowerCase().includes('referer') || detalle.toLowerCase().includes('ip')) {
                    errMsg = 'La key está restringida por dominio/IP. Añade este dominio a las restricciones de la key en Google Cloud Console.';
                } else {
                    errMsg = `Acceso denegado: ${detalle || 'verifica los permisos de la key.'}`;
                }
            } else {
                errMsg = detalle || errMsg;
            }
        } catch (_) { /* ignorar si el cuerpo no es JSON */ }
        return { ok: false, mensaje: errMsg };
    } catch (err) {
        return {
            ok: false,
            mensaje: 'No se pudo conectar con Google. Verifica tu conexión a internet.'
        };
    }
}

/**
 * Reacciona mientras el usuario escribe en el campo de API key:
 * habilita/deshabilita el botón según el formato.
 */
function onInputApiKey() {
    const input    = document.getElementById('input-api-key');
    const icono    = document.getElementById('api-key-icono');
    const estado   = document.getElementById('api-key-estado');
    const btnGuard = document.getElementById('btn-guardar-key');
    const key      = input.value.trim();

    const { ok, mensaje } = validarFormatoApiKey(key);

    icono.className  = 'api-key-icono';
    estado.className = 'api-key-estado';
    estado.textContent = '';

    if (!key) {
        icono.textContent = '';
        btnGuard.disabled = true;
        return;
    }

    if (ok) {
        icono.textContent  = '✓';
        icono.classList.add('ok');
        btnGuard.disabled = false;
    } else {
        icono.textContent  = '✗';
        icono.classList.add('error');
        estado.textContent  = mensaje;
        estado.classList.add('error');
        btnGuard.disabled = true;
    }
}

/**
 * Al pulsar "Verificar y guardar": valida formato, prueba la API
 * y, si todo es correcto, guarda en localStorage y recarga.
 */
async function guardarApiKey() {
    const input    = document.getElementById('input-api-key');
    const icono    = document.getElementById('api-key-icono');
    const estado   = document.getElementById('api-key-estado');
    const btnGuard = document.getElementById('btn-guardar-key');
    const key      = input.value.trim();

    // 1. Validación de formato
    const { ok: fmtOk, mensaje: fmtMsg } = validarFormatoApiKey(key);
    if (!fmtOk) {
        mostrarEstadoKey(icono, estado, false, fmtMsg);
        return;
    }

    // 2. Test en vivo
    btnGuard.disabled  = true;
    btnGuard.textContent = 'Verificando…';
    estado.className  = 'api-key-estado';
    estado.textContent = 'Contactando con Google Drive API…';

    const { ok: apiOk, mensaje: apiMsg } = await testApiKeyEnVivo(key);

    btnGuard.textContent = 'Verificar y guardar';
    btnGuard.disabled  = false;

    if (!apiOk) {
        mostrarEstadoKey(icono, estado, false, apiMsg);
        return;
    }

    // 3. Todo OK: guardar y recargar
    mostrarEstadoKey(icono, estado, true, apiMsg + ' — guardando…');
    localStorage.setItem('drive_api_key', key);
    setTimeout(() => location.reload(), 900);
}

/**
 * Actualiza el icono y el texto de estado en el panel de configuración.
 */
function mostrarEstadoKey(icono, estado, ok, mensaje) {
    icono.className  = 'api-key-icono ' + (ok ? 'ok' : 'error');
    icono.textContent = ok ? '✓' : '✗';
    estado.className  = 'api-key-estado ' + (ok ? 'ok' : 'error');
    estado.textContent = mensaje;
}

/**
 * Muestra el panel de configuración y conecta el listener de input.
 */
function mostrarConfigApiKey() {
    const panel = document.getElementById('config-api');
    panel.style.display = 'block';

    const input = document.getElementById('input-api-key');
    input.removeEventListener('input', onInputApiKey);
    input.addEventListener('input', onInputApiKey);

    document.getElementById('contenido-hoy').innerHTML = `
        <div class="estado-vacio">
            <div class="icono">&#128273;</div>
            <p>Configura la API key de Google Drive para acceder al contenido.</p>
        </div>`;
}

/* ============================================================
   LÓGICA DE CONTENIDO
   ============================================================ */

/**
 * Calcula el índice del cuaderno del día usando rotación secuencial
 * persistida en localStorage.
 */
function obtenerCuadernoDelDia() {
    const hoy      = new Date().toISOString().slice(0, 10);
    const ultimoDia = localStorage.getItem('cpva_ultimo_dia');
    let indice     = parseInt(localStorage.getItem('cpva_indice') || '0', 10);

    if (ultimoDia !== hoy) {
        if (ultimoDia) {
            indice = (indice + 1) % CUADERNOS_CPVA.length;
        }
        localStorage.setItem('cpva_ultimo_dia', hoy);
        localStorage.setItem('cpva_indice', String(indice));
    }

    return {
        nombre: CUADERNOS_CPVA[indice],
        indice: indice,
        total:  CUADERNOS_CPVA.length
    };
}

/**
 * Verifica si hoy hay podcast (L/X/V).
 */
function hayPodcastHoy() {
    return DIAS_PODCAST.includes(new Date().getDay());
}

function formatearFecha(dateStr) {
    const fecha = new Date(dateStr);
    return fecha.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

function formatearFechaCorta(dateStr) {
    const fecha = new Date(dateStr);
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

/**
 * Filtra archivos por nombre de cuaderno.
 */
function filtrarPorCuaderno(archivos, cuaderno) {
    const clave = cuaderno.toLowerCase()
        .replace('cpva_', '')
        .replace('sat_', '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return archivos.filter(f => {
        const nombre = f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nombre.includes(clave);
    });
}

/**
 * Clasifica archivos en podcasts y reflexiones.
 */
function clasificarArchivos(archivos) {
    const podcasts = archivos.filter(f =>
        f.mimeType?.startsWith('audio/') || f.name.endsWith('.mp3') || f.name.endsWith('.wav')
    );
    const reflexiones = archivos.filter(f =>
        f.mimeType === 'text/plain' || f.name.endsWith('.txt') || f.name.endsWith('.md')
    );
    return { podcasts, reflexiones };
}

/**
 * Carga y renderiza el contenido del día.
 */
async function cargarContenidoDelDia() {
    const contenedorHoy       = document.getElementById('contenido-hoy');
    const contenedorHistorial = document.getElementById('historial');

    if (!isApiKeyConfigured()) {
        mostrarConfigApiKey();
        return;
    }

    contenedorHoy.innerHTML = '<div class="cargando"><div class="spinner" role="status" aria-label="Cargando contenido"></div><p>Cargando contenido...</p></div>';

    const cuaderno    = obtenerCuadernoDelDia();
    const tienePodcast = hayPodcastHoy();

    document.getElementById('modulo-nombre').textContent = cuaderno.nombre;
    document.getElementById('modulo-fecha').textContent  = formatearFecha(new Date().toISOString());
    document.getElementById('modulo-ciclo').textContent  =
        `Cuaderno ${cuaderno.indice + 1} de ${cuaderno.total}`;

    try {
        const archivos = await listFolderContents(FOLDER_PODCASTS);

        if (archivos.length === 0) {
            contenedorHoy.innerHTML = `
                <div class="estado-vacio">
                    <div class="icono">&#128247;</div>
                    <p>No hay contenido disponible en la carpeta Drive.</p>
                </div>`;
            return;
        }

        const delCuaderno = filtrarPorCuaderno(archivos, cuaderno.nombre);
        const { podcasts, reflexiones } = clasificarArchivos(delCuaderno.length > 0 ? delCuaderno : archivos);

        let htmlHoy = '';

        // Reflexión diaria (siempre disponible)
        if (reflexiones.length > 0) {
            const ref   = reflexiones[0];
            const texto = await readTextFile(ref.id);
            htmlHoy += `
                <div>
                    <span class="tipo-contenido tipo-reflexion">Reflexión diaria</span>
                    <h3>${cuaderno.nombre}</h3>
                    <div class="visor-texto">${texto || 'Cargando reflexión...'}</div>
                </div>`;
        }

        // Podcast (solo L/X/V)
        if (tienePodcast && podcasts.length > 0) {
            const podcast = podcasts[0];
            htmlHoy += `
                <div class="reproductor">
                    <span class="tipo-contenido tipo-podcast">Podcast</span>
                    <h3>${cuaderno.nombre}</h3>
                    <p class="titulo-audio">${podcast.name}</p>
                    <audio controls preload="none">
                        <source src="${getDriveAudioUrl(podcast.id)}" type="audio/mpeg">
                        Tu navegador no soporta el elemento audio.
                    </audio>
                </div>`;
        } else if (tienePodcast) {
            htmlHoy += `
                <div class="estado-vacio">
                    <p>Hoy es día de podcast, pero no hay uno disponible para "${cuaderno.nombre}".</p>
                </div>`;
        } else {
            htmlHoy += `
                <div class="estado-vacio" style="padding:0.5rem;">
                    <p>Próximo podcast: ${proximoDiaPodcast()}</p>
                </div>`;
        }

        if (!htmlHoy) {
            htmlHoy = `
                <div class="estado-vacio">
                    <div class="icono">&#128218;</div>
                    <p>No hay contenido del cuaderno "${cuaderno.nombre}" disponible aún.</p>
                </div>`;
        }

        contenedorHoy.innerHTML = htmlHoy;

        // Historial: últimos 10 elementos
        const todos = archivos.slice(0, 10);
        if (todos.length > 0) {
            let htmlHist = '';
            todos.forEach(item => {
                const esAudio = item.mimeType?.startsWith('audio/') || item.name.endsWith('.mp3');
                htmlHist += `
                    <div class="historial-item">
                        <span class="historial-fecha">${formatearFechaCorta(item.createdTime)}</span>
                        <span class="historial-titulo">${item.name}</span>
                        <span class="historial-tipo ${esAudio ? 'tipo-podcast' : 'tipo-reflexion'}">${esAudio ? 'Audio' : 'Texto'}</span>
                        ${esAudio ? `<button class="historial-play" onclick="reproducir('${item.id}')" aria-label="Reproducir ${item.name}">&#9654;</button>` : ''}
                    </div>`;
            });
            contenedorHistorial.innerHTML = htmlHist;
        } else {
            contenedorHistorial.innerHTML = '<p class="estado-vacio">Sin historial disponible</p>';
        }

    } catch (err) {
        console.error('Error cargando contenido:', err);
        contenedorHoy.innerHTML = `
            <div class="estado-vacio">
                <div class="icono">&#9888;</div>
                <p>Error al cargar el contenido. Verifica tu conexión.</p>
            </div>`;
    }
}

/**
 * Calcula el próximo día de podcast (L/X/V).
 */
function proximoDiaPodcast() {
    const hoy    = new Date();
    const dia    = hoy.getDay();
    const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    for (let i = 1; i <= 7; i++) {
        const d = (dia + i) % 7;
        if (DIAS_PODCAST.includes(d)) return nombres[d];
    }
    return 'lunes';
}

/**
 * Reproduce un audio en un reproductor flotante.
 */
function reproducir(fileId) {
    const audioUrl = getDriveAudioUrl(fileId);
    let player = document.getElementById('reproductor-flotante');
    if (!player) {
        player = document.createElement('audio');
        player.id       = 'reproductor-flotante';
        player.controls = true;
        player.style.cssText = 'position:fixed;bottom:10px;left:50%;transform:translateX(-50%);width:90%;max-width:600px;z-index:100;';
        document.body.appendChild(player);
    }
    player.src = audioUrl;
    player.play();
}

// Iniciar al cargar la página
document.addEventListener('DOMContentLoaded', cargarContenidoDelDia);
