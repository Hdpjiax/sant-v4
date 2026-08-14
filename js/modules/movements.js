/**
 * Santander Movements & Receipts Module
 */
(function (global) {
    'use strict';

    let currentMovements = [];
    let movementFilter = 'all';
    let movementSearchQuery = '';
    let movsPage = 0;
    const MOVS_PAGE_SIZE = 20;
    let activeReceiptMovement = null;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatAmount(value) {
        const cleanValue = String(value || '0').replace(/[^\d.-]/g, '');
        const num = Number(cleanValue);
        if (Number.isNaN(num)) return String(value || '0.00');
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDateString(dateInput) {
        if (!dateInput) return 'Hoy';
        const parts = dateInput.split('-');
        if (parts.length !== 3) return dateInput;
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const day = parseInt(parts[2], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        return `${day} ${months[monthIndex] || ''}`;
    }

    function getMovementHeader(dateInput) {
        if (!dateInput) return 'hoy';
        const parts = dateInput.split('-');
        if (parts.length !== 3) return dateInput;
        const year = parts[0];
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(Number(year), month, day);
        if (Number.isNaN(date.getTime())) return dateInput;
        const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${weekdays[date.getDay()]} ${day} de ${months[month]}, ${year}`;
    }

    function getMovementCategoryIcon(title = '', isPositive = false) {
        const titleLower = title.toLowerCase();
        if (titleLower.includes('uber') || titleLower.includes('didi') || titleLower.includes('cabify') || titleLower.includes('gasolina') || titleLower.includes('pemex') || titleLower.includes('shell') || titleLower.includes('bp') || titleLower.includes('estacionamiento') || titleLower.includes('auto')) {
            return `<svg class="movement-cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18.7 7.5C18.3 6.6 17.4 6 16.4 6H7.6c-1 0-1.9.6-2.3 1.5L3.5 11.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/>
                <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
                <path d="M5 11h14"/>
            </svg>`;
        } else if (titleLower.includes('restaurante') || titleLower.includes('cafe') || titleLower.includes('starbucks') || titleLower.includes('uber eats') || titleLower.includes('rappi') || titleLower.includes('comida') || titleLower.includes('tacos') || titleLower.includes('mcdonald') || titleLower.includes('burger') || titleLower.includes('bar')) {
            return `<svg class="movement-cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <path d="M18 2v20M2 2v8a4 4 0 0 0 4 4v8M6 2v4M10 2v4"/>
            </svg>`;
        } else if (titleLower.includes('domiciliacion') || titleLower.includes('seguro') || titleLower.includes('telmex') || titleLower.includes('cfe') || titleLower.includes('netflix') || titleLower.includes('spotify') || titleLower.includes('suscripcion') || titleLower.includes('plan')) {
            return `<svg class="movement-cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                <circle cx="12" cy="15" r="2"/><path d="M12 14v1.5l1 1"/>
            </svg>`;
        } else if (titleLower.includes('oxxo') || titleLower.includes('walmart') || titleLower.includes('soriana') || titleLower.includes('chedraui') || titleLower.includes('super') || titleLower.includes('costco') || titleLower.includes('sams') || titleLower.includes('seven') || titleLower.includes('amazon') || titleLower.includes('mercadolibre') || titleLower.includes('liverpool') || titleLower.includes('tienda')) {
            return `<svg class="movement-cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <path d="M4 8h16l-1.5 11h-13L4 8zM2 8h20"/>
                <path d="M9 12v4M12 12v4M15 12v4"/>
                <path d="M8 8a4 4 0 0 1 8 0"/>
            </svg>`;
        } else if (titleLower.includes('spei') || titleLower.includes('transferencia') || titleLower.includes('traspaso') || titleLower.includes('abono') || titleLower.includes('pago de') || titleLower.includes('deposito') || titleLower.includes('recibida') || titleLower.includes('enviada')) {
            return `<svg class="movement-cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <path d="M7 10l5-5 5 5M7 10h10M17 14l-5 5-5-5M17 14H7"/>
            </svg>`;
        } else if (titleLower.includes('retiro') || titleLower.includes('cajero') || titleLower.includes('atm')) {
            return `<svg class="movement-cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="12" cy="15" r="1.5"/>
            </svg>`;
        } else {
            return `<svg class="movement-cat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                ${isPositive ? '<path d="M12 19V5M5 12l7-7 7 7"/>' : '<path d="M12 5v14M19 12l-7 7-7-7"/>'}
            </svg>`;
        }
    }

    function renderMovements() {
        const containerDetail = document.getElementById('movements-container');
        if (!containerDetail) return;

        let htmlDetail = '';
        const sortedMovs = [...currentMovements].sort((a, b) => new Date(b.date) - new Date(a.date));

        const filteredMovs = sortedMovs.filter((m) => {
            if (movementFilter !== 'all' && m.type !== movementFilter) return false;
            if (movementSearchQuery) {
                const q = movementSearchQuery.toLowerCase();
                const match = (m.title || '').toLowerCase().includes(q) ||
                    (m.location || '').toLowerCase().includes(q) ||
                    (m.reference || '').includes(q) ||
                    (m.amount || '').includes(q);
                if (!match) return false;
            }
            return true;
        });

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
                const isPositive = m.type === 'positive';
                const amount = formatAmount(m.amount);
                const iconSvg = getMovementCategoryIcon(m.title || '', isPositive);
                const movJson = encodeURIComponent(JSON.stringify(m));

                htmlDetail += `
                    <div class="santander-movement-item is-clickable-receipt ${index === 0 ? 'first-in-day' : ''}" data-movement="${movJson}" style="cursor: pointer;">
                        <div class="movement-side-icon ${isPositive ? 'is-positive' : 'is-negative'}">
                            ${iconSvg}
                        </div>
                        <div class="movement-content">
                            <div class="movement-topline">
                                <span class="movement-name">${escapeHtml(m.title)}</span>
                                ${m.location ? `<span class="movement-location">${escapeHtml(m.location)}</span>` : ''}
                            </div>
                            ${m.reference ? `<span class="movement-reference">${escapeHtml(m.reference)}</span>` : ''}
                        </div>
                        <div class="movement-amount">
                            ${isPositive ? '' : '-'}${amount}<span>MXN</span>
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
            htmlDetail = `<div class="empty-movements">${
                movementSearchQuery ? 'No hay movimientos que coincidan con tu búsqueda.' : 'No hay movimientos para este filtro.'
            }</div>`;
        }

        containerDetail.innerHTML = htmlDetail;
    }

    function openMovementReceipt(mov) {
        const receiptModal = document.getElementById('movement-receipt-modal');
        if (!receiptModal || !mov) return;
        activeReceiptMovement = mov;
        if (global.triggerHaptic) global.triggerHaptic('medium');

        const isPositive = mov.type === 'positive';
        const amountStr = `${isPositive ? '+' : '-'}$${formatAmount(mov.amount)} MXN`;
        const title = mov.title || 'Operación';
        const titleLower = title.toLowerCase();

        const bankBadge = document.getElementById('receipt-bank-name');
        if (bankBadge) {
            if (titleLower.includes('bbva') || titleLower.includes('bancomer')) bankBadge.textContent = 'BBVA México';
            else if (titleLower.includes('banorte')) bankBadge.textContent = 'Banorte';
            else if (titleLower.includes('nu ') || titleLower.includes('nu bank')) bankBadge.textContent = 'Nu México';
            else if (titleLower.includes('mercado') || titleLower.includes('mp')) bankBadge.textContent = 'Mercado Pago';
            else bankBadge.textContent = 'Santander México';
        }

        const dateClean = (mov.date || '2026-08-14').replace(/-/g, '');
        const folioNum = `0268${String(Math.abs(title.charCodeAt(0) * 89204918)).slice(0, 8)}`;
        const trackingKey = `${dateClean}0144701403960${String(Math.abs(title.charCodeAt(title.length - 1) * 3952)).slice(0, 5)}`;

        const elAmount = document.getElementById('receipt-amount-display');
        const elConcept = document.getElementById('receipt-concept');
        const elDate = document.getElementById('receipt-datetime');
        const elFolio = document.getElementById('receipt-folio');
        const elTracking = document.getElementById('receipt-tracking');
        const elAccount = document.getElementById('receipt-account');
        const elType = document.getElementById('receipt-type');

        if (elAmount) elAmount.textContent = amountStr;
        if (elConcept) elConcept.textContent = mov.reference || title;
        if (elDate) elDate.textContent = `${formatDateString(mov.date)} 2026, 17:04:12 hrs`;
        if (elFolio) elFolio.textContent = folioNum;
        if (elTracking) elTracking.textContent = trackingKey;
        if (elAccount) elAccount.textContent = `Cuenta Débito 14**9096 (TDC 4152••9096)`;
        if (elType) elType.textContent = isPositive ? 'Abono / Transferencia Recibida (SPEI)' : 'Cargo / Pago con Tarjeta';

        receiptModal.classList.remove('hidden-receipt-modal');
        receiptModal.setAttribute('aria-hidden', 'false');
    }

    function closeMovementReceipt() {
        const receiptModal = document.getElementById('movement-receipt-modal');
        if (receiptModal) {
            if (receiptModal.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            receiptModal.classList.add('hidden-receipt-modal');
            receiptModal.setAttribute('aria-hidden', 'true');
        }
    }

    function initMovementsModule(movements = []) {
        currentMovements = movements;

        // Setup filter tabs
        document.querySelectorAll('.filter-tab').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.remove('active'));
                btn.classList.add('active');
                movementFilter = btn.dataset.filter || 'all';
                renderMovements();
            });
        });

        // Setup movement search
        const movContainer = document.getElementById('movements-container');
        if (movContainer && !document.getElementById('movement-search-input')) {
            const searchWrap = document.createElement('div');
            searchWrap.className = 'movement-search-wrap';
            searchWrap.innerHTML = `<input type="search" class="movement-search-input" id="movement-search-input" placeholder="Buscar en movimientos..." aria-label="Buscar movimientos">`;
            movContainer.parentNode?.insertBefore(searchWrap, movContainer);

            document.getElementById('movement-search-input')?.addEventListener('input', (e) => {
                movementSearchQuery = e.target.value.trim();
                renderMovements();
            });
        }

        // Receipt modal listeners
        document.getElementById('btn-close-receipt-modal')?.addEventListener('click', closeMovementReceipt);
        document.getElementById('btn-close-receipt-backdrop')?.addEventListener('click', closeMovementReceipt);

        document.getElementById('btn-share-receipt')?.addEventListener('click', async () => {
            if (global.triggerHaptic) global.triggerHaptic('success');
            if (navigator.share && activeReceiptMovement) {
                try {
                    await navigator.share({
                        title: 'Comprobante de Operación Santander',
                        text: `Santander México - Comprobante de operación: ${activeReceiptMovement.title} por $${formatAmount(activeReceiptMovement.amount)} MXN. Folio: 026849204918.`
                    });
                    return;
                } catch (e) {}
            }
            if (global.showToast) global.showToast('Comprobante copiado al portapapeles');
        });

        // Click delegation strictly inside #movements-container
        document.addEventListener('click', (e) => {
            const movementsBox = document.getElementById('movements-container');
            if (!movementsBox || !movementsBox.contains(e.target)) return;

            const item = e.target.closest('.santander-movement-item');
            if (!item) return;

            const rawData = item.getAttribute('data-movement');
            if (rawData) {
                try {
                    const mov = JSON.parse(decodeURIComponent(rawData));
                    openMovementReceipt(mov);
                    return;
                } catch (err) {}
            }
        });

        renderMovements();
    }

    global.SantanderMovements = {
        init: initMovementsModule,
        setMovements: (movs) => {
            currentMovements = movs;
            renderMovements();
        },
        render: renderMovements,
        openReceipt: openMovementReceipt,
        closeReceipt: closeMovementReceipt,
        getCategoryIcon: getMovementCategoryIcon
    };

    global.getMovementCategoryIcon = getMovementCategoryIcon;
    global.renderMovsApp = renderMovements;
    global.openMovementReceipt = openMovementReceipt;
    global.closeMovementReceipt = closeMovementReceipt;

})(typeof window !== 'undefined' ? window : this);
