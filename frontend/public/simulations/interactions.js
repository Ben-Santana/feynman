// Shared definition is injected into the figure modules by the build script.
// Shared interaction treatment. Colour and labels intentionally extend Hairline's
// monochrome presentation for teaching affordances; its kernel remains unchanged.
// eslint-disable-next-line no-unused-vars
function simulationInteractions(svg) {
  const defs = HL.mk('defs', {}, svg);
  for (const [name, colour] of [['grab', '#b83e39'], ['drop', '#25764b']]) {
    const pattern = HL.mk('pattern', { id: `sim-${name}-hatch`, width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' }, defs);
    HL.mk('rect', { width: 4, height: 4, fill: '#fafafa', stroke: 'none' }, pattern);
    HL.mk('path', { d: 'M 0 0 L 0 4', stroke: colour, 'stroke-width': .65, opacity: .55 }, pattern);
  }
  HL.mk('style', {}, defs).textContent = `
    .sim-grab { fill:url(#sim-grab-hatch)!important;stroke:#b83e39!important;stroke-width:1.5!important; }
    .sim-grab-edge {stroke:#b83e39!important;stroke-width:1.5!important;}
    .sim-drop {fill:url(#sim-drop-hatch)!important;stroke:#25764b!important;stroke-width:1.5!important;}
    .sim-grabbable {cursor:grab;} [data-dragging="true"], [data-dragging="true"] * {cursor:grabbing!important;} [data-solved="true"] .sim-grabbable {cursor:default;}
    .sim-label {fill:#414145!important;stroke:none!important;font:10px system-ui,sans-serif;text-anchor:middle;}
    .sim-dimension {fill:#656569!important;stroke:none!important;font:9px system-ui,sans-serif;text-anchor:middle;}
  `;
  return {
    top(parent, points, kind = 'grab') { return HL.mk('path', { d: HL.poly(points), class: `sim-${kind}` }, parent); },
    label(parent, text, point, dim = false) { const node = HL.mk('text', { x: point[0], y: point[1], class: dim ? 'sim-dimension' : 'sim-label' }, parent); node.textContent = text; return node; },
  };
}
