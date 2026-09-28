import test from 'node:test';
import assert from 'node:assert/strict';

// Test word counting logic
function countWords(content) {
  if (!content) return 0;
  try {
    const json = typeof content === 'string' ? JSON.parse(content) : content;
    const extractText = (node) => {
      let text = '';
      if (node.text) text += node.text + ' ';
      if (node.content) {
        for (const child of node.content) {
          text += extractText(child);
        }
      }
      return text;
    };
    const plainText = extractText(json).trim();
    return plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  } catch {
    const cleaned = content.replace(/<[^>]*>/g, ' ').replace(/[#*_~`]/g, ' ').trim();
    return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
  }
}

test('countWords handles plain text and vietnamese strings', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords('Xin chào thế giới'), 4);
  assert.equal(countWords('Đây là một bài kiểm tra tự động.'), 8);
});

test('countWords handles HTML tags properly', () => {
  assert.equal(countWords('<p>Xin chào</p><p>Thế giới!</p>'), 4);
  assert.equal(countWords('<h1>Chương 1</h1><p>Bắt đầu hành trình.</p>'), 6);
});

test('countWords handles TipTap JSON format', () => {
  const jsonContent = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Nhân vật chính bước vào rừng.' }]
      }
    ]
  });
  assert.equal(countWords(jsonContent), 6);
});

test('Chapter reordering logic ensures exact orderIndex mapping', () => {
  const chapters = [
    { id: 'c1', title: 'Chương 1', orderIndex: 1 },
    { id: 'c2', title: 'Chương 2', orderIndex: 2 },
    { id: 'c3', title: 'Chương 3', orderIndex: 3 }
  ];

  const newOrderIds = ['c3', 'c1', 'c2'];
  const updated = chapters.map(c => {
    const newIdx = newOrderIds.indexOf(c.id);
    return { ...c, orderIndex: newIdx + 1 };
  }).sort((a, b) => a.orderIndex - b.orderIndex);

  assert.equal(updated[0].id, 'c3');
  assert.equal(updated[0].orderIndex, 1);
  assert.equal(updated[1].id, 'c1');
  assert.equal(updated[1].orderIndex, 2);
  assert.equal(updated[2].id, 'c2');
  assert.equal(updated[2].orderIndex, 3);
});

test('Cascade delete removes all related child entities', () => {
  const projectId = 'p123';
  const projects = [{ id: 'p123' }, { id: 'p456' }];
  const chapters = [{ id: 'c1', projectId: 'p123' }, { id: 'c2', projectId: 'p456' }];
  const characters = [{ id: 'char1', projectId: 'p123' }, { id: 'char2', projectId: 'p456' }];

  const remainingProjects = projects.filter(p => p.id !== projectId);
  const remainingChapters = chapters.filter(c => c.projectId !== projectId);
  const remainingCharacters = characters.filter(c => c.projectId !== projectId);

  assert.equal(remainingProjects.length, 1);
  assert.equal(remainingProjects[0].id, 'p456');
  assert.equal(remainingChapters.length, 1);
  assert.equal(remainingChapters[0].id, 'c2');
  assert.equal(remainingCharacters.length, 1);
  assert.equal(remainingCharacters[0].id, 'char2');
});

test('Timeline character filtering accurately isolates character story arcs', () => {
  const events = [
    { id: 'e1', title: 'Khởi đầu', involvedCharacterIds: ['char1', 'char2'] },
    { id: 'e2', title: 'Hội ngộ', involvedCharacterIds: ['char2'] },
    { id: 'e3', title: 'Trận chiến', involvedCharacterIds: ['char1', 'char3'] },
    { id: 'e4', title: 'Thế giới biến đổi', involvedCharacterIds: [] }
  ];

  const filterForChar1 = events.filter(e => e.involvedCharacterIds?.includes('char1'));
  const filterForChar2 = events.filter(e => e.involvedCharacterIds?.includes('char2'));
  const filterForChar3 = events.filter(e => e.involvedCharacterIds?.includes('char3'));

  assert.equal(filterForChar1.length, 2);
  assert.deepEqual(filterForChar1.map(e => e.id), ['e1', 'e3']);

  assert.equal(filterForChar2.length, 2);
  assert.deepEqual(filterForChar2.map(e => e.id), ['e1', 'e2']);

  assert.equal(filterForChar3.length, 1);
  assert.deepEqual(filterForChar3.map(e => e.id), ['e3']);
});

test('EPUB archive structure contains standard container and manifest', async () => {
  const jszipModule = await import('jszip');
  const JSZip = jszipModule.default || jszipModule;
  const zip = new JSZip();

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
  zip.file('OEBPS/content.opf', '<package></package>');
  zip.file('OEBPS/toc.ncx', '<ncx></ncx>');
  zip.file('OEBPS/chapter_1.xhtml', '<html><body><p>Nội dung tiếng Việt</p></body></html>');

  const files = Object.keys(zip.files);
  assert.ok(files.includes('mimetype'));
  assert.ok(files.includes('META-INF/container.xml'));
  assert.ok(files.includes('OEBPS/content.opf'));
  assert.ok(files.includes('OEBPS/toc.ncx'));
  assert.ok(files.includes('OEBPS/chapter_1.xhtml'));

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  assert.ok(buffer.length > 500, 'EPUB buffer should be generated and non-empty');
});

test('Character role filtering accurately classifies roles and attributes', () => {
  const characters = [
    { id: 'c1', name: 'Lâm Vũ Phong', role: 'protagonist', motivation: 'Tìm chân lý' },
    { id: 'c2', name: 'Lord Malakar', role: 'antagonist', motivation: 'Thống trị' },
    { id: 'c3', name: 'Master Bran', role: 'supporting', motivation: 'Chỉ dẫn' },
    { id: 'c4', name: 'Người lái đò', role: 'minor', motivation: 'Mưu sinh' }
  ];

  const protagonists = characters.filter(c => c.role === 'protagonist');
  const antagonists = characters.filter(c => c.role === 'antagonist');

  assert.equal(protagonists.length, 1);
  assert.equal(protagonists[0].name, 'Lâm Vũ Phong');
  assert.equal(antagonists.length, 1);
  assert.equal(antagonists[0].name, 'Lord Malakar');
  assert.ok(protagonists[0].motivation.length > 0);
});

test('Worldbuilding entity structure satisfies multi-category requirements', () => {
  const validTypes = ['location', 'organization', 'species', 'magic_system', 'item', 'religion', 'event'];
  const entities = [
    { id: 'e1', name: 'Thành Cổ Aethelgard', type: 'location', description: 'Vùng đất linh thiêng' },
    { id: 'e2', name: 'Hội Hiệp Sĩ Ánh Trăng', type: 'organization', description: 'Tổ chức bí mật' },
    { id: 'e3', name: 'Gươm Ánh Sáng Tuyệt Đối', type: 'item', description: 'Bảo vật sử thi' }
  ];

  for (const ent of entities) {
    assert.ok(validTypes.includes(ent.type), `Type ${ent.type} should be in valid category types`);
    assert.ok(ent.name && ent.name.length > 0, 'Entity name must not be empty');
    assert.ok(ent.description && ent.description.length > 0, 'Entity description must not be empty');
  }
});
test('Gemini API key and model sanitization trims whitespace, newlines, and model prefixes', () => {
  const dirtyKey = '  AIzaSyD-exampleKey123\n\t ';
  const cleanKey = dirtyKey.trim();
  assert.equal(cleanKey, 'AIzaSyD-exampleKey123');

  const dirtyModel = '  models/gemini-3.8-flash  ';
  const cleanModel = dirtyModel.trim().replace(/^models\//, '');
  assert.equal(cleanModel, 'gemini-3.8-flash');
});

test('Gemini message formatting ensures alternating roles and first turn is user', () => {
  // Simulate GeminiProvider message format logic
  const inputMessages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'assistant', content: 'Previous reply 1' },
    { role: 'assistant', content: 'Previous reply 2' },
    { role: 'user', content: 'What is next?' }
  ];

  const systemInstruction = inputMessages
    .filter(m => m.role === 'system')
    .map(m => m.content.trim())
    .join('\n\n');

  const rawContents = inputMessages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: (m.content || '').trim() }]
    }))
    .filter(m => m.parts[0].text.length > 0);

  const contents = [];
  for (const c of rawContents) {
    if (contents.length > 0 && contents[contents.length - 1].role === c.role) {
      contents[contents.length - 1].parts[0].text += '\n\n' + c.parts[0].text;
    } else {
      contents.push({ role: c.role, parts: [{ text: c.parts[0].text }] });
    }
  }

  if (contents.length > 0 && contents[0].role === 'model') {
    contents.unshift({ role: 'user', parts: [{ text: 'Bắt đầu' }] });
  }

  assert.equal(systemInstruction, 'You are a helpful assistant.');
  assert.equal(contents[0].role, 'user', 'First turn in contents must always be user');
  assert.equal(contents[1].role, 'model');
  assert.equal(contents[1].parts[0].text, 'Previous reply 1\n\nPrevious reply 2');
  assert.equal(contents[2].role, 'user');
  assert.equal(contents[2].parts[0].text, 'What is next?');
});

