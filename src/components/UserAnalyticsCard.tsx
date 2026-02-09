import { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    CircularProgress,
    Alert,
    Chip,
    Divider,
    Stack,
    Tooltip,
    IconButton
} from '@mui/material';
import { TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Bookmark, Share2, Users, BarChart3 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { InfoOutline } from '@mui/icons-material';

interface UserAnalytics {
    following_count: number;
    followers_count: number;
    likes_and_collections: number;
    exposure_count: number;
    view_count: number;
    cover_click_rate: number;
    video_completion_rate: number;
    like_count: number;
    comment_count: number;
    collection_count: number;
    share_count: number;
    net_follower_growth: number;
    new_followers: number;
    unfollowers: number;
    profile_visitors: number;
    period: string;
}

interface Props {
    phone: string;
}

export const UserAnalyticsCard = ({ phone }: Props) => {
    const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFetchAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const data: UserAnalytics = await invoke('fetch_user_analytics', { phone });
            setAnalytics(data);
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ icon: Icon, label, value, unit = '', trend }: any) => (
        <Paper sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            border: '1px solid',
            borderColor: 'divider',
            transition: 'all 0.2s',
            '&:hover': {
                borderColor: 'primary.main',
                transform: 'translateY(-2px)'
            }
        }}>
            <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon size={16} style={{ opacity: 0.6 }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                        {label}
                    </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {value.toLocaleString()}{unit}
                </Typography>
                {trend && (
                    <Chip
                        label={trend}
                        size="small"
                        icon={trend.startsWith('+') ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        color={trend.startsWith('+') ? 'success' : 'error'}
                        sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                    />
                )}
            </Stack>
        </Paper>
    );

    return (
        <Paper sx={{
            p: 4,
            borderRadius: 6,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 'none',
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BarChart3 size={20} />
                        数据分析
                        <Tooltip title="原理: 通过 AI 分析后台首页页面，提取关键数据，如关注数、粉丝数、获赞数等。">
                            <IconButton>
                                <InfoOutline />
                            </IconButton>
                        </Tooltip>
                    </Typography>
                    {analytics && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                            统计周期: {analytics.period}
                        </Typography>
                    )}
                </Box>
                <Button
                    variant="contained"
                    onClick={handleFetchAnalytics}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <BarChart3 size={16} />}
                    sx={{ borderRadius: 3 }}
                >
                    {loading ? '分析中...' : analytics ? '刷新数据' : '获取数据'}
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
                    {error}
                </Alert>
            )}

            {analytics && (
                <Box>
                    {/* 基础数据 */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, opacity: 0.7 }}>
                        基础数据
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
                        <StatCard
                            icon={Users}
                            label="关注数"
                            value={analytics.following_count}
                        />
                        <StatCard
                            icon={Users}
                            label="粉丝数"
                            value={analytics.followers_count}
                        />
                        <StatCard
                            icon={Heart}
                            label="获赞与收藏"
                            value={analytics.likes_and_collections}
                        />
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* 笔记数据总览 */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, opacity: 0.7 }}>
                        笔记数据总览 (近30日)
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
                        <StatCard
                            icon={Eye}
                            label="曝光数"
                            value={analytics.exposure_count}
                        />
                        <StatCard
                            icon={Eye}
                            label="观看数"
                            value={analytics.view_count}
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="封面点击率"
                            value={analytics.cover_click_rate}
                            unit="%"
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="视频完播率"
                            value={analytics.video_completion_rate}
                            unit="%"
                        />
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* 互动数据 */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, opacity: 0.7 }}>
                        互动数据
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
                        <StatCard
                            icon={Heart}
                            label="点赞数"
                            value={analytics.like_count}
                        />
                        <StatCard
                            icon={MessageCircle}
                            label="评论数"
                            value={analytics.comment_count}
                        />
                        <StatCard
                            icon={Bookmark}
                            label="收藏数"
                            value={analytics.collection_count}
                        />
                        <StatCard
                            icon={Share2}
                            label="分享数"
                            value={analytics.share_count}
                        />
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* 粉丝数据 */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, opacity: 0.7 }}>
                        粉丝数据
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
                        <StatCard
                            icon={TrendingUp}
                            label="净涨粉"
                            value={analytics.net_follower_growth}
                        />
                        <StatCard
                            icon={Users}
                            label="新增关注"
                            value={analytics.new_followers}
                        />
                        <StatCard
                            icon={Users}
                            label="取消关注"
                            value={analytics.unfollowers}
                        />
                        <StatCard
                            icon={Eye}
                            label="主页访客"
                            value={analytics.profile_visitors}
                        />
                    </Box>
                </Box>
            )}

            {!analytics && !loading && !error && (
                <Box sx={{ py: 8, textAlign: 'center', opacity: 0.5 }}>
                    <BarChart3 size={48} style={{ marginBottom: 16 }} />
                    <Typography>点击"获取数据"按钮查看账号数据分析</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                        需要先在设置中配置数据分析 AI
                    </Typography>
                </Box>
            )}
        </Paper>
    );
};
