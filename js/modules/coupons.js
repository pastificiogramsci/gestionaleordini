// ============================================
// 🎫 SISTEMA COUPON
// ============================================

const CouponsModule = {
    
    campaigns: [],
    
    // ==========================================
    // INIZIALIZZAZIONE
    // ==========================================
    
    async init() {
        await this.loadCampaigns();
        console.log("✅ Modulo Coupon inizializzato");
    },
    
    // ==========================================
    // CARICAMENTO DATI
    // ==========================================
    
    async loadCampaigns() {
        this.campaigns = await Storage.loadCampaigns();
        console.log(`📋 Caricate ${this.campaigns.length} campagne`);
    },
    
    async saveCampaigns() {
        await Storage.saveCampaigns(this.campaigns);
        console.log("💾 Campagne salvate");
    },
    
    // ==========================================
    // GESTIONE CAMPAGNE
    // ==========================================
    
    // Crea nuova campagna
    createCampaign(campaignData) {
        const campaign = {
            id: Utils.generateId(),
            name: campaignData.name,
            description: campaignData.description || '',
            discountType: campaignData.discountType, // 'percentage' o 'fixed'
            discountValue: parseFloat(campaignData.discountValue),
            startDate: campaignData.startDate,
            endDate: campaignData.endDate,
            active: true,
            createdAt: new Date().toISOString()
        };
        
        this.campaigns.push(campaign);
        this.saveCampaigns();
        
        Utils.showToast(`✅ Campagna "${campaign.name}" creata!`, "success");
        return campaign;
    },
    
    // Aggiorna campagna
    updateCampaign(campaignId, updates) {
        const index = this.campaigns.findIndex(c => c.id === campaignId);
        
        if (index === -1) {
            Utils.showToast("Campagna non trovata", "error");
            return null;
        }
        
        this.campaigns[index] = {
            ...this.campaigns[index],
            ...updates,
            id: campaignId
        };
        
        this.saveCampaigns();
        Utils.showToast("✅ Campagna aggiornata!", "success");
        return this.campaigns[index];
    },
    
    // Elimina campagna
    deleteCampaign(campaignId) {
        const index = this.campaigns.findIndex(c => c.id === campaignId);
        
        if (index === -1) {
            Utils.showToast("Campagna non trovata", "error");
            return false;
        }
        
        const campaign = this.campaigns[index];
        
        if (confirm(`Eliminare la campagna "${campaign.name}"?`)) {
            this.campaigns.splice(index, 1);
            this.saveCampaigns();
            Utils.showToast("✅ Campagna eliminata", "success");
            return true;
        }
        
        return false;
    },
    
    // Attiva/Disattiva campagna
    toggleCampaignActive(campaignId) {
        const campaign = this.getCampaignById(campaignId);
        
        if (campaign) {
            campaign.active = !campaign.active;
            this.saveCampaigns();
            
            const status = campaign.active ? "attivata" : "disattivata";
            Utils.showToast(`✅ Campagna ${status}`, "success");
            return campaign;
        }
        
        return null;
    },
    
    // ==========================================
    // GESTIONE COUPON CLIENTE
    // ==========================================
    
    // Assegna coupon a un cliente per una campagna
    assignCouponToCustomer(customerId, campaignId) {
        const campaign = this.getCampaignById(campaignId);
        
        if (!campaign || !campaign.active) {
            Utils.showToast("Campagna non valida o non attiva", "error");
            return null;
        }
        
        // Controlla se il cliente esiste
        const customer = CustomersModule ? 
            CustomersModule.getCustomerById(customerId) : null;
        
        if (!customer) {
            Utils.showToast("Cliente non trovato", "error");
            return null;
        }
        
        // Inizializza array coupon se non esiste
        if (!customer.coupons) {
            customer.coupons = [];
        }
        
        // Controlla se ha già un coupon per questa campagna
        const existing = customer.coupons.find(c => 
            c.campaignId === campaignId && !c.used
        );
        
        if (existing) {
            Utils.showToast("Cliente ha già un coupon per questa campagna", "warning");
            return existing;
        }
        
        // Crea coupon
        const coupon = {
            id: Utils.generateId(),
            campaignId: campaignId,
            campaignName: campaign.name,
            code: Utils.generateCode(8),
            discountType: campaign.discountType,
            discountValue: campaign.discountValue,
            assignedAt: new Date().toISOString(),
            used: false,
            usedDate: null
        };
        
        customer.coupons.push(coupon);
        
        // Salva clienti
        if (CustomersModule) {
            CustomersModule.saveCustomers();
        }
        
        Utils.showToast(`✅ Coupon assegnato a ${customer.firstName}!`, "success");
        return coupon;
    },
    
    // Assegna coupon a tutti i clienti per una campagna
    assignCouponToAllCustomers(campaignId) {
        const campaign = this.getCampaignById(campaignId);
        
        if (!campaign || !campaign.active) {
            Utils.showToast("Campagna non valida", "error");
            return 0;
        }
        
        if (!CustomersModule) {
            Utils.showToast("Modulo clienti non disponibile", "error");
            return 0;
        }
        
        const customers = CustomersModule.getAllCustomers();
        let assigned = 0;
        
        customers.forEach(customer => {
            const result = this.assignCouponToCustomer(customer.id, campaignId);
            if (result) assigned++;
        });
        
        Utils.showToast(`✅ ${assigned} coupon assegnati!`, "success");
        return assigned;
    },
    
    // Usa coupon
    useCoupon(customerId, couponId, orderAmount) {
        if (!CustomersModule) return null;
        
        const customer = CustomersModule.getCustomerById(customerId);
        
        if (!customer || !customer.coupons) {
            Utils.showToast("Cliente o coupon non trovato", "error");
            return null;
        }
        
        const coupon = customer.coupons.find(c => c.id === couponId);
        
        if (!coupon) {
            Utils.showToast("Coupon non trovato", "error");
            return null;
        }
        
        if (coupon.used) {
            Utils.showToast("Coupon già utilizzato", "warning");
            return null;
        }
        
        // Calcola sconto
        let discountAmount = 0;
        
        if (coupon.discountType === 'percentage') {
            discountAmount = (orderAmount * coupon.discountValue) / 100;
        } else {
            discountAmount = coupon.discountValue;
        }
        
        // Non può essere maggiore dell'importo
        discountAmount = Math.min(discountAmount, orderAmount);
        
        const finalAmount = orderAmount - discountAmount;
        
        // Marca come usato
        coupon.used = true;
        coupon.usedDate = new Date().toISOString();
        coupon.usedAmount = orderAmount;
        coupon.discountApplied = discountAmount;
        
        CustomersModule.saveCustomers();
        
        Utils.showToast(`✅ Coupon applicato! Sconto: ${Utils.formatPrice(discountAmount)}`, "success");
        
        return {
            originalAmount: orderAmount,
            discountAmount: discountAmount,
            finalAmount: finalAmount
        };
    },
    
    // ==========================================
    // RICERCA E FILTRI
    // ==========================================
    
    // Trova campagna per ID
    getCampaignById(campaignId) {
        return this.campaigns.find(c => c.id === campaignId);
    },
    
    // Ottieni campagne attive
    getActiveCampaigns() {
        const now = new Date();
        
        return this.campaigns.filter(c => {
            if (!c.active) return false;
            
            const start = new Date(c.startDate);
            const end = new Date(c.endDate);
            
            return now >= start && now <= end;
        });
    },
    
    // Ottieni campagne future
    getUpcomingCampaigns() {
        const now = new Date();
        
        return this.campaigns.filter(c => {
            const start = new Date(c.startDate);
            return start > now;
        });
    },
    
    // Ottieni campagne scadute
    getExpiredCampaigns() {
        const now = new Date();
        
        return this.campaigns.filter(c => {
            const end = new Date(c.endDate);
            return end < now;
        });
    },
    
    // Ottieni coupon attivi di un cliente
    getCustomerActiveCoupons(customerId) {
        if (!CustomersModule) return [];
        
        const customer = CustomersModule.getCustomerById(customerId);
        if (!customer || !customer.coupons) return [];
        
        return customer.coupons.filter(c => !c.used);
    },
    
    // Ottieni tutti i clienti con coupon attivi
    getCustomersWithActiveCoupons() {
        if (!CustomersModule) return [];
        
        return CustomersModule.getAllCustomers().filter(customer => {
            const activeCoupons = this.getCustomerActiveCoupons(customer.id);
            return activeCoupons.length > 0;
        });
    },
    
    // ==========================================
    // STATISTICHE
    // ==========================================
    
    // Ottieni statistiche coupon
    getCouponStats() {
        let totalCoupons = 0;
        let usedCoupons = 0;
        let totalDiscount = 0;
        
        if (CustomersModule) {
            const customers = CustomersModule.getAllCustomers();
            
            customers.forEach(customer => {
                if (customer.coupons) {
                    totalCoupons += customer.coupons.length;
                    
                    customer.coupons.forEach(coupon => {
                        if (coupon.used) {
                            usedCoupons++;
                            totalDiscount += (coupon.discountApplied || 0);
                        }
                    });
                }
            });
        }
        
        return {
            totalCampaigns: this.campaigns.length,
            activeCampaigns: this.getActiveCampaigns().length,
            totalCoupons: totalCoupons,
            usedCoupons: usedCoupons,
            activeCoupons: totalCoupons - usedCoupons,
            totalDiscount: totalDiscount,
            customersWithCoupons: this.getCustomersWithActiveCoupons().length
        };
    },
    
    // ==========================================
    // VALIDAZIONE
    // ==========================================
    
    validateCampaign(campaignData) {
        const errors = [];
        
        if (!campaignData.name || campaignData.name.trim() === '') {
            errors.push("Nome campagna obbligatorio");
        }
        
        if (!campaignData.discountType) {
            errors.push("Tipo sconto obbligatorio");
        }
        
        if (!campaignData.discountValue || campaignData.discountValue <= 0) {
            errors.push("Valore sconto non valido");
        }
        
        if (campaignData.discountType === 'percentage' && campaignData.discountValue > 100) {
            errors.push("Percentuale non può essere maggiore di 100%");
        }
        
        if (!campaignData.startDate) {
            errors.push("Data inizio obbligatoria");
        }
        
        if (!campaignData.endDate) {
            errors.push("Data fine obbligatoria");
        }
        
        if (campaignData.startDate && campaignData.endDate) {
            if (new Date(campaignData.startDate) > new Date(campaignData.endDate)) {
                errors.push("Data fine deve essere dopo data inizio");
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },
    
    // ==========================================
    // UTILITY
    // ==========================================
    
    // Verifica validità coupon
    verifyCoupon(couponCode) {
        if (!CustomersModule) return null;
        
        const customers = CustomersModule.getAllCustomers();
        
        for (const customer of customers) {
            if (customer.coupons) {
                const coupon = customer.coupons.find(c => 
                    c.code === couponCode && !c.used
                );
                
                if (coupon) {
                    return {
                        valid: true,
                        customer: customer,
                        coupon: coupon
                    };
                }
            }
        }
        
        return {
            valid: false,
            message: "Coupon non valido o già utilizzato"
        };
    }
};

// Rendi il modulo disponibile globalmente
window.CouponsModule = CouponsModule;

console.log("✅ Modulo Coupon caricato");