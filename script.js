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

    function secureRandom(min, max) {
        const range = max - min + 1;
        const bytes = new Uint32Array(1);
        crypto.getRandomValues(bytes);
        return min + (bytes[0] % range);
    }

    function maskCardNumber(card) {
        const digits = String(card || "").replace(/\D/g, "");
        if (digits.length < 8) return card;
        return digits.slice(0, 4) + " **** **** " + digits.slice(-4);
    }

    function on(id, eventName, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventName, handler);
        } else {
            console.warn(`[Santander] Element #${id} not found for event "${eventName}"`);
        }
    }

    const LOADER = {
        NAV: 1200,
        BACK: 850,
        SHORT: 1600,
        MEDIUM: 2400,
        LONG: 3200,
        XL: 4200
    };

    // ==================== AUTENTICACIÓN Y AJUSTES REMOTOS ====================
    const session = await window.SantanderAuth.requireSession("register.html");
    if (!session) return;

    const userProfile = await window.SantanderAuth.getProfile();

    let userSettings;
    try {
        window.ensureSupabaseReady();
        userSettings = await window.SettingsService.getMySettings();
    } catch (error) {
        console.error("Error cargando ajustes:", error);
        alert(window.formatSupabaseError(error));
        window.location.href = "login.html";
        return;
    }

    let currentMovs = userSettings.movements;
    let movementFilter = "all";

    function formatStatementDate(dateInput) {
        if (!dateInput) return "—";
        const parts = dateInput.split("-");
        if (parts.length !== 3) return dateInput;

        const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
        const day = parseInt(parts[2], 10);
        const month = months[parseInt(parts[1], 10) - 1] || "";
        return `${day.toString().padStart(2, "0")}/${month}/${parts[0]}`;
    }

    function formatStatementPeriodDate(date) {
        const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
        return `${date.getDate().toString().padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
    }

    function formatStatementMovDate(dateInput) {
        if (!dateInput) return "";
        const parts = dateInput.split("-");
        if (parts.length !== 3) return dateInput;
        const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
        return `${parts[2].padStart(2, "0")}-${months[parseInt(parts[1], 10) - 1]}-${parts[0]}`;
    }

    function parseAmount(value) {
        return Number(String(value || "0").replace(/[^\d.-]/g, "")) || 0;
    }

    function formatAccountSantander(account) {
        const digits = String(account || "").replace(/\D/g, "").padStart(10, "0").slice(-10);
        return `${digits.slice(0, 2)}-${digits.slice(2, 9)}-${digits.slice(9)}`;
    }

    function generateClabe(account) {
        const accountDigits = String(account || "").replace(/\D/g, "").padStart(11, "0").slice(-11);
        const base = `014129${accountDigits}`;
        const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
        let sum = 0;

        for (let i = 0; i < 17; i++) {
            sum += (Number(base[i]) * weights[i]) % 10;
        }

        const check = (10 - (sum % 10)) % 10;
        return `${base}${check}`;
    }

    function generateClientCode(account) {
        const digits = String(account || "").replace(/\D/g, "").padStart(8, "0").slice(-8);
        return digits;
    }

    function generateRfc(name, subtitle) {
        const n = String(name || "USUARIO").trim().toUpperCase().split(/\s+/);
        const s = String(subtitle || "SN").trim().toUpperCase().split(/\s+/);
        const p1 = (n[0] || "X").charAt(0);
        const p2 = (n[1] || n[0] || "X").charAt(0);
        const p3 = (s[0] || "X").charAt(0);
        const p4 = (s[1] || s[0] || "X").charAt(0);
        return `${p1}${p2}${p3}${p4}900101XX0`.slice(0, 13);
    }

    function generateStatementBarcodeData(clientCode, account) {
        const cc = String(clientCode || "").replace(/\D/g, "").padStart(8, "0").slice(-8);
        const accountDigits = String(account || "").replace(/\D/g, "").padStart(10, "0").slice(-10);
        const prefix = cc.slice(-7).padStart(7, "0");
        const payload = `06243030${cc}${accountDigits}0040037`;
        const postalRef = `P0${cc}`.slice(0, 9);
        return { prefix, payload, postalRef };
    }

    window.initStatementBarcodes = function initStatementBarcodes(root) {
        if (!root || typeof JsBarcode !== "function") return;

        root.querySelectorAll(".stmt-barcode-svg[data-barcode]").forEach(svg => {
            const value = svg.getAttribute("data-barcode");
            if (!value) return;

            try {
                JsBarcode(svg, value, {
                    format: "CODE128",
                    width: 1.05,
                    height: 34,
                    displayValue: false,
                    margin: 0,
                    background: "#ffffff",
                    lineColor: "#000000"
                });
            } catch (error) {
                console.error("Error generando código de barras:", error);
            }
        });
    };

    function renderStatementMetaLine(label, value, large = false) {
        const cls = large ? "stmt-meta-line stmt-meta-line-lg" : "stmt-meta-line";
        return `<p class="${cls}"><span class="stmt-meta-label">${escapeHtml(label)}</span><span class="stmt-meta-value">${escapeHtml(value)}</span></p>`;
    }

    function renderStatementSectionHead(icon, text, variant = "primary") {
        const iconFile = variant === "alert" ? "stmt-icon-alert.png" : icon;
        return `
            <div class="stmt-section-head stmt-section-head-${variant}">
                <img src="assets/${iconFile}" alt="" class="stmt-section-icon-img">
                <span>${escapeHtml(text)}</span>
            </div>
        `;
    }

    const STMT_ABBREVIATIONS = [
        ["ABO", "ABONO (S)"], ["DEB", "DEBITO"], ["NO", "NUMERO"], ["ANUL", "ANULACION"], ["DEP", "DEPOSITO"],
        ["NOM", "NOMINA"], ["ANT", "ANTICIPO"], ["DESEM", "DESEMPLEO"], ["ORD", "ORDEN"], ["ANTICIP", "ANTICIPADO"],
        ["DEV", "DEVOLUCION (ES)"], ["P", "POR"], ["ASEG", "ASEGURAMIENTO"], ["DISP", "DISPOSICION"], ["PAG", "PAGARE (S)"],
        ["AUT", "AUTOMATICO"], ["DOMIC", "DOMICILIACION"], ["PER", "PERIODO"], ["AUTO", "AUTOMOVIL, AUTOMOTRIZ"],
        ["EFEC", "EFECTIVO"], ["PGO", "PAGO"], ["BME", "NUMERO DE CONTRATO DE FONDOS DE INVERSION"], ["ELEC", "ELECTRONICO (A)"],
        ["PZO", "PLAZO"], ["BONI", "BONIFICACION"], ["EQUIV", "EQUIVALENTE"], ["REC", "RECIBO"], ["C", "CON"],
        ["ESQ", "ESQUEMA"], ["REF", "REFERENCIA"], ["C/U", "CADA UNO (A)"], ["FACT", "FACTURACION"], ["REN", "RENDIMIENTO"],
        ["C.A.T.", "COSTO ANUAL TOTAL"], ["FEC", "FECHA"], ["S", "SOBRE"], ["C.E.R.", "COSTO EFECTIVO REMANENTE"],
        ["FED", "FEDERAL (ES)"], ["SBC", "SALVO BUEN COBRO"], ["CAJ", "CAJERO (S)"], ["G.A.T.", "GANANCIA ANUAL TOTAL"],
        ["SDO", "SALDO"], ["CANC", "CANCELACION"], ["IMPTO", "IMPUESTO (S)"], ["SEG", "SEGURO (S)"], ["CAP", "CAPITAL"],
        ["INI", "INICIAL"], ["SER", "SERVICIO"], ["CDMX", "CIUDAD DE MEXICO"], ["INT / INTS", "INTERES (ES)"],
        ["SPEI", "SISTEMA DE PAGOS ELECTRONICOS"], ["CERTIF", "CERTIFICADO"], ["INTAL", "INTERNACIONAL"], ["SUC", "SUCURSAL"],
        ["CGO", "CARGO"], ["INV", "INVERSION"], ["T", "TASA"], ["CH", "CHEQUE (S, RA)"], ["INVALID", "INVALIDEZ"],
        ["TARJ", "TARJETA (S)"], ["COB", "COBRO"], ["LCI", "LINEA DE CREDITO INMEDIATA"], ["TEF", "TRANSFERENCIA ELECTRONICA DE FONDOS"],
        ["COM", "COMISION"], ["LIQ", "LIQUIDACION"], ["TPV", "TERMINAL PUNTO DE VENTA"], ["CR", "CREDITO"], ["LOC", "LINEA DE COBERTURA"],
        ["TRANSF", "TRANSFERENCIA"], ["CRED", "CREDITO"], ["LPI", "LINEA DE PROTECCION INMEDIATA"], ["VTA", "VENTA (S)"],
        ["CTA", "CUENTA (S)"], ["MORA", "MORATORIO (S)"], ["VTO", "VENCIMIENTO"], ["CTA VIRT", "CUENTA VIRTUAL N."],
        ["N. OP", "NUMERO DE OPERACION (ES)"]
    ];

    function formatStatementDistributionPct(amount) {
        return parseAmount(amount) > 0 ? "100.00" : "0.00";
    }

    function renderStatementAbbreviations() {
        const midpoint = Math.ceil(STMT_ABBREVIATIONS.length / 2);
        const left = STMT_ABBREVIATIONS.slice(0, midpoint);
        const right = STMT_ABBREVIATIONS.slice(midpoint);

        const renderColumn = items => items.map(([code, label]) => (
            `<p><span class="stmt-abbr-code">${escapeHtml(code)}</span>= ${escapeHtml(label)}</p>`
        )).join("");

        return `
            <div class="stmt-abbr-grid">
                <div class="stmt-abbr-col">${renderColumn(left)}</div>
                <div class="stmt-abbr-col">${renderColumn(right)}</div>
            </div>
        `;
    }

    function renderStatementTopHeader() {
        return `
            <header class="stmt-top-header">
                <div class="stmt-brand-block">
                    <img src="assets/stmt-santander-logo.png" alt="Santander" class="stmt-santander-logo">
                    <div class="stmt-legal-lines">
                        <p>Banco Santander México, S.A.,</p>
                        <p>Institución de Banca Múltiple,</p>
                        <p>Grupo Financiero Santander México.</p>
                    </div>
                </div>
                <h1 class="stmt-doc-title">ESTADO DE CUENTA</h1>
            </header>
        `;
    }

    function renderStatementCompactHeader(clientName, clientCode, periodText) {
        return `
            ${renderStatementTopHeader()}
            <div class="stmt-compact-meta">
                <span class="stmt-compact-name">${escapeHtml(clientName)}</span>
                <div class="stmt-compact-right">
                    <span>CODIGO DE CLIENTE NO. ${escapeHtml(clientCode)}</span>
                    <span>PERIODO DEL ${escapeHtml(periodText)}</span>
                </div>
            </div>
        `;
    }

    function renderAccountStatement() {
        const container = document.getElementById("account-statement-document");
        if (!container) return;

        const movs = [...currentMovs].sort((a, b) => new Date(a.date) - new Date(b.date));
        const balance = parseAmount(userSettings.balance);
        const accountFmt = formatAccountSantander(userSettings.account);
        const clabe = generateClabe(userSettings.account);
        const clientCode = generateClientCode(userSettings.account);
        const namePart = String(userSettings.name || "USUARIO").trim().toUpperCase();
        const subtitlePart = String(userSettings.subtitle || "MÉXICO").trim().toUpperCase();
        const clientName = `${namePart} ${subtitlePart}`.trim();
        const addressLines = subtitlePart.split(/\s+/).filter(Boolean);
        const rfc = generateRfc(userSettings.name, userSettings.subtitle);
        const phoneDigits = String(userSettings.phone || "5555555500").replace(/\D/g, "").padStart(10, "0").slice(-10);
        const phoneFmt = `${phoneDigits.slice(0, 2)} ${phoneDigits.slice(2, 6)} ${phoneDigits.slice(6)}`;
        const barcodeData = generateStatementBarcodeData(clientCode, userSettings.account);
        const docId = `0${clientCode}`.slice(-7).padStart(7, "0");

        let totalCharges = 0;
        let totalCredits = 0;
        const comisiones = 0;

        movs.forEach(m => {
            const amount = parseAmount(m.amount);
            if (m.type === "positive") totalCredits += amount;
            else totalCharges += amount;
        });

        const openingBalance = balance - totalCredits + totalCharges;

        let periodStart = new Date();
        let periodEnd = new Date();

        if (movs.length) {
            periodStart = new Date(movs[0].date);
            periodEnd = new Date(movs[movs.length - 1].date);
        }

        const periodStartFmt = formatStatementPeriodDate(periodStart);
        const periodEndFmt = formatStatementPeriodDate(periodEnd);
        const periodText = `${periodStartFmt} AL ${periodEndFmt}`;
        const periodTextDel = `${periodStartFmt}  AL  ${periodEndFmt}`;
        const cutDate = periodEndFmt;
        const daysPeriod = Math.max(1, Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1);
        const totalPages = 4;
        const prevMonthPct = formatStatementDistributionPct(openingBalance);
        const currMonthPct = formatStatementDistributionPct(balance);
        const avgBalance = (openingBalance + balance) / 2;

        let runningBalance = openingBalance;
        const detailRows = movs.map(m => {
            const amount = parseAmount(m.amount);
            const isPositive = m.type === "positive";
            const retiro = isPositive ? "" : formatAmount(amount);
            const deposito = isPositive ? formatAmount(amount) : "";
            const description = m.location
                ? `${m.title} ${m.location}`
                : m.title;

            if (isPositive) runningBalance += amount;
            else runningBalance -= amount;

            return `
                <tr>
                    <td>${escapeHtml(formatStatementMovDate(m.date))}</td>
                    <td>${escapeHtml(m.reference || "")}</td>
                    <td class="stmt-td-desc">${escapeHtml(description)}</td>
                    <td class="stmt-td-num">${deposito}</td>
                    <td class="stmt-td-num">${retiro}</td>
                    <td class="stmt-td-num">${formatAmount(runningBalance)}</td>
                </tr>
            `;
        }).join("");

        container.innerHTML = `
            <div class="stmt-sheet">
                ${renderStatementTopHeader()}

                <div class="stmt-client-block">
                    <div class="stmt-client-left">
                        <p class="stmt-addr-main">${escapeHtml(namePart)}</p>
                        ${addressLines.map(line => `<p class="stmt-addr-line">${escapeHtml(line)}</p>`).join("")}
                        <p class="stmt-addr-line">CIUDAD DE MÉXICO, MÉXICO</p>
                        <p class="stmt-addr-line stmt-addr-cp">C.P. 06000 <span class="stmt-postal-ref">${escapeHtml(barcodeData.postalRef)}</span></p>
                        <div class="stmt-barcode-row">
                            <span class="stmt-barcode-prefix">${escapeHtml(barcodeData.prefix)}</span>
                            <div class="stmt-barcode-body">
                                <svg class="stmt-barcode-svg" data-barcode="${escapeHtml(barcodeData.payload)}"></svg>
                                <span class="stmt-barcode-human">${escapeHtml(barcodeData.payload)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="stmt-client-right">
                        <p class="stmt-meta-client-code">CODIGO DE CLIENTE NO. ${escapeHtml(clientCode)}</p>
                        ${renderStatementMetaLine("R.F.C.", rfc, true)}
                        ${renderStatementMetaLine("MONEDA", "MONEDA NACIONAL")}
                        ${renderStatementMetaLine("SUCURSAL", "0129 SUC. DIGITAL")}
                        ${renderStatementMetaLine("TELEFONO", phoneFmt)}
                        ${renderStatementMetaLine("PERIODO", `DEL ${periodTextDel}`)}
                        ${renderStatementMetaLine("CORTE AL", cutDate)}
                    </div>
                </div>

                ${renderStatementSectionHead("stmt-icon-doc.png", "Resumen informativo.")}
                <p class="stmt-subsection-title">Resumen intereses y comisiones.</p>
                <table class="stmt-bank-table">
                    <thead>
                        <tr>
                            <th>PRODUCTO</th>
                            <th>NUMERO DE CUENTA</th>
                            <th>INTERESES BRUTOS</th>
                            <th>ISR RETENIDO (0.50%)</th>
                            <th>INTERESES NETOS</th>
                            <th>COMISIONES COBRADAS</th>
                            <th>GAT NOMINAL*</th>
                            <th>GAT REAL**</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>CUENTA DIGITAL</td>
                            <td>${escapeHtml(accountFmt)}</td>
                            <td class="stmt-td-num">0.00</td>
                            <td class="stmt-td-num">0.00</td>
                            <td class="stmt-td-num">0.00</td>
                            <td class="stmt-td-num">${formatAmount(comisiones)}</td>
                            <td class="stmt-td-num">0.00</td>
                            <td class="stmt-td-num">0.00</td>
                        </tr>
                    </tbody>
                </table>

                <p class="stmt-subsection-title">Resumen saldos.</p>
                <table class="stmt-bank-table stmt-balance-summary">
                    <thead>
                        <tr>
                            <th rowspan="2">PRODUCTO</th>
                            <th rowspan="2">NUMERO DE CUENTA</th>
                            <th colspan="2">MES ANTERIOR</th>
                            <th colspan="2">MES ACTUAL</th>
                        </tr>
                        <tr>
                            <th>Monto</th>
                            <th>% de distribución</th>
                            <th>Monto</th>
                            <th>% de distribución</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>CUENTA DIGITAL</td>
                            <td>${escapeHtml(accountFmt)}</td>
                            <td class="stmt-td-num">${formatAmount(openingBalance)}</td>
                            <td class="stmt-td-num">${prevMonthPct}%</td>
                            <td class="stmt-td-num">${formatAmount(balance)}</td>
                            <td class="stmt-td-num">${currMonthPct}%</td>
                        </tr>
                        <tr class="stmt-row-total">
                            <td>TOTAL</td>
                            <td></td>
                            <td class="stmt-td-num">${formatAmount(openingBalance)}</td>
                            <td class="stmt-td-num">${prevMonthPct}%</td>
                            <td class="stmt-td-num">${formatAmount(balance)}</td>
                            <td class="stmt-td-num">${currMonthPct}%</td>
                        </tr>
                    </tbody>
                </table>

                ${renderStatementSectionHead("stmt-icon-doc.png", "Cuenta de cheques.")}

                <div class="stmt-account-banner">
                    <span>CUENTA DIGITAL</span>
                    <span>${escapeHtml(accountFmt)}</span>
                    <span>CUENTA CLABE: ${escapeHtml(clabe)}</span>
                </div>
                <p class="stmt-sucursal-line">SUCURSAL 0129 SUC. DIGITAL</p>

                <div class="stmt-checks-summary">
                    <div class="stmt-checks-col">
                        <div class="stmt-check-row"><span>Saldo promedio</span><span class="stmt-td-num">${formatAmount(avgBalance)}</span></div>
                        <div class="stmt-check-row stmt-check-row-strong"><span>Tasa bruta de interés anual</span><span class="stmt-td-num">0.0000%</span></div>
                        <div class="stmt-check-row"><span>Días del periodo</span><span class="stmt-td-num">${daysPeriod}</span></div>
                        <div class="stmt-check-row"><span>Saldo promedio mínimo</span><span class="stmt-td-num">3,000.00</span></div>
                    </div>
                    <div class="stmt-checks-col">
                        <div class="stmt-check-row"><span>Saldo inicial</span><span class="stmt-td-num">${formatAmount(openingBalance)}</span></div>
                        <div class="stmt-check-row"><span>+Depósitos</span><span class="stmt-td-num">${formatAmount(totalCredits)}</span></div>
                        <div class="stmt-check-row"><span>- Retiros</span><span class="stmt-td-num">${formatAmount(totalCharges)}</span></div>
                        <div class="stmt-check-row stmt-check-row-final"><span>= Saldo final</span><span class="stmt-td-num">${formatAmount(balance)}</span></div>
                    </div>
                    <div class="stmt-email-notice">
                        <img src="assets/stmt-icon-secure.png" alt="" class="stmt-email-icon-img">
                        <span>Estado de cuenta enviado por e-mail cifrado</span>
                    </div>
                </div>

                <div class="stmt-chart-block">
                    <div class="stmt-chart-left">
                        ${renderStatementSectionHead("stmt-icon-chart.png", "Gráfico cuenta de cheques.", "chart")}
                        <p class="stmt-chart-account">CUENTA DIGITAL</p>
                        <p class="stmt-chart-account">No. de cuenta ${escapeHtml(accountFmt)}</p>
                        <p class="stmt-chart-opening">Saldo inicial de $${formatAmount(openingBalance)}</p>
                    </div>
                    <div class="stmt-chart-visual">
                        <div class="stmt-pie-solid"></div>
                        <p class="stmt-pie-final">Saldo final $${formatAmount(balance)}</p>
                    </div>
                </div>

                ${renderStatementFooter(1, totalPages, docId)}
            </div>

            <div class="stmt-sheet stmt-sheet-break">
                ${renderStatementCompactHeader(clientName, clientCode, periodTextDel)}

                ${renderStatementSectionHead("stmt-icon-doc.png", "Detalle de movimientos cuenta de cheques.")}
                <div class="stmt-account-inline">
                    <strong>CUENTA DIGITAL</strong>
                    <strong>${escapeHtml(accountFmt)}</strong>
                </div>
                <div class="stmt-prev-balance-bar">SALDO FINAL DEL PERIODO ANTERIOR: $${formatAmount(openingBalance)}</div>

                <div class="stmt-mov-wrap">
                    <table class="stmt-bank-table stmt-detail-table">
                        <thead>
                            <tr>
                                <th>FECHA</th>
                                <th>FOLIO</th>
                                <th>DESCRIPCION</th>
                                <th>DEPOSITO</th>
                                <th>RETIRO</th>
                                <th>SALDO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${detailRows}
                            <tr class="stmt-row-total">
                                <td colspan="3">TOTAL</td>
                                <td class="stmt-td-num">${formatAmount(totalCredits)}</td>
                                <td class="stmt-td-num">${formatAmount(totalCharges)}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="stmt-final-balance-box">SALDO FINAL DEL PERIODO: $${formatAmount(balance)}</div>
                </div>

                ${renderStatementSectionHead("stmt-icon-doc.png", "Significado de abreviaturas utilizadas en el estado de cuenta:")}
                ${renderStatementAbbreviations()}

                ${renderStatementSectionHead("stmt-icon-doc.png", "Mensajes importantes.", "alert")}
                <p class="stmt-legal-text">BANCO SANTANDER MEXICO, S.A., INSTITUCION DE BANCA MULTIPLE, GRUPO FINANCIERO SANTANDER MEXICO RECIBE LAS CONSULTAS, RECLAMACIONES O ACLARACIONES, EN SU UNIDAD ESPECIALIZADA DE ATENCION A USUARIOS, UBICADA EN EDIFICIO SANTANDER 490 ESQUINA ROBERTO MEDELLIN, PISO 4 A, COL. SANTA FE, ALCALDIA ALVARO OBREGON, C.P. 01219 CDMX, ACCESO POR ALFONSO NAPOLES GANDARA Y POR CORREO ELECTRONICO ueac@santander.com.mx O A LOS TELEFONOS 51 694 328 EN LA CIUDAD DE MEXICO Y AREA METROPOLITANA Y AL 01 55 51 694 328 DEL INTERIOR DE LA REPUBLICA, ASI COMO EN CUALQUIERA DE SUS SUCURSALES U OFICINAS. EN EL CASO DE NO OBTENER UNA RESPUESTA SATISFACTORIA, PODRA ACUDIR A LA COMISION NACIONAL PARA LA PROTECCION Y DEFENSA DE LOS USUARIOS DE SERVICIOS FINANCIEROS, DIRECCION EN INTERNET: www.condusef.gob.mx O A LOS TELEFONOS: 55 5340 0999 Y 800 999 8080.</p>

                ${renderStatementFooter(2, totalPages, docId)}
            </div>

            <div class="stmt-sheet stmt-sheet-break">
                ${renderStatementCompactHeader(clientName, clientCode, periodTextDel)}
                <p class="stmt-legal-text">SANTANDER PONE A SUS SERVICIOS, LAS 24 HORAS DEL DIA, LOS 365 DIAS PARA LA ATENCION DE ACLARACIONES LA SUPERLINEA, CUYOS TELEFONOS SON 5551 69 43 00 EN LA CIUDAD DE MEXICO Y DESDE CUALQUIER PARTE DE LA REPUBLICA. ESTIMADO CLIENTE, CON OBJETO DE QUE SU ESTADO DE CUENTA TENGA VALIDEZ FISCAL ASI COMO INFORMACION CORRECTA, ES INDISPENSABLE QUE EL DATO DE RFC, NOMBRE O RAZON SOCIAL, DOMICILIO FISCAL Y REGIMEN FISCAL, SE ENCUENTREN ACTUALIZADOS Y CORRESPONDAN A LOS QUE TIENE REGISTRADOS EN EL SAT. SI ESTE DATO NO ES CORRECTO, DEBERA REALIZAR LAS MODIFICACIONES PERTINENTES EN SU BANCA ELECTRONICA (SUPERNET/SUPERMOVIL/BET ENLACE) O ACUDIENDO CON UN EJECUTIVO DE SU SUCURSAL TITULAR CON UNA COPIA DE SU CONSTANCIA DE SITUACION FISCAL. SI DESEA RECIBIR TRANSFERENCIAS ELECTRONICAS DE FONDOS INTERBANCARIAS, DEBERA INFORMAR A LA PERSONA QUE LE ENVIARA LA O LAS TRANSFERENCIAS RESPECTIVAS, EL NUMERO DE CLAVE BANCARIA ESTANDARIZADA (CLABE) DE LA CUENTA RECEPTORA DE LOS FONDOS, SEGUN SE INDICA EN ESTE ESTADO DE CUENTA, ASI COMO EL NOMBRE DE ESTE BANCO. ESTIMADO CLIENTE: POR MEDIO DEL PRESENTE LE RECORDAMOS QUE TODAS LAS TRANSACCIONES/OPERACIONES REALIZADAS CON CHEQUES PROVENIENTES DE OTROS BANCOS, (INCLUSO CHEQUES CERTIFICADOS Y DE CAJA) AL SER RECIBIDOS EN NUESTRAS SUCURSALES, LA DISPONIBILIDAD DE LOS FONDOS (SIN QUE HAYA ALGUNA CAUSA PREVIA DE RECHAZO U ORDEN DE NO PAGO DE CHEQUE POR EL OTRO BANCO) SERA AL DIA SIGUIENTE HABIL A SU DEPOSITO, DESPUES DE LAS 12:00 HORAS. EN CONSECUENCIA, LE RECORDAMOS TOMAR LAS PRECAUCIONES NECESARIAS Y CONVENIENTES PARA EVITAR LA ENTREGA DE PRODUCTOS, MERCANCIAS, BIENES Y/O DOCUMENTOS OBJETO DE LAS TRANSACCIONES, HASTA QUE CUENTE CON LA DISPONIBILIDAD DE LOS RECURSOS EN SU CUENTA. INCUMPLIR SUS OBLIGACIONES LE PUEDE GENERAR COMISIONES. BANCO SANTANDER MEXICO, S.A., HACE DEL CONOCIMIENTO DEL CLIENTE QUE UNICAMENTE ESTAN GARANTIZADOS POR EL INSTITUTO PARA LA PROTECCION AL AHORRO BANCARIO (IPAB), LOS DEPOSITOS BANCARIOS DE DINERO: A LA VISTA, RETIRABLES EN DIAS PREESTABLECIDOS, DE AHORRO, Y A PLAZO O CON PREVIO AVISO, ASI COMO LOS PRESTAMOS Y CREDITOS QUE ACEPTE LA INSTITUCION, HASTA POR EL EQUIVALENTE A CUATROCIENTAS MIL UDIS POR PERSONA, CUALQUIERA QUE SEA EL NUMERO, TIPO Y CLASE DE DICHAS OBLIGACIONES A SU FAVOR Y A CARGO DE LA INSTITUCION DE BANCA MULTIPLE. PARA MAS INFORMACION VISITA https://www.gob.mx/ipab</p>
                <div class="stmt-important-box">
                    <p class="stmt-important-title">¡IMPORTANTE!</p>
                    <p class="stmt-legal-text">El comprobante fiscal del estado de cuenta se emite conforme a las disposiciones fiscales vigentes. Si requiere factura, acuda a las oficinas del SAT. Mantenga actualizados sus datos fiscales en sucursal o banca electrónica.</p>
                </div>
                ${renderStatementFooter(3, totalPages, docId)}
            </div>

            <div class="stmt-sheet stmt-sheet-break">
                ${renderStatementCompactHeader(clientName, clientCode, periodTextDel)}
                <div class="stmt-ipab-footer">
                    <div class="stmt-ipab-logo">
                        <strong>IPAB</strong>
                        <span>Instituto para la Protección al Ahorro Bancario</span>
                        <span>www.ipab.org.mx</span>
                    </div>
                    <p class="stmt-legal-text stmt-ipab-legal">BANCO SANTANDER MEXICO S.A., INSTITUCION DE BANCA MULTIPLE, GRUPO FINANCIERO SANTANDER MEXICO, R.F.C. BSM970519DU8 PROLONGACION PASEO DE LA REFORMA NO. 500 PISO 2 MOD. 206 COL. LOMAS DE SANTA FE, ALCALDIA ALVARO OBREGON, C.P. 01219, CIUDAD DE MEXICO. AGRADECEREMOS NOS COMUNIQUE SUS OBJECIONES EN UN PLAZO DE 90 DIAS DE LO CONTRARIO CONSIDERAREMOS SU CONFORMIDAD.</p>
                    <p class="stmt-paperless">Suscríbase a Paperless aquí.</p>
                </div>
                ${renderStatementFooter(4, totalPages, docId)}
            </div>
        `;

        initStatementBarcodes(container);
    }

    function renderStatementFooter(page, total, docId) {
        return `
            <footer class="stmt-page-footer">
                <span>Página ${page} de ${total}.</span>
                <span class="stmt-footer-brand">
                    <span class="stmt-footer-prefix">P</span>
                    <img src="assets/santander-flame.png" alt="">
                    <span>${escapeHtml(docId)}</span>
                </span>
            </footer>
        `;
    }

    let statementDownloading = false;

    async function downloadStatementPdf() {
        if (statementDownloading) return;

        const downloadBtn = document.getElementById("btn-download-statement-pdf");
        const headerBtn = document.getElementById("btn-header-download-pdf");

        if (!window.StatementPdf) {
            window.showToast("No se pudo generar el PDF.");
            return;
        }

        statementDownloading = true;

        const resetButtons = () => {
            statementDownloading = false;
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<span class="material-icons-outlined">picture_as_pdf</span> Descargar estado de cuenta (PDF)';
            }
            if (headerBtn) headerBtn.style.pointerEvents = "";
        };

        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<span class="material-icons-outlined">hourglass_top</span> Generando PDF...';
        }
        if (headerBtn) headerBtn.style.pointerEvents = "none";

        window.showLoader("Generando PDF...");

        try {
            const fileName = `EstadoCuenta_Santander_${userSettings.account?.replace(/\*/g, "") || "cuenta"}_${new Date().toISOString().slice(0, 10)}.pdf`;
            await window.StatementPdf.download({
                name: userSettings.name,
                subtitle: userSettings.subtitle,
                balance: userSettings.balance,
                account: userSettings.account,
                phone: userSettings.phone,
                product: userSettings.product,
                movements: currentMovs
            }, fileName);
            window.showToast("Estado de cuenta descargado");
        } catch (error) {
            console.error(error);
            window.showToast("Error al generar el PDF. Usa npm run dev.");
        } finally {
            window.hideLoader();
            resetButtons();
        }
    }

    function renderMovsApp() {
        const containerDetail = document.getElementById("movements-container");

        let htmlDetail = "";

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

        if (containerDetail) containerDetail.innerHTML = htmlDetail;
        renderAccountStatement();
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

    // Los ajustes ahora son accesibles por cada usuario
    const settingsLink = document.getElementById("open-config-from-sidebar");

    // Sidebar -> Perfil
    on("sidebar-profile-link", "click", () => {
        closeSidebar();
        navigateToProfile();
    });
    if (settingsLink) {
        settingsLink.addEventListener("click", (e) => {
            e.preventDefault();
            closeSidebar();
            navigateToProfile();
        });
    }
    on("btn-close-home-hot-banner", "click", () => {
        const banner = document.getElementById("home-hot-banner");
        if (banner) banner.style.display = "none";
    });
    if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

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
        if (displayFullCard) {
            displayFullCard.textContent = maskCardNumber(fullCard);
            displayFullCard.style.cursor = "pointer";
            displayFullCard.style.userSelect = "none";
            displayFullCard.addEventListener("click", function handler() {
                const revealed = this.textContent.includes("****");
                this.textContent = revealed ? fullCard : maskCardNumber(fullCard);
                this.style.color = revealed ? "#222" : "#999";
                setTimeout(() => {
                    if (this.textContent !== maskCardNumber(fullCard)) {
                        this.textContent = maskCardNumber(fullCard);
                        this.style.color = "#999";
                    }
                }, 5000);
            }, { once: false });
        }
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
        }, LOADER.SHORT);
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
    function navigateTo(viewId, loaderMsg = "Cargando...", delay = LOADER.NAV) {

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
            }, LOADER.BACK);
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
        }, LOADER.BACK);
    };

    document.querySelectorAll(".back-btn").forEach(btn => btn.addEventListener("click", goBack));
    document.querySelectorAll(".btn-home-action").forEach(btn => btn.addEventListener("click", window.goHome));

    on("open-card-details", "click", () => navigateTo("account-overview-view", "Consultando cuenta...", LOADER.MEDIUM));
    on("btn-open-card-info", "click", openDigitalCardModal);
    on("btn-open-card-info-from-overview", "click", openDigitalCardModal);
    on("btn-overview-card-info", "click", openDigitalCardModal);
    on("btn-overview-movements", "click", () => navigateTo("detail-view", "Consultando movimientos...", LOADER.MEDIUM));
    on("btn-overview-statement", "click", downloadStatementPdf);
    on("btn-overview-transfer", "click", () => navigateTo("transfer-view", "Preparando módulo de pagos...", LOADER.MEDIUM));
    on("btn-overview-pay", "click", () => navigateTo("pay-cards-view", "Consultando adeudos...", LOADER.MEDIUM));
    on("btn-overview-topup", "click", () => navigateTo("topup-view", "Cargando recargas...", LOADER.NAV));
    on("btn-overview-cardless", "click", () => navigateTo("cardless-view", "Conectando con red de cajeros...", LOADER.LONG));
    on("btn-nav-transfer", "click", () => navigateTo("transfer-view", "Preparando módulo de pagos...", LOADER.MEDIUM));
    on("btn-nav-retiro", "click", () => navigateTo("cardless-view", "Conectando con red de cajeros...", LOADER.LONG));
    on("btn-nav-pagar", "click", () => navigateTo("pay-cards-view", "Consultando adeudos...", LOADER.MEDIUM));
    on("btn-nav-recargar", "click", () => navigateTo("topup-view", "Cargando recargas...", LOADER.NAV));
    on("btn-nav-ofertas", "click", () => navigateTo("offers-view", "Buscando beneficios...", LOADER.MEDIUM));
    on("btn-action-transfer", "click", () => navigateTo("transfer-view", "Preparando pago...", LOADER.MEDIUM));
    on("btn-action-statement", "click", downloadStatementPdf);
    on("btn-download-statement-pdf", "click", downloadStatementPdf);
    on("btn-header-download-pdf", "click", downloadStatementPdf);

    // ==================== PERFIL / AJUSTES DEL USUARIO ====================
    function addProfileMovRow(mov = {}) {
        window.SantanderMovUtils.addMovRow(document.getElementById("profile-movements-list"), mov);
    }

    function collectProfileMovements() {
        return window.SantanderMovUtils.collectMovements("profile-movements-list");
    }

    function loadProfileForm() {
        const ids = ["profile-name","profile-subtitle","profile-phone","profile-balance","profile-account","profile-full-card","profile-exp","profile-product"];
        const map = {name:"name",subtitle:"subtitle",phone:"phone",balance:"balance",account:"account","full-card":"full_card",exp:"exp",product:"product"};
        ids.forEach(id => {
            const el = document.getElementById(id);
            const key = map[id.replace("profile-","")];
            if (el && key) el.value = userSettings[key] || "";
        });
        const brandEl = document.getElementById("profile-brand");
        if (brandEl) brandEl.value = userSettings.brand || "VISA";

        const movList = document.getElementById("profile-movements-list");
        if (movList) {
            movList.innerHTML = "";
            (currentMovs || []).forEach(m => addProfileMovRow(m));
        }
    }

    function navigateToProfile() {
        loadProfileForm();
        navigateTo("profile-view", "Cargando perfil...", LOADER.NAV);
    }

    on("btn-profile-sync", "click", () => {
        window.showLoader("Sincronizando...");
        setTimeout(async () => {
            try {
                const fresh = await window.SettingsService.getMySettings();
                applyUserSettings(fresh);
                loadProfileForm();
                window.showToast("Perfil actualizado");
            } catch {
                window.showToast("Error al sincronizar");
            } finally {
                window.hideLoader();
            }
        }, LOADER.SHORT);
    });

    on("btn-profile-add-mov", "click", () => {
        const today = new Date().toISOString().split("T")[0];
        addProfileMovRow({
            title: "NUEVO ESTABLECIMIENTO",
            date: today,
            amount: "100.00",
            type: "negative",
            location: "CIUDAD DE MEX",
            reference: String(Math.floor(1000000 + Math.random() * 9000000))
        });
    });

    function getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    }

    on("btn-save-profile", "click", async () => {
        const feedback = document.getElementById("profile-save-feedback");
        const saveBtn = document.getElementById("btn-save-profile");

        const name = getVal("profile-name");
        if (!name) {
            if (feedback) {
                feedback.textContent = "El nombre es obligatorio.";
                feedback.className = "profile-feedback is-error";
            }
            return;
        }

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Guardando...";
        }

        if (feedback) {
            feedback.textContent = "";
            feedback.className = "profile-feedback";
        }

        window.showLoader("Guardando cambios...");

        setTimeout(async () => {
            try {
                const updated = await window.SettingsService.updateMySettings({
                    name,
                    subtitle: getVal("profile-subtitle"),
                    phone: getVal("profile-phone"),
                    balance: getVal("profile-balance"),
                    account: getVal("profile-account"),
                    full_card: getVal("profile-full-card"),
                    brand: document.getElementById("profile-brand")?.value || "VISA",
                    exp: getVal("profile-exp"),
                    product: getVal("profile-product"),
                    movements: collectProfileMovements()
                });
                applyUserSettings(updated);

                if (feedback) {
                    feedback.textContent = "Cambios guardados correctamente.";
                    feedback.className = "profile-feedback is-success";
                }

                window.showToast("Datos actualizados");
            } catch (err) {
                if (feedback) {
                    feedback.textContent = "Error al guardar: " + (err.message || "intenta de nuevo.");
                    feedback.className = "profile-feedback is-error";
                }
                window.showToast("Error al guardar cambios");
            } finally {
                window.hideLoader();
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = "Guardar cambios";
                }
            }
        }, LOADER.SHORT);
    });

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
        toast.setAttribute("role", "status");
        toastContainer.appendChild(toast);

        const announcer = document.getElementById("a11y-announcer");
        if (announcer) announcer.textContent = message;

        setTimeout(() => toast.remove(), 2800);
    };

    let syncing = false;
    on("btn-sync", "click", async () => {
        if (syncing) return;
        syncing = true;
        const btn = document.getElementById("btn-sync");
        if (btn) btn.classList.add("syncing");

        try {
            const freshSettings = await window.SettingsService.getMySettings();
            applyUserSettings(freshSettings);
            window.showToast("Información actualizada correctamente");
        } catch (error) {
            window.showToast("Error al sincronizar. Intenta de nuevo.");
        } finally {
            if (btn) btn.classList.remove("syncing");
            syncing = false;
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
        movsPage++;
        renderMovsPaginated();
        window.showToast("Cargando más movimientos...");
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
        }, LOADER.MEDIUM);
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
        }, LOADER.SHORT);
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
        navigateTo("defer-view", "Buscando compras diferibles...", LOADER.MEDIUM);
    });

    on("btn-confirm-defer", "click", () => {
        const months = document.getElementById("defer-months")?.value || "6";

        window.showLoader("Calculando plan de pagos...");

        setTimeout(() => {
            window.hideLoader();
            window.showToast(`Compra diferida a ${months} meses correctamente.`);
        }, LOADER.MEDIUM);
    });

    // Generación de NIP
    let nipInterval;

    function startNipTimer() {
        const nipNumber = document.getElementById("dynamic-nip-number");
        const nipTimer = document.getElementById("nip-timer");

        let timeLeft = 180;
        clearInterval(nipInterval);

        const nip = secureRandom(1000, 9999);

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
        navigateTo("nip-view", "Generando NIP seguro...", LOADER.LONG);
        setTimeout(startNipTimer, LOADER.LONG + 100);
    });

    on("btn-regenerate-nip", "click", () => {
        window.showLoader("Generando nuevo NIP...");

        setTimeout(() => {
            window.hideLoader();
            startNipTimer();
            window.showToast("Nuevo NIP generado.");
        }, LOADER.SHORT);
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
        navigateTo("spending-control-view", "Consultando límites...", LOADER.MEDIUM);
    });

    // ==================== CONFIRM DIALOG ====================
    function showConfirm(title, message) {
        return new Promise(resolve => {
            const overlay = document.createElement("div");
            overlay.className = "confirm-overlay";
            overlay.innerHTML = `
                <div class="confirm-dialog" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
                    <h3 id="confirm-title">${escapeHtml(title)}</h3>
                    <p id="confirm-msg">${escapeHtml(message)}</p>
                    <div class="confirm-dialog-actions">
                        <button class="btn-cancel" id="confirm-cancel">Cancelar</button>
                        <button class="btn-confirm" id="confirm-ok">Aceptar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const cleanup = () => overlay.remove();

            document.getElementById("confirm-cancel")?.addEventListener("click", () => {
                cleanup();
                resolve(false);
            });
            document.getElementById("confirm-ok")?.addEventListener("click", () => {
                cleanup();
                resolve(true);
            });
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) { cleanup(); resolve(false); }
            });
        });
    }

    // ==================== INACTIVITY TIMEOUT ====================
    let inactivityTimer;
    const INACTIVITY_LIMIT = 5 * 60 * 1000;

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(showInactivityOverlay, INACTIVITY_LIMIT);
    }

    function showInactivityOverlay() {
        const existing = document.querySelector(".inactivity-overlay");
        if (existing) return;

        const overlay = document.createElement("div");
        overlay.className = "inactivity-overlay";
        overlay.innerHTML = `
            <h2>Tu sesión ha expirado</h2>
            <p>Por seguridad, cerramos tu sesión por inactividad. Inicia sesión nuevamente.</p>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => window.SantanderAuth.signOut(), 3000);
    }

    ["click", "touchstart", "keydown", "scroll", "mousemove"].forEach(ev => {
        document.addEventListener(ev, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();

    // ==================== SPENDING CONTROL - PERSISTENTE ====================
    function getSpendingData() {
        try {
            return JSON.parse(localStorage.getItem("sant_spending") || "{}");
        } catch { return {}; }
    }

    function saveSpendingData(data) {
        localStorage.setItem("sant_spending", JSON.stringify(data));
    }

    function loadSpendingState() {
        const data = getSpendingData();
        const range = document.getElementById("spending-limit-range");
        const input = document.getElementById("spending-limit-input");
        const valEl = document.getElementById("spending-limit-value");

        if (data.limit && range) range.value = data.limit;
        if (data.limit && input) input.value = data.limit;
        if (data.limit && valEl) valEl.textContent = formatAmount(data.limit);

        document.querySelectorAll("[data-control-switch]").forEach(btn => {
            const key = btn.dataset.controlSwitch;
            if (data[key]) btn.classList.add("is-on");
        });
    }

    on("btn-save-spending-control", () => {
        const data = {};
        const range = document.getElementById("spending-limit-range");
        data.limit = range?.value || "5000";

        document.querySelectorAll("[data-control-switch]").forEach(btn => {
            data[btn.dataset.controlSwitch] = btn.classList.contains("is-on");
        });

        saveSpendingData(data);
        window.showLoader("Guardando control de gasto...");
        setTimeout(() => {
            window.hideLoader();
            window.showToast("Control de gasto actualizado.");
        }, LOADER.SHORT);
    });

    loadSpendingState();

    // ==================== CARD STATE PERSISTENTE ====================
    function loadCardState() {
        try {
            const saved = localStorage.getItem("sant_card_active");
            if (saved !== null) cardIsActive = saved === "true";
        } catch {}
        syncDigitalCardStatus();
    }

    function saveCardState() {
        try {
            localStorage.setItem("sant_card_active", String(cardIsActive));
        } catch {}
    }

    // Override toggle to persist
    const origToggle = toggleDigitalCardStatus;
    toggleDigitalCardStatus = function() {
        window.showLoader("Actualizando preferencias de seguridad...");
        setTimeout(() => {
            cardIsActive = !cardIsActive;
            syncDigitalCardStatus();
            saveCardState();
            window.hideLoader();
            window.showToast(cardIsActive ? "Tarjeta digital prendida." : "Tarjeta digital apagada.");
        }, LOADER.SHORT);
    };
    loadCardState();

    // ==================== Billeteras digitales ====================
    const walletStatusMap = {
        apple: "wallet-apple-status",
        google: "wallet-google-status",
        samsung: "wallet-samsung-status"
    };

    function loadWalletStates() {
        try {
            const saved = JSON.parse(localStorage.getItem("sant_wallets") || "{}");
            Object.entries(saved).forEach(([name, added]) => {
                if (!added) return;
                const statusEl = document.getElementById(walletStatusMap[name]);
                if (statusEl) statusEl.textContent = "Agregada";
                const btn = document.querySelector(`[data-wallet="${name}"]`);
                if (btn) {
                    btn.textContent = "Agregada";
                    btn.classList.add("is-added");
                    btn.disabled = true;
                }
            });
        } catch {}
    }

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
            try {
                const saved = JSON.parse(localStorage.getItem("sant_wallets") || "{}");
                saved[walletName] = true;
                localStorage.setItem("sant_wallets", JSON.stringify(saved));
            } catch {}
            window.hideLoader();
            window.showToast("Tarjeta agregada a la billetera digital.");
        }, LOADER.MEDIUM);
    }

    loadWalletStates();

    on("btn-overview-wallets", "click", () => {
        navigateTo("wallets-view", "Consultando billeteras digitales...", LOADER.MEDIUM);
    });

    document.querySelectorAll("[data-wallet]").forEach(btn => {
        btn.addEventListener("click", () => {
            addWallet(btn.dataset.wallet, btn);
        });
    });

    // ==================== GENERAR CVV DINÁMICO ====================
    on("btn-generate-cvv", "click", openDigitalCardModal);

    // ==================== CREDIT CARDS INTERACTIVAS ====================
    document.querySelectorAll(".credit-card-clickable").forEach(card => {
        card.addEventListener("click", () => {
            navigateTo("pay-cards-view", "Consultando adeudos...", LOADER.MEDIUM);
        });
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigateTo("pay-cards-view", "Consultando adeudos...", LOADER.MEDIUM);
            }
        });
    });

    // ==================== MOVEMENT SEARCH ====================
    let movementSearchQuery = "";

    function renderMovsAppFiltered() {
        const containerDetail = document.getElementById("movements-container");
        let htmlDetail = "";

        const sortedMovs = [...currentMovs].sort((a, b) => new Date(b.date) - new Date(a.date));
        const filteredMovs = sortedMovs.filter(m => {
            if (movementFilter !== "all" && m.type !== movementFilter) return false;
            if (movementSearchQuery) {
                const q = movementSearchQuery.toLowerCase();
                const match = m.title.toLowerCase().includes(q) ||
                    (m.location || "").toLowerCase().includes(q) ||
                    (m.reference || "").includes(q) ||
                    m.amount.includes(q);
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
                const isPositive = m.type === "positive";
                const amount = formatAmount(m.amount);
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
                            ${m.reference ? `<span class="movement-reference">${escapeHtml(m.reference)}</span>` : ""}
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
            htmlDetail = `<div class="empty-movements">${
                movementSearchQuery ? "No hay movimientos que coincidan con tu búsqueda." : "No hay movimientos para este filtro."
            }</div>`;
        }

        if (containerDetail) containerDetail.innerHTML = htmlDetail;
        renderAccountStatement();
    }

    // Override renderMovsApp to use search
    const origRenderMovsApp = renderMovsApp;
    renderMovsApp = renderMovsAppFiltered;

    // Add search input
    const movContainer = document.getElementById("movements-container");
    if (movContainer) {
        const searchWrap = document.createElement("div");
        searchWrap.className = "movement-search-wrap";
        searchWrap.innerHTML = `<input type="search" class="movement-search-input" id="movement-search-input" placeholder="Buscar en movimientos..." aria-label="Buscar movimientos">`;
        movContainer.parentNode?.insertBefore(searchWrap, movContainer);

        document.getElementById("movement-search-input")?.addEventListener("input", (e) => {
            movementSearchQuery = e.target.value.trim();
            renderMovsAppFiltered();
        });
    }

    // ==================== MOVEMENT PAGINATION ====================
    const MOVS_PAGE_SIZE = 20;
    let movsPage = 0;

    function renderMovsPaginated() {
        const containerDetail = document.getElementById("movements-container");
        if (!containerDetail) return;

        const sortedMovs = [...currentMovs].sort((a, b) => new Date(b.date) - new Date(a.date));
        const paginated = sortedMovs.slice(0, (movsPage + 1) * MOVS_PAGE_SIZE);
        const hasMore = sortedMovs.length > paginated.length;

        let htmlDetail = "";

        const groupedMovs = paginated.reduce((acc, mov) => {
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
                            ${m.reference ? `<span class="movement-reference">${escapeHtml(m.reference)}</span>` : ""}
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

        if (hasMore) {
            htmlDetail += `<button class="btn-outline primary-action-btn mt-20" id="btn-load-more-movs" style="margin:12px auto;display:block;max-width:200px;padding:12px;">Ver más movimientos</button>`;
        }

        containerDetail.innerHTML = htmlDetail;

        if (hasMore) {
            document.getElementById("btn-load-more-movs")?.addEventListener("click", () => {
                movsPage++;
                renderMovsPaginated();
            });
        }
    }

    // ==================== TRANSFERENCIAS CON VALIDACIÓN Y CONFIRMACIÓN ====================
    on("btn-do-transfer", async () => {
        const dest = document.getElementById("transfer-dest")?.value.trim() || "";
        const amountRaw = document.getElementById("transfer-amount")?.value.trim() || "";
        const concept = document.getElementById("transfer-concept")?.value.trim() || "Sin concepto";
        const numericAmount = Number(amountRaw.replace(/,/g, "")) || 0;
        const balance = parseAmount(userSettings.balance);

        const errors = [];
        if (!dest) errors.push("Ingresa una cuenta destino.");
        if (dest.length < 10) errors.push("La cuenta destino debe tener al menos 10 dígitos.");
        if (numericAmount <= 0) errors.push("El monto debe ser mayor a cero.");
        if (numericAmount > balance) errors.push("El monto excede tu saldo disponible.");

        if (errors.length) {
            window.showToast(errors[0]);
            return;
        }

        const confirmed = await showConfirm(
            "Confirmar transferencia",
            `Enviar $${formatAmount(numericAmount)} MXN a la cuenta ${dest}${concept !== "Sin concepto" ? ` con concepto: ${concept}` : ""}. ¿Estás seguro?`
        );
        if (!confirmed) return;

        // Add movement to history
        const today = new Date().toISOString().split("T")[0];
        const newMov = {
            title: "Transferencia enviada",
            location: "SPEI",
            reference: String(secureRandom(1000000, 9999999)),
            date: today,
            amount: numericAmount.toFixed(2),
            type: "negative"
        };
        currentMovs.unshift(newMov);
        renderMovsApp();

        navigateTo("transfer-success-view", "Conectando con red SPEI...", LOADER.XL);

        setTimeout(() => {
            const els = {
                "success-transfer-amount": `$ ${numericAmount.toFixed(2)} MXN`,
                "success-transfer-dest": dest,
                "success-transfer-concept": concept,
                "success-transfer-date": getTodayString()
            };
            Object.entries(els).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            });
        }, LOADER.XL);
    });

    // Beneficiarios click
    document.querySelectorAll(".beneficiary-item").forEach(item => {
        item.addEventListener("click", () => {
            const clabe = item.dataset.benClabe;
            const destInput = document.getElementById("transfer-dest");
            if (clabe && destInput) {
                destInput.value = clabe;
                window.showToast("Beneficiario seleccionado");
            }
        });
        item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                item.click();
            }
        });
    });

    // ==================== RECARGAS CON VALIDACIÓN ====================
    on("btn-do-topup", async () => {
        const phone = document.getElementById("topup-phone")?.value.trim() || "";
        const company = document.getElementById("topup-company")?.value || "Telcel";
        const amount = document.getElementById("topup-amount")?.value || "100.00";
        const numericAmount = Number(String(amount).replace(/,/g, "")) || 0;

        const errors = [];
        if (!/^\d{10}$/.test(phone)) errors.push("El teléfono debe tener 10 dígitos.");
        if (numericAmount <= 0) errors.push("El monto debe ser mayor a cero.");
        if (numericAmount > 2000) errors.push("La recarga máxima es de $2,000 MXN.");

        if (errors.length) {
            window.showToast(errors[0]);
            return;
        }

        const confirmed = await showConfirm(
            "Confirmar recarga",
            `Recargar $${formatAmount(numericAmount)} MXN al número ${phone} (${company}). ¿Estás seguro?`
        );
        if (!confirmed) return;

        navigateTo("topup-success-view", "Validando número y conectando...", LOADER.XL);
        setTimeout(() => {
            const els = {
                "success-topup-amount": `$ ${numericAmount.toFixed(2)} MXN`,
                "success-topup-phone": phone,
                "success-topup-company": company,
                "success-topup-date": getTodayString()
            };
            Object.entries(els).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            });
        }, LOADER.XL);
    });

    // ==================== RETIRO SIN TARJETA ====================
    on("btn-do-cardless", "click", () => {
        const amount = document.getElementById("cardless-amount")?.value || "500.00";

        navigateTo("cardless-active-view", "Generando clave dinámica...", LOADER.LONG);

        setTimeout(() => {
            const cardlessAmount = document.getElementById("cardless-active-amount");
            const cardlessNumber = document.getElementById("dynamic-cardless-number");
            const timerDisplay = document.getElementById("cardless-timer");

            if (cardlessAmount) cardlessAmount.textContent = `$ ${amount} MXN`;

            const code = `${secureRandom(100, 999)} ${secureRandom(100, 999)} ${secureRandom(100, 999)}`;
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
        }, LOADER.LONG);
    });

    // ==================== RECARGAS CELULAR ====================
    on("btn-do-topup", "click", () => {
        const phone = document.getElementById("topup-phone")?.value || "No especificado";
        const company = document.getElementById("topup-company")?.value || "Telcel";
        const amount = document.getElementById("topup-amount")?.value || "100.00";
        const numericAmount = Number(String(amount).replace(/,/g, "")) || 0;

        navigateTo("topup-success-view", "Validando número y conectando...", LOADER.XL);

        setTimeout(() => {
            const successAmount = document.getElementById("success-topup-amount");
            const successPhone = document.getElementById("success-topup-phone");
            const successCompany = document.getElementById("success-topup-company");
            const successDate = document.getElementById("success-topup-date");

            if (successAmount) successAmount.textContent = `$ ${numericAmount.toFixed(2)} MXN`;
            if (successPhone) successPhone.textContent = phone;
            if (successCompany) successCompany.textContent = company;
            if (successDate) successDate.textContent = getTodayString();
        }, LOADER.XL);
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
    const clockInterval = setInterval(updateClock, 30000);

    // ==================== CLEANUP GLOBAL ====================
    window.addEventListener("beforeunload", () => {
        clearInterval(clockInterval);
        clearInterval(cvvInterval);
        clearInterval(cardlessInterval);
        clearInterval(nipInterval);
        clearInterval(modalCvvInterval);
    });

    // Timer cleanup on navigation
    const origGoBack = goBack;
    goBack = function() {
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
            }, LOADER.BACK);
        }
    };

    // Remove the old goBack listener and re-attach with new version
    // (the old one was already bound, but the new goBack replaces the reference)
});
