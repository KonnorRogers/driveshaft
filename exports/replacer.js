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
    this.replacePage(newDocument)
  }

  /**
   * Main method to replace page content
   * @param {Document} newDoc - The new page HTML as a string
   */
  async replacePage(newDoc) {
    const permanentElements = this.preservePermanentElements();

    this.mergeHead(newDoc.head);
    this.replaceBody(newDoc.body, permanentElements);

    document.dispatchEvent(new CustomEvent('driveshaft:load'));
  }

  /**
   * Store permanent elements before body replacement
   * @returns {Map<string, HTMLElement>} Map of permanent element IDs to their DOM nodes
   */
  preservePermanentElements() {
    const permanents = new Map();
    document.querySelectorAll(this.permanentSelector).forEach(el => {
      const id = el.id || this.generateId();
      el.id = id;
      permanents.set(id, el);
    });
    return permanents;
  }

  /**
   * Merge head elements intelligently
   * @param {HTMLHeadElement} newHead - The new head element
   * @param {HTMLHeadElement} [oldHead=document.head] - The new head element
   */
  mergeHead(newHead, oldHead = document.head) {
    const currentHead = document.head;

    this.syncAttributes(newHead, oldHead)

    // Track elements to add/remove
    const newElements = Array.from(newHead.children);
    const currentElements = Array.from(currentHead.children);

    // Create sets of element signatures for comparison
    const newSignatures = new Set(newElements.map(el => this.getElementSignature(el)));
    const currentSignatures = new Map(
      currentElements.map(el => [this.getElementSignature(el), el])
    );

    // Remove elements not in new head (except base, title handling)
    currentElements.forEach(el => {
      const sig = this.getElementSignature(el);
      if (!newSignatures.has(sig) && this.shouldRemoveHeadElement(el)) {
        el.remove();
      }
    });

    // Add new elements
    newElements.forEach(el => {
      const sig = this.getElementSignature(el);
      if (!currentSignatures.has(sig)) {
        const clone = el.cloneNode(true);
        currentHead.appendChild(clone);
      }
    });

    // Always update title
    if (newHead.querySelector('title')) {
      const titleEl = currentHead.querySelector('title') || document.createElement('title');
      const newTitle = newHead.querySelector('title')

      if (newTitle) {
        titleEl.textContent = newTitle.textContent;
      }
      if (!titleEl.parentNode) {
        currentHead.appendChild(titleEl);
      }
    }
  }

  /**
   * Generate a signature for head elements to compare them
   * @param {Element} el - The element
   * @returns {string} Signature string
   */
  getElementSignature(el) {
    const tag = el.tagName.toLowerCase();

    // For scripts and styles, use src/href as key
    if (tag === 'script' && el.src) {
      return `script[src="${el.src}"]`;
    }
    if (tag === 'link' && el.href) {
      return `link[href="${el.href}"][rel="${el.rel}"]`;
    }
    if (tag === 'meta' && el.name) {
      return `meta[name="${el.name}"]`;
    }
    if (tag === 'meta' && el.property) {
      return `meta[property="${el.property}"]`;
    }

    // For inline styles/scripts, use content hash
    return `${tag}:${el.outerHTML}`;
  }

  /**
   * Determine if a head element should be removed
   * @param {Element} el - The element
   * @returns {boolean}
   */
  shouldRemoveHeadElement(el) {
    const tag = el.tagName.toLowerCase();

    // Never remove these
    if (['base', 'meta[charset]'].includes(tag)) return false;
    if (tag === 'meta' && el.hasAttribute('charset')) return false;

    // Remove everything else if not in new head
    return true;
  }

  /**
   * Replace body content while restoring permanent elements
   * @param {HTMLElement} newBody - The new body element
   * @param {Map<string, Node>} permanentElements - Map of permanent elements to restore
   * @param {HTMLElement} [oldBody=document.body] - Map of permanent elements to restore
   */
  replaceBody(newBody, permanentElements, oldBody = document.body) {
    // Find permanent placeholders in new body
    const newPermanents = newBody.querySelectorAll(this.permanentSelector);

    // Replace placeholders with actual permanent elements
    newPermanents.forEach(placeholder => {
      const id = placeholder.id;
      const node = permanentElements.get(id)
      if (node) {
        placeholder.replaceWith(node);
      }
    });

    this.syncAttributes(newBody, oldBody)

    // Replace body content
    oldBody.replaceChildren(...newBody.children)
  }

  /**
   * Generate a unique ID for permanent elements
   * @returns {string}
   */
  generateId() {
    return `driveshaft-permanent-${Math.random().toString(36).substr(2, 9)}`;
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

