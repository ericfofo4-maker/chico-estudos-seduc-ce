(function(){

    "use strict";

    function esc(value){

        return String(value ?? "")
            .replaceAll("&","&amp;")
            .replaceAll("<","&lt;")
            .replaceAll(">","&gt;")
            .replaceAll('"',"&quot;")
            .replaceAll("'","&#039;");
    }


    function getAnswers(){

        try {

            if(typeof answers === "function"){
                return answers() || {};
            }

        } catch(e){}

        return {};
    }


    function getQuestions(){

        try {

            if(typeof QUESTIONS !== "undefined"){
                return QUESTIONS;
            }

        } catch(e){}

        return [];
    }


    function normalizeAnswer(value){

        if(value === null || value === undefined){
            return "";
        }

        return String(value)
            .trim()
            .toUpperCase();
    }


    function topicOf(q){

        return (
            q.subarea ||
            q.edital_item ||
            q.area ||
            "Conteúdo não classificado"
        );
    }


    function buildRanking(){

        const questions = getQuestions();
        const userAnswers = getAnswers();

        const map = new Map();

        questions.forEach(function(q){

            if(!q.answer_key){
                return;
            }

            const user =
                normalizeAnswer(userAnswers[q.id]);

            const correct =
                normalizeAnswer(q.answer_key);

            if(!user){
                return;
            }

            if(user === correct){
                return;
            }

            const topic = topicOf(q);

            if(!map.has(topic)){

                map.set(topic,{
                    topic: topic,
                    area: q.area || "",
                    banca:
                        q.meta && q.meta.banca
                            ? q.meta.banca
                            : "",
                    count: 0,
                    questionIds: []
                });
            }

            const item = map.get(topic);

            item.count++;
            item.questionIds.push(q.id);
        });

        return Array
            .from(map.values())
            .sort(function(a,b){

                if(b.count !== a.count){
                    return b.count - a.count;
                }

                return a.topic.localeCompare(
                    b.topic,
                    "pt-BR"
                );
            });
    }


    function youtubeUrl(item){

        const query = [
            item.topic,
            item.area,
            item.banca,
            "concurso professor"
        ]
        .filter(Boolean)
        .join(" ");

        return (
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(query)
        );
    }


    function createPanel(){

        let panel =
            document.getElementById(
                "chicoReviewRanking"
            );

        if(panel){
            return panel;
        }

        const errorsList =
            document.getElementById("errorsList");

        if(!errorsList){
            return null;
        }

        panel = document.createElement("section");

        panel.id = "chicoReviewRanking";
        panel.className = "chico-ranking-panel";

        errorsList.parentNode.insertBefore(
            panel,
            errorsList
        );

        return panel;
    }


    function render(){

        const panel = createPanel();

        if(!panel){
            return;
        }

        const ranking = buildRanking();

        if(!ranking.length){

            panel.innerHTML = `
                <div class="chico-ranking-empty">

                    <div>
                        <small>MAPA DE REVISÃO</small>
                        <strong>
                            Ainda não há assuntos suficientes
                            para montar um ranking.
                        </strong>
                    </div>

                    <p>
                        Conforme você responder questões com
                        gabarito conhecido, o CHICO identificará
                        automaticamente os conteúdos que mais
                        precisam de revisão.
                    </p>

                </div>
            `;

            return;
        }

        const totalErrors =
            ranking.reduce(
                function(total,item){
                    return total + item.count;
                },
                0
            );

        const top = ranking.slice(0,5);

        const cards = top.map(function(item,index){

            const percent =
                Math.max(
                    8,
                    Math.round(
                        (item.count / totalErrors) * 100
                    )
                );

            return `
                <article class="chico-ranking-item">

                    <div class="chico-ranking-position">
                        ${index + 1}
                    </div>

                    <div class="chico-ranking-main">

                        <div class="chico-ranking-title">
                            ${esc(item.topic)}
                        </div>

                        <div class="chico-ranking-meta">

                            <span>
                                ${item.count}
                                ${item.count === 1 ? "erro" : "erros"}
                            </span>

                            ${
                                item.area
                                ? `<span>${esc(item.area)}</span>`
                                : ""
                            }

                        </div>

                        <div class="chico-ranking-bar">

                            <span
                                style="width:${percent}%">
                            </span>

                        </div>

                    </div>

                    <a
                        class="chico-ranking-youtube"
                        href="${youtubeUrl(item)}"
                        target="_blank"
                        rel="noopener noreferrer">

                        ▶ Revisar

                    </a>

                </article>
            `;

        }).join("");

        panel.innerHTML = `

            <div class="chico-ranking-header">

                <div>

                    <small>
                        REVISÃO INTELIGENTE
                    </small>

                    <h2>
                        Assuntos que mais preciso revisar
                    </h2>

                    <p>
                        Ranking calculado automaticamente
                        a partir das questões respondidas
                        incorretamente.
                    </p>

                </div>

                <div class="chico-ranking-total">

                    <strong>${totalErrors}</strong>

                    <span>
                        ${
                            totalErrors === 1
                            ? "erro analisado"
                            : "erros analisados"
                        }
                    </span>

                </div>

            </div>

            <div class="chico-ranking-list">
                ${cards}
            </div>

        `;
    }


    function watchErrors(){

        const list =
            document.getElementById("errorsList");

        if(!list){
            return;
        }

        const observer =
            new MutationObserver(function(){
                render();
            });

        observer.observe(
            list,
            {
                childList:true,
                subtree:true
            }
        );
    }


    function bindNavigation(){

        const button =
            document.querySelector(
                '.navbtn[data-view="errors"]'
            );

        if(button){

            button.addEventListener(
                "click",
                function(){

                    setTimeout(
                        render,
                        80
                    );
                }
            );
        }
    }


    function start(){

        bindNavigation();
        watchErrors();
        render();

        window.addEventListener(
            "storage",
            function(){
                render();
            }
        );
    }


    if(document.readyState === "loading"){

        document.addEventListener(
            "DOMContentLoaded",
            start
        );

    } else {

        start();
    }

})();