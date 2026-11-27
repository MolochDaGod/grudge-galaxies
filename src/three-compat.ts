/**
 * three.js r185 for the legacy game runtime.
 *
 * The game was written against r128 as a global script (window.THREE, examples/js loaders, the legacy lighting model and
 * texture.encoding). This module builds a mutable THREE namespace from the r185 ES modules and restores exactly the
 * r128 behaviour the game depends on, so phase 1 changes the engine without changing how anything looks or plays:
 *
 *  - colour: ColorManagement off + linear output == r128's default LinearEncoding pipeline
 *  - texture.encoding / sRGBEncoding / LinearEncoding map onto texture.colorSpace
 *  - lights: r155 removed the legacy (non-physical) lighting mode; ambient/hemisphere/directional/point/spot
 *    intensities are scaled by PI so the same numbers give the same brightness (three's own migration rule)
 *  - addons that used to hang off THREE (GLTFLoader, SkeletonUtils) are attached to the namespace
 *
 * New code imports from 'three' directly and must not rely on these shims.
 */
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtilsNS from 'three/addons/utils/SkeletonUtils.js';

type AnyRecord = Record<string, unknown>;

THREE_NS.ColorManagement.enabled = false;

// legacy encoding constants (r128 values) -> colour spaces
const sRGBEncoding = 3001;
const LinearEncoding = 3000;
Object.defineProperty(THREE_NS.Texture.prototype, 'encoding', {
  configurable: true,
  get(this: THREE_NS.Texture) {
    return this.colorSpace === THREE_NS.SRGBColorSpace ? sRGBEncoding : LinearEncoding;
  },
  set(this: THREE_NS.Texture, v: number) {
    const cs = v === sRGBEncoding ? THREE_NS.SRGBColorSpace : THREE_NS.NoColorSpace;
    if (this.colorSpace !== cs) {
      this.colorSpace = cs;
      this.needsUpdate = true;
    }
  },
});

// renderer: linear output like r128, unless the caller changes it
class WebGLRenderer extends THREE_NS.WebGLRenderer {
  constructor(params?: THREE_NS.WebGLRendererParameters) {
    super(params);
    this.outputColorSpace = THREE_NS.LinearSRGBColorSpace;
  }
}

// lights: store the legacy number, hand three the physically scaled one
function legacyIntensity<T extends new (...a: any[]) => THREE_NS.Light>(Base: T): T {
  const C = class extends Base {
    // Light.copy assigns intensity from the source getter; carry the legacy number instead so clones don't compound
    copy(source: any, recursive?: boolean) {
      super.copy(source, recursive);
      (this as any)._legacyI = source._legacyI;
      return this;
    }
  };
  // three assigns this.intensity in the Light constructor, so a prototype accessor sees every write
  Object.defineProperty(C.prototype, 'intensity', {
    configurable: true,
    get(this: { _legacyI?: number }) {
      return (this._legacyI ?? 1) * Math.PI;
    },
    set(this: { _legacyI?: number }, v: number) {
      this._legacyI = v;
    },
  });
  return C;
}
const AmbientLight = legacyIntensity(THREE_NS.AmbientLight);
const HemisphereLight = legacyIntensity(THREE_NS.HemisphereLight);
const DirectionalLight = legacyIntensity(THREE_NS.DirectionalLight);
const SpotLight = legacyIntensity(THREE_NS.SpotLight);
// r128 point lights used decay 1 by default; r185 defaults to 2
class PointLightBase extends THREE_NS.PointLight {
  constructor(color?: THREE_NS.ColorRepresentation, intensity?: number, distance?: number, decay = 1) {
    super(color, intensity, distance, decay);
  }
}
const PointLight = legacyIntensity(PointLightBase);

// image-based light: r185's IBL is far stronger than r128's legacy mode for the same PMREM. Scale scene.environment and
// explicit material envMaps by one factor (measured against r128 on the same frame, see docs/MIGRATION_R185.md)
export const ENV_LEGACY_SCALE = 0.14; // 1/PI x 0.44, measured: r128 env adds +15 on the Sarrak ground test frame, r185 at 1/PI added +34
class Scene extends THREE_NS.Scene {
  constructor() {
    super();
    this.environmentIntensity = ENV_LEGACY_SCALE;
  }
}
for (const M of [THREE_NS.MeshStandardMaterial.prototype]) {
  Object.defineProperty(M, 'envMapIntensity', {
    configurable: true,
    get(this: { _legacyEnv?: number }) {
      return (this._legacyEnv ?? 1) * ENV_LEGACY_SCALE;
    },
    set(this: { _legacyEnv?: number }, v: number) {
      this._legacyEnv = v;
    },
  });
}
{
  const copy = THREE_NS.MeshStandardMaterial.prototype.copy;
  THREE_NS.MeshStandardMaterial.prototype.copy = function (this: any, source: any) {
    copy.call(this, source);
    this._legacyEnv = source._legacyEnv;
    return this;
  };
}

// r128 only lit MeshStandard/Physical with scene.environment; r185 also multiplies Lambert/Phong by it (reflectivity 1).
// Legacy Lambert/Phong materials get reflectivity 0 unless they bring their own envMap.
function noSceneEnv<T extends new (...a: any[]) => THREE_NS.Material>(Base: T): T {
  return class extends Base {
    constructor(...a: any[]) {
      super(...a);
      const p = a[0] || {};
      if (!('envMap' in p) && !('reflectivity' in p)) (this as any).reflectivity = 0;
    }
  };
}
const MeshLambertMaterial = noSceneEnv(THREE_NS.MeshLambertMaterial);
const MeshPhongMaterial = noSceneEnv(THREE_NS.MeshPhongMaterial);

const THREE: AnyRecord = { ...(THREE_NS as unknown as AnyRecord) };
Object.assign(THREE, {
  WebGLRenderer,
  Scene,
  MeshLambertMaterial,
  MeshPhongMaterial,
  AmbientLight,
  HemisphereLight,
  DirectionalLight,
  PointLight,
  SpotLight,
  sRGBEncoding,
  LinearEncoding,
  GLTFLoader,
  // a plain object so the game can wrap SkeletonUtils.clone (module namespaces are frozen)
  SkeletonUtils: { ...(SkeletonUtilsNS as unknown as AnyRecord) },
  REVISION_LEGACY_TARGET: '128',
});

(window as unknown as { THREE: AnyRecord }).THREE = THREE;
export default THREE;
export { THREE_NS };
