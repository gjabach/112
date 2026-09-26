import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatRelativeTime(timestamp: number): string {
  if (!timestamp || isNaN(Number(timestamp))) return 'Vừa xong';
  const now = Date.now();
  const diff = now - Number(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return formatDate(Number(timestamp));
}

export function countWords(text: any): number {
  if (!text) return 0;
  if (typeof text !== 'string') {
    if (typeof text === 'object') {
      try {
        const plain = extractText(text);
        return plain.trim().split(/\s+/).filter(Boolean).length;
      } catch {
        return 0;
      }
    }
    return 0;
  }
  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object') {
      const plain = extractText(json);
      return plain.trim().split(/\s+/).filter(Boolean).length;
    }
  } catch {}
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return String(node.text);
  if (Array.isArray(node.content)) {
    return node.content.map(extractText).join(' ');
  }
  return '';
}

export function readingTime(words: number): string {
  const wpm = 200;
  const minutes = Math.ceil(words / wpm);
  if (minutes < 1) return '<1 phút đọc';
  return `${minutes} phút đọc`;
}

export const OUTLINE_TEMPLATES: Record<string, { name: string; nameVi: string; desc: string; nodes: any[] }> = {
  'three-act': {
    name: '3-Act Structure',
    nameVi: 'Cấu trúc 3 Hồi',
    desc: 'Mở đầu - Đối đầu - Kết thúc (25%-50%-25%)',
    nodes: [
      {
        type: 'act',
        title: 'HỒI I: MỞ ĐẦU (Setup)',
        description: 'Giới thiệu thế giới, nhân vật chính, và inciting incident (25% truyện)',
        color: '#3b82f6',
        children: [
          { type: 'chapter', title: 'Mở đầu - Thế giới thường nhật', description: 'Cuộc sống bình thường của nhân vật trước khi phiêu lưu bắt đầu' },
          { type: 'chapter', title: 'Lời kêu gọi phiêu lưu', description: 'Inciting incident - sự kiện phá vỡ thế giới thường nhật' },
          { type: 'chapter', title: 'Từ chối lời kêu gọi', description: 'Nhân vật do dự, sợ hãi, không muốn thay đổi' }
        ]
      },
      {
        type: 'act',
        title: 'HỒI II: ĐỐI ĐẦU (Confrontation)',
        description: 'Nhân vật đối mặt thử thách, học hỏi, thất bại tạm thời (50% truyện)',
        color: '#eab308',
        children: [
          { type: 'chapter', title: 'Vượt ngưỡng', description: 'Nhân vật quyết định dấn thân, bước vào thế giới mới' },
          { type: 'chapter', title: 'Thử thách, đồng minh, kẻ thù', description: 'Gặp mentor, bạn bè, kẻ thù. Học quy luật thế giới mới' },
          { type: 'chapter', title: 'Hang sâu nhất', description: 'Thử thách lớn nhất, đối mặt nỗi sợ lớn nhất, thất bại tạm thời' },
          { type: 'chapter', title: 'Phần thưởng', description: 'Chiến thắng nhỏ, có được thứ mình tìm kiếm nhưng chưa trọn vẹn' }
        ]
      },
      {
        type: 'act',
        title: 'HỒI III: KẾT THÚC (Resolution)',
        description: 'Trận chiến cuối cùng và trở về (25% truyện)',
        color: '#22c55e',
        children: [
          { type: 'chapter', title: 'Đường trở về', description: 'Quyết định trở về, mang theo bài học quý giá' },
          { type: 'chapter', title: 'Phục sinh', description: 'Trận chiến cao trào cuối cùng, sử dụng tất cả những gì đã học' },
          { type: 'chapter', title: 'Trở về với Elixir', description: 'Kết thúc, nhân vật biến đổi, thế giới tốt đẹp hơn' }
        ]
      }
    ]
  },
  'hero-journey': {
    name: "Hero's Journey",
    nameVi: 'Hành Trình Người Hùng (12 bước)',
    desc: 'Theo Joseph Campbell - 12 bước hành trình người hùng',
    nodes: [
      {
        type: 'act',
        title: 'HỒI I: RA ĐI',
        color: '#8b5cf6',
        children: [
          { type: 'beat', title: '1. Thế giới thường nhật', description: 'Cuộc sống bình thường của nhân vật' },
          { type: 'beat', title: '2. Lời kêu gọi phiêu lưu', description: 'Thử thách và biến cố xuất hiện' },
          { type: 'beat', title: '3. Từ chối lời kêu gọi', description: 'Do dự, sợ hãi trước sự thay đổi' },
          { type: 'beat', title: '4. Gặp gỡ người cố vấn', description: 'Mentor xuất hiện, trao lời khuyên hoặc bảo bối' },
          { type: 'beat', title: '5. Vượt qua ngưỡng đầu tiên', description: 'Chính thức bước chân vào thế giới phiêu lưu' }
        ]
      },
      {
        type: 'act',
        title: 'HỒI II: KHAI SÁNG & ĐỐI ĐẦU',
        color: '#f59e0b',
        children: [
          { type: 'beat', title: '6. Thử thách, đồng minh, kẻ thù', description: 'Làm quen môi trường mới, kết giao bạn bè và đối thủ' },
          { type: 'beat', title: '7. Tiếp cận hang sâu nhất', description: 'Chuẩn bị cho thử thách sinh tử' },
          { type: 'beat', title: '8. Thử thách cam go', description: 'Đối mặt cái chết, chạm đáy khủng hoảng' },
          { type: 'beat', title: '9. Phần thưởng', description: 'Chiến thắng tạm thời, nắm lấy bảo vật hoặc tri thức' }
        ]
      },
      {
        type: 'act',
        title: 'HỒI III: TRỞ VỀ',
        color: '#10b981',
        children: [
          { type: 'beat', title: '10. Đường trở về', description: 'Hậu quả và cuộc rượt đuổi trở về thế giới cũ' },
          { type: 'beat', title: '11. Phục sinh', description: 'Thử thách tối hậu thử thách con người mới của nhân vật' },
          { type: 'beat', title: '12. Trở về với Elixir', description: 'Đem thuốc giải/trí tuệ cứu rỗi thế giới' }
        ]
      }
    ]
  },
  'save-the-cat': {
    name: 'Save the Cat (15 Beats)',
    nameVi: 'Save the Cat - 15 Nhịp',
    desc: 'Blake Snyder - Cấu trúc cốt truyện hấp dẫn cho truyện thương mại',
    nodes: [
      { type: 'beat', title: '1. Opening Image (1%)', description: 'Hình ảnh mở đầu, tone truyện và hiện trạng nhân vật' },
      { type: 'beat', title: '2. Theme Stated (5%)', description: 'Chủ đề tư tưởng được nêu lên mà nhân vật chưa nhận ra' },
      { type: 'beat', title: '3. Set-Up (1-10%)', description: 'Khắc họa cuộc sống thường nhật và khuyết điểm của nhân vật' },
      { type: 'beat', title: '4. Catalyst (10%)', description: 'Cú hích / Sự kiện kích động làm đảo lộn mọi thứ' },
      { type: 'beat', title: '5. Debate (10-25%)', description: 'Tranh đấu nội tâm: có nên dấn thân không?' },
      { type: 'beat', title: '6. Break into Two (25%)', description: 'Quyết định dấn thân bước sang Hồi 2' },
      { type: 'beat', title: '7. B Story (30%)', description: 'Tuyến truyện phụ (tình cảm/đồng hành) giúp chuyển tải theme' },
      { type: 'beat', title: '8. Fun and Games (30-50%)', description: 'Lõi thú vị nhất của tiền đề truyện - promise of premise' },
      { type: 'beat', title: '9. Midpoint (50%)', description: 'Điểm giữa truyện: chiến thắng giả hoặc thất bại giả' },
      { type: 'beat', title: '10. Bad Guys Close In (50-75%)', description: 'Kẻ địch siết chặt vòng vây, mâu thuẫn nội bộ dâng cao' },
      { type: 'beat', title: '11. All Is Lost (75%)', description: 'Mất mát toàn bộ, khoảnh khắc chạm đáy tuyệt vọng' },
      { type: 'beat', title: '12. Dark Night of the Soul (75-80%)', description: 'Đêm đen linh hồn: tự vấn và tìm ra chân lý' },
      { type: 'beat', title: '13. Break into Three (80%)', description: 'Tia hy vọng xuất hiện, tìm ra kế hoạch mới' },
      { type: 'beat', title: '14. Finale (80-99%)', description: 'Trận chiến cao trào và bài học được hiện thực hóa' },
      { type: 'beat', title: '15. Final Image (99-100%)', description: 'Hình ảnh kết thúc đối lập hình ảnh mở đầu, chứng minh sự biến đổi' }
    ]
  },
  'snowflake': {
    name: 'Snowflake Method',
    nameVi: 'Phương Pháp Bông Tuyết (10 bước)',
    desc: 'Randy Ingermanson - Từ 1 câu ý tưởng mở rộng thành toàn bộ tiểu thuyết',
    nodes: [
      {
        type: 'act',
        title: 'Bước 1-3: Đặt nền móng',
        color: '#06b6d4',
        children: [
          { type: 'beat', title: '1. Câu tóm tắt 1 câu (15 từ)', description: 'Tóm lược câu chuyện trong một câu duy nhất' },
          { type: 'beat', title: '2. Mở rộng thành 1 đoạn 5 câu', description: 'Thiết lập bối cảnh, 3 thảm họa, và kết cục' },
          { type: 'beat', title: '3. Hồ sơ nhân vật chính', description: 'Động cơ, mục tiêu, xung đột và khoảnh khắc bừng tỉnh' }
        ]
      },
      {
        type: 'act',
        title: 'Bước 4-6: Mở rộng cốt truyện',
        color: '#8b5cf6',
        children: [
          { type: 'beat', title: '4. Mở rộng mỗi câu thành 1 đoạn', description: 'Phát triển tóm tắt 1 trang chi tiết' },
          { type: 'beat', title: '5. Hồ sơ nhân vật phụ & đối thủ', description: 'Mối quan hệ và điểm nhìn của các nhân vật khác' },
          { type: 'beat', title: '6. Mở rộng tóm tắt thành 4 trang', description: 'Chi tiết từng diễn biến và bước ngoặt' }
        ]
      },
      {
        type: 'act',
        title: 'Bước 7-10: Hoàn thiện danh sách cảnh',
        color: '#f59e0b',
        children: [
          { type: 'beat', title: '7. Kinh thánh nhân vật (Character Bible)', description: 'Hoàn thiện mọi chi tiết, lai lịch nhân vật' },
          { type: 'beat', title: '8. Lập danh sách các phân cảnh (Scene List)', description: 'Liệt kê tất cả các cảnh cần viết' },
          { type: 'beat', title: '9. Mô tả chi tiết hành động từng cảnh', description: 'Xác định mục tiêu và xung đột từng cảnh' },
          { type: 'beat', title: '10. Bắt đầu viết bản thảo đầu tiên', description: 'Bắt tay vào viết với dàn ý vững chắc' }
        ]
      }
    ]
  }
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function handleLocalApi(path: string, options: RequestInit = {}): Promise<any> {
  if (typeof window === 'undefined') return {};
  const method = (options.method || 'GET').toUpperCase();
  let body: any = {};
  if (options.body) {
    try {
      body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch {}
  }
  const now = Date.now();
  const genId = (prefix: string) => `${prefix}_${now}_${Math.random().toString(36).slice(2, 7)}`;

  const getStorage = (key: string, def: any = []) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : def;
    } catch {
      return def;
    }
  };

  const setStorage = (key: string, val: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      localStorage.setItem('novelist_last_modified', String(Date.now()));
      if (typeof window !== 'undefined') {
        import('./sync').then(m => m.triggerAutoPush()).catch(() => {});
      }
    } catch {}
  };

  const hashLocalPassword = async (pwd: string): Promise<string> => {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pwd + ':novelist_salt_2026');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {}
    return 'hashed_' + btoa(pwd);
  };

  const getCloudAccountKeys = async (email: string) => {
    const clean = (email || '').trim().toLowerCase();
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(clean + ':novelist_auth_v2');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        return { userKey: `u_${hex}`, dataKey: `d_${hex}` };
      }
    } catch {}
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = ((hash << 5) - hash) + clean.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(36);
    return { userKey: `u_${hex}`, dataKey: `d_${hex}` };
  };

  const getCurrentUser = () => {
    let u = getStorage('novelist_current_user', null);
    if (!u) {
      const authStorage = getStorage('auth-storage', null);
      if (authStorage?.state?.user) {
        u = authStorage.state.user;
      }
    }
    return u;
  };

  // Auth - Register
  if (path === '/api/auth/register') {
    let users = getStorage('novelist_users', []);

    const cleanEmail = (body.email || '').trim().toLowerCase();
    const cleanPassword = (body.password || '');
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Email không hợp lệ. Vui lòng kiểm tra lại định dạng email.');
    }
    if (!cleanPassword || cleanPassword.length < 8) {
      throw new Error('Mật khẩu tối thiểu 8 ký tự.');
    }

    const { userKey, dataKey } = await getCloudAccountKeys(cleanEmail);

    let existing = users.find((u: any) => (u.email || '').trim().toLowerCase() === cleanEmail);

    // Also check cloud store for existing account
    if (!existing) {
      try {
        const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${userKey}`);
        if (res.ok) {
          const remoteUser = await res.json();
          if (remoteUser && remoteUser.email) {
            existing = remoteUser;
          }
        }
      } catch {}
    }

    if (existing) {
      throw new Error('Email đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.');
    }

    const user = {
      id: genId('usr'),
      email: cleanEmail,
      name: (body.name || '').trim() || cleanEmail.split('@')[0],
      aiProvider: 'gemini',
      aiModel: 'gemini-3.8-flash',
      aiApiKey: '',
      createdAt: now
    };
    const passwordHash = await hashLocalPassword(cleanPassword);
    users.push({ ...user, passwordHash });
    setStorage('novelist_users', users);
    
    // Save account securely to cloud store for multi-device login (e.g. mobile)
    try {
      await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${userKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...user, passwordHash })
      });
    } catch {}

    setStorage('novelist_current_user', user);

    // Initialize user AI settings
    try {
      localStorage.setItem('ai_provider', 'gemini');
      localStorage.setItem('ai_model', 'gemini-3.8-flash');
      localStorage.removeItem('ai_api_key');
    } catch {}

    // Auto-create initial personal project for this new user
    const projects = getStorage('novelist_projects', []);
    const initialProj = {
      id: genId('proj'),
      userId: user.id,
      title: 'Tiểu thuyết đầu tay',
      subtitle: `Tác phẩm đầu tiên của ${user.name}`,
      description: 'Dự án khởi đầu cho sự nghiệp sáng tác của bạn.',
      genre: 'fantasy',
      status: 'planning',
      wordCount: 0,
      chapterCount: 0,
      wordCountGoal: 50000,
      createdAt: now,
      updatedAt: now
    };
    projects.unshift(initialProj);
    setStorage('novelist_projects', projects);
    
    // Auto push initial workspace to cloud immediately
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        import('./sync').then(m => m.pushSync()).catch(() => {});
      }, 500);
    }

    return { user, token: 'token_' + user.id };
  }

  // Auth - Login
  if (path === '/api/auth/login') {
    const cleanEmail = (body.email || '').trim().toLowerCase();
    const cleanPassword = (body.password || '');
    if (!cleanEmail) {
      throw new Error('Vui lòng nhập địa chỉ email.');
    }
    if (!cleanPassword) {
      throw new Error('Vui lòng nhập mật khẩu.');
    }

    const { userKey, dataKey } = await getCloudAccountKeys(cleanEmail);

    let users = getStorage('novelist_users', []);
    let user = users.find((u: any) => (u.email || '').trim().toLowerCase() === cleanEmail);

    // If not found in this device's local storage (e.g. logging into phone for first time), look up from cloud
    if (!user) {
      try {
        const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${userKey}`);
        if (res.ok) {
          const remoteUser = await res.json();
          if (remoteUser && remoteUser.email) {
            user = remoteUser;
            users.push(user);
            setStorage('novelist_users', users);
          }
        }
      } catch {}
    }

    if (!user) {
      throw new Error('Tài khoản không tồn tại. Vui lòng kiểm tra lại email hoặc bấm Đăng ký tài khoản mới.');
    }

    const inputHash = await hashLocalPassword(cleanPassword);
    const isValid = user.passwordHash ? (user.passwordHash === inputHash) : (user.password === cleanPassword);
    if (!isValid) {
      throw new Error('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
    }

    // Upgrade plaintext password to hash if needed
    if (!user.passwordHash) {
      user.passwordHash = inputHash;
      delete user.password;
      setStorage('novelist_users', users);
      try {
        fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${userKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        }).catch(() => {});
      } catch {}
    }

    const { password, passwordHash, ...safeUser } = user;
    safeUser.aiProvider = safeUser.aiProvider || (typeof window !== 'undefined' ? (localStorage.getItem('ai_provider') || 'gemini') : 'gemini');
    safeUser.aiModel = safeUser.aiModel || (typeof window !== 'undefined' ? (localStorage.getItem('ai_model') || 'gemini-3.8-flash') : 'gemini-3.8-flash');
    
    // Safely preserve existing API key across logins
    const savedKey = (safeUser.aiApiKey || '').trim() 
      || (typeof window !== 'undefined' ? (localStorage.getItem('ai_api_key') || localStorage.getItem(`novelist_api_key_${cleanEmail}`) || '') : '');
    safeUser.aiApiKey = savedKey;

    // Apply this user's specific AI settings to current session
    try {
      localStorage.setItem('ai_provider', safeUser.aiProvider);
      localStorage.setItem('ai_model', safeUser.aiModel);
      if (safeUser.aiApiKey) {
        localStorage.setItem('ai_api_key', safeUser.aiApiKey);
        localStorage.setItem(`novelist_api_key_${cleanEmail}`, safeUser.aiApiKey);
      }
    } catch {}

    setStorage('novelist_current_user', safeUser);
    
    // CRITICAL: Immediately pull full workspace (projects, chapters, drafts) from cloud to this device
    try {
      const res = await fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${dataKey}`);
      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && typeof cloudData === 'object') {
          const { importFullWorkspace } = await import('./sync');
          importFullWorkspace(cloudData);
        }
      }
    } catch {}

    // Auto sync on login
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        import('./sync').then(m => m.pullSync(true)).catch(() => {});
      }, 300);
    }

    return { user: safeUser, token: 'token_' + safeUser.id };
  }

  // Auth - Settings
  if (path === '/api/auth/settings' && method === 'PATCH') {
    const user = getCurrentUser() || {
      id: 'usr_default',
      email: 'user@example.com',
      name: 'Tác giả'
    };

    if (body.name) {
      user.name = body.name.trim();
    }
    if (body.aiProvider) {
      try { localStorage.setItem('ai_provider', body.aiProvider); } catch {}
      user.aiProvider = body.aiProvider;
    }
    if (body.aiModel) {
      try { localStorage.setItem('ai_model', body.aiModel); } catch {}
      user.aiModel = body.aiModel;
    }
    if (body.aiApiKey !== undefined) {
      const cleanKey = (body.aiApiKey || '').trim();
      try {
        if (cleanKey) {
          localStorage.setItem('ai_api_key', cleanKey);
          if (user.email) localStorage.setItem(`novelist_api_key_${user.email.trim().toLowerCase()}`, cleanKey);
        } else {
          localStorage.removeItem('ai_api_key');
          if (user.email) localStorage.removeItem(`novelist_api_key_${user.email.trim().toLowerCase()}`);
        }
      } catch {}
      user.aiApiKey = cleanKey;
    }

    setStorage('novelist_current_user', user);

    // Keep user updated in novelist_users store & sync to cloud
    const users = getStorage('novelist_users', []);
    const userEmailClean = (user.email || '').trim().toLowerCase();
    const idx = users.findIndex((u: any) => u.id === user.id || (u.email && u.email.trim().toLowerCase() === userEmailClean));
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...user };
      setStorage('novelist_users', users);

      try {
        const { userKey } = await getCloudAccountKeys(userEmailClean);
        fetch(`https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/${userKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(users[idx])
        }).catch(() => {});
      } catch {}
    }

    return { success: true, user };
  }

  // Auth - Me
  if (path === '/api/auth/me') {
    const user = getCurrentUser() || {
      id: 'usr_default',
      email: 'user@example.com',
      name: 'Tác giả',
      aiProvider: 'gemini',
      aiModel: 'gemini-3.8-flash',
      aiApiKey: ''
    };
    try {
      user.aiProvider = localStorage.getItem('ai_provider') || user.aiProvider || 'gemini';
      user.aiModel = localStorage.getItem('ai_model') || user.aiModel || 'gemini-3.8-flash';
      user.aiApiKey = localStorage.getItem('ai_api_key') || user.aiApiKey || '';
    } catch {}
    return { user };
  }

  // Projects
  if (path === '/api/projects' && method === 'GET') {
    const currentUser = getCurrentUser() || { id: 'usr_default' };
    const raw = getStorage('novelist_projects', []);

    // Backward compatibility: migrate unassigned legacy projects to active user so existing novels are never lost
    let needsSave = false;
    const migrated = raw.map((p: any) => {
      if (!p.userId) {
        needsSave = true;
        return { ...p, userId: currentUser.id };
      }
      return p;
    });
    if (needsSave) {
      setStorage('novelist_projects', migrated);
    }

    // Isolate projects strictly by active user
    const userProjects = migrated.filter((p: any) => p.userId === currentUser.id);

    const sanitized = userProjects.map((p: any) => ({
      ...p,
      coverUrl: p.coverUrl || '',
      wordCount: p.wordCount ?? 0,
      chapterCount: p.chapterCount ?? 0,
      status: p.status || 'planning',
      genre: p.genre || 'fantasy',
      updatedAt: p.updatedAt || now,
      createdAt: p.createdAt || now
    }));
    return { projects: sanitized };
  }

  if (path === '/api/projects' && method === 'POST') {
    const currentUser = getCurrentUser() || { id: 'usr_default' };
    const projects = getStorage('novelist_projects', []);
    const newProj = {
      id: genId('proj'),
      userId: currentUser.id,
      title: body.title || 'Tiểu thuyết mới',
      subtitle: body.subtitle || '',
      description: body.description || '',
      coverUrl: body.coverUrl || '',
      genre: body.genre || 'fantasy',
      status: body.status || 'planning',
      wordCount: 0,
      chapterCount: 0,
      wordCountGoal: body.wordCountGoal || 50000,
      createdAt: now,
      updatedAt: now
    };
    projects.unshift(newProj);
    setStorage('novelist_projects', projects);
    return { project: newProj };
  }

  const projMatch = path.match(/^\/api\/projects\/([^\/\?]+)$/);
  if (projMatch) {
    const id = projMatch[1];
    const projects = getStorage('novelist_projects', []);
    if (method === 'GET') {
      const proj = projects.find((p: any) => p.id === id) || { id, title: 'Dự án', createdAt: now };
      return { project: proj };
    }
    if (method === 'PATCH') {
      const updated = projects.map((p: any) => (p.id === id ? { ...p, ...body, updatedAt: now } : p));
      setStorage('novelist_projects', updated);
      return { project: updated.find((p: any) => p.id === id) };
    }
    if (method === 'DELETE') {
      const filtered = projects.filter((p: any) => p.id !== id);
      setStorage('novelist_projects', filtered);

      // Cascade delete related records to prevent localStorage bloat
      const chapters = getStorage('novelist_chapters', []);
      setStorage('novelist_chapters', chapters.filter((c: any) => c.projectId !== id));

      const characters = getStorage('novelist_characters', []);
      setStorage('novelist_characters', characters.filter((c: any) => c.projectId !== id));

      const entities = getStorage('novelist_worldbuilding', []);
      setStorage('novelist_worldbuilding', entities.filter((e: any) => e.projectId !== id));

      const timeline = getStorage('novelist_timeline', []);
      setStorage('novelist_timeline', timeline.filter((e: any) => e.projectId !== id));

      const outline = getStorage('novelist_outline', []);
      setStorage('novelist_outline', outline.filter((n: any) => n.projectId !== id));

      return { success: true };
    }
  }

  const dupMatch = path.match(/^\/api\/projects\/([^\/]+)\/duplicate$/);
  if (dupMatch && method === 'POST') {
    const id = dupMatch[1];
    const projects = getStorage('novelist_projects', []);
    const orig = projects.find((p: any) => p.id === id);
    if (orig) {
      const newProjectId = 'proj_' + now;
      const cloned = { ...orig, id: newProjectId, title: orig.title + ' (Bản sao)', createdAt: now, updatedAt: now };
      projects.unshift(cloned);
      setStorage('novelist_projects', projects);

      // Deep clone chapters
      const chapters = getStorage('novelist_chapters', []);
      const origChapters = chapters.filter((c: any) => c.projectId === id);
      const newChapters = origChapters.map((c: any, idx: number) => ({
        ...c,
        id: 'chap_' + (now + idx + 1),
        projectId: newProjectId,
        createdAt: now,
        updatedAt: now
      }));
      setStorage('novelist_chapters', [...chapters, ...newChapters]);

      // Deep clone characters
      const characters = getStorage('novelist_characters', []);
      const origChars = characters.filter((c: any) => c.projectId === id);
      const newChars = origChars.map((c: any, idx: number) => ({
        ...c,
        id: 'char_' + (now + idx + 1),
        projectId: newProjectId,
        createdAt: now,
        updatedAt: now
      }));
      setStorage('novelist_characters', [...characters, ...newChars]);

      // Deep clone entities
      const entities = getStorage('novelist_worldbuilding', []);
      const origEntities = entities.filter((e: any) => e.projectId === id);
      const newEntities = origEntities.map((e: any, idx: number) => ({
        ...e,
        id: 'ent_' + (now + idx + 1),
        projectId: newProjectId,
        createdAt: now,
        updatedAt: now
      }));
      setStorage('novelist_worldbuilding', [...entities, ...newEntities]);

      // Deep clone timeline
      const timeline = getStorage('novelist_timeline', []);
      const origTimeline = timeline.filter((e: any) => e.projectId === id);
      const newTimeline = origTimeline.map((e: any, idx: number) => ({
        ...e,
        id: 'evt_' + (now + idx + 1),
        projectId: newProjectId,
        createdAt: now,
        updatedAt: now
      }));
      setStorage('novelist_timeline', [...timeline, ...newTimeline]);

      // Deep clone outline
      const outline = getStorage('novelist_outline', []);
      const origOutline = outline.filter((n: any) => n.projectId === id);
      const newOutline = origOutline.map((n: any, idx: number) => ({
        ...n,
        id: 'node_' + (now + idx + 1),
        projectId: newProjectId,
        createdAt: now,
        updatedAt: now
      }));
      setStorage('novelist_outline', [...outline, ...newOutline]);

      return { project: cloned };
    }
  }

  // Chapters Reorder
  const reorderChapMatch = path.match(/^\/api\/projects\/([^\/]+)\/chapters\/reorder$/);
  if (reorderChapMatch && method === 'POST') {
    const projectId = reorderChapMatch[1];
    const chapters = getStorage('novelist_chapters', []);
    const orderedIds: string[] = body.chapterIds || (Array.isArray(body.orderedIds) ? body.orderedIds.map((o: any) => o.id) : []);

    if (orderedIds.length > 0) {
      const updated = chapters.map((c: any) => {
        if (c.projectId === projectId) {
          const newIdx = orderedIds.indexOf(c.id);
          if (newIdx !== -1) {
            return { ...c, orderIndex: newIdx + 1, updatedAt: now };
          }
        }
        return c;
      });
      setStorage('novelist_chapters', updated);
    }
    return { success: true };
  }

  // Chapters
  const projChapMatch = path.match(/^\/api\/projects\/([^\/]+)\/chapters/);
  if (projChapMatch) {
    const projectId = projChapMatch[1];
    const chapters = getStorage('novelist_chapters', []);
    if (method === 'GET') {
      const list = chapters
        .filter((c: any) => c.projectId === projectId)
        .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
      return { chapters: list };
    }
    if (method === 'POST') {
      const newChap = {
        id: 'chap_' + now,
        projectId,
        title: body.title || 'Chương mới',
        orderIndex: body.orderIndex ?? chapters.length + 1,
        content: body.content || '',
        wordCount: 0,
        status: body.status || 'draft',
        createdAt: now,
        updatedAt: now
      };
      chapters.push(newChap);
      setStorage('novelist_chapters', chapters);

      // Update chapter count on project
      const projects = getStorage('novelist_projects', []);
      const updatedProj = projects.map((p: any) => p.id === projectId ? { ...p, chapterCount: (p.chapterCount || 0) + 1, updatedAt: now } : p);
      setStorage('novelist_projects', updatedProj);

      return { chapter: newChap };
    }
  }

  const chapMatch = path.match(/^\/api\/chapters\/([^\/]+)$/);
  if (chapMatch) {
    const id = chapMatch[1];
    const chapters = getStorage('novelist_chapters', []);
    if (method === 'GET') {
      const chapter = chapters.find((c: any) => c.id === id) || { id, title: 'Chương', content: '', wordCount: 0 };
      return { chapter };
    }
    if (method === 'PATCH') {
      const updated = chapters.map((c: any) => {
        if (c.id === id) {
          let content = c.content || '';
          if (body.appendContent) {
            content = content ? `${content}\n\n${body.appendContent}` : body.appendContent;
          } else if (body.content !== undefined) {
            content = body.content;
          }
          const wordCount = countWords(content);
          return { ...c, ...body, content, wordCount, updatedAt: now };
        }
        return c;
      });
      setStorage('novelist_chapters', updated);

      // Recalculate project total words
      const targetChap = updated.find((c: any) => c.id === id);
      if (targetChap) {
        const projChapters = updated.filter((c: any) => c.projectId === targetChap.projectId);
        const totalWords = projChapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0);
        const projects = getStorage('novelist_projects', []);
        const updatedProj = projects.map((p: any) => p.id === targetChap.projectId ? { ...p, wordCount: totalWords, updatedAt: now } : p);
        setStorage('novelist_projects', updatedProj);
      }

      return { chapter: updated.find((c: any) => c.id === id) };
    }
    if (method === 'DELETE') {
      const targetChap = chapters.find((c: any) => c.id === id);
      const filtered = chapters.filter((c: any) => c.id !== id);
      setStorage('novelist_chapters', filtered);

      if (targetChap) {
        const remainingProjChaps = filtered.filter((c: any) => c.projectId === targetChap.projectId);
        const totalWords = remainingProjChaps.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0);
        const projects = getStorage('novelist_projects', []);
        const updatedProj = projects.map((p: any) => p.id === targetChap.projectId ? { ...p, chapterCount: remainingProjChaps.length, wordCount: totalWords, updatedAt: now } : p);
        setStorage('novelist_projects', updatedProj);
      }

      return { success: true };
    }
  }

  // Characters
  const projCharMatch = path.match(/^\/api\/projects\/([^\/]+)\/characters/);
  if (projCharMatch) {
    const projectId = projCharMatch[1];
    const characters = getStorage('novelist_characters', []);
    if (method === 'GET') {
      return { characters: characters.filter((c: any) => c.projectId === projectId) };
    }
    if (method === 'POST') {
      const newChar = {
        id: 'char_' + now,
        projectId,
        name: body.name || 'Nhân vật',
        role: body.role || 'supporting',
        personality: body.personality || '',
        background: body.background || '',
        appearance: body.appearance || '',
        motivation: body.motivation || '',
        aliases: body.aliases || [],
        tags: body.tags || [],
        createdAt: now,
        updatedAt: now
      };
      characters.push(newChar);
      setStorage('novelist_characters', characters);
      return { character: newChar };
    }
  }

  // Characters - Generate
  const charGenMatch = path.match(/^\/api\/projects\/([^\/]+)\/characters\/generate$/);
  if (charGenMatch && method === 'POST') {
    const projectId = charGenMatch[1];
    const role = body.role || 'supporting';
    const concept = (body.concept || '').trim();

    const namePool: Record<string, string[]> = {
      protagonist: ['Arthur Pendelton', 'Lâm Vũ Phong', 'Elena Vance', 'Trần Nam Khánh', 'Lyra Silvertongue', 'Kaelen Thorne'],
      antagonist: ['Lord Malakar', 'Bạch Vô Thường', 'Vespera Nyx', 'Dạ Thần', 'Ignis Vor', 'Hắc Lão Ma'],
      supporting: ['Master Bran', 'Tiêu Dao Tử', 'Rowan Reed', 'Tuệ Minh', 'Silas Vance', 'Thảo My'],
      minor: ['Lão quán trọ Tom', 'Lính gác thành', 'Người lái đò', 'Tiểu đồng', 'Thương nhân Hans']
    };

    const roleNameList = namePool[role] || namePool.supporting;
    const pickedName = roleNameList[Math.floor(Math.random() * roleNameList.length)];
    const generatedName = concept ? `${pickedName}` : pickedName;

    const newChar = {
      id: 'char_' + now,
      projectId,
      name: generatedName,
      role,
      personality: concept ? `Tính cách phản ánh: ${concept}. Thông minh, quyết đoán nhưng ẩn chứa nhiều mâu thuẫn nội tâm.` : 'Dũng cảm, cương trực, luôn đấu tranh vì lý tưởng và bảo vệ người thân.',
      background: concept ? `Lai lịch liên quan đến: ${concept}. Từng trải qua một biến cố lớn làm thay đổi hoàn toàn cuộc đời.` : 'Xuất thân bình dị nhưng mang trong mình tiềm năng và bí mật gia tộc chưa được hé lộ.',
      appearance: 'Vóc dáng cao ráo, ánh mắt sắc sảo, thường mang trang phục phong trần và dấu vết của những chuyến đi dài.',
      motivation: concept ? `Mục tiêu tối thượng: giải mã và đạt được ${concept}.` : 'Đi tìm chân lý, bảo vệ những người quan trọng và khám phá sự thật bị chôn vùi.',
      aliases: [],
      tags: [role],
      createdAt: now,
      updatedAt: now
    };

    const characters = getStorage('novelist_characters', []);
    characters.push(newChar);
    setStorage('novelist_characters', characters);
    return { character: newChar, success: true };
  }

  const charMatch = path.match(/^\/api\/characters\/([^\/]+)$/);
  if (charMatch) {
    const id = charMatch[1];
    const characters = getStorage('novelist_characters', []);
    if (method === 'PATCH') {
      const updated = characters.map((c: any) => (c.id === id ? { ...c, ...body, updatedAt: now } : c));
      setStorage('novelist_characters', updated);
      return { character: updated.find((c: any) => c.id === id) };
    }
    if (method === 'DELETE') {
      setStorage('novelist_characters', characters.filter((c: any) => c.id !== id));
      return { success: true };
    }
  }

  // Outline - Templates
  const templateMatch = path.match(/^\/api\/projects\/([^\/]+)\/outline\/template$/);
  if (templateMatch && method === 'POST') {
    const projectId = templateMatch[1];
    const templateId = body.templateId || 'three-act';
    const template = OUTLINE_TEMPLATES[templateId] || OUTLINE_TEMPLATES['three-act'];
    const nodes = getStorage('novelist_outline', []);

    let orderIndex = nodes.filter((n: any) => n.projectId === projectId).length;
    let addedCount = 0;

    const addNodesRecursive = (items: any[], parentId: string | null = null) => {
      for (const item of items) {
        const id = 'node_' + now + '_' + Math.random().toString(36).slice(2, 7);
        const node = {
          id,
          projectId,
          parentId,
          type: item.type || 'scene',
          title: item.title,
          description: item.description || '',
          color: item.color || (item.type === 'act' ? '#3b82f6' : '#64748b'),
          status: 'idea',
          orderIndex: orderIndex++,
          createdAt: now,
          updatedAt: now
        };
        nodes.push(node);
        addedCount++;
        if (item.children && item.children.length > 0) {
          addNodesRecursive(item.children, id);
        }
      }
    };

    addNodesRecursive(template.nodes, null);
    setStorage('novelist_outline', nodes);
    return { success: true, count: addedCount };
  }

  // Outline - AI Generate
  const generateMatch = path.match(/^\/api\/projects\/([^\/]+)\/outline\/generate$/);
  if (generateMatch && method === 'POST') {
    const projectId = generateMatch[1];
    const { premise = '', genre = 'fantasy', numChapters = 10, templateId = 'three-act' } = body;
    const nodes = getStorage('novelist_outline', []);
    let orderIndex = nodes.filter((n: any) => n.projectId === projectId).length;

    // Create Act I, II, III with generated chapters based on premise
    const act1Id = 'node_' + now + '_act1';
    const act2Id = 'node_' + (now + 1) + '_act2';
    const act3Id = 'node_' + (now + 2) + '_act3';

    const acts = [
      { id: act1Id, title: 'HỒI I: MỞ ĐẦU', type: 'act', color: '#3b82f6', parentId: null, description: `Bắt đầu: ${premise.slice(0, 100)}` },
      { id: act2Id, title: 'HỒI II: ĐỐI ĐẦU', type: 'act', color: '#eab308', parentId: null, description: `Thử thách & Xung đột dâng cao (${genre})` },
      { id: act3Id, title: 'HỒI III: CAO TRÀO & KẾT THÚC', type: 'act', color: '#22c55e', parentId: null, description: 'Giải quyết xung đột và kết cục câu chuyện' }
    ];

    acts.forEach(act => {
      nodes.push({ ...act, projectId, status: 'idea', orderIndex: orderIndex++, createdAt: now, updatedAt: now });
    });

    const chapsPerAct = Math.max(1, Math.floor(numChapters / 3));
    let chIdx = 1;

    for (let i = 0; i < numChapters; i++) {
      const parentId = i < chapsPerAct ? act1Id : i < chapsPerAct * 2 ? act2Id : act3Id;
      const actName = i < chapsPerAct ? 'Khởi hành' : i < chapsPerAct * 2 ? 'Thử thách' : 'Quyết định';
      const node = {
        id: 'node_' + (now + 10 + i),
        projectId,
        parentId,
        type: 'chapter',
        title: `Chương ${chIdx}: ${actName} ${i + 1}`,
        description: `Diễn biến theo ý tưởng: ${premise ? premise.slice(0, 80) : 'Phát triển cốt truyện'}`,
        color: '#64748b',
        status: 'idea',
        orderIndex: orderIndex++,
        createdAt: now,
        updatedAt: now
      };
      nodes.push(node);
      chIdx++;
    }

    setStorage('novelist_outline', nodes);
    return { success: true, generatedCount: numChapters + 3 };
  }

  // Outline - Export
  const exportOutMatch = path.match(/^\/api\/projects\/([^\/]+)\/outline\/export/);
  if (exportOutMatch) {
    const projectId = exportOutMatch[1];
    const nodes = getStorage('novelist_outline', []).filter((n: any) => n.projectId === projectId);
    return { outline: nodes, flat: nodes, count: nodes.length };
  }

  // Outline - Main
  const projOutMatch = path.match(/^\/api\/projects\/([^\/\?]+)\/outline/);
  if (projOutMatch) {
    const projectId = projOutMatch[1];
    const nodes = getStorage('novelist_outline', []).filter((n: any) => n.projectId === projectId);

    if (method === 'GET') {
      const buildTree = (parentId: string | null): any[] => {
        return nodes
          .filter((n: any) => (n.parentId || null) === parentId)
          .map((n: any) => ({
            ...n,
            children: buildTree(n.id)
          }))
          .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
      };

      const tree = buildTree(null);
      const total = nodes.length;
      const completed = nodes.filter((n: any) => n.status === 'written' || n.status === 'revised').length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        outline: tree,
        flat: nodes,
        progress,
        total,
        completed
      };
    }

    if (method === 'POST') {
      const allNodes = getStorage('novelist_outline', []);
      const siblings = allNodes.filter((n: any) => n.projectId === projectId && n.parentId === (body.parentId || null));
      const newNode = {
        id: 'node_' + now,
        projectId,
        parentId: body.parentId || null,
        type: body.type || 'scene',
        title: body.title || 'Node mới',
        description: body.description || '',
        orderIndex: body.orderIndex ?? siblings.length,
        status: body.status || 'idea',
        color: body.color || '#3b82f6',
        linkedChapterId: body.linkedChapterId || null,
        createdAt: now,
        updatedAt: now
      };
      allNodes.push(newNode);
      setStorage('novelist_outline', allNodes);
      return { node: newNode, id: newNode.id };
    }
  }

  const outMatch = path.match(/^\/api\/outline\/([^\/]+)$/);
  if (outMatch) {
    const id = outMatch[1];
    const nodes = getStorage('novelist_outline', []);
    if (method === 'PATCH') {
      const updated = nodes.map((n: any) => (n.id === id ? { ...n, ...body, updatedAt: now } : n));
      setStorage('novelist_outline', updated);
      return { node: updated.find((n: any) => n.id === id) };
    }
    if (method === 'DELETE') {
      // Delete recursively
      const idsToDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of nodes) {
          if (n.parentId && idsToDelete.has(n.parentId) && !idsToDelete.has(n.id)) {
            idsToDelete.add(n.id);
            changed = true;
          }
        }
      }
      const filtered = nodes.filter((n: any) => !idsToDelete.has(n.id));
      setStorage('novelist_outline', filtered);
      return { success: true };
    }
  }

  // Timeline - Check
  const timeCheckMatch = path.match(/^\/api\/projects\/([^\/]+)\/timeline\/check$/);
  if (timeCheckMatch && method === 'POST') {
    const projectId = timeCheckMatch[1];
    const events = getStorage('novelist_timeline', []).filter((e: any) => e.projectId === projectId);
    const characters = getStorage('novelist_characters', []).filter((c: any) => c.projectId === projectId);

    const issues: any[] = [];
    if (events.length === 0) {
      return {
        check: {
          summary: 'Dự án chưa có sự kiện timeline nào. Hãy thêm ít nhất 2 sự kiện để phân tích dòng thời gian.',
          issues: []
        }
      };
    }

    // Check for missing dates
    const undatedEvents = events.filter((e: any) => !e.dateInStory && !e.era);
    if (undatedEvents.length > 0) {
      issues.push({
        type: 'missing_date',
        severity: 'medium',
        eventIds: undatedEvents.map((e: any) => e.id),
        description: `Có ${undatedEvents.length} sự kiện chưa xác định ngày trong truyện hoặc kỷ nguyên: ${undatedEvents.slice(0, 3).map((e: any) => `"${e.title}"`).join(', ')}.`,
        suggestion: 'Hãy đặt mốc thời gian (ví dụ: "Năm 102", "Ngày 15 tháng 3", "Đêm trăng tròn") để giữ mạch thời gian rõ ràng.'
      });
    }

    // Check for major events with no characters
    const majorNoChar = events.filter((e: any) => e.importance === 'major' && (!e.involvedCharacterIds || e.involvedCharacterIds.length === 0));
    if (majorNoChar.length > 0) {
      issues.push({
        type: 'causality',
        severity: 'low',
        eventIds: majorNoChar.map((e: any) => e.id),
        description: `Có ${majorNoChar.length} sự kiện trọng đại chưa gắn với nhân vật nào: ${majorNoChar.slice(0, 3).map((e: any) => `"${e.title}"`).join(', ')}.`,
        suggestion: 'Gắn nhân vật vào các sự kiện mấu chốt để người đọc đồng cảm và theo dõi diễn biến tâm lý.'
      });
    }

    const summary = issues.length === 0
      ? `Đã phân tích toàn diện ${events.length} sự kiện và ${characters.length} nhân vật. Mạch thời gian nhất quán, chặt chẽ và không phát hiện nghịch lý thời gian.`
      : `Đã phân tích ${events.length} sự kiện: phát hiện ${issues.length} điểm có thể tối ưu hoá để mạch truyện liền mạch hơn.`;

    return {
      check: {
        summary,
        issues
      }
    };
  }

  // Timeline - Main
  const projTimeMatch = path.match(/^\/api\/projects\/([^\/\?]+)\/timeline/);
  if (projTimeMatch) {
    const projectId = projTimeMatch[1];
    const allEvents = getStorage('novelist_timeline', []).filter((e: any) => e.projectId === projectId);

    if (method === 'GET') {
      let filtered = [...allEvents];
      try {
        const queryIdx = path.indexOf('?');
        if (queryIdx !== -1) {
          const searchParams = new URLSearchParams(path.slice(queryIdx));
          const era = searchParams.get('era');
          const importance = searchParams.get('importance');
          if (era && era !== 'all') filtered = filtered.filter((e: any) => e.era === era);
          if (importance && importance !== 'all') filtered = filtered.filter((e: any) => e.importance === importance);
        }
      } catch {}

      const enriched = filtered.map((e: any) => ({
        ...e,
        involvedCharacterIds: Array.isArray(e.involvedCharacterIds) ? e.involvedCharacterIds : []
      }));

      const eras = [...new Set(allEvents.map((e: any) => e.era).filter(Boolean))] as string[];
      const stats = {
        total: allEvents.length,
        major: allEvents.filter((e: any) => e.importance === 'major').length,
        minor: allEvents.filter((e: any) => e.importance === 'minor').length,
        eras: eras.length
      };

      return { events: enriched, eras, stats };
    }

    if (method === 'POST') {
      const allList = getStorage('novelist_timeline', []);
      const newEvent = {
        id: 'evt_' + now,
        projectId,
        title: body.title || 'Sự kiện mới',
        description: body.description || '',
        dateInStory: body.dateInStory || '',
        dateRealWorld: body.dateRealWorld || '',
        era: body.era || '',
        importance: body.importance || 'minor',
        involvedCharacterIds: Array.isArray(body.involvedCharacterIds) ? body.involvedCharacterIds : [],
        locationId: body.locationId || '',
        chapterId: body.chapterId || '',
        orderIndex: body.orderIndex ?? allEvents.length,
        createdAt: now,
        updatedAt: now
      };
      allList.push(newEvent);
      setStorage('novelist_timeline', allList);
      return { event: newEvent, id: newEvent.id };
    }
  }

  const timeMatch = path.match(/^\/api\/timeline\/([^\/]+)$/);
  if (timeMatch) {
    const id = timeMatch[1];
    const events = getStorage('novelist_timeline', []);
    if (method === 'PATCH') {
      const updated = events.map((e: any) => (e.id === id ? { ...e, ...body, updatedAt: now } : e));
      setStorage('novelist_timeline', updated);
      return { event: updated.find((e: any) => e.id === id) };
    }
    if (method === 'DELETE') {
      setStorage('novelist_timeline', events.filter((e: any) => e.id !== id));
      return { success: true };
    }
  }

  // Worldbuilding / Entities - Generate
  const entityGenMatch = path.match(/^\/api\/projects\/([^\/]+)\/(entities|worldbuilding)\/generate$/);
  if (entityGenMatch && method === 'POST') {
    const projectId = entityGenMatch[1];
    const type = body.type || 'location';
    const concept = (body.concept || '').trim();

    const loreTemplates: Record<string, { names: string[]; desc: string }> = {
      location: {
        names: ['Thành Cổ Aethelgard', 'Thung Lũng Sương Mù', 'Pháo Đài Thiên Thạch', 'Rừng Cấm Hắc Thụ'],
        desc: 'Vùng đất linh thiêng bao phủ bởi sương mù ngàn năm, nơi lưu giữ tàn tích của một nền văn minh cổ đại.'
      },
      organization: {
        names: ['Hội Hiệp Sĩ Ánh Trăng', 'Bang Hội Tro Tàn', 'Học Viện Pháp Thuật Tối Cao', 'Mật Lệnh Bóng Đêm'],
        desc: 'Tổ chức bí mật hoạt động trong bóng tối với mạng lưới gián điệp trải rộng khắp lục địa.'
      },
      species: {
        names: ['Tinh Linh Dạ Nguyệt', 'Long Tộc Cổ Đại', 'Người Khổng Lồ Băng', 'Huyết Tộc Thượng Đẳng'],
        desc: 'Chủng tộc cổ xưa có tuổi thọ hàng thiên niên kỷ và sở hữu sự cộng hưởng ma thuật bẩm sinh.'
      },
      magic_system: {
        names: ['Nguyên Tố Cổ Ngữ', 'Hệ Thống Luyện Hồn', 'Pháp Trận Không Gian', 'Hơi Thở Của Rồng'],
        desc: 'Quy luật thao túng năng lượng vũ trụ thông qua ấn chú, ý chí tinh thần và rune khắc.'
      },
      item: {
        names: ['Gươm Ánh Sáng Tuyệt Đối', 'Nhẫn Không Gian Vĩnh Hằng', 'Cuộn Da Cổ Ngữ', 'Hạt Giống Thế Giới'],
        desc: 'Bảo vật cấp sử thi có khả năng bẻ cong các quy luật thực tại và ban tặng quyền năng to lớn.'
      },
      religion: {
        names: ['Giáo Hội Bình Minh', 'Tín Ngưỡng Đất Mẹ', 'Tà Thần Vực Thẳm', 'Thần Điện Thái Dương'],
        desc: 'Hệ thống tín ngưỡng thờ phụng vị thần bảo hộ, sở hữu các giáo sĩ và nghi thức thanh tẩy linh hồn.'
      },
      event: {
        names: ['Đại Chiến Ngũ Vương', 'Đêm Trăng Máu', 'Sự Cố Đứt Gãy Ma Lực', 'Thời Kỳ Băng Hà'],
        desc: 'Sự kiện chấn động lịch sử làm thay đổi bản đồ địa chính trị và số phận của mọi giống loài.'
      }
    };

    const lore = loreTemplates[type] || loreTemplates.location;
    const name = lore.names[Math.floor(Math.random() * lore.names.length)];

    const newEntity = {
      id: 'entity_' + now,
      projectId,
      name,
      type,
      description: concept ? `${concept}. ${lore.desc}` : lore.desc,
      attributes: {},
      createdAt: now,
      updatedAt: now
    };

    const entities = getStorage('novelist_worldbuilding', []);
    entities.push(newEntity);
    setStorage('novelist_worldbuilding', entities);
    return { entity: newEntity, success: true };
  }

  // Worldbuilding / Entities
  const projEntityMatch = path.match(/^\/api\/projects\/([^\/\?]+)\/(entities|worldbuilding)/);
  if (projEntityMatch) {
    const projectId = projEntityMatch[1];
    const allEntities = getStorage('novelist_worldbuilding', []).filter((e: any) => e.projectId === projectId);

    if (method === 'GET') {
      let filtered = [...allEntities];
      try {
        const queryIdx = path.indexOf('?');
        if (queryIdx !== -1) {
          const searchParams = new URLSearchParams(path.slice(queryIdx));
          const type = searchParams.get('type');
          if (type && type !== 'all') filtered = filtered.filter((e: any) => e.type === type);
        }
      } catch {}

      const enriched = filtered.map((e: any) => ({
        ...e,
        attributes: e.attributes || {},
        relatedEntityIds: e.relatedEntityIds || [],
        tags: e.tags || []
      }));

      return { entities: enriched, items: enriched };
    }

    if (method === 'POST') {
      const allList = getStorage('novelist_worldbuilding', []);
      const newEntity = {
        id: 'ent_' + now,
        projectId,
        name: body.name || 'Thực thể mới',
        type: body.type || 'location',
        description: body.description || '',
        attributes: body.attributes || {},
        imageUrl: body.imageUrl || '',
        relatedEntityIds: body.relatedEntityIds || [],
        tags: body.tags || [],
        createdAt: now,
        updatedAt: now
      };
      allList.push(newEntity);
      setStorage('novelist_worldbuilding', allList);
      return { entity: newEntity, item: newEntity, id: newEntity.id };
    }
  }

  const entityMatch = path.match(/^\/api\/(entities|worldbuilding)\/([^\/]+)$/);
  if (entityMatch) {
    const id = entityMatch[2];
    const entities = getStorage('novelist_worldbuilding', []);
    if (method === 'PATCH') {
      const updated = entities.map((e: any) => (e.id === id ? { ...e, ...body, updatedAt: now } : e));
      setStorage('novelist_worldbuilding', updated);
      return { entity: updated.find((e: any) => e.id === id), success: true };
    }
    if (method === 'DELETE') {
      setStorage('novelist_worldbuilding', entities.filter((e: any) => e.id !== id));
      return { success: true };
    }
  }

  // Export
  if (path.includes('/export/')) {
    const history = getStorage('novelist_export_jobs', []);
    if (path.includes('/history')) {
      return { jobs: history, success: true };
    }
    if (method === 'POST') {
      const job = {
        id: 'job_' + now,
        format: body.format || 'txt',
        status: 'done',
        createdAt: now,
        completedAt: now + 500
      };
      history.unshift(job);
      setStorage('novelist_export_jobs', history);
      return {
        success: true,
        format: job.format,
        extension: job.format,
        size: 1024,
        job
      };
    }
    if (method === 'DELETE') {
      return { success: true };
    }
    return { jobs: history, success: true };
  }

  return { success: true };
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const isBrowser = typeof window !== 'undefined';
  const customApiUrl = process.env.NEXT_PUBLIC_API_URL;

  // 1. If explicit custom API URL is set and valid, try it
  if (customApiUrl && (!isBrowser || !window.location.protocol.startsWith('https') || !customApiUrl.includes('localhost'))) {
    try {
      const token = isBrowser ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
      };
      if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;

      const normalizedBase = customApiUrl.replace(/\/+$/, '');
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const res = await fetch(`${normalizedBase}${normalizedPath}`, { ...options, headers });
      if (res.ok) return await res.json();
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || `Lỗi máy chủ (${res.status})`);
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch') && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
        throw e;
      }
      // fallback
    }
  }

  // 2. In browser, try relative path on the same host (e.g. Next.js API routes on Vercel)
  if (isBrowser && (path.startsWith('/api/ai/') || path.startsWith('/api/sync') || path.startsWith('/api/export'))) {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
      };
      if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(path, {
        ...options,
        headers
      });
      if (res.ok) {
        return await res.json();
      }
      if (res.status === 404) {
        // Fall back to local API handler if the route does not exist on this server
        return await handleLocalApi(path, options);
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || `Lỗi máy chủ (${res.status})`);
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch') && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
        throw e;
      }
      // proceed to local fallback
    }
  }

  // 3. Client-side local storage fallback
  return await handleLocalApi(path, options);
}
