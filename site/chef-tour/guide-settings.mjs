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

export function mountGuideSettings({ host, layout, toggleFollow, toggleMotion, move, toggleChef }) {
  host.innerHTML = `
      <div class="cg-settings-row" role="group" aria-label="Guide settings">
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
  `;
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
    layout();
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
    if (event.key !== "Escape" || positions.hidden || !positions.contains(event.target)) return;
    event.preventDefault();
    setPositions(false);
    place.focus({ preventScroll: true });
  });
  setPositions(false);
  return { sync, closePositions: () => setPositions(false), focusVisibility: () => hide.focus({ preventScroll: true }) };
}
