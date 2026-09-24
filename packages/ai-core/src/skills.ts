// Built-in AI Skills - Prompt Templates cho nhà văn
export interface SkillContext {
  projectTitle?: string;
  projectDescription?: string;
  genre?: string;
  currentChapterContent?: string;
  previousChaptersSummary?: string;
  characters?: { name: string; description: string; role?: string }[];
  selectedText?: string;
  userInstruction?: string;
  tone?: string;
  language?: string; // vi, en
}

export interface AISkill {
  id: string;
  name: string;
  nameVi: string;
  category: 'brainstorm' | 'rewrite' | 'expand' | 'critique' | 'generate' | 'analysis';
  description: string;
  descriptionVi: string;
  icon: string;
  prompt: (ctx: SkillContext) => string;
  systemPrompt: string;
}

export const AI_SKILLS: AISkill[] = [
  {
    id: 'continue_writing',
    name: 'Continue Writing',
    nameVi: 'Viết tiếp',
    category: 'generate',
    description: 'Continue the story from where it left off',
    descriptionVi: 'Viết tiếp câu chuyện từ đoạn hiện tại',
    icon: '✍️',
    systemPrompt: `Bạn là một tiểu thuyết gia chuyên nghiệp, bậc thầy về storytelling. Nhiệm vụ của bạn là viết tiếp câu chuyện một cách tự nhiên, giữ đúng giọng văn, nhịp độ và phong cách của tác giả.
- Giữ nhất quán với nhân vật, bối cảnh, giọng văn đã có
- Không lặp lại nội dung đã viết
- Viết với ngôn ngữ giàu hình ảnh, show don't tell
- Độ dài vừa phải, kết thúc ở điểm tự nhiên để tác giả có thể tiếp tục`,
    prompt: (ctx) => `
Dự án: ${ctx.projectTitle || 'Chưa có tên'} - Thể loại: ${ctx.genre || 'Chưa xác định'}
Mô tả: ${ctx.projectDescription || 'Không có'}

${ctx.characters && ctx.characters.length > 0 ? `Nhân vật:\n${ctx.characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n')}` : ''}

${ctx.previousChaptersSummary ? `Tóm tắt các chương trước:\n${ctx.previousChaptersSummary}` : ''}

Nội dung hiện tại của chương:
"""
${ctx.currentChapterContent || ctx.selectedText || ''}
"""

${ctx.userInstruction ? `Yêu cầu thêm từ tác giả: ${ctx.userInstruction}` : ''}
${ctx.tone ? `Giọng văn mong muốn: ${ctx.tone}` : ''}

Hãy viết tiếp từ đoạn trên. Viết khoảng 300-500 từ, tự nhiên, hấp dẫn. Ngôn ngữ: ${ctx.language || 'Tiếng Việt'}.
`
  },
  {
    id: 'rewrite',
    name: 'Rewrite',
    nameVi: 'Viết lại',
    category: 'rewrite',
    description: 'Rewrite selected text with different style',
    descriptionVi: 'Viết lại đoạn văn với phong cách khác',
    icon: '🔄',
    systemPrompt: `Bạn là biên tập viên văn học chuyên nghiệp. Nhiệm vụ của bạn là viết lại đoạn văn được chọn sao cho hay hơn, mượt hơn, nhưng vẫn giữ nguyên ý chính.
- Cải thiện câu chữ, nhịp điệu
- Áp dụng nguyên tắc "show, don't tell"
- Thêm chi tiết giác quan nếu phù hợp
- Giữ giọng văn của tác giả nếu không có yêu cầu đổi`,
    prompt: (ctx) => `
Đoạn văn cần viết lại:
"""
${ctx.selectedText || ctx.currentChapterContent || ''}
"""

${ctx.userInstruction ? `Yêu cầu viết lại: ${ctx.userInstruction}` : 'Hãy viết lại cho hay hơn, mượt mà hơn, giàu hình ảnh hơn.'}
${ctx.tone ? `Phong cách mong muốn: ${ctx.tone}` : ''}

Chỉ trả về đoạn văn đã viết lại, không giải thích thêm. Ngôn ngữ: ${ctx.language || 'Tiếng Việt'}.
`
  },
  {
    id: 'critique',
    name: 'Critique',
    nameVi: 'Phê bình & Góp ý',
    category: 'critique',
    description: 'Get detailed critique on pacing, structure, characters',
    descriptionVi: 'Nhận xét chi tiết về nhịp độ, cấu trúc, nhân vật',
    icon: '🔍',
    systemPrompt: `Bạn là một nhà phê bình văn học và biên tập viên dày dạn kinh nghiệm, từng làm việc với nhiều tác giả bestseller.
Bạn đưa ra nhận xét thẳng thắn, xây dựng, cụ thể, có ví dụ minh họa.
Cấu trúc phản hồi:
1. Điểm mạnh
2. Điểm cần cải thiện (nhịp độ, nhân vật, hội thoại, mô tả, cấu trúc)
3. Gợi ý cụ thể để sửa
4. Điểm số tổng quan (1-10) cho từng khía cạnh
Luôn khuyến khích tác giả.`,
    prompt: (ctx) => `
Hãy phê bình đoạn/chương sau:

Tiêu đề: ${ctx.projectTitle || ''}
Thể loại: ${ctx.genre || ''}

Nội dung:
"""
${ctx.selectedText || ctx.currentChapterContent || ''}
"""

${ctx.characters ? `Nhân vật liên quan: ${ctx.characters.map(c => c.name).join(', ')}` : ''}

Hãy đưa ra phê bình chi tiết, xây dựng. Phân tích:
- Nhịp độ (pacing)
- Phát triển nhân vật
- Hội thoại (nếu có)
- Mô tả & hình ảnh
- Cấu trúc & logic
- Giọng văn

Ngôn ngữ phản hồi: ${ctx.language || 'Tiếng Việt'}.
`
  },
  {
    id: 'expand',
    name: 'Expand',
    nameVi: 'Mở rộng',
    category: 'expand',
    description: 'Expand a brief passage into richer scene',
    descriptionVi: 'Mở rộng đoạn văn ngắn thành cảnh chi tiết',
    icon: '🌿',
    systemPrompt: `Bạn là tiểu thuyết gia chuyên về mô tả giàu chi tiết giác quan. Bạn mở rộng đoạn văn ngắn thành cảnh đầy đặn hơn bằng cách thêm:
- Chi tiết giác quan (nhìn, nghe, ngửi, chạm, nếm)
- Nội tâm nhân vật
- Hành động nhỏ, cử chỉ
- Bối cảnh xung quanh
Không thêm tình tiết mới làm lệch hướng câu chuyện gốc.`,
    prompt: (ctx) => `
Đoạn gốc cần mở rộng:
"""
${ctx.selectedText || ''}
"""

Bối cảnh:
Dự án: ${ctx.projectTitle}, thể loại: ${ctx.genre}
${ctx.currentChapterContent ? `Nội dung xung quanh:\n${ctx.currentChapterContent.slice(0, 1000)}` : ''}

Hãy mở rộng đoạn trên gấp 2-3 lần, thêm chi tiết giác quan, nội tâm, hành động. Giữ nguyên ý chính.
Ngôn ngữ: ${ctx.language || 'Tiếng Việt'}.
`
  },
  {
    id: 'character_voice',
    name: 'Character Voice',
    nameVi: 'Giọng điệu nhân vật',
    category: 'generate',
    description: 'Improve dialogue to match character personality',
    descriptionVi: 'Cải thiện hội thoại theo tính cách nhân vật',
    icon: '🎭',
    systemPrompt: `Bạn là chuyên gia về xây dựng nhân vật và hội thoại. Bạn giúp tác giả tạo ra giọng nói riêng biệt cho từng nhân vật, dựa trên tính cách, xuất thân, tuổi tác, nghề nghiệp.
Mỗi nhân vật phải có cách nói chuyện khác nhau: từ vựng, nhịp điệu, câu cửa miệng, mức độ trang trọng.`,
    prompt: (ctx) => `
Nhân vật:
${ctx.characters?.map(c => `- ${c.name}: ${c.description}`).join('\n') || 'Không có thông tin nhân vật'}

Đoạn hội thoại cần cải thiện:
"""
${ctx.selectedText || ''}
"""

${ctx.userInstruction || ''}

Hãy viết lại hội thoại sao cho mỗi nhân vật có giọng nói riêng biệt, tự nhiên, thể hiện tính cách. Ngôn ngữ: ${ctx.language || 'Tiếng Việt'}.
`
  },
  {
    id: 'plot_hole',
    name: 'Plot Hole Detection',
    nameVi: 'Phát hiện lỗ hổng cốt truyện',
    category: 'analysis',
    description: 'Detect plot holes and inconsistencies',
    descriptionVi: 'Phát hiện mâu thuẫn và lỗ hổng trong cốt truyện',
    icon: '🕳️',
    systemPrompt: `Bạn là chuyên gia phân tích cốt truyện, chuyên phát hiện plot hole, mâu thuẫn logic, timeline inconsistency.
Bạn liệt kê rõ ràng từng vấn đề, mức độ nghiêm trọng, và gợi ý cách khắc phục.`,
    prompt: (ctx) => `
Phân tích cốt truyện sau để tìm lỗ hổng:

Dự án: ${ctx.projectTitle}
Mô tả: ${ctx.projectDescription}
Thể loại: ${ctx.genre}

Tóm tắt các chương trước:
${ctx.previousChaptersSummary || 'Không có'}

Nội dung chương hiện tại:
"""
${ctx.currentChapterContent || ''}
"""

Nhân vật:
${ctx.characters?.map(c => `- ${c.name}: ${c.description}`).join('\n') || 'Không có'}

Hãy liệt kê các mâu thuẫn, lỗ hổng logic, vấn đề timeline nếu có. Ngôn ngữ: ${ctx.language || 'Tiếng Việt'}.
`
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm Ideas',
    nameVi: 'Gợi ý ý tưởng',
    category: 'brainstorm',
    description: 'Generate ideas for next scenes, twists, conflicts',
    descriptionVi: 'Gợi ý ý tưởng cho cảnh tiếp theo, plot twist, xung đột',
    icon: '💡',
    systemPrompt: `Bạn là partner brainstorming sáng tạo, luôn đưa ra 3-5 ý tưởng đa dạng, bất ngờ nhưng hợp lý cho câu chuyện.
Mỗi ý tưởng có: Tiêu đề, mô tả ngắn, tại sao nó thú vị, rủi ro/cơ hội.`,
    prompt: (ctx) => `
Cần brainstorm ý tưởng cho:

Dự án: ${ctx.projectTitle} - ${ctx.genre}
Mô tả: ${ctx.projectDescription}

Ngữ cảnh hiện tại:
"""
${ctx.currentChapterContent || ''}
"""

${ctx.userInstruction ? `Tác giả muốn: ${ctx.userInstruction}` : 'Gợi ý các hướng phát triển tiếp theo, plot twist, xung đột mới.'}

Hãy đưa ra 5 ý tưởng đa dạng, sáng tạo, kèm ưu/nhược điểm. Ngôn ngữ: ${ctx.language || 'Tiếng Việt'}.
`
  },
  {
    id: 'description_enhance',
    name: 'Sensory Details',
    nameVi: 'Chi tiết giác quan',
    category: 'rewrite',
    description: 'Add sensory details to make scene vivid',
    descriptionVi: 'Thêm chi tiết giác quan để cảnh sống động',
    icon: '👁️',
    systemPrompt: `Bạn là bậc thầy về mô tả giác quan. Bạn biến những đoạn văn khô khan thành cảnh sống động bằng 5 giác quan, nhưng không sa đà, vẫn giữ nhịp truyện.`,
    prompt: (ctx) => `
Đoạn cần thêm chi tiết giác quan:
"""
${ctx.selectedText || ''}
"""

Bối cảnh: ${ctx.projectTitle}, ${ctx.genre}

Hãy viết lại với nhiều chi tiết nhìn, nghe, ngửi, chạm, cảm giác không gian. Ngôn ngữ: ${ctx.language || 'Tiếng Việt'}.
`
  }
];

export function getSkillById(id: string): AISkill | undefined {
  return AI_SKILLS.find(s => s.id === id);
}

export function getSkillsByCategory(category: AISkill['category']): AISkill[] {
  return AI_SKILLS.filter(s => s.category === category);
}
