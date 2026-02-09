import { Box, List, ListItemButton, ListItemText, Typography, IconButton, Tooltip } from '@mui/material';
import { Trash2, FileEdit, RefreshCw, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';

export const DraftsList = () => {
    const { drafts, fetchDrafts, setCurrentPost, currentUser } = useAppStore();

    useEffect(() => {
        if (currentUser) {
            fetchDrafts();
        }
    }, [currentUser]);

    const handleSelectDraft = (draft: any) => {
        setCurrentPost({
            id: draft.id,
            title: draft.title,
            content: draft.content,
            images: draft.images,
            coverImage: draft.coverImage
        });
    };

    const handleDeleteDraft = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const confirmed = await confirm('确定要删除这个草稿吗？', {
            title: '删除草稿',
            kind: 'warning'
        });

        if (confirmed) {
            try {
                await invoke('delete_post', { postId: id });
                fetchDrafts();
            } catch (err) {
                console.error('Failed to delete draft', err);
            }
        }
    };

    const handleNewPost = () => {
        setCurrentPost({
            id: undefined,
            title: '',
            content: '',
            images: [],
            coverImage: undefined
        });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800, px: 1, letterSpacing: 1 }}>
                    草稿箱
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="刷新">
                        <IconButton size="small" onClick={() => fetchDrafts()} sx={{ color: 'text.secondary' }}>
                            <RefreshCw size={14} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="新笔记">
                        <IconButton size="small" onClick={handleNewPost} sx={{ color: 'primary.main', bgcolor: 'rgba(255,36,66,0.1)' }}>
                            <Plus size={14} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <List sx={{ flex: 1, overflowY: 'auto', py: 1, px: 1 }}>
                {drafts.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.5 }}>
                            尚未保存任何草稿
                        </Typography>
                    </Box>
                ) : (
                    drafts.map((draft) => {
                        const isSelected = useAppStore.getState().currentPost.id === draft.id;
                        return (
                            <ListItemButton
                                key={draft.id}
                                onClick={() => handleSelectDraft(draft)}
                                sx={{
                                    py: 1.5,
                                    px: 2,
                                    mb: 0.5,
                                    borderRadius: 3,
                                    bgcolor: isSelected ? 'rgba(255,255,255,0.04)' : 'transparent',
                                    border: isSelected ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                                    '&:hover .delete-btn': { opacity: 1 },
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', overflow: 'hidden' }}>
                                    <FileEdit size={16} color={isSelected ? '#ff2442' : '#666'} />
                                    <ListItemText
                                        primary={draft.title || '未命名动态'}
                                        primaryTypographyProps={{
                                            variant: 'body2',
                                            noWrap: true,
                                            sx: {
                                                color: isSelected
                                                    ? (theme: any) => theme.palette.mode === 'dark' ? '#fff' : 'primary.main'
                                                    : 'text.primary',
                                                fontWeight: isSelected ? 700 : 500,
                                                fontSize: '13px'
                                            }
                                        }}
                                        secondary={new Date(draft.created_at || '').toLocaleDateString()}
                                        secondaryTypographyProps={{
                                            variant: 'caption',
                                            sx: { color: 'text.secondary', fontSize: '10px', mt: 0.5 }
                                        }}
                                    />
                                    <IconButton
                                        className="delete-btn"
                                        size="small"
                                        onClick={(e) => handleDeleteDraft(e, draft.id!)}
                                        sx={{ opacity: 0, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                                    >
                                        <Trash2 size={14} />
                                    </IconButton>
                                </Box>
                            </ListItemButton>
                        );
                    })
                )}
            </List>
        </Box>
    );
};
