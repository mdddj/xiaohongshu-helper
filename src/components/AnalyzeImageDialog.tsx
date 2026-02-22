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
    Box
} from '@mui/material';
import { Sparkles, Image as ImageIcon } from 'lucide-react';
import { useAppStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';

interface AnalyzeImageDialogProps {
    open: boolean;
    onClose: () => void;
    imagePath: string;
}

export const AnalyzeImageDialog = ({
    open,
    onClose,
    imagePath
}: AnalyzeImageDialogProps) => {
    const { aiProviders, selectedTextModel, setSelectedTextModel, setActiveTab } = useAppStore();
    const [prompt, setPrompt] = useState('请提供一张小红书风格的配文，描述这张图片。');
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState('');

    useEffect(() => {
        if (!open) {
            setResult('');
        }
    }, [open]);

    const handleAnalyze = async () => {
        if (!selectedTextModel) {
            await message('请先选择一个用于分析的 AI 模型', { title: '提示', kind: 'info' });
            return;
        }

        const provider = aiProviders.find(p => p.id === selectedTextModel.providerId);
        if (!provider) return;

        setAnalyzing(true);
        setResult('');
        try {
            const res: string = await invoke('analyze_local_image', {
                imagePath: imagePath,
                prompt: prompt,
                provider,
                modelName: selectedTextModel.modelName
            });
            setResult(res);
        } catch (e) {
            console.error(e);
            await message('图片分析失败: ' + e, { title: '错误', kind: 'error' });
        } finally {
            setAnalyzing(false);
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
                ✨ 智能图像分析
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    选择支持视觉理解的 AI 模型来解读这张图片。
                </Typography>
                <Stack spacing={3}>
                    <Stack spacing={1}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, ml: 1 }}>使用模型</Typography>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            value={selectedTextModel ? `${selectedTextModel.providerId}:${selectedTextModel.modelName}` : ''}
                            onChange={(e) => {
                                const [pId, mName] = e.target.value.split(':');
                                setSelectedTextModel({ providerId: parseInt(pId), modelName: mName });
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        >
                            {aiProviders.flatMap(p =>
                                p.models.filter(m => m.model_type === 'text').map(m => ( // 视觉理解一般在文本大语言模型中
                                    <MenuItem key={`${p.id}:${m.name}`} value={`${p.id}:${m.name}`}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Sparkles size={14} />
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
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, ml: 1 }}>分析提示词</Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="你想让 AI 做什么？例如：识别图中物品、配小红书文案等。"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
                        />
                    </Stack>

                    {result && (
                        <Box sx={{ p: 2, bgcolor: 'rgba(255,36,66,0.05)', borderRadius: 3, border: '1px solid rgba(255,36,66,0.1)' }}>
                            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, mb: 1, display: 'block' }}>
                                分析结果
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {result}
                            </Typography>
                        </Box>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
                <Button onClick={onClose} sx={{ color: 'text.secondary' }}>关闭</Button>
                <Button
                    variant="contained"
                    onClick={handleAnalyze}
                    disabled={analyzing || !prompt.trim()}
                    startIcon={analyzing ? <CircularProgress size={16} color="inherit" /> : <ImageIcon size={18} />}
                    sx={{ px: 4, borderRadius: 3 }}
                >
                    {analyzing ? '分析中...' : '开始分析'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
