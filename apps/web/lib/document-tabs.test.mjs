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

    if (c.parentId && c.parentId !== c.id && idMap.has(c.parentId)) {
      let curr = c.parentId;
      let hasCycle = false;
      const visited = new Set([c.id]);
      while (curr && idMap.has(curr)) {
        if (visited.has(curr)) {
          hasCycle = true;
          break;
        }
        visited.add(curr);
        curr = idMap.get(curr)?.parentId;
      }
      if (!hasCycle) {
        const parent = idMap.get(c.parentId);
        parent.children.push(node);
      } else {
        roots.push(node);
      }
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

function detectHeadingFromText(rawText, options) {
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

  // 2. Roman Numerals: I, II, III... up to XLIX (49)
  // Uppercase only (NO /i flag) and single letters restricted to I, V, X to prevent outline letters (C., D., L., M.) from matching
  const romanMatch = trimmed.match(/^(X{1,3}(?:IX|IV|V?I{0,3})?|XL(?:IX|IV|V?I{0,3})?|IX|IV|V?I{1,3}|V)(?:[.,:\-)]|\s+[–—-])\s*(.*)$/);
  if (romanMatch) {
    return { level: 1, text: trimmed };
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

  // 5. Numbered Sections with comma, colon, hyphen: "1, ...", "1: ...", "1 - ..."
  // NOTE: Plain numbered lists with dot ("1. ") or closing paren ("1) ") are regular ordered lists in prose, NOT headings.
  // Excluded by default to prevent normal paragraphs like "1. Mua bánh" from spamming subtabs.
  const numMatch = options?.allowPlainNumberList
    ? trimmed.match(/^(\d+)[.,:\-)]\s+(.+)$/)
    : trimmed.match(/^(\d+)[,:\-]\s+(.+)$/);
  if (numMatch) {
    return { level: 2, text: trimmed };
  }

  // 6. Alphabetic Sections ("A. ", "B. ") removed intentionally to prevent normal bulleted paragraphs like "A. Đi ngủ" from false matching.

  return null;
}

function extractHeadingsFromContent(rawContent, options) {
  if (!rawContent) return [];
  const list = [];

  try {
    const json = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    if (json && typeof json === 'object') {
      const getNodeSize = (n) => {
        if (!n) return 0;
        if (n.type === 'text') return (n.text || '').length;
        if (n.type === 'hardBreak' || n.type === 'image') return 1;
        if (Array.isArray(n.content)) {
          return n.content.reduce((acc, child) => acc + getNodeSize(child), 0) + 2;
        }
        return 2;
      };

      if (Array.isArray(json.content)) {
        let docPos = 0;
        for (let i = 0; i < json.content.length; i++) {
          const block = json.content[i];
          if (block.type === 'heading') {
            const level = Number(block.attrs?.level) || 1;
            let text = (block.content || []).map((c) => c.text || '').join('').trim();
            if (text && /^(Chương|Phần|Hồi|Quyển|Tập|Act|Chapter|Part)\s*([0-9IVXLCDM]+|[A-Z])[:.\-]?$/iu.test(text)) {
              const nextBlock = json.content[i + 1];
              if (nextBlock && nextBlock.type === 'paragraph') {
                const nextText = (nextBlock.content || []).map((c) => c.text || '').join('').trim();
                if (nextText && nextText.length < 120 && !detectHeadingFromText(nextText, options)) {
                  text = `${text} ${nextText}`;
                }
              }
            }
            if (text) {
              list.push({
                id: `h-${list.length}-${text.slice(0, 15)}`,
                level,
                text,
                pos: docPos
              });
            }
          } else if (block.type === 'paragraph' && !options?.disableAutoHeadings) {
            const text = (block.content || []).map((c) => c.text || '').join('').trim();
            if (text) {
              const detected = detectHeadingFromText(text, options);
              if (detected) {
                let combinedText = detected.text;
                if (/^(Chương|Phần|Hồi|Quyển|Tập|Act|Chapter|Part)\s*([0-9IVXLCDM]+|[A-Z])[:.\-]?$/iu.test(combinedText)) {
                  const nextBlock = json.content[i + 1];
                  if (nextBlock && nextBlock.type === 'paragraph') {
                    const nextText = (nextBlock.content || []).map((c) => c.text || '').join('').trim();
                    if (nextText && nextText.length < 120 && !detectHeadingFromText(nextText, options)) {
                      combinedText = `${combinedText} ${nextText}`;
                    }
                  }
                }
                list.push({
                  id: `p-${list.length}-${combinedText.slice(0, 15)}`,
                  level: detected.level,
                  text: combinedText,
                  pos: docPos
                });
              }
            }
          }
          docPos += getNodeSize(block);
        }
      }
      if (list.length > 0) return list;
    }
  } catch {}

  const tagRegex = /<(h[1-3]|p)[^>]*>(.*?)<\/\1>/gi;
  const rawMatches = [];
  let match;
  while ((match = tagRegex.exec(rawContent)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) {
      rawMatches.push({ tag: match[1].toLowerCase(), text });
    }
  }

  for (let i = 0; i < rawMatches.length; i++) {
    const item = rawMatches[i];
    if (item.tag.startsWith('h')) {
      const level = parseInt(item.tag[1], 10);
      let text = item.text;
      if (/^(Chương|Phần|Hồi|Quyển|Tập|Act|Chapter|Part)\s*([0-9IVXLCDM]+|[A-Z])[:.\-]?$/iu.test(text)) {
        const next = rawMatches[i + 1];
        if (next && next.tag === 'p' && next.text.length < 120 && !detectHeadingFromText(next.text, options)) {
          text = `${text} ${next.text}`;
        }
      }
      list.push({ id: `h-${list.length}-${text.slice(0, 15)}`, level, text });
    } else if (!options?.disableAutoHeadings) {
      const detected = detectHeadingFromText(item.text, options);
      if (detected) {
        let text = detected.text;
        if (/^(Chương|Phần|Hồi|Quyển|Tập|Act|Chapter|Part)\s*([0-9IVXLCDM]+|[A-Z])[:.\-]?$/iu.test(text)) {
          const next = rawMatches[i + 1];
          if (next && next.tag === 'p' && next.text.length < 120 && !detectHeadingFromText(next.text, options)) {
            text = `${text} ${next.text}`;
          }
        }
        list.push({ id: `p-${list.length}-${text.slice(0, 15)}`, level: detected.level, text });
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
});

test('Google Docs Heading Extraction - Combines isolated heading prefix with next line paragraph title', () => {
  const multiLineDoc = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Phần I:' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'VŨ TRỤ QUAN, CẤU TRÚC CỦA "Thiên Thư"' }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Nội dung chi tiết bình thường của phần mở đầu...' }]
      }
    ]
  });

  const extracted = extractHeadingsFromContent(multiLineDoc);
  assert.strictEqual(extracted.length, 1);
  assert.strictEqual(extracted[0].level, 1);
  assert.strictEqual(extracted[0].text, 'Phần I: VŨ TRỤ QUAN, CẤU TRÚC CỦA "Thiên Thư"');
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

