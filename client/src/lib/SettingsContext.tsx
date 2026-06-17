import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";
import { setCurrency } from "./format";

export interface OrgSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  logo: string;
  currency: string;
  taxNumber?: string;
}
export interface InvoiceSettings {
  defaultTaxRate: number;
  terms: string;
}

interface SettingsContextType {
  org: OrgSettings;
  invoice: InvoiceSettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_ORG: OrgSettings = { name: "إدارة المشاريع", phone: "", email: "", address: "", logo: "", currency: "ر.س" };
const DEFAULT_INVOICE: InvoiceSettings = { defaultTaxRate: 0, terms: "" };

const SettingsContext = createContext<SettingsContextType>({
  org: DEFAULT_ORG,
  invoice: DEFAULT_INVOICE,
  loading: true,
  refresh: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [org, setOrg] = useState<OrgSettings>(DEFAULT_ORG);
  const [invoice, setInvoice] = useState<InvoiceSettings>(DEFAULT_INVOICE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/settings");
      if (res.data?.org) {
        const o = { ...DEFAULT_ORG, ...res.data.org };
        setOrg(o);
        if (o.currency) setCurrency(o.currency);
      }
      if (res.data?.invoice) setInvoice({ ...DEFAULT_INVOICE, ...res.data.invoice });
    } catch {
      /* ignore (e.g. before login) */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <SettingsContext.Provider value={{ org, invoice, loading, refresh }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
