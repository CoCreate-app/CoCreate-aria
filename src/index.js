function init(elements) {
	if (!elements) {
		elements = document.querySelectorAll("[aria-controls]");
		// initDocument();
	}
	initElement(elements);
}

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
				if (skipControlledId === controlledId) {
					continue; // Skip this controlledId if it was already processed
				}
				if (hasPopUp.contains(event.target)) {
					skipControlledId = controlledId;
					continue; // Ignore clicks inside the popup
				}

				const controlledElement = document.getElementById(controlledId);
				let closeOn = controlledElement.getAttribute("aria-close-on");
				let closeOnEl = controlledElement;
				if (!closeOn) {
					closeOnEl = event.target.closest(
						`#${controlledId} [aria-close-on]`
					);
					if (closeOnEl) {
						closeOn = closeOnEl.getAttribute("aria-close-on");
					}
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

					// If any condition matches, break the loop
					if (shouldClose) break;
				}

				if (!shouldClose) continue;

				controlledElement.classList.remove("show");
				controlledElement.setAttribute("aria-hidden", "true");
				updateAllControls(controlledId, "false");
			}
			// Remove listener if no popups remain open
			if (
				!document.querySelector(
					'[aria-controls][aria-haspopup][aria-expanded="true"]'
				)
			) {
				document.removeEventListener("click", popupListener, true);
				popupListener = null;
			}
		};
		document.addEventListener("click", popupListener, true);
	}
}

function removePopupListener() {
	if (popupListener) {
		document.removeEventListener("click", popupListener, true);
		popupListener = null;
	}
}

const initialized = new Set();
function initElement(elements) {
	if (
		!Array.isArray(elements) &&
		!(elements instanceof NodeList) &&
		!(elements instanceof HTMLCollection)
	) {
		elements = [elements];
	}

	if (elements.length === 0) {
		return;
	}

	for (let control of elements) {
		if (initialized.has(control)) continue;
		initialized.add(control);
		initEscapeKey(control);
		control.addEventListener("click", function (event) {
			event.preventDefault(); // Prevent default link behavior for <a> tags

			const controlledId = this.getAttribute("aria-controls");
			const controlledElement = document.getElementById(controlledId);

			if (!controlledElement) {
				console.warn(
					`ARIA Controls: No element found with ID "${controlledId}" controlled by`,
					this
				);
				return;
			}

			const closeOn = controlledElement.getAttribute("aria-close-on");
			const role = this.getAttribute("role");
			const hasAriaOpen = this.hasAttribute("aria-open");
			const hasAriaClose = this.hasAttribute("aria-close");
			const expanded = this.getAttribute("aria-expanded");
			const controlsClass = this.getAttribute("aria-controls-class") || "show";

			// Apply aria-open and aria-close logic globally, before any role-specific logic
			if (hasAriaOpen && expanded === "true") {
				// Do nothing if already open and aria-open is set
				return;
			}
			if (hasAriaClose && expanded !== "true") {
				// Do nothing if already closed and aria-close is set
				return;
			}

			if (role === "tab") {
				const tablist = this.closest("[role='tablist']");
				const tabs = tablist.querySelectorAll('[role="tab"]');
				for (let tab of tabs) {
					const tabControlledId = tab.getAttribute("aria-controls");
					const tabControlledEl =
						document.getElementById(tabControlledId);
					if (this === tab) {
						tab.setAttribute("aria-selected", "true");
						tabControlledEl.setAttribute("aria-hidden", "false");
						if (controlsClass) {
							tabControlledEl.classList.add(controlsClass);
						}
					} else {
						tab.setAttribute("aria-selected", "false");
						tabControlledEl.setAttribute("aria-hidden", "true");
						if (controlsClass) {
							tabControlledEl.classList.remove(controlsClass);
						}
					}
				}
			} else {
				// Default toggle logic
				if (expanded === "true") {
					controlledElement.setAttribute("aria-hidden", "true");
						if (controlsClass) {
							controlledElement.classList.remove(controlsClass);
						}
					updateAllControls(controlledId, "false");
					removePopupListener();
				} else {
					controlledElement.setAttribute("aria-hidden", "false");
					if (controlsClass) {
						controlledElement.classList.add(controlsClass);
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

function updateAllControls(controlledId, state) {
	const allControls = document.querySelectorAll(
		`[aria-controls="${controlledId}"]`
	);
	allControls.forEach((ctrl) => ctrl.setAttribute("aria-expanded", state));
}

function initEscapeKey(control) {
	const controlledId = control.getAttribute("aria-controls");
	const controlledElement = document.getElementById(controlledId);
	if (controlledElement) {
		control.addEventListener("keydown", handleEscapeKey);
		controlledElement.addEventListener("keydown", handleEscapeKey);
	}
}

function handleEscapeKey(event) {
	if (event.key === "Escape") {
		// Use currentTarget to reference the element the listener is attached to
		const toggleButton = event.currentTarget.matches("[aria-controls]")
			? event.currentTarget
			: document.querySelector(
					`[aria-controls="${event.currentTarget.id}"]`
			  );

		if (toggleButton) {
			toggleButton.click();
		}
	}
}

// Attach Escape key handler globally
document.addEventListener("keydown", handleEscapeKey);

CoCreate.observer.init({
	name: "aria",
	types: ["addedNodes"],
	selector: "[aria-controls]",
	callback: function (mutation) {
		initElement(mutation.target);
	}
});

// CoCreate.observer.init({
// 	name: "aria-attributes",
// 	types: ["attributes"],
// 	attributeFilters: ["aria-selected"],
// 	callback: function (mutation) {
// 		initElement(mutation.target);
// 	}
// });

init();
