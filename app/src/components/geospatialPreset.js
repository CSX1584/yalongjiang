// Tokyo story and R3F Canvas defaults, verified against upstream b012ad06d858.
// https://github.com/takram-design-engineering/three-geospatial/blob/b012ad06d858fc035d88aacfd73f092f93c994e4/storybook/src/clouds/3DTilesRenderer.stories.tsx
export const TOKYO_PRESET = {
  dayOfYear: 170, timeOfDay: 7.5, coverage: 0.35, exposure: 10,
  distance: 1000, heading: -110, pitch: -9, fov: 75,
}

// User-approved geographic adaptation: translate the camera and ALL cloud layers
// by the same altitude; preserve Tokyo's camera geometry and cloud-layer spacing.
export const YALONG_ALTITUDE_OFFSET = 3500
export const YALONG_VIEW_TARGET = [101.4525, 27.7458]
export const DEFAULT_ENVIRONMENT = {
  dayOfYear: TOKYO_PRESET.dayOfYear,
  timeOfDay: TOKYO_PRESET.timeOfDay,
  coverage: TOKYO_PRESET.coverage,
  exposure: TOKYO_PRESET.exposure,
  cloudAltitude: YALONG_ALTITUDE_OFFSET + 750,
  haze: 1,
  aerialPerspective: 1,
}
