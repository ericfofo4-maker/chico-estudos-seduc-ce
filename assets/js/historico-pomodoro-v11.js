(function(){

"use strict";


/* ==========================================================
   CHICO V11 — HISTÓRICO POMODORO
   ========================================================== */

const SUBJECT_TIME_KEY =
    "chico_pomodoro_subject_time_v11";

const SESSION_EVENTS_KEY =
    "chico_pomodoro_events_v11";


const SUBJECT_ORDER = [
    "Educação",
    "Administração Pública",
    "Língua Portuguesa",
    "LIDIE",
    "Filosofia"
];


let refreshTimer =
    null;


/* ==========================================================
   STORAGE
   ========================================================== */

function readJson(
    key,
    fallback
){

    try{

        const raw =
            localStorage.getItem(
                key
            );

        if(!raw)
            return fallback;

        return (
            JSON.parse(raw) ||
            fallback
        );

    }catch(e){

        return fallback;

    }

}


/* ==========================================================
   DATAS
   ========================================================== */

function localDateKey(
    date
){

    date =
        date ||
        new Date();

    return [
        date.getFullYear(),
        String(
            date.getMonth()+1
        ).padStart(2,"0"),
        String(
            date.getDate()
        ).padStart(2,"0")
    ].join("-");

}


function startOfWeek(){

    const now =
        new Date();

    const d =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

    const day =
        d.getDay();

    const diff =
        day === 0
        ? -6
        : 1 - day;

    d.setDate(
        d.getDate() +
        diff
    );

    return d;

}


function parseDateKey(
    key
){

    const parts =
        String(key)
        .split("-")
        .map(Number);

    return new Date(
        parts[0],
        parts[1]-1,
        parts[2]
    );

}


function isThisWeek(
    key
){

    const date =
        parseDateKey(key);

    const start =
        startOfWeek();

    const tomorrow =
        new Date();

    tomorrow.setHours(
        23,
        59,
        59,
        999
    );

    return (
        date >= start &&
        date <= tomorrow
    );

}


function formatDate(
    key
){

    const parts =
        String(key)
        .split("-");

    if(
        parts.length !== 3
    ){
        return key;
    }

    return (
        parts[2] +
        "/" +
        parts[1] +
        "/" +
        parts[0]
    );

}


/* ==========================================================
   TEMPO
   ========================================================== */

function formatDuration(
    ms
){

    ms =
        Number(ms) || 0;

    const seconds =
        Math.floor(
            ms /
            1000
        );

    if(
        seconds < 60
    ){

        return (
            seconds +
            " s"
        );

    }

    const minutes =
        Math.floor(
            seconds /
            60
        );

    if(
        minutes < 60
    ){

        return (
            minutes +
            " min"
        );

    }

    const hours =
        Math.floor(
            minutes /
            60
        );

    const rest =
        minutes %
        60;

    if(
        rest === 0
    ){

        return (
            hours +
            "h"
        );

    }

    return (
        hours +
        "h " +
        String(rest)
        .padStart(
            2,
            "0"
        ) +
        "min"
    );

}


/* ==========================================================
   DADOS
   ========================================================== */

function buildData(){

    const times =
        readJson(
            SUBJECT_TIME_KEY,
            {}
        );

    const events =
        readJson(
            SESSION_EVENTS_KEY,
            []
        );


    const today =
        localDateKey();


    let todayMs =
        0;

    let weekMs =
        0;


    const weekBySubject =
        {};

    const records =
        [];


    Object.keys(
        times
    ).forEach(
        function(dateKey){

            const dayData =
                times[dateKey] || {};

            Object.keys(
                dayData
            ).forEach(
                function(subject){

                    const ms =
                        Number(
                            dayData[
                                subject
                            ] || 0
                        );

                    if(
                        ms <= 0
                    ){
                        return;
                    }


                    if(
                        dateKey ===
                        today
                    ){

                        todayMs +=
                            ms;

                    }


                    if(
                        isThisWeek(
                            dateKey
                        )
                    ){

                        weekMs +=
                            ms;

                        weekBySubject[
                            subject
                        ] =
                            Number(
                                weekBySubject[
                                    subject
                                ] || 0
                            ) +
                            ms;

                    }


                    records.push({

                        date:
                            dateKey,

                        subject:
                            subject,

                        ms:
                            ms

                    });

                }
            );

        }
    );


    records.sort(
        function(a,b){

            if(
                a.date ===
                b.date
            ){

                return (
                    b.ms -
                    a.ms
                );

            }

            return (
                b.date.localeCompare(
                    a.date
                )
            );

        }
    );


    let topSubject =
        "";

    let topMs =
        0;


    Object.keys(
        weekBySubject
    ).forEach(
        function(subject){

            const ms =
                weekBySubject[
                    subject
                ];

            if(
                ms >
                topMs
            ){

                topMs =
                    ms;

                topSubject =
                    subject;

            }

        }
    );


    const weekSessions =
        events.filter(
            function(event){

                return (
                    event &&
                    event.completed &&
                    event.type === "pomodoro" &&
                    event.date &&
                    isThisWeek(
                        event.date
                    )
                );

            }
        ).length;


    return {

        todayMs:
            todayMs,

        weekMs:
            weekMs,

        weekSessions:
            weekSessions,

        topSubject:
            topSubject,

        topMs:
            topMs,

        weekBySubject:
            weekBySubject,

        records:
            records

    };

}


/* ==========================================================
   ESCAPE
   ========================================================== */

function esc(
    value
){

    return String(
        value == null
        ? ""
        : value
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
   MONTAR PAINEL
   ========================================================== */

function ensurePanel(){

    const view =
        document.getElementById(
            "view-history"
        );

    const list =
        document.getElementById(
            "historyList"
        );


    if(
        !view ||
        !list
    ){
        return null;
    }


    let root =
        document.getElementById(
            "chicoPomodoroHistory"
        );


    if(root)
        return root;


    root =
        document.createElement(
            "section"
        );

    root.id =
        "chicoPomodoroHistory";


    if(
        list.parentNode
    ){

        list.parentNode.insertBefore(
            root,
            list
        );

    }else{

        view.appendChild(
            root
        );

    }


    return root;

}


/* ==========================================================
   RANKING
   ========================================================== */

function rankingHtml(
    data
){

    const subjects =
        SUBJECT_ORDER
        .map(
            function(subject){

                return {

                    subject:
                        subject,

                    ms:
                        Number(
                            data.weekBySubject[
                                subject
                            ] || 0
                        )

                };

            }
        )
        .filter(
            function(item){

                return (
                    item.ms > 0
                );

            }
        )
        .sort(
            function(a,b){

                return (
                    b.ms -
                    a.ms
                );

            }
        );


    Object.keys(
        data.weekBySubject
    ).forEach(
        function(subject){

            if(
                SUBJECT_ORDER.includes(
                    subject
                )
            ){
                return;
            }

            subjects.push({

                subject:
                    subject,

                ms:
                    Number(
                        data.weekBySubject[
                            subject
                        ] || 0
                    )

            });

        }
    );


    subjects.sort(
        function(a,b){

            return (
                b.ms -
                a.ms
            );

        }
    );


    if(
        subjects.length === 0
    ){

        return `
            <div class="hp-empty">
                Ainda não há tempo registrado nesta semana.
                Inicie um foco no Pomodoro para começar.
            </div>
        `;

    }


    const max =
        Math.max(
            ...subjects.map(
                function(item){
                    return item.ms;
                }
            )
        );


    return (
        '<div class="hp-ranking">' +

        subjects.map(
            function(item){

                const pct =
                    max > 0
                    ? (
                        item.ms /
                        max
                    ) *
                    100
                    : 0;

                return `
                    <div class="hp-rank-row">

                        <div class="hp-rank-top">

                            <span class="hp-subject">
                                ${esc(item.subject)}
                            </span>

                            <span class="hp-time">
                                ${esc(formatDuration(item.ms))}
                            </span>

                        </div>

                        <div class="hp-track">

                            <div
                                class="hp-bar"
                                style="width:${pct.toFixed(2)}%">
                            </div>

                        </div>

                    </div>
                `;

            }
        ).join("") +

        "</div>"
    );

}


/* ==========================================================
   REGISTROS
   ========================================================== */

function recordsHtml(
    records
){

    if(
        records.length === 0
    ){

        return `
            <div class="hp-empty">
                Seus períodos de estudo aparecerão aqui,
                organizados por dia e matéria.
            </div>
        `;

    }


    return (
        '<div class="hp-records">' +

        records
        .slice(
            0,
            12
        )
        .map(
            function(item){

                return `
                    <div class="hp-record">

                        <div class="hp-record-date">
                            ${esc(formatDate(item.date))}
                        </div>

                        <div class="hp-record-subject">
                            ${esc(item.subject)}
                        </div>

                        <div class="hp-record-time">
                            ${esc(formatDuration(item.ms))}
                        </div>

                    </div>
                `;

            }
        )
        .join("") +

        "</div>"
    );

}


/* ==========================================================
   RENDER
   ========================================================== */

function renderPomodoroHistory(){

    const root =
        ensurePanel();

    if(!root)
        return;


    const data =
        buildData();


    root.innerHTML = `

        <div class="hp-hero">

            <span class="hp-kicker">
                TEMPO DE ESTUDO
            </span>

            <h2 class="hp-title">
                Meu foco no CHICO
            </h2>

            <p class="hp-description">
                Acompanhe o tempo real de estudo registrado pelo
                Pomodoro. Pausas não entram nesta contagem.
            </p>


            <div class="hp-metrics">

                <div class="hp-metric">

                    <div class="hp-metric-label">
                        HOJE
                    </div>

                    <div class="hp-metric-value">
                        ${esc(formatDuration(data.todayMs))}
                    </div>

                </div>


                <div class="hp-metric">

                    <div class="hp-metric-label">
                        ESTA SEMANA
                    </div>

                    <div class="hp-metric-value">
                        ${esc(formatDuration(data.weekMs))}
                    </div>

                </div>


                <div class="hp-metric">

                    <div class="hp-metric-label">
                        CICLOS CONCLUÍDOS
                    </div>

                    <div class="hp-metric-value">
                        ${esc(data.weekSessions)}
                    </div>

                </div>


                <div class="hp-metric">

                    <div class="hp-metric-label">
                        MAIS ESTUDADA
                    </div>

                    <div class="hp-metric-value">
                        ${
                            data.topSubject
                            ? esc(data.topSubject)
                            : "—"
                        }
                    </div>

                </div>

            </div>

        </div>


        <div class="hp-grid">

            <article class="hp-card">

                <div class="hp-card-head">

                    <div>

                        <div class="hp-card-kicker">
                            DISTRIBUIÇÃO
                        </div>

                        <div class="hp-card-title">
                            Tempo por matéria
                        </div>

                    </div>

                    <span class="hp-period">
                        ESTA SEMANA
                    </span>

                </div>

                ${rankingHtml(data)}

            </article>


            <article class="hp-card">

                <div class="hp-card-head">

                    <div>

                        <div class="hp-card-kicker">
                            ATIVIDADE
                        </div>

                        <div class="hp-card-title">
                            Registros recentes
                        </div>

                    </div>

                    <span class="hp-period">
                        TEMPO REAL
                    </span>

                </div>

                ${recordsHtml(data.records)}

            </article>

        </div>


        <div class="hp-note">
            Um período parcial também é contabilizado.
            Exemplo: se você planejar 25 minutos de Administração Pública
            e estudar 17 minutos, esses 17 minutos permanecem no histórico.
        </div>

    `;

}


/* ==========================================================
   ATUALIZAÇÃO
   ========================================================== */

function historyIsVisible(){

    const view =
        document.getElementById(
            "view-history"
        );

    if(!view)
        return false;

    return (
        !view.hidden &&
        getComputedStyle(view).display !==
        "none"
    );

}


function beginRefresh(){

    if(refreshTimer)
        return;


    refreshTimer =
        setInterval(
            function(){

                if(
                    historyIsVisible()
                ){

                    renderPomodoroHistory();

                }

            },
            2000
        );

}


document.addEventListener(
    "click",
    function(event){

        const btn =
            event.target.closest(
                '[data-view="history"]'
            );

        if(!btn)
            return;


        setTimeout(
            renderPomodoroHistory,
            80
        );

    }
);


window.addEventListener(
    "storage",
    function(event){

        if(
            event.key ===
            SUBJECT_TIME_KEY ||
            event.key ===
            SESSION_EVENTS_KEY
        ){

            renderPomodoroHistory();

        }

    }
);


/* ==========================================================
   MUTAÇÃO DO HISTÓRICO
   ========================================================== */

const observer =
    new MutationObserver(
        function(){

            if(
                historyIsVisible()
            ){

                ensurePanel();

            }

        }
    );


function boot(){

    ensurePanel();

    renderPomodoroHistory();

    beginRefresh();


    const view =
        document.getElementById(
            "view-history"
        );

    if(view){

        observer.observe(
            view,
            {
                childList:true,
                subtree:false
            }
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