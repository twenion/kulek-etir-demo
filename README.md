# KÜLƏK — two perfumes from the city of winds (animated concept)

Baku is the city of winds. KÜLƏK is a fictional perfume house with two fragrances named after
them: **Xəzri**, the cold north wind (sea salt, bergamot, cedar), and **Gilavar**, the warm south
wind (saffron, fig, amber). The page is a stage: one bottle in the middle of the screen, carried
by the scroll, while the weather around it changes from a Caspian storm to a warm dusk.

The site is animation-first on purpose. Text is kept to short lines at the moments that need them.

## Scenes

| Scene | What happens |
| --- | --- |
| Opening | Grains blown by the storm gather onto the surface of the bottle; the bottle forms from the base up. |
| Flakon | The camera pushes in to the fluted cap, glides down to the engraved plaque, then pulls back with a full turn. |
| İçindən | Exploded view: cap, actuator, pump, collar and glass separate, each part named. |
| Xəzri | The camera dives into the juice and sinks through its three layers (opening, heart, trace) with bubbles and the notes drifting past. |
| Külək dönür | A storm: wind trails, fog, the bottle spins, the compass swings north to south, the page turns from cold to warm and the juice changes colour layer by layer. Gilavar's notes orbit the bottle. |
| Bir basış | The cap lifts off, one press, the spray rises and settles into the words "Külək keçir, ətir qalır." |
| Kolleksiya | Pick a wind (the page changes weather), pick 30/50/100 ml (the bottle resizes), cart and checkout. |

## How it is built

- Static HTML + CSS + vanilla JS modules. No framework, no CDN, no build step.
- **The bottle is real-time 3D, generated in code** (`js/mesh.js`): a twisted rounded-box glass
  body, the juice, an engraved plaque, and lathed metal parts (collar, pump, actuator, 24-flute cap).
- **Rendering** (`js/bottle.js`, WebGL2): pass A draws the backdrop (gradient, glow, shadow, giant
  words) and the translucent layered juice into a multisampled target; pass B draws the metal and
  then the glass, which samples pass A through its own normal (screen-space refraction with slight
  dispersion), plus Fresnel reflections of a studio environment. Full device resolution, MSAA.
- `js/scenes.js` maps scroll progress to camera, bottle and weather targets; `js/main.js` eases
  toward them every frame.
- `js/fx.js` draws the 2D layers: wind trails, fog, the opening grains, the inside of the juice,
  the orbiting notes (`js/botanica.js`, line drawings) and the spray, which is scroll-driven down to
  the moment the droplets form the motto.
- `js/shop.js`: picker, cart drawer, checkout with validation. Cart in `localStorage`; nothing is sent.

## Budgets (measured 17.11.2026)

| | Size |
| --- | --- |
| HTML + CSS + JS (uncompressed) | 108 KB |
| Fonts (6 × woff2) | 150 KB |
| **First load, everything** | **269 KB** |

Frame time on a laptop with integrated graphics (headless Chrome): ~17–18 ms at full resolution,
1440×900 and a 390-wide phone layout at 2× pixel density.

## Checks

- Cart and checkout flow 16/16; 360 px: no horizontal scroll at any scroll position.
- Every Azerbaijani letter is drawn by the fonts themselves, in every family and weight used.
- `prefers-reduced-motion`: no opening animation, no inertia or idle motion; scenes follow the scroll.
- JavaScript off: the text is readable as a normal page.

## Honest notes

- KÜLƏK, its products, prices, phone number and e-mail are made up. The footer says so.
- The bottle needs WebGL2. Without it the page still works, without the bottle.

## Run

```
python3 -m http.server 8733
```

then open `http://localhost:8733/`. `?intro=0.5` freezes the opening at a moment (for screenshots).

Fonts: Libre Bodoni and Albert Sans, SIL Open Font License (`fonts/OFL-*.txt`).
