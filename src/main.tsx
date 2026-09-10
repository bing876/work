import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MockWorkbenchClient } from './client/mock-workbench-client';
import { WorkbenchClientProvider } from './app/workbench-context';
import { App } from './app/App';
import './styles.css';

const client = new MockWorkbenchClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode><WorkbenchClientProvider client={client}><App /></WorkbenchClientProvider></StrictMode>,
);
