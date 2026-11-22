import { createChefPerformance } from "./chef-performance.mjs?v=3";
import { createGuidePicker } from "./guide-picker.mjs?v=3";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
const degrees = Math.PI / 180;
const viewport = () => ({
  width: document.documentElement.clientWidth,
  height: window.innerHeight,
});
const visible = (rect, height) => rect.bottom > 4 && rect.top < height - 4;
const targetFor = target => typeof target === "string" ? document.querySelector(target) : target;
const easeScroll = t => t * t * (3 - 2 * t);
const scrollKeys = new Set(["Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", " "]);
const nativeControls = "a[href], button, summary, input, select, textarea, label, [tabindex]:not([tabindex='-1'])";
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const afterScroll = (rect, distance) => ({
  left: rect.left, right: rect.right, width: rect.width, height: rect.height,
  top: rect.top - distance, bottom: rect.bottom - distance,
});

function validTarget(reference) {
  const target = targetFor(reference);
  return target?.getClientRects().length ? target : null;
}

function disclosureShows(target) {
  for (let details = target.parentElement?.closest("details:not([open])"); details;
    details = details.parentElement?.closest("details:not([open])")) {
    if (!details.querySelector(":scope > summary")?.contains(target)) return false;
  }
  return true;
}

export function mountGuide({ character, tours = [], menus = [], docks = [] }) {
  const targetExists = step => targetFor(step.target)?.isConnected || targetFor(step.fallback)?.isConnected;
  const availableEntries = entries => entries
    .map(entry => Array.isArray(entry.entries) ? { ...entry, entries: availableEntries(entry.entries) } : entry)
    .filter(entry => entry.step ? targetExists(entry.step) : !Array.isArray(entry.entries) || entry.entries.length);
  const readyTours = tours
    .map(tour => ({ ...tour, steps: tour.steps.filter(targetExists) }))
    .filter(tour => tour.steps.length);
  const readyMenus = availableEntries(menus);
  if (!readyTours.length && !readyMenus.length) return;

  const root = document.createElement("div");
  root.className = "chef-guide";
  // The site supplies the menu destinations and narration.
  root.innerHTML = `
    <div class="cg-highlight" aria-hidden="true" hidden></div>
    <div class="cg-laser" aria-hidden="true" hidden></div>
    <div class="cg-dot" aria-hidden="true" hidden></div>
    <div class="cg-avatar">
      <div class="cg-visual" aria-hidden="true">
        <img class="cg-tornado" alt="" draggable="false">
        <span class="cg-pose" aria-hidden="true">
          <span class="cg-sprite">
            <img class="cg-art" alt="" draggable="false">
            <i class="cg-emitter"></i>
          </span>
        </span>
      </div>
      <button type="button" class="cg-launch" aria-controls="chef-tour-picker" aria-expanded="false">
        <span class="cg-launch-label">Ask the chef</span>
        <span class="cg-compact-label" aria-hidden="true">Guide</span>
      </button>
      <p class="cg-follow-note" aria-hidden="true" hidden></p>
    </div>
    <section class="cg-card cg-picker" id="chef-tour-picker" aria-labelledby="chef-tour-heading" hidden>
      <div class="cg-picker-body">
        <header class="cg-card-head">
          <button type="button" class="cg-picker-back" aria-label="Back" hidden>‹</button>
          <h2 id="chef-tour-heading">What can I show you?</h2>
          <button type="button" class="cg-close-picker" aria-label="Close guide menu">×</button>
        </header>
        <p class="cg-picker-copy" hidden></p>
        <p class="cg-picker-error" hidden></p>
        <div class="cg-choices"></div>
        <footer class="cg-picker-foot" hidden></footer>
      </div>
    </section>
    <section class="cg-card cg-step" aria-labelledby="chef-step-title" hidden>
      <header class="cg-card-head">
        <div class="cg-step-status"><span class="cg-progress"></span><strong class="cg-compact-title" hidden></strong></div>
        <button type="button" class="cg-expand" aria-controls="chef-step-body" aria-expanded="true" hidden>Details</button>
        <button type="button" class="cg-exit" aria-label="End tour">×</button>
      </header>
      <div class="cg-narration" id="chef-step-body">
        <h2 id="chef-step-title"></h2>
        <p class="cg-copy" id="chef-step-copy"></p>
        <div class="cg-tip-actions">
          <button type="button" class="cg-point">Point again</button>
          <button type="button" class="cg-focus-target">Go to highlight</button>
          <a class="cg-tip-link" hidden></a>
          <button type="button" class="cg-tip-button" hidden></button>
        </div>
      </div>
      <footer class="cg-controls">
        <button class="cg-tours" type="button">Switch tour</button>
        <button class="cg-back" type="button">Back</button>
        <button class="cg-next" type="button">Next</button>
      </footer>
    </section>
    <div class="cg-announcement" role="status" aria-live="polite"></div>
  `;
  const find = selector => root.querySelector(selector);
  const [avatar, launch, pose, sprite, art, tornado, emitter, picker, stepCard, highlight, laser, dot] =
    [".cg-avatar", ".cg-launch", ".cg-pose", ".cg-sprite", ".cg-art", ".cg-tornado", ".cg-emitter",
      ".cg-picker", ".cg-step", ".cg-highlight", ".cg-laser", ".cg-dot"].map(find);
  const next = find(".cg-next");
  const back = find(".cg-back");
  const stepTitle = find("#chef-step-title");
  const compactTitle = find(".cg-compact-title");
  const stepBody = find("#chef-step-body");
  const expand = find(".cg-expand");
  const progressLabel = find(".cg-progress");
  const copy = find(".cg-copy");
  const tipLink = find(".cg-tip-link");
  const tipButton = find(".cg-tip-button");
  const stepMenuButton = find(".cg-tours");
  const compactLabel = find(".cg-compact-label");
  const launchLabel = find(".cg-launch-label");
  const askLabel = `Ask the ${character.name}`;
  const announcement = find(".cg-announcement");
  const pickerError = find(".cg-picker-error");
  const followNote = find(".cg-follow-note");
  const visual = find(".cg-visual");
  for (const [image, src] of [[art, character.image], [tornado, character.tornado]]) {
    image.addEventListener("error", () => { image.hidden = true; }, { once: true });
    image.src = src;
  }
  launch.setAttribute("aria-label", askLabel);
  stepTitle.tabIndex = -1;
  sprite.style.aspectRatio = character.aspect;
  sprite.style.transformOrigin = character.grip.map(n => `${n * 100}%`).join(" ");
  [emitter.style.left, emitter.style.top] = character.emitter.map(n => `${n * 100}%`);
  document.body.append(root);

  const shortScreen = matchMedia("(max-height: 500px)");
  let paused = false;
  let selection = null;
  let savedTour = null;
  let follow = false;
  let followTimer;
  let followNoteTimer;
  let followedSection;
  let parkedCorner;
  let hidden = false;
  let photoOpener;
  let position = { x: 0, y: 0 };
  let drag = null;
  let dragFrame = 0;
  let suppressClick = false;
  let manuallyPlaced = false;
  let animationFrame = 0;
  let scrollFrame = 0;
  let dockFrame = 0;
  let keepSamplingUntil = 0;
  let beamReadyAt = 0;
  const still = () => paused;
  const performer = character.performance && createChefPerformance({
    root, avatar, pose, tornado, config: character.performance, still,
  });

  function withinViewport(x, y) {
    const screen = viewport();
    return {
      x: clamp(x, 8, screen.width - avatar.offsetWidth - 8),
      y: clamp(y, 8, screen.height - avatar.offsetHeight - 8),
    };
  }

  function moveTo(x, y) {
    position = withinViewport(x, y);
    avatar.style.setProperty("--cg-x", `${position.x}px`);
    avatar.style.setProperty("--cg-y", `${position.y}px`);
    if (!picker.hidden) placePicker();
    return position;
  }

  function hidePointing() {
    highlight.hidden = laser.hidden = dot.hidden = true;
  }

  function coachPlacement(rect, step, scrollDistance = 0) {
    const screen = viewport();
    const w = avatar.offsetWidth;
    const h = visual.offsetHeight;
    const floor = stepCard.hidden ? screen.height - h - 12 : stepCard.getBoundingClientRect().top - h - 15;
    const [u, v] = step.aim ?? [.5, .5];
    const point = (fraction, height = v) => ({
      aimX: clamp(rect.left + rect.width * fraction, Math.max(4, rect.left), Math.min(screen.width - 4, rect.right)),
      aimY: clamp(rect.top + rect.height * height, Math.max(4, rect.top), Math.min(screen.height - 4, rect.bottom)),
    });
    const avoid = step.avoid ? [...document.querySelectorAll(step.avoid)]
      .map(el => afterScroll(el.getBoundingClientRect(), scrollDistance)) : [];
    const coversControl = (x, y) => avoid.some(box => x < box.right && x + w > box.left && y < box.bottom && y + h > box.top);
    const leftSpace = rect.left - 12;
    const rightSpace = screen.width - rect.right - 12;
    const sides = step.landing === "left" || (step.landing !== "right" && leftSpace > rightSpace) ? [1, -1] : [-1, 1];
    for (const side of sides) {
      const available = side === 1 ? leftSpace : rightSpace;
      if (available < w + 14) continue;
      const x = side === 1 ? rect.left - w - 18 : rect.right + 18;
      const inset = Math.min(.32, 20 / rect.width);
      const destination = point(step.aim ? u : side === 1 ? inset : 1 - inset);
      const muzzleHeight = performer?.ready ? .48 : character.emitter[1];
      const y = clamp(destination.aimY + 3 - sprite.offsetHeight * muzzleHeight, 12, floor);
      if (!coversControl(x, y)) return { x, y, side, ...destination };
    }

    // Full-width controls usually leave room above them rather than beside them.
    const canFitAbove = rect.top >= h + 18;
    const fitsBelow = rect.bottom + 11 <= floor;
    const above = (step.landing !== "below" && canFitAbove) || !fitsBelow;
    const side = rect.left + rect.width * u < screen.width / 2 ? -1 : 1;
    const y = clamp(above ? rect.top - h - 7 : rect.bottom + 11, 12, floor);
    const dock = (facing, top) => ({
      x: facing === 1 ? 12 : screen.width - w - 12,
      y: top,
      side: facing,
      ...point(step.aim ? u : facing === 1 ? .74 : .26, step.aim ? v : above ? .15 : .85),
    });
    const preferred = dock(side, y);
    if (!coversControl(preferred.x, preferred.y)) return preferred;
    const offsets = avoid.flatMap(box => [box.top - h - 6, box.bottom + 6])
      .map(top => clamp(top, 12, floor))
      .sort((a, b) => Math.abs(a - y) - Math.abs(b - y));
    const alternatives = [...offsets.map(top => dock(side, top)), dock(-side, y)];
    return alternatives.find(place => !coversControl(place.x, place.y)) ?? preferred;
  }

  function queueFrame(duration = 520) {
    keepSamplingUntil = Math.max(keepSamplingUntil, performance.now() + duration);
    if (!animationFrame) animationFrame = requestAnimationFrame(paint);
  }

  function paint(now) {
    animationFrame = 0;
    const current = selection?.target;
    const screen = viewport();
    if (!current?.isConnected || !picker.hidden || selection.transitioning || drag?.moved || performer?.traveling || performer?.coasting ||
      !disclosureShows(current) || document.querySelector("dialog[open]")) {
      hidePointing();
    } else {
      const rect = current.getBoundingClientRect();
      if (!visible(rect, screen.height)) {
        hidePointing();
      } else {
        const step = selection.step;
        const { aimX, aimY } = coachPlacement(rect, step);
        const padding = step.padding ?? 6;
        const x = clamp(rect.left - padding, 2, screen.width - 2);
        const y = clamp(rect.top - padding, 2, screen.height - 2);
        highlight.style.translate = `${x}px ${y}px`;
        highlight.style.width = `${clamp(rect.right + padding, x, screen.width - 2) - x}px`;
        highlight.style.height = `${clamp(rect.bottom + padding, y, screen.height - 2) - y}px`;
        highlight.hidden = false;
        // Read the *drawn* nozzle after sprite tilt, mirroring, and avatar motion.
        const source = performer?.ready ? performer.source : emitter;
        const lens = source?.getBoundingClientRect();
        const dx = aimX - (lens?.x ?? aimX);
        const dy = aimY - (lens?.y ?? aimY);
        const facing = performer?.side ?? Number(avatar.dataset.side || "1");
        const correctSide = (dx * facing) > 10;
        laser.hidden = dot.hidden = picker.hidden === false || !correctSide || now < beamReadyAt;
        if (!laser.hidden) {
          laser.style.transform = `translate(${lens.x}px, ${lens.y}px) rotate(${Math.atan2(dy, dx)}rad)`;
          laser.style.width = `${Math.hypot(dx, dy)}px`;
          dot.style.translate = `${aimX}px ${aimY}px`;
        }
      }
    }
    if (now < keepSamplingUntil) animationFrame = requestAnimationFrame(paint);
  }

  function aimAt(placement, animate = false) {
    avatar.dataset.side = placement.side;
    if (performer?.ready) {
      performer.aim(position, { x: placement.aimX, y: placement.aimY }, viewport(), placement.side, animate);
      return;
    }
    const w = pose.offsetWidth;
    const h = sprite.offsetHeight;
    const [gripX, gripY] = character.grip;
    const [tipX, tipY] = character.emitter;
    const pivotX = position.x + w * (placement.side === 1 ? gripX : 1 - gripX);
    const pivotY = position.y + h * gripY;
    const dx = (placement.aimX - pivotX) * placement.side;
    const dy = placement.aimY - pivotY;
    const barrel = character.barrelAngle * degrees;
    // The pointer sits above the grip. Aim its parallel offset at the target.
    const barrelOffset = -Math.sin(barrel) * w * (tipX - gripX) + Math.cos(barrel) * h * (tipY - gripY);
    const offset = Math.asin(clamp(barrelOffset / Math.max(1, Math.hypot(dx, dy)), -1, 1));
    const tilt = clamp((Math.atan2(dy, dx) - barrel - offset) / degrees, -character.maxTilt, character.maxTilt);
    sprite.style.setProperty("--cg-tilt", `${tilt}deg`);
  }

  function visibleControls(screen) {
    return [...document.querySelectorAll(nativeControls)].flatMap(control => {
      if (root.contains(control)) return [];
      const box = control.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.right > 0 && box.left < screen.width &&
        visible(box, screen.height) && disclosureShows(control) && getComputedStyle(control).visibility === "visible"
        ? [box] : [];
    });
  }

  function idleDock(screen, w, h) {
    const anchor = character.idleAnchor && validTarget(character.idleAnchor);
    const home = anchor?.getBoundingClientRect();
    const controls = visibleControls(screen);
    const clear = box => !controls.some(control => overlaps(box, control));
    const mobile = screen.width <= 700;
    if (!hidden && home && home.bottom > 0 && home.top < screen.height) {
      const credit = anchor.querySelector("figcaption")?.getBoundingClientRect();
      const control = anchor.querySelector("button:not([hidden])")?.getBoundingClientRect();
      const right = mobile && credit ? credit.left - 8 : home.right - 10;
      const bottom = mobile ? home.bottom : Math.min(home.bottom - 22, (credit?.top ?? home.bottom) - 8);
      const lastRow = screen.height - h - 8;
      const firstRow = Math.max(8, home.top - (mobile ? 16 : 0));
      const y = clamp(bottom - h, firstRow, lastRow);
      const labelHalfWidth = launchLabel.offsetWidth / 2;
      const lefts = [right - w, home.left + 8];
      if (control && control.bottom > y - 12 && control.top < y + h && control.left < right + 8) {
        lefts.unshift(control.left - w - 8);
      }
      const rows = mobile ? [y, Math.min(y + 16, lastRow)] : [y];
      for (const top of rows) {
        if (top < firstRow || top > lastRow || top + visual.offsetHeight > home.bottom) continue;
        for (const x of lefts) {
          if (!(x >= Math.max(8, home.left) && x + w <= Math.min(home.right, screen.width - 8))) continue;
          const center = x + w / 2;
          const halfWidth = Math.max(w * .3, labelHalfWidth);
          if (clear({ left: center - halfWidth, right: center + halfWidth, top: top + 8, bottom: top + h })) {
            return { x, y: top };
          }
        }
      }
    }

    // Prefer a bottom corner, then look for a gap between native controls.
    const width = compactLabel.offsetWidth;
    const height = compactLabel.offsetHeight;
    const right = screen.width - width - 12;
    const bottom = screen.height - height - 12;
    const tops = [bottom, ...controls.map(box => box.top - height - 4).sort((a, b) => b - a), 12];
    const lefts = [right, 12, ...controls.flatMap(box => [box.right + 4, box.left - width - 4])];
    for (const top of tops) {
      if (top < 8 || top > bottom) continue;
      for (const left of lefts) {
        if (left >= 8 && left <= right &&
            clear({ left, top, right: left + width, bottom: top + height })) return { left, top };
      }
    }
    return { left: right, top: bottom, obstructed: true };
  }

  function showFullChef() {
    delete avatar.dataset.compact;
  }

  function dockPosition(dock) {
    return dock.left === undefined
      ? withinViewport(dock.x, dock.y)
      : withinViewport(dock.left, dock.top - avatar.offsetHeight + compactLabel.offsetHeight);
  }

  function applyDock(dock) {
    const { x, y } = dockPosition(dock);
    if (dock.left === undefined) {
      showFullChef();
    } else {
      avatar.dataset.compact = dock.obstructed ? "obstructed" : "";
      avatar.style.setProperty("--cg-guide-x", `${dock.left - x}px`);
      avatar.style.setProperty("--cg-guide-y", `${dock.top - y}px`);
    }
    moveTo(x, y);
  }

  function queueIdleDock() {
    if (dockFrame || selection || (!hidden && (manuallyPlaced || parkedCorner))) return;
    dockFrame = requestAnimationFrame(() => {
      dockFrame = 0;
      if (selection || drag || performer?.traveling || performer?.coasting ||
          (!hidden && (manuallyPlaced || parkedCorner))) return;
      applyDock(idleDock(viewport(), avatar.offsetWidth, avatar.offsetHeight));
    });
  }

  function park(animate = false) {
    performer?.cancel();
    performer?.park();
    hideFollowNote();
    const screen = viewport();
    const w = avatar.offsetWidth;
    const h = avatar.offsetHeight;
    avatar.dataset.side = "1";
    sprite.style.setProperty("--cg-tilt", "0deg");
    const destination = parkedCorner && !hidden ? {
      x: parkedCorner.endsWith("left") ? 16 : screen.width - w - 16,
      y: parkedCorner.startsWith("top") ? 18 : screen.height - h - 20,
    } : idleDock(screen, w, h);
    const target = dockPosition(destination);
    if (animate && performer?.ready && Math.hypot(target.x - position.x, target.y - position.y) > 8) {
      showFullChef();
      performer.travel(position, target, moveTo, () => {
        applyDock(destination);
        performer.park();
        queueIdleDock();
      });
    } else applyDock(destination);
  }

  function reaim(animate = false) {
    if (!selection || selection.transitioning || drag?.moved || performer?.traveling || performer?.coasting || !picker.hidden || document.querySelector("dialog[open]")) return;
    const rect = selection.target.getBoundingClientRect();
    if (!visible(rect, viewport().height) || !disclosureShows(selection.target)) return;
    const placement = coachPlacement(rect, selection.step);
    placement.side = placement.aimX > position.x + avatar.offsetWidth * .5 ? 1 : -1;
    aimAt(placement, animate);
    queueFrame(animate ? 520 : 330);
  }

  function placePicker() {
    const screen = viewport();
    const margin = 10;
    const gap = 13;
    const preferredWidth = Math.min(312, screen.width - 2 * margin);
    const compact = avatar.hasAttribute("data-compact");
    const box = (compact ? launch : avatar).getBoundingClientRect();
    const voiceX = (box.left + box.right) / 2;
    const voiceY = box.top + box.height * (compact ? .5 : .26);
    const leftRoom = box.left - margin - gap;
    const rightRoom = screen.width - box.right - margin - gap;
    const aboveRoom = box.top - margin - gap;
    const belowRoom = screen.height - box.bottom - margin - gap;
    const sideRoom = Math.max(leftRoom, rightRoom);
    const verticalRoom = Math.max(aboveRoom, belowRoom);
    const beside = sideRoom >= preferredWidth || (verticalRoom < 156 && sideRoom >= 172);
    const width = beside ? Math.min(preferredWidth, sideRoom) : preferredWidth;
    const room = beside ? screen.height - 2 * margin : verticalRoom;
    picker.style.setProperty("--cg-picker-width", `${width}px`);
    picker.style.setProperty("--cg-picker-room", `${Math.max(0, room)}px`);
    const height = picker.offsetHeight;

    let left, top, tail, offset;
    if (beside) {
      const onLeft = leftRoom >= width && (rightRoom < width || picker.dataset.tail !== "left");
      left = onLeft ? box.left - gap - width : box.right + gap;
      top = clamp(voiceY - height * .22, margin, screen.height - height - margin);
      tail = onLeft ? "right" : "left";
      offset = clamp(voiceY - top, 16, height - 16);
    } else {
      // Give the current edge a small bias to avoid alternating sides near the midpoint.
      const edgeBias = picker.dataset.tail === "top" ? 14 : -14;
      const above = belowRoom < height || (aboveRoom >= height && aboveRoom >= belowRoom + edgeBias);
      top = above ? box.top - gap - height : box.bottom + gap;
      left = clamp(voiceX - width / 2, margin, screen.width - width - margin);
      tail = above ? "bottom" : "top";
      offset = clamp(voiceX - left, 18, width - 18);
    }
    picker.dataset.tail = tail;
    picker.style.setProperty("--cg-tail-offset", `${offset}px`);
    picker.style.inset = `${clamp(top, margin, screen.height - height - margin)}px auto auto ${left}px`;
  }

  const toursMenu = {
    label: "Guided tours",
    entries: readyTours.map(tour => ({ label: tour.name, tour })),
  };
  const positionMenu = {
    label: "Move chef",
    text: "Choose a corner or drag me where you want me.",
    entries: ["Top left", "Top right", "Bottom left", "Bottom right"].map(label => ({
      label,
      run: () => setCorner(label.toLowerCase()),
    })),
  };
  const settingsMenu = {
    label: "Guide settings",
    entries: () => [
      {
        label: "Follow me", status: follow ? "On" : "Off", pressed: follow,
        run: () => {
          follow = !follow;
          hideFollowNote();
          followedSection = undefined;
          clearTimeout(followTimer);
          menu.render();
        },
      },
      {
        id: "motion",
        label: paused ? "Resume motion" : "Pause motion",
        run: () => {
          paused = !paused;
          syncMotion();
        },
      },
      positionMenu,
      { label: "Reset position", run: () => setCorner(undefined) },
      { label: "Hide chef", run: hideChef },
    ],
  };
  const homeMenu = {
    label: "What can I show you?",
    entries: () => [
      ...(savedTour ? [{ label: "Resume tour", run: resumeTour }] : []),
      ...readyMenus,
      ...(readyTours.length ? [toursMenu] : []),
    ],
    footer: [settingsMenu],
  };
  const menu = createGuidePicker({ picker, home: homeMenu, choose, place: placePicker });

  function choose(entry) {
    pickerError.hidden = true;
    if (entry.entries) menu.openMenu(entry);
    else if (entry.tour) renderStep(entry.tour, 0);
    else if (entry.step) present(entry.step);
    else entry.run({ openMenu: menu.openMenu });
  }

  function stopFreeMovement() {
    performer?.stopCoast();
    if (!selection && performer?.traveling) {
      performer.cancel();
      performer.park();
      queueIdleDock();
    }
  }

  function openPicker(open, page) {
    picker.hidden = !open;
    stepCard.hidden = open || !selection;
    launch.setAttribute("aria-expanded", String(open));
    if (open) {
      stopFreeMovement();
      hideFollowNote();
      pickerError.hidden = true;
      if (selection && !performer?.traveling) performer?.speak(() => {});
      menu.reset(!page);
      if (page) menu.openMenu(page);
    } else if (performer?.ready) {
      if (selection) reaim();
      else if (!performer.traveling) performer.park();
    }
    queueFrame(80);
  }

  function closePicker(returnFocus = true) {
    openPicker(false);
    if (returnFocus) (selection ? stepBody.hidden ? expand : stepTitle : launch).focus({ preventScroll: true });
  }

  function endTour(returnFocus = true, animateReturn = true) {
    cancelAnimationFrame(scrollFrame);
    if (selection?.tour) savedTour = null;
    selection = null;
    root.classList.remove("cg-active");
    openPicker(false);
    hidePointing();
    manuallyPlaced = false;
    followedSection = undefined;
    park(animateReturn);
    if (returnFocus) launch.focus({ preventScroll: true });
  }

  function resumeTour() {
    const { tour, index } = savedTour;
    if (selection?.tour === tour && selection.index === index &&
        disclosureShows(selection.target) && visible(selection.target.getBoundingClientRect(), viewport().height)) closePicker();
    else renderStep(tour, index);
  }

  function setCorner(corner) {
    parkedCorner = corner;
    manuallyPlaced = false;
    followedSection = undefined;
    park();
    if (selection) reaim();
  }

  function hideChef() {
    savedTour = null;
    endTour(false, false);
    hidden = true;
    performer?.cancel();
    performer?.wake?.clear();
    launch.setAttribute("aria-label", "Guide");
    applyDock(idleDock(viewport(), avatar.offsetWidth, avatar.offsetHeight));
    launch.focus({ preventScroll: true });
  }

  function prepareTarget(step) {
    step.prepare?.();
    const candidate = targetFor(step.target) ?? targetFor(step.fallback);
    // A leaf can point inside a native disclosure that is currently shut.
    if (candidate) {
      for (let node = candidate.closest("details"); node; node = node.parentElement.closest("details")) {
        node.open = true;
      }
    }
    return validTarget(candidate) ?? validTarget(step.fallback);
  }

  function updateStepAction() {
    const action = selection?.step.action;
    const link = action && targetFor(action.link);
    const show = link && (action.when?.() ?? true);
    tipLink.hidden = !show || action.activate;
    tipButton.hidden = !show || !action.activate;
    if (!show) return;
    const control = action.activate ? tipButton : tipLink;
    control.textContent = action.label;
    if (!action.activate) tipLink.href = link.href;
  }

  function foldStep(collapsed) {
    expand.hidden = !shortScreen.matches;
    expand.setAttribute("aria-expanded", String(!collapsed));
    expand.textContent = collapsed ? "Details" : "Less";
    stepBody.hidden = collapsed;
    compactTitle.hidden = !collapsed;
  }

  function renderStep(tour, index) {
    present(tour.steps[index], { tour, index });
  }

  function present(step, { tour, index } = {}) {
    const target = prepareTarget(step);
    if (!target) {
      const message = "That spot is unavailable right now.";
      pickerError.textContent = message;
      pickerError.hidden = false;
      if (!picker.hidden) placePicker();
      announcement.textContent = message;
      return;
    }
    cancelAnimationFrame(scrollFrame);
    if (performer?.traveling) performer.cancel();
    hideFollowNote();
    const active = { step, target, tour, index, transitioning: true };
    const narration = target !== targetFor(step.target) ? step.fallbackText ?? step.text : step.text;
    selection = active;
    if (tour) savedTour = { tour, index };
    manuallyPlaced = false;
    showFullChef();
    root.classList.add("cg-active");
    picker.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    stepCard.hidden = false;
    stepCard.dataset.enRoute = "";
    progressLabel.textContent = tour ? `${tour.name} · ${index + 1} of ${tour.steps.length}` : "Ask the chef";
    stepTitle.textContent = compactTitle.textContent = step.title;
    foldStep(shortScreen.matches);
    copy.textContent = narration ?? "";
    copy.hidden = !narration;
    back.hidden = next.hidden = !tour;
    back.disabled = index === 0;
    next.textContent = tour && index === tour.steps.length - 1 ? "Finish" : "Next";
    stepMenuButton.textContent = tour ? "Switch tour" : "Guide menu";
    find(".cg-exit").setAttribute("aria-label", tour ? "End tour" : "Close guide tip");
    updateStepAction();
    (stepBody.hidden ? expand : stepTitle).focus({ preventScroll: true });

    const screen = viewport();
    const rect = target.getBoundingClientRect();
    const startY = window.scrollY;
    const endY = clamp(startY + rect.top - screen.height * .26, 0, document.documentElement.scrollHeight - screen.height);
    const distance = endY - startY;
    const movingPage = Math.abs(distance) > 1;
    const scrollDuration = movingPage ? clamp(500 + Math.abs(distance) * .22, 720, 1350) : 0;
    const placement = coachPlacement(afterScroll(rect, distance), step, distance);
    const scrollPage = progress => {
      if (movingPage) window.scrollTo({ top: startY + distance * easeScroll(progress), behavior: "instant" });
    };
    const arrived = () => {
      if (selection !== active) return;
      active.transitioning = false;
      delete stepCard.dataset.enRoute;
      const final = coachPlacement(target.getBoundingClientRect(), step);
      moveTo(final.x, final.y);
      const point = () => {
        if (selection === active) reaim(true);
      };
      if (performer?.ready && picker.hidden) performer.speak(point);
      else point();
      stepCard.classList.remove("cg-enter");
      requestAnimationFrame(() => stepCard.classList.add("cg-enter"));
      announcement.textContent = narration ? `${step.title}. ${narration}` : step.title;
      queueFrame();
    };
    hidePointing();
    if (performer?.ready) {
      beamReadyAt = 0;
      // Hold the page still for the last part of the flight so the destination can settle.
      performer.travel({ ...position }, placement, (x, y, progress) => {
        scrollPage(Math.min(1, progress / .86));
        moveTo(x, y);
      }, arrived, scrollDuration / .86);
      queueFrame(2500);
    } else {
      const started = performance.now();
      const scroll = now => {
        const progress = !movingPage || still() ? 1 : clamp((now - started) / scrollDuration, 0, 1);
        scrollPage(progress);
        if (progress < 1) scrollFrame = requestAnimationFrame(scroll);
        else {
          beamReadyAt = performance.now() + (still() ? 0 : 460);
          arrived();
        }
      };
      scroll(started);
    }
  }

  function interruptTravel() {
    if (!selection?.transitioning) return;
    cancelAnimationFrame(scrollFrame);
    performer?.cancel();
    performer?.park();
    selection.transitioning = false;
    delete stepCard.dataset.enRoute;
    reaim();
    queueFrame();
  }

  function hideFollowNote() {
    clearTimeout(followNoteTimer);
    followNote.hidden = true;
  }

  function followSection() {
    if (!follow || hidden || selection || !picker.hidden || drag?.moved || performer?.coasting || document.querySelector("dialog[open]")) return;
    const edge = viewport().height * .32;
    const dock = docks.find(([section]) => {
      const box = validTarget(section)?.getBoundingClientRect();
      return box && box.top <= edge && box.bottom > edge;
    });
    if (!dock || dock === followedSection) return;
    const [, heading, narration] = dock;
    const target = validTarget(heading);
    if (!target) return;
    followedSection = dock;
    manuallyPlaced = true;
    showFullChef();
    const rect = target.getBoundingClientRect();
    const visibleHeading = rect.top < 20
      ? { left: rect.left, right: rect.right, width: rect.width, top: 20, bottom: 64, height: 44 }
      : rect;
    const place = coachPlacement(visibleHeading, {});
    hideFollowNote();
    if (narration) {
      followNote.textContent = narration;
      followNote.style.visibility = "hidden";
      followNote.hidden = false;
      const spill = followNote.offsetTop + followNote.offsetHeight - avatar.offsetHeight;
      followNote.hidden = true;
      followNote.style.removeProperty("visibility");
      place.y = Math.min(place.y, viewport().height - avatar.offsetHeight - Math.max(0, spill) - 8);
    }
    const arrive = () => {
      performer?.park();
      if (!narration || !follow || hidden || selection || !picker.hidden) return;
      followNote.hidden = false;
      followNoteTimer = setTimeout(hideFollowNote, 3000);
    };
    if (performer?.ready) performer.travel({ ...position }, place, moveTo, arrive);
    else {
      moveTo(place.x, place.y);
      arrive();
    }
  }

  launch.addEventListener("click", () => {
    if (suppressClick) return;
    if (hidden) {
      hidden = false;
      launch.setAttribute("aria-label", askLabel);
      park();
    }
    if (picker.hidden) openPicker(true);
    else closePicker();
  });
  stepMenuButton.addEventListener("click", () => openPicker(true, selection?.tour ? toursMenu : undefined));
  find(".cg-close-picker").addEventListener("click", () => closePicker());
  find(".cg-exit").addEventListener("click", () => endTour());
  expand.addEventListener("click", () => {
    foldStep(!stepBody.hidden);
    reaim();
    queueFrame();
  });
  shortScreen.addEventListener("change", () => foldStep(shortScreen.matches));
  find(".cg-point").addEventListener("click", () => {
    if (!disclosureShows(selection.target) || !visible(selection.target.getBoundingClientRect(), viewport().height)) {
      present(selection.step, selection);
    } else reaim(true);
  });
  find(".cg-focus-target").addEventListener("click", () => {
    const target = selection && prepareTarget(selection.step);
    if (!target) return;
    if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) {
      target.tabIndex = -1;
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    }
    interruptTravel();
    if (!visible(target.getBoundingClientRect(), viewport().height)) {
      target.scrollIntoView({ block: "center", behavior: still() ? "instant" : "smooth" });
    }
    target.focus({ preventScroll: true });
  });
  tipButton.addEventListener("click", () => {
    targetFor(selection.step.action.link)?.click();
    photoOpener = document.querySelector("dialog[open]") ? tipButton : undefined;
    hidePointing();
  });
  document.addEventListener("close", () => {
    if (photoOpener) {
      const opener = photoOpener;
      photoOpener = undefined;
      requestAnimationFrame(() => opener.focus({ preventScroll: true }));
    }
    reaim();
  }, true);
  document.addEventListener("input", updateStepAction);
  document.addEventListener("toggle", event => {
    if (selection && event.target.matches("details")) {
      if (!performer?.busy) reaim();
      queueFrame();
    } else if (event.target.matches("details")) queueIdleDock();
  }, true);
  back.addEventListener("click", () => renderStep(selection.tour, selection.index - 1));
  next.addEventListener("click", () => {
    const { tour, index } = selection;
    if (index + 1 === tour.steps.length) endTour();
    else renderStep(tour, index + 1);
  });

  function syncMotion() {
    root.classList.toggle("cg-still", still());
    if (still()) {
      performer?.stopCoast();
      if (drag?.moved) performer?.endDrag();
      performer?.wake?.clear();
    }
    if (!picker.hidden) menu.render();
    if (selection) reaim();
    else if (!performer?.traveling && !performer?.coasting) performer?.park();
  }

  syncMotion();

  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
    if (event.key !== "Escape") {
      const focus = document.activeElement;
      if (selection?.transitioning && scrollKeys.has(event.key) && !focus?.isContentEditable &&
          !focus?.matches("input, select, textarea") &&
          !(event.key === " " && focus?.closest("button, summary, [role=button]"))) interruptTravel();
      return;
    }
    const focusInGuide = root.contains(document.activeElement);
    if (!picker.hidden) {
      event.preventDefault();
      closePicker(focusInGuide);
    } else if (selection) {
      event.preventDefault();
      endTour(focusInGuide);
    }
  });
  root.addEventListener("keydown", event => {
    if (event.target !== launch || !event.altKey || hidden) return;
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    interruptTravel();
    manuallyPlaced = true;
    showFullChef();
    performer?.cancel();
    moveTo(position.x + 28 * direction[0], position.y + 28 * direction[1]);
    reaim();
    if (!selection) performer?.park();
    queueFrame();
  });

  launch.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || hidden) return;
    stopFreeMovement();
    const rect = avatar.getBoundingClientRect();
    const compact = avatar.hasAttribute("data-compact");
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: compact ? event.clientX - rect.width / 2 : rect.x,
      y: compact ? event.clientY - visual.offsetHeight / 2 : rect.y,
      started: event.timeStamp, moved: false };
    launch.setPointerCapture(event.pointerId);
  });

  function drawDrag() {
    dragFrame = 0;
    if (!drag?.point) return;
    const { x, y, at } = drag.point;
    drag.point = null;
    if (!root.classList.contains("cg-dragging")) {
      hideFollowNote();
      interruptTravel();
      performer?.cancel();
      performer?.wake?.begin(position, Math.max(drag.started, at - 32));
      showFullChef();
      root.classList.add("cg-dragging");
    }
    moveTo(x, y);
    performer?.dragTo(position, at);
    queueFrame(65);
  }

  launch.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    manuallyPlaced = true;
    drag.point = { x: drag.x + dx, y: drag.y + dy, at: event.timeStamp };
    if (!dragFrame) dragFrame = requestAnimationFrame(drawDrag);
  });
  function stopDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    if (event.type === "pointerup") drawDrag();
    if (event.type === "pointerup" && drag.moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
    const moved = drag.moved;
    drag = null;
    root.classList.remove("cg-dragging");
    if (moved) {
      const settle = () => {
        if (selection) reaim(true);
        else performer?.park();
        queueFrame();
      };
      if (performer && event.type === "pointerup") performer.coast(position, moveTo, settle);
      else {
        performer?.endDrag();
        settle();
      }
    } else queueIdleDock();
  }
  launch.addEventListener("pointerup", stopDrag);
  launch.addEventListener("pointercancel", stopDrag);
  launch.addEventListener("lostpointercapture", stopDrag);

  // Outside dismissal leaves the tapped page control in charge of its own focus.
  document.addEventListener("pointerdown", event => {
    if (!picker.hidden && !root.contains(event.target)) closePicker(false);
  });
  window.addEventListener("resize", () => {
    if (selection?.transitioning) return;
    performer?.stopCoast();
    const rect = selection?.target.getBoundingClientRect();
    if (rect && picker.hidden && !manuallyPlaced && visible(rect, viewport().height)) {
      performer?.cancel();
      const destination = coachPlacement(rect, selection.step);
      moveTo(destination.x, destination.y);
      reaim();
    } else if (manuallyPlaced || selection) {
      moveTo(position.x, position.y);
    } else {
      park();
    }
    queueFrame();
  });
  window.addEventListener("wheel", event => {
    if (!root.contains(event.target)) interruptTravel();
  }, { passive: true });
  window.addEventListener("touchmove", event => {
    if (!root.contains(event.target)) interruptTravel();
  }, { passive: true });
  window.addEventListener("hashchange", interruptTravel);
  window.addEventListener("scroll", () => {
    queueIdleDock();
    if (follow) {
      clearTimeout(followTimer);
      followTimer = setTimeout(followSection, 175);
    }
    if (!selection) return;
    if (!performer?.ready || (!performer.traveling && !performer.busy)) reaim();
    queueFrame(300);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      performer?.stopCoast();
      performer?.wake?.clear();
    }
    if (!hidden && !selection && picker.hidden && !performer?.traveling) performer?.park();
  });
  new ResizeObserver(queueIdleDock).observe(document.body);
  park();
  root.dataset.ready = "true";
  return { endTour };
}
