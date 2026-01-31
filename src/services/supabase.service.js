// =============================================
// Data Service v2.0
// Supports: Backend API, Direct Supabase, localStorage
// =============================================

import apiService from './api.service.js';
import { FILE_TYPES, API_ENDPOINTS } from '../utils/constants.js';

// Dynamic config loading with fallback
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

// Try to load config (will fail on GitHub Pages if file not present)
try {
    const config = await import('../config/supabase.js').catch(() => null);
    if (config) {
        SUPABASE_URL = config.SUPABASE_URL || '';
        SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY || '';
    }
} catch (e) {
    console.log('Supabase config not found, using localStorage mode');
}

class DataService {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_ANON_KEY;
        this.headers = this.key ? {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        } : {};

        // Mode: 'api' | 'direct' | 'local'
        this.mode = 'local';
    }

    /**
     * Check which backend is available
     * Returns: 'api' | 'direct' | 'local'
     */
    async checkConnection() {
        // First try Backend API
        try {
            await apiService.healthCheck();
            this.mode = 'api';
            console.log('✅ Connected to Backend API');
            return 'api';
        } catch (e) {
            console.log('⚠️ Backend API not available');
        }

        // Then try direct Supabase (only if config exists)
        if (this.url && this.key) {
            try {
                const response = await fetch(`${this.url}/rest/v1/`, {
                    method: 'HEAD',
                    headers: this.headers
                });
                if (response.ok || response.status === 404) {
                    this.mode = 'direct';
                    console.log('✅ Connected to Supabase directly');
                    return 'direct';
                }
            } catch (e) {
                console.log('⚠️ Supabase not available');
            }
        }

        console.log('📁 Using localStorage');
        return 'local';
    }

    // =========================================
    // Direct Supabase methods
    // =========================================

    async fetchDirect(table, query = '') {
        if (!this.url) throw new Error('Supabase not configured');
        const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
            headers: this.headers
        });
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        return response.json();
    }

    async insertDirect(table, data) {
        if (!this.url) throw new Error('Supabase not configured');
        const response = await fetch(`${this.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`Insert failed: ${response.statusText}`);
        return response.json();
    }

    // =========================================
    // Unified API Methods
    // =========================================

    async getZones() {
        if (this.mode === 'api') return apiService.getZones();
        if (this.mode === 'direct') return this.fetchDirect('zones', '?order=name');
        return [];
    }

    async getCouriers() {
        if (this.mode === 'api') return apiService.getCouriers();
        if (this.mode === 'direct') return this.fetchDirect('couriers', '?order=full_name');
        return [];
    }

    async getDeliveries(filters = {}) {
        if (this.mode === 'api') {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.courierId) params.courier_id = filters.courierId;
            if (filters.zoneId) params.zone_id = filters.zoneId;

            const data = await apiService.getDeliveries(params);
            return data.map(d => ({
                id: d.id,
                delivery_date: d.delivery_date,
                loaded_count: d.loaded_count,
                delivered_count: d.delivered_count,
                courier_id: d.courier_id,
                zone_id: d.zone_id,
                couriers: d.courier_name ? { full_name: d.courier_name, vehicle_number: d.vehicle_number } : null,
                zones: d.zone_name ? { name: d.zone_name } : null
            }));
        }

        if (this.mode === 'direct') {
            let query = '?select=*,couriers(full_name,vehicle_number),zones(name)';
            if (filters.startDate) query += `&delivery_date=gte.${filters.startDate}`;
            if (filters.endDate) query += `&delivery_date=lte.${filters.endDate}`;
            query += '&order=delivery_date.desc';
            return this.fetchDirect('deliveries', query);
        }

        return [];
    }

    // =========================================
    // NEW: Courier Performance (Delivery v2)
    // =========================================

    async getCourierPerformance(filters = {}) {
        if (this.mode === 'api') {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('date_from', filters.startDate);
            if (filters.endDate) params.append('date_to', filters.endDate);
            if (filters.courierName) params.append('courier_name', filters.courierName);
            if (filters.department) params.append('department', filters.department);

            const response = await fetch(`${apiService.baseUrl}${API_ENDPOINTS.COURIER_PERFORMANCE}?${params}`);
            if (!response.ok) throw new Error('Failed to fetch courier performance');
            return response.json();
        }

        if (this.mode === 'direct') {
            let query = '?order=report_date.desc';
            if (filters.startDate) query += `&report_date=gte.${filters.startDate}`;
            if (filters.endDate) query += `&report_date=lte.${filters.endDate}`;
            return this.fetchDirect('courier_performance', query);
        }

        return [];
    }

    async importCourierPerformance(records, filename) {
        if (this.mode === 'api') {
            const response = await fetch(`${apiService.baseUrl}${API_ENDPOINTS.BULK_IMPORT_DELIVERY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records, filename })
            });
            if (!response.ok) throw new Error('Import failed');
            return response.json();
        }

        if (this.mode === 'direct') {
            return this.insertDirect('courier_performance', records);
        }

        return { imported: 0, failed: records.length, errors: ['No database connection'] };
    }

    // =========================================
    // NEW: Pickup Orders
    // =========================================

    async getPickupOrders(filters = {}) {
        if (this.mode === 'api') {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('date_from', filters.startDate);
            if (filters.endDate) params.append('date_to', filters.endDate);
            if (filters.senderCountry) params.append('sender_country', filters.senderCountry);
            if (filters.recipientCountry) params.append('recipient_country', filters.recipientCountry);

            const response = await fetch(`${apiService.baseUrl}${API_ENDPOINTS.PICKUP_ORDERS}?${params}`);
            if (!response.ok) throw new Error('Failed to fetch pickup orders');
            return response.json();
        }

        if (this.mode === 'direct') {
            let query = '?order=execution_date.desc';
            if (filters.startDate) query += `&execution_date=gte.${filters.startDate}`;
            if (filters.endDate) query += `&execution_date=lte.${filters.endDate}`;
            return this.fetchDirect('pickup_orders', query);
        }

        return [];
    }

    async importPickupOrders(records, filename) {
        if (this.mode === 'api') {
            const response = await fetch(`${apiService.baseUrl}${API_ENDPOINTS.BULK_IMPORT_PICKUP}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records, filename })
            });
            if (!response.ok) throw new Error('Import failed');
            return response.json();
        }

        if (this.mode === 'direct') {
            return this.insertDirect('pickup_orders', records);
        }

        return { imported: 0, failed: records.length, errors: ['No database connection'] };
    }

    // =========================================
    // Legacy Import (for backward compatibility)
    // =========================================

    async importDeliveries(records, onProgress = null) {
        if (this.mode === 'api') {
            const result = await apiService.importDeliveries(records);
            if (onProgress) {
                onProgress({ current: records.length, total: records.length, percent: 100 });
            }
            return {
                success: result.imported_records,
                failed: result.skipped_records,
                errors: result.errors.map(e => ({ error: e }))
            };
        }

        if (this.mode === 'direct') {
            return this._importDirectly(records, onProgress);
        }

        return { success: 0, failed: records.length, errors: [{ error: 'No database connection' }] };
    }

    async _importDirectly(records, onProgress) {
        const results = { success: 0, failed: 0, errors: [] };

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            try {
                const courier = await this._getOrCreateCourier(record.courierName, record.vehicleNumber);
                const zone = record.zoneName ? await this._getOrCreateZone(record.zoneName) : null;

                await this._upsertDelivery({
                    delivery_date: record.deliveryDate,
                    courier_id: courier.id,
                    zone_id: zone?.id || null,
                    loaded_count: record.loadedCount,
                    delivered_count: record.deliveredCount
                });
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({ record, error: error.message });
            }

            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: records.length,
                    percent: Math.round(((i + 1) / records.length) * 100)
                });
            }
        }
        return results;
    }

    async _getOrCreateCourier(fullName, vehicleNumber) {
        const encoded = encodeURIComponent(fullName);
        const existing = await this.fetchDirect('couriers', `?full_name=eq.${encoded}`);
        if (existing?.length > 0) return existing[0];
        const created = await this.insertDirect('couriers', { full_name: fullName, vehicle_number: vehicleNumber });
        return created[0];
    }

    async _getOrCreateZone(name) {
        const encoded = encodeURIComponent(name);
        const existing = await this.fetchDirect('zones', `?name=eq.${encoded}`);
        if (existing?.length > 0) return existing[0];
        const created = await this.insertDirect('zones', { name });
        return created[0];
    }

    async _upsertDelivery(data) {
        const response = await fetch(`${this.url}/rest/v1/deliveries`, {
            method: 'POST',
            headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`Upsert failed: ${response.statusText}`);
        return response.json();
    }

    async clearAllDeliveries() {
        if (this.mode === 'api') return apiService.clearDeliveries();
        if (this.mode === 'direct') {
            const response = await fetch(`${this.url}/rest/v1/deliveries?id=neq.00000000-0000-0000-0000-000000000000`, {
                method: 'DELETE',
                headers: this.headers
            });
            if (!response.ok) throw new Error(`Clear failed: ${response.statusText}`);
        }
        return true;
    }

    // =========================================
    // Analytics
    // =========================================

    async getFullAnalytics(startDate, endDate) {
        if (this.mode === 'api') return apiService.getFullAnalytics(startDate, endDate);
        return null;
    }

    async getDeliveryStats(startDate, endDate) {
        if (this.mode === 'api') {
            const params = new URLSearchParams();
            if (startDate) params.append('date_from', startDate);
            if (endDate) params.append('date_to', endDate);
            const response = await fetch(`${apiService.baseUrl}${API_ENDPOINTS.STATS_DELIVERY}?${params}`);
            if (!response.ok) return null;
            return response.json();
        }
        return null;
    }

    async getPickupStats(startDate, endDate) {
        if (this.mode === 'api') {
            const params = new URLSearchParams();
            if (startDate) params.append('date_from', startDate);
            if (endDate) params.append('date_to', endDate);
            const response = await fetch(`${apiService.baseUrl}${API_ENDPOINTS.STATS_PICKUP}?${params}`);
            if (!response.ok) return null;
            return response.json();
        }
        return null;
    }

    async getTopCouriers(startDate, endDate, limit = 10) {
        if (this.mode === 'api') return apiService.getTopCouriers(startDate, endDate, limit);
        return [];
    }
}

// Export singleton
const dataService = new DataService();
export default dataService;
