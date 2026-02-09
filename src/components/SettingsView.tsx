import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    MenuItem,
    Divider,
    Button,
    IconButton,
    Paper,
    List,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    Stack,
    Avatar,
    ToggleButton,
    ToggleButtonGroup,
    Snackbar,
    Alert,
    SelectChangeEvent,
    Switch,
    FormControlLabel
} from '@mui/material';
import { Plus, Trash2, Edit2, X, Bot, Wand2, Monitor, Moon, Sun, Zap, Loader2, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { confirm, message } from '@tauri-apps/plugin-dialog';
import { AnalyticsAISelector } from './AnalyticsAISelector';

export const SettingsView = () => {
    const {
        aiProviders,
        setAIProviders,
        customPrompts,
        addPrompt,
        updatePrompt,
        deletePrompt,
        imageSize,
        setImageSize
    } = useAppStore();
    const [open, setOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<any>(null);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState({ id: '', name: '', content: '' });
    const [testingProvider, setTestingProvider] = useState<number | string | null>(null);
    const [testingModels, setTestingModels] = useState<Map<string, 'chat' | 'structured'>>(new Map());
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' }>({
        open: false,
        message: '',
        severity: 'info'
    });

    // 无头浏览器模式状态
    const [headlessMode, setHeadlessMode] = useState(true);

    // 自定义尺寸状态
    const [customWidth, setCustomWidth] = useState('1024');
    const [customHeight, setCustomHeight] = useState('1024');
    const [isCustomSize, setIsCustomSize] = useState(false);

    // 检查当前是否是自定义尺寸
    useEffect(() => {
        const presetSizes = ['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024'];
        if (!presetSizes.includes(imageSize)) {
            setIsCustomSize(true);
            const [w, h] = imageSize.split('x');
            setCustomWidth(w || '1024');
            setCustomHeight(h || '1024');
        } else {
            setIsCustomSize(false);
        }
    }, [imageSize]);

    const handleSizeChange = (e: SelectChangeEvent) => {
        const value = e.target.value;
        if (value === 'custom') {
            setIsCustomSize(true);
            setImageSize(`${customWidth}x${customHeight}`);
        } else {
            setIsCustomSize(false);
            setImageSize(value);
        }
    };

    const handleCustomSizeApply = () => {
        const width = parseInt(customWidth) || 1024;
        const height = parseInt(customHeight) || 1024;

        // 限制范围 256-2048
        const clampedWidth = Math.max(256, Math.min(2048, width));
        const clampedHeight = Math.max(256, Math.min(2048, height));

        setCustomWidth(clampedWidth.toString());
        setCustomHeight(clampedHeight.toString());
        setImageSize(`${clampedWidth}x${clampedHeight}`);
    };

    const fetchProviders = async () => {
        try {
            const providers = await invoke('get_ai_providers');
            setAIProviders(providers as any[]);
        } catch (e) {
            console.error('Failed to fetch providers', e);
        }
    };

    const loadHeadlessMode = async () => {
        try {
            const value = await invoke<string | null>('get_config_value', { key: 'headless_mode' });
            setHeadlessMode(value !== 'false'); // 默认 true
        } catch (e) {
            console.error('Failed to load headless mode', e);
        }
    };

    const handleHeadlessModeChange = async (enabled: boolean) => {
        try {
            await invoke('save_config', { key: 'headless_mode', value: enabled ? 'true' : 'false' });
            setHeadlessMode(enabled);
            setSnackbar({
                open: true,
                message: `已${enabled ? '启用' : '禁用'}无头浏览器模式`,
                severity: 'success'
            });
        } catch (e) {
            setSnackbar({
                open: true,
                message: `保存失败: ${e}`,
                severity: 'error'
            });
        }
    };

    useEffect(() => {
        fetchProviders();
        loadHeadlessMode();
    }, []);

    const handleAddProvider = () => {
        setEditingProvider({
            name: '',
            api_key: '',
            base_url: 'https://api.openai.com/v1',
            models: []
        });
        setOpen(true);
    };

    const handleEditProvider = (provider: any) => {
        setEditingProvider({ ...provider });
        setOpen(true);
    };

    const handleDeleteProvider = async (id: number) => {
        const confirmed = await confirm('确定要删除这个提供商吗？', {
            title: '删除提供商',
            kind: 'warning'
        });
        if (confirmed) {
            try {
                await invoke('delete_ai_provider', { id });
                fetchProviders();
            } catch (e) {
                await message('删除失败: ' + e, { title: '错误', kind: 'error' });
            }
        }
    };

    const handleSaveProvider = async () => {
        try {
            await invoke('save_ai_provider', { provider: editingProvider });
            setOpen(false);
            fetchProviders();
        } catch (e) {
            await message('保存失败: ' + e, { title: '错误', kind: 'error' });
        }
    };

    const handleTestProvider = async (provider: any) => {
        setTestingProvider(provider.id || 'new');

        try {
            const response = await invoke('test_ai_provider', { provider });
            setSnackbar({
                open: true,
                message: `连接成功！AI 响应: ${response}`,
                severity: 'success'
            });
        } catch (e) {
            setSnackbar({
                open: true,
                message: `连接失败: ${e}`,
                severity: 'error'
            });
        } finally {
            setTestingProvider(null);
        }
    };

    const handleTestModelChat = async (modelName: string) => {
        const key = `${editingProvider.id || 'new'}-${modelName}`;
        setTestingModels(prev => new Map(prev).set(key, 'chat'));

        try {
            const result: any = await invoke('test_model_chat', {
                provider: editingProvider,
                modelName
            });

            if (result.success) {
                setSnackbar({
                    open: true,
                    message: `${modelName}: 对话测试成功`,
                    severity: 'success'
                });
            } else {
                setSnackbar({
                    open: true,
                    message: `${modelName}: ${result.error_message}`,
                    severity: 'error'
                });
            }
        } catch (e) {
            setSnackbar({
                open: true,
                message: `${modelName}: 测试失败 - ${e}`,
                severity: 'error'
            });
        } finally {
            setTestingModels(prev => {
                const newMap = new Map(prev);
                newMap.delete(key);
                return newMap;
            });
        }
    };

    const handleTestModelStructured = async (modelName: string) => {
        const key = `${editingProvider.id || 'new'}-${modelName}`;
        setTestingModels(prev => new Map(prev).set(key, 'structured'));

        try {
            const result: any = await invoke('test_model_structured_output', {
                provider: editingProvider,
                modelName
            });

            if (result.success) {
                setSnackbar({
                    open: true,
                    message: `${modelName}: 结构化输出测试成功`,
                    severity: 'success'
                });
            } else {
                setSnackbar({
                    open: true,
                    message: `${modelName}: ${result.error_message}`,
                    severity: 'error'
                });
            }
        } catch (e) {
            setSnackbar({
                open: true,
                message: `${modelName}: 测试失败 - ${e}`,
                severity: 'error'
            });
        } finally {
            setTestingModels(prev => {
                const newMap = new Map(prev);
                newMap.delete(key);
                return newMap;
            });
        }
    };

    const addModel = () => {
        const newModels = [...editingProvider.models, { name: '', model_type: 'text' }];
        setEditingProvider({ ...editingProvider, models: newModels });
    };

    const updateModel = (index: number, fields: any) => {
        const newModels = [...editingProvider.models];
        newModels[index] = { ...newModels[index], ...fields };
        setEditingProvider({ ...editingProvider, models: newModels });
    };

    const removeModel = (index: number) => {
        const newModels = [...editingProvider.models];
        newModels.splice(index, 1);
        setEditingProvider({ ...editingProvider, models: newModels });
    };

    return (
        <Box sx={{ maxWidth: 900, mx: 'auto', p: 4 }}>
            {/* 通用设置 */}
            <Box sx={{ mb: 8 }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>通用设置</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        自定义你的创作环境。
                    </Typography>
                </Box>

                <Stack spacing={3}>
                    {/* 外观模式 */}
                    <Paper
                        sx={{
                            p: 3,
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            borderRadius: 6,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>外观模式</Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.7 }}>
                                    切换浅色、深色或跟随系统的视觉体验。
                                </Typography>
                            </Box>
                            <ToggleButtonGroup
                                value={useAppStore((state) => state.themeMode)}
                                exclusive
                                onChange={(_, val) => val && useAppStore.getState().setThemeMode(val)}
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                                    p: 0.5,
                                    borderRadius: 4,
                                    border: (theme) => `1px solid ${theme.palette.divider}`,
                                    '& .MuiToggleButton-root': {
                                        border: 'none',
                                        borderRadius: 3,
                                        px: 2,
                                        py: 1,
                                        color: 'text.secondary',
                                        '&.Mui-selected': {
                                            bgcolor: 'primary.main',
                                            color: '#fff',
                                            '&:hover': { bgcolor: 'primary.dark' }
                                        }
                                    }
                                }}
                            >
                                <ToggleButton value="light">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Sun size={16} />
                                        <Typography variant="caption" fontWeight={700}>亮色</Typography>
                                    </Stack>
                                </ToggleButton>
                                <ToggleButton value="dark">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Moon size={16} />
                                        <Typography variant="caption" fontWeight={700}>深色</Typography>
                                    </Stack>
                                </ToggleButton>
                                <ToggleButton value="system">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Monitor size={16} />
                                        <Typography variant="caption" fontWeight={700}>自动</Typography>
                                    </Stack>
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Paper>

                    {/* 无头浏览器模式 */}
                    <Paper
                        sx={{
                            p: 3,
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            borderRadius: 6,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {headlessMode ? <EyeOff size={20} /> : <Eye size={20} />}
                                    无头浏览器模式
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.7, display: 'block', mb: 0.5 }}>
                                    {headlessMode
                                        ? '浏览器在后台运行，不显示窗口（推荐）'
                                        : '显示浏览器窗口，便于调试和观察操作过程'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'warning.main', fontSize: 11, fontWeight: 600 }}>
                                    💡 提示：修改此设置后，下次启动应用生效
                                </Typography>
                            </Box>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={headlessMode}
                                        onChange={(e) => handleHeadlessModeChange(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label={headlessMode ? '已启用' : '已禁用'}
                                sx={{ m: 0 }}
                            />
                        </Box>
                    </Paper>

                    {/* AI 生图尺寸 */}
                    <Paper
                        sx={{
                            p: 3,
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            borderRadius: 6,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ImageIcon size={20} />
                                        AI 生图尺寸
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.7 }}>
                                        设置 AI 生成图片的默认尺寸，适配不同平台需求。
                                    </Typography>
                                </Box>
                                <FormControl sx={{ minWidth: 200 }}>
                                    <Select
                                        value={isCustomSize ? 'custom' : imageSize}
                                        onChange={handleSizeChange}
                                        size="small"
                                        sx={{
                                            borderRadius: 3,
                                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: (theme) => theme.palette.divider
                                            }
                                        }}
                                    >
                                        <MenuItem value="256x256">256 × 256 (小图)</MenuItem>
                                        <MenuItem value="512x512">512 × 512 (中图)</MenuItem>
                                        <MenuItem value="1024x1024">1024 × 1024 (标准)</MenuItem>
                                        <MenuItem value="1024x1792">1024 × 1792 (竖版)</MenuItem>
                                        <MenuItem value="1792x1024">1792 × 1024 (横版)</MenuItem>
                                        <MenuItem value="custom">自定义尺寸</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            {/* 自定义尺寸输入框 */}
                            {isCustomSize && (
                                <Box sx={{
                                    mt: 2,
                                    p: 2.5,
                                    borderRadius: 4,
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,36,66,0.05)' : 'rgba(255,36,66,0.03)',
                                    border: '1px solid',
                                    borderColor: 'primary.main',
                                    borderStyle: 'dashed'
                                }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', mb: 1.5, display: 'block' }}>
                                        自定义图片尺寸 (256-2048 像素)
                                    </Typography>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <TextField
                                            label="宽度"
                                            type="number"
                                            size="small"
                                            value={customWidth}
                                            onChange={(e) => setCustomWidth(e.target.value)}
                                            inputProps={{ min: 256, max: 2048, step: 64 }}
                                            sx={{
                                                flex: 1,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : '#fff'
                                                }
                                            }}
                                        />
                                        <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 800 }}>×</Typography>
                                        <TextField
                                            label="高度"
                                            type="number"
                                            size="small"
                                            value={customHeight}
                                            onChange={(e) => setCustomHeight(e.target.value)}
                                            inputProps={{ min: 256, max: 2048, step: 64 }}
                                            sx={{
                                                flex: 1,
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : '#fff'
                                                }
                                            }}
                                        />
                                        <Button
                                            variant="contained"
                                            onClick={handleCustomSizeApply}
                                            sx={{
                                                borderRadius: 2,
                                                px: 3,
                                                fontWeight: 700
                                            }}
                                        >
                                            应用
                                        </Button>
                                    </Stack>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1.5, display: 'block', fontSize: 11 }}>
                                        💡 提示：当前尺寸 {imageSize}，建议使用 64 的倍数以获得最佳效果
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Stack>
            </Box>

            <Divider sx={{ mb: 8, opacity: 0.5 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 6 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>AI 配置</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        配置多个 AI 模型供应商，为创作注入源源不断的动力。
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Plus size={18} />}
                    onClick={handleAddProvider}
                    sx={{ borderRadius: 3 }}
                >
                    新增提供商
                </Button>
            </Box>

            <List sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {aiProviders.map((provider) => (
                    <Paper
                        key={provider.id}
                        sx={{
                            p: 3,
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            borderRadius: 6,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderColor: 'primary.main' }
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800 }}>
                                    <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 14 }}>
                                        {provider.name.charAt(0)}
                                    </Avatar>
                                    {provider.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block', opacity: 0.6 }}>
                                    API Endpoint: {provider.base_url}
                                </Typography>
                                <Box sx={{ mt: 2.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {provider.models.map((m, idx) => (
                                        <Chip
                                            key={idx}
                                            label={m.name}
                                            size="small"
                                            icon={m.model_type === 'text' ? <Bot size={12} /> : <Wand2 size={12} />}
                                            sx={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
                                                borderRadius: 2,
                                                px: 0.5
                                            }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <IconButton
                                    onClick={() => handleTestProvider(provider)}
                                    disabled={testingProvider !== null}
                                    sx={{ color: 'primary.main' }}
                                >
                                    {testingProvider === provider.id ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                                </IconButton>
                                <IconButton onClick={() => handleEditProvider(provider)} sx={{ color: 'text.secondary' }}>
                                    <Edit2 size={18} />
                                </IconButton>
                                <IconButton onClick={() => handleDeleteProvider(provider.id!)} sx={{ color: 'text.secondary', opacity: 0.5, '&:hover': { color: 'error.main', opacity: 1 } }}>
                                    <Trash2 size={18} />
                                </IconButton>
                            </Box>
                        </Box>
                    </Paper>
                ))}
                {aiProviders.length === 0 && (
                    <Box sx={{
                        py: 12,
                        textAlign: 'center',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                        borderRadius: 8,
                        border: (theme) => `1.5px dashed ${theme.palette.divider}`
                    }}>
                        <Bot size={48} style={{ color: 'text.disabled', opacity: 0.2, marginBottom: 20 }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            准备好接入 AI 了吗？
                        </Typography>
                        <Button variant="text" sx={{ mt: 2 }} onClick={handleAddProvider}>立刻添加第一个提供商</Button>
                    </Box>
                )}
            </List>

            {/* 数据分析 AI 配置 */}
            <Divider sx={{ my: 8, opacity: 0.5 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 6 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>数据分析 AI</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        配置用于分析用户数据的 AI 模型，支持任何文本模型。
                    </Typography>
                </Box>
            </Box>

            <AnalyticsAISelector
                aiProviders={aiProviders}
                setSnackbar={setSnackbar}
            />

            {/* 自定义提示词 */}
            <Divider sx={{ my: 8, opacity: 0.5 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 6 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>自定义提示词</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        预设常用指令，让创作更高效。
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Plus size={18} />}
                    onClick={() => {
                        setEditingPrompt({ id: '', name: '', content: '' });
                        setPromptDialogOpen(true);
                    }}
                    sx={{ borderRadius: 3 }}
                >
                    新增提示词
                </Button>
            </Box>

            <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {customPrompts.map((prompt) => (
                    <Paper
                        key={prompt.id}
                        sx={{
                            p: 3,
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            borderRadius: 4,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s',
                            '&:hover': {
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                                borderColor: 'primary.main'
                            }
                        }}
                    >
                        <Box sx={{ flex: 1, mr: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                                {prompt.name}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    fontSize: 13
                                }}
                            >
                                {prompt.content}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton
                                onClick={() => {
                                    setEditingPrompt(prompt);
                                    setPromptDialogOpen(true);
                                }}
                                sx={{ color: 'text.secondary' }}
                            >
                                <Edit2 size={18} />
                            </IconButton>
                            <IconButton
                                onClick={async () => {
                                    const confirmed = await confirm('确定要删除这个提示词吗？', {
                                        title: '删除提示词',
                                        kind: 'warning'
                                    });
                                    if (confirmed) {
                                        deletePrompt(prompt.id);
                                    }
                                }}
                                sx={{ color: 'text.secondary', opacity: 0.5, '&:hover': { color: 'error.main', opacity: 1 } }}
                            >
                                <Trash2 size={18} />
                            </IconButton>
                        </Box>
                    </Paper>
                ))}
            </List>

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingProvider?.id ? '编辑提供商' : '新增提供商'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <TextField
                            label="提供商名称"
                            fullWidth
                            value={editingProvider?.name || ''}
                            onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                            placeholder="例如: DeepSeek, OpenAI"
                        />
                        <TextField
                            label="API Key"
                            type="password"
                            fullWidth
                            value={editingProvider?.api_key || ''}
                            onChange={(e) => setEditingProvider({ ...editingProvider, api_key: e.target.value })}
                            placeholder="sk-..."
                        />
                        <TextField
                            label="API 接口地址"
                            fullWidth
                            value={editingProvider?.base_url || ''}
                            onChange={(e) => setEditingProvider({ ...editingProvider, base_url: e.target.value })}
                            placeholder="https://api.openai.com/v1"
                        />

                        <Divider>模型列表</Divider>

                        {editingProvider?.models.map((model: any, index: number) => {
                            const key = `${editingProvider.id || 'new'}-${model.name}`;
                            const testingType = testingModels.get(key);
                            const isTesting = testingType !== undefined;

                            return (
                                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <TextField
                                        label="模型名称"
                                        size="small"
                                        sx={{ flex: 2 }}
                                        value={model.name}
                                        onChange={(e) => updateModel(index, { name: e.target.value })}
                                        placeholder="gpt-4o-mini"
                                    />
                                    <FormControl size="small" sx={{ flex: 1 }}>
                                        <InputLabel>类型</InputLabel>
                                        <Select
                                            label="类型"
                                            value={model.model_type}
                                            onChange={(e) => updateModel(index, { model_type: e.target.value })}
                                        >
                                            <MenuItem value="text">文本</MenuItem>
                                            <MenuItem value="image">图片</MenuItem>
                                        </Select>
                                    </FormControl>
                                    {model.model_type === 'text' && model.name && (
                                        <>
                                            <IconButton
                                                onClick={() => handleTestModelChat(model.name)}
                                                disabled={isTesting}
                                                size="small"
                                                title="测试对话"
                                                sx={{
                                                    color: 'primary.main',
                                                    width: 28,
                                                    height: 28
                                                }}
                                            >
                                                {testingType === 'chat' ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Zap size={14} />
                                                )}
                                            </IconButton>
                                            <IconButton
                                                onClick={() => handleTestModelStructured(model.name)}
                                                disabled={isTesting}
                                                size="small"
                                                title="测试结构化输出"
                                                sx={{
                                                    color: 'success.main',
                                                    width: 28,
                                                    height: 28
                                                }}
                                            >
                                                {testingType === 'structured' ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Bot size={14} />
                                                )}
                                            </IconButton>
                                        </>
                                    )}
                                    <IconButton onClick={() => removeModel(index)} color="error" size="small">
                                        <X size={18} />
                                    </IconButton>
                                </Box>
                            );
                        })}

                        <Button startIcon={<Plus size={16} />} onClick={addModel} size="small">
                            添加模型
                        </Button>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => handleTestProvider(editingProvider)}
                        disabled={testingProvider !== null || !editingProvider?.api_key}
                        startIcon={testingProvider === 'new' ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    >
                        测试连接
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button onClick={() => setOpen(false)}>取消</Button>
                    <Button variant="contained" onClick={handleSaveProvider}>保存</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={promptDialogOpen} onClose={() => setPromptDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingPrompt?.id ? '编辑提示词' : '新增提示词'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <TextField
                            label="名称"
                            fullWidth
                            value={editingPrompt?.name || ''}
                            onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                            placeholder="例如: 小红书爆款文案"
                        />
                        <TextField
                            label="提示词内容"
                            multiline
                            rows={6}
                            fullWidth
                            value={editingPrompt?.content || ''}
                            onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                            placeholder="请输入详细的 System Prompt..."
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPromptDialogOpen(false)}>取消</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (editingPrompt.id) {
                                updatePrompt(editingPrompt.id, editingPrompt);
                            } else {
                                addPrompt({ ...editingPrompt, id: Date.now().toString() });
                            }
                            setPromptDialogOpen(false);
                        }}
                        disabled={!editingPrompt.name || !editingPrompt.content}
                    >
                        保存
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%', borderRadius: 4 }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};
