import { useState, useEffect } from 'react';
import { Box, Typography, Paper, IconButton, Tooltip, Button } from '@mui/material';
import { FolderOpen, Trash2, RefreshCw, UploadCloud } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { confirm, message, open } from '@tauri-apps/plugin-dialog';

export const AssetsView = () => {
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);

    const fetchImages = async () => {
        setLoading(true);
        try {
            const list: string[] = await invoke('list_local_images');
            setImages(list);
        } catch (e) {
            console.error('Failed to fetch images:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchImages();
    }, []);

    const handleDelete = async (path: string) => {
        const confirmed = await confirm('确定要从本地永久删除这张图片吗？', {
            title: '删除素材',
            kind: 'warning'
        });

        if (confirmed) {
            try {
                await invoke('delete_local_image', { path });
                fetchImages();
            } catch (e) {
                await message('删除失败: ' + e, { title: '错误', kind: 'error' });
            }
        }
    };

    const handleImport = async () => {
        try {
            const selected = await open({
                multiple: true,
                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
            });

            if (selected && Array.isArray(selected)) {
                setImporting(true);
                await invoke('import_local_images', { paths: selected });
                await fetchImages();
            }
        } catch (e) {
            await message('导入失败: ' + e, { title: '错误', kind: 'error' });
        } finally {
            setImporting(false);
        }
    };

    return (
        <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 6 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>素材中心</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        所有由 AI 生成或你导入的媒体素材都会在这里安全存储。
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={importing ? <RefreshCw className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                        onClick={handleImport}
                        disabled={importing}
                        sx={{ borderRadius: 3, px: 3, fontWeight: 700 }}
                    >
                        {importing ? '导入中...' : '上传素材'}
                    </Button>
                    <IconButton
                        onClick={fetchImages}
                        disabled={loading}
                        sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </IconButton>
                </Box>
            </Box>

            {images.length > 0 ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 3 }}>
                    {images.map((img, index) => (
                        <Box
                            key={index}
                            sx={{
                                position: 'relative',
                                borderRadius: 5,
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.05)',
                                '&:hover .overlay': { opacity: 1 },
                                '&:hover img': { transform: 'scale(1.08)' },
                                cursor: 'pointer'
                            }}
                        >
                            <img
                                src={convertFileSrc(img)}
                                alt={`Asset ${index}`}
                                loading="lazy"
                                style={{ height: 200, width: '100%', objectFit: 'cover', transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
                            />
                            <Box className="overlay" sx={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                bgcolor: 'rgba(0,0,0,0.6)',
                                opacity: 0,
                                transition: 'opacity 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backdropFilter: 'blur(4px)'
                            }}>
                                <Tooltip title="删除素材">
                                    <IconButton
                                        onClick={() => handleDelete(img)}
                                        sx={{
                                            p: 2,
                                            bgcolor: 'rgba(255,36,66,0.2)',
                                            color: 'primary.main',
                                            '&:hover': { bgcolor: 'primary.main', color: '#fff' }
                                        }}
                                    >
                                        <Trash2 size={24} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    ))}
                </Box>
            ) : (
                <Paper variant="outlined" sx={{
                    p: 10,
                    textAlign: 'center',
                    border: '2px dashed rgba(255,255,255,0.05)',
                    bgcolor: 'rgba(255,255,255,0.01)',
                    borderRadius: 8,
                    mt: 4
                }}>
                    <FolderOpen size={64} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: 24 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>素材库空空如也</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        当你生成第一张 AI 图片时，它会自动保存到这里。
                    </Typography>
                </Paper>
            )}
        </Box>
    );
};
