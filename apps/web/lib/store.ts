'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  aiApiKey?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
          const emailClean = (user.email || '').trim().toLowerCase();
          const existingKey = (user.aiApiKey || '').trim() 
            || (localStorage.getItem('ai_api_key') || '').trim() 
            || (emailClean ? (localStorage.getItem(`novelist_api_key_${emailClean}`) || '').trim() : '');

          if (existingKey) {
            user.aiApiKey = existingKey;
            localStorage.setItem('ai_api_key', existingKey);
            if (emailClean) localStorage.setItem(`novelist_api_key_${emailClean}`, existingKey);
          }

          localStorage.setItem('novelist_current_user', JSON.stringify(user));
          if (user.aiProvider) localStorage.setItem('ai_provider', user.aiProvider);
          if (user.aiModel) localStorage.setItem('ai_model', user.aiModel);
        }
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          // Backup current API key with user email before logging out
          try {
            const userStr = localStorage.getItem('novelist_current_user');
            if (userStr) {
              const u = JSON.parse(userStr);
              const emailClean = (u.email || '').trim().toLowerCase();
              const currentKey = (localStorage.getItem('ai_api_key') || u.aiApiKey || '').trim();
              if (emailClean && currentKey) {
                localStorage.setItem(`novelist_api_key_${emailClean}`, currentKey);
              }
            }
          } catch {}
          localStorage.removeItem('token');
          localStorage.removeItem('novelist_current_user');
          // Preserve ai_api_key in localStorage so logging out and back in never loses the user's key
        }
        set({ user: null, token: null, isAuthenticated: false });
      },
      setUser: (user) => {
        if (typeof window !== 'undefined') {
          const emailClean = (user.email || '').trim().toLowerCase();
          const cleanKey = (user.aiApiKey || '').trim();
          if (cleanKey) {
            localStorage.setItem('ai_api_key', cleanKey);
            if (emailClean) localStorage.setItem(`novelist_api_key_${emailClean}`, cleanKey);
          } else if (user.aiApiKey === '') {
            localStorage.removeItem('ai_api_key');
            if (emailClean) localStorage.removeItem(`novelist_api_key_${emailClean}`);
          }
          localStorage.setItem('novelist_current_user', JSON.stringify(user));
          if (user.aiProvider) localStorage.setItem('ai_provider', user.aiProvider);
          if (user.aiModel) localStorage.setItem('ai_model', user.aiModel);
        }
        set({ user });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated })
    }
  )
);

interface EditorState {
  focusMode: boolean;
  typewriterMode: boolean;
  wordCount: number;
  isSaving: boolean;
  lastSaved: number | null;
  setFocusMode: (v: boolean) => void;
  setTypewriterMode: (v: boolean) => void;
  setWordCount: (n: number) => void;
  setIsSaving: (v: boolean) => void;
  setLastSaved: (t: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  focusMode: false,
  typewriterMode: false,
  wordCount: 0,
  isSaving: false,
  lastSaved: null,
  setFocusMode: (v) => set({ focusMode: v }),
  setTypewriterMode: (v) => set({ typewriterMode: v }),
  setWordCount: (n) => set({ wordCount: n }),
  setIsSaving: (v) => set({ isSaving: v }),
  setLastSaved: (t) => set({ lastSaved: t })
}));

interface ProjectState {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id })
}));
