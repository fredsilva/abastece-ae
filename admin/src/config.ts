// Em produção, o painel é servido pelo próprio Worker da API (mesmo domínio — ver
// api/wrangler.jsonc, campo "assets"), então as chamadas são sempre relativas. Em dev, o
// Vite faz proxy de /admin para o Worker local (ver vite.config.ts), então também funciona
// com caminho relativo.
export const API_BASE = "";
