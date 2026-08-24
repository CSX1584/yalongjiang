export const XRAY_OUTLINE_VERTEX_SHADER = `
  uniform float thickness;
  uniform vec2 viewportSize;
  uniform vec2 outlineOffset;

  void main() {
    vec4 transformedPosition = vec4(position, 1.0);

    #ifdef USE_INSTANCING
      transformedPosition = instanceMatrix * transformedPosition;
    #endif

    vec4 clipPosition = projectionMatrix * modelViewMatrix * transformedPosition;
    clipPosition.xy +=
      outlineOffset * thickness / viewportSize * clipPosition.w * 2.0;
    gl_Position = clipPosition;
  }
`

export const XRAY_OUTLINE_FRAGMENT_SHADER = `
  uniform vec3 color;
  uniform float opacity;

  void main() {
    gl_FragColor = vec4(color, opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
