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
        // Intentar fallback local antes de pedir API key
        const cuadernoLocal = obtenerCuadernoDelDia();
        document.getElementById('modulo-nombre').textContent = cuadernoLocal.nombre;
        document.getElementById('modulo-fecha').textContent  = formatearFecha(new Date().toISOString());
        document.getElementById('modulo-ciclo').textContent  =
            `Cuaderno ${cuadernoLocal.indice + 1} de ${cuadernoLocal.total}`;
        const localOk = await cargarContenidoLocalCPVA(cuadernoLocal.nombre, contenedorHoy, contenedorHistorial);
        if (localOk) return;
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
            const localOk = await cargarContenidoLocalCPVA(cuaderno.nombre, contenedorHoy, contenedorHistorial);
            if (localOk) return;
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

/* ============================================================
   FALLBACK: RENDERIZADO DE JSON LOCAL (MOT-007/MOT-008)
   ============================================================ */

// Mapeo de cuadernos a archivos JSON locales
const CUADERNO_A_JSON = {
    'CPVA_01 TREC': 'CPVA_trec.json',
    'CPVA_03 Focusing': 'CPVA_focusing.json',
    'CPVA_06 Ansiedad': 'CPVA_ansiedad.json',
    'CPVA_11 Ira': 'CPVA_ira.json',
    'CPVA_12 Soledad': 'CPVA_crisis.json',
    'CPVA_SAT_02 ACT': 'CPVA_act.json',
    'CPVA_SAT_04 Logoterapia': 'CPVA_logoterapia.json',
    'CPVA_SAT_05 Somática': 'CPVA_somatica.json',
    'CPVA_SAT_07 Apego': 'CPVA_apego.json',
    'CPVA_SAT_08 TOC': 'CPVA_trec.json',
    'Resiliencia': 'CPVA_crisis.json'
};

/**
 * Intenta cargar contenido desde JSON local generado por MOT-008.
 * @returns {Promise<boolean>} true si se renderizo contenido
 */
async function cargarContenidoLocalCPVA(cuadernoNombre, contenedorHoy, contenedorHistorial) {
    const archivo = CUADERNO_A_JSON[cuadernoNombre];
    if (!archivo) return false;

    try {
        const resp = await fetch(`data/${archivo}`);
        if (!resp.ok) return false;
        const data = await resp.json();
        renderizarJsonCPVA(data, cuadernoNombre, contenedorHoy, contenedorHistorial);
        return true;
    } catch (err) {
        console.log('Sin JSON local para', cuadernoNombre, err.message);
        return false;
    }
}

/**
 * Renderiza el contenido de un JSON CPVA.
 * Campos esperados: titulo, descripcion, ejercicios[], fichas_rapidas[]
 */
