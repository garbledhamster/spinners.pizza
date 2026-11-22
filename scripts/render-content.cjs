const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const siteOrigin = "https://spinners.pizza";
const photoDirectory = "assets/images/counter-ticket";
const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

function localImage(source) {
  const url = new URL(source, siteOrigin);
  if (url.origin !== siteOrigin || !url.pathname.startsWith("/assets/images/")) {
    throw new Error("Expected a Spinners image asset path");
  }
  return url.pathname.slice(1);
}

function reviewLink(source, author) {
  const href = URL.canParse(source) ? new URL(source) : null;
  const label = escapeHtml(author);
  return href?.protocol === "https:" ? `<a href="${escapeHtml(href.href)}">${label}</a>` : label;
}

const menuPhotos = {
  "assets/images/food/chicken-alfredo-pizza.jpg": [1528, 1224],
  "assets/images/food/supreme-pizza.jpg": [1528, 1224],
  "assets/images/food/gyro-seasoned-fries.jpg": [428, 343],
  "assets/images/food/hoagie-burger-and-fries.jpg": [1128, 904],
  "assets/images/food/breadsticks.jpg": [506, 404],
  "assets/images/food/drinks.jpg": [2184, 1744],
};

function menuGroup({ title, items, photo }) {
  const dimensions = menuPhotos[photo];
  const image = dimensions
    ? `<img src="${escapeHtml(localImage(photo))}" width="${dimensions[0]}" height="${dimensions[1]}" alt="" loading="lazy" decoding="async">`
    : "";
  const rows = items.map((item) => {
    const accent = item.endsWith("⭐") ? ' class="menu-feature"' : "";
    const name = item.replace(/\s*[⭐✅]$/u, "");
    return `<li${accent}>${escapeHtml(name)}</li>`;
  }).join("\n");
  const heading = title === "Drinks & Desert" ? "Drinks & Dessert" : title;
  return `<details class="menu-group" open>
  <summary>${escapeHtml(heading)}</summary>
  <div class="menu-body">${image}<ul>${rows}</ul></div>
</details>`;
}

function galleryPhoto(root, { src, alt }) {
  const original = localImage(src);
  const id = original.match(/^assets\/images\/restaurant\/(0[2-8])%20/)?.[1];
  const thumbnail = `${photoDirectory}/dining-${id}.jpg`;
  const hasThumbnail = id && id !== "07" && existsSync(join(root, thumbnail));
  // The thumbnails preserve the uncropped dimensions of the original photos.
  const dimensions = hasThumbnail ? ' width="640" height="482"' : id === "07" ? ' width="600" height="452"' : "";
  return { original, thumbnail: hasThumbnail ? thumbnail : original, dimensions, alt: alt || "Inside Spinners" };
}

