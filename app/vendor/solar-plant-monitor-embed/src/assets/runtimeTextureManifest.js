export const RUNTIME_TEXTURE_VARIANTS = Object.freeze([
  {
    asset: 'PV.gltf',
    source: 'PV_Bake1_PBR StoA_Diffuse.png',
    runtime: 'runtime/PV_Bake1_PBR StoA_Diffuse.png',
    maxDimension: 2048,
    sourceSha256:
      '05cea3231eb0d7246491ad9d6fa3ecdb69061bbcfd500b97b478a73fd1f93248',
    runtimeSha256:
      '8307ced0cdc59dd1285b4a715a7bebb265890e2139f539f0b88fd5f8aa5a341a',
  },
  {
    asset: 'PV.gltf',
    source: 'PV_Bake1_PBR StoA_Normal.png',
    runtime: 'runtime/PV_Bake1_PBR StoA_Normal.png',
    maxDimension: 2048,
    sourceSha256:
      '55ccd6995f9f56709316ecacdd1bde0645372a39419c147c27be640a1767f5cf',
    runtimeSha256:
      '28b5fe804b9462b869fc6aa6a0f0472ba3f24c572c77a1c448018650f9514a65',
  },
  {
    asset: 'PV.gltf',
    source:
      'PV_Bake1_PBR StoA_Metalness-PV_Bake1_PBR StoA_Roughness.png',
    runtime:
      'runtime/PV_Bake1_PBR StoA_Metalness-PV_Bake1_PBR StoA_Roughness.png',
    maxDimension: 2048,
    sourceSha256:
      '100f101da7081fa15830e444a2235c40cfdddf3a3ed0c3921b8b5ad7fd479587',
    runtimeSha256:
      '31902d0cd676ef40eec72472ed28a6b6f5570d160d74680d0fa235c4eed6b437',
  },
  {
    asset: 'ESS.gltf',
    source: 'ESS_Bake1_PBR StoA_Normal.png',
    runtime: 'runtime/ESS_Bake1_PBR StoA_Normal.png',
    maxDimension: 1024,
    sourceSha256:
      '548e87b09e6ca71f339ce3ebcaaa4aa9637c3af2dc3e18ccc14e70a2b7bc0139',
    runtimeSha256:
      '91f411a55460669597df797a861e4443b2633da4d80e9e1559c800d31a580e4e',
  },
  {
    asset: 'Transformer.gltf',
    source: 'Transformer_Bake1_PBR StoA_Normal.png',
    runtime: 'runtime/Transformer_Bake1_PBR StoA_Normal.png',
    maxDimension: 1024,
    sourceSha256:
      'c2120e819864acd3b7a0eb18b4958f0d263639b91f7a3f99f90b7a1eba6bd957',
    runtimeSha256:
      '5a9dae91cf3cf283b5d06ca62e4dc62072c1c0ef6f4d51ad60c8bc76f53f397d',
  },
  {
    asset: 'PCS.gltf',
    source: 'PCS_Bake1_PBR StoA_Normal.png',
    runtime: 'runtime/PCS_Bake1_PBR StoA_Normal.png',
    maxDimension: 1024,
    sourceSha256:
      '7dbf15946a0fea5dd4790c90b4a67972e1b8f2d47934f35778eedd5ecd732509',
    runtimeSha256:
      '52477597e9b9a3944fe492ba89275d54abefe15a8bd61175dc619122d0c2b109',
  },
])

export function getRuntimeTextureVariantsForAsset(asset) {
  return RUNTIME_TEXTURE_VARIANTS.filter((variant) => variant.asset === asset)
}
