import { useState, useEffect } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    CircularProgress,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Stack,
    Divider,
    Tooltip,
    InputAdornment
} from '@mui/material';
import { SxProps, Theme } from '@mui/material';
import { Sparkles, Send, Plus, X, Image as ImageIcon, Wand2, Bot, ChevronDown, Flame, Settings as SettingsIcon, Layout as LayoutIcon, LayoutTemplate } from 'lucide-react';
import { useAppStore } from '../store';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open, message } from '@tauri-apps/plugin-dialog';
import { AssetSelectorDialog } from './AssetSelectorDialog';
import { AIPolishDialog } from './AIPolishDialog';
import { ImagePromptDialog } from './ImagePromptDialog';
import { TrendsPopover } from './TrendsPopover';
import {
    aiButtonStyles,
    trendButtonStyles,
    gradientTitleStyles,
    imageBoxStyles,
    deleteIconButtonStyles,
    getBorderedButtonStyles,
    getThemedBgStyles
} from '../styles/commonStyles';

// ============================================
// 组件级样式常量
// ============================================

const coverImageButtonStyles: SxProps<Theme> = {
    width: 180,
    height: 144,
    border: '1.5px dashed',
    borderRadius: 5,
    flexDirection: 'column',
    color: 'text.secondary',
    overflow: 'hidden',
    p: 0,
    position: 'relative',
    ...getThemedBgStyles('rgba(255,255,255,0.02)', 'rgba(0,0,0,0.02)'),
    boxShadow: (theme) => theme.palette.mode === 'dark'
        ? '0 20px 60px rgba(0,0,0,0.5)'
        : '0 20px 60px rgba(0,0,0,0.15)',
    '&:hover': {
        borderColor: 'primary.main',
        bgcolor: (theme) => theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(0,0,0,0.04)',
        transform: 'translateY(-2px)',
        boxShadow: (theme) => theme.palette.mode === 'dark'
            ? '0 30px 80px rgba(0,0,0,0.7)'
            : '0 30px 80px rgba(0,0,0,0.25)'
    },
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
};

const coverBadgeStyles: SxProps<Theme> = {
    position: 'absolute',
    top: 8,
    left: 8,
    bgcolor: 'primary.main',
    color: '#fff',
    px: 1,
    py: 0.2,
    borderRadius: 1,
    fontSize: 9,
    fontWeight: 800,
    boxShadow: '0 2px 8px rgba(255,36,66,0.5)'
};

const imageUploadContainerStyles: SxProps<Theme> = {
    display: 'flex',
    flexDirection: 'row',
    width: 280,
    height: 144,
    gap: 1.2,
    p: 1.2,
    ...getThemedBgStyles('rgba(255,255,255,0.02)', 'rgba(0,0,0,0.02)'),
    borderRadius: 5,
    border: (theme) => `1px solid ${theme.palette.divider}`,
    boxShadow: (theme) => theme.palette.mode === 'dark'
        ? '0 20px 60px rgba(0,0,0,0.5)'
        : '0 20px 60px rgba(0,0,0,0.15)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
};

const localUploadButtonStyles: SxProps<Theme> = {
    flex: 1.2,
    height: '100%',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    ...getThemedBgStyles('rgba(255,255,255,0.03)', '#fff'),
    border: (theme) => `1px solid ${theme.palette.divider}`,
    color: 'text.primary',
    '&:hover': {
        bgcolor: 'primary.main',
        color: '#fff',
        borderColor: 'primary.main'
    }
};

const iconButtonContainerStyles: SxProps<Theme> = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5
};

const libraryButtonStyles: SxProps<Theme> = {
    flex: 1,
    borderRadius: 3.5,
    ...getThemedBgStyles('rgba(255,255,255,0.03)', '#fff'),
    border: (theme) => `1px solid ${theme.palette.divider}`,
    color: 'text.secondary',
    minWidth: 0,
    '&:hover': {
        color: 'primary.main',
        borderColor: 'primary.main',
        bgcolor: 'rgba(255,36,66,0.05)'
    }
};

const aiImageButtonStyles: SxProps<Theme> = {
    flex: 1,
    borderRadius: 3.5,
    bgcolor: 'rgba(255,36,66,0.1)',
    border: '1px solid rgba(255,36,66,0.2)',
    color: 'primary.main',
    minWidth: 0,
    position: 'relative',
    '&:hover': {
        bgcolor: 'primary.main',
        color: '#fff',
        borderColor: 'primary.main'
    }
};

