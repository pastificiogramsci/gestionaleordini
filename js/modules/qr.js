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
    generateFidelityQR(containerId, customerId) {
        if (!FidelityModule) {
            console.error("Modulo Fidelity non disponibile");
            return false;
        }
        
        const qrData = FidelityModule.generateFidelityQR(customerId);
        
        if (!qrData) {
            Utils.showToast("Errore generazione QR fidelity", "error");
            return false;
        }
        
        return this.generateQRCode(containerId, JSON.stringify(qrData));
    },
    
    // Genera QR Code per coupon
    generateCouponQR(containerId, customerId, couponId) {
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
        
        return this.generateQRCode(containerId, JSON.stringify(qrData));
    },
    
    // Genera QR Code generico
    generateQRCode(containerId, data, options = {}) {
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.error("Container QR non trovato:", containerId);
            return false;
        }
        
        // Pulisci container
        container.innerHTML = '';
        
        // Opzioni default
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
            
            console.log("✅ QR Code generato");
            return true;
        } catch (error) {
            console.error("Errore generazione QR:", error);
            Utils.showToast("Errore generazione QR Code", "error");
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