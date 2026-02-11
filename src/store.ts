import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface User {
    id: number;
    nickname: string;
    phone: string;
    avatar?: string;
}

interface AIModel {
    id?: number;
    name: string;
    model_type: 'text' | 'image';
}

interface AIProvider {
    id?: number;
    name: string;
    api_key: string;
    base_url?: string;
    models: AIModel[];
}

interface Post {
    id?: number;
    title: string;
    content: string;
    images: string[];
    coverImage?: string;
    created_at?: string;
}

export interface TrendItem {
    id?: string;
    index: number;
    url: string;
    title: string;
    img?: string;
    desc?: string;
    user?: string;
    user_id?: number;
    user_face?: string;
    reason?: string;
    sorting?: string | number;
    time?: string;
}

export interface Prompt {
    id: string;
    name: string;
    content: string;
}

export interface TrendData {
    [key: string]: TrendItem[];
}

interface AppState {
    currentUser: User | null;
    setCurrentUser: (user: User | null) => void;
    users: User[];
    fetchUsers: () => Promise<void>;
    mcpStatus: { is_running: boolean; port: number; token?: string };
    fetchMcpStatus: () => Promise<void>;
    apiStatus: { is_running: boolean; port: number };
    fetchApiStatus: () => Promise<void>;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    aiProviders: AIProvider[];
    setAIProviders: (providers: AIProvider[]) => void;
    selectedTextModel: { providerId: number; modelName: string } | null;
    setSelectedTextModel: (model: { providerId: number; modelName: string } | null) => void;
    selectedImageModel: { providerId: number; modelName: string } | null;
    setSelectedImageModel: (model: { providerId: number; modelName: string } | null) => void;
    imageSize: string;
    setImageSize: (size: string) => void;
    currentPost: Post;
    setCurrentPost: (post: Partial<Post>) => void;
    drafts: Post[];
    fetchDrafts: () => Promise<void>;
    loadInitialConfig: () => Promise<void>;
    themeMode: 'light' | 'dark' | 'system';
    setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
    trends: TrendData | null;
    trendsLoading: boolean;
    fetchTrends: () => Promise<void>;
    customPrompts: Prompt[];
    addPrompt: (prompt: Prompt) => void;
    updatePrompt: (id: string, prompt: Partial<Prompt>) => void;
    deletePrompt: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
    currentUser: null,
    setCurrentUser: (user) => set({ currentUser: user }),
    users: [],
    fetchUsers: async () => {
        try {
            const list: User[] = await invoke('get_users');
            set({ users: list });
        } catch (e) {
            console.error('Failed to fetch users:', e);
        }
    },
    mcpStatus: { is_running: false, port: 8001, token: undefined },
    fetchMcpStatus: async () => {
        try {
            const res: { is_running: boolean; port: number; token?: string } = await invoke('get_mcp_status');
            set({ mcpStatus: res });
        } catch (e) {
            console.error('Failed to fetch MCP status', e);
        }
    },
    apiStatus: { is_running: false, port: 8080 },
    fetchApiStatus: async () => {
        try {
            const res: { is_running: boolean; port: number } = await invoke('get_api_status');
            set({ apiStatus: res });
        } catch (e) {
            console.error('Failed to fetch API status', e);
        }
    },
    activeTab: 'publish',
    setActiveTab: (tab) => set({ activeTab: tab }),
    aiProviders: [],
    setAIProviders: (providers) => set({ aiProviders: providers }),
    selectedTextModel: null,
    setSelectedTextModel: (model) => {
        set({ selectedTextModel: model });
        if (model) {
            invoke('save_config', { key: 'selected_text_model', value: JSON.stringify(model) }).catch(console.error);
        }
    },
    selectedImageModel: null,
    setSelectedImageModel: (model) => {
        set({ selectedImageModel: model });
        if (model) {
            invoke('save_config', { key: 'selected_image_model', value: JSON.stringify(model) }).catch(console.error);
        }
    },
    imageSize: '1024x1024',
    setImageSize: (size) => {
        set({ imageSize: size });
        invoke('save_config', { key: 'image_size', value: size }).catch(console.error);
    },
    currentPost: {
        title: '',
        content: '',
        images: [],
    },
    setCurrentPost: (post) => set((state) => ({ currentPost: { ...state.currentPost, ...post } })),
    drafts: [],
    fetchDrafts: async () => {
        const { currentUser } = useAppStore.getState();
        if (currentUser) {
            try {
                const posts: Post[] = await invoke('get_posts', { userId: currentUser.id });
                set({ drafts: posts });
            } catch (e) {
                console.error('Failed to fetch drafts', e);
            }
        }
    },
    loadInitialConfig: async () => {
        try {
            const textModelJson: string | null = await invoke('get_config_value', { key: 'selected_text_model' });
            if (textModelJson) {
                set({ selectedTextModel: JSON.parse(textModelJson) });
            }
            const imageModelJson: string | null = await invoke('get_config_value', { key: 'selected_image_model' });
            if (imageModelJson) {
                set({ selectedImageModel: JSON.parse(imageModelJson) });
            }
            const imageSizeValue: string | null = await invoke('get_config_value', { key: 'image_size' });
            if (imageSizeValue) {
                set({ imageSize: imageSizeValue });
            }
            const savedTheme: string | null = await invoke('get_config_value', { key: 'theme_mode' });
            if (savedTheme) {
                set({ themeMode: savedTheme as any });
            }
            const promptsJson: string | null = await invoke('get_config_value', { key: 'custom_prompts' });
            if (promptsJson) {
                set({ customPrompts: JSON.parse(promptsJson) });
            }
        } catch (e) {
            console.error('Failed to load initial config', e);
        }
    },
    themeMode: 'system',
    setThemeMode: (mode) => {
        set({ themeMode: mode });
        invoke('save_config', { key: 'theme_mode', value: mode }).catch(console.error);
    },
    trends: null,
    trendsLoading: false,
    fetchTrends: async () => {
        set({ trendsLoading: true });
        try {
            const result: any = await invoke('get_trends');
            if (result.code === 200) {
                set({ trends: result.data });
            }
        } catch (e) {
            console.error('Failed to fetch trends', e);
        } finally {
            set({ trendsLoading: false });
        }
    },
    customPrompts: [],
    addPrompt: (prompt) => {
        const { customPrompts } = useAppStore.getState();
        const newPrompts = [...customPrompts, prompt];
        set({ customPrompts: newPrompts });
        invoke('save_config', { key: 'custom_prompts', value: JSON.stringify(newPrompts) }).catch(console.error);
    },
    updatePrompt: (id, fields) => {
        const { customPrompts } = useAppStore.getState();
        const newPrompts = customPrompts.map(p => p.id === id ? { ...p, ...fields } : p);
        set({ customPrompts: newPrompts });
        invoke('save_config', { key: 'custom_prompts', value: JSON.stringify(newPrompts) }).catch(console.error);
    },
    deletePrompt: (id) => {
        const { customPrompts } = useAppStore.getState();
        const newPrompts = customPrompts.filter(p => p.id !== id);
        set({ customPrompts: newPrompts });
        invoke('save_config', { key: 'custom_prompts', value: JSON.stringify(newPrompts) }).catch(console.error);
    }
}));
