import { useState } from 'react';
import { X } from '@phosphor-icons/react';

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [pane, setPane] = useState('通用');
  return <dialog className="settings-modal" open aria-label="设置"><section className="settings-card"><aside><h2>设置</h2>{['通用', '外观', '通知', '关于'].map((item) => <button key={item} className={pane === item ? 'selected' : ''} onClick={() => setPane(item)} type="button">{item}</button>)}</aside><main><button className="settings-close" type="button" aria-label="关闭设置" onClick={onClose}><X size={20} /></button><h3>{pane}</h3><p>XYZ Workbench vNext 的本地界面偏好将显示在这里。</p><label>界面缩放<select defaultValue="100"><option value="100">100%</option><option value="110">110%</option></select></label><label className="check-row"><input type="checkbox" defaultChecked />显示在线状态</label></main></section></dialog>;
}
