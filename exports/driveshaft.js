// @ts-check

import { Replacer } from "./replacer.js"
import { LinkClickObserver } from "./link-click-observer.js"

const brand = Symbol("driveshaftbrand")

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
 * @param {URLSearchParams} searchParams - if search params passed, will "mutate" them and append the proper keys.
 */
function urlEncodedFormData (formData, searchParams = new URLSearchParams()) {
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
    this.linkClickObserver = new LinkClickObserver()
    this.linkClickObserver.shouldStopNativeNavigation = ({location, event, anchorElement}) => {
      // @ts-expect-error We tried to use ajax navigation, it failed.
      if (anchorElement[brand]) { return false }

      return true
    }

    /**
     * @type {AbortController | null}
     */
    this.currentAbortController = null

    this.linkClickObserver.navigate = async ({location, event, anchorElement}) => {
      this.handleLinkNavigation(location, anchorElement)
    }

    this.interceptNavigation = this.interceptNavigation.bind(this)
    this.handleFormNavigation = this.handleFormNavigation.bind(this)

    /**
     * @type {"default" | ((newDocument: Document) => void)}
     */
    this.replaceStrategy = "default"
  }

  /**
   * @param {string} location
   * @param {HTMLAnchorElement | null} anchorElement
   */
  async handleLinkNavigation (location, anchorElement) {
    if (!anchorElement) { return }

    if (this.currentAbortController) {
      this.currentAbortController.abort()
    }

    this.currentAbortController = new AbortController()

    // TODO: Need to store scroll / focus locations for the polyfill.

    // This is always a link click.
    const response = await this.handleNavigation({
      sourceElement: anchorElement,
      url: location,
      formData: null,
      signal: this.currentAbortController.signal
    })

    if (!response) {
      return
    }

    const newHref = new URL(response.url).href
    const isNewPage = new URL(document.location.href).href !== newHref

    if (isNewPage) {
      window.history.pushState({}, "", newHref)
    } else {
      // Should we check query params et al?
      // window.history.replaceState({}, "", newHref)
    }
  }

  /**
   * @param {SubmitEvent} event
   */
  async handleFormNavigation (event) {
    if (event.defaultPrevented) { return }

    const form = /** @type {null | HTMLFormElement} */ (event.composedPath().find((el) => /** @type {Element} */ (el)?.localName === "form"))

    if (!form) { return }

    // @ts-expect-error
    if (form[brand]) { return }

    /**
     * @type {null | undefined | string}
     */
    let location = null

    if (event.submitter) {
      location = this.getLocationFromSourceElement(event.submitter)
    }


    if (!location) {
      location = form.action
    }

    if (!location) { return }

    if (this.currentAbortController) {
      this.currentAbortController.abort()
    }

    this.currentAbortController = new AbortController()

    // TODO: Need to store scroll / focus locations for the polyfill.
    const formData = new FormData(form)

    const method = (event.submitter?.getAttribute("formmethod") || /** @type {string | null} */ (formData.get("_method")) || form.method || "get").toLowerCase()

    const url = new URL(location)

    if (method === "get") {
      // mutate search params
      urlEncodedFormData(formData, url.searchParams)
    }

    event.preventDefault()


    const sourceElement = event.submitter
    // This is always a form submission.
    const response = await this.handleNavigation({
      sourceElement,
      url: url.href,
      formData: method === "get" ? null : formData,
      signal: this.currentAbortController.signal
    })

    if (!response) {
      return
    }

    const newHref = new URL(response.url).href
    const isNewPage = new URL(document.location.href).href !== newHref

    if (isNewPage) {
      window.history.pushState({}, "", newHref)
    } else {
      // Should we check query params et al?
      // window.history.replaceState({}, "", newHref)
    }
  }

  start () {
    // @ts-expect-error
    if (typeof window.navigation === "undefined") {
      this.linkClickObserver.start()
      document.addEventListener("submit", this.handleFormNavigation)
    } else {
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

    document.removeEventListener("submit", this.handleFormNavigation)
    this.linkClickObserver.stop()
  }

  /**
   * @this {DriveShaft}
  * @param {NavigateEvent} event
  */
  interceptNavigation (event) {
    if (!shouldIntercept(event)) {
      return;
    }

    const location = this.getLocationFromSourceElement(event.sourceElement)

    if (!location) { return }

    // This is what works natively in Chrome for forms. But because of a bug in the polyfill, we need the above checks.
    const url = new URL(event.destination.url)

    if (url.host === document.location.host) {
      const sourceElement = event.sourceElement

      // Don't try to AJAX navigate these. We already tried once.
      // @ts-expect-error
      if (sourceElement?.[brand] || sourceElement?.form?.[brand]) {
        return
      }
      event.intercept({
        // its want a void Promise, but i want to re-use the response from the promise in the polyfill.
        // @ts-expect-error
        handler: async () => await this.handleNavigation({
          sourceElement: event.sourceElement,
          formData: event.formData,
          signal: event.signal,
          url: url.href
        }),
        focusReset: "after-transition",
        scroll: "after-transition"
      });
    }
  }

  /**
   * @param {{
     signal: AbortSignal | null
     url: string
     formData: FormData | null
     sourceElement: Element | null
   }} params
   */
  async handleNavigation (params) {
    // We bind this at the top so its always DriveShaft.
    const self = /** @type {DriveShaft} */ (this)

    /**
    * @type {RequestInit}
    */
    const options = {
      signal: params.signal,
      credentials: "same-origin",
      referrer: window.location.href
    }

    /**
    * @type {Response | null}
    */
    let response = null

    const formData = params.formData

    if (formData) {
      // if there is formData, its a POST.

      // Check the srcElement to see if we have a different "method" defined.

      /**
      * Lets us support PATCH / PUT / DELETE etc.
      */
      const method = params.sourceElement?.getAttribute("formmethod") || /** @type {string | null} */ (formData.get("_method")) || "post"
      const enctype = params.sourceElement?.getAttribute("formenctype") || /** @type {HTMLButtonElement} */ (params.sourceElement).form?.enctype || "application/x-www-form-urlencoded"

      const body = enctype === "multipart/form-data" ? formData : urlEncodedFormData(formData)

      try {
        response = await fetch(params.url, {
          ...options,
          method,
          body
        })
      } catch (e) {
        console.error(`[Driveshaft]: Unable to navigate to ${params.url} with "${method}". Falling back to full page navigation.`)
        console.error(e)
        if (params.sourceElement) {
          this.handleFormError(params.sourceElement)
        }
        return null
      }
    } else {
      // I think url should have search params prefilled by browser.
      try {
        response = await fetch(params.url, {
          ...options,
          method: "get"
        })
      } catch (e) {
        console.error(`[Driveshaft]: Unable to navigate to ${params.url} with "GET". Falling back to full page navigation.`)
        console.error(e)

        if (params.sourceElement) {
          this.handleFormError(params.sourceElement)
        }
        return null
      }
    }

    if (!response) { return Promise.resolve(null) }

    if (isHTMLResponse(response)) {
      // allow the response to be read again.
      const html = await response.clone().text()

      if (document.startViewTransition) {
        // Firefox does not support this version.
        // return document.startViewTransition({
        //   update: () => self.replaceWithNewHTML(html, self.replaceStrategy),
        //   // not sure if we should specify?
        //   // types: [""]
        // }).finished

        await document.startViewTransition(() => self.replaceWithNewHTML(html, self.replaceStrategy)).finished
      } else {

        await /** @type {Promise<void>} */ (new Promise((resolve) => {
          self.replaceWithNewHTML(html, self.replaceStrategy)
          requestAnimationFrame(() => resolve())
        }))
      }
    }

    return Promise.resolve(response)
  }

  /**
   * @param {Element} trigger
   */
  handleFormError (trigger) {
    // @ts-expect-error
    trigger[brand] = brand

    const sourceElement = /** @type {(HTMLButtonElement | HTMLFormElement | HTMLAnchorElement)} */ (trigger)

    const form = sourceElement.localName === "form" ? /** @type {HTMLFormElement} */ (sourceElement) : null
    const button = sourceElement.localName === "button" ? /** @type {HTMLButtonElement} */ (sourceElement) : null;
    const anchor = sourceElement.localName === "a" ? /** @type {HTMLAnchorElement} */ (sourceElement) : null;

    if (button) {
      const buttonForm = button.form

      if (buttonForm) {
        // @ts-expect-error
        buttonForm[brand] = brand
        buttonForm.requestSubmit(button)
      }
    }

    if (form) {
      form.requestSubmit(null)
    }

    if (anchor) {
      anchor.click()
    }
  }

  /**
   * @param {string} html
   * @param {DriveShaft["replaceStrategy"]} replaceStrategy
   */
  replaceWithNewHTML (html, replaceStrategy = this.replaceStrategy) {
    // This is where the magic happens. Lets create a new DOM, then we'll compare the new dom vs existing DOM and then do node replacements, this lets web components properly instantiate.

    /**
     * @type {null | Document}
     */
    let dom = null

    try {
      if (typeof Document.parseHTMLUnsafe === "function") {
        dom = Document.parseHTMLUnsafe(html)
      } else {
        dom = this.domParser.parseFromString(html, "text/html")
      }
    } catch (e) {
      console.error(e)
      console.error("[Driveshaft]: Unable to parse new html")
      return
    }

    if (!dom) { return }

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

  /**
   * @param {Element} srcElement
   */
  getLocationFromSourceElement(srcElement) {
    // This will likely should really only ever be a button or an `<a>` (currently).
    const sourceElement = /** @type {HTMLAnchorElement | HTMLButtonElement} */ (srcElement)
    const href = sourceElement.localName === "a" ? /** @type {HTMLAnchorElement} */ (sourceElement).href : ""
    const form = /** @type {HTMLButtonElement} */ (sourceElement).form || null
    const formAction = sourceElement.localName === "button" ? sourceElement.getAttribute("formaction") : null

    return href || formAction || form?.action
  }
}

