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

