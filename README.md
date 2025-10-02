# ConvAI Widget Core

A conversational AI widget wrapper for ElevenLabs, built with Preact and TypeScript. This library provides a customizable web component for integrating conversational AI into web applications.

## Features

- 🎙️ Voice-enabled conversational AI widget
- 🎨 Customizable UI with Tailwind CSS
- 📱 Responsive design with multiple trigger styles
- 🌐 Multi-language support
- 🔧 Web Component architecture for easy integration
- ⚡ Built with Preact for optimal performance
- 🎯 TypeScript support with full type definitions

## Installation

```bash
npm install @askbenny/convai-widget-core
```

## Quick Start

### As a Web Component

```html
<!DOCTYPE html>
<html>
<head>
  <title>ConvAI Widget Demo</title>
</head>
<body>
  <script type="module">
    import { registerWidget } from '@askbenny/convai-widget-core';
    
    // Register the web component
    registerWidget();
    
    // Create and configure the widget
    const widget = document.createElement('askbenny-convai');
    widget.setAttribute('agent-id', 'your-agent-id');
    document.body.appendChild(widget);
  </script>
</body>
</html>
```

### Custom Tag Name

```javascript
import { registerWidget } from '@askbenny/convai-widget-core';

// Register with a custom tag name
registerWidget('my-convai-widget');
```

## Configuration

The widget accepts various attributes for customization:

```html
<askbenny-convai
  agent-id="your-agent-id"
  server-location="us"
  language="en"
  trigger-style="compact"
></askbenny-convai>
```

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Setup

```bash
# Clone the repository
git clone https://github.com/askbenny/convai-widget-core.git
cd widget-v2

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm test` - Run tests with Vitest
- `pnpm lint` - Run all linting checks
- `pnpm lint:ts` - TypeScript type checking
- `pnpm lint:es` - ESLint checking
- `pnpm lint:prettier` - Prettier formatting check

### Testing

The project uses Vitest with Playwright for browser testing:

```bash
pnpm test
```

Tests run in a real browser environment with microphone permissions for comprehensive testing of voice features.

## Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React/Preact contexts for state management
├── orb/               # 3D orb visualization
├── styles/            # CSS and styling
├── types/             # TypeScript type definitions
├── utils/             # Utility functions and hooks
├── widget/            # Main widget components
├── index.ts           # Main entry point
└── index.dev.tsx      # Development entry point
```

## Architecture

- **Preact**: Lightweight React alternative for optimal bundle size
- **Web Components**: Shadow DOM encapsulation for style isolation
- **TypeScript**: Full type safety and developer experience
- **Tailwind CSS**: Utility-first CSS framework
- **Vite**: Fast build tool and development server
- **Vitest**: Fast unit and browser testing

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run linting: `pnpm lint`
5. Run tests: `pnpm test`
6. Commit your changes: `git commit -m 'Add new feature'`
7. Push to the branch: `git push origin feature/new-feature`
8. Submit a pull request

## CI/CD

### Automated NPM Releases

This project is configured to automatically publish to npm when code is merged to the main branch.

### GitHub Secrets Configuration

The automated release workflow requires the following GitHub secrets:

#### 1. NPM_TOKEN (Required)

Used for publishing packages to npm registry.

**Setup Instructions:**

1. Generate an npm access token:
   - Log in to [npmjs.com](https://www.npmjs.com/)
   - Go to your account settings → Access Tokens
   - Click "Generate New Token"
   - Choose "Classic Token" with "Automation" type
   - Copy the generated token

2. Add the token to GitHub:
   - Go to your repository on GitHub
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

#### 2. GITHUB_TOKEN (Automatic)

This token is automatically provided by GitHub Actions and doesn't need manual configuration. It's used for:
- Git operations (pushing version tags)
- Creating GitHub releases
- Accessing repository content

**Permissions:** The workflow requires these permissions (already configured in `.github/workflows/npm-publish.yml`):
- `contents: write` - For pushing commits and creating releases
- `packages: write` - For publishing packages

#### 3. Build Environment Variables (Required)

The build process requires several environment variables for server endpoints. Add these as GitHub secrets:

**Server URLs:**
- `VITE_SERVER_URL` - Default server URL
- `VITE_SERVER_URL_US` - US region server URL
- `VITE_SERVER_URL_EU_RESIDENCY` - EU region server URL
- `VITE_SERVER_URL_IN_RESIDENCY` - India region server URL

**WebSocket URLs:**
- `VITE_WEBSOCKET_URL` - Default WebSocket URL
- `VITE_WEBSOCKET_URL_US` - US region WebSocket URL
- `VITE_WEBSOCKET_URL_EU_RESIDENCY` - EU region WebSocket URL
- `VITE_WEBSOCKET_URL_IN_RESIDENCY` - India region WebSocket URL

**Setup Instructions:**

1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. For each variable above:
   - Click "New repository secret"
   - Name: Use the exact variable name (e.g., `VITE_SERVER_URL_US`)
   - Value: Enter the appropriate URL for your environment
   - Click "Add secret"

**Note:** These variables must be prefixed with `VITE_` to be accessible in the Vite build process. The values should be the actual URLs for your ElevenLabs endpoints.

#### How It Works

1. When code is merged to `main`, the workflow automatically:
   - Runs tests and linting
   - Checks if the current version is already published
   - Increments the patch version (e.g., 0.0.15 → 0.0.16)
   - Builds the project
   - Publishes to npm
   - Creates a git tag and GitHub release
   - Commits the version change with `[skip ci]` to avoid loops

2. To skip the automated release, include `[skip ci]` in your commit message.

3. For manual version control:
   - Minor version: `pnpm version:minor`
   - Major version: `pnpm version:major`
   - Pre-release: `pnpm version:prerelease`

## License

MIT © ElevenLabs

## Support

For issues and questions, please visit our [GitHub repository](https://github.com/askbenny/convai-widget-core).
