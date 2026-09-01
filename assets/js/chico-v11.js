(function(){

    "use strict";


    function getCearaLogo(){

        const sidebar =
            document.querySelector(".sidebar");

        if(!sidebar){
            return null;
        }

        const images =
            Array.from(
                sidebar.querySelectorAll("img")
            );

        if(!images.length){
            return null;
        }

        return (
            images.find(function(img){

                const text = [
                    img.src || "",
                    img.alt || "",
                    img.className || ""
                ]
                .join(" ")
                .toLowerCase();

                return (
                    text.includes("ceara") ||
                    text.includes("ceará") ||
                    text.includes("brasao") ||
                    text.includes("brasão")
                );

            }) ||
            images[0]
        );
    }


    function decorateHero(hero){

        if(
            !hero ||
            hero.dataset.chicoV11Decorated === "1"
        ){
            return;
        }

        hero.dataset.chicoV11Decorated =
            "1";

        const rays =
            document.createElement("div");

        rays.className =
            "chico-v11-rays";

        hero.appendChild(rays);


        const logo =
            getCearaLogo();

        if(logo){

            const watermark =
                logo.cloneNode(true);

            watermark.removeAttribute("id");

            watermark.className =
                "chico-v11-state-watermark";

            watermark.alt = "";

            hero.appendChild(
                watermark
            );
        }
    }


    function findHeroes(){

        const selectors = [

            ".page-hero",
            ".hero",
            ".section-hero",
            ".view-hero",
            ".panel-hero"

        ];

        const found =
            document.querySelectorAll(
                selectors.join(",")
            );

        found.forEach(
            decorateHero
        );
    }


    function decorateFallbackHeaders(){

        const views =
            document.querySelectorAll(
                '[id$="View"], .view, .page'
            );

        views.forEach(function(view){

            if(
                view.offsetParent === null
            ){
                return;
            }

            const first =
                Array.from(view.children)
                    .find(function(el){

                        const text =
                            (el.textContent || "")
                                .trim();

                        return (
                            text.length > 10 &&
                            (
                                el.querySelector("h1") ||
                                el.querySelector("h2")
                            )
                        );

                    });

            if(!first){
                return;
            }

            if(
                first.classList.contains(
                    "question"
                )
            ){
                return;
            }

            if(
                !first.classList.contains(
                    "chico-v11-auto-hero"
                )
            ){

                first.classList.add(
                    "page-hero",
                    "chico-v11-auto-hero"
                );

                decorateHero(first);
            }
        });
    }


    function animateCurrentView(){

        const visible =
            Array.from(
                document.querySelectorAll(
                    '[id$="View"], .view'
                )
            )
            .find(function(el){

                return (
                    el.offsetParent !== null
                );
            });

        if(!visible){
            return;
        }

        visible.classList.remove(
            "chico-v11-view-enter"
        );

        void visible.offsetWidth;

        visible.classList.add(
            "chico-v11-view-enter"
        );
    }


    function decorate(){

        findHeroes();
        decorateFallbackHeaders();
    }


    function bindNavigation(){

        document.addEventListener(
            "click",
            function(event){

                const nav =
                    event.target.closest(
                        ".navbtn"
                    );

                if(!nav){
                    return;
                }

                setTimeout(function(){

                    decorate();
                    animateCurrentView();

                },60);
            }
        );
    }


    function watchApp(){

        const observer =
            new MutationObserver(
                function(){

                    decorate();
                }
            );

        observer.observe(
            document.body,
            {
                childList:true,
                subtree:true
            }
        );
    }


    function start(){

        decorate();
        bindNavigation();
        watchApp();

        setTimeout(
            decorate,
            300
        );
    }


    if(
        document.readyState === "loading"
    ){

        document.addEventListener(
            "DOMContentLoaded",
            start
        );

    } else {

        start();
    }

})();