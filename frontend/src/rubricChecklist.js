// Numbered text keeps existing saved rubrics compatible while defining distinct items.
export function checklistRows(value) {
  return value ? value.split(/\r?\n/).map(line => line.replace(/^\s*(?:\d+[.)]\s*|[-*]\s+(?:\[[ xX]\]\s*)?)/, '')) : [];
}
export function checklistItems(value) {
  return checklistRows(value).map(item => item.trim()).filter(Boolean);
}
export function checklistText(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}
