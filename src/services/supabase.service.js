// =============================================
// Supabase Database Service
// =============================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

class SupabaseService {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_ANON_KEY;
        this.headers = {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    // =========================================
    // Generic REST methods
    // =========================================
    
    async fetch(table, query = '') {
        const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
            headers: this.headers
        });
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        return response.json();
    }

    async insert(table, data) {
        const response = await fetch(`${this.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`Insert failed: ${response.statusText}`);
        return response.json();
    }

    async update(table, id, data) {
        const response = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
            method: 'PATCH',
            headers: this.headers,
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`Update failed: ${response.statusText}`);
        return response.json();
    }

    async delete(table, id) {
        const response = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
            method: 'DELETE',
            headers: this.headers
        });
        if (!response.ok) throw new Error(`Delete failed: ${response.statusText}`);
        return true;
    }

    // =========================================
    // Couriers
    // =========================================

    async getCouriers() {
        return this.fetch('couriers', '?order=full_name');
    }

    async getCourierByName(name) {
        const encoded = encodeURIComponent(name);
        return this.fetch('couriers', `?full_name=eq.${encoded}`);
    }

    async createCourier(fullName, vehicleNumber = null) {
        return this.insert('couriers', {
            full_name: fullName,
            vehicle_number: vehicleNumber
        });
    }

    async getOrCreateCourier(fullName, vehicleNumber = null) {
        const existing = await this.getCourierByName(fullName);
        if (existing && existing.length > 0) {
            return existing[0];
        }
        const created = await this.createCourier(fullName, vehicleNumber);
        return created[0];
    }

    // =========================================
    // Zones
    // =========================================

    async getZones() {
        return this.fetch('zones', '?order=name');
    }

    async getZoneByName(name) {
        const encoded = encodeURIComponent(name);
        return this.fetch('zones', `?name=eq.${encoded}`);
    }

    async createZone(name) {
        return this.insert('zones', { name });
    }

    async getOrCreateZone(name) {
        if (!name) return null;
        const existing = await this.getZoneByName(name);
        if (existing && existing.length > 0) {
            return existing[0];
        }
        const created = await this.createZone(name);
        return created[0];
    }

    // =========================================
    // Deliveries
    // =========================================

    async getDeliveries(filters = {}) {
        let query = '?select=*,couriers(full_name,vehicle_number),zones(name)';
        
        if (filters.startDate) {
            query += `&delivery_date=gte.${filters.startDate}`;
        }
        if (filters.endDate) {
            query += `&delivery_date=lte.${filters.endDate}`;
        }
        if (filters.courierId) {
            query += `&courier_id=eq.${filters.courierId}`;
        }
        if (filters.zoneId) {
            query += `&zone_id=eq.${filters.zoneId}`;
        }
        
        query += '&order=delivery_date.desc';
        
        return this.fetch('deliveries', query);
    }

    async createDelivery(data) {
        return this.insert('deliveries', {
            delivery_date: data.deliveryDate,
            courier_id: data.courierId,
            zone_id: data.zoneId,
            loaded_count: data.loadedCount,
            delivered_count: data.deliveredCount
        });
    }

    async upsertDelivery(data) {
        // Use upsert to avoid duplicates
        const response = await fetch(`${this.url}/rest/v1/deliveries`, {
            method: 'POST',
            headers: {
                ...this.headers,
                'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify({
                delivery_date: data.deliveryDate,
                courier_id: data.courierId,
                zone_id: data.zoneId,
                loaded_count: data.loadedCount,
                delivered_count: data.deliveredCount
            })
        });
        if (!response.ok) throw new Error(`Upsert failed: ${response.statusText}`);
        return response.json();
    }

    /**
     * Deletes all records from the deliveries table
     */
    async clearAllDeliveries() {
        // Filter id is not null to delete all rows (PostgREST requirement for safety)
        const response = await fetch(`${this.url}/rest/v1/deliveries?id=neq.00000000-0000-0000-0000-000000000000`, {
            method: 'DELETE',
            headers: this.headers
        });
        if (!response.ok) throw new Error(`Clear failed: ${response.statusText}`);
        return true;
    }

    // =========================================
    // Statistics (Views)
    // =========================================

    async getDailyStats(startDate, endDate) {
        let query = '?order=delivery_date.desc';
        if (startDate) query += `&delivery_date=gte.${startDate}`;
        if (endDate) query += `&delivery_date=lte.${endDate}`;
        return this.fetch('daily_stats', query);
    }

    async getCourierStats() {
        return this.fetch('courier_stats', '?order=success_rate.desc');
    }

    async getZoneStats() {
        return this.fetch('zone_stats', '?order=total_loaded.desc');
    }

    // =========================================
    // RPC Functions
    // =========================================

    async callFunction(functionName, params = {}) {
        const response = await fetch(`${this.url}/rest/v1/rpc/${functionName}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(params)
        });
        if (!response.ok) throw new Error(`RPC failed: ${response.statusText}`);
        return response.json();
    }

    async getPeriodStats(startDate, endDate) {
        return this.callFunction('get_period_stats', {
            start_date: startDate,
            end_date: endDate
        });
    }

    async getTopCouriers(startDate, endDate, limit = 10) {
        return this.callFunction('get_top_couriers', {
            start_date: startDate,
            end_date: endDate,
            limit_count: limit
        });
    }

    // =========================================
    // Bulk Import
    // =========================================

    async importDeliveries(records, onProgress = null) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            
            try {
                // Get or create courier
                const courier = await this.getOrCreateCourier(
                    record.courierName,
                    record.vehicleNumber
                );

                // Get or create zone
                const zone = record.zoneName 
                    ? await this.getOrCreateZone(record.zoneName)
                    : null;

                // Create delivery record
                await this.upsertDelivery({
                    deliveryDate: record.deliveryDate,
                    courierId: courier.id,
                    zoneId: zone?.id || null,
                    loadedCount: record.loadedCount,
                    deliveredCount: record.deliveredCount
                });

                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    record,
                    error: error.message
                });
            }

            // Progress callback
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
}

// Export singleton
const supabaseService = new SupabaseService();
export default supabaseService;