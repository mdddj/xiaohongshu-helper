import React, { useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    Skeleton,
    IconButton,
    Tooltip,
    Grid,
    Stack,
    Divider,
} from '@mui/material';
import {
    RefreshCcw,
    Flame,
} from 'lucide-react';
import { useAppStore, TrendItem } from '../store';

const SourceHeader: React.FC<{ source: string }> = ({ source }) => {
    let color = 'text.primary';
    let label = source;
    let bgColor = 'rgba(0,0,0,0.05)';

    switch (source.toLowerCase()) {
        case 'bilibil':
            label = 'Bilibili';
            color = '#fb7299';
            bgColor = 'rgba(251, 114, 153, 0.1)';
            break;
        case 'zhihu':
            label = '知乎热榜';
            color = '#0084ff';
            bgColor = 'rgba(0, 132, 255, 0.1)';
            break;
        case 'weibo':
            label = '微博热搜';
            color = '#eb192d';
            bgColor = 'rgba(235, 25, 45, 0.1)';
            break;
        case 'github':
            label = 'GitHub Trending';
            color = '#24292e';
            bgColor = 'rgba(36, 41, 46, 0.1)'; // Dark mode friendly adaptation needed
            break;
        case 'ithome':
            label = 'IT之家';
            color = '#d22222';
            bgColor = 'rgba(210, 34, 34, 0.1)';
            break;
        case 'douban':
            label = '豆瓣新片';
            color = '#007722';
            bgColor = 'rgba(0, 119, 34, 0.1)';
            break;
        case '36kr':
            label = '36氪';
            color = '#2867ce';
            bgColor = 'rgba(40, 103, 206, 0.1)';
            break;
        case 'baidu':
            label = '百度热搜';
            color = '#2932e1';
            bgColor = 'rgba(41, 50, 225, 0.1)';
            break;
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box sx={{
                width: 4,
                height: 20,
                borderRadius: 2,
                bgcolor: color
            }} />
            <Box sx={{
                px: 1,
                py: 0.5,
                borderRadius: 1.5,
                bgcolor: bgColor,
                display: 'flex',
                alignItems: 'center'
            }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: color, fontSize: 13, lineHeight: 1 }}>
                    {label}
                </Typography>
            </Box>
        </Box>
    );
};

const TrendListItem: React.FC<{ item: TrendItem, index: number }> = ({ item, index }) => {
    return (
        <Tooltip
            title={
                <Box sx={{ p: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{item.title}</Typography>
                    {item.desc && <Typography variant="body2">{item.desc}</Typography>}
                </Box>
            }
            placement="top"
            arrow
        >
            <Box
                onClick={() => item.url && window.open(item.url, '_blank')}
                sx={{
                    py: 1.5,
                    px: 1,
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                        bgcolor: 'action.hover',
                        transform: 'translateX(4px)'
                    }
                }}
            >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 900,
                            color: index < 3 ? 'primary.main' : 'text.disabled',
                            minWidth: 16,
                            lineHeight: 1.6
                        }}
                    >
                        {index + 1}.
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            variant="body2"
                            noWrap
                            sx={{
                                fontWeight: 600,
                                mb: 0.8,
                                lineHeight: 1.5,
                                color: 'text.primary',
                                display: 'block'
                            }}
                        >
                            {item.title}
                        </Typography>

                        {item.desc && (
                            <Typography variant="caption" sx={{
                                color: 'text.secondary',
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                mb: 1,
                                fontSize: 11,
                                lineHeight: 1.4
                            }}>
                                {item.desc}
                            </Typography>
                        )}

                        <Stack direction="row" spacing={1} alignItems="center">
                            {item.sorting && (
                                <Chip
                                    icon={<Flame size={10} />}
                                    label={item.sorting}
                                    size="small"
                                    sx={{
                                        height: 18,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 36, 66, 0.2)' : 'rgba(255, 36, 66, 0.08)',
                                        color: 'primary.main',
                                        border: 'none',
                                        '& .MuiChip-icon': {
                                            width: 12,
                                            height: 12
                                        }
                                    }}
                                />
                            )}
                            {item.user && (
                                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10 }}>
                                    • {item.user}
                                </Typography>
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </Box>
        </Tooltip>
    );
};

export const TrendsView = () => {
    const { trends, trendsLoading, fetchTrends } = useAppStore();

    useEffect(() => {
        if (!trends) {
            fetchTrends();
        }
    }, []);

    const handleRefresh = () => {
        fetchTrends();
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header Area */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, px: 1 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -1 }}>
                        全网趋势汇聚
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        一站式浏览各大平台实时热点，发现灵感
                    </Typography>
                </Box>
                <Tooltip title="刷新数据">
                    <IconButton
                        onClick={handleRefresh}
                        disabled={trendsLoading}
                        sx={{
                            bgcolor: 'rgba(255,255,255,0.03)',
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                        }}
                    >
                        <RefreshCcw size={20} className={trendsLoading ? 'animate-spin' : ''} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Content Area */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
                {trendsLoading ? (
                    <Grid container spacing={2}>
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Grid size={{ xs: 12, md: 4 }} key={i}>
                                <Skeleton
                                    variant="rectangular"
                                    height={400}
                                    sx={{ borderRadius: 4, bgcolor: 'rgba(255,255,255,0.02)' }}
                                />
                            </Grid>
                        ))}
                    </Grid>
                ) : (
                    <Grid container spacing={2}>
                        {trends && Object.entries(trends).map(([source, items]) => (
                            <Grid size={{ xs: 12, md: 4 }} key={source}>
                                <Card sx={{
                                    height: 'auto',
                                    maxHeight: 520,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
                                    borderRadius: 4,
                                    border: (theme) => `1px solid ${theme.palette.divider}`,
                                    boxShadow: 'none',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        boxShadow: (theme) => `0 8px 24px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)'}`,
                                    }
                                }}>
                                    <CardContent sx={{
                                        p: 2,
                                        '&:last-child': { pb: 2 },
                                        overflowY: 'auto',
                                        '&::-webkit-scrollbar': {
                                            width: '4px',
                                        },
                                        '&::-webkit-scrollbar-track': {
                                            background: 'transparent',
                                        },
                                        '&::-webkit-scrollbar-thumb': {
                                            background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                            borderRadius: '4px',
                                        },
                                        '&::-webkit-scrollbar-thumb:hover': {
                                            background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                                        }
                                    }}>
                                        <SourceHeader source={source} />
                                        <Divider sx={{ mb: 1, borderStyle: 'dashed' }} />
                                        <Stack spacing={0}>
                                            {items.slice(0, 10).map((item, idx) => (
                                                <TrendListItem key={idx} item={item} index={idx} />
                                            ))}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Box>
        </Box>
    );
};
