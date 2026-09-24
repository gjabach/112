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
        }
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
        set({ user: null, token: null, isAuthenticated: false });
      },
      setUser: (user) => set({ user })
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
