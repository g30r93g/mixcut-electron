# mixcut

A macOS desktop app for splitting `.m4a` audio files into individual tracks using CUE sheets.

Drop in a long audio file, mark track boundaries on the waveform (or import a `.cue` file), and mixcut splits it into tagged `.m4a` tracks using [m4acut](https://github.com/nu774/m4acut) and [AtomicParsley](https://github.com/wez/atomicparsley).

## Download

Download the latest `.dmg` from the [Releases](../../releases) page.

## Installation

1. Open the `.dmg` and drag **mixcut** to your **Applications** folder.
2. The app is not code-signed. macOS will block it on first launch. To bypass Gatekeeper, open Terminal and run:

```bash
xattr -cr /Applications/mixcut.app
```

3. Open mixcut from Applications as normal.

## Development

Requires Node.js 24+ and pnpm.

```bash
pnpm install
pnpm start
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm start` | Run the app in dev mode |
| `pnpm test` | Run tests |
| `pnpm run package` | Package the app (no distributable) |
| `pnpm run make` | Build the `.dmg` distributable |

## Acknowledgements

[m4acut](https://github.com/nu774/m4acut) and [L-Smash](https://github.com/l-smash/l-smash) for lossless M4A splitting. [AtomicParsley](https://github.com/wez/atomicparsley) for metadata tagging.
