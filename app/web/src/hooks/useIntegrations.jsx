import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import pb from '@/lib/pocketbaseClient';

const IntegrationsContext = createContext({
  integrations: {},
  driveImageConfig: { enabled: false },
  loading: true,
  refresh: async () => {},
});

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export function IntegrationsProvider({ children }) {
  const [integrations, setIntegrations] = useState({});
  const [driveImageConfig, setDriveImageConfig] = useState({ enabled: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${PB_URL}/api/app/integrations`);
      const data = res.ok ? await res.json() : {};
      setIntegrations(data.integrations || {});

      if (pb.authStore.isValid) {
        try {
          const adminRes = await pb.send('/api/app/admin/media-config', { method: 'GET' });
          const drive = adminRes?.google_drive;
          setDriveImageConfig({
            enabled: !!drive?.enabled,
            ...(drive?.config || {}),
          });
        } catch {
          setDriveImageConfig({ enabled: false });
        }
      } else {
        setDriveImageConfig({ enabled: false });
      }
    } catch {
      setIntegrations({});
      setDriveImageConfig({ enabled: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    return pb.authStore.onChange(() => { refresh(); });
  }, [refresh]);

  return (
    <IntegrationsContext.Provider value={{ integrations, driveImageConfig, loading, refresh }}>
      {children}
    </IntegrationsContext.Provider>
  );
}

export function useIntegrations() {
  return useContext(IntegrationsContext);
}
