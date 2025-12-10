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
        const phoneFormatted = this.formatPhone(phone);

        if (!phoneFormatted) {
            Utils.showToast("❌ Numero telefono non valido", "error");
            return;
        }

        // Rimuovi + per WhatsApp
        const phoneClean = phoneFormatted.replace(/\+/g, '');

        // ✅ IMPORTANTE: Valida che il numero sia solo cifre
        if (!/^\d+$/.test(phoneClean)) {
            console.error('❌ Numero contiene caratteri non validi:', phoneClean);
            Utils.showToast(`❌ Numero non valido: ${phoneClean}`, "error");
            return;
        }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // ✅ Copia numero negli appunti come backup
        this.copyToClipboard(phoneClean);

        let url;

        if (isMobile) {
            // ✅ Mobile: encoding più sicuro per whatsapp://
            // Usa encodeURIComponent E poi sostituisci caratteri problematici
            const safeMessage = encodeURIComponent(message)
                .replace(/'/g, '%27')  // Apostrofi
                .replace(/\(/g, '%28')  // Parentesi
                .replace(/\)/g, '%29')
                .replace(/\*/g, '%2A')  // Asterischi (bold WhatsApp)
                .replace(/_/g, '%5F');   // Underscore (italic WhatsApp)

            url = `whatsapp://send?phone=${phoneClean}&text=${safeMessage}`;

            console.log('📱 Mobile - App WhatsApp');
            console.log('📞 Numero:', phoneClean);
            console.log('📝 Messaggio length:', message.length);
            console.log('🔗 URL:', url.substring(0, 200) + '...');

        } else {
            // ✅ Desktop: wa.me funziona meglio
            const encodedMessage = encodeURIComponent(message);
            url = `https://wa.me/${phoneClean}?text=${encodedMessage}`;

            console.log('💻 Desktop - WhatsApp Web');
            console.log('📞 Numero:', phoneClean);
        }

        try {
            if (isMobile) {
                // ✅ IMPORTANTE: Mostra alert PRIMA di aprire per verificare
                // (rimuovi dopo aver verificato che funziona)
                if (confirm(`📱 Apro WhatsApp per:\n${phoneClean}\n\n(Il numero è negli appunti)\n\nContinua?`)) {
                    window.location.href = url;
                }
            } else {
                const newWindow = window.open(url, '_blank');

                if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    Utils.showToast(`❌ Popup bloccato. Numero copiato: ${phoneClean}`, "error", 5000);
                    return;
                }
            }

        } catch (error) {
            console.error('❌ Errore apertura WhatsApp:', error);
            Utils.showToast(`❌ Errore. Numero copiato negli appunti: ${phoneClean}`, "error");
        }
    },

};

window.WhatsAppModule = WhatsAppModule;