// @ts-check

import { Replacer } from "./replacer.js"

/**
 * @typedef {object} NavigationDestination
 * @property {string} id - Returns the id value of the destination NavigationHistoryEntry if the NavigateEvent.navigationType is traverse, or an empty string otherwise.
 * @property {number} index - Returns the index value of the destination NavigationHistoryEntry if the NavigateEvent.navigationType is traverse, or -1 otherwise.
 * @property {string} key - Returns the key value of the destination NavigationHistoryEntry if the NavigateEvent.navigationType is traverse, or an empty string otherwise.
 * @property {boolean} sameDocument - Returns true if the navigation is to the same document as the current Document value, or false otherwise.
 * @property {string} url - Returns the URL being navigated to.
 */

/**
 * @typedef {object} InterceptHandlerInit
 * @property {() => Promise<void>} [handler] - A callback function that defines what the navigation handling behavior should be; it returns a promise. This function will run after the currentEntry property has been updated.
 * @property {() => Promise<void>} [precommitHandler] - A callback function that defines any behavior that should occur just before the navigation has committed; it accepts a controller object as an argument and returns a promise. This function will run before the currentEntry property has been updated.
 * @property {"after-transition" | "manual"} [focusReset] - Defines the navigation's focus behavior. This may take one of the following values:
 *  "after-transition"
 *      Once the promise returned by your handler function resolves, the browser will focus the first element with the autofocus attribute, or the <body> element if no element has autofocus set. This is the default value.
 *  "manual"
 *      Disable the default behavior.
 * @property {"after-transition" | "manual"} [scroll] - Defines the navigation's scrolling behavior. This may take one of the following values:
 *  "after-transition"
 *
 *      Allow the browser to handle scrolling, for example by scrolling to the relevant fragment identifier if the URL contains a fragment, or restoring the scroll position to the same place as last time if the page is reloaded or a page in the history is revisited. This is the default value.
 *  manual
 *
 *      Disable the default behavior.
 *
 */

