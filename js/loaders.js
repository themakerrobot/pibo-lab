// ═══════════════════════════════════════════════════════════
// // STL / URDF 파서
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// STL PARSER
// ═══════════════════════════════════════════════════════════
function parseSTL(buf){
  const dv=new DataView(buf);
  if(buf.byteLength<84)return parseASCII(new TextDecoder().decode(buf));
  const n=dv.getUint32(80,true);
  if(Math.abs(buf.byteLength-(84+n*50))<=4)return parseBin(dv,n);
  return parseASCII(new TextDecoder().decode(buf));
}
function parseBin(dv,n){
  const pos=new Float32Array(n*9),nrm=new Float32Array(n*9);let o=84;
  for(let i=0;i<n;i++){
    const nx=dv.getFloat32(o,true),ny=dv.getFloat32(o+4,true),nz=dv.getFloat32(o+8,true);o+=12;
    for(let j=0;j<3;j++){const b=i*9+j*3;pos[b]=dv.getFloat32(o,true);pos[b+1]=dv.getFloat32(o+4,true);pos[b+2]=dv.getFloat32(o+8,true);nrm[b]=nx;nrm[b+1]=ny;nrm[b+2]=nz;o+=12;}
    o+=2;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nrm,3));return g;
}
function parseASCII(txt){
  const pos=[],nrm=[];let nx=0,ny=0,nz=0;
  for(const ln of txt.split('\n')){const l=ln.trim();
    if(l.startsWith('facet normal')){const m=l.match(/normal\s+([\S]+)\s+([\S]+)\s+([\S]+)/);if(m){nx=+m[1];ny=+m[2];nz=+m[3];}}
    else if(l.startsWith('vertex')){const m=l.match(/vertex\s+([\S]+)\s+([\S]+)\s+([\S]+)/);if(m){pos.push(+m[1],+m[2],+m[3]);nrm.push(nx,ny,nz);}}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));return g;
}

// ═══════════════════════════════════════════════════════════
// URDF PARSER
// ═══════════════════════════════════════════════════════════
function parseURDF(xml){
  const doc=new DOMParser().parseFromString(xml,'text/xml');
  const links={},joints={};
  const mats={};
  doc.querySelectorAll('robot > material').forEach(m=>{
    const c=m.querySelector('color');
    if(c&&m.getAttribute('name'))mats[m.getAttribute('name')]=(c.getAttribute('rgba')||'').split(/\s+/).map(Number);
  });
  function visualColor(v){
    const m=v.querySelector('material');if(!m)return null;
    const c=m.querySelector('color');
    if(c)return (c.getAttribute('rgba')||'').split(/\s+/).map(Number);
    const ref=m.getAttribute('name');
    return (ref&&mats[ref])?mats[ref]:null;
  }
  doc.querySelectorAll('link').forEach(el=>{
    const name=el.getAttribute('name');links[name]={name,visuals:[]};
    el.querySelectorAll('visual').forEach(v=>{
      const me=v.querySelector('geometry mesh');if(!me)return;
      const fn=me.getAttribute('filename')||'';
      const sc=(me.getAttribute('scale')||'1 1 1').split(/\s+/).map(Number);
      links[name].visuals.push({fn,sc,origin:parseOrig(v.querySelector('origin')),rgba:visualColor(v)});
    });
  });
  doc.querySelectorAll('joint').forEach(el=>{
    const name=el.getAttribute('name'),type=el.getAttribute('type')||'fixed';
    const parent=el.querySelector('parent')?.getAttribute('link')||'';
    const child=el.querySelector('child')?.getAttribute('link')||'';
    const axEl=el.querySelector('axis');
    const axis=(axEl?.getAttribute('xyz')||'0 0 1').split(/\s+/).map(Number);
    const lim=el.querySelector('limit');
    const defLo=type==='prismatic'?0:-3.14, defHi=type==='prismatic'?0.05:3.14;
    joints[name]={name,type,parent,child,origin:parseOrig(el.querySelector('origin')),axis,
      limit:{lower:lim?+lim.getAttribute('lower'):defLo,upper:lim?+lim.getAttribute('upper'):defHi}};
  });
  return{links,joints};
}
function parseOrig(el){
  if(!el)return{xyz:[0,0,0],rpy:[0,0,0]};
  return{xyz:(el.getAttribute('xyz')||'0 0 0').split(/\s+/).map(Number),rpy:(el.getAttribute('rpy')||'0 0 0').split(/\s+/).map(Number)};
}
const basename=s=>s.split(/[/\\]/).pop().toLowerCase();
const sid=n=>n.replace(/\W/g,'_');
