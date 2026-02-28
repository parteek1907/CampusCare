// Helper for Type-Safe DOM selection
export function $<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector(selector) as T;
    if (!el) throw new Error(`Element ${selector} not found`);
    return el;
}
