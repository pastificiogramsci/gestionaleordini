const WhatsAppModule = {

    // ✅ NUOVA FUNZIONE: Gestisce nome/cognome vuoti
    getDisplayName(customer) {
        const firstName = (customer.firstName || '').trim();
        const lastName = (customer.lastName || '').trim();

        if (firstName && lastName) {
            return `${firstName} ${lastName}`;
        } else if (firstName) {
            return firstName;
        } else if (lastName) {
            return lastName;
        } else {
            return 'Cliente';
        }
    },

    sendWelcomeMessage(customer, withCard = true) {
        const phone = this.formatPhone(customer.phone);
        if (!phone) {
            Utils.showToast("Numero telefono non valido", "error");
            return;
        }

        const displayName = this.getDisplayName(customer);

        const message = `🎉 Ciao ${displayName}!

Benvenuto/a nel programma *Fidelity* del Pastificio Gramsci! 🎊

Come funziona:
- Ogni 20€ di spesa = 1 bollino ⭐
- Ogni 10 bollini = 1 premio 🎁

Ti ho appena inviato la tua tessera digitale! 
Salvala sul telefono e mostrala ad ogni acquisto per accumulare punti.

Grazie per averci scelto! 😊

_Pastificio Gramsci_`;

        if (withCard) {
            QRModule.generateFidelityQR(customer.id, (blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const fileName = this.getDisplayName(customer).replace(/\s+/g, '-');
                    a.download = `tessera-${fileName}.png`;
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

        const displayName = this.getDisplayName(customer);

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

        // ✅ FORMATTAZIONE CORRETTA (NO spazi extra!)
        const message = `🎉 *ORDINE CONFERMATO* 🎉

📦 *#${order.orderNumber}*

Ciao ${displayName}!

${itemsList}

📅 *Ritiro:* ${Utils.formatDate(order.deliveryDate)} ${order.deliveryTime || ''}

Grazie per averci scelto! 😊

_Pastificio Gramsci_`;

        this.openWhatsApp(phone, message);
    },

    sendCouponMessage(customer, coupon) {
        const phone = this.formatPhone(customer.phone);
        if (!phone) return;

        const displayName = this.getDisplayName(customer);

        const message = `🎫 Ciao ${displayName}!

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
                const fileName = this.getDisplayName(customer).replace(/\s+/g, '-');
                a.href = url;
                a.download = `coupon-${fileName}.png`;
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

        const displayName = this.getDisplayName(customer);

        let message = `📦 Ciao ${displayName}!

Il tuo ordine *#${order.orderNumber}* è pronto per il ritiro! ✅

Vieni a ritirarlo quando vuoi! 😊`;

        if (hasCoupon) {
            const coupon = customer.coupons?.find(c => !c.used && !c.notified);
            if (coupon) {
                message += `

🎁 *SORPRESA!* Hai ricevuto un coupon sconto!

*Descrizione:* ${coupon.description}
*Codice:* ${coupon.code}

Usalo nel tuo prossimo acquisto!`;

                coupon.notified = true;
                CustomersModule.saveCustomers();

                message += `

_Pastificio Gramsci_`;

                QRModule.generateCouponQR(customer.id, coupon.id, (blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const fileName = this.getDisplayName(customer).replace(/\s+/g, '-');
                        a.href = url;
                        a.download = `coupon-${fileName}.png`;
                        a.click();
                        URL.revokeObjectURL(url);

                        Utils.showToast("📱 Card coupon scaricata! Mandala su WhatsApp", "success");

                        setTimeout(() => {
                            this.openWhatsApp(phone, message);
                        }, 1000);
                    } else {
                        this.openWhatsApp(phone, message);
                    }
                });

                return;
            }
        }

        message += `

_Pastificio Gramsci_`;

        this.openWhatsApp(phone, message);
    },

    formatPhone(phone) {
        if (!phone) return null;

        let cleaned = phone.replace(/[\s\-\(\)]/g, '');

        if (cleaned.startsWith('0')) {
            cleaned = '39' + cleaned.substring(1);
        }

        if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned;
        }

        return cleaned;
    },

    // ✅ AGGIUNTO: Copia numero negli appunti
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                console.log('📋 Numero copiato negli appunti:', text);
            }).catch(err => {
                console.error('Errore copia clipboard:', err);
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                console.log('📋 Numero copiato (fallback):', text);
            } catch (err) {
                console.error('Errore copia fallback:', err);
            }
            document.body.removeChild(textArea);
        }
    },

    openWhatsApp(phone, message) {
        const encodedMessage = encodeURIComponent(message);
        const phoneClean = phone.replace('+', '');
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // ✅ Copia numero negli appunti (per messaggi effimeri)
        this.copyToClipboard(phoneClean);

        let url;

        if (isMobile) {
            url = `whatsapp://send?phone=${phoneClean}&text=${encodedMessage}`;
            console.log('📱 Apertura WhatsApp APP (mobile)');
        } else {
            url = `https://wa.me/${phoneClean}?text=${encodedMessage}`;
            console.log('💻 Apertura WhatsApp Web (desktop)');
        }

        console.log('🔗 URL WhatsApp:', url);

        try {
            if (isMobile) {
                window.location.href = url;
            } else {
                window.open(url, '_blank');
            }

            // Toast informativo solo se potrebbe essere utile
            setTimeout(() => {
                Utils.showToast(`📱 WhatsApp aperto
                
💡 Numero copiato negli appunti (${phoneClean}) se hai messaggi effimeri attivi`, "info", 4000);
            }, 500);

        } catch (error) {
            console.error('Errore apertura WhatsApp:', error);
            Utils.showToast(`❌ Errore apertura WhatsApp. Numero copiato: ${phoneClean}`, "error");
        }
    },

};

window.WhatsAppModule = WhatsAppModule;