/**
 * app.js — Coach Psicológico CPVA (APP-002)
 * Rotación secuencial cíclica de 11 cuadernos.
 * Podcasts: solo L/X/V. Reflexiones en texto: diarias.
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

/**
 * Calcula el índice del cuaderno del día usando rotación secuencial
 * persistida en localStorage
 */
function obtenerCuadernoDelDia() {
    const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const ultimoDia = localStorage.getItem('cpva_ultimo_dia');
    let indice = parseInt(localStorage.getItem('cpva_indice') || '0', 10);

    if (ultimoDia !== hoy) {
        // Nuevo día: avanzar al siguiente cuaderno
        if (ultimoDia) {
            indice = (indice + 1) % CUADERNOS_CPVA.length;
        }
        localStorage.setItem('cpva_ultimo_dia', hoy);
        localStorage.setItem('cpva_indice', String(indice));
    }

    return {
        nombre: CUADERNOS_CPVA[indice],
        indice: indice,
        total: CUADERNOS_CPVA.length
    };
}

/**
 * Verifica si hoy hay podcast (L/X/V)
 */
function hayPodcastHoy() {
    return DIAS_PODCAST.includes(new Date().getDay());
}

/**
 * Formatea fecha para mostrar
 */
function formatearFecha(dateStr) {
    const fecha = new Date(dateStr);
    return fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatearFechaCorta(dateStr) {
    const fecha = new Date(dateStr);
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

/**
 * Filtra archivos por nombre de cuaderno
 */
function filtrarPorCuaderno(archivos, cuaderno) {
    // Extraer la clave corta del cuaderno para buscar
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
 * Clasifica archivos en podcasts y reflexiones
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
 * Carga y renderiza el contenido del día
 */
async function cargarContenidoDelDia() {
    const contenedorHoy = document.getElementById('contenido-hoy');
    const contenedorHistorial = document.getElementById('historial');

    if (!isApiKeyConfigured()) {
        mostrarConfigApiKey();
        return;
    }

    contenedorHoy.innerHTML = '<div class="cargando"><div class="spinner"></div><p>Cargando contenido...</p></div>';

    const cuaderno = obtenerCuadernoDelDia();
    const tienePodcast = hayPodcastHoy();

    document.getElementById('modulo-nombre').textContent = cuaderno.nombre;
    document.getElementById('modulo-fecha').textContent = formatearFecha(new Date().toISOString());
    document.getElementById('modulo-ciclo').textContent =
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
            const ref = reflexiones[0];
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
                    <p style="font-size:0.9rem;color:#999;">Próximo podcast: ${proximoDiaPodcast()}</p>
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

        // Historial: últimos 7 elementos (podcasts + reflexiones mezclados)
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
                        ${esAudio ? `<button class="historial-play" onclick="reproducir('${item.id}')" title="Reproducir">&#9654;</button>` : ''}
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
 * Calcula el próximo día de podcast (L/X/V)
 */
function proximoDiaPodcast() {
    const hoy = new Date();
    const dia = hoy.getDay();
    const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    for (let i = 1; i <= 7; i++) {
        const d = (dia + i) % 7;
        if (DIAS_PODCAST.includes(d)) {
            return nombres[d];
        }
    }
    return 'lunes';
}

function reproducir(fileId) {
    const audioUrl = getDriveAudioUrl(fileId);
    let player = document.getElementById('reproductor-flotante');
    if (!player) {
        player = document.createElement('audio');
        player.id = 'reproductor-flotante';
        player.controls = true;
        player.style.cssText = 'position:fixed;bottom:10px;left:50%;transform:translateX(-50%);width:90%;max-width:600px;z-index:100;';
        document.body.appendChild(player);
    }
    player.src = audioUrl;
    player.play();
}

function mostrarConfigApiKey() {
    document.getElementById('config-api').style.display = 'block';
    document.getElementById('contenido-hoy').innerHTML = `
        <div class="estado-vacio">
            <div class="icono">&#128273;</div>
            <p>Configura la API key de Google Drive para acceder al contenido.</p>
        </div>`;
}

function guardarApiKey() {
    const input = document.getElementById('input-api-key');
    const key = input.value.trim();
    if (key.length > 10) {
        localStorage.setItem('drive_api_key', key);
        location.reload();
    }
}

document.addEventListener('DOMContentLoaded', cargarContenidoDelDia);
