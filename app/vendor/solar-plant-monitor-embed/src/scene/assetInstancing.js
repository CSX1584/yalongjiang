import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'

const DEFAULT_POSITION = Object.freeze([0, 0, 0])
const DEFAULT_ROTATION = Object.freeze([0, 0, 0])
const DEFAULT_SCALE = Object.freeze([1, 1, 1])

export function composeInstanceMatrix({
  matrix,
  position = DEFAULT_POSITION,
  rotation = DEFAULT_ROTATION,
  rotationY,
  scale = DEFAULT_SCALE,
}) {
  if (matrix?.isMatrix4) return matrix.clone()
  const resolvedRotation =
    rotationY === undefined ? rotation : [rotation[0], rotationY, rotation[2]]
  return new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...resolvedRotation)),
    new Vector3(...scale),
  )
}

function hasUnsupportedMeshFeatures(mesh) {
  return (
    mesh.isSkinnedMesh ||
    Boolean(mesh.morphTargetInfluences?.length) ||
    !mesh.geometry ||
    !mesh.material
  )
}

export function createInstancedAssetParts(
  sourceScene,
  {
    modelOffset = DEFAULT_POSITION,
    modelRotation = DEFAULT_ROTATION,
    modelScale = DEFAULT_SCALE,
  },
  instanceTransforms,
) {
  sourceScene.updateMatrixWorld(true)
  const sourceMeshes = []
  sourceScene.traverse((object) => {
    if (object.isMesh && object.visible) sourceMeshes.push(object)
  })

  if (
    sourceMeshes.length === 0 ||
    sourceMeshes.some(hasUnsupportedMeshFeatures)
  ) {
    return null
  }

  const inverseSceneMatrix = sourceScene.matrixWorld.clone().invert()
  const modelMatrix = composeInstanceMatrix({
    position: modelOffset,
    rotation: modelRotation,
    scale: modelScale,
  })

  return sourceMeshes.map((sourceMesh, index) => {
    const meshRelativeMatrix = new Matrix4().multiplyMatrices(
      inverseSceneMatrix,
      sourceMesh.matrixWorld,
    )
    const modelMeshMatrix = new Matrix4().multiplyMatrices(
      modelMatrix,
      meshRelativeMatrix,
    )
    const matrices = instanceTransforms.map((transform) =>
      new Matrix4().multiplyMatrices(
        composeInstanceMatrix(transform),
        modelMeshMatrix,
      ),
    )

    return {
      key: `${sourceMesh.uuid}-${index}`,
      geometry: sourceMesh.geometry,
      material: sourceMesh.material,
      matrices,
      renderOrder: sourceMesh.renderOrder,
    }
  })
}