/**
 * @typedef {(options: InterceptHandlerInit) => Promise<void>} InterceptHandler
 */

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent
 * @typedef {object} NavigateEventProperties
 * @property {boolean} canIntercept - Returns true if the navigation can be intercepted, or false otherwise (e.g., you can't intercept a cross-origin navigation).
 * @property {NavigationDestination} destination - Returns a {NavigationDestination} object representing the destination being navigated to.
 * @property {string | null} downloadRequest - Returns the filename of the file requested for download, in the case of a download navigation (e.g., an <a> or <area> element with a download attribute), or null otherwise.
 * @property {FormData | null} formData - Returns the FormData object representing the submitted data in the case of a POST form submission, or null otherwise.
 * @property {boolean} hashChange - Returns true if the navigation is a fragment navigation (i.e., to a fragment identifier in the same document), or false otherwise.
 * @property {boolean} hasUAVisualTransition - Returns true if the user agent performed a visual transition for this navigation before dispatching this event, or false otherwise.
 * @property {unknown | undefined} info - Returns the info data value passed by the initiating navigation operation (e.g., Navigation.back(), or Navigation.navigate()), or undefined if no info data was passed.
 * @property {"push" | "push" | "reload" | "replace" | "traverse"} navigationType - Returns the type of the navigation — push, reload, replace, or traverse.
 * @property {AbortSignal} signal - Returns an AbortSignal, which will become aborted if the navigation is cancelled (e.g., by the user pressing the browser's "Stop" button, or another navigation starting and thus cancelling the ongoing one).
 * @property {Element} sourceElement - When the navigation was initiated by an element (for example clicking a link), returns an Element object representing the initiating element.
 * @property {boolean} userInitiated - Returns true if the navigation was initiated by the user (e.g., by clicking a link, submitting a form, or pressing the browser's "Back"/"Forward" buttons), or false otherwise.
 * @property {InterceptHandler} intercept - Intercepts this navigation, turning it into a same-document navigation to the destination URL. It can accept handler functions that define what the navigation handling behavior should be, plus focusReset and scroll options to enable or disable the browser's default focus and scrolling behavior as desired.
 * @property {() => void} scroll - Can be called to manually trigger the browser-driven scrolling behavior that occurs in response to the navigation, if you want it to happen before the navigation handling has completed.
 */

/**
 * @typedef {Event & NavigateEventProperties & { originalEvent: SubmitEvent }} NavigateEvent
 */

/**
 * @param {NavigateEvent} event
 */
function shouldIntercept (event) {
  if (!event.userInitiated) {
    return false
  }
  // Some navigations, e.g. cross-origin navigations, we cannot intercept.
  // Let the browser handle those normally.
  if (!event.canIntercept) {
    return false
  }

  // don't intercept fragment navigations or downloads.
  if (event.hashChange) {
    return false
  }

  if (event.downloadRequest != null) {
    return false
  }

  return true
}

/**
 * @template {{toString: () => string}} T
 * @param {T} locatable
 */
function expandURL(locatable) {
  return new URL(locatable.toString(), document.baseURI)
}

/**
 * @param {Response} response
 */
function isHTMLResponse (response) {
  const contentType = response.headers.get("Content-Type")
  return contentType && contentType.match(/^(?:text\/([^\s;,]+\b)?html|application\/xhtml\+xml)\b/)
}


/**
 * @param {FormData} formData
 */
function urlEncodedFormData (formData) {
  const searchParams = new URLSearchParams()
  for (const [name, value] of formData) {
    if (value instanceof File) { continue }

    searchParams.append(name, value)
  }

  return searchParams
}

export class DriveShaft {
  constructor () {
    this.domParser = new DOMParser()
    this.replacer = new Replacer()
    this.interceptNavigation = this.interceptNavigation.bind(this)

    /**
     * @type {"default" | ((newDocument: Document) => void)}
     */
    this.replaceStrategy = "default"
  }

  start () {
    // @ts-expect-error
    if (typeof window.navigation !== "undefined") {
      // @ts-expect-error
      navigation.addEventListener("navigate", this.interceptNavigation);
    }
  }

  stop () {
    // @ts-expect-error
    if (typeof window.navigation !== "undefined") {
      // @ts-expect-error
      navigation.removeEventListener("navigate", this.interceptNavigation);
    }
  }

  /**
   * @this {DriveShaft}
  * @param {NavigateEvent} event
  */
  interceptNavigation (event) {
    if (!shouldIntercept(event)) {
      return;
    }

    // We bind this at the top so its always DriveShaft.
    const self = /** @type {DriveShaft} */ (this)

    // Because the polyfill doesn't work correctly on forms, we have to check the sourceElement href / formaction / form.action
    // This will likely should really only ever be a button or an `<a>` (currently).
    const sourceElement = /** @type {HTMLAnchorElement | HTMLButtonElement} */ (event.sourceElement || event.originalEvent.submitter)
    const href = sourceElement.localName === "a" ? /** @type {HTMLAnchorElement} */ (sourceElement).href : ""
    const form = /** @type {HTMLButtonElement} */ (sourceElement).form || null
    const formAction = sourceElement.localName === "button" ? sourceElement.getAttribute("formaction") : null

    const location = href || formAction || form?.action

    if (!location) { return }

    // This is what works natively in Chrome for forms. But because of a bug in the polyfill, we need the above checks.
    // const url = new URL(event.destination.url)
    const url = new URL(location)

    if (url.host === document.location.host) {
      event.intercept({
        async handler() {
          /**
          * @type {RequestInit}
          */
          const options = {
            redirect: "follow",
            signal: event.signal,
            credentials: "same-origin",
            referrer: window.location.href
          }

          /**
          * @type {Response | null}
          */
          let response = null

          const formData = event.formData

          if (formData) {
            // if there is formData, its a POST.

            // Check the srcElement to see if we have a different "method" defined.

            /**
            * Lets us support PATCH / PUT / DELETE etc.
            */
            const method = sourceElement.getAttribute("formmethod") || /** @type {string | null} */ (formData.get("_method")) || "post"
            const enctype = sourceElement.getAttribute("formenctype") || /** @type {HTMLButtonElement} */ (sourceElement).form?.enctype || "application/x-www-form-urlencoded"

            const body = enctype === "multipart/form-data" ? formData : urlEncodedFormData(formData)
            response = await fetch(url, {
              ...options,
              method,
              body
            })
          } else {
            // I think url should have search params prefilled by browser.
            response = await fetch(url, {
              ...options,
              method: "get"
            })
          }

          if (!response) { return }

          if (isHTMLResponse(response)) {
            const html = await response.text()

            if (document.startViewTransition) {
              // Firefox does not support this version.
              // return document.startViewTransition({
              //   update: () => self.replaceWithNewHTML(html, self.replaceStrategy),
              //   // not sure if we should specify?
              //   // types: [""]
              // }).finished

              return document.startViewTransition(() => self.replaceWithNewHTML(html, self.replaceStrategy)).finished
            } else {
              self.replaceWithNewHTML(html, self.replaceStrategy)
              return Promise.resolve()
            }
          }
        },
        focusReset: "after-transition",
        scroll: "after-transition"
      });
    }
  }

  /**
   * @param {string} html
   * @param {DriveShaft["replaceStrategy"]} replaceStrategy
   */
  replaceWithNewHTML (html, replaceStrategy = this.replaceStrategy) {
    // This is where the magic happens. Lets create a new DOM, then we'll compare the new dom vs existing DOM and then do node replacements, this lets web components properly instantiate.
    let dom = this.domParser.parseFromString(html, "text/html")


    if (replaceStrategy === "default") {
      this.replacer.replace(dom)
    } else {
      if (typeof replaceStrategy === "function") {
        replaceStrategy(dom)
      }
    }
  }

  /**
   * @type {Replacer["syncAttributes"]}
   */
  syncAttributes (from, to) {
    return Replacer.syncAttributes(from, to)
  }
}

