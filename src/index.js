import Observer from '@cocreate/observer';

/**
 * Main initialization entry point for ARIA attributes.
 * Orchestrates the setup of interactive controls and navigation states.
 * @param {Element|Element[]|NodeList} [elements] - Optional specific elements to initialize. 
 * If omitted, the script scans the entire document for [aria-controls].
 */
function init(elements) {
    // 1. Initialize aria-controls (Toggles, Popups, Tabs)
    let controlsElements = elements;
    if (!controlsElements) {
        controlsElements = document.querySelectorAll("[aria-controls]");
    }
    initElement(controlsElements);

    // 2. Initialize aria-current (Navigation links)
    // Performed after controls to ensure global scan happens last
    setAriaCurrent();
}

/**
 * Initializes interactive elements by binding click events and handling 
 * accessibility state changes (aria-expanded, aria-hidden, aria-selected).
 * @param {Element|Element[]|NodeList} elements - Elements to be initialized as ARIA controls.
 */
const initialized = new Set();

function initElement(elements) {
    if (
        !Array.isArray(elements) &&
        !(elements instanceof NodeList) &&
        !(elements instanceof HTMLCollection)
    ) {
        elements = [elements];
    }

    if (elements.length === 0) return;

    for (let control of elements) {
        if (!control.hasAttribute('aria-controls')) continue;
        if (initialized.has(control)) continue;
        initialized.add(control);
        
        initEscapeKey(control);
        
        control.addEventListener("click", function (event) {
            // Only prevent default if it's not a standard link leading to another page
            const href = this.getAttribute("href");
            if (!href || href.startsWith("#") || this.hasAttribute("aria-haspopup")) {
                event.preventDefault();
            }

            const controlledId = this.getAttribute("aria-controls");
            const controlledElement = document.getElementById(controlledId);

            if (!controlledElement) {
                console.warn(`ARIA Controls: No element found with ID "${controlledId}" controlled by`, this);
                return;
            }

            const closeOn = controlledElement.getAttribute("aria-close-on");
            const role = this.getAttribute("role");
            const hasAriaOpen = this.hasAttribute("aria-open");
            const hasAriaClose = this.hasAttribute("aria-close");
            const expanded = this.getAttribute("aria-expanded");
            const controlsClass = this.getAttribute("aria-controls-class") || "show";
            const group = this.getAttribute("aria-controls-group");

            // Prevent interaction if state is already in target position
            if (hasAriaOpen && expanded === "true") return;
            if (hasAriaClose && expanded !== "true") return;

            if (role === "tab") {
                // Tab Pattern: Mutual exclusivity within a tablist
                const tablist = this.closest("[role='tablist']");
                const tabs = tablist.querySelectorAll('[role="tab"]');
                for (let tab of tabs) {
                    const tabControlledId = tab.getAttribute("aria-controls");
                    const tabControlledEl = document.getElementById(tabControlledId);
                    if (this === tab) {
                        tab.setAttribute("aria-selected", "true");
                        tabControlledEl.setAttribute("aria-hidden", "false");
                        if (controlsClass) tabControlledEl.classList.add(controlsClass);
                    } else {
                        tab.setAttribute("aria-selected", "false");
                        tabControlledEl.setAttribute("aria-hidden", "true");
                        if (controlsClass) tabControlledEl.classList.remove(controlsClass);
                    }
                }
            } else {
                // Toggle Pattern: Standard expand/collapse
                if (expanded === "true") {
                    controlledElement.setAttribute("aria-hidden", "true");
                    if (controlsClass) controlledElement.classList.remove(controlsClass);
                    updateAllControls(controlledId, "false");
                    removePopupListener();
                } else {
                    controlledElement.setAttribute("aria-hidden", "false");
                    if (controlsClass) controlledElement.classList.add(controlsClass);
                    
                    // Handle grouped controls (Accordions)
                    if (group) {
                        const groupedControls = document.querySelectorAll(`[aria-controls-group="${group}"][aria-expanded="true"]`);
                        for (let groupedControl of groupedControls) {
                            const groupedId = groupedControl.getAttribute("aria-controls");
                            if (!groupedId || groupedId === controlledId) continue;
                            const groupedElement = document.getElementById(groupedId);
                            if (!groupedElement) continue;
                            const gClass = groupedControl.getAttribute("aria-controls-class") || "show";
                            groupedElement.setAttribute("aria-hidden", "true");
                            if (gClass) groupedElement.classList.remove(gClass);
                            updateAllControls(groupedId, "false");
                        }
                    }
                    updateAllControls(controlledId, "true");
                    if (closeOn !== "btn" && closeOn !== "button") {
                        addPopupListener();
                    }
                }
            }
        });
    }
}

/**
 * Synchronizes aria-expanded state across all elements controlling the same ID.
 * @param {string} controlledId - The ID of the target element.
 * @param {string} state - The target state ('true' or 'false').
 */
function updateAllControls(controlledId, state) {
    const allControls = document.querySelectorAll(`[aria-controls="${controlledId}"]`);
    allControls.forEach((ctrl) => ctrl.setAttribute("aria-expanded", state));
}

/**
 * Binds a global click listener to handle "click-outside" behavior for popups.
 * Conditions are defined via 'aria-close-on' attribute (outside, inside, anywhere).
 */
let popupListener = null;

