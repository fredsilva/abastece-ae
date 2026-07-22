-- Abastece Aê — schema inicial (Etapa 0)
-- Ver PLANO-MVP.md na raiz do repositório para o desenho completo (ranking, anti-fraude, etc.)

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  name TEXT,
  avatar_url TEXT,
  trust_score INTEGER DEFAULT 50,
  default_fuel_tab TEXT DEFAULT 'gasolina' CHECK(default_fuel_tab IN ('gasolina','etanol','diesel')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active','shadow_banned','banned')),
  created_at TEXT DEFAULT (datetime('now')),
  last_active_at TEXT
);

CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL CHECK(provider IN ('email','google','apple')),
  provider_subject TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, provider_subject)
);

CREATE TABLE magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  refresh_token_hash TEXT NOT NULL,
  device_id TEXT,
  platform TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  revoked_at TEXT
);

CREATE TABLE gas_stations (
  id TEXT PRIMARY KEY,
  cnpj TEXT UNIQUE,
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  brand TEXT,
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  city_id TEXT NOT NULL,
  source TEXT CHECK(source IN ('anp_seed','user_submitted','admin')) DEFAULT 'anp_seed',
  verified INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','pending_review')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX idx_stations_city ON gas_stations(city_id, status);

CREATE TABLE fuel_prices (
  gas_station_id TEXT NOT NULL REFERENCES gas_stations(id),
  fuel_type TEXT NOT NULL CHECK(fuel_type IN ('gasolina','etanol','diesel')),
  price REAL NOT NULL,
  previous_price REAL,
  price_changed_at TEXT NOT NULL,
  last_reported_at TEXT NOT NULL,
  pix_discount INTEGER DEFAULT 0,
  cash_discount INTEGER DEFAULT 0,
  confidence_score REAL DEFAULT 1.0,
  last_drop_notified_at TEXT,
  PRIMARY KEY (gas_station_id, fuel_type)
);

CREATE TABLE price_reports (
  id TEXT PRIMARY KEY,
  gas_station_id TEXT NOT NULL REFERENCES gas_stations(id),
  fuel_type TEXT NOT NULL,
  price REAL NOT NULL,
  reported_by_user_id TEXT NOT NULL REFERENCES users(id),
  report_type TEXT CHECK(report_type IN ('fill_up','manual_report')),
  pix_discount INTEGER DEFAULT 0,
  cash_discount INTEGER DEFAULT 0,
  device_id TEXT NOT NULL,
  gps_lat REAL,
  gps_lng REAL,
  gps_accuracy_m REAL,
  distance_from_station_m REAL,
  status TEXT DEFAULT 'accepted' CHECK(status IN ('accepted','pending_review','rejected_outlier')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_reports_station_fuel_time ON price_reports(gas_station_id, fuel_type, created_at DESC);
CREATE INDEX idx_reports_user_time ON price_reports(reported_by_user_id, created_at DESC);
CREATE INDEX idx_reports_device_time ON price_reports(device_id, created_at DESC);

CREATE TABLE fill_ups (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  gas_station_id TEXT REFERENCES gas_stations(id),
  fuel_type TEXT NOT NULL,
  price_per_liter REAL NOT NULL,
  liters REAL NOT NULL,
  total_amount REAL GENERATED ALWAYS AS (price_per_liter * liters) STORED,
  price_report_id TEXT REFERENCES price_reports(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE ratings (
  id TEXT PRIMARY KEY,
  fill_up_id TEXT NOT NULL REFERENCES fill_ups(id),
  gas_station_id TEXT NOT NULL REFERENCES gas_stations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  price_stars INTEGER CHECK(price_stars BETWEEN 1 AND 5),
  quality_stars INTEGER CHECK(quality_stars BETWEEN 1 AND 5),
  service_stars INTEGER CHECK(service_stars BETWEEN 1 AND 5),
  avg_stars REAL GENERATED ALWAYS AS ((price_stars + quality_stars + service_stars) / 3.0) STORED,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE gas_station_rating_summary (
  gas_station_id TEXT PRIMARY KEY REFERENCES gas_stations(id),
  ratings_count INTEGER DEFAULT 0,
  avg_overall REAL,
  bayesian_score REAL,
  updated_at TEXT
);

CREATE TABLE geofence_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  gas_station_id TEXT REFERENCES gas_stations(id),
  entered_at TEXT,
  prompted_at TEXT,
  responded TEXT CHECK(responded IN ('yes','no','ignored','timeout')),
  responded_at TEXT
);

CREATE TABLE anp_reference_prices (
  city_id TEXT,
  fuel_type TEXT,
  week_start TEXT,
  avg_price REAL,
  min_price REAL,
  max_price REAL,
  PRIMARY KEY (city_id, fuel_type, week_start)
);

CREATE TABLE favorites (
  user_id TEXT NOT NULL REFERENCES users(id),
  gas_station_id TEXT NOT NULL REFERENCES gas_stations(id),
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, gas_station_id)
);

CREATE TABLE push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expo_push_token TEXT NOT NULL,
  platform TEXT CHECK(platform IN ('ios','android')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, expo_push_token)
);