function galleryImage({ thumbnail, dimensions, alt }) {
  return `<img src="${escapeHtml(thumbnail)}"${dimensions} alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
}

// The shared template inserts this fragment once inside <main>.
module.exports = function renderContent({ root }) {
  const read = (name) => JSON.parse(readFileSync(join(root, "data", name), "utf8"));
  const menu = read("menu.json");
  const groups = menu.sections.map(menuGroup);
  const gallery = read("gallery.json").map((photo) => galleryPhoto(root, photo));
  const about = read("about.json");
  const menuSheets = menu.images.map((source, index) => {
    const page = index + 1;
    return `<a href="${escapeHtml(localImage(source))}" data-menu-photo>
      <img src="${photoDirectory}/menu-sheet-${page}.jpg" width="355" height="520" alt="Printed menu page ${page}" loading="lazy" decoding="async">
      <span aria-hidden="true">View page ${page}</span>
    </a>`;
  }).join("\n");
  const galleryItems = gallery.map((photo) => (
    `<a href="${escapeHtml(photo.original)}" data-gallery>${galleryImage(photo)}</a>`
  )).join("\n");
  const reviews = read("reviews.json").map(({ review, author, href }) => (
    `<figure>
  <blockquote>${escapeHtml(review)}</blockquote>
  <figcaption>${reviewLink(href, author)}</figcaption>
</figure>`
  )).join("\n");

  const illustrations = `${photoDirectory}/illustrations`;
  const scoopArt = `<figure>
      <img src="${illustrations}/scoop-counter.webp" width="875" height="1024" alt="Ink illustration of a sundae and a malt glass" loading="lazy" decoding="async">
      <figcaption>Illustration</figcaption>
    </figure>`;
  const dessertCopy = "<p>More than 25 flavors of Kemps ice cream, plus shakes, malts and sundaes.</p>";
  const discountArt = `<figure>
      <img src="${illustrations}/pizza-boxes.webp" width="610" height="501" alt="" loading="lazy" decoding="async">
      <figcaption>Illustration</figcaption>
    </figure>`;
  const storyImage = `<figure>
    <img src="${escapeHtml(localImage(about.image))}" width="500" height="500" alt="The original Spinners chef tossing a pizza" loading="lazy" decoding="async">
    <figcaption>Original Spinners artwork</figcaption>
  </figure>`;

  return `<section id="menu" class="wrap section" aria-labelledby="menu-title">
  <div class="section-heading">
    <h2 id="menu-title">On the menu</h2>
    <div class="menu-links">
      <a href="#menu-photos" class="text-link">Printed menu</a>
      <a href="#scoops" class="text-link">Desserts <svg aria-hidden="true" focusable="false"><use href="#i-arrow"/></svg></a>
    </div>
  </div>
  <div class="menu-grid">
    <div class="menu-column">${groups.slice(0, 3).join("\n")}</div>
    <div class="menu-column">${groups.slice(3).join("\n")}</div>
  </div>
  ${menu.note ? `<p class="menu-note">${escapeHtml(menu.note)}</p>` : ""}
  <div class="printed-menu" id="menu-photos">
    <h3>Printed menu</h3>
    <p>These pages show an older address. Use <a href="#visit">the map</a> for directions and <a href="#carry-out">call Spinners</a> for current prices and availability.</p>
    <div class="printed-menu-grid">${menuSheets}</div>
  </div>
</section>

<section id="scoops" class="wrap section" aria-labelledby="scoop-title">
  <div class="scoop-panel">
    ${scoopArt}
    <div class="scoop-copy">
      <svg aria-hidden="true" focusable="false"><use href="#i-scoop"/></svg>
      <h2 id="scoop-title">The scoop counter</h2>
      ${dessertCopy}
    </div>
  </div>
</section>

<section id="discounts" class="discount-band" aria-labelledby="discount-title">
  <div class="wrap discount-inner">
    <div>
      <h2 id="discount-title">Discounts for our heroes</h2>
      <p>We honor service members, police, firefighters, and first responders with special discounts.</p>
    </div>
    ${discountArt}
  </div>
</section>

<section id="story" class="wrap section story" aria-labelledby="story-title">
  <div>
    <h2 id="story-title"><span id="about">Our family story</span></h2>
    <p>Since 2016, Tim and Brenda Klein have poured family, faith, and hard work into a neighborhood spot where friends become regulars and regulars become family. Their son Brandon carries on the original Spinners in Stoughton, Wisconsin, while Tim and Brenda serve Grovespring.</p>
    <p>From handcrafted pizzas and custom Hoagie Burgers to smoky BBQ and sweet desserts, there’s always something new to try. Thank you to our neighbors for making Spinners a place to gather.</p>
  </div>
  ${storyImage}
</section>

<section id="gallery" class="wrap section" aria-labelledby="gallery-title">
  <div class="section-heading"><h2 id="gallery-title">Inside Spinners</h2></div>
  <p class="section-intro">Take a spin around our place. Our cozy dining room is perfect for dates, families, and parties, with a welcoming team.</p>
  <div class="gallery-grid">${galleryItems}</div>
</section>

<section id="reviews" class="wrap section" aria-labelledby="reviews-title">
  <div class="section-heading"><h2 id="reviews-title">Customer reviews</h2><span>What our guests are saying</span></div>
  <div class="reviews-grid">${reviews}</div>
</section>

<dialog id="photo-dialog" aria-labelledby="photo-label">
  <div>
    <h2 id="photo-label">Restaurant photo</h2>
    <form method="dialog"><button type="submit" id="close-photo" autofocus>Close</button></form>
  </div>
  <div class="photo-controls" role="group" aria-label="Photo controls">
    <button type="button" id="previous-photo">Previous</button>
    <a class="text-link" id="photo-original" href="#photo-dialog">Open full size</a>
    <button type="button" id="next-photo">Next</button>
  </div>
</dialog>`;
};
