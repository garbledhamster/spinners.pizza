const shortcut = (label, target, text, options = {}) => ({
  label,
  step: { target, title: label, text, ...options },
});

const menuTitle = "#menu-title";
export const dessertTitle = document.querySelector("#scoop-title")?.textContent.trim() || "Desserts";
const dessertCopy = dessertTitle === "The scoop counter"
  ? "Save a little room. I’ll show you the scoop counter, where you can see what’s listed for ice cream, shakes, malts and sundaes."
  : "Want something sweet after the pizza? Here’s where to check what’s available today.";
const hoursPanel = "#hours-details";
const checkResult = "#date-result";
const mapLink = "#visit .locator-copy a";
const phoneLink = "#carry-out a[href^='tel:']";
const destinations = {
  menu: shortcut("Full menu", menuTitle, "Welcome to my kitchen. I’d start with a specialty pie, but I can also show you the house specials, burgers and sides.", {
    avoid: "#menu .section-heading a",
  }),
  story: shortcut("Our family story", "#story-title", "Read about the family behind Spinners and where it all started."),
  gallery: shortcut("Show the photo gallery", "#gallery-title", "Tap a photo to take a closer look."),
};

const groups = [...document.querySelectorAll("#menu .menu-group")];
const categoryCopy = {
  "Specialty Pizzas": "Let me show you a couple of our pies. Try Alfredo Chicken if you’re in the mood for something creamy, or look for the A-1 Steak Pizza.",
  "Create Your Own Pizza": "Want to make the pie your own? Start with original hand-tossed or gluten-free crust, then pick your toppings.",
  "House Specials": "Come a little farther down the counter. This is where I’d point you for homemade lasagna or a gyro with fries.",
  Burgers: "If you came in hungry for a burger, I’d take a look at the Hoagie Burgers and the Spinner Special Smoked Burger.",
  Appetizers: "Ordering for the table? I’d start with garlic breadsticks or wings while everyone decides on a pie.",
  "Drinks & Dessert": "Grab a fountain drink with your order or finish up with a cookie. I can show you the separate dessert section, too.",
};
const categories = groups.map(group => {
  const target = group.querySelector("summary");
  const label = target.textContent.trim();
  return shortcut(label, target, categoryCopy[label] ?? "Let me show you what we have in this part of the menu.", {
    landing: "below",
  });
});
const dessertStop = shortcut(dessertTitle, "#scoop-title", dessertCopy);

export const menuTourStops = [
  { ...destinations.menu.step, title: "On the menu" },
  ...["Specialty Pizzas", "Create Your Own Pizza"].flatMap(label => {
    const category = categories.find(entry => entry.label === label);
    return category ? [category.step] : [];
  }),
  dessertStop.step,
];

// Draw from named dishes with real destinations, skipping build options and drinks.
const foodPicks = groups.flatMap(group =>
  ["Create Your Own Pizza", "Drinks & Dessert"].includes(group.querySelector("summary").textContent.trim())
    ? []
    : [...group.querySelectorAll(".menu-body li")]
);
let previousPick;

function pickFood({ openMenu }, replace = false) {
  const choices = foodPicks.filter(item => item !== previousPick);
  previousPick = choices[Math.floor(Math.random() * choices.length)] ?? previousPick;
  const item = previousPick;
  if (!item) {
    openMenu({ label: "Pick something for me", text: "The full menu is the best place to browse right now.", entries: [destinations.menu] }, { replace });
    return;
  }
  const name = item.textContent.replace(/[⭐★✅]/gu, "").trim();
  openMenu({
    label: name,
    entries: [
      shortcut("Show me on the menu", item, `I picked ${name} for you. Here it is alongside the other dishes in this part of the menu.`, { title: name }),
      { label: "Pick again", run: guide => pickFood(guide, true) },
    ],
  }, { replace });
}

function resetToToday() {
  const input = document.querySelector("#visit-date");
  if (!input) return;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  input.value = `${date.year}-${date.month}-${date.day}`;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const visitHours = (label, target, text, options = {}) =>
  shortcut(label, target, text, {
    action: {
      label: "Call to check",
      link: "#hours .check a[href^='tel:']",
      when: () => document.querySelector(checkResult)?.dataset.state === "unknown",
    },
    ...options,
  });

function photo(label, hrefFragment) {
  const target = `#gallery a[data-gallery][href*="${hrefFragment}"]`;
  return shortcut(label, target, "Here’s the photo. Open it to see it full size.", {
    action: { label: "Open photo", link: target, activate: true },
  });
}

export const spinnersMenu = [
  {
    label: "Menu & desserts",
    entries: [
      destinations.menu,
      { label: "Browse by category", entries: categories },
      dessertStop,
      { label: "Pick something for me", run: pickFood },
    ],
  },
  {
    label: "Plan a visit",
    entries: [
      {
        label: "Hours & date check",
        entries: [
          visitHours("Today’s hours", checkResult, "Here’s the result for today in Grovespring.", { prepare: resetToToday }),
          visitHours("Weekly hours", `${hoursPanel} .weekly`, "Here’s the weekly schedule shown on the site."),
          visitHours("Check a visit date", "#visit-date", "Pick a date to see the hours for that day."),
          visitHours("Holiday hours and exceptions", `${hoursPanel} .ticket-body > div:first-child ul`,
            "Check the posted exceptions here. For a specific day, use the date check.", {
              fallback: checkResult,
              fallbackText: "No separate exceptions are shown here. Use the date check for the day you plan to come.",
              prepare: resetToToday,
            }),
        ],
      },
      {
        label: "Directions",
        entries: [
          shortcut("Show the address", "#visit .locator-copy h3", "Here’s the location shown on the site."),
          shortcut("Open in Maps", mapLink, "Use the map link to look up Spinners.", {
            action: { label: "Open in Maps", link: mapLink },
          }),
        ],
      },
      {
        label: "Carry-out",
        entries: [
          shortcut("Show the phone number", "#carry-out-number", "Here’s the carry-out number on the page."),
          shortcut("Open the phone dialer", phoneLink, "Use this link when you’re ready to call.", {
            action: { label: "Open the phone dialer", link: phoneLink },
          }),
        ],
      },
      shortcut("Discounts for our heroes", "#discount-title", "Here’s what Spinners says about its service discounts."),
    ],
  },
  {
    label: "About Spinners",
    entries: [
      destinations.story,
      {
        label: "Inside Spinners",
        entries: [
          destinations.gallery,
          photo("See the entrance", "/02%20"),
          photo("See the counter", "/03%20"),
          photo("See the dining room", "/05%20"),
        ],
      },
      shortcut("Customer reviews", "#reviews-title", "See what people have shared about their visits."),
    ],
  },
];

export const spinnersDocks = [
  ["#home", "#title", "Welcome to Spinners."],
  ["#hours", "#hours-title", "Check your visit date here."],
  ["#menu", menuTitle, "Let me show you my menu."],
  ["#scoops", "#scoop-title", "See the dessert information here."],
  ["#discounts", "#discount-title", "See Spinners’ service discounts."],
  ["#story", "#story-title", "Meet the family behind Spinners."],
  ["#gallery", "#gallery-title", "Take a look inside."],
  ["#reviews", "#reviews-title", "See what visitors have shared."],
  ["#visit", "#visit-title", "Find directions and carry-out here."],
];
