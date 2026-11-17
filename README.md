# KÜLƏK — two perfumes from the city of winds (animated concept)

Baku is the city of winds. KÜLƏK is a fictional perfume house with two fragrances named after
them: **Xəzri**, the cold north wind (sea salt, bergamot, cedar), and **Gilavar**, the warm south
wind (saffron, fig, amber). The whole page is one bottle carried by the scroll, and the weather
of the page changes with the wind: misty and cold for Xəzri, dusk-warm for Gilavar.

The site is animation-first on purpose. It shows what a product page can do when the product
itself is the interface.

## Scenes

| Scene | What the scroll does |
| --- | --- |
| Hero | The bottle floats and turns in drifting fog; wind trails cross the page. |
| 01–03 Flakon | One full turn of the twisted glass body, with a degree counter. |
| 04 İçindən | Exploded view: cap, actuator, pump, collar and glass separate, each part labelled. |
| Xəzri | The bottle drains and refills layer by layer (trace, heart, opening) while line drawings of the notes blow in. |
| 05 Hava dəyişir | The wind turns: compass swings north to south, the page goes from cold mist to warm dusk, the juice changes colour layer by layer, Gilavar's notes arrive. |
| 06 Bir basış | The cap lifts off, one press, the spray drifts across the screen and settles into the words "Külək keçir, ətir qalır." |
| Kolleksiya | Pick a wind (the whole page changes weather), pick 30/50/100 ml (the bottle resizes), cart, checkout. |

## How it is built

- Static HTML + CSS + vanilla JS modules, no framework, no CDN, no build step.
- **The bottle is not a model or a video.** `js/bottle.js` is a single WebGL2 fragment shader
  that raymarches signed distance fields: twisted thick glass with a cavity, three layers of
  juice, fluted metal cap, actuator, pump, collar and an engraved plaque. Rays refract into the
  glass, through the juice (Beer–Lambert absorption per layer) and out again, so the backdrop
  bends through the bottle.
- `js/scenes.js` maps each scene's scroll progress to camera, bottle and weather targets;
  `js/main.js` eases toward them every frame, so the motion stays smooth on any scroll input.
- `js/fx.js` draws the 2D layers: wind trails (a flow field), fog, the notes (`js/botanica.js`,
  line drawings) placed clear of the text, and the spray. The spray is fully scroll-driven,
  including the moment the droplets settle into the motto.
- `js/shop.js`: picker, cart drawer, checkout with validation. The cart lives in `localStorage`.
  Nothing is ever sent anywhere.
- Adaptive quality: the render scale drops when frames get slow, and below the floor the
  shader switches to shorter marches.

## Budgets (measured 17.11.2026)

| | Size |
| --- | --- |
| `index.html` | 11.4 KB |
| CSS + JS (uncompressed) | 92 KB |
| Fonts (6 × woff2) | 150 KB |
| **First load, everything** | **264 KB** |

## Checks

- Cart and checkout flow: 16/16 (pick, volume, price, add, quantity, validation, shipping,
  success, empty cart, Escape, persistence).
- 360 px: no horizontal scroll at any scroll position. 390/1440 screenshots of every scene.
- Every Azerbaijani letter is drawn by the font itself (ə Ə ş ğ İ ı ç ö ü) in every font and
  weight used.
- `prefers-reduced-motion`: no inertia, no idle motion, scenes still follow the scroll.
- JavaScript off: the full text is readable as a normal page.

## Honest notes

- KÜLƏK, its products, prices, phone number and e-mail are made up. Footer says so.
- The bottle needs WebGL2. Without it the page still works, but without the bottle.
- Frame times were measured on a laptop GPU. A low-end phone may run at reduced resolution.

## Run

```
python3 -m http.server 8733
```

then open `http://localhost:8733/`.

Fonts: Libre Bodoni and Albert Sans, SIL Open Font License (`fonts/OFL-*.txt`).
