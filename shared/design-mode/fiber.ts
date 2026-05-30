/**
 * React fiber helpers for design mode.
 *
 * React's dev JSX transform attaches _debugSource to every fiber node,
 * giving us { fileName, lineNumber, columnNumber } for free — no build
 * transforms needed.
 */

export interface SourceLocation {
	fileName: string;
	lineNumber: number;
	columnNumber: number;
}

export function getFiberFromElement(element: Element): any {
	const key = Object.keys(element).find((k) => k.startsWith("__reactFiber$"));
	return key ? (element as any)[key] : null;
}

export function normalizeClassName(value: string): string {
	return value
		.split(/\s+/)
		.filter((cls) => cls.length > 0 && !/^jsx-\d+$/.test(cls))
		.join(" ");
}

export function getNormalizedClassName(element: Element): string {
	return normalizeClassName(element.getAttribute("class") ?? "");
}

export function computeDomIndex(element: Element, className: string): number {
	if (!className) return 0;
	const normalized = normalizeClassName(className);
	let index = 0;
	const all = document.querySelectorAll("*");
	for (const el of all) {
		if (el === element) return index;
		if (getNormalizedClassName(el) === normalized) index += 1;
	}
	return 0;
}

/**
 * Read `__source` directly off the DOM node's React props record. This is
 * the EXACT JSX line for this element — not a walked-up ancestor's — so it
 * fixes edits landing on the wrong element when host fibers don't carry
 * `_debugSource` and `getDebugSource` would otherwise walk up to a
 * component instantiation site.
 */
export function getSourceFromProps(element: Element): SourceLocation | null {
	const key = Object.keys(element).find((k) => k.startsWith("__reactProps$"));
	if (!key) return null;
	const props = (element as any)[key];
	const source = props?.__source;
	if (
		source &&
		typeof source.fileName === "string" &&
		typeof source.lineNumber === "number" &&
		typeof source.columnNumber === "number"
	) {
		return {
			fileName: source.fileName,
			lineNumber: source.lineNumber,
			columnNumber: source.columnNumber,
		};
	}
	return null;
}

export function getDebugSource(fiber: any): SourceLocation | null {
	let current = fiber;
	while (current) {
		if (current._debugSource) {
			return current._debugSource as SourceLocation;
		}
		current = current.return;
	}
	return null;
}

export function getComponentName(fiber: any): string | null {
	let current = fiber?.return;
	while (current) {
		if (
			typeof current.type === "function" ||
			typeof current.type === "object"
		) {
			const name = current.type.displayName ?? current.type.name ?? null;
			if (name && name !== "Fragment" && !name.startsWith("_")) {
				return name;
			}
		}
		current = current.return;
	}
	return null;
}

export interface ResolvedElement {
	source: SourceLocation;
	element: Element;
	componentName: string | null;
	fiber: any;
}

export function resolveElement(
	target: EventTarget | null,
): ResolvedElement | null {
	let el = target as Element | null;

	while (el) {
		const fiber = getFiberFromElement(el);
		// Prefer __reactProps$.__source — that's the exact JSX line for THIS
		// element, not an ancestor's — falling back to fiber.return walk-up
		// only when props don't carry __source.
		const source =
			getSourceFromProps(el) ?? (fiber ? getDebugSource(fiber) : null);
		if (source && fiber) {
			return {
				source,
				element: el,
				componentName: getComponentName(fiber),
				fiber,
			};
		}
		el = el.parentElement;
	}

	return null;
}

/**
 * Walk the entire DOM tree and find the element whose React fiber
 * matches the given source location. Used to re-select after HMR
 * replaces DOM nodes.
 *
 * Prefer the element with the SMALLEST fiber walk-up distance to the
 * matching _debugSource. This means:
 *   - An element whose OWN fiber carries _debugSource beats an element
 *     whose ancestor fiber does.
 *   - If the originally-clicked host fiber lacks _debugSource and we
 *     stored a walked-up source, we still land on the nearest
 *     descendant of the component (rather than the topmost parent,
 *     which document-order iteration would otherwise return first).
 */
export function findElementBySource(
	source: SourceLocation,
): ResolvedElement | null {
	const allElements = document.body.querySelectorAll("*");
	let best: { distance: number; resolved: ResolvedElement } | null = null;

	for (const el of allElements) {
		const fiber = getFiberFromElement(el);
		if (!fiber) continue;

		// Distance 0: __reactProps$.__source on the DOM node itself — the
		// most accurate match (no walk-up).
		const propsSource = getSourceFromProps(el);
		if (
			propsSource &&
			propsSource.fileName === source.fileName &&
			propsSource.lineNumber === source.lineNumber &&
			propsSource.columnNumber === source.columnNumber
		) {
			if (!best || best.distance > 0) {
				best = {
					distance: 0,
					resolved: {
						source: propsSource,
						element: el,
						componentName: getComponentName(fiber),
						fiber,
					},
				};
			}
			continue;
		}

		let current = fiber;
		let distance = 1;
		while (current) {
			const s = current._debugSource as SourceLocation | undefined;
			if (
				s &&
				s.fileName === source.fileName &&
				s.lineNumber === source.lineNumber &&
				s.columnNumber === source.columnNumber
			) {
				if (!best || distance < best.distance) {
					best = {
						distance,
						resolved: {
							source: s,
							element: el,
							componentName: getComponentName(fiber),
							fiber,
						},
					};
				}
				break;
			}
			current = current.return;
			distance++;
		}
	}

	return best?.resolved ?? null;
}
