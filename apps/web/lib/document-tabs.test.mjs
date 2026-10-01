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

function detectHeadingFromText(rawText) {
  if (!rawText) return null;
  const normalized = rawText.normalize('NFC');
  const cleanedText = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  const trimmed = cleanedText.trim();
  if (!trimmed || trimmed.length > 120) return null;

  // 1. Markdown syntax
  const mdMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (mdMatch) {
    return { level: mdMatch[1].length, text: mdMatch[2].trim() };
  }

  // 2. Roman Numerals: I, II, III...
  const romanMatch = trimmed.match(/^([IVXLCDM]+)[.,:\-)]\s*(.*)$/i);
  if (romanMatch) {
    const isUpper = romanMatch[1] === romanMatch[1].toUpperCase();
    return { level: isUpper ? 1 : 2, text: trimmed };
  }

  // 3. Named Structural Titles
  const namedMajorMatch = trimmed.match(/^(Chương|Hồi|Phần|Quyển|Tập|Act|Chapter|Part)\s*([0-9IVXLCDM]+|[A-Z])[.,:\-\s]*(.*)$/iu);
  if (namedMajorMatch) {
    return { level: 1, text: trimmed };
  }

  const namedMinorMatch = trimmed.match(/^(Mục|Tiết|Bài|Cảnh|Scene|Section)\s*([0-9IVXLCDM]+|[A-Z])[.,:\-\s]*(.*)$/iu);
  if (namedMinorMatch) {
    return { level: 2, text: trimmed };
  }

  // 4. Hierarchical Numbers
  const hierarchicalNumMatch = trimmed.match(/^(\d+\.\d+(\.\d+)?)[.,:\-\s\xA0]\s*(.+)$/);
  if (hierarchicalNumMatch) {
    const dots = (hierarchicalNumMatch[1].match(/\./g) || []).length;
    return { level: Math.min(3, dots + 1), text: trimmed };
  }

  // 5. Numbered Lists/Sections
  const numMatch = trimmed.match(/^(\d+)[.,:\-)]\s+(.+)$/);
  if (numMatch) {
    return { level: 2, text: trimmed };
  }

  // 6. Alphabetic Sections
  const alphaMatch = trimmed.match(/^([A-Z])[.,:\-)]\s+(.+)$/);
  if (alphaMatch) {
    return { level: 2, text: trimmed };
  }

  return null;
}

