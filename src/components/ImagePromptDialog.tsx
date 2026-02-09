import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Stack,
    MenuItem,
    CircularProgress,
    Divider
} from '@mui/material';
import { Wand2, Image as ImageIcon } from 'lucide-react';
import { useAppStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';

interface ImagePromptDialogProps {
    open: boolean;
    onClose: () => void;
    onImageGenerated: (url: string) => void;
    initialTitle?: string;
    initialContent?: string;
}

export const ImagePromptDialog = ({
    open,
    onClose,
    onImageGenerated,
    initialTitle = '',
    initialContent = ''
}: ImagePromptDialogProps) => {
    const { aiProviders, selectedTextModel, selectedImageModel, setSelectedImageModel, setActiveTab } = useAppStore();

    const [userImagePrompt, setUserImagePrompt] = useState('');
    const [tempImageTitle, setTempImageTitle] = useState(initialTitle);
    const [tempImageContent, setTempImageContent] = useState(initialContent);
    const [imgLoading, setImgLoading] = useState(false);
    const [smartPromptLoading, setSmartPromptLoading] = useState(false);

    // Update temp values when dialog opens
    useEffect(() => {
        if (open) {
            setTempImageTitle(initialTitle);
            setTempImageContent(initialContent);
            setUserImagePrompt(initialTitle); // Default to title
        }
    }, [open, initialTitle, initialContent]);

    const handleSmartPrompt = async () => {
        if (!selectedTextModel) {
            await message('请先选择一个文本模型用于生成提示词', { title: '提示', kind: 'info' });
            return;
        }
        const provider = aiProviders.find(p => p.id === selectedTextModel.providerId);
        if (!provider) return;

        setSmartPromptLoading(true);
        try {
            const systemPrompt = `你是一个专业的小红书摄影师、视觉艺术家以及 DALL-E/Midjourney 提示词专家。
请根据提供的笔记标题和内容，构想一个精美、高质感、符合小红书审美的画面，并生成一段专业的英文提示词（Prompt）。

要求：
1. **画风捕捉**：提示词应包含画风、构图、光影、材质及核心主体描述。
2. **纯粹输出**：仅返回生成的提示词本身，严禁包含任何中文说明、解释或开场白。
3. **小红书审美**：侧重于奶油风、多巴胺色系、极简主义或胶片感等主流小红书爆款视觉风格。

待创作笔记：
标题：${tempImageTitle}
内容：${tempImageContent}`;

            const result: string = await invoke('generate_ai_text', {
                prompt: "请开始创作生图提示词：",
                system: systemPrompt,
                provider,
                modelName: selectedTextModel.modelName
            });
            setUserImagePrompt(result.trim());
        } catch (e) {
            await message('生成提示词失败: ' + e, { title: '错误', kind: 'error' });
        } finally {
            setSmartPromptLoading(false);
        }
    };

    const handleConfirmGenerateImage = async () => {
        if (!selectedImageModel) {
            await message('请先选择一个生图模型', { title: '提示', kind: 'info' });
            return;
        }

        const provider = aiProviders.find(p => p.id === selectedImageModel.providerId);
        if (!provider) return;

        setImgLoading(true);
        try {
            const url: string = await invoke('generate_ai_image', {
                prompt: userImagePrompt,
                provider,
                modelName: selectedImageModel.modelName,
                size: useAppStore.getState().imageSize
            });
            onImageGenerated(url);
            onClose();
        } catch (e) {
            console.error(e);
            await message('AI 生图失败: ' + e, { title: '错误', kind: 'error' });
        } finally {
            setImgLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 5, p: 1 } }}
        >
            <DialogTitle sx={{ fontWeight: 800 }}>
                🎨 图片内容构想
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    描述你想要的画面，AI 将为你即刻创作。
                </Typography>
                <Stack spacing={3}>
                    <Stack spacing={1}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, ml: 1 }}>使用模型</Typography>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            value={selectedImageModel ? `${selectedImageModel.providerId}:${selectedImageModel.modelName}` : ''}
                            onChange={(e) => {
                                const [pId, mName] = e.target.value.split(':');
                                setSelectedImageModel({ providerId: parseInt(pId), modelName: mName });
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        >
                            {aiProviders.flatMap(p =>
                                p.models.filter(m => m.model_type === 'image').map(m => (
                                    <MenuItem key={`${p.id}:${m.name}`} value={`${p.id}:${m.name}`}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Wand2 size={14} />
                                            <Typography variant="body2">{m.name}</Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.5 }}>({p.name})</Typography>
                                        </Stack>
                                    </MenuItem>
                                ))
                            )}
                            <MenuItem onClick={() => { onClose(); setActiveTab('settings'); }}>
                                <Typography variant="caption" color="primary">+ 添加更多模型</Typography>
                            </MenuItem>
                        </TextField>
                    </Stack>

                    <Stack spacing={1}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, ml: 1 }}>画面描述 (Prompt)</Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            value={userImagePrompt}
                            onChange={(e) => setUserImagePrompt(e.target.value)}
                            placeholder="描述细节（光影、画风、构图）效果更佳..."
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
                        />
                    </Stack>

                    <Divider sx={{ my: 1, borderStyle: 'dashed' }}>
                        <Typography variant="caption" color="text.disabled">参考内容 (用于生成构想)</Typography>
                    </Divider>

                    <Stack spacing={2}>
                        <TextField
                            fullWidth
                            size="small"
                            label="标题"
                            value={tempImageTitle}
                            onChange={(e) => setTempImageTitle(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            size="small"
                            label="正文"
                            value={tempImageContent}
                            onChange={(e) => setTempImageContent(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                    </Stack>

                    <Button
                        variant="outlined"
                        startIcon={smartPromptLoading ? <CircularProgress size={16} /> : <Wand2 size={18} />}
                        onClick={handleSmartPrompt}
                        disabled={smartPromptLoading}
                        sx={{
                            alignSelf: 'center',
                            borderRadius: 3,
                            borderColor: 'primary.main',
                            borderWidth: 2,
                            color: 'primary.main',
                            fontWeight: 700,
                            width: '100%',
                            py: 1.2,
                            '&:hover': {
                                borderWidth: 2,
                                bgcolor: 'rgba(255, 36, 66, 0.05)'
                            }
                        }}
                    >
                        根据笔记生成构想
                    </Button>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
                <Button onClick={onClose} sx={{ color: 'text.secondary' }}>等会儿</Button>
                <Button
                    variant="contained"
                    onClick={handleConfirmGenerateImage}
                    disabled={imgLoading || !userImagePrompt.trim()}
                    startIcon={imgLoading ? <CircularProgress size={16} color="inherit" /> : <ImageIcon size={18} />}
                    sx={{ px: 4, borderRadius: 3 }}
                >
                    {imgLoading ? '描绘中...' : '开始生成'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
