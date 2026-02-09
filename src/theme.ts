import { createTheme, PaletteMode } from '@mui/material/styles';

export const getAppTheme = (mode: PaletteMode) => createTheme({
  palette: {
    mode,
    primary: {
      main: '#ff2442',
      light: '#ff5e73',
      dark: '#c4001a',
    },
    ...(mode === 'dark' ? {
      background: {
        default: '#0f0f12',
        paper: '#1a1a1f',
      },
      divider: 'rgba(255, 255, 255, 0.08)',
      text: {
        primary: '#ffffff',
        secondary: 'rgba(255, 255, 255, 0.6)',
      }
    } : {
      background: {
        default: '#f8f9fa',
        paper: '#ffffff',
      },
      divider: 'rgba(0, 0, 0, 0.08)',
      text: {
        primary: '#1a1a1b',
        secondary: '#666666',
      }
    }),
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "system-ui", sans-serif',
    fontSize: 14,
    h5: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontWeight: 900,
      letterSpacing: '-0.03em',
    },
    h6: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          padding: '8px 20px',
        },
        containedPrimary: {
          background: 'linear-gradient(45deg, #ff2442 30%, #ff5e73 90%)',
          boxShadow: mode === 'dark' ? '0 8px 32px rgba(255,36,66,0.25)' : '0 8px 25px rgba(255,36,66,0.4)',
          '&:hover': {
            boxShadow: mode === 'dark' ? '0 12px 40px rgba(255,36,66,0.4)' : '0 12px 35px rgba(255,36,66,0.5)',
            transform: 'translateY(-1px)',
          }
        }
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
          boxShadow: mode === 'light' ? '0 2px 12px rgba(0,0,0,0.03)' : 'none',
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            background: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            transform: 'scale(1.05)',
          }
        }
      }
    }
  },
});
