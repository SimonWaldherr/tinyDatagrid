# Dynamic arrays

[← Overview](../README.md) · [Integration guide](guide.md) · [Function reference](functions.md) · [JSON](json.md)

A formula that returns several values **spills** them into the cells to its right
and below. One formula fills a whole table, and the result stays live:

```text
D2   =SORT(A2:B7; 2; -1)              sorted copy of a table, filled into D2:E7
G2   =UNIQUE(B2:B7)                   distinct values in a column
A10  =FILTER(A2:B7; B2:B7>=85; "–")   rows that meet a condition
I2   =ROUND(B2:B7*1.1; 1)             a calculation for every row at once
B15  =SUM(I2#)                        the whole spilled result of I2
```

The formula cell shows the first value and owns the range. The other cells are
read-only results: they hold no content of their own, so formulas can refer to
them like to any cell, and they recalculate with their source. A faint tint and
outline mark the range (`tg-spilled`, `tg-spill-t/b/l/r`; override
`--tg-spill` and `--tg-spill-line`).

## Blocked spills

A spill needs empty space. Otherwise the formula cell shows an error, with the
reason in its tooltip, and dependents see the error too:

| Error | Cause |
| --- | --- |
| `#SPILL! Blocked by B3` | Another cell in the range has content |
| `#SPILL! Overlaps C1` | The range collides with an earlier spill (the one that starts first in reading order keeps the cells) |
| `#SPILL! Result too large` | More than `maxSpillCells` values (default 100,000) |

Clearing the blocking cell restores the spill. Typing into a spilled cell blocks
its own spill. The sheet grows automatically when a result extends past the last
row or column.

## Referring to results

- `A1` is the value of the formula cell itself, the top-left result.
- `A1#` is the **whole result** of the formula in `A1`, for example
  `=SUM(A1#)`, `=ROWS(A1#)`, `=INDEX(A1#; 2; 1)` or `=SORT(A1#)`. A cell without
  an array formula behaves like a one-cell range.
- Ranges over spilled cells work as usual: `=SUM(D2:D7)`.

Earlier versions passed an array through a plain reference (`=SUM(B1)` summing all
of `B1`'s array). Use `B1#` for that now.

## Calculations over ranges

Operators work element by element when an operand is a range:

```text
=A2:A10*B2:B10             product row by row
=A2:A10&" (" & B2:B10 & ")"   text for every row
=A2:A10>100                TRUE/FALSE for every row
=-A2:A10
=IF(A2:A10>100; "high"; "normal")
```

A single row combines with a single column to a table
(`=A2:A5*B1:E1`). Ranges of different sizes fill the missing positions with
`#N/A`. An error in one element stays in that element.

Many single-value functions also map over ranges: `ABS ROUND ROUNDUP ROUNDDOWN
FLOOR CEIL INT SQRT POW MOD SIGN EXP LN LOG NOT ISBLANK ISNUMBER ISTEXT VALUE N
LEN UPPER LOWER PROPER LEFT RIGHT MID FIND SEARCH SUBSTITUTE REPLACE TEXT
YEAR MONTH DAY HOUR MINUTE SECOND DATE DATEVALUE DAYS TRIM LTRIM RTRIM SQUEEZE
SUBSTR REVERSE REPEAT STARTSWITH ENDSWITH CONTAINS REPLACEALL PADSTART PADEND
REGEXP REGEXP_EXTRACT REGEXP_REPLACE`, the trigonometric functions, `GEO.DISTANCE`,
`GEO.BEARING` and `GEOM.*` shape formulas, `HASH.*` and the JSON functions
`JSON.PARSE JSON.GET JSON.HAS JSON.TYPE JSON.VALID JSON.LENGTH`. Aggregates such as
`SUM` or `AVERAGE` keep taking the whole range.

## Functions that fill cells

`SEQUENCE`, `FILTER`, `SORT`, `UNIQUE`, `TRANSPOSE`, `HSTACK`, `VSTACK`, `MAKEARRAY`,
`MAP`, `SCAN`, `BYROW`, `SPLIT`, `REGEXP_SPLIT`, `GEO.DESTINATION`, lookups that return
a whole row, `JSON.TABLE`, `JSON.KEYS`, `JSON.VALUES`, `JSON.ENTRIES`, `JSON.FLATTEN`,
and custom functions that return arrays.

```text
=SEQUENCE(3; 4)                    12 numbers in 3 rows
=SPLIT("a,b,c"; ",")               one row of three cells
=MAP(A2:A9; LAMBDA(x; x*x))        a column of squares
=JSON.TABLE(A1)                    an array of JSON objects as a table
```

## What this means elsewhere

- **Used range and export.** `getUsedRange()` includes spilled cells, so CSV,
  Markdown and HTML exports of computed values contain them. A workbook stores
  only the formula; opening it recreates the spill. Exporting with
  `{ formulas: false }` writes the spilled values as constants.
- **Copy.** Copying a selection with spilled cells copies their values.
- **Search.** `grid.find(text, { scope: 'values' })` also searches spilled results.
- **Undo.** Spills are derived data, so undo and redo restore them automatically.
- **Worksheets.** Other sheets can read spilled cells (`=Data!A3`). A spill on an
  inactive sheet is known once that sheet has been calculated, which happens when
  another sheet references it or when you select it.
- **Not for sorting or tables.** Sorting a table, filters and fill operate on the
  content of cells. Keep spilled results outside of tables you sort.

## API

```js
grid.setCell(0, 0, '=SEQUENCE(4; 2)');
grid.getComputedValue(0, 0);   // 1, the formula cell's own value
grid.getSpill(0, 0);           // [[1, 2], [3, 4], [5, 6], [7, 8]]
grid.getSpillRanges();         // [{ row: 0, col: 0, rows: 4, cols: 2 }]
new TinyDatagrid('#grid', { maxSpillCells: 20000 });
```

Evaluation stays incremental: a change recalculates the cells that depend on it,
and a spill only re-registers when its size or values change.
