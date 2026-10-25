import assert from 'node:assert/strict';

/** Real rendered geometry: long labels must fit the cell and touch targets must
 * remain usable, including disabled actions. Horizontal table scrolling is valid. */
export async function assertTableActions(page) {
  const results = await page.locator('.ui-table-region tbody td .ui-action').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    const cell = node.closest('td').getBoundingClientRect();
    const style = getComputedStyle(node);
    return {label: node.textContent.trim(), height: rect.height,
      fits: rect.left >= cell.left && rect.right <= cell.right + 1,
      clipped: node.scrollWidth > node.clientWidth + 1,
      wraps: style.whiteSpace !== 'nowrap',
      overlaps: nodes.some(other => {
        if (node === other) return false;
        const b = other.getBoundingClientRect();
        return rect.left < b.right - 1 && rect.right > b.left + 1 && rect.top < b.bottom - 1 && rect.bottom > b.top + 1;
      })};
  }));
  assert.ok(results.length, 'Expected rendered table actions');
  for (const result of results) {
    assert.ok(result.label, 'Every table action needs a visible label');
    assert.ok(result.height >= 44, `Touch target: ${JSON.stringify(result)}`);
    assert.ok(result.fits && !result.clipped && result.wraps, `Cell fit: ${result.label}`);
    assert.equal(result.overlaps, false, `Overlapping action: ${result.label}`);
  }
  const first = page.locator('.ui-table-region tbody td .ui-action:not(:disabled)').first();
  if (await first.count()) {
    await first.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.ok(await first.evaluate(node => node.matches(':focus-visible') && parseFloat(getComputedStyle(node).outlineWidth) >= 2), 'Keyboard focus must be visible');
  }
}
