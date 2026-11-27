const {chromium}=require('playwright');const crypto=require('crypto'),fs=require('fs');
const U='ual2.glb';
const J=[['swordA','Sword_Regular_A'],['swordB','Sword_Regular_B'],['swordC','Sword_Regular_C'],['swordCombo','Sword_Regular_Combo'],['swordBlock','Sword_Block'],['swordDash','Sword_Dash_RM'],
['shieldIdle','Idle_Shield_Loop'],['shieldBash','Shield_OneShot'],['shieldBreak','Idle_Shield_Break'],['shieldDash','Shield_Dash_RM'],['hook','Melee_Hook'],['knockback','Hit_Knockback'],
['climbUp','ClimbUp_1m_RM'],['consume','Consume'],['harvest','Farm_Harvest'],['plantSeed','Farm_PlantSeed'],['watering','Farm_Watering'],['treeChop','TreeChopping_Loop'],['carryWalk','Walk_Carry_Loop'],
['chestOpen','Chest_Open'],['foldArms','Idle_FoldArms_Loop'],['lanternIdle','Idle_Lantern_Loop'],['comlink','Idle_TalkingPhone_Loop'],['railLean','Idle_Rail_Loop'],['railCall','Idle_Rail_Call'],
['shakeNo','Idle_No_Loop'],['nodYes','Yes'],['getUp','LayToIdle'],['jumpStart','NinjaJump_Start'],['jumpAir','NinjaJump_Idle_Loop'],['jumpLand','NinjaJump_Land'],['throwOver','OverhandThrow'],
['slideStart','Slide_Start'],['slide','Slide_Loop'],['slideExit','Slide_Exit'],['zIdle','Zombie_Idle_Loop'],['zScratch','Zombie_Scratch'],['zWalk','Zombie_Walk_Fwd_Loop']].map(([a,b])=>[a,U,b,'ue']);
(async()=>{const b=await chromium.launch();const pg=await b.newPage();pg.on('pageerror',e=>console.log('ERR',e.message));
await pg.route('**/*',r=>{const u=r.request().url();if(/localhost/.test(u))return r.continue();if(/cdnjs|jsdelivr/.test(u)){const f='cdn/'+crypto.createHash('md5').update(u).digest('hex').slice(0,12);if(fs.existsSync(f))return r.fulfill({body:fs.readFileSync(f),contentType:'application/javascript'})}return r.abort()});
await pg.goto('http://localhost:8793/bake2.html');await pg.waitForFunction(()=>window.__bake&&THREE.GLTFLoader);
const out=await pg.evaluate(j=>__bake(j),J);console.log(out.log.join('\n'));delete out.log;fs.writeFileSync('anim3.json',JSON.stringify(out));console.log('bytes',JSON.stringify(out).length);await b.close()})();