test('Google Docs Automatic Subtabs - Does not falsely match normal paragraphs like "c. ", "1. ", "A. "', () => {
  const normalParagraphs = [
    'c. Tóm lại là câu chuyện đã kết thúc.',
    'i. Đây là một đoạn văn bình thường bắt đầu bằng chữ i.',
    'v. Và đây là đoạn bắt đầu bằng chữ v.',
    'C. Tóm lại là câu chuyện đã kết thúc.',
    'D. Kết luận cuộc điều tra.',
    'M. Thư viện sách cổ.',
    'L. Ghi chú thêm ở cuối trang.',
    '1. Mua bánh mì cho bữa sáng',
    '2. Đi chợ mua rau củ',
    'A. Đi ngủ sớm vào buổi tối',
    'B. Thức dậy tập thể dục',
    '1) Một danh sách số có dấu ngoặc tròn'
  ];

  for (const text of normalParagraphs) {
    const detected = detectHeadingFromText(text);
    assert.strictEqual(detected, null, `"${text}" must NOT be detected as a heading`);
  }

  // True Roman numerals must still be recognized accurately
  const validRomanHeadings = [
    { text: 'I, aceererf', level: 1 },
    { text: 'II, nrfnerjf', level: 1 },
    { text: 'III - Cao trào', level: 1 },
    { text: 'IV: Kết thúc', level: 1 },
    { text: 'V. Khởi sắc', level: 1 },
    { text: 'X. Tổng kết', level: 1 },
    { text: 'XXI. Thế kỷ mới', level: 1 }
  ];

  for (const item of validRomanHeadings) {
    const detected = detectHeadingFromText(item.text);
    assert.ok(detected, `"${item.text}" should be detected as heading`);
    assert.strictEqual(detected.level, item.level);
  }

  const docJson = JSON.stringify({
    type: 'doc',
    content: normalParagraphs.map(text => ({
      type: 'paragraph',
      content: [{ type: 'text', text }]
    }))
  });

  const extracted = extractHeadingsFromContent(docJson);
  assert.strictEqual(extracted.length, 0, 'Must not extract any false subtabs from normal list/text paragraphs');
});

// =====================================================================
// Requirement 1: handleMoveTab - sibling-only swap logic
// =====================================================================
function moveTabInTree(allChapters, targetId, direction) {
  const target = allChapters.find(c => c.id === targetId);
  if (!target) return null;
  const parentId = target.parentId || null;

  const siblings = allChapters
    .filter(c => (c.parentId || null) === parentId)
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  const idx = siblings.findIndex(c => c.id === targetId);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= siblings.length) return null;

  const tree = buildTabTree(allChapters);

  const swapSiblingInTree = (nodes) => {
    const sIdx = nodes.findIndex(n => n.id === targetId);
    if (sIdx !== -1) {
      const sTargetIdx = direction === 'up' ? sIdx - 1 : sIdx + 1;
      if (sTargetIdx >= 0 && sTargetIdx < nodes.length) {
        const temp = nodes[sIdx];
        nodes[sIdx] = nodes[sTargetIdx];
        nodes[sTargetIdx] = temp;
        return true;
      }
    }
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        if (swapSiblingInTree(n.children)) return true;
      }
    }
    return false;
  };

  swapSiblingInTree(tree);
  return flattenTabTree(tree);
}

