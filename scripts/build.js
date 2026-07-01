const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

function loadEnvFile() {
    const envPath = path.join(ROOT, ".env");
    if (!fs.existsSync(envPath)) return;

    fs.readFileSync(envPath, "utf8")
        .split("\n")
        .forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) return;

            const eqIndex = trimmed.indexOf("=");
            if (eqIndex === -1) return;

            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();

            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }

            if (!process.env[key]) {
                process.env[key] = value;
            }
        });
}

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((entry) => {
            copyRecursive(path.join(src, entry), path.join(dest, entry));
        });
        return;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function cleanDist() {
    if (fs.existsSync(DIST)) {
        fs.rmSync(DIST, { recursive: true, force: true });
    }
    ensureDir(DIST);
}

function readConfigFromFile() {
    const configPath = path.join(ROOT, "js", "config.js");
    if (!fs.existsSync(configPath)) return {};

    const content = fs.readFileSync(configPath, "utf8");
    const readValue = (key) => {
        const match = content.match(new RegExp(`window\\.${key}\\s*=\\s*["']([^"']+)["']`));
        return match ? match[1] : "";
    };

    return {
        url: readValue("SUPABASE_URL"),
        key: readValue("SUPABASE_ANON_KEY"),
        adminCode: readValue("ADMIN_REGISTRATION_CODE")
    };
}

loadEnvFile();

const fileConfig = readConfigFromFile();

let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileConfig.url || "";
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || fileConfig.key || "";
const adminCode = process.env.ADMIN_REGISTRATION_CODE || fileConfig.adminCode || "SANTANDER_ADMIN_2026";

const isPlaceholder = (value) =>
    !value || value.includes("TU_PROYECTO") || value.includes("TU_ANON");

if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
    console.error("\n❌ Faltan credenciales de Supabase:");
    console.error("   SUPABASE_URL");
    console.error("   SUPABASE_ANON_KEY");
    console.error("\nConfigúralas en Vercel → Settings → Environment Variables");
    console.error("o en js/config.js / .env local (usa .env.example como guía).\n");
    process.exit(1);
}

cleanDist();

const staticFiles = [
    "index.html",
    "register.html",
    "login.html",
    "admin.html",
    "script.js",
    "styles.css",
    "auth.css",
    "image.png",
    "1.webp",
    "estado de cuenta.pdf"
];

staticFiles.forEach((file) => {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) {
        copyRecursive(src, path.join(DIST, file));
    }
});

if (fs.existsSync(path.join(ROOT, "assets"))) {
    copyRecursive(path.join(ROOT, "assets"), path.join(DIST, "assets"));
}

ensureDir(path.join(DIST, "js"));

const jsFiles = ["supabase-errors.js", "supabase-client.js", "auth.js", "settings-service.js", "statement-pdf.js", "register.js", "login.js", "admin.js"];
jsFiles.forEach((file) => {
    copyRecursive(path.join(ROOT, "js", file), path.join(DIST, "js", file));
});

const configContent = `/**
 * Generado automáticamente en build — no editar manualmente en producción.
 */
window.SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};
window.ADMIN_REGISTRATION_CODE = ${JSON.stringify(adminCode)};
`;

fs.writeFileSync(path.join(DIST, "js", "config.js"), configContent, "utf8");

console.log("✅ Build completado en /dist");
console.log(`   SUPABASE_URL: ${supabaseUrl}`);