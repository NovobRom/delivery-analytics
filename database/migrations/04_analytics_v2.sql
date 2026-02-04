-- =============================================
-- Analytics V2: Views and Functions for New Architecture
-- =============================================

-- 1. DAILY STATS VIEW (Aggregated by Date)
CREATE OR REPLACE VIEW v2_daily_stats AS
SELECT 
    report_date as date,
    COUNT(DISTINCT courier_name) as active_couriers,
    COUNT(*) as total_deliveries, -- Total attempts recorded
    COUNT(CASE WHEN delivery_status_on_date = 'Доставлено' THEN 1 END) as delivered_count,
    COUNT(CASE WHEN delivery_status_on_date = 'Не доставлено' THEN 1 END) as returned_count,
    ROUND(
        (COUNT(CASE WHEN delivery_status_on_date = 'Доставлено' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as success_rate
FROM delivery_events
GROUP BY report_date
ORDER BY report_date DESC;

-- 2. COURIER DAILY PERFORMANCE (Granular for Frontend Filtering)
-- Replaces old 'courier_performance' table usage
CREATE OR REPLACE VIEW v2_courier_daily_stats AS
SELECT 
    report_date,
    courier_name,
    COUNT(*) as total_assigned, -- loaded_count equivalent
    COUNT(CASE WHEN delivery_status_on_date = 'Доставлено' THEN 1 END) as delivered,
    COUNT(CASE WHEN delivery_status_on_date = 'Не доставлено' THEN 1 END) as returned,
    ROUND(
        (COUNT(CASE WHEN delivery_status_on_date = 'Доставлено' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as success_rate
FROM delivery_events
GROUP BY report_date, courier_name
ORDER BY report_date DESC;

-- 3. COURIER TOTAL PERFORMANCE (For Leaderboards)
CREATE OR REPLACE VIEW v2_courier_performance AS
SELECT 
    courier_name,
    COUNT(*) as total_assigned,
    COUNT(CASE WHEN delivery_status_on_date = 'Доставлено' THEN 1 END) as delivered,
    COUNT(CASE WHEN delivery_status_on_date = 'Не доставлено' THEN 1 END) as returned,
    ROUND(
        (COUNT(CASE WHEN delivery_status_on_date = 'Доставлено' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as success_rate,
    COUNT(CASE WHEN failure_reason IS NOT NULL AND failure_reason != '' THEN 1 END) as documented_failures
FROM delivery_events
GROUP BY courier_name;

-- 4. FAILURE REASONS BREAKDOWN
CREATE OR REPLACE VIEW v2_failure_reasons AS
SELECT 
    failure_reason,
    COUNT(*) as count,
    ROUND((COUNT(*)::DECIMAL / (SELECT COUNT(*) FROM delivery_events WHERE delivery_status_on_date = 'Не доставлено')) * 100, 2) as percentage
FROM delivery_events
WHERE delivery_status_on_date = 'Не доставлено'
GROUP BY failure_reason
ORDER BY count DESC;

-- 5. SHIPMENT OVERVIEW (Source A stats)
CREATE OR REPLACE VIEW v2_shipment_stats AS
SELECT 
    pickup_execution_date,
    COUNT(*) as total_shipments,
    SUM(total_weight_actual) as total_weight,
    SUM(delivery_cost) as total_cost,
    sender_country
FROM shipments
GROUP BY pickup_execution_date, sender_country;
