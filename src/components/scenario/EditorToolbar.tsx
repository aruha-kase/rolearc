import { useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, List, ListOrdered, Image as ImageIcon, Zap,
  EyeOff, Layers, UserX, Clipboard, Undo2, Redo2, Download, Upload, Settings2,
} from 'lucide-react';

const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px', '64px'];

interface HeadingSizes {
  h1: string;
  h2: string;
  h3: string;
}

interface EditorToolbarProps {
  editor: Editor | null;
  hasSelection?: boolean;
  hasActionMark?: boolean;
  bgColor?: string;
  onBgColorChange?: (color: string) => void;
  onSetAction?: () => void;
  onRemoveAction?: () => void;
  onAddActionButton?: () => void;
  hideAllObjects?: boolean;
  hideCharacterObjects?: boolean;
  onToggleHideAll?: () => void;
  onToggleHideCharacters?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  headingSizes?: HeadingSizes;
  onHeadingSizeChange?: (level: 'h1' | 'h2' | 'h3', size: string) => void;
}

const ToolBtn = ({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) => (
  <button
    onMouseDown={e => { e.preventDefault(); if (!disabled) onClick(); }}
    title={title}
    disabled={disabled}
    className={`p-1.5 rounded transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'}`}
  >
    {children}
  </button>
);

const HEADING_PRESETS = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px', '56px', '64px', '80px'];

function HeadingSizePanel({ headingSizes, onHeadingSizeChange }: {
  headingSizes: HeadingSizes;
  onHeadingSizeChange: (level: 'h1' | 'h2' | 'h3', size: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded border border-border bg-card/80">
      {(['h1', 'h2', 'h3'] as const).map(level => (
        <div key={level} className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase font-medium">{level}</span>
          <select
            value={headingSizes[level]}
            onChange={e => onHeadingSizeChange(level, e.target.value)}
            onMouseDown={e => e.stopPropagation()}
            className="text-[11px] bg-transparent border border-border rounded px-1 py-0.5 text-foreground cursor-pointer"
          >
            {HEADING_PRESETS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export function EditorToolbar({
  editor, hasSelection, hasActionMark, bgColor, onBgColorChange,
  onSetAction, onRemoveAction, onAddActionButton,
  hideAllObjects, hideCharacterObjects, onToggleHideAll, onToggleHideCharacters,
  onExport, onImport,
  headingSizes, onHeadingSizeChange,
}: EditorToolbarProps) {
  const [showHeadingPanel, setShowHeadingPanel] = useState(false);

  if (!editor) return null;

  // Get current font size from selection
  const currentFontSize = editor.getAttributes('textStyle').fontSize ?? '';

  return (
    <div className="shrink-0" style={{ borderBottom: '1px solid hsla(0 0% 100% / 0.06)', background: 'hsla(0 0% 0% / 0.2)' }}>
      <div className="flex items-center gap-0.5 px-4 py-1.5 flex-wrap">
        {/* Undo / Redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()} title="元に戻す (Ctrl+Z)">
          <Undo2 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()} title="やり直す (Ctrl+Y)">
          <Redo2 size={15} />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Headings */}
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })} title="見出し1">
          <Heading1 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })} title="見出し2">
          <Heading2 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })} title="見出し3">
          <Heading3 size={15} />
        </ToolBtn>
        {/* Heading size settings toggle */}
        {headingSizes && onHeadingSizeChange && (
          <ToolBtn
            onClick={() => setShowHeadingPanel(v => !v)}
            active={showHeadingPanel}
            title="見出しサイズを設定"
          >
            <Settings2 size={13} />
          </ToolBtn>
        )}

        <div className="w-px h-4 bg-border mx-1" />

        {/* Font size */}
        <div className="flex items-center gap-1 mx-1">
          <span className="text-[10px] text-muted-foreground">文字</span>
          <select
            value={currentFontSize}
            onChange={e => {
              const val = e.target.value;
              if (!val) {
                editor.chain().focus().unsetFontSize().run();
              } else {
                editor.chain().focus().setFontSize(val).run();
              }
            }}
            onMouseDown={e => { e.stopPropagation(); }}
            className="text-[11px] bg-transparent border border-border rounded px-1 py-0.5 text-foreground cursor-pointer"
            title="文字サイズ"
          >
            <option value="">デフォルト</option>
            {FONT_SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Text style */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')} title="太字">
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')} title="斜体">
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')} title="取り消し線">
          <Strikethrough size={15} />
        </ToolBtn>

        {/* Color */}
        <div className="flex items-center gap-1 mx-1">
          <span className="text-[10px] text-muted-foreground">色</span>
          <input
            type="color"
            defaultValue="#ffffff"
            onChange={e => editor.chain().focus().setColor(e.target.value).run()}
            className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent p-0"
            title="文字色"
          />
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Alignment */}
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })} title="左揃え">
          <AlignLeft size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })} title="中央揃え">
          <AlignCenter size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })} title="右揃え">
          <AlignRight size={15} />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Lists */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')} title="箇条書き">
          <List size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')} title="番号リスト">
          <ListOrdered size={15} />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Image */}
        <ToolBtn
          onClick={() => {
            const url = window.prompt('画像URL');
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
          title="画像挿入"
        >
          <ImageIcon size={15} />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Editor background color */}
        {onBgColorChange && (
          <div className="flex items-center gap-1 mx-1">
            <span className="text-[10px] text-muted-foreground">背景</span>
            <input
              type="color"
              value={bgColor ?? '#0f1117'}
              onChange={e => onBgColorChange(e.target.value)}
              className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent p-0"
              title="背景色"
            />
          </div>
        )}

        <div className="w-px h-4 bg-border mx-1" />

        {/* Action buttons — context-aware */}
        {(hasSelection || hasActionMark) && onSetAction && (
          <ToolBtn onClick={onSetAction} active={hasActionMark} title="アクションを設定/編集">
            <Zap size={15} />
          </ToolBtn>
        )}
        {hasActionMark && onRemoveAction && (
          <button
            onMouseDown={e => { e.preventDefault(); onRemoveAction(); }}
            title="アクションを削除"
            className="p-1.5 rounded text-destructive hover:bg-secondary/60 transition-colors text-[10px] font-medium"
          >
            解除
          </button>
        )}
        {!hasSelection && !hasActionMark && onAddActionButton && (
          <ToolBtn onClick={onAddActionButton} title="アクションボタンを挿入">
            <Zap size={15} />
          </ToolBtn>
        )}
        {!hasSelection && !hasActionMark && editor && (
          <ToolBtn
            onClick={() => {
              const stored = localStorage.getItem('lsm-copied-button');
              if (!stored) return;
              try {
                const { config, label, buttonText, color } = JSON.parse(stored);
                editor.chain().focus().insertContent({ type: 'actionButton', attrs: { config, label, buttonText, color } }).run();
              } catch { /* ignore */ }
            }}
            title="コピーしたボタンをペースト"
          >
            <Clipboard size={15} />
          </ToolBtn>
        )}

        {(onToggleHideAll || onToggleHideCharacters) && (
          <div className="w-px h-4 bg-border mx-1" />
        )}

        {onToggleHideAll && (
          <ToolBtn onClick={onToggleHideAll} active={hideAllObjects} title={hideAllObjects ? 'オブジェクトを表示' : '全オブジェクトを非表示'}>
            {hideAllObjects ? <Layers size={15} /> : <EyeOff size={15} />}
          </ToolBtn>
        )}
        {onToggleHideCharacters && (
          <ToolBtn onClick={onToggleHideCharacters} active={hideCharacterObjects} title={hideCharacterObjects ? 'キャラクターを表示' : 'キャラクターを非表示'}>
            <UserX size={15} />
          </ToolBtn>
        )}

        {(onExport || onImport) && (
          <div className="w-px h-4 bg-border mx-1" />
        )}
        {onExport && (
          <ToolBtn onClick={onExport} title="シナリオをファイルに書き出す">
            <Download size={15} />
          </ToolBtn>
        )}
        {onImport && (
          <ToolBtn onClick={onImport} title="ファイルからシナリオを読み込む">
            <Upload size={15} />
          </ToolBtn>
        )}
      </div>

      {/* Heading size panel */}
      {showHeadingPanel && headingSizes && onHeadingSizeChange && (
        <div className="px-4 pb-2">
          <HeadingSizePanel headingSizes={headingSizes} onHeadingSizeChange={onHeadingSizeChange} />
        </div>
      )}
    </div>
  );
}
