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

    sendStampsNotification(customer, stampsAdded, currentStamps, stampsNeeded, availableRewards = 0) {
        const phone = this.formatPhone(customer.phone);
        if (!phone) {
            console.warn("⚠️ Numero telefono non valido per notifica bollini");
            return;
        }

        const displayName = this.getDisplayName(customer);

        // Genera stelline visuali
        const stars = '⭐'.repeat(Math.min(stampsAdded, 10));

        let message = '';

        // Se ha appena sbloccato premi
        if (availableRewards > 0 && stampsAdded >= 10) {
            message = `🎉 PREMIO SBLOCCATO! 🎉

Ciao ${displayName}!

Hai appena guadagnato ${availableRewards} premio/i! 🎁

📊 Stato tessera:
- Bollini attuali: ${currentStamps}
- Mancano ${stampsNeeded} bollini al prossimo premio

Vieni a ritirare il tuo premio! 😊

_Pastificio Gramsci_`;
        } else {
            message = `🎉 Ciao ${displayName}!

Ti abbiamo appena aggiunto ${stampsAdded} bollini! ${stars}

📊 Stato tessera:
- Bollini attuali: ${currentStamps}
- Mancano ${stampsNeeded} bollini al prossimo premio`;

            // Se ha premi disponibili non riscattati
            if (availableRewards > 0) {
                message += `
- 🎁 Hai ${availableRewards} premio/i disponibile/i da riscattare!

Non dimenticare di usare ${availableRewards === 1 ? 'il tuo premio' : 'i tuoi premi'}! 😊`;
            } else {
                message += `

Continua così! 🎁`;
            }

            message += `

_Pastificio Gramsci_`;
        }

        this.openWhatsApp(phone, message);
    },

    sendOrderConfirmation(order) {
        const customer = CustomersModule.getCustomerById(order.customerId);
        if (!customer) return;

        const phone = this.formatPhone(customer.phone);
        if (!phone) return;

        const displayName = this.getDisplayName(customer);

        const itemsList = order.items.map(item => {
            const product = ProductsModule.getProductById(item.productId);
            const displayQty = Utils.formatProductQuantity(item.quantity, product, item);
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

    // Invia notifica modifica ordine
    sendOrderModification(order, oldOrder = null) {
        const customer = CustomersModule.getCustomerById(order.customerId);
        if (!customer?.phone) {
            Utils.showToast("❌ Cliente senza numero di telefono", "error");
            return;
        }

        const customerName = this.getDisplayName(customer);
        const formattedDate = Utils.formatDate(order.deliveryDate);
        const formattedTime = order.deliveryTime || '';

        let message = `🔔 MODIFICA ORDINE #${order.orderNumber}\n\n`;
        message += `Ciao ${customerName},\nabbiamo modificato il tuo ordine:\n\n`;

        // Se la data è cambiata
        if (oldOrder && oldOrder.deliveryDate !== order.deliveryDate) {
            const oldFormattedDate = Utils.formatDate(oldOrder.deliveryDate);
            message += `📅 Nuova data consegna: ${formattedDate}`;
            if (formattedTime) message += ` ore ${formattedTime}`;
            message += `\n(prima era: ${oldFormattedDate}`;
            if (oldOrder.deliveryTime) message += ` ore ${oldOrder.deliveryTime}`;
            message += `)\n\n`;
        } else {
            message += `📅 Data consegna: ${formattedDate}`;
            if (formattedTime) message += ` ore ${formattedTime}`;
            message += `\n\n`;
        }

        // Prodotti
        message += `📦 Prodotti:\n`;
        order.items.forEach(item => {
            const product = ProductsModule.getProductById(item.productId);
            const productName = product?.name || 'Prodotto';
            const displayQty = Utils.formatProductQuantity(item.quantity, product, item);
            message += `• ${productName} - ${displayQty}\n`;
        });

        // Note
        if (order.notes) {
            message += `\n\n📝 Note: ${order.notes}`;
        }

        message += `\n\n✅ Ti confermiamo la modifica!`;

        this.openWhatsApp(customer.phone, message);
    },

    sendCouponMessage(customer, coupon) {
        const phone = this.formatPhone(customer.phone);
        if (!phone) return;

        const displayName = this.getDisplayName(customer);

        // ⬇️ LEGGI SEMPRE DALLA CAMPAGNA (RETROATTIVO) ⬇️
        const campaign = CouponsModule.getCampaignById(coupon.campaignId);
        const description = campaign ? campaign.description : coupon.description;
        // ⬆️ FINE MODIFICA RETROATTIVA ⬆️

        const message = `🎁 REGALO SPECIALE! 🎁

Ciao ${displayName}!

Hai ricevuto un *COUPON SCONTO* per ringraziarti della tua fedeltà! 🎉

🎫 *COSA INCLUDE:*
➡️ ${description}

📱 *COME USARLO:*
Mostra questo QR code alla cassa al tuo prossimo acquisto!

*Codice:* ${coupon.code}
*Valido fino al:* ${Utils.formatDate(coupon.expiryDate)}

Non perderlo! ⏰

Grazie di cuore! ❤️

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

                Utils.showToast("📱 Card coupon scaricata! Mandala su WhatsApp", "success");
            } else {
                this.openWhatsApp(phone, message);
            }
        });
    },
    
    sendDeliveryNotification(order) {
        const customer = CustomersModule.getCustomerById(order.customerId);
        if (!customer) return;

        const phone = this.formatPhone(customer.phone);
        if (!phone) return;

        const displayName = this.getDisplayName(customer);

        const message = `📦 Ciao ${displayName}!

Il tuo ordine *#${order.orderNumber}* è stato consegnato! 🎉

Grazie per averci scelto! 😊

⭐⭐⭐⭐⭐
Ti è piaciuto? Lasciaci una recensione su Google!
👉 https://g.page/r/CUYacCbpX0mKEBM/review

Ci aiuti tantissimo! 🙏

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