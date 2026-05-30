/**
 * Design mode overlays — renders:
 *  - A lightweight hover highlight that follows the cursor
 *  - A persistent selection highlight for the element the design panel is
 *    currently editing
 *  - A contextual action toolbar attached to the selected element, inside
 *    the iframe so it stays pinned during scroll without cross-frame lag.
 *
 * Shared between web and mobile (mobile uses React Native Web).
 */

// `vanilla-colorful` registers the <hex-color-picker> custom element. The
// side-effect import is done from each app's design-mode entry point (where
// the dependency is installed). We just type the element locally so this
// shared file doesn't need to resolve the package itself.
type HexColorPickerElement = HTMLElement & {
	color: string;
};

export const TOOLBAR_ID = "__design-mode-toolbar";

const HOVER_COLOR = "#4180EB";
const SELECTION_COLOR = "#4180EB";
const TOOLBAR_GAP = 8;

const GRID_ICON = `
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.4 3H4.6C4.03995 3 3.75992 3 3.54601 3.10899C3.35785 3.20487 3.20487 3.35785 3.10899 3.54601C3 3.75992 3 4.03995 3 4.6V8.4C3 8.96005 3 9.24008 3.10899 9.45399C3.20487 9.64215 3.35785 9.79513 3.54601 9.89101C3.75992 10 4.03995 10 4.6 10H8.4C8.96005 10 9.24008 10 9.45399 9.89101C9.64215 9.79513 9.79513 9.64215 9.89101 9.45399C10 9.24008 10 8.96005 10 8.4V4.6C10 4.03995 10 3.75992 9.89101 3.54601C9.79513 3.35785 9.64215 3.20487 9.45399 3.10899C9.24008 3 8.96005 3 8.4 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19.4 3H15.6C15.0399 3 14.7599 3 14.546 3.10899C14.3578 3.20487 14.2049 3.35785 14.109 3.54601C14 3.75992 14 4.03995 14 4.6V8.4C14 8.96005 14 9.24008 14.109 9.45399C14.2049 9.64215 14.3578 9.79513 14.546 9.89101C14.7599 10 15.0399 10 15.6 10H19.4C19.9601 10 20.2401 10 20.454 9.89101C20.6422 9.79513 20.7951 9.64215 20.891 9.45399C21 9.24008 21 8.96005 21 8.4V4.6C21 4.03995 21 3.75992 20.891 3.54601C20.7951 3.35785 20.6422 3.20487 20.454 3.10899C20.2401 3 19.9601 3 19.4 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19.4 14H15.6C15.0399 14 14.7599 14 14.546 14.109C14.3578 14.2049 14.2049 14.3578 14.109 14.546C14 14.7599 14 15.0399 14 15.6V19.4C14 19.9601 14 20.2401 14.109 20.454C14.2049 20.6422 14.3578 20.7951 14.546 20.891C14.7599 21 15.0399 21 15.6 21H19.4C19.9601 21 20.2401 21 20.454 20.891C20.6422 20.7951 20.7951 20.6422 20.891 20.454C21 20.2401 21 19.9601 21 19.4V15.6C21 15.0399 21 14.7599 20.891 14.546C20.7951 14.3578 20.6422 14.2049 20.454 14.109C20.2401 14 19.9601 14 19.4 14Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8.4 14H4.6C4.03995 14 3.75992 14 3.54601 14.109C3.35785 14.2049 3.20487 14.3578 3.10899 14.546C3 14.7599 3 15.0399 3 15.6V19.4C3 19.9601 3 20.2401 3.10899 20.454C3.20487 20.6422 3.35785 20.7951 3.54601 20.891C3.75992 21 4.03995 21 4.6 21H8.4C8.96005 21 9.24008 21 9.45399 20.891C9.64215 20.7951 9.79513 20.6422 9.89101 20.454C10 20.2401 10 19.9601 10 19.4V15.6C10 15.0399 10 14.7599 9.89101 14.546C9.79513 14.3578 9.64215 14.2049 9.45399 14.109C9.24008 14 8.96005 14 8.4 14Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

let toolbarEl: HTMLDivElement | null = null;
let inputWrapEl: HTMLDivElement | null = null;
let submitBtnEl: HTMLButtonElement | null = null;
let typographyControlsEl: HTMLDivElement | null = null;
let typographyFieldsRef: {
	fontFamilyLabel: HTMLSpanElement;
	fontFamilySelect: HTMLSelectElement;
	colorSwatch: HTMLSpanElement;
	colorControl: HTMLDivElement;
	colorDropdown: HTMLDivElement;
	colorPicker: HexColorPickerElement;
	colorHexInput: HTMLInputElement;
	fontSizeInput: HTMLInputElement;
	textAlignControl: HTMLDivElement;
	textAlignDropdown: HTMLDivElement;
	textAlignHButtons: Record<AlignH, HTMLButtonElement>;
	textPaddingControl: HTMLDivElement;
	textPaddingDropdown: HTMLDivElement;
	textPaddingXInput: HTMLInputElement;
	textPaddingYInput: HTMLInputElement;
} | null = null;
let currentTextAlignHRef: AlignH = "left";
let currentTextPaddingXRef = 0;
let currentTextPaddingYRef = 0;
let textColorDropdownOpen = false;
let textColorDropdownDocListener: ((e: MouseEvent) => void) | null = null;
let textAlignDropdownOpen = false;
let textAlignDropdownDocListener: ((e: MouseEvent) => void) | null = null;
let textPaddingDropdownOpen = false;
let textPaddingDropdownDocListener: ((e: MouseEvent) => void) | null = null;
let imageControlsEl: HTMLDivElement | null = null;
type AlignH = "left" | "center" | "right";
type AlignV = "top" | "center" | "bottom";
let imageFieldsRef: {
	sourceLabel: HTMLSpanElement;
	sourceThumb: HTMLSpanElement;
	sourceDropdown: HTMLDivElement;
	sourceControl: HTMLDivElement;
	alignControl: HTMLDivElement;
	alignDropdown: HTMLDivElement;
	alignHButtons: Record<AlignH, HTMLButtonElement>;
	alignVButtons: Record<AlignV, HTMLButtonElement>;
	paddingControl: HTMLDivElement;
	paddingDropdown: HTMLDivElement;
	paddingXInput: HTMLInputElement;
	paddingYInput: HTMLInputElement;
} | null = null;
let imageAssetsRef: Array<{ url: string; name: string }> = [];
let currentImageSrcRef: string | null = null;
let currentAlignHRef: AlignH = "center";
let currentAlignVRef: AlignV = "center";
let currentPaddingXRef = 0;
let currentPaddingYRef = 0;
let sourceDropdownOpen = false;
let sourceDropdownDocListener: ((e: MouseEvent) => void) | null = null;
let alignDropdownOpen = false;
let alignDropdownDocListener: ((e: MouseEvent) => void) | null = null;
let paddingDropdownOpen = false;
let paddingDropdownDocListener: ((e: MouseEvent) => void) | null = null;
let containerControlsEl: HTMLDivElement | null = null;
let containerFieldsRef: {
	bgSwatch: HTMLSpanElement;
	bgControl: HTMLDivElement;
	bgDropdown: HTMLDivElement;
	bgFormatLabel: HTMLSpanElement;
	bgHexInput: HTMLInputElement;
	bgAlphaLabel: HTMLSpanElement;
	bgPicker: HexColorPickerElement;
	alignControl: HTMLDivElement;
	alignDropdown: HTMLDivElement;
	alignHButtons: Record<AlignH, HTMLButtonElement>;
	alignVButtons: Record<AlignV, HTMLButtonElement>;
	paddingControl: HTMLDivElement;
	paddingDropdown: HTMLDivElement;
	paddingXInput: HTMLInputElement;
	paddingYInput: HTMLInputElement;
} | null = null;
let currentContainerAlignHRef: AlignH = "center";
let currentContainerAlignVRef: AlignV = "center";
let currentContainerPaddingXRef = 0;
let currentContainerPaddingYRef = 0;
let bgDropdownOpen = false;
let bgDropdownDocListener: ((e: MouseEvent) => void) | null = null;
let containerAlignDropdownOpen = false;
let containerAlignDropdownDocListener: ((e: MouseEvent) => void) | null = null;
let containerPaddingDropdownOpen = false;
let containerPaddingDropdownDocListener: ((e: MouseEvent) => void) | null = null;
let multiSelectInfoEl: HTMLDivElement | null = null;
let multiSelectDividerEl: HTMLDivElement | null = null;
let multiAlignPillEl: HTMLButtonElement | null = null;
let multiPaddingPillEl: HTMLButtonElement | null = null;
let multiAlignDropdownEl: HTMLDivElement | null = null;
let multiPaddingDropdownEl: HTMLDivElement | null = null;
let currentToolbarModeRef: "wand" | "palette" = "palette";
let currentSelectionIsTypography = false;
let currentSelectionIsImage = false;
let currentSelectionIsContainer = false;
let currentMultiSelectCount: number | null = null;
const TOOLBAR_SCALE = 1.3;

const TYPOGRAPHY_TAGS = new Set([
	"P",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"SPAN",
	"A",
	"BUTTON",
	"LABEL",
	"LI",
	"BLOCKQUOTE",
	"EM",
	"STRONG",
	"B",
	"I",
	"SMALL",
]);

export function isTypographyElement(element: Element): boolean {
	return TYPOGRAPHY_TAGS.has(element.tagName);
}

const IMAGE_TAGS = new Set(["IMG"]);

export function isImageElement(element: Element): boolean {
	return IMAGE_TAGS.has(element.tagName);
}

export function isContainerElement(element: Element): boolean {
	if (isTypographyElement(element)) return false;
	if (isImageElement(element)) return false;
	return true;
}
let hoverOverlayEl: HTMLDivElement | null = null;
let hoverLabelEl: HTMLDivElement | null = null;
let selectionOverlayEl: HTMLDivElement | null = null;
let selectionLabelEl: HTMLDivElement | null = null;
let multiSelectionContainerEl: HTMLDivElement | null = null;
let multiSelectionLabelsEl: HTMLDivElement | null = null;
const MULTI_SELECT_BADGE_COLOR = "#743af3";

function ensureHoverOverlay(): {
	overlay: HTMLDivElement;
	label: HTMLDivElement;
} {
	if (!hoverOverlayEl) {
		hoverOverlayEl = document.createElement("div");
		hoverOverlayEl.id = "__design-mode-overlay";
		Object.assign(hoverOverlayEl.style, {
			position: "absolute",
			pointerEvents: "none",
			border: `1.5px solid ${HOVER_COLOR}`,
			borderRadius: "2px",
			zIndex: "2147483645",
			display: "none",
		});
		document.body.appendChild(hoverOverlayEl);
	}

	if (!hoverLabelEl) {
		hoverLabelEl = document.createElement("div");
		hoverLabelEl.id = "__design-mode-label";
		Object.assign(hoverLabelEl.style, {
			position: "absolute",
			pointerEvents: "none",
			zIndex: "2147483647",
			background: HOVER_COLOR,
			color: "#FFFFFF",
			fontSize: "14px",
			lineHeight: "1.4",
			padding: "2px 8px",
			borderRadius: "4px",
			fontFamily: "Inter, system-ui, -apple-system, sans-serif",
			whiteSpace: "nowrap",
			display: "none",
			alignItems: "center",
			gap: "4px",
		});
		document.body.appendChild(hoverLabelEl);
	}

	return { overlay: hoverOverlayEl, label: hoverLabelEl };
}

function ensureSelectionOverlay(): {
	overlay: HTMLDivElement;
	label: HTMLDivElement;
} {
	if (!selectionOverlayEl) {
		selectionOverlayEl = document.createElement("div");
		selectionOverlayEl.id = "__design-mode-selection-overlay";
		Object.assign(selectionOverlayEl.style, {
			position: "absolute",
			pointerEvents: "none",
			border: `2px solid ${SELECTION_COLOR}`,
			borderRadius: "2px",
			zIndex: "2147483645",
			display: "none",
		});
		document.body.appendChild(selectionOverlayEl);
	}

	if (!selectionLabelEl) {
		selectionLabelEl = document.createElement("div");
		selectionLabelEl.id = "__design-mode-selection-label";
		Object.assign(selectionLabelEl.style, {
			position: "absolute",
			pointerEvents: "none",
			zIndex: "2147483647",
			background: SELECTION_COLOR,
			color: "#FFFFFF",
			fontSize: "14px",
			lineHeight: "1.4",
			padding: "2px 8px",
			borderRadius: "4px",
			fontFamily: "Inter, system-ui, -apple-system, sans-serif",
			whiteSpace: "nowrap",
			display: "none",
			alignItems: "center",
			gap: "4px",
		});
		document.body.appendChild(selectionLabelEl);
	}

	return { overlay: selectionOverlayEl, label: selectionLabelEl };
}

function positionLabel(label: HTMLDivElement, rect: DOMRect, text: string) {
	const escaped = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
	label.innerHTML = `${GRID_ICON}<span>${escaped}</span>`;
	label.style.display = "inline-flex";

	const sx = window.scrollX;
	const sy = window.scrollY;
	const labelHeight = 24;
	const vh = window.innerHeight;
	const fitsAbove = rect.top > labelHeight + 4;
	const fitsBelow = rect.bottom + labelHeight + 4 <= vh;

	let top: number;
	if (fitsAbove) {
		top = rect.top + sy - labelHeight - 2;
	} else if (fitsBelow) {
		top = rect.bottom + sy + 2;
	} else {
		top = rect.top + sy + 4;
	}
	label.style.top = `${top}px`;
	label.style.left = `${rect.left + sx}px`;
}

function displayText(tagName: string, className: string) {
	const tag = tagName.toLowerCase();
	const firstClass = className
		.split(/\s+/)
		.find(
			(cls) =>
				cls.length > 0 &&
				!cls.startsWith("[") &&
				!cls.startsWith("jsx-") &&
				!cls.startsWith("__"),
		);
	return firstClass ? `${tag}.${firstClass}` : `<${tag}>`;
}

export function positionOverlay(
	rect: DOMRect,
	tagName: string,
	className: string,
) {
	const { overlay, label } = ensureHoverOverlay();

	overlay.style.top = `${rect.top + window.scrollY}px`;
	overlay.style.left = `${rect.left + window.scrollX}px`;
	overlay.style.width = `${rect.width}px`;
	overlay.style.height = `${rect.height}px`;
	overlay.style.display = "block";

	positionLabel(label, rect, displayText(tagName, className));
}

export function hideOverlay() {
	if (hoverOverlayEl) hoverOverlayEl.style.display = "none";
	if (hoverLabelEl) hoverLabelEl.style.display = "none";
}

const DROP_INDICATOR_COLOR = "#4180EB";
let dropIndicatorEl: HTMLDivElement | null = null;

function ensureDropIndicator(): HTMLDivElement {
	if (dropIndicatorEl) return dropIndicatorEl;
	const el = document.createElement("div");
	el.id = "__design-mode-drop-indicator";
	Object.assign(el.style, {
		position: "absolute",
		pointerEvents: "none",
		background: DROP_INDICATOR_COLOR,
		borderRadius: "2px",
		height: "3px",
		zIndex: "2147483647",
		display: "none",
	});
	document.body.appendChild(el);
	dropIndicatorEl = el;
	return el;
}

export function positionDropIndicator(
	rect: DOMRect,
	position: "before" | "after",
) {
	const el = ensureDropIndicator();
	const sx = window.scrollX;
	const sy = window.scrollY;
	const top =
		position === "before" ? rect.top + sy - 1.5 : rect.bottom + sy - 1.5;
	el.style.top = `${top}px`;
	el.style.left = `${rect.left + sx}px`;
	el.style.width = `${rect.width}px`;
	el.style.display = "block";
}

export function hideDropIndicator() {
	if (dropIndicatorEl) dropIndicatorEl.style.display = "none";
}

let insideDropIndicatorEl: HTMLDivElement | null = null;

function ensureInsideDropIndicator(): HTMLDivElement {
	if (insideDropIndicatorEl) return insideDropIndicatorEl;
	const el = document.createElement("div");
	el.id = "__design-mode-inside-drop-indicator";
	Object.assign(el.style, {
		position: "absolute",
		pointerEvents: "none",
		border: `2px solid ${DROP_INDICATOR_COLOR}`,
		background: "rgba(65, 128, 235, 0.08)",
		borderRadius: "2px",
		zIndex: "2147483646",
		display: "none",
	});
	document.body.appendChild(el);
	insideDropIndicatorEl = el;
	return el;
}

export function positionInsideDropIndicator(rect: DOMRect) {
	const el = ensureInsideDropIndicator();
	const sx = window.scrollX;
	const sy = window.scrollY;
	el.style.top = `${rect.top + sy}px`;
	el.style.left = `${rect.left + sx}px`;
	el.style.width = `${rect.width}px`;
	el.style.height = `${rect.height}px`;
	el.style.display = "block";
}

export function hideInsideDropIndicator() {
	if (insideDropIndicatorEl) insideDropIndicatorEl.style.display = "none";
}

export function positionSelectionOverlay(
	rect: DOMRect,
	tagName: string,
	className: string,
) {
	const { overlay, label } = ensureSelectionOverlay();

	overlay.style.top = `${rect.top + window.scrollY}px`;
	overlay.style.left = `${rect.left + window.scrollX}px`;
	overlay.style.width = `${rect.width}px`;
	overlay.style.height = `${rect.height}px`;
	overlay.style.display = "block";

	positionLabel(label, rect, displayText(tagName, className));
}

export function hideSelectionOverlay() {
	if (selectionOverlayEl) selectionOverlayEl.style.display = "none";
	if (selectionLabelEl) selectionLabelEl.style.display = "none";
}

export function removeOverlay() {
	hoverOverlayEl?.remove();
	hoverLabelEl?.remove();
	selectionOverlayEl?.remove();
	selectionLabelEl?.remove();
	toolbarEl?.remove();
	multiSelectionContainerEl?.remove();
	multiSelectionLabelsEl?.remove();
	dropIndicatorEl?.remove();
	insideDropIndicatorEl?.remove();
	dropIndicatorEl = null;
	insideDropIndicatorEl = null;
	hoverOverlayEl = null;
	hoverLabelEl = null;
	selectionOverlayEl = null;
	selectionLabelEl = null;
	toolbarEl = null;
	multiSelectionContainerEl = null;
	multiSelectionLabelsEl = null;
	multiSelectInfoEl = null;
	multiSelectDividerEl = null;
	multiAlignPillEl = null;
	multiPaddingPillEl = null;
	multiAlignDropdownEl?.remove();
	multiAlignDropdownEl = null;
	multiPaddingDropdownEl?.remove();
	multiPaddingDropdownEl = null;
	currentMultiSelectCount = null;
}

function ensureMultiSelectionContainer(): HTMLDivElement {
	if (multiSelectionContainerEl) return multiSelectionContainerEl;
	const el = document.createElement("div");
	el.id = "__design-mode-multi-selection";
	Object.assign(el.style, {
		position: "absolute",
		top: "0",
		left: "0",
		pointerEvents: "none",
		zIndex: "2147483645",
	});
	document.body.appendChild(el);
	multiSelectionContainerEl = el;
	return el;
}

export function renderMultiSelectionRects(
	rects: { top: number; left: number; width: number; height: number }[],
) {
	const container = ensureMultiSelectionContainer();
	container.innerHTML = "";
	for (const rect of rects) {
		const child = document.createElement("div");
		Object.assign(child.style, {
			position: "absolute",
			top: `${rect.top + window.scrollY}px`,
			left: `${rect.left + window.scrollX}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			background: "transparent",
			border: `2px solid ${MULTI_SELECT_BADGE_COLOR}`,
			borderRadius: "4px",
			pointerEvents: "none",
			boxSizing: "border-box",
		});
		container.appendChild(child);
	}
}

