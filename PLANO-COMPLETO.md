# Abastece Aê — Plano Completo (visão de produto madura)

## Visão

Versão brasileira do GasBuddy: crowdsourcing de preços de combustível, cobertura nacional (multi-cidade), com dados confiáveis o suficiente para virar a fonte de referência de preço de combustível no Brasil — para consumidores e, eventualmente, como produto de dados para distribuidoras/varejo.

Este documento descreve a arquitetura completa e as funcionalidades que vão além do MVP de uma cidade. O ponto de partida obrigatório é o [`PLANO-MVP.md`](./PLANO-MVP.md) — toda a base técnica (schema, ranking, anti-fraude, geofencing, auth, stack Cloudflare) descrita ali continua valendo aqui; este arquivo cobre **o que muda e o que se adiciona** quando o produto cresce além de uma cidade.

---

## Stack de ferramentas (completa)

A base é a mesma do MVP (Cloudflare Workers/D1/KV, Expo, Mapbox, Resend, Expo Push, Cloudflare Access/Pages para o admin). O que se adiciona com a escala:

| Camada | Ferramenta | Quando adotar | Custo |
|---|---|---|---|
| Processamento assíncrono | **Cloudflare Queues** | Quando o volume de reports/recompute de ranking deixar de ser trivial de processar inline (múltiplas cidades simultâneas) | Historicamente requer o plano Workers Paid (US$5/mês) |
| Coordenação em tempo real | **Durable Objects** | Se surgir necessidade real de estado forte/tempo-real (ex. leilão de posto patrocinado, sessões colaborativas) — não há caso de uso óbvio hoje | Free tier com limites |
| Armazenamento de arquivos | **Cloudflare R2** | Evidência fotográfica no report de preço, fotos de posto | Free tier generoso (sem taxa de egress) |
| Proteção de superfícies web públicas | **Cloudflare Turnstile** | Landing pages públicas de comparação de preço, formulários de contato/denúncia web | Grátis |
| Observability | **Cloudflare Workers Analytics Engine** / Sentry (free tier) | Quando o time crescer e precisar de alertas de erro em produção | Free tier |
| Notificações transacionais em volume | Reavaliar Resend em tier pago | Se o volume de e-mails ultrapassar ~3.000/mês (múltiplas cidades) | Pago acima do free tier |

---

## Design system

Mesma base do MVP: `DESIGN-cal.md`, com Inter 600 (-0.04em) como substituto de Cal Sans. Em escala, vale formalizar um pacote de componentes compartilhado (`packages/ui` no monorepo) consumido tanto pelo app mobile quanto pelo admin e por eventuais superfícies web públicas (landing page, página de comparação de preço por cidade), para não divergir visualmente conforme o time cresce.

---

## Arquitetura técnica — o que muda em escala

### Multi-cidade

- `gas_stations.city_id` já existe desde o MVP — a expansão é primariamente de dados, não de schema.
- **Substituir "carregar todos os postos da cidade em KV" por bounding-box indexado:** `WHERE city_id=? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?` sobre um índice `(city_id, latitude, longitude)`, refinado por Haversine em JS só dentro do retângulo resultante. Necessário quando uma cidade tem milhares de postos ou quando o usuário está numa região de fronteira entre cidades mapeadas.
- Seed ANP deixa de ser script manual único e vira um pipeline recorrente (Cron ou GitHub Action agendada) por cidade, com fila de QA de geocodificação em vez de revisão manual em planilha.
- Troca de cidade ativa no app (detecção automática por GPS + seleção manual como fallback).

### Processamento assíncrono (Queues)

Com múltiplas cidades processando reports simultaneamente, recomputar `gas_station_rating_summary` e invalidar cache KV inline no request deixa de ser desprezível. Migrar para **Cloudflare Queues**: `POST /price-reports` grava o report e enfileira o recompute; um consumer processa em lote. Isso também abre espaço para retry automático em falhas transitórias de terceiros (ex. Expo Push indisponível).

### Papéis no admin

O MVP trata qualquer e-mail na allowlist do Cloudflare Access como admin completo. Em escala, introduzir uma tabela `admin_roles (email, role)` (`admin` vs `moderator`) consultada pelo middleware após a validação do Access — moderadores só acessam a fila de `pending_review` e visualização de usuários, não config de ranking nem exclusão de dados.

### Evidência fotográfica (R2)

Ao reportar preço, permitir anexar foto do totem/bomba. Reduz fraude (mais fácil verificar visualmente um preço absurdo), mas aumenta fricção — por isso fica fora do MVP até validar que a fricção adicional não mata a taxa de contribuição. Armazenar em R2, referenciado por URL em `price_reports.photo_url` (coluna nova).

