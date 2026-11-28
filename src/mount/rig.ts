/**
 * Mount rig: where a rider sits, holds the reins and puts their feet, read from the mount's own skeleton, plus
 * two-bone IK that puts the rider's hands and feet there every frame.
 *
 * Anchors are measured once per mount, in its idle pose, then parented to its bones so they move with every gallop:
 *  - seat: the mount's rider bone when it has one (Toon RTS: Bone_Mount); otherwise the top of the back between the
 *    Torso and Torso2 bones (Quaternius animals), found by casting a ray down onto the skinned mesh;
 *  - reins: the top of the neck (Neck1 / Bip001 Neck), cast the same way;
 *  - stirrups: either side of the seat, on the flank surface (side ray casts), at the rider's leg reach.
 * Each frame, after the game has animated and placed the rider (the 'sit' clip), the rider is moved so their pelvis
 * lands on the seat, and their hands and feet are solved onto the reins and stirrups. A rider attacking from the
 * saddle keeps their animated right arm.
 *
 * Rider bones are found by name for both rigs the game uses: Bip001 (Toon RTS; three.js loads 'Bip001 L Hand' as 'Bip001_L_Hand') and Mixamo-style (Hips, LeftArm, ...).
 * A rider without those bones (the stand-in model) still gets the seat, without IK.
 */
import * as THREE from 'three';
import { bridge } from '../bridge';

const UP = new THREE.Vector3(0, 1, 0);
const RIDE_BOB = 0.2; // share of the mount's vertical bounce the rider keeps

interface Anchors {
  seat: THREE.Object3D;
  reins: THREE.Object3D;
  stirL: THREE.Object3D;
  stirR: THREE.Object3D;
  source: string;
}
interface Chain { a: THREE.Bone; b: THREE.Bone; c: THREE.Bone }
interface RiderRig { pelvis: THREE.Bone | null; armL: Chain | null; armR: Chain | null; legL: Chain | null; legR: Chain | null; leg: number }

const find = (root: THREE.Object3D, re: RegExp): THREE.Bone | null => {
  let hit: THREE.Bone | null = null;
  root.traverse((o: any) => { if (!hit && (o.isBone || o.type === 'Bone' || /Bip001|Bone_/.test(o.name)) && re.test(o.name)) hit = o; });
  return hit;
};
const meshesOf = (root: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  root.traverse((o: any) => { if (o.isMesh && o.visible) out.push(o); });
  return out;
};

/** cast down (or sideways) onto the mount's skinned meshes in their current pose */
function cast(meshes: THREE.Mesh[], from: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 | null {
  const rc = new THREE.Raycaster(from, dir.clone().normalize(), 0, 50);
  for (const m of meshes) { (m as any).computeBoundingSphere?.(); m.geometry.computeBoundingSphere?.(); }
  const hits = rc.intersectObjects(meshes, false);
  return hits.length ? hits[0].point.clone() : null;
}

function attach(parent: THREE.Object3D, worldPos: THREE.Vector3, name: string): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  parent.updateWorldMatrix(true, false);
  o.position.copy(parent.worldToLocal(worldPos.clone()));
  parent.add(o);
  return o;
}

export function buildMountAnchors(obj: THREE.Object3D, legReach: number): Anchors | null {
  obj.updateMatrixWorld(true);
  const meshes = meshesOf(obj);
  if (!meshes.length) return null;
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
  const rider = find(obj, /^Bone_Mount$/);
  const torso = find(obj, /^Torso$/), torso2 = find(obj, /^Torso2$/) || find(obj, /^Bip001[ _]Spine$/);
  const neck = find(obj, /^Neck1$/) || find(obj, /^Bip001[ _]Neck$/);
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  let seatW: THREE.Vector3 | null = null, seatBone: THREE.Object3D | null = null, source = '';
  if (rider) {
    seatW = rider.getWorldPosition(p).clone();
    seatBone = rider;
    source = 'Bone_Mount';
  } else if (torso && torso2) {
    torso.getWorldPosition(p); torso2.getWorldPosition(q);
    const mid = p.clone().lerp(q, 0.5);
    seatW = cast(meshes, new THREE.Vector3(mid.x, box.max.y + 2, mid.z), UP.clone().negate());
    seatBone = torso2;
    source = 'back surface over Torso/Torso2';
  }
  if (!seatW || !seatBone) {
    // no usable bones: the old guess, centred
    seatW = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + size.y * 0.74, (box.min.z + box.max.z) / 2);
    seatBone = obj;
    source = 'bounding box (no rider or back bones)';
  }
  // reins over the neck
  let reinW: THREE.Vector3 | null = null;
  if (neck) {
    neck.getWorldPosition(p);
    reinW = cast(meshes, new THREE.Vector3(p.x, box.max.y + 2, p.z), UP.clone().negate()) || p.clone();
    reinW.y += 0.05;
  }
  // forward: from the seat towards the neck, flattened
  const fwd = reinW ? reinW.clone().sub(seatW).setY(0) : new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion()));
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
  fwd.normalize();
  if (!reinW) reinW = seatW.clone().addScaledVector(fwd, size.z * 0.3).add(new THREE.Vector3(0, 0.15, 0));
  // reins sit a little above and in front of the withers, where hands would be
  const reinsAt = seatW.clone().lerp(reinW, 0.55).add(new THREE.Vector3(0, 0.18, 0));
  const side = new THREE.Vector3().crossVectors(UP, fwd).normalize();
  // stirrups on the flanks, at leg reach below the seat
  const stirY = seatW.y - legReach * 0.82;
  const flank = (s: number) => {
    const from = seatW!.clone().addScaledVector(side, s * (size.x + 2));
    from.y = seatW!.y - 0.25;
    const hit = cast(meshes, from, side.clone().multiplyScalar(-s));
    const x = hit ? hit.clone().addScaledVector(side, s * 0.06) : seatW!.clone().addScaledVector(side, s * Math.max(0.22, size.x * 0.32));
    x.y = stirY;
    return x;
  };
  const seat = attach(seatBone, seatW, 'mount-seat');
  return { seat, reins: attach(neck || seatBone, reinsAt, 'mount-reins'), stirL: attach(seatBone, flank(1), 'mount-stirrup-l'), stirR: attach(seatBone, flank(-1), 'mount-stirrup-r'), source };
}

