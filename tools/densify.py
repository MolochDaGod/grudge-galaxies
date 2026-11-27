# Give every accessor without a bufferView (implicit zeros) a real zero-filled bufferView; three r128 cannot read implicit ones.
import json,struct,sys
N={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};C={5126:4,5123:2,5125:4,5121:1,5122:2,5120:1}
for f in sys.argv[1:]:
    b=open(f,'rb').read();jl=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+jl]);o=20+jl
    bl=struct.unpack('<I',b[o:o+4])[0];bin_=bytearray(b[o+8:o+8+bl]);n=0
    for a in j['accessors']:
        if 'bufferView' in a or 'sparse' in a:continue
        while len(bin_)%4:bin_.append(0)
        size=a['count']*N[a['type']]*C[a['componentType']]
        j['bufferViews'].append({'buffer':0,'byteOffset':len(bin_),'byteLength':size});a['bufferView']=len(j['bufferViews'])-1;bin_+=bytes(size);n+=1
    while len(bin_)%4:bin_.append(0)
    j['buffers'][0]['byteLength']=len(bin_)
    js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((4-len(js)%4)%4)
    out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin_))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bin_),0x004E4942)+bin_
    open(f,'wb').write(out);print(f,'densified',n)
