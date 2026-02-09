import { useState, useMemo, useEffect } from 'react';
import { Box, Typography, Avatar, IconButton, Stack } from '@mui/material';
import { Heart, MessageCircle, Star, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store';
import { convertFileSrc } from '@tauri-apps/api/core';

export const PreviewPanel = () => {
    const { currentPost, currentUser } = useAppStore();
    const [activeIndex, setActiveIndex] = useState(0);

    // Combine cover and other images for the preview list
    const allImages = useMemo(() => {
        const list = [...currentPost.images];
        if (currentPost.coverImage && !list.includes(currentPost.coverImage)) {
            list.unshift(currentPost.coverImage);
        }
        return list;
    }, [currentPost.images, currentPost.coverImage]);

    // Reset index if image count changes and current index is out of bounds
    useEffect(() => {
        if (activeIndex >= allImages.length && allImages.length > 0) {
            setActiveIndex(0);
        }
    }, [allImages.length]);

    const displayImage = allImages[activeIndex] || null;

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveIndex((prev) => (prev + 1) % allImages.length);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    };

    return (
        <Box sx={{
            width: '100%',
            bgcolor: '#fff',
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            color: '#333',
            height: 'fit-content',
            maxHeight: 700,
            position: 'relative',
        }}>
            {/* Top Bar (Fake Phone Status + App Header) */}
            <Box sx={{
                height: 44,
                width: '100%',
                px: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f0f0f0',
                bgcolor: '#fff'
            }}>
                <IconButton size="small"><ChevronLeft size={20} /></IconButton>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar
                        src={currentUser?.avatar || undefined}
                        sx={{ width: 24, height: 24 }}
                    >
                        {currentUser?.nickname?.charAt(0)}
                    </Avatar>
                    <Typography variant="caption" fontWeight="bold">
                        {currentUser?.nickname || '用户名'}
                    </Typography>
                </Stack>
                <IconButton size="small"><Share2 size={18} /></IconButton>
            </Box>

            {/* Content Area (Scrollable) */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {/* Image Section */}
                <Box sx={{ position: 'relative', width: '100%', aspectRatio: '3/4', bgcolor: '#f5f5f5' }}>
                    {displayImage ? (
                        <img
                            key={displayImage} // Force re-render for animation if needed
                            src={displayImage.startsWith('http') ? displayImage : convertFileSrc(displayImage)}
                            alt="Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.3s' }}
                        />
                    ) : (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                            <Typography variant="body2">暂无图片素材</Typography>
                        </Box>
                    )}

                    {/* Navigation Overlays */}
                    {allImages.length > 1 && (
                        <>
                            <IconButton
                                onClick={handlePrev}
                                sx={{
                                    position: 'absolute',
                                    left: 8,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    bgcolor: 'rgba(255,255,255,0.7)',
                                    color: '#000',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                                    width: 32,
                                    height: 32,
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                }}
                                size="small"
                            >
                                <ChevronLeft size={20} />
                            </IconButton>
                            <IconButton
                                onClick={handleNext}
                                sx={{
                                    position: 'absolute',
                                    right: 8,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    bgcolor: 'rgba(255,255,255,0.7)',
                                    color: '#000',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                                    width: 32,
                                    height: 32,
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                }}
                                size="small"
                            >
                                <ChevronRight size={20} />
                            </IconButton>

                            <Box sx={{
                                position: 'absolute',
                                bottom: 12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                bgcolor: 'rgba(0,0,0,0.4)',
                                color: '#fff',
                                px: 1.2,
                                py: 0.3,
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 'bold',
                                backdropFilter: 'blur(4px)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                            }}>
                                {activeIndex + 1} / {allImages.length}
                            </Box>
                        </>
                    )}
                </Box>

                {/* Text Section */}
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 900, mb: 1, lineHeight: 1.4 }}>
                        {currentPost.title || '这里写标题更加吸引人～'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: 14, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.7, mb: 2 }}>
                        {currentPost.content || '快来分享你的精彩故事吧...'}
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        编辑于 {new Date().toLocaleDateString()}
                    </Typography>
                    <Box sx={{ height: '1px', bgcolor: '#f0f0f0', mb: 2 }} />
                </Box>
            </Box>

            {/* Bottom Interaction Bar (Fake) */}
            <Box sx={{
                height: 52,
                px: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid #f0f0f0',
                bgcolor: '#fff'
            }}>
                <Box sx={{
                    flex: 1,
                    height: 32,
                    bgcolor: '#f5f5f5',
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    mr: 2
                }}>
                    <Typography variant="caption" color="text.secondary">说点什么...</Typography>
                </Box>
                <Stack direction="row" spacing={2.5}>
                    <Stack alignItems="center" spacing={0.2} sx={{ color: '#666' }}>
                        <Heart size={20} />
                        <Typography variant="caption" sx={{ fontSize: 9 }}>点赞</Typography>
                    </Stack>
                    <Stack alignItems="center" spacing={0.2} sx={{ color: '#666' }}>
                        <Star size={20} />
                        <Typography variant="caption" sx={{ fontSize: 9 }}>收藏</Typography>
                    </Stack>
                    <Stack alignItems="center" spacing={0.2} sx={{ color: '#666' }}>
                        <MessageCircle size={20} />
                        <Typography variant="caption" sx={{ fontSize: 9 }}>评论</Typography>
                    </Stack>
                </Stack>
            </Box>
        </Box>
    );
};