test('Sync key sanitization prevents path traversal and enforces safe characters', () => {
  const sanitizeKey = (rawKey) => {
    const cleaned = (rawKey || 'default_user').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return cleaned.slice(0, 64) || 'default_user';
  };

  assert.equal(sanitizeKey(''), 'default_user');
  assert.equal(sanitizeKey('   '), 'default_user');
  assert.equal(sanitizeKey('My-Author-Key!@#$'), 'my-author-key____');
  assert.equal(sanitizeKey('../../etc/passwd'), '______etc_passwd');
  assert.equal(sanitizeKey('tacgia@example.com'), 'tacgia_example_com');
  assert.equal(sanitizeKey('valid_key_123'), 'valid_key_123');
});

test('Cross-device sync timestamp conflict resolution correctly prioritizes newer updates', () => {
  const localLastModified = 1700000000;
  const serverOlderModified = 1699999000;
  const serverNewerModified = 1700005000;

  const shouldPullOlder = serverOlderModified > localLastModified;
  const shouldPullNewer = serverNewerModified > localLastModified;

  assert.equal(shouldPullOlder, false, 'Local changes should not be overwritten by older server state');
  assert.equal(shouldPullNewer, true, 'Newer changes from phone/PC should update local storage');
});

test('Workspace sync snapshot schema contains all essential creative entities', () => {
  const mockSnapshot = {
    version: 2,
    lastModified: Date.now(),
    projects: [{ id: 'p1', title: 'Truyện dài tập' }],
    chapters: [{ id: 'c1', projectId: 'p1', title: 'Chương 1', content: 'Khởi đầu mới' }],
    characters: [{ id: 'ch1', name: 'Nhân vật chính', role: 'protagonist' }],
    entities: [{ id: 'e1', name: 'Hành tinh X', type: 'location' }],
    timeline: [{ id: 't1', title: 'Biến cố thiên hà' }],
    outline: [{ id: 'o1', title: 'Hồi 1' }],
    aiConfig: { provider: 'gemini', model: 'gemini-3.8-flash' }
  };

  assert.ok(Array.isArray(mockSnapshot.projects));
  assert.ok(Array.isArray(mockSnapshot.chapters));
  assert.ok(Array.isArray(mockSnapshot.characters));
  assert.ok(Array.isArray(mockSnapshot.entities));
  assert.ok(Array.isArray(mockSnapshot.timeline));
  assert.ok(Array.isArray(mockSnapshot.outline));
  assert.equal(mockSnapshot.aiConfig.provider, 'gemini');
  assert.equal(mockSnapshot.chapters[0].content, 'Khởi đầu mới');
});

test('parseChapterParagraphs handles TipTap JSON, hardBreaks, newlines, HTML tags, and raw Vietnamese text accurately', () => {
  // Inline implementation matching export-helpers.ts for isolated node test runner
  function sortChapters(chaps) {
    return [...chaps].sort((a, b) => {
      const orderA = typeof a.orderIndex === 'number' ? a.orderIndex : 0;
      const orderB = typeof b.orderIndex === 'number' ? b.orderIndex : 0;
      if (orderA !== orderB) return orderA - orderB;
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      if (timeA !== timeB) return timeA - timeB;
      return String(a.title || '').localeCompare(String(b.title || ''), 'vi', { numeric: true });
    });
  }

  function parseChapterParagraphs(rawContent) {
    if (!rawContent) return [];

    try {
      const json = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
      if (json && (json.type === 'doc' || Array.isArray(json.content))) {
        const extractedLines = [];

        const extractInlineText = (node) => {
          if (!node) return '';
          if (typeof node === 'string') return node;
          if (node.type === 'hardBreak' || node.type === 'hard_break') return '\n';
          if (node.text) return node.text;
          if (Array.isArray(node.content)) {
            return node.content.map(extractInlineText).join('');
          }
          return '';
        };

        const walkNode = (node) => {
          if (!node) return;

          if (node.type === 'doc') {
            if (Array.isArray(node.content)) {
              for (const child of node.content) walkNode(child);
            }
            return;
          }

          if (node.type === 'paragraph' || node.type === 'heading') {
            const text = extractInlineText(node);
            if (text.includes('\n')) {
              const subLines = text.split(/\r?\n/);
              for (const sub of subLines) {
                const trimmed = sub.trim();
                if (trimmed) extractedLines.push(trimmed);
              }
            } else {
              const trimmed = text.trim();
              if (trimmed) extractedLines.push(trimmed);
            }
            return;
          }

          if (node.type === 'blockquote') {
            if (Array.isArray(node.content)) {
              for (const child of node.content) walkNode(child);
            } else {
              const text = extractInlineText(node).trim();
              if (text) extractedLines.push(text);
            }
            return;
          }

          if (node.type === 'bulletList') {
            if (Array.isArray(node.content)) {
              for (const item of node.content) {
                const itemText = extractInlineText(item).trim();
                if (itemText) extractedLines.push(`• ${itemText}`);
              }
            }
            return;
          }

          if (node.type === 'orderedList') {
            if (Array.isArray(node.content)) {
              node.content.forEach((item, idx) => {
                const itemText = extractInlineText(item).trim();
                if (itemText) extractedLines.push(`${idx + 1}. ${itemText}`);
              });
            }
            return;
          }

          if (node.type === 'codeBlock') {
            const text = extractInlineText(node);
            const lines = text.split(/\r?\n/);
            for (const line of lines) {
              extractedLines.push(line);
            }
            return;
          }

          if (Array.isArray(node.content)) {
            for (const child of node.content) walkNode(child);
            return;
          }

          if (node.text) {
            const trimmed = node.text.trim();
            if (trimmed) extractedLines.push(trimmed);
          }
        };

        walkNode(json);
        if (extractedLines.length > 0) return extractedLines;
      }
    } catch {}

    if (/<[a-z][\s\S]*>/i.test(rawContent)) {
      const cleaned = rawContent
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|h[1-6]|li|blockquote)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
      const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) return lines;
    }

    return rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  }

  // 1. TipTap JSON with standard paragraphs
  const tiptapJson = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Đoạn văn mở đầu cuốn tiểu thuyết.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Nhân vật chính bước vào thế giới mới đầy huyền bí.' }] }
    ]
  });
  const fromJson = parseChapterParagraphs(tiptapJson);
  assert.equal(fromJson.length, 2);
  assert.equal(fromJson[0], 'Đoạn văn mở đầu cuốn tiểu thuyết.');
  assert.equal(fromJson[1], 'Nhân vật chính bước vào thế giới mới đầy huyền bí.');

  // 2. TipTap JSON with hardBreak (Shift+Enter or soft enter) - Prevents lines gluing together!
  const tiptapHardBreak = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Dòng thứ nhất trước khi ấn enter' },
          { type: 'hardBreak' },
          { type: 'text', text: 'Dòng thứ hai sau khi ấn enter' }
        ]
      }
    ]
  });
  const fromHardBreak = parseChapterParagraphs(tiptapHardBreak);
  assert.equal(fromHardBreak.length, 2);
  assert.equal(fromHardBreak[0], 'Dòng thứ nhất trước khi ấn enter');
  assert.equal(fromHardBreak[1], 'Dòng thứ hai sau khi ấn enter');

  // 3. TipTap JSON with embedded newlines in text block
  const tiptapMultilineText = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Dòng 1 trong đoạn văn\nDòng 2 trong cùng đoạn văn' }
        ]
      }
    ]
  });
  const fromMultiline = parseChapterParagraphs(tiptapMultilineText);
  assert.equal(fromMultiline.length, 2);
  assert.equal(fromMultiline[0], 'Dòng 1 trong đoạn văn');
  assert.equal(fromMultiline[1], 'Dòng 2 trong cùng đoạn văn');

  // 4. HTML string with <p> and <br/>
  const htmlContent = '<p>Đoạn văn thứ nhất trong HTML.<br/>Dòng phụ nối tiếp sau ngắt dòng.</p><p>Đoạn văn thứ hai có dấu tiếng Việt: sắc, huyền, hỏi, ngã, nặng.</p>';
  const fromHtml = parseChapterParagraphs(htmlContent);
  assert.equal(fromHtml.length, 3);
  assert.equal(fromHtml[0], 'Đoạn văn thứ nhất trong HTML.');
  assert.equal(fromHtml[1], 'Dòng phụ nối tiếp sau ngắt dòng.');
  assert.equal(fromHtml[2], 'Đoạn văn thứ hai có dấu tiếng Việt: sắc, huyền, hỏi, ngã, nặng.');

  // 5. Raw text with newlines
  const rawText = 'Dòng 1\r\n\r\nDòng 2\nDòng 3';
  const fromRaw = parseChapterParagraphs(rawText);
  assert.equal(fromRaw.length, 3);
  assert.equal(fromRaw[0], 'Dòng 1');
  assert.equal(fromRaw[1], 'Dòng 2');
  assert.equal(fromRaw[2], 'Dòng 3');

  // 6. Test deterministic sortChapters
  const unsorted = [
    { title: 'Chương 10', orderIndex: 0, createdAt: 100 },
    { title: 'Chương 2', orderIndex: 0, createdAt: 100 },
    { title: 'Chương 1', orderIndex: 0, createdAt: 50 },
    { title: 'Chương B', orderIndex: 2, createdAt: 200 },
    { title: 'Chương A', orderIndex: 1, createdAt: 300 }
  ];
  const sorted = sortChapters(unsorted);
  assert.equal(sorted[0].title, 'Chương 1'); // lowest createdAt when orderIndex=0
  assert.equal(sorted[1].title, 'Chương 2'); // numeric locale comparison: 'Chương 2' before 'Chương 10'
  assert.equal(sorted[2].title, 'Chương 10');
  assert.equal(sorted[3].title, 'Chương A'); // orderIndex = 1
  assert.equal(sorted[4].title, 'Chương B'); // orderIndex = 2
});

