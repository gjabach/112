import { test } from 'node:test';
import assert from 'node:assert';
import { sortChapters } from './export-helpers.ts';

// Test tree building and flattening logic
function buildTabTree(chapters) {
  const compareSiblings = (a, b) => {
    const orderA = typeof a.orderIndex === 'number' ? a.orderIndex : 0;
    const orderB = typeof b.orderIndex === 'number' ? b.orderIndex : 0;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = a.createdAt || 0;
    const timeB = b.createdAt || 0;
    if (timeA !== timeB) return timeA - timeB;
    return String(a.title || '').localeCompare(String(b.title || ''), 'vi', { numeric: true });
  };

  const idMap = new Map();
  chapters.forEach(c => {
    idMap.set(c.id, { ...c, children: [], depth: 0 });
  });

  const roots = [];

  chapters.forEach(c => {
    const node = idMap.get(c.id);
    if (!node) return;

    if (c.parentId && idMap.has(c.parentId)) {
      const parent = idMap.get(c.parentId);
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const setDepths = (nodes, depth) => {
    nodes.sort(compareSiblings);
    nodes.forEach(n => {
      n.depth = depth;
      if (n.children.length > 0) {
        setDepths(n.children, depth + 1);
      }
    });
  };

  setDepths(roots, 0);
  return roots;
}

function flattenTabTree(roots) {
  const result = [];
  const traverse = (node) => {
    result.push(node);
    if (node.children && node.children.length > 0) {
      node.children.forEach(traverse);
    }
  };
  roots.forEach(traverse);
  return result;
}

test('Document Tabs - buildTabTree correctly builds nested subtabs structure', () => {
  const mockChapters = [
    { id: 'tab_1', title: 'Thẻ 1', parentId: null, orderIndex: 1 },
    { id: 'tab_sub1', title: 'Hương Hỏa', parentId: 'tab_1', orderIndex: 1 },
    { id: 'tab_sub2', title: 'Chương 1: Ông Bụng', parentId: 'tab_1', orderIndex: 2 },
    { id: 'tab_2', title: 'Thế giới & Lore', parentId: null, orderIndex: 2 },
    { id: 'tab_sub2_1', title: 'Phép thuật', parentId: 'tab_2', orderIndex: 1 }
  ];

  const tree = buildTabTree(mockChapters);

  assert.strictEqual(tree.length, 2, 'Should have 2 root tabs');
  assert.strictEqual(tree[0].id, 'tab_1');
  assert.strictEqual(tree[0].children.length, 2, 'Tab 1 should have 2 subtabs');
  assert.strictEqual(tree[0].children[0].title, 'Hương Hỏa');
  assert.strictEqual(tree[0].children[1].title, 'Chương 1: Ông Bụng');
  assert.strictEqual(tree[0].children[0].depth, 1);

  assert.strictEqual(tree[1].id, 'tab_2');
  assert.strictEqual(tree[1].children.length, 1);
  assert.strictEqual(tree[1].children[0].title, 'Phép thuật');
});

test('Document Tabs - flattenTabTree traverses in depth-first order', () => {
  const mockChapters = [
    { id: 'tab_1', title: 'Thẻ 1', parentId: null, orderIndex: 1 },
    { id: 'tab_sub1', title: 'Hương Hỏa', parentId: 'tab_1', orderIndex: 1 },
    { id: 'tab_sub2', title: 'Chương 1: Ông Bụng', parentId: 'tab_1', orderIndex: 2 },
    { id: 'tab_2', title: 'Thế giới & Lore', parentId: null, orderIndex: 2 },
    { id: 'tab_sub2_1', title: 'Phép thuật', parentId: 'tab_2', orderIndex: 1 }
  ];

  const tree = buildTabTree(mockChapters);
  const flattened = flattenTabTree(tree);

  assert.strictEqual(flattened.length, 5);
  assert.deepStrictEqual(flattened.map(t => t.id), [
    'tab_1',
    'tab_sub1',
    'tab_sub2',
    'tab_2',
    'tab_sub2_1'
  ]);
});

test('Document Tabs - sortChapters respects hierarchical subtab depth-first order for export', () => {
  const mockChapters = [
    { id: 'b', title: 'Tập 2', parentId: null, orderIndex: 2 },
    { id: 'a', title: 'Tập 1', parentId: null, orderIndex: 1 },
    { id: 'b_1', title: 'Chương 2.1', parentId: 'b', orderIndex: 1 },
    { id: 'a_2', title: 'Chương 1.2', parentId: 'a', orderIndex: 2 },
    { id: 'a_1', title: 'Chương 1.1', parentId: 'a', orderIndex: 1 }
  ];

  const sorted = sortChapters(mockChapters);
  assert.deepStrictEqual(sorted.map(c => c.id), [
    'a',
    'a_1',
    'a_2',
    'b',
    'b_1'
  ]);
});
