// Small shim to provide named exports for the `cookie` package
// Some prebuilt bundles import `parse`/`serialize` as named exports
// while `cookie` ships as CommonJS. This wrapper exposes the
// expected named exports while delegating to the original implementation.
import * as cookieCJS from 'cookie';

// cookieCJS may be the default export, or module.exports; handle both
const cookie = cookieCJS && cookieCJS.default ? cookieCJS.default : cookieCJS;

export const parse = cookie.parse || (() => ({}));
export const serialize = cookie.serialize || (() => '');
export default cookie;
