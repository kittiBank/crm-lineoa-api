export interface RichMenuBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RichMenuLayout {
  id: string;
  label: string;
  description: string;
  size: { width: number; height: number };
  rows: number;
  cols: number;
  cells: RichMenuBounds[];
}

function splitSize(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, index) =>
    base + (index === parts - 1 ? remainder : 0),
  );
}

function buildGrid(
  width: number,
  height: number,
  rows: number,
  cols: number,
): RichMenuBounds[] {
  const colWidths = splitSize(width, cols);
  const rowHeights = splitSize(height, rows);
  const cells: RichMenuBounds[] = [];

  let y = 0;
  for (let row = 0; row < rows; row++) {
    let x = 0;
    for (let col = 0; col < cols; col++) {
      cells.push({
        x,
        y,
        width: colWidths[col],
        height: rowHeights[row],
      });
      x += colWidths[col];
    }
    y += rowHeights[row];
  }

  return cells;
}

export const RICH_MENU_LAYOUTS: RichMenuLayout[] = [
  {
    id: 'large-1',
    label: '1 area',
    description: 'Full menu (2500×1686)',
    size: { width: 2500, height: 1686 },
    rows: 1,
    cols: 1,
    cells: buildGrid(2500, 1686, 1, 1),
  },
  {
    id: 'large-2-cols',
    label: '2 columns',
    description: '2 areas side by side',
    size: { width: 2500, height: 1686 },
    rows: 1,
    cols: 2,
    cells: buildGrid(2500, 1686, 1, 2),
  },
  {
    id: 'large-3-cols',
    label: '3 columns',
    description: '3 areas in one row',
    size: { width: 2500, height: 1686 },
    rows: 1,
    cols: 3,
    cells: buildGrid(2500, 1686, 1, 3),
  },
  {
    id: 'large-2x2',
    label: '2×2 grid',
    description: '4 equal areas',
    size: { width: 2500, height: 1686 },
    rows: 2,
    cols: 2,
    cells: buildGrid(2500, 1686, 2, 2),
  },
  {
    id: 'large-2x3',
    label: '2×3 grid',
    description: '6 areas (2 rows × 3 cols)',
    size: { width: 2500, height: 1686 },
    rows: 2,
    cols: 3,
    cells: buildGrid(2500, 1686, 2, 3),
  },
  {
    id: 'large-3x2',
    label: '3×2 grid',
    description: '6 areas (3 rows × 2 cols)',
    size: { width: 2500, height: 1686 },
    rows: 3,
    cols: 2,
    cells: buildGrid(2500, 1686, 3, 2),
  },
  {
    id: 'compact-1',
    label: 'Compact 1 area',
    description: 'Half height (2500×843)',
    size: { width: 2500, height: 843 },
    rows: 1,
    cols: 1,
    cells: buildGrid(2500, 843, 1, 1),
  },
  {
    id: 'compact-2-cols',
    label: 'Compact 2 columns',
    description: '2 areas half height',
    size: { width: 2500, height: 843 },
    rows: 1,
    cols: 2,
    cells: buildGrid(2500, 843, 1, 2),
  },
  {
    id: 'compact-3-cols',
    label: 'Compact 3 columns',
    description: '3 areas half height',
    size: { width: 2500, height: 843 },
    rows: 1,
    cols: 3,
    cells: buildGrid(2500, 843, 1, 3),
  },
];

export function getLayoutById(layoutId: string): RichMenuLayout {
  const layout = RICH_MENU_LAYOUTS.find((item) => item.id === layoutId);
  if (!layout) {
    throw new Error(`Unknown layout: ${layoutId}`);
  }
  return layout;
}
