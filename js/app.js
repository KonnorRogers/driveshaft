import { morph } from "https://www.unpkg.com/morphlex@0.0.19/dist/morphlex.min.js"

if (window.state) {
  window.state.foo = "baz"
  console.log({ state: window.state })
}

window.state ||= {foo: "bar"}
console.log({ state: window.state })

function shouldIntercept (event) {
  // Some navigations, e.g. cross-origin navigations, we cannot intercept.
  // Let the browser handle those normally.
  if (!event.canIntercept) {
    return false
  }

  // don't intercept fragment navigations or downloads.
  if (event.hashchange) {
    return false
  }

  if (event.downloadRequest != null) {
    return false
  }

  return true
}

function interceptNavigation (event) {
  console.log({event})
  if (!shouldIntercept(event)) {
    return;
  }

  const url = new URL(event.destination.url);

  if (url.pathname.startsWith("/")) {
    event.intercept({
      async handler(...args) {
        console.log({ args })
        // await fetch(url, {
        //   method:

        // })
        // event.scroll()
      },
    });
  }
}
navigation.addEventListener("navigate", interceptNavigation);
