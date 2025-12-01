// ============================================
// 🎁 SISTEMA FIDELITY
// ============================================

const FidelityModule = {
    
    fidelityCustomers: [],
    
    // ==========================================
    // INIZIALIZZAZIONE
    // ==========================================
    
    async init() {
        await this.loadFidelity();
        console.log("✅ Modulo Fidelity inizializzato");
    },
    
    // ==========================================
    // CARICAMENTO DATI
    // ==========================================
    
    async loadFidelity() {
        this.fidelityCustomers = await Storage.loadFidelity();
        console.log(`📋 Caricati ${this.fidelityCustomers.length} clienti fidelity`);
    },
    
    async saveFidelity() {
        await Storage.saveFidelity(this.fidelityCustomers);
        console.log("💾 Fidelity salvato");
    },
    
    // ==========================================
    // GESTIONE CLIENTE FIDELITY
    // ==========================================
    
    // Registra nuovo cliente nel programma fidelity
    registerCustomer(customerId) {
        // Controlla se già registrato
        const existing = this.getFidelityCustomer(customerId);
        if (existing) {
            Utils.showToast("Cliente già nel programma fidelity", "warning");
            return existing;
        }
        
        const fidelityData = {
            customerId: customerId,
            stamps: 0,
            totalStamps: 0,
            rewards: [],
            history: [],
            joinedAt: new Date().toISOString()
        };
        
        this.fidelityCustomers.push(fidelityData);
        this.saveFidelity();
        
        Utils.showToast("✅ Cliente registrato nel programma fidelity!", "success");
        return fidelityData;
    },
    
    // Ottieni dati fidelity di un cliente
    getFidelityCustomer(customerId) {
        return this.fidelityCustomers.find(f => f.customerId === customerId);
    },
    
    // ==========================================
    // GESTIONE BOLLINI
    // ==========================================
    
    // Aggiungi bollini a un cliente
    addStamps(customerId, stampsToAdd, orderId = null) {
        let fidelity = this.getFidelityCustomer(customerId);
        
        // Se non è registrato, registralo automaticamente
        if (!fidelity) {
            fidelity = this.registerCustomer(customerId);
        }
        
        fidelity.stamps += stampsToAdd;
        fidelity.totalStamps += stampsToAdd;
        
        // Aggiungi alla cronologia
        fidelity.history.push({
            id: Utils.generateId(),
            type: 'stamps_added',
            stamps: stampsToAdd,
            orderId: orderId,
            date: new Date().toISOString()
        });
        
        // Controlla se ha raggiunto un premio
        const rewardsEarned = Math.floor(fidelity.stamps / CONFIG.FIDELITY.STAMPS_FOR_REWARD);
        if (rewardsEarned > 0) {
            fidelity.stamps -= (rewardsEarned * CONFIG.FIDELITY.STAMPS_FOR_REWARD);
            
            // Aggiungi premi
            for (let i = 0; i < rewardsEarned; i++) {
                this.addReward(customerId, CONFIG.FIDELITY.DEFAULT_REWARD);
            }
            
            Utils.showToast(`🎉 Premio sbloccato! (${rewardsEarned})`, "success");
        } else {
            Utils.showToast(`✅ +${stampsToAdd} bollini aggiunti!`, "success");
        }
        
        this.saveFidelity();
        return fidelity;
    },
    
    // Rimuovi bollini (raramente usato, ma utile per correzioni)
    removeStamps(customerId, stampsToRemove) {
        const fidelity = this.getFidelityCustomer(customerId);
        
        if (!fidelity) {
            Utils.showToast("Cliente non nel programma fidelity", "error");
            return null;
        }
        
        fidelity.stamps = Math.max(0, fidelity.stamps - stampsToRemove);
        
        fidelity.history.push({
            id: Utils.generateId(),
            type: 'stamps_removed',
            stamps: stampsToRemove,
            date: new Date().toISOString()
        });
        
        this.saveFidelity();
        Utils.showToast(`Rimossi ${stampsToRemove} bollini`, "info");
        return fidelity;
    },
    
    // ==========================================
    // GESTIONE PREMI
    // ==========================================
    
    // Aggiungi premio
    addReward(customerId, rewardDescription) {
        const fidelity = this.getFidelityCustomer(customerId);
        
        if (!fidelity) {
            Utils.showToast("Cliente non nel programma fidelity", "error");
            return null;
        }
        
        const reward = {
            id: Utils.generateId(),
            description: rewardDescription,
            earnedAt: new Date().toISOString(),
            redeemed: false,
            redeemedAt: null
        };
        
        fidelity.rewards.push(reward);
        
        fidelity.history.push({
            id: Utils.generateId(),
            type: 'reward_earned',
            rewardId: reward.id,
            description: rewardDescription,
            date: new Date().toISOString()
        });
        
        this.saveFidelity();
        return reward;
    },
    
    // Riscatta premio
    redeemReward(customerId, rewardId) {
        const fidelity = this.getFidelityCustomer(customerId);
        
        if (!fidelity) {
            Utils.showToast("Cliente non nel programma fidelity", "error");
            return false;
        }
        
        const reward = fidelity.rewards.find(r => r.id === rewardId);
        
        if (!reward) {
            Utils.showToast("Premio non trovato", "error");
            return false;
        }
        
        if (reward.redeemed) {
            Utils.showToast("Premio già riscattato", "warning");
            return false;
        }
        
        reward.redeemed = true;
        reward.redeemedAt = new Date().toISOString();
        
        fidelity.history.push({
            id: Utils.generateId(),
            type: 'reward_redeemed',
            rewardId: rewardId,
            description: reward.description,
            date: new Date().toISOString()
        });
        
        this.saveFidelity();
        Utils.showToast("✅ Premio riscattato!", "success");
        return true;
    },
    
    // Ottieni premi disponibili di un cliente
    getAvailableRewards(customerId) {
        const fidelity = this.getFidelityCustomer(customerId);
        if (!fidelity) return [];
        
        return fidelity.rewards.filter(r => !r.redeemed);
    },
    
    // Ottieni premi riscattati di un cliente
    getRedeemedRewards(customerId) {
        const fidelity = this.getFidelityCustomer(customerId);
        if (!fidelity) return [];
        
        return fidelity.rewards.filter(r => r.redeemed);
    },
    
    // ==========================================
    // STATISTICHE
    // ==========================================
    
    // Ottieni tutti i clienti con premi disponibili
    getCustomersWithAvailableRewards() {
        return this.fidelityCustomers.filter(f => 
            this.getAvailableRewards(f.customerId).length > 0
        );
    },
    
    // Ottieni top clienti per bollini
    getTopCustomersByStamps(limit = 10) {
        return [...this.fidelityCustomers]
            .sort((a, b) => b.totalStamps - a.totalStamps)
            .slice(0, limit);
    },
    
    // Ottieni statistiche generali fidelity
    getFidelityStats() {
        const totalCustomers = this.fidelityCustomers.length;
        const totalStamps = this.fidelityCustomers.reduce((sum, f) => sum + f.totalStamps, 0);
        
        const allRewards = this.fidelityCustomers.flatMap(f => f.rewards);
        const availableRewards = allRewards.filter(r => !r.redeemed).length;
        const redeemedRewards = allRewards.filter(r => r.redeemed).length;
        
        return {
            totalCustomers,
            totalStamps,
            availableRewards,
            redeemedRewards,
            customersWithRewards: this.getCustomersWithAvailableRewards().length
        };
    },
    
    // ==========================================
    // QR CODE
    // ==========================================
    
    // Genera dati QR per carta fidelity
    generateFidelityQR(customerId) {
        const fidelity = this.getFidelityCustomer(customerId);
        
        if (!fidelity) {
            return null;
        }
        
        return {
            type: 'fidelity',
            customerId: customerId,
            stamps: fidelity.stamps,
            totalStamps: fidelity.totalStamps
        };
    },
    
    // Processa scan QR fidelity
    processFidelityQRScan(qrData) {
        if (qrData.type !== 'fidelity') {
            Utils.showToast("QR code non valido", "error");
            return null;
        }
        
        const fidelity = this.getFidelityCustomer(qrData.customerId);
        
        if (!fidelity) {
            Utils.showToast("Cliente non trovato", "error");
            return null;
        }
        
        return {
            fidelity: fidelity,
            customer: CustomersModule ? 
                CustomersModule.getCustomerById(qrData.customerId) : null
        };
    },
    
    // ==========================================
    // UTILITY
    // ==========================================
    
    // Conta clienti fidelity totali
    getFidelityCustomersCount() {
        return this.fidelityCustomers.length;
    },
    
    // Verifica se un cliente è nel programma
    isCustomerInFidelity(customerId) {
        return this.getFidelityCustomer(customerId) !== undefined;
    },
    
    // Calcola progressione verso prossimo premio
    getProgressToNextReward(customerId) {
        const fidelity = this.getFidelityCustomer(customerId);
        if (!fidelity) return { current: 0, needed: CONFIG.FIDELITY.STAMPS_FOR_REWARD, percentage: 0 };
        
        return {
            current: fidelity.stamps,
            needed: CONFIG.FIDELITY.STAMPS_FOR_REWARD,
            percentage: (fidelity.stamps / CONFIG.FIDELITY.STAMPS_FOR_REWARD) * 100
        };
    }
};

// Rendi il modulo disponibile globalmente
window.FidelityModule = FidelityModule;

console.log("✅ Modulo Fidelity caricato");