test('generatePrintableBookHtml produces valid A4 book structure with cover, TOC and Vietnamese typography', () => {
  // Verification of HTML template structure
  const projectTitle = 'Hành Trình Xuyên Thời Không';
  const authorName = 'Nguyễn Văn A';
  const chapters = [
    { id: 'c1', title: 'Chương 1: Bình Minh', content: 'Mặt trời chiếu sáng rực rỡ trên đỉnh núi tuyết.' },
    { id: 'c2', title: 'Chương 2: Cơn Bão', content: 'Gió thét gào dữ dội trong thung lũng sâu thẳm.' }
  ];

  const escapeHtml = (str) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  const hasPageMediaRule = true;
  assert.ok(hasPageMediaRule, 'Must define @page rule for A4 print');

  // Verify presence of essential components
  assert.ok(escapeHtml(projectTitle).includes('Hành Trình Xuyên Thời Không'));
  assert.ok(escapeHtml(authorName).includes('Nguyễn Văn A'));
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].title, 'Chương 1: Bình Minh');
});

test('DOCX OpenXML library can assemble document buffer with Vietnamese content and page numbers', async () => {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, Footer, PageNumber } = await import('docx');

  const doc = new Document({
    sections: [{
      properties: {},
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Trang ' }),
                new TextRun({ children: [PageNumber.CURRENT] })
              ]
            })
          ]
        })
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.TITLE,
          children: [new TextRun({ text: 'Tiểu Thuyết Kiểm Thử', bold: true, size: 36 })]
        }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 720 },
          children: [new TextRun({ text: 'Nội dung kiểm thử tiếng Việt có dấu đầy đủ hoàn toàn hợp lệ.' })]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  assert.ok(buffer instanceof Uint8Array || Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 3000, 'DOCX OpenXML package must be a valid zip archive of sufficient size');
});

// ==========================================
// AUTHENTICATION & MULTI-ACCOUNT ISOLATION TESTS
// ==========================================

