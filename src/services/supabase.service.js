// =============================================
// Data Service
// Supports both Backend API and direct Supabase
// =============================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';
import apiService from './api.service.js';

class DataService {
    constructor() {
        // Supabase direct access config
        this.url = SUPABASE_URL;
        this.key = SUPABASE_ANON_KEY;
        this.headers = {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        // Mode: 'api' (recommended) or 'direct' (legacy)
        this.mode = 'api';
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
            console.log('⚠️ Backend API not available, trying direct Supabase...');
        }

        // Then try direct Supabase
        try {
            await this.fetchDirect('zones', '?limit=1');
            this.mode = 'direct';
            console.log('✅ Connected to Supabase directly');
            return 'direct';
        } catch (e) {
            console.log('⚠️ Supabase not available, using localStorage');
        }

        return 'local';
    }

    // =========================================
    // Direct Supabase methods (legacy)
    // =========================================

    async fetchDirect(table, query = '') {
        const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
            headers: this.headers
        });
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        return response.json();
    }

    async insertDirect(table, data) {
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
        if (this.mode === 'api') {
            return apiService.getZones();
        }
        return this.fetchDirect('zones', '?order=name');
    }

    async getCouriers() {
        if (this.mode === 'api') {
            return apiService.getCouriers();
        }
        return this.fetchDirect('couriers', '?order=full_name');
    }

    async getDeliveries(filters = {}) {
        if (this.mode === 'api') {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.courierId) params.courier_id = filters.courierId;
            if (filters.zoneId) params.zone_id = filters.zoneId;

            const data = await apiService.getDeliveries(params);

            // Transform API response to match expected format
            return data.map(d => ({
                id: d.id,
                delivery_date: d.delivery_date,
                loaded_count: d.loaded_count,
                delivered_count: d.delivered_count,
                courier_id: d.courier_id,
                zone_id: d.zone_id,
                couriers: d.courier_name ? {
                    full_name: d.courier_name,
                    vehicle_number: d.vehicle_number
                } : null,
                zones: d.zone_name ? { name: d.zone_name } : null
            }));
        }

        // Direct Supabase query
        let query = '?select=*,couriers(full_name,vehicle_number),zones(name)';
        if (filters.startDate) query += `&delivery_date=gte.${filters.startDate}`;
        if (filters.endDate) query += `&delivery_date=lte.${filters.endDate}`;
        if (filters.courierId) query += `&courier_id=eq.${filters.courierId}`;
        if (filters.zoneId) query += `&zone_id=eq.${filters.zoneId}`;
        query += '&order=delivery_date.desc';

        return this.fetchDirect('deliveries', query);
    }

    /**
     * Import deliveries from parsed Excel
     */
    async importDeliveries(records, onProgress = null) {
        if (this.mode === 'api') {
            // Use bulk import API
            const result = await apiService.importDeliveries(records);

            // Call progress callback with 100%
            if (onProgress) {
                onProgress({ current: records.length, total: records.length, percent: 100 });
            }

            return {
                success: result.imported_records,
                failed: result.skipped_records,
                errors: result.errors.map(e => ({ error: e }))
            };
        }

        // Legacy: direct Supabase import (one by one)
        return this._importDirectly(records, onProgress);
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
        if (this.mode === 'api') {
            return apiService.clearDeliveries();
        }

        const response = await fetch(`${this.url}/rest/v1/deliveries?id=neq.00000000-0000-0000-0000-000000000000`, {
            method: 'DELETE',
            headers: this.headers
        });
        if (!response.ok) throw new Error(`Clear failed: ${response.statusText}`);
        return true;
    }

    // =========================================
    // Analytics (API only)
    // =========================================

    async getFullAnalytics(startDate, endDate) {
        if (this.mode === 'api') {
            return apiService.getFullAnalytics(startDate, endDate);
        }
        return null;
    }

    async getTopCouriers(startDate, endDate, limit = 10) {
        if (this.mode === 'api') {
            return apiService.getTopCouriers(startDate, endDate, limit);
        }
        return this._callFunction('get_top_couriers', { start_date: startDate, end_date: endDate, limit_count: limit });
    }

    async comparePeriods(p1Start, p1End, p2Start, p2End) {
        if (this.mode === 'api') {
            return apiService.comparePeriods(p1Start, p1End, p2Start, p2End);
        }
        return null;
    }

    async _callFunction(functionName, params = {}) {
        const response = await fetch(`${this.url}/rest/v1/rpc/${functionName}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(params)
        });
        if (!response.ok) throw new Error(`RPC failed: ${response.statusText}`);
        return response.json();
    }
}

// Export singleton (keep same name for backward compatibility)
const supabaseService = new DataService();
export default supabaseService;
