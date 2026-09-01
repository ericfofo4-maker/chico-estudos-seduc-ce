(function(){

"use strict";


/* ==========================================================
   CHICO ESTUDOS — POMODORO V11.1
   Matérias + contabilização real de tempo
   ========================================================== */

const STORAGE_KEY =
    "chico_pomodoro_v11";

const DAILY_KEY =
    "chico_pomodoro_daily_v11";

const SUBJECT_TIME_KEY =
    "chico_pomodoro_subject_time_v11";

const SESSION_EVENTS_KEY =
    "chico_pomodoro_events_v11";


/* ==========================================================
   MATÉRIAS DO CONCURSO
   ========================================================== */

const SUBJECTS = [
    "Educação",
    "Administração Pública",
    "Língua Portuguesa",
    "LIDIE",
    "Filosofia"
];


const DEFAULTS = {

    focus:25,
    shortBreak:5,
    longBreak:15,

    sessionsBeforeLong:4,

    mode:"focus",

    remaining:25*60,

    running:false,
    endAt:null,

    sound:true,
    autoStart:false,

    preset:"25-5",

    subject:"",

    sessionTrackedMs:0,
    lastTrackedAt:null
};


let state =
    loadState();

let interval =
    null;


/* ==========================================================
   STORAGE
   ========================================================== */

function loadState(){

    try{

        const saved =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_KEY
                )
            ) || {};

        const merged =
            Object.assign(
                {},
                DEFAULTS,
                saved
            );

        if(
            merged.running &&
            merged.endAt
        ){

            merged.remaining =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            merged.endAt -
                            Date.now()
                        ) / 1000
                    )
                );

        }

        return merged;

    }catch(e){

        return {
            ...DEFAULTS
        };

    }

}


function saveState(){

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );

}


/* ==========================================================
   DATA
   ========================================================== */

function todayKey(){

    const d =
        new Date();

    return [
        d.getFullYear(),
        String(
            d.getMonth()+1
        ).padStart(2,"0"),
        String(
            d.getDate()
        ).padStart(2,"0")
    ].join("-");

}


/* ==========================================================
   SESSÕES CONCLUÍDAS
   ========================================================== */

function getDaily(){

    try{

        const data =
            JSON.parse(
                localStorage.getItem(
                    DAILY_KEY
                )
            ) || {};

        return Number(
            data[todayKey()] || 0
        );

    }catch(e){

        return 0;

    }

}


function addDaily(){

    let data = {};

    try{

        data =
            JSON.parse(
                localStorage.getItem(
                    DAILY_KEY
                )
            ) || {};

    }catch(e){}

    const key =
        todayKey();

    data[key] =
        Number(
            data[key] || 0
        ) + 1;

    localStorage.setItem(
        DAILY_KEY,
        JSON.stringify(data)
    );

}


/* ==========================================================
   TEMPO POR MATÉRIA
   ========================================================== */

function loadSubjectTimes(){

    try{

        return (
            JSON.parse(
                localStorage.getItem(
                    SUBJECT_TIME_KEY
                )
            ) || {}
        );

    }catch(e){

        return {};

    }

}


function addSubjectMilliseconds(
    subject,
    milliseconds
){

    if(
        !subject ||
        !milliseconds ||
        milliseconds <= 0
    ){
        return;
    }

    const data =
        loadSubjectTimes();

    const day =
        todayKey();

    if(!data[day])
        data[day] = {};

    data[day][subject] =
        Number(
            data[day][subject] || 0
        ) +
        milliseconds;

    localStorage.setItem(
        SUBJECT_TIME_KEY,
        JSON.stringify(data)
    );

}


function getSubjectTodayMs(
    subject
){

    if(!subject)
        return 0;

    const data =
        loadSubjectTimes();

    const day =
        data[todayKey()] || {};

    return Number(
        day[subject] || 0
    );

}


/* ==========================================================
   EVENTOS PARA A FUTURA INTEGRAÇÃO AO HISTÓRICO
   ========================================================== */