export function clearMultiSelectionRects() {
	if (multiSelectionContainerEl) multiSelectionContainerEl.innerHTML = "";
}

function ensureMultiSelectionLabels(): HTMLDivElement {
	if (multiSelectionLabelsEl) return multiSelectionLabelsEl;
	const el = document.createElement("div");
	el.id = "__design-mode-multi-selection-labels";
	Object.assign(el.style, {
		position: "absolute",
		top: "0px",
		left: "0px",
		display: "block",
		pointerEvents: "none",
		zIndex: "2147483647",
		fontFamily: "Inter, system-ui, -apple-system, sans-serif",
		fontSize: "14px",
		lineHeight: "1.4",
		whiteSpace: "nowrap",
	});
	document.body.appendChild(el);
	multiSelectionLabelsEl = el;
	return el;
}

export function renderMultiSelectionLabels(
	items: {
		tagName: string;
		className: string;
		rect: { top: number; left: number; right: number; bottom: number };
	}[],
) {
	const container = ensureMultiSelectionLabels();
	container.innerHTML = "";

	if (items.length === 0) {
		container.style.display = "none";
		return;
	}

	container.style.display = "block";

	const sx = window.scrollX;
	const sy = window.scrollY;
	const vh = window.innerHeight;
	const labelHeight = 24;

	for (const item of items) {
		const text = displayText(item.tagName, item.className);
		const escaped = text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
		const badge = document.createElement("div");
		Object.assign(badge.style, {
			position: "absolute",
			display: "inline-flex",
			alignItems: "center",
			gap: "4px",
			padding: "2px 8px",
			borderRadius: "4px",
			background: MULTI_SELECT_BADGE_COLOR,
			color: "#FFFFFF",
			pointerEvents: "none",
		});
		badge.innerHTML = `${GRID_ICON}<span>${escaped}</span>`;

		const fitsAbove = item.rect.top > labelHeight + 4;
		const fitsBelow = item.rect.bottom + labelHeight + 4 <= vh;
		let top: number;
		if (fitsAbove) {
			top = item.rect.top + sy - labelHeight - 2;
		} else if (fitsBelow) {
			top = item.rect.bottom + sy + 2;
		} else {
			top = item.rect.top + sy + 4;
		}
		badge.style.top = `${top}px`;
		badge.style.left = `${item.rect.left + sx}px`;

		container.appendChild(badge);
	}
}

export function clearMultiSelectionLabels() {
	if (multiSelectionLabelsEl) {
		multiSelectionLabelsEl.innerHTML = "";
		multiSelectionLabelsEl.style.display = "none";
	}
}

type ToolbarMode = "wand" | "palette";

function postToParent(message: Record<string, unknown>) {
	window.parent.postMessage(message, "*");
}