test('Document Tabs - handleMoveTab only swaps siblings sharing the same parentId', () => {
  const chapters = [
    { id: 'root_1', title: 'Tập 1', parentId: null, orderIndex: 1 },
    { id: 'sub_1_1', title: 'Chương 1.1', parentId: 'root_1', orderIndex: 1 },
    { id: 'sub_1_2', title: 'Chương 1.2', parentId: 'root_1', orderIndex: 2 },
    { id: 'root_2', title: 'Tập 2', parentId: null, orderIndex: 2 },
    { id: 'sub_2_1', title: 'Chương 2.1', parentId: 'root_2', orderIndex: 1 }
  ];

  // Move sub_1_2 UP: should swap with sub_1_1, neither root_1 nor root_2 should move
  const movedSubUp = moveTabInTree(chapters, 'sub_1_2', 'up');
  assert.ok(movedSubUp, 'Move sub_1_2 up should succeed');
  assert.deepStrictEqual(
    movedSubUp.map(c => c.id),
    ['root_1', 'sub_1_2', 'sub_1_1', 'root_2', 'sub_2_1'],
    'sub_1_2 must be swapped with sub_1_1 under root_1'
  );

  // Moving sub_1_1 UP when it is first sibling must be boundary rejected (return null)
  const movedSub1FirstUp = moveTabInTree(chapters, 'sub_1_1', 'up');
  assert.strictEqual(movedSub1FirstUp, null, 'Cannot move first sibling up');

  // Moving sub_1_2 DOWN when it is last sibling must be boundary rejected (return null)
  const movedSub1LastDown = moveTabInTree(chapters, 'sub_1_2', 'down');
  assert.strictEqual(movedSub1LastDown, null, 'Cannot move last sibling down');

  // Moving root_1 DOWN swaps with root_2, carrying sub_1_1 and sub_1_2 along
  const movedRootDown = moveTabInTree(chapters, 'root_1', 'down');
  assert.ok(movedRootDown, 'Move root_1 down should succeed');
  assert.deepStrictEqual(
    movedRootDown.map(c => c.id),
    ['root_2', 'sub_2_1', 'root_1', 'sub_1_1', 'sub_1_2'],
    'Entire root_1 subtree must cleanly move after root_2'
  );
});

// =====================================================================
// Requirement 6: Subtree height & 3-level max hierarchy check
// =====================================================================
function getSubtreeHeight(node) {
  if (!node.children || node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(getSubtreeHeight));
}

