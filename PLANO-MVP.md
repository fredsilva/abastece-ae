# Abastece Aê — Plano MVP (cidade piloto)

## Objetivo

Validar adoção do app numa única cidade antes de expandir. O MVP contém **todas** as funcionalidades centrais descritas pelo fundador — nada a mais, nada a menos — estruturadas em etapas incrementais e testáveis.

Documento irmão: [`PLANO-COMPLETO.md`](./PLANO-COMPLETO.md) descreve a visão de produto madura (multi-cidade, monetização, etc.) que fica **fora** deste MVP.

---

## Stack de ferramentas

| Camada | Ferramenta | Custo |
|---|---|---|
| Backend/API | Cloudflare Workers + **Hono** (router TS) | Free tier (~100k req/dia) |
| Banco relacional | Cloudflare **D1** (SQLite) | Free tier generoso |
| Cache/config | Cloudflare **KV** | Free tier (cache leve + config, não rate limiting) |
| Cron/jobs | Cloudflare **Cron Triggers** | Free tier |
| Mobile | **React Native + Expo** (EAS Build, dev client) | Free tier de builds |
| Painel admin | **React + Vite**, hospedado em **Cloudflare Pages** | Free tier (builds + requisições ilimitadas) |
| Auth do admin | **Cloudflare Zero Trust Access** (allowlist de e-mail) | Free até 50 usuários |
| Mapas/geocoding/rotas | **Mapbox** (Maps SDK, Directions, Geocoding) | Free tier (~50k map loads/mês, ~100k directions/mês) |
| Navegação turn-by-turn | Deep-link para Google Maps/Waze/Apple Maps nativo | Grátis |
| Auth social (app) | `expo-auth-session` (Google) + `expo-apple-authentication` + verificação JWT própria no Worker (`jose`) | Grátis |
| E-mail (magic link) | **Resend** | Free tier (~3.000 e-mails/mês) |
| Push notifications | **Expo Push Notification Service** | Grátis |
| Dados iniciais de postos | **ANP** (dados abertos) | Grátis |
| CI | GitHub Actions (lint/typecheck + deploy) | Grátis |

**Custos inevitáveis:** Apple Developer Program (US$99/ano) e taxa única do Google Play Console (US$25). Todo o resto cabe nos tiers gratuitos para o volume de uma cidade.

**Descartado deliberadamente para o MVP:** Clerk/Auth0 (não elimina a tabela `users` própria e adiciona dependência fora do Cloudflare), Cloudflare Queues/Durable Objects (custo ou overkill neste volume — processamento assíncrono roda inline), R2 (nenhuma feature do MVP exige foto/arquivo), Google Maps (exige cartão de crédito e cobra por carregamento), login/senha próprio no admin (Cloudflare Access resolve com menos código e mais segurança), Turnstile (feito para web/WebView, não para API JSON nativa consumida pelo app).

---

## Design system

Base: `DESIGN-cal.md` (tokens de cor, tipografia, espaçamento, raio, componentes).

- **App mobile:** `{component.badge-pill}` → badges "Mais barato" e "Desconto no Pix ou Dinheiro"; `{component.rating-stars}` (`{colors.badge-orange}`) → estrelas de nota do posto e das 3 avaliações; `{component.category-tab}`/`{component.category-tab-active}` dentro de `{component.nav-pill-group}` → abas Gasolina/Etanol/Diesel; `{component.button-primary}` → CTAs "Navegar"/"Abasteci"; `{component.text-input}` → campos do fluxo de abastecimento; cards de posto usam `{component.feature-card}` (`{colors.surface-card}`, `{rounded.lg}`).
- **Painel admin:** dashboard SaaS clássico — o gênero de superfície para o qual `DESIGN-cal.md` foi extraído. Tabelas com hairline dividers (`{colors.hairline}`) e `{component.badge-pill}` para status; formulários com `{component.text-input}`; fila de moderação com `{component.product-mockup-card}` por item; navegação entre seções com `{component.nav-pill-group}`.
- **Fonte:** Cal Sans é proprietária da Cal.com e não está disponível como web font pública. Usar o substituto documentado no próprio design system: **Inter weight 600, letter-spacing -0.04em** (ou Manrope 700 como alternativa).
- Paleta quase monocromática (preto como cor de ação dominante); badges pastéis reservados para tags secundárias (ex. bandeira do posto no admin), nunca nos CTAs principais.

