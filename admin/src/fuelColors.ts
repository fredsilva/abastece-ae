import type { FuelType } from "./types";

// Slots 1/3/2 do tema categórico validado (ver skill de dataviz — ordem fixa, nunca
// ciclada; os 3 primeiros slots são os únicos que passam a checagem all-pairs de CVD).
export const FUEL_COLORS: Record<FuelType, string> = {
  gasolina: "#2a78d6",
  etanol: "#1baf7a",
  diesel: "#eb6834",
};
