# Contributing to AI Power Ranking

Thank you for considering contributing to this project!

## Project Organization

This project follows a standardized directory structure for consistency and maintainability:

### Directory Structure

- **`docs/`** - All documentation organized by category
  - `algorithms/` - Algorithm documentation and implementation details
  - `api/` - API documentation and design considerations
  - `architecture/` - Architecture decisions and guides
  - `deployment/` - Deployment guides and verification reports
  - `development/` - Development guides and implementation summaries
  - `performance/` - Performance optimization reports
  - `qa/` - QA reports and test results
  - `reference/` - General reference documentation
  - `research/` - Research reports and investigations
  - `security/` - Security documentation and hardening guides
  - `troubleshooting/` - Bug fixes and troubleshooting guides

- **`tests/`** - All test files and test utilities
  - `e2e/` - End-to-end tests (Playwright)
  - `unit/` - Unit tests
  - `integration/` - Integration tests

- **`scripts/`** - Utility scripts and database migrations
  - Database migration scripts
  - Build and deployment utilities
  - Data transformation scripts

- **`app/`** - Next.js App Router pages and layouts (following Next.js conventions)

- **`lib/`** - Shared libraries, utilities, and business logic

- **`components/`** - React components

- **`tmp/`** - Temporary files (gitignored)

### Documentation Guidelines

When adding documentation:

1. **Place files in the appropriate `docs/` subdirectory** based on content type
2. **Use descriptive filenames** that clearly indicate the content purpose
3. **Link related documentation** together for easy navigation
4. **Keep documentation up-to-date** when making code changes
5. **Follow markdown best practices** for readability

### Code Organization

- Follow Next.js 15 App Router conventions for page and API route structure
- Keep business logic in `lib/` separate from UI components
- Use TypeScript for type safety
- Follow existing code style and patterns

## Development Setup

See [CLAUDE.md](./CLAUDE.md) for project-specific development instructions and AI assistant integration details.

## Pull Request Process

1. Ensure your changes follow the project organization structure
2. Update documentation in `docs/` if adding features or changing behavior
3. Add tests in `tests/` for new functionality
4. Run linting and tests before submitting
5. Provide clear descriptions of changes in commit messages

## Questions?

For project-specific context and development guidelines, refer to [CLAUDE.md](./CLAUDE.md).