function addPopupListener() {
    if (!popupListener) {
        popupListener = function (event) {
            const hasPopUps = document.querySelectorAll(
                '[aria-controls][aria-haspopup][aria-expanded="true"]'
            );

            let skipControlledId = null;
            for (let hasPopUp of hasPopUps) {
                const controlledId = hasPopUp.getAttribute("aria-controls");
                if (skipControlledId === controlledId) continue;
                if (hasPopUp.contains(event.target)) {
                    skipControlledId = controlledId;
                    continue; 
                }

                const controlledElement = document.getElementById(controlledId);
                if (!controlledElement) continue;

                // Check if the click occurred on an item explicitly marked to exclude closing
                const excludeElement = event.target.closest('[aria-close="false"]');
                if (excludeElement && controlledElement.contains(excludeElement)) {
                    skipControlledId = controlledId;
                    continue; 
                }

                let closeOn = controlledElement.getAttribute("aria-close-on");
                let closeOnEl = controlledElement;
                if (!closeOn) {
                    closeOnEl = event.target.closest(`#${controlledId} [aria-close-on]`);
                    if (closeOnEl) closeOn = closeOnEl.getAttribute("aria-close-on");
                }

                let closeOnConditions = closeOn ? closeOn.split(",").map(c => c.trim()) : [];
                let shouldClose = false;

                for (let condition of closeOnConditions) {
                    if (condition === "outside" && !closeOnEl.contains(event.target)) {
                        shouldClose = true;
                    } else if (condition === "inside" && closeOnEl.contains(event.target)) {
                        shouldClose = true;
                    } else if (condition === "anywhere") {
                        shouldClose = true;
                    }
                    if (shouldClose) break;
                }

                if (!shouldClose) continue;

                controlledElement.classList.remove("show");
                controlledElement.setAttribute("aria-hidden", "true");
                updateAllControls(controlledId, "false");
            }

            if (!document.querySelector('[aria-controls][aria-haspopup][aria-expanded="true"]')) {
                document.removeEventListener("click", popupListener, true);
                popupListener = null;
            }
        };
        document.addEventListener("click", popupListener, true);
    }
}

/**
 * Removes the global popup click listener.
 */
function removePopupListener() {
    if (popupListener) {
        document.removeEventListener("click", popupListener, true);
        popupListener = null;
    }
}

/**
 * Binds the Escape key to close the controlled element.
 * @param {Element} control - The trigger element that controls the target.
 */
function initEscapeKey(control) {
    const controlledId = control.getAttribute("aria-controls");
    const controlledElement = document.getElementById(controlledId);
    if (controlledElement) {
        control.addEventListener("keydown", handleEscapeKey);
        controlledElement.addEventListener("keydown", handleEscapeKey);
    }
}

/**
 * Global handler for the Escape key to close open interactive elements.
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function handleEscapeKey(event) {
    if (event.key === "Escape") {
        const toggleButton = event.currentTarget.matches("[aria-controls]")
            ? event.currentTarget
            : document.querySelector(`[aria-controls="${event.currentTarget.id}"]`);

        if (toggleButton) {
            toggleButton.click();
        }
    }
}

/**
 * Manages navigation state attributes by scanning links and matching them against
 * the current URL and hash. Assigns aria-current="page" or "location".
 * @param {Element|Element[]|NodeList} [elements] - Links or containers to scan. 
 * Defaults to all a[href] if not provided.
 */
function setAriaCurrent(elements) {
    if (!elements) {
        elements = document.querySelectorAll("a[href]");
    }

    if (
        !Array.isArray(elements) &&
        !(elements instanceof NodeList) &&
        !(elements instanceof HTMLCollection)
    ) {
        elements = [elements];
    }

    const currentUrl = new URL(window.location.href);
    const currentPage = `${currentUrl.origin}${normalizePath(currentUrl.pathname)}`;
    const currentHash = currentUrl.hash;

    for (const item of elements) {
        const links = (item.nodeName === 'A' && item.hasAttribute('href'))
            ? [item]
            : (item.querySelectorAll ? item.querySelectorAll("a[href]") : []);

        for (const link of links) {
            const href = link.getAttribute("href") || "";

            if (!href || href === "#") {
                link.removeAttribute("aria-current");
                continue;
            }

            let linkUrl;
            try {
                linkUrl = new URL(href, window.location.href);
            } catch {
                continue;
            }

            const linkPage = `${linkUrl.origin}${normalizePath(linkUrl.pathname)}`;
            const isSamePage = linkPage === currentPage;
            const linkHasHash = Boolean(linkUrl.hash);

            let ariaValue = null;

            if (isSamePage) {
                // Match exact location (hash) or general page
                if (linkHasHash && linkUrl.hash === currentHash) {
                    ariaValue = "location";
                } else if (!linkHasHash) {
                    ariaValue = "page";
                }
            }

            if (ariaValue) {
                link.setAttribute("aria-current", ariaValue);
            } else {
                link.removeAttribute("aria-current");
            }
        }
    }
}

/**
 * Sanitizes and normalizes URL paths to prevent trailing slash mismatches.
 * @param {string} path - The raw URL path.
 * @returns {string} The normalized path string.
 */
const normalizePath = (path) => path.replace(/\/$/, "") || "/";

/**
 * Event Listeners and Observers
 * Handles browser navigation events and dynamic DOM mutations.
 */
window.addEventListener("hashchange", () => setAriaCurrent());
window.addEventListener("popstate", () => setAriaCurrent());
document.addEventListener("keydown", handleEscapeKey);

// Observer: Interactive controls
Observer.init({
    name: "aria-controls",
    types: ["addedNodes"],
    selector: "[aria-controls]",
    callback: function (mutation) {
        initElement(mutation.target);
    }
});

// Observer: Navigation links
Observer.init({
    name: "aria-current",
    types: ["addedNodes", "attributes"],
    selector: "a[href]",
    attributeFilters: ["href"],
    callback: function (mutation) {
        setAriaCurrent(mutation.target);
    }
});

// Initial execution
init();

export { init, initElement, setAriaCurrent };