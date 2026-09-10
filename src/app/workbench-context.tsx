import { createContext, useContext } from 'react';
import type { WorkbenchClient } from '../client/workbench-client';

const WorkbenchClientContext = createContext<WorkbenchClient | null>(null);

export function WorkbenchClientProvider({ client, children }: { client: WorkbenchClient; children: React.ReactNode }) {
  return <WorkbenchClientContext.Provider value={client}>{children}</WorkbenchClientContext.Provider>;
}

export function useWorkbenchClient(): WorkbenchClient {
  const client = useContext(WorkbenchClientContext);
  if (!client) throw new Error('WorkbenchClientProvider is required');
  return client;
}
