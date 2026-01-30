-- =============================================
-- Delivery Analytics Database Schema
-- Supabase (PostgreSQL)
-- =============================================

-- Таблиця зон/підрозділів
CREATE TABLE zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблиця курʼєрів
CREATE TABLE couriers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    vehicle_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Індекс для швидкого пошуку по імені
CREATE INDEX idx_couriers_name ON couriers(full_name);

-- Основна таблиця доставок
CREATE TABLE deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_date DATE NOT NULL,
    courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    loaded_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Унікальне обмеження: один запис на курʼєра на день на зону
    CONSTRAINT unique_delivery UNIQUE (delivery_date, courier_id, zone_id)
);

-- Індекси для швидких запитів
CREATE INDEX idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX idx_deliveries_courier ON deliveries(courier_id);
CREATE INDEX idx_deliveries_zone ON deliveries(zone_id);
CREATE INDEX idx_deliveries_date_range ON deliveries(delivery_date DESC);

-- Таблиця імпортів (для відстеження завантажень)
CREATE TABLE imports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name VARCHAR(255),
    records_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed', -- completed, failed, partial
    error_message TEXT,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID -- для майбутньої авторизації
);

-- =============================================
-- Представлення (Views) для аналітики
-- =============================================

-- Денна статистика
CREATE OR REPLACE VIEW daily_stats AS
SELECT 
    delivery_date,
    COUNT(DISTINCT courier_id) as active_couriers,
    SUM(loaded_count) as total_loaded,
    SUM(delivered_count) as total_delivered,
    ROUND(
        CASE 
            WHEN SUM(loaded_count) > 0 
            THEN (SUM(delivered_count)::DECIMAL / SUM(loaded_count)) * 100 
            ELSE 0 
        END, 2
    ) as success_rate
FROM deliveries
GROUP BY delivery_date
ORDER BY delivery_date DESC;

-- Статистика по курʼєрах
CREATE OR REPLACE VIEW courier_stats AS
SELECT 
    c.id,
    c.full_name,
    c.vehicle_number,
    COUNT(d.id) as total_deliveries,
    SUM(d.loaded_count) as total_loaded,
    SUM(d.delivered_count) as total_delivered,
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
LEFT JOIN deliveries d ON c.id = d.courier_id
GROUP BY c.id, c.full_name, c.vehicle_number
ORDER BY success_rate DESC;

-- Статистика по зонах
CREATE OR REPLACE VIEW zone_stats AS
SELECT 
    z.id,
    z.name,
    COUNT(d.id) as total_deliveries,
    SUM(d.loaded_count) as total_loaded,
    SUM(d.delivered_count) as total_delivered,
    ROUND(
        CASE 
            WHEN SUM(d.loaded_count) > 0 
            THEN (SUM(d.delivered_count)::DECIMAL / SUM(d.loaded_count)) * 100 
            ELSE 0 
        END, 2
    ) as success_rate
FROM zones z
LEFT JOIN deliveries d ON z.id = d.zone_id
GROUP BY z.id, z.name
ORDER BY total_loaded DESC;

-- =============================================
-- Row Level Security (RLS) - для майбутнього
-- =============================================

-- Увімкнути RLS (розкоментувати коли додасте авторизацію)
-- ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Функції
-- =============================================

-- Функція для отримання статистики за період
CREATE OR REPLACE FUNCTION get_period_stats(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    total_loaded BIGINT,
    total_delivered BIGINT,
    success_rate DECIMAL,
    active_couriers BIGINT,
    delivery_days BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(d.loaded_count), 0)::BIGINT,
        COALESCE(SUM(d.delivered_count), 0)::BIGINT,
        ROUND(
            CASE 
                WHEN SUM(d.loaded_count) > 0 
                THEN (SUM(d.delivered_count)::DECIMAL / SUM(d.loaded_count)) * 100 
                ELSE 0 
            END, 2
        ),
        COUNT(DISTINCT d.courier_id)::BIGINT,
        COUNT(DISTINCT d.delivery_date)::BIGINT
    FROM deliveries d
    WHERE d.delivery_date BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Функція для отримання топ курʼєрів за період
CREATE OR REPLACE FUNCTION get_top_couriers(
    start_date DATE,
    end_date DATE,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    courier_id UUID,
    full_name VARCHAR,
    vehicle_number VARCHAR,
    total_loaded BIGINT,
    total_delivered BIGINT,
    success_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.full_name,
        c.vehicle_number,
        SUM(d.loaded_count)::BIGINT,
        SUM(d.delivered_count)::BIGINT,
        ROUND(
            CASE 
                WHEN SUM(d.loaded_count) > 0 
                THEN (SUM(d.delivered_count)::DECIMAL / SUM(d.loaded_count)) * 100 
                ELSE 0 
            END, 2
        )
    FROM couriers c
    JOIN deliveries d ON c.id = d.courier_id
    WHERE d.delivery_date BETWEEN start_date AND end_date
    GROUP BY c.id, c.full_name, c.vehicle_number
    HAVING SUM(d.loaded_count) > 0
    ORDER BY 6 DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