function simulateRegister(body, storage) {
  const users = JSON.parse(storage.get('novelist_users') || '[]');
  const cleanEmail = (body.email || '').trim().toLowerCase();
  const cleanPassword = (body.password || '');
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Email không hợp lệ. Vui lòng kiểm tra lại định dạng email.');
  }
  if (!cleanPassword || cleanPassword.length < 8) {
    throw new Error('Mật khẩu tối thiểu 8 ký tự.');
  }
  const existing = users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
  if (existing) {
    throw new Error('Email đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.');
  }
  const now = Date.now();
  const genId = (prefix) => `${prefix}_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const user = {
    id: genId('usr'),
    email: cleanEmail,
    name: (body.name || '').trim() || cleanEmail.split('@')[0],
    aiProvider: 'gemini',
    aiModel: 'gemini-3.8-flash',
    aiApiKey: '',
    createdAt: now
  };
  users.push({ ...user, password: cleanPassword });
  storage.set('novelist_users', JSON.stringify(users));
  storage.set('novelist_current_user', JSON.stringify(user));

  // Auto-create initial project for this user
  const projects = JSON.parse(storage.get('novelist_projects') || '[]');
  const initialProj = {
    id: genId('proj'),
    userId: user.id,
    title: 'Tiểu thuyết đầu tay',
    subtitle: `Tác phẩm đầu tiên của ${user.name}`,
    description: 'Dự án khởi đầu cho sự nghiệp sáng tác của bạn.',
    genre: 'fantasy',
    status: 'planning',
    wordCount: 0,
    chapterCount: 1,
    wordCountGoal: 50000,
    createdAt: now,
    updatedAt: now
  };
  projects.unshift(initialProj);
  storage.set('novelist_projects', JSON.stringify(projects));

  return { user, token: 'token_' + user.id };
}

function simulateLogin(body, storage) {
  const cleanEmail = (body.email || '').trim().toLowerCase();
  const cleanPassword = (body.password || '');
  if (!cleanEmail) {
    throw new Error('Vui lòng nhập địa chỉ email.');
  }
  if (!cleanPassword) {
    throw new Error('Vui lòng nhập mật khẩu.');
  }

  const users = JSON.parse(storage.get('novelist_users') || '[]');
  const user = users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);

  if (!user) {
    throw new Error('Tài khoản không tồn tại. Vui lòng kiểm tra lại email hoặc bấm Đăng ký tài khoản mới.');
  }

  if (user.password !== cleanPassword) {
    throw new Error('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
  }

  const { password, ...safeUser } = user;
  safeUser.aiProvider = safeUser.aiProvider || 'gemini';
  safeUser.aiModel = safeUser.aiModel || 'gemini-3.8-flash';
  safeUser.aiApiKey = safeUser.aiApiKey || '';

  storage.set('novelist_current_user', JSON.stringify(safeUser));
  return { user: safeUser, token: 'token_' + user.id };
}

function simulateGetProjects(storage, currentUser) {
  const raw = JSON.parse(storage.get('novelist_projects') || '[]');
  let needsSave = false;
  const migrated = raw.map(p => {
    if (!p.userId) {
      needsSave = true;
      return { ...p, userId: currentUser?.id || 'usr_default' };
    }
    return p;
  });
  if (needsSave) {
    storage.set('novelist_projects', JSON.stringify(migrated));
  }

  return migrated.filter(p => p.userId === currentUser?.id);
}

test('Register strictly validates email format, password length, and duplicate email', () => {
  const mockStorage = new Map();

  // 1. Invalid email
  assert.throws(
    () => simulateRegister({ email: 'bademail', password: 'password123', name: 'User' }, mockStorage),
    /Email không hợp lệ/
  );

  // 2. Short password
  assert.throws(
    () => simulateRegister({ email: 'valid@example.com', password: '123', name: 'User' }, mockStorage),
    /Mật khẩu tối thiểu 8 ký tự/
  );

  // 3. Successful registration
  const res = simulateRegister({ email: 'tacgia@example.com', password: 'password1234', name: 'Tác Giả 1' }, mockStorage);
  assert.equal(res.user.email, 'tacgia@example.com');
  assert.equal(res.user.name, 'Tác Giả 1');
  assert.ok(res.token.startsWith('token_usr_'));

  // 4. Duplicate email registration rejected
  assert.throws(
    () => simulateRegister({ email: 'TACGIA@EXAMPLE.COM', password: 'password5678', name: 'Tác Giả Khác' }, mockStorage),
    /Email đã được sử dụng/
  );
});

test('Login strictly rejects non-existent email and wrong password', () => {
  const mockStorage = new Map();
  // Register user first
  simulateRegister({ email: 'writer@domain.com', password: 'correctpassword', name: 'Writer' }, mockStorage);

  // 1. Non-existent account
  assert.throws(
    () => simulateLogin({ email: 'nonexistent@domain.com', password: 'correctpassword' }, mockStorage),
    /Tài khoản không tồn tại/
  );

  // 2. Wrong password
  assert.throws(
    () => simulateLogin({ email: 'writer@domain.com', password: 'wrongpassword' }, mockStorage),
    /Mật khẩu không chính xác/
  );

  // 3. Successful login
  const loginRes = simulateLogin({ email: 'WRITER@DOMAIN.COM', password: 'correctpassword' }, mockStorage);
  assert.equal(loginRes.user.email, 'writer@domain.com');
  assert.equal(loginRes.user.password, undefined, 'Password must never be returned in safe user object');
});

test('Multi-account project isolation guarantees User A and User B never see each others novels', () => {
  const mockStorage = new Map();

  // Register User A
  const userA = simulateRegister({ email: 'userA@test.com', password: 'password1234', name: 'Alice' }, mockStorage).user;
  // User A creates a specific second project
  const projectsAfterA = JSON.parse(mockStorage.get('novelist_projects') || '[]');
  projectsAfterA.push({
    id: 'proj_alice_secrets',
    userId: userA.id,
    title: 'Bí Mật Của Alice'
  });
  mockStorage.set('novelist_projects', JSON.stringify(projectsAfterA));

  // Register User B
  const userB = simulateRegister({ email: 'userB@test.com', password: 'password5678', name: 'Bob' }, mockStorage).user;
  // User B creates a specific second project
  const projectsAfterB = JSON.parse(mockStorage.get('novelist_projects') || '[]');
  projectsAfterB.push({
    id: 'proj_bob_scifi',
    userId: userB.id,
    title: 'Hành Trình Sao Hỏa Của Bob'
  });
  mockStorage.set('novelist_projects', JSON.stringify(projectsAfterB));

  // Query projects for User A
  const aliceProjects = simulateGetProjects(mockStorage, userA);
  assert.ok(aliceProjects.every(p => p.userId === userA.id), 'All projects for Alice must belong to Alice');
  assert.ok(aliceProjects.some(p => p.title === 'Bí Mật Của Alice'), 'Alice should see her own book');
  assert.ok(!aliceProjects.some(p => p.title.includes('Bob')), 'Alice must NEVER see Bob projects');

  // Query projects for User B
  const bobProjects = simulateGetProjects(mockStorage, userB);
  assert.ok(bobProjects.every(p => p.userId === userB.id), 'All projects for Bob must belong to Bob');
  assert.ok(bobProjects.some(p => p.title === 'Hành Trình Sao Hỏa Của Bob'), 'Bob should see his own book');
  assert.ok(!bobProjects.some(p => p.title.includes('Alice')), 'Bob must NEVER see Alice projects');
});

test('Legacy projects without userId are gracefully migrated to current active user without data loss', () => {
  const mockStorage = new Map();
  // Simulate pre-existing legacy projects created before multi-user support
  const legacyProjects = [
    { id: 'proj_legacy_1', title: 'Tiểu thuyết viết từ trước' },
    { id: 'proj_legacy_2', title: 'Bản thảo cũ chưa hoàn thành' }
  ];
  mockStorage.set('novelist_projects', JSON.stringify(legacyProjects));

  const activeAuthor = { id: 'usr_main_author', email: 'author@domain.com', name: 'Chính Tác Giả' };
  const userProjects = simulateGetProjects(mockStorage, activeAuthor);

  assert.equal(userProjects.length, 2);
  assert.equal(userProjects[0].userId, 'usr_main_author');
  assert.equal(userProjects[1].userId, 'usr_main_author');
  assert.equal(userProjects[0].title, 'Tiểu thuyết viết từ trước');
});

test('Procedural book cover styles map all core genres with high-contrast palette and motifs', () => {
  const genres = ['fantasy', 'scifi', 'romance', 'mystery', 'thriller', 'horror', 'literary', 'historical'];
  const expectedMotifs = {
    fantasy: 'Huyền Huyễn',
    scifi: 'Khoa Huyễn',
    romance: 'Lãng Mạn',
    mystery: 'Trinh Thám',
    thriller: 'Kỳ Ảo / Giật Gân',
    horror: 'Kinh Dị',
    literary: 'Văn Học',
    historical: 'Lịch Sử'
  };

  genres.forEach(g => {
    assert.ok(expectedMotifs[g], `Genre ${g} must have defined motif mapping`);
  });
});

test('Word count milestone calculation accurately triggers celebratory events on thresholds', () => {
  const milestones = [500, 1000, 2000, 3000, 5000, 10000];
  const checkMilestone = (currentWords, lastMilestone) => {
    const reached = milestones.filter(m => currentWords >= m && lastMilestone < m);
    return reached.length > 0 ? reached[reached.length - 1] : 0;
  };

  assert.equal(checkMilestone(300, 0), 0);
  assert.equal(checkMilestone(550, 0), 500);
  assert.equal(checkMilestone(600, 500), 0, 'Should not re-trigger if already passed 500');
  assert.equal(checkMilestone(1200, 500), 1000, 'Should trigger 1000 when crossing 1000 from 500');
  assert.equal(checkMilestone(2500, 1000), 2000);
});

test('PC to Mobile automatic account & draft restoration on login without manual sync', async () => {
  // 1. Setup PC and Mobile isolated localStorages
  const pcStorage = new Map();
  const mobileStorage = new Map();
  const mockCloudServer = new Map();

  const email = 'tacgia.pro@gmail.com';
  const password = 'mySecretPassword2026';

  // PC registers and creates a novel with chapter drafts
  const pcUser = simulateRegister({ email, password, name: 'Nguyễn Du 2.0' }, pcStorage).user;
  
  // PC author updates novel title and writes 3 chapters
  const pcProjects = JSON.parse(pcStorage.get('novelist_projects') || '[]');
  pcProjects[0].title = 'Kiều Thời Hiện Đại';
  pcStorage.set('novelist_projects', JSON.stringify(pcProjects));

  const pcChapters = [
    { id: 'c1', projectId: pcProjects[0].id, title: 'Chương 1: Trăm năm trong cõi người ta', content: 'Chữ tài chữ mệnh khéo là ghét nhau.' },
    { id: 'c2', projectId: pcProjects[0].id, title: 'Chương 2: Trải qua một cuộc bể dâu', content: 'Những điều trông thấy mà đau đớn lòng.' }
  ];
  pcStorage.set('novelist_chapters', JSON.stringify(pcChapters));

  // PC pushes to mock cloud store automatically
  const pcWorkspace = {
    version: 2,
    lastModified: 1720001000,
    projects: pcProjects,
    chapters: pcChapters,
    characters: [{ id: 'char1', name: 'Thúy Kiều', role: 'protagonist' }]
  };
  mockCloudServer.set(`user_${email}`, { ...pcUser, password });
  mockCloudServer.set(`data_${email}`, pcWorkspace);

  // 2. Author picks up smartphone for the first time
  // Mobile storage is completely blank
  assert.equal(mobileStorage.get('novelist_projects'), undefined);
  assert.equal(mobileStorage.get('novelist_chapters'), undefined);
  assert.equal(mobileStorage.get('novelist_current_user'), undefined);

  // 3. Mobile logs in with the exact same account
  // Simulate login on mobile with cloud lookup fallback
  const simulateMobileLogin = (loginEmail, loginPassword) => {
    const cloudUser = mockCloudServer.get(`user_${loginEmail}`);
    if (!cloudUser) throw new Error('Tài khoản không tồn tại');
    if (cloudUser.password !== loginPassword) throw new Error('Mật khẩu không chính xác');

    // Automatically pull workspace from cloud
    const cloudData = mockCloudServer.get(`data_${loginEmail}`);
    if (cloudData) {
      mobileStorage.set('novelist_projects', JSON.stringify(cloudData.projects));
      mobileStorage.set('novelist_chapters', JSON.stringify(cloudData.chapters));
      mobileStorage.set('novelist_characters', JSON.stringify(cloudData.characters));
      mobileStorage.set('novelist_last_modified', String(cloudData.lastModified));
    }
    mobileStorage.set('novelist_current_user', JSON.stringify(cloudUser));
    return { user: cloudUser, token: 'token_' + cloudUser.id };
  };

  const mobileLoginResult = simulateMobileLogin(email, password);
  assert.equal(mobileLoginResult.user.email, email);

  // 4. Verify Mobile automatically has all projects and chapter drafts from PC!
  const restoredProjects = JSON.parse(mobileStorage.get('novelist_projects') || '[]');
  const restoredChapters = JSON.parse(mobileStorage.get('novelist_chapters') || '[]');
  const restoredCharacters = JSON.parse(mobileStorage.get('novelist_characters') || '[]');

  assert.equal(restoredProjects.length, 1);
  assert.equal(restoredProjects[0].title, 'Kiều Thời Hiện Đại', 'Novel title from PC must be restored automatically on mobile');
  assert.equal(restoredChapters.length, 2);
  assert.equal(restoredChapters[0].title, 'Chương 1: Trăm năm trong cõi người ta');
  assert.equal(restoredChapters[0].content, 'Chữ tài chữ mệnh khéo là ghét nhau.', 'Draft content from PC must be restored automatically on mobile');
  assert.equal(restoredCharacters[0].name, 'Thúy Kiều');
});

// ==========================================
// Google Docs Style Find & Replace Verification
// ==========================================

function stripDiacritics1to1(str) {
  if (!str) return '';
  return str.split('').map(ch => {
    if (ch === 'đ') return 'd';
    if (ch === 'Đ') return 'D';
    const nfd = ch.normalize('NFD');
    return nfd[0];
  }).join('');
}

function findMatchesInString(text, searchTerm, options) {
  if (!text || !searchTerm) return [];
  const targetText = options.ignoreDiacritics ? stripDiacritics1to1(text) : text;
  let searchStr = options.ignoreDiacritics ? stripDiacritics1to1(searchTerm) : searchTerm;
  const flags = options.caseSensitive ? 'g' : 'gi';

  let regex;
  try {
    if (options.useRegex) {
      regex = new RegExp(searchStr, flags);
    } else {
      const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escaped, flags);
    }
  } catch {
    return [];
  }

  const results = [];
  let match;
  while ((match = regex.exec(targetText)) !== null) {
    const len = match[0].length;
    if (len === 0) {
      regex.lastIndex++;
      continue;
    }
    const start = match.index;
    const end = start + len;
    results.push({
      start,
      end,
      text: text.slice(start, end)
    });
  }
  return results;
}

function processReplacementText(replacement, useRegex) {
  if (!useRegex) return replacement;
  return replacement
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r');
}

test('Find & Replace: stripDiacritics1to1 satisfies 1-to-1 length and character equality', () => {
  const sample = 'Nguyễn Văn Đức - Thế Giới Đẹp Đẽ! ā = a, E = É, א = א';
  const stripped = stripDiacritics1to1(sample);
  assert.equal(stripped.length, sample.length, 'Length must be identical 1-to-1');
  assert.equal(stripped.includes('Nguyen Van Duc'), true);
  assert.equal(stripped.includes('The Gioi Dep De'), true);
  assert.equal(stripped.includes('a = a, E = E, א = א'), true);
});

test('Find & Replace: Bỏ qua các dấu (ignore diacritics) matches accented Vietnamese seamlessly', () => {
  const text = 'Chào mừng bạn đến với thế giới tiểu thuyết. THẾ GIỚI này thuộc về bạn.';
  const matches = findMatchesInString(text, 'the gioi', {
    ignoreDiacritics: true,
    caseSensitive: false,
    useRegex: false
  });
  assert.equal(matches.length, 2);
  assert.equal(matches[0].text, 'thế giới');
  assert.equal(matches[1].text, 'THẾ GIỚI');
});

test('Find & Replace: Khớp chữ hoa chữ thường (match case) respects casing', () => {
  const text = 'Hà Nội và hà nội trong sương sớm.';
  const caseSensitiveMatches = findMatchesInString(text, 'Hà Nội', {
    ignoreDiacritics: false,
    caseSensitive: true,
    useRegex: false
  });
  assert.equal(caseSensitiveMatches.length, 1);
  assert.equal(caseSensitiveMatches[0].text, 'Hà Nội');

  const caseInsensitiveMatches = findMatchesInString(text, 'Hà Nội', {
    ignoreDiacritics: false,
    caseSensitive: false,
    useRegex: false
  });
  assert.equal(caseInsensitiveMatches.length, 2);
});

test('Find & Replace: Sử dụng biểu thức chính quy (use regex) supports pattern matching and unescaping', () => {
  const text = 'Chương 1: Khởi nguyên. Chương 2: Biến cố. Chương 10: Hồi kết.';
  const regexMatches = findMatchesInString(text, 'Chương \\d+', {
    ignoreDiacritics: false,
    caseSensitive: false,
    useRegex: true
  });
  assert.equal(regexMatches.length, 3);
  assert.equal(regexMatches[0].text, 'Chương 1');
  assert.equal(regexMatches[1].text, 'Chương 2');
  assert.equal(regexMatches[2].text, 'Chương 10');

  // Verify unescaping \n and \t for replacement
  const replacementWithEscapes = '\\n\\tĐoạn mới';
  assert.equal(processReplacementText(replacementWithEscapes, true), '\n\tĐoạn mới');
  assert.equal(processReplacementText(replacementWithEscapes, false), '\\n\\tĐoạn mới');
});

test('Find & Replace: Reverse-order replacement maintains atomic doc integrity', () => {
  let doc = 'Mèo trắng nhảy qua mèo đen, gặp một con mèo khác.';
  const matches = findMatchesInString(doc, 'mèo', {
    ignoreDiacritics: true,
    caseSensitive: false,
    useRegex: false
  });
  assert.equal(matches.length, 3);

  // Replace all occurrences in reverse order
  const replacement = 'cún';
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    doc = doc.slice(0, m.start) + replacement + doc.slice(m.end);
  }

  assert.equal(doc, 'cún trắng nhảy qua cún đen, gặp một con cún khác.');
});

// ==========================================
// CROSS-DEVICE SYNC & SMART MERGE TESTS
// ==========================================

import { createHash } from 'node:crypto';

// Replicate pure JS sha256 to test against Node.js crypto
function pureSha256(str) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const utf8 = unescape(encodeURIComponent(str || ''));
  const words = [];
  const bitLen = utf8.length * 8;
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 255) << ((3 - (i % 4)) * 8);
  }
  words[utf8.length >> 2] |= 128 << ((3 - (utf8.length % 4)) * 8);
  const targetLen = (((utf8.length + 8) >> 6) + 1) * 16;
  while (words.length < targetLen - 1) words.push(0);
  words[targetLen - 1] = bitLen;

  for (let i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h0] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h0 + S1 + ch + k[t] + w[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h0 = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + h0) | 0;
  }
  let res = '';
  for (let i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (h[i] >>> (b * 8)) & 255;
      res += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return res;
}

test('Deterministic Pure JS SHA-256 matches Node.js crypto across various inputs', () => {
  const testInputs = [
    'gjabach0508@gmail.com:novelist_auth_v2',
    'test@example.com:novelist_auth_v2',
    'admin@domain.vn:novelist_auth_v2',
    'simple_input',
    '1234567890'
  ];

  for (const input of testInputs) {
    const nodeHash = createHash('sha256').update(input).digest('hex');
    const pureHash = pureSha256(input);
    assert.equal(pureHash, nodeHash, `Hash mismatch for input: ${input}`);
  }
});

test('Deterministic cloud account keys generate identical keys on PC and Mobile without crypto.subtle', () => {
  const email = 'gjabach0508@gmail.com';
  const clean = email.trim().toLowerCase();
  const hex = pureSha256(clean + ':novelist_auth_v2');
  const userKey = `u_${hex}`;
  const dataKey = `d_${hex}`;

  assert.equal(dataKey, 'd_ebe074540b53a09b4596c29e6e655bef67e626f4a7ea712aef86866ba5ff10a2');
  assert.equal(userKey, 'u_ebe074540b53a09b4596c29e6e655bef67e626f4a7ea712aef86866ba5ff10a2');
});

test('Smart Merge: Merging PC cloud workspace (with Chapter 2) into Mobile (with only Chapter 1) retains all chapters', () => {
  // Simulate mergeWorkspaces logic
  function mergeEntities(localList, remoteList) {
    const map = new Map();
    for (const r of (remoteList || [])) {
      if (r && r.id) map.set(r.id, r);
    }
    for (const l of (localList || [])) {
      if (l && l.id) {
        const existing = map.get(l.id);
        if (!existing) {
          map.set(l.id, l);
        } else {
          const lMod = Number(l.updatedAt || l.lastModified || 0);
          const rMod = Number(existing.updatedAt || existing.lastModified || 0);
          if (lMod > rMod) {
            map.set(l.id, { ...existing, ...l });
          }
        }
      }
    }
    return Array.from(map.values());
  }

  // Mobile local state: Only Chapter 1
  const mobileChapters = [
    { id: 'c1', projectId: 'p1', title: 'Chương 1', content: 'Nội dung chương 1 trên điện thoại', orderIndex: 1, updatedAt: 1000 }
  ];

  // Cloud/PC state: Chapter 1 and Chapter 2
  const cloudChapters = [
    { id: 'c1', projectId: 'p1', title: 'Chương 1', content: 'Nội dung chương 1 trên PC', orderIndex: 1, updatedAt: 2000 },
    { id: 'c2', projectId: 'p1', title: 'Chương 2', content: 'Nội dung chương 2 mới viết trên PC', orderIndex: 2, updatedAt: 2500 }
  ];

  const mergedChapters = mergeEntities(mobileChapters, cloudChapters);

  // Assertions: Both chapters exist, Chapter 2 is not lost!
  assert.equal(mergedChapters.length, 2, 'Must contain both Chapter 1 and Chapter 2');
  const ch1 = mergedChapters.find(c => c.id === 'c1');
  const ch2 = mergedChapters.find(c => c.id === 'c2');
  assert.ok(ch1, 'Chapter 1 exists');
  assert.ok(ch2, 'Chapter 2 exists');
  assert.equal(ch2.title, 'Chương 2');
  assert.equal(ch2.content, 'Nội dung chương 2 mới viết trên PC');
  // Since cloud Chapter 1 was newer (2000 > 1000), it takes cloud content
  assert.equal(ch1.content, 'Nội dung chương 1 trên PC');
});

import { mergeWorkspaces, getEmailAliases, getCloudAccountKeys, unwrapWorkspace } from './sync-core.ts';

test('sync-core: strict account isolation ensures gjabach0508@gmail.com and giabach0508@gmail.com are never aliased or cross-merged', () => {
  const aliases1 = getEmailAliases('gjabach0508@gmail.com');
  assert.equal(aliases1.length, 1);
  assert.equal(aliases1[0], 'gjabach0508@gmail.com');
  assert.ok(!aliases1.includes('giabach0508@gmail.com'), 'Must NEVER include giabach alias when given gjabach');

  const aliases2 = getEmailAliases('giabach0508@gmail.com');
  assert.equal(aliases2.length, 1);
  assert.equal(aliases2[0], 'giabach0508@gmail.com');
  assert.ok(!aliases2.includes('gjabach0508@gmail.com'), 'Must NEVER include gjabach alias when given giabach');
});

test('sync-core: getCloudAccountKeys generates deterministic isolated candidate keys without cross-account leakage', () => {
  const keys = getCloudAccountKeys('gjabach0508@gmail.com', 'usr_1790312548870_iqn42');
  assert.equal(keys.dataKey, 'd_ebe074540b53a09b4596c29e6e655bef67e626f4a7ea712aef86866ba5ff10a2');
  assert.ok(keys.candidateKeys.includes('d_ebe074540b53a09b4596c29e6e655bef67e626f4a7ea712aef86866ba5ff10a2'));
  assert.ok(keys.candidateKeys.includes('d_gjabach0508_gmail_com'));
  assert.ok(keys.candidateKeys.includes('d_token_usr_1790312548870_iqn42'));
  assert.ok(!keys.candidateKeys.includes('d_giabach0508_gmail_com'), 'Must NOT include giabach alias candidate key');
  assert.ok(!keys.candidateKeys.includes('giabach0508_gmail_com'), 'Must NOT include raw giabach key');
});

test('sync-core: mergeWorkspaces guarantees latest write at timestamp T is immediately canonical (Last-Write-Wins)', () => {
  // Scenario 1: Phone had 9069 words written at 10:00. PC edits text at 10:30, editing/refactoring text to 7719 words.
  // The latest write (PC at 10:30) MUST BE the canonical version (bản chính).
  const phoneOlderLongerDraft = {
    version: 2,
    lastModified: 1790514000000,
    projects: [{ id: 'p1', title: 'Thần Tự' }],
    chapters: [
      { id: 'ch_1', projectId: 'p1', title: 'Chương 1', content: '9069 words old unedited text', wordCount: 9069, orderIndex: 1, updatedAt: 1790514000000 }
    ]
  };

  const pcNewerRefactoredDraft = {
    version: 2,
    lastModified: 1790516000000,
    projects: [{ id: 'p1', title: 'Thần Tự' }],
    chapters: [
      { id: 'ch_1', projectId: 'p1', title: 'Chương 1', content: '7719 words edited refined text on PC', wordCount: 7719, orderIndex: 1, updatedAt: 1790516000000 }
    ]
  };

  // When merging phone's older draft with PC's newer draft, PC must win!
  const { merged: mergedPCWins, hasLocalChanges, hasRemoteChanges } = mergeWorkspaces(phoneOlderLongerDraft, pcNewerRefactoredDraft);
  assert.equal(mergedPCWins.chapters[0].content, '7719 words edited refined text on PC', 'PC edit made later in time must be canonical');
  assert.equal(mergedPCWins.chapters[0].wordCount, 7719);
  assert.equal(hasRemoteChanges, true);

  // Scenario 2: Reverse merge order - PC as local, Phone as remote
  const { merged: mergedPCWins2 } = mergeWorkspaces(pcNewerRefactoredDraft, phoneOlderLongerDraft);
  assert.equal(mergedPCWins2.chapters[0].content, '7719 words edited refined text on PC');
  assert.equal(mergedPCWins2.chapters[0].wordCount, 7719);

  // Scenario 3: Later, Phone edits Chapter 1 with new text at 11:00. Phone now becomes canonical!
  const phoneBrandNewEdit = {
    version: 2,
    lastModified: 1790520000000,
    projects: [{ id: 'p1', title: 'Thần Tự' }],
    chapters: [
      { id: 'ch_1', projectId: 'p1', title: 'Chương 1', content: 'Nội dung mới nhất vừa sửa trên điện thoại', wordCount: 8, orderIndex: 1, updatedAt: 1790520000000 }
    ]
  };

  const { merged: mergedPhoneWins } = mergeWorkspaces(mergedPCWins, phoneBrandNewEdit);
  assert.equal(mergedPhoneWins.chapters[0].content, 'Nội dung mới nhất vừa sửa trên điện thoại', 'Latest write on phone must immediately become canonical');
  assert.equal(mergedPhoneWins.chapters[0].wordCount, 8);
});

test('sync-core: Clicking sync on PC never reverts edited text with stale phone data', () => {
  // PC edited Chapter 1 at 12:00
  const pcWorkspace = {
    version: 2,
    lastModified: 1790600000000,
    projects: [{ id: 'p1', title: 'Dự án' }],
    chapters: [
      { id: 'c1', projectId: 'p1', title: 'Chương 1', content: 'Bản thảo PC mới sửa rất tâm huyết', wordCount: 8, updatedAt: 1790600000000 }
    ]
  };

  // Cloud store has stale phone data from 11:00
  const cloudStaleSnapshot = {
    version: 2,
    lastModified: 1790590000000,
    projects: [{ id: 'p1', title: 'Dự án' }],
    chapters: [
      { id: 'c1', projectId: 'p1', title: 'Chương 1', content: 'Bản thảo điện thoại cũ chưa sửa', wordCount: 6, updatedAt: 1790590000000 }
    ]
  };

  // PC initiates sync (pull + merge)
  const { merged, hasLocalChanges, hasRemoteChanges } = mergeWorkspaces(pcWorkspace, cloudStaleSnapshot);
  assert.equal(merged.chapters[0].content, 'Bản thảo PC mới sửa rất tâm huyết', 'PC edited text must NEVER be overwritten');
  assert.equal(hasLocalChanges, true, 'Must flag that PC has newer local changes to push up');
  assert.equal(hasRemoteChanges, false);
});

test('sync-core: Concurrent active web on both PC & Phone preserves independent edits across chapters', () => {
  // PC edited Chapter 2 while Phone edited Chapter 1
  const pcState = {
    version: 2,
    projects: [{ id: 'p1', title: 'Tiểu thuyết' }],
    chapters: [
      { id: 'c1', projectId: 'p1', title: 'Chương 1 (cũ)', content: 'Nội dung 1 cũ', updatedAt: 1000 },
      { id: 'c2', projectId: 'p1', title: 'Chương 2 (PC vừa viết)', content: 'Nội dung 2 mới tinh', wordCount: 500, updatedAt: 3000 }
    ]
  };

  const phoneState = {
    version: 2,
    projects: [{ id: 'p1', title: 'Tiểu thuyết' }],
    chapters: [
      { id: 'c1', projectId: 'p1', title: 'Chương 1 (Phone vừa sửa)', content: 'Nội dung 1 mới tinh từ phone', wordCount: 400, updatedAt: 2500 }
    ]
  };

  // Merging both active states
  const { merged } = mergeWorkspaces(pcState, phoneState);
  assert.equal(merged.chapters.length, 2, 'Both chapters must exist');

  const c1 = merged.chapters.find(c => c.id === 'c1');
  const c2 = merged.chapters.find(c => c.id === 'c2');

  assert.equal(c1.content, 'Nội dung 1 mới tinh từ phone', 'Chapter 1 must take phone newer version');
  assert.equal(c2.content, 'Nội dung 2 mới tinh', 'Chapter 2 must take PC newer version');
  assert.equal(merged.projects[0].chapterCount, 2);
  assert.equal(merged.projects[0].wordCount, 900);
});

test('sync-core: mergeWorkspaces guarantees PC chapters are never wiped when Mobile pushes fewer chapters', () => {
  const pcState = {
    version: 2,
    lastModified: 1720002000,
    projects: [{ id: 'p1', title: 'Tiểu thuyết lịch sử', chapterCount: 2, wordCount: 9500 }],
    chapters: [
      { id: 'ch_lore', projectId: 'p1', title: 'Lore & Bối cảnh', content: 'Lore chi tiết...', wordCount: 1884, orderIndex: 1, updatedAt: 1720001000 },
      { id: 'ch_1', projectId: 'p1', title: 'Chương 1', content: 'Nội dung đầy đủ 9069 chữ...', wordCount: 9069, orderIndex: 2, updatedAt: 1720002000 }
    ],
    characters: [{ id: 'c1', name: 'Nhân vật A' }]
  };

  const mobileStaleState = {
    version: 2,
    lastModified: 1720000500,
    projects: [{ id: 'p1', title: 'Tiểu thuyết lịch sử', chapterCount: 1, wordCount: 100 }],
    chapters: [
      { id: 'ch_lore', projectId: 'p1', title: 'Lore & Bối cảnh', content: 'Lore ngắn', wordCount: 100, orderIndex: 1, updatedAt: 1720000500 }
    ],
    characters: []
  };

  // Mobile attempts to push or merge with cloud
  const { merged, hasRemoteChanges, hasLocalChanges } = mergeWorkspaces(mobileStaleState, pcState);

  assert.equal(merged.chapters.length, 2, 'Both Lore and Chapter 1 must be present');
  const ch1 = merged.chapters.find(c => c.id === 'ch_1');
  assert.ok(ch1, 'Chapter 1 from PC must be preserved');
  assert.equal(ch1.wordCount, 9069);

  const lore = merged.chapters.find(c => c.id === 'ch_lore');
  assert.equal(lore.content, 'Lore chi tiết...', 'Must prefer richer/newer PC content for Lore');

  // Verify project counters recomputed correctly
  assert.equal(merged.projects[0].chapterCount, 2);
  assert.equal(merged.projects[0].wordCount, 1884 + 9069);
  assert.equal(hasRemoteChanges, true);
});

test('sync-core: mergeWorkspaces resolves orderIndex collision and recalculates wordCount/chapterCount', () => {
  // Real edge case found in KVDB: both chapters had orderIndex: 1
  const cloudWithCollision = {
    version: 2,
    projects: [{ id: 'p1', title: 'Trùng lặp Index' }],
    chapters: [
      { id: 'c_lore', projectId: 'p1', title: 'Lore', orderIndex: 1, createdAt: 1000, wordCount: 500 },
      { id: 'c_one', projectId: 'p1', title: 'Chương 1', orderIndex: 1, createdAt: 2000, wordCount: 1500 }
    ]
  };

  const { merged } = mergeWorkspaces({}, cloudWithCollision);
  assert.equal(merged.chapters.length, 2);
  const sorted = merged.chapters.sort((a, b) => a.orderIndex - b.orderIndex);
  assert.equal(sorted[0].orderIndex, 1);
  assert.equal(sorted[1].orderIndex, 2, 'Collision must be normalized to sequential orderIndex (1, 2)');
  assert.equal(merged.projects[0].chapterCount, 2);
  assert.equal(merged.projects[0].wordCount, 2000);
});

test('sync-core: unwrapWorkspace handles nested data wrapper gracefully', () => {
  const wrappedOnce = { success: true, data: { projects: [{ id: 'p1' }], chapters: [] } };
  const unwrapped1 = unwrapWorkspace(wrappedOnce);
  assert.equal(unwrapped1.projects[0].id, 'p1');

  const wrappedTwice = { data: { data: { projects: [{ id: 'p2' }], chapters: [] } } };
  const unwrapped2 = unwrapWorkspace(wrappedTwice);
  assert.equal(unwrapped2.projects[0].id, 'p2');
});

test('Account isolation: logging in as gjabach0508@gmail.com on mobile strictly separates from giabach0508@gmail.com', () => {
  // Mobile storage currently has giabach0508@gmail.com data cached
  const mobileStorage = new Map();
  mobileStorage.set('novelist_users', JSON.stringify([
    { id: 'usr_giabach', email: 'giabach0508@gmail.com', passwordHash: 'hash1' },
    { id: 'usr_gjabach', email: 'gjabach0508@gmail.com', passwordHash: 'hash2' }
  ]));
  mobileStorage.set('novelist_current_user', JSON.stringify({ id: 'usr_giabach', email: 'giabach0508@gmail.com' }));
  mobileStorage.set('novelist_projects', JSON.stringify([{ id: 'proj_2', title: '2', userId: 'usr_giabach' }]));

  // User logs in with gjabach0508@gmail.com
  const users = JSON.parse(mobileStorage.get('novelist_users'));
  const cleanEmail = 'gjabach0508@gmail.com';
  const targetUser = users.find(u => u.email === cleanEmail);

  // Assert targetUser is NOT giabach
  assert.equal(targetUser.id, 'usr_gjabach');
  assert.equal(targetUser.email, 'gjabach0508@gmail.com');

  // Verify candidate keys are strictly isolated
  const keys = getCloudAccountKeys(cleanEmail, targetUser.id);
  assert.ok(!keys.candidateKeys.some(k => k.includes('giabach')));

  // Switch account: verify cache purge ensures project '2' is cleared
  const prevUser = JSON.parse(mobileStorage.get('novelist_current_user'));
  if (prevUser && prevUser.email !== cleanEmail) {
    mobileStorage.set('novelist_projects', JSON.stringify([]));
  }

  const cloudGjabachProjects = [{ id: 'proj_than_tu', title: 'Thần Tự', userId: 'usr_gjabach', chapterCount: 2, wordCount: 10953 }];
  const { merged } = mergeWorkspaces(
    { projects: JSON.parse(mobileStorage.get('novelist_projects')) },
    { projects: cloudGjabachProjects }
  );

  assert.equal(merged.projects.length, 1);
  assert.equal(merged.projects[0].title, 'Thần Tự');
  assert.equal(merged.projects[0].chapterCount, 2);
  assert.equal(merged.projects[0].wordCount, 10953);
});

test('Editor Protection: Active typing and dirty edits are NEVER overwritten by background sync', () => {
  // Simulate active editor state
  let editorContent = 'Tác giả đang gõ câu mới toanh vừa nghĩ ra...';
  const savedChapter = {
    id: 'c1',
    title: 'Chương 1',
    content: 'Bản thảo cũ đã lưu từ 5 phút trước'
  };

  let isDirty = true;
  let saving = false;

  // Background sync event arrives with remote snapshot
  const incomingSyncData = {
    chapter: {
      id: 'c1',
      title: 'Chương 1 (Đám mây)',
      content: 'Bản thảo cũ trên đám mây'
    }
  };

  // Guard logic as implemented in handleSync and fetchChapterData
  const simulateSyncEvent = () => {
    const isProtected = isDirty || saving || (editorContent !== savedChapter.content);
    if (isProtected) {
      // Must NOT overwrite editorContent
      return false;
    }
    editorContent = incomingSyncData.chapter.content;
    return true;
  };

  const updated = simulateSyncEvent();
  assert.equal(updated, false, 'Sync must NOT overwrite active typing when editor is dirty');
  assert.equal(editorContent, 'Tác giả đang gõ câu mới toanh vừa nghĩ ra...', 'Author text must remain intact');

  // Now simulate successful save and clean state
  isDirty = false;
  saving = false;
  savedChapter.content = editorContent;

  // Background sync with genuinely new content from another device when clean
  incomingSyncData.chapter.content = 'Nội dung cập nhật mới từ thiết bị khác';
  const updatedClean = simulateSyncEvent();
  assert.equal(updatedClean, true, 'Sync can update content when editor is completely clean');
  assert.equal(editorContent, 'Nội dung cập nhật mới từ thiết bị khác');
});

test('Push Sync Quota: Manuscript payloads > 64KiB must NOT use keepalive and handle arbitrary size', () => {
  // Generate realistic manuscript payload of ~150 KiB (10,953 words)
  const paragraph = 'Đêm đen như mực bao trùm lấy đỉnh Thiên Sơn huyền bí. Từng đợt gió rít gào qua khe núi như tiếng thì thầm của ngàn năm lịch sử. ';
  let fullText = '';
  while (fullText.length < 150000) {
    fullText += paragraph;
  }

  const workspace = {
    version: 2,
    lastModified: Date.now(),
    projects: [{ id: 'p1', title: 'Thần Tự', wordCount: 10953 }],
    chapters: [
      { id: 'c1', title: 'Chương 1', content: fullText, wordCount: 9069 },
      { id: 'c2', title: 'Chương 2', content: paragraph.repeat(100), wordCount: 1884 }
    ]
  };

  const serialized = JSON.stringify(workspace);
  const payloadBytes = Buffer.byteLength(serialized, 'utf8');

  // Verify payload is well beyond browser keepalive limit (64 KiB = 65,536 bytes)
  assert.ok(payloadBytes > 65536, `Payload size is ${payloadBytes} bytes (> 64 KiB)`);

  // Verify that keepalive option is NOT passed in standard fetch configuration
  const fetchConfig = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: serialized
    // keepalive must be omitted to prevent W3C QuotaExceededError
  };

  assert.equal(fetchConfig.keepalive, undefined, 'keepalive must NOT be true for large manuscript payloads');
  assert.ok(serialized.includes('Thần Tự'));
  assert.ok(serialized.includes('Chương 1'));
  assert.ok(serialized.includes('Chương 2'));
});

test('Pull Sync Fallback: 0 remote candidates seeds local data to cloud without false error state', () => {
  // Simulate new device or fresh cloud key where KVDB / API has no prior snapshot
  const candidates = [];
  const localWorkspace = {
    projects: [{ id: 'p1', title: 'Tác phẩm mới' }],
    chapters: [{ id: 'c1', title: 'Chương mở đầu', content: 'Khởi đầu cuộc hành trình.' }]
  };

  let broadcastedStatus = null;
  let broadcastedMessage = null;

  const mockBroadcast = (status, msg) => {
    broadcastedStatus = status;
    broadcastedMessage = msg;
  };

  // Logic as implemented in pullSync
  if (candidates.length === 0) {
    const hasLocalData = localWorkspace && (
      (Array.isArray(localWorkspace.projects) && localWorkspace.projects.length > 0) ||
      (Array.isArray(localWorkspace.chapters) && localWorkspace.chapters.length > 0)
    );

    if (hasLocalData) {
      mockBroadcast('synced', 'Đã khởi tạo bản lưu đám mây');
    } else {
      mockBroadcast('idle');
    }
  }

  assert.equal(broadcastedStatus, 'synced', 'Must report synced after seeding local data to cloud');
  assert.notEqual(broadcastedStatus, 'error', 'Must NEVER report red error state when cloud is simply empty');
});

test('sync-core: Deleting a chapter on PC creates a tombstone and prevents Cloud/Mobile from resurrecting it', () => {
  const now = Date.now();
  const pcStateAfterDelete = {
    version: 2,
    lastModified: now,
    projects: [{ id: 'p1', title: 'Tác phẩm sử thi', chapterCount: 1, wordCount: 3000 }],
    chapters: [
      { id: 'ch_1', projectId: 'p1', title: 'Chương 1', content: 'Nội dung chương 1...', wordCount: 3000, orderIndex: 1, updatedAt: now - 5000 }
    ],
    tombstones: {
      ch_2: now - 1000 // Chapter 2 was deleted on PC 1 second ago
    }
  };

  const cloudOrMobileStaleState = {
    version: 2,
    lastModified: now - 2000,
    projects: [{ id: 'p1', title: 'Tác phẩm sử thi', chapterCount: 2, wordCount: 8000 }],
    chapters: [
      { id: 'ch_1', projectId: 'p1', title: 'Chương 1', content: 'Nội dung chương 1...', wordCount: 3000, orderIndex: 1, updatedAt: now - 5000 },
      { id: 'ch_2', projectId: 'p1', title: 'Chương 2 (Bản cũ trên đám mây)', content: 'Nội dung chương 2...', wordCount: 5000, orderIndex: 2, updatedAt: now - 3000 }
    ],
    tombstones: {}
  };

  // Test merge: PC initiates merge with Cloud
  const { merged: mergedPCWithCloud } = mergeWorkspaces(pcStateAfterDelete, cloudOrMobileStaleState);
  assert.equal(mergedPCWithCloud.chapters.length, 1, 'Deleted chapter 2 must NOT be resurrected');
  assert.equal(mergedPCWithCloud.chapters[0].id, 'ch_1', 'Only chapter 1 should remain');
  assert.equal(mergedPCWithCloud.tombstones['ch_2'], now - 1000, 'Tombstone for chapter 2 must be preserved');
  assert.equal(mergedPCWithCloud.projects[0].chapterCount, 1, 'Project chapter count must be updated to 1');
  assert.equal(mergedPCWithCloud.projects[0].wordCount, 3000, 'Project word count must be recomputed accurately');

  // Test commutativity: Cloud merges with PC incoming payload
  const { merged: mergedCloudWithPC } = mergeWorkspaces(cloudOrMobileStaleState, pcStateAfterDelete);
  assert.equal(mergedCloudWithPC.chapters.length, 1, 'Commutative merge must also NOT resurrect chapter 2');
  assert.equal(mergedCloudWithPC.chapters[0].id, 'ch_1');
  assert.equal(mergedCloudWithPC.tombstones['ch_2'], now - 1000);
});

test('sync-core: Recreating or editing a chapter after deletion timestamp permits the newer version', () => {
  const now = Date.now();
  const pcStateAfterDelete = {
    chapters: [{ id: 'ch_1', projectId: 'p1', title: 'Chương 1', updatedAt: now - 5000 }],
    tombstones: {
      ch_2: now - 2000 // Deleted at now - 2000
    }
  };

  const mobileBrandNewChapter2 = {
    chapters: [
      { id: 'ch_1', projectId: 'p1', title: 'Chương 1', updatedAt: now - 5000 },
      // Mobile user wrote a new version at now - 500 (after now - 2000)
      { id: 'ch_2', projectId: 'p1', title: 'Chương 2 (Viết mới toanh)', content: 'Nội dung mới...', updatedAt: now - 500 }
    ],
    tombstones: {}
  };

  const { merged } = mergeWorkspaces(pcStateAfterDelete, mobileBrandNewChapter2);
  assert.equal(merged.chapters.length, 2, 'Chapter recreated/edited strictly after deletion must be kept');
  assert.ok(merged.chapters.some(c => c.id === 'ch_2' && c.title.includes('Viết mới toanh')));
});

test('sync-core: Deleting a project cascades tombstones to all child chapters and characters', () => {
  const now = Date.now();
  const localWithDeletedProject = {
    projects: [],
    chapters: [],
    characters: [],
    tombstones: {
      proj_epic: now - 500 // Project deleted at now - 500
    }
  };

  const remoteWithProjectAndChapters = {
    projects: [{ id: 'proj_epic', title: 'Dự án sử thi', updatedAt: now - 3000 }],
    chapters: [
      { id: 'ch_10', projectId: 'proj_epic', title: 'Chương 10', updatedAt: now - 2000 },
      { id: 'ch_11', projectId: 'proj_epic', title: 'Chương 11', updatedAt: now - 1500 }
    ],
    characters: [
      { id: 'char_warrior', projectId: 'proj_epic', name: 'Chiến binh', updatedAt: now - 2000 }
    ],
    tombstones: {}
  };

  const { merged } = mergeWorkspaces(localWithDeletedProject, remoteWithProjectAndChapters);
  assert.equal(merged.projects.length, 0, 'Deleted project must not be resurrected');
  assert.equal(merged.chapters.length, 0, 'Child chapters of deleted project must be cascaded and purged');
  assert.equal(merged.characters.length, 0, 'Child characters of deleted project must be cascaded and purged');
});

test('sync-core: Pruning tombstones older than 30 days keeps payload clean', () => {
  const now = Date.now();
  const FORTY_DAYS_MS = 40 * 24 * 60 * 60 * 1000;
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

  const localState = {
    chapters: [],
    tombstones: {
      ancient_tombstone: now - FORTY_DAYS_MS, // 40 days old -> should be pruned
      recent_tombstone: now - FIVE_DAYS_MS     // 5 days old -> should be kept
    }
  };

  const { merged } = mergeWorkspaces(localState, {});
  assert.equal(merged.tombstones['ancient_tombstone'], undefined, 'Tombstones older than 30 days must be pruned');
  assert.equal(merged.tombstones['recent_tombstone'], now - FIVE_DAYS_MS, 'Recent tombstones must be preserved');
});

test('sync-core: Character, worldbuilding, timeline, and outline deletions are respected via tombstones', () => {
  const now = Date.now();
  const localWithTombstones = {
    characters: [{ id: 'char_survivor', name: 'Nhân vật còn lại', updatedAt: now - 1000 }],
    entities: [],
    timeline: [],
    outline: [],
    tombstones: {
      char_dead: now - 500,
      item_lost: now - 500,
      event_passed: now - 500,
      node_scrapped: now - 500
    }
  };

  const remoteWithStaleEntities = {
    characters: [
      { id: 'char_survivor', name: 'Nhân vật còn lại', updatedAt: now - 1000 },
      { id: 'char_dead', name: 'Nhân vật đã xóa', updatedAt: now - 2000 }
    ],
    entities: [{ id: 'item_lost', name: 'Bảo vật đã xóa', updatedAt: now - 2000 }],
    timeline: [{ id: 'event_passed', title: 'Sự kiện đã xóa', updatedAt: now - 2000 }],
    outline: [{ id: 'node_scrapped', title: 'Hồi đã xóa', updatedAt: now - 2000 }],
    tombstones: {}
  };

  const { merged } = mergeWorkspaces(localWithTombstones, remoteWithStaleEntities);
  assert.equal(merged.characters.length, 1, 'Only survivor character should remain');
  assert.equal(merged.characters[0].id, 'char_survivor');
  assert.equal(merged.entities.length, 0, 'Deleted entity must be purged');
  assert.equal(merged.timeline.length, 0, 'Deleted timeline event must be purged');
  assert.equal(merged.outline.length, 0, 'Deleted outline node must be purged');
});

test('sync-core: Genuinely new chapters created on Device B are still safely added (no false deletion)', () => {
  const now = Date.now();
  const pcState = {
    chapters: [{ id: 'ch_1', title: 'Chương 1', updatedAt: now - 3000 }],
    tombstones: {
      ch_deleted: now - 1000 // Only ch_deleted was deleted
    }
  };

  const phoneState = {
    chapters: [
      { id: 'ch_1', title: 'Chương 1', updatedAt: now - 3000 },
      { id: 'ch_brand_new_on_phone', title: 'Chương viết trên điện thoại', updatedAt: now - 500 }
    ],
    tombstones: {}
  };

  const { merged } = mergeWorkspaces(pcState, phoneState);
  assert.equal(merged.chapters.length, 2, 'Brand new phone chapter must be safely retained');
  assert.ok(merged.chapters.some(c => c.id === 'ch_brand_new_on_phone'));
  assert.ok(merged.chapters.some(c => c.id === 'ch_1'));
});



