document.addEventListener("DOMContentLoaded", async () => {
    const errorEl = document.getElementById("auth-error");

    function showError(err) {
        if (!errorEl) return;
        errorEl.textContent = window.formatSupabaseError ? window.formatSupabaseError(err) : (err.message || String(err));
        errorEl.classList.add("visible");
        setTimeout(() => {
            errorEl.classList.remove("visible");
        }, 5000);
    }

    try {
        if (window.ensureSupabaseReady) window.ensureSupabaseReady();
        if (window.SantanderAuth) {
            const session = await window.SantanderAuth.getSession();
            if (session) {
                const profile = await window.SantanderAuth.getProfile();
                window.location.href = profile?.role === "admin" ? "admin.html" : "index.html";
                return;
            }
        }
    } catch (err) {
        console.warn("Supabase init check:", err);
    }

    // ==================== USER LOGIN STATE ====================
    const rememberedSec = document.getElementById("remembered-user-section");
    const newUserSec = document.getElementById("new-user-section");
    const changeUserBtn = document.getElementById("btn-change-user");
    const changeUserSheetBtn = document.getElementById("btn-change-user-sheet");
    const userGreetingEl = document.getElementById("user-greeting");
    const sheetNameEl = document.getElementById("password-sheet-name");

    function maskName(fullName) {
        if (!fullName) return "Usuario Santander";
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) return parts[0];
        if (parts.length === 2) return `${parts[0]} ${parts[1][0]}*****`;
        
        // E.g. "Natalia Estefani De La Paz Chavez" -> "Natalia Estefani D******** C*****"
        let firstNames = parts.slice(0, 2).join(" ");
        let lastNames = parts.slice(2).map(p => p[0] + "*".repeat(Math.max(4, p.length - 1))).join(" ");
        return `${firstNames} ${lastNames}`;
    }

    const mobileFrame = document.querySelector(".mobile-frame");

    function checkUserState() {
        const rawUser = localStorage.getItem("santander_last_user");
        if (rawUser) {
            try {
                const user = JSON.parse(rawUser);
                const fullName = user.name || user.email.split("@")[0];
                const firstName = fullName.trim().split(/\s+/)[0];

                if (userGreetingEl) userGreetingEl.textContent = firstName;
                if (sheetNameEl) sheetNameEl.textContent = maskName(fullName);

                if (rememberedSec) rememberedSec.classList.add("active");
                if (newUserSec) newUserSec.classList.add("hidden-view");
                if (mobileFrame) mobileFrame.classList.remove("new-user-mode");
                return;
            } catch (e) {
                console.error("Error parsing remembered user:", e);
            }
        }

        // If no user remembered: Show new user login form and hide shortcuts
        if (rememberedSec) rememberedSec.classList.remove("active");
        if (newUserSec) newUserSec.classList.remove("hidden-view");
        if (mobileFrame) mobileFrame.classList.add("new-user-mode");
    }

    checkUserState();

    // Change user handlers
    function clearRememberedUser() {
        localStorage.removeItem("santander_last_user");
        closePasswordSheet();
        checkUserState();
        const emailInput = document.getElementById("email");
        if (emailInput) {
            emailInput.value = "";
            emailInput.focus();
        }
    }

    if (changeUserBtn) changeUserBtn.addEventListener("click", clearRememberedUser);
    if (changeUserSheetBtn) changeUserSheetBtn.addEventListener("click", clearRememberedUser);

    // ==================== REAL IPHONE FACE ID / BIOMETRIC AUTHENTICATION ====================
    async function proceedFaceIdLogin(user) {
        if (btnOpenSheet) {
            btnOpenSheet.disabled = true;
            btnOpenSheet.innerHTML = `<span class="material-icons-outlined btn-face-icon">sync</span><span>Ingresando...</span>`;
        }

        try {
            // Check if existing session is already valid
            const existingSession = await window.SantanderAuth.getSession();
            if (existingSession && existingSession.user?.email === user.email) {
                if (navigator.vibrate) navigator.vibrate([15, 40, 25]);
                const profile = await window.SantanderAuth.getProfile();
                window.location.href = profile?.role === "admin" ? "admin.html" : "index.html";
                return;
            }

            // Otherwise, login with stored credential
            if (user.saved_pwd) {
                const clearPwd = decodeURIComponent(atob(user.saved_pwd));
                await window.SantanderAuth.signIn(user.email, clearPwd);
                if (navigator.vibrate) navigator.vibrate([15, 40, 25]);
                const profile = await window.SantanderAuth.getProfile();
                window.location.href = profile?.role === "admin" ? "admin.html" : "index.html";
                return;
            }

            // If no password saved, open sheet
            openPasswordSheet();
        } catch (err) {
            console.error("Face ID auto-login error:", err);
            openPasswordSheet();
        } finally {
            if (btnOpenSheet) {
                btnOpenSheet.disabled = false;
                btnOpenSheet.innerHTML = `<span class="material-icons-outlined btn-face-icon">face</span><span>Ingresar</span>`;
            }
        }
    }

    async function handleFaceIdOrOpenSheet() {
        const rawUser = localStorage.getItem("santander_last_user");
        if (!rawUser) {
            openPasswordSheet();
            return;
        }

        let user;
        try {
            user = JSON.parse(rawUser);
        } catch (e) {
            openPasswordSheet();
            return;
        }

        // 1. Check Native Capacitor Biometric (iOS Native app)
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeBiometric) {
            try {
                const isAvailable = await window.Capacitor.Plugins.NativeBiometric.isAvailable();
                if (isAvailable) {
                    const verified = await window.Capacitor.Plugins.NativeBiometric.verifyIdentity({
                        reason: "Acceso con Face ID para Santander",
                        title: "Santander México",
                        subtitle: "Inicia sesión con Face ID",
                        negativeButtonText: "Ingresar con contraseña"
                    });
                    if (verified) {
                        await proceedFaceIdLogin(user);
                        return;
                    }
                }
            } catch (e) {
                console.log("Native Face ID dismissed or fallback:", e);
                openPasswordSheet();
                return;
            }
        }

        // 2. Real iPhone / Safari WebAuthn Face ID check (Browser / PWA / Web)
        if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
            try {
                const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (isAvailable) {
                    const challenge = new Uint8Array(32);
                    window.crypto.getRandomValues(challenge);

                    const userId = new Uint8Array(16);
                    window.crypto.getRandomValues(userId);

                    const rpHostname = (window.location.hostname && window.location.hostname !== "localhost" && !window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/))
                        ? window.location.hostname
                        : undefined;

                    const rpConfig = { name: "Santander México" };
                    if (rpHostname) rpConfig.id = rpHostname;

                    const credential = await navigator.credentials.create({
                        publicKey: {
                            challenge: challenge,
                            rp: rpConfig,
                            user: {
                                id: userId,
                                name: user.email || "usuario@santander.com",
                                displayName: user.name || "Usuario Santander"
                            },
                            pubKeyCredParams: [
                                { alg: -7, type: "public-key" },
                                { alg: -257, type: "public-key" }
                            ],
                            authenticatorSelection: {
                                authenticatorAttachment: "platform",
                                userVerification: "required"
                            },
                            timeout: 60000
                        }
                    });

                    if (credential) {
                        await proceedFaceIdLogin(user);
                        return;
                    }
                }
            } catch (err) {
                console.warn("Face ID verification dismissed, opening password sheet:", err);
                openPasswordSheet();
                return;
            }
        }

        // Fallback if not supported
        openPasswordSheet();
    }

    // ==================== PASSWORD BOTTOM SHEET ====================
    const bottomSheet = document.getElementById("password-bottom-sheet");
    const btnOpenSheet = document.getElementById("btn-open-login-sheet");
    const btnCloseSheet = document.getElementById("btn-close-password-sheet");
    const btnCloseSheetBg = document.getElementById("btn-close-password-sheet-bg");
    const rememberedPassword = document.getElementById("remembered-password");
    const btnSubmitRemembered = document.getElementById("btn-submit-remembered-password");
    const toggleVisibility = document.getElementById("toggle-password-visibility");

    function openPasswordSheet() {
        if (bottomSheet) {
            bottomSheet.classList.add("active");
            if (rememberedPassword) {
                rememberedPassword.value = "";
                if (btnSubmitRemembered) {
                    btnSubmitRemembered.disabled = true;
                    btnSubmitRemembered.classList.remove("active");
                }
                setTimeout(() => rememberedPassword.focus(), 250);
            }
        }
    }

    function closePasswordSheet() {
        if (bottomSheet) bottomSheet.classList.remove("active");
    }

    if (btnOpenSheet) btnOpenSheet.addEventListener("click", handleFaceIdOrOpenSheet);
    if (btnCloseSheet) btnCloseSheet.addEventListener("click", closePasswordSheet);
    if (btnCloseSheetBg) btnCloseSheetBg.addEventListener("click", closePasswordSheet);

    if (rememberedPassword && btnSubmitRemembered) {
        rememberedPassword.addEventListener("input", (e) => {
            if (e.target.value.trim().length > 0) {
                btnSubmitRemembered.classList.add("active");
                btnSubmitRemembered.disabled = false;
            } else {
                btnSubmitRemembered.classList.remove("active");
                btnSubmitRemembered.disabled = true;
            }
        });

        rememberedPassword.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !btnSubmitRemembered.disabled) {
                btnSubmitRemembered.click();
            }
        });
    }

    if (toggleVisibility && rememberedPassword) {
        toggleVisibility.addEventListener("click", () => {
            if (rememberedPassword.type === "password") {
                rememberedPassword.type = "text";
                toggleVisibility.textContent = "visibility";
            } else {
                rememberedPassword.type = "password";
                toggleVisibility.textContent = "visibility_off";
            }
        });
    }

    if (btnSubmitRemembered) {
        btnSubmitRemembered.addEventListener("click", async () => {
            const rawUser = localStorage.getItem("santander_last_user");
            if (!rawUser) {
                showError("No se encontró usuario recordado.");
                return;
            }
            const passwordVal = rememberedPassword ? rememberedPassword.value : "";
            if (!passwordVal) {
                showError("Ingresa tu contraseña.");
                return;
            }

            try {
                btnSubmitRemembered.disabled = true;
                btnSubmitRemembered.textContent = "Ingresando...";

                const user = JSON.parse(rawUser);
                await window.SantanderAuth.signIn(user.email, passwordVal);
                const profile = await window.SantanderAuth.getProfile();

                // Update remembered password
                user.saved_pwd = btoa(encodeURIComponent(passwordVal));
                localStorage.setItem("santander_last_user", JSON.stringify(user));

                window.location.href = profile?.role === "admin" ? "admin.html" : "index.html";
            } catch (err) {
                showError(err);
                btnSubmitRemembered.disabled = false;
                btnSubmitRemembered.textContent = "Continuar";
            }
        });
    }

    // ==================== NEW USER FORM LOGIN ====================
    const loginForm = document.getElementById("login-form");
    const btnLogin = document.getElementById("btn-login");
    const newUserPwd = document.getElementById("password");
    const toggleNewUserPwd = document.getElementById("toggle-new-user-pwd");

    if (toggleNewUserPwd && newUserPwd) {
        toggleNewUserPwd.addEventListener("click", () => {
            if (newUserPwd.type === "password") {
                newUserPwd.type = "text";
                toggleNewUserPwd.textContent = "visibility";
            } else {
                newUserPwd.type = "password";
                toggleNewUserPwd.textContent = "visibility_off";
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById("email");
            const passwordInput = document.getElementById("password");

            const email = emailInput ? emailInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";

            if (!email || !password) return;

            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.textContent = "Entrando...";
            }

            try {
                await window.SantanderAuth.signIn(email, password);
                const profile = await window.SantanderAuth.getProfile();

                // Save user to localStorage
                let userName = profile.email.split("@")[0];
                try {
                    const settings = await window.SettingsService.getSettingsByUserId(profile.id);
                    if (settings?.name) userName = settings.name;
                } catch (err) {
                    console.warn("Could not fetch settings name:", err);
                }

                localStorage.setItem("santander_last_user", JSON.stringify({
                    email: profile.email,
                    name: userName,
                    saved_pwd: btoa(encodeURIComponent(password))
                }));

                window.location.href = profile?.role === "admin" ? "admin.html" : "index.html";
            } catch (err) {
                showError(err);
                if (btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.textContent = "Entrar";
                }
            }
        });
    }

    // ==================== STORIES CAROUSEL LOGIC ====================
    const slidesData = [
        {
            tag: "EVITA UNAS VACACIONES DE TERROR",
            title: "Reserva y compra paquetes solo en sitios oficiales.",
            link: "Conoce más"
        },
        {
            tag: "CÁMBIATE A SANTANDER",
            title: "Trae tu nómina y llévatela mejor con tu quincena.",
            link: "Conoce más"
        },
        {
            tag: "REGRESAN LOS DÍAS SANTANDER",
            title: "Aprovecha 3 MSI en supermercados participantes, en toda la tienda.",
            link: "Conoce más"
        },
        {
            tag: "ABRE TU DÉBITO LIKEU",
            title: "Recibe hasta $500 de Cashback y controla todo desde la app.",
            link: "Conoce más"
        },
        {
            tag: "SANTANDER MÓVIL",
            title: "Tus finanzas siempre seguras, siempre a tu alcance.",
            link: "Conoce más"
        }
    ];

    let currentSlideIndex = 0;
    const slideDuration = 5000;
    let slideTimer = null;

    const bgSlides = document.querySelectorAll(".carousel-slide-bg");
    const progressTracks = document.querySelectorAll(".progress-bar-track");
    const tagEl = document.getElementById("onboarding-tag");
    const titleEl = document.getElementById("onboarding-title");
    const descEl = document.getElementById("onboarding-desc");

    function renderSlide(index) {
        currentSlideIndex = (index + slidesData.length) % slidesData.length;

        bgSlides.forEach((slide, i) => {
            slide.classList.toggle("active", i === currentSlideIndex);
        });

        progressTracks.forEach((track, i) => {
            track.classList.remove("active", "filled");
            const fill = track.querySelector(".progress-bar-fill");
            if (fill) fill.style.transition = "";

            if (i < currentSlideIndex) {
                track.classList.add("filled");
            } else if (i === currentSlideIndex) {
                // Trigger animation reset
                void track.offsetWidth;
                track.classList.add("active");
            }
        });

        const data = slidesData[currentSlideIndex];
        if (tagEl) tagEl.textContent = data.tag;
        if (titleEl) titleEl.textContent = data.title;
        if (descEl) {
            descEl.innerHTML = `${data.link} <span class="material-icons-outlined" style="font-size: 15px; vertical-align: middle; margin-left: 2px;">arrow_forward</span>`;
        }

        resetTimer();
    }

    function nextSlide() {
        renderSlide(currentSlideIndex + 1);
    }

    function prevSlide() {
        renderSlide(currentSlideIndex - 1);
    }

    function resetTimer() {
        if (slideTimer) clearInterval(slideTimer);
        slideTimer = setInterval(nextSlide, slideDuration);
    }

    // Tap zones for stories
    const tapPrev = document.getElementById("stories-tap-prev");
    const tapNext = document.getElementById("stories-tap-next");

    if (tapPrev) tapPrev.addEventListener("click", prevSlide);
    if (tapNext) tapNext.addEventListener("click", nextSlide);

    renderSlide(0);

    // ==================== PRELOGIN SHORTCUT MODALS ====================
    function setupModal(triggerId, modalId, closeIds = []) {
        const trigger = document.getElementById(triggerId);
        const modal = document.getElementById(modalId);
        if (!trigger || !modal) return;

        trigger.addEventListener("click", () => {
            modal.classList.add("active");
        });

        closeIds.forEach(id => {
            const closeBtn = document.getElementById(id);
            if (closeBtn) {
                closeBtn.addEventListener("click", () => {
                    modal.classList.remove("active");
                });
            }
        });
    }

    setupModal("shortcut-transfer", "modal-transfer", ["btn-close-transfer", "btn-close-transfer-bg"]);
    setupModal("shortcut-withdraw", "modal-withdraw", ["btn-close-withdraw", "btn-close-withdraw-bg"]);
    setupModal("shortcut-update", "modal-update", ["btn-close-update", "btn-close-update-bg"]);
    setupModal("shortcut-support", "modal-support", ["btn-close-support", "btn-close-support-bg"]);

    const btnTransferPrompt = document.getElementById("btn-transfer-login-prompt");
    if (btnTransferPrompt) {
        btnTransferPrompt.addEventListener("click", () => {
            const modalTransfer = document.getElementById("modal-transfer");
            if (modalTransfer) modalTransfer.classList.remove("active");
            
            const rawUser = localStorage.getItem("santander_last_user");
            if (rawUser) {
                openPasswordSheet();
            } else {
                const emailInput = document.getElementById("email");
                if (emailInput) emailInput.focus();
            }
        });
    }

    // ==================== SUPERTOKEN LIVE GENERATOR ====================
    const shortcutToken = document.getElementById("shortcut-token");
    const modalToken = document.getElementById("modal-token");
    const btnCloseToken = document.getElementById("btn-close-token");
    const btnCloseTokenBg = document.getElementById("btn-close-token-bg");
    let tokenInterval = null;

    function generateTokenCode() {
        const rand = (min, max) => Math.floor(Math.random() * (max - min) + min);
        const codeEl = document.getElementById("prelogin-token-code");
        if (codeEl) {
            codeEl.textContent = `${rand(1000, 9999)} ${rand(1000, 9999)}`;
        }
    }

    function startTokenTimer() {
        if (tokenInterval) clearInterval(tokenInterval);
        generateTokenCode();
        let timeLeft = 30;

        const timerEl = document.getElementById("prelogin-token-timer");
        const progressEl = document.getElementById("prelogin-token-progress");

        if (timerEl) timerEl.textContent = timeLeft;
        if (progressEl) {
            progressEl.style.transition = "none";
            progressEl.style.width = "100%";
        }

        tokenInterval = setInterval(() => {
            timeLeft--;
            if (timerEl) timerEl.textContent = timeLeft;
            if (progressEl) {
                progressEl.style.transition = "width 1s linear";
                progressEl.style.width = `${(timeLeft / 30) * 100}%`;
            }

            if (timeLeft <= 0) {
                timeLeft = 30;
                generateTokenCode();
                if (progressEl) {
                    progressEl.style.transition = "none";
                    progressEl.style.width = "100%";
                }
            }
        }, 1000);
    }

    if (shortcutToken) {
        shortcutToken.addEventListener("click", () => {
            if (modalToken) {
                modalToken.classList.add("active");
                startTokenTimer();
            }
        });
    }

    const closeTokenModal = () => {
        if (modalToken) modalToken.classList.remove("active");
        if (tokenInterval) {
            clearInterval(tokenInterval);
            tokenInterval = null;
        }
    };

    if (btnCloseToken) btnCloseToken.addEventListener("click", closeTokenModal);
    if (btnCloseTokenBg) btnCloseTokenBg.addEventListener("click", closeTokenModal);
});