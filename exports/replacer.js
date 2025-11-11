/**
 * @typedef {Object} ReplacerOptions
 * @property {string} [permanentSelector]
 */
export class Replacer {
  /**
  * @param {Element} from
  * @param {Element} to
  */
  static syncAttributes (from, to) {
    // Get all attribute names from both elements
    const fromAttrs = Array.from(from.attributes).map(attr => attr.name)
    const toAttrs = Array.from(to.attributes).map(attr => attr.name)

    toAttrs.forEach((name) => {
      if (!fromAttrs.includes(name)) {
        to.removeAttribute(name)
      }
    })

    for (const { name, value } of from.attributes) {
      to.setAttribute(name, value);
    }
  }

  /**
  * @param {Element} from
  * @param {Element} to
  */
  syncAttributes (from, to) {
    return /** @type {typeof Replacer} */ (this.constructor).syncAttributes(from, to)
  }

  /**
   * @param {ReplacerOptions} options
   */
  constructor (options = {}) {
    this.permanentSelector = options?.permanentSelector || "[data-driveshaft-permanent]"
  }

  /**
   * @param {Document} newDocument
   * @param {Document} [oldDocument=document]
   */
  replace (newDocument, oldDocument = document) {
    const oldNodes = Array.from(document.head.childNodes) // Array.from to make it no longer a "live" reference.

    // TODO: We need a way to make sure everything has settled before replacing the `<head>` of old content. Perhaps we could look at a "merge" replaceStrategy instead?
    setTimeout(() => {
      for (const node of oldNodes) { node.remove() }
    })


    // upgrade any custom elements.
    const newBody = document.adoptNode(newDocument.body)

    // Update head / body elements with new attributes and remove old ones
    this.syncAttributes(newDocument.head, document.head)
    this.syncAttributes(newBody, document.body)
    document.body.replaceChildren(...newBody.childNodes)
    document.head.append(...newDocument.head.childNodes)
  }
}

/**
 * Waits for an element like a stylesheet to load. Not sure this is needed with ViewTransitions.
 * @param {HTMLElement} element
 */
function waitForLoad(element, timeoutInMilliseconds = 300) {
  return /** @type {Promise<void>} */ (new Promise((resolve) => {
    const onComplete = () => {
      element.removeEventListener("error", onComplete)
      element.removeEventListener("load", onComplete)
      resolve()
    }

    element.addEventListener("load", onComplete, { once: true })
    element.addEventListener("error", onComplete, { once: true })
    setTimeout(resolve, timeoutInMilliseconds)
  }))
}

