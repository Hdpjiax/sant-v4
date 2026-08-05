const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
// Directorio donde colocarás el archivo .ipa descargado
const BUILD_DIR = path.join(__dirname, '../ios-build');
const IPA_PATH = path.join(BUILD_DIR, 'App.ipa');

// Crear la carpeta de compilación si no existe
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  const url = req.url;

  if (url === '/manifest.plist') {
    const host = req.headers.host;
    // Ngrok reenvía cabeceras indicando si es HTTPS
    const proto = req.headers['x-forwarded-proto'] || 'https';
    
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>items</key>
    <array>
        <dict>
            <key>assets</key>
            <array>
                <dict>
                    <key>kind</key>
                    <string>software-package</string>
                    <key>url</key>
                    <string>${proto}://${host}/App.ipa</string>
                </dict>
            </array>
            <key>metadata</key>
            <dict>
                <key>bundle-identifier</key>
                <string>com.santander.demo</string>
                <key>bundle-version</key>
                <string>1.0.0</string>
                <key>kind</key>
                <string>software</string>
                <key>title</key>
                <string>Santander</string>
            </dict>
        </dict>
    </array>
</dict>
</plist>`;

    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(manifest);
  } else if (url === '/App.ipa') {
    if (fs.existsSync(IPA_PATH)) {
      const stat = fs.statSync(IPA_PATH);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size
      });
      const readStream = fs.createReadStream(IPA_PATH);
      readStream.pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Error: Archivo App.ipa no encontrado en: ${IPA_PATH}\n\nPor favor, descarga el .ipa desde GitHub Actions, colócalo en la carpeta "ios-build" y renómbralo a "App.ipa".`);
    }
  } else if (url === '/' || url === '/index.html') {
    const host = req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const installUrl = `itms-services://?action=download-manifest&url=${proto}://${host}/manifest.plist`;
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Instalador Santander iOS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            text-align: center;
            padding: 40px 20px;
            background: #f4f4f7;
            color: #333;
          }
          .card {
            background: white;
            padding: 35px 25px;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            max-width: 400px;
            margin: 0 auto;
          }
          h1 {
            color: #ec0000;
            font-size: 26px;
            margin-top: 0;
            margin-bottom: 15px;
          }
          p {
            font-size: 15px;
            color: #666;
            line-height: 1.6;
            margin-bottom: 25px;
          }
          a.btn {
            display: inline-block;
            background: #ec0000;
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(236,0,0,0.3);
            transition: transform 0.2s;
          }
          a.btn:active {
            transform: scale(0.98);
          }
          .footer {
            margin-top: 30px;
            font-size: 11px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Instalar Santander</h1>
          <p>Pulsa el botón de abajo desde tu iPhone en <strong>Safari</strong> para descargar e instalar la aplicación de forma inalámbrica.</p>
          <a class="btn" href="${installUrl}">Instalar Aplicación</a>
        </div>
        <div class="footer">
          Servido de forma segura desde el proxy de tu PC Windows.
        </div>
      </body>
      </html>
    `);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`[OK] Servidor de instalación iOS corriendo en http://localhost:${PORT}`);
  console.log(`[Paso 1] Crea la carpeta "ios-build" y mete tu archivo "App.ipa" dentro.`);
  console.log(`[Paso 2] Ejecuta en otra terminal: ngrok http ${PORT}`);
  console.log(`[Paso 3] Envía el enlace HTTPS de ngrok al iPhone del usuario.`);
  console.log('================================================================');
});
