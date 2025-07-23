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
    const widget = document.createElement('elevenlabs-convai');
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
<elevenlabs-convai
  agent-id="your-agent-id"
  server-location="us"
  language="en"
  trigger-style="compact"
></elevenlabs-convai>
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

## License

MIT © ElevenLabs

## Support

For issues and questions, please visit our [GitHub repository](https://github.com/askbenny/convai-widget-core).
