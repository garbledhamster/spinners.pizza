(() => {
  const badge = document.getElementById("medallion");
  const chef = badge?.querySelector("img#chef");
  const control = document.querySelector("button#motion-control");
  if (!chef || !control) return;

  const variants = [1, 2, 3, 4, 5, 6];
  const imageDirectory = new URL(".", chef.src);
  let currentVariant = 1;
  let shuffleTimer = null;

  function shuffleChef() {
    const choices = variants.filter((variant) => variant !== currentVariant);
    currentVariant = choices[Math.floor(Math.random() * choices.length)];
    chef.src = new URL(`${currentVariant}.png`, imageDirectory).href;
  }

  function setPlaying(playing) {
    if (playing) {
      shuffleTimer = window.setInterval(shuffleChef, 4000);
    } else {
      window.clearInterval(shuffleTimer);
      shuffleTimer = null;
    }
    control.textContent = playing ? "Pause emblem" : "Resume emblem";
    badge.dataset.medallionState = playing ? "playing" : "paused";
  }

  control.addEventListener("click", () => setPlaying(shuffleTimer === null));
  control.hidden = false;
  setPlaying(true);
})();
