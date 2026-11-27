# Animation pipeline

The game stores every clip in `dist/anim.js` (`window.GRUDGE_ANIM`): 20 canonical bones, rotations as deltas from a
T-pose in a character-facing frame, 24 fps, int16. Any humanoid rig can be baked into it and played on every Grudge 6 race.

## Adding clips from a GLB pack

`tools/bake2.html` + `tools/retarget.js` bake clips from GLB animation packs. Bone maps exist for:

- `kaykit`: KayKit Rig_Medium / Rig_Large (`hips`, `upperarm.l`, `wrist.r` ...)
- `rigify`: Quaternius Universal Animation Library and other Rigify `DEF-` rigs
- `ue`: Quaternius Universal Animation Library 2 and other UE-mannequin rigs (`pelvis`, `spine_03`, `upperarm_l` ...); job list in `tools/bake_ual2_jobs.js`

Steps that were needed for the ObjectStore packs:

1. `gltf-transform copy in.glb out.glb` then `gltf-transform dequantize` (meshopt and quantization are not readable by three r128).
2. `python3 tools/densify.py out.glb` gives accessors with no buffer view (implicit zeros) a real one; r128 cannot read them.
3. Serve the folder, open `bake2.html`, call `__bake([[id, file, clipName, rig], ...])`, merge the result's `clips` into `anim.js`.

Clips added this way: pistol/rifle aim, shoot, fire, reload (KayKit CombatRanged), rifle and bow run, run-strafe,
dodges, sneak, crouch walk (MovementAdvanced), pistol idle/aim/shot/reload, roll, swim, drive, punches, interact,
pick up, kneeling repair, talking, torch idle, sprint (UAL), use item, throw, deaths (KayKit General).

## Generating new motion (free tools, checked November 2026)

| Need | Use | Licence notes |
|---|---|---|
| Text prompt to clip | **NVIDIA Kimodo** (SOMA-RP / SOMA-SEED v1.1), free Space `nvidia/Kimodo`, exports BVH | NVIDIA Open Model License, commercial use allowed. The SMPL-X variant is non-commercial. |
| Higher quality text to clip | **Tencent HY-Motion 1.0** (Space `tencent/HY-Motion-1.0`) | Commercial OK except in the EU, UK and South Korea; outputs SMPL-H. |
| Record yourself on video | GVHMR (Space `LittleFrog/GVHMR`) for reference only | Weights are non-commercial and output is SMPL (Meshcapade licence needed for commercial). |
| Strafe / walk style library | **100STYLE** (BVH) | CC BY 4.0, credit required. |

Avoid shipping clips from anything trained on HumanML3D / AMASS / Motion-X (MoMask, MotionGPT, T2M-GPT, MotionLCM):
those datasets are research-only. Route for shippable clips: BVH -> Blender -> Mixamo bone names -> 24 fps ->
bake with a `mixamo` map (the original `bake.html` handles Mixamo FBX directly).
