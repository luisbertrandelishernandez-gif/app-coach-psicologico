// gemini-client.js
// FASE 2 (2026-05-19): llamadas directas a Gemini REST desde el navegador.
// FASE 4 (2026-05-19): pool de keys con rotación automática ante 429/503,
// equivalente JS de E:\Automatizaciones\_shared\gemini_pool.py.
// App PERSONAL; aceptable embeber las keys aquí.

(function () {
    'use strict';

    // --- POOL DE KEYS (origen: E:/Automatizaciones/.secrets/gemini_keys.json) ---
    // Orden: stm primero (la habitual de esta app), luego el resto.
    // El nombre se usa solo para logging.
    const GEMINI_KEYS = [
        { name: 'stm',        key: 'AIzaSyBKHeTvucH4lprJ9Indx4zyqc3GevTq-yo' },
        { name: 'u58',        key: 'AIzaSyCRlSdkZmCjbMv2Fv_w4wEy0B6Tr65hyMQ' },
        { name: 'oposicion',  key: 'AIzaSyBdahBkDOfoVFAQB6Ontzr5e_1SzQ3RW84' },
        { name: 'shared_old', key: 'AIzaSyBJYK6oKQSokZkMU4ev6w4oiN9zrAmWeMI' },
        { name: 'lh_legal',   key: 'AIzaSyBr8YBk-Px7HsM-8_5bTROsZKAh-Pb6iSU' },
        { name: 'lh_salud',   key: 'AIzaSyCzBolwkoP4S5YqOQ1Sf5mvAEK4ZccJ-uc' },
        { name: 'hub',        key: 'AIzaSyDdhUGj5oBaX8zHqMUL547MFDHKamRClZw' }
    ];

    const GEMINI_MODEL = 'gemini-2.5-flash-lite';
    const TIMEOUT_MS = 30000;
    const MAX_ROTATIONS = 3;        // como pide la espec: máximo 3 rotaciones
    const PAUSE_POST_ERROR_MS = 2000; // backoff de 2s entre reintentos (igual que gemini_pool)

    // Estado del pool (vive en memoria mientras la pestaña esté abierta).
    // _idx: índice activo. _burned: nombres ya quemados en esta sesión.
    const pool = {
        _idx: 0,
        _burned: new Set()
    };

    function geminiUrl(apiKey) {
        return 'https://generativelanguage.googleapis.com/v1beta/models/' +
            GEMINI_MODEL + ':generateContent?key=' + apiKey;
    }

    function activeKey() {
        return GEMINI_KEYS[pool._idx];
    }

    // Avanza al siguiente índice no quemado. Devuelve true si hay candidato nuevo.
    function rotateToNextAvailable() {
        const total = GEMINI_KEYS.length;
        for (let step = 1; step <= total; step++) {
            const candidate = (pool._idx + step) % total;
            if (!pool._burned.has(GEMINI_KEYS[candidate].name)) {
                pool._idx = candidate;
                console.info('Rotando a key: ' + GEMINI_KEYS[candidate].name);
                return true;
            }
        }
        return false;
    }

    const PROMPT_RACIONALIZACION =
        'Eres un terapeuta cognitivo-conductual experto. El usuario describe:\n' +
        '- Situación: {situacion}\n' +
        '- Pensamiento automático: {pensamiento}\n' +
        '- Emoción y respuesta: {emocion}\n' +
        '- Credibilidad del pensamiento (0-100): {credibilidad}%\n' +
        '- Intento de alternativa: {alternativa}\n\n' +
        'Responde SOLO en JSON válido con esta estructura exacta:\n' +
        '{\n' +
        '  "distorsion_cognitiva": "nombre de la distorsión identificada",\n' +
        '  "explicacion_distorsion": "2-3 frases explicando por qué encaja",\n' +
        '  "pensamiento_alternativo": "propuesta de pensamiento racional, 2-3 frases",\n' +
        '  "fuerza_distorsion": número 1-10,\n' +
        '  "ejercicio_sugerido": "ejercicio concreto para trabajar esta distorsión",\n' +
        '  "mensaje_cierre": "mensaje empático de cierre, 1-2 frases"\n' +
        '}';

    const PROMPT_FOCUSING =
        'Eres un terapeuta especializado en Focusing (método Gendlin). El usuario ha completado una sesión:\n' +
        '- Zona corporal donde siente: {zona_corporal}\n' +
        '- Cualidad de la sensación: {cualidad}\n' +
        '- Asidero (palabra o imagen): {asidero}\n' +
        '- Lo que la sensación diría si pudiera hablar: {dialogo}\n\n' +
        'Responde SOLO en JSON válido:\n' +
        '{\n' +
        '  "sintesis": "integración comprensiva de la experiencia en 3-4 frases",\n' +
        '  "sugerencia_proxima_practica": "qué explorar en la próxima sesión de focusing"\n' +
        '}';

    function fillTemplate(tpl, vars) {
        return tpl.replace(/\{(\w+)\}/g, function (_, k) {
            return vars[k] !== undefined && vars[k] !== null && vars[k] !== ''
                ? String(vars[k])
                : '(sin dato)';
        });
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    // Una petición individual al endpoint REST con la key indicada.
    // Devuelve { ok:true, data } o { ok:false, status, error }.
    async function singleAttempt(apiKey, prompt) {
        const controller = new AbortController();
        const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
        try {
            const resp = await fetch(geminiUrl(apiKey), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.7
                    }
                }),
                signal: controller.signal
            });

            if (!resp.ok) {
                return { ok: false, status: resp.status, error: 'HTTP ' + resp.status };
            }
            const data = await resp.json();
            const text =
                data &&
                data.candidates &&
                data.candidates[0] &&
                data.candidates[0].content &&
                data.candidates[0].content.parts &&
                data.candidates[0].content.parts[0] &&
                data.candidates[0].content.parts[0].text;
            if (!text) {
                return { ok: false, status: 200, error: 'Respuesta vacía.' };
            }
            try {
                return { ok: true, data: JSON.parse(text) };
            } catch (parseErr) {
                return { ok: false, status: 200, error: 'JSON inválido.' };
            }
        } catch (e) {
            if (e && e.name === 'AbortError') {
                return { ok: false, status: 0, error: 'timeout' };
            }
            if (e instanceof TypeError) {
                // Fallo de red (CORS, offline, DNS, ...).
                return { ok: false, status: -1, error: 'network' };
            }
            return { ok: false, status: 0, error: (e && e.message) ? e.message : 'unknown' };
        } finally {
            clearTimeout(timer);
        }
    }

    // Punto de entrada del pool: prueba la key activa y rota ante 429/503.
    async function callGeminiPool(prompt) {
        let rotations = 0;

        // Si la key actual ya está quemada en sesiones previas, saltar a la siguiente útil.
        if (pool._burned.has(activeKey().name)) {
            if (!rotateToNextAvailable()) {
                throw new Error('Servicio no disponible: todas las keys agotadas en esta sesión.');
            }
        }

        while (true) {
            const current = activeKey();
            const result = await singleAttempt(current.key, prompt);

            if (result.ok) {
                return result.data;
            }

            // Errores que activan rotación: 429 (quota) y 503 (overloaded).
            const rotatable = (result.status === 429 || result.status === 503);

            if (rotatable && rotations < MAX_ROTATIONS) {
                console.info('Key ' + current.name + ' devolvió ' + result.status +
                    '. Marcando quemada y rotando.');
                pool._burned.add(current.name);
                if (!rotateToNextAvailable()) {
                    throw new Error('Servicio no disponible: todas las keys agotadas en esta sesión.');
                }
                rotations++;
                await sleep(PAUSE_POST_ERROR_MS);
                continue;
            }

            if (rotatable) {
                // Alcanzamos el tope de rotaciones.
                throw new Error('Servicio no disponible tras ' + rotations +
                    ' rotaciones. Inténtalo más tarde.');
            }

            // Error no rotable: traducir a mensaje claro.
            if (result.error === 'timeout') {
                throw new Error('Timeout: Gemini tardó más de 30 segundos.');
            }
            if (result.error === 'network') {
                throw new Error('Sin conexión, tu sesión se ha guardado localmente.');
            }
            if (result.status > 0) {
                throw new Error('Gemini respondió HTTP ' + result.status + '.');
            }
            throw new Error(result.error || 'Error desconocido al llamar a Gemini.');
        }
    }

    async function analizarRacionalizacion(situacion, pensamiento, emocion, credibilidad, alternativa) {
        const prompt = fillTemplate(PROMPT_RACIONALIZACION, {
            situacion: situacion,
            pensamiento: pensamiento,
            emocion: emocion,
            credibilidad: credibilidad,
            alternativa: alternativa
        });
        return callGeminiPool(prompt);
    }

    async function analizarFocusing(zona_corporal, cualidad, asidero, dialogo) {
        const prompt = fillTemplate(PROMPT_FOCUSING, {
            zona_corporal: zona_corporal,
            cualidad: cualidad,
            asidero: asidero,
            dialogo: dialogo
        });
        return callGeminiPool(prompt);
    }

    // Exponer también el estado del pool para depuración manual desde consola.
    function poolStatus() {
        return {
            active_key: activeKey().name,
            burned: Array.from(pool._burned),
            total_keys: GEMINI_KEYS.length
        };
    }

    window.GeminiClient = {
        analizarRacionalizacion: analizarRacionalizacion,
        analizarFocusing: analizarFocusing,
        poolStatus: poolStatus
    };
})();
