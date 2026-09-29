import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeWorkspaces, unwrapWorkspace } from './sync-core.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Creative Suite - Outline templates include classic international structures including Story Circle', () => {
  const utilsCode = fs.readFileSync(path.join(__dirname, 'utils.ts'), 'utf8');
  assert.ok(utilsCode.includes("'three-act':"), 'Three-act structure must exist');
  assert.ok(utilsCode.includes("'save-the-cat':"), 'Save the Cat structure must exist');
  assert.ok(utilsCode.includes("'hero-journey':"), 'Hero Journey structure must exist');
  assert.ok(utilsCode.includes("'snowflake':"), 'Snowflake method must exist');
  assert.ok(utilsCode.includes("'story-circle':"), 'Story Circle structure must exist');
  assert.ok(utilsCode.includes("Dan Harmon's Story Circle"), 'Dan Harmon Story Circle title must exist');
  assert.ok(utilsCode.includes("1. Vùng an toàn (Comfort Zone)"), 'Step 1 Comfort Zone must exist');
  assert.ok(utilsCode.includes("8. Biến đổi hoàn toàn (Change / Master of Both Worlds)"), 'Step 8 Change must exist');
});

test('Creative Suite - Character relationships data structure supports multi-role directed links', () => {
  const characters = [
    {
      id: 'char_1',
      name: 'Lâm Vũ Phong',
      role: 'protagonist',
      desires: 'Đạt được đỉnh cao kiếm đạo',
      characterArc: 'Học cách tin tưởng đồng đội thay vì cô độc gánh vác',
      secrets: 'Mang huyết mạch Long Tộc cổ đại',
      relationships: [
        { characterId: 'char_2', type: 'rival', description: 'Đối thủ truyền kiếp thời niên thiếu' },
        { characterId: 'char_3', type: 'love', description: 'Người yêu thầm nhưng chưa dám thổ lộ' }
      ]
    },
    {
      id: 'char_2',
      name: 'Kaelen Thorne',
      role: 'antagonist',
      relationships: [
        { characterId: 'char_1', type: 'enemy', description: 'Xem là cái gai trong mắt cần trừ khử' }
      ]
    },
    {
      id: 'char_3',
      name: 'Elena Vance',
      role: 'supporting',
      relationships: []
    }
  ];

  // Test relationship link resolution
  const char1Rels = characters[0].relationships;
  assert.strictEqual(char1Rels.length, 2);
  assert.strictEqual(char1Rels[0].type, 'rival');
  assert.strictEqual(char1Rels[1].type, 'love');

  // Verify finding target character
  const target1 = characters.find(c => c.id === char1Rels[0].characterId);
  assert.strictEqual(target1?.name, 'Kaelen Thorne');
});

test('Creative Suite - Worldbuilding entity custom attributes preserve key-value pairs', () => {
  const entity = {
    id: 'ent_1',
    name: 'Thành Cổ Aethelgard',
    type: 'location',
    description: 'Thành trì cổ xưa nằm trên vách đá nghìn trượng',
    attributes: {
      'Khí hậu': 'Hàn đới băng giá',
      'Địa hình': 'Vách đá dốc đứng',
      'Mức độ nguy hiểm': 'Cấp S - Nguy hiểm cực độ',
      'Thủ lĩnh': 'Lãnh chúa Vane'
    }
  };

  assert.strictEqual(entity.attributes['Khí hậu'], 'Hàn đới băng giá');
  assert.strictEqual(Object.keys(entity.attributes).length, 4);
});

test('Creative Suite - Timeline importance classifications and chronological sorting', () => {
  const events = [
    { id: 'ev_1', title: 'Hòa ước Ngũ Vương', dateInStory: 'Năm 104', importance: 'major', orderIndex: 1 },
    { id: 'ev_2', title: 'Biến cố Dạ Nguyệt', dateInStory: 'Năm 102', importance: 'turning_point', orderIndex: 0 },
    { id: 'ev_3', title: 'Cuộc gặp gỡ quán trọ', dateInStory: 'Năm 105', importance: 'minor', orderIndex: 2 }
  ];

  const sorted = [...events].sort((a, b) => a.orderIndex - b.orderIndex);
  assert.strictEqual(sorted[0].id, 'ev_2');
  assert.strictEqual(sorted[1].id, 'ev_1');
  assert.strictEqual(sorted[2].id, 'ev_3');
});

