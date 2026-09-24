# Phase 2 - Outline & Timeline ✅ Hoàn Thành

## Tổng Quan

Đã triển khai đầy đủ module **Outline & Timeline** theo yêu cầu với 4 view cho Outline và vertical timeline với filter/zoom/AI check.

---

## 1. Backend API (Cloudflare Workers)

### 1.1 Outline Routes (`/api/projects/:projectId/outline`)

**File:** `apps/api/src/routes/outline.ts`

**Endpoints:**
- `GET /api/projects/:projectId/outline` - Lấy outline dạng tree + flat + progress
  - Build tree từ flat list (parentId)
  - Tính progress: % nodes có status written/revised
  - Trả về templates list

- `POST /api/projects/:projectId/outline` - Tạo node mới
  - Body: title, description, type (act/chapter/scene/beat), parentId, status, color, linkedChapterId

- `POST /api/projects/:projectId/outline/template` - Áp dụng template
  - 4 templates có sẵn (xem dưới)
  - Tạo nodes đệ quy với orderIndex

- `PATCH /api/outline/:id` - Update node
- `DELETE /api/outline/:id` - Xóa node + children đệ quy
- `POST /api/projects/:projectId/outline/reorder` - Reorder drag & drop
- `POST /api/projects/:projectId/outline/generate` - **AI Generate Outline**
  - Dùng BYOK AI provider
  - Prompt: tạo JSON acts/chapters/scenes
  - Parse JSON và lưu vào DB
- `GET /api/projects/:projectId/outline/export?format=json|opml` - Export

**Templates:**
```typescript
OUTLINE_TEMPLATES = {
  'three-act': {
    name: '3-Act Structure',
    nodes: [
      { type: 'act', title: 'HỒI I: MỞ ĐẦU (25%)', color: '#3b82f6', children: [...] },
      { type: 'act', title: 'HỒI II: ĐỐI ĐẦU (50%)', color: '#eab308', children: [...] },
      { type: 'act', title: 'HỒI III: KẾT THÚC (25%)', color: '#22c55e', children: [...] }
    ]
  },
  'hero-journey': 12 bước Joseph Campbell
  'save-the-cat': 15 beats Blake Snyder
  'snowflake': 10 bước Randy Ingermanson
}
```

**AI Generate Prompt:**
```
System: Bạn là chuyên gia cấu trúc truyện...
User: Premise: ... Thể loại: ... Số chương: ...
Output: JSON { acts: [{title, description, color, chapters: [{title, description, type}]}] }
```

### 1.2 Timeline Routes (`/api/projects/:projectId/timeline`)

**File:** `apps/api/src/routes/timeline.ts`

**Endpoints:**
- `GET /api/projects/:projectId/timeline?era=&importance=&characterId=&locationId=`
  - Filter in-memory (D1 simple)
  - Group by era, tính stats (total, major, minor, eras)

- `POST /api/projects/:projectId/timeline` - Tạo event
  - Body: title, description, dateInStory, dateRealWorld, era, importance, involvedCharacterIds, locationId, chapterId, orderIndex

- `PATCH /api/timeline/:id` - Update event
- `DELETE /api/timeline/:id`
- `POST /api/projects/:projectId/timeline/reorder` - Reorder
- `POST /api/projects/:projectId/timeline/check` - **AI Check Consistency**
  - Prompt kiểm tra time paradox, character age, causality, era mismatch
  - Trả về JSON: { issues: [{type, severity, eventIds, description, suggestion}], summary }
- `GET /api/projects/:projectId/timeline/eras` - List unique eras

**AI Check Prompt:**
```
System: Bạn là chuyên gia kiểm tra timeline...
User: Dự án: ... Nhân vật: ... Events: 1. ... 2. ...
Output: JSON { issues: [...], summary: "..." }
```

---

## 2. Frontend Components

### 2.1 Outline Components

**`components/outline/outline-node.tsx`:**
- Tree node với:
  - Icon theo type: act 🎬, chapter 📖, scene 🎞️, beat 💡
  - Màu border-left theo node.color
  - Expand/collapse children
  - Inline edit (title, description)
  - Status selector: idea/planned/written/revised (màu: gray/blue/yellow/green)
  - Actions: edit, add child, delete
  - Drag handle (GripVertical)
  - Linked chapter indicator

