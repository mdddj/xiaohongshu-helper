import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemButton,
    IconButton,
    Avatar,
    Button,
    Stack,
    Chip,
    CircularProgress,
    Tooltip,
} from '@mui/material';
import { Plus, User as UserIcon, Trash2, LogOut, CheckCircle2, FolderOpen, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { confirm, message } from '@tauri-apps/plugin-dialog';
import { LoginDialog } from './LoginDialog';
import { UserAnalyticsCard } from './UserAnalyticsCard';

interface UserValidationStatus {
    phone: string;
    isValid: boolean | null; // null = 未检测, true = 有效, false = 无效
    lastChecked?: Date;
}

export const UsersView = () => {
    const { currentUser, setCurrentUser, users, fetchUsers } = useAppStore();
    const [loginOpen, setLoginOpen] = useState(false);
    const [validating, setValidating] = useState<string | null>(null);
    const [validationStatuses, setValidationStatuses] = useState<Map<string, UserValidationStatus>>(new Map());
    const [batchValidating, setBatchValidating] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    // 单个账号验证
    const handleValidateUser = async (user: any) => {
        setValidating(user.phone);
        try {
            await invoke('validate_login_status', { phone: user.phone });
            setValidationStatuses(prev => new Map(prev).set(user.phone, {
                phone: user.phone,
                isValid: true,
                lastChecked: new Date()
            }));
            await message(`账号 ${user.nickname} 验证通过`, { title: '验证成功', kind: 'info' });
        } catch (e: any) {
            setValidationStatuses(prev => new Map(prev).set(user.phone, {
                phone: user.phone,
                isValid: false,
                lastChecked: new Date()
            }));
            await message(`账号 ${user.nickname} 验证失败：${e}`, { title: '验证失败', kind: 'error' });
        } finally {
            setValidating(null);
        }
    };

    // 批量验证所有账号
    const handleBatchValidate = async () => {
        if (users.length === 0) return;

        const confirmed = await confirm(
            `即将验证所有 ${users.length} 个账号的登录状态，这可能需要一些时间。`,
            { title: '批量验证', kind: 'info' }
        );

        if (!confirmed) return;

        setBatchValidating(true);
        let validCount = 0;
        let invalidCount = 0;

        for (const user of users) {
            try {
                await invoke('validate_login_status', { phone: user.phone });
                setValidationStatuses(prev => new Map(prev).set(user.phone, {
                    phone: user.phone,
                    isValid: true,
                    lastChecked: new Date()
                }));
                validCount++;
            } catch (e) {
                setValidationStatuses(prev => new Map(prev).set(user.phone, {
                    phone: user.phone,
                    isValid: false,
                    lastChecked: new Date()
                }));
                invalidCount++;
            }
        }

        setBatchValidating(false);
        await message(
            `验证完成！\n✅ 有效账号: ${validCount}\n❌ 失效账号: ${invalidCount}`,
            { title: '批量验证结果', kind: 'info' }
        );
    };

    const handleUserSwitch = async (user: any) => {
        if (currentUser?.phone === user.phone) return;

        setValidating(user.phone);
        try {
            const validatedUser: any = await invoke('validate_login_status', { phone: user.phone });
            setCurrentUser(validatedUser);
            await message(`已切换至账号: ${validatedUser.nickname}`, { title: '切换成功', kind: 'info' });
        } catch (e: any) {
            console.error(e);
            await message('账号验证失败，可能登录已过期：' + e, { title: '验证失败', kind: 'error' });
        } finally {
            setValidating(null);
        }
    };

    const handleUnbindUser = async (e: React.MouseEvent, user: any) => {
        e.stopPropagation();

        const confirmed = await confirm(
            `确定要彻底移除账号 ${user.nickname} (${user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}) 吗？\n此操作将删除该账号的所有本地发布记录和登录凭证。`,
            { title: '解绑账号', kind: 'warning' }
        );

        if (confirmed) {
            try {
                await invoke('logout_user', { phone: user.phone });
                if (currentUser?.phone === user.phone) {
                    setCurrentUser(null);
                }
                await fetchUsers();
                await message('账号已成功解绑', { title: '操作成功', kind: 'info' });
            } catch (e) {
                console.error(e);
                await message('解绑失败: ' + e, { title: '错误', kind: 'error' });
            }
        }
    };

    const handleOpenFolder = async (e: React.MouseEvent, phone: string) => {
        e.stopPropagation();
        try {
            await invoke('open_user_data_dir', { phone });
        } catch (e: any) {
            await message('打开目录失败: ' + e, { title: '错误', kind: 'error' });
        }
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: -1 }}>
                        账号 <Box component="span" sx={{ color: 'primary.main' }}>管理</Box>
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        管理已绑定的多账号，支持一键切换和安全退出
                    </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    <Button
                        variant="outlined"
                        startIcon={batchValidating ? <CircularProgress size={16} /> : <ShieldCheck size={20} />}
                        onClick={handleBatchValidate}
                        disabled={batchValidating || users.length === 0}
                        sx={{ borderRadius: 3, px: 3 }}
                    >
                        批量检测
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Plus size={20} />}
                        onClick={() => setLoginOpen(true)}
                        sx={{ borderRadius: 3, px: 3 }}
                    >
                        绑定新账号
                    </Button>
                </Stack>
            </Box>

            <Stack spacing={3}>
                <Paper sx={{
                    p: 4,
                    borderRadius: 6,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: 'none',
                }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>已登录账号 ({users.length})</Typography>

                    <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {users.map((user) => {
                            const isCurrent = currentUser?.phone === user.phone;
                            const isValidating = validating === user.phone;
                            const validationStatus = validationStatuses.get(user.phone);

                            return (
                                <ListItem
                                    key={user.id}
                                    disablePadding
                                    sx={{
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                        border: '1px solid',
                                        borderColor: isCurrent ? 'primary.main' : 'divider',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.05)'
                                        }
                                    }}
                                    secondaryAction={
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            {/* 验证状态指示器 */}
                                            {validationStatus && (
                                                <Tooltip title={`上次检测: ${validationStatus.lastChecked?.toLocaleString()}`}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        {validationStatus.isValid ? (
                                                            <ShieldCheck size={18} style={{ color: '#4caf50' }} />
                                                        ) : (
                                                            <ShieldAlert size={18} style={{ color: '#f44336' }} />
                                                        )}
                                                    </Box>
                                                </Tooltip>
                                            )}

                                            {/* 单独验证按钮 */}
                                            <Tooltip title="验证账号有效性">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleValidateUser(user);
                                                    }}
                                                    disabled={isValidating || batchValidating}
                                                    sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' } }}
                                                >
                                                    {isValidating ? <CircularProgress size={18} /> : <RefreshCw size={18} />}
                                                </IconButton>
                                            </Tooltip>

                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleOpenFolder(e, user.phone)}
                                                sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' } }}
                                                title="打开数据目录"
                                            >
                                                <FolderOpen size={18} />
                                            </IconButton>

                                            {isValidating ? (
                                                <CircularProgress size={20} sx={{ mx: 1 }} />
                                            ) : isCurrent ? (
                                                <Typography variant="caption" color="primary" sx={{ fontWeight: 800, mx: 1 }}>当前使用</Typography>
                                            ) : (
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => handleUserSwitch(user)}
                                                    disabled={batchValidating}
                                                    sx={{ borderRadius: 2 }}
                                                >
                                                    切换
                                                </Button>
                                            )}

                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={(e) => handleUnbindUser(e, user)}
                                                disabled={batchValidating}
                                                sx={{ bgcolor: 'rgba(255,77,79,0.05)', '&:hover': { bgcolor: 'rgba(255,77,79,0.1)' } }}
                                                title="全量解绑"
                                            >
                                                <Trash2 size={18} />
                                            </IconButton>
                                        </Stack>
                                    }
                                >
                                    <ListItemButton
                                        onClick={() => handleUserSwitch(user)}
                                        disabled={isValidating || isCurrent || batchValidating}
                                        sx={{
                                            py: 2,
                                            px: 3,
                                            pr: 30, // 为 secondaryAction 留出更多空间
                                            '&.Mui-disabled': { opacity: 1 }
                                        }}
                                    >
                                        <ListItemAvatar>
                                            <Avatar
                                                src={user.avatar}
                                                sx={{
                                                    width: 56,
                                                    height: 56,
                                                    border: isCurrent ? '2px solid' : 'none',
                                                    borderColor: 'primary.main'
                                                }}
                                            />
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                        {user.nickname}
                                                    </Typography>
                                                    {isCurrent && (
                                                        <Chip
                                                            label="活跃"
                                                            size="small"
                                                            color="primary"
                                                            icon={<CheckCircle2 size={12} />}
                                                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                                                        />
                                                    )}
                                                </Stack>
                                            }
                                            secondary={user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                                            primaryTypographyProps={{ component: 'div' }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}
                    </List>

                    {users.length === 0 && (
                        <Box sx={{ py: 8, textAlign: 'center', opacity: 0.5 }}>
                            <UserIcon size={48} style={{ marginBottom: 16 }} />
                            <Typography>暂无已登录账号</Typography>
                        </Box>
                    )}
                </Paper>

                <Box sx={{
                    p: 3,
                    borderRadius: 4,
                    bgcolor: 'rgba(255,36,66,0.05)',
                    border: '1px solid rgba(255,36,66,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                }}>
                    <LogOut size={24} style={{ color: 'var(--mui-palette-primary-main)' }} />
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>多账号安全</Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                            所有账号的登录凭证均分块加密存储在本地 Profile 目录中。切换账号时会自动加载对应的浏览器上下文，互不干扰。
                        </Typography>
                    </Box>
                </Box>
            </Stack>

            {/* 用户数据分析 */}
            {currentUser && (
                <Box sx={{ mt: 4 }}>
                    <UserAnalyticsCard phone={currentUser.phone} />
                </Box>
            )}

            <LoginDialog
                open={loginOpen}
                onClose={() => setLoginOpen(false)}
                onSuccess={(user) => {
                    fetchUsers();
                    setCurrentUser(user);
                    setLoginOpen(false);
                }}
            />
        </Box>
    );
};
