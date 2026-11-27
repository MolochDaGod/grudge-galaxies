/* ================= Terrain protection: building pads, mesh-true heights, finer ground =================
   The planet mesh is a grid (57 m cells at 288², finer on Medium/High). Two rules keep buildings and props out of the ground:
   1. Before the mesh is sampled, every building / static footprint pulls the terrain to its base (a flat pad that reaches the
      nearest grid vertices, then eases back out), like the town plateaus already do.
   2. Once the mesh exists, every height query (player, NPCs, kit pieces, nodes, wildlife) reads the mesh itself (exact
      triangle interpolation), so nothing is placed on a height the player can't see. */
const TERRAIN_RES={low:288,medium:336,high:384};
function buildPads(w){const cell=EXT/(TERRAIN_RES[quality]||288),bins=new Map();let n=0;
  for(const p of w.placements){const c=clsOf(p);if(c==='npc'||c==='travel')continue;const r=p.w?Math.max(p.w,p.d||p.w)/2:Math.min((p.r||0)*1.15,70)/1;if(!(r>=2.5)||r>90)continue;
    const base=w._padRaw?w._padRaw(p.x,p.z):0;const pad={x:p.x,z:p.z,r,base,inner:r+cell*.55,outer:r+cell*1.7};n++;
    const b0x=Math.floor((p.x-pad.outer)/512),b1x=Math.floor((p.x+pad.outer)/512),b0z=Math.floor((p.z-pad.outer)/512),b1z=Math.floor((p.z+pad.outer)/512);
    for(let bx=b0x;bx<=b1x;bx++)for(let bz=b0z;bz<=b1z;bz++){const k=bx+','+bz;(bins.get(k)||bins.set(k,[]).get(k)).push(pad)}}
  w._pads=bins;return n}
{const _gh=groundH;groundH=function(w,x,z){
  if(w&&w.hGrid)return hGridAt(w,x,z);
  const h=_gh(w,x,z);const B=w&&w._pads;if(!B)return h;const a=B.get(Math.floor(x/512)+','+Math.floor(z/512));if(!a)return h;
  let best=0,bh=h;for(const p of a){const d=Math.hypot(x-p.x,z-p.z);if(d>=p.outer)continue;const k=d<=p.inner?1:1-smooth(p.inner,p.outer,d);if(k>best){best=k;bh=p.base}}
  return h+(bh-h)*best}}
{const _hg=hGridAt;hGridAt=function(w,x,z){if(!w.hGrid)return groundH(w,x,z);return _hg(w,x,z)}}
{const _bg=buildGround;buildGround=function(w){if(groundWorld===w)return _bg(w);
  w.hGrid=null;w._pads=null;indexPois(w);w._padRaw=(x,z)=>groundH(w,x,z);buildPads(w);
  const r=_bg(w);w._meshH=true;return r}}
