// ============================================
// 📷 SCANNER QR CODE
// ============================================

const QRModule = {

    scanner: null,
    isScanning: false,
    videoElement: null,
    canvasElement: null,

    // ==========================================
    // INIZIALIZZAZIONE
    // ==========================================

    init() {
        console.log("✅ Modulo QR inizializzato");
    },

    // ==========================================
    // SCANNER QR - CAMERA
    // ==========================================

    // Apri scanner con camera
    async openScanner(videoElementId, onScanSuccess, onScanError) {
        this.videoElement = document.getElementById(videoElementId);

        if (!this.videoElement) {
            console.error("Elemento video non trovato");
            if (onScanError) onScanError("Elemento video non trovato");
            return false;
        }

        try {
            // Richiedi accesso alla camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment", // Camera posteriore
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            this.videoElement.srcObject = stream;
            this.videoElement.setAttribute("playsinline", true);
            await this.videoElement.play();

            this.isScanning = true;

            // Inizia la scansione continua
            this.scanFrame(onScanSuccess, onScanError);

            Utils.showToast("📷 Scanner attivo", "info");
            return true;

        } catch (error) {
            console.error("Errore accesso camera:", error);

            let errorMessage = "Impossibile accedere alla camera";

            if (error.name === 'NotAllowedError') {
                errorMessage = "Permesso camera negato. Abilita l'accesso nelle impostazioni.";
            } else if (error.name === 'NotFoundError') {
                errorMessage = "Nessuna camera trovata sul dispositivo";
            }

            Utils.showToast(errorMessage, "error");

            if (onScanError) onScanError(errorMessage);
            return false;
        }
    },

    // Scansiona frame video
    scanFrame(onScanSuccess, onScanError) {
        if (!this.isScanning || !this.videoElement) return;

        // Crea canvas se non esiste
        if (!this.canvasElement) {
            this.canvasElement = document.createElement('canvas');
        }

        const canvas = this.canvasElement;
        const video = this.videoElement;

        // Imposta dimensioni canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Ottieni dati immagine
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Prova a decodificare QR
        try {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert"
            });

            if (code) {
                console.log("✅ QR Code rilevato:", code.data);

                // Ferma scanner
                this.closeScanner();

                // Parse JSON
                try {
                    const qrData = JSON.parse(code.data);
                    if (onScanSuccess) onScanSuccess(qrData);
                } catch (e) {
                    // Non è JSON, passa stringa
                    if (onScanSuccess) onScanSuccess(code.data);
                }

                return;
            }
        } catch (error) {
            // jsQR non disponibile o errore
            console.error("Errore scansione QR:", error);
        }

        // Continua scansione
        requestAnimationFrame(() => this.scanFrame(onScanSuccess, onScanError));
    },

    // Chiudi scanner
    closeScanner() {
        this.isScanning = false;

        if (this.videoElement && this.videoElement.srcObject) {
            const stream = this.videoElement.srcObject;
            const tracks = stream.getTracks();

            tracks.forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }

        console.log("📷 Scanner chiuso");
    },

    // ==========================================
    // GENERAZIONE QR CODE
    // ==========================================

    // Genera QR Code per fidelity card
    generateFidelityQR(customerId, callback) {
        console.log("🎨 Genera QR Fidelity per:", customerId);

        const customer = window.CustomersModule.getCustomerById(customerId);
        if (!customer) {
            console.error("❌ Cliente non trovato");
            return;
        }

        const qrData = JSON.stringify({
            type: 'fidelity',  // ← AGGIUNGI questo
            customerId: customer.id,  // ← Rinomina da "id" a "customerId" per consistenza
            name: `${customer.firstName} ${customer.lastName}`
        });

        // Container nascosto
        const qrContainer = document.createElement('div');
        qrContainer.style.display = 'none';
        document.body.appendChild(qrContainer);

        // Genera QR
        new QRCode(qrContainer, {
            text: qrData,
            width: 400,
            height: 400,
            colorDark: "#5D3F24",
            colorLight: "#ffffff"
        });

        // TIMEOUT per aspettare rendering
        setTimeout(() => {
            console.log('⏰ Cerco QR renderizzato...');

            let qrImg = qrContainer.querySelector('img');
            const qrCanvas = qrContainer.querySelector('canvas');

            console.log('IMG?', !!qrImg, '| CANVAS?', !!qrCanvas);

            // Fallback: se IMG src vuoto, usa CANVAS
            if (qrImg && (!qrImg.src || qrImg.src.length < 100)) {
                console.log('⚠️ IMG vuota, uso CANVAS');
                qrImg = null;
            }

            // Usa CANVAS se IMG non valida
            if (!qrImg && qrCanvas) {
                console.log('🔄 Converto CANVAS→IMG');
                const tempImg = new Image();
                tempImg.onload = () => {
                    console.log('✅ CANVAS caricato');
                    this.drawFidelityCard(tempImg, customer, qrContainer, callback);
                };
                tempImg.onerror = () => {
                    console.error('❌ Errore CANVAS');
                    document.body.removeChild(qrContainer);
                };
                tempImg.src = qrCanvas.toDataURL();
                return;
            }

            // Usa IMG
            if (qrImg && qrImg.src) {
                console.log('🔄 Carico IMG');
                const tempImg = new Image();
                tempImg.onload = () => {
                    console.log('✅ IMG caricata');
                    this.drawFidelityCard(tempImg, customer, qrContainer, callback);
                };
                tempImg.onerror = () => {
                    console.error('❌ Errore IMG');
                    document.body.removeChild(qrContainer);
                };
                tempImg.src = qrImg.src;
                return;
            }

            console.error('❌ Nessun QR trovato');
            document.body.removeChild(qrContainer);
        }, 500); // ASPETTA 500ms
    },

    drawFidelityCard(qrImg, customer, qrContainer, callback) {
        console.log('🎨 Disegno card fidelity orizzontale...');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 1200;
        canvas.height = 750;

        // Sfondo beige
        ctx.fillStyle = '#F5E6D3';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Bordo marrone
        ctx.strokeStyle = '#5D3F24';
        ctx.lineWidth = 6;
        ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

        // Carica logo
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.onload = () => {
            // Logo tondo in alto a destra
            const logoSize = 120;
            const logoX = canvas.width - logoSize - 40;
            const logoY = 40;

            ctx.save();
            ctx.beginPath();
            ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
            ctx.restore();

            // Centrato
            const centerX = canvas.width / 2;
            const startY = 180;

            // Nome attività
            ctx.fillStyle = '#5D3F24';
            ctx.textAlign = 'center';
            ctx.font = 'bold 48px Georgia';
            ctx.fillText('PASTIFICIO GRAMSCI', centerX, startY);

            ctx.font = '28px Georgia';
            ctx.fillText('Tessera Fidelity', centerX, startY + 45);

            // Nome cliente
            ctx.font = 'bold 42px Arial';
            ctx.fillText(`${customer.firstName} ${customer.lastName}`, centerX, startY + 110);

            // QR Code
            const qrSize = 280;
            const qrX = (canvas.width - qrSize) / 2;
            const qrY = startY + 140;

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            // Frase
            ctx.fillStyle = '#5D3F24';
            ctx.font = 'italic 26px Georgia';
            ctx.fillText('Grazie per averci scelto', centerX, qrY + qrSize + 45);

            // Data
            const fidelity = window.FidelityModule.getFidelityCustomer(customer.id);
            const joinDate = fidelity ? new Date(fidelity.joinedAt).toLocaleDateString('it-IT') : 'N/A';

            ctx.font = '22px Arial';
            ctx.fillStyle = '#8B6F47';
            ctx.fillText(`Cliente dal ${joinDate}`, centerX, qrY + qrSize + 80);

            canvas.toBlob((blob) => {
                console.log('✅ Card generata');
                document.body.removeChild(qrContainer);
                if (callback) callback(blob);
            }, 'image/png', 1.0);
        };

        logo.onerror = () => {
            console.error('❌ Logo non trovato');
            this.drawCardNoLogo(qrImg, customer, qrContainer, callback, canvas, ctx);
        };

        logo.src = 'img/logo.jpg';
    },

    drawCardNoLogo(qrImg, customer, qrContainer, callback, canvas, ctx) {
        const centerX = canvas.width / 2;
        const startY = 180;

        ctx.fillStyle = '#5D3F24';
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Georgia';
        ctx.fillText('PASTIFICIO GRAMSCI', centerX, startY);

        ctx.font = '28px Georgia';
        ctx.fillText('Tessera Fidelity', centerX, startY + 45);

        ctx.font = 'bold 42px Arial';
        ctx.fillText(`${customer.firstName} ${customer.lastName}`, centerX, startY + 110);

        const qrSize = 280;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = startY + 140;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = '#5D3F24';
        ctx.font = 'italic 26px Georgia';
        ctx.fillText('Grazie per averci scelto', centerX, qrY + qrSize + 45);

        const fidelity = window.FidelityModule.getFidelityCustomer(customer.id);
        const joinDate = fidelity ? new Date(fidelity.joinedAt).toLocaleDateString('it-IT') : 'N/A';

        ctx.font = '22px Arial';
        ctx.fillStyle = '#8B6F47';
        ctx.fillText(`Cliente dal ${joinDate}`, centerX, qrY + qrSize + 80);

        canvas.toBlob((blob) => {
            document.body.removeChild(qrContainer);
            if (callback) callback(blob);
        }, 'image/png', 1.0);
    },

    // Genera QR Code per coupon
    // Genera QR Code per coupon card (come fidelity)
    generateCouponQR(customerId, couponId, callback) {
        console.log("🎨 Genera QR Coupon per:", customerId, couponId);

        const customer = window.CustomersModule.getCustomerById(customerId);
        const coupon = customer?.coupons?.find(c => c.id === couponId);

        if (!customer || !coupon) {
            console.error("❌ Cliente o coupon non trovato");
            if (callback) callback(null);
            return;
        }

        const qrData = JSON.stringify({
            type: 'coupon',  // ← AGGIUNGI questo
            customerId: customer.id,
            couponId: couponId,
            customerName: `${customer.firstName} ${customer.lastName}`,
            couponCode: coupon.code
        });

        // Container nascosto
        const qrContainer = document.createElement('div');
        qrContainer.style.display = 'none';
        document.body.appendChild(qrContainer);

        // Genera QR
        new QRCode(qrContainer, {
            text: qrData,
            width: 400,
            height: 400
        });

        // TIMEOUT per aspettare rendering (come fidelity)
        setTimeout(() => {
            console.log('⏰ Cerco QR coupon renderizzato...');

            let qrImg = qrContainer.querySelector('img');
            const qrCanvas = qrContainer.querySelector('canvas');

            console.log('IMG?', !!qrImg, '| CANVAS?', !!qrCanvas);

            // Fallback: se IMG src vuoto, usa CANVAS
            if (qrImg && (!qrImg.src || qrImg.src.length < 100)) {
                console.log('⚠️ IMG vuota, uso CANVAS');
                qrImg = null;
            }

            // Usa CANVAS se IMG non valida
            if (!qrImg && qrCanvas) {
                console.log('🔄 Converto CANVAS→IMG coupon');
                const tempImg = new Image();
                tempImg.onload = () => {
                    console.log('✅ CANVAS coupon caricato');
                    this.drawCouponCard(tempImg, customer, coupon, qrContainer, callback);
                };
                tempImg.onerror = () => {
                    console.error('❌ Errore CANVAS coupon');
                    document.body.removeChild(qrContainer);
                    if (callback) callback(null);
                };
                tempImg.src = qrCanvas.toDataURL();
                return;
            }

            // Usa IMG
            if (qrImg && qrImg.src) {
                console.log('🔄 Carico IMG coupon');
                const tempImg = new Image();
                tempImg.onload = () => {
                    console.log('✅ IMG coupon caricata');
                    this.drawCouponCard(tempImg, customer, coupon, qrContainer, callback);
                };
                tempImg.onerror = () => {
                    console.error('❌ Errore IMG coupon');
                    document.body.removeChild(qrContainer);
                    if (callback) callback(null);
                };
                tempImg.src = qrImg.src;
                return;
            }

            console.error('❌ Nessun QR coupon trovato');
            document.body.removeChild(qrContainer);
            if (callback) callback(null);
        }, 500); // ASPETTA 500ms
    },

    drawCouponCard(qrImg, customer, coupon, qrContainer, callback) {
        console.log('🎨 Disegno card coupon elegante...');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 1200;
        canvas.height = 750;

        // Sfondo beige (come fidelity)
        ctx.fillStyle = '#F5E6D3';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Bordo marrone
        ctx.strokeStyle = '#5D3F24';
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        // Bordo interno decorativo
        ctx.strokeStyle = '#8B6F47';
        ctx.lineWidth = 2;
        ctx.strokeRect(25, 25, canvas.width - 50, canvas.height - 50);

        // Header rosa per distinguerlo
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(50, 50, canvas.width - 100, 120);

        // Testo header bianco
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Arial';
        ctx.fillText('🎫 COUPON SCONTO', canvas.width / 2, 120);

        const centerX = canvas.width / 2;
        const startY = 220;

        // Testo marrone (resto del contenuto)
        ctx.fillStyle = '#5D3F24';

        // Logo/Nome azienda
        ctx.font = 'bold 42px Georgia';
        ctx.fillText('PASTIFICIO GRAMSCI', centerX, startY);

        // Nome cliente
        ctx.font = 'bold 36px Arial';
        ctx.fillText(`${customer.firstName} ${customer.lastName}`, centerX, startY + 60);

        // Campagna
        ctx.font = '28px Georgia';
        ctx.fillStyle = '#8B6F47';
        ctx.fillText(coupon.campaignName || 'Coupon Speciale', centerX, startY + 100);

        // Box descrizione con sfondo rosa chiaro
        ctx.fillStyle = '#fce7f3';
        ctx.fillRect(150, startY + 130, canvas.width - 300, 70);

        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.strokeRect(150, startY + 130, canvas.width - 300, 70);

        ctx.fillStyle = '#5D3F24';
        ctx.font = 'bold 32px Arial';
        ctx.fillText(coupon.description || '', centerX, startY + 175);

        // Codice con badge rosa
        ctx.fillStyle = '#ec4899';
        const codeText = `Codice: ${coupon.code}`;
        ctx.font = 'bold 36px monospace';
        const codeWidth = ctx.measureText(codeText).width;
        ctx.fillRect(centerX - codeWidth / 2 - 20, startY + 220, codeWidth + 40, 50);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(codeText, centerX, startY + 255);

        // QR Code con cornice
        const qrSize = 220;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = startY + 290;

        // Sfondo bianco per QR
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);

        // Bordo marrone
        ctx.strokeStyle = '#5D3F24';
        ctx.lineWidth = 4;
        ctx.strokeRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        // Scadenza sotto QR
        ctx.fillStyle = '#5D3F24';
        ctx.font = 'italic 26px Georgia';
        ctx.fillText(`Valido fino al: ${window.Utils.formatDate(coupon.expiryDate)}`, centerX, qrY + qrSize + 55);

        // Footer
        ctx.font = '22px Arial';
        ctx.fillStyle = '#8B6F47';
        ctx.fillText('Mostra questo coupon alla cassa', centerX, qrY + qrSize + 90);

        canvas.toBlob((blob) => {
            document.body.removeChild(qrContainer);
            if (callback) callback(blob);
        }, 'image/png', 1.0);
    },

    // ==========================================
    // PROCESSAMENTO QR SCANSIONATI
    // ==========================================

    // Processa QR scansionato
    processScannedQR(qrData) {
        console.log("🔍 Processamento QR:", qrData);

        // Se è una stringa, prova a parsare
        if (typeof qrData === 'string') {
            try {
                qrData = JSON.parse(qrData);
            } catch (e) {
                Utils.showToast("QR Code non valido", "error");
                return null;
            }
        }

        // Controlla tipo
        if (!qrData.type) {
            Utils.showToast("QR Code senza tipo", "error");
            return null;
        }

        switch (qrData.type) {
            case 'fidelity':
                return this.processFidelityQR(qrData);

            case 'coupon':
                return this.processCouponQR(qrData);

            default:
                Utils.showToast("Tipo QR non riconosciuto", "error");
                return null;
        }
    },

    // Processa QR fidelity
    processFidelityQR(qrData) {
        if (!FidelityModule) return null;

        const result = FidelityModule.processFidelityQRScan(qrData);

        if (result) {
            Utils.showToast("✅ Carta fidelity riconosciuta!", "success");
        }

        return result;
    },

    // Processa QR coupon
    processCouponQR(qrData) {
        if (!CustomersModule || !CouponsModule) return null;

        const customer = CustomersModule.getCustomerById(qrData.customerId);

        if (!customer || !customer.coupons) {
            Utils.showToast("Coupon non trovato", "error");
            return null;
        }

        const coupon = customer.coupons.find(c => c.id === qrData.couponId);

        if (!coupon) {
            Utils.showToast("Coupon non valido", "error");
            return null;
        }

        if (coupon.used) {
            Utils.showToast("⚠️ Coupon già utilizzato", "warning");
            return null;
        }

        Utils.showToast("✅ Coupon valido!", "success");

        return {
            customer: customer,
            coupon: coupon
        };
    },

    // ==========================================
    // UTILITY
    // ==========================================

    // Verifica se la camera è disponibile
    async isCameraAvailable() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            return cameras.length > 0;
        } catch (error) {
            console.error("Errore controllo camera:", error);
            return false;
        }
    },

    // Ottieni lista camere disponibili
    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (error) {
            console.error("Errore elenco camere:", error);
            return [];
        }
    }
};

// Rendi il modulo disponibile globalmente
window.QRModule = QRModule;

console.log("✅ Modulo QR caricato");