/**
 * Constants and column mappings for Excel import (V2 Architecture)
 * Delivery Analytics v2.1.0
 */

// File type detection markers
export const FILE_TYPE_MARKERS = {
    // Source B: Detailed Delivery Data (Operational Events)
    EVENTS: ['Номер відомості завантаження кур\'єра', 'Підрозділ відомості', 'Статус доставки на дату відомості', 'Причина недоставки'],
    // Source A: Pickup Aggregation (Base Shipments)
    SHIPMENTS: ['Номер документу PickUp', 'Кількість шипментів у документі PickUp', 'Замовлений часовий інтервал', 'Тип відправлення']
};

export const FILE_TYPES = {
    EVENTS: 'events',       // Operational Delivery Events
    SHIPMENTS: 'shipments', // Base Shipment Data
    UNKNOWN: 'unknown'
};

// API endpoints
export const API_ENDPOINTS = {
    INGEST_SHIPMENTS: '/api/ingest/shipments',
    INGEST_EVENTS: '/api/ingest/events',

    // Analytics endpoints
    ANALYTICS: '/api/analytics',
    STATS_DELIVERY: '/api/analytics/v2/delivery/summary',
    STATS_DELIVERY_COURIERS: '/api/analytics/v2/delivery/couriers',
    STATS_PICKUP: '/api/analytics/v2/pickup/summary',
};

// Date format patterns for parsing
export const DATE_PATTERNS = [
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, format: 'DD-MM-YYYY' },           // 03-02-2025
    { regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, format: 'DD.MM.YYYY' },         // 27.01.2026
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: 'YYYY-MM-DD' },           // 2025-02-03 (ISO)
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, format: 'DD/MM/YYYY' },         // 03/02/2025
];

// Currency extraction pattern
export const CURRENCY_PATTERN = /^([\d.,]+)\s*([A-Z]{3})?$/;

// Default values
export const DEFAULTS = {
    CURRENCY: 'UAH',
    LIMIT: 100,
    DATE_FORMAT: 'YYYY-MM-DD'
};

// Legacy Column Maps (Kept for reference or backward compatibility if needed, 
// strictly speaking V2 parsing logic is moved to backend but frontend might still need hints)
export const DELIVERY_COLUMN_MAP = {};
export const PICKUP_COLUMN_MAP = {};
