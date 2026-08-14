/**
 * Santander Digital Card Module (CVV Dinámico & Tarjeta Digital)
 */
(function (global) {
    'use strict';

    let cardIsActive = true;
    let modalCvvInterval = null;
    let userCardData = {
        full_card: '4152 3140 8080 9096',
        exp: '12/28'
    };

    function secureRandom(min, max) {
        const range = max - min + 1;
        const bytes = new Uint32Array(1);
        crypto.getRandomValues(bytes);
        return min + (bytes[0] % range);
    }

    function formatModalCvv(cvv) {
        const str = String(cvv || '000').padStart(3, '0');
        return `${str[0]} ${str[1]} ${str[2]}`;
    }

    function copyText(value) {
        const text = String(value || '').trim();
        if (!text) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                if (global.showToast) global.showToast('Copiado al portapapeles');
            });
            return;
        }

        const tempInput = document.createElement('textarea');
        tempInput.value = text;
        tempInput.style.position = 'fixed';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        tempInput.remove();

        if (global.showToast) global.showToast('Copiado al portapapeles');
    }

    function startModalCvvTimer() {
        const modalCvvNumber = document.getElementById('modal-dynamic-cvv');
        const modalCvvTimer = document.getElementById('modal-cvv-timer');
        const modalCvvProgress = document.getElementById('modal-cvv-progress');

        const randomCvv = secureRandom(100, 999);
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
                modalCvvTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            if (modalCvvProgress) {
                modalCvvProgress.style.width = `${progress}%`;
            }

            if (timeLeft <= 0) {
                clearInterval(modalCvvInterval);
                if (modalCvvNumber) modalCvvNumber.textContent = '---';
                if (global.showToast) global.showToast('Tu CVV dinámico ha expirado.');
                return;
            }

            timeLeft--;
        };

        updateModalTimer();
        modalCvvInterval = setInterval(updateModalTimer, 1000);
    }

    function openDigitalCardModal() {
        if (!cardIsActive) {
            if (global.showToast) global.showToast('Enciende tu tarjeta primero para generar un CVV.');
            return;
        }

        const digitalCardModal = document.getElementById('digital-card-modal');
        if (!digitalCardModal) return;

        if (global.showLoader) global.showLoader('Generando tarjeta digital...');

        setTimeout(() => {
            if (global.hideLoader) global.hideLoader();
            digitalCardModal.classList.remove('hidden-digital-card-modal');
            digitalCardModal.setAttribute('aria-hidden', 'false');
            startModalCvvTimer();
        }, 1600);
    }

    function closeDigitalCardModal() {
        const digitalCardModal = document.getElementById('digital-card-modal');
        if (!digitalCardModal) return;

        if (digitalCardModal.contains(document.activeElement)) {
            document.activeElement.blur();
        }

        digitalCardModal.classList.add('hidden-digital-card-modal');
        digitalCardModal.setAttribute('aria-hidden', 'true');
        clearInterval(modalCvvInterval);
    }

    function syncDigitalCardStatus() {
        const overviewMainCard = document.querySelector('#account-overview-view .account-main-card');
        const overviewPowerText = document.getElementById('overview-card-power-text');
        const overviewPowerIcon = document.getElementById('overview-card-power-icon');
        const modalCardSwitch = document.getElementById('modal-card-switch');
        const virtualCard = document.querySelector('#card-info-view .virtual-card');
        const toggleCardIcon = document.getElementById('toggle-card-icon');
        const toggleCardText = document.getElementById('toggle-card-text');
        const cardStatusText = document.getElementById('card-status-text');

        if (overviewMainCard) overviewMainCard.classList.toggle('card-off-state', !cardIsActive);
        if (overviewPowerText) overviewPowerText.textContent = cardIsActive ? 'Apagar tarjeta digital' : 'Prender tarjeta digital';
        if (overviewPowerIcon) overviewPowerIcon.textContent = cardIsActive ? 'power_settings_new' : 'power';

        if (modalCardSwitch) {
            modalCardSwitch.classList.toggle('is-on', cardIsActive);
            modalCardSwitch.setAttribute('aria-label', cardIsActive ? 'Tarjeta digital prendida' : 'Tarjeta digital apagada');
        }

        if (virtualCard) virtualCard.classList.toggle('card-off-state', !cardIsActive);
        if (toggleCardIcon) toggleCardIcon.style.color = cardIsActive ? 'var(--santander-red)' : '#767676';
        if (toggleCardText) toggleCardText.textContent = cardIsActive ? 'Apagar tarjeta' : 'Encender tarjeta';
        if (cardStatusText) cardStatusText.textContent = cardIsActive ? 'Activa' : 'Apagada';
    }

    function toggleDigitalCardStatus() {
        if (global.showLoader) global.showLoader('Actualizando preferencias de seguridad...');

        setTimeout(() => {
            cardIsActive = !cardIsActive;
            syncDigitalCardStatus();
            if (global.hideLoader) global.hideLoader();
            if (global.showToast) global.showToast(cardIsActive ? 'Tarjeta digital prendida.' : 'Tarjeta digital apagada.');
        }, 1200);
    }

    function initDigitalCardModule(cardData = {}) {
        userCardData = { ...userCardData, ...cardData };

        document.getElementById('btn-close-digital-card-modal')?.addEventListener('click', closeDigitalCardModal);
        document.getElementById('digital-card-backdrop')?.addEventListener('click', closeDigitalCardModal);

        document.getElementById('btn-copy-modal-cvv')?.addEventListener('click', () => {
            const num = (document.getElementById('modal-dynamic-cvv')?.textContent || '').replace(/\s/g, '');
            copyText(num);
        });

        document.getElementById('btn-copy-modal-card')?.addEventListener('click', () => {
            copyText(userCardData.full_card);
        });

        document.getElementById('btn-copy-modal-exp')?.addEventListener('click', () => {
            copyText(userCardData.exp);
        });

        document.getElementById('btn-overview-toggle-card')?.addEventListener('click', toggleDigitalCardStatus);
        document.getElementById('modal-card-switch')?.addEventListener('click', toggleDigitalCardStatus);
        document.getElementById('btn-action-toggle')?.addEventListener('click', toggleDigitalCardStatus);

        syncDigitalCardStatus();
    }

    global.SantanderDigitalCard = {
        init: initDigitalCardModule,
        openModal: openDigitalCardModal,
        closeModal: closeDigitalCardModal,
        toggleStatus: toggleDigitalCardStatus,
        copyText,
        isActive: () => cardIsActive
    };

    global.openDigitalCardModal = openDigitalCardModal;
    global.closeDigitalCardModal = closeDigitalCardModal;
    global.copyText = copyText;

})(typeof window !== 'undefined' ? window : this);