### Monetização

- **Posto patrocinado:** destaque visual no topo da lista, mas **sempre rotulado como patrocinado** e nunca reordenando o `overall_score` real — corromper o ranking objetivo destrói a credibilidade que é a proposta de valor central do app.
- **Anúncios:** banners discretos, preferencialmente contextuais (ex. seguro auto, oficina) — avaliar impacto em retenção antes de ativar.
- **Dados B2B:** preços agregados/anonimizados por região para distribuidoras, redes de postos, ou seguradoras — exige que a base de dados já tenha volume e confiabilidade suficientes (métrica: cobertura `verified=1` alta e volume de reports estável).

### Analytics de negócio

Funis de ativação (instalação → conta → primeira visualização de posto → primeiro report/fill-up), retenção (D1/D7/D30), DAU/MAU, taxa de resposta ao geofencing por cidade. Cloudflare Workers Analytics Engine ou um provedor de analytics de produto (avaliar tiers gratuitos no momento da implementação) alimentando dashboards no próprio painel admin.

---

## Funcionalidades além do MVP

- **Moderação avançada:** denunciar posto fechado/mudou de bandeira, denunciar avaliação abusiva (além da fila `pending_review` de preço, que já é MVP).
- **Evidência fotográfica** do report via R2.
- **Gamificação:** pontos por contribuição, badges de "colaborador confiável", ranking de contribuidores por cidade.
- **Multi-cidade:** troca de cidade ativa, bounding-box indexado, seed ANP recorrente.
- **Papéis no admin** (moderador vs. admin completo).
- **Analytics de negócio:** funis, retenção, DAU/MAU.
- **Monetização:** posto patrocinado (rotulado), anúncios, dados B2B.
- **Modo escuro.**
- **Programa formal de compliance LGPD:** mapeamento de dados (RIPD), exclusão self-service automatizada (hoje é manual/via suporte no MVP), DPO formal.
- **Testes automatizados** (unit + E2E) e CI/CD maduro, observability em produção (alertas de erro, SLOs).
- **Cloudflare Turnstile** em superfícies web públicas (landing page, formulário de contato).
- **Cloudflare Queues/Durable Objects** conforme o volume justificar.

---

## Roadmap de evolução pós-MVP

**Fase 2 — Consolidação na cidade piloto**
Depois do lançamento (Etapa 10 do MVP), antes de expandir: papéis no admin (se o time crescer), evidência fotográfica opcional, moderação avançada de denúncias, começo de testes automatizados nos fluxos críticos (ranking, anti-fraude).

**Fase 3 — Expansão multi-cidade**
Bounding-box indexado, pipeline de seed ANP recorrente, seleção/detecção de cidade no app, Queues para processamento assíncrono em escala, analytics de negócio por cidade.

**Fase 4 — Monetização**
Posto patrocinado rotulado, anúncios contextuais, avaliação de produto de dados B2B — só depois de volume/confiabilidade suficientes para não comprometer a credibilidade do ranking.

**Fase 5 — Maturidade de plataforma**
Programa formal de LGPD, observability completa, modo escuro, gamificação, CI/CD maduro com testes E2E cobrindo os fluxos regulatoriamente sensíveis (localização em background, exclusão de conta).

---

## Considerações de compliance (LGPD)

O app coleta localização em background e comportamento de abastecimento — dados sensíveis o suficiente para exigir, em maturidade completa (não no MVP, mas como destino):
- Mapeamento formal de dados coletados e finalidade de cada um (RIPD — Relatório de Impacto à Proteção de Dados).
- Exclusão de conta self-service (não apenas via suporte).
- Política de retenção de dados (ex. quanto tempo `price_reports` com GPS bruto fica armazenado antes de anonimizar).
- Eventual designação de DPO conforme o volume de usuários justificar.

## Considerações de custo em escala

A stack do MVP cabe inteira em tiers gratuitos para uma cidade. Os primeiros custos reais aparecem em:
1. **Cloudflare Workers Paid** (US$5/mês) — necessário para Queues, e eventualmente para limites de requisição/CPU do Workers free tier.
2. **Mapbox** acima do free tier — relevante só com volume nacional de carregamentos de mapa/rotas.
3. **Resend** acima de ~3.000 e-mails/mês.
4. Nenhum desses é bloqueador para validar 1-2 cidades adicionais; reavaliar quando os números reais de uso existirem.
