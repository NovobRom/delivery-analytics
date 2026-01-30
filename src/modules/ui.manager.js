// =============================================
// UI Manager - General UI Operations
// =============================================

import store from './store.js';
import * as helpers from '../utils/helpers.js';
import { FILE_TYPES } from '../utils/constants.js';

/**
 * Manages general UI operations: loading, stats, connection status, insights
 */
class UIManager {
    constructor() {
        this.elements = {};
    }

    // ==========================================
    // Initialization
    // ==========================================

    init() {
        this.cacheElements();
    }

    cacheElements() {
        this.elements = {
            loadingOverlay: document.getElementById('loadingOverlay'),
            progressBar: document.getElementById('progressBar'),
            connectionStatus: document.getElementById('connectionStatus'),
            statsGrid: document.getElementById('statsGrid'),
            insightsContainer: document.getElementById('insightsContainer'),
            alertContainer: document.getElementById('alertContainer'),
            dataTypeToggle: document.getElementById('dataTypeToggle')
        };
    }

    // ==========================================
    // Loading State
    // ==========================================

    showLoading(show = true) {
        const loader = this.elements.loadingOverlay || document.getElementById('loadingOverlay');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
        store.setLoading(show);
    }

    updateProgress(percent) {
        const bar = this.elements.progressBar || document.getElementById('progressBar');
        if (bar) {
            bar.style.width = `${percent}%`;
            bar.textContent = `${percent}%`;
        }
    }

    // ==========================================
    // Connection Status
    // ==========================================

    updateConnectionStatus(type = 'local') {
        const indicator = this.elements.connectionStatus || document.getElementById('connectionStatus');
        if (!indicator) return;

        const configs = {
            api: {
                icon: 'cloud',
                text: 'API',
                className: 'status-online',
                title: 'Connected via Backend API'
            },
            direct: {
                icon: 'database',
                text: 'DB',
                className: 'status-online',
                title: 'Connected directly to Supabase'
            },
            local: {
                icon: 'hdd',
                text: 'Local',
                className: 'status-offline',
                title: 'Using local storage'
            }
        };

        const config = configs[type] || configs.local;
        indicator.innerHTML = `<i class="fas fa-${config.icon}"></i> ${config.text}`;
        indicator.className = config.className;
        indicator.title = config.title;
    }

    // ==========================================
    // Statistics Cards
    // ==========================================

    updateStats() {
        if (store.isDeliveryMode()) {
            this.updateDeliveryStats();
        } else {
            this.updatePickupStats();
        }
    }

    updateDeliveryStats() {
        const grid = this.elements.statsGrid || document.getElementById('statsGrid');
        if (!grid) return;

        const stats = store.getDeliveryStats();
        if (!stats) {
            grid.innerHTML = this.getEmptyStatsHTML();
            return;
        }

        const undelivered = stats.totalLoaded - stats.totalDelivered;
        const undeliveredRate = stats.totalLoaded > 0 ? (undelivered / stats.totalLoaded * 100) : 0;

        grid.innerHTML = `
            <div class="stat-card">
                <span class="stat-label">Total Parcels</span>
                <span class="stat-value">${helpers.formatNumber(stats.totalLoaded)}</span>
                <span class="stat-sub">Loaded in period</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Delivered</span>
                <span class="stat-value">${helpers.formatNumber(stats.totalDelivered)}</span>
                <span class="stat-sub up"><i class="fas fa-check-circle"></i> ${helpers.formatPercent(stats.successRate)} success</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Active Couriers</span>
                <span class="stat-value">${stats.uniqueCouriers}</span>
                <span class="stat-sub">In this period</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Records</span>
                <span class="stat-value">${stats.recordsCount}</span>
                <span class="stat-sub">Data entries</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Undelivered</span>
                <span class="stat-value">${helpers.formatNumber(undelivered)}</span>
                <span class="stat-sub down">${helpers.formatPercent(undeliveredRate)} of total</span>
            </div>
        `;
    }

