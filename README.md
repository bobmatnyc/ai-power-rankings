# AI Power Ranking

**Version**: 0.1.3
**Framework**: Next.js 14 (App Router)
**Status**: Production

---

## Overview

AI Power Ranking is a comprehensive web application that ranks and tracks AI tools and technologies. The platform provides:

- **Rankings System**: Comprehensive AI tool evaluation and scoring with monthly algorithm updates
- **News & Articles**: AI industry news, analysis, and market insights
- **Multi-language Support**: Internationalized content delivery
- **Authentication**: Secure user management via Clerk
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd aipowerranking

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the application.

---

## Development

### Available Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm test             # Run test suite
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio
```

### Project Structure

```
aipowerranking/
├── app/[lang]/      # Next.js App Router pages (internationalized)
├── components/      # React components
├── lib/             # Core business logic and utilities
├── docs/            # Complete documentation
├── tests/           # Test suites
└── scripts/         # Database migrations and utilities
```

### Key Technologies

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

---

## Documentation

📖 **[Complete Documentation Index](docs/README.md)** - Start here for all documentation

### Quick Links

- **[Contributing Guide](docs/development/CONTRIBUTING.md)** - Setup and development guidelines
- **[Deployment Checklist](docs/deployment/DEPLOYMENT-CHECKLIST.md)** - Pre-deployment verification
- **[Authentication Config](docs/reference/AUTHENTICATION-CONFIG.md)** - Clerk setup
- **[Project Organization](docs/reference/PROJECT_ORGANIZATION.md)** - File structure standards
- **[CLAUDE.md](CLAUDE.md)** - AI assistant project guide

---

## Features

### Rankings System
- Monthly algorithm updates with detailed scoring
- Comprehensive AI tool evaluation across multiple criteria
- Historical tracking and trend analysis
- Category-based organization

### News & Analysis
- AI industry news and updates
- Market insights and analysis
- State of the Union reports
- Expert commentary and perspectives

### Multi-language Support
- Internationalized routing via `[lang]` parameter
- Dictionary-based translations
- Language-specific content delivery

### Authentication
- Secure user authentication via Clerk
- Protected routes and API endpoints
- Admin dashboard access control

---

## Deployment

The application is deployed on Vercel with continuous deployment from the main branch.

**Production URL**: [Your production URL]

See [Deployment Checklist](docs/deployment/DEPLOYMENT-CHECKLIST.md) for deployment procedures.

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/development/CONTRIBUTING.md) for:

- Development setup
- Code style guidelines
- Testing requirements
- Pull request process

---

## Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- rankings

# Run tests in watch mode
npm test -- --watch
```

See [Test Documentation](tests/README.md) for detailed testing guides.

---

## License

[Your License Here]

---

## Contact

**Developer**: Robert (Masa) Matsuoka
**Project**: AI Power Ranking
**Version**: 0.1.3

For issues and feature requests, please use the issue tracker.

---

## Acknowledgments

Built with Next.js, React, TypeScript, and deployed on Vercel.
