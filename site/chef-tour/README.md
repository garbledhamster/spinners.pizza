# Spinners chef guide

Open [Spinners Pizza](https://spinners.pizza/) and tap **Ask the chef** or **Guide** for menu and dessert shortcuts, visit information, the family story and photos, and four guided tours. Pick a destination to watch him land and point. Use Back and Next during a tour, or Resume tour after taking a detour. Use the stationary **Settings** button at the bottom left to follow sections as you scroll, pause or resume motion, reposition the chef, or hide and show him. Drag him by his artwork, or press Alt + an arrow key while focused. Escape closes the picker or the active guide card.

The page supplies the destinations and narration as static data. Shortcuts use the real page controls, including the hours panel, maps and phone links, and gallery dialog. Visitors can use the guide or navigate directly through the site’s links.

## Adapt it to another page

- Import `mountGuide` from [tour-guide.mjs](tour-guide.mjs) and load [tour-guide.css](tour-guide.css). Use [spinners-tours.mjs](spinners-tours.mjs) as the registration example. Load the registration as a browser module after the page’s targets exist.
- The guide accepts nested `menus` built from entries with a label and child entries, a destination step, or a command. The optional `docks` list pairs sections with headings for opt-in scroll following. See [spinners-menu.mjs](spinners-menu.mjs) for examples.
- Give each step a stable HTML selector, title and text. Optional `aim` sets the point inside the target as two fractions. Optional `landing` prefers left, right, or below where there is space. Optional `padding` sets the highlight’s margin in pixels. Use `avoid` for nearby controls the chef should leave clear.
- Set the character and optional idle anchor in the registration. Use a transparent sprite with the whole prop in frame. Calibrate `emitter` and `grip` as fractions from the image’s top left. Set `aspect`, the unrotated `barrelAngle`, and `maxTilt` in degrees. Swap or restyle the tornado through the image URL and CSS. The beam reads the transformed emitter and uses the same target rectangle as the highlight.
- Override the scoped `--cg-*` CSS properties to match the host site. Confirm both sides of the sprite, a full-width target, and a narrow phone in the browser. Visitors can pause motion. System reduced motion uses still positioning. On short viewports the tour card starts folded to leave room for the page’s controls. Go to highlight moves focus to the actual target, and Escape dismisses the guide when a native dialog is closed.

## Run and verify

From the Counter Ticket checkout:

```sh
npm run build
python3 -m http.server 54243 --bind 127.0.0.1
```

Open [the local site](http://127.0.0.1:54243/). Run `node site/chef-tour/verify-preview.cjs` to replay all four tours in Chromium and WebKit, `node site/chef-tour/verify-guide.cjs` for the shortcuts and guide settings, and `node site/chef-tour/verify-safe-dock.cjs` for native tap targets and page-scroll interruption. Run `node site/chef-tour/verify-release.cjs http://127.0.0.1:54243/ http://127.0.0.1:54243/` for landscape hit targets, keyboard focus, reduced-motion changes during flight, and fallback behavior. Set `SPINNERS_CHROME` to an installed Chrome binary if Playwright Chromium is unavailable.

## Artwork

[chef-peel.png](chef-peel.png) is built-in ImageGen artwork based on the existing Spinners chef in `assets/images/logos/98.png`. Prompt brief: keep the chef’s face, hat, white jacket and red neckerchief, pose him holding a wooden pizza peel, and tape a small red laser pointer to its end. Leave the beam and tornado out of the cutout so the browser can render them as separate layers. The tornado is the existing `assets/images/logos/7.png`.

## Sixteen-pose chef

[spinners-chef-art.mjs](spinners-chef-art.mjs) names 16 active frames across the presentation and flight sheets and the blink cutout. All frames share one display box. The independent peel has its own grip pivot and laser lens. The guide holds the selected head pose while the peel moves. For an inward shot from the side it selects a rear pose. Side shots use the front-facing poses and ordinary interaction returns him to face the visitor. If the peel or beam would cross the head, the outline remains available.

The glide uses distance-based timing and easing. On a long trip the page scrolls with the chef and settles before he points. Nearby destinations can share a shorter hop of about 0.6 seconds. Closing a stop sends him smoothly back to his dock. A quick drag release coasts briefly and leaves thinner mist as it slows. In standby, he balances gently at the waist and blinks every few seconds. Settings → Motion switches the animation off and keeps highlighting and navigation available.

Built-in ImageGen created the [presentation poses](art/chef-presentation.webp), [flight poses](art/chef-flight.webp), [blink](art/chef-blink.webp), and [taped peel](art/laser-peel.webp) from the original prototype mascot. The poses use lossless WebP. The prompts held the same chef hat, long nose, white jacket, red neckerchief and hand-inked style. The pose atlases use evenly spaced waist-up sprites on transparent backgrounds. The blink closes both eyes in the front pose. The separate prop keeps the bright red emitter at the rightmost end, with the beam rendered in the browser.

## Tornado and directional dust

The tornado uses 32 transparent frames, from eight ImageGen key frames with three motion-interpolated drawings between each pair. Register each pose at its waist. The funnel and the foreground curl share that pivot, forming the chef’s lower half. Flight and dragging increase the spin rate. The funnel banks with direction and grows with speed. Four dust sprites are spaced along the path behind the funnel. Faster motion makes the trail longer and slower to fade.

The optional `tornado` art settings in `spinners-chef-art.mjs` accept a horizontal strip of equally sized cells and its frame count. The dust strip has four equal cells ordered left to right. The optional `wrap` strips share the funnel clock. The rear strip paints behind the funnel and the near strip paints above it, under the peel. Regenerate the two 48-frame WebP strips with `node scripts/render-tornado-wrap.cjs`. The original tornado artwork stays available if the spin atlas fails to load.
