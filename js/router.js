// Hash router with an in-app depth counter so "back" never leaves the app.

let depth = 0;

export function navigate(path) {
  depth++;
  location.hash = path;
}

/** Replace the current entry (e.g. after creating a client). */
export function replace(path) {
  location.replace(`#${path}`);
}

/** Go back within the app, or to the fallback if there is nothing to go back to. */
export function goBack(fallback = '/') {
  if (depth > 0) {
    depth--;
    history.back();
  } else {
    replace(fallback);
  }
}

export function currentPath() {
  return location.hash.replace(/^#/, '') || '/';
}

/** Match a path against route patterns like '/c/:id/edit'. */
export function match(routes, path) {
  for (const [pattern, handler] of routes) {
    const names = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    const m = path.match(re);
    if (m) return { handler, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}