function ensureToolbar(): HTMLDivElement {
	if (toolbarEl) return toolbarEl;

	const toolbar = document.createElement("div");
	toolbar.id = TOOLBAR_ID;
	Object.assign(toolbar.style, {
		position: "absolute",
		display: "none",
		alignItems: "center",
		gap: "8px",
		padding: "2px 4px",
		transform: `scale(${TOOLBAR_SCALE})`,
		transformOrigin: "top left",
		background: "#2c2d2f",
		border: "1px solid #555658",
		borderRadius: "8px",
		boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
		fontFamily: "Inter, system-ui, -apple-system, sans-serif",
		fontSize: "14px",
		lineHeight: "1",
		color: "#E8E8EA",
		zIndex: "2147483647",
		pointerEvents: "auto",
		cursor: "default",
		boxSizing: "border-box",
		userSelect: "none",
	});

	if (!document.getElementById(`${TOOLBAR_ID}-styles`)) {
		const styleEl = document.createElement("style");
		styleEl.id = `${TOOLBAR_ID}-styles`;
		styleEl.textContent = `
      #${TOOLBAR_ID} input::placeholder { color: #6a6a6c; opacity: 1; }
      #${TOOLBAR_ID} input::-webkit-input-placeholder { color: #6a6a6c; }
    `;
		document.head.appendChild(styleEl);
	}

	const wandIconLg = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.0001 14L10.0001 11M15.0104 3.5V2M18.9498 5.06066L20.0104 4M18.9498 13L20.0104 14.0607M11.0104 5.06066L9.94979 4M20.5104 9H22.0104M6.13146 20.8686L15.3687 11.6314C15.7647 11.2354 15.9627 11.0373 16.0369 10.809C16.1022 10.6082 16.1022 10.3918 16.0369 10.191C15.9627 9.96265 15.7647 9.76465 15.3687 9.36863L14.6315 8.63137C14.2354 8.23535 14.0374 8.03735 13.8091 7.96316C13.6083 7.8979 13.3919 7.8979 13.1911 7.96316C12.9627 8.03735 12.7647 8.23535 12.3687 8.63137L3.13146 17.8686C2.73545 18.2646 2.53744 18.4627 2.46325 18.691C2.39799 18.8918 2.39799 19.1082 2.46325 19.309C2.53744 19.5373 2.73545 19.7354 3.13146 20.1314L3.86872 20.8686C4.26474 21.2646 4.46275 21.4627 4.69108 21.5368C4.89192 21.6021 5.10827 21.6021 5.30911 21.5368C5.53744 21.4627 5.73545 21.2646 6.13146 20.8686Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const paletteIconLg = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12C2 17.5228 6.47715 22 12 22C13.6569 22 15 20.6569 15 19V18.5C15 18.0356 15 17.8034 15.0257 17.6084C15.2029 16.2622 16.2622 15.2029 17.6084 15.0257C17.8034 15 18.0356 15 18.5 15H19C20.6569 15 22 13.6569 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M7 13C7.55228 13 8 12.5523 8 12C8 11.4477 7.55228 11 7 11C6.44772 11 6 11.4477 6 12C6 12.5523 6.44772 13 7 13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 9C16.5523 9 17 8.55228 17 8C17 7.44772 16.5523 7 16 7C15.4477 7 15 7.44772 15 8C15 8.55228 15.4477 9 16 9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 8C10.5523 8 11 7.55228 11 7C11 6.44772 10.5523 6 10 6C9.44772 6 9 6.44772 9 7C9 7.55228 9.44772 8 10 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const wandIconSm = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.0001 14L10.0001 11M15.0104 3.5V2M18.9498 5.06066L20.0104 4M18.9498 13L20.0104 14.0607M11.0104 5.06066L9.94979 4M20.5104 9H22.0104M6.13146 20.8686L15.3687 11.6314C15.7647 11.2354 15.9627 11.0373 16.0369 10.809C16.1022 10.6082 16.1022 10.3918 16.0369 10.191C15.9627 9.96265 15.7647 9.76465 15.3687 9.36863L14.6315 8.63137C14.2354 8.23535 14.0374 8.03735 13.8091 7.96316C13.6083 7.8979 13.3919 7.8979 13.1911 7.96316C12.9627 8.03735 12.7647 8.23535 12.3687 8.63137L3.13146 17.8686C2.73545 18.2646 2.53744 18.4627 2.46325 18.691C2.39799 18.8918 2.39799 19.1082 2.46325 19.309C2.53744 19.5373 2.73545 19.7354 3.13146 20.1314L3.86872 20.8686C4.26474 21.2646 4.46275 21.4627 4.69108 21.5368C4.89192 21.6021 5.10827 21.6021 5.30911 21.5368C5.53744 21.4627 5.73545 21.2646 6.13146 20.8686Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const sendIcon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.4995 13.5001L20.9995 3.00005M10.6271 13.8281L13.2552 20.5861C13.4867 21.1815 13.6025 21.4791 13.7693 21.566C13.9139 21.6414 14.0862 21.6415 14.2308 21.5663C14.3977 21.4796 14.5139 21.1821 14.7461 20.587L21.3364 3.69925C21.5461 3.16207 21.6509 2.89348 21.5935 2.72185C21.5437 2.5728 21.4268 2.45583 21.2777 2.40604C21.1061 2.34871 20.8375 2.45352 20.3003 2.66315L3.41258 9.25349C2.8175 9.48572 2.51997 9.60183 2.43326 9.76873C2.35809 9.91342 2.35819 10.0857 2.43353 10.2303C2.52043 10.3971 2.81811 10.5128 3.41345 10.7444L10.1715 13.3725C10.2923 13.4195 10.3527 13.443 10.4036 13.4793C10.4487 13.5114 10.4881 13.5509 10.5203 13.596C10.5566 13.6468 10.5801 13.7073 10.6271 13.8281Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const trashIcon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

	const segmented = document.createElement("div");
	Object.assign(segmented.style, {
		display: "flex",
		alignItems: "center",
		gap: "0",
		padding: "0",
		background: "#555658",
		borderRadius: "8px",
		height: "28px",
	});

	const mkSegButton = (mode: ToolbarMode, icon: string, selected: boolean) => {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.dataset.mode = mode;
		btn.setAttribute("aria-pressed", String(selected));
		btn.innerHTML = icon;
		Object.assign(btn.style, {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			height: "28px",
			padding: "4px 12px",
			border: selected ? "1px solid #dbdbdb" : "1px solid transparent",
			borderRadius: "8px",
			background: selected ? "#ffffff" : "transparent",
			color: selected ? "#18191B" : "#dbdbdb",
			cursor: "pointer",
			boxSizing: "border-box",
			transition: "background 80ms ease-out, color 80ms ease-out",
		});
		return btn;
	};

	const wandBtn = mkSegButton("wand", wandIconLg, false);
	const paletteBtn = mkSegButton("palette", paletteIconLg, true);
	segmented.append(wandBtn, paletteBtn);

	const mkDivider = () => {
		const d = document.createElement("div");
		Object.assign(d.style, {
			width: "1px",
			height: "18.333px",
			background: "#555658",
			flexShrink: "0",
		});
		return d;
	};

	const FONT_FAMILY_OPTIONS = [
		"Inter",
		"System UI",
		"Sans-serif",
		"Serif",
		"Monospace",
		"Roboto",
		"Open Sans",
		"Georgia",
		"Times New Roman",
		"Arial",
		"Helvetica",
		"Courier New",
	];
	const TEXT_ALIGN_OPTIONS = [
		{ value: "left", label: "Left" },
		{ value: "center", label: "Center" },
		{ value: "right", label: "Right" },
		{ value: "justify", label: "Justify" },
	];

	const mkPillControl = () => {
		const wrap = document.createElement("div");
		Object.assign(wrap.style, {
			display: "inline-flex",
			alignItems: "center",
			gap: "4px",
			height: "28px",
			padding: "4px 12px",
			borderRadius: "8px",
			background: "#414243",
			color: "#FFFFFF",
			fontFamily: "inherit",
			fontSize: "14px",
			fontWeight: "500",
			lineHeight: "1",
			flexShrink: "0",
			cursor: "pointer",
		});
		return wrap;
	};

	const chevronDownIconSm = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

	// Typography controls (palette mode + text element). Hidden by default.
	const typographyWrap = document.createElement("div");
	Object.assign(typographyWrap.style, {
		display: "none",
		alignItems: "center",
		gap: "8px",
		flexShrink: "0",
	});

	const fontFamilyControl = mkPillControl();
	Object.assign(fontFamilyControl.style, {
		background: "#555658",
		border: "1px solid #414243",
		padding: "4px 14px",
		width: "190px",
		justifyContent: "space-between",
	});
	const fontFamilyLabel = document.createElement("span");
	fontFamilyLabel.textContent = "Inter";
	Object.assign(fontFamilyLabel.style, {
		flex: "1 1 auto",
		minWidth: "0",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	});
	const fontFamilySelect = document.createElement("select");
	for (const opt of FONT_FAMILY_OPTIONS) {
		const o = document.createElement("option");
		o.value = opt;
		o.textContent = opt;
		fontFamilySelect.appendChild(o);
	}
	Object.assign(fontFamilySelect.style, {
		position: "absolute",
		inset: "0",
		opacity: "0",
		cursor: "pointer",
	});
	const fontFamilyChevron = document.createElement("span");
	fontFamilyChevron.innerHTML = chevronDownIconSm;
	Object.assign(fontFamilyChevron.style, { display: "inline-flex" });
	fontFamilyControl.style.position = "relative";
	fontFamilyControl.append(fontFamilyLabel, fontFamilyChevron, fontFamilySelect);

	const postStyle = (property: string, value: string | null) => {
		postToParent({
			type: "design-mode:typography-style-changed",
			property,
			value,
		});
	};
	const postStyles = (styles: Record<string, string | null>) => {
		postToParent({
			type: "design-mode:typography-style-changed",
			styles,
		});
	};

	// --- Text color pill + HSV picker popover ---
	const colorControl = mkPillControl();
	Object.assign(colorControl.style, {
		position: "relative",
		cursor: "pointer",
		padding: "4px 12px",
		gap: "4px",
	});
	const colorSwatch = document.createElement("span");
	Object.assign(colorSwatch.style, {
		width: "18px",
		height: "18px",
		borderRadius: "4px",
		background: "#FFFFFF",
		border: "1px solid #DBDBDB",
		display: "inline-block",
		flexShrink: "0",
		boxSizing: "border-box",
	});
	const colorChevron = document.createElement("span");
	colorChevron.innerHTML = chevronDownIconSm;
	Object.assign(colorChevron.style, { display: "inline-flex" });

	const colorDropdown = document.createElement("div");
	Object.assign(colorDropdown.style, {
		position: "absolute",
		top: "calc(100% + 4px)",
		left: "0",
		width: "260px",
		background: "#2c2d2f",
		borderRadius: "12px",
		padding: "12px",
		boxShadow: "0 4px 5px rgba(0,0,0,0.15)",
		display: "none",
		flexDirection: "column",
		gap: "16px",
		zIndex: "2147483647",
		cursor: "default",
		boxSizing: "border-box",
	});
	const colorPicker = document.createElement(
		"hex-color-picker",
	) as HexColorPickerElement;
	colorPicker.color = "#FFFFFF";
	Object.assign(colorPicker.style, { width: "236px", height: "200px" });
	const colorHexRow = document.createElement("div");
	Object.assign(colorHexRow.style, {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		width: "236px",
	});
	const colorFormatLabel = document.createElement("div");
	colorFormatLabel.textContent = "HEX";
	Object.assign(colorFormatLabel.style, {
		display: "flex",
		alignItems: "center",
		background: "#414243",
		borderRadius: "8px",
		width: "100px",
		padding: "6px 12px",
		flexShrink: "0",
		boxSizing: "border-box",
		color: "#acadae",
		fontSize: "14px",
		fontWeight: "500",
		lineHeight: "1.4",
	});
	const colorHexWrap = document.createElement("div");
	Object.assign(colorHexWrap.style, {
		display: "flex",
		alignItems: "center",
		background: "#414243",
		borderRadius: "8px",
		flex: "1 1 auto",
		padding: "6px 12px",
		minWidth: "0",
		boxSizing: "border-box",
	});
	const colorHexInput = document.createElement("input");
	colorHexInput.type = "text";
	colorHexInput.value = "FFFFFF";
	colorHexInput.maxLength = 6;
	Object.assign(colorHexInput.style, {
		flex: "1 1 auto",
		minWidth: "0",
		background: "transparent",
		border: "0",
		outline: "none",
		color: "#acadae",
		fontFamily: "inherit",
		fontSize: "14px",
		fontWeight: "500",
		lineHeight: "1.4",
		padding: "0",
		textTransform: "uppercase",
	});
	colorHexWrap.append(colorHexInput);
	colorHexRow.append(colorFormatLabel, colorHexWrap);
	colorDropdown.append(colorPicker, colorHexRow);
	colorControl.append(colorSwatch, colorChevron, colorDropdown);

	// --- Font size (no chevron) ---
	const fontSizeControl = mkPillControl();
	const fontSizeInput = document.createElement("input");
	fontSizeInput.type = "number";
	fontSizeInput.value = "14";
	fontSizeInput.min = "1";
	Object.assign(fontSizeInput.style, {
		width: "28px",
		background: "transparent",
		border: "0",
		outline: "none",
		color: "#FFFFFF",
		fontFamily: "inherit",
		fontSize: "14px",
		fontWeight: "500",
		lineHeight: "1",
		padding: "0",
		appearance: "textfield",
		textAlign: "center",
	});
	fontSizeControl.append(fontSizeInput);

	// --- Shared icon SVG strings for text-align + padding popovers ---
	const txTextAlignLeftIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6h18M3 12h12M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
	const txTextAlignCenterIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6h18M6 12h12M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
	const txTextAlignRightIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6h18M9 12h12M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
	const txHSpacingIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4v16M20 4v16M8 12h8M10 9l-2 3 2 3M14 9l2 3-2 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
	const txVSpacingIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4h16M4 20h16M12 8v8M9 10l3-2 3 2M9 14l3 2 3-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

	// --- Text align pill + popover (H row + V row segmented controls) ---
	const txMkSegBtn = (icon: string) => {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.innerHTML = icon;
		Object.assign(btn.style, {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			padding: "6px 12px",
			border: "0",
			borderRadius: "8px",
			background: "transparent",
			color: "#dbdbdb",
			cursor: "pointer",
			boxSizing: "border-box",
			transition: "background 80ms ease-out, color 80ms ease-out",
		});
		return btn;
	};
	const txMkPopover = () => {
		const popover = document.createElement("div");
		Object.assign(popover.style, {
			position: "absolute",
			top: "calc(100% + 4px)",
			left: "0",
			background: "#2c2d2f",
			border: "1px solid #dbdbdb",
			borderRadius: "8px",
			padding: "8px",
			boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
			display: "none",
			flexDirection: "column",
			gap: "8px",
			zIndex: "2147483647",
			cursor: "default",
		});
		return popover;
	};
	const txMkPaddingRow = (icon: string) => {
		const row = document.createElement("div");
		Object.assign(row.style, {
			display: "inline-flex",
			alignItems: "center",
			gap: "4px",
			background: "#414243",
			borderRadius: "8px",
			padding: "6px 12px",
			width: "126px",
			boxSizing: "border-box",
		});
		const iconWrap = document.createElement("span");
		iconWrap.innerHTML = icon;
		Object.assign(iconWrap.style, {
			display: "inline-flex",
			color: "#c4c4c4",
			flexShrink: "0",
		});
		const input = document.createElement("input");
		input.type = "number";
		input.min = "0";
		input.value = "0";
		Object.assign(input.style, {
			flex: "1 1 auto",
			minWidth: "0",
			background: "transparent",
			border: "0",
			outline: "none",
			color: "#c4c4c4",
			fontFamily: "inherit",
			fontSize: "14px",
			fontWeight: "500",
			lineHeight: "1.4",
			padding: "0",
			appearance: "textfield",
		});
		row.append(iconWrap, input);
		return { row, input };
	};

	const textAlignControl = mkPillControl();
	Object.assign(textAlignControl.style, {
		position: "relative",
		cursor: "pointer",
	});
	const textAlignIconEl = document.createElement("span");
	textAlignIconEl.innerHTML = txTextAlignLeftIcon;
	Object.assign(textAlignIconEl.style, { display: "inline-flex" });
	const textAlignChevron = document.createElement("span");
	textAlignChevron.innerHTML = chevronDownIconSm;
	Object.assign(textAlignChevron.style, { display: "inline-flex" });
	const textAlignDropdown = txMkPopover();
	const textAlignHRow = document.createElement("div");
	Object.assign(textAlignHRow.style, {
		display: "inline-flex",
		alignItems: "center",
		background: "#414243",
		borderRadius: "8px",
	});
	const textAlignLeftBtn = txMkSegBtn(txTextAlignLeftIcon);
	const textAlignCenterBtn = txMkSegBtn(txTextAlignCenterIcon);
	const textAlignRightBtn = txMkSegBtn(txTextAlignRightIcon);
	textAlignHRow.append(textAlignLeftBtn, textAlignCenterBtn, textAlignRightBtn);
	textAlignDropdown.append(textAlignHRow);
	textAlignControl.append(
		textAlignIconEl,
		textAlignChevron,
		textAlignDropdown,
	);

	const typoDivider = mkDivider();

	// --- Text padding pill + popover (replaces letter spacing) ---
	const textPaddingControl = mkPillControl();
	Object.assign(textPaddingControl.style, {
		position: "relative",
		cursor: "pointer",
	});
	const textPaddingIconEl = document.createElement("span");
	textPaddingIconEl.innerHTML = txHSpacingIcon;
	Object.assign(textPaddingIconEl.style, { display: "inline-flex" });
	const textPaddingChevron = document.createElement("span");
	textPaddingChevron.innerHTML = chevronDownIconSm;
	Object.assign(textPaddingChevron.style, { display: "inline-flex" });
	const textPaddingDropdown = txMkPopover();
	const textPaddingX = txMkPaddingRow(txHSpacingIcon);
	const textPaddingY = txMkPaddingRow(txVSpacingIcon);
	textPaddingDropdown.append(textPaddingX.row, textPaddingY.row);
	textPaddingControl.append(
		textPaddingIconEl,
		textPaddingChevron,
		textPaddingDropdown,
	);

	typographyWrap.append(
		fontFamilyControl,
		colorControl,
		fontSizeControl,
		textAlignControl,
		typoDivider,
		textPaddingControl,
	);

	// --- Event handlers ---
	fontFamilySelect.addEventListener("change", () => {
		const v = fontFamilySelect.value;
		fontFamilyLabel.textContent = v;
		postStyle("fontFamily", v);
	});
	const submitFontSize = () => {
		const n = Number(fontSizeInput.value);
		if (!Number.isFinite(n) || n <= 0) return;
		postStyle("fontSize", `${n}px`);
	};
	fontSizeInput.addEventListener("change", submitFontSize);
	fontSizeInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submitFontSize();
		}
	});
	colorControl.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleTextColorDropdown();
	});
	colorDropdown.addEventListener("click", (e) => e.stopPropagation());
	colorDropdown.addEventListener("mousedown", (e) => e.stopPropagation());
	colorPicker.addEventListener("color-changed", (event: Event) => {
		const detail = (event as CustomEvent<{ value: string }>).detail;
		const hex = detail.value.toUpperCase();
		colorSwatch.style.background = hex;
		colorHexInput.value = hex.replace(/^#/, "");
		postStyle("textColor", hex);
	});
	colorPicker.addEventListener("click", (e) => e.stopPropagation());
	colorPicker.addEventListener("mousedown", (e) => e.stopPropagation());
	const submitHex = () => {
		const raw = colorHexInput.value.replace(/^#/, "").trim();
		if (!/^[a-fA-F0-9]{6}$/.test(raw)) return;
		const hex = `#${raw.toUpperCase()}`;
		colorPicker.color = hex;
		colorSwatch.style.background = hex;
		colorHexInput.value = raw.toUpperCase();
		postStyle("textColor", hex);
	};
	colorHexInput.addEventListener("change", submitHex);
	colorHexInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submitHex();
		}
	});
	colorHexInput.addEventListener("click", (e) => e.stopPropagation());

	const setTextAlignH = (value: AlignH) => {
		currentTextAlignHRef = value;
		updateTextAlignButtons();
		postStyle("textAlign", value);
	};
	textAlignLeftBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setTextAlignH("left");
	});
	textAlignCenterBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setTextAlignH("center");
	});
	textAlignRightBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setTextAlignH("right");
	});
	textAlignControl.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleTextAlignDropdown();
	});

	const submitTextPaddingX = () => {
		const n = Number(textPaddingX.input.value);
		if (!Number.isFinite(n) || n < 0) return;
		currentTextPaddingXRef = n;
		const value = `${n}px`;
		postStyles({ paddingLeft: value, paddingRight: value });
	};
	const submitTextPaddingY = () => {
		const n = Number(textPaddingY.input.value);
		if (!Number.isFinite(n) || n < 0) return;
		currentTextPaddingYRef = n;
		const value = `${n}px`;
		postStyles({ paddingTop: value, paddingBottom: value });
	};
	textPaddingX.input.addEventListener("change", submitTextPaddingX);
	textPaddingX.input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submitTextPaddingX();
		}
	});
	textPaddingX.input.addEventListener("click", (e) => e.stopPropagation());
	textPaddingY.input.addEventListener("change", submitTextPaddingY);
	textPaddingY.input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submitTextPaddingY();
		}
	});
	textPaddingY.input.addEventListener("click", (e) => e.stopPropagation());
	textPaddingControl.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleTextPaddingDropdown();
	});

	typographyWrap.dataset.typographyControls = "1";
	typographyControlsEl = typographyWrap;
	typographyFieldsRef = {
		fontFamilyLabel,
		fontFamilySelect,
		colorSwatch,
		colorControl,
		colorDropdown,
		colorPicker,
		colorHexInput,
		fontSizeInput,
		textAlignControl,
		textAlignDropdown,
		textAlignHButtons: {
			left: textAlignLeftBtn,
			center: textAlignCenterBtn,
			right: textAlignRightBtn,
		},
		textPaddingControl,
		textPaddingDropdown,
		textPaddingXInput: textPaddingX.input,
		textPaddingYInput: textPaddingY.input,
	};
	updateTextAlignButtons();

	const uploadIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 16.5V18.5C3 19.6046 3.89543 20.5 5 20.5H19C20.1046 20.5 21 19.6046 21 18.5V16.5M16 7.5L12 3.5M12 3.5L8 7.5M12 3.5V15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const imgAlignIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4v16M8 8h12M8 16h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const paddingIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4v16M20 4v16M8 12h8M10 9l-2 3 2 3M14 9l2 3-2 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const alignHLeftIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4v16M8 8h12M8 16h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const alignHCenterIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4v16M5 8h14M8 16h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const alignHRightIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4v16M4 8h12M9 16h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const alignVTopIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4h16M8 8v12M16 8v7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const alignVCenterIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12h16M8 5v14M16 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const alignVBottomIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 20h16M8 4v16M16 9v11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const hSpacingIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4v16M20 4v16M8 12h8M10 9l-2 3 2 3M14 9l2 3-2 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	const vSpacingIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4h16M4 20h16M12 8v8M9 10l3-2 3 2M9 14l3 2 3-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

	const imageWrap = document.createElement("div");
	Object.assign(imageWrap.style, {
		display: "none",
		alignItems: "center",
		gap: "8px",
		flexShrink: "0",
	});

	const sourceControl = mkPillControl();
	Object.assign(sourceControl.style, {
		background: "#555658",
		border: "1px solid #414243",
		padding: "4px 14px",
		gap: "8px",
		cursor: "pointer",
		position: "relative",
	});
	const sourceThumb = document.createElement("span");
	Object.assign(sourceThumb.style, {
		width: "18px",
		height: "18px",
		background: "#FFFFFF",
		border: "1px solid #DBDBDB",
		borderRadius: "4px",
		display: "inline-block",
		flexShrink: "0",
		backgroundSize: "cover",
		backgroundPosition: "center",
	});
	const sourceLabel = document.createElement("span");
	sourceLabel.textContent = "image.jpg";
	Object.assign(sourceLabel.style, {
		flex: "0 1 auto",
		minWidth: "0",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		fontWeight: "400",
	});
	const sourceChevron = document.createElement("span");
	sourceChevron.innerHTML = chevronDownIconSm;
	Object.assign(sourceChevron.style, { display: "inline-flex" });
	const sourceDropdown = document.createElement("div");
	Object.assign(sourceDropdown.style, {
		position: "absolute",
		top: "calc(100% + 4px)",
		left: "0",
		width: "280px",
		maxHeight: "240px",
		overflowY: "auto",
		background: "#2c2d2f",
		borderRadius: "12px",
		padding: "12px",
		boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
		display: "none",
		flexDirection: "column",
		gap: "8px",
		zIndex: "2147483647",
		cursor: "default",
		boxSizing: "border-box",
	});
	sourceControl.append(sourceThumb, sourceLabel, sourceChevron, sourceDropdown);

	const uploadControl = mkPillControl();
	Object.assign(uploadControl.style, {
		padding: "4px 14px",
		gap: "8px",
		cursor: "pointer",
	});
	const uploadIconEl = document.createElement("span");
	uploadIconEl.innerHTML = uploadIcon;
	Object.assign(uploadIconEl.style, { display: "inline-flex", color: "#C4C4C4" });
	const uploadLabel = document.createElement("span");
	uploadLabel.textContent = "Upload New";
	Object.assign(uploadLabel.style, {
		color: "#C4C4C4",
		fontWeight: "400",
	});
	uploadControl.append(uploadIconEl, uploadLabel);

	const mkAlignSegBtn = (icon: string) => {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.innerHTML = icon;
		Object.assign(btn.style, {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			padding: "6px 12px",
			border: "0",
			borderRadius: "8px",
			background: "transparent",
			color: "#dbdbdb",
			cursor: "pointer",
			boxSizing: "border-box",
			transition: "background 80ms ease-out, color 80ms ease-out",
		});
		return btn;
	};

	const mkPopoverShell = () => {
		const popover = document.createElement("div");
		Object.assign(popover.style, {
			position: "absolute",
			top: "calc(100% + 4px)",
			left: "0",
			background: "#2c2d2f",
			border: "1px solid #dbdbdb",
			borderRadius: "8px",
			padding: "8px",
			boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
			display: "none",
			flexDirection: "column",
			gap: "8px",
			zIndex: "2147483647",
			cursor: "default",
		});
		return popover;
	};

	const imgAlignControl = mkPillControl();
	Object.assign(imgAlignControl.style, {
		position: "relative",
		cursor: "pointer",
	});
	const imgAlignIconEl = document.createElement("span");
	imgAlignIconEl.innerHTML = imgAlignIcon;
	Object.assign(imgAlignIconEl.style, { display: "inline-flex" });
	const imgAlignChevron = document.createElement("span");
	imgAlignChevron.innerHTML = chevronDownIconSm;
	Object.assign(imgAlignChevron.style, { display: "inline-flex" });
	const alignDropdown = mkPopoverShell();

	const alignHRow = document.createElement("div");
	Object.assign(alignHRow.style, {
		display: "inline-flex",
		alignItems: "center",
		background: "#414243",
		borderRadius: "8px",
	});
	const alignHLeftBtn = mkAlignSegBtn(alignHLeftIcon);
	const alignHCenterBtn = mkAlignSegBtn(alignHCenterIcon);
	const alignHRightBtn = mkAlignSegBtn(alignHRightIcon);
	alignHRow.append(alignHLeftBtn, alignHCenterBtn, alignHRightBtn);

	const alignVRow = document.createElement("div");
	Object.assign(alignVRow.style, {
		display: "inline-flex",
		alignItems: "center",
		background: "#414243",
		borderRadius: "8px",
	});
	const alignVTopBtn = mkAlignSegBtn(alignVTopIcon);
	const alignVCenterBtn = mkAlignSegBtn(alignVCenterIcon);
	const alignVBottomBtn = mkAlignSegBtn(alignVBottomIcon);
	alignVRow.append(alignVTopBtn, alignVCenterBtn, alignVBottomBtn);

	alignDropdown.append(alignHRow, alignVRow);
	imgAlignControl.append(imgAlignIconEl, imgAlignChevron, alignDropdown);

	const paddingControl = mkPillControl();
	Object.assign(paddingControl.style, {
		position: "relative",
		cursor: "pointer",
	});
	const paddingIconEl = document.createElement("span");
	paddingIconEl.innerHTML = paddingIcon;
	Object.assign(paddingIconEl.style, { display: "inline-flex" });
	const paddingChevron = document.createElement("span");
	paddingChevron.innerHTML = chevronDownIconSm;
	Object.assign(paddingChevron.style, { display: "inline-flex" });
	const paddingDropdown = mkPopoverShell();

	const mkPaddingInputRow = (icon: string) => {
		const row = document.createElement("div");
		Object.assign(row.style, {
			display: "inline-flex",
			alignItems: "center",
			gap: "4px",
			background: "#414243",
			borderRadius: "8px",
			padding: "6px 12px",
			width: "126px",
			boxSizing: "border-box",
		});
		const iconWrap = document.createElement("span");
		iconWrap.innerHTML = icon;
		Object.assign(iconWrap.style, {
			display: "inline-flex",
			color: "#c4c4c4",
			flexShrink: "0",
		});
		const input = document.createElement("input");
		input.type = "number";
		input.min = "0";
		input.value = "0";
		Object.assign(input.style, {
			flex: "1 1 auto",
			minWidth: "0",
			background: "transparent",
			border: "0",
			outline: "none",
			color: "#c4c4c4",
			fontFamily: "inherit",
			fontSize: "14px",
			fontWeight: "500",
			lineHeight: "1.4",
			padding: "0",
			appearance: "textfield",
		});
		row.append(iconWrap, input);
		return { row, input };
	};
	const paddingX = mkPaddingInputRow(hSpacingIcon);
	const paddingY = mkPaddingInputRow(vSpacingIcon);
	paddingDropdown.append(paddingX.row, paddingY.row);
	paddingControl.append(paddingIconEl, paddingChevron, paddingDropdown);

	imageWrap.append(
		sourceControl,
		uploadControl,
		imgAlignControl,
		paddingControl,
	);

	const postImageStyle = (property: string, value: string | null) => {
		postToParent({
			type: "design-mode:image-style-changed",
			property,
			value,
		});
	};
	const postImageStyles = (styles: Record<string, string | null>) => {
		postToParent({
			type: "design-mode:image-style-changed",
			styles,
		});
	};

	const setAlignH = (value: AlignH) => {
		currentAlignHRef = value;
		updateAlignButtons();
		postImageStyle(
			"objectPosition",
			`${currentAlignHRef} ${currentAlignVRef}`,
		);
	};
	const setAlignV = (value: AlignV) => {
		currentAlignVRef = value;
		updateAlignButtons();
		postImageStyle(
			"objectPosition",
			`${currentAlignHRef} ${currentAlignVRef}`,
		);
	};
	alignHLeftBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setAlignH("left");
	});
	alignHCenterBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setAlignH("center");
	});
	alignHRightBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setAlignH("right");
	});
	alignVTopBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setAlignV("top");
	});
	alignVCenterBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setAlignV("center");
	});
	alignVBottomBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setAlignV("bottom");
	});

	const submitPaddingX = () => {
		const n = Number(paddingX.input.value);
		if (!Number.isFinite(n) || n < 0) return;
		currentPaddingXRef = n;
		const value = `${n}px`;
		postImageStyles({ paddingLeft: value, paddingRight: value });
	};
	const submitPaddingY = () => {
		const n = Number(paddingY.input.value);
		if (!Number.isFinite(n) || n < 0) return;
		currentPaddingYRef = n;
		const value = `${n}px`;
		postImageStyles({ paddingTop: value, paddingBottom: value });
	};
	paddingX.input.addEventListener("change", submitPaddingX);
	paddingX.input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submitPaddingX();
		}
	});
	paddingX.input.addEventListener("click", (e) => e.stopPropagation());
	paddingY.input.addEventListener("change", submitPaddingY);
	paddingY.input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submitPaddingY();
		}
	});
	paddingY.input.addEventListener("click", (e) => e.stopPropagation());

	imgAlignControl.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleAlignDropdown();
	});
	paddingControl.addEventListener("click", (e) => {
		e.stopPropagation();
		togglePaddingDropdown();
	});
	sourceControl.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleSourceDropdown();
	});
	uploadControl.addEventListener("click", (e) => {
		e.stopPropagation();
		postToParent({ type: "design-mode:image-upload-requested" });
	});

	imageWrap.dataset.imageControls = "1";
	imageControlsEl = imageWrap;
	imageFieldsRef = {
		sourceLabel,
		sourceThumb,
		sourceDropdown,
		sourceControl,
		alignControl: imgAlignControl,
		alignDropdown,
		alignHButtons: {
			left: alignHLeftBtn,
			center: alignHCenterBtn,
			right: alignHRightBtn,
		},
		alignVButtons: {
			top: alignVTopBtn,
			center: alignVCenterBtn,
			bottom: alignVBottomBtn,
		},
		paddingControl,
		paddingDropdown,
		paddingXInput: paddingX.input,
		paddingYInput: paddingY.input,
	};
	rebuildSourceOptions();
	updateAlignButtons();

	const containerWrap = document.createElement("div");
	Object.assign(containerWrap.style, {
		display: "none",
		alignItems: "center",
		gap: "8px",
		flexShrink: "0",
	});

	const bgControl = mkPillControl();
	Object.assign(bgControl.style, {
		position: "relative",
		cursor: "pointer",
		padding: "4px 12px",
		gap: "4px",
	});
	const bgSwatch = document.createElement("span");
	Object.assign(bgSwatch.style, {
		width: "18px",
		height: "18px",
		background: "#FFFFFF",
		border: "1px solid #DBDBDB",
		borderRadius: "4px",
		display: "inline-block",
		flexShrink: "0",
		boxSizing: "border-box",
	});
	const bgChevron = document.createElement("span");
	bgChevron.innerHTML = chevronDownIconSm;
	Object.assign(bgChevron.style, { display: "inline-flex" });

	const bgDropdown = document.createElement("div");
	Object.assign(bgDropdown.style, {
		position: "absolute",
		top: "calc(100% + 4px)",
		left: "0",
		width: "260px",
		background: "#2c2d2f",
		borderRadius: "12px",
		padding: "12px",
		boxShadow: "0 4px 5px rgba(0,0,0,0.15)",
		display: "none",
		flexDirection: "column",
		gap: "24px",
		zIndex: "2147483647",
		cursor: "default",
		boxSizing: "border-box",
	});

	const bgInner = document.createElement("div");
	Object.assign(bgInner.style, {
		display: "flex",
		flexDirection: "column",
		gap: "16px",
		width: "236px",
		alignItems: "flex-start",
	});

	const bgTopRow = document.createElement("div");
	Object.assign(bgTopRow.style, {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		width: "100%",
	});
	const bgTitle = document.createElement("span");
	bgTitle.textContent = "Color";
	Object.assign(bgTitle.style, {
		color: "#c4c4c4",
		fontSize: "12px",
		fontWeight: "500",
		lineHeight: "1.4",
	});
	const bgCloseBtn = document.createElement("button");
	bgCloseBtn.type = "button";
	bgCloseBtn.setAttribute("aria-label", "Close color picker");
	bgCloseBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
	Object.assign(bgCloseBtn.style, {
		width: "20px",
		height: "20px",
		border: "0",
		background: "transparent",
		color: "#c4c4c4",
		cursor: "pointer",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		padding: "0",
		flexShrink: "0",
	});
	bgTopRow.append(bgTitle, bgCloseBtn);

	const bgPicker = document.createElement("hex-color-picker") as HexColorPickerElement;
	bgPicker.color = "#FFFFFF";
	Object.assign(bgPicker.style, {
		width: "236px",
		height: "200px",
	});

	bgInner.append(bgTopRow, bgPicker);

	const bgBottomRow = document.createElement("div");
	Object.assign(bgBottomRow.style, {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		width: "236px",
	});
	const bgFormatControl = document.createElement("div");
	Object.assign(bgFormatControl.style, {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		background: "#414243",
		borderRadius: "8px",
		width: "100px",
		padding: "6px 12px",
		flexShrink: "0",
		boxSizing: "border-box",
		cursor: "pointer",
	});
	const bgFormatLabel = document.createElement("span");
	bgFormatLabel.textContent = "HEX";
	Object.assign(bgFormatLabel.style, {
		color: "#acadae",
		fontSize: "14px",
		fontWeight: "500",
		lineHeight: "1.4",
	});
	const bgFormatChevron = document.createElement("span");
	bgFormatChevron.innerHTML = chevronDownIconSm;
	Object.assign(bgFormatChevron.style, {
		display: "inline-flex",
		color: "#acadae",
	});
	bgFormatControl.append(bgFormatLabel, bgFormatChevron);

	const bgHexControl = document.createElement("div");
	Object.assign(bgHexControl.style, {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		background: "#414243",
		borderRadius: "8px",
		flex: "1 1 auto",
		padding: "6px 12px",
		minWidth: "0",
		boxSizing: "border-box",
		gap: "8px",
	});
	const bgHexInput = document.createElement("input");
	bgHexInput.type = "text";
	bgHexInput.value = "FFFFFF";
	bgHexInput.maxLength = 6;
	Object.assign(bgHexInput.style, {
		flex: "1 1 auto",
		minWidth: "0",
		background: "transparent",
		border: "0",
		outline: "none",
		color: "#acadae",
		fontFamily: "inherit",
		fontSize: "14px",
		fontWeight: "500",
		lineHeight: "1.4",
		padding: "0",
		textTransform: "uppercase",
	});
	const bgAlphaLabel = document.createElement("span");
	bgAlphaLabel.textContent = "100%";
	Object.assign(bgAlphaLabel.style, {
		color: "#acadae",
		fontSize: "14px",
		fontWeight: "500",
		lineHeight: "1.4",
		flexShrink: "0",
	});
	bgHexControl.append(bgHexInput, bgAlphaLabel);
	bgBottomRow.append(bgFormatControl, bgHexControl);

	bgDropdown.append(bgInner, bgBottomRow);
	bgControl.append(bgSwatch, bgChevron, bgDropdown);

	const containerAlignControl = mkPillControl();
	Object.assign(containerAlignControl.style, {
		position: "relative",
		cursor: "pointer",
	});
	const containerAlignIconEl = document.createElement("span");
	containerAlignIconEl.innerHTML = imgAlignIcon;
	Object.assign(containerAlignIconEl.style, { display: "inline-flex" });
	const containerAlignChevron = document.createElement("span");
	containerAlignChevron.innerHTML = chevronDownIconSm;
	Object.assign(containerAlignChevron.style, { display: "inline-flex" });
	const containerAlignDropdown = mkPopoverShell();

	const cAlignHRow = document.createElement("div");
	Object.assign(cAlignHRow.style, {
		display: "inline-flex",
		alignItems: "center",
		background: "#414243",
		borderRadius: "8px",
	});
	const cAlignHLeftBtn = mkAlignSegBtn(alignHLeftIcon);
	const cAlignHCenterBtn = mkAlignSegBtn(alignHCenterIcon);
	const cAlignHRightBtn = mkAlignSegBtn(alignHRightIcon);
	cAlignHRow.append(cAlignHLeftBtn, cAlignHCenterBtn, cAlignHRightBtn);

	const cAlignVRow = document.createElement("div");
	Object.assign(cAlignVRow.style, {
		display: "inline-flex",
		alignItems: "center",
		background: "#414243",
		borderRadius: "8px",
	});
	const cAlignVTopBtn = mkAlignSegBtn(alignVTopIcon);
	const cAlignVCenterBtn = mkAlignSegBtn(alignVCenterIcon);
	const cAlignVBottomBtn = mkAlignSegBtn(alignVBottomIcon);
	cAlignVRow.append(cAlignVTopBtn, cAlignVCenterBtn, cAlignVBottomBtn);

	containerAlignDropdown.append(cAlignHRow, cAlignVRow);
	containerAlignControl.append(
		containerAlignIconEl,
		containerAlignChevron,
		containerAlignDropdown,
	);

	const containerPaddingControl = mkPillControl();
	Object.assign(containerPaddingControl.style, {
		position: "relative",
		cursor: "pointer",
	});
	const containerPaddingIconEl = document.createElement("span");
	containerPaddingIconEl.innerHTML = paddingIcon;
	Object.assign(containerPaddingIconEl.style, { display: "inline-flex" });
	const containerPaddingChevron = document.createElement("span");
	containerPaddingChevron.innerHTML = chevronDownIconSm;
	Object.assign(containerPaddingChevron.style, { display: "inline-flex" });
	const containerPaddingDropdown = mkPopoverShell();
	const cPaddingX = mkPaddingInputRow(hSpacingIcon);
	const cPaddingY = mkPaddingInputRow(vSpacingIcon);
	containerPaddingDropdown.append(cPaddingX.row, cPaddingY.row);
	containerPaddingControl.append(
		containerPaddingIconEl,
		containerPaddingChevron,
		containerPaddingDropdown,
	);

	containerWrap.append(bgControl, containerAlignControl, containerPaddingControl);

	const postContainerStyle = (property: string, value: string | null) => {
		postToParent({
			type: "design-mode:container-style-changed",
			property,
			value,
		});
	};
	const postContainerStyles = (styles: Record<string, string | null>) => {
		postToParent({
			type: "design-mode:container-style-changed",
			styles,
		});
	};

	const JUSTIFY_FROM_H: Record<AlignH, string> = {
		left: "flex-start",
		center: "center",
		right: "flex-end",
	};
	const ALIGN_FROM_V: Record<AlignV, string> = {
		top: "flex-start",
		center: "center",
		bottom: "flex-end",
	};

	const setContainerAlignH = (value: AlignH) => {
		currentContainerAlignHRef = value;
		updateContainerAlignButtons();
		postContainerStyle("justifyContent", JUSTIFY_FROM_H[value]);
	};
	const setContainerAlignV = (value: AlignV) => {
		currentContainerAlignVRef = value;
		updateContainerAlignButtons();
		postContainerStyle("alignItems", ALIGN_FROM_V[value]);
	};
	cAlignHLeftBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setContainerAlignH("left");
	});
	cAlignHCenterBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setContainerAlignH("center");
	});
	cAlignHRightBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setContainerAlignH("right");
	});
	cAlignVTopBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setContainerAlignV("top");
	});
	cAlignVCenterBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setContainerAlignV("center");
	});
	cAlignVBottomBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setContainerAlignV("bottom");
	});

	const submitContainerPaddingX = () => {
		const n = Number(cPaddingX.input.value);
		if (!Number.isFinite(n) || n < 0) return;
		currentContainerPaddingXRef = n;
		const value = `${n}px`;
		postContainerStyles({ paddingLeft: value, paddingRight: value });
	};
	const submitContainerPaddingY = () => {
		const n = Number(cPaddingY.input.value);
		if (!Number.isFinite(n) || n < 0) return;
		currentContainerPaddingYRef = n;
		const value = `${n}px`;
		postContainerStyles({ paddingTop: value, paddingBottom: value });
	};
	cPaddingX.input.addEventListener("change", submitContainerPaddingX);
	cPaddingX.input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submitContainerPaddingX();
		}
	});
	cPaddingX.input.addEventListener("click", (e) => e.stopPropagation());
	cPaddingY.input.addEventListener("change", submitContainerPaddingY);
	cPaddingY.input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submitContainerPaddingY();
		}
	});
	cPaddingY.input.addEventListener("click", (e) => e.stopPropagation());

	containerAlignControl.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleContainerAlignDropdown();
	});
	containerPaddingControl.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleContainerPaddingDropdown();
	});
	bgControl.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleBgDropdown();
	});
	bgDropdown.addEventListener("click", (e) => e.stopPropagation());
	bgDropdown.addEventListener("mousedown", (e) => e.stopPropagation());

	bgCloseBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		closeBgDropdown();
	});

	let bgCommitTimer: number | null = null;
	let lastBgHex = "#FFFFFF";
	const scheduleBgCommit = (hex: string) => {
		lastBgHex = hex;
		if (bgCommitTimer != null) window.clearTimeout(bgCommitTimer);
		bgCommitTimer = window.setTimeout(() => {
			bgCommitTimer = null;
			postContainerStyle("backgroundColor", hex);
		}, 150);
	};
	bgPicker.addEventListener("color-changed", (event: Event) => {
		const detail = (event as CustomEvent<{ value: string }>).detail;
		const hex = (detail?.value ?? "#FFFFFF").toUpperCase();
		bgSwatch.style.background = hex;
		bgHexInput.value = hex.replace(/^#/, "");
		window.postMessage(
			{
				type: "design-mode:apply-inline-style",
				styles: { backgroundColor: hex },
			},
			"*",
		);
		scheduleBgCommit(hex);
	});
	bgPicker.addEventListener("click", (e) => e.stopPropagation());
	bgPicker.addEventListener("mousedown", (e) => e.stopPropagation());
	bgPicker.addEventListener("pointerdown", (e) => e.stopPropagation());

	bgHexInput.addEventListener("click", (e) => e.stopPropagation());
	bgHexInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			(e.currentTarget as HTMLInputElement).blur();
		}
	});
	bgHexInput.addEventListener("change", () => {
		const raw = bgHexInput.value.trim().replace(/^#/, "");
		if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
			bgHexInput.value = lastBgHex.replace(/^#/, "").toUpperCase();
			return;
		}
		const hex = `#${raw.toUpperCase()}`;
		bgPicker.color = hex;
		bgSwatch.style.background = hex;
		lastBgHex = hex;
		postContainerStyle("backgroundColor", hex);
	});

	containerWrap.dataset.containerControls = "1";
	containerControlsEl = containerWrap;
	containerFieldsRef = {
		bgSwatch,
		bgControl,
		bgDropdown,
		bgFormatLabel,
		bgHexInput,
		bgAlphaLabel,
		bgPicker,
		alignControl: containerAlignControl,
		alignDropdown: containerAlignDropdown,
		alignHButtons: {
			left: cAlignHLeftBtn,
			center: cAlignHCenterBtn,
			right: cAlignHRightBtn,
		},
		alignVButtons: {
			top: cAlignVTopBtn,
			center: cAlignVCenterBtn,
			bottom: cAlignVBottomBtn,
		},
		paddingControl: containerPaddingControl,
		paddingDropdown: containerPaddingDropdown,
		paddingXInput: cPaddingX.input,
		paddingYInput: cPaddingY.input,
	};
	updateContainerAlignButtons();

	const inputWrap = document.createElement("div");
	Object.assign(inputWrap.style, {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		width: "258px",
		flexShrink: "0",
	});
	const inputIcon = document.createElement("span");
	inputIcon.innerHTML = wandIconSm;
	Object.assign(inputIcon.style, {
		color: "#6a6a6c",
		display: "inline-flex",
		flexShrink: "0",
	});
	const input = document.createElement("input");
	input.type = "text";
	input.placeholder = "e.g., \u201CChange the text copy to\u2026\u201D";
	Object.assign(input.style, {
		flex: "1 1 auto",
		minWidth: "0",
		background: "transparent",
		border: "0",
		outline: "none",
		color: "#FFFFFF",
		fontFamily: "inherit",
		fontSize: "14px",
		fontWeight: "400",
		lineHeight: "1",
		padding: "0",
	});
	inputWrap.append(inputIcon, input);

	const mkActionButton = (action: string, icon: string) => {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.dataset.action = action;
		btn.innerHTML = icon;
		Object.assign(btn.style, {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: "32px",
			height: "32px",
			border: "0",
			borderRadius: "100px",
			background: "#2c2d2f",
			color: "#dbdbdb",
			cursor: "pointer",
			padding: "0",
			flexShrink: "0",
		});
		return btn;
	};

	const submitBtn = mkActionButton("submit", sendIcon);
	const deleteBtn = mkActionButton("delete", trashIcon);

	const multiInfo = document.createElement("div");
	Object.assign(multiInfo.style, {
		display: "none",
		alignItems: "center",
		padding: "0 4px",
		height: "28px",
		color: "#FFFFFF",
		fontFamily: "inherit",
		fontSize: "12px",
		fontWeight: "400",
		lineHeight: "1.4",
		whiteSpace: "nowrap",
		flexShrink: "0",
	});

	const multiDivider = mkDivider();
	multiDivider.style.display = "none";

	const alignLeftIconSm = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M3 4v16M7 8h12M7 16h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
		</svg>
	`;
	const alignHCenterIconSm = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M12 4v16M6 8h12M9 16h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
		</svg>
	`;
	const alignRightIconSm = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M21 4v16M5 8h12M10 16h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
		</svg>
	`;
	const alignTopIconSm = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M4 3h16M8 7v12M16 7v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
		</svg>
	`;
	const alignVCenterIconSm = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M4 12h16M8 6v12M16 9v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
		</svg>
	`;
	const alignBottomIconSm = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M4 21h16M8 5v12M16 10v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
		</svg>
	`;
	const paddingHIconSm = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M4 4v16M20 4v16M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	`;
	const paddingVIconSm = `
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M4 4h16M4 20h16M12 4v16M9 7l3-3 3 3M9 17l3 3 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	`;

	const mkMultiPill = (icon: string) => {
		const pill = document.createElement("button");
		pill.type = "button";
		pill.dataset.open = "false";
		Object.assign(pill.style, {
			display: "none",
			alignItems: "center",
			justifyContent: "center",
			gap: "4px",
			height: "28px",
			padding: "4px 12px",
			border: "0",
			borderRadius: "8px",
			background: "#414243",
			color: "#FFFFFF",
			cursor: "pointer",
			flexShrink: "0",
			fontFamily: "inherit",
		});
		pill.innerHTML = `${icon}${chevronDownIconSm}`;
		return pill;
	};

	const alignPill = mkMultiPill(alignLeftIconSm);
	alignPill.setAttribute("aria-label", "Alignment");
	const paddingPill = mkMultiPill(paddingHIconSm);
	paddingPill.setAttribute("aria-label", "Padding");

	const multiAlignDropdown = document.createElement("div");
	multiAlignDropdown.id = "__design-mode-multi-align-dropdown";
	Object.assign(multiAlignDropdown.style, {
		position: "absolute",
		display: "none",
		flexDirection: "column",
		gap: "8px",
		padding: "8px",
		background: "#2c2d2f",
		border: "1px solid #dbdbdb",
		borderRadius: "8px",
		boxShadow: "0 4px 5px rgba(0,0,0,0.15)",
		zIndex: "2147483647",
		pointerEvents: "auto",
		fontFamily: "inherit",
	});

	const mkAlignRow = () => {
		const row = document.createElement("div");
		Object.assign(row.style, {
			display: "flex",
			alignItems: "center",
			background: "#414243",
			borderRadius: "8px",
		});
		return row;
	};

	const mkAlignOption = (
		icon: string,
		property: string,
		value: string,
		ariaLabel: string,
	) => {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.dataset.alignProperty = property;
		btn.dataset.alignValue = value;
		btn.setAttribute("aria-label", ariaLabel);
		btn.innerHTML = icon;
		Object.assign(btn.style, {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: "42px",
			height: "30px",
			padding: "6px 12px",
			border: "0",
			borderRadius: "8px",
			background: "transparent",
			color: "#FFFFFF",
			cursor: "pointer",
		});
		return btn;
	};

	const horizontalRow = mkAlignRow();
	horizontalRow.append(
		mkAlignOption(alignLeftIconSm, "textAlign", "left", "Align left"),
		mkAlignOption(alignHCenterIconSm, "textAlign", "center", "Align center"),
		mkAlignOption(alignRightIconSm, "textAlign", "right", "Align right"),
	);
	const verticalRow = mkAlignRow();
	verticalRow.append(
		mkAlignOption(alignTopIconSm, "alignItems", "flex-start", "Align top"),
		mkAlignOption(alignVCenterIconSm, "alignItems", "center", "Align middle"),
		mkAlignOption(alignBottomIconSm, "alignItems", "flex-end", "Align bottom"),
	);
	multiAlignDropdown.append(horizontalRow, verticalRow);
	document.body.appendChild(multiAlignDropdown);

	const multiPaddingDropdown = document.createElement("div");
	multiPaddingDropdown.id = "__design-mode-multi-padding-dropdown";
	Object.assign(multiPaddingDropdown.style, {
		position: "absolute",
		display: "none",
		flexDirection: "column",
		gap: "8px",
		padding: "8px",
		background: "#2c2d2f",
		border: "1px solid #dbdbdb",
		borderRadius: "8px",
		boxShadow: "0 4px 5px rgba(0,0,0,0.15)",
		zIndex: "2147483647",
		pointerEvents: "auto",
		fontFamily: "inherit",
	});

	const mkPaddingRow = (icon: string, axis: "horizontal" | "vertical") => {
		const row = document.createElement("div");
		Object.assign(row.style, {
			display: "flex",
			alignItems: "center",
			gap: "4px",
			height: "30px",
			padding: "0 12px",
			background: "#414243",
			borderRadius: "8px",
			color: "#FFFFFF",
		});
		const iconSpan = document.createElement("span");
		iconSpan.innerHTML = icon;
		Object.assign(iconSpan.style, { display: "inline-flex", flexShrink: "0" });
		const inp = document.createElement("input");
		inp.type = "number";
		inp.min = "0";
		inp.value = "0";
		inp.dataset.paddingAxis = axis;
		Object.assign(inp.style, {
			width: "60px",
			background: "transparent",
			border: "0",
			outline: "none",
			color: "#FFFFFF",
			fontFamily: "inherit",
			fontSize: "14px",
			fontWeight: "500",
			lineHeight: "1",
			padding: "0",
			appearance: "textfield",
		});
		row.append(iconSpan, inp);
		return { row, input: inp };
	};

	const { row: paddingHRow, input: paddingHInput } = mkPaddingRow(
		paddingHIconSm,
		"horizontal",
	);
	const { row: paddingVRow, input: paddingVInput } = mkPaddingRow(
		paddingVIconSm,
		"vertical",
	);
	multiPaddingDropdown.append(paddingHRow, paddingVRow);
	document.body.appendChild(multiPaddingDropdown);

	multiAlignDropdownEl = multiAlignDropdown;
	multiPaddingDropdownEl = multiPaddingDropdown;

	const positionDropdownBelow = (
		pill: HTMLElement,
		dropdown: HTMLElement,
	) => {
		const r = pill.getBoundingClientRect();
		dropdown.style.top = `${r.bottom + window.scrollY + 6}px`;
		dropdown.style.left = `${r.left + window.scrollX}px`;
	};

	alignPill.addEventListener("click", (e) => {
		e.stopPropagation();
		const wasOpen = alignPill.dataset.open === "true";
		closeMultiSelectDropdowns();
		if (!wasOpen) {
			positionDropdownBelow(alignPill, multiAlignDropdown);
			multiAlignDropdown.style.display = "flex";
			alignPill.dataset.open = "true";
		}
	});

	paddingPill.addEventListener("click", (e) => {
		e.stopPropagation();
		const wasOpen = paddingPill.dataset.open === "true";
		closeMultiSelectDropdowns();
		if (!wasOpen) {
			positionDropdownBelow(paddingPill, multiPaddingDropdown);
			multiPaddingDropdown.style.display = "flex";
			paddingPill.dataset.open = "true";
		}
	});

	multiAlignDropdown.addEventListener("click", (e) => {
		e.stopPropagation();
		const target = e.target as HTMLElement | null;
		const btn = target?.closest<HTMLButtonElement>(
			"button[data-align-property]",
		);
		if (!btn) return;
		const property = btn.dataset.alignProperty;
		const value = btn.dataset.alignValue;
		if (!property || !value) return;
		postToParent({
			type: "design-mode:multi-style-change",
			changes: { [property]: value },
		});
		closeMultiSelectDropdowns();
	});

	const commitPadding = (axis: "horizontal" | "vertical", raw: string) => {
		const n = Number(raw);
		if (!Number.isFinite(n) || n < 0) return;
		const px = `${n}px`;
		const changes =
			axis === "horizontal"
				? { paddingLeft: px, paddingRight: px }
				: { paddingTop: px, paddingBottom: px };
		postToParent({
			type: "design-mode:multi-style-change",
			changes,
		});
	};

	const wirePaddingInput = (
		input: HTMLInputElement,
		axis: "horizontal" | "vertical",
	) => {
		input.addEventListener("keydown", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			commitPadding(axis, input.value);
		});
		input.addEventListener("change", () => {
			commitPadding(axis, input.value);
		});
		input.addEventListener("click", (e) => e.stopPropagation());
		input.addEventListener("mousedown", (e) => e.stopPropagation());
	};
	wirePaddingInput(paddingHInput, "horizontal");
	wirePaddingInput(paddingVInput, "vertical");

	toolbar.append(
		segmented,
		mkDivider(),
		multiInfo,
		multiDivider,
		inputWrap,
		alignPill,
		paddingPill,
		typographyWrap,
		imageWrap,
		containerWrap,
		submitBtn,
		mkDivider(),
		deleteBtn,
	);
	inputWrapEl = inputWrap;
	submitBtnEl = submitBtn;
	multiSelectInfoEl = multiInfo;
	multiSelectDividerEl = multiDivider;
	multiAlignPillEl = alignPill;
	multiPaddingPillEl = paddingPill;

	const setMode = (mode: ToolbarMode) => {
		for (const b of [wandBtn, paletteBtn]) {
			const isSelected = b.dataset.mode === mode;
			b.setAttribute("aria-pressed", String(isSelected));
			b.style.background = isSelected ? "#ffffff" : "transparent";
			b.style.color = isSelected ? "#18191B" : "#dbdbdb";
			b.style.border = isSelected
				? "1px solid #dbdbdb"
				: "1px solid transparent";
		}
		currentToolbarModeRef = mode;
		applyToolbarLayout();
		postToParent({ type: "design-mode:toolbar-mode-changed", mode });
	};
	wandBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setMode("wand");
	});
	paletteBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		setMode("palette");
	});

	const submitPrompt = () => {
		const value = input.value.trim();
		if (!value) return;
		postToParent({ type: "design-mode:prompt-submitted", prompt: value });
		input.value = "";
	};
	submitBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		submitPrompt();
	});
	input.addEventListener("keydown", (e) => {
		if (e.key !== "Enter") return;
		e.preventDefault();
		submitPrompt();
	});
	input.addEventListener("click", (e) => e.stopPropagation());
	input.addEventListener("mousedown", (e) => e.stopPropagation());

	deleteBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		postToParent({ type: "design-mode:delete-requested" });
	});

	document.body.appendChild(toolbar);
	toolbarEl = toolbar;
	return toolbar;
}

function applyToolbarLayout() {
	if (
		!inputWrapEl ||
		!submitBtnEl ||
		!typographyControlsEl ||
		!imageControlsEl ||
		!containerControlsEl
	)
		return;

	const inMulti =
		currentMultiSelectCount != null && currentMultiSelectCount > 0;
	const isPalette = currentToolbarModeRef === "palette";
	const showTypography =
		!inMulti && isPalette && currentSelectionIsTypography;
	const showImage = !inMulti && isPalette && currentSelectionIsImage;
	const showContainer =
		!inMulti &&
		isPalette &&
		currentSelectionIsContainer &&
		!showTypography &&
		!showImage;
	const showMultiPills = inMulti && isPalette;
	const showInput = inMulti
		? currentToolbarModeRef === "wand"
		: !showTypography && !showImage && !showContainer;

	inputWrapEl.style.display = showInput ? "flex" : "none";
	submitBtnEl.style.display = showInput ? "inline-flex" : "none";
	typographyControlsEl.style.display = showTypography ? "inline-flex" : "none";
	imageControlsEl.style.display = showImage ? "inline-flex" : "none";
	containerControlsEl.style.display = showContainer ? "inline-flex" : "none";

	if (multiSelectInfoEl) {
		if (inMulti) {
			const n = currentMultiSelectCount as number;
			multiSelectInfoEl.textContent = `${n} object${n === 1 ? "" : "s"} selected`;
			multiSelectInfoEl.style.display = "inline-flex";
		} else {
			multiSelectInfoEl.style.display = "none";
		}
	}
	if (multiSelectDividerEl) {
		multiSelectDividerEl.style.display = inMulti ? "block" : "none";
	}
	if (multiAlignPillEl) {
		multiAlignPillEl.style.display = showMultiPills ? "inline-flex" : "none";
	}
	if (multiPaddingPillEl) {
		multiPaddingPillEl.style.display = showMultiPills ? "inline-flex" : "none";
	}
	if (!showMultiPills) {
		closeMultiSelectDropdowns();
	}
}

export function setMultiSelectMode(count: number | null) {
	ensureToolbar();
	currentMultiSelectCount = count;
	applyToolbarLayout();
}

function updateTextAlignButtons() {
	if (!typographyFieldsRef) return;
	const apply = (btn: HTMLButtonElement, active: boolean) => {
		btn.style.background = active ? "#FFFFFF" : "transparent";
		btn.style.color = active ? "#18191B" : "#dbdbdb";
	};
	apply(
		typographyFieldsRef.textAlignHButtons.left,
		currentTextAlignHRef === "left",
	);
	apply(
		typographyFieldsRef.textAlignHButtons.center,
		currentTextAlignHRef === "center",
	);
	apply(
		typographyFieldsRef.textAlignHButtons.right,
		currentTextAlignHRef === "right",
	);
}

function openTextColorDropdown() {
	if (!typographyFieldsRef || textColorDropdownOpen) return;
	closeTextAlignDropdown();
	closeTextPaddingDropdown();
	typographyFieldsRef.colorDropdown.style.display = "flex";
	textColorDropdownOpen = true;
	const handler = (e: MouseEvent) => {
		if (!typographyFieldsRef) return;
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (
			typographyFieldsRef.colorControl.contains(target) ||
			typographyFieldsRef.colorDropdown.contains(target)
		)
			return;
		closeTextColorDropdown();
	};
	textColorDropdownDocListener = handler;
	document.addEventListener("click", handler, true);
}
function closeTextColorDropdown() {
	if (!typographyFieldsRef || !textColorDropdownOpen) return;
	typographyFieldsRef.colorDropdown.style.display = "none";
	textColorDropdownOpen = false;
	if (textColorDropdownDocListener) {
		document.removeEventListener("click", textColorDropdownDocListener, true);
		textColorDropdownDocListener = null;
	}
}
function toggleTextColorDropdown() {
	if (textColorDropdownOpen) closeTextColorDropdown();
	else openTextColorDropdown();
}

function openTextAlignDropdown() {
	if (!typographyFieldsRef || textAlignDropdownOpen) return;
	closeTextColorDropdown();
	closeTextPaddingDropdown();
	typographyFieldsRef.textAlignDropdown.style.display = "flex";
	textAlignDropdownOpen = true;
	const handler = (e: MouseEvent) => {
		if (!typographyFieldsRef) return;
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (
			typographyFieldsRef.textAlignControl.contains(target) ||
			typographyFieldsRef.textAlignDropdown.contains(target)
		)
			return;
		closeTextAlignDropdown();
	};
	textAlignDropdownDocListener = handler;
	document.addEventListener("click", handler, true);
}
function closeTextAlignDropdown() {
	if (!typographyFieldsRef || !textAlignDropdownOpen) return;
	typographyFieldsRef.textAlignDropdown.style.display = "none";
	textAlignDropdownOpen = false;
	if (textAlignDropdownDocListener) {
		document.removeEventListener("click", textAlignDropdownDocListener, true);
		textAlignDropdownDocListener = null;
	}
}
function toggleTextAlignDropdown() {
	if (textAlignDropdownOpen) closeTextAlignDropdown();
	else openTextAlignDropdown();
}

function openTextPaddingDropdown() {
	if (!typographyFieldsRef || textPaddingDropdownOpen) return;
	closeTextColorDropdown();
	closeTextAlignDropdown();
	typographyFieldsRef.textPaddingDropdown.style.display = "flex";
	textPaddingDropdownOpen = true;
	const handler = (e: MouseEvent) => {
		if (!typographyFieldsRef) return;
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (
			typographyFieldsRef.textPaddingControl.contains(target) ||
			typographyFieldsRef.textPaddingDropdown.contains(target)
		)
			return;
		closeTextPaddingDropdown();
	};
	textPaddingDropdownDocListener = handler;
	document.addEventListener("click", handler, true);
}
function closeTextPaddingDropdown() {
	if (!typographyFieldsRef || !textPaddingDropdownOpen) return;
	typographyFieldsRef.textPaddingDropdown.style.display = "none";
	textPaddingDropdownOpen = false;
	if (textPaddingDropdownDocListener) {
		document.removeEventListener(
			"click",
			textPaddingDropdownDocListener,
			true,
		);
		textPaddingDropdownDocListener = null;
	}
}
function toggleTextPaddingDropdown() {
	if (textPaddingDropdownOpen) closeTextPaddingDropdown();
	else openTextPaddingDropdown();
}

function parseTextAlignH(raw: string | null): AlignH {
	if (raw === "center" || raw === "right" || raw === "left") return raw;
	return "left";
}

export function setTypographyMode(
	enabled: boolean,
	currentValues: {
		fontFamily: string | null;
		fontSize: string | null;
		textColor: string | null;
		textAlign: string | null;
		paddingTop: string | null;
		paddingRight: string | null;
		paddingBottom: string | null;
		paddingLeft: string | null;
	} | null,
) {
	ensureToolbar();
	currentSelectionIsTypography = enabled;
	if (enabled && typographyFieldsRef && currentValues) {
		const family = (currentValues.fontFamily ?? "Inter").replace(/['"]/g, "");
		typographyFieldsRef.fontFamilyLabel.textContent = family;
		typographyFieldsRef.fontFamilySelect.value = family;
		const sizePx = (currentValues.fontSize ?? "").match(/(\d+(\.\d+)?)px/);
		if (sizePx?.[1]) typographyFieldsRef.fontSizeInput.value = sizePx[1];
		const color = currentValues.textColor;
		if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
			typographyFieldsRef.colorPicker.color = color;
			typographyFieldsRef.colorSwatch.style.background = color;
			typographyFieldsRef.colorHexInput.value = color
				.replace(/^#/, "")
				.toUpperCase();
		}
		currentTextAlignHRef = parseTextAlignH(currentValues.textAlign);
		updateTextAlignButtons();
		const px = pxToNumber(currentValues.paddingLeft);
		const py = pxToNumber(currentValues.paddingTop);
		currentTextPaddingXRef = px;
		currentTextPaddingYRef = py;
		typographyFieldsRef.textPaddingXInput.value = String(px);
		typographyFieldsRef.textPaddingYInput.value = String(py);
	} else {
		closeTextColorDropdown();
		closeTextAlignDropdown();
		closeTextPaddingDropdown();
	}
	applyToolbarLayout();
}

const checkIconSm = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

function rebuildSourceOptions() {
	if (!imageFieldsRef) return;
	const dropdown = imageFieldsRef.sourceDropdown;
	while (dropdown.firstChild) dropdown.removeChild(dropdown.firstChild);

	if (!imageAssetsRef.length) {
		const empty = document.createElement("div");
		empty.textContent = "No assets uploaded";
		Object.assign(empty.style, {
			color: "#6a6a6c",
			fontSize: "13px",
			padding: "8px",
		});
		dropdown.appendChild(empty);
		return;
	}

	for (const asset of imageAssetsRef) {
		const isCurrent = asset.url === currentImageSrcRef;
		const row = document.createElement("div");
		row.dataset.assetUrl = asset.url;
		Object.assign(row.style, {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			padding: "6px 12px",
			borderRadius: "8px",
			cursor: "pointer",
			background: isCurrent ? "#414243" : "transparent",
			gap: "8px",
		});

		const left = document.createElement("div");
		Object.assign(left.style, {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			minWidth: "0",
			flex: "1 1 auto",
		});

		const thumb = document.createElement("span");
		Object.assign(thumb.style, {
			width: "36px",
			height: "36px",
			flexShrink: "0",
			borderRadius: "8px",
			backgroundImage: `url("${asset.url.replace(/"/g, "%22")}")`,
			backgroundSize: "cover",
			backgroundPosition: "center",
			backgroundColor: "#414243",
			display: "inline-block",
		});

		const label = document.createElement("span");
		label.textContent = asset.name;
		Object.assign(label.style, {
			color: "#c4c4c4",
			fontSize: "14px",
			fontWeight: "500",
			lineHeight: "1.4",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis",
			minWidth: "0",
		});

		left.append(thumb, label);
		row.appendChild(left);

		if (isCurrent) {
			const check = document.createElement("span");
			check.innerHTML = checkIconSm;
			Object.assign(check.style, {
				display: "inline-flex",
				flexShrink: "0",
				color: "#FFFFFF",
			});
			row.appendChild(check);
		}

		row.addEventListener("mouseenter", () => {
			if (asset.url !== currentImageSrcRef)
				row.style.background = "rgba(255,255,255,0.06)";
		});
		row.addEventListener("mouseleave", () => {
			if (asset.url !== currentImageSrcRef) row.style.background = "transparent";
		});
		row.addEventListener("click", (e) => {
			e.stopPropagation();
			postToParent({
				type: "design-mode:image-asset-selected",
				src: asset.url,
			});
			closeSourceDropdown();
		});

		dropdown.appendChild(row);
	}
}