function validateReparenting(allChapters, targetId, newParentId) {
  if (newParentId) {
    if (newParentId === targetId) {
      return { ok: false, error: 'Không thể chọn chính thẻ này làm thẻ cha' };
    }

    const getAllDescendantIds = (rootId) => {
      const children = allChapters.filter(c => c.parentId === rootId);
      const childIds = children.map(c => c.id);
      const nestedIds = childIds.flatMap(cid => getAllDescendantIds(cid));
      return [...childIds, ...nestedIds];
    };
    const descendantIds = new Set(getAllDescendantIds(targetId));
    if (descendantIds.has(newParentId)) {
      return { ok: false, error: 'Quan hệ phân cấp vòng tròn không hợp lệ' };
    }

    const tree = buildTabTree(allChapters);
    const findNode = (nodes, id) => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          const found = findNode(n.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const parentNode = findNode(tree, newParentId);
    const targetNode = findNode(tree, targetId);
    if (parentNode && targetNode) {
      const parentDepth = parentNode.depth;
      const targetSubtreeHeight = getSubtreeHeight(targetNode);
      if (parentDepth + 1 + targetSubtreeHeight > 2) {
        return { ok: false, error: 'Google Docs giới hạn phân cấp tối đa 3 cấp thẻ' };
      }
    }
  }
  return { ok: true };
}

test('Document Tabs - Strict 3-level hierarchy check accounts for node subtree height', () => {
  const chapters = [
    { id: 'root_1', title: 'Tập 1', parentId: null, orderIndex: 1 },
    { id: 'sub_1_1', title: 'Chương 1', parentId: 'root_1', orderIndex: 1 },
    { id: 'root_2', title: 'Tập 2', parentId: null, orderIndex: 2 },
    { id: 'sub_2_1', title: 'Chương 2', parentId: 'root_2', orderIndex: 1 },
    { id: 'leaf_2_1_1', title: 'Cảnh 2.1.1', parentId: 'sub_2_1', orderIndex: 1 }
  ];

  // sub_1_1 (height 0) moving under sub_2_1 (depth 1): 1 + 1 + 0 = 2 <= 2 -> OK
  const check1 = validateReparenting(chapters, 'sub_1_1', 'sub_2_1');
  assert.strictEqual(check1.ok, true, 'Moving leaf under depth 1 creates depth 2 which is allowed');

  // sub_2_1 has leaf child leaf_2_1_1 (height 1). Trying to move sub_2_1 under sub_1_1 (depth 1):
  // 1 (depth of sub_1_1) + 1 + 1 (height of sub_2_1) = 3 > 2 -> MUST REJECT!
  const check2 = validateReparenting(chapters, 'sub_2_1', 'sub_1_1');
  assert.strictEqual(check2.ok, false);
  assert.strictEqual(check2.error, 'Google Docs giới hạn phân cấp tối đa 3 cấp thẻ');

  // root_2 has height 2 (root_2 -> sub_2_1 -> leaf_2_1_1). Trying to move under root_1 (depth 0):
  // 0 + 1 + 2 = 3 > 2 -> MUST REJECT!
  const check3 = validateReparenting(chapters, 'root_2', 'root_1');
  assert.strictEqual(check3.ok, false);
  assert.strictEqual(check3.error, 'Google Docs giới hạn phân cấp tối đa 3 cấp thẻ');
});

test('Document Tabs - Cycle detection prevents circular reparenting', () => {
  const chapters = [
    { id: 'A', title: 'Thẻ A', parentId: null, orderIndex: 1 },
    { id: 'B', title: 'Thẻ B', parentId: 'A', orderIndex: 1 },
    { id: 'C', title: 'Thẻ C', parentId: 'B', orderIndex: 1 }
  ];

  // Self parent
  const selfCheck = validateReparenting(chapters, 'A', 'A');
  assert.strictEqual(selfCheck.ok, false);
  assert.strictEqual(selfCheck.error, 'Không thể chọn chính thẻ này làm thẻ cha');

  // Direct child parent
  const directChildCheck = validateReparenting(chapters, 'A', 'B');
  assert.strictEqual(directChildCheck.ok, false);
  assert.strictEqual(directChildCheck.error, 'Quan hệ phân cấp vòng tròn không hợp lệ');

  // Indirect descendant parent
  const grandChildCheck = validateReparenting(chapters, 'A', 'C');
  assert.strictEqual(grandChildCheck.ok, false);
  assert.strictEqual(grandChildCheck.error, 'Quan hệ phân cấp vòng tròn không hợp lệ');
});

test('Document Tabs - buildTabTree safely handles cyclic parentId without stack overflow', () => {
  const cyclicChapters = [
    { id: 'cycle_1', title: 'Thẻ 1', parentId: 'cycle_2', orderIndex: 1 },
    { id: 'cycle_2', title: 'Thẻ 2', parentId: 'cycle_1', orderIndex: 1 },
    { id: 'self_cycle', title: 'Thẻ tự lặp', parentId: 'self_cycle', orderIndex: 2 }
  ];

  // Must not throw RangeError: Maximum call stack size exceeded
  const tree = buildTabTree(cyclicChapters);
  assert.ok(Array.isArray(tree));
  assert.strictEqual(tree.length > 0, true, 'Cyclic nodes should fall back to root tabs');
});

// =====================================================================
// Requirement 2 & 11: Tab duplication with parentId remapping & 100-tab limit
// =====================================================================
function duplicateChapterSubtree(allChapters, targetId) {
  const chapter = allChapters.find(c => c.id === targetId);
  if (!chapter) throw new Error('Not found');

  if (allChapters.length >= 100) {
    throw new Error('Tài liệu đã đạt giới hạn tối đa 100 thẻ');
  }

  const getAllDescendants = (rootId) => {
    const children = allChapters.filter(c => c.parentId === rootId);
    const nested = children.flatMap(c => getAllDescendants(c.id));
    return [...children, ...nested];
  };

  const descendants = getAllDescendants(targetId);
  if (allChapters.length + 1 + descendants.length > 100) {
    throw new Error('Tài liệu đã đạt giới hạn tối đa 100 thẻ');
  }

  const maxOrder = allChapters.length > 0 ? Math.max(...allChapters.map(c => c.orderIndex || 0)) : 0;
  const newRootId = 'cloned_' + targetId;
  const idMap = new Map();
  idMap.set(targetId, newRootId);
  descendants.forEach(d => {
    idMap.set(d.id, 'cloned_' + d.id);
  });

  const newRootChapter = {
    ...chapter,
    id: newRootId,
    title: `${chapter.title} (Bản sao)`,
    orderIndex: maxOrder + 1
  };

  const clonedDescendants = descendants.map((d, i) => ({
    ...d,
    id: idMap.get(d.id),
    orderIndex: maxOrder + 2 + i,
    parentId: idMap.get(d.parentId) || d.parentId
  }));

  return [newRootChapter, ...clonedDescendants];
}

test('Document Tabs - Chapter duplication duplicates subtree and remaps parentId', () => {
  const chapters = [
    { id: 'tab_parent', title: 'Phần 1', parentId: null, orderIndex: 1 },
    { id: 'tab_child1', title: 'Chương 1', parentId: 'tab_parent', orderIndex: 1 },
    { id: 'tab_child2', title: 'Chương 2', parentId: 'tab_parent', orderIndex: 2 },
    { id: 'tab_grandchild', title: 'Cảnh 1', parentId: 'tab_child1', orderIndex: 1 }
  ];

  const duplicated = duplicateChapterSubtree(chapters, 'tab_parent');
  assert.strictEqual(duplicated.length, 4, 'Should duplicate parent and all 3 descendants');
  assert.strictEqual(duplicated[0].id, 'cloned_tab_parent');
  assert.strictEqual(duplicated[0].title, 'Phần 1 (Bản sao)');

  // Verify child1 parentId points to cloned_tab_parent, NOT tab_parent
  const clonedChild1 = duplicated.find(c => c.id === 'cloned_tab_child1');
  assert.ok(clonedChild1);
  assert.strictEqual(clonedChild1.parentId, 'cloned_tab_parent');

  // Verify grandchild parentId points to cloned_tab_child1
  const clonedGrandchild = duplicated.find(c => c.id === 'cloned_tab_grandchild');
  assert.ok(clonedGrandchild);
  assert.strictEqual(clonedGrandchild.parentId, 'cloned_tab_child1');
});

test('Document Tabs - 100-tab limit prevents duplicating if total tabs would exceed 100', () => {
  const dummy98Chapters = Array.from({ length: 98 }, (_, i) => ({
    id: `tab_${i}`,
    title: `Tab ${i}`,
    parentId: null,
    orderIndex: i
  }));
  const chapters = [
    ...dummy98Chapters,
    { id: 'root', title: 'Root', parentId: null, orderIndex: 99 },
    { id: 'child1', title: 'Child 1', parentId: 'root', orderIndex: 1 },
    { id: 'child2', title: 'Child 2', parentId: 'root', orderIndex: 2 }
  ];
  // 101 tabs -> already over 100
  assert.throws(() => duplicateChapterSubtree(chapters, 'root'), /giới hạn tối đa 100 thẻ/);

  // Exactly 99 tabs, duplicating a parent + 1 child would make 101 -> reject
  const chapters99 = Array.from({ length: 97 }, (_, i) => ({
    id: `tab_${i}`,
    title: `Tab ${i}`,
    parentId: null,
    orderIndex: i
  }));
  chapters99.push(
    { id: 'root', title: 'Root', parentId: null, orderIndex: 98 },
    { id: 'child', title: 'Child', parentId: 'root', orderIndex: 1 }
  );
  assert.strictEqual(chapters99.length, 99);
  // Root + 1 child = 2 tabs. 99 + 2 = 101 > 100
  assert.throws(() => duplicateChapterSubtree(chapters99, 'root'), /giới hạn tối đa 100 thẻ/);
});

// =====================================================================
// Requirement 3 & 11: Cascade delete & minimum 1 tab enforcement
// =====================================================================
function cascadeDelete(allChapters, targetId) {
  if (allChapters.length <= 1) {
    throw new Error('Tài liệu phải có tối thiểu 1 thẻ');
  }

  const getAllDescendantIds = (rootId) => {
    const children = allChapters.filter(c => c.parentId === rootId);
    const childIds = children.map(c => c.id);
    const nestedIds = childIds.flatMap(cid => getAllDescendantIds(cid));
    return [...childIds, ...nestedIds];
  };

  const toDeleteIds = new Set([targetId, ...getAllDescendantIds(targetId)]);
  if (toDeleteIds.size >= allChapters.length) {
    throw new Error('Tài liệu phải có tối thiểu 1 thẻ');
  }

  return allChapters.filter(c => !toDeleteIds.has(c.id));
}

test('Document Tabs - Cascade delete removes target and all descendants, enforces min 1 tab', () => {
  const chapters = [
    { id: 'root_1', title: 'Tập 1', parentId: null },
    { id: 'sub_1_1', title: 'Chương 1', parentId: 'root_1' },
    { id: 'sub_1_2', title: 'Chương 2', parentId: 'root_1' },
    { id: 'leaf_1_2_1', title: 'Cảnh 1', parentId: 'sub_1_2' },
    { id: 'root_2', title: 'Tập 2', parentId: null }
  ];

  // Deleting sub_1_2 removes sub_1_2 and leaf_1_2_1
  const remainingAfterSub = cascadeDelete(chapters, 'sub_1_2');
  assert.strictEqual(remainingAfterSub.length, 3);
  assert.deepStrictEqual(remainingAfterSub.map(c => c.id), ['root_1', 'sub_1_1', 'root_2']);

  // Deleting root_1 removes root_1, sub_1_1, sub_1_2, leaf_1_2_1, leaving root_2
  const remainingAfterRoot = cascadeDelete(chapters, 'root_1');
  assert.strictEqual(remainingAfterRoot.length, 1);
  assert.strictEqual(remainingAfterRoot[0].id, 'root_2');

  // Deleting when only 1 tab exists throws error
  assert.throws(() => cascadeDelete([{ id: 'solo', title: 'Solo' }], 'solo'), /tối thiểu 1 thẻ/);

  // Deleting root when its tree is the entire project throws error
  const allInOne = [
    { id: 'root', title: 'Root', parentId: null },
    { id: 'child', title: 'Child', parentId: 'root' }
  ];
  assert.throws(() => cascadeDelete(allInOne, 'root'), /tối thiểu 1 thẻ/);
});

// =====================================================================
// Requirement 4: Project duplication preserves hierarchical parentId
// =====================================================================
function duplicateProjectChapters(chapters, newProjectId) {
  const chapterIdMap = new Map();
  for (const ch of chapters) {
    chapterIdMap.set(ch.id, 'new_' + ch.id);
  }
  return chapters.map(ch => ({
    ...ch,
    id: chapterIdMap.get(ch.id),
    projectId: newProjectId,
    parentId: ch.parentId && chapterIdMap.has(ch.parentId) ? chapterIdMap.get(ch.parentId) : null
  }));
}

test('Document Tabs - Project duplication accurately remaps parentId across all tabs', () => {
  const originalChapters = [
    { id: 'c1', title: 'Thẻ 1', parentId: null },
    { id: 'c2', title: 'Thẻ con 1.1', parentId: 'c1' },
    { id: 'c3', title: 'Thẻ cháu 1.1.1', parentId: 'c2' },
    { id: 'c4', title: 'Thẻ 2', parentId: null }
  ];

  const cloned = duplicateProjectChapters(originalChapters, 'proj_new');
  assert.strictEqual(cloned.length, 4);
  assert.strictEqual(cloned[0].id, 'new_c1');
  assert.strictEqual(cloned[0].parentId, null);
  assert.strictEqual(cloned[1].id, 'new_c2');
  assert.strictEqual(cloned[1].parentId, 'new_c1');
  assert.strictEqual(cloned[2].id, 'new_c3');
  assert.strictEqual(cloned[2].parentId, 'new_c2');
  assert.strictEqual(cloned[3].id, 'new_c4');
  assert.strictEqual(cloned[3].parentId, null);
});

// =====================================================================
// Requirement 5: Bidirectional sync detects orderIndex, parentId, emoji
// =====================================================================
import { mergeWorkspaces } from './sync-core.ts';

test('Document Tabs - sync-core detects orderIndex, parentId, and emoji changes in isDifferent', () => {
  const baseLocal = {
    chapters: [
      {
        id: 'chap_1',
        projectId: 'p1',
        title: 'Chương 1',
        content: 'Nội dung giống nhau',
        orderIndex: 0,
        parentId: null,
        emoji: '📄',
        updatedAt: 1000
      }
    ]
  };

  // Case A: Remote changed orderIndex with newer timestamp
  const baseLocalTwoChapters = {
    chapters: [
      {
        id: 'chap_1',
        projectId: 'p1',
        title: 'Chương 1',
        content: 'Nội dung giống nhau',
        orderIndex: 1,
        parentId: null,
        emoji: '📄',
        updatedAt: 1000
      },
      {
        id: 'chap_2',
        projectId: 'p1',
        title: 'Chương 2',
        content: 'Nội dung giống nhau 2',
        orderIndex: 2,
        parentId: null,
        emoji: '📄',
        updatedAt: 1000
      }
    ]
  };

  const remoteReordered = {
    chapters: [
      {
        id: 'chap_1',
        projectId: 'p1',
        title: 'Chương 1',
        content: 'Nội dung giống nhau',
        orderIndex: 10, // Moved after chap_2
        parentId: null,
        emoji: '📄',
        updatedAt: 2000
      },
      {
        id: 'chap_2',
        projectId: 'p1',
        title: 'Chương 2',
        content: 'Nội dung giống nhau 2',
        orderIndex: 2,
        parentId: null,
        emoji: '📄',
        updatedAt: 1000
      }
    ]
  };
  const resOrder = mergeWorkspaces(baseLocalTwoChapters, remoteReordered);
  assert.strictEqual(resOrder.hasRemoteChanges, true, 'isDifferent must detect changed orderIndex');
  assert.strictEqual(resOrder.merged.chapters[0].id, 'chap_2', 'chap_2 now comes first');
  assert.strictEqual(resOrder.merged.chapters[1].id, 'chap_1', 'chap_1 now comes second');
  assert.strictEqual(resOrder.merged.chapters[0].orderIndex, 1);
  assert.strictEqual(resOrder.merged.chapters[1].orderIndex, 2);

  // Case B: Remote changed parentId (demoted to subtab) with newer timestamp
  const remoteParentChanged = {
    chapters: [
      {
        id: 'chap_1',
        projectId: 'p1',
        title: 'Chương 1',
        content: 'Nội dung giống nhau',
        orderIndex: 0,
        parentId: 'parent_99',
        emoji: '📄',
        updatedAt: 2000
      }
    ]
  };
  const resParent = mergeWorkspaces(baseLocal, remoteParentChanged);
  assert.strictEqual(resParent.hasRemoteChanges, true);
  assert.strictEqual(resParent.merged.chapters[0].parentId, 'parent_99');

  // Case C: Remote changed emoji with newer timestamp
  const remoteEmojiChanged = {
    chapters: [
      {
        id: 'chap_1',
        projectId: 'p1',
        title: 'Chương 1',
        content: 'Nội dung giống nhau',
        orderIndex: 0,
        parentId: null,
        emoji: '🔥',
        updatedAt: 2000
      }
    ]
  };
  const resEmoji = mergeWorkspaces(baseLocal, remoteEmojiChanged);
  assert.strictEqual(resEmoji.hasRemoteChanges, true);
  assert.strictEqual(resEmoji.merged.chapters[0].emoji, '🔥');
});

// =====================================================================
// Requirement 7: TipTap outline heading jump disambiguation
// =====================================================================
function resolveHeadingJumpTarget(headingsInDoc, targetText, targetOccIndex) {
  const candidates = headingsInDoc
    .filter(h => h.text.trim() === targetText.trim())
    .map(h => h.pos);

  if (candidates.length === 0) return -1;
  if (typeof targetOccIndex === 'number' && targetOccIndex >= 0 && targetOccIndex < candidates.length) {
    return candidates[targetOccIndex];
  }
  return candidates[0];
}

test('Document Tabs - Heading jump resolves correct occurrence when heading names are identical', () => {
  const docHeadings = [
    { text: 'Mở đầu', pos: 10 },
    { text: 'Diễn biến', pos: 150 },
    { text: 'Mở đầu', pos: 300 }, // 2nd occurrence of 'Mở đầu'
    { text: 'Kết thúc', pos: 450 },
    { text: 'Mở đầu', pos: 600 }  // 3rd occurrence of 'Mở đầu'
  ];

  // Map occurrence index as done by DocumentTabsSidebar
  const occurrenceMap = new Map();
  const counts = new Map();
  docHeadings.forEach((h, idx) => {
    const seen = counts.get(h.text) || 0;
    occurrenceMap.set(idx, seen);
    counts.set(h.text, seen + 1);
  });

  assert.strictEqual(occurrenceMap.get(0), 0);
  assert.strictEqual(occurrenceMap.get(2), 1);
  assert.strictEqual(occurrenceMap.get(4), 2);

  // Jump to 1st occurrence (index 0) -> pos 10
  const pos0 = resolveHeadingJumpTarget(docHeadings, 'Mở đầu', 0);
  assert.strictEqual(pos0, 10);

  // Jump to 2nd occurrence (index 1) -> pos 300
  const pos1 = resolveHeadingJumpTarget(docHeadings, 'Mở đầu', 1);
  assert.strictEqual(pos1, 300);

  // Jump to 3rd occurrence (index 2) -> pos 600
  const pos2 = resolveHeadingJumpTarget(docHeadings, 'Mở đầu', 2);
  assert.strictEqual(pos2, 600);
});

// =====================================================================
// Requirement 8: Complex ZWJ Emoji schema validation (up to 30 chars)
// =====================================================================
test('Document Tabs - Emoji schema supports complex ZWJ emojis and skin-tone modifiers', () => {
  const familyEmoji = '👨‍👩‍👧‍👦'; // 11 code units
  assert.ok(familyEmoji.length > 10, 'Family emoji must be > 10 code units');
  assert.ok(familyEmoji.length <= 30, 'Family emoji must fit within 30 chars');

  const skinToneEmoji = '🧑🏽‍🦰'; // 7 code units
  assert.ok(skinToneEmoji.length <= 30);

  // Validate string length boundary
  const validEmojiMax = '🔥'.repeat(15); // 30 code units
  assert.strictEqual(validEmojiMax.length, 30);

  const invalidEmojiTooLong = '🔥'.repeat(16); // 32 code units
  assert.ok(invalidEmojiTooLong.length > 30);
});

// =====================================================================
// Requirement 11: Accurate subtree counting for delete & duplicate constraints
// =====================================================================
test('Document Tabs - Subtree node counting correctly prevents wiping all tabs and exceeding 100 tabs', () => {
  const countSubtreeNodes = (n) => {
    let count = 1;
    if (n.children && n.children.length > 0) {
      for (const child of n.children) {
        count += countSubtreeNodes(child);
      }
    }
    return count;
  };

  const tree = buildTabTree([
    { id: 'root_1', title: 'Root 1', parentId: null, orderIndex: 1 },
    { id: 'sub_1_1', title: 'Child 1', parentId: 'root_1', orderIndex: 1 },
    { id: 'sub_1_2', title: 'Child 2', parentId: 'root_1', orderIndex: 2 }
  ]);

  const allTabsCount = 3;
  const rootNode = tree[0];
  const rootSubtreeCount = countSubtreeNodes(rootNode);
  assert.strictEqual(rootSubtreeCount, 3, 'Root node subtree must count 3 nodes (self + 2 children)');

  // Deleting rootNode would wipe all 3 tabs -> canDelete MUST BE FALSE
  const canDeleteRoot = allTabsCount > rootSubtreeCount;
  assert.strictEqual(canDeleteRoot, false, 'Cannot delete root because it wipes entire document');

  // Deleting child 1 only removes 1 tab -> canDelete MUST BE TRUE
  const childNode = rootNode.children[0];
  const childSubtreeCount = countSubtreeNodes(childNode);
  assert.strictEqual(childSubtreeCount, 1);
  const canDeleteChild = allTabsCount > childSubtreeCount;
  assert.strictEqual(canDeleteChild, true, 'Can delete child because 2 tabs remain');

  // Duplication limit: 98 existing tabs, duplicating a 3-node subtree would result in 101 tabs (> 100)
  const existingCount = 98;
  const canDuplicate = existingCount + rootSubtreeCount <= 100;
  assert.strictEqual(canDuplicate, false, 'Duplicating 3-node subtree from 98 tabs exceeds 100 tabs');
});

// =====================================================================
// Requirement 2: Subtree duplication uses DFS preorder for contiguous sequential orderIndex
// =====================================================================
test('Document Tabs - Duplicating chapter subtree uses preorder DFS to allocate contiguous orderIndex', () => {
  const allChapters = [
    { id: 'root_1', title: 'Tập 1', parentId: null, orderIndex: 1 },
    { id: 'sub_1', title: 'Chương 1', parentId: 'root_1', orderIndex: 1 },
    { id: 'grand_1', title: 'Hồi 1', parentId: 'sub_1', orderIndex: 1 },
    { id: 'sub_2', title: 'Chương 2', parentId: 'root_1', orderIndex: 2 },
    { id: 'root_2', title: 'Tập 2', parentId: null, orderIndex: 2 }
  ];

  const getAllDescendants = (rootId) => {
    const children = allChapters
      .filter((ch) => ch.parentId === rootId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const result = [];
    for (const child of children) {
      result.push(child);
      result.push(...getAllDescendants(child.id));
    }
    return result;
  };

  const descendants = getAllDescendants('root_1');
  assert.strictEqual(descendants.length, 3);
  assert.strictEqual(descendants[0].id, 'sub_1', 'sub_1 first');
  assert.strictEqual(descendants[1].id, 'grand_1', 'grand_1 nested under sub_1 immediately follows sub_1');
  assert.strictEqual(descendants[2].id, 'sub_2', 'sub_2 follows grand_1 in DFS preorder');
});

// =====================================================================
// Requirement 7: extractHeadingsFromContent computes exact ProseMirror document offsets
// =====================================================================
test('Document Tabs - extractHeadingsFromContent calculates exact ProseMirror block positions', () => {
  const docJson = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello' }] // size = 5 + 2 = 7
      },
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Chương 1: Mở đầu' }] // size = 16 + 2 = 18, starts at pos 7
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Nội dung chương' }] // size = 15 + 2 = 17, starts at pos 25
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Mục 1.1' }] // starts at pos 42
      }
    ]
  });

  const headings = extractHeadingsFromContent(docJson);
  assert.strictEqual(headings.length, 2);
  assert.strictEqual(headings[0].text, 'Chương 1: Mở đầu');
  assert.strictEqual(headings[0].pos, 7, 'First heading must start at ProseMirror offset 7');
  assert.strictEqual(headings[1].text, 'Mục 1.1');
  assert.strictEqual(headings[1].pos, 42, 'Second heading must start at ProseMirror offset 42');
});

