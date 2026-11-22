export function createGuidePicker({ picker, home, choose, place }) {
  const heading = picker.querySelector("h2");
  const copy = picker.querySelector(".cg-picker-copy");
  const choices = picker.querySelector(".cg-choices");
  const footer = picker.querySelector(".cg-picker-foot");
  const backButton = picker.querySelector(".cg-picker-back");
  const pages = [{ ...home }];
  let selectedEntry;

  function render(focus = true) {
    const page = pages.at(-1);
    const builder = entry => {
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = Boolean(entry.disabled);
      button.className = "cg-choice";
      button.textContent = entry.label;
      if (entry.status) {
        const status = document.createElement("small");
        status.textContent = entry.status;
        status.setAttribute("aria-hidden", "true");
        button.append(status);
      }
      if (entry.pressed !== undefined) button.setAttribute("aria-pressed", String(entry.pressed));
      if (entry.entries) button.classList.add("cg-branch");
      button.addEventListener("click", () => {
        selectedEntry = entry.id ?? entry.label;
        choose(entry);
      });
      return button;
    };
    const entries = typeof page.entries === "function" ? page.entries() : page.entries;
    heading.textContent = page.label;
    copy.textContent = page.text ?? "";
    copy.hidden = !page.text;
    backButton.hidden = pages.length === 1;
    choices.replaceChildren(...entries.map(builder));
    footer.replaceChildren(...(page.footer ?? []).map(builder));
    footer.hidden = !page.footer?.length;
    picker.scrollTop = 0;
    place();
    if (focus) {
      const rows = [...picker.querySelectorAll(".cg-choice")];
      const index = entries.concat(page.footer ?? []).findIndex(entry => (entry.id ?? entry.label) === selectedEntry);
      (rows[index] ?? rows[0] ?? picker.querySelector(".cg-close-picker")).focus({ preventScroll: true });
    }
  }

  function openMenu(menu, { replace = false } = {}) {
    if (replace && pages.length > 1) pages.pop();
    else if (selectedEntry) pages.at(-1).returnEntry = selectedEntry;
    pages.push({ ...menu });
    selectedEntry = undefined;
    render();
  }

  function reset(focus) {
    pages.length = 1;
    delete pages[0].returnEntry;
    selectedEntry = undefined;
    render(focus);
  }

  backButton.addEventListener("click", () => {
    if (pages.length === 1) return;
    pages.pop();
    selectedEntry = pages.at(-1).returnEntry;
    render();
  });

  return { openMenu, render, reset };
}
