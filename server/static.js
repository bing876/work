// 生产静态托管(零依赖):把 vite build 产物 dist/ 随后端一起提供,单服务单端口。
// - 只有 dist/ 存在时才接管;开发/测试环境无 dist,返回 false 走原有 JSON 404。
// - 非文件路径回退到 index.html(SPA);防目录穿越;assets 下哈希文件长缓存。
import { readFileSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
const typeFor = (path) => MIME[path.slice(path.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream';
const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** 命中静态文件返回 true(已响应);无 dist 或非静态请求返回 false */
export function serveStatic(req, res, distDir) {
  if (!isFile(join(distDir, 'index.html'))) return false;
  let pathname;
  try {
    pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  } catch {
    return false;
  }
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const file = join(distDir, rel === '' ? 'index.html' : rel);
  if (!file.startsWith(distDir + sep)) return false; // 目录穿越
  const target = isFile(file) ? file : join(distDir, 'index.html'); // SPA 回退
  const body = readFileSync(target);
  const hashed = target.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'Content-Type': typeFor(target),
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-store',
    'Content-Length': body.length,
  });
  if (req.method !== 'HEAD') res.end(body);
  else res.end();
  return true;
}
