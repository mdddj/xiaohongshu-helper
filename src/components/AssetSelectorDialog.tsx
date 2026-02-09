import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    ImageList,
    ImageListItem,
    Box,
    Typography,
    CircularProgress
} from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Check } from 'lucide-react';

interface AssetSelectorDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (path: string) => void;
    title?: string;
}

export const AssetSelectorDialog = ({ open, onClose, onSelect, title = "选择素材" }: AssetSelectorDialogProps) => {
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);

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
        if (open) {
            fetchImages();
            setSelectedPath(null);
        }
    }, [open]);

    const handleConfirm = () => {
        if (selectedPath) {
            onSelect(selectedPath);
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress size={30} />
                    </Box>
                ) : images.length > 0 ? (
                    <ImageList cols={3} gap={12}>
                        {images.map((img, index) => (
                            <ImageListItem
                                key={index}
                                onClick={() => setSelectedPath(img)}
                                sx={{
                                    cursor: 'pointer',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    border: '2px solid',
                                    borderColor: selectedPath === img ? 'primary.main' : 'transparent',
                                    position: 'relative',
                                    height: '140px !important'
                                }}
                            >
                                <img
                                    src={convertFileSrc(img)}
                                    alt={`Asset ${index}`}
                                    style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                                />
                                {selectedPath === img && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        bgcolor: 'primary.main',
                                        color: '#fff',
                                        borderRadius: '50%',
                                        width: 20,
                                        height: 20,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Check size={14} />
                                    </Box>
                                )}
                            </ImageListItem>
                        ))}
                    </ImageList>
                ) : (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">素材库空空如也，快去生成或上传一些吧</Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>取消</Button>
                <Button variant="contained" onClick={handleConfirm} disabled={!selectedPath}>
                    确认选择
                </Button>
            </DialogActions>
        </Dialog>
    );
};
