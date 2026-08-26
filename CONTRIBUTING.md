# Contributing

Thank you for your interest in contributing to Blockbuster Agentic Studio!

## Development Setup

```bash
git clone https://github.com/<org>/blockbuster-agentic-studio.git
cd blockbuster-agentic-studio
cp .env.example .env
npm run setup
```

## Architecture Principles

This project strictly follows:
- **SOLID principles** across all packages
- **Domain-Driven Design (DDD)** for complex domain modeling
- **Clean Architecture** to enforce dependency rules
- **OpenSpec** for technical decision records

### Code Style
- TypeScript strict mode
- ESLint + Prettier for consistent formatting
- Maximum line length: 100 characters
- Meaningful variable and function names (no abbreviations)

### Commit Messages
We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add Gemini agent retry policy`
- `fix: resolve ClickHouse connection pool leak`
- `docs: update OpenSpec decision 001`

## Pull Request Process

1. Ensure all tests pass: `npm test`
2. Ensure linting passes: `npm run lint`
3. Update documentation if needed
4. Request review from at least one maintainer

## Partner Integration Guidelines

When adding a new partner adapter:
1. Implement `IConnector` interface from `packages/core`
2. Add integration tests in `packages/infrastructure/src/partners/{partner}/tests/`
3. Update `docs/openspec/decisions/003-data-layer.md`
4. Add example workflow in `examples/media-workflows/`
