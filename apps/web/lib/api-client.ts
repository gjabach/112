/**
 * Unified API Client for Novelist Frontend
 * Provides unified online (Cloudflare Worker API) & offline (Local Storage / IndexedDB fallback) handling
 */

import { apiFetch } from './utils';
import type { 
  Project, 
  User,
  CreateProjectInput,
  UpdateProjectInput,
  CreateChapterInput,
  UpdateChapterInput,
  CreateCharacterInput,
  UpdateCharacterInput
} from '@novelist/shared';

export interface ApiClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export class NovelistApiClient {
  private baseUrl: string;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_API_URL || '';
  }

  public isOnline(): boolean {
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
  }

  public getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  public async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    return apiFetch(path, options);
  }

  // --- Auth Endpoints ---
  public auth = {
    login: (credentials: { email: string; password: string }) => 
      this.request<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      }),

    register: (data: { email: string; password: string; name: string }) =>
      this.request<{ user: User; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    me: () => this.request<{ user: User }>('/api/auth/me'),

    logout: async () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('novelist_current_user');
      }
      return { success: true };
    }
  };

  // --- Projects Endpoints ---
  public projects = {
    list: () => this.request<{ projects: Project[] }>('/api/projects'),
    
    get: (id: string) => this.request<{ project: Project }>(`/api/projects/${id}`),
    
    create: (data: CreateProjectInput) => this.request<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
    update: (id: string, data: UpdateProjectInput) => this.request<{ success: boolean }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    
    delete: (id: string) => this.request<{ success: boolean }>(`/api/projects/${id}`, {
      method: 'DELETE'
    }),

    duplicate: (id: string) => this.request<{ project: Project }>(`/api/projects/${id}/duplicate`, {
      method: 'POST'
    })
  };

  // --- Chapters Endpoints ---
  public chapters = {
    list: (projectId: string) => this.request<{ chapters: any[] }>(`/api/projects/${projectId}/chapters`),
    
    get: (id: string) => this.request<{ chapter: any }>(`/api/chapters/${id}`),
    
    create: (projectId: string, data: CreateChapterInput) => this.request<{ chapter: any }>(`/api/projects/${projectId}/chapters`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
    update: (id: string, data: UpdateChapterInput) => this.request<{ success: boolean }>(`/api/chapters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    
    delete: (id: string) => this.request<{ success: boolean }>(`/api/chapters/${id}`, {
      method: 'DELETE'
    }),
    
    reorder: (id: string, newIndex: number) => this.request<{ success: boolean; newIndex: number }>(`/api/chapters/${id}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ newIndex })
    }),

    revisions: (id: string) => this.request<{ revisions: any[] }>(`/api/chapters/${id}/revisions`)
  };

  // --- Characters Endpoints ---
  public characters = {
    list: (projectId: string) => this.request<{ characters: any[] }>(`/api/projects/${projectId}/characters`),
    
    create: (projectId: string, data: CreateCharacterInput) => this.request<{ character: any }>(`/api/projects/${projectId}/characters`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
    update: (id: string, data: UpdateCharacterInput) => this.request<{ success: boolean }>(`/api/characters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    
    delete: (id: string) => this.request<{ success: boolean }>(`/api/characters/${id}`, {
      method: 'DELETE'
    })
  };

  // --- Stats Overview ---
  public stats = {
    overview: () => this.request<{ stats: { totalProjects: number; totalWords: number; totalChapters: number } }>('/api/stats/overview')
  };
}

// Export global singleton instance
export const apiClient = new NovelistApiClient();
