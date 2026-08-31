(function () {

    "use strict";

    const DATA_URL = "./dados/noticias.json";

    function escapeHTML(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function formatDate(dateString) {

        if (!dateString) {
            return {
                top: "CEARÁ",
                bottom: "RADAR"
            };
        }

        const parts = dateString.split("-");

        if (parts.length !== 3) {
            return {
                top: "CEARÁ",
                bottom: "RADAR"
            };
        }

        const months = [
            "JAN","FEV","MAR","ABR","MAI","JUN",
            "JUL","AGO","SET","OUT","NOV","DEZ"
        ];

        const year = parts[0];
        const month = months[Number(parts[1]) - 1] || "";
        const day = parts[2];

        return {
            top: day + " " + month,
            bottom: year
        };
    }


    function formatDeadline(dateString) {

        if (!dateString) {
            return "";
        }

        const parts = dateString.split("-");

        if (parts.length !== 3) {
            return dateString;
        }

        return (
            parts[2] + "/" +
            parts[1] + "/" +
            parts[0]
        );
    }


    function activeItems(data) {

        return (data.noticias || []).filter(function (item) {
            return item.ativo !== false;
        });
    }


    function tickerText(item) {

        const place =
            item.municipio ||
            (item.tipo === "seduc" ? "SEDUC-CE 2026" : "CEARÁ");

        let text = item.titulo || item.resumo || "";

        if (item.prazo) {
            text += " • prazo até " + formatDeadline(item.prazo);
        }

        return {
            place: place,
            text: text
        };
    }


    function renderTicker(items) {

        const track =
            document.querySelector(".chico-ticker-track");

        if (!track) {
            return;
        }

        const urgent = items.filter(function (item) {
            return item.urgente === true;
        });

        if (!urgent.length) {

            track.innerHTML = `
                <span class="chico-ticker-item">
                    <strong>CHICO:</strong>
                    Nenhum alerta urgente no momento.
                </span>
            `;

            return;
        }

        function createItem(item) {

            const info = tickerText(item);

            return `
                <a
                    class="chico-ticker-item"
                    href="${escapeHTML(item.url || "#")}"
                    target="_blank"
                    rel="noopener noreferrer">

                    <span class="chico-ticker-urgent">
                        ${escapeHTML(item.situacao || "ALERTA")}
                    </span>

                    <strong>
                        ${escapeHTML(info.place)}:
                    </strong>

                    ${escapeHTML(info.text)}

                </a>
            `;
        }

        const cycle = urgent.map(createItem).join("");

        /*
         * Repetimos o mesmo ciclo duas vezes para que
         * a animação horizontal permaneça contínua.
         */
        track.innerHTML = cycle + cycle;
    }


    function renderSeducNews(items) {

        const list =
            document.querySelector(".v10-news-list");

        if (!list) {
            return;
        }

        const seduc = items
            .filter(function (item) {
                return item.tipo === "seduc";
            })
            .sort(function (a, b) {
                return String(b.data || "")
                    .localeCompare(String(a.data || ""));
            });

        if (!seduc.length) {
            return;
        }

        list.innerHTML = seduc.map(function (item) {

            const date = formatDate(item.data);

            return `
                <article
                    class="v10-news-card"
                    data-news-type="seduc">

                    <div class="v10-news-date">
                        <strong>${escapeHTML(date.top)}</strong>
                        <span>${escapeHTML(date.bottom)}</span>
                    </div>

                    <div class="v10-news-content">

                        <div class="v10-news-badge">
                            ${escapeHTML(item.situacao || "OFICIAL")}
                            •
                            ${escapeHTML(item.fonte || "FONTE OFICIAL")}
                        </div>

                        <h3>
                            ${escapeHTML(item.titulo)}
                        </h3>

                        <p>
                            ${escapeHTML(item.resumo)}
                        </p>

                    </div>

                    <a
                        class="v10-news-link"
                        href="${escapeHTML(item.url || "#")}"
                        target="_blank"
                        rel="noopener noreferrer">

                        Ver publicação

                    </a>

                </article>
            `;

        }).join("");
    }


    function renderMunicipios(items) {

        const grid =
            document.querySelector(".v10-municipio-grid");

        if (!grid) {
            return;
        }

        const municipios = items
            .filter(function (item) {
                return item.tipo === "municipio";
            })
            .sort(function (a, b) {
                return String(a.municipio || "")
                    .localeCompare(
                        String(b.municipio || ""),
                        "pt-BR"
                    );
            });

        if (!municipios.length) {
            return;
        }

        grid.innerHTML = municipios.map(function (item) {

            const tags = [];

            if (item.banca) {
                tags.push(item.banca);
            }

            if (
                item.fonte &&
                item.fonte !== item.banca
            ) {
                tags.push(item.fonte);
            }

            if (item.prazo) {
                tags.push(
                    "Prazo: " +
                    formatDeadline(item.prazo)
                );
            }

            const meta = tags.map(function (tag) {
                return `<span>${escapeHTML(tag)}</span>`;
            }).join("");

            return `
                <article class="v10-municipio-card">

                    <div class="v10-municipio-top">

                        <span class="v10-municipio-place">
                            ${escapeHTML(item.municipio)}
                            •
                            ${escapeHTML(item.uf || "CE")}
                        </span>

                        <span class="v10-municipio-status">
                            ${escapeHTML(item.situacao || "ATUALIZAÇÃO")}
                        </span>

                    </div>

                    <h3>
                        ${escapeHTML(item.titulo)}
                    </h3>

                    <p>
                        ${escapeHTML(item.resumo)}
                    </p>

                    <div class="v10-municipio-meta">
                        ${meta}
                    </div>

                    <a
                        class="v10-municipio-link"
                        href="${escapeHTML(item.url || "#")}"
                        target="_blank"
                        rel="noopener noreferrer">

                        Ver concurso

                    </a>

                </article>
            `;

        }).join("");
    }


    function updateStatus(data) {

        const toolbar =
            document.querySelector(".v10-news-toolbar");

        if (!toolbar) {
            return;
        }

        let status =
            document.getElementById("chicoRadarDataStatus");

        if (!status) {

            status = document.createElement("small");

            status.id = "chicoRadarDataStatus";

            status.style.cssText =
                "display:block;" +
                "width:100%;" +
                "margin-top:3px;" +
                "font-size:8px;" +
                "color:var(--muted);";

            toolbar.appendChild(status);
        }

        const date =
            data.atualizado_em || "não informada";

        status.textContent =
            "Banco do Radar atualizado em: " + date;
    }


    function applyFilter(filter) {

        const newsList =
            document.querySelector(".v10-news-list");

        const municipioHeading =
            document.querySelector(".v10-municipio-heading");

        const municipioGrid =
            document.querySelector(".v10-municipio-grid");

        if (filter === "seduc") {

            if (newsList) {
                newsList.style.display = "grid";
            }

            if (municipioHeading) {
                municipioHeading.style.display = "none";
            }

            if (municipioGrid) {
                municipioGrid.style.display = "none";
            }

            return;
        }

        if (filter === "municipios") {

            if (newsList) {
                newsList.style.display = "none";
            }

            if (municipioHeading) {
                municipioHeading.style.display = "flex";
            }

            if (municipioGrid) {
                municipioGrid.style.display = "grid";
            }

            return;
        }

        if (newsList) {
            newsList.style.display = "grid";
        }

        if (municipioHeading) {
            municipioHeading.style.display = "flex";
        }

        if (municipioGrid) {
            municipioGrid.style.display = "grid";
        }
    }


    function bindFilters() {

        document
            .querySelectorAll(".v10-news-filter")
            .forEach(function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const filter =
                            button.dataset.newsFilter || "all";

                        /*
                         * O setTimeout garante que nosso filtro seja
                         * aplicado depois da lógica antiga do HTML.
                         */
                        setTimeout(function () {
                            applyFilter(filter);
                        }, 0);
                    }
                );

            });
    }


    async function loadRadar() {

        try {

            const response = await fetch(
                DATA_URL + "?t=" + Date.now(),
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    "HTTP " + response.status
                );
            }

            const data = await response.json();

            const items = activeItems(data);

            renderTicker(items);
            renderSeducNews(items);
            renderMunicipios(items);
            updateStatus(data);

            console.log(
                "[CHICO RADAR] Banco carregado:",
                items.length,
                "notícias."
            );

        }
        catch (error) {

            /*
             * Não apagamos o conteúdo estático.
             * Se o JSON falhar, a versão embutida continua funcionando.
             */

            console.warn(
                "[CHICO RADAR] Não foi possível carregar noticias.json.",
                error
            );
        }
    }


    function start() {

        bindFilters();
        loadRadar();
    }


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            start
        );

        return;
    }

    start();

})();