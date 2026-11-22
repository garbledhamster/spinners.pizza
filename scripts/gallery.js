(() => {
  const dialog = document.querySelector("#photo-dialog");
  if (typeof dialog?.showModal !== "function") return;

  const label = dialog.querySelector("#photo-label");
  const original = dialog.querySelector("#photo-original");
  const previous = dialog.querySelector("#previous-photo");
  const next = dialog.querySelector("#next-photo");
  const image = new Image();
  image.id = "dialog-image";
  image.alt = "";
  dialog.append(image);

  let trigger;
  let current;
  let photos;
  for (const selector of ["a[data-gallery]", "a[data-menu-photo]"]) {
    const group = [...document.querySelectorAll(selector)];
    for (const [index, link] of group.entries()) {
      link.setAttribute("aria-haspopup", "dialog");
      link.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 ||
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        trigger = link;
        photos = group;
        previous.hidden = next.hidden = photos.length < 2;
        showPhoto(index);
        dialog.showModal();
        event.preventDefault();
      });
    }
  }

  function showPhoto(index) {
    current = (index + photos.length) % photos.length;
    const link = photos[current];
    label.textContent = link.querySelector("img").alt;
    image.src = original.href = link.href;
  }

  previous.addEventListener("click", () => showPhoto(current - 1));
  next.addEventListener("click", () => showPhoto(current + 1));
  dialog.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowLeft") showPhoto(current - 1);
    else if (event.key === "ArrowRight") showPhoto(current + 1);
    else return;
    event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    trigger?.focus({ preventScroll: true });
    trigger = undefined;
  });
})();
