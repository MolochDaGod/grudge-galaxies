# Packs Poly Haven (CC0) PBR sets into two compact atlases for the game.
# Surface atlas (kit pieces): 3x2 tiles of 512, RGB = (normal x, normal y, albedo detail); rough atlas = roughness.
# Ground atlas (terrain): 4x2 tiles of 512, RGB = (normal x, normal y, roughness).
import sys,os,numpy as np
from PIL import Image
PH=sys.argv[1];OUT=sys.argv[2];T=512
def load(d,kind):
    t=os.path.join(PH,d,'textures');fs=os.listdir(t)
    f=[x for x in fs if ('_'+kind+'_') in x or x.split('_')[-2]==kind]
    if not f:return None
    return Image.open(os.path.join(t,f[0])).convert('RGB').resize((T,T),Image.LANCZOS)
def rough(d):
    r=load(d,'rough')
    if r is not None:return np.asarray(r)[...,0].astype(np.float32)/255
    a=load(d,'arm');return np.asarray(a)[...,1].astype(np.float32)/255
def albedo_detail(d):
    c=load(d,'diff') or load(d,'col');g=np.asarray(c.convert('L')).astype(np.float32)/255
    return np.clip(.5+(g-g.mean())*1.6,0,1)
def nrm(d):return np.asarray(load(d,'nor_gl')).astype(np.float32)/255
def wood():
    # procedural planks: grooves every 1/4 tile, grain along x, per-plank offset; tileable
    y,x=np.mgrid[0:T,0:T].astype(np.float32)/T;rng=np.random.default_rng(3)
    plank=np.floor(y*4);off=rng.random(8)[plank.astype(int)%8]
    grain=np.sin((y*4+off)*np.pi*2*5+np.sin(x*np.pi*2*2+off*9)*.9)*.5+.5
    fine=np.sin(y*np.pi*2*64+np.sin(x*np.pi*2*3+off*4)*1.2)*.5+.5
    h=.55+.06*grain+.012*fine-0.45*np.exp(-((y*4-plank)/0.035)**2)-0.45*np.exp(-((y*4-plank-1)/0.035)**2)
    # end joints
    j=((x*2+off*3)%1);h-=.35*np.exp(-(np.minimum(j,1-j)/.01)**2)
    gy,gx=np.gradient(h);n=np.stack([-gx*T*.04,-gy*T*.04,np.ones_like(h)],-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
    N=n*.5+.5;R=np.clip(.62+.25*(1-grain)-.1*fine,0,1);A=np.clip(.5+(h-h.mean())*1.2,0,1);return N,R,A
SURF=[('plaster','grey_plaster_02_2k'),('roof','clay_roof_tiles_03_2k'),('stone','concrete_wall_003_2k'),('metal','metal_plate_02_2k'),('rust','rusty_metal_04_2k'),('wood',None)]
A=np.zeros((T*2,T*3,3),np.float32);R=np.zeros((T*2,T*3),np.float32)
for i,(k,d) in enumerate(SURF):
    ox,oy=(i%3)*T,(i//3)*T
    if d is None:N,Ro,Al=wood()
    else:N,Ro,Al=nrm(d),rough(d),albedo_detail(d)
    A[oy:oy+T,ox:ox+T,0]=N[...,0];A[oy:oy+T,ox:ox+T,1]=N[...,1];A[oy:oy+T,ox:ox+T,2]=Al;R[oy:oy+T,ox:ox+T]=Ro
Image.fromarray((A*255).astype(np.uint8)).save(OUT+'/surface_nd.jpg',quality=90)
Image.fromarray((R*255).astype(np.uint8)).save(OUT+'/surface_r.jpg',quality=88)
GROUND=[('sand','damp_sand_2k'),('rock','rocks_ground_02_2k'),('forest','forest_floor_2k'),('snow','snow_01_2k'),('mud','mud_forest_2k'),('cliff','mountainside_2k'),('stone','rock_face_02_2k')]
G=np.zeros((T*2,T*4,3),np.float32)
for i,(k,d) in enumerate(GROUND):
    ox,oy=(i%4)*T,(i//4)*T;N=nrm(d);G[oy:oy+T,ox:ox+T,0]=N[...,0];G[oy:oy+T,ox:ox+T,1]=N[...,1];G[oy:oy+T,ox:ox+T,2]=rough(d)
Image.fromarray((G*255).astype(np.uint8)).save(OUT+'/ground_nr.jpg',quality=90)
print([k for k,_ in SURF],[k for k,_ in GROUND])