    updatePickupStats() {
        const grid = this.elements.statsGrid || document.getElementById('statsGrid');
        if (!grid) return;

        const stats = store.getPickupStats();
        if (!stats) {
            grid.innerHTML = this.getEmptyStatsHTML();
            return;
        }

        grid.innerHTML = `
            <div class="stat-card">
                <span class="stat-label">Total Orders</span>
                <span class="stat-value">${helpers.formatNumber(stats.totalOrders)}</span>
                <span class="stat-sub">Pickup documents</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Shipments</span>
                <span class="stat-value">${helpers.formatNumber(stats.totalShipments)}</span>
                <span class="stat-sub">Total shipments</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Total Weight</span>
                <span class="stat-value">${stats.totalWeight.toFixed(1)} kg</span>
                <span class="stat-sub">Actual weight</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Revenue</span>
                <span class="stat-value">${helpers.formatNumber(stats.totalRevenue)}</span>
                <span class="stat-sub up"><i class="fas fa-coins"></i> Total</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Countries</span>
                <span class="stat-value">${stats.uniqueCountries}</span>
                <span class="stat-sub">Unique destinations</span>
            </div>
        `;
    }

    getEmptyStatsHTML() {
        return `
            <div class="stat-card">
                <span class="stat-label">No Data</span>
                <span class="stat-value">-</span>
                <span class="stat-sub">Upload a file to start</span>
            </div>
        `;
    }

    // ==========================================
    // Insights
    // ==========================================

    updateInsights(apiInsights = null) {
        const container = this.elements.insightsContainer || document.getElementById('insightsContainer');
        if (!container) return;

        if (apiInsights && apiInsights.length > 0) {
            this.renderInsights(container, apiInsights);
            return;
        }

        // Generate local insights
        const insights = store.isDeliveryMode()
            ? this.generateDeliveryInsights()
            : this.generatePickupInsights();

        this.renderInsights(container, insights);
    }

    generateDeliveryInsights() {
        const data = store.filteredData;
        if (!data || data.length === 0) {
            return ['Upload data to get insights'];
        }

        const insights = [];
        const stats = store.getDeliveryStats();

        if (!stats) return ['No data available'];

        // Success rate insight
        if (stats.successRate >= 95) {
            insights.push(`Excellent success rate: ${stats.successRate.toFixed(1)}%`);
        } else if (stats.successRate >= 85) {
            insights.push(`Good success rate: ${stats.successRate.toFixed(1)}% (target: 95%)`);
        } else {
            insights.push(`Warning: Success rate ${stats.successRate.toFixed(1)}% is below target (95%)`);
        }

        // Find best courier
        const courierStats = {};
        data.forEach(d => {
            const name = d.courier_name || d["ПІБ кур'єра"];
            if (!courierStats[name]) courierStats[name] = { loaded: 0, delivered: 0 };
            courierStats[name].loaded += d.loaded_parcels || d._loaded || 0;
            courierStats[name].delivered += d.delivered_parcels || d._delivered || 0;
        });

        let bestCourier = { name: '', rate: 0 };
        Object.entries(courierStats).forEach(([name, s]) => {
            if (s.loaded < 50) return;
            const rate = s.loaded > 0 ? (s.delivered / s.loaded * 100) : 0;
            if (rate > bestCourier.rate) bestCourier = { name, rate };
        });

        if (bestCourier.name) {
            insights.push(`Top performer: ${bestCourier.name} (${bestCourier.rate.toFixed(1)}%)`);
        }

        // Undelivered count
        const undelivered = stats.totalLoaded - stats.totalDelivered;
        if (undelivered > 0) {
            insights.push(`Undelivered parcels: ${helpers.formatNumber(undelivered)}`);
        }

        return insights.length > 0 ? insights : ['All metrics are normal'];
    }

