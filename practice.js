/**
 * Practice-only content. These testlets are never scored and are excluded
 * from both Form A and Form B candidate pools.
 */
export const PRACTICE_TESTLETS = Object.freeze([
  Object.freeze({
    testletId: "practice_01",
    scored: false,
    options: Object.freeze(["game", "island", "mouth", "movie", "song", "yard"]),
    items: Object.freeze([
      Object.freeze({ itemId: "practice_01_i01", prompt: "land with water all around it", correctOption: "island" }),
      Object.freeze({ itemId: "practice_01_i02", prompt: "part of your body used for eating and speaking", correctOption: "mouth" }),
      Object.freeze({ itemId: "practice_01_i03", prompt: "a piece of music", correctOption: "song" })
    ])
  }),
  Object.freeze({
    testletId: "practice_02",
    scored: false,
    options: Object.freeze(["banana", "bicycle", "pillow", "spoon", "window", "zebra"]),
    items: Object.freeze([
      Object.freeze({ itemId: "practice_02_i01", prompt: "a yellow curved fruit", correctOption: "banana" }),
      Object.freeze({ itemId: "practice_02_i02", prompt: "something used to eat soup", correctOption: "spoon" }),
      Object.freeze({ itemId: "practice_02_i03", prompt: "an opening in a wall with glass that lets light in", correctOption: "window" })
    ])
  })
]);
