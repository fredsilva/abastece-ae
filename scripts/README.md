# scripts/seed-anp.ts

Importa postos + preços da ANP para uma cidade e gera um `.sql` pronto para `wrangler d1 execute --file`.

## 1. Baixar os CSVs de origem (manual)

O site da ANP bloqueia requisições do `fetch` do Node (WAF por fingerprint de TLS) — baixe via `curl` com `--ssl-no-revoke` (necessário no Windows por causa de um problema de verificação de revogação de certificado do schannel):

```bash
# Cadastro de revendedores (URL estável, cobre o Brasil inteiro)
curl -sL --ssl-no-revoke -A "Mozilla/5.0" \
  -o scripts/data/anp_cadastro.csv \
  "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-dados-cadastrais-dos-revendedores-varejistas-de-combustiveis-automotivos/dados-cadastrais-revendedores-varejistas-combustiveis-automoveis.csv"

# Pesquisa semanal de preços — ache o link do mês mais recente em
# https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/serie-historica-de-precos-de-combustiveis
# (nomeação inconsistente mês a mês, não dá para automatizar com segurança)
curl -sL --ssl-no-revoke -A "Mozilla/5.0" \
  -o scripts/data/anp_precos_gasolina_etanol_AAAA_MM.csv \
  "<link do mês mais recente — gasolina/etanol>"

curl -sL --ssl-no-revoke -A "Mozilla/5.0" \
  -o scripts/data/anp_precos_diesel_gnv_AAAA_MM.csv \
  "<link do mês mais recente — diesel/GNV>"
```

## 2. Rodar o seed

```bash
cd scripts
npm install
node --env-file=.env seed-anp.ts \
  --city "Nome Da Cidade" --uf UF \
  --cadastro data/anp_cadastro.csv \
  --precos data/anp_precos_gasolina_etanol_AAAA_MM.csv \
  --precos data/anp_precos_diesel_gnv_AAAA_MM.csv \
  --out output/seed-<cidade>-<uf>.sql
```

Requer `MAPBOX_TOKEN` em `scripts/.env` (mesmo token usado pelo app/admin para mapas).

O script:
- Filtra o cadastro e a pesquisa de preços pela cidade/UF.
- Geocodifica cada endereço via Mapbox (com cache em `scripts/data/geocode-cache.json` — reruns não re-consultam endereços já resolvidos).
- Para cada posto+combustível: usa o preço real da pesquisa quando o posto foi amostrado naquela semana (`confidence_score=0.6`); senão usa a média municipal calculada a partir da própria amostra (`confidence_score=0`, estimativa).
- Gera `anp_reference_prices` (média/mín/máx por combustível) para o cross-check de outliers do anti-fraude.
- Lista no console os endereços que falharam na geocodificação, para revisão manual antes de aplicar o SQL.

## 3. Aplicar

```bash
cd ../api
npx wrangler d1 execute abastece-ae-db --local --file ../scripts/output/seed-<cidade>-<uf>.sql   # testar local primeiro
npx wrangler d1 execute abastece-ae-db --remote --file ../scripts/output/seed-<cidade>-<uf>.sql  # depois de validar
```