export function riderRig(model: THREE.Object3D): RiderRig {
  const b = (re: RegExp) => find(model, re);
  const chain = (a: RegExp, m: RegExp, c: RegExp): Chain | null => {
    const A = b(a), B = b(m), C = b(c);
    return A && B && C ? { a: A, b: B, c: C } : null;
  };
  const rig: RiderRig = {
    pelvis: b(/Bip001[ _]Pelvis$|^(mixamorig:?)?Hips$/),
    armL: chain(/Bip001[ _]L[ _]UpperArm$|^(mixamorig:?)?LeftArm$/, /Bip001[ _]L[ _]Forearm$|^(mixamorig:?)?LeftForeArm$/, /Bip001[ _]L[ _]Hand$|^(mixamorig:?)?LeftHand$/),
    armR: chain(/Bip001[ _]R[ _]UpperArm$|^(mixamorig:?)?RightArm$/, /Bip001[ _]R[ _]Forearm$|^(mixamorig:?)?RightForeArm$/, /Bip001[ _]R[ _]Hand$|^(mixamorig:?)?RightHand$/),
    legL: chain(/Bip001[ _]L[ _]Thigh$|^(mixamorig:?)?LeftUpLeg$/, /Bip001[ _]L[ _]Calf$|^(mixamorig:?)?LeftLeg$/, /Bip001[ _]L[ _]Foot$|^(mixamorig:?)?LeftFoot$/),
    legR: chain(/Bip001[ _]R[ _]Thigh$|^(mixamorig:?)?RightUpLeg$/, /Bip001[ _]R[ _]Calf$|^(mixamorig:?)?RightLeg$/, /Bip001[ _]R[ _]Foot$|^(mixamorig:?)?RightFoot$/),
    leg: 0.8,
  };
  if (rig.legL) {
    model.updateMatrixWorld(true);
    const a = rig.legL.a.getWorldPosition(new THREE.Vector3()), m = rig.legL.b.getWorldPosition(new THREE.Vector3()), c = rig.legL.c.getWorldPosition(new THREE.Vector3());
    rig.leg = a.distanceTo(m) + m.distanceTo(c);
  }
  return rig;
}

