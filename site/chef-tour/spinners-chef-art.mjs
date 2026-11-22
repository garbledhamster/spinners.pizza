const art = name => new URL(`./art/${name}`, import.meta.url).href;
const presentation = (column, row, waist, grip, head) => ({ sheet: "presentation", cell: [column, row], waist, grip, head });
const flight = (column, row, waist, grip) => ({ sheet: "flight", cell: [column, row], waist, grip });

export const chefPerformance = {
  images: {
    presentation: { src: art("chef-presentation.webp"), columns: 4, rows: 2 },
    flight: { src: art("chef-flight.webp"), columns: 4, rows: 2 },
    eyelids: { src: art("chef-blink.webp") },
    peel: { src: art("laser-peel.webp") },
  },
  tornado: { spin: art("tornado-spin.webp"), dust: art("tornado-dust.webp"), frames: 32 },
  // The waist is a fraction of the avatar width, matching the tornado's pivot.
  waistY: .75,
  // Grip and lens are fractions of the transparent peel image.
  prop: { grip: [.23, .599], tip: [.958, .233], angle: 0, width: .40 },
  frames: {
    idle: presentation(0, 0, [.526, .926], [.67, .87]),
    speak: presentation(1, 0, [.526, .929], [.67, .87]),
    "turn-left": presentation(2, 0, [.516, .929], [.115, .745]),
    "turn-right": presentation(3, 0, [.48, .929], [.835, .746]),
    "front-left": presentation(0, 1, [.544, .926], [.188, .747], [.291, .025, .722, .599]),
    "front-right": presentation(1, 1, [.443, .926], [.807, .751], [.269, .025, .699, .597]),
    "rear-left": presentation(2, 1, [.513, .926], [.117, .756], [.341, .022, .746, .568]),
    "rear-right": presentation(3, 1, [.485, .926], [.856, .758], [.246, .025, .651, .570]),
    takeoff: flight(0, 0, [.48, .934], [.707, .822]),
    "bank-left": flight(1, 0, [.522, .929], [.723, .797]),
    "bank-right": flight(2, 0, [.47, .931], [.692, .848]),
    glide: flight(3, 0, [.483, .934], [.671, .856]),
    "brake-left": flight(0, 1, [.626, .914], [.848, .742]),
    "brake-right": flight(1, 1, [.416, .931], [.564, .839]),
    settle: flight(2, 1, [.503, .92], [.660, .859]),
    blink: { sheet: "eyelids", waist: [.526, .926], registration: [.026, .008], grip: [.67, .87] },
  },
};
