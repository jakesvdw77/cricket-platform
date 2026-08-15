import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { baseTheme } from './theme'
import UpcomingMatches from './pages/view/UpcomingMatches'

const queryClient = new QueryClient()

function App() {
  return (
    <ThemeProvider theme={baseTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<UpcomingMatches />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
