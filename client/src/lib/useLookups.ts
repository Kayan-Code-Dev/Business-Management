import { useEffect, useState } from "react";
import { api } from "../api/client";

export interface Lookup {
  id: number;
  category: string;
  value: string;
  label: string;
}

const cache: { data: Lookup[] | null } = { data: null };

export function useLookups() {
  const [lookups, setLookups] = useState<Lookup[]>(cache.data || []);

  useEffect(() => {
    if (cache.data) return;
    api.get("/lookups").then((res) => {
      cache.data = res.data;
      setLookups(res.data);
    });
  }, []);

  const byCategory = (category: string) => lookups.filter((l) => l.category === category);
  const label = (category: string, value: string | null | undefined) =>
    lookups.find((l) => l.category === category && l.value === value)?.label || value || "—";

  return { lookups, byCategory, label };
}

export function clearLookupCache() {
  cache.data = null;
}
