import { Extension } from '@tiptap/react';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
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

export function clearFindDecorations(editor: any) {
  if (!editor?.view?.state) return;
  const tr = editor.state.tr.setMeta(findAndReplacePluginKey, {
    decorations: DecorationSet.empty,
    matches: [],
    activeIndex: 0
  });
  editor.view.dispatch(tr);
}

/**
 * Navigates to a specific match:
 * 1. Re-renders decorations so active match is highlighted with .find-match-active
 * 2. Sets ProseMirror TextSelection to match boundaries
 * 3. Smoothly centers the scroll container on the active match
 */
export function goToMatch(editor: any, matches: FindMatch[], activeIndex: number) {
  if (!editor?.view?.state || !matches || matches.length === 0) return;
  const doc = editor.state.doc;
  const match = matches[activeIndex];
  if (!match) return;

  const decorations = createSearchDecorations(doc, matches, activeIndex);
  const tr = editor.state.tr.setMeta(findAndReplacePluginKey, {
    decorations,
    matches,
    activeIndex
  });

  const maxPos = doc.content?.size ?? 0;
  const from = Math.min(match.from, maxPos);
  const to = Math.min(match.to, maxPos);
  if (from <= to) {
    try {
      tr.setSelection(TextSelection.create(doc, from, to));
      tr.scrollIntoView();
    } catch {}
  }

  editor.view.dispatch(tr);

  // Smoothly center the active match in the scrollable manuscript container
  requestAnimationFrame(() => {
    try {
      const viewDom = editor.view?.dom;
      if (!viewDom) return;

      const scrollContainer = viewDom.closest('.overflow-y-auto') || viewDom.parentElement;
      const activeEl = viewDom.querySelector('.find-match-active');

      if (activeEl && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        const relativeTop = elRect.top - containerRect.top + scrollContainer.scrollTop;
        const targetScrollTop = relativeTop - containerRect.height / 2 + elRect.height / 2;
        scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      } else if (match && scrollContainer) {
        const coords = editor.view.coordsAtPos?.(match.from);
        if (coords) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const relativeTop = coords.top - containerRect.top + scrollContainer.scrollTop;
          const targetScrollTop = relativeTop - containerRect.height / 2;
          scrollContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
        }
      }
    } catch (e) {
      console.error('Error centering active match:', e);
    }
  });
}
