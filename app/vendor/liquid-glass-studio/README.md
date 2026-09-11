# Liquid Glass Studio material

Source: https://github.com/iyinchao/liquid-glass-studio
Commit: 4bc702044bb2718d61b8992b697a5cd051b58980 (MIT, Charles Yin).

The shaders, WebGL2 multipass renderer and Gaussian kernel helper retain the
upstream source. `stationGlassRenderer.js` resolves GLSL includes with Vite raw
imports and supplies live map crops in place of Studio's demo background pass.
No editor, sample media, UI dependencies or WebGPU backend are included.

The station adapter uses final material step 9, circular corners matching the
existing DOM layout, a 30px Gaussian kernel with blurred edges, 18.7px refracting
rim, 0.07 refraction distance, 1.71 refractive index, 12.3 dispersion and 24.38
glare range. Thickness and dispersion retain the visible precision of the user's
reference screenshot, whose final digits were clipped. Fresnel and other glare
settings use Studio's defaults. Light tint is #ffffff52 for both card states.
The external shadow remains a native CSS shadow: 17.54px blur, 15% opacity,
and 10px downward offset (Studio's upward Y coordinate is -10).
One offscreen renderer is shared; DOM text and controls remain at native scale.

The map toolbar's glass panel edits `stationGlassConfig.mjs` defaults live via
a configuration ref, without recreating the map or WebGL renderer. Explicit
save uses the versioned `ops-station-glass-config-v1` localStorage key; values
are validated on read and write, and storage errors are shown in the panel.
Browser storage survives refresh/restarts on the same origin, but is not a
cross-device backup. Geometry continues to follow the confirmed Figma layout.
