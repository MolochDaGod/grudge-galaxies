// Shared retarget core: used by the offline bake (source side) and embedded in the page (target side).
const RT_KEYS=['Hips','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'];
const RT_CHILD={Hips:'Spine2',Spine2:'Neck',Neck:'Head',LeftShoulder:'LeftArm',LeftArm:'LeftForeArm',LeftForeArm:'LeftHand',RightShoulder:'RightArm',RightArm:'RightForeArm',RightForeArm:'RightHand',LeftUpLeg:'LeftLeg',LeftLeg:'LeftFoot',LeftFoot:'LeftToeBase',RightUpLeg:'RightLeg',RightLeg:'RightFoot',RightFoot:'RightToeBase'};
const RT_DIR={Hips:[0,1,0],Spine2:[0,1,0],Neck:[0,1,0],LeftShoulder:[1,0,0],LeftArm:[1,0,0],LeftForeArm:[1,0,0],RightShoulder:[-1,0,0],RightArm:[-1,0,0],RightForeArm:[-1,0,0],LeftUpLeg:[0,-1,0],LeftLeg:[0,-1,0],LeftFoot:[0,0,1],RightUpLeg:[0,-1,0],RightLeg:[0,-1,0],RightFoot:[0,0,1]};
const RT_BIP={Hips:'Pelvis',Spine2:'Spine',Neck:'Neck',Head:'Head',LeftShoulder:'L_Clavicle',LeftArm:'L_UpperArm',LeftForeArm:'L_Forearm',LeftHand:'L_Hand',RightShoulder:'R_Clavicle',RightArm:'R_UpperArm',RightForeArm:'R_Forearm',RightHand:'R_Hand',
  LeftUpLeg:'L_Thigh',LeftLeg:'L_Calf',LeftFoot:'L_Foot',LeftToeBase:'L_Toe0',RightUpLeg:'R_Thigh',RightLeg:'R_Calf',RightFoot:'R_Foot',RightToeBase:'R_Toe0'};
function rtWorldQ(o){const q=new THREE.Quaternion();o.getWorldQuaternion(q);return q}
function rtWorldP(o){const p=new THREE.Vector3();o.getWorldPosition(p);return p}
// Facing frame: canonical +X = character's left, +Y = up, +Z = forward.
function rtFrame(map){const l=rtWorldP(map.LeftUpLeg).sub(rtWorldP(map.RightUpLeg));l.y=0;l.normalize();const up=new THREE.Vector3(0,1,0),f=new THREE.Vector3().crossVectors(l,up).normalize();
  const m=new THREE.Matrix4().makeBasis(l,up,f);return new THREE.Quaternion().setFromRotationMatrix(m)}
// Swing every mapped bone so the rig stands in the canonical T-pose; returns those world rotations.
function rtTPose(root,map,F){root.updateMatrixWorld(true);
  for(const k of RT_KEYS){const b=map[k],c=map[RT_CHILD[k]];if(!b||!c||!RT_DIR[k])continue;
    const d=rtWorldP(c).sub(rtWorldP(b)).normalize(),want=new THREE.Vector3(...RT_DIR[k]).applyQuaternion(F);
    const W=rtWorldQ(b),R=new THREE.Quaternion().setFromUnitVectors(d,want),nw=R.multiply(W),pw=b.parent?rtWorldQ(b.parent):new THREE.Quaternion();
    b.quaternion.copy(pw.invert().multiply(nw));b.updateMatrixWorld(true)}
  const T={};for(const k of RT_KEYS)if(map[k])T[k]=rtWorldQ(map[k]);return T}
