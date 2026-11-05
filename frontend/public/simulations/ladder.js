const {Cam,fit,proj,facing,rings,prism,solid,put,mk,open,poly,spring,stepS,pointer,register,disposer,clamp}=HL;
function mount({stage,svg,read}) {
 const treatment=simulationInteractions(svg),bag=disposer(),C=Cam(0,.55,1.8);
 fit(C,[[-60,-25,0],[100,35,90]],230,150);
 const P=proj(C),front=facing(C),root=mk('g',{},svg);
 const ground=mk('path',{class:'nf dash lo'},root),foot=solid(root),tower=solid(root),deck=solid(root),landing=mk('path',{class:'sim-drop'},root);
 const ladder=mk('g',{class:'sim-grabbable'},root),rungs=Array.from({length:8},()=>solid(ladder));
 const rails=[solid(ladder),solid(ladder)],grips=[mk('path',{class:'sim-grab'},ladder),mk('path',{class:'sim-grab'},ladder)];
 const gate=solid(root),arc=mk('path',{class:'nf lo'},root);
 const labels=[treatment.label(root,'',[0,0],true),treatment.label(root,'',[0,0],true),treatment.label(root,'',[0,0],true)];
 let config={angle:20,length:10,rise:6,run:8,checked:false,solved:false},drag=null,last='';const angle=spring(10),win=spring(0);
 function block(s,x0,y0,x1,y1,r,z0,z1,project=P){const[a,b]=rings(x0,y0,x1,y1,r,Math.min(1,(x1-x0)/5,(y1-y0)/5));put(s,prism(project,front,a,b,z0,z1));}
 function label(node,text,p){node.textContent=text;node.setAttribute('x',p[0]);node.setAttribute('y',p[1]);}
 function update(next){config=next;stage.setAttribute('data-solved',String(config.solved));angle.t=config.checked?config.angle:10;win.t=config.solved?1:0;read.textContent=config.solved?'ladder secured':'set ladder angle';last='';loop.wake();}
 const loop=register(stage,dt=>{
  const moving=[angle,win].map(s=>stepS(s,dt)).some(Boolean),key=[angle.x,win.x].join(',');if(key===last)return moving;last=key;
  const scale=8,L=config.length*scale,h=config.rise*scale,x=-50+config.run*scale,a=angle.x*Math.PI/180;
  // The tower is behind the ladder in world y. Its landing projects forward.
  block(foot,-55,0,-45,20,2,-3,0);
  block(tower,x+3,-24,x+24,-4,4,0,h+15);block(deck,x-7,-7,x+25,23,4,h-4,h);
  landing.setAttribute('d',poly([P(x-5,1,h),P(x+5,1,h),P(x+5,20,h),P(x-5,20,h)]));
  const B=(u,v,z)=>P(-50+u*Math.cos(a)-z*Math.sin(a),v,u*Math.sin(a)+z*Math.cos(a));
  rungs.forEach((r,i)=>{const u=(i+1)*L/9;block(r,u-1.5,4,u+1.5,16,1,0,3,B);});
  rails.forEach((rail,i)=>{const y=i?16:1;block(rail,0,y,L,y+3,1.4,0,5,B);rail.sil.classList.add('sim-grab-edge');grips[i].setAttribute('d',poly([B(1,y+.4,5),B(L-1,y+.4,5),B(L-1,y+2.6,5),B(1,y+2.6,5)]));});
  block(gate,x+4,1,x+8,21,1.5,h,h+3+win.x*12);
  ground.setAttribute('d',open([P(-50,10,0),P(x,10,0),P(x,10,h)]));
  arc.setAttribute('d',open(Array.from({length:20},(_,i)=>P(-50+18*Math.cos(a*i/19),10,18*Math.sin(a*i/19)))));
  label(labels[0],`${config.run} m`,P(-50+config.run*4,26,0));label(labels[1],`${config.rise} m`,P(x+30,-8,h/2));
  label(labels[2],`${config.length} m`,B(L/2,-4,8));return moving;
 });
 bag.add(pointer(stage,{down:(p,e)=>{if(config.solved)return;const a=angle.t*Math.PI/180;
  const start=P(-50,10,0),end=P(-50+config.length*8*Math.cos(a),10,config.length*8*Math.sin(a));
  const dx=end[0]-start[0],dy=end[1]-start[1],t=clamp(((p[0]-start[0])*dx+(p[1]-start[1])*dy)/(dx*dx+dy*dy),0,1);
  if(Math.hypot(p[0]-start[0]-t*dx,p[1]-start[1]-t*dy)>24)return;
  drag={y:p[1],angle:config.angle};stage.setPointerCapture(e.pointerId);stage.setAttribute('data-dragging','true');
 },move:p=>{if(drag)parent.postMessage({type:'feynman-ladder-angle',value:clamp(drag.angle+(drag.y-p[1])*.5,10,75)},location.origin);},leave:()=>{}}));
 bag.on(stage,'lostpointercapture',()=>{drag=null;stage.removeAttribute('data-dragging');});
 bag.on(window,'message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='feynman-ladder-state')update(e.data.config);});
 bag.add(loop.unregister);bag.add(()=>svg.replaceChildren());update(config);return{set:()=>{},destroy:bag.dispose};
}
hairline({name:'ladder',means:'Set the ladder angle to reach a balcony with a known height and horizontal distance.',rules:[1,3,6,7,8,9],range:[1,2,3],tour:[[180,170],[200,130],null],mount});
