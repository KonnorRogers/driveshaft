## Next

### Dependencies

- Remove `@virtualstate/navigation` from dependencies
- Move `rimraf` into `devDependencies`

## v0.0.3 - 2025-11-12

### Changes

- Driveshaft no longer relies on the `@virtualstate/navigation` polyfill. There were a number of issues with it, mainly `pushState()` unexpectedly triggering page navigation. Instead it now listens to the `submit` event from forms, and uses `link-click-observer` to listen for link clicks, including those in the shadow DOM.

### Features

- Added `data-driveshaft-permanent` to preserve nodes across page transitions.
- Added `data-driveshaft-eval="false"` to prevent re-evaluating script tags on new pages

### Bug fixes

- Scripts now properly evaluate when moving across pages

## v0.0.2 - 2025-11-09

- Initial release
