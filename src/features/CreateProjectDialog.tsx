import { useRef, useState } from 'react';
import type { AttachmentRef, CreateProjectInput, ProjectAvatar } from '../client/workbench-client';
import attachmentFileIcon from '../assets/create-project/attachment-file.svg';
import attachmentFolderIcon from '../assets/create-project/attachment-folder.svg';
import attachmentImageIcon from '../assets/create-project/attachment-image.svg';
import folderIcon from '../assets/create-project/folder-icon.svg';
import plusIcon from '../assets/create-project/plus-icon.svg';

const placeholder = '想做什么？也可以直接拖入文件夹、图片或文件';
const fileRef = (file: File, index: number): AttachmentRef => ({ id: `${file.name}-${file.size}-${file.lastModified}-${index}`, displayName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
const attachmentVisual = (attachment: AttachmentRef) => attachment.mimeType === 'application/x-directory'
  ? { kind: 'folder', icon: attachmentFolderIcon }
  : attachment.mimeType.startsWith('image/')
    ? { kind: 'image', icon: attachmentImageIcon }
    : { kind: 'file', icon: attachmentFileIcon };

type Props = { onClose: () => void; onCreate: (input: CreateProjectInput) => Promise<void> };
type UploadedProjectAvatar = Extract<ProjectAvatar, { source: 'upload' }>;

export function CreateProjectDialog({ onClose, onCreate }: Props) {
  const folderInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<UploadedProjectAvatar | null>(null);
  const [name, setName] = useState('');
  const [workingFolder, setWorkingFolder] = useState<CreateProjectInput['workingFolder']>(null);
  const [initialMessage, setInitialMessage] = useState('');
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [templateEnabled, setTemplateEnabled] = useState(false);
  const [industryIntelligenceEnabled, setIndustryIntelligenceEnabled] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const next = Array.from(files).map(fileRef);
    setAttachments((current) => [...current, ...next.filter((item) => !current.some((existing) => existing.id === item.id))]);
  };

  const selectFolder = (displayName: string) => {
    const folder = { displayName, mockRef: `browser-folder:${displayName}` };
    const attachment: AttachmentRef = { id: `folder:${displayName}`, displayName, mimeType: 'application/x-directory', size: 0 };
    setWorkingFolder(folder);
    if (!name.trim()) setName(displayName);
    setAttachments((current) => [attachment, ...current.filter((item) => item.mimeType !== 'application/x-directory')]);
    setInitialMessage('');
  };

  const chooseFolder = (files: FileList | null) => {
    const first = files?.[0];
    if (!first) return;
    const relativePath = (first as File & { webkitRelativePath?: string }).webkitRelativePath;
    selectFolder(relativePath?.split('/')[0] || first.name);
  };

  const chooseAvatar = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar({ source: 'upload', name: file.name, mimeType: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatar(null);
    if (avatarInput.current) avatarInput.current.value = '';
  };

  const removeAttachment = (attachment: AttachmentRef) => {
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    if (attachment.mimeType === 'application/x-directory') {
      setWorkingFolder(null);
      if (folderInput.current) folderInput.current.value = '';
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      await onCreate({ ...(avatar ? { avatar } : {}), name, workingFolder, initialMessage: initialMessage.trim(), attachments, templateEnabled, industryIntelligenceEnabled });
    } finally {
      setCreating(false);
    }
  };

  return <dialog className="create-project-modal" open aria-label="创建项目" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <section className="create-project-card">
      <header className="create-project-head"><h2>创建项目</h2></header>
      <button className="create-project-close" type="button" aria-label="关闭创建项目" onClick={onClose} />
      <div className="project-identity">
        <div className={`project-avatar ${avatar ? 'has-avatar' : ''}`}>
          <button className="project-avatar-picker" type="button" aria-label="选择项目头像" title="选择项目头像" onClick={() => avatarInput.current?.click()}>
            {avatar ? <img src={avatar.dataUrl} alt="项目头像" /> : <img className="project-avatar-plus" src={plusIcon} alt="" />}
          </button>
          {avatar && <button className="project-avatar-remove" type="button" aria-label="删除项目头像" onClick={removeAvatar}>×</button>}
        </div>
        <div className="project-name-shell">
          <button type="button" aria-label="选择工作文件夹" title="选择工作文件夹" onClick={() => folderInput.current?.click()}><img className="project-folder-icon" src={folderIcon} alt="" /></button><i />
          <input aria-label="项目名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="项目名称" autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </div>
      </div>
      <div className="project-context"><strong>需求描述</strong><span className={workingFolder ? 'selected' : ''} data-testid="working-folder-status">{workingFolder ? `已添加源文件 · ${workingFolder.displayName}` : '未添加源文件'}</span></div>
      <div className={`project-composer ${dragging ? 'drag' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const directory = Array.from(event.dataTransfer.items).map((item) => item.webkitGetAsEntry?.()).find((entry) => entry?.isDirectory);
        if (directory) selectFolder(directory.name);
        addFiles(event.dataTransfer.files);
        setInitialMessage('');
      }}>
        <div className="project-attachments">{attachments.map((attachment) => {
          const visual = attachmentVisual(attachment);
          return <div className="project-attachment" data-testid={`attachment-${attachment.displayName}`} data-attachment-kind={visual.kind} key={attachment.id}>
            <img src={visual.icon} alt="" /><span>{attachment.displayName}</span>
            <button type="button" aria-label={`移除附件 ${attachment.displayName}`} title="移除附件" onClick={() => removeAttachment(attachment)}>×</button>
          </div>;
        })}</div>
        <textarea className={attachments.length ? 'has-attachments' : ''} aria-label="项目需求" value={initialMessage} onChange={(event) => setInitialMessage(event.target.value)} placeholder={attachments.length ? '' : placeholder} autoComplete="off" spellCheck={false} />
      </div>
      <footer className="create-project-footer">
        <div className="project-options">
          <Option label="模板配置" checked={templateEnabled} onChange={setTemplateEnabled} />
          <div className="project-option industry"><span>行业数据</span><Switch checked={industryIntelligenceEnabled} label="切换行业数据" onChange={setIndustryIntelligenceEnabled} /><span className="project-help" tabIndex={0} aria-label="行业数据帮助">!<span>启用后可获得最新行业数据，CL 消耗会相应增加。</span></span></div>
        </div>
        <div className="project-actions"><button type="button" onClick={onClose}>取消</button><button type="button" className="primary" disabled={creating} onClick={() => void create()}>{creating ? '创建中…' : '创建项目'}</button></div>
      </footer>
      <input ref={folderInput} className="project-file-input" aria-label="工作文件夹输入" type="file" multiple onChange={(event) => chooseFolder(event.target.files)} {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} />
      <input ref={avatarInput} className="project-file-input" aria-label="头像输入" type="file" accept="image/*" onChange={(event) => chooseAvatar(event.target.files)} />
    </section>
  </dialog>;
}

function Option({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="project-option"><span>{label}</span><Switch checked={checked} label={`切换${label}`} onChange={onChange} /></div>;
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <button className={`project-switch ${checked ? 'on' : ''}`} type="button" aria-label={label} aria-pressed={checked} onClick={() => onChange(!checked)}><i /></button>;
}
