// =============================================
// Data Service v2.0
// Supports: Direct Supabase + localStorage fallback
// =============================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

class DataService {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_ANON_KEY;
        this.headers = {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
        this.mode = 'local';
    }

    /**
     * Check connection to Supabase
     */
    async checkConnection() {
        if (!this.url || !this.key) {
            console.log('📁 No Supabase config, using localStorage');
            this.mode = 'local';
            return 'local';
        }

        try {
            const response = await fetch(`${this.url}/rest/v1/`, {
                method: 'HEAD',
                headers: this.headers
            });

            if (response.ok || response.status === 404) {
                this.mode = 'direct';
                console.log('✅ Connected to Supabase');
                return 'direct';
            }
        } catch (e) {
            console.log('⚠️ Supabase connection failed:', e.message);
        }

        this.mode = 'local';
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
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Fetch failed: ${response.status} - ${error}`);
        }
        return response.json();
    }

    async insertDirect(table, data) {
        if (!this.url) throw new Error('Supabase not configured');
        const response = await fetch(`${this.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Insert failed: ${response.status} - ${error}`);
        }
        return response.json();
    }

    // =========================================
    // Courier Performance (Delivery data)
    // =========================================

    async getCourierPerformance(filters = {}) {
        if (this.mode !== 'direct') return [];

        try {
            let query = '?order=report_date.desc&limit=1000';
            if (filters.startDate) query += `&report_date=gte.${filters.startDate}`;
            if (filters.endDate) query += `&report_date=lte.${filters.endDate}`;
            return await this.fetchDirect('courier_performance', query);
        } catch (e) {
            console.error('getCourierPerformance error:', e);
            return [];
        }
    }

    async importCourierPerformance(records) {
        if (this.mode !== 'direct') {
            return { imported: 0, failed: records.length, errors: ['No database connection'] };
        }

        try {
            const result = await this.insertDirect('courier_performance', records);
            return { imported: result.length || records.length, failed: 0, errors: [] };
        } catch (e) {
            console.error('Import error:', e);
            return { imported: 0, failed: records.length, errors: [e.message] };
        }
    }

    // =========================================
    // Pickup Orders
    // =========================================

    async getPickupOrders(filters = {}) {
        if (this.mode !== 'direct') return [];

        try {
            let query = '?order=execution_date.desc&limit=1000';
            if (filters.startDate) query += `&execution_date=gte.${filters.startDate}`;
            if (filters.endDate) query += `&execution_date=lte.${filters.endDate}`;
            return await this.fetchDirect('pickup_orders', query);
        } catch (e) {
            console.error('getPickupOrders error:', e);
            return [];
        }
    }

    async importPickupOrders(records) {
        if (this.mode !== 'direct') {
            return { imported: 0, failed: records.length, errors: ['No database connection'] };
        }

        try {
            const result = await this.insertDirect('pickup_orders', records);
            return { imported: result.length || records.length, failed: 0, errors: [] };
        } catch (e) {
            console.error('Import error:', e);
            return { imported: 0, failed: records.length, errors: [e.message] };
        }
    }

    // =========================================
    // Clear Data
    // =========================================

    async clearAllDeliveries() {
        if (this.mode !== 'direct') return false;

        try {
            const response = await fetch(`${this.url}/rest/v1/courier_performance?id=neq.00000000-0000-0000-0000-000000000000`, {
                method: 'DELETE',
                headers: this.headers
            });
            return response.ok;
        } catch (e) {
            console.error('Clear error:', e);
            return false;
        }
    }

    async clearAllPickups() {
        if (this.mode !== 'direct') return false;

        try {
            const response = await fetch(`${this.url}/rest/v1/pickup_orders?id=neq.00000000-0000-0000-0000-000000000000`, {
                method: 'DELETE',
                headers: this.headers
            });
            return response.ok;
        } catch (e) {
            console.error('Clear error:', e);
            return false;
        }
    }
}

// Export singleton
const dataService = new DataService();
export default dataService;
