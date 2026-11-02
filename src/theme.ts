import { alpha, createTheme } from '@mui/material/styles'

/**
 * ZUS-inspired palette. Colours are approximated from public brand references
 * (no official design tokens were provided) and kept here so they can be swapped
 * for the real tokens in one place.
 */
export const brand = {
  blue: '#2B3A7E',
  blueDark: '#1E2A5E',
  ice: '#DFE6F0',
  page: '#F3F5F9',
  ink: '#1B2140',
  inkMuted: '#5F6577',
  coffee: '#A87C49',
  grey: '#8C8C90',
} as const

export const theme = createTheme({
  palette: {
    primary: { main: brand.blue, dark: brand.blueDark, light: brand.ice, contrastText: '#FFFFFF' },
    secondary: { main: brand.coffee, contrastText: '#FFFFFF' },
    background: { default: brand.page, paper: '#FFFFFF' },
    text: { primary: brand.ink, secondary: brand.inkMuted, disabled: brand.grey },
    divider: alpha(brand.blue, 0.12),
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.125rem', fontWeight: 700 },
    h3: { fontSize: '1rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    overline: { fontWeight: 600, letterSpacing: '0.08em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: 'antialiased' },
        '.tabular-nums': { fontVariantNumeric: 'tabular-nums' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, minHeight: 44, paddingInline: 20 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        elevation1: {
          boxShadow: `0 1px 3px ${alpha(brand.ink, 0.06)}, 0 4px 16px ${alpha(brand.ink, 0.04)}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiCheckbox: {
      styleOverrides: { root: { padding: 10 } },
    },
  },
})