function addSessionEvent(
    subject,
    trackedMs,
    plannedMinutes
){

    if(
        !subject ||
        trackedMs <= 0
    ){
        return;
    }

    let events = [];

    try{

        events =
            JSON.parse(
                localStorage.getItem(
                    SESSION_EVENTS_KEY
                )
            ) || [];

    }catch(e){}

    events.unshift({

        id:
            "pomo-" +
            Date.now(),

        timestamp:
            new Date().toISOString(),

        date:
            todayKey(),

        subject:
            subject,

        studiedSeconds:
            Math.round(
                trackedMs / 1000
            ),

        plannedMinutes:
            plannedMinutes,

        type:
            "pomodoro",

        completed:
            true

    });

    if(
        events.length > 500
    ){
        events =
            events.slice(
                0,
                500
            );
    }

    localStorage.setItem(
        SESSION_EVENTS_KEY,
        JSON.stringify(events)
    );

}


/* ==========================================================
   DURAÇÕES
   ========================================================== */

function durationForMode(
    mode
){

    if(
        mode === "short"
    ){
        return (
            state.shortBreak *
            60
        );
    }

    if(
        mode === "long"
    ){
        return (
            state.longBreak *
            60
        );
    }

    return (
        state.focus *
        60
    );

}


function modeLabel(){

    if(
        state.mode === "short"
    ){
        return "PAUSA CURTA";
    }

    if(
        state.mode === "long"
    ){
        return "PAUSA LONGA";
    }

    return "TEMPO DE FOCO";

}


/* ==========================================================
   CONTABILIZAÇÃO REAL DO FOCO
   ========================================================== */

function accountFocusTime(
    now
){

    now =
        now ||
        Date.now();

    if(
        !state.running ||
        state.mode !== "focus" ||
        !state.subject ||
        !state.lastTrackedAt
    ){
        return;
    }

    let effectiveNow =
        now;

    if(
        state.endAt
    ){

        effectiveNow =
            Math.min(
                effectiveNow,
                state.endAt
            );

    }

    const delta =
        Math.max(
            0,
            effectiveNow -
            state.lastTrackedAt
        );

    if(
        delta <= 0
    ){
        return;
    }

    state.sessionTrackedMs =
        Number(
            state.sessionTrackedMs || 0
        ) +
        delta;

    addSubjectMilliseconds(
        state.subject,
        delta
    );

    state.lastTrackedAt =
        effectiveNow;

    saveState();

}


/* ==========================================================
   ÁUDIO
   ========================================================== */

function beep(){

    if(
        !state.sound
    ){
        return;
    }

    try{

        const AudioCtx =
            window.AudioContext ||
            window.webkitAudioContext;

        if(!AudioCtx)
            return;

        const ctx =
            new AudioCtx();

        const gain =
            ctx.createGain();

        gain.gain.value =
            0.05;

        gain.connect(
            ctx.destination
        );

        [
            0,
            0.18,
            0.36
        ].forEach(
            function(offset){

                const osc =
                    ctx.createOscillator();

                osc.type =
                    "sine";

                osc.frequency.value =
                    760;

                osc.connect(gain);

                osc.start(
                    ctx.currentTime +
                    offset
                );

                osc.stop(
                    ctx.currentTime +
                    offset +
                    0.10
                );

            }
        );

        setTimeout(
            function(){

                ctx.close();

            },
            900
        );

    }catch(e){}

}


/* ==========================================================
   INTERFACE
   ========================================================== */