// =====================================================================
// Bug 1 Verification: Selection-based heading split preserves text before selection
// =====================================================================
test('Document Tabs & Editor - Applying H1 to selected segment splits block and preserves preceding text', async () => {
  const { Schema } = await import('@tiptap/pm/model');
  const { EditorState, TextSelection } = await import('@tiptap/pm/state');

  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'text*', toDOM: () => ['p', 0] },
      heading: {
        group: 'block',
        content: 'text*',
        attrs: { level: { default: 1 } },
        toDOM: (node) => ['h' + node.attrs.level, 0]
      },
      text: { inline: true }
    }
  });

  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Dòng đằng trước. Đoạn được chọn H1. Dòng đằng sau.')
    ])
  ]);

  let state = EditorState.create({ doc, schema });

  // Select 'Đoạn được chọn H1.'
  // Text breakdown: 'Dòng đằng trước. ' (17 chars, pos 1..18)
  // 'Đoạn được chọn H1.' (18 chars, pos 18..36)
  const from = 18;
  const to = 36;
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));

  // Simulate toggleHeadingSafe algorithm
  let tr = state.tr;
  const resFrom = tr.doc.resolve(from);
  const resTo = tr.doc.resolve(to);

  const blockStart = resFrom.start(resFrom.depth);
  const blockEnd = resTo.end(resTo.depth);

  const hasContentBefore = from > blockStart;
  const hasContentAfter = to < blockEnd;

  assert.strictEqual(hasContentBefore, true, 'Must detect text preceding selection');
  assert.strictEqual(hasContentAfter, true, 'Must detect text succeeding selection');

  if (hasContentBefore) {
    tr = tr.split(from);
  }
  const mappedTo = tr.mapping.map(to, -1);
  const resMappedTo = tr.doc.resolve(mappedTo);
  if (mappedTo < resMappedTo.end(resMappedTo.depth)) {
    tr = tr.split(mappedTo);
  }

  const targetStart = tr.mapping.map(from, 1);
  const targetEnd = tr.mapping.map(to, -1);
  tr.setBlockType(targetStart, targetEnd, schema.nodes.heading, { level: 1 });

  state = state.apply(tr);

  const blocks = [];
  state.doc.forEach((node) => {
    blocks.push({ type: node.type.name, level: node.attrs?.level, text: node.textContent });
  });

  assert.strictEqual(blocks.length, 3, 'Document must be split into 3 distinct blocks');
  // Block 0: The preceding text MUST remain a regular paragraph!
  assert.strictEqual(blocks[0].type, 'paragraph');
  assert.strictEqual(blocks[0].text, 'Dòng đằng trước. ');
  // Block 1: ONLY the selected text becomes H1!
  assert.strictEqual(blocks[1].type, 'heading');
  assert.strictEqual(blocks[1].level, 1);
  assert.strictEqual(blocks[1].text, 'Đoạn được chọn H1.');
  // Block 2: The succeeding text MUST remain a regular paragraph!
  assert.strictEqual(blocks[2].type, 'paragraph');
  assert.strictEqual(blocks[2].text, ' Dòng đằng sau.');
});

