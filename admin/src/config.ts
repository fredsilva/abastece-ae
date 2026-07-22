// Em dev, o Vite faz proxy de /admin para o Worker local (ver vite.config.ts) — string vazia
// mantém as chamadas relativas. Em produção, admin (Pages) e api (Workers) ficam em origens
// diferentes, então precisamos da URL completa do Worker.
export const API_BASE = import.meta.env.DEV ? "" : "https://abastece-ae-api.fredsilva-sistemas.workers.dev";