**`components/outline/kanban-view.tsx`:**
- 4 columns: Ý tưởng, Đã lên kế hoạch, Đã viết, Đã sửa
- Drag & drop: HTML5 drag API
- Card: title, description, type badge, color border
- Drop zone highlight
- Add card per column

**`components/outline/corkboard-view.tsx`:**
- Corkboard texture: background radial + noise SVG
- Cards với:
  - Random rotation (-3 to 3 deg) dựa trên hash id
  - Pin đỏ ở top
  - Tape effect ở góc
  - Yellow paper style
  - Hover scale + shadow
  - Handwriting font (Crimson Pro)

### 2.2 Timeline Components

**`components/timeline/timeline-event.tsx`:**
- Vertical timeline:
  - Dot: red nếu major + flag icon, gray nếu minor
  - Vertical line connecting dots
  - Card border-left: red nếu major, muted nếu minor
  - Badge importance, era
  - Meta: dateInStory, location, characters count, chapter link
  - Hover actions: edit, delete
  - isFirst/isLast để ẩn line

### 2.3 Pages

**`app/(dashboard)/outline/[projectId]/page.tsx`:**

**Features:**
- Header: progress bar, view switcher (Tree/Kanban/Corkboard/Timeline), Template, AI Generate, Add
- 4 View modes:

1. **Tree View:**
   - Recursive OutlineNode
   - Max-width 4xl, centered
   - Add child button sets parentId

2. **Kanban View:**
   - KanbanView component
   - 4 columns, drag to change status

3. **Corkboard View:**
   - CorkboardView component
   - Grid auto-rows-min, gap 6

4. **Timeline (Horizontal) View:**
   - Horizontal scroll cards
   - OrderIndex order
   - Progress bar bottom

- Empty state: icon 🗺️, CTA Template/AI/Manual
- Footer actions: Export JSON/OPML, Clear all
- Dialogs:
  - New Node: title, description, type, status, color picker
  - Template: 4 cards với icon, nameVi, desc, Apply button
  - AI Generate: premise textarea, genre, numChapters, templateId, requirements note

**State:**
- outline (tree), flat (array), progress, loading, viewMode
- showNewDialog, showTemplateDialog, showAIDialog
- newNode, aiForm, aiLoading

**API calls:**
- fetchOutline, createNode, updateNode, deleteNode, applyTemplate, generateWithAI, exportOutline, clearAll

---

**`app/(dashboard)/timeline/[projectId]/page.tsx`:**

**Features:**
- Header: stats (total/major/eras), zoom switcher (All/Era), AI Check, Add Event
- Layout: sidebar filters + main timeline

**Sidebar:**
- Search input
- Filter Era: All + list eras
- Filter Importance: All/Major/Minor
- AI Check Result card: summary + issues list with severity colors
- Tips

**Main:**
- Vertical timeline:
  - If zoom=all: single list sorted by orderIndex
  - If zoom=era: grouped by era, sticky era header
- TimelineEvent per event
- Empty state: ⏳ icon, CTA

**Dialog New/Edit:**
- title, description
- dateInStory, dateRealWorld (grid 2 cols)
- era (with datalist from existing eras), importance select
- involvedCharacterIds: checkbox list from characters API
- locationId, chapterId (future)

**AI Check:**
- Button triggers POST /timeline/check
- Shows issues: type, severity, description, suggestion
- Green "✅ Không phát hiện mâu thuẫn!" if no issues

**State:**
- events, eras, stats, loading, filterEra, filterImportance, search, zoom
- showNewDialog, editingEvent, form, aiCheck, aiLoading, characters

---

## 3. Tích Hợp

**Updated:**
- `apps/api/src/index.ts`: Mount outline + timeline routes
- `app/(dashboard)/editor/[projectId]/page.tsx`: Thêm buttons Outline (blue) + Timeline (purple) vào header
- `components/layout/dashboard-layout.tsx`: Import icons (không thêm nav items vì outline/timeline là per-project, không phải global)

