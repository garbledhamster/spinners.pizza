import { mountGuide } from "./tour-guide.mjs?v=8";
import { chefPerformance } from "./spinners-chef-art.mjs?v=7";
import { spinnersMenu, spinnersDocks, menuTourStops } from "./spinners-menu.mjs?v=6";

// Origin and grip are fractions of the image, measured from its top left.
const character = {
  name: "Spinners chef",
  image: "site/chef-tour/chef-peel.png",
  tornado: "assets/images/logos/7.png",
  aspect: 1,
  emitter: [0.943, 0.544],
  grip: [0.50, 0.71],
  barrelAngle: -3,
  maxTilt: 38,
  idleAnchor: "#hero-art",
  performance: chefPerformance,
};

const tours = [
  {
    id: "site",
    name: "Site tour",
    description: "Find your way around.",
    steps: [
      { target: "#home .actions", title: "Start here", text: "Menu, hours, carry-out and directions are right up front." },
      { target: "#menu-title", avoid: "#menu .section-heading a", title: "Find your order", text: "Start with the menu to see what sounds good." },
      { target: "#story-title", title: "Meet the family", text: "Come meet the family behind Spinners and see where it all started." },
    ],
  },
  {
    id: "menu",
    name: "Menu tour",
    description: "From the pizza oven to the scoop counter.",
    steps: menuTourStops,
  },
  {
    id: "restaurant",
    name: "Restaurant tour",
    description: "Look inside and plan a visit.",
    steps: [
      { target: "#gallery-title", title: "Inside Spinners", text: "Take a look around the Grovespring restaurant. Tap a photo to see it up close." },
      { target: "#gallery .gallery-grid a:nth-child(2)", title: "The counter", text: "This is what you’ll see when you come in and look toward the counter." },
      { target: "#visit-title", title: "Visit or carry out", text: "Find directions and the carry-out number in this section." },
      { target: "#hours-title", title: "Check the hours", text: "Use the hours section to plan when to come by." },
    ],
  },
  {
    id: "family",
    name: "Family tour",
    description: "The people and places behind Spinners.",
    steps: [
      { target: "#story-title", title: "Our family story", text: "Spinners has family roots in Stoughton, Wisconsin. This is where you can read how that story connects to Grovespring." },
      { target: "#story figure", title: "Spinners in Grovespring", text: "Here’s the dining room from the counter at the Grovespring restaurant." },
      { target: "#gallery-title", title: "Look around", text: "The photos show the place the family built for people to gather over pizza." },
    ],
  },
];

mountGuide({ character, tours, menus: spinnersMenu, docks: spinnersDocks });