    generatePickupInsights() {
        const data = store.filteredData;
        if (!data || data.length === 0) {
            return ['Upload data to get insights'];
        }

        const insights = [];
        const stats = store.getPickupStats();

        if (!stats) return ['No data available'];

        // Revenue insight
        if (stats.totalRevenue > 0) {
            const avgRevenue = stats.totalRevenue / stats.totalOrders;
            insights.push(`Average order value: ${avgRevenue.toFixed(2)}`);
        }

        // Weight insight
        if (stats.totalWeight > 0) {
            const avgWeight = stats.totalWeight / stats.totalOrders;
            insights.push(`Average weight: ${avgWeight.toFixed(2)} kg per order`);
        }

        // Top country
        const countryStats = {};
        data.forEach(d => {
            const country = d.recipient_country || 'Unknown';
            if (!countryStats[country]) countryStats[country] = 0;
            countryStats[country]++;
        });

        const topCountry = Object.entries(countryStats)
            .sort((a, b) => b[1] - a[1])[0];

        if (topCountry) {
            const percentage = (topCountry[1] / stats.totalOrders * 100).toFixed(1);
            insights.push(`Top destination: ${topCountry[0]} (${percentage}% of orders)`);
        }

        insights.push(`Active countries: ${stats.uniqueCountries}`);

        return insights;
    }

    renderInsights(container, insights) {
        container.innerHTML = insights.map(insight => {
            const isWarning = insight.toLowerCase().includes('warning') ||
                             insight.toLowerCase().includes('below');
            const isSuccess = insight.toLowerCase().includes('excellent') ||
                             insight.toLowerCase().includes('top');
            const icon = isWarning ? 'exclamation-triangle' : isSuccess ? 'check-circle' : 'info-circle';
            const colorClass = isWarning ? 'warning' : isSuccess ? 'success' : 'info';

            return `
                <div class="insight-item insight-${colorClass}">
                    <i class="fas fa-${icon}"></i>
                    <span>${insight}</span>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // Alerts
    // ==========================================

    showAlerts(issues, type = 'warning') {
        const container = this.elements.alertContainer || document.getElementById('alertContainer');
        if (!container) return;

        const icon = type === 'error' ? 'exclamation-circle' : 'exclamation-triangle';

        container.innerHTML = issues.slice(0, 5).map(issue => `
            <div class="alert alert-${type}">
                <i class="fas fa-${icon}"></i>
                <span>${issue.message || issue}</span>
            </div>
        `).join('');

        // Auto-hide after 10 seconds
        setTimeout(() => {
            container.innerHTML = '';
        }, 10000);
    }

    clearAlerts() {
        const container = this.elements.alertContainer || document.getElementById('alertContainer');
        if (container) {
            container.innerHTML = '';
        }
    }

    // ==========================================
    // Tab Switching
    // ==========================================

    switchTab(tabName) {
        store.setActiveTab(tabName);

        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const tabButton = document.querySelector(`.tab[data-tab="${tabName}"]`) ||
                         document.querySelector(`.tab[onclick*="${tabName}"]`);
        if (tabButton) tabButton.classList.add('active');

        const tabContent = document.getElementById(`tab-${tabName}`);
        if (tabContent) tabContent.classList.add('active');
    }

    // ==========================================
    // Data Type Toggle
    // ==========================================

    updateDataTypeToggle() {
        const toggle = this.elements.dataTypeToggle || document.getElementById('dataTypeToggle');
        if (!toggle) return;

        const isDelivery = store.isDeliveryMode();
        toggle.innerHTML = `
            <button class="toggle-btn ${isDelivery ? 'active' : ''}" data-type="${FILE_TYPES.DELIVERY}">
                <i class="fas fa-truck"></i> Delivery
            </button>
            <button class="toggle-btn ${!isDelivery ? 'active' : ''}" data-type="${FILE_TYPES.PICKUP}">
                <i class="fas fa-box"></i> Pickup
            </button>
        `;
    }
}

// Export singleton
const uiManager = new UIManager();
export default uiManager;

export { UIManager };
