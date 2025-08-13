# Contributing to Helper

**This software is derived from the source code for Gumroad, Inc. Helper™ software.**

Thanks for your interest in contributing! This document will help you get started.

## Quick Start

1. Set up the repository

```bash
git clone https://github.com/dailydimaz/helper.git
```

2. Set up your development environment

For detailed instructions on setting up your local development environment, please refer to our [README](README.md).

## Development

1. Create your feature branch

```bash
git checkout -b feature/your-feature
```

2. Install dependencies

```bash
pnpm install
```

3. Set up the database

```bash
pnpm db:reset
```

4. Start the development environment

```bash
pnpm dev
```

5. Run the test suite

```bash
# Run all tests
pnpm test

# Run unit tests
pnpm test:unit

# Run end-to-end tests
pnpm test:e2e

# Run tests in watch mode
pnpm test:watch
```

## Testing Guidelines

- Write descriptive test names that explain the behavior being tested
- Keep tests independent and isolated
- For API endpoints, test response status, format, and content
- Use factories for test data instead of creating objects directly
- Test both happy path and edge cases
- We use Vitest for unit tests and Playwright for end-to-end tests

## Trademark Compliance Requirements

**IMPORTANT**: All contributions must comply with Helper™ trademark guidelines.

### Required Documentation Updates:
- When adding/modifying documentation, include proper trademark attribution
- First mention of Helper in any document must use Helper™
- Include attribution footer: "Helper is a trademark of Gumroad, Inc."
- Never use Helper logos in contributions
- Clearly identify derivative nature of the software

### Compliance Checklist:
- [ ] Documentation uses Helper™ on first mention
- [ ] Trademark attribution footer included where required
- [ ] No unauthorized logo usage
- [ ] Proper disclaimers in place for derivative software
- [ ] No claims of official endorsement or affiliation

### Resources:
- [Trademark Guidelines](TRADEMARK_GUIDELINES.md)
- [Community Guidelines](COMMUNITY_GUIDELINES.md)
- [Internal Trademark Usage](INTERNAL_TRADEMARK_USAGE.md)

## Pull Request

1. Update documentation if you're changing behavior
2. Add or update tests for your changes
3. Include screenshots of your test suite passing locally
4. **Ensure trademark compliance** - verify proper Helper™ usage and attribution
5. Use native-sounding English in all communication with no excessive capitalization (e.g HOW IS THIS GOING), multiple question marks (how's this going???), grammatical errors (how's dis going), or typos (thnx fr update).
   - ❌ Before: "is this still open ?? I am happy to work on it ??"
   - ✅ After: "Is this actively being worked on? I've started work on it here…"
6. Make sure all tests pass
7. Run linting and formatting checks:
   ```bash
   pnpm lint
   pnpm format
   ```
8. Request a review from maintainers
9. After reviews begin, avoid force-pushing to your branch
   - Force-pushing rewrites history and makes review threads hard to follow
   - Don't worry about messy commits - we squash everything when merging to main
10. The PR will be merged once you have the sign-off of at least one other developer

## Monorepo Structure

Helper is organized as a monorepo with pnpm workspaces. Key packages include:

- **Main Application** (`/`): The core Helper Next.js application
- **React SDK** (`packages/react/`): Reusable React components and SDK
- **Marketing Site** (`packages/marketing/`): Documentation and marketing content

When contributing to specific packages, also refer to their individual CONTRIBUTING.md files (e.g., `packages/react/CONTRIBUTING.md`).

## Style Guide

- Follow the existing code patterns
- Use clear, descriptive variable names
- Write TypeScript for all code
- Follow React best practices and use functional components
- Refer to the app as "Helper" (not "Helper AI")
- Use lowerCamelCase for component file names (e.g., `conversationList.tsx`)
- Design for both light and dark mode
- Consider mobile and desktop devices (medium, large, and extra large breakpoints)

## Development Guidelines

### Code Standards

- Refer to app as Helper not Helper AI
- No explanatory comments please
- Name component files in lowerCamelCase, e.g. conversationList.tsx
- Always design for light and dark mode
- Always consider mobile and desktop devices (medium and large and extra large)

### Development Practices

- We have existing TypeScript tests using vitest. Fix the existing tests if required, but don't add any new tests unless explicitly told to do so
- Don't modify config files or package.json unless explicitly told to do so

## Writing Bug Reports

A great bug report includes:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Help

- Check existing discussions/issues/PRs before creating new ones
- Start a discussion for questions or ideas
- Open an [issue](https://github.com/dailydimaz/helper/issues) for bugs or problems

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE.md).

## Legal Notice

**Trademark Notice**: Helper™ is a trademark of Gumroad, Inc. This derivative software is not officially endorsed or distributed by Gumroad, Inc.

**Compliance Requirement**: All contributors must comply with trademark guidelines and acknowledge understanding of proper Helper™ trademark usage.

---

Helper is a trademark of Gumroad, Inc.