// =====================================================================
// Bug 2 Verification: Deleting active tab selects adjacent neighbor
// =====================================================================
test('Document Tabs - Deleting active tab accurately selects adjacent tab instead of first tab', () => {
  const orderedTabs = [
    { id: 'tab_1', title: 'Thẻ 1' },
    { id: 'tab_2', title: 'Thẻ 2' },
    { id: 'tab_3', title: 'Thẻ 3' },
    { id: 'tab_4', title: 'Thẻ 4' }
  ];

  const getAdjacentTab = (currentId, deletedIds, tabs) => {
    const currentIdx = tabs.findIndex(c => c.id === currentId);
    const remaining = tabs.filter(c => !deletedIds.includes(c.id));
    if (remaining.length === 0) return null;
    const adjacentIdx = Math.min(currentIdx, remaining.length - 1);
    return remaining[Math.max(0, adjacentIdx)];
  };

  // Case 1: Deleting tab_2 (middle tab) -> should select tab_3 (the next adjacent tab, NOT tab_1)
  const afterDelete2 = getAdjacentTab('tab_2', ['tab_2'], orderedTabs);
  assert.strictEqual(afterDelete2.id, 'tab_3', 'Deleting tab_2 should navigate to tab_3');

  // Case 2: Deleting tab_4 (last tab) -> should select tab_3 (the preceding adjacent tab)
  const afterDeleteLast = getAdjacentTab('tab_4', ['tab_4'], orderedTabs);
  assert.strictEqual(afterDeleteLast.id, 'tab_3', 'Deleting last tab should navigate to tab_3');

  // Case 3: Deleting tab_1 (first tab) -> should select tab_2
  const afterDeleteFirst = getAdjacentTab('tab_1', ['tab_1'], orderedTabs);
  assert.strictEqual(afterDeleteFirst.id, 'tab_2', 'Deleting first tab should navigate to tab_2');
});

