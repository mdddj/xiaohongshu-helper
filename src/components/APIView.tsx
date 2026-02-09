import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    TextField,
    Stack,
    Chip,
    InputAdornment,
    IconButton,
    Tooltip,
    Alert,
    Snackbar,
    Divider
} from '@mui/material';
import { Server, Copy, RefreshCw, Key, ExternalLink, Play, Square } from 'lucide-react';
import { useAppStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

export const APIView = () => {
    const { apiStatus, fetchApiStatus } = useAppStore();
    const [apiKey, setApiKey] = useState('');
    const [apiPort, setApiPort] = useState(8080);
    const [isStarting, setIsStarting] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' }>({
        open: false,
        message: '',
        severity: 'info'
    });

    useEffect(() => {
        fetchApiStatus();
        loadApiKey();
        const interval = setInterval(fetchApiStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const loadApiKey = async () => {
        try {
            const key = await invoke<string | null>('get_api_key');
            if (key) {
                setApiKey(key);
            }
        } catch (e) {
            console.error('Failed to load API key', e);
        }
    };

    const handleGenerateApiKey = async () => {
        try {
            const newKey = await invoke<string>('generate_api_key');
            setApiKey(newKey);
            setSnackbar({
                open: true,
                message: '新的 API Key 已生成并保存',
                severity: 'success'
            });
        } catch (e) {
            setSnackbar({
                open: true,
                message: `生成失败: ${e}`,
                severity: 'error'
            });
        }
    };

    const handleSaveApiKey = async () => {
        try {
            await invoke('save_api_key', { key: apiKey });
            setSnackbar({
                open: true,
                message: 'API Key 已保存',
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

    const handleCopyApiKey = () => {
        navigator.clipboard.writeText(apiKey);
        setSnackbar({
            open: true,
            message: 'API Key 已复制到剪贴板',
            severity: 'success'
        });
    };

    const handleStartApiServer = async () => {
        if (!apiKey) {
            setSnackbar({
                open: true,
                message: '请先生成或输入 API Key',
                severity: 'error'
            });
            return;
        }

        setIsStarting(true);
        try {
            await invoke('start_api_server', { port: apiPort });
            await fetchApiStatus();
            setSnackbar({
                open: true,
                message: `API 服务器已启动在端口 ${apiPort}`,
                severity: 'success'
            });
        } catch (e) {
            setSnackbar({
                open: true,
                message: `启动失败: ${e}`,
                severity: 'error'
            });
        } finally {
            setIsStarting(false);
        }
    };

    const handleStopApiServer = async () => {
        try {
            await invoke('stop_api_server');
            // 立即更新本地状态
            setSnackbar({
                open: true,
                message: 'API 服务器正在停止...',
                severity: 'info'
            });
            // 等待服务器完全关闭后再刷新状态
            setTimeout(async () => {
                await fetchApiStatus();
                setSnackbar({
                    open: true,
                    message: 'API 服务器已停止',
                    severity: 'success'
                });
            }, 200);
        } catch (e) {
            setSnackbar({
                open: true,
                message: `停止失败: ${e}`,
                severity: 'error'
            });
        }
    };

    const openSwaggerUI = async () => {
        try {
            await openUrl(`http://127.0.0.1:${apiStatus.port}/swagger-ui`);
        } catch (e) {
            setSnackbar({
                open: true,
                message: `打开失败: ${e}`,
                severity: 'error'
            });
        }
    };

    const openApiDoc = async () => {
        try {
            await openUrl(`http://127.0.0.1:${apiStatus.port}/api-doc/openapi.json`);
        } catch (e) {
            setSnackbar({
                open: true,
                message: `打开失败: ${e}`,
                severity: 'error'
            });
        }
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 4 }}>
            {/* 标题区域 */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Server size={32} />
                    REST API 服务
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    通过 HTTP 接口调用所有功能，支持任何编程语言集成
                </Typography>
            </Box>

            {/* 服务状态卡片 */}
            <Paper
                sx={{
                    p: 4,
                    mb: 3,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 4,
                    border: (theme) => `2px solid ${apiStatus.is_running ? theme.palette.success.main : theme.palette.divider}`,
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            服务状态
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Chip
                                label={apiStatus.is_running ? '运行中' : '已停止'}
                                color={apiStatus.is_running ? 'success' : 'default'}
                                size="small"
                                sx={{ fontWeight: 600 }}
                            />
                            {apiStatus.is_running && (
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    http://127.0.0.1:{apiStatus.port}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        {apiStatus.is_running ? (
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<Square size={16} />}
                                onClick={handleStopApiServer}
                                sx={{ borderRadius: 2 }}
                            >
                                停止服务
                            </Button>
                        ) : (
                            <>
                                <TextField
                                    label="端口"
                                    type="number"
                                    size="small"
                                    value={apiPort}
                                    onChange={(e) => setApiPort(parseInt(e.target.value) || 8080)}
                                    sx={{ width: 100 }}
                                />
                                <Button
                                    variant="contained"
                                    startIcon={<Play size={16} />}
                                    onClick={handleStartApiServer}
                                    disabled={isStarting || !apiKey}
                                    sx={{ borderRadius: 2 }}
                                >
                                    启动服务
                                </Button>
                            </>
                        )}
                    </Box>
                </Box>

                {apiStatus.is_running && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<ExternalLink size={16} />}
                            onClick={openSwaggerUI}
                            sx={{ borderRadius: 2 }}
                        >
                            打开 Swagger UI
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<ExternalLink size={16} />}
                            onClick={openApiDoc}
                            sx={{ borderRadius: 2 }}
                        >
                            OpenAPI 规范
                        </Button>
                    </Box>
                )}
            </Paper>

            {/* API Key 配置 */}
            <Paper
                sx={{
                    p: 4,
                    mb: 3,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 4,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Key size={20} />
                    API Key 配置
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                    所有 API 请求需要在请求头中携带 <code style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>X-API-Key</code> 进行认证
                </Typography>

                <Stack spacing={2}>
                    <TextField
                        label="API Key"
                        fullWidth
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        type="password"
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Tooltip title="复制">
                                        <IconButton onClick={handleCopyApiKey} edge="end" size="small">
                                            <Copy size={16} />
                                        </IconButton>
                                    </Tooltip>
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                            }
                        }}
                    />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshCw size={16} />}
                            onClick={handleGenerateApiKey}
                            sx={{ borderRadius: 2 }}
                        >
                            生成新密钥
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSaveApiKey}
                            disabled={!apiKey}
                            sx={{ borderRadius: 2 }}
                        >
                            保存密钥
                        </Button>
                    </Box>
                </Stack>
            </Paper>

            {/* 使用说明 */}
            <Paper
                sx={{
                    p: 4,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 4,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    快速开始
                </Typography>

                <Stack spacing={2}>
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            1. 生成 API Key
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            点击"生成新密钥"按钮创建一个新的 API Key，或手动输入自定义密钥
                        </Typography>
                    </Box>

                    <Divider />

                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            2. 启动服务
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            配置端口（默认 8080）并点击"启动服务"按钮
                        </Typography>
                    </Box>

                    <Divider />

                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            3. 调用 API
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                            在请求头中添加 API Key：
                        </Typography>
                        <Paper
                            sx={{
                                p: 2,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                                fontFamily: 'monospace',
                                fontSize: 13,
                                borderRadius: 2
                            }}
                        >
                            X-API-Key: your-api-key-here
                        </Paper>
                    </Box>

                    <Divider />

                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            4. 查看文档
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            访问 Swagger UI 查看完整的 API 文档和在线测试接口
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%', borderRadius: 2 }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};
