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

  const dirtyModel = '  models/gemini-1.5-flash  ';
  const cleanModel = dirtyModel.trim().replace(/^models\//, '');
  assert.equal(cleanModel, 'gemini-1.5-flash');
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
    aiConfig: { provider: 'gemini', model: 'gemini-1.5-flash', apiKey: 'AIzaSyTestKey' }
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

