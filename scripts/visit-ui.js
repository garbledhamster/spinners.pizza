"use strict";

const heroPhoto = document.getElementById("hero-photo");
const heroCaption = document.getElementById("hero-caption");

function showMissingPhoto() {
  heroPhoto.hidden = true;
  heroCaption.textContent = "Photo unavailable";
}

heroPhoto.addEventListener("error", showMissingPhoto);
if (heroPhoto.complete && !heroPhoto.naturalWidth) showMissingPhoto();

const visitDisclosures = new Map([
  ["#hours", document.getElementById("hours-details")],
  ["#carry-out", document.getElementById("carry-out-details")],
]);

function openVisitDisclosure(hash) {
  const disclosure = visitDisclosures.get(hash);
  if (disclosure) disclosure.open = true;
}

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const href = event.target.closest("a")?.getAttribute("href");
  openVisitDisclosure(href);
});

window.addEventListener("hashchange", () => openVisitDisclosure(location.hash));
openVisitDisclosure(location.hash);
