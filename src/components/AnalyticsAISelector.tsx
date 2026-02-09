import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Alert,
    Stack,
    Chip,
    SelectChangeEvent
} from '@mui/material';
import { Bot, CheckCircle, AlertCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

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

interface Props {
    aiProviders: AIProvider[];
    setSnackbar: (snackbar: { open: boolean; message: string; severity: 'success' | 'error' | 'info' }) => void;
}

export const AnalyticsAISelector = ({ aiProviders, setSnackbar }: Props) => {
    const [selectedProvider, setSelectedProvider] = useState<number | ''>('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [currentConfig, setCurrentConfig] = useState<{ providerId: number; modelName: string } | null>(null);

    // 加载当前配置
    useEffect(() => {
        loadCurrentConfig();
    }, []);

    const loadCurrentConfig = async () => {
        try {
            const config = await invoke<string | null>('get_config_value', { key: 'analytics_ai_model' });
            if (config) {
                const parsed = JSON.parse(config);
                setCurrentConfig(parsed);
                setSelectedProvider(parsed.providerId);
                setSelectedModel(parsed.modelName);
                setSaveStatus('success');
            }
        } catch (e) {
            console.error('Failed to load analytics AI config:', e);
        }
    };

    const handleProviderChange = (e: SelectChangeEvent<number>) => {
        const providerId = e.target.value as number;
        setSelectedProvider(providerId);
        setSelectedModel('');
        setSaveStatus('idle');
    };

    const handleModelChange = (e: SelectChangeEvent) => {
        setSelectedModel(e.target.value);
        setSaveStatus('idle');
    };

    const handleSave = async () => {
        if (!selectedProvider || !selectedModel) {
            setSnackbar({
                open: true,
                message: '请选择 AI 提供商和模型',
                severity: 'error'
            });
            return;
        }

        try {
            const config = {
                providerId: selectedProvider,
                modelName: selectedModel
            };
            await invoke('save_config', {
                key: 'analytics_ai_model',
                value: JSON.stringify(config)
            });

            setCurrentConfig(config);
            setSaveStatus('success');
            setSnackbar({
                open: true,
                message: '数据分析 AI 配置成功！',
                severity: 'success'
            });
        } catch (e: any) {
            setSaveStatus('error');
            setSnackbar({
                open: true,
                message: `保存失败: ${e}`,
                severity: 'error'
            });
        }
    };

    const textModels = aiProviders
        .find(p => p.id === selectedProvider)
        ?.models.filter(m => m.model_type === 'text') || [];

    const getStatusIcon = () => {
        switch (saveStatus) {
            case 'success':
                return <CheckCircle size={20} style={{ color: '#4caf50' }} />;
            case 'error':
                return <AlertCircle size={20} style={{ color: '#f44336' }} />;
            default:
                return <Bot size={20} />;
        }
    };

    return (
        <Paper sx={{
            p: 4,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            borderRadius: 6,
            border: (theme) => `1px solid ${theme.palette.divider}`,
        }}>
            <Stack spacing={3}>
                {currentConfig && saveStatus === 'success' && (
                    <Alert severity="success" sx={{ borderRadius: 3 }}>
                        当前已配置: {aiProviders.find(p => p.id === currentConfig.providerId)?.name} - {currentConfig.modelName}
                    </Alert>
                )}

                <FormControl fullWidth>
                    <InputLabel>AI 提供商</InputLabel>
                    <Select
                        value={selectedProvider}
                        onChange={handleProviderChange}
                        label="AI 提供商"
                        sx={{ borderRadius: 3 }}
                    >
                        {aiProviders.map(provider => (
                            <MenuItem key={provider.id} value={provider.id}>
                                {provider.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth disabled={!selectedProvider}>
                    <InputLabel>文本模型</InputLabel>
                    <Select
                        value={selectedModel}
                        onChange={handleModelChange}
                        label="文本模型"
                        sx={{ borderRadius: 3 }}
                    >
                        {textModels.map(model => (
                            <MenuItem key={model.name} value={model.name}>
                                {model.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={{
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(33,150,243,0.05)' : 'rgba(33,150,243,0.03)',
                    border: '1px solid',
                    borderColor: 'info.main',
                    borderStyle: 'dashed'
                }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'info.main', display: 'block', mb: 1 }}>
                        💡 提示
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                        数据分析功能使用 AI 从 HTML 中提取数据。选择任何支持文本对话的模型即可，无需结构化输出支持。
                        推荐使用性价比高的模型如 GPT-4o-mini、Claude 3.5 Haiku 等。
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!selectedProvider || !selectedModel}
                        startIcon={getStatusIcon()}
                        sx={{ borderRadius: 3, flex: 1 }}
                    >
                        保存配置
                    </Button>

                    {saveStatus === 'success' && (
                        <Chip
                            label="已保存"
                            color="success"
                            icon={<CheckCircle size={14} />}
                            sx={{ fontWeight: 700 }}
                        />
                    )}
                    {saveStatus === 'error' && (
                        <Chip
                            label="保存失败"
                            color="error"
                            icon={<AlertCircle size={14} />}
                            sx={{ fontWeight: 700 }}
                        />
                    )}
                </Box>
            </Stack>
        </Paper>
    );
};
