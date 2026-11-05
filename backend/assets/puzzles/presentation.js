// Host-owned annotations keep generated lettering out of the apparatus.
function puzzlePresentation(HL, stage, svg, interactions) {
  const palette = { red: '#b83e39', green: '#25764b', blue: '#2869a3', amber: '#946515', teal: '#197b80', gray: '#656569' };
  const legend = document.createElement('div'), outputs = document.createElement('div');
  legend.className = 'puzzle-legend'; outputs.className = 'puzzle-outputs';
  legend.setAttribute('aria-label', 'Component legend'); outputs.setAttribute('aria-label', 'Measurements');
  stage.append(legend, outputs);
  const formatNumber = value => {
    if (!Number.isFinite(value)) throw new Error('Readings must be finite numbers.');
    // Preserve small nonzero evidence without a long string of decimal places.
    return value !== 0 && Math.abs(value) < .001 ? value.toExponential(2) : String(Number(value.toFixed(3)));
  };
  const safeHL = { ...HL, mk(tag, attrs, parent) {
    if (['text', 'tspan', 'textpath', 'foreignobject'].includes(String(tag).toLowerCase())) throw new Error('Use interactions.legend or interactions.reading outside the apparatus.');
    return HL.mk(tag, attrs, parent);
  } };
  return { HL: safeHL, interactions: { ...interactions,
    label() { throw new Error('Use interactions.legend for component labels.'); },
    legend(component, label, color = 'blue') {
      if (!palette[color] || !svg.contains(component)) throw new Error('Legend needs a scene component and a named palette color.');
      component.classList.add(`puzzle-component-${color}`);
      const row = document.createElement('div'), swatch = document.createElement('i');
      swatch.style.backgroundColor = palette[color]; swatch.setAttribute('aria-hidden', 'true');
      row.append(swatch, document.createTextNode(String(label))); legend.append(row);
    },
    reading(label, value, unit = '') {
      const row = document.createElement('div'), name = document.createElement('span'), output = document.createElement('output');
      name.textContent = String(label); row.append(name, output); outputs.append(row);
      const update = next => { output.textContent = `${formatNumber(next)}${unit ? ` ${unit}` : ''}`; };
      update(value); return { update };
    },
  } };
}
