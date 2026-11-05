/* Hairline figure adapted for direct manipulation in Feynman's apply workshop.
 * The kernel and bench remain unchanged. Parent controls own task state.
 */
const { Cam, fit, proj, facing, rings, prism, solid, put, mk, poly, open, circ, ringAt,
  spring, stepS, tween, tset, tval, tdone, pointer, register, disposer, clamp } = HL;
function mount({ stage, svg, read }) {
  simulationInteractions(svg);
  const bag = disposer(), C = Cam(45, .5, 1.65);
  fit(C, [[-90,-25,0],[90,25,0],[-90,0,100],[90,0,100]], 200, 166);
  const P = proj(C), front = facing(C), root = mk('g', {}, svg);
  const base = solid(root), post = solid(root), beam = solid(root);
  const ticks = mk('path', {class:'nf lo'}, root);
  const weights = [solid(root), solid(root)], handles = [mk('path', {class:'nf lo'}, weights[0].g), mk('path', {class:'sim-grab'}, weights[1].g)];
  const jewelBase = solid(root), jewel = solid(root);
  const pulse = mk('path', {class:'nf hi'}, root);
  let config = { left: -3, right: 1, leftMass: 4, rightMass: 6, checked: false, solved: false };
  const tilt = spring(0), xs = [spring(-42), spring(14)], win = tween(0);
  let last = '', drag = null;

  function block(item, x0,y0,x1,y1,r,z0,z1, project = P) {
    const [outer,inner] = rings(x0,y0,x1,y1,r,Math.min(1,(x1-x0)/6,(y1-y0)/6));
    put(item, prism(project,front,outer,inner,z0,z1));
  }
  function draw(a, left, right, completion) {
    block(base,-27,-22,27,22,7,0,6);
    block(post,-6,-6,6,6,3,6,58);
    const B = (x,y,z) => P(x*Math.cos(a)-(z-60)*Math.sin(a),y,60+x*Math.sin(a)+(z-60)*Math.cos(a));
    block(beam,-90,-9,90,9,4,58,63,B);
    ticks.setAttribute('d',Array.from({length:13},(_,i)=>{const x=(i-6)*14;return open([B(x,-6,63),B(x,-2,63)])}).join(''));
    [left,right].forEach((x,i)=>{
      const h = 9 + (i ? config.rightMass : config.leftMass)*5;
      block(weights[i],x-9,-8,x+9,8,3,63,63+h,B);
      handles[i].setAttribute('d',poly([B(x-7,-6,63+h),B(x+7,-6,63+h),B(x+7,6,63+h),B(x-7,6,63+h)]));
    });
    block(jewelBase,45,30,73,53,5,0,5);
    block(jewel,51,36,67,47,3,5,10+completion*28);
    jewel.sil.classList.toggle('hi',config.solved);
    weights[1].sil.classList.add('sim-grab-edge'); weights[1].g.setAttribute('class', 'sim-grabbable');
    pulse.setAttribute('d',completion>0 && completion<1 ? open(ringAt(P,circ(10+completion*32,60).map(q=>({...q,u:q.u+59,v:q.v+41})),3)) : '');
  }
  const loop = register(stage,(dt,now)=>{
    const moving = [tilt,...xs].map(s=>stepS(s,dt)).some(Boolean);
    const completion = tval(win,now), key = [tilt.x,xs[0].x,xs[1].x,completion,config.leftMass,config.rightMass,drag?.i,config.solved].join(',');
    if(key!==last){draw(tilt.x,xs[0].x,xs[1].x,completion);last=key;}
    return moving || !tdone(win,now);
  });
  function update(next) {
    config=next;stage.setAttribute('data-solved',String(config.solved));
    xs[0].t=config.left*14; xs[1].t=config.right*14;
    tilt.t=config.checked?clamp((config.leftMass*Math.abs(config.left)-config.rightMass*config.right)*.023,-.26,.26):0;
    tset(win,config.solved?1:0,performance.now(),0);
    read.textContent=config.solved?'balanced':'move a weight';loop.wake();
  }
  bag.add(pointer(stage,{
    down:(p,e)=>{
      if(config.solved)return;
      // Pick the whole weight in its TARGET pose, including the beam's tilt.
      // A level-beam centre misses the body once the right side drops far enough.
      const a=tilt.t;
      const x=config.right*14,h=9+config.rightMass*5,corners=[];
      for(const u of [x-9,x+9])for(const v of [-8,8])for(const z of [63,63+h])
        corners.push(P(u*Math.cos(a)-(z-60)*Math.sin(a),v,60+u*Math.sin(a)+(z-60)*Math.cos(a)));
      const bounds=[Math.min(...corners.map(q=>q[0]))-6,Math.max(...corners.map(q=>q[0]))+6,Math.min(...corners.map(q=>q[1]))-6,Math.max(...corners.map(q=>q[1]))+6];
      if(p[0]<bounds[0]||p[0]>bounds[1]||p[1]<bounds[2]||p[1]>bounds[3])return;
      drag={i:1,start:p[0],x:config.right};
      stage.setPointerCapture(e.pointerId);stage.setAttribute('data-dragging','true');loop.wake();
    },
    move:p=>{
      if(!drag)return;
      const delta=(p[0]-drag.start)/(P(14,0,60)[0]-P(0,0,60)[0]);
      const value=clamp(drag.x+delta,drag.i?1:-6,drag.i?6:-1);
      window.parent.postMessage({type:'feynman-balance-move',side:drag.i?'right':'left',value},window.location.origin);
    },
    leave:()=>{if(!drag)read.textContent=config.solved?'balanced':'move a weight';},
  }));
  const release=()=>{drag=null;stage.removeAttribute('data-dragging');loop.wake();};
  bag.on(stage,'lostpointercapture',release);
  bag.on(window,'message',e=>{if(e.source===window.parent&&e.origin===window.location.origin&&e.data?.type==='feynman-balance-state')update(e.data.config);});
  bag.add(loop.unregister);bag.add(()=>svg.replaceChildren());
  update(config);
  return {set:()=>{},destroy:bag.dispose};
}
hairline({name:'balance',means:'Move the weights until both turning effects match.',rules:[1,3,4,5,6,7,8,9,10],range:[1,2,3],tour:[[150,130],[245,130],null],mount});
