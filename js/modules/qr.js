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
            id: customer.id,
            name: `${customer.firstName} ${customer.lastName}`,
            app: 'fidelity-card'
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
        console.log('🎨 Disegno card fidelity...');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        canvas.width = isMobile ? 800 : 1200;
        canvas.height = isMobile ? 500 : 750;

        const scale = isMobile ? 0.65 : 1;

        // Sfondo gradiente
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#F8E3C4');
        gradient.addColorStop(1, '#F2D4A4');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Texture
        ctx.globalAlpha = 0.03;
        const texturePoints = isMobile ? 50 : 200;
        for (let i = 0; i < texturePoints; i++) {
            ctx.fillStyle = '#5D3F24';
            ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
        }
        ctx.globalAlpha = 1;

        // Intestazione
        ctx.fillStyle = '#5D3F24';
        ctx.font = `bold ${Math.floor(60 * scale)}px Georgia`;
        ctx.textAlign = 'center';
        ctx.fillText('PASTIFICIO GRAMSCI', canvas.width / 2, Math.floor(80 * scale));

        // Nome cliente
        ctx.font = `bold ${Math.floor(40 * scale)}px Arial`;
        ctx.fillText(`${customer.firstName} ${customer.lastName}`, canvas.width / 2, Math.floor(150 * scale));

        // QR Code
        const qrSize = Math.floor(300 * scale);
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = Math.floor(200 * scale);
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        // Testo
        ctx.font = `${Math.floor(24 * scale)}px Arial`;
        ctx.fillText('Tessera Fidelity', canvas.width / 2, canvas.height - Math.floor(60 * scale));

        // Converti in blob
        canvas.toBlob((blob) => {
            console.log('✅ Card generata:', blob.size, 'bytes');
            document.body.removeChild(qrContainer);
            if (callback) callback(blob);
        }, 'image/png', 1.0);
    },

    // Genera QR Code per coupon
    generateCouponQR(containerId, customerId, couponId, callback) {
        if (!CustomersModule) {
            console.error("Modulo Clienti non disponibile");
            return false;
        }

        const customer = CustomersModule.getCustomerById(customerId);
        if (!customer || !customer.coupons) return false;

        const coupon = customer.coupons.find(c => c.id === couponId);
        if (!coupon) return false;

        const qrData = {
            type: 'coupon',
            couponId: coupon.id,
            customerId: customerId,
            code: coupon.code
        };

        return this.generateQRCode(containerId, JSON.stringify(qrData), {}, callback);
    },

    generateQRCode(containerId, data, options = {}, callback) {
        const container = document.getElementById(containerId);

        if (!container) {
            console.error("Container QR non trovato:", containerId);
            return false;
        }

        container.innerHTML = '';

        const qrOptions = {
            width: options.width || 256,
            height: options.height || 256,
            colorDark: options.colorDark || "#000000",
            colorLight: options.colorLight || "#ffffff"
        };

        try {
            new QRCode(container, {
                text: data,
                ...qrOptions
            });

            // ASPETTA rendering (come fidelity)
            setTimeout(() => {
                console.log('⏰ Verifico QR coupon...');

                let qrImg = container.querySelector('img');
                const qrCanvas = container.querySelector('canvas');

                // Fallback CANVAS se IMG vuota
                if (qrImg && (!qrImg.src || qrImg.src.length < 100)) {
                    console.log('⚠️ IMG vuota coupon, uso CANVAS');
                    qrImg = null;
                }

                // Usa CANVAS
                if (!qrImg && qrCanvas) {
                    console.log('🔄 Converto CANVAS coupon');
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        console.log('✅ QR coupon da CANVAS pronto');
                        container.innerHTML = '';
                        container.appendChild(tempImg);
                        if (callback) callback(true);
                    };
                    tempImg.onerror = () => {
                        console.error('❌ Errore CANVAS coupon');
                        if (callback) callback(false);
                    };
                    tempImg.src = qrCanvas.toDataURL();
                    return;
                }

                // IMG già OK
                if (qrImg && qrImg.src) {
                    console.log('✅ QR coupon da IMG pronto');
                    if (callback) callback(true);
                    return;
                }

                console.error('❌ Nessun QR coupon');
                if (callback) callback(false);
            }, 500);

            return true;
        } catch (error) {
            console.error("Errore generazione QR:", error);
            Utils.showToast("Errore generazione QR Code", "error");
            if (callback) callback(false);
            return false;
        }
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