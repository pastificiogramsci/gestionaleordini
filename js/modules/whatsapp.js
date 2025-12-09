const WhatsAppModule = {

    sendWelcomeMessage(customer, withCard = true) {
        const phone = this.formatPhone(customer.phone);
        if (!phone) {
            Utils.showToast("Numero telefono non valido", "error");
            return;
        }

        const message = `🎉 Ciao ${customer.firstName}!

        Benvenuto/a nel programma *Fidelity* del Pastificio Gramsci! 🎊

        Come funziona:
        - Ogni 20€ di spesa = 1 bollino ⭐
        - Ogni 10 bollini = 1 premio 🎁

        Scarica la tua tessera digitale dal link e accumula punti ad ogni acquisto!

        Grazie per averci scelto! 😊

        _Pastificio Gramsci_`;

        if (withCard) {
            QRModule.generateFidelityQR(customer.id, (blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `tessera-${customer.firstName}-${customer.lastName}.png`;
                    a.click();
                    URL.revokeObjectURL(url);

                    setTimeout(() => {
                        this.openWhatsApp(phone, message);
                    }, 1000);

                    Utils.showToast("✅ Tessera scaricata! Mandala su WhatsApp", "success");
                } else {
                    this.openWhatsApp(phone, message);
                }
            });
        } else {
            this.openWhatsApp(phone, message);
        }
    },

    sendOrderConfirmation(order) {
        const customer = CustomersModule.getCustomerById(order.customerId);
        if (!customer) return;

        const phone = this.formatPhone(customer.phone);
        if (!phone) return;

        const itemsList = order.items.map(item => {
            const product = ProductsModule.getProductById(item.productId);

            let displayQty = '';

            if (item.mode === 'weight' && product?.averageWeight) {
                const pezzi = Math.round(item.quantity / product.averageWeight);
                displayQty = `${pezzi} pz`;
            } else if (item.mode === 'pieces') {
                displayQty = `${item.quantity} pz`;
            } else if (item.mode === 'kg') {
                displayQty = `${item.quantity.toFixed(2)} kg`;
            } else {
                displayQty = `${item.quantity.toFixed(2)} ${item.unit || 'kg'}`;
            }

            return `• ${product?.name || 'Prodotto'} - ${displayQty}`;
        }).join('\n');

        const message = `🎉 *ORDINE CONFERMATO* 🎉

        📦 *#${order.orderNumber}*

        Ciao ${customer.firstName}!

        ${itemsList}

        📅 *Ritiro:* ${Utils.formatDate(order.deliveryDate)} ${order.deliveryTime || ''}

        Grazie per averci scelto! 😊

        _Pastificio Gramsci_`;

        this.openWhatsApp(phone, message);
    },

    sendCouponMessage(customer, coupon) {
        const phone = this.formatPhone(customer.phone);
        if (!phone) return;

        const message = `🎫 Ciao ${customer.firstName}!

        Hai ricevuto un *nuovo coupon sconto*! 🎉

        *Campagna:* ${coupon.campaignName}
        *Descrizione:* ${coupon.description}
        *Codice:* ${coupon.code}
        *Valido fino al:* ${Utils.formatDate(coupon.expiryDate)}

        Mostra questo coupon alla cassa per usare lo sconto!

        Grazie per la tua fedeltà! 😊

        _Pastificio Gramsci_`;

        QRModule.generateCouponQR(customer.id, coupon.id, (blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `coupon-${customer.firstName}-${customer.lastName}.png`;
                a.click();
                URL.revokeObjectURL(url);

                setTimeout(() => {
                    this.openWhatsApp(phone, message);
                }, 1000);

                Utils.showToast("✅ Card coupon scaricata! Mandala su WhatsApp", "success");
            } else {
                this.openWhatsApp(phone, message);
            }
        });
    },

    sendDeliveryNotification(order, hasCoupon = false) {
        const customer = CustomersModule.getCustomerById(order.customerId);
        if (!customer) return;

        const phone = this.formatPhone(customer.phone);
        if (!phone) return;

        let message = `📦 Ciao ${customer.firstName}!

        Il tuo ordine *#${order.orderNumber}* è pronto per il ritiro! ✅

        Vieni a ritirarlo quando vuoi! 😊`;

        if (hasCoupon) {
            // Trova il coupon appena assegnato
            const coupon = customer.coupons?.find(c => !c.used && !c.notified);
            if (coupon) {
                message += `

        🎁 *SORPRESA!* Hai ricevuto un coupon sconto!

        *Descrizione:* ${coupon.description}
        *Codice:* ${coupon.code}

        Usalo nel tuo prossimo acquisto!`;

                // Marca coupon come notificato
                coupon.notified = true;
                CustomersModule.saveCustomers();

                // Aggiungi firma PRIMA di generare QR
                message += `

        _Pastificio Gramsci_`;

                // GENERA E INVIA CARD COUPON
                QRModule.generateCouponQR(customer.id, coupon.id, (blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `coupon-${customer.firstName}-${customer.lastName}.png`;
                        a.click();
                        URL.revokeObjectURL(url);

                        Utils.showToast("📱 Card coupon scaricata! Mandala su WhatsApp", "success");

                        // Poi apri WhatsApp
                        setTimeout(() => {
                            this.openWhatsApp(phone, message);
                        }, 1000);
                    } else {
                        // Fallback: solo messaggio
                        this.openWhatsApp(phone, message);
                    }
                });

                return; // ← IMPORTANTE: esci qui per aspettare il callback
            }
        }

        // Se non c'è coupon, aggiungi firma normale
        message += `

        _Pastificio Gramsci_`;

        this.openWhatsApp(phone, message);
    },

    formatPhone(phone) {
        if (!phone) return null;

        // Rimuovi spazi, trattini, parentesi
        let cleaned = phone.replace(/[\s\-\(\)]/g, '');

        // Se inizia con 0, sostituisci con +39
        if (cleaned.startsWith('0')) {
            cleaned = '39' + cleaned.substring(1);
        }

        // Se non inizia con +, aggiungi +
        if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned;
        }

        return cleaned;
    },

    openWhatsApp(phone, message) {
        const encodedMessage = encodeURIComponent(message);

        // Rimuovi il + iniziale se c'è (WhatsApp URI scheme non lo vuole)
        const phoneClean = phone.replace('+', '');

        // Rileva se è mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        let url;

        if (isMobile) {
            // Mobile: usa schema WhatsApp nativo (apre l'APP direttamente!)
            url = `whatsapp://send?phone=${phoneClean}&text=${encodedMessage}`;
            console.log('📱 Apertura WhatsApp APP (mobile)');
        } else {
            // Desktop: usa WhatsApp Web
            url = `https://wa.me/${phoneClean}?text=${encodedMessage}`;
            console.log('💻 Apertura WhatsApp Web (desktop)');
        }

        console.log('🔗 URL WhatsApp:', url);

        // Su mobile usa window.location invece di window.open
        if (isMobile) {
            window.location.href = url;
        } else {
            window.open(url, '_blank');
        }
    },

};

window.WhatsAppModule = WhatsAppModule;