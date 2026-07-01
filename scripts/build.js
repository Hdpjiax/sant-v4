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

loadEnvFile();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const adminCode = process.env.ADMIN_REGISTRATION_CODE || "SANTANDER_ADMIN_2026";

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("\n❌ Faltan variables de entorno:");
    console.error("   SUPABASE_URL");
    console.error("   SUPABASE_ANON_KEY");
    console.error("\nConfigúralas en Vercel → Settings → Environment Variables");
    console.error("o crea un archivo .env local (usa .env.example como guía).\n");
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
    "image.png"
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

const jsFiles = ["supabase-client.js", "auth.js", "settings-service.js", "register.js", "login.js", "admin.js"];
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