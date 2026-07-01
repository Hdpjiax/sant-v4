const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PREFERRED_PORT = Number(process.env.PORT) || 3000;

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".json": "application/json"
};

const ALLOWED_DIRS = new Set(["js", "assets", "dist"]);
const ALLOWED_ROOT_FILES = new Set([
    "index.html", "register.html", "login.html", "admin.html",
    "script.js", "styles.css", "auth.css", "image.png", "1.webp",
    "estado de cuenta.pdf"
]);

/** Mismas rutas limpias que vercel.json */
const ROUTES = {
    "/": "/register.html",
    "/register": "/register.html",
    "/login": "/login.html",
    "/admin": "/admin.html",
    "/app": "/index.html"
};

function resolveUrlPath(rawUrl) {
    let urlPath = decodeURIComponent((rawUrl || "/").split("?")[0]);

    if (urlPath.length > 1 && urlPath.endsWith("/")) {
        urlPath = urlPath.slice(0, -1);
    }

    if (ROUTES[urlPath]) {
        return ROUTES[urlPath];
    }

    if (!path.extname(urlPath)) {
        const withHtml = `${urlPath}.html`;
        const candidate = safePath(withHtml);
        if (candidate && fs.existsSync(candidate)) {
            return withHtml;
        }
    }

    return urlPath;
}

function safePath(urlPath) {
    const decoded = decodeURIComponent(urlPath.split("?")[0]);
    const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
    const full = path.join(ROOT, normalized);

    if (!full.startsWith(ROOT)) return null;
    return full;
}

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("404 — No encontrado");
            return;
        }

        res.writeHead(200, { "Content-Type": type });
        res.end(data);
    });
}

function generateStatementPdf(body, res) {
    const scriptPath = path.join(__dirname, "generate-statement.py");
    const pythonCmd = process.env.PYTHON || "python";
    const child = spawn(pythonCmd, [scriptPath], {
        cwd: ROOT,
        stdio: ["pipe", "pipe", "pipe"]
    });

    const chunks = [];
    let stderr = "";

    child.stdout.on("data", chunk => chunks.push(chunk));
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", (err) => {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`No se pudo ejecutar Python: ${err.message}`);
    });
    child.on("close", (code) => {
        if (code !== 0) {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(stderr || "Error generando PDF con PyMuPDF");
            return;
        }

        res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="EstadoCuenta.pdf"',
            "Cache-Control": "no-store"
        });
        res.end(Buffer.concat(chunks));
    });

    child.stdin.write(body);
    child.stdin.end();
}

const server = http.createServer((req, res) => {
    if (req.url === "/api/statement-pdf" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => generateStatementPdf(body, res));
        return;
    }

    const urlPath = resolveUrlPath(req.url);
    const filePath = safePath(urlPath);

    if (!filePath) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("403 — Acceso denegado");
        return;
    }

    const basename = path.basename(filePath);
    if (basename.startsWith(".")) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("403 — Archivo no permitido");
        return;
    }

    const relative = path.relative(ROOT, filePath);
    const topDir = relative.split(path.sep)[0];

    if (relative.includes("..")) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("403 — Ruta inválida");
        return;
    }

    const isRootFile = !relative.includes(path.sep);
    const isAllowedDir = ALLOWED_DIRS.has(topDir);

    if (isRootFile && !ALLOWED_ROOT_FILES.has(basename)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("403 — Archivo no permitido");
        return;
    }

    if (!isRootFile && !isAllowedDir) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("403 — Ruta no servida en desarrollo");
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("404 — No encontrado");
            return;
        }

        sendFile(res, filePath);
    });
});

function tryListen(port, attemptsLeft) {
    server.once("error", (err) => {
        if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
            console.warn(`  Puerto ${port} ocupado, probando ${port + 1}...`);
            tryListen(port + 1, attemptsLeft - 1);
            return;
        }
        throw err;
    });

    server.listen(port, () => {
        console.log("");
        console.log("  Servidor local listo");
        console.log(`  → http://localhost:${port}`);
        console.log(`  → http://localhost:${port}/login`);
        console.log(`  → http://localhost:${port}/register`);
        console.log(`  → http://localhost:${port}/app`);
        console.log("");
        console.log("  Edita archivos y recarga el navegador (sin rebuild).");
        console.log("  NO abras los .html con doble clic (file:// bloquea Supabase).");
        console.log("");
    });
}

tryListen(PREFERRED_PORT, 5);