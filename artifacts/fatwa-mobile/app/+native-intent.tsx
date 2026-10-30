// Shared links (https .../p/ID or fatwa-mobile://post/ID) are handled inside Shell, so the router always lands on the home route.
export function redirectSystemPath() {
  return '/';
}
