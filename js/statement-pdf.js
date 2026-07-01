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
        const response = await fetch("/api/statement-pdf", {
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

        this.forceDownload(blob, fileName);
    }
};
