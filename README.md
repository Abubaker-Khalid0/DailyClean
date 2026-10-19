# DailyClean 6.0.0

A Chrome extension that blocks Dailymotion ad requests, sanitizes ad-related settings, and automatically clicks the native skip button when available. The interface is in Arabic and uses official shadcn/ui components, with dark mode and keyboard accessibility support.

## Usage

1. **If you previously installed the extension from this project:** Open `chrome://extensions` and click **Reload** on the DailyClean extension card. Approve the expected new permissions if Chrome prompts you: running scripts on Dailymotion and redirecting specific IMA resources.
2. **For a fresh installation:** Enable **Developer mode**, click **Load unpacked**, and select the `release/DailyClean` folder after extracting the package, or the project directory containing `manifest.json`.
3. Reload the Dailymotion video page. The interface should display the connection status of both the page and the video player.
4. **Automatic skipping is enabled by default.** You can disable it while keeping ad blocking enabled. The fallback skip button appears inside the video player, at the bottom-right corner above the control bar. It stays correctly positioned when scrolling or entering fullscreen mode.
5. Toggling protection enables or disables the blocking rules and request interception. You must refresh the video page to replace the libraries and settings already loaded by the player. A clearly visible refresh button is provided for this purpose. The page will not automatically reload during playback.

## Behavioral Limitations

- The extension does not modify `currentTime` or change video playback speed. It only clicks the native ad skip button when that button is visible and usable. If no safe skipping method is available, the interface displays **"Waiting for skip availability."**
- Network blocking rules are restricted to requests originating from the Dailymotion domain, including embedded Dailymotion player frames on other websites. Requests initiated directly by those websites are not blocked.
- **"Protection Actions"** counts processing and skipping operations, not the number of ads removed. It does not include the network blocking counter. This new counter starts at zero instead of migrating the inaccurate counter from the previous version.
- Ads embedded directly into the video stream and changes to Dailymotion's player may require an update. Passing all tests does not guarantee that every advertisement will be removed in every session or region.
- The extension does not collect viewing data or transmit it to its own server. All settings and counters are stored locally. The interface does not load JavaScript or CSS from a CDN.

## Development and Testing

Building the extension requires Node.js 20 or later. Prebuilt interface assets are included in `build/`, so Node.js is not required to run the extension.

```sh
npm ci
npm run build
npx playwright install chromium
npm test
npm run package
```

You can specify an existing Chromium installation using the `CHROMIUM_PATH` environment variable.

Browser test results and interface screenshots are saved in `test-results/`. Tests use an isolated extension instance and a separate browser profile, leaving the user's existing browser profile untouched.

`node tests/live-smoke.cjs` is an optional live smoke test that can be run after `npm test`. It requires network access and an available Dailymotion player.

Regression tests cover:

- IMA permissions and actual resource redirection.
- Restricting blocking rules to Dailymotion.
- Enabling, disabling, and navigation behavior.
- JSON and XHR request handling.
- Protection of regular, non-ad content.
- Automatic ad skipping.
- Embedded Dailymotion player frames.
- Fullscreen behavior.
- Observer recovery.
- Counter synchronization.
- Interface controls and interactions.

## UI Components

The Button, Switch, and Card components were obtained from the official [shadcn/ui](https://ui.shadcn.com/) registry using the `new-york` style, with only the `cn` utility import path modified.

Component source files are located in `ui/components/ui/`, and the MIT license is included in `ui/SHADCN-LICENSE.md`.

The interface uses React and Radix, with all assets bundled locally.

The in-player skip button is lightweight, rendered inside a Shadow DOM, and visually isolated from Dailymotion's CSS.
