const icon = name => `<span class="cg-settings-icon" data-icon="${name}" aria-hidden="true"></span>`;
const button = (name, label, visibleLabel) => `
  <button type="button" class="cg-settings-control" data-setting="${name}" aria-label="${label}">
    ${icon(name)}<span class="cg-settings-label">${visibleLabel}</span>
  </button>`;
const corners = [
  ["top left", "Top left"],
  ["top right", "Top right"],
  ["bottom left", "Bottom left"],
  ["bottom right", "Bottom right"],
];

export function mountGuideSettings({ host, closeGuide, toggleFollow, toggleMotion, move, toggleChef }) {
  host.innerHTML = `
    <button type="button" class="cg-settings-trigger" aria-label="Guide settings"
      aria-controls="chef-guide-settings" aria-expanded="false">
      ${icon("settings")}<span>Settings</span>
    </button>
    <section class="cg-settings-panel" id="chef-guide-settings" aria-labelledby="chef-guide-settings-title" hidden>
      <header>
        <h2 id="chef-guide-settings-title">Guide settings</h2>
        <button type="button" class="cg-settings-close" aria-label="Close guide settings">Close</button>
      </header>
      <div class="cg-settings-row">
        ${button("follow", "Follow me", "Follow")}
        ${button("motion", "Guide motion", "Motion")}
        ${button("move", "Move chef", "Move")}
        ${button("reset", "Reset position", "Reset")}
        ${button("hide", "Hide chef", "Hide")}
      </div>
      <div class="cg-corners" id="chef-guide-corners" aria-label="Chef position" role="group" hidden>
        ${corners.map(([value, label]) =>
          `<button type="button" data-corner="${value}">${label}</button>`).join("")}
      </div>
    </section>
  `;
  const trigger = host.querySelector(".cg-settings-trigger");
  const panel = host.querySelector(".cg-settings-panel");
  const positions = host.querySelector(".cg-corners");
  const setting = name => host.querySelector(`[data-setting="${name}"]`);
  const follow = setting("follow");
  const motion = setting("motion");
  const place = setting("move");
  const reset = setting("reset");
  const hide = setting("hide");
  place.setAttribute("aria-controls", positions.id);

  function setPositions(open) {
    positions.hidden = !open;
    place.setAttribute("aria-expanded", String(open));
  }

  function setOpen(open, restoreFocus = false) {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      closeGuide();
      follow.focus({ preventScroll: true });
    } else {
      setPositions(false);
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }
  }

  function sync({ following, playing, chefHidden, corner }) {
    follow.setAttribute("aria-pressed", String(following));
    motion.setAttribute("aria-pressed", String(playing));
    for (const [control, on] of [[follow, following], [motion, playing]]) {
      control.dataset.state = on ? "On" : "Off";
    }
    hide.setAttribute("aria-label", chefHidden ? "Show chef" : "Hide chef");
    hide.querySelector(".cg-settings-label").textContent = chefHidden ? "Show" : "Hide";
    hide.dataset.chefHidden = String(chefHidden);
    place.disabled = reset.disabled = chefHidden;
    if (chefHidden) setPositions(false);
    for (const control of positions.querySelectorAll("button")) {
      control.setAttribute("aria-pressed", String(control.dataset.corner === corner));
    }
  }

  trigger.addEventListener("click", () => setOpen(panel.hidden, true));
  host.querySelector(".cg-settings-close").addEventListener("click", () => setOpen(false, true));
  follow.addEventListener("click", toggleFollow);
  motion.addEventListener("click", toggleMotion);
  place.addEventListener("click", () => {
    setPositions(positions.hidden);
    if (!positions.hidden) {
      (positions.querySelector('[aria-pressed="true"]') ?? positions.firstElementChild).focus({ preventScroll: true });
    }
  });
  reset.addEventListener("click", () => {
    setPositions(false);
    move(undefined);
  });
  hide.addEventListener("click", toggleChef);
  positions.addEventListener("click", event => {
    const control = event.target.closest("[data-corner]");
    if (!control) return;
    move(control.dataset.corner);
    setPositions(false);
    place.focus({ preventScroll: true });
  });
  host.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    if (!positions.hidden && positions.contains(event.target)) {
      setPositions(false);
      place.focus({ preventScroll: true });
    } else setOpen(false, true);
  });
  function dismissOutside(event) {
    if (!panel.hidden && !host.contains(event.target)) setOpen(false);
  }

  document.addEventListener("pointerdown", dismissOutside);
  document.addEventListener("focusin", dismissOutside);
  setPositions(false);
  return { sync, close: () => setOpen(false), isOpen: () => !panel.hidden };
}