function openSourceDropdown() {
	if (!imageFieldsRef || sourceDropdownOpen) return;
	imageFieldsRef.sourceDropdown.style.display = "flex";
	sourceDropdownOpen = true;
	rebuildSourceOptions();
	const handler = (e: MouseEvent) => {
		if (!imageFieldsRef) return;
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (
			imageFieldsRef.sourceControl.contains(target) ||
			imageFieldsRef.sourceDropdown.contains(target)
		)
			return;
		closeSourceDropdown();
	};
	sourceDropdownDocListener = handler;
	document.addEventListener("click", handler, true);
}

function closeSourceDropdown() {
	if (!imageFieldsRef || !sourceDropdownOpen) return;
	imageFieldsRef.sourceDropdown.style.display = "none";
	sourceDropdownOpen = false;
	if (sourceDropdownDocListener) {
		document.removeEventListener("click", sourceDropdownDocListener, true);
		sourceDropdownDocListener = null;
	}
}

function toggleSourceDropdown() {
	if (sourceDropdownOpen) closeSourceDropdown();
	else openSourceDropdown();
}

function updateAlignButtons() {
	if (!imageFieldsRef) return;
	const apply = (
		btn: HTMLButtonElement,
		active: boolean,
	) => {
		btn.style.background = active ? "#FFFFFF" : "transparent";
		btn.style.color = active ? "#18191B" : "#dbdbdb";
	};
	apply(
		imageFieldsRef.alignHButtons.left,
		currentAlignHRef === "left",
	);
	apply(
		imageFieldsRef.alignHButtons.center,
		currentAlignHRef === "center",
	);
	apply(
		imageFieldsRef.alignHButtons.right,
		currentAlignHRef === "right",
	);
	apply(imageFieldsRef.alignVButtons.top, currentAlignVRef === "top");
	apply(
		imageFieldsRef.alignVButtons.center,
		currentAlignVRef === "center",
	);
	apply(
		imageFieldsRef.alignVButtons.bottom,
		currentAlignVRef === "bottom",
	);
}

