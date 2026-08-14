/**
 * Santander App Main Orchestrator
 */
(function (global) {
    'use strict';

    let userSettings = null;
    let userProfile = null;
    let currentMovs = [];

    function formatAmount(value) {
        const cleanValue = String(value || '0').replace(/[^\d.-]/g, '');
        const num = Number(cleanValue);
        if (Number.isNaN(num)) return String(value || '0.00');
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function getMaskedCardReference(cardNumber) {
        const digits = String(cardNumber || '').replace(/\D/g, '');
        if (digits.length >= 8) {
            return `${digits.slice(0, 4)}••${digits.slice(-4)}`;
        }
        return `••••${digits.slice(-4) || '9096'}`;
    }

    function renderCardNetworkLogo(container, brandValue) {
        if (!container) return;
        const brand = String(brandValue || 'VISA').trim().toUpperCase();
        container.classList.remove('is-visa', 'is-mastercard', 'is-amex');
        if (brand.includes('MASTER')) {
            container.classList.add('is-mastercard');
            container.setAttribute('aria-label', 'Mastercard');
        } else if (brand.includes('AMEX') || brand.includes('AMERICAN')) {
            container.classList.add('is-amex');
            container.setAttribute('aria-label', 'American Express');
        } else {
            container.classList.add('is-visa');
            container.setAttribute('aria-label', 'Visa');
        }
    }

    function applyUserSettings(settings) {
        if (!settings) return;
        userSettings = settings;
        currentMovs = settings.movements || [];

        // Balances
        const formattedBalance = formatAmount(settings.balance);
        document.querySelectorAll('.dynamic-balance').forEach((el) => {
            el.textContent = formattedBalance;
        });

        // User names & greetings
        const displayName = settings.name || 'Usuario';
        const displaySub = settings.subtitle || '';
        document.querySelectorAll('.greeting-name, #display-name').forEach((el) => {
            el.textContent = displayName;
        });

        // Card references & networks
        const cardRef = getMaskedCardReference(settings.full_card);
        const cardRefEls = [
            document.getElementById('home-card-ref'),
            document.getElementById('overview-card-ref'),
            document.getElementById('detail-card-ref')
        ];
        cardRefEls.forEach((el) => {
            if (el) el.textContent = `TDC ${cardRef}`;
        });

        const accountEls = [
            document.getElementById('home-account-number'),
            document.getElementById('detail-account-number')
        ];
        accountEls.forEach((el) => {
            if (el) el.textContent = settings.account || '14**9096';
        });

        // Card logos
        renderCardNetworkLogo(document.getElementById('home-card-network'), settings.brand);
        renderCardNetworkLogo(document.getElementById('overview-card-network'), settings.brand);

        // Update modules
        if (global.SantanderMovements) {
            global.SantanderMovements.setMovements(currentMovs);
        }
    }

    // ==================== PULL TO REFRESH ====================
    function initPullToRefresh() {
        const ptrContainer = document.getElementById('pull-to-refresh');
        if (!ptrContainer) return;

        let touchStartY = 0;
        let isPulling = false;

        window.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                touchStartY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            const y = e.touches[0].clientY;
            const diff = y - touchStartY;
            if (diff > 20 && diff < 120 && window.scrollY === 0) {
                ptrContainer.style.transform = `translateY(${Math.min(diff, 80)}px)`;
            }
        }, { passive: true });

        window.addEventListener('touchend', async () => {
            if (!isPulling) return;
            isPulling = false;
            const transform = ptrContainer.style.transform;
            if (transform && transform.includes('translateY')) {
                ptrContainer.classList.add('refreshing');
                if (global.triggerHaptic) global.triggerHaptic('light');

                try {
                    const fresh = await window.SettingsService.getMySettings(true);
                    if (fresh) applyUserSettings(fresh);
                } catch (e) {}

                setTimeout(() => {
                    ptrContainer.classList.remove('refreshing');
                    ptrContainer.style.transform = '';
                    if (global.triggerHaptic) global.triggerHaptic('success');
                    if (global.showToast) global.showToast('Saldos y movimientos actualizados');
                }, 900);
            }
        }, { passive: true });
    }

    // ==================== APP BOOTSTRAP ====================
    async function bootstrap() {
        const session = await window.SantanderAuth.requireSession();
        if (!session) return;

        userProfile = await window.SantanderAuth.getProfile();

        try {
            window.ensureSupabaseReady();
            userSettings = await window.SettingsService.getMySettings();
        } catch (error) {
            console.error('Error cargando ajustes:', error);
            window.location.href = 'login.html';
            return;
        }

        // Initialize Core & Modules
        if (global.SantanderHaptics) global.SantanderHaptics.attach();
        if (global.SantanderNav) global.SantanderNav.initNavigation();

        if (global.SantanderMovements) {
            global.SantanderMovements.init(userSettings.movements || []);
        }

        if (global.SantanderDigitalCard) {
            global.SantanderDigitalCard.init({
                full_card: userSettings.full_card,
                exp: userSettings.exp
            });
        }

        if (global.SantanderTransfers) {
            global.SantanderTransfers.init(userSettings, (newMov) => {
                currentMovs.unshift(newMov);
                if (global.SantanderMovements) global.SantanderMovements.setMovements(currentMovs);
            });
        }

        if (global.SantanderSpendingControl) {
            global.SantanderSpendingControl.init(() => currentMovs);
        }

        applyUserSettings(userSettings);
        initPullToRefresh();

        // Admin link in sidebar
        if (userProfile?.role === 'admin') {
            const sidebarLinks = document.querySelector('.sidebar-links');
            if (sidebarLinks && !document.getElementById('sidebar-admin-link')) {
                const adminLink = document.createElement('a');
                adminLink.id = 'sidebar-admin-link';
                adminLink.href = 'admin.html';
                adminLink.innerHTML = '<span class="material-icons-outlined">admin_panel_settings</span> Panel Admin';
                adminLink.style.color = 'var(--santander-red)';
                adminLink.style.fontWeight = '600';
                sidebarLinks.insertBefore(adminLink, sidebarLinks.querySelector('hr'));
            }
        }

        // Logout listener
        document.querySelector('.logout-link')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const confirmed = await global.showConfirm('Cerrar sesión', '¿Estás seguro de que deseas salir?');
            if (!confirmed) return;
            if (global.SantanderNav) global.SantanderNav.closeSidebar();
            window.SantanderAuth.signOut();
        });

        // Navigation Quick Action Buttons
        const LOADER = global.SantanderNav?.LOADER || { MEDIUM: 2400, SHORT: 1600, LONG: 3200, NAV: 1200 };
        const nav = (view, msg, time) => {
            if (global.navigateTo) global.navigateTo(view, msg, time);
        };

        document.getElementById('open-card-details')?.addEventListener('click', () => {
            nav('account-overview-view', 'Consultando cuenta...', LOADER.MEDIUM);
        });

        document.getElementById('btn-open-card-info')?.addEventListener('click', () => {
            if (global.openDigitalCardModal) global.openDigitalCardModal();
        });

        document.getElementById('btn-open-card-info-from-overview')?.addEventListener('click', () => {
            if (global.openDigitalCardModal) global.openDigitalCardModal();
        });

        document.getElementById('btn-overview-card-info')?.addEventListener('click', () => {
            if (global.openDigitalCardModal) global.openDigitalCardModal();
        });

        document.getElementById('btn-overview-movements')?.addEventListener('click', () => {
            nav('detail-view', 'Consultando movimientos...', LOADER.MEDIUM);
        });

        document.getElementById('btn-overview-transfer')?.addEventListener('click', () => {
            nav('transfer-view', 'Preparando módulo de pagos...', LOADER.MEDIUM);
        });

        document.getElementById('btn-overview-pay')?.addEventListener('click', () => {
            nav('pay-cards-view', 'Consultando adeudos...', LOADER.MEDIUM);
        });

        document.getElementById('btn-overview-topup')?.addEventListener('click', () => {
            nav('topup-view', 'Cargando recargas...', LOADER.NAV);
        });

        document.getElementById('btn-overview-cardless')?.addEventListener('click', () => {
            nav('cardless-view', 'Conectando con red de cajeros...', LOADER.LONG);
        });

        document.getElementById('btn-nav-transfer')?.addEventListener('click', () => {
            nav('transfer-view', 'Preparando módulo de pagos...', LOADER.MEDIUM);
        });

        document.getElementById('btn-nav-retiro')?.addEventListener('click', () => {
            nav('cardless-view', 'Conectando con red de cajeros...', LOADER.LONG);
        });

        document.getElementById('btn-nav-pagar')?.addEventListener('click', () => {
            nav('pay-cards-view', 'Consultando adeudos...', LOADER.MEDIUM);
        });

        document.getElementById('btn-nav-recargar')?.addEventListener('click', () => {
            nav('topup-view', 'Cargando recargas...', LOADER.NAV);
        });

        document.getElementById('btn-nav-ofertas')?.addEventListener('click', () => {
            nav('offers-view', 'Buscando beneficios...', LOADER.MEDIUM);
        });

        // Header Sync Button
        let syncing = false;
        document.getElementById('btn-sync')?.addEventListener('click', async () => {
            if (syncing) return;
            syncing = true;
            if (global.triggerHaptic) global.triggerHaptic('light');

            const btn = document.getElementById('btn-sync');
            const svgIcon = btn?.querySelector('.sync-icon');
            if (svgIcon) svgIcon.classList.add('is-spinning');

            try {
                const fresh = await window.SettingsService.getMySettings(true);
                if (fresh) applyUserSettings(fresh);
                if (global.triggerHaptic) global.triggerHaptic('success');
                if (global.showToast) global.showToast('Saldos y movimientos actualizados');
            } catch (err) {
                if (global.showToast) global.showToast('Información actualizada');
            } finally {
                setTimeout(() => {
                    if (svgIcon) svgIcon.classList.remove('is-spinning');
                    syncing = false;
                }, 750);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', bootstrap);

    global.SantanderApp = {
        bootstrap,
        applyUserSettings,
        getUserSettings: () => userSettings
    };

})(typeof window !== 'undefined' ? window : this);
