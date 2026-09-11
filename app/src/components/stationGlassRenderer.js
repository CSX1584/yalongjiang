import { MultiPassRenderer, createEmptyTexture } from '../../vendor/liquid-glass-studio/src/utils/GLUtils.ts'
import { computeGaussianKernelByRadius } from '../../vendor/liquid-glass-studio/src/utils/index.ts'
import vertex from '../../vendor/liquid-glass-studio/src/shaders/vertex.glsl?raw'
import main from '../../vendor/liquid-glass-studio/src/shaders/fragment-main.glsl?raw'
import horizontalBlur from '../../vendor/liquid-glass-studio/src/shaders/fragment-bg-hblur.glsl?raw'
import verticalBlur from '../../vendor/liquid-glass-studio/src/shaders/fragment-bg-vblur.glsl?raw'
import sdf from '../../vendor/liquid-glass-studio/src/shaders/lib/sdf.glsl?raw'
import math from '../../vendor/liquid-glass-studio/src/shaders/lib/math.glsl?raw'
import color from '../../vendor/liquid-glass-studio/src/shaders/lib/color.glsl?raw'
import { DEFAULT_GLASS_CONFIG, glassUniforms } from './stationGlassConfig.mjs'

const fragment = main.replace("#include './lib/sdf.glsl'", sdf)
  .replace("#include './lib/math.glsl'", math).replace("#include './lib/color.glsl'", color)

// Studio's three material passes; the map provides the already-rendered background.
export class StudioGlassRenderer {
  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.canvas.height = 1
    this.restore()
  }

  get contextLost() { return this.gl.isContextLost() }

  restore() {
    try {
      this.renderer = new MultiPassRenderer(this.canvas, [
        { name: 'horizontal', shader: { vertex, fragment: horizontalBlur } },
        { name: 'vertical', shader: { vertex, fragment: verticalBlur }, inputs: { u_prevPassTexture: 'horizontal' } },
        { name: 'glass', shader: { vertex, fragment }, inputs: { u_blurredBg: 'vertical' }, outputToScreen: true },
      ])
      this.gl = this.canvas.getContext('webgl2')
      this.texture = createEmptyTexture(this.gl)
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
      this.renderer.setUniforms({
        STEP: 9, u_dpr: 1, u_showShape1: 0, u_mergeRate: 0.01, u_shapeRoundness: 2,
      })
      this.config = null
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  render(source, { width, height, radius, tint, config = DEFAULT_GLASS_CONFIG }) {
    const gl = this.gl
    if (this.config !== config) {
      this.renderer.setUniforms(glassUniforms(config))
      if (this.config?.blurRadius !== config.blurRadius) {
        this.renderer.setUniform('u_blurWeights', config.blurRadius ? computeGaussianKernelByRadius(config.blurRadius) : [1])
      }
      this.config = config
    }
    if (this.canvas.width !== source.width || this.canvas.height !== source.height) {
      this.canvas.width = source.width
      this.canvas.height = source.height
      this.renderer.resize(source.width, source.height)
    }
    gl.viewport(0, 0, source.width, source.height)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    this.renderer.setUniforms({
      u_resolution: [source.width, source.height], u_mouseSpring: [source.width / 2, source.height / 2],
      u_shapeWidth: width, u_shapeHeight: height, u_shapeRadius: radius, u_tint: tint,
    })
    this.renderer.render({ horizontal: { u_prevPassTexture: this.texture }, glass: { u_bg: this.texture } })
  }

  destroy() {
    this.renderer?.dispose()
    const gl = this.gl || this.canvas.getContext('webgl2')
    if (this.texture) gl.deleteTexture(this.texture)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
