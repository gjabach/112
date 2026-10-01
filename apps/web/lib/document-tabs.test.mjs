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

// Google Docs Heading Hierarchy Tests
function buildHeadingTree(headings) {
  if (!Array.isArray(headings) || headings.length === 0) return [];
  const roots = [];
  const stack = [];

  for (const item of headings) {
    const node = { ...item, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return roots;
}

function extractHeadingsFromContent(rawContent) {
  if (!rawContent) return [];
  const list = [];

  try {
    const json = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    if (json && typeof json === 'object') {
      const walk = (node) => {
        if (!node) return;
        if (node.type === 'heading') {
          const level = Number(node.attrs?.level) || 1;
          const text = (node.content || []).map((c) => c.text || '').join('').trim();
          if (text) {
            list.push({
              id: `h-${list.length}-${text.slice(0, 15)}`,
              level,
              text
            });
          }
        }
        if (Array.isArray(node.content)) {
          node.content.forEach(walk);
        }
      };
      walk(json);
      if (list.length > 0) return list;
    }
  } catch {}

  const htmlRegex = /<h([1-3])[^>]*>(.*?)<\/h\1>/gi;
  let match;
  while ((match = htmlRegex.exec(rawContent)) !== null) {
    const level = parseInt(match[1], 10);
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) {
      list.push({
        id: `h-${list.length}-${text.slice(0, 15)}`,
        level,
        text
      });
    }
  }

  return list;
}

test('Google Docs Heading Hierarchy - H1 (cha) -> H2 (con) -> H3 (cháu) forms accurate 3-level tree', () => {
  const mockHeadings = [
    { id: '1', level: 1, text: 'PHẦN 0: TIỀN ĐỀ CỐT LÕI' },
    { id: '2', level: 2, text: 'Thực tại là một cuốn Thiên Thư' },
    { id: '3', level: 3, text: 'Cửu Chấp Bút' },
    { id: '4', level: 3, text: 'Thần Tự Thượng Cổ' },
    { id: '5', level: 2, text: 'Khởi Nguyên Thế Giới' },
    { id: '6', level: 1, text: 'PHẦN 1: HÀNH TRÌNH BẮT ĐẦU' },
    { id: '7', level: 2, text: 'Chương 1: Bình Minh' }
  ];

  const tree = buildHeadingTree(mockHeadings);

  assert.strictEqual(tree.length, 2, 'Should have 2 top-level H1 headings (thẻ cha)');
  assert.strictEqual(tree[0].text, 'PHẦN 0: TIỀN ĐỀ CỐT LÕI');
  assert.strictEqual(tree[0].children.length, 2, 'H1 should have 2 H2 children (thẻ con)');
  
  assert.strictEqual(tree[0].children[0].text, 'Thực tại là một cuốn Thiên Thư');
  assert.strictEqual(tree[0].children[0].children.length, 2, 'H2 should have 2 H3 grandchildren (thẻ cháu)');
  assert.strictEqual(tree[0].children[0].children[0].text, 'Cửu Chấp Bút');
  assert.strictEqual(tree[0].children[0].children[1].text, 'Thần Tự Thượng Cổ');

  assert.strictEqual(tree[0].children[1].text, 'Khởi Nguyên Thế Giới');
  assert.strictEqual(tree[0].children[1].children.length, 0);

  assert.strictEqual(tree[1].text, 'PHẦN 1: HÀNH TRÌNH BẮT ĐẦU');
  assert.strictEqual(tree[1].children.length, 1);
  assert.strictEqual(tree[1].children[0].text, 'Chương 1: Bình Minh');
});

test('Google Docs Heading Hierarchy - Gracefully handles documents starting with H2 or skipping to H3', () => {
  const edgeHeadings = [
    { id: '1', level: 2, text: 'Tiểu mục mở đầu không có H1' },
    { id: '2', level: 3, text: 'Tiểu mục con cấp 3' },
    { id: '3', level: 1, text: 'Chương chính H1' },
    { id: '4', level: 3, text: 'H3 nhảy cóc không qua H2' }
  ];

  const tree = buildHeadingTree(edgeHeadings);

  assert.strictEqual(tree.length, 2);
  assert.strictEqual(tree[0].text, 'Tiểu mục mở đầu không có H1');
  assert.strictEqual(tree[0].children.length, 1);
  assert.strictEqual(tree[0].children[0].text, 'Tiểu mục con cấp 3');

  assert.strictEqual(tree[1].text, 'Chương chính H1');
  assert.strictEqual(tree[1].children.length, 1);
  assert.strictEqual(tree[1].children[0].text, 'H3 nhảy cóc không qua H2');
});

test('Google Docs Heading Extraction - Extracts headings accurately from TipTap JSON and HTML', () => {
  const tiptapJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Chương Một' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Đoạn văn bình thường...' }]
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Cảnh 1: Trong rừng' }]
      }
    ]
  });

  const headingsFromJson = extractHeadingsFromContent(tiptapJson);
  assert.strictEqual(headingsFromJson.length, 2);
  assert.strictEqual(headingsFromJson[0].level, 1);
  assert.strictEqual(headingsFromJson[0].text, 'Chương Một');
  assert.strictEqual(headingsFromJson[1].level, 2);
  assert.strictEqual(headingsFromJson[1].text, 'Cảnh 1: Trong rừng');

  const htmlContent = '<h1>Tiêu đề chính</h1><p>Nội dung</p><h2>Mục con</h2><h3>Chi tiết nhỏ</h3>';
  const headingsFromHtml = extractHeadingsFromContent(htmlContent);
  assert.strictEqual(headingsFromHtml.length, 3);
  assert.strictEqual(headingsFromHtml[0].level, 1);
  assert.strictEqual(headingsFromHtml[1].level, 2);
  assert.strictEqual(headingsFromHtml[2].level, 3);
});

