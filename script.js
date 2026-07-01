document.addEventListener("DOMContentLoaded", async () => {

    // ==================== UTILIDADES BÁSICAS ====================
    function formatDateString(dateInput) {
        if (!dateInput) return "Hoy";

        const parts = dateInput.split("-");
        if (parts.length !== 3) return dateInput;

        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const day = parseInt(parts[2], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;

        return `${day} ${months[monthIndex] || ""}`;
    }

    function getTodayString() {
        const d = new Date();
        return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
    }

    function getMovementHeader(dateInput) {
        if (!dateInput) return "hoy";

        const parts = dateInput.split("-");
        if (parts.length !== 3) return dateInput;

        const year = parts[0];
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(Number(year), month, day);

        if (Number.isNaN(date.getTime())) return dateInput;

        const weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

        return `${weekdays[date.getDay()]} ${day} de ${months[month]}, ${year}`;
    }

    function formatAmount(value) {
        const cleanValue = String(value || "0").replace(/[^\d.-]/g, "");
        const num = Number(cleanValue);

        if (Number.isNaN(num)) return String(value || "0.00");

        return num.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function getMaskedCardReference(cardNumber) {
        const digits = String(cardNumber || "").replace(/\D/g, "");

        if (digits.length >= 8) {
            return `${digits.slice(0, 4)}••${digits.slice(-4)}`;
        }

        return `••••${digits.slice(-4) || "9096"}`;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function on(id, eventName, handler) {
        const element = document.getElementById(id);
        if (element) element.addEventListener(eventName, handler);
    }

    // ==================== AUTENTICACIÓN Y AJUSTES REMOTOS ====================
    const session = await window.SantanderAuth.requireSession("register.html");
    if (!session) return;

    const userProfile = await window.SantanderAuth.getProfile();

    let userSettings;
    try {
        userSettings = await window.SettingsService.getMySettings();
    } catch (error) {
        console.error("Error cargando ajustes:", error);
        alert("No se pudieron cargar tus ajustes. Contacta al administrador.");
        return;
    }

    let currentMovs = userSettings.movements;
    let movementFilter = "all";

    function renderMovsApp() {
        const containerDetail = document.getElementById("movements-container");
        const containerStatement = document.getElementById("statement-movements-container");

        let htmlDetail = "";
        let htmlStatement = "";

        const sortedMovs = [...currentMovs].sort((a, b) => new Date(b.date) - new Date(a.date));
        const filteredMovs = sortedMovs.filter(m => movementFilter === "all" ? true : m.type === movementFilter);

        const groupedMovs = filteredMovs.reduce((acc, mov) => {
            const headerDate = getMovementHeader(mov.date);
            if (!acc[headerDate]) acc[headerDate] = [];
            acc[headerDate].push(mov);
            return acc;
        }, {});

        Object.entries(groupedMovs).forEach(([headerDate, movs]) => {
            htmlDetail += `
                <div class="movement-group">
                    <div class="movement-day-header">${escapeHtml(headerDate)}</div>
                    <div class="movement-group-items">
            `;

            movs.forEach((m, index) => {
                const isPositive = m.type === "positive";
                const amount = formatAmount(m.amount);
                const referenceText = m.reference || "";

                htmlDetail += `
                    <div class="santander-movement-item ${index === 0 ? "first-in-day" : ""}">
                        <div class="movement-side-icon ${isPositive ? "is-positive" : "is-negative"}">
                            <span class="material-icons-outlined">${isPositive ? "arrow_upward" : "arrow_downward"}</span>
                        </div>

                        <div class="movement-content">
                            <div class="movement-topline">
                                <span class="movement-name">${escapeHtml(m.title)}</span>
                                ${m.location ? `<span class="movement-location">${escapeHtml(m.location)}</span>` : ""}
                            </div>
                            ${referenceText ? `<span class="movement-reference">${escapeHtml(referenceText)}</span>` : ""}
                        </div>

                        <div class="movement-amount">
                            ${isPositive ? "" : "-"}${amount}<span>MXN</span>
                        </div>
                    </div>
                `;
            });

            htmlDetail += `
                    </div>
                </div>
            `;
        });

        if (!htmlDetail) {
            htmlDetail = `<div class="empty-movements">No hay movimientos para este filtro.</div>`;
        }

        sortedMovs.forEach(m => {
            const isPositive = m.type === "positive";
            const formattedDate = formatDateString(m.date);
            const amount = formatAmount(m.amount);

            htmlStatement += `
                <div class="movement-item" style="background: #FFF; padding-left: 20px; padding-right: 20px;">
                    <div class="mov-icon ${isPositive ? "green-icon" : ""}">
                        <span class="material-icons-outlined">${isPositive ? "arrow_downward" : "shopping_cart"}</span>
                    </div>
                    <div class="mov-details">
                        <span class="mov-title">${escapeHtml(m.title)}</span>
                        <span class="mov-date">${escapeHtml(formattedDate)}</span>
                    </div>
                    <div class="mov-amount ${isPositive ? "positive" : ""}">
                        ${isPositive ? "+" : "-"}$${amount}
                    </div>
                </div>
            `;
        });

        if (containerDetail) containerDetail.innerHTML = htmlDetail;
        if (containerStatement) containerStatement.innerHTML = htmlStatement;
    }

    // ==================== FUNCIONES DE CARGA ====================
    const globalLoader = document.getElementById("global-loader");
    const loaderTextMsg = document.getElementById("loader-text");

    window.showLoader = function (text = "Cargando...") {
        if (loaderTextMsg) loaderTextMsg.textContent = text;
        if (globalLoader) globalLoader.classList.remove("hidden-loader");
    };

    window.hideLoader = function () {
        if (globalLoader) globalLoader.classList.add("hidden-loader");
    };

    // ==================== MENÚ LATERAL ====================
    const sidebar = document.getElementById("sidebar-menu");
    const sidebarOverlay = document.getElementById("sidebar-overlay");

    function openSidebar() {
        if (sidebarOverlay) sidebarOverlay.classList.add("active");
        if (sidebar) sidebar.classList.add("active");

        const sidebarName = document.getElementById("sidebar-name");
        if (sidebarName) sidebarName.textContent = userSettings.name;
    }

    function closeSidebar() {
        if (sidebarOverlay) sidebarOverlay.classList.remove("active");
        if (sidebar) sidebar.classList.remove("active");
    }

    on("btn-open-sidebar-home", "click", openSidebar);
    on("btn-open-sidebar-detail", "click", openSidebar);
    on("btn-open-sidebar-account", "click", openSidebar);
    on("btn-close-sidebar", "click", closeSidebar);
    on("btn-close-home-hot-banner", "click", () => {
        const banner = document.getElementById("home-hot-banner");
        if (banner) banner.style.display = "none";
    });
    if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

    // Ocultar ajustes locales — el admin los gestiona remotamente
    const settingsLink = document.getElementById("open-config-from-sidebar");
    if (settingsLink) settingsLink.style.display = "none";

    if (userProfile?.role === "admin") {
        const sidebarLinks = document.querySelector(".sidebar-links");
        if (sidebarLinks) {
            const adminLink = document.createElement("a");
            adminLink.href = "admin.html";
            adminLink.innerHTML = '<span class="material-icons-outlined">admin_panel_settings</span> Panel Admin';
            adminLink.style.color = "var(--santander-red)";
            adminLink.style.fontWeight = "600";
            sidebarLinks.insertBefore(adminLink, sidebarLinks.querySelector("hr"));
        }
    }

    document.querySelector(".logout-link")?.addEventListener("click", (e) => {
        e.preventDefault();
        closeSidebar();
        window.SantanderAuth.signOut();
    });

    // ==================== CARGAR DATOS VISIBLES ====================
    function renderCardNetworkLogo(container, brandValue) {
        if (!container) return;

        const normalizedBrand = String(brandValue || "VISA").toLowerCase();

        container.classList.remove("is-visa", "is-mastercard");

        if (normalizedBrand.includes("mastercard")) {
            container.classList.add("is-mastercard");
            container.setAttribute("aria-label", "Mastercard");
        } else {
            container.classList.add("is-visa");
            container.setAttribute("aria-label", "VISA");
        }
    }

    function renderAllCardNetworkLogos() {
        const brandValue = userSettings?.brand || "VISA";
        document.querySelectorAll(".dynamic-card-network").forEach(container => {
            renderCardNetworkLogo(container, brandValue);
        });
    }
    const displayName = document.getElementById("display-name");
    const displaySubtitle = document.getElementById("display-subtitle");
    const displayAccount = document.getElementById("display-account");
    const displayPhone = document.getElementById("display-phone");
    const displayFullCard = document.getElementById("display-full-card");
    const displayBrand = document.getElementById("display-brand");
    const displayExp = document.getElementById("display-exp");
    const detailAccountNumber = document.getElementById("detail-account-number");
    const detailCardRef = document.getElementById("detail-card-ref");
    const overviewAccountNumber = document.getElementById("overview-account-number");
    const overviewCardRef = document.getElementById("overview-card-ref");
    const displayAccountDetail = document.getElementById("display-account-detail");

    function applyUserSettings(settings) {
        userSettings = settings;
        currentMovs = settings.movements;

        const userName = settings.name || "Usuario";
        const userSubtitle = settings.subtitle || "";
        const balance = settings.balance || "0.00";
        const formattedBalance = formatAmount(balance);
        const account = settings.account || "14**0000";
        const phone = settings.phone || "";
        const fullCard = settings.full_card || "4152 0000 0000 0000";
        const brand = settings.brand || "VISA";
        const exp = settings.exp || "12/28";
        const maskedCardRef = getMaskedCardReference(fullCard);

        if (displayName) displayName.textContent = userName;
        if (displaySubtitle) displaySubtitle.textContent = userSubtitle;
        if (displayAccount) displayAccount.textContent = account;
        if (displayPhone) displayPhone.textContent = phone;
        if (displayFullCard) displayFullCard.textContent = fullCard;
        if (displayBrand) renderCardNetworkLogo(displayBrand, brand);
        renderAllCardNetworkLogos();
        if (displayExp) displayExp.textContent = exp;
        if (detailAccountNumber) detailAccountNumber.textContent = account;
        if (detailCardRef) detailCardRef.textContent = maskedCardRef;
        if (overviewAccountNumber) overviewAccountNumber.textContent = account;
        if (overviewCardRef) overviewCardRef.textContent = "TDC " + maskedCardRef;
        if (displayAccountDetail) displayAccountDetail.textContent = account;

        if (modalFullCardNumber) modalFullCardNumber.textContent = fullCard;
        if (modalCardExp) modalCardExp.textContent = exp;

        document.querySelectorAll(".dynamic-balance").forEach(el => {
            el.textContent = formattedBalance;
        });

        const sidebarName = document.getElementById("sidebar-name");
        if (sidebarName) sidebarName.textContent = userName;

        renderMovsApp();
    }

    // ==================== NAVEGACIÓN GLOBAL SPA ====================
    let historyStack = ["home-view"];
    let cvvInterval;
    let cardlessInterval;
    // ==================== MODAL TARJETA DIGITAL ====================
    const digitalCardModal = document.getElementById("digital-card-modal");
    const modalCvvNumber = document.getElementById("modal-dynamic-cvv");
    const modalCvvTimer = document.getElementById("modal-cvv-timer");
    const modalCvvProgress = document.getElementById("modal-cvv-progress");
    const modalFullCardNumber = document.getElementById("modal-full-card-number");
    const modalCardExp = document.getElementById("modal-card-exp");

    let modalCvvInterval;

    applyUserSettings(userSettings);

    function formatModalCvv(value) {
        return String(value).split("").join(" ");
    }

    function copyText(value) {
        const text = String(value || "").trim();
        if (!text) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => window.showToast("Copiado al portapapeles"));
            return;
        }

        const tempInput = document.createElement("textarea");
        tempInput.value = text;
        tempInput.style.position = "fixed";
        tempInput.style.opacity = "0";
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        tempInput.remove();

        window.showToast("Copiado al portapapeles");
    }

    function startModalCvvTimer() {
        const randomCvv = Math.floor(100 + Math.random() * 900);
        let timeLeft = 180;
        const totalTime = 180;

        clearInterval(modalCvvInterval);

        if (modalCvvNumber) {
            modalCvvNumber.textContent = formatModalCvv(randomCvv);
        }

        const updateModalTimer = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const progress = Math.max(0, (timeLeft / totalTime) * 100);

            if (modalCvvTimer) {
                modalCvvTimer.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
            }

            if (modalCvvProgress) {
                modalCvvProgress.style.width = `${progress}%`;
            }

            if (timeLeft <= 0) {
                clearInterval(modalCvvInterval);

                if (modalCvvNumber) {
                    modalCvvNumber.textContent = "---";
                }

                window.showToast("Tu CVV dinámico ha expirado.");
                return;
            }

            timeLeft--;
        };

        updateModalTimer();
        modalCvvInterval = setInterval(updateModalTimer, 1000);
    }

    function openDigitalCardModal() {
        if (!cardIsActive) {
            window.showToast("Enciende tu tarjeta primero para generar un CVV.");
            return;
        }

        if (!digitalCardModal) return;

        window.showLoader("Generando tarjeta digital...");

        setTimeout(() => {
            window.hideLoader();

            digitalCardModal.classList.remove("hidden-digital-card-modal");
            digitalCardModal.setAttribute("aria-hidden", "false");

            startModalCvvTimer();
        }, 900);
    }

    function closeDigitalCardModal() {
        if (!digitalCardModal) return;

        digitalCardModal.classList.add("hidden-digital-card-modal");
        digitalCardModal.setAttribute("aria-hidden", "true");

        clearInterval(modalCvvInterval);
    }

    on("btn-close-digital-card-modal", "click", closeDigitalCardModal);
    on("digital-card-backdrop", "click", closeDigitalCardModal);

    on("btn-copy-modal-cvv", "click", () => {
        copyText((modalCvvNumber?.textContent || "").replace(/\s/g, ""));
    });

    on("btn-copy-modal-card", "click", () => {
        copyText(userSettings.full_card);
    });

    on("btn-copy-modal-exp", "click", () => {
        copyText(userSettings.exp);
    });
    function navigateTo(viewId, loaderMsg = "Cargando...", delay = 400) {

        const currentView = historyStack[historyStack.length - 1];
        if (currentView === viewId) return;

        const currentViewElement = document.getElementById(currentView);
        const nextViewElement = document.getElementById(viewId);
        closeSidebar();
        document.body.style.overflowX = "hidden";

        if (!currentViewElement || !nextViewElement) return;

        window.showLoader(loaderMsg);

        setTimeout(() => {
            currentViewElement.classList.replace("view-active", "hidden-view");
            nextViewElement.classList.replace("hidden-view", "view-active");
            historyStack.push(viewId);
            window.hideLoader();
        }, delay);
    }

    function goBack() {
        closeSidebar();
        document.body.style.overflowX = "hidden";
        if (historyStack.length > 1) {
            window.showLoader("");

            setTimeout(() => {
                const currentView = historyStack.pop();
                const previousView = historyStack[historyStack.length - 1];

                if (currentView === "cvv-view") clearInterval(cvvInterval);
                if (currentView === "cardless-active-view") clearInterval(cardlessInterval);
                if (currentView === "nip-view") clearInterval(nipInterval);

                const currentViewElement = document.getElementById(currentView);
                const previousViewElement = document.getElementById(previousView);

                if (currentViewElement && previousViewElement) {
                    currentViewElement.classList.replace("view-active", "hidden-view");
                    previousViewElement.classList.replace("hidden-view", "view-active");
                }

                window.hideLoader();
            }, 300);
        }
    }

    window.goHome = function () {
        closeSidebar();
        document.body.style.overflowX = "hidden";
        const currentView = historyStack[historyStack.length - 1];
        if (currentView === "home-view") return;

        window.showLoader("");

        setTimeout(() => {
            clearInterval(cvvInterval);
            clearInterval(cardlessInterval);
            clearInterval(nipInterval);
            closeDigitalCardModal();

            const currentViewElement = document.getElementById(currentView);
            const homeViewElement = document.getElementById("home-view");

            if (currentViewElement && homeViewElement) {
                currentViewElement.classList.replace("view-active", "hidden-view");
                homeViewElement.classList.replace("hidden-view", "view-active");
            }

            historyStack = ["home-view"];
            window.hideLoader();
        }, 300);
    };

    document.querySelectorAll(".back-btn").forEach(btn => btn.addEventListener("click", goBack));
    document.querySelectorAll(".btn-home-action").forEach(btn => btn.addEventListener("click", window.goHome));

    on("open-card-details", "click", () => navigateTo("account-overview-view", "Consultando cuenta...", 600));
    on("btn-open-card-info", "click", openDigitalCardModal);
    on("btn-open-card-info-from-overview", "click", openDigitalCardModal);
    on("btn-overview-card-info", "click", openDigitalCardModal);
    on("btn-overview-movements", "click", () => navigateTo("detail-view", "Consultando movimientos...", 600));
    on("btn-overview-transfer", "click", () => navigateTo("transfer-view", "Preparando módulo de pagos..."));
    on("btn-overview-pay", "click", () => navigateTo("pay-cards-view", "Consultando adeudos..."));
    on("btn-overview-topup", "click", () => navigateTo("topup-view"));
    on("btn-overview-cardless", "click", () => navigateTo("cardless-view", "Conectando con red de cajeros..."));
    on("btn-nav-transfer", "click", () => navigateTo("transfer-view", "Preparando módulo de pagos..."));
    on("btn-nav-retiro", "click", () => navigateTo("cardless-view", "Conectando con red de cajeros..."));
    on("btn-nav-pagar", "click", () => navigateTo("pay-cards-view", "Consultando adeudos..."));
    on("btn-nav-recargar", "click", () => navigateTo("topup-view"));
    on("btn-nav-ofertas", "click", () => navigateTo("offers-view", "Buscando beneficios..."));
    on("btn-action-transfer", "click", () => navigateTo("transfer-view", "Preparando pago...", 500));
    on("btn-action-statement", "click", () => navigateTo("statement-view", "Descargando movimientos...", 800));

    // ==================== ACORDEONES Y TOASTS ====================
    document.querySelectorAll(".menu-accordion").forEach(acc => {
        const header = acc.querySelector(".menu-header");
        if (header) header.addEventListener("click", () => acc.classList.toggle("active"));
    });

    const toastContainer = document.getElementById("toast-container");

    window.showToast = function (message) {
        if (!toastContainer) return;

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => toast.remove(), 2800);
    };

    on("btn-sync", "click", async () => {
        window.showLoader("Sincronizando información...");
        try {
            const freshSettings = await window.SettingsService.getMySettings();
            applyUserSettings(freshSettings);
            window.showToast("Información actualizada correctamente");
        } catch (error) {
            window.showToast("Error al sincronizar. Intenta de nuevo.");
        } finally {
            window.hideLoader();
        }
    });

    on("btn-close-promo", "click", () => {
        const promo = document.getElementById("promo-banner-container");
        if (promo) promo.style.display = "none";
    });

    document.querySelectorAll(".filter-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.remove("active"));
            btn.classList.add("active");
            movementFilter = btn.dataset.filter || "all";
            renderMovsApp();
        });
    });

    on("btn-load-older-movements", "click", () => {
        window.showToast("No hay movimientos anteriores por el momento.");
    });

    // ==================== APAGAR / ENCENDER TARJETA ====================
    let cardIsActive = true;
    const virtualCard = document.querySelector("#card-info-view .virtual-card");
    const toggleCardIcon = document.getElementById("toggle-card-icon");
    const toggleCardText = document.getElementById("toggle-card-text");
    const cardStatusText = document.getElementById("card-status-text");

    on("btn-action-toggle", "click", () => {
        window.showLoader("Actualizando preferencias de seguridad...");

        setTimeout(() => {
            window.hideLoader();
            cardIsActive = !cardIsActive;

            if (!cardIsActive) {
                if (virtualCard) virtualCard.classList.add("card-off-state");
                if (toggleCardIcon) toggleCardIcon.style.color = "#767676";
                if (toggleCardText) toggleCardText.textContent = "Encender tarjeta";
                if (cardStatusText) cardStatusText.textContent = "Apagada";
                window.showToast("Tarjeta apagada.");
            } else {
                if (virtualCard) virtualCard.classList.remove("card-off-state");
                if (toggleCardIcon) toggleCardIcon.style.color = "var(--santander-red)";
                if (toggleCardText) toggleCardText.textContent = "Apagar tarjeta";
                if (cardStatusText) cardStatusText.textContent = "Activa";
                window.showToast("Tarjeta encendida y lista para usarse.");
            }
        }, 1200);
    });
    // ==================== FUNCIONALIDADES CUENTA DIGITAL ====================
    const overviewMainCard = document.querySelector("#account-overview-view .account-main-card");
    const overviewPowerText = document.getElementById("overview-card-power-text");
    const overviewPowerIcon = document.getElementById("overview-card-power-icon");
    const modalCardSwitch = document.getElementById("modal-card-switch");

    function syncDigitalCardStatus() {
        if (overviewMainCard) {
            overviewMainCard.classList.toggle("card-off-state", !cardIsActive);
        }

        if (overviewPowerText) {
            overviewPowerText.textContent = cardIsActive ? "Apagar tarjeta digital" : "Prender tarjeta digital";
        }

        if (overviewPowerIcon) {
            overviewPowerIcon.textContent = cardIsActive ? "power_settings_new" : "power";
        }

        if (modalCardSwitch) {
            modalCardSwitch.classList.toggle("is-on", cardIsActive);
            modalCardSwitch.setAttribute(
                "aria-label",
                cardIsActive ? "Tarjeta digital prendida" : "Tarjeta digital apagada"
            );
        }
    }

    function toggleDigitalCardStatus() {
        window.showLoader("Actualizando preferencias de seguridad...");

        setTimeout(() => {
            cardIsActive = !cardIsActive;
            syncDigitalCardStatus();
            window.hideLoader();

            window.showToast(cardIsActive ? "Tarjeta digital prendida." : "Tarjeta digital apagada.");
        }, 900);
    }

    on("btn-overview-toggle-card", "click", toggleDigitalCardStatus);
    on("modal-card-switch", "click", toggleDigitalCardStatus);

    syncDigitalCardStatus();

    // Difiere tus compras
    let selectedDeferIndex = 0;

    function renderDeferrablePurchases() {
        const list = document.getElementById("defer-purchases-list");
        if (!list) return;

        const purchases = currentMovs
            .filter(m => m.type === "negative")
            .slice(0, 4);

        if (!purchases.length) {
            list.innerHTML = `<div class="empty-movements">No hay compras disponibles para diferir.</div>`;
            return;
        }

        selectedDeferIndex = 0;

        list.innerHTML = purchases.map((purchase, index) => {
            const amount = formatAmount(purchase.amount);

            return `
            <button class="deferrable-purchase ${index === 0 ? "active" : ""}" type="button" data-defer-index="${index}">
                <div>
                    <strong>${escapeHtml(purchase.title)}</strong>
                    <span>${escapeHtml(formatDateString(purchase.date))}</span>
                </div>
                <em>$${amount}</em>
            </button>
        `;
        }).join("");

        list.querySelectorAll(".deferrable-purchase").forEach(btn => {
            btn.addEventListener("click", () => {
                list.querySelectorAll(".deferrable-purchase").forEach(item => item.classList.remove("active"));
                btn.classList.add("active");
                selectedDeferIndex = Number(btn.dataset.deferIndex || 0);
            });
        });
    }

    on("btn-overview-defer", "click", () => {
        renderDeferrablePurchases();
        navigateTo("defer-view", "Buscando compras diferibles...", 700);
    });

    on("btn-confirm-defer", "click", () => {
        const months = document.getElementById("defer-months")?.value || "6";

        window.showLoader("Calculando plan de pagos...");

        setTimeout(() => {
            window.hideLoader();
            window.showToast(`Compra diferida a ${months} meses correctamente.`);
        }, 1200);
    });

    // Generación de NIP
    let nipInterval;

    function startNipTimer() {
        const nipNumber = document.getElementById("dynamic-nip-number");
        const nipTimer = document.getElementById("nip-timer");

        let timeLeft = 180;
        clearInterval(nipInterval);

        const nip = Math.floor(1000 + Math.random() * 9000);

        if (nipNumber) nipNumber.textContent = nip;

        const updateNipTimer = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;

            if (nipTimer) {
                nipTimer.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
            }

            if (timeLeft <= 0) {
                clearInterval(nipInterval);
                if (nipNumber) nipNumber.textContent = "----";
                window.showToast("Tu NIP temporal ha expirado.");
                return;
            }

            timeLeft--;
        };

        updateNipTimer();
        nipInterval = setInterval(updateNipTimer, 1000);
    }

    on("btn-overview-nip", "click", () => {
        navigateTo("nip-view", "Generando NIP seguro...", 900);
        setTimeout(startNipTimer, 950);
    });

    on("btn-regenerate-nip", "click", () => {
        window.showLoader("Generando nuevo NIP...");

        setTimeout(() => {
            window.hideLoader();
            startNipTimer();
            window.showToast("Nuevo NIP generado.");
        }, 900);
    });

    // Control de gasto
    const spendingRange = document.getElementById("spending-limit-range");
    const spendingInput = document.getElementById("spending-limit-input");
    const spendingValue = document.getElementById("spending-limit-value");

    function updateSpendingLimit(value) {
        const numericValue = Number(value) || 0;
        const formatted = formatAmount(numericValue);

        if (spendingRange) spendingRange.value = numericValue;
        if (spendingInput) spendingInput.value = numericValue;
        if (spendingValue) spendingValue.textContent = formatted;
    }

    if (spendingRange) {
        spendingRange.addEventListener("input", () => updateSpendingLimit(spendingRange.value));
    }

    if (spendingInput) {
        spendingInput.addEventListener("input", () => updateSpendingLimit(spendingInput.value));
    }

    document.querySelectorAll("[data-control-switch]").forEach(btn => {
        btn.addEventListener("click", () => {
            btn.classList.toggle("is-on");
        });
    });

    on("btn-overview-spending-control", "click", () => {
        navigateTo("spending-control-view", "Consultando límites...", 700);
    });

    on("btn-save-spending-control", "click", () => {
        window.showLoader("Guardando control de gasto...");

        setTimeout(() => {
            window.hideLoader();
            window.showToast("Control de gasto actualizado.");
        }, 1000);
    });

    // Billeteras digitales
    const walletStatusMap = {
        apple: "wallet-apple-status",
        google: "wallet-google-status",
        samsung: "wallet-samsung-status"
    };

    function addWallet(walletName, button) {
        window.showLoader("Validando tarjeta digital...");

        setTimeout(() => {
            const statusElement = document.getElementById(walletStatusMap[walletName]);

            if (statusElement) statusElement.textContent = "Agregada";
            if (button) {
                button.textContent = "Agregada";
                button.classList.add("is-added");
                button.disabled = true;
            }

            window.hideLoader();
            window.showToast("Tarjeta agregada a la billetera digital.");
        }, 1300);
    }

    on("btn-overview-wallets", "click", () => {
        navigateTo("wallets-view", "Consultando billeteras digitales...", 700);
    });

    document.querySelectorAll("[data-wallet]").forEach(btn => {
        btn.addEventListener("click", () => {
            addWallet(btn.dataset.wallet, btn);
        });
    });
    // ==================== GENERAR CVV DINÁMICO ====================
    on("btn-generate-cvv", "click", openDigitalCardModal);

    // ==================== TRANSFERENCIAS ====================
    on("btn-do-transfer", "click", () => {
        const dest = document.getElementById("transfer-dest")?.value || "Cuenta no especificada";
        const amount = document.getElementById("transfer-amount")?.value || "0.00";
        const concept = document.getElementById("transfer-concept")?.value || "Sin concepto";
        const numericAmount = Number(String(amount).replace(/,/g, "")) || 0;

        navigateTo("transfer-success-view", "Conectando con red SPEI...", 1800);

        setTimeout(() => {
            const successAmount = document.getElementById("success-transfer-amount");
            const successDest = document.getElementById("success-transfer-dest");
            const successConcept = document.getElementById("success-transfer-concept");
            const successDate = document.getElementById("success-transfer-date");

            if (successAmount) successAmount.textContent = `$ ${numericAmount.toFixed(2)} MXN`;
            if (successDest) successDest.textContent = dest;
            if (successConcept) successConcept.textContent = concept;
            if (successDate) successDate.textContent = getTodayString();
        }, 1800);
    });

    // ==================== RETIRO SIN TARJETA ====================
    on("btn-do-cardless", "click", () => {
        const amount = document.getElementById("cardless-amount")?.value || "500.00";

        navigateTo("cardless-active-view", "Generando clave dinámica...", 1500);

        setTimeout(() => {
            const cardlessAmount = document.getElementById("cardless-active-amount");
            const cardlessNumber = document.getElementById("dynamic-cardless-number");
            const timerDisplay = document.getElementById("cardless-timer");

            if (cardlessAmount) cardlessAmount.textContent = `$ ${amount} MXN`;

            const code = `${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`;
            if (cardlessNumber) cardlessNumber.textContent = code;

            let timeLeft = 600;
            clearInterval(cardlessInterval);

            const updateTimer = () => {
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;

                if (timerDisplay) {
                    timerDisplay.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
                }

                if (timeLeft <= 0) clearInterval(cardlessInterval);
                timeLeft--;
            };

            updateTimer();
            cardlessInterval = setInterval(updateTimer, 1000);
        }, 1500);
    });

    // ==================== RECARGAS CELULAR ====================
    on("btn-do-topup", "click", () => {
        const phone = document.getElementById("topup-phone")?.value || "No especificado";
        const company = document.getElementById("topup-company")?.value || "Telcel";
        const amount = document.getElementById("topup-amount")?.value || "100.00";
        const numericAmount = Number(String(amount).replace(/,/g, "")) || 0;

        navigateTo("topup-success-view", "Validando número y conectando...", 2000);

        setTimeout(() => {
            const successAmount = document.getElementById("success-topup-amount");
            const successPhone = document.getElementById("success-topup-phone");
            const successCompany = document.getElementById("success-topup-company");
            const successDate = document.getElementById("success-topup-date");

            if (successAmount) successAmount.textContent = `$ ${numericAmount.toFixed(2)} MXN`;
            if (successPhone) successPhone.textContent = phone;
            if (successCompany) successCompany.textContent = company;
            if (successDate) successDate.textContent = getTodayString();
        }, 2000);
    });

    // ==================== RELOJ ====================
    const currentTimeEl = document.getElementById("current-time");

    function updateClock() {
        const d = new Date();
        if (currentTimeEl) {
            currentTimeEl.textContent = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
        }
    }

    updateClock();
    setInterval(updateClock, 30000);
});
