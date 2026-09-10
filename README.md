# XYZ Workbench Frontend

XYZ Workbench vnext 前端独立仓库（React 19 + TypeScript + Vite + Vitest + Playwright）。

从 `DIMSPACE-XYZ-Agent-OS` 主仓库 `apps/workbench-vnext/frontend/` 迁移，仅包含前端代码，不含 kernel / runtime / services / backend。

## 开发

```bash
npm install
npm run dev        # 启动开发服务器
```

## 构建

```bash
npm run build      # tsc --noEmit + vite build
```

## 测试

```bash
npm test           # Vitest 单元测试
npm run test:e2e   # Playwright e2e 测试
```

## 目录结构

```
src/          应用源码（app / client / features / assets / test）
e2e/          Playwright e2e 测试
scripts/      开发辅助脚本（视觉几何校验等）
index.html    Vite 入口
```
