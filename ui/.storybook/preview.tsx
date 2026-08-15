import type { Preview } from '@storybook/react-vite'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { MemoryRouter } from 'react-router-dom'
import { baseTheme } from '../src/theme'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },

    // Our three reference widths — docs/standards/frontend.md's mobile-first rule.
    viewport: {
      options: {
        mobile: { name: 'Mobile 375', styles: { width: '375px', height: '812px' } },
        tablet: { name: 'Tablet 768', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop 1280', styles: { width: '1280px', height: '800px' } },
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={baseTheme}>
        <CssBaseline />
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      </ThemeProvider>
    ),
  ],
}

export default preview
