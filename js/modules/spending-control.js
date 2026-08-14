/**
 * Santander Spending Control, Deferrals & ATM NIP Module
 */
(function (global) {
    'use strict';

    let nipInterval = null;
    let selectedDeferIndex = 0;

    function formatAmount(value) {
        const cleanValue = String(value || '0').replace(/[^\d.-]/g, '');
        const num = Number(cleanValue);
        if (Number.isNaN(num)) return String(value || '0.00');
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function secureRandom(min, max) {
        const range = max - min + 1;
        const bytes = new Uint32Array(1);
        crypto.getRandomValues(bytes);
        return min + (bytes[0] % range);
    }

    function updateSpendingLimit(value) {
        const spendingRange = document.getElementById('spending-limit-range');
        const spendingInput = document.getElementById('spending-limit-input');
        const spendingValue = document.getElementById('spending-limit-value');

        const numericValue = Number(value) || 0;
        const formatted = formatAmount(numericValue);

        if (spendingRange) spendingRange.value = numericValue;
        if (spendingInput) spendingInput.value = numericValue;
        if (spendingValue) spendingValue.textContent = formatted;
    }

    function startNipTimer() {
        const nipNumber = document.getElementById('dynamic-nip-number');
        const nipTimer = document.getElementById('nip-timer');

        let timeLeft = 180;
        clearInterval(nipInterval);

        const nip = secureRandom(1000, 9999);
        if (nipNumber) nipNumber.textContent = nip;

        const updateTimer = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;

            if (nipTimer) {
                nipTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            if (timeLeft <= 0) {
                clearInterval(nipInterval);
                if (nipNumber) nipNumber.textContent = '----';
                if (global.showToast) global.showToast('Tu NIP temporal ha expirado.');
                return;
            }

            timeLeft--;
        };

        updateTimer();
        nipInterval = setInterval(updateTimer, 1000);
    }

    function renderDeferrablePurchases(movements = []) {
        const list = document.getElementById('defer-purchases-list');
        if (!list) return;

        const purchases = movements
            .filter((m) => m.type === 'negative')
            .slice(0, 4);

        if (!purchases.length) {
            list.innerHTML = '<p class="empty-state-text">No tienes compras diferibles en este momento.</p>';
            return;
        }

        list.innerHTML = purchases.map((purchase, index) => {
            const amount = formatAmount(purchase.amount);
            return `
                <button class="deferrable-purchase ${index === 0 ? 'active' : ''}" type="button" data-defer-index="${index}">
                    <div>
                        <strong>${purchase.title || 'Compra'}</strong>
                        <span>${purchase.date || ''}</span>
                    </div>
                    <em>$${amount}</em>
                </button>
            `;
        }).join('');

        list.querySelectorAll('.deferrable-purchase').forEach((btn) => {
            btn.addEventListener('click', () => {
                list.querySelectorAll('.deferrable-purchase').forEach((item) => item.classList.remove('active'));
                btn.classList.add('active');
                selectedDeferIndex = Number(btn.dataset.deferIndex || 0);
            });
        });
    }

    function initSpendingControlModule(getMovementsFn) {
        const spendingRange = document.getElementById('spending-limit-range');
        const spendingInput = document.getElementById('spending-limit-input');

        if (spendingRange) {
            spendingRange.addEventListener('input', () => updateSpendingLimit(spendingRange.value));
        }

        if (spendingInput) {
            spendingInput.addEventListener('input', () => updateSpendingLimit(spendingInput.value));
        }

        document.querySelectorAll('[data-control-switch]').forEach((btn) => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('is-on');
            });
        });

        document.getElementById('btn-overview-spending-control')?.addEventListener('click', () => {
            if (global.navigateTo) global.navigateTo('spending-control-view', 'Consultando límites...', 2400);
        });

        document.getElementById('btn-overview-defer')?.addEventListener('click', () => {
            const movs = getMovementsFn ? getMovementsFn() : [];
            renderDeferrablePurchases(movs);
            if (global.navigateTo) global.navigateTo('defer-view', 'Buscando compras diferibles...', 2400);
        });

        document.getElementById('btn-confirm-defer')?.addEventListener('click', () => {
            const months = document.getElementById('defer-months')?.value || '6';
            if (global.showLoader) global.showLoader('Calculando plan de pagos...');

            setTimeout(() => {
                if (global.hideLoader) global.hideLoader();
                if (global.showToast) global.showToast(`Compra diferida a ${months} meses correctamente.`);
            }, 2400);
        });

        document.getElementById('btn-overview-nip')?.addEventListener('click', () => {
            if (global.navigateTo) global.navigateTo('nip-view', 'Generando NIP seguro...', 3200);
            setTimeout(startNipTimer, 3300);
        });

        document.getElementById('btn-regenerate-nip')?.addEventListener('click', () => {
            if (global.showLoader) global.showLoader('Generando nuevo NIP...');
            setTimeout(() => {
                if (global.hideLoader) global.hideLoader();
                startNipTimer();
                if (global.showToast) global.showToast('Nuevo NIP generado.');
            }, 1600);
        });
    }

    global.SantanderSpendingControl = {
        init: initSpendingControlModule,
        updateSpendingLimit,
        startNipTimer,
        renderDeferrablePurchases
    };

})(typeof window !== 'undefined' ? window : this);
