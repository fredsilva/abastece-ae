import { useRef, useState } from "react";
import { bulkImportStations, type BulkImportResult } from "./api";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function StationImportModal({ onClose, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [payload, setPayload] = useState<{ postos: unknown[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setFileName(file.name);
    setPayload(null);
    try {
      const json = JSON.parse(await file.text());
      const postos = json?.postos;
      if (!Array.isArray(postos) || postos.length === 0) {
        setError('O arquivo não contém um array "postos" válido.');
        return;
      }
      setPayload({ postos });
    } catch {
      setError("Não foi possível ler o arquivo. Verifique se é um JSON válido.");
    }
  }

  async function handleImport() {
    if (!payload) return;
    setImporting(true);
    setError(null);
    try {
      const res = await bulkImportStations(payload);
      setResult(res);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal--sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importar postos via JSON</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 3.5l-9 9M3.5 3.5l9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-banner">{error}</div>}

          {!result && (
            <>
              <p style={{ color: "var(--color-muted)", fontSize: 14, marginTop: 0 }}>
                Selecione um arquivo .json com um array <code>postos</code> (mesmo formato do levantamento de
                mercado). Postos com o mesmo Google Place ID ou mesmo nome já cadastrado na cidade são ignorados
                automaticamente.
              </p>

              <div className="file-drop" onClick={() => fileInputRef.current?.click()}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
                {fileName ? (
                  <div>
                    <strong>{fileName}</strong>
                    {payload && (
                      <p style={{ margin: "4px 0 0", color: "var(--color-muted)", fontSize: 13 }}>
                        {payload.postos.length} posto(s) encontrado(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "var(--color-muted)" }}>Clique para selecionar o arquivo .json</p>
                )}
              </div>
            </>
          )}

          {result && (
            <div>
              <p>
                <strong>{result.imported}</strong> posto(s) importado(s) de {result.total}.
                {result.skippedCount > 0 && ` ${result.skippedCount} ignorado(s).`}
              </p>
              {result.skipped.length > 0 && (
                <ul style={{ fontSize: 13, color: "var(--color-muted)", maxHeight: 200, overflowY: "auto", paddingLeft: 18 }}>
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      {s.nome || "(sem nome)"} — {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {result ? (
            <button type="button" className="button-primary" onClick={onClose}>
              Fechar
            </button>
          ) : (
            <>
              <button type="button" className="button-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="button-primary" disabled={!payload || importing} onClick={handleImport}>
                {importing ? "Importando..." : payload ? `Importar ${payload.postos.length} posto(s)` : "Importar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
