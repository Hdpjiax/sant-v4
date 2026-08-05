function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

window.StatementPdf = {
    forceDownload(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            URL.revokeObjectURL(url);
            link.remove();
        }, 1500);
    },

    buildPayload(userData) {
        return {
            name: userData?.name || "",
            subtitle: userData?.subtitle || "",
            balance: userData?.balance || "0.00",
            account: userData?.account || "",
            phone: userData?.phone || "",
            product: userData?.product || "",
            movements: Array.isArray(userData?.movements) ? userData.movements : []
        };
    },

    async download(userData, fileName) {
        const baseUrl = window.API_BASE_URL || "";
        const response = await fetch(baseUrl + "/api/statement-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(this.buildPayload(userData))
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw new Error(detail || "No se pudo generar el PDF desde la plantilla");
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
            throw new Error("El PDF generado está vacío");
        }

        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            try {
                const base64Data = await blobToBase64(blob);
                const filesystem = window.Capacitor.Plugins.Filesystem;
                const share = window.Capacitor.Plugins.Share;

                if (!filesystem || !share) {
                    throw new Error("Plugins de Capacitor Filesystem o Share no están disponibles.");
                }

                const result = await filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: 'CACHE',
                    recursive: true
                });

                await share.share({
                    title: fileName,
                    text: 'Aquí está tu estado de cuenta de Santander',
                    url: result.uri,
                    dialogTitle: 'Compartir/Guardar Estado de Cuenta'
                });
            } catch (err) {
                console.error("Error al descargar/compartir PDF nativo:", err);
                alert("Error al descargar el PDF en el móvil: " + err.message);
            }
        } else {
            this.forceDownload(blob, fileName);
        }
    }
};

