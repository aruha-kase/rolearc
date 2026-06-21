import { Mark, mergeAttributes } from '@tiptap/core';

export const ActionMark = Mark.create({
  name: 'actionMark',

  addAttributes() {
    return {
      config: {
        default: null,
        parseHTML: el => el.getAttribute('data-action-config'),
        renderHTML: attrs => ({ 'data-action-config': attrs.config }),
      },
      label: {
        default: '',
        parseHTML: el => el.getAttribute('data-action-label'),
        renderHTML: attrs => ({ 'data-action-label': attrs.label }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-action-config]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      class: 'action-mark',
      style: 'color: #60a5fa; text-decoration: underline; cursor: pointer; font-weight: 500;',
    }), 0];
  },

  addKeyboardShortcuts() {
    return {};
  },
});
