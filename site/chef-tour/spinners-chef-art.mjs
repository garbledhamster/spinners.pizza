const art = name => new URL(`./art/${name}`, import.meta.url).href;
// Trace the hand cut and place the wrist pivot in 350 × 350 atlas cell coordinates.
const fraction = point => point.map(n => n / 350);
const wrist = (pivot, cut, side = 1, angle = 1.36) => ({ pivot: fraction(pivot), cut: cut.map(fraction), side, angle });
// Some closed fists cover part of the coat. Fill the section exposed by the replacement.
const coat = (wrist, fill) => ({ ...wrist, coat: fill.map(fraction) });
const pose = (sheet, column, row, waist, wrist, head) => ({ sheet, cell: [column, row], waist, wrist, head });
const resting = (column, waist, wrist) => pose("presentation", column, 0, waist, wrist);
const pointing = (column, waist, head, wrist) => pose("presentation", column, 1, waist, wrist, head);
const flight = (column, row, waist, wrist) => pose("flight", column, row, waist, wrist);
const idleWrist = coat(wrist([249, 291],
  [[212, 285], [225, 279], [236, 277], [246, 280], [254, 286], [260, 297], [257, 312],
    [248, 324], [230, 330], [214, 321], [210, 302]], -1, 1.10),
  [[209, 278], [245, 276], [248, 292], [243, 313], [244, 321], [230, 327], [209, 330]]);

export const chefPerformance = {
  images: {
    presentation: { src: art("chef-presentation.webp"), columns: 4, rows: 2 },
    flight: { src: art("chef-flight.webp"), columns: 4, rows: 2 },
    eyelids: { src: art("chef-blink.webp"), optional: true },
    heldSpatula: { src: art("chef-hand-and-spatula.webp?v=2") },
  },
  tornado: {
    spin: art("tornado-spin.webp"), dust: art("tornado-dust.webp"), frames: 32,
    wrap: { rear: art("tornado-wrap-rear.webp"), near: art("tornado-wrap-near.webp"), frames: 48 },
  },
  // The waist is a fraction of the avatar width, matching the tornado's pivot.
  waistY: .75,
  // Pivot, lens center and silhouette are fractions of the same illustrated cutout.
  prop: {
    pivot: [.085, .655], tip: [.968, .224], width: .54, sideRoom: .29,
    outline: [[.053, .54], [.06, .48], [.09, .46], [.103, .39], [.15, .326], [.179, .327],
      [.22, .38], [.23, .47], [.55, .47], [.586, .405], [.617, .28], [.664, .216],
      [.817, .21], [.84, .157], [.89, .146], [.914, .16], [.974, .166], [.982, .237],
      [.976, .291], [.983, .34], [.982, .79], [.967, .827], [.64, .827], [.611, .79],
      [.579, .672], [.55, .625], [.23, .625], [.221, .71], [.197, .758], [.16, .762],
      [.13, .732], [.101, .714], [.067, .707], [.063, .625], [.054, .607]],
  },
  frames: {
    idle: resting(0, [.526, .926], idleWrist),
    speak: resting(1, [.526, .929], idleWrist),
    "turn-left": resting(2, [.516, .929], wrist([68, 266],
      [[20, 235], [63, 235], [68, 250], [73, 260], [76, 272], [73, 285], [65, 292], [20, 295]], -1, .78)),
    "turn-right": resting(3, [.48, .929], wrist([282, 266],
      [[330, 235], [289, 235], [283, 250], [278, 259], [274, 271], [276, 283], [283, 292], [330, 295]], 1, .78)),
    "front-left": pointing(0, [.544, .926], [.291, .025, .722, .599], wrist([88, 273],
      [[34, 232], [76, 232], [81, 244], [88, 253], [91, 263], [90, 274], [83, 282], [81, 291], [34, 291]])),
    "front-right": pointing(1, [.443, .926], [.269, .025, .699, .597], wrist([259, 273],
      [[315, 232], [272, 232], [265, 244], [259, 253], [256, 265], [257, 275], [265, 282], [268, 291], [315, 291]])),
    "rear-left": pointing(2, [.513, .926], [.341, .022, .746, .568], wrist([62, 273],
      [[17, 232], [66, 232], [65, 248], [61, 257], [59, 269], [60, 278], [64, 285], [65, 294], [17, 294]])),
    "rear-right": pointing(3, [.485, .926], [.246, .025, .651, .570], wrist([289, 273],
      [[335, 232], [284, 232], [286, 249], [291, 257], [292, 269], [291, 278], [286, 285], [285, 294], [335, 294]])),
    takeoff: flight(0, 0, [.48, .934], wrist([263, 274],
      [[214, 283], [224, 268], [239, 261], [250, 262], [263, 268], [274, 279], [279, 296], [268, 313], [232, 315], [215, 303]])),
    "bank-left": flight(1, 0, [.522, .929], wrist([268, 264],
      [[217, 275], [227, 257], [243, 250], [259, 254], [271, 262], [281, 277], [283, 291], [271, 305], [240, 307], [219, 292]])),
    "bank-right": flight(2, 0, [.47, .931], coat(wrist([247, 286],
      [[204, 302], [214, 283], [229, 273], [241, 275], [254, 283], [263, 301], [265, 313], [247, 327], [220, 324], [204, 316]], -1, 1.20),
      [[201, 274], [237, 273], [246, 290], [244, 308], [244, 319], [222, 324], [201, 328]])),
    glide: flight(3, 0, [.483, .934], coat(wrist([249, 287],
      [[202, 304], [213, 285], [225, 276], [241, 277], [254, 283], [265, 297], [268, 314], [253, 330], [220, 330], [202, 320]], -1, 1.20),
      [[199, 276], [244, 276], [250, 288], [248, 313], [247, 323], [214, 330], [201, 332]])),
    "brake-left": flight(0, 1, [.626, .914], wrist([274, 252],
      [[266, 250], [279, 237], [295, 233], [311, 241], [324, 254], [327, 273], [309, 285], [282, 280], [264, 268]], 1, 1.10)),
    "brake-right": flight(1, 1, [.416, .931], coat(wrist([187, 282],
      [[146, 281], [157, 271], [173, 269], [185, 274], [194, 284], [206, 302], [205, 316], [184, 325], [152, 318], [144, 301]], -1, 1.33),
      [[139, 271], [186, 271], [190, 291], [185, 309], [185, 320], [170, 323], [141, 329]])),
    settle: flight(2, 1, [.503, .92], coat(wrist([244, 286],
      [[201, 304], [207, 287], [219, 277], [236, 275], [250, 283], [260, 295], [263, 316], [245, 328], [213, 324], [201, 314]], -1, 1.19),
      [[199, 275], [235, 275], [248, 290], [245, 312], [246, 321], [225, 325], [198, 331]])),
    blink: {
      sheet: "eyelids", waist: [.526, .926], registration: [.026, .008],
      wrist: coat(wrist([254, 303],
        [[213, 300], [227, 291], [242, 290], [252, 295], [259, 305], [262, 318], [255, 331], [243, 339], [223, 341], [213, 328], [210, 312]],
        -1, 1.10), [[208, 290], [249, 289], [251, 309], [248, 329], [244, 338], [224, 341], [209, 344]]),
    },
  },
};
