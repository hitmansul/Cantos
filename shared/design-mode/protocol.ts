/**
 * Design mode message protocol and controller.
 *
 * Platform-specific code provides a `getStyleInfo` function that extracts
 * style data from a resolved element. Everything else (fiber resolution,
 * events, overlay, messages) is shared.
 */

import {
	type ResolvedElement,
	type SourceLocation,
	computeDomIndex,
	findElementBySource,
	getComponentName,
	getDebugSource,
	getFiberFromElement,
	getNormalizedClassName,
	getSourceFromProps,
	normalizeClassName,
	resolveElement,
} from "./fiber";
import {
	clearMultiSelectionLabels,
	clearMultiSelectionRects,
	hideDropIndicator,
	hideInsideDropIndicator,
	hideMultiSelectDropdowns,
	hideOverlay,
	hideSelectionOverlay,
	hideToolbar,
	isContainerElement,
	isImageElement,
	isInsideToolbar,
	isTypographyElement,
	positionDropIndicator,
	positionInsideDropIndicator,
	positionOverlay,
	positionSelectionOverlay,
	positionToolbar,
	removeOverlay,
	renderMultiSelectionLabels,
	renderMultiSelectionRects,
	scrollAndPositionForSelection,
	setContainerMode,
	setImageAssets,
	setImageMode,
	setMultiSelectMode,
	setTypographyMode,
} from "./overlay";

const CONTAINER_TAGS = new Set([
	"div",
	"section",
	"main",
	"article",
	"aside",
	"header",
	"footer",
	"nav",
	"ul",
	"ol",
	"form",
	"fieldset",
	"figure",
]);

type DropPosition = "before" | "after" | "inside-start" | "inside-end";
type DropTarget = { el: Element; position: DropPosition };

interface ReorderHistoryEntry {
	el: Element;
	prevParent: Node;
	prevNextSibling: Node | null;
}

const reorderHistory = new Map<string, ReorderHistoryEntry>();

