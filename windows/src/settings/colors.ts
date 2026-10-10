// The colour dot at the start of a pill's row in Settings.

import { pillColor } from "../core/pill-colors";
import { h } from "../views/dom";

/**
 * Renders a static color dot for a pill row. Color options / popup options removed as requested.
 */
export function colorDot(
  def: { id: string; name: string; color: string },
  size: string,
  colors: () => unknown,
  _pick?: (next: Record<string, string>) => void,
): HTMLElement {
  const current = pillColor(def.id, def.color, colors());
  return h("i", {
    class: "dot",
    style: `background:${current};${size}`,
    title: def.name,
  });
}
