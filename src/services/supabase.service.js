// =============================================
// Data Service v2.1 (API-First)
// Replaces direct Supabase connection with Backend API calls
// =============================================

import { API_ENDPOINTS } from '../utils/constants.js';

class DataService {

    constructor() {
        this.mode = 'api';
    }

    /**
     * Check connection to Backend API
     */
    async checkConnection() {
        try {
            const response = await fetch('/api');
            if (response.ok) {
                console.log('✅ Connected to Delivery Analytics API');
                return 'api';
            }
        } catch (e) {
            console.warn('⚠️ API Connection failed:', e);
        }
        return 'offline';
    }

    // =========================================
    // Helpers
    // =========================================

    async _get(endpoint, params = {}) {
        try {
            const url = new URL(endpoint, window.location.origin);
            Object.keys(params).forEach(key => {
                if (params[key]) url.searchParams.append(key, params[key]);
            });

            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`GET ${endpoint} failed:`, error);
            return [];
        }
    }

    // =========================================
    // Courier Performance (Delivery Pipeline)
    // =========================================

    /**
     * Get Courier Performance Stats
     * Maps V2 API fields to Legacy UI fields for compatibility
     */
    async getCourierPerformance(filters = {}) {
        // We fetch the aggregated stats view
        const data = await this._get(API_ENDPOINTS.STATS_DELIVERY_COURIERS, filters);

        // Map to legacy format expected by UI (charts/tables)
        return data.map(item => ({
            courier_name: item.courier_name,
            full_name: item.courier_name, // Alias
            report_date: item.report_date, // Critical for date filtering

            // Map metrics
            loaded_count: item.total_assigned || 0,
            delivered_count: item.delivered || 0,
            returned_count: item.returned || 0,
            success_rate: item.success_rate || 0,

            // Extra V2 data
            documented_failures: item.documented_failures || 0
        }));
    }

    /**
     * Import is now handled via excelParser.uploadToBackend
     * keeping empty method for compatibility if app.js calls it
     */
    async importCourierPerformance(records) {
        console.warn('Deprecated: Use uploadToBackend instead');
        return { imported: 0, failed: 0, errors: ['Use new upload method'] };
    }

    // =========================================
    // Pickup Orders (Shipment Pipeline)
    // =========================================

    async getPickupOrders(filters = {}) {
        const data = await this._get(API_ENDPOINTS.STATS_PICKUP, filters);

        // Map V2 shipment stats to UI format
        return data.map(item => ({
            execution_date: item.pickup_execution_date,
            report_date: item.pickup_execution_date, // Alias for charts

            sender_country: item.sender_country,

            // Metrics
            shipments_count: item.total_shipments,
            total_weight: item.total_weight,
            total_cost: item.total_cost
        }));
    }

    async importPickupOrders(records) {
        console.warn('Deprecated: Use uploadToBackend instead');
        return { imported: 0, failed: 0, errors: ['Use new upload method'] };
    }

    // =========================================
    // Daily Stats Summary
    // =========================================

    async getDailyStats(filters = {}) {
        const data = await this._get(API_ENDPOINTS.STATS_DELIVERY, filters);

        return data.map(item => ({
            delivery_date: item.date,
            report_date: item.date,

            active_couriers: item.active_couriers,

            loaded_count: item.total_deliveries, // Attempts
            delivered_count: item.delivered_count,
            success_rate: item.success_rate
        }));
    }

    // =========================================
    // Management
    // =========================================

    // Clear methods would require new ADMIN endpoints
    async clearAllData() {
        console.warn('Clear data not implemented in V2 yet');
        return false;
    }
}

// Export singleton
const dataService = new DataService();
export default dataService;
