/**
 * Santander Native Dialog & Modal System
 * Diálogos oficiales Santander con desenfoque de fondo y diseño bancario
 */
(function (global) {
    'use strict';

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showConfirm(title, message, okText = 'Aceptar', cancelText = 'Cancelar') {
        return new Promise((resolve) => {
            if (global.triggerHaptic) global.triggerHaptic('medium');
            const overlay = document.createElement('div');
            overlay.className = 'santander-dialog-overlay';
            overlay.innerHTML = `
                <div class="santander-dialog-card" role="alertdialog" aria-labelledby="dialog-title" aria-describedby="dialog-msg">
                    <img src="assets/santander-flame.png" alt="Santander" class="santander-dialog-flame">
                    <h3 id="dialog-title" class="santander-dialog-title">${escapeHtml(title)}</h3>
                    <p id="dialog-msg" class="santander-dialog-msg">${escapeHtml(message)}</p>
                    <div class="santander-dialog-actions">
                        <button type="button" class="santander-dialog-btn-cancel" id="dialog-cancel-btn">${escapeHtml(cancelText)}</button>
                        <button type="button" class="santander-dialog-btn-primary" id="dialog-ok-btn">${escapeHtml(okText)}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const cleanup = () => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 180);
            };

            document.getElementById('dialog-cancel-btn')?.addEventListener('click', () => {
                if (global.triggerHaptic) global.triggerHaptic('light');
                cleanup();
                resolve(false);
            });
            document.getElementById('dialog-ok-btn')?.addEventListener('click', () => {
                if (global.triggerHaptic) global.triggerHaptic('success');
                cleanup();
                resolve(true);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    if (global.triggerHaptic) global.triggerHaptic('light');
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    function showAlert(title, message, btnText = 'Entendido') {
        return new Promise((resolve) => {
            if (global.triggerHaptic) global.triggerHaptic('medium');
            const overlay = document.createElement('div');
            overlay.className = 'santander-dialog-overlay';
            overlay.innerHTML = `
                <div class="santander-dialog-card" role="alertdialog" aria-labelledby="dialog-title" aria-describedby="dialog-msg">
                    <img src="assets/santander-flame.png" alt="Santander" class="santander-dialog-flame">
                    <h3 id="dialog-title" class="santander-dialog-title">${escapeHtml(title)}</h3>
                    <p id="dialog-msg" class="santander-dialog-msg">${escapeHtml(message)}</p>
                    <div class="santander-dialog-actions">
                        <button type="button" class="santander-dialog-btn-primary" id="dialog-alert-ok-btn">${escapeHtml(btnText)}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const cleanup = () => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 180);
            };

            document.getElementById('dialog-alert-ok-btn')?.addEventListener('click', () => {
                if (global.triggerHaptic) global.triggerHaptic('success');
                cleanup();
                resolve(true);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    if (global.triggerHaptic) global.triggerHaptic('light');
                    cleanup();
                    resolve(true);
                }
            });
        });
    }

    global.SantanderDialog = {
        showConfirm,
        showAlert
    };

    global.showConfirm = showConfirm;
    global.showAlert = showAlert;
    global.alert = (msg) => showAlert('Santander', msg, 'Entendido');

})(typeof window !== 'undefined' ? window : this);