**Navigation Flow:**
```
Projects -> Editor [projectId] -> Outline [projectId]
                          \-> Timeline [projectId]
                          \-> Characters [projectId]
                          \-> Worldbuilding [projectId]
```

---

## 4. Demo Scenarios

### Scenario 1: Dùng Template
1. Vào Project -> Outline
2. Click "📚 Templates"
3. Chọn "3-Act Structure" -> Apply
4. Thấy 3 Acts với 3+4+3 chapters = 10 nodes
5. Chuyển sang Kanban view: thấy 10 cards ở cột Ý tưởng
6. Drag 1 card sang "Đã lên kế hoạch"

### Scenario 2: AI Generate
1. Trong Outline, click "✨ AI Generate"
2. Nhập premise: "Một cô gái phát hiện mình là phù thủy cuối cùng..."
3. Chọn genre fantasy, 12 chapters, template three-act
4. Click Tạo (cần Groq key free)
5. AI tạo JSON và lưu, thấy 3 acts + 12 chapters

### Scenario 3: Timeline
1. Vào Timeline
2. Tạo sự kiện: "Lời tiên tri xuất hiện" - Era: Kỷ nguyên Ánh Sáng - Importance: Major - Date: Năm 1000
3. Tạo thêm 3-4 events khác era
4. Filter theo era
5. Click "AI Check" -> AI kiểm tra mâu thuẫn thời gian
6. Chuyển zoom "Theo kỷ nguyên" -> grouped view

---

## 5. Kỹ Thuật

**Drag & Drop:**
- Outline tree: chưa implement dnd-kit, dùng orderIndex manual + future
- Kanban: HTML5 drag API (draggable, onDragStart, onDrop)
- Timeline: chưa drag, dùng orderIndex + reorder API (future dnd-kit)

**Performance:**
- Outline tree build: O(n^2) worst nhưng n < 100 nên ok
- Timeline filter: in-memory, O(n)
- D1 queries: simple, no JOIN, fast

**AI:**
- Outline generate: temperature 0.8, maxTokens 4000, JSON mode
- Timeline check: temperature 0.3, maxTokens 3000, JSON mode
- Error handling: try parse JSON, fallback regex extract {.*}

**UI/UX:**
- Tailwind + shadcn
- Framer Motion chưa dùng trong Phase 2, nhưng đã cài sẵn cho Phase 3 animations
- Responsive: sidebar hidden on mobile, grid cols adapt
- Dark mode: corkboard dark bg #2a2520, cards yellow-900/20

---

## 6. Chưa Làm (Phase 3)

- [ ] Outline drag & drop thực sự với dnd-kit sortable
- [ ] Outline linkedChapter: click để mở chapter editor
- [ ] Outline progress per act
- [ ] Timeline drag reorder với dnd-kit
- [ ] Timeline zoom scale: hour/day/month/year/century (hiện chỉ all/era)
- [ ] Timeline multiple timelines: main, character-specific, world
- [ ] Timeline map view: pin events lên bản đồ
- [ ] Export outline to PDF (hiện JSON/OPML)
- [ ] Outline search/filter
- [ ] Timeline calendar view

---

## 7. Cách Test

```bash
# API
curl http://localhost:8787/api/projects/:id/outline
curl -X POST http://localhost:8787/api/projects/:id/outline/template -d '{"templateId":"three-act"}'

# Frontend
# Vào /outline/:projectId
# Test 4 views
# Test AI generate (cần API key trong Settings)
# Vào /timeline/:projectId
# Test create event, filter, AI check
```

---

## Kết Luận

Phase 2 đã hoàn thành **Outline & Timeline** với:

- ✅ Backend đầy đủ 8 endpoints outline + 6 endpoints timeline
- ✅ 4 templates outline + AI generate
- ✅ AI check timeline consistency
- ✅ Frontend 4 views: Tree, Kanban, Corkboard, Horizontal Timeline
- ✅ Vertical timeline với filter, zoom, search, grouping
- ✅ Tích hợp vào editor navigation
- ✅ Export JSON/OPML
- ✅ Code chạy được, TypeScript strict, không any

Sẵn sàng cho Phase 3: Export PDF/DOCX/EPUB hoặc Stats Dashboard!