const modelIndicatorStyles: SxProps<Theme> = {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: '50%',
    border: '1px solid #fff'
};

const modelSelectorStyles: SxProps<Theme> = {
    position: 'absolute',
    bottom: -22,
    left: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    cursor: 'pointer',
    '&:hover opacity': 1
};

const editorInputStyles: SxProps<Theme> = {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: 'text.primary',
    mb: 3
};

const contentInputStyles: SxProps<Theme> = {
    fontSize: '1.05rem',
    lineHeight: 1.8,
    color: 'text.primary'
};

const absoluteIconButtonStyles: SxProps<Theme> = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    ...aiButtonStyles
};

const secondaryIconButtonStyles: SxProps<Theme> = {
    position: 'absolute',
    bottom: 0,
    right: 44,
    ...trendButtonStyles
};

export const PublishView = () => {
    const {
        currentPost,
        setCurrentPost,
        aiProviders,
        setAIProviders,
        selectedTextModel,
        setSelectedTextModel,
        selectedImageModel,
        setSelectedImageModel,
        setActiveTab,
        currentUser,
        trends,
        fetchTrends,
        trendsLoading
    } = useAppStore();

    const [loading, setLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const [textAnchorEl, setTextAnchorEl] = useState<null | HTMLElement>(null);
    const [imageAnchorEl, setImageAnchorEl] = useState<null | HTMLElement>(null);

    const [imgDialogOpen, setImgDialogOpen] = useState(false);
    const [assetSelectorOpen, setAssetSelectorOpen] = useState(false);
    const [selectorMode, setSelectorMode] = useState<'cover' | 'image'>('image');

    // AI Polish State
    const [polishDialogOpen, setPolishDialogOpen] = useState(false);
    const [polishTarget, setPolishTarget] = useState<'title' | 'content'>('title');

    // Trend Popover State
    const [trendAnchorEl, setTrendAnchorEl] = useState<null | HTMLElement>(null);
    const [trendTarget, setTrendTarget] = useState<'title' | 'content'>('title');

    const handleOpenTrends = (event: React.MouseEvent<HTMLElement>, target: 'title' | 'content') => {
        setTrendAnchorEl(event.currentTarget);
        setTrendTarget(target);
        if (!trends || Object.keys(trends).length === 0) {
            fetchTrends();
        }
    };

    const handleSelectTrend = (trendTitle: string) => {
        const tag = ` #${trendTitle} `;
        if (trendTarget === 'title') {
            setCurrentPost({ title: (currentPost.title || '').trim() + tag });
        } else {
            setCurrentPost({ content: (currentPost.content || '').trim() + tag });
        }
    };

    const fetchProviders = async () => {
        try {
            const providers = await invoke('get_ai_providers');
            setAIProviders(providers as any[]);
        } catch (e) {
            console.error('Failed to fetch providers', e);
        }
    };

    useEffect(() => {
        if (aiProviders.length === 0) {
            fetchProviders();
        }
    }, []);

    // Helper to find provider by id
    const getProvider = (id: number) => aiProviders.find(p => p.id === id);

    const handleAICompose = async () => {
        if (!currentPost.title?.trim()) {
            await message('请先输入一个吸引人的标题', { title: '提示', kind: 'info' });
            return;
        }

        if (!selectedTextModel) {
            await message('请先选择一个文本生成模型 (点击按钮旁边的箭头)', { title: '提示', kind: 'info' });
            return;
        }
        const provider = getProvider(selectedTextModel.providerId);
        if (!provider) return;

        setLoading(true);
        try {
            const systemPrompt = `你是一位精通小红书运营的爆款文案专家。
请根据用户提供的标题，创作一篇极具吸引力的小红书正文。

要求：
1. **直接输出正文**：不要包含任何开场白（如“好的”、“没问题”）、结束语或 AI 的自我介绍。将生成的文本直接填入编辑器使用。
2. **结构化排版**：内容应包含吸引人的开头、更有价值的干货要点（使用 emoji 增强可读性）以及引导互动的结尾。
3. **话题标签**：在文案末尾附带 5-10 个精准的热门话题标签（以 # 开头）。
4. **语气亲切**：使用小红书特色的亲切语气（如“亲爱的们”、“集美们”、“真的绝了”等）。

当前标题：${currentPost.title}`;

            const result: string = await invoke('generate_ai_text', {
                prompt: "请开始创作：",
                system: systemPrompt,
                provider,
                modelName: selectedTextModel.modelName
            });
            setCurrentPost({ content: result });
        } catch (e) {
            console.error(e);
            await message('AI 生成失败: ' + e, { title: '错误', kind: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateImage = async () => {
        if (!selectedImageModel) {
            await message('请先选择一个生图模型 (点击按钮旁边的箭头)', { title: '提示', kind: 'info' });
            return;
        }
        setImgDialogOpen(true);
    };

    const handleSelectImages = async () => {
        const selected = await open({
            multiple: true,
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
        });
        if (selected && Array.isArray(selected)) {
            setCurrentPost({ images: [...currentPost.images, ...selected] });
        } else if (selected) {
            setCurrentPost({ images: [...currentPost.images, selected as string] });
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...currentPost.images];
        const removed = newImages.splice(index, 1)[0];
        const newPost: any = { images: newImages };
        // If removed image was cover, clear cover
        if (currentPost.coverImage === removed) {
            newPost.coverImage = undefined;
        }
        setCurrentPost(newPost);
    };

    const handleSelectFromLibrary = (path: string) => {
        if (selectorMode === 'cover') {
            setCurrentPost({ coverImage: path });
        } else {
            if (currentPost.images.length < 9) {
                setCurrentPost({ images: [...currentPost.images, path] });
            }
        }
    };
    const handlePublish = async () => {
        if (!currentUser) {
            await message('请先登录账号', { title: '提示', kind: 'info' });
            return;
        }
        if (!currentPost.title || !currentPost.content) {
            await message('请填写标题和正文', { title: '提示', kind: 'info' });
            return;
        }

        setPublishing(true);
        try {
            await invoke('publish_post', {
                phone: currentUser.phone,
                title: currentPost.title,
                content: currentPost.content,
                images: currentPost.images,
                coverImage: currentPost.coverImage
            });
            await message('发布流程已启动，请观察浏览器操作', { title: '发布中', kind: 'info' });
        } catch (e) {
            await message('发布失败: ' + e, { title: '错误', kind: 'error' });
        } finally {
            setPublishing(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!currentUser) {
            await message('请先登录账号', { title: '提示', kind: 'info' });
            return;
        }
        try {
            const id: number = await invoke('save_post', {
                userId: currentUser.id,
                title: currentPost.title,
                content: currentPost.content,
                images: currentPost.images,
                coverImage: currentPost.coverImage
            });
            setCurrentPost({ id });
            useAppStore.getState().fetchDrafts();
            await message('草稿已保存', { title: '成功', kind: 'info' });
        } catch (e) {
            await message('保存草稿失败: ' + e, { title: '错误', kind: 'error' });
        }
    };

    const handleOpenPolish = async (target: 'title' | 'content') => {
        if (!selectedTextModel) {
            await message('请先选择一个文本模型', { title: '提示', kind: 'info' });
            return;
        }
        setPolishTarget(target);
        setPolishDialogOpen(true);
    };

    const renderModelMenu = (type: 'text' | 'image', anchorEl: HTMLElement | null, setAnchorEl: any, selectedModel: any, setSelectedModel: any) => {
        const availableModels: any[] = [];
        aiProviders.forEach(p => {
            p.models.filter(m => m.model_type === type).forEach(m => {
                availableModels.push({ providerId: p.id, providerName: p.name, modelName: m.name });
            });
        });

        return (
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                {availableModels.length === 0 ? (
                    <MenuItem disabled>没有可用的{type === 'text' ? '文本' : '生图'}模型</MenuItem>
                ) : (
                    availableModels.map((item, idx) => (
                        <MenuItem
                            key={idx}
                            onClick={() => {
                                setSelectedModel({ providerId: item.providerId, modelName: item.modelName });
                                setAnchorEl(null);
                            }}
                            selected={selectedModel?.providerId === item.providerId && selectedModel?.modelName === item.modelName}
                        >
                            <ListItemIcon>
                                {type === 'text' ? <Bot size={18} /> : <Wand2 size={18} />}
                            </ListItemIcon>
                            <ListItemText primary={item.modelName} secondary={item.providerName} />
                        </MenuItem>
                    ))
                )}
                <Divider />
                <MenuItem onClick={() => { setActiveTab('settings'); setAnchorEl(null); }}>
                    <ListItemIcon><SettingsIcon size={18} /></ListItemIcon>
                    <ListItemText primary="去设置中添加模型" />
                </MenuItem>
            </Menu>
        );
    };

    return (
        <Box sx={{ maxWidth: 900, mx: 'auto', p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
                <Typography variant="h5" sx={gradientTitleStyles}>
                    创作空间
                </Typography>
                <Stack direction="row" spacing={1.5}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={handleSaveDraft}
                        sx={getBorderedButtonStyles()}
                    >
                        存草稿
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={publishing ? <CircularProgress size={18} color="inherit" /> : <Send size={18} />}
                        onClick={handlePublish}
                        disabled={publishing}
                    >
                        {publishing ? '准备发布' : '发布笔记'}
                    </Button>
                </Stack>
            </Stack>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {/* Image Section */}
                <Box>
                    <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ImageIcon size={16} /> 图片素材 ({currentPost.images.length}/9)
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {/* Cover Image Placeholder/Selection */}
                        <Box sx={{ gridColumn: 'span 1', gridRow: 'span 1' }}>
                            <Button
                                onClick={() => { setSelectorMode('cover'); setAssetSelectorOpen(true); }}
                                sx={{
                                    ...coverImageButtonStyles,
                                    borderColor: currentPost.coverImage ? 'primary.main' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                }}
                            >
                                {currentPost.coverImage ? (
                                    <img
                                        src={convertFileSrc(currentPost.coverImage)}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <>
                                        <LayoutTemplate size={28} />
                                        <Typography variant="body2" sx={{ mt: 1, fontWeight: 800 }}>设置封面</Typography>
                                    </>
                                )}
                                <Box sx={coverBadgeStyles}>
                                    COVER
                                </Box>
                            </Button>
                        </Box>

                        {currentPost.images.map((img, index) => (
                            <Box key={index} sx={imageBoxStyles}>
                                <img
                                    src={img.startsWith('http') ? img : convertFileSrc(img)}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                                />
                                <IconButton
                                    size="small"
                                    onClick={() => removeImage(index)}
                                    sx={deleteIconButtonStyles}
                                >
                                    <X size={14} strokeWidth={3} />
                                </IconButton>
                            </Box>
                        ))}

                        {currentPost.images.length < 9 && (
                            <Box sx={imageUploadContainerStyles}>
                                <Button
                                    onClick={handleSelectImages}
                                    sx={localUploadButtonStyles}
                                >
                                    <Plus size={28} />
                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>本地上传</Typography>
                                </Button>

                                <Box sx={iconButtonContainerStyles}>
                                    <Tooltip title="从素材库选择">
                                        <Button
                                            onClick={() => { setSelectorMode('image'); setAssetSelectorOpen(true); }}
                                            sx={libraryButtonStyles}
                                        >
                                            <LayoutIcon size={20} />
                                        </Button>
                                    </Tooltip>

                                    <Tooltip title={`AI 生图: ${selectedImageModel?.modelName || '未选择'}`}>
                                        <Button
                                            onClick={handleGenerateImage}
                                            disabled={!selectedImageModel}
                                            sx={aiImageButtonStyles}
                                        >
                                            <Sparkles size={20} />
                                            <Box sx={{
                                                ...modelIndicatorStyles,
                                                bgcolor: selectedImageModel ? 'primary.main' : 'text.disabled'
                                            }} />
                                        </Button>
                                    </Tooltip>
                                </Box>

                                <Box sx={modelSelectorStyles} onClick={(e: React.MouseEvent<HTMLElement>) => setImageAnchorEl(e.currentTarget)}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, fontWeight: 700, opacity: 0.6 }}>
                                        AI: {selectedImageModel?.modelName || '点击配置'}
                                    </Typography>
                                    <ChevronDown size={10} style={{ opacity: 0.6 }} />
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Box>

                {/* Editor Content */}
                <Box sx={{
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    p: 4,
                    borderRadius: 6,
                    border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    position: 'relative' // For absolute positioning of content AI button
                }}>
                    <TextField
                        fullWidth
                        placeholder="输入一个吸引人的标题..."
                        variant="standard"
                        value={currentPost.title}
                        onChange={(e) => setCurrentPost({ title: e.target.value })}
                        InputProps={{
                            disableUnderline: true,
                            sx: editorInputStyles,
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Tooltip title={currentPost.title?.trim() ? "AI 润色标题" : "请先输入标题"}>
                                        <span>
                                            <IconButton
                                                onClick={() => handleOpenPolish('title')}
                                                disabled={!currentPost.title?.trim()}
                                                sx={{ ...aiButtonStyles, mr: 1 }}
                                            >
                                                <Sparkles size={18} />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="蹭个热点">
                                        <IconButton
                                            onClick={(e) => handleOpenTrends(e, 'title')}
                                            sx={trendButtonStyles}
                                        >
                                            <Flame size={18} />
                                        </IconButton>
                                    </Tooltip>
                                </InputAdornment>
                            )
                        }}
                    />

                    <Box sx={{ position: 'relative' }}>
                        <TextField
                            fullWidth
                            multiline
                            rows={10}
                            placeholder="在这里分享你的故事..."
                            value={currentPost.content}
                            onChange={(e) => setCurrentPost({ content: e.target.value })}
                            InputProps={{
                                disableUnderline: true,
                                sx: contentInputStyles
                            }}
                            variant="standard"
                        />
                        <Tooltip title={currentPost.content?.trim() ? "AI 润色正文" : "请先输入内容"}>
                            <span>
                                <IconButton
                                    onClick={() => handleOpenPolish('content')}
                                    disabled={!currentPost.content?.trim()}
                                    sx={absoluteIconButtonStyles}
                                >
                                    <Sparkles size={18} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="蹭个热点">
                            <IconButton
                                onClick={(e) => handleOpenTrends(e, 'content')}
                                sx={secondaryIconButtonStyles}
                            >
                                <Flame size={18} />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box /> {/* Spacer */}

                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                                size="small"
                                variant="text"
                                endIcon={<ChevronDown size={14} />}
                                onClick={(e) => setTextAnchorEl(e.currentTarget)}
                                sx={{ color: 'text.secondary', fontSize: 11 }}
                            >
                                {selectedTextModel ? selectedTextModel.modelName : '选择 AI'}
                            </Button>
                            <Button
                                variant="contained"
                                size="medium"
                                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={18} />}
                                onClick={handleAICompose}
                                disabled={loading}
                                sx={{
                                    borderRadius: 3,
                                    bgcolor: 'primary.main',
                                    px: 2.5
                                }}
                            >
                                根据标题生成内容
                            </Button>
                        </Stack>
                    </Stack>
                </Box>

                {/* Menus */}
                {renderModelMenu('text', textAnchorEl, setTextAnchorEl, selectedTextModel, setSelectedTextModel)}
                {renderModelMenu('image', imageAnchorEl, setImageAnchorEl, selectedImageModel, setSelectedImageModel)}

                {/* Image Prompt Dialog */}
                <ImagePromptDialog
                    open={imgDialogOpen}
                    onClose={() => setImgDialogOpen(false)}
                    onImageGenerated={(url) => setCurrentPost({ images: [...currentPost.images, url] })}
                    initialTitle={currentPost.title || ''}
                    initialContent={currentPost.content || ''}
                />

                {/* Asset Selector Dialog */}
                <AssetSelectorDialog
                    open={assetSelectorOpen}
                    onClose={() => setAssetSelectorOpen(false)}
                    onSelect={handleSelectFromLibrary}
                    title={selectorMode === 'cover' ? '选定封面' : '加入素材库照片'}
                />

                {/* AI Polish Dialog */}
                <AIPolishDialog
                    open={polishDialogOpen}
                    onClose={() => setPolishDialogOpen(false)}
                    targetLabel={polishTarget === 'title' ? '标题' : '正文'}
                    initialText={polishTarget === 'title' ? currentPost.title : currentPost.content}
                    onApply={(text) => {
                        if (polishTarget === 'title') {
                            setCurrentPost({ title: text });
                        } else {
                            setCurrentPost({ content: text });
                        }
                    }}
                />

                {/* Trends Popover */}
                <TrendsPopover
                    anchorEl={trendAnchorEl}
                    onClose={() => setTrendAnchorEl(null)}
                    onSelectTrend={handleSelectTrend}
                    trends={trends}
                    trendsLoading={trendsLoading}
                />
            </Box>
        </Box >
    );
};
