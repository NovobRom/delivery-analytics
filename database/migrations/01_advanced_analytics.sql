-- Advanced Analytics Functions
-- Run this in your Supabase SQL Editor

-- Function to get courier performance for a specific period
CREATE OR REPLACE FUNCTION get_courier_stats_period(
    start_date DATE,
    end_date DATE,
    min_deliveries INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    full_name VARCHAR,
    vehicle_number VARCHAR,
    total_deliveries BIGINT,
    total_loaded BIGINT,
    total_delivered BIGINT,
    success_rate DECIMAL,
    first_delivery DATE,
    last_delivery DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.full_name,
        c.vehicle_number,
        COUNT(d.id)::BIGINT as total_deliveries,
        SUM(d.loaded_count)::BIGINT as total_loaded,
        SUM(d.delivered_count)::BIGINT as total_delivered,
        ROUND(
            CASE 
                WHEN SUM(d.loaded_count) > 0 
                THEN (SUM(d.delivered_count)::DECIMAL / SUM(d.loaded_count)) * 100 
                ELSE 0 
            END, 2
        ) as success_rate,
        MIN(d.delivery_date) as first_delivery,
        MAX(d.delivery_date) as last_delivery
    FROM couriers c
    JOIN deliveries d ON c.id = d.courier_id
    WHERE d.delivery_date BETWEEN start_date AND end_date
    GROUP BY c.id, c.full_name, c.vehicle_number
    HAVING COUNT(d.id) >= min_deliveries
    ORDER BY success_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get zone performance for a specific period
CREATE OR REPLACE FUNCTION get_zone_stats_period(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    total_deliveries BIGINT,
    total_loaded BIGINT,
    total_delivered BIGINT,
    success_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        z.id,
        z.name,
        COUNT(d.id)::BIGINT as total_deliveries,
        SUM(d.loaded_count)::BIGINT as total_loaded,
        SUM(d.delivered_count)::BIGINT as total_delivered,
        ROUND(
            CASE 
                WHEN SUM(d.loaded_count) > 0 
                THEN (SUM(d.delivered_count)::DECIMAL / SUM(d.loaded_count)) * 100 
                ELSE 0 
            END, 2
        ) as success_rate
    FROM zones z
    JOIN deliveries d ON z.id = d.zone_id
    WHERE d.delivery_date BETWEEN start_date AND end_date
    GROUP BY z.id, z.name
    ORDER BY total_loaded DESC;
END;
$$ LANGUAGE plpgsql;