function createUI(){

    if(
        document.getElementById(
            "chicoPomodoro"
        )
    ){
        return;
    }

    const root =
        document.createElement(
            "div"
        );

    root.id =
        "chicoPomodoro";

    const subjectOptions =
        SUBJECTS.map(
            function(subject){

                return (
                    '<option value="' +
                    escapeHtml(subject) +
                    '">' +
                    escapeHtml(subject) +
                    "</option>"
                );

            }
        ).join("");


    root.innerHTML = `

        <button
            class="pomo-fab"
            id="pomoFab"
            type="button"
            aria-label="Abrir Pomodoro">

            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">

                <circle
                    cx="12"
                    cy="13"
                    r="8">
                </circle>

                <path
                    d="M12 9v4l2.5 2">
                </path>

                <path
                    d="M9 2h6">
                </path>

                <path
                    d="M12 2v3">
                </path>

            </svg>

            <span
                class="pomo-fab-running"
                id="pomoRunningDot"
                hidden>
            </span>

        </button>


        <section
            class="pomo-panel"
            id="pomoPanel"
            aria-label="Pomodoro CHICO">

            <div class="pomo-header">

                <span class="pomo-kicker">
                    MÉTODO POMODORO
                </span>

                <div class="pomo-title-row">

                    <h2 class="pomo-title">
                        Foco CHICO
                    </h2>

                    <button
                        type="button"
                        class="pomo-close"
                        id="pomoClose"
                        aria-label="Fechar">

                        ×

                    </button>

                </div>

                <p class="pomo-subtitle">
                    Foque, registre a matéria e acompanhe seu tempo real de estudo.
                </p>

            </div>


            <div class="pomo-body">

                <div class="pomo-modes">

                    <button
                        type="button"
                        class="pomo-mode"
                        data-mode="focus">
                        Foco
                    </button>

                    <button
                        type="button"
                        class="pomo-mode"
                        data-mode="short">
                        Pausa
                    </button>

                    <button
                        type="button"
                        class="pomo-mode"
                        data-mode="long">
                        Longa
                    </button>

                </div>


                <div class="pomo-subject-box">

                    <div class="pomo-subject-head">

                        <span class="pomo-subject-label">
                            MATÉRIA DE ESTUDO
                        </span>

                        <span class="pomo-subject-required">
                            OBRIGATÓRIA NO FOCO
                        </span>

                    </div>

                    <select
                        id="pomoSubject">

                        <option value="">
                            Selecione a matéria...
                        </option>

                        ${subjectOptions}

                    </select>

                    <div
                        class="pomo-subject-warning"
                        id="pomoSubjectWarning">

                        Selecione a matéria antes de iniciar o foco.

                    </div>

                </div>


                <div class="pomo-clock-zone">

                    <div
                        class="pomo-ring"
                        id="pomoRing">

                        <div class="pomo-clock">

                            <div
                                class="pomo-time"
                                id="pomoTime">

                                25:00

                            </div>

                            <div
                                class="pomo-clock-label"
                                id="pomoClockLabel">

                                TEMPO DE FOCO

                            </div>

                        </div>

                    </div>

                </div>


                <div class="pomo-controls">

                    <button
                        type="button"
                        class="pomo-main-btn"
                        id="pomoPlay">

                        Iniciar foco

                    </button>

                    <button
                        type="button"
                        class="pomo-icon-btn"
                        id="pomoReset"
                        title="Reiniciar">

                        ↺

                    </button>

                    <button
                        type="button"
                        class="pomo-icon-btn"
                        id="pomoSkip"
                        title="Pular etapa">

                        ›

                    </button>

                </div>


                <div class="pomo-study-stats">

                    <div class="pomo-study-stat">

                        <div class="pomo-study-stat-label">
                            HOJE NESTA MATÉRIA
                        </div>

                        <div
                            class="pomo-study-stat-value"
                            id="pomoSubjectToday">

                            0 min

                        </div>

                    </div>

                    <div class="pomo-study-stat">

                        <div class="pomo-study-stat-label">
                            SESSÃO ATUAL
                        </div>

                        <div
                            class="pomo-study-stat-value"
                            id="pomoCurrentStudy">

                            0 min

                        </div>

                    </div>

                </div>


                <div class="pomo-session-card">

                    <div>

                        <div class="pomo-session-label">
                            CICLOS CONCLUÍDOS HOJE
                        </div>

                        <div
                            class="pomo-session-count"
                            id="pomoSessionCount">

                            0 sessões

                        </div>

                    </div>

                    <div
                        class="pomo-tomatoes"
                        id="pomoDots">
                    </div>

                </div>


                <div class="pomo-section-title">
                    CICLOS RÁPIDOS
                </div>

                <div class="pomo-presets">

                    <button
                        type="button"
                        class="pomo-preset"
                        data-focus="25"
                        data-break="5"
                        data-long="15"
                        data-preset="25-5">

                        25 / 5

                    </button>

                    <button
                        type="button"
                        class="pomo-preset"
                        data-focus="50"
                        data-break="10"
                        data-long="20"
                        data-preset="50-10">

                        50 / 10

                    </button>

                    <button
                        type="button"
                        class="pomo-preset"
                        data-focus="90"
                        data-break="15"
                        data-long="30"
                        data-preset="90-15">

                        90 / 15

                    </button>

                </div>


                <details class="pomo-advanced">

                    <summary>
                        Personalizar tempos e preferências
                    </summary>

                    <div class="pomo-advanced-content">

                        <div class="pomo-settings">

                            <div class="pomo-field">

                                <label
                                    for="pomoFocusInput">
                                    Foco
                                </label>

                                <input
                                    id="pomoFocusInput"
                                    type="number"
                                    min="1"
                                    max="180">

                            </div>

                            <div class="pomo-field">

                                <label
                                    for="pomoBreakInput">
                                    Pausa
                                </label>

                                <input
                                    id="pomoBreakInput"
                                    type="number"
                                    min="1"
                                    max="60">

                            </div>

                            <div class="pomo-field">

                                <label
                                    for="pomoLongInput">
                                    Pausa longa
                                </label>

                                <input
                                    id="pomoLongInput"
                                    type="number"
                                    min="1"
                                    max="90">

                            </div>

                            <div class="pomo-field">

                                <label
                                    for="pomoCyclesInput">
                                    Ciclos
                                </label>

                                <input
                                    id="pomoCyclesInput"
                                    type="number"
                                    min="1"
                                    max="10">

                            </div>

                        </div>


                        <div class="pomo-toggles">

                            <label class="pomo-toggle-row">

                                <span>
                                    Som ao concluir
                                </span>

                                <input
                                    id="pomoSound"
                                    type="checkbox">

                            </label>

                            <label class="pomo-toggle-row">

                                <span>
                                    Iniciar próxima etapa automaticamente
                                </span>

                                <input
                                    id="pomoAutoStart"
                                    type="checkbox">

                            </label>

                        </div>

                    </div>

                </details>


                <div class="pomo-footer">
                    Apenas o tempo em que o foco estiver rodando é contabilizado.
                    Pausas não entram no tempo de estudo.
                </div>

            </div>

        </section>

    `;

    document.body.appendChild(
        root
    );

    bindEvents();
    render();

    if(
        state.running
    ){
        startTicker();
    }

}


