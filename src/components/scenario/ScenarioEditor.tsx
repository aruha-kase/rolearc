import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { List, ChevronDown, ChevronRight } from 'lucide-react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { useScenario } from '@/hooks/useScenario';
import { useRoom } from '@/hooks/useRoom';
import { useBgm } from '@/hooks/useBgm';
import { useSePlayer } from '@/hooks/useSePlayer';
import { useMasterVolume } from '@/hooks/useMasterVolume';
import { useScenarioActions } from '@/hooks/useScenarioActions';
import { EditorToolbar } from './EditorToolbar';
import { ActionConfigModal } from './ActionConfigModal';
import { ActionMark } from './ActionMark';
import { ActionButton } from './ActionButton';
import { FontSizeExtension } from './FontSizeExtension';
import { ActionConfig, ACTION_LABELS } from './types';
import { toast } from 'sonner';

interface ScenarioEditorProps {
  roomId: string;
}

interface ContextMenu {
  x: number;
  y: number;
  hasSelection: boolean;
  hasActionMark: boolean;
}

export function ScenarioEditor({ roomId }: ScenarioEditorProps) {
  const { scenario, saving, saveScenario } = useScenario(roomId);
  const { room, scenes, objects, roomBroadcast, hideAllObjects, setHideAllObjects, hideCharacterObjects, setHideCharacterObjects } = useRoom(roomId);
  const { masterVolume } = useMasterVolume();
  // LSM is a editing view — mute local audio to avoid double playback with BoardPage
  const bgm = useBgm(roomId, room?.current_scene_id ?? null, 0);
  const se = useSePlayer(roomId, 0);
  const { execute } = useScenarioActions(
    roomId, objects, room?.current_scene_id ?? null, roomBroadcast,
    hideAllObjects, setHideAllObjects, hideCharacterObjects, setHideCharacterObjects,
    bgm.playTrack, bgm.stopPlayback, se.playSe, se.stopSe,
  );

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [actionModal, setActionModal] = useState<{ initial?: ActionConfig | null; buttonPos?: number; isButton?: boolean; initialButtonText?: string; initialColor?: string } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [hasActionMark, setHasActionMark] = useState(false);
  const [bgColor, setBgColor] = useState(() => localStorage.getItem('lsm-bg-color') ?? '#0f1117');
  const [headingSizes, setHeadingSizes] = useState(() => {
    // 旧emの保存値はpxへ換算（1em=16px）して移行
    const toPx = (v: string | null, fallback: string) => {
      if (!v) return fallback;
      if (v.endsWith('px')) return v;
      if (v.endsWith('em')) return `${Math.round(parseFloat(v) * 16)}px`;
      return fallback;
    };
    return {
      h1: toPx(localStorage.getItem('lsm-h1-size'), '32px'),
      h2: toPx(localStorage.getItem('lsm-h2-size'), '24px'),
      h3: toPx(localStorage.getItem('lsm-h3-size'), '20px'),
    };
  });
  const [showToc, setShowToc] = useState(false);
  const [tocItems, setTocItems] = useState<{ level: number; text: string; pos: number }[]>([]);

  // 見出しから目次を生成
  const refreshToc = useCallback((ed: Editor) => {
    const items: { level: number; text: string; pos: number }[] = [];
    ed.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        items.push({ level: node.attrs.level ?? 1, text: node.textContent || '(無題)', pos });
      }
    });
    setTocItems(items);
  }, []);
  const editorRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const longPressPos = useRef({ x: 0, y: 0 });
  const longPressFired = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image,
      ActionMark,
      ActionButton,
      FontSizeExtension,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-full p-8 pb-32',
      },
    },
    onUpdate: ({ editor }) => {
      saveScenario(editor.getJSON());
      refreshToc(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      setHasSelection(!editor.state.selection.empty);
      setHasActionMark(editor.isActive('actionMark'));
    },
  });

  // Load saved content
  useEffect(() => {
    if (editor && scenario && editor.isEmpty) {
      editor.commands.setContent(scenario);
      refreshToc(editor);
    }
  }, [editor, scenario, refreshToc]);

  // 目次の見出しへスクロール
  const scrollToHeading = useCallback((pos: number) => {
    if (!editor) return;
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (dom && typeof dom.scrollIntoView === 'function') {
      dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editor]);

  // Handle action mark clicks/taps in the editor
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const tryExecute = (target: HTMLElement): boolean => {
      const actionEl = target.closest('[data-action-config]') as HTMLElement | null;
      if (!actionEl) return false;
      const configStr = actionEl.getAttribute('data-action-config');
      if (!configStr) return false;
      try { execute(JSON.parse(configStr) as ActionConfig); return true; } catch { return false; }
    };

    // PC click
    const handleClick = (e: MouseEvent) => tryExecute(e.target as HTMLElement);

    // Mobile tap — only if long press did NOT fire
    const handleTouchEnd = (e: TouchEvent) => {
      if (longPressFired.current) return;
      const touch = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
      if (target && tryExecute(target)) {
        e.preventDefault();
        // Dismiss virtual keyboard after executing action on mobile
        (document.activeElement as HTMLElement)?.blur();
      }
    };

    // ActionButton custom events
    const handleLsmAction = (e: Event) => {
      execute((e as CustomEvent).detail as ActionConfig);
      // Dismiss virtual keyboard — buttons are inside contentEditable so tapping
      // them can focus the editor and show the keyboard on mobile devices.
      (document.activeElement as HTMLElement)?.blur();
    };
    const handleLsmEditButton = (e: Event) => {
      const { pos, attrs } = (e as CustomEvent).detail;
      const initial = attrs.config ? JSON.parse(attrs.config) as ActionConfig : null;
      setActionModal({ initial, buttonPos: pos, isButton: true, initialButtonText: attrs.buttonText ?? '', initialColor: attrs.color ?? '#3b82f6' });
    };

    el.addEventListener('click', handleClick);
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    el.addEventListener('lsm-action', handleLsmAction);
    el.addEventListener('lsm-edit-button', handleLsmEditButton);
    return () => {
      el.removeEventListener('click', handleClick);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('lsm-action', handleLsmAction);
      el.removeEventListener('lsm-edit-button', handleLsmEditButton);
    };
  }, [execute]);

  const openContextMenu = useCallback((x: number, y: number) => {
    if (!editor) return;
    const sel = !editor.state.selection.empty;
    const mark = editor.isActive('actionMark');
    if (!sel && !mark) return;
    setContextMenu({ x, y, hasSelection: sel, hasActionMark: mark });
  }, [editor]);

  // Right-click context menu (PC)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY);
  }, [openContextMenu]);

  // Long press (mobile)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressPos.current = { x: touch.clientX, y: touch.clientY };
    longPressFired.current = false;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      openContextMenu(longPressPos.current.x, longPressPos.current.y);
    }, 500);
  }, [openContextMenu]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleSetAction = useCallback(() => {
    if (!editor) return;
    setContextMenu(null);
    // Get existing mark config if any
    const marks = editor.state.selection.$from.marks();
    const existing = marks.find(m => m.type.name === 'actionMark');
    const initial = existing ? JSON.parse(existing.attrs.config) as ActionConfig : null;
    setActionModal({ initial });
  }, [editor]);

  const handleRemoveAction = useCallback(() => {
    editor?.chain().focus().unsetMark('actionMark').run();
    setContextMenu(null);
  }, [editor]);

  const handleSaveAction = useCallback((config: ActionConfig, buttonText?: string, color?: string) => {
    if (!editor) return;
    if (actionModal?.buttonPos !== undefined) {
      // Update existing button node
      const pos = actionModal.buttonPos;
      editor.chain().focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, {
            config: JSON.stringify(config),
            label: ACTION_LABELS[config.type],
            buttonText: buttonText ?? ACTION_LABELS[config.type],
            color: color ?? '#3b82f6',
          });
          return true;
        })
        .run();
    } else if (hasSelection) {
      // Apply as inline mark
      editor.chain().focus()
        .setMark('actionMark', {
          config: JSON.stringify(config),
          label: ACTION_LABELS[config.type],
        })
        .run();
    } else {
      // Insert new button node — close modal first so editor regains focus
      setActionModal(null);
      const attrs = {
        config: JSON.stringify(config),
        label: ACTION_LABELS[config.type],
        buttonText: buttonText ?? ACTION_LABELS[config.type],
        color: color ?? '#3b82f6',
      };
      requestAnimationFrame(() => {
        editor.chain().focus().insertContent({ type: 'actionButton', attrs }).run();
      });
      return;
    }
    setActionModal(null);
  }, [editor, actionModal, hasSelection]);

  // エクスポート: 現在のシナリオをJSONファイルとしてダウンロード
  const handleExport = useCallback(() => {
    if (!editor) return;
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      scenario: editor.getJSON(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lsm-scenario-${date}.rolearc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editor]);

  // インポート: ファイルピッカーを開く
  const handleImport = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  // インポート: ファイルを読み込んでエディタに適用
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const content = json.scenario ?? json; // バージョン付きorレガシー両対応
        editor.commands.setContent(content);
        saveScenario(content);
        toast.success('シナリオを読み込みました');
      } catch {
        toast.error('ファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [editor, saveScenario]);

  const handleHeadingSizeChange = useCallback((level: 'h1' | 'h2' | 'h3', size: string) => {
    setHeadingSizes(prev => {
      const next = { ...prev, [level]: size };
      localStorage.setItem(`lsm-${level}-size`, size);
      return next;
    });
  }, []);

  const handleToggleHideAll = useCallback(() => {
    const next = !hideAllObjects;
    setHideAllObjects(next);
    setHideCharacterObjects(false);
    roomBroadcast('visibility_filter', { hideAll: next, hideCharacters: false });
  }, [hideAllObjects, setHideAllObjects, setHideCharacterObjects, roomBroadcast]);

  const handleToggleHideCharacters = useCallback(() => {
    const next = !hideCharacterObjects;
    setHideCharacterObjects(next);
    setHideAllObjects(false);
    roomBroadcast('visibility_filter', { hideAll: false, hideCharacters: next });
  }, [hideCharacterObjects, setHideCharacterObjects, setHideAllObjects, roomBroadcast]);

  const bgmTracks = bgm.tracks.map(t => ({ id: t.id, name: t.name }));
  const seTracks = se.tracks.map(t => ({ id: t.id, name: t.name }));

  return (
    <div className="h-full flex flex-col" onClick={closeContextMenu}>
      <style>{`
        .lsm-editor h1 { font-size: ${headingSizes.h1} !important; }
        .lsm-editor h2 { font-size: ${headingSizes.h2} !important; }
        .lsm-editor h3 { font-size: ${headingSizes.h3} !important; }
      `}</style>
      <EditorToolbar
        editor={editor}
        hasSelection={hasSelection}
        hasActionMark={hasActionMark}
        bgColor={bgColor}
        onBgColorChange={c => { setBgColor(c); localStorage.setItem('lsm-bg-color', c); }}
        onSetAction={handleSetAction}
        onRemoveAction={handleRemoveAction}
        onAddActionButton={() => setActionModal({ isButton: true })}
        hideAllObjects={hideAllObjects}
        hideCharacterObjects={hideCharacterObjects}
        onToggleHideAll={handleToggleHideAll}
        onToggleHideCharacters={handleToggleHideCharacters}
        onExport={handleExport}
        onImport={handleImport}
        headingSizes={headingSizes}
        onHeadingSizeChange={handleHeadingSizeChange}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".rolearc,.json"
        className="hidden"
        onChange={handleFileImport}
      />

      {/* 目次バー（折りたたみ） */}
      <div className="shrink-0 border-b border-border/40" style={{ background: 'hsla(0 0% 0% / 0.15)' }}>
        <button
          onClick={() => setShowToc(v => !v)}
          className="flex items-center gap-1.5 px-4 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showToc ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <List size={13} />
          目次{tocItems.length > 0 ? `（${tocItems.length}）` : ''}
        </button>
        {showToc && (
          <div className="px-4 pb-2 flex flex-col gap-0.5 max-h-52 overflow-y-auto">
            {tocItems.length === 0 ? (
              <span className="text-[10px] text-muted-foreground/50 px-1">見出し（H1〜H3）がありません</span>
            ) : (
              tocItems.map((it, i) => (
                <button
                  key={i}
                  onClick={() => scrollToHeading(it.pos)}
                  style={{ paddingLeft: 4 + (it.level - 1) * 14 }}
                  className="text-left text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded py-0.5 pr-2 truncate transition-colors"
                >
                  {it.text}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto lsm-editor" ref={editorRef} style={{ background: bgColor }}>
        <EditorContent
          editor={editor}
          className="h-full"
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchEnd}
        />
      </div>

      {saving && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground bg-card px-3 py-1 rounded-full shadow">
          保存中...
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-[150] glass-panel py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.hasSelection && (
            <button
              onClick={handleSetAction}
              className="w-full text-left text-[12px] px-4 py-2 text-foreground hover:bg-secondary/60 transition-colors"
            >
              アクションを設定
            </button>
          )}
          {contextMenu.hasActionMark && (
            <>
              <button
                onClick={handleSetAction}
                className="w-full text-left text-[12px] px-4 py-2 text-foreground hover:bg-secondary/60 transition-colors"
              >
                アクションを編集
              </button>
              <button
                onClick={handleRemoveAction}
                className="w-full text-left text-[12px] px-4 py-2 text-destructive hover:bg-secondary/60 transition-colors"
              >
                アクションを削除
              </button>
            </>
          )}
          {!contextMenu.hasSelection && !contextMenu.hasActionMark && (
            <div className="text-[11px] text-muted-foreground px-4 py-2">
              テキストを選択してください
            </div>
          )}
        </div>
      )}

      {/* Action config modal */}
      {actionModal && (
        <ActionConfigModal
          initial={actionModal.initial}
          isButton={actionModal.isButton}
          initialButtonText={actionModal.initialButtonText}
          initialColor={actionModal.initialColor}
          scenes={scenes}
          currentSceneId={room?.current_scene_id ?? null}
          objects={objects}
          bgmTracks={bgmTracks}
          seTracks={seTracks}
          onSave={handleSaveAction}
          onCancel={() => setActionModal(null)}
        />
      )}
    </div>
  );
}
