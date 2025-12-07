const WhatsAppModule = {

    sendWelcomeMessage(customer, withCard = true) {
        const phone = this.formatPhone(customer.phone);
        if (!phone) {
            Utils.showToast("Numero telefono non valido", "error");
            return;
        }

        const message = `Ciao ${customer.firstName}! 🎉

Benvenuto/a nel nostro programma Fidelity di Pastificio Gramsci!

✨ Ogni 10 bollini ottieni un premio
📱 Scarica la tua tessera digitale dal link
🎁 Accumula punti ad ogni acquisto

Grazie per averci scelto!`;

        if (withCard) {
            // Prima genera e scarica la card
            QRModule.generateFidelityQR(customer.id, (blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `tessera-${customer.firstName}-${customer.lastName}.png`;
                    a.click();
                    URL.revokeObjectURL(url);

                    // Poi apri WhatsApp
                    setTimeout(() => {
                        this.openWhatsApp(phone, message);
                    }, 1000);

                    Utils.showToast("📱 Tessera scaricata! Mandala su WhatsApp", "success");
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
            return `• ${product?.name || 'Prodotto'} - ${item.quantity.toFixed(2)} ${product?.unit || 'kg'}`;
        }).join('\n');

        const message = `Ciao ${customer.firstName}! 📦

Il tuo ordine #${order.orderNumber} è stato confermato!

${itemsList}

📅 Ritiro: ${Utils.formatDate(order.deliveryDate)} ${order.deliveryTime || ''}

Ci vediamo presto! 😊`;

        this.openWhatsApp(phone, message);
    },

    sendCouponMessage(customer, coupon) {
        const phone = this.formatPhone(customer.phone);
        if (!phone) return;

        const message = `Ciao ${customer.firstName}! 🎁

Hai ricevuto un nuovo coupon sconto!

🎫 ${coupon.campaignName}
💝 ${coupon.description}
🔢 Codice: ${coupon.code}
⏰ Valido fino al ${Utils.formatDate(coupon.expiryDate)}

Mostra questo messaggio alla cassa per usare lo sconto!

Grazie per la tua fedeltà! ❤️`;

        // Prima genera e scarica la card coupon
        QRModule.generateCouponQR(customer.id, coupon.id, (blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `coupon-${customer.firstName}-${customer.lastName}.png`;
                a.click();
                URL.revokeObjectURL(url);

                // Poi apri WhatsApp
                setTimeout(() => {
                    this.openWhatsApp(phone, message);
                }, 1000);

                Utils.showToast("📱 Card coupon scaricata! Mandala su WhatsApp", "success");
            } else {
                // Fallback: solo messaggio senza card
                this.openWhatsApp(phone, message);
            }
        });
    },

    sendDeliveryNotification(order, hasCoupon = false) {
        const customer = CustomersModule.getCustomerById(order.customerId);
        if (!customer) return;

        const phone = this.formatPhone(customer.phone);
        if (!phone) return;

        let message = `Ciao ${customer.firstName}! ✅

    Il tuo ordine #${order.orderNumber} è pronto per il ritiro!

    📍 Vieni a ritirarlo quando vuoi`;

        if (hasCoupon) {
            // Trova il coupon appena assegnato
            const coupon = customer.coupons?.find(c => !c.used && !c.notified);
            if (coupon) {
                message += `

    🎁 SORPRESA! Hai ricevuto un coupon sconto!
    🎫 ${coupon.description}
    🔢 Codice: ${coupon.code}

    Usalo nel tuo prossimo acquisto!`;

                // Marca coupon come notificato
                coupon.notified = true;
                CustomersModule.saveCustomers();

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

        message += `

    Grazie e a presto! 😊`;

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
        const url = `https://wa.me/${phone}?text=${encodedMessage}`;

        // Su mobile apre l'app, su desktop apre WhatsApp Web
        window.open(url, '_blank');
    }
};

window.WhatsAppModule = WhatsAppModule;