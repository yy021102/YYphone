import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initViewportKeyboardLayout } from './viewportKeyboard';

test('full-screen startup and safe areas stay intact while only an editable keyboard constrains the app', () => {
  class Element { isContentEditable = false; }
  class Textarea extends Element { disabled = false; readOnly = false; }
  class Input extends Element { disabled = false; readOnly = false; type = 'text'; }
  const styles = new Map<string, string>();
  const viewport = Object.assign(new EventTarget(), { height: 810, offsetTop: 0, scale: 1 });
  const win = Object.assign(new EventTarget(), { visualViewport: viewport, innerHeight: 844,
    scrollX: 0, scrollY: 0, scrollTo: () => {} });
  const doc = Object.assign(new EventTarget(), { activeElement: new Element(), documentElement: { style: {
    setProperty: (key: string, value: string) => styles.set(key, value),
    removeProperty: (key: string) => styles.delete(key),
  } } });
  const frames: FrameRequestCallback[] = [];
  const replacements = { window: win, document: doc, HTMLElement: Element, HTMLTextAreaElement: Textarea,
    HTMLInputElement: Input, requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback) };
  const originals = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const update = (type = 'resize') => {
    if (type.startsWith('focus')) doc.dispatchEvent(new Event(type));
    else viewport.dispatchEvent(new Event(type));
    while (frames.length) frames.shift()?.(0);
  };
  try {
    for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value });
    initViewportKeyboardLayout();
    assert.equal(styles.size, 0, 'a 34px startup inset must not shorten the app');
    viewport.height = 500;
    update();
    assert.equal(styles.size, 0, 'viewport changes without an editable focus are not keyboards');
    doc.activeElement = new Textarea();
    viewport.height = 810;
    update('focusin');
    assert.equal(styles.size, 0, 'focus alone must not mistake a safe area for a keyboard');
    viewport.height = 500.4;
    viewport.offsetTop = 80;
    update();
    assert.equal(styles.get('--app-height'), '501px');
    assert.equal(styles.get('--app-top'), '80px');
    viewport.scale = 2;
    update();
    assert.equal(styles.size, 0, 'zoom must not shrink the app');
    viewport.scale = 1;
    const readonly = new Textarea();
    readonly.readOnly = true;
    doc.activeElement = readonly;
    update('focusin');
    assert.equal(styles.size, 0);
    const checkbox = new Input();
    checkbox.type = 'checkbox';
    doc.activeElement = checkbox;
    update('focusin');
    assert.equal(styles.size, 0);
    const editable = new Element();
    editable.isContentEditable = true;
    doc.activeElement = editable;
    update('focusin');
    assert.equal(styles.get('--app-height'), '501px');
    doc.activeElement = new Element();
    update('focusout');
    assert.equal(styles.size, 0, 'blur restores the full-screen CSS even during keyboard dismissal');
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
