import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import CssBaseline from '@mui/material/CssBaseline'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { ThemeProvider } from '@mui/material/styles'
import { OrderPage } from './pages/OrderPage'
import { theme } from './theme'

const ORDER_ID = import.meta.env.VITE_ORDER_ID ?? 'ORD-10482'
const MOCKS_ENABLED = import.meta.env.VITE_ENABLE_MOCKS === 'true'

async function resetDemoData() {
  const { resetMockDb } = await import('./mocks/db')
  resetMockDb()
  window.location.reload()
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Typography
            component="span"
            sx={{ fontWeight: 800, letterSpacing: '0.12em', fontSize: 20 }}
          >
            ZUS
          </Typography>
          <Typography component="span" sx={{ opacity: 0.8, fontWeight: 500 }}>
            Back Office
          </Typography>
          <Box sx={{ flex: 1 }} />
          {MOCKS_ENABLED && (
            <Button color="inherit" size="small" onClick={resetDemoData} sx={{ minHeight: 36 }}>
              Reset demo data
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        <OrderPage orderId={ORDER_ID} />
      </Container>
    </ThemeProvider>
  )
}
