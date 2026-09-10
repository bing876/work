import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MockWorkbenchClient } from './client/mock-workbench-client';
import { HttpWorkbenchClient } from './client/http-workbench-client';
import { getToken } from './client/auth';
import { WorkbenchClientProvider } from './app/workbench-context';
import { AuthGate } from './app/AuthGate';
import { App } from './app/App';
import './styles.css';

// 一键切换:默认连真实后端,VITE_API_MODE=mock 切回本地假数据(见 .env.example)
// 真实模式走双界面:登录小卡片 -> 工作台;mock 模式直进工作台
const isMock = import.meta.env.VITE_API_MODE === 'mock';
const client = isMock
  ? new MockWorkbenchClient()
  : new HttpWorkbenchClient({ baseUrl: import.meta.env.VITE_API_BASE_URL || '', getToken });

createRoot(document.getElementById('root')!).render(
  <StrictMode><WorkbenchClientProvider client={client}>{isMock ? <App /> : <AuthGate><App /></AuthGate>}</WorkbenchClientProvider></StrictMode>,
);