/* ==========================================================
   HTML SEGURO
   ========================================================== */

function escapeHtml(
    value
){

    return String(
        value
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


/* ==========================================================
   EVENTOS
   ========================================================== */

function bindEvents(){

    const root =
        document.getElementById(
            "chicoPomodoro"
        );


    document.getElementById(
        "pomoFab"
    ).addEventListener(
        "click",
        function(){

            root.classList.toggle(
                "open"
            );

        }
    );


    document.getElementById(
        "pomoClose"
    ).addEventListener(
        "click",
        function(){

            root.classList.remove(
                "open"
            );

        }
    );


    document.getElementById(
        "pomoSubject"
    ).addEventListener(
        "change",
        function(e){

            state.subject =
                e.target.value;

            document.getElementById(
                "pomoSubjectWarning"
            ).classList.remove(
                "show"
            );

            saveState();
            renderStats();

        }
    );


    document.querySelectorAll(
        "#chicoPomodoro .pomo-mode"
    ).forEach(
        function(btn){

            btn.addEventListener(
                "click",
                function(){

                    changeMode(
                        btn.dataset.mode
                    );

                }
            );

        }
    );


    document.getElementById(
        "pomoPlay"
    ).addEventListener(
        "click",
        function(){

            if(
                state.running
            ){

                pause();

            }else{

                start();

            }

        }
    );


    document.getElementById(
        "pomoReset"
    ).addEventListener(
        "click",
        reset
    );


    document.getElementById(
        "pomoSkip"
    ).addEventListener(
        "click",
        function(){

            completePhase(
                true
            );

        }
    );


    document.querySelectorAll(
        "#chicoPomodoro .pomo-preset"
    ).forEach(
        function(btn){

            btn.addEventListener(
                "click",
                function(){

                    if(
                        state.running
                    ){
                        pause();
                    }

                    state.focus =
                        Number(
                            btn.dataset.focus
                        );

                    state.shortBreak =
                        Number(
                            btn.dataset.break
                        );

                    state.longBreak =
                        Number(
                            btn.dataset.long
                        );

                    state.preset =
                        btn.dataset.preset;

                    state.remaining =
                        durationForMode(
                            state.mode
                        );

                    state.sessionTrackedMs =
                        0;

                    state.lastTrackedAt =
                        null;

                    saveState();
                    render();

                }
            );

        }
    );


    const numberBindings = [

        [
            "pomoFocusInput",
            "focus",
            1,
            180
        ],

        [
            "pomoBreakInput",
            "shortBreak",
            1,
            60
        ],

        [
            "pomoLongInput",
            "longBreak",
            1,
            90
        ],

        [
            "pomoCyclesInput",
            "sessionsBeforeLong",
            1,
            10
        ]

    ];


    numberBindings.forEach(
        function(item){

            const el =
                document.getElementById(
                    item[0]
                );

            el.addEventListener(
                "change",
                function(){

                    let value =
                        Number(
                            el.value
                        );

                    value =
                        Math.max(
                            item[2],
                            Math.min(
                                item[3],
                                value
                            )
                        );

                    state[
                        item[1]
                    ] =
                        value;

                    state.preset =
                        "custom";

                    if(
                        !state.running
                    ){

                        state.remaining =
                            durationForMode(
                                state.mode
                            );

                    }

                    saveState();
                    render();

                }
            );

        }
    );


    document.getElementById(
        "pomoSound"
    ).addEventListener(
        "change",
        function(e){

            state.sound =
                e.target.checked;

            saveState();

        }
    );


    document.getElementById(
        "pomoAutoStart"
    ).addEventListener(
        "change",
        function(e){

            state.autoStart =
                e.target.checked;

            saveState();

        }
    );


    document.addEventListener(
        "keydown",
        function(e){

            if(
                e.key === "Escape"
            ){

                root.classList.remove(
                    "open"
                );

            }

        }
    );

}


/* ==========================================================
   INICIAR
   ========================================================== */

function start(){

    if(
        state.mode === "focus" &&
        !state.subject
    ){

        const warning =
            document.getElementById(
                "pomoSubjectWarning"
            );

        const select =
            document.getElementById(
                "pomoSubject"
            );

        warning.classList.add(
            "show"
        );

        select.focus();

        return;

    }


    if(
        state.remaining <= 0
    ){

        state.remaining =
            durationForMode(
                state.mode
            );

    }


    state.running =
        true;

    state.endAt =
        Date.now() +
        state.remaining *
        1000;

    state.lastTrackedAt =
        Date.now();

    saveState();

    startTicker();
    render();

}


/* ==========================================================
   PAUSAR
   ========================================================== */

function pause(){

    const now =
        Date.now();

    accountFocusTime(
        now
    );

    syncRemaining(
        now
    );

    state.running =
        false;

    state.endAt =
        null;

    state.lastTrackedAt =
        null;

    stopTicker();

    saveState();
    render();

}


/* ==========================================================
   RESETAR
   ========================================================== */

function reset(){

    if(
        state.running
    ){

        accountFocusTime(
            Date.now()
        );

    }

    state.running =
        false;

    state.endAt =
        null;

    state.lastTrackedAt =
        null;

    state.remaining =
        durationForMode(
            state.mode
        );

    state.sessionTrackedMs =
        0;

    stopTicker();

    saveState();
    render();

}


/* ==========================================================
   TROCAR MODO
   ========================================================== */

function changeMode(
    mode
){

    if(
        state.running
    ){

        accountFocusTime(
            Date.now()
        );

    }

    state.running =
        false;

    state.endAt =
        null;

    state.lastTrackedAt =
        null;

    state.mode =
        mode;

    state.remaining =
        durationForMode(
            mode
        );

    if(
        mode === "focus"
    ){

        state.sessionTrackedMs =
            0;

    }

    stopTicker();

    saveState();
    render();

}


/* ==========================================================
   SINCRONIZAR TEMPO
   ========================================================== */

function syncRemaining(
    now
){

    now =
        now ||
        Date.now();

    if(
        !state.running ||
        !state.endAt
    ){
        return;
    }

    state.remaining =
        Math.max(
            0,
            Math.ceil(
                (
                    state.endAt -
                    now
                ) / 1000
            )
        );

}


/* ==========================================================
   TICK
   ========================================================== */

function startTicker(){

    stopTicker();

    interval =
        setInterval(
            function(){

                const now =
                    Date.now();

                accountFocusTime(
                    now
                );

                syncRemaining(
                    now
                );


                if(
                    state.remaining <= 0
                ){

                    completePhase(
                        false
                    );

                    return;

                }

                renderClock();
                renderStats();

            },
            1000
        );

}


function stopTicker(){

    if(
        interval
    ){

        clearInterval(
            interval
        );

        interval =
            null;

    }

}


/* ==========================================================
   FIM DE ETAPA
   ========================================================== */

function completePhase(
    skipped
){

    const finishedMode =
        state.mode;

    const now =
        Date.now();


    if(
        state.running
    ){

        accountFocusTime(
            now
        );

    }


    stopTicker();

    state.running =
        false;

    state.endAt =
        null;

    state.lastTrackedAt =
        null;


    if(
        finishedMode === "focus" &&
        !skipped
    ){

        addDaily();

        addSessionEvent(
            state.subject,
            state.sessionTrackedMs,
            state.focus
        );

    }


    if(
        !skipped
    ){

        beep();

    }


    if(
        finishedMode === "focus"
    ){

        const completed =
            getDaily();

        if(
            completed > 0 &&
            completed %
            state.sessionsBeforeLong === 0
        ){

            state.mode =
                "long";

        }else{

            state.mode =
                "short";

        }

    }else{

        state.mode =
            "focus";

        state.sessionTrackedMs =
            0;

    }


    state.remaining =
        durationForMode(
            state.mode
        );


    saveState();
    render();


    if(
        state.autoStart &&
        !skipped
    ){

        start();

    }

}


/* ==========================================================
   FORMATAÇÃO
   ========================================================== */

function formatTime(
    seconds
){

    seconds =
        Math.max(
            0,
            Number(
                seconds
            ) || 0
        );

    const m =
        Math.floor(
            seconds /
            60
        );

    const s =
        Math.floor(
            seconds %
            60
        );

    return (
        String(m).padStart(2,"0") +
        ":" +
        String(s).padStart(2,"0")
    );

}


function formatStudyTime(
    milliseconds
){

    const totalSeconds =
        Math.floor(
            Number(
                milliseconds
            ) /
            1000
        );

    if(
        totalSeconds < 60
    ){

        return (
            totalSeconds +
            " s"
        );

    }

    const totalMinutes =
        Math.floor(
            totalSeconds /
            60
        );

    if(
        totalMinutes < 60
    ){

        return (
            totalMinutes +
            " min"
        );

    }

    const hours =
        Math.floor(
            totalMinutes /
            60
        );

    const minutes =
        totalMinutes %
        60;

    if(
        minutes === 0
    ){

        return (
            hours +
            "h"
        );

    }

    return (
        hours +
        "h " +
        String(
            minutes
        ).padStart(
            2,
            "0"
        ) +
        "min"
    );

}


/* ==========================================================
   RELÓGIO
   ========================================================== */

function renderClock(){

    const time =
        document.getElementById(
            "pomoTime"
        );

    const ring =
        document.getElementById(
            "pomoRing"
        );

    const dot =
        document.getElementById(
            "pomoRunningDot"
        );

    if(
        !time ||
        !ring
    ){
        return;
    }


    time.textContent =
        formatTime(
            state.remaining
        );


    const total =
        durationForMode(
            state.mode
        );

    const elapsed =
        Math.max(
            0,
            total -
            state.remaining
        );

    const pct =
        total > 0
        ? elapsed / total
        : 0;

    const deg =
        Math.min(
            360,
            Math.max(
                0,
                pct * 360
            )
        );


    ring.style.setProperty(
        "--pomo-progress",
        deg + "deg"
    );


    dot.hidden =
        !state.running;

}


/* ==========================================================
   ESTATÍSTICAS
   ========================================================== */

function renderStats(){

    const subjectToday =
        document.getElementById(
            "pomoSubjectToday"
        );

    const current =
        document.getElementById(
            "pomoCurrentStudy"
        );

    if(
        subjectToday
    ){

        subjectToday.textContent =
            state.subject
            ? formatStudyTime(
                getSubjectTodayMs(
                    state.subject
                )
            )
            : "Selecione";

    }


    if(
        current
    ){

        current.textContent =
            formatStudyTime(
                state.sessionTrackedMs
            );

    }

}


/* ==========================================================
   RENDER GERAL
   ========================================================== */

function render(){

    const root =
        document.getElementById(
            "chicoPomodoro"
        );

    if(!root)
        return;


    syncRemaining();


    document.querySelectorAll(
        "#chicoPomodoro .pomo-mode"
    ).forEach(
        function(btn){

            btn.classList.toggle(
                "active",
                btn.dataset.mode ===
                state.mode
            );

        }
    );


    document.querySelectorAll(
        "#chicoPomodoro .pomo-preset"
    ).forEach(
        function(btn){

            btn.classList.toggle(
                "active",
                btn.dataset.preset ===
                state.preset
            );

        }
    );


    document.getElementById(
        "pomoClockLabel"
    ).textContent =
        modeLabel();


    const play =
        document.getElementById(
            "pomoPlay"
        );


    if(
        state.running
    ){

        play.textContent =
            "Pausar";

    }else if(
        state.mode === "focus"
    ){

        play.textContent =
            state.remaining <
            durationForMode("focus")
            ? "Continuar foco"
            : "Iniciar foco";

    }else{

        play.textContent =
            "Iniciar pausa";

    }


    const subjectSelect =
        document.getElementById(
            "pomoSubject"
        );

    subjectSelect.value =
        state.subject || "";

    subjectSelect.disabled =
        (
            state.mode === "focus" &&
            (
                state.running ||
                Number(state.sessionTrackedMs || 0) > 0
            )
        );


    document.getElementById(
        "pomoFocusInput"
    ).value =
        state.focus;

    document.getElementById(
        "pomoBreakInput"
    ).value =
        state.shortBreak;

    document.getElementById(
        "pomoLongInput"
    ).value =
        state.longBreak;

    document.getElementById(
        "pomoCyclesInput"
    ).value =
        state.sessionsBeforeLong;

    document.getElementById(
        "pomoSound"
    ).checked =
        !!state.sound;

    document.getElementById(
        "pomoAutoStart"
    ).checked =
        !!state.autoStart;


    const count =
        getDaily();

    document.getElementById(
        "pomoSessionCount"
    ).textContent =
        count +
        (
            count === 1
            ? " sessão"
            : " sessões"
        );


    const dots =
        document.getElementById(
            "pomoDots"
        );

    dots.innerHTML =
        "";


    const cycle =
        Math.max(
            1,
            state.sessionsBeforeLong
        );

    const progress =
        count %
        cycle;


    for(
        let i = 0;
        i < cycle;
        i++
    ){

        const dot =
            document.createElement(
                "span"
            );

        dot.className =
            "pomo-dot";


        if(
            progress > 0 &&
            i < progress
        ){

            dot.classList.add(
                "done"
            );

        }


        if(
            progress === 0 &&
            count > 0
        ){

            dot.classList.add(
                "done"
            );

        }


        dots.appendChild(
            dot
        );

    }


    renderClock();
    renderStats();

    saveState();

}


/* ==========================================================
   RETORNO À ABA
   ========================================================== */

document.addEventListener(
    "visibilitychange",
    function(){

        if(
            document.visibilityState !==
            "visible"
        ){
            return;
        }


        if(
            state.running
        ){

            const now =
                Date.now();

            accountFocusTime(
                now
            );

            syncRemaining(
                now
            );


            if(
                state.remaining <= 0
            ){

                completePhase(
                    false
                );

            }else{

                render();

            }

        }

    }
);


/* ==========================================================
   INICIALIZAÇÃO
   ========================================================== */

function boot(){

    createUI();


    if(
        state.running &&
        state.remaining <= 0
    ){

        completePhase(
            false
        );

    }

}


if(
    document.readyState ===
    "loading"
){

    document.addEventListener(
        "DOMContentLoaded",
        boot
    );

}else{

    boot();

}

})();