function openAlignDropdown() {
	if (!imageFieldsRef || alignDropdownOpen) return;
	closeSourceDropdown();
	closePaddingDropdown();
	imageFieldsRef.alignDropdown.style.display = "flex";
	alignDropdownOpen = true;
	const handler = (e: MouseEvent) => {
		if (!imageFieldsRef) return;
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (
			imageFieldsRef.alignControl.contains(target) ||
			imageFieldsRef.alignDropdown.contains(target)
		)
			return;
		closeAlignDropdown();
	};
	alignDropdownDocListener = handler;
	document.addEventListener("click", handler, true);
}

function closeAlignDropdown() {
	if (!imageFieldsRef || !alignDropdownOpen) return;
	imageFieldsRef.alignDropdown.style.display = "none";
	alignDropdownOpen = false;
	if (alignDropdownDocListener) {
		document.removeEventListener("click", alignDropdownDocListener, true);
		alignDropdownDocListener = null;
	}
}

function toggleAlignDropdown() {
	if (alignDropdownOpen) closeAlignDropdown();
	else openAlignDropdown();
}

function openPaddingDropdown() {
	if (!imageFieldsRef || paddingDropdownOpen) return;
	closeSourceDropdown();
	closeAlignDropdown();
	imageFieldsRef.paddingDropdown.style.display = "flex";
	paddingDropdownOpen = true;
	const handler = (e: MouseEvent) => {
		if (!imageFieldsRef) return;
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (
			imageFieldsRef.paddingControl.contains(target) ||
			imageFieldsRef.paddingDropdown.contains(target)
		)
			return;
		closePaddingDropdown();
	};
	paddingDropdownDocListener = handler;
	document.addEventListener("click", handler, true);
}

