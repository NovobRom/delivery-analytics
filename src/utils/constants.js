/**
 * Constants and column mappings for Excel import
 * Delivery Analytics v2.0.0
 */

// File type detection markers
export const FILE_TYPE_MARKERS = {
    DELIVERY: ['К-сть доставлених ШК', 'ПІБ кур\'єра', 'Дата відомості', 'Номер авто'],
    PICKUP: ['Номер документу PickUp', 'Shipment', 'Країна відправника', 'Країна отримувача']
};

// Column mapping: Ukrainian Excel headers -> English DB fields
export const DELIVERY_COLUMN_MAP = {
    // Original Ukrainian -> English DB field
    '№': '_rowNumber',  // Ignored, auto-generated
    'Дата відомості': 'report_date',
    'ПІБ кур\'єра': 'courier_name',
    'Номер авто': 'car_number',
    'Підрозділ відомості': 'department',
    'К-сть відомостей': 'reports_count',
    'К-сть адрес': 'addresses_count',
    'К-сть завантажених ШК': 'loaded_parcels',
    'К-сть доставлених ШК на дату відомості': 'delivered_parcels',
    'К-сть доставлених ШК на дату відомості "В руки"': 'delivered_in_hand',
    'К-сть доставлених ШК на дату відомості "SafePlace"': 'delivered_safe_place',
    'К-сть недоставлених ШК на дату відомості': 'undelivered_parcels',
    'К-сть недоставлених ШК з причиною': 'undelivered_with_reason',
    'К-сть недоставлених ШК без причини': 'undelivered_no_reason',
    'Відсоток доставлених ШК': 'delivery_success_rate'
};

export const PICKUP_COLUMN_MAP = {
    '№': '_rowNumber',
    'Номер документу PickUp': 'pickup_doc_number',
    'Кількість шипментів у документі PickUp': 'shipments_in_doc',
    'Дата виконання документу PickUp': 'execution_date',
    'Замовлений часовий інтервал': 'time_interval',
    'Дата статусу документу PickUp «Створено»': '_created_status_date',
    'Час статусу документу PickUp «Створено»': '_created_status_time',
    'Джерело створення': 'creation_source',
    'Перший логістичний склад': 'first_warehouse',
    'Номер Shipment': 'shipment_number',
    'Кількість мість': 'places_count',
    'Дата створення Shipment': 'shipment_created_date',
    'Підрозділ створення Shipment': 'shipment_department',
    'Дата першого сканування в ОМ': 'first_scan_date',
    'Склад першого сканування': 'first_scan_warehouse',
    'Планова дата доставки (РДД)': 'planned_delivery_date',
    'Країна відправника': 'sender_country',
    'Тип відправника': 'sender_type',
    'Компанія відправник': 'sender_company',
    'Місто відправника': 'sender_city',
    'Адреса відправника': 'sender_address',
    'Тип відправлення': 'shipment_type',
    'Опис відправлення': 'shipment_description',
    'Оголошена вартість відправлення': 'declared_value',
    'Загальна фактична вага відправлення': 'actual_weight',
    'Загальна об\'ємна вага відправлення': 'volumetric_weight',
    'Довжина, см*Ширина, см*Висота, см': 'dimensions',
    'Країна отримувача': 'recipient_country',
    'Тип отримувача': 'recipient_type',
    'Останній статус документу PickUp': 'pickup_status',
    'Дата останнього статусу документу PickUp': 'pickup_status_date',
    'Прізвище та ім\'я кур\'єра': 'courier_name',
    'Номер заявки на забір партнера першої милі': 'partner_pickup_number',
    'Номер шипменту партнера першої милі': 'partner_shipment_number',
    'Вартість доставки': 'delivery_cost',
    'Платник': 'payer',
    'Номер документу оплати': 'payment_doc_number',
    'Останній статус документу оплати': 'payment_doc_status',
    'Дата останнього статусу документу оплати': 'payment_doc_status_date',
    'Статус оплати Shipment': 'shipment_payment_status',
    'Дата отримання статусу оплати в Shipment': 'shipment_payment_date',
    'Останній статус Shipment': 'shipment_status',
    'Дата останнього статусу Shipment': 'shipment_status_date',
    'Результат перевірки відправлення': 'verification_result',
    'Дата приймання відправлення': 'acceptance_date',
    'Дата останнього сканування в ОМ': 'last_scan_date',
    'Підрозділ останнього сканування в ОМ': 'last_scan_department',
    'Номер, назва та статус відомості останнього сканування': 'last_scan_report',
    'Швидкість виконання': 'execution_speed',
    'Причини не виконання загалом/день-в-день': 'non_execution_reason'
};

// Date format patterns for parsing
export const DATE_PATTERNS = [
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, format: 'DD-MM-YYYY' },           // 03-02-2025
    { regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, format: 'DD.MM.YYYY' },         // 27.01.2026
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: 'YYYY-MM-DD' },           // 2025-02-03 (ISO)
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, format: 'DD/MM/YYYY' },         // 03/02/2025
];

// Currency extraction pattern (e.g., "4.66 EUR" -> { amount: 4.66, currency: "EUR" })
export const CURRENCY_PATTERN = /^([\d.,]+)\s*([A-Z]{3})?$/;

// File types enum
export const FILE_TYPES = {
    DELIVERY: 'delivery',
    PICKUP: 'pickup',
    UNKNOWN: 'unknown'
};

// API endpoints
export const API_ENDPOINTS = {
    COURIER_PERFORMANCE: '/courier-performance',
    PICKUP_ORDERS: '/pickup-orders',
    BULK_IMPORT_DELIVERY: '/courier-performance/bulk-import',
    BULK_IMPORT_PICKUP: '/pickup-orders/bulk-import',
    STATS_DELIVERY: '/courier-performance/stats/summary',
    STATS_PICKUP: '/pickup-orders/stats/summary',
};

// Default values
export const DEFAULTS = {
    CURRENCY: 'UAH',
    LIMIT: 100,
    DATE_FORMAT: 'YYYY-MM-DD'
};
