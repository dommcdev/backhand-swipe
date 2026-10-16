# Comic-book style (v1)

The first full look for Backhand Swipe: a loud, flat, comic-book / fight-poster style.
The exact code is saved on the git branch `style/comic-book` (`git checkout style/comic-book -- frontend`
restores it).

## Feel

Bold and playful, like a printed fight poster or comic panel. Flat color fields, thick black
ink outlines, hard offset shadows, a halftone or stripe pattern on the page, and a condensed
poster typeface for every headline and number. No gradients, no blur, no soft shadows.

## Color

Every palette is a bright "paper" background plus a red corner and a blue corner for the two
fighters. Ink is always pure black and cards are always pure white.

| Token      | Role                                            |
| ---------- | ----------------------------------------------- |
| `paper`    | Page background, the loud color                 |
| `ink`      | Text, borders, shadows (`#000`)                 |
| `card`     | Card and panel fill (`#fff`)                    |
| `muted`    | Secondary text, a dark shade of the paper color |
| `tint`     | Focused input fill, a pale shade of the paper   |
| `corner-l` | Left fighter (red family)                       |
| `corner-r` | Right fighter (blue family)                     |
| `up`       | Rank moved up (green)                           |
| `pattern`  | CSS background layered over `paper`, fixed      |

Palettes (paper / left / right, plus the pattern):

- Fight night: `#ffd23f` / `#e63b2e` / `#1f4fe0`, black halftone dots 11px apart
- Main event: `#b6f03c` / `#e8304f` / `#4632e6`, white sunburst rays from the top
- Bubblegum: `#ff9fcf` / `#d9480f` / `#0b7c6b`, thin black 45° pinstripes
- Rooftop: `#8fd0ff` / `#e8432a` / `#3a2a8f`, 24px graph-paper grid
- Hazard: `#ff9f1c` / `#c1121f` / `#1d3557`, wide 45° hazard stripes
- Lucha: `#4fe0c4` / `#e0007a` / `#1c3fd6`, white zig-zag
- Grape soda: `#c4a6ff` / `#f0442c` / `#127a4a`, large white polka dots

The palette is stored in localStorage (`bhs:palette:v1`) and applied as `data-theme` on `<html>`
by an inline script before first paint.

## Type

- Display: Big Shoulders Display (variable), weight 900, tight leading (0.82 to 1.1). Used for
  the wordmark, fighter names, headings, ranks, ratings, and percentages.
- Body: Archivo (variable, with width axis), weights 500 to 700. A `font-condensed` utility
  sets `wdth 82` for labels, chips, and small stats.
- Wordmark: "Backhand" solid black over "swipe" in white with a 1.5px black stroke, rotated -3°.

## Borders, radius, shadows

- Borders: 2px solid black on cards, buttons, inputs, chips, and bars. 3px on the belt plate.
- Radius: 18px on cards and big panels, 14px on pick buttons, 10 to 12px on inputs and faces,
  full pills on chips and the nav.
- Shadows: hard offset black with no blur. `shadow-block` is `7px 7px 0 #000` on cards and
  panels; `shadow-block-sm` is `4px 4px 0 #000` on buttons, the search box, and the nav.
- Pressing a `.press` button moves it 3px down and right and shrinks its shadow to 1px, so it
  looks pushed into the page.
- Focus: 3px solid black outline, 3px offset.

## Components

- Header: wordmark on the left, centered segmented nav pill on desktop (white with black active
  segment). On mobile the nav is a fixed bottom bar over a fade to the paper color.
- Swipe card: white card, black border, block shadow. The top half is the "arena": red corner
  on the left and blue on the right, cut on a diagonal, with emoji crowds or art. A round
  paper-colored "vs" badge, tilted -8°, sits on the seam. Dragging dims the losing corner and
  fades in a white outlined "X wins" stamp on the winner. The lower half has both names in
  their corner colors and a "tale of the tape" (total weight, secret weapon, weakness).
- Deck: two cards peek out behind the top one and rise as it is dragged.
- Pick buttons: solid red and blue blocks with a chevron and the fighter's name in white.
- Split bar: rounded black-bordered bar, red share and blue share with white percentages,
  animating its split.
- Rankings: sticky search and category bar, a three-card podium (the champion's card has a mini
  championship belt), closest-call split bars, then a white standings table with rank, face,
  name, record, win-rate bar, rating, and weekly movement.
- Where do I rank: white form card (units toggle, weight, age, height), a big verdict headline,
  and a ladder where the "You" row is inverted to black and springs in.
- Palette picker: three-stripe swatch pills in the footer.

## Motion

Only in response to the user: card drag and fling, the deck rising, split bar transitions,
the "You" row springing into the ladder, and button presses. Reduced motion turns it all off.