function closePaddingDropdown() {
	if (!imageFieldsRef || !paddingDropdownOpen) return;
	imageFieldsRef.paddingDropdown.style.display = "none";
	paddingDropdownOpen = false;
	if (paddingDropdownDocListener) {
		document.removeEventListener("click", paddingDropdownDocListener, true);
		paddingDropdownDocListener = null;
	}
}

function togglePaddingDropdown() {
	if (paddingDropdownOpen) closePaddingDropdown();
	else openPaddingDropdown();
}

export function setImageAssets(assets: Array<{ url: string; name: string }>) {
	imageAssetsRef = assets;
	if (sourceDropdownOpen) rebuildSourceOptions();
}

function parseObjectPosition(raw: string | null): {
	h: AlignH;
	v: AlignV;
} {
	const parts = (raw ?? "center center").trim().split(/\s+/);
	const first = parts[0] ?? "center";
	const second = parts[1] ?? first;
	const horizontals: AlignH[] = ["left", "center", "right"];
	const verticals: AlignV[] = ["top", "center", "bottom"];
	let h: AlignH = "center";
	let v: AlignV = "center";
	for (const part of [first, second]) {
		if ((horizontals as string[]).includes(part)) h = part as AlignH;
		if ((verticals as string[]).includes(part)) v = part as AlignV;
	}
	return { h, v };
}

