import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MockWorkbenchClient } from './client/mock-workbench-client';
import { HttpWorkbenchClient } from './client/http-workbench-client';
import { WorkbenchClientProvider } from './app/workbench-context';
import { App } from './app/App';
import './styles.css';

// 一键切换:默认连真实后端,VITE_API_MODE=mock 切回本地假数据(见 .env.example)
const client =
  import.meta.env.VITE_API_MODE === 'mock'
    ? new MockWorkbenchClient()
    : new HttpWorkbenchClient({ baseUrl: import.meta.env.VITE_API_BASE_URL || '' });

createRoot(document.getElementById('root')!).render(
  <StrictMode><WorkbenchClientProvider client={client}><App /></WorkbenchClientProvider></StrictMode>,
);
