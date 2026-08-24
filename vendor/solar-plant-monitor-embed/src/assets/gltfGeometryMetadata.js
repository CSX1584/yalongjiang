import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

function getPrimitiveTriangleCount(document, primitive) {
  const count =
    primitive.indices === undefined
      ? document.accessors?.[primitive.attributes?.POSITION]?.count
      : document.accessors?.[primitive.indices]?.count
  if (!count) return 0

  switch (primitive.mode ?? 4) {
    case 5:
    case 6:
      return Math.max(0, count - 2)
    case 4:
      return Math.floor(count / 3)
    default:
      return 0
  }
}

function calculateGltfBounds(document) {
  const bounds = new Box3()
  const nodes = document.nodes ?? []
  const localMatrices = nodes.map((node) => {
    const matrix = new Matrix4()
    if (node.matrix) return matrix.fromArray(node.matrix)
    return matrix.compose(
      new Vector3(...(node.translation ?? [0, 0, 0])),
      new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
      new Vector3(...(node.scale ?? [1, 1, 1])),
    )
  })
  const activeScene = document.scenes?.[document.scene ?? 0]
  const childNodeIds = new Set(nodes.flatMap((node) => node.children ?? []))
  const rootNodeIds =
    activeScene?.nodes ??
    nodes.map((_, index) => index).filter((index) => !childNodeIds.has(index))

  function visitNode(nodeId, parentMatrix) {
    const node = nodes[nodeId]
    if (!node) return
    const worldMatrix = parentMatrix.clone().multiply(localMatrices[nodeId])

    if (node.mesh !== undefined) {
      for (const primitive of document.meshes?.[node.mesh]?.primitives ?? []) {
        const accessor = document.accessors?.[primitive.attributes?.POSITION]
        if (!accessor?.min || !accessor?.max) continue
        for (const x of [accessor.min[0], accessor.max[0]]) {
          for (const y of [accessor.min[1], accessor.max[1]]) {
            for (const z of [accessor.min[2], accessor.max[2]]) {
              bounds.expandByPoint(
                new Vector3(x, y, z).applyMatrix4(worldMatrix),
              )
            }
          }
        }
      }
    }

    for (const childId of node.children ?? []) {
      visitNode(childId, worldMatrix)
    }
  }

  rootNodeIds.forEach((nodeId) => visitNode(nodeId, new Matrix4()))
  return bounds
}

export function deriveGltfGeometryMetadata(gltfSource) {
  const document =
    typeof gltfSource === 'string' ? JSON.parse(gltfSource) : gltfSource
  const bounds = calculateGltfBounds(document)
  if (bounds.isEmpty()) {
    throw new Error('无法从 glTF POSITION 访问器计算模型边界')
  }

  const center = bounds.getCenter(new Vector3())
  const dimensions = bounds.getSize(new Vector3()).toArray()
  const triangleCount = (document.meshes ?? []).reduce(
    (meshTotal, mesh) =>
      meshTotal +
      (mesh.primitives ?? []).reduce(
        (primitiveTotal, primitive) =>
          primitiveTotal + getPrimitiveTriangleCount(document, primitive),
        0,
      ),
    0,
  )

  return {
    dimensions,
    sourceBounds: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
    },
    modelOffset: [-center.x, -bounds.min.y, -center.z],
    triangleCount,
  }
}