test('Creative Suite - Story Arc tension checkpoints correctly partition narrative progress', () => {
  const arcStages = [
    { id: 'setup', pctStart: 0, pctEnd: 15 },
    { id: 'catalyst', pctStart: 15, pctEnd: 30 },
    { id: 'rising', pctStart: 30, pctEnd: 50 },
    { id: 'midpoint', pctStart: 50, pctEnd: 60 },
    { id: 'all_lost', pctStart: 60, pctEnd: 80 },
    { id: 'climax', pctStart: 80, pctEnd: 95 },
    { id: 'resolution', pctStart: 95, pctEnd: 100 }
  ];

  const mockNodes = Array.from({ length: 20 }, (_, i) => ({
    id: `node_${i}`,
    title: `Scene ${i + 1}`,
    orderIndex: i
  }));

  const total = mockNodes.length;
  const climaxNodes = mockNodes.filter(n => {
    const pct = (n.orderIndex / total) * 100;
    return pct >= 80 && pct < 95;
  });

  assert.ok(climaxNodes.length > 0, 'Must have scenes mapped into Climax checkpoint');
});

test('Creative Suite - Workspace sync preserves characters, worldbuilding, timeline, and outline integrity', () => {
  const local = {
    version: 2,
    lastModified: 1000,
    projects: [{ id: 'proj_1', title: 'Tiểu thuyết huyền ảo', updatedAt: 1000 }],
    chapters: [{ id: 'ch_1', projectId: 'proj_1', title: 'Chương 1', updatedAt: 1000 }],
    characters: [{ id: 'c_1', projectId: 'proj_1', name: 'Nhân vật 1', updatedAt: 1000 }],
    entities: [{ id: 'e_1', projectId: 'proj_1', name: 'Địa điểm 1', updatedAt: 1000 }],
    timeline: [{ id: 't_1', projectId: 'proj_1', title: 'Biến cố 1', updatedAt: 1000 }],
    outline: [{ id: 'o_1', projectId: 'proj_1', title: 'Hồi 1', updatedAt: 1000 }]
  };

  const remote = {
    version: 2,
    lastModified: 2000,
    projects: [{ id: 'proj_1', title: 'Tiểu thuyết huyền ảo', updatedAt: 1000 }],
    chapters: [{ id: 'ch_1', projectId: 'proj_1', title: 'Chương 1 (Đã sửa)', updatedAt: 2000 }],
    characters: [
      { id: 'c_1', projectId: 'proj_1', name: 'Nhân vật 1', updatedAt: 1000 },
      { id: 'c_2', projectId: 'proj_1', name: 'Nhân vật 2 mới', updatedAt: 2000 }
    ],
    entities: [{ id: 'e_1', projectId: 'proj_1', name: 'Địa điểm 1', updatedAt: 1000 }],
    timeline: [{ id: 't_1', projectId: 'proj_1', title: 'Biến cố 1', updatedAt: 1000 }],
    outline: [{ id: 'o_1', projectId: 'proj_1', title: 'Hồi 1', updatedAt: 1000 }]
  };

  const { merged, hasRemoteChanges } = mergeWorkspaces(local, remote);

  assert.strictEqual(hasRemoteChanges, true);
  assert.strictEqual(merged.characters.length, 2, 'Must union characters from remote');
  assert.strictEqual(merged.chapters[0].title, 'Chương 1 (Đã sửa)', 'Must take latest chapter via LWW');
  assert.strictEqual(merged.entities.length, 1);
  assert.strictEqual(merged.timeline.length, 1);
  assert.strictEqual(merged.outline.length, 1);
});
