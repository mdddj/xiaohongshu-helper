import { useState, useEffect } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Typography,
  Button,
  Paper,
  Box,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  IconButton,
  CircularProgress
} from '@mui/material';
import { useMemo } from 'react';
import { useMediaQuery } from '@mui/material';
import { getAppTheme } from './theme';
import { useAppStore } from './store';
import { Plus, User as UserIcon, Trash2, Shield } from 'lucide-react';
import { LoginDialog } from './components/LoginDialog';
import { invoke } from '@tauri-apps/api/core';
import { AppLayout } from './components/Layout';
import { confirm, message } from '@tauri-apps/plugin-dialog';

function App() {
  const {
    currentUser, setCurrentUser, loadInitialConfig,
    users, fetchUsers,
    mcpStatus, fetchMcpStatus,
    themeMode
  } = useAppStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [mcpStarting, setMcpStarting] = useState(false);
  const [hasAutoStartedMcp, setHasAutoStartedMcp] = useState(false);

  const handleUserClick = async (user: any) => {
    if (validating) return;
    setValidating(user.phone);
    try {
      const validatedUser: any = await invoke('validate_login_status', { phone: user.phone });
      setCurrentUser(validatedUser);
    } catch (e: any) {
      console.error(e);
      await message('登录验证失败：' + e + '，请点击“绑定新账号”重新登录。', { title: '验证失败', kind: 'error' });
    } finally {
      setValidating(null);
    }
  };

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(() => {
    const mode = themeMode === 'system' ? (prefersDarkMode ? 'dark' : 'light') : themeMode;
    return getAppTheme(mode);
  }, [themeMode, prefersDarkMode]);


  const handleDeleteUser = async (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();

    // 使用 Tauri 的原生对话框
    const confirmed = await confirm(
      `确定要移除账号 ${phone} 吗？\n所有本地保存的草稿和登录状态将被清空。`,
      { title: '移除账号', kind: 'warning' }
    );

    if (confirmed) {
      try {
        await invoke('logout_user', { phone });
        await fetchUsers();
      } catch (e) {
        console.error(e);
        await message('删除失败: ' + e, { title: '错误', kind: 'error' });
      }
    }
  };

  useEffect(() => {
    fetchUsers();
    loadInitialConfig();
    fetchMcpStatus();
    const mcpTimer = setInterval(fetchMcpStatus, 5000);
    return () => clearInterval(mcpTimer);
  }, []);

  // MCP Auto-start logic
  useEffect(() => {
    const autoStartMcp = async () => {
      const savedAutoStart = localStorage.getItem('mcp_auto_start') === 'true';
      const savedPort = localStorage.getItem('mcp_port') || '8001';

      if (savedAutoStart && !mcpStatus.is_running && !hasAutoStartedMcp) {
        setHasAutoStartedMcp(true);
        setMcpStarting(true);
        try {
          await invoke('start_mcp_server', { port: parseInt(savedPort) });
          await fetchMcpStatus();
        } catch (e) {
          console.error('MCP Auto-start failed:', e);
        } finally {
          setMcpStarting(false);
        }
      }
    };

    autoStartMcp();
  }, [mcpStatus.is_running, hasAutoStartedMcp]);

  // 当进入用户选择界面（没有当前用户时），强制刷新一次列表
  useEffect(() => {
    if (!currentUser) {
      fetchUsers();
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: (theme) => theme.palette.mode === 'dark'
            ? 'radial-gradient(circle at center, #1a1a24 0%, #0f0f12 100%)'
            : 'radial-gradient(circle at center, #f5f5f7 0%, #e8e8ed 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            width: '150%',
            height: '150%',
            background: (theme) => theme.palette.mode === 'dark'
              ? 'radial-gradient(circle at 30% 30%, rgba(255,36,66,0.05) 0%, transparent 40%)'
              : 'radial-gradient(circle at 30% 30%, rgba(255,36,66,0.03) 0%, transparent 40%)',
            pointerEvents: 'none'
          }
        }}>
          <Paper sx={{
            p: 6,
            width: 480,
            textAlign: 'center',
            borderRadius: 8,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(26, 26, 31, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid',
            borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? '0 20px 50px rgba(0,0,0,0.4)'
              : '0 20px 50px rgba(0,0,0,0.08)',
            zIndex: 1
          }}>
            <Box sx={{ mb: 5 }}>
              <Typography variant="h4" sx={{
                fontWeight: 900,
                mb: 1.5,
                letterSpacing: -1,
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(45deg, #fff 30%, rgba(255,255,255,0.8) 90%)'
                  : 'linear-gradient(45deg, #1a1a1b 30%, #666 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                启航发布
              </Typography>
              <Typography variant="body1" sx={{
                color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                fontWeight: 500
              }}>
                选择一个灵感引擎继续创作
              </Typography>
            </Box>

            <Box sx={{ maxHeight: 340, overflowY: 'auto', mb: 4, px: 1 }}>
              {users.length > 0 ? (
                <List sx={{ width: '100%', gap: 1.5, display: 'flex', flexDirection: 'column' }}>
                  {users.map((user) => (
                    <ListItem
                      key={user.id}
                      disablePadding
                      secondaryAction={
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={(e) => handleDeleteUser(e, user.phone)}
                          sx={{
                            color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'text.disabled',
                            '&:hover': { color: '#ff4d4f', bgcolor: 'rgba(255,77,79,0.1)' }
                          }}
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      }
                    >
                      <ListItemButton
                        onClick={() => handleUserClick(user)}
                        disabled={validating !== null}
                        sx={{
                          py: 2,
                          px: 3,
                          borderRadius: 4,
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                          border: '1px solid',
                          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          transition: 'all 0.2s',
                          opacity: validating && validating !== user.phone ? 0.5 : 1,
                          '&:hover': {
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                            borderColor: 'primary.main',
                            transform: 'translateY(-3px)',
                            boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.05)'
                          }
                        }}
                      >
                        <ListItemAvatar>
                          <Box sx={{ position: 'relative' }}>
                            <Avatar
                              src={user.avatar || undefined}
                              sx={{
                                bgcolor: 'rgba(255,36,66,0.1)',
                                color: 'primary.main',
                                width: 44,
                                height: 44,
                                opacity: validating === user.phone ? 0.4 : 1
                              }}
                            >
                              <UserIcon size={22} />
                            </Avatar>
                            {validating === user.phone && (
                              <CircularProgress
                                size={24}
                                sx={{
                                  position: 'absolute',
                                  top: 10,
                                  left: 10,
                                  zIndex: 1,
                                  color: 'primary.main'
                                }}
                              />
                            )}
                          </Box>
                        </ListItemAvatar>
                        <ListItemText
                          primary={user.nickname}
                          secondary={user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                          primaryTypographyProps={{ fontWeight: 800, fontSize: '1rem' }}
                          secondaryTypographyProps={{ fontSize: '0.75rem', sx: { opacity: 0.6 } }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 4 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>尚无活跃账号</Typography>
                </Box>
              )}
            </Box>

            <Button
              variant="contained"
              startIcon={<Plus size={20} />}
              fullWidth
              size="large"
              onClick={() => setLoginOpen(true)}
              sx={{
                py: 2,
                borderRadius: 4,
                fontSize: '1rem',
                fontWeight: 800,
                boxShadow: '0 10px 20px rgba(255,36,66,0.3)',
                '&:hover': { boxShadow: '0 15px 30px rgba(255,36,66,0.5)' }
              }}
            >
              绑定新账号
            </Button>
          </Paper>
        </Box>

        <Box sx={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', alignItems: 'center', gap: 1.5, zIndex: 1000 }}>
          <Paper sx={{
            px: 2,
            py: 1,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }}>
            {mcpStarting || (hasAutoStartedMcp && !mcpStatus.is_running) ? (
              <CircularProgress size={14} color="primary" />
            ) : (
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: mcpStatus.is_running ? '#22c55e' : '#94a3b8',
                boxShadow: mcpStatus.is_running ? '0 0 10px rgba(34, 197, 94, 0.4)' : 'none'
              }} />
            )}
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.8 }}>
              MCP {mcpStatus.is_running ? '已就绪' : (mcpStarting ? '启动中...' : '未启动')}
            </Typography>
            <Shield size={14} style={{ opacity: 0.5 }} />
          </Paper>
        </Box>

        <LoginDialog
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={(user) => {
            fetchUsers();
            setCurrentUser(user);
            setLoginOpen(false);
          }}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppLayout />
    </ThemeProvider>
  );
}

export default App;
