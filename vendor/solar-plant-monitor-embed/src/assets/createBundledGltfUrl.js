export function createBundledGltfUrl(
  gltfSource,
  resourceUrls,
  moduleUrl,
) {
  const document = JSON.parse(gltfSource)
  const resolveResource = (uri) => {
    const decodedUri = decodeURIComponent(uri)
    const resourceUrl = resourceUrls[decodedUri] ?? resourceUrls[uri]
    if (!resourceUrl) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(uri)) return uri
      throw new Error(`Bundled glTF 缺少外部资源映射：${decodedUri}`)
    }
    if (resourceUrl.startsWith('data:') || resourceUrl.startsWith('blob:')) {
      return resourceUrl
    }

    // The glTF document itself is a data URI. GLTFLoader otherwise resolves a
    // root-relative buffer URL against the `data:model/` pseudo base path.
    return new URL(resourceUrl, moduleUrl).href
  }

  document.buffers?.forEach((buffer) => {
    if (buffer.uri) buffer.uri = resolveResource(buffer.uri)
  })
  document.images?.forEach((image) => {
    if (image.uri) image.uri = resolveResource(image.uri)
  })

  return `data:model/gltf+json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(document),
  )}`
}
