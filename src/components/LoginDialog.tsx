import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    Button,
    Box,
    Typography,
    CircularProgress,
    IconButton
} from '@mui/material';
import { X, Smartphone, ShieldCheck } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface LoginDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (user: any) => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({ open, onClose, onSuccess }) => {
    const [step, setStep] = useState<'phone' | 'code'>('phone');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSendCode = async () => {
        if (!phone) return;
        setLoading(true);
        setError(null);
        try {
            const result = await invoke<string>('start_login_process', { phone });

            // 检查是否已经登录
            if (result.startsWith('already_logged_in:')) {
                const userJson = result.replace('already_logged_in:', '');
                const user = JSON.parse(userJson);
                onSuccess(user);
                return;
            }

            // 未登录，进入验证码步骤
            setStep('code');
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!code) return;
        setLoading(true);
        setError(null);
        try {
            const user = await invoke('submit_verification_code', { phone, code });
            onSuccess(user);
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} PaperProps={{ sx: { width: 350, borderRadius: 3, p: 1 } }}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="bold">
                    {step === 'phone' ? '登录小红书' : '输入验证码'}
                </Typography>
                <IconButton onClick={onClose} size="small"><X size={18} /></IconButton>
            </DialogTitle>

            <DialogContent>
                <Box sx={{ py: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {step === 'phone' ? (
                        <>
                            <TextField
                                fullWidth
                                label="手机号"
                                variant="outlined"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="请输入手机号"
                                slotProps={{
                                    input: {
                                        startAdornment: <Smartphone size={18} style={{ marginRight: 8, color: '#858585' }} />,
                                    }
                                }}
                            />
                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                disabled={loading || !phone}
                                onClick={handleSendCode}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : '发送验证码'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Typography variant="body2" color="text.secondary">
                                验证码已发送至 {phone}
                            </Typography>
                            <TextField
                                fullWidth
                                label="验证码"
                                variant="outlined"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="6位验证码"
                                slotProps={{
                                    input: {
                                        startAdornment: <ShieldCheck size={18} style={{ marginRight: 8, color: '#858585' }} />,
                                    }
                                }}
                            />
                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                disabled={loading || !code}
                                onClick={handleVerify}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : '立即登录'}
                            </Button>
                            <Button variant="text" size="small" onClick={() => setStep('phone')}>返回修改手机号</Button>
                        </>
                    )}

                    {error && (
                        <Typography variant="caption" color="error">
                            错误: {error}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
};
