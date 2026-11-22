(() => {
  const gallery = document.querySelector("#gallery");
  const dialog = document.querySelector("#photo-dialog");
  if (!gallery || typeof dialog?.showModal !== "function") return;

  const label = dialog.querySelector("#photo-label");
  const image = new Image();
  image.id = "dialog-image";
  image.alt = "";
  dialog.append(image);

  let trigger;
  for (const link of gallery.querySelectorAll("a[data-gallery]")) {
    link.setAttribute("aria-haspopup", "dialog");
  }

  gallery.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-gallery]");
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    trigger = link;
    label.textContent = link.querySelector("img").alt;
    image.src = link.href;
    dialog.showModal();
    event.preventDefault();
  });

  dialog.addEventListener("close", () => {
    trigger?.focus();
    trigger = undefined;
  });
})();
