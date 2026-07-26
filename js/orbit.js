// ═══════════════════════════════════════════════════════════
// // 카메라 궤도 컨트롤
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// ORBIT CONTROLS
// ═══════════════════════════════════════════════════════════
class Orbit {
  constructor(cam, el) {
    this.cam=cam; this.el=el;
    this.target=new THREE.Vector3(0,.8,0);
    this.phi=1.2; this.theta=0.5; this.r=3.5;
    this._dn=false; this._btn=-1; this._lx=0; this._ly=0;
    el.addEventListener('mousedown',e=>{this._dn=true;this._btn=e.button;this._lx=e.clientX;this._ly=e.clientY;});
    window.addEventListener('mousemove',e=>{
      if(!this._dn)return;
      const dx=e.clientX-this._lx,dy=e.clientY-this._ly;
      this._lx=e.clientX;this._ly=e.clientY;
      if(this._btn===0){this.theta-=dx*.005;this.phi=Math.max(.04,Math.min(Math.PI-.04,this.phi-dy*.005));}
      else if(this._btn===2){const f=this.r*.0012;const rt=new THREE.Vector3().setFromMatrixColumn(cam.matrix,0);const up=new THREE.Vector3().setFromMatrixColumn(cam.matrix,1);this.target.addScaledVector(rt,-dx*f).addScaledVector(up,dy*f);}
      this.update();
    });
    window.addEventListener('mouseup',()=>this._dn=false);
    el.addEventListener('wheel',e=>{e.preventDefault();this.r=Math.max(.15,Math.min(60,this.r*(e.deltaY>0?1.1:.9)));this.update();},{passive:false});
    el.addEventListener('contextmenu',e=>e.preventDefault());
    this.update();
  }
  update(){const s=Math.sin(this.phi);this.cam.position.set(this.target.x+this.r*s*Math.sin(this.theta),this.target.y+this.r*Math.cos(this.phi),this.target.z+this.r*s*Math.cos(this.theta));this.cam.lookAt(this.target);}
  // 축소 버튼(x1.22) 을 4번 누른 만큼 물러난 거리를 기본값으로 쓴다
  focusBox(box){const c=box.getCenter(new THREE.Vector3());const sz=box.getSize(new THREE.Vector3()).length();this.target.copy(c);this.r=sz*1.3*Math.pow(1.22,4);this.update();}
}
