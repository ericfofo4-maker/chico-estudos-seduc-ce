(function(){

    "use strict";

    const AUTH_KEY = "chico_auth_v1";

    /*
       Credenciais armazenadas como SHA-256.
       Isso evita deixá-las escritas diretamente no código,
       mas NÃO transforma GitHub Pages em autenticação segura.
    */

    const USER_HASH =
        "dd305b180c8c41986569323e0225ad8d6441424ab7df6a426ab38e6074505faa";

    const PASS_HASH =
        "dd305b180c8c41986569323e0225ad8d6441424ab7df6a426ab38e6074505faa";


    function authenticated(){

        return (
            localStorage.getItem(AUTH_KEY) === "1" ||
            sessionStorage.getItem(AUTH_KEY) === "1"
        );
    }


    async function sha256(text){

        const data =
            new TextEncoder().encode(text);

        const hash =
            await crypto.subtle.digest(
                "SHA-256",
                data
            );

        return Array
            .from(new Uint8Array(hash))
            .map(function(byte){
                return byte
                    .toString(16)
                    .padStart(2,"0");
            })
            .join("");
    }


    function setPageState(logged){

        const html =
            document.documentElement;

        html.classList.remove(
            "chico-auth-locked",
            "chico-auth-ok"
        );

        html.classList.add(
            logged
                ? "chico-auth-ok"
                : "chico-auth-locked"
        );
    }


    function finishLogin(remember){

        localStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(AUTH_KEY);

        if(remember){

            localStorage.setItem(
                AUTH_KEY,
                "1"
            );

        } else {

            sessionStorage.setItem(
                AUTH_KEY,
                "1"
            );
        }

        const overlay =
            document.getElementById(
                "chicoLoginOverlay"
            );

        setPageState(true);

        if(overlay){

            overlay.classList.add(
                "is-leaving"
            );

            setTimeout(function(){

                overlay.hidden = true;

            },470);
        }
    }


    function logout(){

        localStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(AUTH_KEY);

        location.reload();
    }



    function createCearaLogo(){

        if(
            document.getElementById(
                "chicoLoginStateLogo"
            )
        ){
            return;
        }

        const brandMain =
            document.querySelector(
                ".chico-login-brand-main"
            );

        if(!brandMain){
            return;
        }

        let originalLogo = null;

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        if(sidebar){

            const images =
                Array.from(
                    sidebar.querySelectorAll("img")
                );

            originalLogo =
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
                        text.includes("brasão") ||
                        text.includes("logo")
                    );

                }) || images[0] || null;
        }


        if(!originalLogo){

            const allImages =
                Array.from(
                    document.querySelectorAll("img")
                );

            originalLogo =
                allImages.find(function(img){

                    if(
                        img.closest(
                            "#chicoLoginOverlay"
                        )
                    ){
                        return false;
                    }

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

                }) || null;
        }


        if(!originalLogo){
            return;
        }


        const wrapper =
            document.createElement("div");

        wrapper.id =
            "chicoLoginStateLogo";

        wrapper.className =
            "chico-login-state-logo";


        const frame =
            document.createElement("div");

        frame.className =
            "chico-login-state-logo-frame";


        const image =
            originalLogo.cloneNode(true);

        image.removeAttribute("id");

        image.className = "";

        image.alt =
            "Brasão do Estado do Ceará";


        const text =
            document.createElement("div");

        text.className =
            "chico-login-state-logo-text";

        text.innerHTML = `
            <strong>ESTADO DO CEARÁ</strong>
            <span>SEDUC-CE • FILOSOFIA</span>
        `;


        frame.appendChild(image);

        wrapper.appendChild(frame);
        wrapper.appendChild(text);

        const brand =
            document.querySelector(
                ".chico-login-brand"
            );

        if(brand){
            brand.appendChild(wrapper);
        }
    }

    function createLogout(){

        if(
            document.getElementById(
                "chicoLogoutButton"
            )
        ){
            return;
        }

        const button =
            document.createElement("button");

        button.id =
            "chicoLogoutButton";

        button.type =
            "button";

        button.className =
            "chico-logout-btn";

        button.innerHTML =
            "↪&nbsp; Sair";

        button.addEventListener(
            "click",
            logout
        );

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        if(sidebar){

            sidebar.appendChild(button);

        } else {

            button.classList.add(
                "chico-logout-floating"
            );

            document.body.appendChild(
                button
            );
        }
    }


    function showError(message){

        const msg =
            document.getElementById(
                "chicoLoginMessage"
            );

        const shell =
            document.querySelector(
                ".chico-login-shell"
            );

        if(msg){
            msg.textContent = message;
        }

        if(shell){

            shell.classList.remove(
                "chico-login-shake"
            );

            void shell.offsetWidth;

            shell.classList.add(
                "chico-login-shake"
            );
        }
    }


    async function submitLogin(event){

        event.preventDefault();

        const userInput =
            document.getElementById(
                "chicoLoginUser"
            );

        const passInput =
            document.getElementById(
                "chicoLoginPassword"
            );

        const remember =
            document.getElementById(
                "chicoLoginRemember"
            );

        const button =
            document.getElementById(
                "chicoLoginSubmit"
            );

        const message =
            document.getElementById(
                "chicoLoginMessage"
            );

        const username =
            userInput.value.trim();

        const password =
            passInput.value;

        if(!username || !password){

            showError(
                "Informe usuário e senha."
            );

            return;
        }

        button.disabled = true;
        button.textContent = "VERIFICANDO...";

        if(message){
            message.textContent = "";
        }

        try{

            const results =
                await Promise.all([
                    sha256(username),
                    sha256(password)
                ]);

            const userHash =
                results[0];

            const passHash =
                results[1];

            if(
                userHash === USER_HASH &&
                passHash === PASS_HASH
            ){

                button.textContent =
                    "ACESSO LIBERADO";

                finishLogin(
                    remember.checked
                );

                setTimeout(function(){

                    button.disabled = false;
                    button.textContent =
                        "ENTRAR NO CHICO";

                },600);

                return;
            }

            showError(
                "Usuário ou senha incorretos."
            );

            passInput.value = "";
            passInput.focus();

        } catch(error){

            showError(
                "Não foi possível validar o acesso."
            );
        }

        button.disabled = false;
        button.textContent =
            "ENTRAR NO CHICO";
    }


    function bindPasswordToggle(){

        const button =
            document.getElementById(
                "chicoTogglePassword"
            );

        const input =
            document.getElementById(
                "chicoLoginPassword"
            );

        if(!button || !input){
            return;
        }

        button.addEventListener(
            "click",
            function(){

                const showing =
                    input.type === "text";

                input.type =
                    showing
                        ? "password"
                        : "text";

                button.textContent =
                    showing
                        ? "◉"
                        : "◎";

                button.setAttribute(
                    "aria-label",
                    showing
                        ? "Mostrar senha"
                        : "Ocultar senha"
                );
            }
        );
    }


    function start(){

        /* CHICO_LOGIN_RESET_ESTAVEL */

        const chicoLoginParams =
            new URLSearchParams(
                window.location.search
            );

        if(
            chicoLoginParams.get("logout") === "1"
        ){
            localStorage.removeItem(AUTH_KEY);
            sessionStorage.removeItem(AUTH_KEY);
        }



        const overlay =
            document.getElementById(
                "chicoLoginOverlay"
            );

        const form =
            document.getElementById(
                "chicoLoginForm"
            );

        createLogout();
        /* painel visual V11 usa a arte aprovada */
        if(authenticated()){

            setPageState(true);

            if(overlay){
                overlay.hidden = true;
            }

            return;
        }

        setPageState(false);

        if(overlay){

            overlay.hidden = false;
            overlay.classList.remove(
                "is-leaving"
            );
        }

        bindPasswordToggle();

        if(form){

            form.addEventListener(
                "submit",
                submitLogin
            );
        }

        setTimeout(function(){

            const user =
                document.getElementById(
                    "chicoLoginUser"
                );

            if(user){
                user.focus();
            }

        },100);
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