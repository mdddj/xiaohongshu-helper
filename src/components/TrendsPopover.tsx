import { useState } from 'react';
import {
    Popover,
    Box,
    Typography,
    Stack,
    Tabs,
    Tab,
    Grid,
    CircularProgress
} from '@mui/material';
import { TrendingUp } from 'lucide-react';

interface TrendsPopoverProps {
    anchorEl: HTMLElement | null;
    onClose: () => void;
    onSelectTrend: (trendTitle: string) => void;
    trends: Record<string, Array<{ title: string }>> | null;
    trendsLoading: boolean;
}

export const TrendsPopover = ({
    anchorEl,
    onClose,
    onSelectTrend,
    trends,
    trendsLoading
}: TrendsPopoverProps) => {
    const [activePlatform, setActivePlatform] = useState('weibo');

    const platformLabels: Record<string, string> = {
        'bilibili': 'B站热搜',
        'zhihu': '知乎热榜',
        'weibo': '微博热搜',
        'github': 'GitHub',
        'ithome': 'IT之家',
        'douban': '豆瓣新片',
        '36kr': '36氪',
        'baidu': '百度热搜'
    };

    return (
        <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
                sx: {
                    mt: 1,
                    width: 480,
                    maxHeight: 500,
                    borderRadius: 3,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: (theme) => `1px solid ${theme.palette.divider}`
                }
            }}
        >
            <Box sx={{
                p: 2,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)',
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`
            }}>
                <Stack spacing={2}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingUp size={16} color="orange" /> 全平台实时热点
                    </Typography>
                    <Tabs
                        value={activePlatform}
                        onChange={(_, v) => setActivePlatform(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            minHeight: 32,
                            '& .MuiTabs-scrollButtons': {
                                width: 20
                            },
                            '& .MuiTab-root': {
                                minHeight: 30,
                                fontSize: 12,
                                px: 1.5,
                                py: 0.5,
                                minWidth: 'auto',
                                borderRadius: 1.5,
                                mr: 0.5,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                color: 'text.secondary',
                                transition: 'all 0.2s',
                                '&.Mui-selected': {
                                    bgcolor: 'primary.main',
                                    color: '#fff',
                                    fontWeight: 700
                                }
                            }
                        }}
                        TabIndicatorProps={{ sx: { display: 'none' } }}
                    >
                        {trends && Object.keys(trends)
                            .sort((a, b) => {
                                if (a.toLowerCase() === 'weibo') return -1;
                                if (b.toLowerCase() === 'weibo') return 1;
                                return 0;
                            })
                            .map(platform => (
                                <Tab
                                    key={platform}
                                    label={platformLabels[platform.toLowerCase()] || platform}
                                    value={platform}
                                />
                            ))}
                    </Tabs>
                </Stack>
            </Box>

            <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
                {trendsLoading ? (
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        flexDirection: 'column',
                        gap: 2,
                        opacity: 0.7
                    }}>
                        <CircularProgress size={32} thickness={5} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>正在获取全网热点...</Typography>
                    </Box>
                ) : (
                    <>
                        <Grid container spacing={1}>
                            {(trends ? trends[activePlatform] || [] : []).map((trend, idx) => (
                                <Grid size={{ xs: 6 }} key={idx}>
                                    <Box
                                        onClick={() => {
                                            onSelectTrend(trend.title);
                                            onClose();
                                        }}
                                        sx={{
                                            p: 1.2,
                                            borderRadius: 2,
                                            cursor: 'pointer',
                                            fontSize: 13,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            transition: 'all 0.2s',
                                            border: (theme) => `1px solid ${theme.palette.divider}`,
                                            '&:hover': {
                                                bgcolor: 'primary.main',
                                                color: '#fff',
                                                borderColor: 'primary.main',
                                                transform: 'translateY(-1px)',
                                                boxShadow: '0 4px 12px rgba(255,36,66,0.15)'
                                            }
                                        }}
                                    >
                                        {trend.title}
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                        {(!trends || (activePlatform === 'all' ? Object.values(trends).flat().length === 0 : !trends[activePlatform]?.length)) && (
                            <Box sx={{ py: 4, textAlign: 'center', opacity: 0.5 }}>
                                <Typography variant="body2">暂无热点数据</Typography>
                            </Box>
                        )}
                    </>
                )}
            </Box>

            <Box sx={{
                p: 1.5,
                textAlign: 'center',
                borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)'
            }}>
                <Typography variant="caption" color="text.secondary">点击热点即可自动填入编辑器</Typography>
            </Box>
        </Popover>
    );
};
