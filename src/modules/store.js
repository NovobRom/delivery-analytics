// =============================================
// Store - Centralized State Management
// =============================================

import { FILE_TYPES } from '../utils/constants.js';

/**
 * Central application state store
 * Manages both Delivery and Pickup data separately
 */
class Store {
    constructor() {
        // Delivery data (courier performance)
        this.deliveryData = {
            all: [],
            filtered: [],
            display: []
        };

        // Pickup data (pickup orders)
        this.pickupData = {
            all: [],
            filtered: [],
            display: []
        };

        // Current active data type
        this.activeDataType = FILE_TYPES.DELIVERY;

        // UI State
        this.ui = {
            activeTab: 'overview',
            currentPage: 1,
            rowsPerPage: 15,
            isLoading: false
        };

        // Charts instances
        this.charts = {};

        // Filters
        this.filters = {
            type: 'this_month',
            year: null,
            startDate: null,
            endDate: null,
            zone: null,
            courier: null,
            country: null
        };

        // Connection
        this.connection = {
            type: 'local', // 'api', 'direct', 'local'
            isConnected: false
        };

        // Validation
        this.validationIssues = [];

        // Listeners for state changes
        this._listeners = new Map();
    }

    // ==========================================
    // Data Getters (based on active type)
    // ==========================================

    get allData() {
        return this.activeDataType === FILE_TYPES.DELIVERY
            ? this.deliveryData.all
            : this.pickupData.all;
    }

    set allData(data) {
        if (this.activeDataType === FILE_TYPES.DELIVERY) {
            this.deliveryData.all = data;
        } else {
            this.pickupData.all = data;
        }
        this._notify('dataChange');
    }

    get filteredData() {
        return this.activeDataType === FILE_TYPES.DELIVERY
            ? this.deliveryData.filtered
            : this.pickupData.filtered;
    }

    set filteredData(data) {
        if (this.activeDataType === FILE_TYPES.DELIVERY) {
            this.deliveryData.filtered = data;
        } else {
            this.pickupData.filtered = data;
        }
        this._notify('filterChange');
    }

    get displayData() {
        return this.activeDataType === FILE_TYPES.DELIVERY
            ? this.deliveryData.display
            : this.pickupData.display;
    }

    set displayData(data) {
        if (this.activeDataType === FILE_TYPES.DELIVERY) {
            this.deliveryData.display = data;
        } else {
            this.pickupData.display = data;
        }
        this._notify('displayChange');
    }

    // ==========================================
    // Data Type Switching
    // ==========================================

    setActiveDataType(type) {
        if (type !== FILE_TYPES.DELIVERY && type !== FILE_TYPES.PICKUP) {
            console.warn('Invalid data type:', type);
            return;
        }
        this.activeDataType = type;
        this._notify('dataTypeChange');
    }

    isDeliveryMode() {
        return this.activeDataType === FILE_TYPES.DELIVERY;
    }

    isPickupMode() {
        return this.activeDataType === FILE_TYPES.PICKUP;
    }

    // ==========================================
    // Connection State
    // ==========================================

    setConnection(type, isConnected = true) {
        this.connection.type = type;
        this.connection.isConnected = isConnected;
        this._notify('connectionChange');
    }

    get useSupabase() {
        return this.connection.type === 'api' || this.connection.type === 'direct';
    }

    get connectionType() {
        return this.connection.type;
    }

    // ==========================================
    // UI State
    // ==========================================

    setActiveTab(tab) {
        this.ui.activeTab = tab;
        this._notify('tabChange');
    }

    setPage(page) {
        this.ui.currentPage = page;
        this._notify('pageChange');
    }

    setLoading(isLoading) {
        this.ui.isLoading = isLoading;
        this._notify('loadingChange');
    }

    // ==========================================
    // Filters
    // ==========================================

    setFilter(key, value) {
        this.filters[key] = value;
        this._notify('filterSettingChange');
    }

    resetFilters() {
        this.filters = {
            type: 'this_month',
            year: null,
            startDate: null,
            endDate: null,
            zone: null,
            courier: null,
            country: null
        };
        this._notify('filterSettingChange');
    }

    // ==========================================
    // Charts
    // ==========================================

    setChart(name, instance) {
        if (this.charts[name]) {
            this.charts[name].destroy();
        }
        this.charts[name] = instance;
    }

    getChart(name) {
        return this.charts[name];
    }

    destroyAllCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }

    // ==========================================
    // Statistics Helpers
    // ==========================================

    getDeliveryStats() {
        const data = this.deliveryData.filtered;
        if (!data.length) return null;

        const totalLoaded = data.reduce((sum, d) => sum + (d.loaded_parcels || d._loaded || 0), 0);
        const totalDelivered = data.reduce((sum, d) => sum + (d.delivered_parcels || d._delivered || 0), 0);
        const uniqueCouriers = new Set(data.map(d => d.courier_name || d["ПІБ кур'єра"])).size;

        return {
            totalLoaded,
            totalDelivered,
            successRate: totalLoaded > 0 ? (totalDelivered / totalLoaded * 100) : 0,
            uniqueCouriers,
            recordsCount: data.length
        };
    }

    getPickupStats() {
        const data = this.pickupData.filtered;
        if (!data.length) return null;

        // Check if data is aggregated (has total_pickups field) or raw
        const isAggregated = data[0]?.total_pickups !== undefined;

        if (isAggregated) {
            // Handle aggregated pickup data (courier-day summaries)
            const totalPickups = data.reduce((sum, d) => sum + (d.total_pickups || 0), 0);
            const totalSuccessful = data.reduce((sum, d) => sum + (d.success_count || 0), 0);
            const totalWeight = data.reduce((sum, d) => sum + (d.total_weight || 0), 0);
            const totalRevenue = data.reduce((sum, d) => sum + (d.total_cost || 0), 0);
            const uniqueCouriers = new Set(data.map(d => d.courier_name).filter(Boolean)).size;

            return {
                totalOrders: totalPickups,
                totalSuccessful,
                successRate: totalPickups > 0 ? (totalSuccessful / totalPickups * 100) : 0,
                totalWeight,
                totalRevenue,
                uniqueCouriers,
                recordsCount: data.length,
                avgCostPerPickup: totalPickups > 0 ? totalRevenue / totalPickups : 0,
                avgWeightPerPickup: totalPickups > 0 ? totalWeight / totalPickups : 0
            };
        } else {
            // Handle raw pickup data (legacy support)
            const totalOrders = data.length;
            const totalShipments = data.reduce((sum, d) => sum + (d.shipments_in_doc || 1), 0);
            const totalWeight = data.reduce((sum, d) => sum + (d.actual_weight || 0), 0);
            const totalRevenue = data.reduce((sum, d) => sum + (d.delivery_cost || 0), 0);

            const countries = new Set([
                ...data.map(d => d.sender_country).filter(Boolean),
                ...data.map(d => d.recipient_country).filter(Boolean)
            ]);

            return {
                totalOrders,
                totalShipments,
                totalWeight,
                totalRevenue,
                uniqueCountries: countries.size
            };
        }
    }

    // ==========================================
    // Event System
    // ==========================================

    subscribe(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);

        // Return unsubscribe function
        return () => {
            const listeners = this._listeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }

    _notify(event) {
        const listeners = this._listeners.get(event) || [];
        listeners.forEach(callback => {
            try {
                callback(this);
            } catch (e) {
                console.error(`Error in ${event} listener:`, e);
            }
        });
    }

    // ==========================================
    // Persistence
    // ==========================================

    saveToLocalStorage() {
        try {
            const data = {
                deliveryData: this.deliveryData.all,
                pickupData: this.pickupData.all,
                activeDataType: this.activeDataType
            };
            localStorage.setItem('deliveryAnalyticsStore', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('deliveryAnalyticsStore');
            if (stored) {
                const data = JSON.parse(stored);
                this.deliveryData.all = data.deliveryData || [];
                this.pickupData.all = data.pickupData || [];
                this.activeDataType = data.activeDataType || FILE_TYPES.DELIVERY;
                return true;
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
        return false;
    }

    // ==========================================
    // Legacy Compatibility
    // ==========================================

    // For backward compatibility with old app.js code
    get state() {
        return {
            allData: this.allData,
            filteredData: this.filteredData,
            displayData: this.displayData,
            activeTab: this.ui.activeTab,
            currentPage: this.ui.currentPage,
            rowsPerPage: this.ui.rowsPerPage,
            charts: this.charts,
            filters: this.filters,
            useSupabase: this.useSupabase,
            connectionType: this.connectionType,
            validationIssues: this.validationIssues
        };
    }
}

// Export singleton instance
const store = new Store();
export default store;

// Also export class for testing
export { Store };
