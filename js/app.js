document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let state = {
        currentScreen: 'hub',
        moodHistory: [],
        activeMode: null,
        sessionStep: 0,
        sessionLog: [],
        chats: [],
        savedResources: []
    };

    // Load from localStorage
    const savedState = localStorage.getItem('cpva_state');
    if (savedState) {
        state = { ...state, ...JSON.parse(savedState) };
    }

    function saveState() {
        localStorage.setItem('cpva_state', JSON.stringify(state));
    }

    // --- DOM ELEMENTS ---
    const screens = document.querySelectorAll('.screen');
    const navLinks = document.querySelectorAll('.nav-link');
    const crisisOverlay = document.getElementById('crisis-overlay');
    const breathingCircle = document.getElementById('breathing-circle');
    const breathingText = document.getElementById('breathing-text');
    const groundingInstruction = document.getElementById('grounding-instruction');
    const groundingCounter = document.getElementById('grounding-counter');
    const groundingIcon = document.getElementById('grounding-icon');

    // --- NAVIGATION LOGIC ---
    function showScreen(screenId) {
        state.currentScreen = screenId;
        screens.forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(`screen-${screenId}`);
        if (target) {
            target.classList.remove('hidden');
            target.style.display = 'block'; // Ensure visibility
        }

        const header = document.getElementById('main-header');
        if (header) header.classList.remove('hidden');

        // Active nav link
        navLinks.forEach(l => {
            l.classList.toggle('active', l.dataset.screen === screenId);
        });

        // Trigger specific screen renders
        if (screenId === 'progreso') renderChart();
        if (screenId === 'recursos') renderRecursos('flashcards');
        if (screenId === 'cuaderno') renderCuaderno();
        if (screenId === 'programa') renderPrograma();

        saveState();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => showScreen(link.dataset.screen));
    });

    // --- HUB LOGIC ---
    const moodSlider = document.getElementById('mood-slider');
    const moodValue = document.getElementById('mood-value');
    const moodEmoji = document.getElementById('mood-emoji');

    moodSlider.addEventListener('input', () => {
        const val = parseInt(moodSlider.value);
        const labels = ["Muy mal", "Mal", "Inquieto", "Regular", "Neutral", "Bien", "Muy bien", "Tranquilo", "Paz", "Plenitud"];
        const emojis = ["😫", "😟", "😕", "😐", "🙂", "😊", "😌", "🧘", "✨", "🌟"];

        moodValue.textContent = `${labels[val - 1]} (${val})`;
        moodEmoji.textContent = emojis[val - 1];
    });

    document.getElementById('confirm-checkin').addEventListener('click', () => {
        const val = parseInt(moodSlider.value);
        // FASE 5C: cada entrada se guarda con timestamp para poder pintar
        // el eje X del chart con fechas reales. Tolera entradas legacy (números).
        state.moodHistory.push({ val: val, fecha: new Date().toISOString() });
        if (state.moodHistory.length > 30) state.moodHistory.shift();
        saveState();
        // Mision FIX 22/05/2026: sustituye alert() por bloque visible con
        // recomendacion personalizada segun valor del slider (1-10) y
        // accesos directos al contenido apropiado.
        renderRecomendacionCheckin(val);
    });

    // --- RECOMENDACION POST-CHECKIN (Mision FIX 22/05/2026) -------------
    // Personaliza el contenido recomendado segun el valor 1-10 del slider.
    // Bajo (1-3): protocolo crisis + meditacion de regulacion urgente.
    // Medio (4-6): contenido del dia del Programa segun plan semanal.
    // Alto (7-10): trabajo profundo (reflexiones + flashcards).
    function renderRecomendacionCheckin(val) {
        const checkinCard = document.querySelector('#screen-hub .checkin-card');
        if (!checkinCard) return;
        const existing = document.getElementById('checkin-recomendacion');
        if (existing) existing.remove();

        const emojis = ["😫", "😟", "😕", "😐", "🙂", "😊", "😌", "🧘", "✨", "🌟"];
        const labels = ["Muy mal", "Mal", "Inquieto", "Regular", "Neutral", "Bien", "Muy bien", "Tranquilo", "Paz", "Plenitud"];

        let categoria, titulo, sub, claseExtra = '';
        if (val <= 3) {
            categoria = 'bajo';
            claseExtra = 'estado-bajo';
            titulo = 'Estado bajo registrado. Prioriza regularte ahora.';
            sub = 'Vamos a usar primero el protocolo de crisis y una meditacion de regulacion urgente. No tienes que decidir nada mas hoy.';
        } else if (val <= 6) {
            categoria = 'medio';
            titulo = 'Estado registrado. Aqui tu contenido para hoy:';
            sub = 'Te sugerimos el plan terapeutico del dia segun tu programa activo. Trabajo sostenido pero sin sobrecargar.';
        } else {
            categoria = 'alto';
            claseExtra = 'estado-alto';
            titulo = 'Buen momento para trabajo profundo.';
            sub = 'Estado favorable para reflexiones de fondo y consolidacion. Aprovecha para una sesion mas larga.';
        }

        const rec = document.createElement('div');
        rec.id = 'checkin-recomendacion';
        rec.className = 'checkin-recomendacion ' + claseExtra;
        rec.setAttribute('role', 'region');
        rec.setAttribute('aria-live', 'polite');
        rec.setAttribute('aria-label', 'Recomendacion segun tu check-in');
        rec.innerHTML =
            '<div class="checkin-rec-cabecera">' +
                '<span class="checkin-rec-emoji" aria-hidden="true">' + emojis[val - 1] + '</span>' +
                '<div>' +
                    '<h3 class="checkin-rec-titulo">' + titulo + '</h3>' +
                    '<p class="checkin-rec-sub">Estado: <strong>' + labels[val - 1] + ' (' + val + '/10)</strong>. ' + sub + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="checkin-rec-acciones" id="checkin-rec-acciones"></div>';

        checkinCard.insertAdjacentElement('afterend', rec);

        const acciones = rec.querySelector('#checkin-rec-acciones');
        if (categoria === 'bajo') {
            acciones.appendChild(crearBotonAccion('🆘 Protocolo de crisis', 'crisis', () => {
                document.getElementById('crisis-overlay').classList.add('active');
            }));
            acciones.appendChild(crearBotonAccion('🧘 Meditacion de regulacion', '', () => {
                irAProgramaYAbrir('meditaciones/med_05_crisis_ira.md', 'Meditacion de crisis');
            }));
            acciones.appendChild(crearBotonAccion('🌊 Modo Crisis guiado', '', () => startSession('MOD-CRI')));
        } else if (categoria === 'medio') {
            acciones.appendChild(crearBotonAccion('📚 Ver mi programa de hoy', '', () => {
                showScreen('programa');
                setTimeout(() => {
                    const panel = document.getElementById('programa-activo');
                    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 200);
            }));
            acciones.appendChild(crearBotonAccion('📋 Sesion de racionalizacion', '', () => startSession('MOD-RAC')));
            acciones.appendChild(crearBotonAccion('🌊 Sesion de Focusing', '', () => startSession('MOD-FOC')));
        } else {
            acciones.appendChild(crearBotonAccion('🪞 Reflexiones', '', () => {
                showScreen('programa');
                setTimeout(() => {
                    const bibTab = document.querySelector('.bib-tab[data-bib="reflexiones"]');
                    if (bibTab) bibTab.click();
                    const bibSection = document.getElementById('biblioteca-section');
                    if (bibSection) bibSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 200);
            }));
            acciones.appendChild(crearBotonAccion('🗂️ Flashcards', '', () => {
                showScreen('programa');
                setTimeout(() => {
                    const bibTab = document.querySelector('.bib-tab[data-bib="flashcards"]');
                    if (bibTab) bibTab.click();
                    const bibSection = document.getElementById('biblioteca-section');
                    if (bibSection) bibSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 200);
            }));
        }

        rec.scrollIntoView({ behavior: 'smooth', block: 'center' });
        rec.focus({ preventScroll: true });
    }

    function crearBotonAccion(label, extra, onClick) {
        const b = document.createElement('button');
        b.className = 'checkin-rec-btn ' + (extra || '');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
    }

    function irAProgramaYAbrir(rutaRelativa, titulo) {
        showScreen('programa');
        setTimeout(() => {
            try { programaAbrirItem(rutaRelativa); }
            catch (e) { console.warn('Programa no listo todavia:', e); }
        }, 250);
    }

    document.querySelectorAll('.mode-item').forEach(item => {
        item.addEventListener('click', () => {
            startSession(item.dataset.mode);
        });
    });

    // --- MODO ROUTER LOGIC ---
    // FASE 1: MOD-SIT y MOD-PEN unificados en MOD-RAC (Racionalización).
    //         MOD-EMO renombrado a MOD-FOC (Focusing).
    //         Sin perfil_modifiers (app personal, tono cálido único).
    const MODO_ROUTER = {
        triggers: {
            'MOD-RAC': ['me pasó', 'tuve', 'situación', 'conflicto', 'discutí', 'me dijo',
                        'no puedo dejar de pensar', 'pensamiento', 'me obsesiona', 'rumio'],
            'MOD-FOC': ['siento', 'noto en el cuerpo', 'me duele', 'tensión', 'opresión', 'calor'],
            'MOD-VAL': ['no sé qué quiero', 'sin sentido', 'propósito', 'qué importa', 'vacío'],
            'MOD-CRI': ['no puedo más', 'hacerme daño', 'desaparecer', 'crisis', 'emergencia', 'SOS'],
            'MOD-IRA': ['rabia', 'ira', 'enfado', 'injusticia', 'frustración', 'gritar']
        }
    };

    function detectModeFromText(text) {
        text = text.toLowerCase();
        for (const [mode, keywords] of Object.entries(MODO_ROUTER.triggers)) {
            if (keywords.some(k => text.includes(k))) return mode;
        }
        return null;
    }

    // --- SESSION FLOWS ---
    // FASE 1: MOD-SIT + MOD-PEN unificados en MOD-RAC (Racionalización ABC),
    //         sin esquema ABC genérico al inicio (eso confundía).
    //         La racionalización real con LLM se conecta en FASE 2.
    //         MOD-EMO renombrado a MOD-FOC (Focusing). Rediseño completo en FASE 3.
    //         MOD-EMDR placeholder, se desarrolla en FASE 4.
    const SESSION_FLOWS = {
        'MOD-RAC': [
            {
                phase: 'Situación', tool: null, responses: [
                    "Cuéntame qué situación te ha alterado. Describe los hechos tal como ocurrieron."
                ]
            },
            {
                phase: 'Pensamiento', tool: null, responses: [
                    "¿Qué pensamiento automático te vino en ese momento? Escríbelo tal cual apareció."
                ]
            },
            {
                phase: 'Emoción', tool: null, responses: [
                    "¿Qué emoción llegó y cómo respondiste? (qué hiciste o dejaste de hacer)"
                ]
            },
            {
                phase: 'Credibilidad', tool: 'cred', responses: [
                    "Del 0 al 100, ¿cuánto te crees ese pensamiento?"
                ]
            },
            {
                phase: 'Alternativa', tool: null, responses: [
                    "¿Cómo podrías verlo de forma que te ayude más?"
                ]
            },
            {
                phase: 'Análisis', tool: null, responses: [
                    "Procesando tu respuesta... (el análisis cognitivo con LLM se activa en FASE 2)"
                ]
            }
        ],
        // MOD-FOC: rediseñado en FASE 3 con su propio flujo (startFocusingFlow).
        // Estas fases NO se renderizan: existen solo para que la bitácora
        // (saveSessionToCuaderno) etiquete correctamente los 4 campos.
        'MOD-FOC': [
            { phase: 'Zona corporal', tool: null, responses: ['—'] },
            { phase: 'Cualidad', tool: null, responses: ['—'] },
            { phase: 'Asidero', tool: null, responses: ['—'] },
            { phase: 'Diálogo', tool: null, responses: ['—'] }
        ],
        'MOD-EMDR': [
            {
                phase: 'EMDR', tool: null, responses: [
                    "El módulo EMDR (estimulación bilateral + SUD pre/post) se activa en FASE 4."
                ]
            }
        ],
        'MOD-VAL': [
            {
                phase: 'Vacío', tool: null, responses: [
                    "¿Qué es lo que sientes que falta o que ha perdido sentido?",
                    "¿Desde cuándo llevas con esta sensación de vacío o de sin-dirección?",
                    "¿Hay algún área de tu vida donde todavía sientes que algo vale la pena?"
                ]
            },
            {
                phase: 'Valores', tool: 'values', responses: [
                    "¿Qué cosas, cuando las haces, te hacen sentir que eres tú de verdad?",
                    "¿Qué admiras profundamente en los demás? Eso suele señalar tus valores.",
                    "Si tuvieras 6 meses de vida, ¿a qué los dedicarías?"
                ]
            },
            {
                phase: 'Compromiso', tool: null, responses: [
                    "¿Qué acción pequeña y concreta puedes hacer hoy en la dirección de ese valor?",
                    "No tiene que ser perfecta. ¿Cuál sería el paso más pequeño posible?",
                    "¿Qué estarías dispuesto/a a hacer aunque te produjera incomodidad?"
                ]
            }
        ],
        'MOD-IRA': [
            {
                phase: 'Validar', tool: 'body', responses: [
                    "¿Dónde sientes la rabia ahora mismo en tu cuerpo?",
                    "La ira suele aparecer cuando algo que valoras ha sido violado. ¿Qué crees que está detrás?",
                    "¿Puedes describir qué pasó exactamente para que llegara este enfado?"
                ]
            },
            {
                phase: 'Valor', tool: null, responses: [
                    "¿Qué necesidad o valor tuyo no fue respetado en esa situación?",
                    "¿Qué significó para ti lo que ocurrió?",
                    "¿Hay algo injusto aquí que necesita ser reconocido?"
                ]
            },
            {
                phase: 'Canal', tool: null, responses: [
                    "Antes de actuar desde la rabia, vamos a bajar la activación. ¿Puedes hacer 3 respiraciones lentas?",
                    "¿Qué necesitas expresar? Puedes escribirlo o imaginar que se lo dices a la persona.",
                    "¿Qué respuesta desde tus valores te dejaría mejor contigo mismo/a?"
                ]
            }
        ],
        'MOD-CRI': [
            {
                phase: 'SOS', tool: null, responses: [
                    "Estoy aquí contigo. ¿Estás en un lugar seguro ahora mismo?",
                    "Lo primero es tu seguridad. ¿Puedes decirme cómo estás físicamente?",
                    "Respira. Estoy contigo. Cuéntame qué está pasando."
                ]
            },
            {
                phase: 'Seguridad', tool: null, responses: [
                    "¿Tienes pensamientos de hacerte daño ahora mismo?",
                    "¿Hay alguien de confianza cerca de ti a quien puedas llamar?",
                    "¿Puedes decirme si estás solo/a o acompañado/a?"
                ]
            },
            {
                phase: 'Ayuda', tool: null, responses: [
                    "Te pido que llames ahora al Teléfono de la Esperanza: 717 003 717.",
                    "El Chat de Crisis del Teléfono de la Esperanza está disponible en telefonodelaesperanza.org.",
                    "Si estás en peligro inmediato, llama al 112."
                ]
            }
        ]
    };

    // FASE 1: tono único cálido, sin perfiles AGA/APA/OBS.
    const RESPONSE_BANK = {
        validacion: {
            general: [
                "Lo que describes tiene sentido.",
                "Tiene lógica que te sientas así.",
                "Tu experiencia es válida."
            ]
        },
        transiciones: {
            herramienta: ["Voy a mostrarte una herramienta para esto.", "Usemos un ejercicio práctico.", "Mira la herramienta de abajo."],
            siguiente: ["Bien. Sigamos un paso más.", "Eso es importante. Ahora te pregunto...", "Muy bien. Vamos a profundizar."]
        },
        cierre: [
            "Has trabajado algo importante hoy. ¿Qué te llevas?",
            "Tómate un momento para integrar esto. ¿Qué nota tu cuerpo ahora?",
            "Has dado un paso valioso hoy. Este registro se ha guardado."
        ]
    };

    const MODE_INFO = {
        'MOD-RAC': 'Racionalización (ABC)',
        'MOD-FOC': 'Focusing',
        'MOD-EMDR': 'EMDR',
        'MOD-CRI': 'Crisis (SOS)',
        'MOD-VAL': 'Valores (Brújula)',
        'MOD-IRA': 'Ira (Gestión)'
    };

    function pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // --- SESSION / CHAT LOGIC ---
    function startSession(mode) {
        // FASE 3: MOD-FOC tiene su propio flujo guiado (6 pasos con TTS,
        // mapa corporal, cualidad por chips y análisis Gemini al cierre).
        if (mode === 'MOD-FOC') {
            startFocusingFlow();
            return;
        }
        // FASE 4: MOD-EMDR tiene su propio flujo (intro / SUD pre /
        // estimulación bilateral 60 s / notas / SUD post / resumen). Sin Gemini.
        if (mode === 'MOD-EMDR') {
            startEMDRFlow();
            return;
        }

        state.activeMode = mode;
        state.sessionStep = -1;
        state.sessionLog = [];
        showScreen('session');

        document.getElementById('current-mode-name').textContent = MODE_INFO[mode] || mode;
        updateSessionStepper();

        const chatBox = document.getElementById('chat-messages');
        chatBox.innerHTML = '';
        hideTool();

        // Asegurar tema claro y restaurar el input row si veníamos de Focusing.
        const wrapper = document.querySelector('.chat-wrapper');
        if (wrapper) wrapper.classList.remove('focusing-mode');
        document.body.classList.remove('focusing-mode');
        restoreInputRow();

        advanceSession();
    }

    // --- FOCUSING (MOD-FOC) — flujo dedicado FASE 3 ---
    // Flujo de 6 pasos con accesibilidad alta (tema oscuro, fuente grande,
    // botones 48px, TTS es-ES). El input-row del chat queda oculto durante
    // todo el módulo: los avances se hacen con botones dentro de cada paso.
    const FOCUSING_CUALIDADES = [
        'Presión', 'Nudo', 'Calor', 'Frío', 'Vacío', 'Cosquilleo', 'Peso', 'Otro'
    ];
    const FOCUSING_PART_NAMES = {
        'head': 'cabeza',
        'chest': 'pecho',
        'belly': 'estómago',
        'arm-l': 'brazo izquierdo',
        'arm-r': 'brazo derecho',
        'leg-l': 'pierna izquierda',
        'leg-r': 'pierna derecha'
    };

    function ttsSpeak(text) {
        try {
            if (!('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'es-ES';
            u.rate = 0.95;
            u.pitch = 1;
            window.speechSynthesis.speak(u);
        } catch (_) { /* silencio */ }
    }

    function ttsStop() {
        try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) {}
    }

    // ============================================================
    // FASE 2 (22/05/2026) - Modulo TTS robusto + audio guiado
    // ============================================================
    // Objeto TTS con voz castellana preferida, limpieza de markdown,
    // workaround Chrome (pause/resume cada 10s evita corte a 15s) y
    // sincronizacion con boton (label + clase 'tts-activo').
    const TTS = {
        synth: window.speechSynthesis,
        utterance: null,
        speaking: false,
        _keepAlive: null,

        getVoz() {
            try {
                const voces = this.synth ? this.synth.getVoices() : [];
                const prefs = ['Google espanol', 'Microsoft Pablo', 'Microsoft Helena',
                               'es-ES', 'es-MX', 'es'];
                for (const pref of prefs) {
                    const v = voces.find(v => v.name.includes(pref) || (v.lang && v.lang.startsWith(pref)));
                    if (v) return v;
                }
                return voces.find(v => v.lang && v.lang.startsWith('es')) || voces[0] || null;
            } catch (_) { return null; }
        },

        limpiar(texto) {
            return String(texto || '')
                .replace(/#{1,6}\s+/g, '')
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/\*(.+?)\*/g, '$1')
                .replace(/`(.+?)`/g, '$1')
                .replace(/---+/g, '. ')
                .replace(/\n{2,}/g, '. ')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        },

        leer(texto, btnEl) {
            try {
                if (!this.synth) return;
                if (this.speaking) { this.parar(); return; }
                const limpio = this.limpiar(texto);
                if (!limpio) return;
                this.utterance = new SpeechSynthesisUtterance(limpio);
                const v = this.getVoz();
                if (v) this.utterance.voice = v;
                this.utterance.lang = 'es-ES';
                this.utterance.rate = 0.9;
                this.utterance.pitch = 1.0;

                const onEnd = () => {
                    this.speaking = false;
                    if (this._keepAlive) { clearInterval(this._keepAlive); this._keepAlive = null; }
                    if (btnEl) { btnEl.textContent = '🔊 Escuchar'; btnEl.classList.remove('tts-activo'); btnEl.setAttribute('aria-pressed', 'false'); }
                };
                this.utterance.onstart = () => {
                    this.speaking = true;
                    if (btnEl) { btnEl.textContent = '⏹ Parar'; btnEl.classList.add('tts-activo'); btnEl.setAttribute('aria-pressed', 'true'); }
                };
                this.utterance.onend = onEnd;
                this.utterance.onerror = onEnd;

                // Workaround Chrome bug: la sintesis se corta a los ~15s sin pause/resume.
                if (this._keepAlive) clearInterval(this._keepAlive);
                this._keepAlive = setInterval(() => {
                    if (!this.synth.speaking) {
                        clearInterval(this._keepAlive);
                        this._keepAlive = null;
                        return;
                    }
                    try { this.synth.pause(); this.synth.resume(); } catch (_) {}
                }, 10000);

                this.synth.speak(this.utterance);
            } catch (_) { /* silencio */ }
        },

        parar() {
            try {
                if (this._keepAlive) { clearInterval(this._keepAlive); this._keepAlive = null; }
                if (this.synth) this.synth.cancel();
                this.speaking = false;
                document.querySelectorAll('.btn-tts.tts-activo').forEach(b => {
                    b.classList.remove('tts-activo');
                    b.textContent = '🔊 Escuchar';
                    b.setAttribute('aria-pressed', 'false');
                });
            } catch (_) {}
        }
    };

    // Precarga de voces (Chrome carga asincronamente).
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => TTS.getVoz();
    }

    // Helper para crear un boton TTS reutilizable.
    function crearBotonTTS(textoFn, claseExtra) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-tts ' + (claseExtra || '');
        btn.setAttribute('aria-label', 'Leer en voz alta');
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = '🔊 Escuchar';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const texto = typeof textoFn === 'function' ? textoFn() : String(textoFn);
            TTS.leer(texto, btn);
        });
        return btn;
    }

    // ============================================================
    // EMDR GUIADO POR VOZ (FASE 2)
    // ============================================================
    const EMDRGuia = {
        fases: [
            { duracion: 30, texto: 'Cierra los ojos un momento. Piensa en la situacion que quieres trabajar. Como la sientes en el cuerpo ahora mismo.' },
            { duracion: 20, texto: 'Bien. Ahora abre los ojos y sigue el punto con la mirada. Deja que los pensamientos vengan y vayan sin agarrarte a ninguno.' },
            { duracion: 45, texto: 'Sigue el punto. Si un pensamiento o imagen aparece, dejalo estar. No lo analices. Solo observa.' },
            { duracion: 15, texto: 'Para un momento. Que notas ahora. Hay algun cambio en como sientes la situacion en el cuerpo.' },
            { duracion: 45, texto: 'Volvemos. Sigue el punto. Esta vez, si aparece una emocion, ponle nombre mentalmente y dejala pasar.' },
            { duracion: 15, texto: 'Para. Respira. Como estas ahora. Notalo sin juzgar.' },
            { duracion: 45, texto: 'Ultima ronda. Sigue el punto. Cuando sientas que algo se mueve o cambia en el cuerpo, es una buena senal.' },
            { duracion: 20, texto: 'Cierra los ojos. Respira despacio tres veces. Deja que lo que se ha movido se asiente. Bien hecho.' }
        ],
        faseActual: 0,
        timer: null,
        activo: false,

        iniciar() {
            this.parar();
            this.activo = true;
            this.faseActual = 0;
            try { if (typeof emdrMiniStart === 'function') emdrMiniStart(); } catch (_) {}
            this.siguienteFase();
        },

        siguienteFase() {
            if (!this.activo) return;
            if (this.faseActual >= this.fases.length) { this.finalizar(); return; }
            const fase = this.fases[this.faseActual];
            TTS.leer(fase.texto);
            this.timer = setTimeout(() => {
                this.faseActual++;
                this.siguienteFase();
            }, fase.duracion * 1000);
        },

        parar() {
            this.activo = false;
            if (this.timer) { clearTimeout(this.timer); this.timer = null; }
            TTS.parar();
            try { if (typeof emdrMiniStop === 'function') emdrMiniStop(); } catch (_) {}
        },

        finalizar() {
            this.activo = false;
            TTS.leer('La sesion ha terminado. Tomate un momento. Respira. Como estas ahora comparado con antes de empezar.');
            try { if (typeof emdrMiniStop === 'function') emdrMiniStop(); } catch (_) {}
        }
    };

    // ============================================================
    // RESPIRACION GUIADA POR VOZ (FASE 2)
    // ============================================================
    const RespiracionGuia = {
        ciclos: 0,
        maxCiclos: 6,
        timer: null,
        activo: false,

        iniciar() {
            this.parar();
            this.activo = true;
            this.ciclos = 0;
            try { if (typeof respCohStart === 'function') respCohStart(); } catch (_) {}
            TTS.leer('Vamos a hacer seis ciclos de respiracion. Sigue el circulo en pantalla. Inhala por la nariz, exhala por la boca.');
            this.timer = setTimeout(() => this.cicloInhalar(), 7000);
        },

        cicloInhalar() {
            if (!this.activo) return;
            if (this.ciclos >= this.maxCiclos) { this.finalizar(); return; }
            TTS.leer('Inhala. Dos. Tres. Cuatro. Cinco.');
            this.timer = setTimeout(() => this.cicloExhalar(), 5500);
        },

        cicloExhalar() {
            if (!this.activo) return;
            TTS.leer('Exhala. Dos. Tres. Cuatro. Cinco.');
            this.timer = setTimeout(() => {
                this.ciclos++;
                if (this.ciclos < this.maxCiclos) {
                    this.cicloInhalar();
                } else {
                    this.finalizar();
                }
            }, 5500);
        },

        parar() {
            this.activo = false;
            if (this.timer) { clearTimeout(this.timer); this.timer = null; }
            TTS.parar();
            try { if (typeof respCohStop === 'function') respCohStop(); } catch (_) {}
        },

        finalizar() {
            this.activo = false;
            TTS.leer('Perfecto. Has completado ' + this.maxCiclos + ' ciclos. Notalo. Tu sistema nervioso esta mas calmado ahora.');
            try { if (typeof respCohStop === 'function') respCohStop(); } catch (_) {}
        }
    };

    function startFocusingFlow() {
        state.activeMode = 'MOD-FOC';
        state.sessionStep = 0;
        state.sessionLog = [];
        state._focusing = { zona: '', zonaKey: '', cualidad: '', cualidadOtro: '', dialogo: '' };

        showScreen('session');
        document.getElementById('current-mode-name').textContent = MODE_INFO['MOD-FOC'];

        // Stepper personalizado de 6 pasos
        const stepsContainer = document.querySelector('.session-steps');
        if (stepsContainer) {
            const labels = ['Guía', 'Atención', 'Mapa', 'Cualidad', 'Diálogo', 'Síntesis'];
            stepsContainer.innerHTML = labels.map((s, i) =>
                '<div class="step" id="step-' + i + '">' + s + '</div>'
            ).join('');
        }

        // Tema oscuro y ocultar input-row + dynamic-tool durante el flujo
        const wrapper = document.querySelector('.chat-wrapper');
        if (wrapper) wrapper.classList.add('focusing-mode');
        document.body.classList.add('focusing-mode');
        hideTool();
        const inputRow = document.querySelector('.input-row');
        if (inputRow) inputRow.style.display = 'none';

        const chatBox = document.getElementById('chat-messages');
        chatBox.innerHTML = '';

        focusingRenderStep(0);
    }

    function focusingMarkStep(step) {
        const stepsContainer = document.querySelector('.session-steps');
        if (!stepsContainer) return;
        const stepDivs = stepsContainer.querySelectorAll('.step');
        stepDivs.forEach((s, idx) => {
            s.classList.remove('active', 'done');
            if (idx < step) s.classList.add('done');
            else if (idx === step) s.classList.add('active');
        });
    }

    function focusingAppendCard(html) {
        const chatBox = document.getElementById('chat-messages');
        const card = document.createElement('div');
        card.className = 'focusing-card';
        card.innerHTML = html;
        chatBox.appendChild(card);
        chatBox.scrollTop = chatBox.scrollHeight;
        return card;
    }

    function focusingRenderStep(step) {
        state.sessionStep = step;
        focusingMarkStep(step);
        ttsStop();

        if (step === 0) {
            const guiaTexto =
                'Cierra los ojos. Respira profundamente tres veces. ' +
                'Lleva tu atención al interior de tu cuerpo. ' +
                'No busques nada concreto, solo observa lo que aparece.';
            const card = focusingAppendCard(
                '<h2 class="foc-title">Vamos a hacer un ejercicio de Focusing</h2>' +
                '<p class="foc-text">' + escapeHtml(guiaTexto) + '</p>' +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-secondary" data-action="tts">🔊 Escuchar guía</button>' +
                '  <button class="btn-foc btn-foc-primary" data-action="next-1">Continuar</button>' +
                '</div>'
            );
            card.querySelector('[data-action="tts"]').addEventListener('click', () => {
                ttsSpeak('Vamos a hacer un ejercicio de Focusing. ' + guiaTexto);
            });
            card.querySelector('[data-action="next-1"]').addEventListener('click', () => {
                focusingRenderStep(1);
            });
        } else if (step === 1) {
            const preguntaTexto =
                '¿Notas alguna sensación en alguna parte de tu cuerpo? ' +
                'No la juzgues, solo obsérvala.';
            const card = focusingAppendCard(
                '<h2 class="foc-title">' + escapeHtml('¿Notas alguna sensación en alguna parte de tu cuerpo?') + '</h2>' +
                '<p class="foc-text">No la juzgues, solo obsérvala.</p>' +
                '<div class="foc-actions foc-actions-vertical">' +
                '  <button class="btn-foc btn-foc-secondary" data-action="tts">🔊 Escuchar</button>' +
                '  <button class="btn-foc btn-foc-primary" data-action="yes">Sí, la noto</button>' +
                '  <button class="btn-foc btn-foc-secondary" data-action="not-sure">No estoy seguro</button>' +
                '</div>'
            );
            card.querySelector('[data-action="tts"]').addEventListener('click', () => {
                ttsSpeak(preguntaTexto);
            });
            card.querySelector('[data-action="yes"]').addEventListener('click', () => {
                focusingRenderStep(2);
            });
            card.querySelector('[data-action="not-sure"]').addEventListener('click', () => {
                focusingRenderHelp();
            });
        } else if (step === 2) {
            const svgHtml =
                '<svg viewBox="0 0 200 500" class="human-body foc-body">' +
                '  <path class="body-part" data-part="head" d="M100,20 c15,0 25,10 25,25 s-10,25 -25,25 s-25,-10 -25,-25 s10,-25 25,-25" />' +
                '  <path class="body-part" data-part="chest" d="M75,75 l50,0 l10,80 l-70,0 z" />' +
                '  <path class="body-part" data-part="belly" d="M75,160 l70,0 l-5,80 l-60,0 z" />' +
                '  <path class="body-part" data-part="arm-l" d="M70,80 l-40,80 l10,10 l30,-70 z" />' +
                '  <path class="body-part" data-part="arm-r" d="M130,80 l40,80 l-10,10 l-30,-70 z" />' +
                '  <path class="body-part" data-part="leg-l" d="M80,245 l-10,180 l15,0 l10,-150 l10,0 z" />' +
                '  <path class="body-part" data-part="leg-r" d="M120,245 l10,180 l-15,0 l-10,-150 l-10,0 z" />' +
                '</svg>';
            const card = focusingAppendCard(
                '<h2 class="foc-title">Toca la zona donde notas la sensación</h2>' +
                '<div class="body-svg-container foc-body-container">' + svgHtml + '</div>' +
                '<div id="foc-body-label" class="selected-label foc-zona-label">Ninguna zona seleccionada</div>' +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-primary" data-action="confirm" disabled>Confirmar zona</button>' +
                '</div>'
            );
            const label = card.querySelector('#foc-body-label');
            const btnConfirm = card.querySelector('[data-action="confirm"]');
            card.querySelectorAll('.body-part').forEach(p => {
                p.addEventListener('click', () => {
                    card.querySelectorAll('.body-part').forEach(x => x.classList.remove('selected'));
                    p.classList.add('selected');
                    const key = p.dataset.part;
                    const nombre = FOCUSING_PART_NAMES[key] || key;
                    state._focusing.zonaKey = key;
                    state._focusing.zona = nombre;
                    label.textContent = 'Zona seleccionada: ' + nombre;
                    btnConfirm.disabled = false;
                });
            });
            btnConfirm.addEventListener('click', () => {
                if (!state._focusing.zona) return;
                focusingRenderStep(3);
            });
        } else if (step === 3) {
            const zona = state._focusing.zona || 'esa zona';
            const chipsHtml = FOCUSING_CUALIDADES.map(c =>
                '<button class="foc-chip" data-chip="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>'
            ).join('');
            const card = focusingAppendCard(
                '<h2 class="foc-title">¿Qué cualidad tiene esa sensación en ' + escapeHtml(zona) + '?</h2>' +
                '<div class="foc-chips">' + chipsHtml + '</div>' +
                '<div class="foc-otro-wrap hidden">' +
                '  <label for="foc-otro" class="foc-label">Descríbela con tus palabras:</label>' +
                '  <input type="text" id="foc-otro" class="foc-input" maxlength="80" placeholder="p. ej. burbuja apretada">' +
                '</div>' +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-primary" data-action="next-4" disabled>Continuar</button>' +
                '</div>'
            );
            const btnNext = card.querySelector('[data-action="next-4"]');
            const otroWrap = card.querySelector('.foc-otro-wrap');
            const otroInput = card.querySelector('#foc-otro');
            card.querySelectorAll('.foc-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    card.querySelectorAll('.foc-chip').forEach(c => c.classList.remove('selected'));
                    chip.classList.add('selected');
                    const val = chip.dataset.chip;
                    state._focusing.cualidad = val;
                    if (val === 'Otro') {
                        otroWrap.classList.remove('hidden');
                        btnNext.disabled = !otroInput.value.trim();
                        otroInput.focus();
                    } else {
                        otroWrap.classList.add('hidden');
                        state._focusing.cualidadOtro = '';
                        btnNext.disabled = false;
                    }
                });
            });
            otroInput.addEventListener('input', () => {
                state._focusing.cualidadOtro = otroInput.value.trim();
                btnNext.disabled = !state._focusing.cualidadOtro;
            });
            btnNext.addEventListener('click', () => {
                if (state._focusing.cualidad === 'Otro' && state._focusing.cualidadOtro) {
                    state._focusing.cualidad = state._focusing.cualidadOtro;
                }
                if (!state._focusing.cualidad) return;
                focusingRenderStep(4);
            });
        } else if (step === 4) {
            const card = focusingAppendCard(
                '<h2 class="foc-title">Si esa sensación pudiera hablar, ¿qué te diría?</h2>' +
                '<textarea id="foc-dialogo" class="foc-textarea" rows="4" maxlength="500" placeholder="Escribe lo que esa sensación querría decirte..."></textarea>' +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-primary" data-action="next-5" disabled>Continuar</button>' +
                '</div>'
            );
            const ta = card.querySelector('#foc-dialogo');
            const btn = card.querySelector('[data-action="next-5"]');
            ta.addEventListener('input', () => {
                btn.disabled = !ta.value.trim();
            });
            btn.addEventListener('click', () => {
                state._focusing.dialogo = ta.value.trim();
                focusingRenderStep(5);
            });
            ta.focus();
        } else if (step === 5) {
            focusingRunAnalysis();
        }
    }

    function focusingRenderHelp() {
        // Texto de ayuda + botón Continuar al mapa (mantenemos paso 1 marcado)
        const ayudaTexto =
            'A veces la sensación es sutil. Puede ser presión, tensión, calor, frío, ' +
            'vacío, nudo, cosquilleo... Tómate un momento más.';
        const card = focusingAppendCard(
            '<p class="foc-text">' + escapeHtml(ayudaTexto) + '</p>' +
            '<div class="foc-actions">' +
            '  <button class="btn-foc btn-foc-secondary" data-action="tts">🔊 Escuchar</button>' +
            '  <button class="btn-foc btn-foc-primary" data-action="next-2">Continuar al mapa</button>' +
            '</div>'
        );
        card.querySelector('[data-action="tts"]').addEventListener('click', () => ttsSpeak(ayudaTexto));
        card.querySelector('[data-action="next-2"]').addEventListener('click', () => focusingRenderStep(2));
    }

    async function focusingRunAnalysis() {
        const chatBox = document.getElementById('chat-messages');
        const spinner = document.createElement('div');
        spinner.className = 'focusing-card foc-spinner';
        spinner.innerHTML =
            '<div class="foc-spinner-inner">' +
            '  <div class="foc-spinner-dot"></div>' +
            '  <p class="foc-text">Integrando tu experiencia...</p>' +
            '</div>';
        chatBox.appendChild(spinner);
        chatBox.scrollTop = chatBox.scrollHeight;

        let analisis = null;
        let errorTexto = null;
        try {
            if (!window.GeminiClient) throw new Error('Cliente Gemini no cargado.');
            const zona = state._focusing.zona || '';
            const cualidad = state._focusing.cualidad || '';
            const asidero = state._focusing.cualidad || '';
            const dialogo = state._focusing.dialogo || '';
            analisis = await window.GeminiClient.analizarFocusing(zona, cualidad, asidero, dialogo);
        } catch (e) {
            errorTexto = (e && e.message) ? e.message : 'Error desconocido.';
        }
        spinner.remove();

        // Reconstruir sessionLog en el formato que espera saveSessionToCuaderno
        state.sessionLog = [
            { role: 'user', text: state._focusing.zona || '' },
            { role: 'user', text: state._focusing.cualidad || '' },
            { role: 'user', text: state._focusing.cualidad || '' },
            { role: 'user', text: state._focusing.dialogo || '' }
        ];

        if (analisis) {
            const sintesis = analisis.sintesis || '';
            const proxima = analisis.sugerencia_proxima_practica || '';
            const card = focusingAppendCard(
                '<h2 class="foc-title">🌊 Síntesis de tu sesión</h2>' +
                '<p class="foc-text">' + escapeHtml(sintesis) + '</p>' +
                '<div class="foc-proxima">' +
                '  <strong>Próxima práctica:</strong><br/>' + escapeHtml(proxima) +
                '</div>' +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-secondary" data-action="tts">🔊 Escuchar síntesis</button>' +
                '  <button class="btn-foc btn-foc-primary" data-action="save">💾 Guardar en bitácora</button>' +
                '</div>'
            );
            card.querySelector('[data-action="tts"]').addEventListener('click', () => {
                ttsSpeak(sintesis + '. Próxima práctica: ' + proxima);
            });
            card.querySelector('[data-action="save"]').addEventListener('click', () => {
                state._pendingAnalysis = analisis;
                focusingFinish();
            });
        } else {
            // Gemini falla: guardar sin análisis y avisar
            const card = focusingAppendCard(
                '<h2 class="foc-title">⚠️ Análisis no disponible</h2>' +
                '<p class="foc-text">No se pudo conectar con el análisis (' +
                escapeHtml(errorTexto || 'sin detalle') +
                '), pero tu sesión se guardará igualmente en la bitácora.</p>' +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-primary" data-action="save">💾 Guardar igualmente</button>' +
                '</div>'
            );
            card.querySelector('[data-action="save"]').addEventListener('click', () => {
                state._pendingAnalysis = null;
                focusingFinish();
            });
        }
    }

    function focusingFinish() {
        ttsStop();
        // Guardar usando el mismo helper que el resto del sistema
        saveSessionToCuaderno();
        // Restaurar UI normal
        const wrapper = document.querySelector('.chat-wrapper');
        if (wrapper) wrapper.classList.remove('focusing-mode');
        document.body.classList.remove('focusing-mode');
        restoreInputRow();
        showScreen('hub');
    }

    // --- EMDR (MOD-EMDR) — flujo dedicado FASE 4 ---
    // 6 pasos: introducción / SUD pre / estimulación bilateral 60 s /
    // pregunta libre / SUD post / resumen. Sin Gemini. Reutiliza el tema
    // oscuro de focusing-mode y el sistema de tarjetas focusing-card.
    const EMDR_DURACION_S = 60;

    function startEMDRFlow() {
        state.activeMode = 'MOD-EMDR';
        state.sessionStep = 0;
        state.sessionLog = [];
        state._emdr = {
            sud_pre: null,
            sud_post: null,
            notas: '',
            timer_id: null,
            tiempo_restante: EMDR_DURACION_S,
            completado: false
        };

        showScreen('session');
        document.getElementById('current-mode-name').textContent = MODE_INFO['MOD-EMDR'] || 'EMDR';

        // Stepper personalizado de 6 pasos
        const stepsContainer = document.querySelector('.session-steps');
        if (stepsContainer) {
            const labels = ['Intro', 'SUD pre', 'Bilateral', 'Notas', 'SUD post', 'Cierre'];
            stepsContainer.innerHTML = labels.map((s, i) =>
                '<div class="step" id="step-' + i + '">' + s + '</div>'
            ).join('');
        }

        // Tema oscuro y ocultar input-row durante el flujo
        const wrapper = document.querySelector('.chat-wrapper');
        if (wrapper) wrapper.classList.add('focusing-mode');
        document.body.classList.add('focusing-mode');
        hideTool();
        const inputRow = document.querySelector('.input-row');
        if (inputRow) inputRow.style.display = 'none';

        const chatBox = document.getElementById('chat-messages');
        chatBox.innerHTML = '';

        emdrRenderStep(0);
    }

    function emdrMarkStep(step) {
        const stepsContainer = document.querySelector('.session-steps');
        if (!stepsContainer) return;
        const stepDivs = stepsContainer.querySelectorAll('.step');
        stepDivs.forEach((s, idx) => {
            s.classList.remove('active', 'done');
            if (idx < step) s.classList.add('done');
            else if (idx === step) s.classList.add('active');
        });
    }

    function emdrAppendCard(html) {
        // Reutilizamos el contenedor focusing-card para el mismo aspecto oscuro.
        const chatBox = document.getElementById('chat-messages');
        const card = document.createElement('div');
        card.className = 'focusing-card emdr-card';
        card.innerHTML = html;
        chatBox.appendChild(card);
        chatBox.scrollTop = chatBox.scrollHeight;
        return card;
    }

    function emdrSudGridHtml() {
        // 11 botones del 0 al 10.
        let html = '<div class="emdr-sud-grid">';
        for (let n = 0; n <= 10; n++) {
            html += '<button class="emdr-sud-btn" data-sud="' + n + '">' + n + '</button>';
        }
        html += '</div>';
        return html;
    }

    function emdrRenderStep(step) {
        state.sessionStep = step;
        emdrMarkStep(step);
        ttsStop();
        // Asegurar que cualquier timer anterior queda parado al cambiar de paso.
        if (state._emdr.timer_id) {
            clearInterval(state._emdr.timer_id);
            state._emdr.timer_id = null;
        }

        if (step === 0) {
            const introTexto =
                'Vamos a hacer una sesión de estimulación bilateral (EMDR simplificado). ' +
                'Sigue el punto con los ojos mientras se mueve de izquierda a derecha.';
            const card = emdrAppendCard(
                '<h2 class="foc-title">EMDR — Estimulación bilateral</h2>' +
                '<p class="foc-text">' + escapeHtml(introTexto) + '</p>' +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-secondary" data-action="tts">🔊 Escuchar guía</button>' +
                '  <button class="btn-foc btn-foc-primary" data-action="next">Continuar</button>' +
                '</div>'
            );
            card.querySelector('[data-action="tts"]').addEventListener('click', () => ttsSpeak(introTexto));
            card.querySelector('[data-action="next"]').addEventListener('click', () => emdrRenderStep(1));

        } else if (step === 1) {
            // SUD pre
            const card = emdrAppendCard(
                '<h2 class="foc-title">¿Cuánto malestar sientes ahora?</h2>' +
                '<p class="foc-text">0 = ninguno · 10 = máximo</p>' +
                emdrSudGridHtml()
            );
            card.querySelectorAll('.emdr-sud-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    card.querySelectorAll('.emdr-sud-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    const valor = parseInt(btn.dataset.sud, 10);
                    state._emdr.sud_pre = isNaN(valor) ? 0 : valor;
                    // Pequeña pausa visual y avance automático.
                    setTimeout(() => emdrRenderStep(2), 350);
                });
            });

        } else if (step === 2) {
            // Estimulación bilateral 60 s con punto oscilante CSS y contador.
            const card = emdrAppendCard(
                '<h2 class="foc-title">Sigue el punto con la mirada</h2>' +
                '<div class="emdr-stage" aria-label="Punto luminoso oscilando">' +
                '  <div class="emdr-dot"></div>' +
                '</div>' +
                '<div class="emdr-counter">Tiempo restante: <span id="emdr-time">' +
                EMDR_DURACION_S + '</span> s</div>' +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-secondary" data-action="pause">⏸ Pausar</button>' +
                '  <button class="btn-foc btn-foc-primary" data-action="end">Terminar antes</button>' +
                '</div>'
            );
            const dot = card.querySelector('.emdr-dot');
            const counterEl = card.querySelector('#emdr-time');
            const btnPause = card.querySelector('[data-action="pause"]');
            const btnEnd = card.querySelector('[data-action="end"]');

            state._emdr.tiempo_restante = EMDR_DURACION_S;
            let pausado = false;

            state._emdr.timer_id = setInterval(() => {
                if (pausado) return;
                state._emdr.tiempo_restante--;
                if (counterEl) counterEl.textContent = state._emdr.tiempo_restante;
                if (state._emdr.tiempo_restante <= 0) {
                    clearInterval(state._emdr.timer_id);
                    state._emdr.timer_id = null;
                    state._emdr.completado = true;
                    emdrRenderStep(3);
                }
            }, 1000);

            btnPause.addEventListener('click', () => {
                pausado = !pausado;
                if (pausado) {
                    dot.classList.add('paused');
                    btnPause.textContent = '▶ Reanudar';
                } else {
                    dot.classList.remove('paused');
                    btnPause.textContent = '⏸ Pausar';
                }
            });

            btnEnd.addEventListener('click', () => {
                if (state._emdr.timer_id) {
                    clearInterval(state._emdr.timer_id);
                    state._emdr.timer_id = null;
                }
                state._emdr.completado = false;
                emdrRenderStep(3);
            });

        } else if (step === 3) {
            // Pregunta libre tras la estimulación.
            const card = emdrAppendCard(
                '<h2 class="foc-title">Respira. ¿Qué notas ahora?</h2>' +
                '<textarea id="emdr-notas" class="foc-textarea" rows="4" maxlength="500" placeholder="Lo que aparezca: sensaciones, imágenes, pensamientos..."></textarea>' +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-secondary" data-action="skip">Sin notas</button>' +
                '  <button class="btn-foc btn-foc-primary" data-action="next" disabled>Continuar</button>' +
                '</div>'
            );
            const ta = card.querySelector('#emdr-notas');
            const btnNext = card.querySelector('[data-action="next"]');
            const btnSkip = card.querySelector('[data-action="skip"]');
            ta.addEventListener('input', () => {
                btnNext.disabled = !ta.value.trim();
            });
            btnNext.addEventListener('click', () => {
                state._emdr.notas = ta.value.trim();
                emdrRenderStep(4);
            });
            btnSkip.addEventListener('click', () => {
                state._emdr.notas = '';
                emdrRenderStep(4);
            });
            ta.focus();

        } else if (step === 4) {
            // SUD post
            const card = emdrAppendCard(
                '<h2 class="foc-title">¿Y ahora? ¿Cuánto malestar sientes?</h2>' +
                '<p class="foc-text">0 = ninguno · 10 = máximo</p>' +
                emdrSudGridHtml()
            );
            card.querySelectorAll('.emdr-sud-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    card.querySelectorAll('.emdr-sud-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    const valor = parseInt(btn.dataset.sud, 10);
                    state._emdr.sud_post = isNaN(valor) ? 0 : valor;
                    setTimeout(() => emdrRenderStep(5), 350);
                });
            });

        } else if (step === 5) {
            // Resumen + guardar
            const pre = (state._emdr.sud_pre !== null) ? state._emdr.sud_pre : '?';
            const post = (state._emdr.sud_post !== null) ? state._emdr.sud_post : '?';
            let delta = '';
            if (state._emdr.sud_pre !== null && state._emdr.sud_post !== null) {
                const diff = state._emdr.sud_pre - state._emdr.sud_post;
                if (diff > 0) delta = '<span class="emdr-delta-mejor">↓ ' + diff + ' puntos</span>';
                else if (diff < 0) delta = '<span class="emdr-delta-peor">↑ ' + Math.abs(diff) + ' puntos</span>';
                else delta = '<span class="emdr-delta-igual">= sin cambio</span>';
            }
            const notasHtml = state._emdr.notas
                ? '<div class="foc-proxima"><strong>Tus notas:</strong><br/>' + escapeHtml(state._emdr.notas) + '</div>'
                : '<p class="foc-text" style="font-style:italic;opacity:0.7">No hubo notas registradas.</p>';

            const card = emdrAppendCard(
                '<h2 class="foc-title">Resumen de tu sesión EMDR</h2>' +
                '<div class="emdr-sud-summary">' +
                '  <div class="emdr-sud-cell"><div class="emdr-sud-label">SUD antes</div><div class="emdr-sud-value">' + pre + '</div></div>' +
                '  <div class="emdr-sud-arrow">→</div>' +
                '  <div class="emdr-sud-cell"><div class="emdr-sud-label">SUD después</div><div class="emdr-sud-value">' + post + '</div></div>' +
                '</div>' +
                '<div class="emdr-delta-wrap">' + delta + '</div>' +
                notasHtml +
                '<div class="foc-actions">' +
                '  <button class="btn-foc btn-foc-primary" data-action="save">💾 Guardar en bitácora</button>' +
                '</div>'
            );
            card.querySelector('[data-action="save"]').addEventListener('click', () => {
                emdrSave();
            });
        }
    }

    function emdrSave() {
        // Estructura solicitada: { tipo:"emdr", sud_pre, sud_post, notas, fecha }
        // Conservamos también campos legacy (date/time/mode/content) para que
        // renderCuaderno actual no se rompa.
        const now = new Date();
        const animoPre = (state.moodHistory && state.moodHistory.length > 0)
            ? state.moodHistory[state.moodHistory.length - 1]
            : null;

        const sudPre = state._emdr.sud_pre;
        const sudPost = state._emdr.sud_post;
        const notas = state._emdr.notas || '';
        const resumenContenido =
            'SUD ' + (sudPre !== null ? sudPre : '?') +
            ' → ' + (sudPost !== null ? sudPost : '?') +
            (notas ? ' | ' + notas : '');

        const entry = {
            // Campos legacy.
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            mode: MODE_INFO['MOD-EMDR'] || 'EMDR',
            phases: 'Intro → SUD pre → Bilateral → Notas → SUD post → Cierre',
            content: resumenContenido,
            // Campos nuevos FASE 4.
            fecha: now.toISOString(),
            tipo: 'emdr',
            sud_pre: sudPre,
            sud_post: sudPost,
            notas: notas,
            analisis_llm: null,
            animo_pre: animoPre,
            completado: !!state._emdr.completado
        };
        state.savedResources.push(entry);
        saveState();

        // Limpiar timer por si quedó algo activo.
        if (state._emdr.timer_id) {
            clearInterval(state._emdr.timer_id);
            state._emdr.timer_id = null;
        }
        // Restaurar UI normal y volver al Hub.
        const wrapper = document.querySelector('.chat-wrapper');
        if (wrapper) wrapper.classList.remove('focusing-mode');
        document.body.classList.remove('focusing-mode');
        restoreInputRow();
        showScreen('hub');
        // Confirmación visual sutil mediante alert (mismo patrón que check-in).
        alert('Sesión EMDR guardada en tu bitácora.');
    }

    function advanceSession() {
        const flow = SESSION_FLOWS[state.activeMode];
        if (!flow) return;

        state.sessionStep++;
        updateSessionStepper();

        if (state.sessionStep >= flow.length) {
            // Modos sin análisis LLM: guardado directo.
            saveSessionToCuaderno();
            return;
        }

        const step = flow[state.sessionStep];
        let response = pickRandom(step.responses);

        // FASE 2: en la última fase de MOD-RAC o MOD-FOC, lanzar análisis Gemini.
        const isLastStep = state.sessionStep === flow.length - 1;
        const llmMode =
            (state.activeMode === 'MOD-RAC' && isLastStep) ||
            (state.activeMode === 'MOD-FOC' && isLastStep);

        if (llmMode) {
            const closingMsg = state.activeMode === 'MOD-RAC'
                ? 'Analizando tu sesión con un enfoque cognitivo-conductual...'
                : response;
            showTypingIndicator();
            setTimeout(() => {
                removeTypingIndicator();
                addChatMessage('assistant', closingMsg);
                hideTool();
                runLLMAnalysis(state.activeMode);
            }, 800);
            return;
        }

        // FASE 1: validación cálida única (sin perfil) solo en el primer paso.
        if (state.sessionStep === 0) {
            response = pickRandom(RESPONSE_BANK.validacion.general) + " " + response;
        }

        showTypingIndicator();
        setTimeout(() => {
            removeTypingIndicator();
            addChatMessage('assistant', response);

            if (step.tool) {
                showToolByType(step.tool);
            } else {
                hideTool();
            }
        }, 800);
    }

    // FASE 2: análisis LLM al final de MOD-RAC / MOD-FOC.
    async function runLLMAnalysis(mode) {
        const userTexts = (state.sessionLog || [])
            .filter(l => l.role === 'user')
            .map(l => l.text);

        // Ocultar input para evitar que el usuario escriba durante el análisis.
        const inputRow = document.querySelector('.input-row');
        if (inputRow) inputRow.style.display = 'none';

        // Spinner.
        const chatBox = document.getElementById('chat-messages');
        const spinner = document.createElement('div');
        spinner.className = 'message assistant';
        spinner.id = 'llm-spinner';
        spinner.innerHTML = '<div class="msg-bubble">⏳ Analizando...</div>';
        chatBox.appendChild(spinner);
        chatBox.scrollTop = chatBox.scrollHeight;

        let analisis = null;
        let errorTexto = null;

        try {
            if (!window.GeminiClient) {
                throw new Error('Cliente Gemini no cargado.');
            }
            if (mode === 'MOD-RAC') {
                const situacion = userTexts[0] || '';
                const pensamiento = userTexts[1] || '';
                const emocion = userTexts[2] || '';
                const credibilidad = userTexts[3] || '';
                const alternativa = userTexts[4] || '';
                analisis = await window.GeminiClient.analizarRacionalizacion(
                    situacion, pensamiento, emocion, credibilidad, alternativa
                );
            } else if (mode === 'MOD-FOC') {
                const zona = userTexts[0] || '';
                const cualidad = userTexts[1] || '';
                const asidero = userTexts[2] || '';
                const dialogo = userTexts[3] || '';
                analisis = await window.GeminiClient.analizarFocusing(
                    zona, cualidad, asidero, dialogo
                );
            }
        } catch (e) {
            errorTexto = (e && e.message) ? e.message : 'Error desconocido.';
        }

        const sp = document.getElementById('llm-spinner');
        if (sp) sp.remove();

        if (analisis) {
            renderAnalysisCard(mode, analisis);
            state._pendingAnalysis = analisis;
        } else {
            addChatMessage(
                'assistant',
                '⚠️ ' + (errorTexto || 'Análisis no disponible ahora, se guardó tu sesión.')
            );
            state._pendingAnalysis = null;
        }

        renderSaveButton();
    }

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function renderAnalysisCard(mode, analisis) {
        const chatBox = document.getElementById('chat-messages');
        const card = document.createElement('div');
        card.className = 'message assistant';

        if (mode === 'MOD-RAC') {
            const fuerzaRaw = parseInt(analisis.fuerza_distorsion, 10);
            const fuerza = isNaN(fuerzaRaw) ? 5 : Math.max(1, Math.min(10, fuerzaRaw));
            const barraWidth = (fuerza * 10) + '%';
            card.innerHTML =
                '<div class="msg-bubble" style="background:#f8fafc;border:1px solid #e2e8f0;padding:1rem;border-radius:12px;max-width:100%">' +
                '<h4 style="margin:0 0 0.5rem 0;color:#3b82f6">🧩 ' + escapeHtml(analisis.distorsion_cognitiva || 'Análisis') + '</h4>' +
                '<p style="margin:0.5rem 0">' + escapeHtml(analisis.explicacion_distorsion || '') + '</p>' +
                '<div style="background:#fef3c7;padding:0.5rem;border-radius:6px;margin:0.5rem 0">' +
                '<strong>Pensamiento alternativo:</strong><br/>' + escapeHtml(analisis.pensamiento_alternativo || '') +
                '</div>' +
                '<div style="margin:0.75rem 0">' +
                '<small>Fuerza de la distorsión: ' + fuerza + '/10</small>' +
                '<div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin-top:4px">' +
                '<div style="height:100%;width:' + barraWidth + ';background:linear-gradient(90deg,#10b981,#f59e0b,#ef4444)"></div>' +
                '</div></div>' +
                '<p style="margin:0.5rem 0"><strong>Ejercicio:</strong> ' + escapeHtml(analisis.ejercicio_sugerido || '') + '</p>' +
                '<p style="margin:0.5rem 0 0;color:#64748b;font-style:italic">' + escapeHtml(analisis.mensaje_cierre || '') + '</p>' +
                '</div>';
        } else if (mode === 'MOD-FOC') {
            card.innerHTML =
                '<div class="msg-bubble" style="background:#f0fdf4;border:1px solid #bbf7d0;padding:1rem;border-radius:12px;max-width:100%">' +
                '<h4 style="margin:0 0 0.5rem 0;color:#059669">🌊 Síntesis de tu sesión</h4>' +
                '<p style="margin:0.5rem 0">' + escapeHtml(analisis.sintesis || '') + '</p>' +
                '<div style="background:#ecfeff;padding:0.5rem;border-radius:6px;margin:0.5rem 0">' +
                '<strong>Próxima práctica:</strong><br/>' + escapeHtml(analisis.sugerencia_proxima_practica || '') +
                '</div></div>';
        }

        chatBox.appendChild(card);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function restoreInputRow() {
        const inputRow = document.querySelector('.input-row');
        if (!inputRow) return;
        inputRow.style.display = '';
        inputRow.innerHTML =
            '<textarea id="user-input" placeholder="Escribe aquí..." rows="1"></textarea>' +
            '<button id="send-msg">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" />' +
            '</svg>' +
            '</button>';
        document.getElementById('send-msg').addEventListener('click', submitMessage);
        document.getElementById('user-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitMessage();
            }
        });
    }

    function renderSaveButton() {
        const inputRow = document.querySelector('.input-row');
        if (!inputRow) return;
        inputRow.style.display = 'flex';
        inputRow.innerHTML =
            '<button id="save-session-btn" class="btn-primary" style="width:100%;padding:0.75rem;border-radius:8px;border:none;background:#3b82f6;color:white;font-weight:600;cursor:pointer">' +
            '💾 Guardar en bitácora' +
            '</button>';
        document.getElementById('save-session-btn').addEventListener('click', () => {
            saveSessionToCuaderno();
            restoreInputRow();
            showScreen('hub');
        });
    }

    function updateSessionStepper() {
        const stepsContainer = document.querySelector('.session-steps');
        const flow = SESSION_FLOWS[state.activeMode];
        if (!flow) return;

        // Repopulate steps if needed
        if (stepsContainer.children.length !== flow.length) {
            stepsContainer.innerHTML = flow.map((s, i) => `<div class="step" id="step-${i}">${s.phase}</div>`).join('');
        }

        const stepDivs = stepsContainer.querySelectorAll('.step');
        stepDivs.forEach((s, idx) => {
            s.classList.remove('active', 'done');
            if (idx < state.sessionStep) s.classList.add('done');
            else if (idx === state.sessionStep) s.classList.add('active');
        });
    }

    function addChatMessage(role, text) {
        const chatBox = document.getElementById('chat-messages');
        const msg = document.createElement('div');
        msg.className = `message ${role}`;
        msg.innerHTML = `<div class="msg-bubble">${text}</div>`;
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (role === 'user') {
            state.sessionLog.push({ role, text });
            // Passive mode detection
            const detectedMode = detectModeFromText(text);
            if (detectedMode && detectedMode === 'MOD-CRI' && state.activeMode !== 'MOD-CRI') {
                setTimeout(() => {
                    startSession('MOD-CRI');
                }, 500);
            }
        }
    }

    function showTypingIndicator() {
        const chatBox = document.getElementById('chat-messages');
        const ind = document.createElement('div');
        ind.className = 'message assistant typing-indicator';
        ind.id = 'typing-ind';
        ind.innerHTML = '<div class="msg-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
        chatBox.appendChild(ind);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removeTypingIndicator() {
        const el = document.getElementById('typing-ind');
        if (el) el.remove();
    }

    document.getElementById('send-msg').addEventListener('click', submitMessage);
    document.getElementById('user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitMessage();
        }
    });

    function submitMessage() {
        const input = document.getElementById('user-input');
        const text = input.value.trim();
        if (!text) return;

        addChatMessage('user', text);
        input.value = '';

        // Advance to next step after user responds
        setTimeout(() => {
            advanceSession();
        }, 400);
    }

    // --- DYNAMIC TOOLS LOGIC ---
    const TOOL_CONFIG = {
        'abc-map': { title: 'Modelo ABC: Hechos vs Juicios', tpl: 'tpl-abc-map', setup: null },
        'body': { title: 'Escaneo Corporal', tpl: 'tpl-body-selector', setup: 'setupBodySelector' },
        'cred': { title: 'Barra de Credibilidad', tpl: 'tpl-credibility-bar', setup: 'setupCredibilitySlider' },
        'values': { title: 'Mapa de Valores', tpl: 'tpl-values-map', setup: 'setupValuesMap' }
    };

    function showToolByType(type) {
        const config = TOOL_CONFIG[type];
        if (!config) return;

        const container = document.getElementById('dynamic-tool-container');
        const content = document.getElementById('dynamic-tool-content');
        const title = document.getElementById('tool-title');

        container.classList.remove('hidden');
        content.innerHTML = '';
        title.textContent = config.title;

        const tplEl = document.getElementById(config.tpl);
        if (tplEl) {
            const temp = tplEl.content.cloneNode(true);
            content.appendChild(temp);
        }

        if (config.setup && typeof window[config.setup] !== 'undefined') {
            window[config.setup]();
        } else if (config.setup === 'setupBodySelector') {
            setupBodySelector();
        } else if (config.setup === 'setupCredibilitySlider') {
            setupCredibilitySlider();
        } else if (config.setup === 'setupValuesMap') {
            setupValuesMap();
        }
    }

    function hideTool() {
        document.getElementById('dynamic-tool-container').classList.add('hidden');
    }

    document.getElementById('close-tool').addEventListener('click', hideTool);

    function setupBodySelector() {
        const parts = document.querySelectorAll('.body-part');
        const label = document.getElementById('body-part-selected');
        parts.forEach(p => {
            p.addEventListener('click', () => {
                parts.forEach(x => x.classList.remove('selected'));
                p.classList.add('selected');
                const partNames = {
                    'head': 'Cabeza / Pensamientos',
                    'chest': 'Pecho / Ansiedad',
                    'belly': 'Abdomen / Emoción',
                    'arm-l': 'Brazo Izquierdo',
                    'arm-r': 'Brazo Derecho',
                    'leg-l': 'Pierna Izquierda',
                    'leg-r': 'Pierna Derecha'
                };
                label.textContent = `Seleccionado: ${partNames[p.dataset.part]}`;
            });
        });
    }

    function setupCredibilitySlider() {
        // FASE 2 fix: el slider antiguo no enviaba el valor. Ahora hay solo un
        // input numérico (0-100). El botón "Continuar" coge el valor, lo
        // convierte en mensaje de usuario y avanza la sesión, garantizando
        // que el campo "credibilidad" llega correcto a analizarRacionalizacion()
        // en gemini-client.js.
        const input = document.getElementById('cred-num');
        const btn = document.getElementById('cred-submit');
        if (!input || !btn) return;

        function clamp(v) {
            const n = parseInt(v, 10);
            if (isNaN(n)) return null;
            return Math.max(0, Math.min(100, n));
        }

        input.addEventListener('input', () => {
            const v = clamp(input.value);
            if (v !== null) input.value = v;
        });

        btn.addEventListener('click', () => {
            const v = clamp(input.value);
            if (v === null) {
                input.focus();
                input.style.borderColor = '#ef4444';
                return;
            }
            input.style.borderColor = '';
            // Inyectamos el valor en el textarea principal y disparamos el envío
            // normal: así el flujo (sessionLog[3] = credibilidad) sigue intacto.
            const ta = document.getElementById('user-input');
            if (ta) ta.value = String(v);
            btn.disabled = true;
            input.disabled = true;
            submitMessage();
        });

        // Permitir Enter para confirmar
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });
    }

    function setupValuesMap() {
        const nodes = document.querySelectorAll('.value-node');
        nodes.forEach(n => {
            n.addEventListener('click', () => {
                n.classList.toggle('selected');
                n.style.background = n.classList.contains('selected') ? 'var(--primary-soft)' : 'white';
                n.style.borderColor = n.classList.contains('selected') ? 'var(--primary)' : '#e2e8f0';
            });
        });
    }

    // --- CRISIS LOGIC ---
    document.getElementById('crisis-button').addEventListener('click', () => {
        crisisOverlay.classList.add('active');
        startBreathingAnimation();
    });

    document.querySelector('.close-overlay').addEventListener('click', () => {
        crisisOverlay.classList.remove('active');
        stopBreathingAnimation();
    });

    let breathInterval;
    function startBreathingAnimation() {
        let cycle = 0;
        const runCycle = () => {
            breathingCircle.className = 'inhale';
            breathingText.textContent = "Inhala...";
            setTimeout(() => {
                breathingText.textContent = "Retén...";
                setTimeout(() => {
                    breathingCircle.className = 'exhale';
                    breathingText.textContent = "Exhala...";
                }, 7000);
            }, 4000);
        };
        runCycle();
        breathInterval = setInterval(runCycle, 19000);
    }

    function stopBreathingAnimation() {
        clearInterval(breathInterval);
        if (breathingCircle) breathingCircle.className = '';
    }

    let groundingIdx = 0;
    const groundingSteps = [
        { count: 5, icon: '👁️', text: 'Busca 5 cosas que puedas ver ahora mismo.' },
        { count: 4, icon: '✋', text: 'Busca 4 cosas que puedas tocar (texturas).' },
        { count: 3, icon: '👂', text: 'Busca 3 sonidos que puedas oír.' },
        { count: 2, icon: '👃', text: 'Busca 2 olores que puedas percibir.' },
        { count: 1, icon: '👅', text: 'Busca 1 sabor que puedas notar.' }
    ];

    document.getElementById('next-grounding').addEventListener('click', () => {
        groundingIdx++;
        if (groundingIdx < 5) {
            const step = groundingSteps[groundingIdx];
            groundingCounter.textContent = step.count;
            groundingIcon.textContent = step.icon;
            groundingInstruction.textContent = step.text;
        } else {
            document.getElementById('step-grounding').classList.remove('active');
            document.getElementById('step-contacts').classList.add('active');
        }
    });

    // --- RECURSOS RENDERING (FASE 5A) ---
    // Carga los 9 JSONs CPVA desde data/cpva/ (servidos por Firebase Hosting,
    // mismo origen). Caché en memoria + estado de carga compartido. Tabs:
    // flashcards (fichas_rapidas), ejercicios, podcasts (recursos_audio o aviso).
    const CPVA_MODULOS = [
        { key: 'focusing',    etiqueta: 'Focusing',     icono: '🌊' },
        { key: 'trec',        etiqueta: 'TREC',         icono: '📋' },
        { key: 'act',         etiqueta: 'ACT',          icono: '🌿' },
        { key: 'ansiedad',    etiqueta: 'Ansiedad',     icono: '😰' },
        { key: 'apego',       etiqueta: 'Apego',        icono: '❤️' },
        { key: 'crisis',      etiqueta: 'Crisis',       icono: '⚓' },
        { key: 'ira',         etiqueta: 'Ira',          icono: '🔥' },
        { key: 'logoterapia', etiqueta: 'Logoterapia',  icono: '✨' },
        { key: 'somatica',    etiqueta: 'Somática',     icono: '🪷' }
    ];

    let cpvaData = null;       // { focusing: {...}, trec: {...}, ... }
    let cpvaLoading = null;    // Promise mientras está cargando.
    let recursosTab = 'flashcards';
    let recursosFiltro = 'all';

    function moduloMeta(key) {
        return CPVA_MODULOS.find(m => m.key === key) || { key: key, etiqueta: key, icono: '📄' };
    }

    async function ensureCPVAData() {
        if (cpvaData) return cpvaData;
        if (cpvaLoading) return cpvaLoading;
        cpvaLoading = (async () => {
            const resultado = {};
            await Promise.all(CPVA_MODULOS.map(async (mod) => {
                try {
                    const resp = await fetch('data/cpva/CPVA_' + mod.key + '.json', { cache: 'no-cache' });
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    resultado[mod.key] = await resp.json();
                } catch (e) {
                    console.warn('CPVA: no se pudo cargar ' + mod.key, e);
                    resultado[mod.key] = null;
                }
            }));
            cpvaData = resultado;
            return resultado;
        })();
        return cpvaLoading;
    }

    function renderRecursosFiltro() {
        const filtroEl = document.getElementById('recursos-filtro');
        if (!filtroEl) return;
        if (recursosTab === 'podcasts') { filtroEl.innerHTML = ''; return; }
        const chipAll = '<button class="filtro-chip' + (recursosFiltro === 'all' ? ' selected' : '') +
            '" data-filtro="all">Todos</button>';
        const chips = CPVA_MODULOS.map(m =>
            '<button class="filtro-chip' + (recursosFiltro === m.key ? ' selected' : '') +
            '" data-filtro="' + m.key + '">' + m.icono + ' ' + escapeHtml(m.etiqueta) + '</button>'
        ).join('');
        filtroEl.innerHTML = chipAll + chips;
        filtroEl.querySelectorAll('.filtro-chip').forEach(c => {
            c.addEventListener('click', () => {
                recursosFiltro = c.dataset.filtro;
                renderRecursos(recursosTab);
            });
        });
    }

    function renderRecursosFlashcards(container, data) {
        // Aplanar todas las fichas_rapidas anotando su módulo.
        const fichas = [];
        CPVA_MODULOS.forEach(mod => {
            const j = data[mod.key];
            if (!j || !Array.isArray(j.fichas_rapidas)) return;
            if (recursosFiltro !== 'all' && recursosFiltro !== mod.key) return;
            j.fichas_rapidas.forEach((f, i) => {
                fichas.push({
                    id: (f.id || mod.key + '_F' + i),
                    titulo: f.titulo || '(sin título)',
                    contenido: f.contenido || '',
                    modulo: mod.key,
                    etiquetas: Array.isArray(f.etiquetas) ? f.etiquetas : []
                });
            });
        });

        if (fichas.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay fichas para el filtro seleccionado.</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'flashcard-grid';
        fichas.forEach(f => {
            const meta = moduloMeta(f.modulo);
            const card = document.createElement('div');
            card.className = 'f-card';
            // Front: módulo + título. Back: contenido + TTS + etiquetas.
            const etiquetasHtml = f.etiquetas.length
                ? '<div class="f-tags">' +
                  f.etiquetas.map(t => '<span class="f-tag">' + escapeHtml(t) + '</span>').join('') +
                  '</div>'
                : '';
            card.innerHTML =
                '<div class="inner">' +
                '  <div class="front">' +
                '    <div class="f-modulo">' + meta.icono + ' ' + escapeHtml(meta.etiqueta) + '</div>' +
                '    <div class="f-front-title">' + escapeHtml(f.titulo) + '</div>' +
                '    <div class="f-hint">Toca para ver respuesta</div>' +
                '  </div>' +
                '  <div class="back">' +
                '    <button class="f-tts" title="Escuchar"><span aria-hidden="true">🔊</span></button>' +
                '    <div class="f-back-text">' + escapeHtml(f.contenido) + '</div>' +
                     etiquetasHtml +
                '  </div>' +
                '</div>';
            card.addEventListener('click', (e) => {
                // No voltear si han pulsado el botón TTS.
                if (e.target && e.target.closest && e.target.closest('.f-tts')) return;
                card.classList.toggle('flipped');
            });
            const ttsBtn = card.querySelector('.f-tts');
            if (ttsBtn) {
                ttsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    ttsSpeak(f.titulo + '. ' + f.contenido);
                });
            }
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    function renderRecursosEjercicios(container, data) {
        const grupos = [];
        CPVA_MODULOS.forEach(mod => {
            const j = data[mod.key];
            if (!j || !Array.isArray(j.ejercicios) || j.ejercicios.length === 0) return;
            if (recursosFiltro !== 'all' && recursosFiltro !== mod.key) return;
            grupos.push({ modulo: mod, json: j });
        });

        if (grupos.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay ejercicios para el filtro seleccionado.</div>';
            return;
        }

        const lista = document.createElement('div');
        lista.className = 'ejercicios-lista';
        grupos.forEach(g => {
            const cabecera = document.createElement('h3');
            cabecera.className = 'ejercicios-grupo';
            cabecera.textContent = g.modulo.icono + ' ' + g.modulo.etiqueta;
            lista.appendChild(cabecera);

            g.json.ejercicios.forEach((ej, idx) => {
                const item = document.createElement('details');
                item.className = 'ejercicio-item';
                const nombre = ej.nombre || ('Ejercicio ' + (idx + 1));
                const duracion = (typeof ej.duracion_min === 'number') ? (ej.duracion_min + ' min') : '';
                const nivel = ej.nivel ? ej.nivel : '';
                const metaLinea = [duracion, nivel].filter(Boolean).join(' · ');
                let pasosHtml = '';
                if (Array.isArray(ej.pasos) && ej.pasos.length > 0) {
                    pasosHtml = '<ol class="ejercicio-pasos">' +
                        ej.pasos.map(p => '<li>' + escapeHtml(p.instruccion || '') + '</li>').join('') +
                        '</ol>';
                }
                let extra = '';
                if (ej.indicaciones) {
                    extra += '<p class="ejercicio-extra"><strong>Indicaciones:</strong> ' +
                        escapeHtml(ej.indicaciones) + '</p>';
                }
                if (ej.contraindicaciones) {
                    extra += '<p class="ejercicio-extra warn"><strong>Contraindicaciones:</strong> ' +
                        escapeHtml(ej.contraindicaciones) + '</p>';
                }
                item.innerHTML =
                    '<summary class="ejercicio-summary">' +
                    '  <span class="ejercicio-nombre">' + escapeHtml(nombre) + '</span>' +
                    (metaLinea ? '  <span class="ejercicio-meta">' + escapeHtml(metaLinea) + '</span>' : '') +
                    '</summary>' +
                    '<div class="ejercicio-cuerpo">' + pasosHtml + extra + '</div>';
                lista.appendChild(item);
            });
        });
        container.appendChild(lista);
    }

    function renderRecursosPodcasts(container, data) {
        // Recolectar todos los recursos_audio no vacíos.
        const audios = [];
        CPVA_MODULOS.forEach(mod => {
            const j = data[mod.key];
            if (!j || !Array.isArray(j.recursos_audio)) return;
            j.recursos_audio.forEach(a => {
                audios.push({ modulo: mod, audio: a });
            });
        });

        if (audios.length === 0) {
            container.innerHTML =
                '<div class="empty-state">' +
                '<div class="empty-icon">🎧</div>' +
                '<p>Los podcasts estarán disponibles próximamente cuando se active la generación de audio.</p>' +
                '<p class="empty-sub">De momento no hay episodios publicados para CPVA.</p>' +
                '</div>';
            return;
        }

        const lista = document.createElement('div');
        lista.className = 'podcasts-lista';
        audios.forEach(({ modulo, audio }) => {
            const item = document.createElement('div');
            item.className = 'podcast-item';
            const titulo = audio.titulo || audio.nombre || 'Audio';
            const url = audio.url || audio.src || '';
            item.innerHTML =
                '<div class="podcast-titulo">' + modulo.icono + ' ' + escapeHtml(titulo) +
                ' <span class="podcast-modulo">' + escapeHtml(modulo.etiqueta) + '</span></div>' +
                (url
                    ? '<audio controls preload="none" src="' + escapeHtml(url) + '"></audio>'
                    : '<p class="empty-sub">Sin URL disponible.</p>');
            lista.appendChild(item);
        });
        container.appendChild(lista);
    }

    function renderRecursos(type) {
        recursosTab = type || 'flashcards';
        const container = document.getElementById('tab-content');
        if (!container) return;

        renderRecursosFiltro();

        if (!cpvaData) {
            container.innerHTML = '<div class="empty-state">Cargando recursos…</div>';
            ensureCPVAData().then(() => renderRecursos(recursosTab));
            return;
        }

        container.innerHTML = '';
        if (recursosTab === 'flashcards')     renderRecursosFlashcards(container, cpvaData);
        else if (recursosTab === 'ejercicios') renderRecursosEjercicios(container, cpvaData);
        else if (recursosTab === 'podcasts')   renderRecursosPodcasts(container, cpvaData);
        else container.innerHTML = '<div class="empty-state">Pestaña desconocida.</div>';
    }

    document.querySelectorAll('.tab-link').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderRecursos(tab.dataset.tab);
        });
    });

    // --- CHART + STATS RENDERING (FASE 5C) ---
    // Solo datos reales derivados de savedResources + moodHistory.
    // Tolera entradas legacy de moodHistory (números) y nuevas ({val, fecha}).

    function moodEntryVal(e) {
        if (typeof e === 'number') return e;
        if (e && typeof e === 'object' && typeof e.val === 'number') return e.val;
        return null;
    }

    function moodEntryFecha(e) {
        if (e && typeof e === 'object' && e.fecha) {
            const t = Date.parse(e.fecha);
            return isNaN(t) ? null : new Date(t);
        }
        return null;
    }

    function fmtFechaCorta(d) {
        if (!d) return '';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return dd + '/' + mm;
    }

    function renderChart() {
        if (window.myChart) { try { window.myChart.destroy(); } catch (_) {} window.myChart = null; }

        // Referenciamos por .chart-container para que el toggle entre canvas
        // y empty-state sea reversible.
        const wrapper = document.querySelector('#screen-progreso .chart-container');
        if (!wrapper) return;

        const entradas = (state.moodHistory || []).map(moodEntryVal).filter(v => v !== null).length;

        if (entradas < 3) {
            wrapper.innerHTML =
                '<div class="empty-state empty-state-inline">' +
                '<div class="empty-icon">📈</div>' +
                '<p>Registra tu estado de ánimo en el Hub para ver tu evolución.</p>' +
                '<p class="empty-sub">Necesitas al menos 3 check-ins.</p>' +
                '</div>';
            renderStatsSidebar();
            return;
        }

        // Recrear canvas si lo habíamos sustituido por empty-state.
        if (!document.getElementById('evolution-chart')) {
            wrapper.innerHTML = '<canvas id="evolution-chart"></canvas>';
        }
        const ctx2 = document.getElementById('evolution-chart').getContext('2d');

        const valores = [];
        const etiquetas = [];
        (state.moodHistory || []).forEach((e, i, arr) => {
            const v = moodEntryVal(e);
            if (v === null) return;
            const f = moodEntryFecha(e);
            valores.push(v);
            if (f) {
                etiquetas.push(fmtFechaCorta(f));
            } else {
                // Legacy: etiqueta posicional relativa al final.
                etiquetas.push(i === arr.length - 1 ? 'Hoy' : ('-' + (arr.length - 1 - i)));
            }
        });

        window.myChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'Bienestar autopercibido',
                    data: valores,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.18)',
                    tension: 0.35,
                    fill: true,
                    borderWidth: 3,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { min: 1, max: 10, grid: { display: false }, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });

        renderStatsSidebar();
    }

    function contarPorTipo() {
        const counts = { racionalizacion: 0, focusing: 0, emdr: 0, crisis: 0, valores: 0, ira: 0, otros: 0 };
        (state.savedResources || []).forEach(r => {
            const t = r.tipo || 'otros';
            if (counts[t] === undefined) counts.otros += 1;
            else counts[t] += 1;
        });
        return counts;
    }

    function distorsionMasFrecuente() {
        const freq = {};
        (state.savedResources || []).forEach(r => {
            if (r.tipo !== 'racionalizacion') return;
            const d = r.analisis_llm && r.analisis_llm.distorsion_cognitiva;
            if (!d || typeof d !== 'string') return;
            const key = d.trim();
            freq[key] = (freq[key] || 0) + 1;
        });
        let mejorNombre = null, mejorCount = 0;
        Object.keys(freq).forEach(k => {
            if (freq[k] > mejorCount) { mejorNombre = k; mejorCount = freq[k]; }
        });
        return { nombre: mejorNombre, count: mejorCount, total: Object.values(freq).reduce((a, b) => a + b, 0) };
    }

    function mediaSudEmdr() {
        let sumPre = 0, sumPost = 0, n = 0;
        (state.savedResources || []).forEach(r => {
            if (r.tipo !== 'emdr') return;
            if (typeof r.sud_pre !== 'number' || typeof r.sud_post !== 'number') return;
            sumPre += r.sud_pre; sumPost += r.sud_post; n += 1;
        });
        if (n === 0) return null;
        return { pre: sumPre / n, post: sumPost / n, n: n };
    }

    function renderStatsSidebar() {
        const sidebar = document.getElementById('stats-sidebar');
        if (!sidebar) return;

        const total = (state.savedResources || []).length;

        if (total === 0) {
            sidebar.innerHTML =
                '<div class="empty-state empty-state-inline">' +
                '<div class="empty-icon">📊</div>' +
                '<p>Sin sesiones registradas todavía.</p>' +
                '<p class="empty-sub">Cuando completes una sesión aparecerán aquí tus estadísticas reales.</p>' +
                '</div>';
            return;
        }

        const counts = contarPorTipo();
        const dist = distorsionMasFrecuente();
        const sud = mediaSudEmdr();

        // Tarjeta principal: total + desglose.
        let html = '';
        html += '<div class="stat-card">' +
            '<span class="stat-label">Sesiones completadas</span>' +
            '<span class="stat-value">' + total + '</span>' +
            '<div class="stat-icon">📅</div>' +
            '</div>';

        const tipoFila = (icon, etiqueta, n) =>
            (n > 0 ? '<li><span>' + icon + ' ' + etiqueta + '</span><strong>' + n + '</strong></li>' : '');
        const desglose =
            tipoFila('🧠', 'Racionalización', counts.racionalizacion) +
            tipoFila('🌊', 'Focusing', counts.focusing) +
            tipoFila('👁️', 'EMDR', counts.emdr) +
            tipoFila('⚓', 'Crisis', counts.crisis) +
            tipoFila('🔥', 'Ira', counts.ira) +
            tipoFila('✨', 'Valores', counts.valores) +
            tipoFila('📝', 'Otros', counts.otros);
        if (desglose) {
            html += '<div class="stat-card stat-card-lista">' +
                '<span class="stat-label">Por tipo</span>' +
                '<ul class="stat-desglose">' + desglose + '</ul>' +
                '</div>';
        }

        // Distorsión más frecuente (solo si hay >= 3 sesiones de racionalización con análisis).
        if (dist.total >= 3 && dist.nombre) {
            html += '<div class="stat-card">' +
                '<span class="stat-label">Distorsión más frecuente</span>' +
                '<span class="stat-value stat-value-text">' + escapeHtml(dist.nombre) + '</span>' +
                '<small class="stat-sub">(' + dist.count + '/' + dist.total + ' sesiones)</small>' +
                '<div class="stat-icon">🧩</div>' +
                '</div>';
        }

        // Media SUD EMDR (siempre que haya al menos 1).
        if (sud) {
            const dPre = sud.pre.toFixed(1);
            const dPost = sud.post.toFixed(1);
            const delta = (sud.pre - sud.post).toFixed(1);
            const deltaCls = (sud.pre - sud.post) > 0 ? 'mejor' : ((sud.pre - sud.post) < 0 ? 'peor' : 'igual');
            html += '<div class="stat-card">' +
                '<span class="stat-label">Media SUD (EMDR)</span>' +
                '<span class="stat-value stat-value-text">' + dPre + ' → ' + dPost + '</span>' +
                '<small class="stat-sub cua-delta-' + deltaCls + '">Δ ' + delta + ' · ' + sud.n + ' sesión' + (sud.n === 1 ? '' : 'es') + '</small>' +
                '<div class="stat-icon">👁️</div>' +
                '</div>';
        }

        sidebar.innerHTML = html;
    }

    function saveSessionToCuaderno() {
        const flow = SESSION_FLOWS[state.activeMode];
        const phases = flow ? flow.map(s => s.phase).join(' → ') : '';
        const userTexts = (state.sessionLog || []).filter(l => l.role === 'user').map(l => l.text);
        const summary = userTexts.length > 0 ? userTexts.join(' | ') : 'Sesión sin registro de texto.';

        // FASE 2: respuestas estructuradas por fase + tipo + análisis LLM + ánimo previo.
        const respuestas_usuario = {};
        if (flow) {
            flow.forEach((step, idx) => {
                if (userTexts[idx] !== undefined) {
                    respuestas_usuario[step.phase] = userTexts[idx];
                }
            });
        }

        const tipoMap = {
            'MOD-RAC': 'racionalizacion',
            'MOD-FOC': 'focusing',
            'MOD-EMDR': 'emdr',
            'MOD-CRI': 'crisis',
            'MOD-VAL': 'valores',
            'MOD-IRA': 'ira'
        };

        const animoPre = (state.moodHistory && state.moodHistory.length > 0)
            ? state.moodHistory[state.moodHistory.length - 1]
            : null;

        const entry = {
            // Campos legacy (compatibilidad con renderCuaderno actual).
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            mode: MODE_INFO[state.activeMode] || state.activeMode,
            phases: phases,
            content: summary,
            // Campos nuevos FASE 2.
            fecha: new Date().toISOString(),
            tipo: tipoMap[state.activeMode] || state.activeMode,
            respuestas_usuario: respuestas_usuario,
            analisis_llm: state._pendingAnalysis || null,
            animo_pre: animoPre
        };
        state.savedResources.push(entry);
        state._pendingAnalysis = null;
        saveState();

        addChatMessage('assistant', `✅ Sesión guardada en tu bitácora.`);
    }

    // --- CUADERNO (FASE 5B) ---
    // Tarjetas ricas por tipo, expandible, borrar con confirmación, orden DESC.
    const CUADERNO_TIPO_INFO = {
        racionalizacion: { icono: '🧠', etiqueta: 'Racionalización' },
        focusing:        { icono: '🌊', etiqueta: 'Focusing' },
        emdr:            { icono: '👁️', etiqueta: 'EMDR' },
        crisis:          { icono: '⚓', etiqueta: 'Crisis' },
        valores:         { icono: '✨', etiqueta: 'Valores' },
        ira:             { icono: '🔥', etiqueta: 'Ira' }
    };

    function cuadernoTipoMeta(tipo) {
        return CUADERNO_TIPO_INFO[tipo] || { icono: '📝', etiqueta: tipo || 'Sesión' };
    }

    // Ordena por `fecha` ISO descendente; si no existe, usa el índice original
    // como desempate (las añadidas más tarde quedan más arriba).
    function cuadernoEntradasOrdenadas() {
        return (state.savedResources || []).map((r, idx) => ({ r, idx }))
            .sort((a, b) => {
                const ta = a.r.fecha ? Date.parse(a.r.fecha) : 0;
                const tb = b.r.fecha ? Date.parse(b.r.fecha) : 0;
                if (ta !== tb) return tb - ta;
                return b.idx - a.idx;
            });
    }

    function cuadernoResumenHtml(res) {
        const tipo = res.tipo || '';
        const analisis = res.analisis_llm || null;

        if (tipo === 'racionalizacion' && analisis) {
            const distorsion = analisis.distorsion_cognitiva || 'Distorsión identificada';
            const fuerzaRaw = parseInt(analisis.fuerza_distorsion, 10);
            const fuerza = isNaN(fuerzaRaw) ? 5 : Math.max(1, Math.min(10, fuerzaRaw));
            const barraWidth = (fuerza * 10) + '%';
            return '<div class="cua-distorsion">' +
                '  <div class="cua-distorsion-nombre">🧩 ' + escapeHtml(distorsion) + '</div>' +
                '  <div class="cua-fuerza">' +
                '    <small>Fuerza ' + fuerza + '/10</small>' +
                '    <div class="cua-fuerza-bar"><div class="cua-fuerza-fill" style="width:' + barraWidth + '"></div></div>' +
                '  </div>' +
                '</div>';
        }
        if (tipo === 'focusing' && analisis && analisis.sintesis) {
            const sintesis = analisis.sintesis;
            const corta = sintesis.length > 220 ? (sintesis.slice(0, 220) + '…') : sintesis;
            return '<p class="cua-sintesis">' + escapeHtml(corta) + '</p>';
        }
        if (tipo === 'emdr') {
            const pre = (res.sud_pre !== null && res.sud_pre !== undefined) ? res.sud_pre : '?';
            const post = (res.sud_post !== null && res.sud_post !== undefined) ? res.sud_post : '?';
            let deltaCls = 'igual', deltaTxt = '= sin cambio';
            if (typeof res.sud_pre === 'number' && typeof res.sud_post === 'number') {
                const diff = res.sud_pre - res.sud_post;
                if (diff > 0) { deltaCls = 'mejor'; deltaTxt = '↓ ' + diff; }
                else if (diff < 0) { deltaCls = 'peor'; deltaTxt = '↑ ' + Math.abs(diff); }
            }
            return '<div class="cua-emdr-sud">' +
                '  <span class="cua-sud-cell">SUD ' + pre + ' → ' + post + '</span>' +
                '  <span class="cua-emdr-delta cua-delta-' + deltaCls + '">' + deltaTxt + '</span>' +
                '</div>';
        }
        if (tipo === 'crisis') {
            return '<p class="cua-sintesis">Sesión de calma inmediata completada.</p>';
        }
        // Fallback genérico
        const contenido = (res.content || '').toString();
        const corta = contenido.length > 160 ? (contenido.slice(0, 160) + '…') : contenido;
        return corta ? '<p class="cua-sintesis">' + escapeHtml(corta) + '</p>' : '';
    }

    function cuadernoDetalleHtml(res) {
        let html = '';
        // Fases / pasos.
        if (res.phases) {
            html += '<p class="cua-detail-line"><strong>Fases:</strong> ' + escapeHtml(res.phases) + '</p>';
        }
        // Ánimo previo.
        if (res.animo_pre !== null && res.animo_pre !== undefined) {
            html += '<p class="cua-detail-line"><strong>Ánimo antes:</strong> ' + escapeHtml(String(res.animo_pre)) + '/10</p>';
        }
        // Respuestas estructuradas.
        if (res.respuestas_usuario && typeof res.respuestas_usuario === 'object') {
            const keys = Object.keys(res.respuestas_usuario);
            if (keys.length > 0) {
                html += '<div class="cua-respuestas"><strong>Tus respuestas:</strong><ul>';
                keys.forEach(k => {
                    html += '<li><span class="cua-resp-fase">' + escapeHtml(k) + ':</span> ' +
                        escapeHtml(String(res.respuestas_usuario[k])) + '</li>';
                });
                html += '</ul></div>';
            }
        }
        // Análisis LLM completo.
        const a = res.analisis_llm;
        if (a && typeof a === 'object') {
            if (res.tipo === 'racionalizacion') {
                if (a.explicacion_distorsion) html += '<p class="cua-detail-line"><strong>Explicación:</strong> ' + escapeHtml(a.explicacion_distorsion) + '</p>';
                if (a.pensamiento_alternativo) html += '<p class="cua-detail-line"><strong>Pensamiento alternativo:</strong> ' + escapeHtml(a.pensamiento_alternativo) + '</p>';
                if (a.ejercicio_sugerido) html += '<p class="cua-detail-line"><strong>Ejercicio:</strong> ' + escapeHtml(a.ejercicio_sugerido) + '</p>';
                if (a.mensaje_cierre) html += '<p class="cua-detail-line cua-cierre">' + escapeHtml(a.mensaje_cierre) + '</p>';
            } else if (res.tipo === 'focusing') {
                if (a.sintesis) html += '<p class="cua-detail-line"><strong>Síntesis:</strong> ' + escapeHtml(a.sintesis) + '</p>';
                if (a.sugerencia_proxima_practica) html += '<p class="cua-detail-line"><strong>Próxima práctica:</strong> ' + escapeHtml(a.sugerencia_proxima_practica) + '</p>';
            }
        }
        // EMDR notas.
        if (res.tipo === 'emdr' && res.notas) {
            html += '<p class="cua-detail-line"><strong>Notas:</strong> ' + escapeHtml(res.notas) + '</p>';
        }
        // Fallback content si no había nada más.
        if (!html && res.content) {
            html = '<p class="cua-detail-line">' + escapeHtml(res.content) + '</p>';
        }
        return html || '<p class="cua-detail-line empty-sub">Sin detalle adicional.</p>';
    }

    function renderCuaderno() {
        const container = document.getElementById('notebook-entries');
        if (!container) return;
        container.innerHTML = '';

        const entradas = cuadernoEntradasOrdenadas();
        if (entradas.length === 0) {
            container.innerHTML =
                '<div class="empty-state">' +
                '<div class="empty-icon">📓</div>' +
                '<p>Aún no has registrado ninguna sesión.</p>' +
                '<p class="empty-sub">Empieza desde el Hub.</p>' +
                '</div>';
            return;
        }

        entradas.forEach(({ r: res, idx: realIdx }) => {
            const meta = cuadernoTipoMeta(res.tipo);
            const fechaTxt = (res.date || '') + (res.time ? ' · ' + res.time : '');
            const card = document.createElement('article');
            card.className = 'cua-card cua-tipo-' + (res.tipo || 'otro');

            card.innerHTML =
                '<header class="cua-card-head">' +
                '  <div class="cua-tipo">' +
                '    <span class="cua-tipo-icon">' + meta.icono + '</span>' +
                '    <span class="cua-tipo-nombre">' + escapeHtml(meta.etiqueta) + '</span>' +
                '  </div>' +
                '  <time class="cua-fecha">' + escapeHtml(fechaTxt) + '</time>' +
                '</header>' +
                '<div class="cua-resumen">' + cuadernoResumenHtml(res) + '</div>' +
                '<details class="cua-detalle">' +
                '  <summary>Ver detalle</summary>' +
                '  <div class="cua-detalle-cuerpo">' + cuadernoDetalleHtml(res) + '</div>' +
                '</details>' +
                '<div class="cua-actions">' +
                '  <button class="cua-btn-borrar" data-idx="' + realIdx + '" aria-label="Borrar entrada">🗑️ Borrar</button>' +
                '</div>';

            const btnBorrar = card.querySelector('.cua-btn-borrar');
            btnBorrar.addEventListener('click', () => {
                if (!confirm('¿Borrar esta entrada de tu bitácora? No se puede deshacer.')) return;
                state.savedResources.splice(realIdx, 1);
                saveState();
                renderCuaderno();
            });

            container.appendChild(card);
        });
    }

    // Cancelar sesión: limpia tema oscuro de Focusing/EMDR, TTS y cualquier
    // timer EMDR activo antes de volver al Hub.
    const cancelBtn = document.getElementById('cancel-session');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            ttsStop();
            if (state._emdr && state._emdr.timer_id) {
                clearInterval(state._emdr.timer_id);
                state._emdr.timer_id = null;
            }
            const wrapper = document.querySelector('.chat-wrapper');
            if (wrapper) wrapper.classList.remove('focusing-mode');
            document.body.classList.remove('focusing-mode');
            restoreInputRow();
            state.activeMode = null;
            showScreen('hub');
        });
    }

    // Saludo dinamico segun hora (anadido 22/05/2026 - mision Agente B)
    // Sustituye "Como estas hoy?" por "Buenos dias/tardes/noches" + sub.
    (function aplicarSaludoDinamico() {
        try {
            var el = document.getElementById('welcome-greeting');
            if (!el) return;
            var h = new Date().getHours();
            var saludo;
            if (h >= 6 && h < 13) saludo = 'Buenos dias';
            else if (h >= 13 && h < 21) saludo = 'Buenas tardes';
            else saludo = 'Buenas noches';
            // Mantenemos accesibilidad: texto claro para NVDA.
            el.textContent = saludo + ', tomate un momento para ti';
        } catch (e) {
            // Silencioso: si falla, se queda el texto estatico del HTML.
            console.warn('Saludo dinamico no aplicado:', e);
        }
    })();

    // --- PROGRAMA PERSONALIZADO (Misión B - 22/05/2026) ---
    // Detecta supuestos/caso-invernadero/INDEX.json y muestra:
    //   * Panel "Programa activo" con la sesión recomendada del día.
    //   * Botón destacado "Protocolo de crisis".
    //   * Sub-tabs biblioteca (meditaciones / ejercicios / flashcards / podcasts / reflexiones).
    //   * Visor Markdown (modal) y visor de flashcards con flip.
    //   * Herramientas guiadas: EMDR bilateral + respiración coherencia cardíaca.
    // Sin librerías externas. Degradación elegante si no existe INDEX.json.

    // FASE 2: PROGRAMA_SUPUESTO ahora es dinamico (se elige desde la lista).
    let PROGRAMA_SUPUESTO = 'caso-invernadero';
    let PROGRAMA_BASE = 'supuestos/' + PROGRAMA_SUPUESTO + '/';
    const PROGRAMA_DIAS = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    let programaIndex = null;        // INDEX.json del supuesto seleccionado.
    let programaCargando = null;     // Promise de carga en curso.
    let bibliotecaTab = 'meditaciones';
    // FASE 2: vista actual de la pantalla Programa.
    //   'lista'  = pantalla de seleccion de programas.
    //   'detalle' = vista del programa elegido (logica original).
    let programaVista = 'lista';
    let programaManifest = null;
    let programaManifestCargando = null;

    function programaSeleccionar(slug) {
        if (!slug) return;
        PROGRAMA_SUPUESTO = slug;
        PROGRAMA_BASE = 'supuestos/' + slug + '/';
        programaIndex = null;
        programaCargando = null;
        programaVista = 'detalle';
        renderPrograma();
    }

    function programaVolverALista() {
        programaVista = 'lista';
        renderPrograma();
    }

    async function ensureProgramaManifest() {
        if (programaManifest !== null) return programaManifest;
        if (programaManifestCargando) return programaManifestCargando;
        programaManifestCargando = (async () => {
            try {
                // FIX-4: cache-bust agresivo + tolerancia a formato array o dict.
                const resp = await fetch('supuestos/_manifest.json?t=' + Date.now(), { cache: 'no-cache' });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                const raw = await resp.json();
                // Soportar ambos formatos: ["slug1","slug2"] o {"programas":[...]}
                if (Array.isArray(raw)) {
                    programaManifest = { programas: raw };
                } else if (raw && Array.isArray(raw.programas)) {
                    programaManifest = raw;
                } else {
                    programaManifest = { programas: [] };
                }
            } catch (e) {
                console.warn('Manifest no disponible, fallback a single', e);
                programaManifest = { programas: ['caso-invernadero'] };
            }
            return programaManifest;
        })();
        return programaManifestCargando;
    }

    async function cargarMetadataPrograma(slug) {
        try {
            // FIX-4: cache-bust con timestamp.
            const resp = await fetch('supuestos/' + slug + '/metadata.json?t=' + Date.now(), { cache: 'no-cache' });
            if (!resp.ok) return null;
            return await resp.json();
        } catch (_) { return null; }
    }

    function programaPathRelativo(p) {
        // INDEX.json usa rutas relativas tipo "meditaciones/med_01.md".
        if (!p) return '';
        return PROGRAMA_BASE + p;
    }

    async function ensureProgramaIndex() {
        if (programaIndex !== null) return programaIndex;
        if (programaCargando) return programaCargando;
        programaCargando = (async () => {
            try {
                const resp = await fetch(PROGRAMA_BASE + 'INDEX.json', { cache: 'no-cache' });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                programaIndex = await resp.json();
            } catch (e) {
                console.warn('Programa: INDEX.json no disponible', e);
                programaIndex = false; // false = ya intentado y no hay
            }
            return programaIndex;
        })();
        return programaCargando;
    }

    function programaItemTipo(rutaRelativa) {
        // "meditaciones/med_01.md" -> "meditaciones"
        if (!rutaRelativa) return 'desconocido';
        const idx = rutaRelativa.indexOf('/');
        return idx === -1 ? rutaRelativa : rutaRelativa.substring(0, idx);
    }

    function programaNombreLegible(rutaRelativa) {
        // "meditaciones/med_01_ira_cuerpo.md" -> "Med 01 ira cuerpo"
        if (!rutaRelativa) return '';
        const base = rutaRelativa.split('/').pop().replace(/\.(md|json)$/i, '');
        const limpio = base.replace(/^(med|ref|ep|mazo)_?\d*_?/i, '').replace(/_/g, ' ').trim();
        if (!limpio) return base.replace(/_/g, ' ');
        return limpio.charAt(0).toUpperCase() + limpio.slice(1);
    }

    function programaIconoTipo(tipo) {
        return {
            meditaciones: '🧘',
            ejercicios: '🌿',
            flashcards: '🗂️',
            'podcast-guiones': '🎧',
            podcasts: '🎧',
            reflexiones: '🪞'
        }[tipo] || '📄';
    }

    function programaTipoEtiqueta(tipo) {
        return {
            meditaciones: 'Meditación',
            ejercicios: 'Ejercicio',
            flashcards: 'Flashcards',
            'podcast-guiones': 'Podcast',
            podcasts: 'Podcast',
            reflexiones: 'Reflexión'
        }[tipo] || tipo;
    }

    function programaAbrirItem(rutaRelativa) {
        if (!rutaRelativa) return;
        const tipo = programaItemTipo(rutaRelativa);
        const titulo = programaNombreLegible(rutaRelativa);
        if (tipo === 'flashcards') {
            openFlashcardsModal(programaPathRelativo(rutaRelativa), titulo);
        } else if (tipo === 'podcast-guiones' || tipo === 'podcasts') {
            // FASE 2: si INDEX.json lista el podcast como objeto con audio_url
            // ofrecer reproductor MP3; si es string suelto, fallback a TTS.
            const audioUrl = programaBuscarAudioUrl(rutaRelativa);
            openMarkdownModal(programaPathRelativo(rutaRelativa), titulo, {
                esPodcast: true,
                audioUrl: audioUrl
            });
        } else {
            openMarkdownModal(programaPathRelativo(rutaRelativa), titulo);
        }
    }

    function programaBuscarAudioUrl(rutaRelativa) {
        if (!programaIndex || !programaIndex.contenidos) return null;
        const podcasts = programaIndex.contenidos.podcasts || [];
        for (const p of podcasts) {
            if (typeof p === 'object' && p) {
                const ruta = p.guion || p.ruta;
                if (ruta && (ruta === rutaRelativa || rutaRelativa.endsWith(ruta) || ruta.endsWith(rutaRelativa.split('/').pop()))) {
                    return p.audio_url || null;
                }
            }
        }
        return null;
    }

    async function renderPrograma() {
        const panel = document.getElementById('programa-activo');
        const bibSection = document.getElementById('biblioteca-section');
        const crisisBtn = document.getElementById('protocolo-crisis-btn');
        const herramientasSection = document.querySelector('#screen-programa .herramientas-section');
        if (!panel) return;

        // FASE 2: vista de seleccion de programas.
        if (programaVista === 'lista') {
            await renderListaProgramas(panel, bibSection, crisisBtn, herramientasSection);
            return;
        }

        const idx = await ensureProgramaIndex();

        if (!idx) {
            panel.innerHTML =
                '<div class="programa-toolbar">' +
                '  <button class="programa-volver-btn" id="programa-volver-btn" aria-label="Volver a la lista de programas">← Volver a la lista</button>' +
                '</div>' +
                '<div class="empty-state">' +
                '<div class="empty-icon">📦</div>' +
                '<p>No hay programa terapéutico activo todavía.</p>' +
                '<p class="empty-sub">Cuando se asigne un supuesto clínico, aparecerá aquí su plan semanal.</p>' +
                '</div>';
            const volverBtn = document.getElementById('programa-volver-btn');
            if (volverBtn) volverBtn.addEventListener('click', programaVolverALista);
            if (bibSection) bibSection.hidden = true;
            if (crisisBtn) crisisBtn.classList.add('hidden');
            if (herramientasSection) herramientasSection.hidden = false;
            return;
        }
        if (herramientasSection) herramientasSection.hidden = false;

        // Bloque protocolo crisis (visible si existe ruta).
        if (crisisBtn) {
            if (idx.protocolo_crisis) {
                crisisBtn.classList.remove('hidden');
                crisisBtn.onclick = () => programaAbrirItem(idx.protocolo_crisis);
            } else {
                crisisBtn.classList.add('hidden');
                crisisBtn.onclick = null;
            }
        }

        // Día actual (los nombres en JSON: lunes..domingo sin tilde para miercoles/sabado).
        const hoyIdx = new Date().getDay(); // 0=domingo
        const claveHoy = PROGRAMA_DIAS[hoyIdx];
        const itemsHoy = (idx.semana_recomendada && idx.semana_recomendada[claveHoy]) || [];

        const titulo = escapeHtml(idx.titulo || 'Programa activo');
        const generado = escapeHtml(idx.generado || '');
        const hoyEtiqueta = claveHoy.charAt(0).toUpperCase() + claveHoy.slice(1);

        let itemsHtml;
        if (itemsHoy.length === 0) {
            itemsHtml = '<p class="programa-vacio">No hay práctica recomendada para ' +
                        escapeHtml(hoyEtiqueta) + '. Explora la biblioteca para elegir tu sesión.</p>';
        } else {
            itemsHtml = '<ul class="programa-items">' + itemsHoy.map(ruta => {
                const tipo = programaItemTipo(ruta);
                const icono = programaIconoTipo(tipo);
                const etiquetaTipo = programaTipoEtiqueta(tipo);
                const nombre = programaNombreLegible(ruta);
                const accion = (tipo === 'flashcards') ? 'Abrir mazo' : 'Abrir';
                return '<li class="programa-item">' +
                       '  <button class="programa-item-btn" data-ruta="' + escapeHtml(ruta) + '"' +
                       '          aria-label="' + escapeHtml(accion + ': ' + nombre) + '">' +
                       '    <span class="prog-item-icono" aria-hidden="true">' + icono + '</span>' +
                       '    <span class="prog-item-cuerpo">' +
                       '      <span class="prog-item-tipo">' + escapeHtml(etiquetaTipo) + '</span>' +
                       '      <span class="prog-item-nombre">' + escapeHtml(nombre) + '</span>' +
                       '    </span>' +
                       '    <span class="prog-item-flecha" aria-hidden="true">→</span>' +
                       '  </button>' +
                       '</li>';
            }).join('') + '</ul>';
        }

        panel.innerHTML =
            '<div class="programa-toolbar">' +
            '  <button class="programa-volver-btn" id="programa-volver-btn" aria-label="Volver a la lista de programas">← Volver a la lista</button>' +
            '</div>' +
            '<div class="programa-cab">' +
            '  <span class="programa-cab-eyebrow">Hoy · ' + escapeHtml(hoyEtiqueta) + '</span>' +
            '  <h3 class="programa-cab-titulo">' + titulo + '</h3>' +
            (generado ? '  <small class="programa-cab-fecha">Plan generado: ' + generado + '</small>' : '') +
            '</div>' +
            itemsHtml;

        const volverBtn = document.getElementById('programa-volver-btn');
        if (volverBtn) volverBtn.addEventListener('click', programaVolverALista);

        panel.querySelectorAll('.programa-item-btn').forEach(btn => {
            btn.addEventListener('click', () => programaAbrirItem(btn.dataset.ruta));
        });

        if (bibSection) bibSection.hidden = false;
        renderBiblioteca(bibliotecaTab);
    }

    // FASE 2: vista de lista de programas (selecciOn de supuesto).
    async function renderListaProgramas(panel, bibSection, crisisBtn, herramientasSection) {
        if (bibSection) bibSection.hidden = true;
        if (crisisBtn) crisisBtn.classList.add('hidden');
        if (herramientasSection) herramientasSection.hidden = true;

        panel.innerHTML =
            '<div class="programa-cab">' +
            '  <span class="programa-cab-eyebrow">Programas terapéuticos</span>' +
            '  <h3 class="programa-cab-titulo">Tus programas activos</h3>' +
            '  <small class="programa-cab-fecha">Selecciona un programa o crea uno nuevo adaptado a tu situación.</small>' +
            '</div>' +
            '<div id="programa-lista-cards" class="programa-lista-cards">' +
            '  <p class="empty-sub">Cargando programas…</p>' +
            '</div>';

        const cont = document.getElementById('programa-lista-cards');

        // FIX-4: try/catch global con error visible + boton reintentar.
        let manifest, slugs, locales, todos, metas;
        try {
            manifest = await ensureProgramaManifest();
            slugs = (manifest && manifest.programas) || [];
            locales = leerProgramasLocales();
            todos = Array.from(new Set([].concat(slugs, locales.map(p => p.slug))));
            metas = await Promise.all(todos.map(slug => cargarMetadataPrograma(slug)));
        } catch (e) {
            cont.innerHTML =
                '<div class="empty-state">' +
                '  <div class="empty-icon">⚠</div>' +
                '  <p>No se pudo cargar la lista de programas.</p>' +
                '  <p class="empty-sub">Error: ' + escapeHtml(String(e && e.message ? e.message : e)) + '</p>' +
                '  <button id="prog-lista-reintentar" class="btn-secondary" style="margin-top:1rem">Reintentar</button>' +
                '</div>';
            const r = document.getElementById('prog-lista-reintentar');
            if (r) r.addEventListener('click', () => { programaManifest = null; programaManifestCargando = null; renderPrograma(); });
            return;
        }

        cont.innerHTML = '';
        let mostrados = 0;
        todos.forEach((slug, i) => {
            let meta = metas[i];
            if (!meta) {
                const local = locales.find(p => p.slug === slug);
                if (local) meta = local;
            }
            if (!meta) return;
            mostrados++;
            const titulo = meta.titulo || slug;
            const subtitulo = meta.subtitulo || (meta.titulo_largo || '');
            const icono = meta.icono || '📦';
            const fecha = meta.fecha_inicio || meta.fecha || '';
            const numModulos = (meta.modulos && meta.modulos.length) || 0;
            const local = locales.some(p => p.slug === slug);

            const card = document.createElement('article');
            card.className = 'programa-card-item' + (local ? ' programa-local' : '');
            card.innerHTML =
                '<div class="prog-card-icono" aria-hidden="true">' + icono + '</div>' +
                '<div class="prog-card-body">' +
                '  <h4 class="prog-card-titulo">' + escapeHtml(titulo) + '</h4>' +
                (subtitulo ? '  <p class="prog-card-sub">' + escapeHtml(subtitulo) + '</p>' : '') +
                '  <p class="prog-card-meta">' +
                (fecha ? 'Iniciado: ' + escapeHtml(fecha) + ' · ' : '') +
                numModulos + ' módulos' +
                (local ? ' · <span class="prog-local-badge">Borrador local</span>' : '') +
                '  </p>' +
                '</div>' +
                '<button class="prog-card-btn btn-secondary" data-slug="' + escapeHtml(slug) + '"' +
                (local ? ' disabled aria-label="Programa local pendiente de generar contenido"' : ' aria-label="Abrir programa ' + escapeHtml(titulo) + '"') + '>' +
                (local ? 'Pendiente generar' : 'Abrir →') +
                '</button>';
            cont.appendChild(card);
        });

        if (mostrados === 0) {
            cont.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div>' +
                '<p>No hay programas configurados todavía.</p>' +
                '<p class="empty-sub">Pulsa el botón de abajo para crear el primero.</p></div>';
        }

        // Card "Crear nuevo programa".
        const nueva = document.createElement('button');
        nueva.type = 'button';
        nueva.className = 'programa-card-nuevo';
        nueva.setAttribute('aria-label', 'Crear nuevo programa con el asistente');
        nueva.innerHTML = '<span class="prog-nuevo-icono" aria-hidden="true">➕</span>' +
                          '<span class="prog-nuevo-text">Crear nuevo programa</span>';
        nueva.addEventListener('click', abrirWizardPrograma);
        cont.appendChild(nueva);

        // Bind click en cada card que NO sea local.
        cont.querySelectorAll('.prog-card-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                programaSeleccionar(btn.dataset.slug);
            });
        });
    }

    function leerProgramasLocales() {
        try {
            const raw = localStorage.getItem('cpva_programas_locales');
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (_) { return []; }
    }

    function guardarProgramaLocal(programa) {
        const list = leerProgramasLocales();
        const idx = list.findIndex(p => p.slug === programa.slug);
        if (idx >= 0) list[idx] = programa;
        else list.push(programa);
        localStorage.setItem('cpva_programas_locales', JSON.stringify(list));
    }

    // ============================================================
    // WIZARD ALTA NUEVO PROGRAMA (FASE 2 - Bloque 5)
    // ============================================================
    const WIZARD_PASOS = 5;
    let wizardData = {};
    let wizardPasoActual = 1;

    const WIZARD_EMOCIONES = ['Ira', 'Tristeza', 'Vergüenza', 'Miedo', 'Humillación',
                              'Traición', 'Culpa', 'Impotencia', 'Ansiedad', 'Duelo'];
    const WIZARD_DIMENSIONES = ['Cognitiva (pensamientos)', 'Emocional (sentimientos)',
                                'Corporal (cuerpo, tensión)', 'Relacional (vínculos)',
                                'Existencial (sentido)', 'Espiritual (fe, trascendencia)'];
    const WIZARD_CARACTERISTICAS = ['TOC / tendencia obsesiva', 'Ansiedad generalizada',
                                    'Depresión', 'Trauma / TEPT', 'Ninguna especial'];
    const WIZARD_PRACTICAS = ['Meditación', 'Movimiento/yoga', 'Escritura', 'Lectura',
                              'Ejercicios guiados', 'Escuchar audios'];

    function abrirWizardPrograma() {
        wizardData = {
            situacion: '', duracion_valor: '', duracion_unidad: 'meses', activa: 'Activa',
            emociones: [], emocion_mas_intensa: '', intensidad: 5,
            dimensiones: [], caracteristicas: [],
            tiempo_diario: '15-20 min', practicas: [], espiritual: 'No especialmente'
        };
        wizardPasoActual = 1;
        renderWizardModal();
    }

    function renderWizardModal() {
        let modal = document.getElementById('wizard-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wizard-modal';
            modal.className = 'overlay';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'wizard-modal-title');
            modal.innerHTML =
                '<div class="overlay-content wizard-modal-content">' +
                '  <button class="close-overlay" id="wizard-modal-close" aria-label="Cerrar asistente">×</button>' +
                '  <h2 id="wizard-modal-title">Crear nuevo programa</h2>' +
                '  <div class="wizard-progress" id="wizard-progress" aria-live="polite"></div>' +
                '  <div class="wizard-body" id="wizard-body"></div>' +
                '  <div class="wizard-nav">' +
                '    <button class="btn-secondary" id="wizard-prev">← Anterior</button>' +
                '    <button class="btn-primary" id="wizard-next">Siguiente →</button>' +
                '  </div>' +
                '</div>';
            document.body.appendChild(modal);
            document.getElementById('wizard-modal-close').addEventListener('click', cerrarWizard);
            document.getElementById('wizard-prev').addEventListener('click', wizardAnterior);
            document.getElementById('wizard-next').addEventListener('click', wizardSiguiente);
            modal.addEventListener('click', (e) => { if (e.target === modal) cerrarWizard(); });
        }
        modal.classList.add('active');
        renderWizardPaso();
    }

    function cerrarWizard() {
        const modal = document.getElementById('wizard-modal');
        if (modal) modal.classList.remove('active');
    }

    function renderWizardPaso() {
        const progress = document.getElementById('wizard-progress');
        if (progress) {
            progress.innerHTML = 'Paso <strong>' + wizardPasoActual + '</strong> de ' + WIZARD_PASOS;
        }
        const body = document.getElementById('wizard-body');
        if (!body) return;
        const renderers = {
            1: renderWizardPaso1, 2: renderWizardPaso2, 3: renderWizardPaso3,
            4: renderWizardPaso4, 5: renderWizardPaso5
        };
        renderers[wizardPasoActual](body);

        const prev = document.getElementById('wizard-prev');
        const next = document.getElementById('wizard-next');
        if (prev) prev.disabled = wizardPasoActual === 1;
        if (next) next.textContent = wizardPasoActual === WIZARD_PASOS ? '✨ Generar programa' : 'Siguiente →';
    }

    function renderWizardPaso1(body) {
        body.innerHTML =
            '<h3>1. Situación</h3>' +
            '<label class="wiz-label">¿Cuál es la situación que quieres trabajar? Descríbela con tus palabras, sin filtros.</label>' +
            '<textarea id="wiz-situacion" class="wiz-textarea" rows="5" ' +
            'placeholder="Llevo meses con una situación que...">' + escapeHtml(wizardData.situacion || '') + '</textarea>' +
            '<div class="wiz-row">' +
            '  <label class="wiz-label-inline">¿Cuánto tiempo llevas con esto?</label>' +
            '  <input id="wiz-duracion-val" type="number" min="1" value="' + escapeHtml(String(wizardData.duracion_valor || 1)) + '" class="wiz-input-num">' +
            '  <select id="wiz-duracion-uni" class="wiz-select">' +
            ['días', 'semanas', 'meses', 'años'].map(u =>
                '<option value="' + u + '"' + (wizardData.duracion_unidad === u ? ' selected' : '') + '>' + u + '</option>'
            ).join('') +
            '  </select>' +
            '</div>' +
            '<div class="wiz-row">' +
            '  <label class="wiz-label-inline">¿Es una situación...</label>' +
            ['Activa', 'Cerrada pero no procesada'].map(s =>
                '  <label class="wiz-radio"><input type="radio" name="wiz-activa" value="' + s + '"' +
                (wizardData.activa === s ? ' checked' : '') + '> ' + s + '</label>'
            ).join('') +
            '</div>';
    }

    function renderWizardPaso2(body) {
        body.innerHTML =
            '<h3>2. Emociones principales</h3>' +
            '<label class="wiz-label">Selecciona todas las que correspondan:</label>' +
            '<div class="wiz-chips" id="wiz-emociones">' +
            WIZARD_EMOCIONES.map(e => {
                const sel = (wizardData.emociones || []).includes(e);
                return '<button type="button" class="wiz-chip' + (sel ? ' wiz-chip-sel' : '') +
                       '" data-val="' + escapeHtml(e) + '">' + escapeHtml(e) + '</button>';
            }).join('') +
            '</div>' +
            '<div class="wiz-row">' +
            '  <label class="wiz-label-inline">¿Cuál es la más intensa ahora mismo?</label>' +
            '  <select id="wiz-emoc-intensa" class="wiz-select"></select>' +
            '</div>' +
            '<div class="wiz-row">' +
            '  <label class="wiz-label-inline">Del 1 al 10, ¿cómo de intenso es el malestar?</label>' +
            '  <input id="wiz-intensidad" type="range" min="1" max="10" value="' +
            escapeHtml(String(wizardData.intensidad || 5)) + '" class="wiz-slider">' +
            '  <span id="wiz-intensidad-val" class="wiz-slider-val">' + escapeHtml(String(wizardData.intensidad || 5)) + '/10</span>' +
            '</div>';

        actualizarWizSelEmocionMasIntensa();

        body.querySelectorAll('.wiz-chip').forEach(c => {
            c.addEventListener('click', () => {
                const val = c.dataset.val;
                wizardData.emociones = wizardData.emociones || [];
                const i = wizardData.emociones.indexOf(val);
                if (i >= 0) wizardData.emociones.splice(i, 1);
                else wizardData.emociones.push(val);
                c.classList.toggle('wiz-chip-sel');
                actualizarWizSelEmocionMasIntensa();
            });
        });

        const slider = document.getElementById('wiz-intensidad');
        const sliderVal = document.getElementById('wiz-intensidad-val');
        if (slider) slider.addEventListener('input', () => {
            wizardData.intensidad = parseInt(slider.value, 10);
            if (sliderVal) sliderVal.textContent = wizardData.intensidad + '/10';
        });
    }

    function actualizarWizSelEmocionMasIntensa() {
        const sel = document.getElementById('wiz-emoc-intensa');
        if (!sel) return;
        sel.innerHTML = '<option value="">(selecciona)</option>' +
            (wizardData.emociones || []).map(e =>
                '<option value="' + escapeHtml(e) + '"' +
                (wizardData.emocion_mas_intensa === e ? ' selected' : '') + '>' + escapeHtml(e) + '</option>'
            ).join('');
        sel.onchange = () => { wizardData.emocion_mas_intensa = sel.value; };
    }

    function renderWizardPaso3(body) {
        body.innerHTML =
            '<h3>3. Área de trabajo</h3>' +
            '<label class="wiz-label">¿Qué dimensiones quieres trabajar?</label>' +
            '<div class="wiz-chips" id="wiz-dimensiones">' +
            WIZARD_DIMENSIONES.map(d => {
                const sel = (wizardData.dimensiones || []).includes(d);
                return '<button type="button" class="wiz-chip' + (sel ? ' wiz-chip-sel' : '') +
                       '" data-val="' + escapeHtml(d) + '">' + escapeHtml(d) + '</button>';
            }).join('') +
            '</div>' +
            '<label class="wiz-label">¿Tienes alguna característica psicológica relevante?</label>' +
            '<div class="wiz-chips" id="wiz-caracteristicas">' +
            WIZARD_CARACTERISTICAS.map(c => {
                const sel = (wizardData.caracteristicas || []).includes(c);
                return '<button type="button" class="wiz-chip' + (sel ? ' wiz-chip-sel' : '') +
                       '" data-val="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
            }).join('') +
            '</div>';

        body.querySelectorAll('#wiz-dimensiones .wiz-chip').forEach(c => {
            c.addEventListener('click', () => toggleChip(c, 'dimensiones'));
        });
        body.querySelectorAll('#wiz-caracteristicas .wiz-chip').forEach(c => {
            c.addEventListener('click', () => toggleChip(c, 'caracteristicas'));
        });
    }

    function toggleChip(chip, campo) {
        const val = chip.dataset.val;
        wizardData[campo] = wizardData[campo] || [];
        const i = wizardData[campo].indexOf(val);
        if (i >= 0) wizardData[campo].splice(i, 1);
        else wizardData[campo].push(val);
        chip.classList.toggle('wiz-chip-sel');
    }

    function renderWizardPaso4(body) {
        body.innerHTML =
            '<h3>4. Recursos disponibles</h3>' +
            '<div class="wiz-row">' +
            '  <label class="wiz-label-inline">¿Cuánto tiempo tienes al día para el programa?</label>' +
            '  <select id="wiz-tiempo" class="wiz-select">' +
            ['5-10 min', '15-20 min', '30+ min'].map(t =>
                '<option value="' + t + '"' + (wizardData.tiempo_diario === t ? ' selected' : '') + '>' + t + '</option>'
            ).join('') +
            '  </select>' +
            '</div>' +
            '<label class="wiz-label">¿Qué tipo de práctica prefieres?</label>' +
            '<div class="wiz-chips" id="wiz-practicas">' +
            WIZARD_PRACTICAS.map(p => {
                const sel = (wizardData.practicas || []).includes(p);
                return '<button type="button" class="wiz-chip' + (sel ? ' wiz-chip-sel' : '') +
                       '" data-val="' + escapeHtml(p) + '">' + escapeHtml(p) + '</button>';
            }).join('') +
            '</div>' +
            '<div class="wiz-row">' +
            '  <label class="wiz-label-inline">¿Hay una dimensión espiritual o religiosa relevante para ti?</label>' +
            '  <select id="wiz-espiritual" class="wiz-select">' +
            ['Sí, cristiana', 'Sí, otra', 'No especialmente'].map(e =>
                '<option value="' + e + '"' + (wizardData.espiritual === e ? ' selected' : '') + '>' + e + '</option>'
            ).join('') +
            '  </select>' +
            '</div>';

        body.querySelectorAll('#wiz-practicas .wiz-chip').forEach(c => {
            c.addEventListener('click', () => toggleChip(c, 'practicas'));
        });
    }

    function renderWizardPaso5(body) {
        // Capturar valores del paso 4 si el usuario ya estaba aqui antes.
        capturarValoresPasoActual();
        const modulos = calcularModulos(wizardData);
        const slug = wizardSlugFromSituacion(wizardData.situacion);
        body.innerHTML =
            '<h3>5. Revisión y generación</h3>' +
            '<div class="wiz-resumen">' +
            '<p><strong>Situación:</strong> ' + escapeHtml((wizardData.situacion || '').substring(0, 200)) + ((wizardData.situacion || '').length > 200 ? '…' : '') + '</p>' +
            '<p><strong>Duración:</strong> ' + escapeHtml(String(wizardData.duracion_valor) + ' ' + wizardData.duracion_unidad) + ' · ' + escapeHtml(wizardData.activa) + '</p>' +
            '<p><strong>Emociones:</strong> ' + escapeHtml((wizardData.emociones || []).join(', ') || '(ninguna)') + '</p>' +
            '<p><strong>Más intensa:</strong> ' + escapeHtml(wizardData.emocion_mas_intensa || '-') + ' (' + wizardData.intensidad + '/10)</p>' +
            '<p><strong>Dimensiones:</strong> ' + escapeHtml((wizardData.dimensiones || []).join(', ') || '(ninguna)') + '</p>' +
            '<p><strong>Características:</strong> ' + escapeHtml((wizardData.caracteristicas || []).join(', ') || '(ninguna)') + '</p>' +
            '<p><strong>Tiempo diario:</strong> ' + escapeHtml(wizardData.tiempo_diario) + '</p>' +
            '<p><strong>Prácticas preferidas:</strong> ' + escapeHtml((wizardData.practicas || []).join(', ') || '(ninguna)') + '</p>' +
            '<p><strong>Espiritual:</strong> ' + escapeHtml(wizardData.espiritual) + '</p>' +
            '<hr>' +
            '<p><strong>Slug del programa:</strong> <code>' + escapeHtml(slug) + '</code></p>' +
            '<p><strong>Módulos a generar (' + modulos.length + '):</strong> ' + escapeHtml(modulos.join(', ')) + '</p>' +
            '<p class="wiz-nota">Al pulsar "Generar programa" se creará un borrador local + un prompt completo para Claude Code que generará todos los archivos de contenido.</p>' +
            '</div>';
    }

    function wizardAnterior() {
        capturarValoresPasoActual();
        if (wizardPasoActual > 1) wizardPasoActual--;
        renderWizardPaso();
    }

    function wizardSiguiente() {
        capturarValoresPasoActual();
        if (wizardPasoActual < WIZARD_PASOS) {
            wizardPasoActual++;
            renderWizardPaso();
        } else {
            generarProgramaDesdeWizard();
        }
    }

    function capturarValoresPasoActual() {
        if (wizardPasoActual === 1) {
            const s = document.getElementById('wiz-situacion');
            const dv = document.getElementById('wiz-duracion-val');
            const du = document.getElementById('wiz-duracion-uni');
            const activa = document.querySelector('input[name="wiz-activa"]:checked');
            if (s) wizardData.situacion = s.value;
            if (dv) wizardData.duracion_valor = dv.value;
            if (du) wizardData.duracion_unidad = du.value;
            if (activa) wizardData.activa = activa.value;
        } else if (wizardPasoActual === 4) {
            const t = document.getElementById('wiz-tiempo');
            const e = document.getElementById('wiz-espiritual');
            if (t) wizardData.tiempo_diario = t.value;
            if (e) wizardData.espiritual = e.value;
        }
    }

    function calcularModulos(datos) {
        const modulos = ['regulacion_emocional'];
        const em = datos.emociones || [];
        const dim = datos.dimensiones || [];
        const car = datos.caracteristicas || [];
        if (em.includes('Ira')) modulos.push('ira_regulacion');
        if (em.includes('Vergüenza') || em.includes('Humillación')) modulos.push('autocompasion');
        if (em.includes('Tristeza') || em.includes('Duelo')) modulos.push('duelo_tristeza');
        if (em.includes('Miedo') || em.includes('Ansiedad')) modulos.push('manejo_ansiedad');
        if (em.includes('Culpa')) modulos.push('culpa_perdon');
        if (car.includes('TOC / tendencia obsesiva')) modulos.push('toc_defusion');
        if (car.includes('Trauma / TEPT')) modulos.push('trauma_emdr');
        if (dim.some(d => d.startsWith('Corporal'))) modulos.push('regulacion_somatica');
        if (dim.some(d => d.startsWith('Existencial'))) modulos.push('logoterapia');
        if (dim.some(d => d.startsWith('Espiritual')) && datos.espiritual === 'Sí, cristiana') {
            modulos.push('espiritualidad_cristiana');
        }
        if (datos.tiempo_diario === '5-10 min' || (datos.intensidad || 0) >= 8) {
            modulos.push('protocolo_crisis');
        }
        return Array.from(new Set(modulos));
    }

    function wizardSlugFromSituacion(s) {
        const limpio = String(s || '').toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 40);
        return 'caso-' + (limpio || ('nuevo-' + Date.now()));
    }

    function generarProgramaDesdeWizard() {
        const modulos = calcularModulos(wizardData);
        const slug = wizardSlugFromSituacion(wizardData.situacion);
        const fecha = new Date().toISOString().substring(0, 10);
        const titulo = capitalizarPrimera(wizardData.situacion.substring(0, 60));

        // Guardar borrador local.
        const borrador = {
            slug: slug,
            titulo: titulo || 'Programa nuevo',
            subtitulo: (wizardData.emociones || []).slice(0, 3).join(' · '),
            icono: '✨',
            fecha_inicio: fecha,
            modulos: modulos.map(id => ({ id: id, nombre: id.replace(/_/g, ' ') })),
            wizard_data: wizardData,
            estado: 'borrador'
        };
        guardarProgramaLocal(borrador);

        const prompt = construirPromptClaudeCode(slug, titulo, modulos, wizardData);
        mostrarPromptParaCopiar(slug, prompt);
    }

    function capitalizarPrimera(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function construirPromptClaudeCode(slug, titulo, modulos, datos) {
        const fechaHoy = new Date().toISOString().substring(0, 10);
        const lines = [];
        lines.push('# NUEVA MISION CLAUDE CODE - PROGRAMA: ' + (titulo || slug));
        lines.push('## Generado por asistente de alta APP-002 el ' + fechaHoy);
        lines.push('');
        lines.push('## CONTEXTO DEL CASO');
        lines.push('- **Situacion:** ' + (datos.situacion || '(sin descripcion)'));
        lines.push('- **Duracion:** ' + (datos.duracion_valor || '?') + ' ' + (datos.duracion_unidad || ''));
        lines.push('- **Estado:** ' + (datos.activa || '?'));
        lines.push('- **Emociones presentes:** ' + ((datos.emociones || []).join(', ') || '(ninguna)'));
        lines.push('- **Emocion mas intensa:** ' + (datos.emocion_mas_intensa || '-') + ' (' + datos.intensidad + '/10)');
        lines.push('- **Dimensiones:** ' + ((datos.dimensiones || []).join(', ') || '(ninguna)'));
        lines.push('- **Caracteristicas:** ' + ((datos.caracteristicas || []).join(', ') || '(ninguna)'));
        lines.push('- **Tiempo diario disponible:** ' + (datos.tiempo_diario || '?'));
        lines.push('- **Practicas preferidas:** ' + ((datos.practicas || []).join(', ') || '(ninguna)'));
        lines.push('- **Dimension espiritual:** ' + (datos.espiritual || '?'));
        lines.push('');
        lines.push('## RUTA DESTINO');
        lines.push('`E:\\Automatizaciones\\app002-psicologico\\supuestos\\' + slug + '\\`');
        lines.push('');
        lines.push('## MODULOS A GENERAR (' + modulos.length + ')');
        modulos.forEach((m, i) => lines.push((i + 1) + '. ' + m));
        lines.push('');
        lines.push('## ESTRUCTURA OBLIGATORIA');
        lines.push('Seguir el mismo formato que `supuestos\\caso-invernadero\\`:');
        lines.push('- `metadata.json` (id, titulo, subtitulo, icono, fecha_inicio, modulos, cuadernos_activos)');
        lines.push('- `INDEX.json` (titulo, generado, contenidos, semana_recomendada L-D, protocolo_crisis)');
        lines.push('- `flashcards/` (3 mazos JSON con tarjetas frente/reverso)');
        lines.push('- `meditaciones/` (5 guiones MD: ira/observar/compasion/soltar/crisis)');
        lines.push('- `ejercicios/` (5 protocolos: coherencia cardiaca, EMDR, focusing, yoga, crisis)');
        lines.push('- `podcast-guiones/` (5 guiones MD 700-1000 palabras cada uno)');
        lines.push('- `reflexiones/` (1 articulo MD 600-900 palabras por modulo, con 3 preguntas finales)');
        lines.push('');
        lines.push('## PASOS FINALES');
        lines.push('1. Generar todos los archivos en la ruta destino.');
        lines.push('2. Actualizar `supuestos\\_manifest.json` anadiendo `"' + slug + '"` a la lista `programas`.');
        lines.push('3. Bumpear cache-buster en `index.html` (?v=N+1).');
        lines.push('4. Documentar en TRASPASO_MAESTRO + HISTORIAL_DECISIONES de APP-002.');
        lines.push('5. Avisar a Luis: `cd E:\\Automatizaciones\\app002-psicologico ; firebase deploy --only hosting`.');
        return lines.join('\n');
    }

    function mostrarPromptParaCopiar(slug, prompt) {
        const body = document.getElementById('wizard-body');
        if (!body) return;
        body.innerHTML =
            '<h3>✅ Programa "' + escapeHtml(slug) + '" registrado como borrador</h3>' +
            '<p class="wiz-nota">Se ha guardado un borrador local. Para generar todos los archivos de contenido, copia el prompt de abajo y pegalo en una sesion de Claude Code.</p>' +
            '<div class="wiz-prompt-actions">' +
            '  <button class="btn-primary" id="wiz-copy-prompt">📋 Copiar prompt para Claude Code</button>' +
            '  <button class="btn-secondary" id="wiz-cerrar-final">Cerrar</button>' +
            '</div>' +
            '<textarea id="wiz-prompt-text" class="wiz-prompt-text" readonly rows="20">' + escapeHtml(prompt) + '</textarea>' +
            '<p class="wiz-nota"><strong>Despues de generar el contenido en Claude Code:</strong> Luis hace `firebase deploy --only hosting` desde `E:\\Automatizaciones\\app002-psicologico\\`.</p>';

        const copyBtn = document.getElementById('wiz-copy-prompt');
        const closeBtn = document.getElementById('wiz-cerrar-final');
        const ta = document.getElementById('wiz-prompt-text');
        if (copyBtn) copyBtn.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(prompt);
                } else {
                    ta.select();
                    document.execCommand('copy');
                }
                copyBtn.textContent = '✅ Copiado al portapapeles';
                setTimeout(() => { copyBtn.textContent = '📋 Copiar prompt para Claude Code'; }, 3000);
            } catch (e) {
                copyBtn.textContent = '⚠ No se pudo copiar - selecciona manualmente';
            }
        });
        if (closeBtn) closeBtn.addEventListener('click', () => {
            cerrarWizard();
            programaVolverALista();
        });
    }

    function renderBiblioteca(tab) {
        bibliotecaTab = tab || 'meditaciones';
        const cont = document.getElementById('biblioteca-content');
        if (!cont) return;
        if (!programaIndex || !programaIndex.contenidos) {
            cont.innerHTML = '<div class="empty-state empty-state-inline">' +
                '<p class="empty-sub">Sin contenidos disponibles.</p></div>';
            return;
        }

        // Mapeo tab UI -> clave en INDEX.contenidos
        const mapaKeys = {
            meditaciones: 'meditaciones',
            ejercicios:   'ejercicios',
            flashcards:   'flashcards',
            podcasts:     'podcasts',
            reflexiones:  'reflexiones'
        };
        // Mapeo a subcarpeta real
        const mapaSubcarpetas = {
            meditaciones: 'meditaciones',
            ejercicios:   'ejercicios',
            flashcards:   'flashcards',
            podcasts:     'podcast-guiones',
            reflexiones:  'reflexiones'
        };

        const clave = mapaKeys[bibliotecaTab];
        const subcarpeta = mapaSubcarpetas[bibliotecaTab];
        const items = programaIndex.contenidos[clave];
        if (!Array.isArray(items) || items.length === 0) {
            cont.innerHTML = '<div class="empty-state empty-state-inline">' +
                '<p class="empty-sub">Sin elementos en esta categoría.</p></div>';
            return;
        }

        const icono = programaIconoTipo(subcarpeta);
        const etiquetaTipo = programaTipoEtiqueta(subcarpeta);
        const accion = (bibliotecaTab === 'flashcards') ? 'Abrir mazo' : 'Abrir';

        const grid = document.createElement('div');
        grid.className = 'biblioteca-grid';
        items.forEach(nombreArchivo => {
            const ruta = subcarpeta + '/' + nombreArchivo;
            const nombreLegible = programaNombreLegible(nombreArchivo);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'biblioteca-card';
            card.setAttribute('aria-label', accion + ': ' + nombreLegible);
            card.innerHTML =
                '<span class="bib-card-icono" aria-hidden="true">' + icono + '</span>' +
                '<span class="bib-card-cuerpo">' +
                '  <span class="bib-card-tipo">' + escapeHtml(etiquetaTipo) + '</span>' +
                '  <span class="bib-card-nombre">' + escapeHtml(nombreLegible) + '</span>' +
                '</span>';
            card.addEventListener('click', () => programaAbrirItem(ruta));
            grid.appendChild(card);
        });
        cont.innerHTML = '';
        cont.appendChild(grid);
    }

    document.querySelectorAll('.bib-tab').forEach(t => {
        t.addEventListener('click', () => {
            document.querySelectorAll('.bib-tab').forEach(x => {
                x.classList.remove('active');
                x.setAttribute('aria-selected', 'false');
            });
            t.classList.add('active');
            t.setAttribute('aria-selected', 'true');
            renderBiblioteca(t.dataset.bib);
        });
    });

    // --- Mini parser Markdown defensivo (sin librerías externas) ---
    // Soporta: # ## ### ####, párrafos, **bold**, *italic*, `code`,
    // listas - / 1., separador ---, blockquote >, links [t](u).
    function markdownToHtml(md) {
        if (!md) return '';
        // Normalizar saltos
        let texto = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lineas = texto.split('\n');
        const partes = [];
        let i = 0;

        function esc(s) {
            return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
        function inline(s) {
            // Escapar primero, luego aplicar marcado seguro.
            let t = esc(s);
            // Links [texto](url) — url limpia (sin <>)
            t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
                const safeUrl = url.replace(/[<>]/g, '');
                return '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>';
            });
            // Code inline
            t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
            // Bold **x**
            t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            // Italic *x* (no marcar si ya estaba dentro de **)
            t = t.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
            return t;
        }

        while (i < lineas.length) {
            const linea = lineas[i];
            const trim = linea.trim();

            // Separador
            if (/^---+$/.test(trim)) {
                partes.push('<hr/>');
                i++;
                continue;
            }
            // Headings
            const h = /^(#{1,4})\s+(.*)$/.exec(trim);
            if (h) {
                const lvl = h[1].length;
                partes.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>');
                i++;
                continue;
            }
            // Blockquote
            if (/^>\s?/.test(trim)) {
                const buf = [];
                while (i < lineas.length && /^>\s?/.test(lineas[i].trim())) {
                    buf.push(lineas[i].trim().replace(/^>\s?/, ''));
                    i++;
                }
                partes.push('<blockquote>' + inline(buf.join(' ')) + '</blockquote>');
                continue;
            }
            // Lista no ordenada
            if (/^[-*+]\s+/.test(trim)) {
                const items = [];
                while (i < lineas.length && /^[-*+]\s+/.test(lineas[i].trim())) {
                    items.push(lineas[i].trim().replace(/^[-*+]\s+/, ''));
                    i++;
                }
                partes.push('<ul>' + items.map(it => '<li>' + inline(it) + '</li>').join('') + '</ul>');
                continue;
            }
            // Lista ordenada
            if (/^\d+\.\s+/.test(trim)) {
                const items = [];
                while (i < lineas.length && /^\d+\.\s+/.test(lineas[i].trim())) {
                    items.push(lineas[i].trim().replace(/^\d+\.\s+/, ''));
                    i++;
                }
                partes.push('<ol>' + items.map(it => '<li>' + inline(it) + '</li>').join('') + '</ol>');
                continue;
            }
            // Línea vacía -> separador entre párrafos
            if (trim === '') {
                i++;
                continue;
            }
            // Párrafo: acumular líneas no vacías hasta encontrar vacío o estructura.
            const buf = [linea];
            i++;
            while (i < lineas.length) {
                const t2 = lineas[i].trim();
                if (t2 === '' || /^(#{1,4}\s|>|---+$|[-*+]\s|\d+\.\s)/.test(t2)) break;
                buf.push(lineas[i]);
                i++;
            }
            partes.push('<p>' + inline(buf.join(' ')) + '</p>');
        }
        return partes.join('\n');
    }

    // --- Modal Markdown ---
    const mdModal = document.getElementById('md-modal');
    const mdModalClose = document.getElementById('md-modal-close');
    const mdModalBody = document.getElementById('md-modal-body');
    const mdModalTitle = document.getElementById('md-modal-title');

    async function openMarkdownModal(path, titulo, opciones) {
        if (!mdModal || !mdModalBody) return;
        opciones = opciones || {};
        mdModalTitle.textContent = titulo || 'Documento';
        mdModalBody.innerHTML = '<p>Cargando…</p>';
        mdModal.classList.add('active');
        mdModalBody.scrollTop = 0;
        // Limpiar barra de herramientas previa.
        const previo = document.getElementById('md-modal-toolbar');
        if (previo) previo.remove();
        try {
            const resp = await fetch(path, { cache: 'no-cache' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const texto = await resp.text();
            // FASE 2: barra de herramientas con boton TTS + reproductor audio
            // opcional (podcasts con audio_url).
            const toolbar = document.createElement('div');
            toolbar.id = 'md-modal-toolbar';
            toolbar.className = 'md-modal-toolbar';
            toolbar.appendChild(crearBotonTTS(() => texto, 'btn-tts-md'));
            if (opciones.audioUrl) {
                const audioWrap = document.createElement('div');
                audioWrap.className = 'md-modal-audio';
                audioWrap.innerHTML =
                    '<div class="md-modal-audio-label">Audio real (NotebookLM)</div>' +
                    '<audio controls preload="none" src="' + escapeHtml(opciones.audioUrl) + '"></audio>';
                toolbar.appendChild(audioWrap);
            } else if (opciones.esPodcast) {
                const nota = document.createElement('div');
                nota.className = 'md-modal-audio-nota';
                nota.textContent = 'Audio MP3 no disponible aun. Usa "Escuchar" para voz sintetizada.';
                toolbar.appendChild(nota);
            }
            mdModalBody.parentNode.insertBefore(toolbar, mdModalBody);
            mdModalBody.innerHTML = markdownToHtml(texto);
            // Focus para lectura con NVDA.
            if (typeof mdModalBody.focus === 'function') mdModalBody.focus();
        } catch (e) {
            mdModalBody.innerHTML =
                '<p class="empty-sub">No se pudo cargar el documento.</p>' +
                '<p class="empty-sub"><small>' + escapeHtml(String(e && e.message ? e.message : e)) + '</small></p>';
        }
    }
    function closeMarkdownModal() {
        if (mdModal) mdModal.classList.remove('active');
        ttsStop();
        TTS.parar();
        // Parar audio del podcast si estaba sonando.
        const audio = mdModal && mdModal.querySelector('audio');
        if (audio) { try { audio.pause(); } catch (_) {} }
    }
    if (mdModalClose) mdModalClose.addEventListener('click', closeMarkdownModal);
    if (mdModal) mdModal.addEventListener('click', (e) => {
        if (e.target === mdModal) closeMarkdownModal();
    });

    // --- Modal Flashcards ---
    const fcModal = document.getElementById('fc-modal');
    const fcModalClose = document.getElementById('fc-modal-close');
    const fcModalTitle = document.getElementById('fc-modal-title');
    const fcCard = document.getElementById('fc-card');
    const fcFront = document.getElementById('fc-front-text');
    const fcBack = document.getElementById('fc-back-text');
    const fcPrev = document.getElementById('fc-prev');
    const fcNext = document.getElementById('fc-next');
    const fcCounter = document.getElementById('fc-counter');
    let fcDeck = [];
    let fcIndex = 0;

    function fcRender() {
        if (!fcCard) return;
        fcCard.classList.remove('flipped');
        // Limpiar botones TTS previos en flashcards.
        document.querySelectorAll('.fc-front .btn-tts-fc, .fc-back .btn-tts-fc').forEach(b => b.remove());
        if (fcDeck.length === 0) {
            fcFront.textContent = 'Mazo vacío';
            fcBack.textContent = '';
            fcCounter.textContent = '0/0';
            return;
        }
        const t = fcDeck[fcIndex];
        fcFront.textContent = t.frente || '(sin frente)';
        fcBack.textContent = t.reverso || '(sin reverso)';
        fcCounter.textContent = (fcIndex + 1) + '/' + fcDeck.length;
        if (fcPrev) fcPrev.disabled = fcIndex <= 0;
        if (fcNext) fcNext.disabled = fcIndex >= fcDeck.length - 1;
        // FASE 2: boton TTS por cada cara de la flashcard.
        const btnFront = crearBotonTTS(() => t.frente || '', 'btn-tts-fc');
        const btnBack = crearBotonTTS(() => t.reverso || '', 'btn-tts-fc');
        fcFront.appendChild(btnFront);
        fcBack.appendChild(btnBack);
    }

    async function openFlashcardsModal(path, titulo) {
        if (!fcModal) return;
        fcModalTitle.textContent = titulo || 'Mazo';
        fcFront.textContent = 'Cargando…';
        fcBack.textContent = '';
        fcCounter.textContent = '…';
        fcDeck = [];
        fcIndex = 0;
        fcModal.classList.add('active');
        try {
            const resp = await fetch(path, { cache: 'no-cache' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const json = await resp.json();
            if (json && Array.isArray(json.tarjetas)) {
                fcDeck = json.tarjetas;
                if (json.mazo) fcModalTitle.textContent = json.mazo;
            } else if (Array.isArray(json)) {
                fcDeck = json;
            }
            fcRender();
            if (fcCard && typeof fcCard.focus === 'function') fcCard.focus();
        } catch (e) {
            fcFront.textContent = 'No se pudo cargar el mazo';
            fcBack.textContent = String(e && e.message ? e.message : e);
            fcCounter.textContent = '0/0';
        }
    }
    function closeFlashcardsModal() {
        if (fcModal) fcModal.classList.remove('active');
    }
    if (fcModalClose) fcModalClose.addEventListener('click', closeFlashcardsModal);
    if (fcModal) fcModal.addEventListener('click', (e) => {
        if (e.target === fcModal) closeFlashcardsModal();
    });
    if (fcCard) {
        fcCard.addEventListener('click', () => fcCard.classList.toggle('flipped'));
        fcCard.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                fcCard.classList.toggle('flipped');
            }
        });
    }
    if (fcPrev) fcPrev.addEventListener('click', () => {
        if (fcIndex > 0) { fcIndex--; fcRender(); }
    });
    if (fcNext) fcNext.addEventListener('click', () => {
        if (fcIndex < fcDeck.length - 1) { fcIndex++; fcRender(); }
    });

    // Cierre con tecla Escape para ambos modales.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (mdModal && mdModal.classList.contains('active')) closeMarkdownModal();
        if (fcModal && fcModal.classList.contains('active')) closeFlashcardsModal();
    });

    // --- EMDR mini bilateral (autónomo del modo MOD-EMDR) ---
    // Velocidades en duración total (s) de un ida-y-vuelta.
    const EMDR_MINI_VEL = { slow: 3.6, medium: 2.4, fast: 1.4 };
    let emdrMiniState = {
        velocidad: 'medium',
        animando: false,
        pausado: false,
        rondas: 0,
        listenerColocado: false,
        startTs: 0,
        ultimaPos: 'left' // controla conteo de rondas
    };

    function emdrMiniAplicarVelocidad() {
        const dot = document.getElementById('emdr-mini-dot');
        if (!dot) return;
        dot.style.animationDuration = EMDR_MINI_VEL[emdrMiniState.velocidad] + 's';
    }

    function emdrMiniStart() {
        const dot = document.getElementById('emdr-mini-dot');
        if (!dot) return;
        emdrMiniAplicarVelocidad();
        dot.classList.add('animando');
        dot.classList.remove('pausado');
        emdrMiniState.animando = true;
        emdrMiniState.pausado = false;
        const btnStart = document.getElementById('emdr-mini-start');
        const btnPause = document.getElementById('emdr-mini-pause');
        const btnStop = document.getElementById('emdr-mini-stop');
        if (btnStart) btnStart.disabled = true;
        if (btnPause) { btnPause.disabled = false; btnPause.textContent = '⏸ Pausar'; }
        if (btnStop) btnStop.disabled = false;

        if (!emdrMiniState.listenerColocado) {
            // Cuenta una ronda cada vez que la animación completa un ciclo.
            dot.addEventListener('animationiteration', () => {
                if (!emdrMiniState.animando || emdrMiniState.pausado) return;
                emdrMiniState.rondas++;
                const el = document.getElementById('emdr-mini-rondas');
                if (el) el.textContent = emdrMiniState.rondas;
            });
            emdrMiniState.listenerColocado = true;
        }
    }
    function emdrMiniPause() {
        const dot = document.getElementById('emdr-mini-dot');
        if (!dot || !emdrMiniState.animando) return;
        emdrMiniState.pausado = !emdrMiniState.pausado;
        dot.classList.toggle('pausado', emdrMiniState.pausado);
        const btnPause = document.getElementById('emdr-mini-pause');
        if (btnPause) btnPause.textContent = emdrMiniState.pausado ? '▶ Reanudar' : '⏸ Pausar';
    }
    function emdrMiniStop() {
        const dot = document.getElementById('emdr-mini-dot');
        if (!dot) return;
        dot.classList.remove('animando', 'pausado');
        emdrMiniState.animando = false;
        emdrMiniState.pausado = false;
        const btnStart = document.getElementById('emdr-mini-start');
        const btnPause = document.getElementById('emdr-mini-pause');
        const btnStop = document.getElementById('emdr-mini-stop');
        if (btnStart) btnStart.disabled = false;
        if (btnPause) { btnPause.disabled = true; btnPause.textContent = '⏸ Pausar'; }
        if (btnStop) btnStop.disabled = true;
    }

    document.querySelectorAll('.emdr-vel-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('.emdr-vel-btn').forEach(x => {
                x.classList.remove('active');
                x.setAttribute('aria-pressed', 'false');
            });
            b.classList.add('active');
            b.setAttribute('aria-pressed', 'true');
            emdrMiniState.velocidad = b.dataset.vel || 'medium';
            emdrMiniAplicarVelocidad();
        });
    });
    const _emdrMiniStartBtn = document.getElementById('emdr-mini-start');
    const _emdrMiniPauseBtn = document.getElementById('emdr-mini-pause');
    const _emdrMiniStopBtn = document.getElementById('emdr-mini-stop');
    if (_emdrMiniStartBtn) _emdrMiniStartBtn.addEventListener('click', emdrMiniStart);
    if (_emdrMiniPauseBtn) _emdrMiniPauseBtn.addEventListener('click', emdrMiniPause);
    if (_emdrMiniStopBtn) _emdrMiniStopBtn.addEventListener('click', emdrMiniStop);

    // --- Respiración coherencia cardíaca ---
    // Ciclos de 10s: 5s inhalar, 5s exhalar. Texto cambia con setTimeout.
    let respCohState = {
        activo: false,
        ciclos: 0,
        timer: null,
        fase: null
    };

    function respCohActualizar(fase) {
        const circle = document.getElementById('resp-coh-circle');
        const text = document.getElementById('resp-coh-text');
        if (!circle || !text) return;
        respCohState.fase = fase;
        if (fase === 'inhalar') {
            circle.classList.remove('resp-exhale');
            circle.classList.add('resp-inhale');
            text.textContent = 'Inhala…';
        } else if (fase === 'exhalar') {
            circle.classList.remove('resp-inhale');
            circle.classList.add('resp-exhale');
            text.textContent = 'Exhala…';
        } else {
            circle.classList.remove('resp-inhale', 'resp-exhale');
            text.textContent = 'Listo';
        }
    }

    function respCohStart() {
        if (respCohState.activo) return;
        respCohState.activo = true;
        respCohState.ciclos = 0;
        const ciclosEl = document.getElementById('resp-coh-ciclos');
        if (ciclosEl) ciclosEl.textContent = '0';
        const btnStart = document.getElementById('resp-coh-start');
        const btnStop = document.getElementById('resp-coh-stop');
        if (btnStart) btnStart.disabled = true;
        if (btnStop) btnStop.disabled = false;

        respCohActualizar('inhalar');
        const tick = () => {
            if (!respCohState.activo) return;
            if (respCohState.fase === 'inhalar') {
                respCohState.timer = setTimeout(() => {
                    respCohActualizar('exhalar');
                    tick();
                }, 5000);
            } else {
                respCohState.timer = setTimeout(() => {
                    respCohState.ciclos++;
                    if (ciclosEl) ciclosEl.textContent = respCohState.ciclos;
                    respCohActualizar('inhalar');
                    tick();
                }, 5000);
            }
        };
        tick();
    }
    function respCohStop() {
        respCohState.activo = false;
        if (respCohState.timer) { clearTimeout(respCohState.timer); respCohState.timer = null; }
        respCohActualizar(null);
        const btnStart = document.getElementById('resp-coh-start');
        const btnStop = document.getElementById('resp-coh-stop');
        if (btnStart) btnStart.disabled = false;
        if (btnStop) btnStop.disabled = true;
    }

    const _respStart = document.getElementById('resp-coh-start');
    const _respStop = document.getElementById('resp-coh-stop');
    if (_respStart) _respStart.addEventListener('click', respCohStart);
    if (_respStop) _respStop.addEventListener('click', respCohStop);

    // FASE 2: botones de sesion guiada por voz (EMDR y respiracion).
    const _emdrGuiaStart = document.getElementById('emdr-guia-start');
    const _emdrGuiaStop = document.getElementById('emdr-guia-stop');
    if (_emdrGuiaStart) _emdrGuiaStart.addEventListener('click', () => {
        EMDRGuia.iniciar();
        _emdrGuiaStart.disabled = true;
        if (_emdrGuiaStop) _emdrGuiaStop.disabled = false;
    });
    if (_emdrGuiaStop) _emdrGuiaStop.addEventListener('click', () => {
        EMDRGuia.parar();
        _emdrGuiaStop.disabled = true;
        if (_emdrGuiaStart) _emdrGuiaStart.disabled = false;
    });
    const _respGuiaStart = document.getElementById('resp-guia-start');
    const _respGuiaStop = document.getElementById('resp-guia-stop');
    if (_respGuiaStart) _respGuiaStart.addEventListener('click', () => {
        RespiracionGuia.iniciar();
        _respGuiaStart.disabled = true;
        if (_respGuiaStop) _respGuiaStop.disabled = false;
    });
    if (_respGuiaStop) _respGuiaStop.addEventListener('click', () => {
        RespiracionGuia.parar();
        _respGuiaStop.disabled = true;
        if (_respGuiaStart) _respGuiaStart.disabled = false;
    });

    // FASE 2: anadir boton TTS pequeno a cada mode-item del Hub que lee
    // titulo + descripcion. No interfiere con el click que abre la sesion.
    document.querySelectorAll('#screen-hub .mode-item').forEach(item => {
        const h3 = item.querySelector('h3');
        const p = item.querySelector('p');
        if (!h3) return;
        const btn = crearBotonTTS(() => {
            return (h3.textContent || '') + '. ' + (p ? p.textContent || '' : '');
        }, 'btn-tts-mode');
        item.appendChild(btn);
    });

    // Parar herramientas si el usuario abandona la pantalla Programa.
    document.querySelectorAll('.nav-link').forEach(l => {
        l.addEventListener('click', () => {
            if (l.dataset.screen !== 'programa') {
                if (emdrMiniState.animando) emdrMiniStop();
                if (respCohState.activo) respCohStop();
            }
        });
    });

    // Default init (FASE 1: arranque directo al Hub).
    showScreen('hub');
});
