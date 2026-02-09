import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    Paper,
    Chip,
    IconButton,
    Divider,
    Stack,
    Grid,
} from '@mui/material';
import {
    Copy,
    Check,
    Terminal,
    Power,
    Shield,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
import IOSSwitch from './IOSSwitch';
import { useAppStore } from '../store';

export const MCPView = () => {
    const { mcpStatus: status, fetchMcpStatus: fetchStatus } = useAppStore();
    const [port, setPort] = useState(8001);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [autoStart, setAutoStart] = useState(false);

    const connectionUrl = `http://127.0.0.1:${status.port}/mcp`;

    useEffect(() => {
        // Load settings from localStorage
        const savedAutoStart = localStorage.getItem('mcp_auto_start') === 'true';
        const savedPort = localStorage.getItem('mcp_port');

        setAutoStart(savedAutoStart);
        if (savedPort) {
            setPort(parseInt(savedPort));
        }

        fetchStatus();
    }, []);


    const handleAutoStartToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.checked;
        setAutoStart(newValue);
        localStorage.setItem('mcp_auto_start', newValue.toString());
    };

    const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPort = parseInt(e.target.value);
        setPort(newPort);
        localStorage.setItem('mcp_port', newPort.toString());
    };

    const handleToggle = async () => {
        setLoading(true);
        try {
            if (status.is_running) {
                await invoke('stop_mcp_server');
            } else {
                await invoke('start_mcp_server', { port });
            }
            await fetchStatus();
        } catch (e: any) {
            await message(e.toString(), { kind: 'error', title: 'MCP 服务错误' });
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(connectionUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const tools = [
        { name: 'start_login', desc: '开始登录流程并发送验证码' },
        { name: 'submit_code', desc: '提交验证码完成账号绑定' },
        { name: 'list_users', desc: '获取系统中已绑定的用户列表' },
        { name: 'get_user_info', desc: '根据用户名或手机号获取指定用户信息' },
        { name: 'publish_post', desc: '发布笔记到小红书' },
        { name: 'validate_login_status', desc: '验证指定手机号的登录状态' },
    ];

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
            {/* Header Area */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: -1 }}>
                    MCP <Box component="span" sx={{ color: 'primary.main' }}>控制台</Box>
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Model Context Protocol (MCP) 让您的 AI 助手能直接与此应用交互
                </Typography>
            </Box>

            <Stack spacing={4}>
                {/* Main Control Card */}
                <Paper sx={{
                    p: 4,
                    borderRadius: 6,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: 'none',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Status Glow */}
                    <Box sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: 200,
                        height: 200,
                        background: status.is_running
                            ? 'radial-gradient(circle at top right, rgba(0,255,127,0.08) 0%, transparent 70%)'
                            : 'radial-gradient(circle at top right, rgba(255,36,66,0.05) 0%, transparent 70%)',
                        pointerEvents: 'none'
                    }} />

                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 3,
                                bgcolor: status.is_running ? 'success.main' : 'rgba(255,255,255,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                transform: status.is_running ? 'scale(1)' : 'scale(0.9)',
                            }}>
                                <Power size={24} color={status.is_running ? '#fff' : 'rgba(255,255,255,0.2)'} />
                            </Box>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>服务状态</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        bgcolor: status.is_running ? '#00ff7f' : '#ff4d4f',
                                        boxShadow: status.is_running ? '0 0 10px #00ff7f' : 'none'
                                    }} />
                                    <Typography variant="body2" color={status.is_running ? 'success.main' : 'text.secondary'} sx={{ fontWeight: 600 }}>
                                        {status.is_running ? '正在运行' : '已停止'}
                                    </Typography>
                                </Stack>
                            </Box>
                        </Stack>

                        <IOSSwitch
                            checked={status.is_running}
                            onChange={handleToggle}
                            disabled={loading}
                        />
                    </Stack>

                    <Divider sx={{ mb: 4, opacity: 0.5 }} />

                    <Grid container spacing={4}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
                                配置参数
                            </Typography>
                            <TextField
                                fullWidth
                                label="端口号"
                                size="small"
                                type="number"
                                value={port}
                                onChange={handlePortChange}
                                disabled={status.is_running}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 3,
                                    }
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ height: '100%', pt: 1 }}>
                                <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                    随 APP 启动自动运行
                                </Typography>
                                <IOSSwitch
                                    checked={autoStart}
                                    onChange={handleAutoStartToggle}
                                    size="small"
                                />
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
                                连接 URL (SSE)
                            </Typography>
                            <Box sx={{
                                p: 1,
                                pr: 0.5,
                                borderRadius: 3,
                                bgcolor: 'rgba(255,255,255,0.03)',
                                border: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <Typography variant="body2" sx={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    ml: 1.5,
                                    color: status.is_running ? 'text.primary' : 'text.disabled'
                                }}>
                                    {status.is_running ? connectionUrl : '服务未启动'}
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={handleCopy}
                                    disabled={!status.is_running}
                                    sx={{ borderRadius: 2 }}
                                >
                                    {copied ? <Check size={18} color="#00ff7f" /> : <Copy size={18} />}
                                </IconButton>
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Tools List */}
                <Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <Terminal size={18} style={{ color: 'var(--mui-palette-primary-main)' }} />
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>已注册工具</Typography>
                        <Chip size="small" label={tools.length} sx={{ fontWeight: 700, height: 20 }} />
                    </Stack>

                    <Grid container spacing={2}>
                        {tools.map((t) => (
                            <Grid size={{ xs: 12, md: 4 }} key={t.name}>
                                <Paper sx={{
                                    p: 2.5,
                                    height: '100%',
                                    borderRadius: 4,
                                    bgcolor: 'rgba(255,255,255,0.01)',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        bgcolor: 'rgba(255,255,255,0.03)',
                                        borderColor: 'primary.main',
                                        transform: 'translateY(-2px)'
                                    }
                                }}>
                                    <Typography variant="subtitle1" sx={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, mb: 0.5, color: 'primary.main' }}>
                                        {t.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                        {t.desc}
                                    </Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Security Info */}
                <Box sx={{
                    p: 3,
                    borderRadius: 4,
                    bgcolor: 'rgba(255,165,0,0.05)',
                    border: '1px solid rgba(255,165,0,0.1)',
                    display: 'flex',
                    gap: 2
                }}>
                    <Shield size={24} style={{ color: '#ffa500', flexShrink: 0 }} />
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ffa500', mb: 0.5 }}>安全性警告</Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                            MCP SSE (HTTP) 服务目前主要用于本地集成。请勿在受限网络环境外开启此服务，因为它目前不提供额外的鉴权机制。端口号冲突可能导致服务无法启动。
                        </Typography>
                    </Box>
                </Box>
            </Stack>
        </Box>
    );
};
