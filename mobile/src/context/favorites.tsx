import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth';
import { addFavorite, fetchFavoriteIds, removeFavorite } from '@/lib/api';

interface FavoritesContextValue {
  isFavorite: (stationId: string) => boolean;
  toggleFavorite: (stationId: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!accessToken) {
      setFavoriteIds(new Set());
      return;
    }
    fetchFavoriteIds(accessToken)
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => {});
  }, [accessToken]);

  async function toggleFavorite(stationId: string) {
    if (!accessToken) return;
    const wasFavorite = favoriteIds.has(stationId);

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(stationId);
      else next.add(stationId);
      return next;
    });

    try {
      if (wasFavorite) {
        await removeFavorite(accessToken, stationId);
      } else {
        await addFavorite(accessToken, stationId);
      }
    } catch {
      // reverte a atualização otimista se a chamada falhar
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(stationId);
        else next.delete(stationId);
        return next;
      });
    }
  }

  function isFavorite(stationId: string) {
    return favoriteIds.has(stationId);
  }

  return <FavoritesContext.Provider value={{ isFavorite, toggleFavorite }}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites deve ser usado dentro de FavoritesProvider');
  return ctx;
}
