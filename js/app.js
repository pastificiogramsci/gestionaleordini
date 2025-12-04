// ============================================
// 🎯 APP PRINCIPALE - COORDINATORE
// ============================================

const App = {

    initialized: false,
    currentTab: 'dashboard',

    // ==========================================
    // INIZIALIZZAZIONE
    // ==========================================

    async init() {
        console.log("🚀 Inizializzazione App...");

        try {
            // 1. PRIMA controlla callback Dropbox
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('code')) {
                console.log("🔵 Trovato code Dropbox, processo callback...");
                await Storage.checkDropboxCallback();
            }

            // 2. Controlla autenticazione
            if (!AuthManager.init()) {
                console.log("🔒 Autenticazione richiesta");
                return;
            }

            console.log("✅ Autenticato");
            this.hideAuthScreen();

            // 3. Inizializza Storage e Dropbox
            await Storage.initDropbox();

            // 4. Inizializza tutti i moduli
            await this.initModules();

            // 5. Sync iniziale con Dropbox (se connesso)
            if (Storage.dropboxClient) {
                console.log("🔄 Sincronizzazione iniziale...");
                await Storage.syncAllToDropbox(true); // true = silent (no toast)
            }

            // 6. Setup UI
            this.setupUI();

            // 7. Carica tab iniziale
            this.switchTab('dashboard');

            this.initialized = true;
            console.log("✅ App inizializzata con successo!");

            Utils.showToast("✅ App caricata!", "success");

        } catch (error) {
            console.error("❌ Errore inizializzazione:", error);
            Utils.showToast("Errore caricamento app", "error");
        }
    },

    // Inizializza tutti i moduli
    async initModules() {
        console.log("📦 Caricamento moduli...");

        // Ordine importante! Alcuni moduli dipendono da altri
        if (CustomersModule) await CustomersModule.init();
        if (ProductsModule) await ProductsModule.init();
        if (OrdersModule) await OrdersModule.init();
        if (FidelityModule) await FidelityModule.init();
        if (CouponsModule) await CouponsModule.init();
        if (QRModule) QRModule.init();

        console.log("✅ Tutti i moduli caricati");
    },

    handleLogin(event) {
        event.preventDefault();

        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('remember-me').checked;

        if (AuthManager.login(password, remember)) {
            this.hideAuthScreen();
            this.init();
        } else {
            document.getElementById('login-error').textContent = '❌ Password errata';
            document.getElementById('login-error').classList.remove('hidden');
        }
    },

    hideAuthScreen() {
        document.getElementById('auth-screen').style.display = 'none';
    },

    logout() {
        if (confirm('Sei sicuro di voler uscire?')) {
            AuthManager.logout();
        }
    },

    // ==========================================
    // GESTIONE TAB/PAGINE
    // ==========================================

    switchTab(tabName) {
        console.log("📑 Switch tab:", tabName);

        this.currentTab = tabName;

        // Nascondi tutti i tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        // Mostra il tab selezionato
        const selectedContent = document.getElementById(`${tabName}-content`);
        if (selectedContent) {
            selectedContent.classList.remove('hidden');
        }

        // Aggiorna stato bottoni tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });

        const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active', 'border-blue-500', 'text-blue-600');
            selectedBtn.classList.remove('border-transparent', 'text-gray-500');
        }

        // Carica contenuto del tab
        this.loadTabContent(tabName);

        // Nascondi floating buttons in alcune tab
        this.updateFloatingButtons(tabName);
    },

    loadTabContent(tabName) {
        switch (tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'orders':
                const orderDateFilter = document.getElementById('order-date-filter');
                if (orderDateFilter && !orderDateFilter.value) {
                    orderDateFilter.value = this.getTomorrowDate();
                }
                this.populateYearFilter();
                this.applyOrderFilters();
                break;
            case 'preparation':
                const prepDate = document.getElementById('prep-date');
                if (prepDate && !prepDate.value) {
                    prepDate.value = this.getTomorrowDate();
                }
                this.loadPreparation();
                break;
            case 'modifiche':
                const modDate = document.getElementById('mod-date-filter');
                if (modDate && !modDate.value) {
                    modDate.value = this.getTomorrowDate();
                }
                this.loadModifications();
                break;
            case 'customers':
                this.loadCustomers();
                break;
            case 'products':
                this.loadProducts();
                break;
            case 'fidelity':
                this.loadFidelity();
                break;
            case 'settings':
                this.loadSettings();
                break;
            case 'coupon':
                this.loadCoupons();
                break;
        }
    },

    getTomorrowDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    },

    // ==========================================
    // CARICAMENTO CONTENUTI TAB
    // ==========================================

    loadDashboard() {
        console.log("📊 Caricamento dashboard...");

        const stats = StatsModule.getDashboardStats();

        // Aggiorna cards statistiche
        this.updateStatsCards(stats);

        // Carica ordini recenti
        if (OrdersModule) {
            const recentOrders = OrdersModule.getAllOrders('recent').slice(0, 5);
            this.displayRecentOrders(recentOrders);
        }

        // Stats Fidelity
        const fidelityStats = FidelityModule.getFidelityStats();
        // Aggiungi card o aggiorna esistente se serve
    },

    updateStatsCards(stats) {
        // Ordini
        if (stats.orders) {
            this.updateElement('stat-orders', stats.orders.total);
            this.updateElement('stat-active-orders', stats.orders.active);
            this.updateElement('stat-today-orders', stats.orders.todayOrders);

            // Stati ordini con percentuali
            const total = stats.orders.total || 1; // evita divisione per 0
            this.updateElement('stat-pending-orders', stats.orders.byStatus?.pending || 0);
            this.updateElement('stat-pending-percent', `(${((stats.orders.byStatus?.pending || 0) / total * 100).toFixed(0)}%)`);

            this.updateElement('stat-preparation-orders', stats.orders.byStatus?.in_preparation || 0);
            this.updateElement('stat-preparation-percent', `(${((stats.orders.byStatus?.in_preparation || 0) / total * 100).toFixed(0)}%)`);

            this.updateElement('stat-ready-orders', stats.orders.byStatus?.ready || 0);
            this.updateElement('stat-ready-percent', `(${((stats.orders.byStatus?.ready || 0) / total * 100).toFixed(0)}%)`);

            this.updateElement('stat-delivered-orders', stats.orders.byStatus?.delivered || 0);
            this.updateElement('stat-delivered-percent', `(${((stats.orders.byStatus?.delivered || 0) / total * 100).toFixed(0)}%)`);

            this.updateElement('stat-to-prepare', stats.orders.byStatus?.pending || 0);
        }

        // Clienti
        if (stats.customers) {
            this.updateElement('stat-customers', stats.customers.total);
        }

        // Prodotti
        if (stats.products) {
            this.updateElement('stat-active-products', stats.products.active);
        }

        // Fatturato
        if (stats.revenue) {
            this.updateElement('stat-revenue', Utils.formatPrice(stats.revenue.total));
            this.updateElement('stat-today-revenue', Utils.formatPrice(stats.revenue.today));
        }

        // Fidelity
        if (stats.fidelity) {
            this.updateElement('stat-fidelity-customers', stats.fidelity.totalCustomers);
            this.updateElement('stat-available-rewards', stats.fidelity.availableRewards);
        }

        // Coupon
        if (stats.coupons) {
            this.updateElement('stat-active-coupons', stats.coupons.activeCoupons);
        }

        // Top clienti
        this.updateTopCustomers();
    },

    updateTopCustomers() {
        const customers = CustomersModule.getAllCustomers()
            .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
            .slice(0, 5);

        const container = document.getElementById('top-customers-list');
        if (!container) return;

        if (customers.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-4">Nessun ordine ancora</p>';
            return;
        }

        container.innerHTML = customers.map((c, i) => `
        <div class="flex items-center justify-between py-3 border-b last:border-b-0">
            <div class="flex items-center gap-3">
                <span class="text-2xl font-bold text-gray-300">${i + 1}</span>
                <div>
                    <p class="font-bold">${c.firstName} ${c.lastName}</p>
                    <p class="text-sm text-gray-600">${c.totalOrders || 0} ordini</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-bold text-green-600">${Utils.formatPrice(c.totalSpent || 0)}</p>
            </div>
        </div>
    `).join('');
    },

    displayRecentOrders(orders) {
        const container = document.getElementById('recent-orders-list');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Nessun ordine recente</p>';
            return;
        }

        container.innerHTML = orders.map(order => {
            const customer = CustomersModule ?
                CustomersModule.getCustomerById(order.customerId) : null;

            const customerName = customer ?
                `${customer.firstName} ${customer.lastName}` :
                'Cliente sconosciuto';

            return `
                <div class="border-b pb-3 mb-3 last:border-b-0" onclick="app.viewOrderDetails('${order.id}')">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-semibold">${customerName}</p>
                            <p class="text-sm text-gray-600">${order.items.length} prodotti</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-blue-600">${Utils.formatPrice(order.totalAmount)}</p>
                            <p class="text-xs text-gray-500">${Utils.formatDate(order.createdAt)}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    loadOrders() {
        this.displayOrders(OrdersModule.getAllOrders('recent'));
        this.populateYearFilter();
    },

    loadFidelity() {
        const fidelityList = FidelityModule.getAllFidelityCustomers();
        this.displayFidelityCustomers(fidelityList);
    },

    displayFidelityCustomers(fidelityList) {
        const container = document.getElementById('fidelity-customers-list');
        if (!container) return;

        if (fidelityList.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessun cliente fidelity</p>';
            return;
        }

        container.innerHTML = fidelityList.map(f => {
            const customer = CustomersModule.getCustomerById(f.customerId);
            if (!customer) return '';

            const progress = FidelityModule.getProgressToNextReward(f.customerId);
            const available = FidelityModule.getAvailableRewards(f.customerId).length;
            const redeemed = FidelityModule.getRedeemedRewards(f.customerId).length;

            return `
            <div class="bg-white rounded-lg shadow-lg p-4">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="text-lg font-bold">${customer.firstName} ${customer.lastName}</h3>
                        <p class="text-sm text-gray-600">${customer.phone || ''}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-bold text-purple-600">${f.stamps} ⭐</span>
                        ${available > 0 ? `<span class="ml-2 bg-green-500 text-white px-2 py-1 rounded-full text-sm font-bold">${available} 🎁</span>` : ''}
                    </div>
                </div>
                
                <div class="mb-3">
                    <p class="text-xs text-gray-600 mb-1">Prossimo premio: ${progress.current}/${progress.needed} bollini</p>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-purple-600 h-2 rounded-full" style="width: ${progress.percentage}%"></div>
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div class="bg-green-50 p-2 rounded text-center cursor-pointer" onclick="app.showAvailableRewards('${f.customerId}')">
                        <p class="font-bold text-green-600">${available}</p>
                        <p class="text-gray-600">Premi disponibili</p>
                    </div>
                    <div class="bg-gray-50 p-2 rounded text-center">
                        <p class="font-bold">${redeemed}</p>
                        <p class="text-gray-600">Premi riscattati</p>
                    </div>
                    <div class="bg-blue-50 p-2 rounded text-center">
                        <p class="font-bold text-blue-600">${customer.coupons?.filter(c => !c.used).length || 0}</p>
                        <p class="text-gray-600">Coupon attivi</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-2">
                    <button onclick="app.openFidelityDetail('${f.customerId}')" class="bg-purple-600 text-white py-2 rounded text-sm font-medium">Aggiungi Bollini</button>
                    <button onclick="app.generateFidelityCard('${f.customerId}')" class="bg-blue-600 text-white py-2 rounded text-sm font-medium">📱 Tessera</button>
                    <button onclick="app.deleteFidelityCustomer('${f.customerId}')" class="bg-red-600 text-white py-2 rounded text-sm font-medium">🗑️ Elimina</button>
                </div>
            </div>
        `;
        }).join('');
    },

    openFidelityDetail(customerId) {
        this.currentFidelityCustomer = customerId;
        const customer = CustomersModule.getCustomerById(customerId);
        const fidelity = FidelityModule.getFidelityCustomer(customerId);

        if (!customer || !fidelity) return;

        document.getElementById('fidelity-customer-name').textContent = `${customer.firstName} ${customer.lastName}`;
        document.getElementById('fidelity-customer-phone').textContent = customer.phone || '';
        document.getElementById('fidelity-detail-stamps').textContent = fidelity.totalStamps;

        const available = FidelityModule.getAvailableRewards(customerId);
        const redeemed = FidelityModule.getRedeemedRewards(customerId);

        document.getElementById('fidelity-detail-available').textContent = available.length;
        document.getElementById('fidelity-detail-redeemed').textContent = redeemed.length;

        const progress = FidelityModule.getProgressToNextReward(customerId);
        document.getElementById('fidelity-detail-progress').textContent = `${progress.current}/${progress.needed}`;
        document.getElementById('fidelity-detail-bar').style.width = `${progress.percentage}%`;
        document.getElementById('fidelity-detail-missing').textContent = `Mancano ${progress.needed - progress.current} bollini al prossimo premio`;

        // Coupon attivi
        const coupons = customer.coupons?.filter(c => !c.used) || [];
        const couponsHtml = coupons.length > 0 ? `
        <div class="bg-pink-50 border border-pink-200 rounded p-3">
            <h4 class="font-bold mb-2">🎫 Coupon Attivi (${coupons.length})</h4>
            ${coupons.map(c => `<p class="text-sm">• ${c.campaignName}</p>`).join('')}
        </div>
    ` : '';

        document.getElementById('fidelity-detail-coupons').innerHTML = couponsHtml;

        this.openModal('fidelity-detail-modal');
    },

    quickAddStamps(qty) {
        FidelityModule.addStamps(this.currentFidelityCustomer, qty);
        this.openFidelityDetail(this.currentFidelityCustomer);
        this.loadFidelity();
    },

    openCustomStamps() {
        document.getElementById('custom-stamps-input').value = '';
        this.openModal('custom-stamps-modal');
    },

    saveCustomStamps() {
        const qty = parseInt(document.getElementById('custom-stamps-input').value);
        if (!qty || qty < 1) {
            Utils.showToast("Inserisci un numero valido", "error");
            return;
        }
        FidelityModule.addStamps(this.currentFidelityCustomer, qty);
        this.closeModal('custom-stamps-modal');
        this.openFidelityDetail(this.currentFidelityCustomer);
        this.loadFidelity();
    },

    showHistory() {
        const history = document.getElementById('fidelity-detail-history');
        history.classList.toggle('hidden');

        if (!history.classList.contains('hidden')) {
            const fidelity = FidelityModule.getFidelityCustomer(this.currentFidelityCustomer);
            const historyHtml = fidelity.history.map(h => `
            <div class="border-b py-2">
                <p class="text-sm font-medium">${h.type === 'earned' ? '+ ' + h.stamps + ' bollini' : h.type}</p>
                <p class="text-xs text-gray-500">${Utils.formatDateTime(h.date)}</p>
            </div>
        `).join('');
            document.getElementById('fidelity-history-list').innerHTML = historyHtml || '<p class="text-sm text-gray-500">Nessuna cronologia</p>';
        }
    },

    showAllFidelityCustomers() {
        if (confirm("ATTENZIONE: Vuoi davvero azzerare tutti i dati fidelity?")) {
            FidelityModule.fidelityCustomers = [];
            FidelityModule.saveFidelity();
            this.loadFidelity();
        }
    },

    deleteFidelityCustomer(customerId) {
        if (confirm("Eliminare questo cliente dal programma fidelity?")) {
            const idx = FidelityModule.fidelityCustomers.findIndex(f => f.customerId === customerId);
            if (idx > -1) {
                FidelityModule.fidelityCustomers.splice(idx, 1);
                FidelityModule.saveFidelity();
                this.loadFidelity();
            }
        }
    },

    loadCoupons() {
        const campaigns = CouponsModule.getAllCampaigns();
        this.displayCampaigns(campaigns);
    },

    displayCampaigns(campaigns) {
        const container = document.getElementById('campaigns-list');
        if (!container) return;

        if (campaigns.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessuna campagna attiva</p>';
            return;
        }

        container.innerHTML = campaigns.map(c => {
            if (!c || !c.id) return '';
            const eligible = this.getEligibleCustomers(c); const assigned = eligible.filter(cust => {
                const customer = CustomersModule.getCustomerById(cust.customerId);
                return customer?.coupons?.some(cp => cp.campaignId === c.id);
            }).length;

            return `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <div class="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-4">
                    <h3 class="text-xl font-bold">${c.name}</h3>
                    <p class="text-sm">${c.description}</p>
                </div>
                
                <div class="p-4">
                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div class="bg-gray-50 p-3 rounded">
                            <p class="text-xs text-gray-600">Clienti idonei</p>
                            <p class="text-2xl font-bold">${eligible.length}</p>
                        </div>
                        <div class="bg-green-50 p-3 rounded">
                            <p class="text-xs text-gray-600">Coupon assegnati</p>
                            <p class="text-2xl font-bold text-green-600">${assigned}</p>
                        </div>
                    </div>
                    
                    <p class="text-sm text-gray-600 mb-2">📅 ${this.formatCampaignDates(c)}</p>
                    <p class="text-sm text-gray-600 mb-3">⏰ Scade: ${Utils.formatDate(c.expiryDate)}</p>
                    
                    <div class="flex gap-2">
                        <button onclick="app.assignCoupons('${c.id}')" class="flex-1 bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700">
                            Assegna Coupon
                        </button>
                        <button onclick="app.viewCampaignDetails('${c.id}')" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            Dettagli
                        </button>
                        <button onclick="app.deleteCampaign('${c.id}')" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    },

    getEligibleCustomers(campaign) {
        if (!campaign || !campaign.dateType) {
            console.warn('Campagna senza dateType:', campaign);
            return [];
        }

        let orders = [];

        if (campaign.dateType === 'single' || campaign.dateType === 'multiple') {
            orders = OrdersModule.getAllOrders('recent').filter(o =>
                campaign.dates && campaign.dates.includes(o.deliveryDate)
            );
        } else if (campaign.dateType === 'range') {
            orders = OrdersModule.getAllOrders('recent').filter(o =>
                o.deliveryDate >= campaign.dateFrom && o.deliveryDate <= campaign.dateTo
            );
        }

        const customerIds = [...new Set(orders.map(o => o.customerId))];
        return customerIds.map(id => ({ customerId: id }));
    },

    openNewCampaignModal() {
        document.getElementById('campaign-name').value = '';
        document.getElementById('campaign-description').value = '';
        document.getElementById('campaign-date-from').value = '';
        document.getElementById('campaign-date-to').value = '';
        document.getElementById('campaign-expiry').value = '';
        this.openModal('new-campaign-modal');
    },

    toggleCampaignDateInputs() {
        const type = document.getElementById('campaign-date-type').value;

        document.getElementById('date-single-input').classList.add('hidden');
        document.getElementById('date-multiple-input').classList.add('hidden');
        document.getElementById('date-range-input').classList.add('hidden');

        if (type === 'single') {
            document.getElementById('date-single-input').classList.remove('hidden');
        } else if (type === 'multiple') {
            document.getElementById('date-multiple-input').classList.remove('hidden');
        } else if (type === 'range') {
            document.getElementById('date-range-input').classList.remove('hidden');
        }
    },

    saveCampaign() {
        const name = document.getElementById('campaign-name').value;
        const description = document.getElementById('campaign-description').value;
        const dateType = document.getElementById('campaign-date-type').value;
        const expiryDate = document.getElementById('campaign-expiry').value;

        if (!name || !description || !expiryDate) {
            Utils.showToast("Compila tutti i campi obbligatori", "error");
            return;
        }

        let campaignData = {
            name,
            description,
            dateType,
            expiryDate
        };

        // Gestisci date in base al tipo
        if (dateType === 'single') {
            const date = document.getElementById('campaign-date-single').value;
            if (!date) {
                Utils.showToast("Seleziona una data", "error");
                return;
            }
            campaignData.dates = [date];
        } else if (dateType === 'multiple') {
            const datesStr = document.getElementById('campaign-dates-multiple').value;
            if (!datesStr) {
                Utils.showToast("Inserisci almeno una data", "error");
                return;
            }
            campaignData.dates = datesStr.split(',').map(d => d.trim()).filter(d => d);
        } else if (dateType === 'range') {
            const dateFrom = document.getElementById('campaign-date-from').value;
            const dateTo = document.getElementById('campaign-date-to').value;
            if (!dateFrom || !dateTo) {
                Utils.showToast("Seleziona entrambe le date", "error");
                return;
            }
            campaignData.dateFrom = dateFrom;
            campaignData.dateTo = dateTo;
        }

        CouponsModule.createCampaign(campaignData);
        this.closeModal('new-campaign-modal');
        this.loadCoupons();
    },

    assignCoupons(campaignId) {
        const campaign = CouponsModule.getCampaignById(campaignId);
        if (!campaign) return;

        const eligible = this.getEligibleCustomers(campaign);

        if (eligible.length === 0) {
            Utils.showToast("Nessun cliente idoneo", "info");
            return;
        }

        if (confirm(`Assegnare coupon a ${eligible.length} clienti?`)) {
            let assigned = 0;
            eligible.forEach(e => {
                const customer = CustomersModule.getCustomerById(e.customerId);
                if (!customer) return;

                // Controlla se ha già questo coupon
                if (customer.coupons?.some(c => c.campaignId === campaignId)) return;

                CouponsModule.assignCoupon(e.customerId, campaignId);
                assigned++;
            });

            Utils.showToast(`✅ ${assigned} coupon assegnati!`, "success");
            this.loadCoupons();
        }
    },

    viewCampaignDetails(campaignId) {
        const campaign = CouponsModule.getCampaignById(campaignId);
        if (!campaign) {
            Utils.showToast("Campagna non trovata", "error");
            return;
        }

        const eligible = this.getEligibleCustomers(campaign);

        const html = `
        <div class="space-y-3">
            <h3 class="font-bold text-lg">${campaign.name}</h3>
            <p class="text-sm text-gray-600">${campaign.description}</p>
            
            <div class="bg-gray-50 p-3 rounded">
                <h4 class="font-bold mb-2">Clienti idonei (${eligible.length})</h4>
                ${eligible.map(e => {
            const customer = CustomersModule.getCustomerById(e.customerId);
            const hasCoupon = customer?.coupons?.some(c => c.campaignId === campaignId);
            return `
                        <div class="flex justify-between items-center py-1 border-b">
                            <span class="text-sm">${customer?.firstName} ${customer?.lastName}</span>
                            ${hasCoupon ? '<span class="text-green-600 text-xs">✓ Assegnato</span>' : '<span class="text-gray-400 text-xs">Non assegnato</span>'}
                        </div>
                    `;
        }).join('')}
            </div>
        </div>
    `;

        const div = document.createElement('div');
        div.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="this.remove()">
            <div class="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto" onclick="event.stopPropagation()">
                ${html}
                <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-4 bg-gray-200 px-4 py-2 rounded">Chiudi</button>
            </div>
        </div>
    `;
        document.body.appendChild(div);
    },

    deleteCampaign(campaignId) {
        if (confirm("Eliminare questa campagna? I coupon già assegnati rimarranno validi.")) {
            CouponsModule.deleteCampaign(campaignId);
            this.loadCoupons();
        }
    },

    formatCampaignDates(campaign) {
        if (campaign.dateType === 'single') {
            return `Ritiro: ${Utils.formatDate(campaign.dates[0])}`;
        } else if (campaign.dateType === 'multiple') {
            return `Ritiri: ${campaign.dates.map(d => Utils.formatDate(d)).join(', ')}`;
        } else {
            return `Ritiri dal ${Utils.formatDate(campaign.dateFrom)} al ${Utils.formatDate(campaign.dateTo)}`;
        }
    },

    showAvailableRewards(customerId) {
        const rewards = FidelityModule.getAvailableRewards(customerId);
        if (rewards.length === 0) {
            Utils.showToast("Nessun premio disponibile", "info");
            return;
        }

        const customer = CustomersModule.getCustomerById(customerId);
        const html = `
        <div class="space-y-2">
            <h3 class="font-bold">Premi disponibili per ${customer.firstName} ${customer.lastName}</h3>
            ${rewards.map(r => `
                <div class="flex justify-between items-center bg-green-50 p-3 rounded">
                    <span>${r.description}</span>
                    <button onclick="app.redeemRewardConfirm('${customerId}', '${r.id}')" class="bg-green-600 text-white px-3 py-1 rounded">Riscuoti</button>
                </div>
            `).join('')}
        </div>
    `;

        // Mostra in un alert temporaneo (o puoi fare un modal dedicato)
        const div = document.createElement('div');
        div.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="this.remove()">
            <div class="bg-white rounded-lg p-6 max-w-md" onclick="event.stopPropagation()">
                ${html}
                <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-4 bg-gray-200 px-4 py-2 rounded">Chiudi</button>
            </div>
        </div>
    `;
        document.body.appendChild(div);
    },

    redeemRewardConfirm(customerId, rewardId) {
        if (confirm("Confermi il riscatto del premio?")) {
            FidelityModule.redeemReward(customerId, rewardId);
            document.querySelector('.fixed.inset-0').remove();
            this.loadFidelity();
            Utils.showToast("✅ Premio riscattato!", "success");
        }
    },

    generateFidelityCard(customerId) {
        QRModule.generateFidelityQR(customerId, (blob) => {
            if (!blob) {
                Utils.showToast("Errore generazione tessera", "error");
                return;
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tessera-fidelity-${customerId}.png`;
            a.click();
            URL.revokeObjectURL(url);

            Utils.showToast("✅ Tessera scaricata!", "success");
        });
    },

    loadPreparation() {
        const date = document.getElementById('prep-date').value;
        if (!date) {
            Utils.showToast("Seleziona una data", "warning");
            return;
        }

        const orders = OrdersModule.getOrdersByDeliveryDate(date).filter(o =>
            o.status !== 'delivered' && o.status !== 'cancelled'
        );

        if (orders.length === 0) {
            document.getElementById('preparation-list').innerHTML =
                '<p class="text-center text-gray-500 py-8">📦 Nessun ordine da preparare per questa data</p>';
            return;
        }

        const byProduct = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const product = ProductsModule.getProductById(item.productId);
                if (!product) return;

                if (!byProduct[item.productId]) {
                    byProduct[item.productId] = {
                        productId: item.productId,
                        productName: product.name,
                        totalQty: 0,
                        orders: []
                    };
                }

                byProduct[item.productId].totalQty += item.quantity;
                byProduct[item.productId].orders.push({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    customerId: order.customerId,
                    customerName: CustomersModule.getFullName(order.customerId),
                    quantity: item.quantity
                });
            });
        });

        this.displayPreparation(Object.values(byProduct));
    },

    displayPreparation(products) {
        const container = document.getElementById('preparation-list');
        const today = new Date().toISOString().split('T')[0];

        // Filtra prodotti con ordini preparabili (data non passata)
        const preparableProducts = products.filter(p => {
            return p.orders.some(o => {
                const order = OrdersModule.getOrderById(o.orderId);
                return order && order.deliveryDate >= today;
            });
        }).map(p => {
            // Filtra solo ordini con data non passata
            return {
                ...p,
                orders: p.orders.filter(o => {
                    const order = OrdersModule.getOrderById(o.orderId);
                    return order && order.deliveryDate >= today;
                })
            };
        });

        if (preparableProducts.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessun ordine da preparare per questa data</p>';
            return;
        }

        container.innerHTML = products.map((p, idx) => {
            const date = document.getElementById('prep-date').value;
            const allPrepared = p.orders.every(o => {
                const order = OrdersModule.getOrderById(o.orderId);
                const item = order.items.find(i => i.productId === p.productId);
                return item?.prepared;
            });

            return `
            <div class="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg overflow-hidden ${allPrepared ? 'opacity-50' : ''}">
                <div class="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 flex justify-between items-center cursor-pointer" onclick="document.getElementById('prep-${idx}').classList.toggle('hidden')">
                    <div>
                        <h3 class="text-xl font-bold">🍝 ${p.productName}</h3>
                        <p class="text-sm">${p.orders.length} ordini - Totale: ${p.totalQty.toFixed(2)}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-sm">${p.orders.filter(o => {
                const order = OrdersModule.getOrderById(o.orderId);
                const item = order.items.find(i => i.productId === p.productId);
                return item?.prepared;
            }).length}/${p.orders.length} preparati</span>
                        <span class="text-2xl">▼</span>
                    </div>
                </div>
                
                <div id="prep-${idx}" class="p-4 hidden">
                    <button onclick="app.markAllProduct('${p.productId}')" class="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 mb-3 font-bold">
                        ✓ Segna tutti
                    </button>
                    
                    <table class="w-full text-sm">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="px-3 py-2 text-left">Ordine</th>
                                <th class="px-3 py-2 text-left">Cliente</th>
                                <th class="px-3 py-2 text-right">Quantità</th>
                                <th class="px-3 py-2 text-center">Stato</th>
                                <th class="px-3 py-2 text-center">Azione</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${p.orders.map(o => {
                const order = OrdersModule.getOrderById(o.orderId);
                const itemIdx = order.items.findIndex(i => i.productId === p.productId);
                const item = order.items[itemIdx];
                const isPrepared = item?.prepared;

                return `
                                    <tr class="border-b ${isPrepared ? 'bg-green-50' : ''}">
                                        <td class="px-3 py-2"><span class="bg-blue-600 text-white px-2 py-1 rounded text-xs">${o.orderNumber}</span></td>
                                        <td class="px-3 py-2">${o.customerName}</td>
                                        <td class="px-3 py-2 text-right font-bold">${o.quantity.toFixed(2)}</td>
                                        <td class="px-3 py-2 text-center">${isPrepared ? '<span class="text-green-600 font-bold">✓</span>' : '-'}</td>
                                        <td class="px-3 py-2 text-center">
                                            ${!isPrepared ? `
                                                <button onclick="app.markItemPrepared('${o.orderId}', ${itemIdx})" class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Fatto</button>
                                            ` : '<span class="text-green-600 text-xs">Completato</span>'}
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        }).join('');
    },

    markItemPrepared(orderId, itemIndex) {
        const order = OrdersModule.getOrderById(orderId);
        if (!order) return;

        // Blocca se data passata
        const today = new Date().toISOString().split('T')[0];
        if (order.deliveryDate && order.deliveryDate < today) {
            Utils.showToast("⛔ Non puoi preparare ordini con data passata", "error");
            return;
        }

        OrdersModule.markItemPrepared(orderId, itemIndex);
        this.loadPreparation();
    },

    markAllProduct(productId) {
        const date = document.getElementById('prep-date').value;

        // Blocca se data passata
        const today = new Date().toISOString().split('T')[0];
        if (date && date < today) {
            Utils.showToast("⛔ Non puoi preparare ordini con data passata", "error");
            return;
        }

        const marked = OrdersModule.markAllItemsOfProductPrepared(productId, date);
        Utils.showToast(`✅ ${marked} item preparati`, "success");
        this.loadPreparation();
    },

    applyPrepFilters() {
        const monthFilter = document.getElementById('prep-month-filter').value;
        const yearFilter = document.getElementById('prep-year-filter').value;

        if (monthFilter) {
            document.getElementById('prep-date').value = '';
            // Carica tutti ordini del mese
            const orders = OrdersModule.getAllOrders('recent').filter(o =>
                o.deliveryDate && o.deliveryDate.startsWith(monthFilter) &&
                o.status !== 'delivered' && o.status !== 'cancelled'
            );
            this.displayPreparationMultiDate(orders);
        } else if (yearFilter) {
            document.getElementById('prep-date').value = '';
            const orders = OrdersModule.getAllOrders('recent').filter(o =>
                o.deliveryDate && o.deliveryDate.startsWith(yearFilter) &&
                o.status !== 'delivered' && o.status !== 'cancelled'
            );
            this.displayPreparationMultiDate(orders);
        }
    },

    clearPrepFilters() {
        document.getElementById('prep-date').value = '';
        document.getElementById('prep-month-filter').value = '';
        document.getElementById('prep-year-filter').value = '';
        document.getElementById('prep-date').value = this.getTomorrowDate();
        this.loadPreparation();
    },

    displayPreparationMultiDate(orders) {
        // Raggruppa per prodotto (come loadPreparation)
        const byProduct = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const product = ProductsModule.getProductById(item.productId);
                if (!product) return;

                if (!byProduct[item.productId]) {
                    byProduct[item.productId] = {
                        productId: item.productId,
                        productName: product.name,
                        totalQty: 0,
                        orders: []
                    };
                }

                byProduct[item.productId].totalQty += item.quantity;
                byProduct[item.productId].orders.push({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    customerId: order.customerId,
                    customerName: CustomersModule.getFullName(order.customerId),
                    quantity: item.quantity
                });
            });
        });

        this.displayPreparation(Object.values(byProduct));
    },

    applyModFilters() {
        const monthFilter = document.getElementById('mod-month-filter').value;
        const yearFilter = document.getElementById('mod-year-filter').value;

        let orders = OrdersModule.orders.filter(o => o.modifications);

        if (monthFilter) {
            document.getElementById('mod-date-filter').value = '';
            orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(monthFilter));
        } else if (yearFilter) {
            document.getElementById('mod-date-filter').value = '';
            orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(yearFilter));
        }

        this.displayModifications(orders);
    },

    clearModFilters() {
        document.getElementById('mod-date-filter').value = '';
        document.getElementById('mod-month-filter').value = '';
        document.getElementById('mod-year-filter').value = '';
        document.getElementById('mod-date-filter').value = this.getTomorrowDate();
        this.loadModifications();
    },

    loadModifications() {
        const date = document.getElementById('mod-date-filter').value;
        const orders = OrdersModule.getOrdersWithModifications(date || null);
        this.displayModifications(orders);
    },

    displayModifications(orders) {
        const container = document.getElementById('modifications-list');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessuna modifica da effettuare</p>';
            return;
        }

        container.innerHTML = orders.map(o => {
            const customer = CustomersModule.getCustomerById(o.customerId);
            const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'N/A';

            const toAddCount = o.modifications.toAdd.filter(m => !m.completed).length;
            const toRemoveCount = o.modifications.toRemove.filter(m => !m.completed).length;

            return `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <div class="bg-orange-500 text-white p-4 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-lg">Ordine #${o.orderNumber || o.id.slice(-6)}</h3>
                        <p class="text-sm">${customerName}</p>
                    </div>
                    <span class="bg-white text-orange-600 px-3 py-1 rounded-full font-bold">${toAddCount + toRemoveCount} modifiche</span>
                </div>
                
                <div class="p-4">
                    ${o.modifications.toAdd.length > 0 ? `
                        <div class="mb-4">
                            <div class="bg-orange-100 border-l-4 border-orange-500 p-3 mb-2">
                                <h4 class="font-bold text-orange-700">➕ DA AGGIUNGERE</h4>
                            </div>
                            ${o.modifications.toAdd.map((item, idx) => {
                const product = ProductsModule.getProductById(item.productId);
                return `
                                    <div class="flex justify-between items-center p-2 border-b ${item.completed ? 'opacity-50 line-through' : ''}">
                                        <span>${product?.name || 'N/A'} - ${item.quantity} kg</span>
                                        ${!item.completed ? `
                                            <button onclick="app.completeModification('${o.id}', 'add', ${idx})" class="bg-orange-600 text-white px-3 py-1 rounded text-sm">✓ Aggiunto</button>
                                        ` : '<span class="text-green-600">✓</span>'}
                                    </div>
                                `;
            }).join('')}
                        </div>
                    ` : ''}
                    
                    ${o.modifications.toRemove.length > 0 ? `
                        <div>
                            <div class="bg-red-100 border-l-4 border-red-500 p-3 mb-2">
                                <h4 class="font-bold text-red-700">➖ DA RIMUOVERE</h4>
                            </div>
                            ${o.modifications.toRemove.map((item, idx) => {
                const product = ProductsModule.getProductById(item.productId);
                return `
                                    <div class="flex justify-between items-center p-2 border-b ${item.completed ? 'opacity-50 line-through' : ''}">
                                        <span>${product?.name || 'N/A'} - ${item.quantity} kg</span>
                                        ${!item.completed ? `
                                            <button onclick="app.completeModification('${o.id}', 'remove', ${idx})" class="bg-red-600 text-white px-3 py-1 rounded text-sm">✓ Rimosso</button>
                                        ` : '<span class="text-green-600">✓</span>'}
                                    </div>
                                `;
            }).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        }).join('');
    },

    completeModification(orderId, type, index) {
        const order = OrdersModule.getOrderById(orderId);

        // Marca item come preparato quando completi modifica
        if (type === 'add' && order.modifications) {
            const modItem = order.modifications.toAdd[index];
            const orderItem = order.items.find(i => i.productId === modItem.productId);
            if (orderItem) {
                orderItem.prepared = true;
            }
        }

        OrdersModule.markModificationComplete(orderId, type, index);
        this.loadModifications();
        this.loadOrders();
    },

    displayOrders(orders) {
        const container = document.getElementById('orders-list');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Nessun ordine</p>';
            return;
        }

        const statusColors = {
            pending: "bg-yellow-100 text-yellow-800",
            confirmed: "bg-blue-100 text-blue-800",
            in_preparation: "bg-purple-100 text-purple-800",  // ← NUOVO
            ready: "bg-green-100 text-green-800",
            delivered: "bg-gray-100 text-gray-800",
            cancelled: "bg-red-100 text-red-800"
        };

        const statusNames = {
            pending: "In attesa",
            confirmed: "Confermato",
            in_preparation: "In preparazione",  // ← NUOVO
            ready: "Pronto",
            delivered: "Consegnato",
            cancelled: "Annullato"
        };

        container.innerHTML = orders.map(o => {
            const customer = CustomersModule.getCustomerById(o.customerId);
            const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'Cliente sconosciuto';

            return `
                <div class="bg-white p-4 rounded-lg shadow cursor-pointer" onclick="app.viewOrderDetails('${o.id}')">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="font-bold text-lg">
                                #${o.orderNumber || 'N/A'} - ${customerName}
                                ${o.modifications ? '<span class="ml-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs">⚠️ Da modificare</span>' : ''}
                                ${o.deliveryDate && o.deliveryDate < new Date().toISOString().split('T')[0] && o.status !== 'delivered' ? '<span class="ml-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs">📅 Data passata</span>' : ''}
                            </h3>
                            <p class="text-sm text-gray-600">${o.items.length} prodotti</p>
                            ${o.deliveryDate ? `<p class="text-sm text-gray-600">📅 Consegna: ${Utils.formatDate(o.deliveryDate)} ${o.deliveryTime || ''}</p>` : ''}
                            <p class="text-xs text-gray-500">Creato: ${Utils.formatDateTime(o.createdAt)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-bold text-blue-600">${Utils.formatPrice(o.totalAmount)}</p>
                            <span class="text-xs px-2 py-1 rounded ${statusColors[o.status]}">${statusNames[o.status]}</span>
                        </div>
                    </div>
                
                <div class="flex gap-2 mt-3">
                    ${o.status === 'pending' ? `<button onclick="OrdersModule.changeOrderStatus('${o.id}', 'in_preparation'); app.loadOrders()" class="text-xs px-3 py-1 bg-blue-600 text-white rounded">Conferma</button>` : ''}
                    ${o.status === 'ready' ? `<button onclick="OrdersModule.changeOrderStatus('${o.id}', 'delivered'); app.loadOrders()" class="text-xs px-3 py-1 bg-gray-600 text-white rounded">Consegnato</button>` : ''}
                    ${o.status === 'delivered' ? `<button onclick="app.undoDelivery('${o.id}')" class="text-xs px-3 py-1 bg-orange-600 text-white rounded">↩️ Annulla consegna</button>` : ''}
                    ${o.status !== 'delivered' ? `<button onclick="app.editOrder('${o.id}')" class="text-xs px-3 py-1 bg-gray-200 rounded">✏️ Modifica</button>` : ''}
                    <button onclick="app.deleteOrder('${o.id}')" class="text-red-600 text-sm ml-auto">🗑️</button>
                </div>
            </div>
        `;
        }).join('');
    },

    filterOrders(status) {
        this.currentOrderFilter = status;
        if (status === 'all') {
            this.applyOrderFilters();
        } else {
            let orders = OrdersModule.getAllOrders('recent').filter(o => o.status === status);

            // Applica anche filtri data se attivi
            const dateFilter = document.getElementById('order-date-filter').value;
            const monthFilter = document.getElementById('order-month-filter').value;
            const yearFilter = document.getElementById('order-year-filter').value;

            if (dateFilter) {
                orders = orders.filter(o => o.deliveryDate === dateFilter);
            } else if (monthFilter) {
                orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(monthFilter));
            } else if (yearFilter) {
                orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(yearFilter));
            }

            this.displayOrders(orders);
        }
    },

    applyOrderFilters() {
        const dateFilter = document.getElementById('order-date-filter').value;
        const monthFilter = document.getElementById('order-month-filter').value;
        const yearFilter = document.getElementById('order-year-filter').value;

        let orders = OrdersModule.getAllOrders('recent');

        // Filtra per data specifica
        if (dateFilter) {
            orders = orders.filter(o => o.deliveryDate === dateFilter);
        }
        // Filtra per mese (formato YYYY-MM)
        else if (monthFilter) {
            orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(monthFilter));
        }
        // Filtra per anno
        else if (yearFilter) {
            orders = orders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(yearFilter));
        }

        // Applica anche filtro stato se attivo
        if (this.currentOrderFilter && this.currentOrderFilter !== 'all') {
            orders = orders.filter(o => o.status === this.currentOrderFilter);
        }

        this.displayOrders(orders);
    },

    clearOrderFilters() {
        document.getElementById('order-date-filter').value = '';
        document.getElementById('order-month-filter').value = '';
        document.getElementById('order-year-filter').value = '';
        this.currentOrderFilter = null;
        this.loadOrders();
    },

    populateYearFilter() {
        const select = document.getElementById('order-year-filter');
        const orders = OrdersModule.getAllOrders('recent');

        const years = [...new Set(orders.map(o => o.deliveryDate?.substring(0, 4)).filter(y => y))].sort().reverse();

        select.innerHTML = '<option value="">Tutti gli anni</option>' +
            years.map(y => `<option value="${y}">${y}</option>`).join('');
    },

    openNewOrderModal() {
        console.log("🔵 openNewOrderModal chiamata");
        this.openModal('new-order-modal');

        const select = document.getElementById('order-customer');
        console.log("🔵 Select trovato:", select);

        const customers = CustomersModule.getAllCustomers('name');
        console.log("🔵 Clienti:", customers.length);

        select.innerHTML = '<option value="">-- Seleziona cliente --</option>' +
            customers.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('');

        console.log("🔵 Select popolato, innerHTML length:", select.innerHTML.length);

        // Reset form
        document.getElementById('order-items').innerHTML = '';
        document.getElementById('order-delivery-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('order-notes').value = '';
        this.orderItems = [];
        this.updateOrderTotal();
    },

    orderItems: [],

    addOrderItem() {
        const products = ProductsModule.getActiveProducts();
        const itemHtml = `
        <div class="flex gap-2 mb-2 order-item">
            <select class="flex-1 px-2 py-1 border rounded" onchange="app.updateOrderTotal()">
                <option value="">-- Prodotto --</option>
                ${products.map(p => `<option value="${p.id}" data-price="${p.price}" data-weight="${p.averageWeight || 0}">${p.name} - ${Utils.formatPrice(p.price)}/${p.unit || 'kg'}</option>`).join('')}
            </select>
            <input type="number" step="0.01" placeholder="Qtà" class="w-20 px-2 py-1 border rounded" onchange="app.updateOrderTotal()">
            <button onclick="this.parentElement.remove(); app.updateOrderTotal()" class="text-red-600">✕</button>
        </div>
    `;
        document.getElementById('order-items').insertAdjacentHTML('beforeend', itemHtml);
    },

    updateOrderTotal() {
        let total = 0;
        document.querySelectorAll('.order-item').forEach(item => {
            const select = item.querySelector('select');
            const qty = parseFloat(item.querySelector('input').value) || 0;
            if (select.value && qty > 0) {
                const option = select.selectedOptions[0];
                const price = parseFloat(option.dataset.price);
                const weight = parseFloat(option.dataset.weight) || 0;

                if (weight > 0) {
                    total += price * weight * qty;
                } else {
                    total += price * qty;
                }
            }
        });
        document.getElementById('order-total').textContent = Utils.formatPrice(total);
    },

    saveOrder() {
        const customerId = document.getElementById('order-customer').value;
        if (!customerId) {
            Utils.showToast("Seleziona un cliente", "error");
            return;
        }

        const items = [];
        document.querySelectorAll('.order-item').forEach(item => {
            const select = item.querySelector('select');
            const qty = parseFloat(item.querySelector('input').value) || 0;
            if (select.value && qty > 0) {
                const option = select.selectedOptions[0];
                const price = parseFloat(option.dataset.price);
                const weight = parseFloat(option.dataset.weight) || 0;

                items.push({
                    productId: select.value,
                    quantity: weight > 0 ? weight * qty : qty,
                    price: price
                });
            }
        });

        if (items.length === 0) {
            Utils.showToast("Aggiungi almeno un prodotto", "error");
            return;
        }

        const orderData = {
            customerId: customerId,
            items: items,
            deliveryDate: document.getElementById('order-delivery-date').value,
            deliveryTime: document.getElementById('order-delivery-time').value,
            notes: document.getElementById('order-notes').value
        };

        if (this.editingOrderId) {
            const oldOrder = OrdersModule.getOrderById(this.editingOrderId);
            if (oldOrder && (oldOrder.status === 'confirmed' || oldOrder.status === 'in_preparation' || oldOrder.status === 'ready')) {
                const modifications = this.compareOrders(oldOrder.items, items);
                if (modifications.toAdd.length > 0 || modifications.toRemove.length > 0) {
                    OrdersModule.addModification(this.editingOrderId, modifications);

                    if (oldOrder.status === 'ready') {
                        OrdersModule.changeOrderStatus(this.editingOrderId, 'in_preparation');
                    }
                }
            }

            OrdersModule.updateOrder(this.editingOrderId, orderData);
            this.editingOrderId = null;
        } else {
            const newOrder = OrdersModule.createOrder(orderData);

            // Chiedi se mandare conferma ordine
            if (newOrder && confirm("Mandare conferma ordine su WhatsApp?")) {
                WhatsAppModule.sendOrderConfirmation(newOrder);
            }
        }

        this.closeModal('new-order-modal');
        this.loadOrders();
    },

    compareOrders(oldItems, newItems) {
        const toAdd = [];
        const toRemove = [];

        // Prodotti aggiunti o aumentati
        newItems.forEach(newItem => {
            const oldItem = oldItems.find(i => i.productId === newItem.productId);
            if (!oldItem) {
                toAdd.push(newItem);
            } else if (newItem.quantity > oldItem.quantity) {
                toAdd.push({
                    productId: newItem.productId,
                    quantity: newItem.quantity - oldItem.quantity,
                    price: newItem.price
                });
            }
        });

        // Prodotti rimossi o diminuiti
        oldItems.forEach(oldItem => {
            const newItem = newItems.find(i => i.productId === oldItem.productId);
            if (!newItem) {
                toRemove.push(oldItem);
            } else if (newItem.quantity < oldItem.quantity) {
                toRemove.push({
                    productId: oldItem.productId,
                    quantity: oldItem.quantity - newItem.quantity,
                    price: oldItem.price
                });
            }
        });

        return { toAdd, toRemove };
    },

    editOrder(orderId) {
        const order = OrdersModule.getOrderById(orderId);
        if (!order) return;

        // Blocca modifica ordini consegnati
        if (order.status === 'delivered') {
            Utils.showToast("⛔ Ordine già consegnato, non modificabile", "error");
            return;
        }

        // Prima apri modal
        this.openModal('new-order-modal');

        // Popola select clienti
        const select = document.getElementById('order-customer');
        const customers = CustomersModule.getAllCustomers('name');
        select.innerHTML = '<option value="">-- Seleziona cliente --</option>' +
            customers.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('');

        // Poi imposta valori
        select.value = order.customerId;
        document.getElementById('order-delivery-date').value = order.deliveryDate;
        document.getElementById('order-delivery-time').value = order.deliveryTime || '';
        document.getElementById('order-notes').value = order.notes || '';

        document.getElementById('order-items').innerHTML = '';
        order.items.forEach(item => {
            this.addOrderItem();
            const lastItem = document.querySelectorAll('.order-item')[document.querySelectorAll('.order-item').length - 1];
            lastItem.querySelector('select').value = item.productId;
            lastItem.querySelector('input').value = item.quantity;
        });

        this.updateOrderTotal();
        this.editingOrderId = orderId;
    },

    deleteOrder(orderId) {
        if (OrdersModule.deleteOrder(orderId)) {
            this.loadOrders();
        }
    },

    undoDelivery(orderId) {
        if (confirm("⚠️ Annullare la consegna e riportare l'ordine a 'Pronto'?")) {
            OrdersModule.changeOrderStatus(orderId, 'ready');

            // Rimuovi bollini fidelity se erano stati aggiunti
            const order = OrdersModule.getOrderById(orderId);
            if (order && FidelityModule) {
                const stampsToRemove = Math.floor(order.totalAmount / 10);
                if (stampsToRemove > 0) {
                    const fidelity = FidelityModule.getFidelityCustomer(order.customerId);
                    if (fidelity) {
                        fidelity.stamps = Math.max(0, fidelity.stamps - stampsToRemove);
                        fidelity.totalStamps = Math.max(0, fidelity.totalStamps - stampsToRemove);
                        FidelityModule.saveFidelity();
                    }
                }
            }

            this.loadOrders();
            Utils.showToast("↩️ Consegna annullata", "success");
        }
    },

    viewOrderDetails(orderId) {
        const order = OrdersModule.formatOrderDetails(orderId);
        if (!order) return;

        const content = document.getElementById('order-details-content');
        content.innerHTML = `
        <p class="mb-2"><strong>Cliente:</strong> ${order.customerName}</p>
        <p class="mb-2"><strong>Data consegna:</strong> ${order.deliveryDate ? Utils.formatDate(order.deliveryDate) : '-'} ${order.deliveryTime || ''}</p>
        <p class="mb-4"><strong>Note:</strong> ${order.notes || '-'}</p>
        
        <h4 class="font-bold mb-2">Prodotti:</h4>
        <div class="space-y-1 mb-4">
            ${order.items.map(item => `
                <div class="flex justify-between text-sm">
                    <span>${item.productName} x${item.quantity}</span>
                    <span>${Utils.formatPrice(item.price * item.quantity)}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="text-right">
            <p class="text-2xl font-bold">Totale: ${Utils.formatPrice(order.totalAmount)}</p>
        </div>
    `;

        this.openModal('order-details-modal');
    },

    loadCustomers() {
        console.log("👥 Caricamento clienti...");
        this.displayCustomers(CustomersModule.getAllCustomers());
    },

    displayCustomers(customers) {
        const container = document.getElementById('customers-list');
        if (!container) return;

        if (customers.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Nessun cliente</p>';
            return;
        }

        container.innerHTML = customers.map(c => `
        <div class="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h3 class="font-bold text-lg">${c.firstName} ${c.lastName}</h3>
                    ${c.phone ? `<p class="text-sm text-gray-600">📞 ${c.phone}</p>` : ''}
                    ${c.email ? `<p class="text-sm text-gray-600">📧 ${c.email}</p>` : ''}
                    <p class="text-xs text-gray-500 mt-2">Ordini: ${c.totalOrders || 0} | Speso: ${Utils.formatPrice(c.totalSpent || 0)}</p>
                </div>
                <button onclick="app.deleteCustomer('${c.id}')" class="text-red-600 hover:text-red-800">🗑️</button>
            </div>
        </div>
    `).join('');
    },

    searchCustomers() {
        const query = document.getElementById('customer-search').value;
        const results = CustomersModule.searchCustomers(query);
        this.displayCustomers(results);
    },

    openNewCustomerModal() {
        this.openModal('new-customer-modal');
    },

    saveCustomer(event) {
        event.preventDefault();

        const data = {
            firstName: document.getElementById('customer-firstname').value,
            lastName: document.getElementById('customer-lastname').value,
            phone: document.getElementById('customer-phone').value,
            email: document.getElementById('customer-email').value,
            address: document.getElementById('customer-address').value
        };

        const newCustomer = CustomersModule.addCustomer(data);
        this.closeModal('new-customer-modal');
        this.loadCustomers();

        // Chiedi se mandare messaggio benvenuto
        if (confirm("Mandare messaggio di benvenuto su WhatsApp con tessera fidelity?")) {
            WhatsAppModule.sendWelcomeMessage(newCustomer, true);
        }
    },

    deleteCustomer(customerId) {
        // Controlla se ha ordini attivi
        const hasOrders = OrdersModule.getAllOrders('recent').some(o =>
            o.customerId === customerId && o.status !== 'delivered' && o.status !== 'cancelled'
        );

        if (hasOrders) {
            Utils.showToast("⛔ Impossibile eliminare: cliente ha ordini attivi", "error");
            return;
        }

        if (confirm("Eliminare questo cliente? Questa azione è irreversibile.")) {
            if (CustomersModule.deleteCustomer(customerId)) {
                this.loadCustomers();
            }
        }
    },

    loadProducts() {
        this.displayProducts(ProductsModule.getAllProducts());
    },

    displayProducts(products) {
        const container = document.getElementById('products-list');
        if (!container) return;

        // Raggruppa per categoria
        const byCategory = {};
        products.forEach(p => {
            if (!byCategory[p.category]) byCategory[p.category] = [];
            byCategory[p.category].push(p);
        });

        container.innerHTML = Object.keys(byCategory).sort().map(cat => `
        <div class="col-span-full">
            <h3 class="text-xl font-bold mb-3 text-blue-600">${cat}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                ${byCategory[cat].map(p => `
                    <div class="bg-white p-4 rounded-lg shadow">
                        <h4 class="font-bold">${p.name}</h4>
                        <p class="text-2xl text-blue-600 font-bold mt-2">${Utils.formatPrice(p.price)}/${p.unit || 'kg'}</p>
                        ${p.averageWeight ? `<p class="text-xs text-gray-500">Peso medio: ${(p.averageWeight * 1000).toFixed(0)}g</p>` : ''}
                        <div class="flex gap-2 mt-3">
                            <button onclick="ProductsModule.toggleProductActive('${p.id}'); app.loadProducts()" class="text-xs px-2 py-1 rounded ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100'}">${p.active ? '✓' : '✗'}</button>
                            <button onclick="app.editProduct('${p.id}')" class="text-blue-600 text-sm">✏️</button>
                            <button onclick="app.deleteProduct('${p.id}')" class="text-red-600 text-sm">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    },

    searchProducts() {
        const query = document.getElementById('product-search').value;
        const results = ProductsModule.searchProducts(query);
        this.displayProducts(results);
    },

    openNewProductModal() {
        this.openModal('new-product-modal');
    },

    saveProduct(event) {
        event.preventDefault();
        const unit = document.getElementById('product-unit').value;
        const productId = document.getElementById('product-id').value;

        let category = document.getElementById('product-category').value;
        if (category === '__new__') {
            category = document.getElementById('product-category-new').value;
        }

        const data = {
            name: document.getElementById('product-name').value,
            price: document.getElementById('product-price').value,
            category: category,
            description: document.getElementById('product-description').value,
            unit: unit,
            averageWeight: unit === 'kg (peso medio)' ? parseFloat(document.getElementById('product-weight').value) : null
        };

        if (productId) {
            ProductsModule.updateProduct(productId, data);
        } else {
            ProductsModule.addProduct(data);
        }

        this.closeModal('new-product-modal');
        event.target.reset();
        document.getElementById('product-id').value = '';
        this.loadProducts();
    },

    editProduct(productId) {
        const product = ProductsModule.getProductById(productId);
        if (!product) return;

        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-price').value = product.price;

        // Gestione categoria
        const categorySelect = document.getElementById('product-category');
        categorySelect.value = product.category;

        // Se la categoria non esiste nel select, usa "Nuova categoria"
        if (categorySelect.value === '' && product.category) {
            categorySelect.value = '__new__';
            document.getElementById('product-category-new').value = product.category;
            checkNewCategory();
        }

        document.getElementById('product-unit').value = product.unit || 'kg';
        document.getElementById('product-weight').value = product.averageWeight || '';
        document.getElementById('product-description').value = product.description || '';

        toggleWeightInput();
        this.openModal('new-product-modal');
    },

    deleteProduct(productId) {
        if (ProductsModule.deleteProduct(productId)) {
            this.loadProducts();
        }
    },

    loadFidelity() {
        console.log("🎁 Caricamento fidelity...");
        const fidelityList = FidelityModule.getAllFidelityCustomers();
        this.displayFidelityCustomers(fidelityList);
    },

    loadSettings() {
        console.log("⚙️ Caricamento impostazioni...");
        this.updateDropboxStatus();
    },

    updateDropboxStatus() {
        const statusDiv = document.getElementById('dropbox-status');
        const actionsDiv = document.getElementById('dropbox-actions');

        if (!statusDiv || !actionsDiv) return;

        if (Storage.dropboxClient) {
            statusDiv.innerHTML = '<p class="text-green-600 font-bold">✅ Connesso</p>';
            actionsDiv.innerHTML = `
            <button onclick="app.manualSync()" class="bg-blue-600 text-white px-4 py-2 rounded mr-2 hover:bg-blue-700">🔄 Sincronizza ora</button>
            <button onclick="app.disconnectDropbox()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Disconnetti</button>
        `;
        } else {
            statusDiv.innerHTML = '<p class="text-gray-600">Non connesso</p>';
            actionsDiv.innerHTML = `
            <button onclick="app.connectDropbox()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Connetti Dropbox</button>
        `;
        }
    },

    connectDropbox() {
        Storage.startDropboxAuth();
    },

    disconnectDropbox() {
        if (confirm("Disconnettere Dropbox? I dati rimarranno salvati localmente.")) {
            Storage.disconnectDropbox();
            this.updateDropboxStatus();
        }
    },

    async manualSync() {
        if (!Storage.dropboxClient) {
            Utils.showToast("⚠️ Dropbox non connesso", "warning");
            return;
        }

        const choice = confirm("Vuoi:\n\nOK = Scaricare dati DA Dropbox\nAnnulla = Caricare dati SU Dropbox");

        if (choice) {
            // SCARICA da Dropbox
            Utils.showToast("📥 Caricamento da Dropbox...", "info");

            await CustomersModule.init();
            await ProductsModule.init();
            await OrdersModule.init();
            await FidelityModule.init();
            await CouponsModule.init();

            Utils.showToast("✅ Dati caricati da Dropbox!", "success");

            setTimeout(() => window.location.reload(), 1000);
        } else {
            // CARICA su Dropbox
            Utils.showToast("📤 Caricamento su Dropbox...", "info");
            await Storage.syncAllToDropbox(false);
            Utils.showToast("✅ Dati caricati su Dropbox!", "success");
        }
    },

    // ==========================================
    // MODAL MANAGEMENT
    // ==========================================

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    // ==========================================
    // ACTIONS
    // ==========================================

    openNewOrderModal() {
        this.openModal('new-order-modal');

        // Popola select clienti
        const select = document.getElementById('order-customer');
        const customers = CustomersModule.getAllCustomers('name');
        select.innerHTML = '<option value="">-- Seleziona cliente --</option>' +
            customers.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('');

        // Reset form
        document.getElementById('order-items').innerHTML = '';
        document.getElementById('order-delivery-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('order-notes').value = '';
        this.orderItems = [];
        this.updateOrderTotal();
    },

    // Visualizza dettagli ordine
    viewOrderDetails(orderId) {
        console.log("👁️ Visualizza ordine:", orderId);
        // TODO: Mostra dettagli ordine in modal
    },

    // Scanner QR Fidelity
    openFidelityQRScanner() {
        this.openModal('fidelity-qr-scanner-modal');

        QRModule.openScanner(
            'fidelity-qr-video',
            (qrData) => this.handleFidelityQRScan(qrData),
            (error) => console.error("Errore scanner:", error)
        );
    },

    closeFidelityQRScanner() {
        QRModule.closeScanner();
        this.closeModal('fidelity-qr-scanner-modal');
    },

    handleFidelityQRScan(qrData) {
        console.log("QR Scansionato:", qrData);

        const result = QRModule.processScannedQR(qrData);

        if (result) {
            // Mostra info cliente e permetti azioni
            Utils.showToast(`Cliente: ${result.customer.firstName}`, "success");
            // TODO: Apri modal con azioni (aggiungi bollini, usa premio, etc.)
        }
    },

    // ==========================================
    // DROPBOX
    // ==========================================

    disconnectDropbox() {
        if (confirm("Disconnettere Dropbox?")) {
            Storage.disconnectDropbox();
            this.loadSettings();
        }
    },

    async syncWithDropbox() {
        Utils.showToast("🔄 Sincronizzazione in corso...", "info");

        try {
            // Ricarica tutti i dati da Dropbox
            await this.initModules();

            // Ricarica UI
            this.loadTabContent(this.currentTab);

            Utils.showToast("✅ Sincronizzazione completata!", "success");
        } catch (error) {
            console.error("Errore sincronizzazione:", error);
            Utils.showToast("❌ Errore sincronizzazione", "error");
        }
    },

    // ==========================================
    // IMPORT/EXPORT DATI
    // ==========================================

    // Esporta tutti i dati in JSON
    exportData() {
        console.log("📤 Esportazione dati...");

        const data = {
            version: "2.0",
            exportDate: new Date().toISOString(),
            customers: CustomersModule.customers,
            products: ProductsModule.products,
            orders: OrdersModule.orders,
            fidelity: FidelityModule.fidelityCustomers,
            campaigns: CouponsModule.campaigns
        };

        // Converti in JSON
        const json = JSON.stringify(data, null, 2);

        // Crea file e download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `gestionale-ordini-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast("✅ Dati esportati!", "success");
        console.log("✅ Export completato");
    },

    // Importa dati da JSON
    importData() {
        console.log("📥 Apertura file picker...");

        const fileInput = document.getElementById('import-file-input');

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                Utils.showToast("📂 Lettura file...", "info");

                const text = await file.text();
                const data = JSON.parse(text);

                console.log("📊 File letto:", data);

                // Controlla se è formato vecchio o nuovo
                if (data.version === "2.0") {
                    // Formato nuovo
                    await this.importNewFormat(data);
                } else {
                    // Formato vecchio (usa TestData)
                    await TestData.importFromOldJSON(data);
                }

                // Reset input
                fileInput.value = '';

            } catch (error) {
                console.error("❌ Errore importazione:", error);
                Utils.showToast("❌ Errore: file non valido", "error");
            }
        };

        fileInput.click();
    },

    // Importa formato nuovo (2.0)
    async importNewFormat(data) {
        console.log("📥 Importazione formato nuovo...");

        if (confirm("⚠️ Questo sovrascriverà i dati esistenti. Continuare?")) {

            // Importa tutto
            if (data.customers) {
                CustomersModule.customers = data.customers;
                await CustomersModule.saveCustomers();
            }

            if (data.products) {
                ProductsModule.products = data.products;
                await ProductsModule.saveProducts();
            }

            if (data.orders) {
                OrdersModule.orders = data.orders;
                await OrdersModule.saveOrders();
            }

            if (data.fidelity) {
                FidelityModule.fidelityCustomers = data.fidelity;
                await FidelityModule.saveFidelity();
            }

            if (data.campaigns) {
                CouponsModule.campaigns = data.campaigns;
                await CouponsModule.saveCampaigns();
            }

            Utils.showToast("✅ Dati importati con successo!", "success");

            // Ricarica app
            this.refresh();
        }
    },

    // ==========================================
    // SETUP UI
    // ==========================================

    setupUI() {
        console.log("🎨 Setup UI...");

        // Setup auto-hide floating buttons
        this.setupFloatingButtons();

        // Setup shortcuts tastiera (per desktop)
        this.setupKeyboardShortcuts();
    },

    setupFloatingButtons() {
        let lastScrollTop = 0;
        const floatingButtons = document.getElementById('floating-buttons');

        if (!floatingButtons) return;

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scroll giù - nascondi
                floatingButtons.style.transform = 'translateY(100px)';
                floatingButtons.style.opacity = '0';
            } else {
                // Scroll su - mostra
                floatingButtons.style.transform = 'translateY(0)';
                floatingButtons.style.opacity = '1';
            }

            lastScrollTop = scrollTop;
        });
    },

    updateFloatingButtons(tabName) {
        const floatingButtons = document.getElementById('floating-buttons');
        if (!floatingButtons) return;

        // Mostra solo in alcune tab
        if (['dashboard', 'orders', 'fidelity'].includes(tabName)) {
            floatingButtons.style.display = 'flex';
        } else {
            floatingButtons.style.display = 'none';
        }
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + numero = switch tab
            if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
                e.preventDefault();
                const tabs = ['dashboard', 'orders', 'customers', 'products', 'fidelity', 'settings'];
                const index = parseInt(e.key) - 1;
                if (tabs[index]) {
                    this.switchTab(tabs[index]);
                }
            }
        });
    },

    // ==========================================
    // UTILITY
    // ==========================================

    updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    },

    refresh() {
        console.log("🔄 Refresh app...");
        this.loadTabContent(this.currentTab);
    }
};

// Rendi App disponibile globalmente
window.app = App;

// Auto-inizializzazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

console.log("✅ App.js caricato");