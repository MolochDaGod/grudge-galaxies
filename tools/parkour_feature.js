/* ================= Parkour (codepawl/parkour-mocap-glb on Hugging Face, Apache-2.0; hhtools Parkour Mocap by YaojieShen) =================
   Real optical mocap of vaults and flips, cut around the apex and turned to face forward. A running jump becomes a speed
   or kong vault now and then; /flip /backflip /sideflip /wallflip /vault play them on demand. */
const PK_RUN=['vaultSpeed','vaultKong','jumpRun','jumpRun'];
{const _os=toonOneShot;toonOneShot=function(inst,kind){const u=inst&&inst.userData;if(u&&u.mixer){
    if(kind==='jumpRun'&&!u.gun){const k=PK_RUN[Math.random()*PK_RUN.length|0];if(k!=='jumpRun'&&u.clips[k])return toonPlay(inst,k,.1,{once:true,hold:u.clips[k].duration*.95})}
    const pk={flip:'frontFlip',backflip:'backFlip',sideflip:'sideFlip',wallflip:'wallFlip',vault:'vaultHigh'}[kind];if(pk&&u.clips[pk])return toonPlay(inst,pk,.12,{once:true,hold:u.clips[pk].duration})}
  return _os(inst,kind)}}
Object.assign(EMOTES,{flip:'does a front flip',backflip:'does a back flip',sideflip:'does a side flip',wallflip:'flips off the wall',vault:'vaults'});