function makeReorderId() {
	return `reorder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function undoReorderById(reorderId: string) {
	const entry = reorderHistory.get(reorderId);
	if (!entry) return;
	reorderHistory.delete(reorderId);
	const { el, prevParent, prevNextSibling } = entry;
	if (!document.body.contains(prevParent)) return;
	if (prevNextSibling && prevParent.contains(prevNextSibling)) {
		prevParent.insertBefore(el, prevNextSibling);
	} else {
		prevParent.appendChild(el);
	}
}

interface ReorderSelector {
	lineNumber: number;
	columnNumber: number;
	tagName: string;
	className: string | null;
	domIndex: number;
}

function buildReorderSelector(el: Element): ReorderSelector | null {
	const source = getSourceForReorder(el);
	if (!source) return null;
	const className = getNormalizedClassName(el);
	return {
		lineNumber: source.lineNumber,
		columnNumber: source.columnNumber,
		tagName: el.tagName.toLowerCase(),
		className: className.length > 0 ? className : null,
		domIndex: computeReorderDomIndex(el),
	};
}

function getSourceForReorder(el: Element): SourceLocation | null {
	const propsSource = getSourceFromProps(el);
	if (propsSource) return propsSource;
	const fiber = getFiberFromElement(el);
	return fiber ? getDebugSource(fiber) : null;
}

function computeReorderDomIndex(element: Element): number {
	const tag = element.tagName.toLowerCase();
	const className = getNormalizedClassName(element);
	let index = 0;
	const all = document.querySelectorAll(tag);
	for (const el of all) {
		if (el === element) return index;
		if (getNormalizedClassName(el) === className) index += 1;
	}
	return 0;
}

export interface Rect {
	top: number;
	left: number;
	width: number;
	height: number;
}

export interface StyleInfo {
	/** Tailwind className for web, serialized style object for mobile */
	className: string;
	/** Additional platform-specific style data */
	styles: Record<string, string> | null;
}

export type GetStyleInfo = (resolved: ResolvedElement) => StyleInfo;

function toRect(domRect: DOMRect): Rect {
	return {
		top: domRect.top,
		left: domRect.left,
		width: domRect.width,
		height: domRect.height,
	};
}

function getImgSrc(element: Element): string | null {
	if (!(element instanceof HTMLImageElement)) return null;
	return element.currentSrc || element.src || null;
}

function postToParent(message: Record<string, unknown>) {
	window.parent.postMessage(message, "*");
}

let active = false;
let cleanupFn: (() => void) | null = null;
let selectedEl: Element | null = null;
let selectedSource: SourceLocation | null = null;
let storedGetStyleInfo: GetStyleInfo | null = null;
let multiSelectedEls: Element[] = [];

interface MultiEntry {
	element: Element;
	source: SourceLocation;
	componentName: string | null;
	className: string;
	styles: Record<string, string> | null;
	rect: DOMRect;
	domIndex: number;
}

function buildMultiEntry(
	getStyleInfo: GetStyleInfo,
	element: Element,
): MultiEntry | null {
	const resolved = resolveElement(element);
	if (!resolved) return null;
	const rect = resolved.element.getBoundingClientRect();
	const styleInfo = getStyleInfo(resolved);
	return {
		element: resolved.element,
		source: resolved.source,
		componentName: resolved.componentName,
		className: styleInfo.className,
		styles: styleInfo.styles,
		rect,
		domIndex: computeDomIndex(resolved.element, styleInfo.className),
	};
}

function emitMultiSelection(entries: MultiEntry[]) {
	if (entries.length === 0) {
		clearMultiSelectionRects();
		clearMultiSelectionLabels();
		setMultiSelectMode(null);
		hideToolbar();
		postToParent({
			type: "design-mode:multi-elements-selected",
			elements: [],
		});
		return;
	}

	renderMultiSelectionRects(entries.map((entry) => toRect(entry.rect)));

	let bTop = Infinity;
	let bLeft = Infinity;
	let bRight = -Infinity;
	let bBottom = -Infinity;
	for (const entry of entries) {
		if (entry.rect.top < bTop) bTop = entry.rect.top;
		if (entry.rect.left < bLeft) bLeft = entry.rect.left;
		if (entry.rect.right > bRight) bRight = entry.rect.right;
		if (entry.rect.bottom > bBottom) bBottom = entry.rect.bottom;
	}

	renderMultiSelectionLabels(
		entries.map((entry) => ({
			tagName: entry.element.tagName,
			className: entry.className,
			rect: {
				top: entry.rect.top,
				left: entry.rect.left,
				right: entry.rect.right,
				bottom: entry.rect.bottom,
			},
		})),
	);
	setMultiSelectMode(entries.length);
	positionToolbar(new DOMRect(bLeft, bTop, bRight - bLeft, bBottom - bTop));

	postToParent({
		type: "design-mode:multi-elements-selected",
		elements: entries.map((entry) => ({
			source: entry.source,
			tagName: entry.element.tagName.toLowerCase(),
			className: entry.className,
			styles: entry.styles,
			rect: toRect(entry.rect),
			componentName: entry.componentName,
			domIndex: entry.domIndex,
		})),
	});
}

function clearMultiSelection() {
	multiSelectedEls = [];
	clearMultiSelectionRects();
	clearMultiSelectionLabels();
	setMultiSelectMode(null);
}

interface DomTreeNode {
	source: SourceLocation;
	tagName: string;
	id: string | null;
	className: string | null;
	componentName: string | null;
	domIndex: number;
	children: DomTreeNode[];
}

const DESIGN_MODE_ELEMENT_IDS = new Set([
	"__design-mode-toolbar",
	"__design-mode-toolbar-styles",
	"__design-mode-overlay",
	"__design-mode-label",
	"__design-mode-selection-overlay",
	"__design-mode-selection-label",
]);

function isDesignModeElement(el: Element): boolean {
	return el.id != null && DESIGN_MODE_ELEMENT_IDS.has(el.id);
}

/**
 * Walk the DOM and emit a tree of React-rendered nodes only. Non-React
 * wrappers (e.g. raw <body>, third-party-injected nodes) are skipped, but
 * we keep recursing into their children so React-bearing descendants
 * still surface — they're hoisted up to the nearest included ancestor.
 */
function buildDomTree(root: Element): DomTreeNode[] {
	const result: DomTreeNode[] = [];
	for (const child of Array.from(root.children)) {
		if (isDesignModeElement(child)) continue;

		const fiber = getFiberFromElement(child);
		const source =
			getSourceFromProps(child) ?? (fiber ? getDebugSource(fiber) : null);

		const childTrees = buildDomTree(child);

		if (source && fiber) {
			const className = child.getAttribute("class");
			result.push({
				source,
				tagName: child.tagName.toLowerCase(),
				id: child.id || null,
				className: className,
				componentName: getComponentName(fiber),
				domIndex: computeDomIndex(child, className ?? ""),
				children: childTrees,
			});
		} else {
			// Hoist React-bearing descendants up so the parent app still
			// sees them even when their host wrapper has no fiber source.
			result.push(...childTrees);
		}
	}
	return result;
}

let domTreeBroadcastScheduled = false;
function scheduleDomTreeBroadcast() {
	if (!active) return;
	if (domTreeBroadcastScheduled) return;
	domTreeBroadcastScheduled = true;
	// requestAnimationFrame batches with React paint; layered on top of
	// MutationObserver this gives ~16ms debounce for free.
	requestAnimationFrame(() => {
		domTreeBroadcastScheduled = false;
		if (!active) return;
		postToParent({
			type: "design-mode:dom-tree",
			tree: buildDomTree(document.body),
		});
	});
}

function enable(getStyleInfo: GetStyleInfo) {
	if (active) return;
	active = true;

	// Force default cursor globally, overriding any app-level pointer/grab/etc.
	// Also disable native text selection — drag-to-reorder needs the pointer
	// to start drag tracking, not select text.
	const style = document.createElement("style");
	style.textContent = `
		* { cursor: default !important; user-select: none !important; -webkit-user-select: none !important; }
		body.__design-mode-dragging, body.__design-mode-dragging * {
			cursor: grabbing !important;
		}
		#__design-mode-toolbar button[data-action] {
			cursor: pointer !important;
			transition: background 120ms ease, color 120ms ease;
		}
		#__design-mode-toolbar button[data-action]:hover {
			background: #3a3b3f !important;
			color: #ffffff !important;
		}
		#__design-mode-toolbar button[data-mode] {
			cursor: pointer !important;
			transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
		}
		#__design-mode-toolbar button[data-mode][aria-pressed="false"]:hover {
			background: rgba(255,255,255,0.08) !important;
			color: #ffffff !important;
		}
		#__design-mode-toolbar button[data-mode][aria-pressed="true"]:hover {
			background: #f0f0f0 !important;
		}
		#__design-mode-toolbar input { cursor: text !important; }
	`;
	document.head.appendChild(style);

	const onMouseOver = (e: MouseEvent) => {
		if (isInsideToolbar(e.target)) return;

		const resolved = resolveElement(e.target);
		if (!resolved) {
			hideOverlay();
			postToParent({ type: "design-mode:element-hovered", element: null });
			return;
		}

		// Suppress hover highlight on the currently-selected element so the
		// selection overlay is the only visual treatment. Also suppress on
		// any element that's part of the active multi-selection set.
		if (
			resolved.element === selectedEl ||
			multiSelectedEls.includes(resolved.element)
		) {
			hideOverlay();
		} else {
			const rect = resolved.element.getBoundingClientRect();
			const className = resolved.element.getAttribute("class") ?? "";
			positionOverlay(rect, resolved.element.tagName, className);
		}

		postToParent({
			type: "design-mode:element-hovered",
			element: {
				tagName: resolved.element.tagName.toLowerCase(),
				rect: toRect(resolved.element.getBoundingClientRect()),
			},
		});
	};

	const onClick = (e: MouseEvent) => {
		if (isInsideToolbar(e.target)) return;

		hideMultiSelectDropdowns();

		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		const resolved = resolveElement(e.target);

		if (e.shiftKey) {
			// Shift+click: toggle this element in/out of the multi-selection set.
			// Shift+click on empty area is a no-op (don't clear).
			if (!resolved) return;

			// First shift+click after a normal selection seeds the multi-set
			// with the current single-select target so {A, B} feels natural.
			if (multiSelectedEls.length === 0 && selectedEl) {
				multiSelectedEls = [selectedEl];
			}

			const existingIdx = multiSelectedEls.indexOf(resolved.element);
			if (existingIdx >= 0) {
				multiSelectedEls.splice(existingIdx, 1);
			} else {
				multiSelectedEls.push(resolved.element);
			}

			// Hide single-selection visuals — we either fall into multi-select
			// UI (2+) or back to single-select UI on the remaining element (1).
			hideSelectionOverlay();
			hideToolbar();
			selectedEl = null;
			selectedSource = null;

			if (multiSelectedEls.length >= 2) {
				// Dedupe by DOM element identity, not source — sibling instances of the
				// same component (e.g. three Card titles) share a source location, but
				// the user expects each clicked DOM node to keep its own highlight.
				const entries: MultiEntry[] = [];
				const seenElements = new Set<Element>();
				for (const el of multiSelectedEls) {
					const entry = buildMultiEntry(getStyleInfo, el);
					if (!entry) continue;
					if (seenElements.has(entry.element)) continue;
					seenElements.add(entry.element);
					entries.push(entry);
				}
				multiSelectedEls = entries.map((entry) => entry.element);
				emitMultiSelection(entries);
				hideOverlay();
				return;
			}

			if (multiSelectedEls.length === 1) {
				// Down to one — switch to single-select UI on the remaining element.
				const lone = multiSelectedEls[0];
				clearMultiSelection();
				if (!lone) return;
				const loneResolved = resolveElement(lone);
				if (loneResolved) {
					applySingleSelection(loneResolved, getStyleInfo);
				}
				return;
			}

			// length === 0 — nothing selected.
			clearMultiSelection();
			hideToolbar();
			postToParent({
				type: "design-mode:multi-elements-selected",
				elements: [],
			});
			postToParent({ type: "design-mode:element-selected", element: null });
			return;
		}

		// Plain click: clears any multi-selection first.
		if (multiSelectedEls.length > 0) {
			clearMultiSelection();
			postToParent({
				type: "design-mode:multi-elements-selected",
				elements: [],
			});
		}

		if (!resolved) {
			selectedEl = null;
			selectedSource = null;
			hideSelectionOverlay();
			hideToolbar();
			postToParent({ type: "design-mode:element-selected", element: null });
			return;
		}

		applySingleSelection(resolved, getStyleInfo);
	};

	// Re-emit the selected element's rect when the page scrolls or resizes so
	// the parent toolbar and selection outline stay pinned to the element.
	let resyncScheduled = false;
	const resyncSelection = () => {
		if (resyncScheduled) return;
		resyncScheduled = true;
		requestAnimationFrame(() => {
			resyncScheduled = false;

			// Multi-selection takes precedence — re-render rects + labels + toolbar
			// anchored on the current union bounding box.
			if (multiSelectedEls.length >= 2) {
				const entries: MultiEntry[] = [];
				for (const el of multiSelectedEls) {
					if (!document.body.contains(el)) continue;
					const entry = buildMultiEntry(getStyleInfo, el);
					if (!entry) continue;
					entries.push(entry);
				}
				if (entries.length >= 2) {
					multiSelectedEls = entries.map((entry) => entry.element);
					emitMultiSelection(entries);
				}
				return;
			}

			const el = selectedEl;
			if (!el || !document.body.contains(el)) return;
			const resolved = resolveElement(el);
			if (!resolved) return;
			const rect = resolved.element.getBoundingClientRect();
			const rawStyleInfo = getStyleInfo(resolved);
		const styleInfo: StyleInfo = {
			className: normalizeClassName(rawStyleInfo.className),
			styles: rawStyleInfo.styles,
		};
			positionSelectionOverlay(
				rect,
				resolved.element.tagName,
				styleInfo.className,
			);
			positionToolbar(rect);
			postToParent({
				type: "design-mode:element-selected",
				element: {
					source: resolved.source,
					tagName: resolved.element.tagName.toLowerCase(),
					className: styleInfo.className,
					styles: styleInfo.styles,
					rect: toRect(rect),
					componentName: resolved.componentName,
					domIndex: computeDomIndex(resolved.element, styleInfo.className),
					src: getImgSrc(resolved.element),
				},
			});
		});
	};

	// Overlays + toolbar use position: absolute with document-relative coords,
	// so the browser scrolls them with the element for free. We only need to
	// re-sync on layout changes (resize / reflow).
	const resizeObserver = new ResizeObserver(resyncSelection);
	resizeObserver.observe(document.documentElement);

	// Watch DOM mutations and re-broadcast the tree (debounced via rAF).
	// `attributes: true` covers className / id changes that affect labels.
	const mutationObserver = new MutationObserver(scheduleDomTreeBroadcast);
	mutationObserver.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["class", "id"],
	});

	const DRAG_THRESHOLD = 4;
	const EDGE_GUTTER_PX = 8;
	let dragStart: { x: number; y: number; sourceEl: Element } | null = null;
	let isDragging = false;
	let lastDropTarget: DropTarget | null = null;
	let savedSourceStyle: {
		transform: string;
		opacity: string;
		pointerEvents: string;
		transition: string;
	} | null = null;

	const applyDragStyles = (el: HTMLElement, dx: number, dy: number) => {
		if (!savedSourceStyle) {
			savedSourceStyle = {
				transform: el.style.transform,
				opacity: el.style.opacity,
				pointerEvents: el.style.pointerEvents,
				transition: el.style.transition,
			};
		}
		el.style.transform = `translate(${dx}px, ${dy}px)`;
		el.style.opacity = "0.7";
		el.style.pointerEvents = "none";
		el.style.transition = "none";
	};

	const restoreDragStyles = (el: HTMLElement) => {
		if (!savedSourceStyle) return;
		el.style.transform = savedSourceStyle.transform;
		el.style.opacity = savedSourceStyle.opacity;
		el.style.pointerEvents = savedSourceStyle.pointerEvents;
		el.style.transition = savedSourceStyle.transition;
		savedSourceStyle = null;
	};

	const onPointerDown = (e: PointerEvent) => {
		if (isInsideToolbar(e.target)) return;
		if (!selectedEl) return;
		if (!(e.target instanceof Node)) return;
		if (!selectedEl.contains(e.target)) return;
		if (e.button !== 0) return;
		e.preventDefault();
		dragStart = { x: e.clientX, y: e.clientY, sourceEl: selectedEl };
	};

	const findDropTarget = (
		sourceEl: Element,
		clientX: number,
		clientY: number,
	): DropTarget | null => {
		let el: Element | null = document.elementFromPoint(clientX, clientY);
		while (el && (el === sourceEl || sourceEl.contains(el))) {
			el = el.parentElement;
		}
		while (el) {
			if (
				el.id === "__design-mode-drop-indicator" ||
				el.id === "__design-mode-inside-drop-indicator"
			) {
				el = el.parentElement;
				continue;
			}
			const rect = el.getBoundingClientRect();
			const tag = el.tagName.toLowerCase();
			const isContainer = CONTAINER_TAGS.has(tag);
			const distFromTop = clientY - rect.top;
			const distFromBottom = rect.bottom - clientY;

			if (distFromTop >= 0 && distFromTop < EDGE_GUTTER_PX) {
				return { el, position: "before" };
			}
			if (distFromBottom >= 0 && distFromBottom < EDGE_GUTTER_PX) {
				return { el, position: "after" };
			}

			if (isContainer) {
				const midY = rect.top + rect.height / 2;
				return {
					el,
					position: clientY < midY ? "inside-start" : "inside-end",
				};
			}
			const midY = rect.top + rect.height / 2;
			return { el, position: clientY < midY ? "before" : "after" };
		}
		return null;
	};

	const onPointerMove = (e: PointerEvent) => {
		if (!dragStart) return;
		const dx = e.clientX - dragStart.x;
		const dy = e.clientY - dragStart.y;
		if (!isDragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
			isDragging = true;
			document.body.classList.add("__design-mode-dragging");
		}
		if (!isDragging) return;
		if (dragStart.sourceEl instanceof HTMLElement) {
			applyDragStyles(dragStart.sourceEl, dx, dy);
		}
		const target = findDropTarget(dragStart.sourceEl, e.clientX, e.clientY);
		if (target) {
			lastDropTarget = target;
			const rect = target.el.getBoundingClientRect();
			if (
				target.position === "inside-start" ||
				target.position === "inside-end"
			) {
				hideDropIndicator();
				positionInsideDropIndicator(rect);
			} else {
				hideInsideDropIndicator();
				positionDropIndicator(rect, target.position);
			}
		} else {
			lastDropTarget = null;
			hideDropIndicator();
			hideInsideDropIndicator();
		}
	};

	const onPointerUp = (e: PointerEvent) => {
		const wasDragging = isDragging;
		const drop = lastDropTarget;
		const sourceEl = dragStart?.sourceEl ?? null;
		dragStart = null;
		isDragging = false;
		lastDropTarget = null;
		hideDropIndicator();
		hideInsideDropIndicator();
		document.body.classList.remove("__design-mode-dragging");
		if (sourceEl instanceof HTMLElement) restoreDragStyles(sourceEl);
		if (!wasDragging || !drop || !sourceEl) return;

		e.preventDefault();
		e.stopPropagation();

		const sourceSource = getSourceForReorder(sourceEl);
		const sourceSelector = buildReorderSelector(sourceEl);
		const targetSelector = buildReorderSelector(drop.el);
		if (!sourceSource || !sourceSelector || !targetSelector) return;

		const prevParent = sourceEl.parentNode;
		const prevNextSibling = sourceEl.nextSibling;

		previewReorder(sourceEl, drop);

		const reorderId = makeReorderId();
		if (prevParent) {
			reorderHistory.set(reorderId, {
				el: sourceEl,
				prevParent,
				prevNextSibling,
			});
		}

		postToParent({
			type: "design-mode:reorder-requested",
			reorderId,
			filePath: sourceSource.fileName,
			source: sourceSelector,
			target: targetSelector,
			position: drop.position,
		});
	};

	const previewReorder = (sourceEl: Element, drop: DropTarget) => {
		const target = drop.el;
		switch (drop.position) {
			case "before": {
				const parent = target.parentElement;
				if (parent) parent.insertBefore(sourceEl, target);
				return;
			}
			case "after": {
				const parent = target.parentElement;
				if (parent) parent.insertBefore(sourceEl, target.nextSibling);
				return;
			}
			case "inside-start":
				target.insertBefore(sourceEl, target.firstChild);
				return;
			case "inside-end":
				target.appendChild(sourceEl);
				return;
		}
	};

	const onDragEsc = (e: KeyboardEvent) => {
		if (e.key !== "Escape" || !dragStart) return;
		const sourceEl = dragStart.sourceEl;
		dragStart = null;
		isDragging = false;
		lastDropTarget = null;
		hideDropIndicator();
		hideInsideDropIndicator();
		document.body.classList.remove("__design-mode-dragging");
		if (sourceEl instanceof HTMLElement) restoreDragStyles(sourceEl);
	};

	document.addEventListener("mouseover", onMouseOver, true);
	document.addEventListener("click", onClick, true);
	document.addEventListener("pointerdown", onPointerDown, true);
	document.addEventListener("pointermove", onPointerMove, true);
	document.addEventListener("pointerup", onPointerUp, true);
	document.addEventListener("keydown", onDragEsc, true);
	window.addEventListener("resize", resyncSelection);

	// Initial tree push so the panel populates as soon as design mode opens.
	scheduleDomTreeBroadcast();

	cleanupFn = () => {
		document.removeEventListener("mouseover", onMouseOver, true);
		document.removeEventListener("click", onClick, true);
		document.removeEventListener("pointerdown", onPointerDown, true);
		document.removeEventListener("pointermove", onPointerMove, true);
		document.removeEventListener("pointerup", onPointerUp, true);
		document.removeEventListener("keydown", onDragEsc, true);
		window.removeEventListener("resize", resyncSelection);
		resizeObserver.disconnect();
		mutationObserver.disconnect();
		style.remove();
		hideOverlay();
		hideSelectionOverlay();
		hideToolbar();
		clearMultiSelectionRects();
		clearMultiSelectionLabels();
		hideDropIndicator();
		hideInsideDropIndicator();
		document.body.classList.remove("__design-mode-dragging");
	};
}

function applySingleSelection(
	resolved: ResolvedElement,
	getStyleInfo: GetStyleInfo,
) {
	selectedEl = resolved.element;
	selectedSource = resolved.source;
	const rect = resolved.element.getBoundingClientRect();
	const rawStyleInfo = getStyleInfo(resolved);
	const styleInfo: StyleInfo = {
		className: normalizeClassName(rawStyleInfo.className),
		styles: rawStyleInfo.styles,
	};

	scrollAndPositionForSelection(
		resolved.element,
		resolved.element.tagName,
		styleInfo.className,
	);
	const isText = isTypographyElement(resolved.element);
	const isImage = isImageElement(resolved.element);
	const isContainer =
		!isText && !isImage && isContainerElement(resolved.element);
	const styles = styleInfo.styles ?? {};
	setTypographyMode(
		isText,
		isText
			? {
					fontFamily: styles.fontFamily ?? null,
					fontSize: styles.fontSize ?? null,
					textColor: styles.textColor ?? null,
					textAlign: styles.textAlign ?? null,
					paddingTop: styles.paddingTop ?? null,
					paddingRight: styles.paddingRight ?? null,
					paddingBottom: styles.paddingBottom ?? null,
					paddingLeft: styles.paddingLeft ?? null,
				}
			: null,
	);
	const src = getImgSrc(resolved.element);
	setImageMode(
		isImage,
		isImage
			? {
					src,
					objectFit: styles.objectFit ?? null,
					objectPosition: styles.objectPosition ?? null,
					paddingTop: styles.paddingTop ?? null,
					paddingRight: styles.paddingRight ?? null,
					paddingBottom: styles.paddingBottom ?? null,
					paddingLeft: styles.paddingLeft ?? null,
				}
			: null,
	);
	setContainerMode(
		isContainer,
		isContainer
			? {
					backgroundColor: styles.backgroundColor ?? null,
					justifyContent: styles.justifyContent ?? null,
					alignItems: styles.alignItems ?? null,
					paddingTop: styles.paddingTop ?? null,
					paddingRight: styles.paddingRight ?? null,
					paddingBottom: styles.paddingBottom ?? null,
					paddingLeft: styles.paddingLeft ?? null,
				}
			: null,
	);
	hideOverlay();

	postToParent({
		type: "design-mode:element-selected",
		element: {
			source: resolved.source,
			tagName: resolved.element.tagName.toLowerCase(),
			className: styleInfo.className,
			styles: styleInfo.styles,
			rect: toRect(rect),
			componentName: resolved.componentName,
			domIndex: computeDomIndex(resolved.element, styleInfo.className),
			src,
		},
	});
}

function disable() {
	if (!active) return;
	active = false;
	cleanupFn?.();
	cleanupFn = null;
	removeOverlay();
	selectedEl = null;
	selectedSource = null;
	domTreeBroadcastScheduled = false;
	multiSelectedEls = [];
	// Drop any stray focus an input may have acquired while design mode was on
	const activeEl = document.activeElement;
	if (activeEl instanceof HTMLElement && activeEl !== document.body) {
		activeEl.blur();
	}
}

/**
 * Find an element by source location, disambiguating between elements that
 * share the same source (e.g. items rendered from a `.map()`) using the
 * `domIndex` recorded by the parent.
 */
function selectBySource(
	getStyleInfo: GetStyleInfo,
	source: SourceLocation,
	domIndex: number,
	className: string | null,
) {
	const all = document.body.querySelectorAll("*");
	let match: Element | null = null;
	let nthByIndex: Element | null = null;
	let count = 0;
	// When className is provided, scope the count to elements that share it —
	// mirrors `computeDomIndex`, which is what produced `domIndex` on the parent.
	for (const el of all) {
		const fiber = getFiberFromElement(el);
		if (!fiber) continue;
		if (className !== null) {
			const elClass = el.getAttribute("class");
			if (elClass !== className) continue;
		} else {
			const propsSource =
				getSourceFromProps(el) ?? (fiber ? getDebugSource(fiber) : null);
			if (
				!propsSource ||
				propsSource.fileName !== source.fileName ||
				propsSource.lineNumber !== source.lineNumber ||
				propsSource.columnNumber !== source.columnNumber
			) {
				continue;
			}
		}
		if (count === domIndex) {
			nthByIndex = el;
		}
		match ??= el;
		count++;
	}

	const target = nthByIndex ?? match;
	if (!target) return;

	const resolved = resolveElement(target);
	if (!resolved) return;

	selectedEl = resolved.element;
	selectedSource = resolved.source;
	const rect = resolved.element.getBoundingClientRect();
	const styleInfo = getStyleInfo(resolved);

	scrollAndPositionForSelection(
		resolved.element,
		resolved.element.tagName,
		styleInfo.className,
	);
	const isText = isTypographyElement(resolved.element);
	const styles = styleInfo.styles ?? {};
	setTypographyMode(
		isText,
		isText
			? {
					fontFamily: styles.fontFamily ?? null,
					fontSize: styles.fontSize ?? null,
					textColor: styles.textColor ?? null,
					textAlign: styles.textAlign ?? null,
					paddingTop: styles.paddingTop ?? null,
					paddingRight: styles.paddingRight ?? null,
					paddingBottom: styles.paddingBottom ?? null,
					paddingLeft: styles.paddingLeft ?? null,
				}
			: null,
	);
	hideOverlay();

	postToParent({
		type: "design-mode:element-selected",
		element: {
			source: resolved.source,
			tagName: resolved.element.tagName.toLowerCase(),
			className: styleInfo.className,
			styles: styleInfo.styles,
			rect: toRect(rect),
			componentName: resolved.componentName,
			domIndex: computeDomIndex(resolved.element, styleInfo.className),
		},
	});
}

function handleMessage(getStyleInfo: GetStyleInfo, event: MessageEvent) {
	const data = event.data;
	if (!data) return;

	if (data.type === "enable-design-mode") {
		enable(getStyleInfo);
		return;
	}
	if (data.type === "disable-design-mode") {
		disable();
		return;
	}
	if (data.type === "design-mode:reselect") {
		// Ignore reselect messages that arrive after design mode was disabled
		// (e.g. a post-HMR ping) so we don't recreate the overlays.
		if (!active) return;
		reselect();
		return;
	}
	if (data.type === "design-mode:reorder-undo") {
		if (typeof data.reorderId === "string") {
			undoReorderById(data.reorderId);
		}
		return;
	}
	if (data.type === "design-mode:apply-inline-style") {
		if (!active) return;
		if (selectedEl instanceof HTMLElement && data.styles) {
			for (const [prop, value] of Object.entries(
				data.styles as Record<string, string>,
			)) {
				selectedEl.style.setProperty(prop, value);
			}
		}
		return;
	}
	if (data.type === "design-mode:apply-inline-src") {
		if (!active) return;
		if (
			selectedEl instanceof HTMLImageElement &&
			typeof data.src === "string"
		) {
			selectedEl.src = data.src;
		}
		return;
	}
	if (data.type === "design-mode:set-assets") {
		const assets = Array.isArray(data.assets) ? data.assets : [];
		setImageAssets(
			assets.filter(
				(a: unknown): a is { url: string; name: string } =>
					typeof a === "object" &&
					a !== null &&
					typeof (a as { url?: unknown }).url === "string" &&
					typeof (a as { name?: unknown }).name === "string",
			),
		);
		return;
	}
	if (data.type === "design-mode:request-dom-tree") {
		if (!active) return;
		scheduleDomTreeBroadcast();
		return;
	}
	if (data.type === "design-mode:select-by-source") {
		if (!active) return;
		const src = data.source;
		const idx = typeof data.domIndex === "number" ? data.domIndex : 0;
		const cls = typeof data.className === "string" ? data.className : null;
		if (
			!src ||
			typeof src.fileName !== "string" ||
			typeof src.lineNumber !== "number" ||
			typeof src.columnNumber !== "number"
		) {
			return;
		}
		selectBySource(getStyleInfo, src, idx, cls);
		return;
	}
	if (data.type === "design-mode:apply-multi-inline-style") {
		if (!active) return;
		if (!data.styles) return;
		const styles = data.styles as Record<string, string>;
		for (const el of multiSelectedEls) {
			if (!(el instanceof HTMLElement)) continue;
			for (const [prop, value] of Object.entries(styles)) {
				el.style.setProperty(prop, value);
			}
		}
		return;
	}

	// Handle wrapped messages from useIframe hook
	if (typeof data === "string" || data.__fromUseIframeHook) {
		try {
			const parsed = typeof data === "string" ? JSON.parse(data) : data;
			if (parsed.__fromUseIframeHook && parsed.payload) {
				const message = JSON.parse(parsed.payload);
				if (message.type === "enable-design-mode") {
					enable(getStyleInfo);
				} else if (message.type === "disable-design-mode") {
					disable();
				}
			}
		} catch {
			// Not a design mode message
		}
	}
}

/**
 * Re-find the currently selected element by its source location.
 * Called after HMR replaces DOM nodes so the selection stays alive.
 */
function reselect() {
	if (!storedGetStyleInfo) return;

	// Fast Refresh usually preserves DOM nodes when only a className changes,
	// so our selectedEl reference is still live. Reuse it directly — this is
	// unambiguous, unlike matching by fiber _debugSource where a parent and
	// child often share the same walked-up source.
	if (selectedEl && document.body.contains(selectedEl)) {
		const resolved = resolveElement(selectedEl);
		if (resolved) {
			selectedSource = resolved.source;
			const rect = resolved.element.getBoundingClientRect();
			const rawStyleInfo = storedGetStyleInfo(resolved);
			const styleInfo: StyleInfo = {
				className: normalizeClassName(rawStyleInfo.className),
				styles: rawStyleInfo.styles,
			};
			positionSelectionOverlay(
				rect,
				resolved.element.tagName,
				styleInfo.className,
			);
			positionToolbar(rect);
			postToParent({
				type: "design-mode:element-selected",
				element: {
					source: resolved.source,
					tagName: resolved.element.tagName.toLowerCase(),
					className: styleInfo.className,
					styles: styleInfo.styles,
					rect: toRect(rect),
					componentName: resolved.componentName,
					domIndex: computeDomIndex(resolved.element, styleInfo.className),
					src: getImgSrc(resolved.element),
				},
			});
			return;
		}
	}

	// Fallback: the DOM node was actually replaced (e.g. structural edit).
	if (!selectedSource) return;
	const resolved = findElementBySource(selectedSource);
	if (!resolved) {
		selectedEl = null;
		selectedSource = null;
		hideSelectionOverlay();
		hideToolbar();
		postToParent({ type: "design-mode:element-selected", element: null });
		return;
	}

	selectedEl = resolved.element;
	const rect = resolved.element.getBoundingClientRect();
	const rawStyleInfo = storedGetStyleInfo(resolved);
	const styleInfo: StyleInfo = {
		className: normalizeClassName(rawStyleInfo.className),
		styles: rawStyleInfo.styles,
	};

	positionSelectionOverlay(
		rect,
		resolved.element.tagName,
		styleInfo.className,
	);
	positionToolbar(rect);
	postToParent({
		type: "design-mode:element-selected",
		element: {
			source: resolved.source,
			tagName: resolved.element.tagName.toLowerCase(),
			className: styleInfo.className,
			styles: styleInfo.styles,
			rect: toRect(rect),
			componentName: resolved.componentName,
			domIndex: computeDomIndex(resolved.element, styleInfo.className),
			src: getImgSrc(resolved.element),
		},
	});
}

/**
 * Initialize the design mode listener. Call once at app startup.
 * Provide a platform-specific `getStyleInfo` to extract style data.
 *
 * Returns a `reselect` function that re-finds the selected element
 * by source location — call it after HMR updates to restore selection.
 */
export function initDesignMode(getStyleInfo: GetStyleInfo) {
	if (typeof window === "undefined") return () => {};
	storedGetStyleInfo = getStyleInfo;
	window.addEventListener("message", (e) => handleMessage(getStyleInfo, e));
	return reselect;
}
