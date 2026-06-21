import { Node, mergeAttributes } from '@tiptap/core';

export const ActionButton = Node.create({
  name: 'actionButton',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      config: {
        default: null,
        parseHTML: el => el.getAttribute('data-action-config'),
        renderHTML: attrs => ({ 'data-action-config': attrs.config }),
      },
      label: {
        default: 'ボタン',
        parseHTML: el => el.getAttribute('data-action-label'),
        renderHTML: attrs => ({ 'data-action-label': attrs.label }),
      },
      buttonText: {
        default: '',
        parseHTML: el => el.getAttribute('data-button-text'),
        renderHTML: attrs => ({ 'data-button-text': attrs.buttonText }),
      },
      color: {
        default: 'default',
        parseHTML: el => el.getAttribute('data-color'),
        renderHTML: attrs => ({ 'data-color': attrs.color }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-action-button]' }, { tag: 'div[data-action-button]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const color = HTMLAttributes['data-color'] ?? '#3b82f6';
    const text = HTMLAttributes['data-button-text'] || HTMLAttributes['data-action-label'] || 'ボタン';

    return ['span', mergeAttributes(HTMLAttributes, {
      'data-action-button': 'true',
      style: 'display: inline-flex; margin: 4px;',
    }), ['button', {
      style: `background:${color};color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;`,
      'data-action-config': HTMLAttributes['data-action-config'],
    }, text]];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement('span');
      wrapper.style.cssText = 'margin: 4px; display: inline-flex; vertical-align: middle; align-items: center; gap: 6px;';

      // ドラッグハンドル（インライン上の位置をドラッグで移動）
      const handle = document.createElement('span');
      handle.textContent = '⠿';
      handle.setAttribute('data-drag-handle', '');
      handle.setAttribute('draggable', 'true');
      handle.setAttribute('contenteditable', 'false');
      handle.title = 'ドラッグで移動';
      handle.style.cssText = 'cursor: grab; color: #888; font-size: 13px; line-height: 1; user-select: none; padding: 0 2px;';

      const btn = document.createElement('button');
      const bg = node.attrs.color ?? '#3b82f6';
      btn.style.cssText = `background:${bg};color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.15s;`;
      btn.textContent = node.attrs.buttonText || node.attrs.label || 'ボタン';
      btn.title = node.attrs.label ?? '';

      // Edit button (shown in edit mode)
      const editBtn = document.createElement('button');
      editBtn.textContent = '⚙';
      editBtn.style.cssText = 'background:transparent;border:1px solid #555;border-radius:4px;padding:2px 6px;font-size:11px;color:#aaa;cursor:pointer;';
      editBtn.title = '編集';

      const copyBtn = document.createElement('button');
      copyBtn.textContent = '⎘';
      copyBtn.style.cssText = 'background:transparent;border:1px solid #555;border-radius:4px;padding:2px 6px;font-size:11px;color:#aaa;cursor:pointer;';
      copyBtn.title = 'コピー';

      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.style.cssText = 'background:transparent;border:1px solid #555;border-radius:4px;padding:2px 6px;font-size:11px;color:#aaa;cursor:pointer;';
      delBtn.title = '削除';

      // Prevent all buttons from stealing focus from the editor area —
      // on mobile this is what causes the virtual keyboard to appear.
      const preventFocus = (e: MouseEvent) => e.preventDefault();
      [btn, editBtn, copyBtn, delBtn].forEach(b =>
        b.addEventListener('mousedown', preventFocus)
      );

      // Action execute
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        (document.activeElement as HTMLElement)?.blur();
        if (!node.attrs.config) return;
        try {
          const event = new CustomEvent('lsm-action', { detail: JSON.parse(node.attrs.config), bubbles: true });
          wrapper.dispatchEvent(event);
        } catch { /* ignore */ }
      });

      // Open edit modal
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const event = new CustomEvent('lsm-edit-button', {
          detail: { pos: typeof getPos === 'function' ? getPos() : 0, attrs: node.attrs },
          bubbles: true,
        });
        wrapper.dispatchEvent(event);
      });

      // Copy button config to localStorage
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.setItem('lsm-copied-button', JSON.stringify({
          config: node.attrs.config,
          label: node.attrs.label,
          buttonText: node.attrs.buttonText,
          color: node.attrs.color,
        }));
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '⎘'; }, 1000);
      });

      // Delete node
      delBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos === null) return;
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      });

      wrapper.appendChild(handle);
      wrapper.appendChild(btn);
      wrapper.appendChild(editBtn);
      wrapper.appendChild(copyBtn);
      wrapper.appendChild(delBtn);

      return { dom: wrapper };
    };
  },
});