function resolveImageFilename(src: string): string {
	const match = imageAssetsRef.find((a) => a.url === src);
	if (match) return match.name;
	const basename = src.split("/").pop()?.split("?")[0] ?? "";
	if (!basename || /^\d+$/.test(basename)) return "image";
	return basename;
}

function pxToNumber(raw: string | null): number {
	if (!raw) return 0;
	const match = raw.match(/(-?\d+(?:\.\d+)?)/);
	if (!match?.[1]) return 0;
	const n = Number(match[1]);
	return Number.isFinite(n) ? n : 0;
}

function updateContainerAlignButtons() {
	if (!containerFieldsRef) return;
	const apply = (btn: HTMLButtonElement, active: boolean) => {
		btn.style.background = active ? "#FFFFFF" : "transparent";
		btn.style.color = active ? "#18191B" : "#dbdbdb";
	};
	apply(
		containerFieldsRef.alignHButtons.left,
		currentContainerAlignHRef === "left",
	);
	apply(
		containerFieldsRef.alignHButtons.center,
		currentContainerAlignHRef === "center",
	);
	apply(
		containerFieldsRef.alignHButtons.right,
		currentContainerAlignHRef === "right",
	);
	apply(
		containerFieldsRef.alignVButtons.top,
		currentContainerAlignVRef === "top",
	);
	apply(
		containerFieldsRef.alignVButtons.center,
		currentContainerAlignVRef === "center",
	);
	apply(
		containerFieldsRef.alignVButtons.bottom,
		currentContainerAlignVRef === "bottom",
	);
}