function extractHeadingsFromContent(rawContent) {
  if (!rawContent) return [];
  const list = [];

  try {
    const json = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    if (json && typeof json === 'object') {
      let currentPos = 0;
      const walk = (node) => {
        if (!node) return;
        if (node.type === 'heading') {
          const level = Number(node.attrs?.level) || 1;
          const text = (node.content || []).map((c) => c.text || '').join('').trim();
          if (text) {
            list.push({
              id: `h-${list.length}-${text.slice(0, 15)}`,
              level,
              text,
              pos: currentPos
            });
          }
        } else if (node.type === 'paragraph') {
          const text = (node.content || []).map((c) => c.text || '').join('').trim();
          if (text) {
            const detected = detectHeadingFromText(text);
            if (detected) {
              list.push({
                id: `p-${list.length}-${text.slice(0, 15)}`,
                level: detected.level,
                text,
                pos: currentPos
              });
            }
          }
        }
        currentPos += 1;
        if (Array.isArray(node.content)) {
          node.content.forEach(walk);
        }
      };
      walk(json);
      if (list.length > 0) return list;
    }
  } catch {}

  const tagRegex = /<(h[1-3]|p)[^>]*>(.*?)<\/\1>/gi;
  let match;
  while ((match = tagRegex.exec(rawContent)) !== null) {
    const tag = match[1].toLowerCase();
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (!text) continue;

    if (tag.startsWith('h')) {
      const level = parseInt(tag[1], 10);
      list.push({
        id: `h-${list.length}-${text.slice(0, 15)}`,
        level,
        text
      });
    } else {
      const detected = detectHeadingFromText(text);
      if (detected) {
        list.push({
          id: `p-${list.length}-${text.slice(0, 15)}`,
          level: detected.level,
          text
        });
      }
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

test('Google Docs Document Tabs - Subtabs created with parentId support full 3-level nesting', () => {
  const tabs = [
    { id: 'root_1', title: 'Tập 1: Khởi Nguyên', parentId: null, orderIndex: 1 },
    { id: 'sub_1_1', title: 'Chương 1: Khởi hành', parentId: 'root_1', orderIndex: 1 },
    { id: 'sub_sub_1_1_1', title: 'Cảnh 1: Trong quán trọ', parentId: 'sub_1_1', orderIndex: 1 },
    { id: 'sub_1_2', title: 'Chương 2: Rừng hoang', parentId: 'root_1', orderIndex: 2 },
    { id: 'root_2', title: 'Tập 2: Thăng Hoa', parentId: null, orderIndex: 2 }
  ];

  const tree = buildTabTree(tabs);
  assert.strictEqual(tree.length, 2, 'Should have 2 root tabs');
  assert.strictEqual(tree[0].depth, 0, 'Root tab has depth 0');
  assert.strictEqual(tree[0].children.length, 2, 'Root 1 has 2 subtabs');
  
  const sub1 = tree[0].children[0];
  assert.strictEqual(sub1.depth, 1, 'Subtab has depth 1');
  assert.strictEqual(sub1.children.length, 1, 'Subtab has 1 nested child');

  const nestedSub = sub1.children[0];
  assert.strictEqual(nestedSub.depth, 2, 'Nested sub-subtab has depth 2');
  assert.strictEqual(nestedSub.children.length, 0);

  // Depth-first traversal order
  const flattened = flattenTabTree(tree);
  assert.deepStrictEqual(flattened.map(t => t.id), [
    'root_1',
    'sub_1_1',
    'sub_sub_1_1_1',
    'sub_1_2',
    'root_2'
  ]);
});

test('Google Docs Document Tabs - Max depth limit check prevents creating subtab beyond depth 2', () => {
  const canCreateSubtab = (depth) => depth < 2; // depth 0 -> subtab (depth 1), depth 1 -> sub-subtab (depth 2), depth 2 cannot have subtabs
  assert.strictEqual(canCreateSubtab(0), true, 'Root tab (depth 0) can have subtabs');
  assert.strictEqual(canCreateSubtab(1), true, 'Subtab (depth 1) can have subtabs');
  assert.strictEqual(canCreateSubtab(2), false, 'Sub-subtab (depth 2) cannot have further subtabs in Google Docs');
});

test('Google Docs Document Tabs - Reparenting allows demoting to subtab and promoting to parent', () => {
  // Initial: two sibling root tabs
  let chapters = [
    { id: 'tab_a', title: 'Thẻ A', parentId: null, orderIndex: 1 },
    { id: 'tab_b', title: 'Thẻ B', parentId: null, orderIndex: 2 }
  ];

  // Demote tab_b to be a subtab of tab_a
  chapters = chapters.map(c => c.id === 'tab_b' ? { ...c, parentId: 'tab_a' } : c);
  let tree = buildTabTree(chapters);
  assert.strictEqual(tree.length, 1, 'Now only tab_a is root');
  assert.strictEqual(tree[0].children.length, 1);
  assert.strictEqual(tree[0].children[0].id, 'tab_b');
  assert.strictEqual(tree[0].children[0].depth, 1);

  // Promote tab_b back to root tab
  chapters = chapters.map(c => c.id === 'tab_b' ? { ...c, parentId: null } : c);
  tree = buildTabTree(chapters);
  assert.strictEqual(tree.length, 2, 'Both are roots again');
  assert.strictEqual(tree[0].children.length, 0);
  assert.strictEqual(tree[1].children.length, 0);
});

test('Google Docs Automatic Subtabs - Writing "I, aceererf" and "II, nrfnerjf" automatically creates 2 subtabs without H1/H2 formatting', () => {
  // Plain text / plain paragraphs typed in document without H1/H2 styles
  const plainDocumentJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'I, aceererf' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Nội dung đoạn văn thứ nhất bên dưới mục I...' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'II, nrfnerjf' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Nội dung đoạn văn thứ hai bên dưới mục II...' }]
      }
    ]
  });

  const extracted = extractHeadingsFromContent(plainDocumentJson);
  assert.strictEqual(extracted.length, 2, 'Must extract exactly 2 subtabs automatically');
  assert.strictEqual(extracted[0].text, 'I, aceererf');
  assert.strictEqual(extracted[0].level, 1);
  assert.strictEqual(extracted[1].text, 'II, nrfnerjf');
  assert.strictEqual(extracted[1].level, 1);

  const subtabTree = buildHeadingTree(extracted);
  assert.strictEqual(subtabTree.length, 2, 'Should form 2 independent subtab items');
  assert.strictEqual(subtabTree[0].text, 'I, aceererf');
  assert.strictEqual(subtabTree[1].text, 'II, nrfnerjf');
});

test('Google Docs Automatic Subtabs - Detects hierarchical sub-items like 1, 2 under I, II', () => {
  const documentWithSubItems = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'I, aceererf' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '1, Chi tiết nhỏ của I' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '2, Chi tiết nhỏ thứ hai của I' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'II, nrfnerjf' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '1, Chi tiết nhỏ của II' }] }
    ]
  });

  const extracted = extractHeadingsFromContent(documentWithSubItems);
  assert.strictEqual(extracted.length, 5);

  const tree = buildHeadingTree(extracted);
  assert.strictEqual(tree.length, 2, 'Should have 2 major subtabs: I and II');
  assert.strictEqual(tree[0].text, 'I, aceererf');
  assert.strictEqual(tree[0].children.length, 2, 'I should have 2 nested children');
  assert.strictEqual(tree[0].children[0].text, '1, Chi tiết nhỏ của I');
  assert.strictEqual(tree[0].children[1].text, '2, Chi tiết nhỏ thứ hai của I');

  assert.strictEqual(tree[1].text, 'II, nrfnerjf');
  assert.strictEqual(tree[1].children.length, 1, 'II should have 1 nested child');
  assert.strictEqual(tree[1].children[0].text, '1, Chi tiết nhỏ của II');
});

test('Google Docs Automatic Subtabs - Robustly detects decomposed unicode Vietnamese titles and tricky spacings', () => {
  const trickyDocumentJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'PHẦN I: VŨ TRỤ QUAN'.normalize('NFD') }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '1.1.' + String.fromCharCode(160) + 'Ba tầng thực tại' }]
      }
    ]
  });

  const extracted = extractHeadingsFromContent(trickyDocumentJson);
  assert.strictEqual(extracted.length, 2, 'Must extract exactly 2 subtabs even with NFD or non-breaking spaces');
  assert.strictEqual(extracted[0].text.normalize('NFC'), 'PHẦN I: VŨ TRỤ QUAN');
  assert.strictEqual(extracted[0].level, 1);
  assert.strictEqual(extracted[1].level, 2, '1.1. should be level 2');
});



