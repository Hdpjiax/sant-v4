/**
 * Santander Transfers & Payments Module (SPEI, Recargas, Retiro sin tarjeta, Pago de tarjetas)
 */
(function (global) {
    'use strict';

    function formatAmount(value) {
        const cleanValue = String(value || '0').replace(/[^\d.-]/g, '');
        const num = Number(cleanValue);
        if (Number.isNaN(num)) return String(value || '0.00');
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function parseAmount(value) {
        return Number(String(value || '0').replace(/[^\d.-]/g, '')) || 0;
    }

    function secureRandom(min, max) {
        const range = max - min + 1;
        const bytes = new Uint32Array(1);
        crypto.getRandomValues(bytes);
        return min + (bytes[0] % range);
    }

    function initTransfersModule(userSettings, onMovementAdded) {
        // ==================== TRANSFERENCIAS SPEI ====================
        document.getElementById('btn-do-transfer')?.addEventListener('click', async () => {
            const dest = document.getElementById('transfer-dest')?.value.trim() || '';
            const amountRaw = document.getElementById('transfer-amount')?.value.trim() || '';
            const concept = document.getElementById('transfer-concept')?.value.trim() || 'Sin concepto';
            const numericAmount = Number(amountRaw.replace(/,/g, '')) || 0;
            const balance = parseAmount(userSettings.balance);

            const errors = [];
            if (!dest) errors.push('Ingresa una cuenta destino.');
            if (dest.length < 10) errors.push('La cuenta destino debe tener al menos 10 dígitos.');
            if (numericAmount <= 0) errors.push('El monto debe ser mayor a cero.');
            if (numericAmount > balance) errors.push('El monto excede tu saldo disponible.');

            if (errors.length) {
                if (global.showToast) global.showToast(errors[0]);
                return;
            }

            const confirmed = await global.showConfirm(
                'Confirmar transferencia',
                `Enviar $${formatAmount(numericAmount)} MXN a la cuenta ${dest}${concept !== 'Sin concepto' ? ` con concepto: ${concept}` : ''}. ¿Estás seguro?`
            );
            if (!confirmed) return;

            // Simulación SPEI progresiva
            const steps = [
                { msg: 'Conectando con red SPEI...', pct: 15 },
                { msg: 'Validando cuenta destino...', pct: 35 },
                { msg: 'Autorizando transferencia...', pct: 60 },
                { msg: 'Procesando en Banco de México...', pct: 80 },
                { msg: 'Transferencia completada', pct: 100 }
            ];
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(255,255,255,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px;';
            overlay.innerHTML = `
                <div style="width:100%;max-width:280px;">
                    <div style="height:6px;background:#E0E0E0;border-radius:3px;overflow:hidden;">
                        <div id="spei-progress" style="height:100%;width:0%;background:#EC0000;border-radius:3px;transition:width 0.4s ease;"></div>
                    </div>
                </div>
                <p id="spei-msg" style="font-size:14px;color:#666;text-align:center;margin:0;">Conectando con red SPEI...</p>
            `;
            document.body.appendChild(overlay);

            for (let i = 0; i < steps.length; i++) {
                await new Promise((r) => setTimeout(r, i === steps.length - 1 ? 600 : 400 + Math.random() * 400));
                const msgEl = document.getElementById('spei-msg');
                const progEl = document.getElementById('spei-progress');
                if (msgEl) msgEl.textContent = steps[i].msg;
                if (progEl) progEl.style.width = steps[i].pct + '%';
            }
            overlay.remove();

            // Descontar saldo
            userSettings.balance = String(parseFloat(userSettings.balance || 0) - numericAmount);
            document.querySelectorAll('.dynamic-balance').forEach((el) => {
                el.textContent = formatAmount(userSettings.balance);
            });

            // Registrar movimiento
            const today = new Date().toISOString().split('T')[0];
            const folio = String(secureRandom(10000000, 99999999));
            const newMov = {
                title: 'Transferencia enviada',
                location: concept !== 'Sin concepto' ? concept : 'SPEI',
                reference: folio,
                date: today,
                amount: numericAmount.toFixed(2),
                type: 'negative'
            };

            if (onMovementAdded) onMovementAdded(newMov);

            if (global.navigateTo) global.navigateTo('transfer-success-view', '', 0);

            const now = new Date();
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const dateFormatted = `${now.getDate()}/${months[now.getMonth()]}/${now.getFullYear()} a las ${now.toTimeString().split(' ')[0]} h`;

            const year = String(now.getFullYear()).slice(-2);
            const monthStr = String(now.getMonth() + 1).padStart(2, '0');
            const dayStr = String(now.getDate()).padStart(2, '0');
            const randStr = String(Math.floor(1000000000 + Math.random() * 9000000000));
            const rastreo = `8026${year}${monthStr}${dayStr}${randStr}`;
            const refNum = String(Math.floor(100000 + Math.random() * 900000));
            const originAcc = `Santander (${userSettings.account || '14**0000'})`;

            const els = {
                'success-transfer-amount': `$ ${formatAmount(numericAmount)} MXN`,
                'success-transfer-origin': originAcc,
                'success-transfer-dest': dest,
                'success-transfer-concept': concept,
                'success-transfer-date': dateFormatted,
                'success-transfer-rastreo': rastreo,
                'success-transfer-ref': refNum
            };
            Object.entries(els).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            });
        });

        // ==================== RECARGAS ====================
        document.getElementById('btn-do-topup')?.addEventListener('click', async () => {
            const phone = document.getElementById('topup-phone')?.value.trim() || '';
            const company = document.getElementById('topup-company')?.value || 'Telcel';
            const amount = document.getElementById('topup-amount')?.value || '100.00';
            const numericAmount = Number(String(amount).replace(/,/g, '')) || 0;

            const errors = [];
            if (!/^\d{10}$/.test(phone)) errors.push('El teléfono debe tener 10 dígitos.');
            if (numericAmount <= 0) errors.push('El monto debe ser mayor a cero.');
            if (numericAmount > 2000) errors.push('La recarga máxima es de $2,000 MXN.');

            if (errors.length) {
                if (global.showToast) global.showToast(errors[0]);
                return;
            }

            const confirmed = await global.showConfirm(
                'Confirmar recarga',
                `Recargar $${formatAmount(numericAmount)} MXN al número ${phone} (${company}). ¿Estás seguro?`
            );
            if (!confirmed) return;

            userSettings.balance = String(parseFloat(userSettings.balance || 0) - numericAmount);
            document.querySelectorAll('.dynamic-balance').forEach((el) => {
                el.textContent = formatAmount(userSettings.balance);
            });

            const today = new Date().toISOString().split('T')[0];
            const folio = String(secureRandom(10000000, 99999999));
            const newMov = {
                title: `Recarga ${company}`,
                location: phone,
                reference: folio,
                date: today,
                amount: numericAmount.toFixed(2),
                type: 'negative'
            };

            if (onMovementAdded) onMovementAdded(newMov);

            if (global.navigateTo) global.navigateTo('topup-success-view', '', 0);

            const els = {
                'success-topup-amount': `$ ${formatAmount(numericAmount)} MXN`,
                'success-topup-phone': phone,
                'success-topup-company': company,
                'success-topup-date': new Date().toLocaleDateString()
            };
            Object.entries(els).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            });
        });
    }

    global.SantanderTransfers = {
        init: initTransfersModule
    };

})(typeof window !== 'undefined' ? window : this);
