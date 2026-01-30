// =============================================
// Backend API Service
// Communicates with FastAPI backend
// =============================================

const API_BASE_URL = 'http://localhost:8000';

class ApiService {
    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    // =========================================
    // Generic HTTP methods
    // =========================================

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        const response = await fetch(url, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(error.detail || `Request failed: ${response.status}`);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    async get(endpoint, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${endpoint}?${query}` : endpoint;
        return this.request(url);
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${endpoint}?${query}` : endpoint;
        return this.request(url, { method: 'DELETE' });
    }

    // =========================================
    // Health Check
    // =========================================

    async healthCheck() {
        return this.get('/');
    }

    // =========================================
    // Couriers
    // =========================================

    async getCouriers(params = {}) {
        return this.get('/api/couriers', params);
    }

    async getCourier(id) {
        return this.get(`/api/couriers/${id}`);
    }

    async createCourier(data) {
        return this.post('/api/couriers', data);
    }

    async updateCourier(id, data) {
        return this.patch(`/api/couriers/${id}`, data);
    }

    async deleteCourier(id) {
        return this.delete(`/api/couriers/${id}`);
    }

    // =========================================
    // Zones
    // =========================================

    async getZones(params = {}) {
        return this.get('/api/zones', params);
    }

    async createZone(data) {
        return this.post('/api/zones', data);
    }

    // =========================================
    // Deliveries
    // =========================================

    async getDeliveries(params = {}) {
        return this.get('/api/deliveries', params);
    }

    async getDelivery(id) {
        return this.get(`/api/deliveries/${id}`);
    }

    async createDelivery(data) {
        return this.post('/api/deliveries', data);
    }

    async updateDelivery(id, data) {
        return this.patch(`/api/deliveries/${id}`, data);
    }

    async deleteDelivery(id) {
        return this.delete(`/api/deliveries/${id}`);
    }

    /**
     * Bulk import deliveries
     * Automatically creates couriers and zones if they don't exist
     */
    async importDeliveries(records) {
        // Transform records to API format
        const apiRecords = records.map(r => ({
            delivery_date: r.deliveryDate,
            courier_name: r.courierName,
            vehicle_number: r.vehicleNumber || null,
            zone_name: r.zoneName,
            loaded_count: r.loadedCount,
            delivered_count: r.deliveredCount
        }));

        return this.post('/api/deliveries/import', apiRecords);
    }

    async clearDeliveries(params = {}) {
        return this.delete('/api/deliveries', { ...params, confirm: true });
    }

    // =========================================
    // Analytics
    // =========================================

    async getAnalyticsSummary(startDate, endDate) {
        return this.get('/api/analytics/summary', {
            start_date: startDate,
            end_date: endDate
        });
    }

    async getDailyStats(startDate, endDate) {
        return this.get('/api/analytics/daily', {
            start_date: startDate,
            end_date: endDate
        });
    }

    async getTopCouriers(startDate, endDate, limit = 10) {
        return this.get('/api/analytics/top-couriers', {
            start_date: startDate,
            end_date: endDate,
            limit
        });
    }

    async getZoneStats(startDate, endDate) {
        return this.get('/api/analytics/zones', {
            start_date: startDate,
            end_date: endDate
        });
    }

    async getCourierStats(startDate, endDate) {
        return this.get('/api/analytics/couriers', {
            start_date: startDate,
            end_date: endDate
        });
    }

    /**
     * Get full analytics in one request (for dashboard)
     */
    async getFullAnalytics(startDate, endDate) {
        return this.get('/api/analytics/full', {
            start_date: startDate,
            end_date: endDate
        });
    }

    /**
     * Compare two periods
     */
    async comparePeriods(period1Start, period1End, period2Start, period2End) {
        return this.get('/api/analytics/compare', {
            period1_start: period1Start,
            period1_end: period1End,
            period2_start: period2Start,
            period2_end: period2End
        });
    }

    // =========================================
    // Insights
    // =========================================

    async getInsights(startDate, endDate) {
        return this.get('/api/analytics/insights', {
            start_date: startDate,
            end_date: endDate
        });
    }
}

// Export singleton
const apiService = new ApiService();
export default apiService;