function openContainerAlignDropdown() {
	if (!containerFieldsRef || containerAlignDropdownOpen) return;
	closeBgDropdown();
	closeContainerPaddingDropdown();
	containerFieldsRef.alignDropdown.style.display = "flex";
	containerAlignDropdownOpen = true;
	const handler = (e: MouseEvent) => {
		if (!containerFieldsRef) return;
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (
			containerFieldsRef.alignControl.contains(target) ||
			containerFieldsRef.alignDropdown.contains(target)
		)
			return;
		closeContainerAlignDropdown();
	};
	containerAlignDropdownDocListener = handler;
	document.addEventListener("click", handler, true);
}

function closeContainerAlignDropdown() {
	if (!containerFieldsRef || !containerAlignDropdownOpen) return;
	containerFieldsRef.alignDropdown.style.display = "none";
	containerAlignDropdownOpen = false;
	if (containerAlignDropdownDocListener) {
		document.removeEventListener(
			"click",
			containerAlignDropdownDocListener,
			true,
		);
		containerAlignDropdownDocListener = null;
	}
}

function toggleContainerAlignDropdown() {
	if (containerAlignDropdownOpen) closeContainerAlignDropdown();
	else openContainerAlignDropdown();
}

function openContainerPaddingDropdown() {
	if (!containerFieldsRef || containerPaddingDropdownOpen) return;
	closeBgDropdown();
	closeContainerAlignDropdown();
	containerFieldsRef.paddingDropdown.style.display = "flex";
	containerPaddingDropdownOpen = true;
	const handler = (e: MouseEvent) => {
		if (!containerFieldsRef) return;
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (
			containerFieldsRef.paddingControl.contains(target) ||
			containerFieldsRef.paddingDropdown.contains(target)
		)
			return;
		closeContainerPaddingDropdown();
	};
	containerPaddingDropdownDocListener = handler;
	document.addEventListener("click", handler, true);
}

function closeContainerPaddingDropdown() {
	if (!containerFieldsRef || !containerPaddingDropdownOpen) return;
	containerFieldsRef.paddingDropdown.style.display = "none";
	containerPaddingDropdownOpen = false;
	if (containerPaddingDropdownDocListener) {
		document.removeEventListener(
			"click",
			containerPaddingDropdownDocListener,
			true,
		);
		containerPaddingDropdownDocListener = null;
	}
}

function toggleContainerPaddingDropdown() {
	if (containerPaddingDropdownOpen) closeContainerPaddingDropdown();
	else openContainerPaddingDropdown();
}

function openBgDropdown() {
	if (!containerFieldsRef || bgDropdownOpen) return;
	closeContainerAlignDropdown();
	closeContainerPaddingDropdown();
	containerFieldsRef.bgDropdown.style.display = "flex";
	bgDropdownOpen = true;
	const handler = (e: MouseEvent) => {
		if (!containerFieldsRef) return;
		const target = e.target;
		if (!(target instanceof Node)) return;
		if (
			containerFieldsRef.bgControl.contains(target) ||
			containerFieldsRef.bgDropdown.contains(target)
		)
			return;
		closeBgDropdown();
	};
	bgDropdownDocListener = handler;
	document.addEventListener("click", handler, true);
}

function closeBgDropdown() {
	if (!containerFieldsRef || !bgDropdownOpen) return;
	containerFieldsRef.bgDropdown.style.display = "none";
	bgDropdownOpen = false;
	if (bgDropdownDocListener) {
		document.removeEventListener("click", bgDropdownDocListener, true);
		bgDropdownDocListener = null;
	}
}

function toggleBgDropdown() {
	if (bgDropdownOpen) closeBgDropdown();
	else openBgDropdown();
}

function applyBgColorState(hex: string) {
	if (!containerFieldsRef) return;
	const normalized = hex.toUpperCase();
	containerFieldsRef.bgSwatch.style.background = normalized;
	containerFieldsRef.bgHexInput.value = normalized.replace(/^#/, "");
	containerFieldsRef.bgPicker.color = normalized;
}

function normalizeColorToHex(raw: string | null): string | null {
	if (!raw) return null;
	const trimmed = raw.trim();
	if (!trimmed || trimmed === "transparent") return null;
	if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
	if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
		const r = trimmed[1] ?? "0";
		const g = trimmed[2] ?? "0";
		const b = trimmed[3] ?? "0";
		return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
	}
	const m = trimmed.match(
		/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i,
	);
	if (m) {
		const r = Math.max(0, Math.min(255, Number(m[1])));
		const g = Math.max(0, Math.min(255, Number(m[2])));
		const b = Math.max(0, Math.min(255, Number(m[3])));
		const to2 = (n: number) => n.toString(16).padStart(2, "0");
		return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
	}
	return null;
}

export function setContainerMode(
	enabled: boolean,
	currentValues: {
		backgroundColor: string | null;
		justifyContent: string | null;
		alignItems: string | null;
		paddingTop: string | null;
		paddingRight: string | null;
		paddingBottom: string | null;
		paddingLeft: string | null;
	} | null,
) {
	ensureToolbar();
	currentSelectionIsContainer = enabled;
	if (enabled && containerFieldsRef && currentValues) {
		const hex = normalizeColorToHex(currentValues.backgroundColor) ?? "#FFFFFF";
		applyBgColorState(hex);

		const justifyMap: Record<string, AlignH> = {
			"flex-start": "left",
			start: "left",
			left: "left",
			center: "center",
			"flex-end": "right",
			end: "right",
			right: "right",
		};
		const alignMap: Record<string, AlignV> = {
			"flex-start": "top",
			start: "top",
			top: "top",
			center: "center",
			"flex-end": "bottom",
			end: "bottom",
			bottom: "bottom",
		};
		currentContainerAlignHRef =
			justifyMap[currentValues.justifyContent ?? ""] ?? "center";
		currentContainerAlignVRef =
			alignMap[currentValues.alignItems ?? ""] ?? "center";
		updateContainerAlignButtons();

		const px = pxToNumber(currentValues.paddingLeft);
		const py = pxToNumber(currentValues.paddingTop);
		currentContainerPaddingXRef = px;
		currentContainerPaddingYRef = py;
		containerFieldsRef.paddingXInput.value = String(px);
		containerFieldsRef.paddingYInput.value = String(py);
	} else {
		closeBgDropdown();
		closeContainerAlignDropdown();
		closeContainerPaddingDropdown();
	}
	applyToolbarLayout();
}

export function setImageMode(
	enabled: boolean,
	currentValues: {
		src: string | null;
		objectFit: string | null;
		objectPosition: string | null;
		paddingTop: string | null;
		paddingRight: string | null;
		paddingBottom: string | null;
		paddingLeft: string | null;
	} | null,
) {
	ensureToolbar();
	currentSelectionIsImage = enabled;
	if (enabled && imageFieldsRef && currentValues) {
		currentImageSrcRef = currentValues.src;
		if (currentValues.src) {
			const filename = resolveImageFilename(currentValues.src);
			if (filename) imageFieldsRef.sourceLabel.textContent = filename;
			imageFieldsRef.sourceThumb.style.backgroundImage = `url("${currentValues.src.replace(/"/g, "%22")}")`;
		}
		const { h, v } = parseObjectPosition(currentValues.objectPosition);
		currentAlignHRef = h;
		currentAlignVRef = v;
		updateAlignButtons();

		const px = pxToNumber(currentValues.paddingLeft);
		const py = pxToNumber(currentValues.paddingTop);
		currentPaddingXRef = px;
		currentPaddingYRef = py;
		imageFieldsRef.paddingXInput.value = String(px);
		imageFieldsRef.paddingYInput.value = String(py);
	} else {
		closeSourceDropdown();
		closeAlignDropdown();
		closePaddingDropdown();
	}
	applyToolbarLayout();
}

export function positionToolbar(rect: DOMRect) {
	const toolbar = ensureToolbar();
	toolbar.style.display = "flex";
	toolbar.style.visibility = "hidden";
	toolbar.style.top = "0px";
	toolbar.style.left = "0px";

	const tRect = toolbar.getBoundingClientRect();
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const sx = window.scrollX;
	const sy = window.scrollY;

	const belowTop = rect.bottom + TOOLBAR_GAP;
	const fitsBelow = belowTop + tRect.height + TOOLBAR_GAP <= vh;
	const aboveTop = rect.top - tRect.height - TOOLBAR_GAP;
	const fitsAbove = aboveTop >= TOOLBAR_GAP;
	let top: number;
	if (fitsBelow) {
		top = belowTop;
	} else if (fitsAbove) {
		top = aboveTop;
	} else {
		// Element doesn't fit either way (e.g. taller than the viewport).
		// Pin the toolbar to the bottom of the visible viewport so the
		// user can still see and use it.
		top = vh - tRect.height - TOOLBAR_GAP;
	}

	const centerX = rect.left + rect.width / 2 - tRect.width / 2;
	const edgeMargin = 8;
	const minLeft = edgeMargin;
	const maxLeft = vw - tRect.width - edgeMargin;
	const clampedX =
		maxLeft < minLeft ? minLeft : Math.max(minLeft, Math.min(centerX, maxLeft));

	toolbar.style.top = `${top + sy}px`;
	toolbar.style.left = `${clampedX + sx}px`;
	toolbar.style.visibility = "visible";
}

export function hideToolbar() {
	if (toolbarEl) {
		toolbarEl.style.display = "none";
		toolbarEl.style.visibility = "visible";
	}
}

function waitForScrollSettle(cb: () => void) {
	let prevY = window.scrollY;
	let stable = 0;
	let frames = 0;
	const tick = () => {
		frames++;
		const curY = window.scrollY;
		if (Math.abs(curY - prevY) < 0.5) {
			stable++;
			if (stable >= 3 || frames >= 120) {
				cb();
				return;
			}
		} else {
			stable = 0;
			prevY = curY;
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

export function scrollAndPositionForSelection(
	element: Element,
	tagName: string,
	className: string,
) {
	const rect = element.getBoundingClientRect();
	const vh = window.innerHeight;
	const reserveBelow = 80;
	const needsScroll = rect.top < 16 || rect.bottom + reserveBelow > vh;

	if (!needsScroll) {
		positionSelectionOverlay(rect, tagName, className);
		positionToolbar(rect);
		return;
	}

	positionSelectionOverlay(rect, tagName, className);
	hideToolbar();

	const targetY = Math.max(0, window.scrollY + rect.top - vh * 0.15);
	window.scrollTo({ top: targetY, behavior: "smooth" });
	waitForScrollSettle(() => {
		const r = element.getBoundingClientRect();
		positionSelectionOverlay(r, tagName, className);
		positionToolbar(r);
	});
}

export function isInsideToolbar(target: EventTarget | null): boolean {
	if (!(target instanceof Node)) return false;
	if (toolbarEl?.contains(target)) return true;
	if (multiAlignDropdownEl?.contains(target)) return true;
	if (multiPaddingDropdownEl?.contains(target)) return true;
	return false;
}

function closeMultiSelectDropdowns() {
	if (multiAlignDropdownEl) multiAlignDropdownEl.style.display = "none";
	if (multiPaddingDropdownEl) multiPaddingDropdownEl.style.display = "none";
	if (multiAlignPillEl) multiAlignPillEl.dataset.open = "false";
	if (multiPaddingPillEl) multiPaddingPillEl.dataset.open = "false";
}

export function hideMultiSelectDropdowns() {
	closeMultiSelectDropdowns();
}

