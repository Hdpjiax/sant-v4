(function () {
    if (window.location.protocol !== "file:") return;

    const banner = document.createElement("div");
    banner.style.cssText = [
        "position:fixed",
        "inset:0",
        "background:#1a1a1a",
        "color:#fff",
        "z-index:99999",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "padding:24px",
        "font-family:system-ui,sans-serif"
    ].join(";");

    banner.innerHTML = `
        <div style="max-width:420px;text-align:center;line-height:1.6;">
            <h2 style="color:#EC0000;margin-bottom:12px;">No uses file://</h2>
            <p style="color:#ccc;margin-bottom:16px;">
                Abriste el HTML directamente. El navegador bloquea la conexión con Supabase
                y verás <strong>Failed to fetch</strong>.
            </p>
            <p style="color:#aaa;font-size:14px;margin-bottom:20px;">
                En la terminal del proyecto ejecuta:<br>
                <code style="background:#333;padding:8px 12px;border-radius:6px;display:inline-block;margin-top:8px;">npm run dev:local</code>
            </p>
            <p style="color:#888;font-size:13px;">Luego abre <strong>http://localhost:3000</strong></p>
        </div>
    `;

    document.addEventListener("DOMContentLoaded", () => {
        document.body.prepend(banner);
    });
})();