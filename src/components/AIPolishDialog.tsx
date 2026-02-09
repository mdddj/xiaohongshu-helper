import { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    Button,
    TextField,
    Box,
    Typography,
    Stack,
    CircularProgress,
    MenuItem,
    useTheme,
    IconButton,
    Fade,
    Menu
} from '@mui/material';
import { Sparkles, Wand2, RefreshCw, X, Quote, ChevronDown, Check } from 'lucide-react';
import { useAppStore } from '../store';
import { invoke } from '@tauri-apps/api/core';

interface AIPolishDialogProps {
    open: boolean;
    onClose: () => void;
    targetLabel: string;
    initialText: string;
    onApply: (text: string) => void;
}

export const AIPolishDialog = ({
    open,
    onClose,
    targetLabel,
    initialText,
    onApply
}: AIPolishDialogProps) => {
    const theme = useTheme();
    const { customPrompts, selectedTextModel, aiProviders } = useAppStore();

    const [localModel, setLocalModel] = useState<{ providerId: number; modelName: string } | null>(null);

    // Prepare available models list
    const availableModels = useMemo(() => {
        const models: any[] = [];
        aiProviders.forEach(p => {
            p.models.filter(m => m.model_type === 'text').forEach(m => {
                models.push({ providerId: p.id, providerName: p.name, modelName: m.name });
            });
        });
        return models;
    }, [aiProviders]);

    const [inputText, setInputText] = useState(initialText);
    const [selectedPromptId, setSelectedPromptId] = useState<string>('custom');
    const [customPromptContent, setCustomPromptContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultText, setResultText] = useState('');
    const [titleOptions, setTitleOptions] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [modelAnchorEl, setModelAnchorEl] = useState<null | HTMLElement>(null);

    // Update input text when dialog opens or initialText changes
    useEffect(() => {
        if (open) {
            setInputText(initialText);
            setResultText('');
            setTitleOptions([]);
            setError('');
            setLocalModel(selectedTextModel);
        }
    }, [open, initialText, selectedTextModel]);

    // Handle preset selection
    useEffect(() => {
        if (selectedPromptId !== 'custom') {
            const prompt = customPrompts.find(p => p.id === selectedPromptId);
            if (prompt) {
                setCustomPromptContent(prompt.content);
            }
        }
    }, [selectedPromptId, customPrompts]);

    const handleGenerate = async () => {
        if (!localModel) {
            setError('请选择一个有效的 AI 模型');
            return;
        }

        const provider = aiProviders.find(p => p.id === localModel.providerId);
        if (!provider) {
            setError('找不到所选模型的提供商配置');
            return;
        }

        // For titles, we don't strictly require custom prompts as we use the specialized command
        // But if user provided one, we might want to respect it? 
        // For now, let's stick to the structured output command for titles which has a fixed system prompt in backend
        // OR we can pass it if we update the backend.
        // The current backend `polish_title_with_options` uses a hardcoded system prompt for structure.
        // Let's use the new command for titles.

        if (targetLabel !== '标题' && !customPromptContent.trim()) {
            setError('请输入提示词或选择一个预设');
            return;
        }

        setLoading(true);
        setError('');
        setResultText('');
        setTitleOptions([]);

        try {
            if (targetLabel === '标题') {
                // Use new structured output command
                const options: string[] = await invoke('polish_title_with_options', {
                    title: inputText,
                    instruction: customPromptContent,
                    provider,
                    modelName: localModel.modelName
                });
                setTitleOptions(options);
                if (options.length > 0) {
                    setResultText(options[0]); // Default select first
                }
            } else {
                // Content generation
                let systemPrompt = customPromptContent;
                systemPrompt += "\n\n注意：请直接给出润色后的结果内容，不需要任何解释、开场白或引导语。";

                const fullResult: string = await invoke('generate_ai_text', {
                    prompt: inputText,
                    system: systemPrompt,
                    provider,
                    modelName: localModel.modelName
                });

                setResultText(fullResult);
            }
        } catch (e) {
            console.error(e);
            setError('AI 生成失败: ' + e);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        if (resultText) {
            onApply(resultText);
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                elevation: 0,
                sx: {
                    borderRadius: 6,
                    backgroundImage: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(30,30,35,0.95), rgba(20,20,22,0.98))'
                        : 'linear-gradient(135deg, #ffffff, #fcfcfd)',
                    backdropFilter: 'blur(24px)',
                    boxShadow: (theme) => theme.palette.mode === 'dark'
                        ? '0 20px 60px rgba(0,0,0,0.6)'
                        : '0 20px 60px rgba(0,0,0,0.1)',
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden'
                }
            }}
        >
            {/* Header */}
            <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{
                        width: 36, height: 36, borderRadius: '50%',
                        bgcolor: 'primary.main', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(255,36,66,0.3)'
                    }}>
                        <Sparkles size={20} />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>AI 智能润色</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary">优化 · {targetLabel} · </Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    cursor: 'pointer',
                                    color: 'primary.main',
                                    '&:hover': { opacity: 0.8 }
                                }}
                                onClick={(e) => setModelAnchorEl(e.currentTarget)}
                            >
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                    {localModel?.modelName || '选择模型'}
                                </Typography>
                                <ChevronDown size={12} />
                            </Box>
                        </Stack>
                    </Box>
                </Stack>
                <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary', bgcolor: (theme) => theme.palette.action.hover }}>
                    <X size={20} />
                </IconButton>

                {/* Model Selection Menu */}
                <Menu
                    anchorEl={modelAnchorEl}
                    open={Boolean(modelAnchorEl)}
                    onClose={() => setModelAnchorEl(null)}
                    PaperProps={{
                        elevation: 3,
                        sx: {
                            borderRadius: 3,
                            minWidth: 200,
                            maxHeight: 400,
                            overflowY: 'auto',
                            mt: 1,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            boxShadow: (theme) => theme.palette.mode === 'dark'
                                ? '0 10px 40px rgba(0,0,0,0.5)'
                                : '0 10px 40px rgba(0,0,0,0.1)'
                        }
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                    <Box sx={{ p: 1.5, pb: 0.5 }}>
                        <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', ml: 1 }}>
                            选择 AI 模型
                        </Typography>
                    </Box>
                    {availableModels.map((item, idx) => (
                        <MenuItem
                            key={idx}
                            selected={item.providerId === localModel?.providerId && item.modelName === localModel?.modelName}
                            onClick={() => {
                                const newModel = { providerId: item.providerId, modelName: item.modelName };
                                setLocalModel(newModel);
                                useAppStore.getState().setSelectedTextModel(newModel);
                                setModelAnchorEl(null);
                            }}
                            sx={{
                                borderRadius: 2,
                                mx: 1,
                                my: 0.5,
                                fontSize: 13,
                                transition: 'all 0.2s'
                            }}
                        >
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.modelName}</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.5, display: 'block' }}>{item.providerName}</Typography>
                                </Box>
                                {item.providerId === localModel?.providerId && item.modelName === localModel?.modelName && (
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                                )}
                            </Stack>
                        </MenuItem>
                    ))}
                    {availableModels.length === 0 && (
                        <MenuItem disabled sx={{ fontSize: 13 }}>没有可用的文本模型</MenuItem>
                    )}
                </Menu>
            </Box>

            <DialogContent sx={{ p: 0 }}>
                <Stack direction="row" sx={{ height: 500 }}>
                    {/* Left: Input & Prompt Settings (Scrollable) */}
                    <Box sx={{ flex: 1, p: 3, borderRight: `1px solid ${theme.palette.divider}`, overflowY: 'auto' }}>
                        <Stack spacing={3}>
                            {/* Prompt Selection */}
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Quote size={16} /> 润色指令
                                </Typography>
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    value={selectedPromptId}
                                    onChange={(e) => setSelectedPromptId(e.target.value)}
                                    sx={{ mb: 2 }}
                                >
                                    <MenuItem value="custom">✍️ 自定义指令</MenuItem>
                                    <MenuItem disabled divider>我的预设</MenuItem>
                                    {customPrompts.map((p) => (
                                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={4}
                                    placeholder="告诉 AI 怎么改..."
                                    value={customPromptContent}
                                    onChange={(e) => {
                                        setCustomPromptContent(e.target.value);
                                        if (selectedPromptId !== 'custom') setSelectedPromptId('custom');
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: (theme) => theme.palette.action.hover }
                                    }}
                                />
                            </Box>

                            {targetLabel === '标题' && (
                                <Box sx={{ p: 2, bgcolor: (theme) => theme.palette.action.hover, borderRadius: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        💡 标题润色将自动生成 5 个爆款备选标题，字数控制在 20 字以内，优化点击率。
                                    </Typography>
                                </Box>
                            )}
                        </Stack>
                    </Box>

                    {/* Right: Original Text & Result (Scrollable) */}
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ p: 3, flex: 1, overflowY: 'auto', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.01)' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block' }}>
                                原文
                            </Typography>
                            <Box sx={{
                                p: 2, borderRadius: 3, mb: 3,
                                bgcolor: (theme) => theme.palette.background.paper,
                                border: `1px solid ${theme.palette.divider}`
                            }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                                    {inputText || '(空)'}
                                </Typography>
                            </Box>

                            {/* Result Area */}
                            {loading ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5 }}>
                                    <CircularProgress size={30} thickness={4} sx={{ color: 'primary.main', mb: 2 }} />
                                    <Typography variant="body2" color="text.secondary">AI 正在疯狂输出中...</Typography>
                                </Box>
                            ) : (titleOptions.length > 0) ? (
                                <Fade in={true}>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, mb: 1, display: 'block' }}>
                                            AI 推荐标题 (点击选择)
                                        </Typography>
                                        <Stack spacing={1.5}>
                                            {titleOptions.map((option, idx) => (
                                                <Box
                                                    key={idx}
                                                    onClick={() => setResultText(option)}
                                                    sx={{
                                                        p: 2,
                                                        borderRadius: 3,
                                                        bgcolor: resultText === option ? 'rgba(255,36,66,0.08)' : (theme) => theme.palette.background.paper,
                                                        border: (theme) => `1px solid ${resultText === option ? theme.palette.primary.main : theme.palette.divider}`,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        '&:hover': {
                                                            borderColor: 'primary.main',
                                                            transform: 'translateX(4px)'
                                                        },
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1.5
                                                    }}
                                                >
                                                    <Box sx={{
                                                        width: 24, height: 24, borderRadius: '50%',
                                                        bgcolor: resultText === option ? 'primary.main' : 'transparent',
                                                        border: `1px solid ${resultText === option ? 'transparent' : '#ccc'}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#fff', fontSize: 12, fontWeight: 'bold'
                                                    }}>
                                                        {resultText === option && <Check size={14} />}
                                                    </Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{option}</Typography>
                                                </Box>
                                            ))}
                                        </Stack>
                                    </Box>
                                </Fade>
                            ) : resultText ? (
                                <Fade in={true}>
                                    <Box sx={{ position: 'relative' }}>
                                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, mb: 1, display: 'block' }}>
                                            AI 建议
                                        </Typography>
                                        <Box sx={{
                                            p: 3,
                                            borderRadius: 4,
                                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(30,30,35,0.6)' : '#fff',
                                            border: `1px solid ${theme.palette.primary.main}`,
                                            boxShadow: '0 8px 30px rgba(0,0,0,0.05)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <Box sx={{
                                                position: 'absolute', top: 0, left: 0, width: 4, height: '100%',
                                                bgcolor: 'primary.main'
                                            }} />
                                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                                                {resultText}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Fade>
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, opacity: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        点击生成，见证奇迹 ✨
                                    </Typography>
                                </Box>
                            )}

                            {error && <Typography color="error" variant="body2" sx={{ mt: 2 }}>{error}</Typography>}
                        </Box>

                        {/* Footer Actions */}
                        <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'flex-end', gap: 2, bgcolor: (theme) => theme.palette.background.paper }}>
                            {resultText ? (
                                <>
                                    <Button
                                        onClick={() => setResultText('')} // Or re-generate
                                        color="inherit"
                                        startIcon={<RefreshCw size={16} />}
                                    >
                                        不满意，重写
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleApply}
                                        sx={{ borderRadius: 3, px: 4, boxShadow: '0 8px 20px rgba(255,36,66,0.2)' }}
                                    >
                                        采用此版本
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="contained"
                                    onClick={handleGenerate}
                                    startIcon={<Wand2 size={18} />}
                                    disabled={loading || !inputText.trim()}
                                    sx={{
                                        borderRadius: 3,
                                        px: 4, py: 1,
                                        width: '100%',
                                        background: 'linear-gradient(45deg, #FF2442, #FF5E7C)',
                                        boxShadow: '0 8px 20px rgba(255,36,66,0.25)',
                                        '&:hover': {
                                            boxShadow: '0 10px 25px rgba(255,36,66,0.35)',
                                        },
                                        '&.Mui-disabled': {
                                            background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                            color: 'text.disabled'
                                        }
                                    }}
                                >
                                    开始智能润色
                                </Button>
                            )}
                        </Box>
                    </Box>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};