/* ---- two-bone IK in world space ---- */
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3(), _T = new THREE.Vector3();
const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _id = new THREE.Quaternion();
function rotateWorld(bone: THREE.Object3D, q: THREE.Quaternion, w: number) {
  const r = w >= 1 ? q : _id.clone().slerp(q, w);
  bone.getWorldQuaternion(_wq);
  const parentQ = bone.parent ? bone.parent.getWorldQuaternion(_pq) : _pq.identity();
  bone.quaternion.copy(parentQ.invert().multiply(r.clone().multiply(_wq)));
  bone.updateWorldMatrix(false, true);
}
export function solveTwoBone(ch: Chain, target: THREE.Vector3, pole: THREE.Vector3, w = 1) {
  ch.c.updateWorldMatrix(true, false);
  ch.a.getWorldPosition(_A); ch.b.getWorldPosition(_B); ch.c.getWorldPosition(_C);
  const l1 = _A.distanceTo(_B), l2 = _B.distanceTo(_C);
  if (l1 < 1e-4 || l2 < 1e-4) return;
  const toT = _T.copy(target).sub(_A);
  const d = Math.min(Math.max(toT.length(), 1e-3), (l1 + l2) * 0.999);
  const dir = toT.normalize();
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const pd = pole.clone().sub(_A);
  const perp = pd.sub(dir.clone().multiplyScalar(pd.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.copy(_B).sub(_A).sub(dir.clone().multiplyScalar(_B.clone().sub(_A).dot(dir))); // keep the current bend
  if (perp.lengthSq() < 1e-8) return;
  perp.normalize();
  const bDes = _A.clone().addScaledVector(dir, cosA * l1).addScaledVector(perp, Math.sqrt(1 - cosA * cosA) * l1);
  _q.setFromUnitVectors(_B.clone().sub(_A).normalize(), bDes.clone().sub(_A).normalize());
  rotateWorld(ch.a, _q, w);
  ch.c.updateWorldMatrix(true, false);
  ch.b.getWorldPosition(_B); ch.c.getWorldPosition(_C);
  const tEnd = _A.clone().addScaledVector(dir, d);
  _q.setFromUnitVectors(_C.clone().sub(_B).normalize(), tEnd.sub(_B).normalize());
  rotateWorld(ch.b, _q, w);
}

/* ---- wiring ---- */
export async function installMountRig() {
  const B = await bridge();
  const stats = { mounts: 0, lastSource: '', ik: false };
  (window as any).GG_MOUNTRIG = { stats, buildMountAnchors, riderRig, solveTwoBone };
  let ema = NaN, lastT = 0, rigFresh = true;
  let rigFor: THREE.Object3D | null = null, anchors: Anchors | null = null, rider: RiderRig | null = null, riderFor: THREE.Object3D | null = null;
  const v = new THREE.Vector3(), s = new THREE.Vector3(), r = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3();
  B.wrap('updatePlay', (orig) => function (this: unknown, ...a: any[]) {
    const out = orig.apply(this, a);
    try {
      const p = B.play, m = p?.mount, model: THREE.Object3D | undefined = p?.model;
      if (!m || !m.obj || !model || m.def?.fly || m.def?.cart) { rigFor = null; return out; }
      if (riderFor !== model) { rider = riderRig(model); riderFor = model; }
      if (rigFor !== m.obj) {
        anchors = buildMountAnchors(m.obj, rider?.leg || 0.8);
        rigFor = m.obj;
        rigFresh = true;
        stats.mounts++;
        stats.lastSource = anchors?.source || 'none';
        stats.ik = !!(rider && rider.legL && rider.armL);
      }
      if (!anchors) return out;
      m.obj.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
      // 1. pelvis onto the seat. The rider absorbs the mount's vertical bounce: the seat height relative to the
      //    mount is low-passed and only RIDE_BOB of what is left passes through (the wolf's gallop is a 1.4 m leap)
      anchors.seat.getWorldPosition(s);
      const root = m.obj.getWorldPosition(new THREE.Vector3());
      const rel = s.y - root.y, now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000 || 0.016);
      lastT = now;
      if (!Number.isFinite(ema) || rigFresh) { ema = rel; rigFresh = false; }
      ema += (rel - ema) * Math.min(1, dt / 0.9);
      const bounce = s.y - (root.y + ema + (rel - ema) * RIDE_BOB);
      s.y -= bounce;
      if (rider?.pelvis) {
        rider.pelvis.getWorldPosition(v);
        model.position.add(s.clone().sub(v).add(new THREE.Vector3(0, 0.06, 0)));
      } else model.position.set(s.x, s.y - 0.45, s.z);
      model.updateMatrixWorld(true);
      if (!rider) return out;
      // 2. feet into the stirrups, knees forward
      anchors.reins.getWorldPosition(r);
      fwd.copy(r).sub(s).setY(0).normalize();
      side.crossVectors(UP, fwd).normalize();
      const knee = (sgn: number) => s.clone().addScaledVector(fwd, 1.2).addScaledVector(side, sgn * 0.4).add(new THREE.Vector3(0, -0.2, 0));
      // stirrups ride with the rider (same damped bounce), so the legs do not pump with every stride
      const stir = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -bounce, 0));
      if (rider.legL) solveTwoBone(rider.legL, stir(anchors.stirL), knee(1), 1);
      if (rider.legR) solveTwoBone(rider.legR, stir(anchors.stirR), knee(-1), 1);
      // 3. hands on the reins, elbows back and out; the sword arm stays free in a fight
      const elbow = (sgn: number) => s.clone().addScaledVector(fwd, -0.6).addScaledVector(side, sgn * 0.6).add(new THREE.Vector3(0, 0.3, 0));
      const grip = (sgn: number) => r.clone().addScaledVector(side, sgn * 0.11);
      if (rider.armL) solveTwoBone(rider.armL, grip(1), elbow(1), 0.9);
      const fighting = !!(B.combat?.p) || (performance.now() - ((model.userData as any).lastOneShot || 0) < 900);
      if (rider.armR && !fighting) solveTwoBone(rider.armR, grip(-1), elbow(-1), 0.9);
    } catch (e) {
      console.warn('[mount rig]', e);
      rigFor = null;
    }
    return out;
  });
}