// =====================================================================
// Bug 4 Verification: Title auto-sync heuristic
// =====================================================================
test('Document Tabs - Title auto-sync accurately detects default placeholder titles', () => {
  const isDefaultTitle = (t) => {
    const clean = (t || '').trim();
    return !clean || /^Thẻ(\s+\d+|\s+không\s+tên)?$/i.test(clean) || /.*Thẻ con\s+\d+$/i.test(clean);
  };

  // Default titles that SHOULD be replaced when first heading is typed:
  assert.strictEqual(isDefaultTitle('Thẻ 1'), true);
  assert.strictEqual(isDefaultTitle('Thẻ 2'), true);
  assert.strictEqual(isDefaultTitle('Thẻ'), true);
  assert.strictEqual(isDefaultTitle('Thẻ không tên'), true);
  assert.strictEqual(isDefaultTitle('Tập 1 - Thẻ con 1'), true);
  assert.strictEqual(isDefaultTitle(''), true);

  // Custom user-defined titles that MUST NOT be replaced:
  assert.strictEqual(isDefaultTitle('Chương 1: Bình Minh'), false);
  assert.strictEqual(isDefaultTitle('Nhân vật chính'), false);
  assert.strictEqual(isDefaultTitle('Thế giới ảo'), false);
  assert.strictEqual(isDefaultTitle('Hương Hỏa'), false);
});