function renderizarJsonCPVA(data, cuadernoNombre, contenedorHoy, contenedorHistorial) {
    let html = '';

    html += `<span class="tipo-contenido tipo-reflexion">Contenido local</span>`;
    html += `<h3>${data.titulo || cuadernoNombre}</h3>`;
    if (data.descripcion) {
        html += `<p class="visor-texto">${data.descripcion}</p>`;
    }

    // Ejercicios
    if (data.ejercicios && data.ejercicios.length > 0) {
        html += `<div class="seccion-contenido"><h3>Ejercicios (${data.ejercicios.length})</h3>`;
        for (const ej of data.ejercicios) {
            html += `
                <div class="ejercicio-card">
                    <h4>${ej.titulo || ej.nombre || 'Ejercicio'}</h4>
                    <p class="visor-texto">${ej.descripcion || ej.instrucciones || ''}</p>`;
            if (ej.pasos && ej.pasos.length > 0) {
                html += '<ol>';
                for (const paso of ej.pasos) {
                    html += `<li>${typeof paso === 'string' ? paso : paso.instruccion || paso.texto || ''}</li>`;
                }
                html += '</ol>';
            }
            if (ej.duracion_minutos) {
                html += `<small>Duracion: ${ej.duracion_minutos} min</small>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }

    // Fichas rapidas
    if (data.fichas_rapidas && data.fichas_rapidas.length > 0) {
        html += `<div class="seccion-contenido"><h3>Fichas rapidas (${data.fichas_rapidas.length})</h3>`;
        for (const ficha of data.fichas_rapidas) {
            html += `
                <div class="ficha-card">
                    <h4>${ficha.titulo || ficha.nombre || 'Ficha'}</h4>
                    <p class="visor-texto">${ficha.contenido || ficha.descripcion || ficha.texto || ''}</p>
                </div>`;
        }
        html += `</div>`;
    }

    contenedorHoy.innerHTML = html;
    contenedorHistorial.innerHTML = '<p class="estado-vacio">Contenido cargado desde datos locales (MOT-008)</p>';
}

/* ============================================================
   SECCIÓN APRENDIZAJE CPVA (9 módulos locales)
   ============================================================ */

// Los 9 módulos CPVA disponibles con sus archivos JSON
const MODULOS_CPVA = [
    { id: 'act', archivo: 'CPVA_act.json', nombre: 'ACT', nombreCompleto: 'Terapia de Aceptación y Compromiso' },
    { id: 'ansiedad', archivo: 'CPVA_ansiedad.json', nombre: 'Ansiedad', nombreCompleto: 'Manejo de la Ansiedad' },
    { id: 'apego', archivo: 'CPVA_apego.json', nombre: 'Apego', nombreCompleto: 'Apego y Vínculos' },
    { id: 'crisis', archivo: 'CPVA_crisis.json', nombre: 'Crisis', nombreCompleto: 'Gestión de Crisis' },
    { id: 'focusing', archivo: 'CPVA_focusing.json', nombre: 'Focusing', nombreCompleto: 'Focusing de Gendlin' },
    { id: 'ira', archivo: 'CPVA_ira.json', nombre: 'Ira', nombreCompleto: 'Regulación de la Ira' },
    { id: 'logoterapia', archivo: 'CPVA_logoterapia.json', nombre: 'Logoterapia', nombreCompleto: 'Logoterapia de Frankl' },
    { id: 'somatica', archivo: 'CPVA_somatica.json', nombre: 'Somática', nombreCompleto: 'Regulación Somática' },
    { id: 'trec', archivo: 'CPVA_trec.json', nombre: 'TREC', nombreCompleto: 'Terapia Racional Emotiva Conductual' }
];

/**
 * Alterna entre la sección "Hoy" y "Aprendizaje CPVA".
 * Persiste la última sección en localStorage.
 */
function mostrarSeccion(seccion) {
    const seccionHoy = document.getElementById('seccion-hoy');
    const seccionAprendizaje = document.getElementById('seccion-aprendizaje');
    const btnHoy = document.getElementById('btn-hoy');
    const btnAprendizaje = document.getElementById('btn-aprendizaje');

    if (seccion === 'hoy') {
        seccionHoy.style.display = '';
        seccionAprendizaje.style.display = 'none';
        btnHoy.classList.add('activo');
        btnAprendizaje.classList.remove('activo');
    } else if (seccion === 'aprendizaje') {
        seccionHoy.style.display = 'none';
        seccionAprendizaje.style.display = '';
        btnHoy.classList.remove('activo');
        btnAprendizaje.classList.add('activo');

        // Cargar módulos si aún no se han cargado
        if (!document.getElementById('selector-modulos').hasChildNodes()) {
            cargarAprendizaje();
        }
    }

    // Persistir última sección visitada
    localStorage.setItem('cpva_seccion', seccion);
}

/**
 * Carga los 9 módulos CPVA y genera el selector de tarjetas.
 */
async function cargarAprendizaje() {
    const selector = document.getElementById('selector-modulos');
    selector.innerHTML = '<div class="cargando"><div class="spinner" role="status"></div><p>Cargando módulos...</p></div>';

    let html = '';
    for (const modulo of MODULOS_CPVA) {
        try {
            const resp = await fetch(`data/${modulo.archivo}`);
            if (!resp.ok) continue;
            const data = await resp.json();

            const numEjercicios = data.ejercicios?.length || 0;
            const numFichas = data.fichas_rapidas?.length || 0;

            html += `
                <div class="tarjeta-modulo" role="listitem" tabindex="0"
                     onclick="cargarModulo('${modulo.archivo}')"
                     onkeydown="if(event.key==='Enter')cargarModulo('${modulo.archivo}')"
                     aria-label="${modulo.nombreCompleto}: ${numEjercicios} ejercicios, ${numFichas} fichas">
                    <h3>${modulo.nombre}</h3>
                    <p class="modulo-subtitulo">${modulo.nombreCompleto}</p>
                    <div class="modulo-stats">
                        <span>${numEjercicios} ejercicios</span>
                        <span>${numFichas} fichas</span>
                    </div>
                </div>`;
        } catch (err) {
            console.error(`Error cargando ${modulo.archivo}:`, err);
        }
    }

    selector.innerHTML = html || '<p class="estado-vacio">No se pudieron cargar los módulos.</p>';
}

/**
 * Carga y muestra un módulo CPVA específico.
 * @param {string} nombreJson - Nombre del archivo JSON (ej: 'CPVA_act.json')
 */
async function cargarModulo(nombreJson) {
    const selector = document.getElementById('selector-modulos');
    const contenido = document.getElementById('modulo-contenido');
    const titulo = document.getElementById('mod-titulo');
    const descripcion = document.getElementById('mod-descripcion');
    const listaEjercicios = document.getElementById('lista-ejercicios');
    const listaFichas = document.getElementById('lista-fichas');

    // Ocultar selector, mostrar contenido del módulo
    selector.style.display = 'none';
    contenido.style.display = 'block';

    // Cargar JSON
    contenido.innerHTML = '<div class="cargando"><div class="spinner" role="status"></div><p>Cargando módulo...</p></div>';

    try {
        const resp = await fetch(`data/${nombreJson}`);
        if (!resp.ok) throw new Error('No se pudo cargar el módulo');
        const data = await resp.json();

        // Restaurar estructura del contenido
        contenido.innerHTML = `
            <div class="modulo-header">
                <button class="btn-volver" onclick="volverASelector()" aria-label="Volver al selector de módulos">
                    ← Volver
                </button>
                <h2 id="mod-titulo">${data.titulo || 'Módulo'}</h2>
                <p id="mod-descripcion" class="mod-descripcion">${data.descripcion || ''}</p>
            </div>
            <div class="pestanas" role="tablist">
                <button id="tab-ejercicios" class="pestana activa" role="tab" aria-selected="true"
                        aria-controls="lista-ejercicios" onclick="mostrarPestana('ejercicios')">
                    Ejercicios
                </button>
                <button id="tab-fichas" class="pestana" role="tab" aria-selected="false"
                        aria-controls="lista-fichas" onclick="mostrarPestana('fichas')">
                    Fichas rápidas
                </button>
            </div>
            <div id="lista-ejercicios" class="lista-ejercicios" role="tabpanel" aria-labelledby="tab-ejercicios"></div>
            <div id="lista-fichas" class="lista-fichas" role="tabpanel" aria-labelledby="tab-fichas" style="display:none;"></div>`;

        // Renderizar ejercicios
        renderizarEjercicios(data.ejercicios || []);

        // Renderizar fichas
        renderizarFichas(data.fichas_rapidas || []);

    } catch (err) {
        contenido.innerHTML = `
            <div class="estado-vacio">
                <p>Error al cargar el módulo.</p>
                <button class="btn-volver" onclick="volverASelector()">← Volver</button>
            </div>`;
        console.error('Error cargando módulo:', err);
    }
}

/**
 * Renderiza la lista de ejercicios de un módulo.
 */
function renderizarEjercicios(ejercicios) {
    const lista = document.getElementById('lista-ejercicios');
    if (!ejercicios || ejercicios.length === 0) {
        lista.innerHTML = '<p class="estado-vacio">No hay ejercicios disponibles.</p>';
        return;
    }

    let html = '';
    for (const ej of ejercicios) {
        html += `
            <div class="ejercicio-item">
                <h3>${ej.nombre || ej.titulo || 'Ejercicio'}</h3>
                <div class="ejercicio-meta">
                    <span class="badge badge-${ej.nivel || 'basico'}">${ej.nivel || 'básico'}</span>
                    <span class="duracion">${ej.duracion_min || '—'} min</span>
                    <span class="tipo">${ej.tipo || '—'}</span>
                </div>`;

        if (ej.pasos && ej.pasos.length > 0) {
            html += '<ol class="pasos-ejercicio">';
            for (const paso of ej.pasos) {
                const texto = typeof paso === 'string' ? paso : (paso.instruccion || paso.texto || '');
                const duracion = paso.duracion_seg ? ` <em>(${Math.round(paso.duracion_seg / 60)} min)</em>` : '';
                html += `<li>${texto}${duracion}</li>`;
            }
            html += '</ol>';
        }

        if (ej.indicaciones) {
            html += `<div class="ejercicio-indicaciones"><strong>Cuándo usarlo:</strong> ${ej.indicaciones}</div>`;
        }

        if (ej.contraindicaciones) {
            html += `<div class="ejercicio-contraindicaciones"><strong>Contraindicaciones:</strong> ${ej.contraindicaciones}</div>`;
        }

        html += '</div>';
    }

    lista.innerHTML = html;
}

/**
 * Renderiza la lista de fichas rápidas de un módulo.
 */
function renderizarFichas(fichas) {
    const lista = document.getElementById('lista-fichas');
    if (!fichas || fichas.length === 0) {
        lista.innerHTML = '<p class="estado-vacio">No hay fichas disponibles.</p>';
        return;
    }

    let html = '';
    for (const ficha of fichas) {
        html += `
            <div class="ficha-item">
                <h3>${ficha.titulo || ficha.nombre || 'Ficha'}</h3>
                <p>${ficha.contenido || ficha.descripcion || ficha.texto || ''}</p>`;

        if (ficha.etiquetas && ficha.etiquetas.length > 0) {
            html += '<div class="ficha-etiquetas">';
            for (const tag of ficha.etiquetas) {
                html += `<span class="tag">${tag}</span>`;
            }
            html += '</div>';
        }

        html += '</div>';
    }

    lista.innerHTML = html;
}

/**
 * Alterna entre las pestañas "Ejercicios" y "Fichas rápidas".
 */
function mostrarPestana(pestana) {
    const tabEjercicios = document.getElementById('tab-ejercicios');
    const tabFichas = document.getElementById('tab-fichas');
    const listaEjercicios = document.getElementById('lista-ejercicios');
    const listaFichas = document.getElementById('lista-fichas');

    if (pestana === 'ejercicios') {
        tabEjercicios.classList.add('activa');
        tabEjercicios.setAttribute('aria-selected', 'true');
        tabFichas.classList.remove('activa');
        tabFichas.setAttribute('aria-selected', 'false');
        listaEjercicios.style.display = '';
        listaFichas.style.display = 'none';
    } else if (pestana === 'fichas') {
        tabEjercicios.classList.remove('activa');
        tabEjercicios.setAttribute('aria-selected', 'false');
        tabFichas.classList.add('activa');
        tabFichas.setAttribute('aria-selected', 'true');
        listaEjercicios.style.display = 'none';
        listaFichas.style.display = '';
    }
}

/**
 * Vuelve del módulo al selector de módulos.
 */
function volverASelector() {
    const selector = document.getElementById('selector-modulos');
    const contenido = document.getElementById('modulo-contenido');
    selector.style.display = '';
    contenido.style.display = 'none';
}

// Iniciar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Recuperar última sección visitada
    const ultimaSeccion = localStorage.getItem('cpva_seccion') || 'hoy';

    if (ultimaSeccion === 'aprendizaje') {
        mostrarSeccion('aprendizaje');
    } else {
        // Sección Hoy (por defecto)
        cargarContenidoDelDia();
    }
});
