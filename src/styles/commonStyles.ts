import { SxProps, Theme } from '@mui/material';

/**
 * 通用样式工具 - 避免重复的内联 sx 样式
 */

// AI 功能按钮样式（Sparkles 图标按钮）
export const aiButtonStyles: SxProps<Theme> = {
    mr: 1,
    color: 'primary.main',
    bgcolor: (theme) => theme.palette.mode === 'dark'
        ? 'rgba(255,36,66,0.1)'
        : 'rgba(255,36,66,0.05)',
    '&:hover': {
        bgcolor: 'primary.main',
        color: '#fff'
    },
    '&.Mui-disabled': {
        bgcolor: (theme) => theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.02)',
        color: 'text.disabled',
        opacity: 0.5
    }
};

// 热点按钮样式（Flame 图标按钮）
export const trendButtonStyles: SxProps<Theme> = {
    color: 'orange',
    bgcolor: (theme) => theme.palette.mode === 'dark'
        ? 'rgba(255,165,0,0.1)'
        : 'rgba(255,165,0,0.05)',
    '&:hover': {
        bgcolor: 'orange',
        color: '#fff'
    }
};

// 圆角输入框样式
export const roundedInputStyles: SxProps<Theme> = {
    '& .MuiOutlinedInput-root': {
        borderRadius: 3
    }
};

// 卡片容器样式
export const cardContainerStyles: SxProps<Theme> = {
    bgcolor: (theme) => theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.02)'
        : 'rgba(0,0,0,0.02)',
    p: 4,
    borderRadius: 6,
    border: (theme) => `1px solid ${theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(0,0,0,0.04)'
        }`
};

// 主要操作按钮样式
export const primaryActionButtonStyles: SxProps<Theme> = {
    borderRadius: 3,
    px: 4,
    boxShadow: '0 8px 20px rgba(255,36,66,0.2)',
    '&:hover': {
        boxShadow: '0 10px 25px rgba(255,36,66,0.35)'
    }
};

// 渐变标题样式
export const gradientTitleStyles: SxProps<Theme> = {
    fontWeight: 800,
    background: (theme) => theme.palette.mode === 'dark'
        ? 'linear-gradient(45deg, #fff, rgba(255,255,255,0.7))'
        : 'linear-gradient(45deg, #1a1a1b, #666)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
};

// 图片容器样式
export const imageBoxStyles: SxProps<Theme> = {
    width: 144,
    height: 144,
    position: 'relative',
    borderRadius: 5,
    border: (theme) => `1px solid ${theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.05)'
        }`,
    transition: 'all 0.3s ease'
};

// 删除按钮样式（图片上的 X 按钮）
export const deleteIconButtonStyles: SxProps<Theme> = {
    position: 'absolute',
    top: -8,
    right: -8,
    bgcolor: '#ff4d4f',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(255,107,129,0.4)',
    '&:hover': {
        bgcolor: '#ff7875',
        transform: 'scale(1.1)'
    },
    zIndex: 10,
    width: 24,
    height: 24,
    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
};

// 对话框样式
export const dialogPaperStyles: SxProps<Theme> = {
    borderRadius: 5,
    p: 1
};

// 分隔线样式（虚线）
export const dashedDividerStyles: SxProps<Theme> = {
    my: 1,
    borderStyle: 'dashed'
};

/**
 * 样式工具函数 - 用于动态生成样式
 */

// 生成带边框的按钮样式
export const getBorderedButtonStyles = (color: string = 'primary.main'): SxProps<Theme> => ({
    borderRadius: 3,
    border: (theme) => `1px solid ${theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(0,0,0,0.1)'}`,
    borderColor: color
});

// 生成悬浮卡片样式
export const getHoverCardStyles = (elevation: number = 2): SxProps<Theme> => ({
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: (theme) => theme.palette.mode === 'dark'
            ? `0 ${elevation * 10}px ${elevation * 20}px rgba(0,0,0,0.${5 + elevation})`
            : `0 ${elevation * 10}px ${elevation * 20}px rgba(0,0,0,0.${1 + elevation})`
    }
});

// 生成背景色样式（根据主题模式）
export const getThemedBgStyles = (
    darkColor: string,
    lightColor: string
): SxProps<Theme> => ({
    bgcolor: (theme) => theme.palette.mode === 'dark' ? darkColor : lightColor
});
