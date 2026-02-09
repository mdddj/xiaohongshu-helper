import { Box, IconButton, Typography, Avatar, Stack } from '@mui/material';
import {
    FileText,
    Image as ImageIcon,
    Settings,
    Users,
    TrendingUp,
    LogOut,
    Plus
} from 'lucide-react';
import { useAppStore } from '../store';
import { PreviewPanel } from './PreviewPanel';
import { DraftsList } from './DraftsList';
import { PublishView } from './PublishView';
import { SettingsView } from './SettingsView';
import { AssetsView } from './AssetsView';
import { TrendsView } from './TrendsView';

import { MCPView } from './MCPView.tsx';
import { APIView } from './APIView';
import { UsersView } from './UsersView';
import { Cpu, Server } from 'lucide-react';

const NavigationPane = () => {
    const { activeTab, setActiveTab, currentUser, setCurrentUser } = useAppStore();

    const handleLogout = async () => {
        if (currentUser) {
            // 只在前端重置状态，返回启航页面
            setCurrentUser(null);
            setActiveTab('publish');
        }
    };

    const items = [
        { id: 'publish', icon: <FileText size={20} />, label: '创作发布' },
        { id: 'assets', icon: <ImageIcon size={20} />, label: '素材库' },
        { id: 'users', icon: <Users size={20} />, label: '账号' },
        { id: 'trends', icon: <TrendingUp size={20} />, label: '趋势' },
        { id: 'mcp', icon: <Cpu size={20} />, label: 'MCP 服务' },
        { id: 'api', icon: <Server size={20} />, label: 'API 服务' },
        { id: 'settings', icon: <Settings size={20} />, label: '全局设置' },
    ];

    return (
        <Box sx={{
            width: 240,
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid',
            borderColor: 'divider',
            height: '100%'
        }}>
            {/* Logo/Header */}
            <Box sx={{ p: 3, mb: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'primary.main',
                        borderRadius: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(255, 36, 66, 0.4)'
                    }}>
                        <Plus color="#fff" size={20} />
                    </Box>
                    <Typography variant="h6" sx={{ letterSpacing: -0.5, fontWeight: 800 }}>
                        Xiaohongshu<Box component="span" sx={{ color: 'primary.main' }}>+</Box>
                    </Typography>
                </Stack>
            </Box>

            {/* Nav Items */}
            <Box sx={{ flex: 1, px: 2 }}>
                {items.map((item) => (
                    <Box
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            px: 2,
                            py: 1.5,
                            mb: 0.5,
                            borderRadius: 3,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            color: activeTab === item.id ? 'primary.main' : 'text.secondary',
                            bgcolor: activeTab === item.id ? 'rgba(255, 36, 66, 0.08)' : 'transparent',
                            '&:hover': {
                                bgcolor: activeTab === item.id ? 'rgba(255, 36, 66, 0.12)' : 'rgba(255,255,255,0.03)',
                                transform: 'translateX(4px)'
                            }
                        }}
                    >
                        {item.icon}
                        <Typography variant="body2" sx={{ fontWeight: activeTab === item.id ? 700 : 500 }}>
                            {item.label}
                        </Typography>
                    </Box>
                ))}
            </Box>

            {/* Bottom User Area */}
            <Box
                sx={{
                    p: 2,
                    m: 2,
                    bgcolor: 'background.paper',
                    borderRadius: 3,
                    boxShadow: 10,
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.dark' }} src={currentUser?.avatar}>
                        {currentUser?.nickname?.charAt(0)}
                    </Avatar>
                    <Box sx={{ flex: 1, overflow: 'hidden' }}>
                        <Typography variant="caption" noWrap sx={{ fontWeight: 700, display: 'block' }}>
                            {currentUser?.nickname}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
                            已登录
                        </Typography>
                    </Box>
                    <IconButton size="small" onClick={handleLogout} sx={{ color: 'text.secondary' }}>
                        <LogOut size={16} />
                    </IconButton>
                </Stack>
            </Box>
        </Box>
    );
};

export const AppLayout = () => {
    const { activeTab } = useAppStore();

    const renderContent = () => {
        switch (activeTab) {
            case 'publish': return <PublishView />;
            case 'settings': return <SettingsView />;
            case 'assets': return <AssetsView />;
            case 'trends': return <TrendsView />;
            case 'mcp': return <MCPView />;
            case 'api': return <APIView />;
            case 'users': return <UsersView />;
            default: return (
                <Box sx={{ p: 8, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="h5" gutterBottom>功能模块开发中</Typography>
                    <Typography variant="body1" color="text.secondary">
                        {activeTab.toUpperCase()} 模块正在全力研发，敬请期待。
                    </Typography>
                </Box>
            );
        }
    };

    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default', color: 'text.primary' }}>
            <NavigationPane />

            {/* Left Drawer Area (Used for Contextual Sidebars like Drafts) */}
            {activeTab === 'publish' && (
                <Box sx={{
                    width: 260,
                    bgcolor: 'background.default',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <DraftsList />
                </Box>
            )}

            {/* Main Content Area */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
                    {renderContent()}
                </Box>

                {/* Right Preview Panel */}
                <Box sx={{
                    width: 420,
                    bgcolor: 'rgba(255,255,255,0.015)',
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    p: 4,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <Typography variant="overline" gutterBottom sx={{ mb: 3, letterSpacing: 2, color: 'text.secondary', fontWeight: 600 }}>
                        实时效果预览
                    </Typography>
                    <Box sx={{
                        width: '100%',
                        maxWidth: 360,
                        transform: 'scale(1)',
                        transformOrigin: 'top center'
                    }}>
                        <PreviewPanel />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};
