# Publishing Guide for @forthix/forthic

This guide explains how to publish new versions of the package to npm.

## Prerequisites

1. **npm account**: You must be logged in to npm
   ```bash
   npm whoami  # Check if logged in
   npm login   # Login if needed
   ```

2. **Access permissions**: You need write access to the `@forthix` scope

3. **All tests passing**: Run tests before publishing
   ```bash
   npm test
   ```

## Publishing Steps

### 1. Update Version

Follow [Semantic Versioning](https://semver.org/):

- **Patch** (0.1.0 → 0.1.1): Bug fixes, minor changes
  ```bash
  npm version patch
  ```

- **Minor** (0.1.0 → 0.2.0): New features, backwards compatible
  ```bash
  npm version minor
  ```

- **Major** (0.1.0 → 1.0.0): Breaking changes
  ```bash
  npm version major
  ```

This will:
- Update version in `package.json`
- Create a git commit
- Create a git tag

### 2. Build and Test

The `prepublishOnly` script will automatically:
- Build both CJS and ESM versions
- Run all tests

But you can run manually first:
```bash
npm run build
npm test
```

### 3. Publish to npm

For the first public release:
```bash
npm publish --access public
```

For subsequent releases:
```bash
npm publish
```

### 4. Push to GitHub

```bash
git push && git push --tags
```

## Publishing Checklist

- [ ] All tests passing (`npm test`)
- [ ] Version updated appropriately
- [ ] CHANGELOG updated (if you maintain one)
- [ ] README is up to date
- [ ] Build successful (`npm run build`)
- [ ] Logged into npm (`npm whoami`)
- [ ] Pushed to GitHub after publishing

## First Time Setup

Since this is scoped to `@forthix`, the first publish requires `--access public`:

```bash
npm publish --access public
```

## Dry Run

To preview what will be published without actually publishing:

```bash
npm publish --dry-run
```

## Unpublishing (Emergency Only)

⚠️ **Warning**: Only unpublish within 72 hours, and only if absolutely necessary!

```bash
npm unpublish @forthix/forthic@0.1.0
```

## Version History

- **0.1.0** - Initial release
  - Stack-based interpreter
  - Full standard library
  - CJS and ESM builds
  - TypeScript declarations

## Troubleshooting

### "You do not have permission to publish"
- Verify you're logged in: `npm whoami`
- Check scope access: `npm access list packages`
- For first publish, use: `npm publish --access public`

### "Version already exists"
- Update version: `npm version patch` (or minor/major)
- Or manually edit package.json version

### Build fails
- Check TypeScript version: `npm ls typescript`
- Verify all dependencies installed: `npm install`
- Check for TypeScript errors: `npx tsc --noEmit`
