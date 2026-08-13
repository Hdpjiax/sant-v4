document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("login-form");
    const errorEl = document.getElementById("auth-error");
    const submitBtn = document.getElementById("btn-login");

    function showError(err) {
        errorEl.textContent = window.formatSupabaseError(err);
        errorEl.classList.add("visible");
    }

    try {
        window.ensureSupabaseReady();
        const session = await window.SantanderAuth.getSession();
        if (session) {
            const profile = await window.SantanderAuth.getProfile();
            window.location.href = profile?.role === "admin" ? "admin.html" : "index.html";
            return;
        }
    } catch (err) {
        showError(err);
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    // Lógica para usuario recordado
    const rememberedUser = localStorage.getItem("santander_last_user");
    const emailField = document.getElementById("email")?.closest(".auth-field");
    const rememberedSec = document.getElementById("remembered-user-section");
    const changeUserBtn = document.getElementById("btn-change-user");
    const titleEl = document.querySelector(".auth-card h1");
    const subtitleEl = document.querySelector(".auth-card .subtitle");

    if (rememberedUser) {
        try {
            const user = JSON.parse(rememberedUser);
            const emailInput = document.getElementById("email");
            if (emailInput) emailInput.value = user.email;

            // Obtener iniciales
            const names = (user.name || "Usuario").split(" ");
            const initials = names.map(n => n[0]).slice(0, 2).join("").toUpperCase();
            const initialsEl = document.getElementById("user-avatar-initials");
            if (initialsEl) initialsEl.textContent = initials || "U";

            // Mensaje de saludo
            const greetingEl = document.getElementById("user-greeting");
            if (greetingEl) greetingEl.textContent = `Hola, ${user.name}`;

            if (rememberedSec) rememberedSec.classList.add("active");
            if (emailField) emailField.style.display = "none";
            if (titleEl) titleEl.style.display = "none";
            if (subtitleEl) subtitleEl.style.display = "none";
        } catch (e) {
            console.error("Error al cargar usuario recordado:", e);
        }
    }

    if (changeUserBtn) {
        changeUserBtn.addEventListener("click", () => {
            localStorage.removeItem("santander_last_user");
            const emailInput = document.getElementById("email");
            if (emailInput) emailInput.value = "";
            if (rememberedSec) rememberedSec.classList.remove("active");
            if (emailField) emailField.style.display = "block";
            if (titleEl) titleEl.style.display = "block";
            if (subtitleEl) subtitleEl.style.display = "block";
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        errorEl.classList.remove("visible");
        submitBtn.disabled = true;
        submitBtn.textContent = "Entrando...";

        try {
            await window.SantanderAuth.signIn(email, password);
            const profile = await window.SantanderAuth.getProfile();

            // Guardar usuario en localStorage
            try {
                const settings = await window.SettingsService.getSettingsByUserId(profile.id);
                localStorage.setItem("santander_last_user", JSON.stringify({
                    email: profile.email,
                    name: settings?.name || profile.email.split("@")[0]
                }));
            } catch (err) {
                localStorage.setItem("santander_last_user", JSON.stringify({
                    email: profile.email,
                    name: profile.email.split("@")[0]
                }));
            }

            if (profile?.role === "admin") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "index.html";
            }
        } catch (err) {
            showError(err);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Entrar";
        }
    });

    // BIOMETRICS LOGIC
    const btnBiometric = document.getElementById("btn-biometric");
    const modalBiometric = document.getElementById("modal-biometric");
    const btnCloseBiometric = document.getElementById("btn-close-biometric");
    const biometricStatus = document.getElementById("biometric-status");

    const checkBiometric = async () => {
        if (window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable("NativeBiometric")) {
            const NativeBiometric = window.Capacitor.Plugins.NativeBiometric;
            try {
                const result = await NativeBiometric.isAvailable();
                if (result.isAvailable) {
                    return true;
                }
            } catch (e) {
                console.error("Biometrics check failed:", e);
            }
        }
        return false;
    };

    if (btnBiometric) {
        btnBiometric.addEventListener("click", async () => {
            if (!rememberedUser) {
                alert("Debes iniciar sesión con contraseña al menos una vez para activar la biometría.");
                return;
            }

            const hasBiometrics = await checkBiometric();
            if (hasBiometrics) {
                const NativeBiometric = window.Capacitor.Plugins.NativeBiometric;
                try {
                    await NativeBiometric.verifyIdentity({
                        reason: "Accede de forma rápida y segura a tu cuenta Santander",
                        title: "Iniciar sesión",
                        subtitle: "Usa tu huella o rostro",
                        description: "Coloca tu dedo en el sensor o escanea tu rostro"
                    });
                    
                    const user = JSON.parse(rememberedUser);
                    window.location.href = user.email.includes("admin") ? "admin.html" : "index.html";
                } catch (err) {
                    console.error("Biometric verification failed:", err);
                    alert("Autenticación biométrica fallida o cancelada.");
                }
            } else {
                // FALLBACK: Simular lectura si no estamos en dispositivo con biometría real
                if (modalBiometric) modalBiometric.classList.add("active");
                if (biometricStatus) biometricStatus.textContent = "Escaneando...";

                setTimeout(async () => {
                    if (biometricStatus) biometricStatus.textContent = "¡Acceso concedido!";
                    setTimeout(async () => {
                        if (modalBiometric) modalBiometric.classList.remove("active");
                        
                        try {
                            const user = JSON.parse(rememberedUser);
                            window.location.href = user.email.includes("admin") ? "admin.html" : "index.html";
                        } catch (e) {
                            if (modalBiometric) modalBiometric.classList.remove("active");
                            alert("Error al validar biometría.");
                        }
                    }, 1000);
                }, 2000);
            }
        });
    }

    if (btnCloseBiometric) {
        btnCloseBiometric.addEventListener("click", () => {
            if (modalBiometric) modalBiometric.classList.remove("active");
        });
    }

    // PRELOGIN MODALS TOGGLES
    const shortcutToken = document.getElementById("shortcut-token");
    const modalToken = document.getElementById("modal-token");
    const btnCloseToken = document.getElementById("btn-close-token");

    const shortcutWithdraw = document.getElementById("shortcut-withdraw");
    const shortcutSupport = document.getElementById("shortcut-support");
    const modalSupport = document.getElementById("modal-support");
    const btnCloseSupport = document.getElementById("btn-close-support");

    // SuperToken pre-login generation
    let preloginTokenInterval = null;

    function generatePreloginToken() {
        const rand = (min, max) => Math.floor(Math.random() * (max - min) + min);
        const codeEl = document.getElementById("prelogin-token-code");
        if (codeEl) {
            codeEl.textContent = `${rand(1000, 9999)} ${rand(1000, 9999)}`;
        }
    }

    function startPreloginTokenTimer() {
        if (preloginTokenInterval) clearInterval(preloginTokenInterval);
        generatePreloginToken();
        
        let timeLeft = 30;
        const timerEl = document.getElementById("prelogin-token-timer");
        const progressEl = document.getElementById("prelogin-token-progress");

        if (timerEl) timerEl.textContent = timeLeft;
        if (progressEl) {
            progressEl.style.transition = "none";
            progressEl.style.width = "100%";
        }

        preloginTokenInterval = setInterval(() => {
            timeLeft--;
            if (timerEl) timerEl.textContent = timeLeft;
            if (progressEl) {
                progressEl.style.transition = "width 1s linear";
                progressEl.style.width = `${(timeLeft / 30) * 100}%`;
            }

            if (timeLeft <= 0) {
                timeLeft = 30;
                generatePreloginToken();
                if (progressEl) {
                    progressEl.style.transition = "none";
                    progressEl.style.width = "100%";
                }
            }
        }, 1000);
    }

    if (shortcutToken) {
        shortcutToken.addEventListener("click", () => {
            if (modalToken) modalToken.classList.add("active");
            
            // Check if active
            const isActivated = localStorage.getItem("santander_token_active") === "true";
            const activationSec = document.getElementById("prelogin-token-activation");
            const displaySec = document.getElementById("prelogin-token-display");

            if (isActivated) {
                if (activationSec) activationSec.classList.add("hidden-view");
                if (displaySec) displaySec.classList.remove("hidden-view");
                startPreloginTokenTimer();
            } else {
                if (activationSec) activationSec.classList.remove("hidden-view");
                if (displaySec) displaySec.classList.add("hidden-view");
            }
        });
    }

    // Mock activate inside pre-login
    const btnPreloginActivateMock = document.getElementById("btn-prelogin-activate-mock");
    if (btnPreloginActivateMock) {
        btnPreloginActivateMock.addEventListener("click", () => {
            localStorage.setItem("santander_token_active", "true");
            const activationSec = document.getElementById("prelogin-token-activation");
            const displaySec = document.getElementById("prelogin-token-display");
            if (activationSec) activationSec.classList.add("hidden-view");
            if (displaySec) displaySec.classList.remove("hidden-view");
            startPreloginTokenTimer();
        });
    }

    if (btnCloseToken) {
        btnCloseToken.addEventListener("click", () => {
            if (modalToken) modalToken.classList.remove("active");
            if (preloginTokenInterval) {
                clearInterval(preloginTokenInterval);
                preloginTokenInterval = null;
            }
        });
    }

    const modalWithdraw = document.getElementById("modal-withdraw");
    const btnCloseWithdraw = document.getElementById("btn-close-withdraw");

    if (shortcutWithdraw) {
        shortcutWithdraw.addEventListener("click", () => {
            if (modalWithdraw) modalWithdraw.classList.add("active");
        });
    }

    if (btnCloseWithdraw) {
        btnCloseWithdraw.addEventListener("click", () => {
            if (modalWithdraw) modalWithdraw.classList.remove("active");
        });
    }

    if (shortcutSupport) {
        shortcutSupport.addEventListener("click", () => {
            if (modalSupport) modalSupport.classList.add("active");
        });
    }

    if (btnCloseSupport) {
        btnCloseSupport.addEventListener("click", () => {
            if (modalSupport) modalSupport.classList.remove("active");
        });
    }
});