---

## Arquitetura técnica

### Estrutura de repositório

```
abastece-ae/
  api/                         # Cloudflare Worker (Hono + D1 + KV)
    src/
      routes/ (auth.ts, stations.ts, priceReports.ts, fillUps.ts, ratings.ts,
                favorites.ts, pushTokens.ts, admin.ts)
      middleware/cfAccess.ts   # valida Cf-Access-Jwt-Assertion nas rotas /admin/*
      lib/ (ranking.ts, geo.ts, antifraud.ts, auth-jwt.ts, mapbox.ts, push.ts)
      db/migrations/0001_init.sql
    wrangler.toml
  mobile/                      # Expo app (dev client / EAS Build)
    app/                       # expo-router
    src/ (tasks/geofencing.ts, lib/, components/, theme.ts)
    app.json, eas.json
  admin/                       # React + Vite, deploy Cloudflare Pages
    src/ (pages: Stations, Users, PriceReports, Config, theme.ts)
  scripts/
    seed-anp.ts                # importação one-off da base ANP
```

### Modelo de dados (D1 / SQLite)

Padrão: **estado atual** (`fuel_prices`, leitura rápida) + **ledger append-only** (`price_reports`, histórico e auditoria).

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  name TEXT, avatar_url TEXT,
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
  id TEXT PRIMARY KEY, email TEXT NOT NULL, token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL, used_at TEXT
);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id),
  refresh_token_hash TEXT NOT NULL, device_id TEXT, platform TEXT,
  created_at TEXT DEFAULT (datetime('now')), expires_at TEXT, revoked_at TEXT
);

CREATE TABLE gas_stations (
  id TEXT PRIMARY KEY,
  cnpj TEXT UNIQUE,
  nome_fantasia TEXT NOT NULL, razao_social TEXT, brand TEXT,
  address_street TEXT, address_number TEXT, address_neighborhood TEXT,
  city TEXT NOT NULL, state TEXT NOT NULL, postal_code TEXT,
  latitude REAL NOT NULL, longitude REAL NOT NULL,
  city_id TEXT NOT NULL,
  source TEXT CHECK(source IN ('anp_seed','user_submitted','admin')) DEFAULT 'anp_seed',
  verified INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','pending_review')),
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT
);
CREATE INDEX idx_stations_city ON gas_stations(city_id, status);

CREATE TABLE fuel_prices (
  gas_station_id TEXT NOT NULL REFERENCES gas_stations(id),
  fuel_type TEXT NOT NULL CHECK(fuel_type IN ('gasolina','etanol','diesel')),
  price REAL NOT NULL,
  previous_price REAL,
  price_changed_at TEXT NOT NULL,
  last_reported_at TEXT NOT NULL,
  pix_discount INTEGER DEFAULT 0, cash_discount INTEGER DEFAULT 0,
  confidence_score REAL DEFAULT 1.0,
  last_drop_notified_at TEXT,
  PRIMARY KEY (gas_station_id, fuel_type)
);

