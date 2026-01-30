-- =============================================
-- Seed Data for Testing
-- =============================================

-- Додаємо тестові зони
INSERT INTO zones (name) VALUES
    ('Київ-Центр'),
    ('Київ-Лівий берег'),
    ('Київ-Правий берег'),
    ('Бровари'),
    ('Вишневе'),
    ('Ірпінь')
ON CONFLICT (name) DO NOTHING;

-- Додаємо тестових курʼєрів
INSERT INTO couriers (full_name, vehicle_number) VALUES
    ('Іванов Іван Іванович', 'AA1234BB'),
    ('Петренко Петро Петрович', 'AA5678CC'),
    ('Сидоренко Сидір Сидорович', 'AA9012DD'),
    ('Коваленко Олександр Миколайович', 'AA3456EE'),
    ('Шевченко Тарас Григорович', 'AA7890FF'),
    ('Бондаренко Андрій Володимирович', 'AA1122GG'),
    ('Мельник Віктор Олексійович', 'AA3344HH'),
    ('Ткаченко Дмитро Сергійович', 'AA5566II')
ON CONFLICT DO NOTHING;

-- Генеруємо тестові доставки за останній місяць
-- (Цей скрипт можна запустити для швидкого тестування)

DO $$
DECLARE
    courier_rec RECORD;
    zone_rec RECORD;
    current_date DATE := CURRENT_DATE - INTERVAL '30 days';
    end_date DATE := CURRENT_DATE;
    loaded INT;
    delivered INT;
BEGIN
    WHILE current_date <= end_date LOOP
        -- Пропускаємо неділю
        IF EXTRACT(DOW FROM current_date) != 0 THEN
            FOR courier_rec IN SELECT id FROM couriers LOOP
                FOR zone_rec IN SELECT id FROM zones ORDER BY RANDOM() LIMIT 1 LOOP
                    -- Випадкова кількість завантажених (50-150)
                    loaded := 50 + floor(random() * 100)::INT;
                    -- Доставлено 85-100% від завантажених
                    delivered := floor(loaded * (0.85 + random() * 0.15))::INT;
                    
                    INSERT INTO deliveries (delivery_date, courier_id, zone_id, loaded_count, delivered_count)
                    VALUES (current_date, courier_rec.id, zone_rec.id, loaded, delivered)
                    ON CONFLICT (delivery_date, courier_id, zone_id) 
                    DO UPDATE SET 
                        loaded_count = EXCLUDED.loaded_count,
                        delivered_count = EXCLUDED.delivered_count;
                END LOOP;
            END LOOP;
        END IF;
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
END $$;

-- Перевірка
SELECT 'Zones:' as info, COUNT(*) as count FROM zones
UNION ALL
SELECT 'Couriers:', COUNT(*) FROM couriers
UNION ALL
SELECT 'Deliveries:', COUNT(*) FROM deliveries;
