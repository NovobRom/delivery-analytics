# 🔧 Налаштування Supabase

Покрокова інструкція для підключення бази даних Supabase до Delivery Analytics Pro.

## 1. Створення проекту Supabase

1. Перейди на [supabase.com](https://supabase.com)
2. Натисни **"Start your project"** (Sign up якщо ще немає акаунту)
3. Натисни **"New project"**
4. Заповни форму:
   - **Name:** `delivery-analytics` (або своя назва)
   - **Database Password:** створи надійний пароль (збережи його!)
   - **Region:** обери найближчий (наприклад, `Frankfurt`)
5. Натисни **"Create new project"**
6. Зачекай 2-3 хвилини поки проект створюється

## 2. Створення таблиць

1. В меню зліва натисни **"SQL Editor"**
2. Натисни **"New query"**
3. Скопіюй весь вміст файлу `database/schema.sql`
4. Натисни **"Run"** (або Ctrl+Enter)
5. Перевір що всі таблиці створились: зайди в **"Table Editor"** зліва

### Перевірка таблиць

Ти маєш побачити такі таблиці:
- `zones` - зони доставки
- `couriers` - курʼєри
- `deliveries` - записи доставок
- `imports` - історія імпортів

І такі views:
- `daily_stats`
- `courier_stats`
- `zone_stats`

## 3. Додавання тестових даних (опціонально)

1. Відкрий **"SQL Editor"**
2. Створи новий запит
3. Скопіюй вміст файлу `database/seed.sql`
4. Натисни **"Run"**

## 4. Отримання API ключів

1. В меню зліва натисни **"Project Settings"** (значок шестірні внизу)
2. Перейди в розділ **"API"**
3. Знайди:
   - **Project URL** — це твій `SUPABASE_URL`
   - **anon public** key — це твій `SUPABASE_ANON_KEY`

## 5. Налаштування проекту

1. Скопіюй файл конфігурації:
```bash
cp src/config/supabase.example.js src/config/supabase.js
```

2. Відкрий `src/config/supabase.js` і заміни значення:

```javascript
const SUPABASE_URL = 'https://abcdefghijk.supabase.co';  // твій URL
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';  // твій ключ

export { SUPABASE_URL, SUPABASE_ANON_KEY };
```

## 6. Налаштування доступу (Row Level Security)

За замовчуванням RLS вимкнено для простоти розробки. Для production рекомендуємо увімкнути.

### Базовий публічний доступ (для тестування)

Виконай в SQL Editor:

```sql
-- Дозволити читання всім
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON zones FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON couriers FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON deliveries FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON zones FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON couriers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON deliveries FOR INSERT WITH CHECK (true);
```

## 7. Перевірка підключення

1. Відкрий `index.html` в браузері
2. Дивись на індикатор підключення біля логотипу:
   - 🟢 **"Online"** — Supabase підключено
   - ⚪ **"Local"** — працює з localStorage

3. Завантаж Excel файл і перевір що дані з'являються в Supabase:
   - Зайди в **Table Editor** → **deliveries**

## 🔒 Безпека

⚠️ **ВАЖЛИВО:**

- Ніколи не комітай файл `src/config/supabase.js` в Git
- Використовуй environment variables для production
- Увімкни RLS перед виходом в production
- Регулярно оновлюй ключі доступу

## 🆘 Проблеми?

### Помилка "Failed to fetch"
- Перевір що URL правильний (без пробілів, зі `https://`)
- Перевір що ключ правильний (довгий рядок починається з `eyJ`)

### Помилка "permission denied"
- Перевір що RLS політики створені
- Або тимчасово вимкни RLS для тестування

### Дані не зберігаються
- Перевір в Network tab браузера статус запитів
- Подивись відповідь сервера на помилки

## 📚 Корисні посилання

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
