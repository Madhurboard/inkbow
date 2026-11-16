/** Small typed DOM helpers. */

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export function show(id: string, display = 'flex'): void {
  byId(id).style.display = display;
}

export function hide(id: string): void {
  byId(id).style.display = 'none';
}

export function isShown(id: string): boolean {
  return byId(id).style.display === 'flex';
}

/** Run `handler` on press (pointerdown), without the press also reaching the canvas. */
export function onPress(el: HTMLElement, handler: () => void): void {
  el.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  });
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.append(...children);
  return el;
}
