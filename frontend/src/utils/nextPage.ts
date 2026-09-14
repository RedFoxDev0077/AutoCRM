// Pages that live outside the SPA router (static apps under frontend/public)
// send the user to /login?next=<path>. Only these prefixes are honoured, so
// the parameter can't be used as an open redirect.
const EXTERNAL_PAGES = ['/cotizador/']

export function externalNextPage(): string | null {
  const next = new URLSearchParams(window.location.search).get('next') ?? ''
  return EXTERNAL_PAGES.some(p => next.startsWith(p)) ? next : null
}

// Full page load with a cache-busting query, so the browser can't hand back a
// stale copy of the SPA shell for that path.
export function openExternalPage(path: string) {
  // Already on a cache-busted load of that page and still inside the SPA:
  // the server itself is serving the shell, so reloading again would loop.
  const here = window.location
  if (here.pathname.startsWith(path) && new URLSearchParams(here.search).has('v')) {
    window.location.replace('/dashboard')
    return
  }
  const sep = path.includes('?') ? '&' : '?'
  window.location.replace(`${path}${sep}v=${Date.now()}`)
}