CREATE TABLE price_reports (
  id TEXT PRIMARY KEY,
  gas_station_id TEXT NOT NULL REFERENCES gas_stations(id),
  fuel_type TEXT NOT NULL, price REAL NOT NULL,
  reported_by_user_id TEXT NOT NULL REFERENCES users(id),
  report_type TEXT CHECK(report_type IN ('fill_up','manual_report')),
  pix_discount INTEGER DEFAULT 0, cash_discount INTEGER DEFAULT 0,
  device_id TEXT NOT NULL,
  gps_lat REAL, gps_lng REAL, gps_accuracy_m REAL, distance_from_station_m REAL,
  status TEXT DEFAULT 'accepted' CHECK(status IN ('accepted','pending_review','rejected_outlier')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_reports_station_fuel_time ON price_reports(gas_station_id, fuel_type, created_at DESC);
CREATE INDEX idx_reports_user_time ON price_reports(reported_by_user_id, created_at DESC);
CREATE INDEX idx_reports_device_time ON price_reports(device_id, created_at DESC);

CREATE TABLE fill_ups (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), gas_station_id TEXT REFERENCES gas_stations(id),
  fuel_type TEXT NOT NULL, price_per_liter REAL NOT NULL, liters REAL NOT NULL,
  total_amount REAL GENERATED ALWAYS AS (price_per_liter * liters) STORED,
  price_report_id TEXT REFERENCES price_reports(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE ratings (
  id TEXT PRIMARY KEY, fill_up_id TEXT NOT NULL REFERENCES fill_ups(id),
  gas_station_id TEXT NOT NULL REFERENCES gas_stations(id), user_id TEXT NOT NULL REFERENCES users(id),
  price_stars INTEGER CHECK(price_stars BETWEEN 1 AND 5),
  quality_stars INTEGER CHECK(quality_stars BETWEEN 1 AND 5),
  service_stars INTEGER CHECK(service_stars BETWEEN 1 AND 5),
  avg_stars REAL GENERATED ALWAYS AS ((price_stars+quality_stars+service_stars)/3.0) STORED,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE gas_station_rating_summary (
  gas_station_id TEXT PRIMARY KEY REFERENCES gas_stations(id),
  ratings_count INTEGER DEFAULT 0,
  avg_overall REAL, bayesian_score REAL, updated_at TEXT
);

CREATE TABLE geofence_events (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), gas_station_id TEXT REFERENCES gas_stations(id),
  entered_at TEXT, prompted_at TEXT,
  responded TEXT CHECK(responded IN ('yes','no','ignored','timeout')), responded_at TEXT
);

CREATE TABLE anp_reference_prices (
  city_id TEXT, fuel_type TEXT, week_start TEXT,
  avg_price REAL, min_price REAL, max_price REAL,
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
```

Não existe tabela `admin_users`: a autenticação do painel é feita pelo **Cloudflare Access** — autorização é só um allowlist de e-mails na configuração do Access, sem senha para gerenciar.

**Postos próximos:** D1/SQLite não tem função geoespacial nativa. Para uma cidade (centenas de postos), cachear o array completo em KV e calcular **Haversine** + ordenar em JS no Worker é suficiente e simples de depurar.

### Algoritmo de ranking (custo-benefício)

```
overall_score = 0.5 * price_score + 0.3 * distance_score + 0.2 * rating_score
```

- `price_score` e `distance_score`: normalizados (0–1) dentro do conjunto de postos exibido no momento.
- `rating_score`: **média bayesiana** — `bayesian_rating = (v/(v+m))*R + (m/(v+m))*C`, com `m≈10` (limiar mínimo de credibilidade), `R` = média real do posto, `C` = prior/média da cidade. Evita que 1 avaliação 5★ vença um posto com 200 avaliações e nota 4.5. Card só exibe estrela quando `ratings_count >= m`.
- Pesos configuráveis via KV (`config:ranking_weights`), editáveis pelo painel admin (Etapa 8), sem redeploy.
- **Badge "Mais barato":** menor preço não-stale da lista/aba atual.
- `freshness_multiplier` decrescente sobre `price_score` para preços antigos não dominarem o ranking "no papel".
- Empates: preço → distância → nota.

### Anti-fraude e qualidade de dados (sem SMS OTP)

1. Todo report exige usuário autenticado (`reported_by_user_id` + `device_id`).
2. **Sanity check de faixa de preço** (client e server-side) — evita erro de vírgula decimal.
3. **Confirmação de GPS no momento do report** — fluxo "Abasteceu?" exige ≤150m do posto; "reportar sem abastecer" não bloqueia por distância, mas usa distância como sinal de confiança.
4. **Rate limiting via D1** (não KV): ex. 1 report por usuário/posto/combustível a cada 15min, ~20/dia por usuário, limites espelhados por `device_id`.
5. **Detecção de outliers** contra mediana/IQR da cidade — outlier isolado vira `pending_review` até corroboração.
6. `anp_reference_prices` como segundo cross-check independente.
7. **`trust_score` (0–100):** sobe com reports corroborados/vindos de `fill_up` confirmado; cai com reports rejeitados.
8. **Decaimento de confiança (Cron diário):** `confidence_score` cai com a idade do último report aceito; perto de zero, UI avisa "preço pode estar desatualizado" e o posto perde elegibilidade ao badge "Mais barato".
9. Avaliações só existem atreladas a um `fill_up` real (geofence confirmado) — bloqueia review-bombing por construção.
10. **Moderação manual:** a fila `pending_review` pode ser aprovada/rejeitada no painel admin, além da corroboração automática.

### Geofencing em background ("Abasteceu?")

- `expo-location` (`Location.startGeofencingAsync`) + `expo-task-manager` — monitoramento nativo de região do SO, não GPS polling contínuo.
- **Limite duro do iOS: 20 regiões monitoradas por app** — exige janela deslizante (monitorar só os ~20 postos mais próximos, realocando com significant-location-change). Android é mais permissivo (~100 geofences), mas sofre com Doze/otimização agressiva de fabricantes (Xiaomi/Huawei).
- Raio recomendado: ~100–150m por geofence.
- **iOS:** fluxo em duas etapas ("When In Use" → "Always Allow") com tela de priming própria antes do prompt do sistema — sem isso, risco real de rejeição na App Store Review (Guideline 5.1.1/2.5.4). **Android 10+:** `ACCESS_BACKGROUND_LOCATION` separado + declaração no Play Console.
- Fluxo: ENTER da geofence → notificação local (`expo-notifications`) → modal "Abasteceu?" → Sim → registra `fill_ups` + `price_reports` → tela de 3 estrelas (Preço/Qualidade/Atendimento) → grava `ratings` → recalcula `gas_station_rating_summary`. `geofence_events` aplica cooldown (~2h) por posto.
- Todo o fluxo exige EAS Build/dev client — Expo Go não suporta essas APIs nativas em background.

### Favoritos e notificação de queda de preço

- `POST/DELETE /favorites/:stationId`, `GET /favorites` no app.
- `POST /push-tokens` registra o Expo push token do device vinculado ao usuário logado.
- Ao aceitar um `price_report` que resulte em `fuel_prices.price < previous_price`: consulta `favorites` daquele posto, junta com `push_tokens`, chama a **Expo Push API** (grátis) em lote síncrono dentro do próprio handler.
- Dedupe: `last_drop_notified_at` evita notificar de novo o mesmo posto+combustível numa janela curta (~6h).

### Seed inicial de postos (dados abertos da ANP)

A ANP publica (1) registro de revendedores autorizados (CNPJ, endereço, bandeira — sem lat/lng) e (2) pesquisa semanal de preços agregada por município (não por posto individual).

`scripts/seed-anp.ts` (execução única): baixar CSV filtrado pela cidade → geocodificar via Mapbox Geocoding → QA amostral manual (esperar ~10-20% de correção pontual) → inserir em `gas_stations` (`source='anp_seed'`, `verified=0`) → popular `fuel_prices` inicial com a média municipal da ANP, `confidence_score=0`, rotulado na UI como "preço médio da região — aguardando confirmação". `verified` vira 1 organicamente no primeiro report/fill-up real confirmado. Cron semanal mantém `anp_reference_prices` atualizado.

### Autenticação

- **Google:** `expo-auth-session` → Worker valida `id_token` via JWKS do Google (lib `jose`).
- **Apple:** `expo-apple-authentication` → Worker valida `identityToken` via JWKS da Apple. Obrigatório por regra da Apple (Guideline 4.8) quando há login social de terceiro no iOS.
- **E-mail (magic link):** Worker gera token, grava hash em `magic_links` (expira ~15min), envia via Resend com deep link.
- **Sessão:** JWT de acesso curto (HS256 via `wrangler secret`) + refresh token opaco em `auth_sessions` (D1) + `SecureStore` no device.
- **Admin:** **Cloudflare Zero Trust Access** na frente do Cloudflare Pages e das rotas `/admin/*` do Worker, com policy de allowlist por e-mail. O Worker valida o header `Cf-Access-Jwt-Assertion` contra as chaves públicas do Access antes de processar qualquer rota `/admin/*` — sem tabela de admin, sem hash de senha, sem tela de login própria.

### Stack Cloudflare — bindings

| Produto | Uso |
|---|---|
| Workers (Hono) | API única (rotas públicas + `/admin/*`) |
| D1 | Schema relacional completo + rate limiting (`COUNT()`) |
| KV | Cache de postos por cidade + config tunável (pesos de ranking, faixas de preço) |
| Pages | Hospeda o painel admin (React + Vite) |
| Access | Autenticação/autorização do painel admin |
| Cron Triggers | Decaimento diário de confiança, recompute de rating summary, refresh semanal ANP, limpeza de sessões expiradas |
| R2, Durable Objects, Queues | **Fora do MVP** — ver `PLANO-COMPLETO.md` |

**Endpoints principais:** `POST /auth/{google,apple}`, `POST /auth/email/request`, `POST /auth/email/verify`, `POST /auth/refresh` · `GET /stations?city=&fuel=&lat=&lng=` · `GET /stations/:id` · `POST /price-reports` · `POST /fill-ups` · `POST /ratings` · `GET/POST/DELETE /favorites` · `POST /push-tokens` · `GET/POST/PUT /admin/stations` · `GET /admin/users` · `POST /admin/users/:id/ban` · `GET /admin/price-reports?status=pending_review` · `POST /admin/price-reports/:id/{approve,reject}` · `GET /admin/metrics` · `GET/PUT /admin/config`.

---

## Escopo funcional do MVP

1. Auth: e-mail (magic link) + Google + Apple.
2. Home: mapa no topo (usuário + postos próximos) + lista ranqueada por custo-benefício.
3. Mapa expansível/full-screen, navegável livremente por toda a cidade mapeada.
4. 3 abas Gasolina/Etanol/Diesel, aba padrão configurável.
5. Card de posto: nome, preço atual, preço anterior riscado, distância, nota (quando houver avaliações suficientes), "há quanto tempo" desde a última atualização.
6. Badges "Mais barato" e "Desconto no Pix ou Dinheiro".
7. Tap no posto → mapa com rota traçada (Mapbox Directions).
8. Botão "Navegar" → deep-link para o app de navegação nativo do usuário.
9. Geofencing → "Abasteceu?" → combustível/preço/litros → 3 avaliações por estrela → nota do posto = média das 3.
10. "Reportar preço" sem abastecer.
11. **Favoritos** + **notificação de queda de preço** em posto favoritado.
12. **Painel admin:** CRUD de postos, visualização/moderação de usuários, fila de aprovação de reports, métricas básicas, config do ranking.
13. Camada anti-fraude completa (pré-requisito invisível dos itens 9/10/11).
14. Seed ANP da cidade piloto.
15. LGPD mínimo viável: consentimento de localização, política de privacidade, exclusão de conta.

**Fora do MVP:** fotos de posto, denúncias avançadas, gamificação, multi-cidade, dark mode, monetização, analytics avançado — ver `PLANO-COMPLETO.md`.

---

## Etapas de implementação

Cada etapa produz algo testável antes de avançar. Ordem pensada por dependência técnica (não dá para testar geofencing sem postos reais; não dá para testar ranking sem preços).

### Etapa 0 — Fundação técnica
`wrangler.toml` + migração D1 inicial (schema acima) + Hono skeleton + deploy do Worker.
**Teste:** `wrangler dev` local, endpoint de health check responde 200.

### Etapa 1 — Dados da cidade piloto + admin básico de postos
Rodar `seed-anp.ts` para a cidade escolhida. Painel admin mínimo (protegido por Cloudflare Access): CRUD de postos (listar, criar, editar, desativar) e visualização de `fuel_prices` atuais.
**Teste:** abrir o painel, ver os postos da cidade carregados do seed, criar/editar um posto manualmente.

### Etapa 2 — Autenticação do app
Magic link + Google + Apple no Worker; telas de login no Expo.
**Teste:** instalar via EAS dev build, criar conta, logar, deslogar, relogar.

### Etapa 3 — Home: mapa + lista ranqueada + abas
`GET /stations` com ranking + cache KV; tela Home com mapa Mapbox, lista de postos, 3 abas (aba padrão configurável nas preferências), badges "Mais barato" e "Desconto no Pix ou Dinheiro".
**Teste:** com localização real, ver os postos da cidade ranqueados corretamente; trocar de aba; mudar aba padrão.

### Etapa 4 — Rota e navegação
Tap no posto → mapa com rota traçada (Mapbox Directions). Botão "Navegar" → deep link para Google Maps/Waze/Apple Maps.
**Teste:** tocar num posto da lista, ver rota desenhada; tocar Navegar, confirmar abertura do app nativo de navegação.

### Etapa 5 — Reportar preço + moderação básica
`POST /price-reports` com sanity check, rate limiting D1, outlier detection. Tela "reportar preço" no app. Fila `pending_review` no admin (aprovar/rejeitar).
**Teste:** reportar preço no app, ver refletido na lista (se dentro dos limites) ou pendente na fila do admin (se outlier).

### Etapa 6 — Geofencing, "Abasteceu?" e avaliações
`expo-location`/`expo-task-manager`, notificação local, modal "Abasteceu?", registro de `fill_ups`, 3 estrelas (Preço/Qualidade/Atendimento), recompute de `gas_station_rating_summary`.
**Teste:** simular GPS entrando na geofence (mock location no simulador/emulador), confirmar prompt, registrar abastecimento, avaliar, ver a nota do posto atualizar.

### Etapa 7 — Favoritos e notificação de queda de preço
Favoritar/desfavoritar posto no app. Registro de push token (`expo-notifications`). Disparo de push ao detectar queda de preço em posto favoritado.
**Teste:** favoritar um posto, reportar um preço mais baixo nele (outra conta ou via admin), confirmar recebimento da notificação push no device.

### Etapa 8 — Admin: usuários, métricas e config
Tela de usuários (trust_score, banir/desbanir), dashboard de métricas (nº postos, reports, fill-ups, usuários ativos, cobertura verificada vs não verificada), edição de `config:ranking_weights` e `config:price_bounds` via UI.
**Teste:** banir um usuário de teste e confirmar que os reports dele passam a exigir revisão; alterar peso de ranking e ver a lista do app reordenar.

### Etapa 9 — LGPD e beta fechado
Tela de consentimento de localização (antes do "Always Allow"), política de privacidade, caminho de exclusão de conta. Crons de decaimento/refresh ativos. Build EAS internal distribution (TestFlight/Play Internal Testing) com grupo pequeno de usuários reais na cidade piloto.
**Teste:** fluxo completo ponta a ponta com usuários reais por alguns dias; observar taxa de resposta ao "Abasteceu?" e qualidade dos preços reportados.

### Etapa 10 — Lançamento público na cidade piloto
Submissão App Store / Play Store.
**Teste:** monitorar adoção via painel admin (métricas da Etapa 8) e ajustar.

---

## Métricas de sucesso do MVP

Para saber se houve adesão real na cidade piloto, acompanhar no painel admin (Etapa 8):
- Instalações e contas criadas por semana.
- Usuários ativos semanais (abriram o app e viram a lista).
- Reports de preço por semana (manuais + via "Abasteceu?") e % aceitos vs. `pending_review`.
- Taxa de resposta ao prompt "Abasteceu?" (respondido vs. ignorado/timeout em `geofence_events`).
- Cobertura de postos `verified=1` vs. total cadastrado (indica se os dados estão ficando confiáveis com o tempo).
- Retenção simples (usuários que voltam a abrir o app numa segunda semana).

---

## Verificação (como validar de ponta a ponta)

- `wrangler dev --local` com D1 local para testar as rotas da API isoladamente antes de builds mobile.
- Geofencing: localização simulada (GPX no Xcode Simulator, mock location no Android Emulator) antes de depender de teste físico em campo; validar fisicamente pelo menos uma vez por plataforma antes do beta (o limite de 20 regiões do iOS e o Doze mode do Android não são bem simulados por emulador).
- Painel admin: confirmar que rotas `/admin/*` retornam 403 sem o header do Cloudflare Access, e 200 com um e-mail autorizado na allowlist.
- Notificação de queda de preço: testar com 2 contas (uma favorita o posto, outra reporta preço menor) para confirmar o disparo real via Expo Push.
- Beta fechado (Etapa 9) via EAS internal distribution com usuários reais da cidade piloto antes do lançamento público, para validar cold-start dos dados ANP, qualidade do anti-fraude e taxa de resposta ao geofencing com uso real.
