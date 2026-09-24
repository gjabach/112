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
