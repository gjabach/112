import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { FindMatch } from '@/lib/find-replace';

export const findAndReplacePluginKey = new PluginKey('findAndReplacePlugin');

export interface FindPluginState {
  decorations: DecorationSet;
  matches: FindMatch[];
  activeIndex: number;
}

export function createSearchDecorations(doc: any, matches: FindMatch[], activeIndex: number): DecorationSet {
  if (!matches || matches.length === 0 || !doc) {
    return DecorationSet.empty;
  }

  const decos: Decoration[] = [];
  const maxPos = doc.content?.size ?? 0;

  matches.forEach((m, idx) => {
    if (m.from >= 0 && m.to <= maxPos && m.from < m.to) {
      const isActive = idx === activeIndex;
      decos.push(
        Decoration.inline(m.from, m.to, {
          class: isActive ? 'find-match find-match-active' : 'find-match',
          'data-find-index': String(idx)
        })
      );
    }
  });

  return DecorationSet.create(doc, decos);
}

export const FindAndReplaceExtension = Extension.create({
  name: 'findAndReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin<FindPluginState>({
        key: findAndReplacePluginKey,
        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              matches: [],
              activeIndex: 0
            };
          },
          apply(tr, prev) {
            const meta = tr.getMeta(findAndReplacePluginKey);
            if (meta) {
              return meta;
            }
            if (tr.docChanged && prev.decorations) {
              return {
                ...prev,
                decorations: prev.decorations.map(tr.mapping, tr.doc)
              };
            }
            return prev;
          }
        },
        props: {
          decorations(state) {
            return findAndReplacePluginKey.getState(state)?.decorations;
          }
        }
      })
    ];
  }
});

export function updateFindDecorations(editor: any, matches: FindMatch[], activeIndex: number) {
  if (!editor?.view?.state) return;
  const doc = editor.state.doc;
  const decorations = createSearchDecorations(doc, matches, activeIndex);
  const tr = editor.state.tr.setMeta(findAndReplacePluginKey, {
    decorations,
    matches,
    activeIndex
  });
  editor.view.dispatch(tr);
}

export function clearFindDecorations(editor: any) {
  if (!editor?.view?.state) return;
  const tr = editor.state.tr.setMeta(findAndReplacePluginKey, {
    decorations: DecorationSet.empty,
    matches: [],
    activeIndex: 0
  });
  editor.view.dispatch(tr);
}

export function scrollActiveMatchIntoView(editor: any, match?: FindMatch) {
  if (!editor?.view?.dom) return;
  try {
    setTimeout(() => {
      const activeEl = editor.view.dom.querySelector('.find-match-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (match) {
        const coords = editor.view.coordsAtPos?.(match.from);
        if (coords) {
          const scrollContainer = editor.view.dom.closest('.overflow-y-auto');
          if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const topOffset = coords.top - containerRect.top + scrollContainer.scrollTop - 120;
            scrollContainer.scrollTo({ top: topOffset, behavior: 'smooth' });
          }
        }
      }
    }, 30);
  } catch (err) {
    console.error('Error scrolling active match into view:', err);
  }
}
