const {Cam,fit,proj,unproj,facing,rings,circ,run,ringAt,prism,solid,put,mk,open,poly,spring,stepS,pointer,register,disposer}=HL;
function mount({stage,svg,read}) {
 const treatment=simulationInteractions(svg),bag=disposer(),C=Cam(45,.5,1.38);
 fit(C,[[-90,-70,0],[95,110,65]],200,148);
 const P=proj(C),front=facing(C),root=mk('g',{},svg);
 const wire=mk('path',{class:'nf lo'},root),flow=mk('path',{class:'nf hi'},root);
 const objects=[],part=(x,y)=>{const g=mk('g',{},root);const p={g,x,y};objects.push(p);return p;};
 function block(s,x0,y0,x1,y1,r,z0,z1){const[a,b]=rings(x0,y0,x1,y1,r,1);put(s,prism(P,front,a,b,z0,z1));}
 const battery=part(-65,-10);block(solid(battery.g),-77,-29,-53,9,4,0,25);block(solid(battery.g),-71,-18,-59,-2,2,25,29);
 const socket=part(-30,-55);block(solid(socket.g),-55,-67,-5,-43,4,0,3);
 treatment.top(socket.g,[P(-53,-65,3),P(-7,-65,3),P(-7,-45,3),P(-53,-45,3)],'drop');
 const lamp=part(65,8);block(solid(lamp.g),53,-8,77,24,5,0,8);
 // The screw holder rises directly from the base. Anchor the glass neck inside
 // its rim, then paint that rim in front of the glass to seat the bulb in it.
 const holderRing=circ(7.5,48).map(q=>({...q,u:q.u+65,v:q.v+8}));
 const holderInner=circ(6.5,48).map(q=>({...q,u:q.u+65,v:q.v+8}));
 put(solid(lamp.g),prism(P,front,holderRing,holderInner,8,14));
 for(const z of [9.5,11.5,13.5])mk('path',{class:'nf lo',d:open(ringAt(P,run(holderRing,front),z))},lamp.g);
 const [bx,neckY]=P(65,8,16),by=neckY-31;
 const bulb=mk('path',{class:'sil','data-lamp-part':'glass'},lamp.g),filament=mk('path',{class:'nf'},lamp.g);
 bulb.setAttribute('d',`M ${bx-5} ${neckY} L ${bx+5} ${neckY} L ${bx+5} ${neckY-7} C ${bx+8} ${neckY-14} ${bx+23} ${neckY-17} ${bx+23} ${neckY-31} C ${bx+23} ${neckY-44} ${bx+13} ${neckY-54} ${bx} ${neckY-54} C ${bx-13} ${neckY-54} ${bx-23} ${neckY-44} ${bx-23} ${neckY-31} C ${bx-23} ${neckY-17} ${bx-8} ${neckY-14} ${bx-5} ${neckY-7} Z`);
 mk('path',{class:'nf lo',d:`M ${bx-14} ${by-4} C ${bx-15} ${by-11} ${bx-9} ${by-17} ${bx-3} ${by-18}`},lamp.g);
 filament.setAttribute('d',open([[bx-3,neckY-5],[bx-6,by+4],[bx-3,by],[bx,by+4],[bx+3,by],[bx+6,by+4],[bx+3,neckY-5]]));
 const rim=solid(lamp.g);rim.g.setAttribute('data-lamp-part','socket-rim');
 put(rim,prism(P,front,holderRing,holderInner,14,18));
 const rays=mk('path',{class:'nf hi'},lamp.g);
 wire.setAttribute('d',open([P(-65,-29,2),P(-65,-55,2),P(-55,-55,2)])+open([P(-5,-55,2),P(65,-55,2),P(65,-8,2)])+open([P(65,24,2),P(65,47,2),P(-65,47,2),P(-65,9,2)]));
 const homes=[[-58,88],[0,88],[58,88]];
 const items=homes.map(([x,y])=>{const item=part(x,y);item.body=solid(item.g);item.top=mk('path',{class:'sim-grab'},item.g);item.label=treatment.label(item.g,'',P(x,y+18,0));item.pos=[spring(x),spring(y),spring(5)];item.g.setAttribute('class','sim-grabbable');return item;});
 let config={selected:null,options:[15,30,60],voltage:6,checked:false,solved:false},drag=null,last='';
 const light=spring(0),win=spring(0);
 function targets(){items.forEach((item,i)=>{if(drag?.i===i)return;const installed=config.selected===i;item.pos[0].t=installed?-30:homes[i][0];item.pos[1].t=installed?-55:homes[i][1];item.pos[2].t=installed?3:5;});}
 function update(next){config=next;stage.setAttribute('data-solved',String(config.solved));targets();const on=config.checked&&config.selected!==null&&Math.abs(config.voltage/config.options[config.selected]-.2)<.0001;light.t=on?1:0;win.t=config.solved?1:0;read.textContent=on?'lamp on':'choose resistor';last='';loop.wake();}
 const loop=register(stage,dt=>{
  const moving=[light,win,...items.flatMap(i=>i.pos)].map(s=>stepS(s,dt)).some(Boolean);
  const key=[light.x,win.x,...items.flatMap(i=>i.pos.map(s=>s.x)),drag?.i].join(',');if(key===last)return moving;last=key;
  items.forEach((item,i)=>{const[x,y,height]=item.pos.map(s=>s.x),z=Math.max(3,height);item.x=x;item.y=y;
   block(item.body,x-20,y-8,x+20,y+8,3,z,z+10);item.body.sil.classList.add('sim-grab-edge');
   item.top.setAttribute('d',poly([P(x-17,y-6,z+10),P(x+17,y-6,z+10),P(x+17,y+6,z+10),P(x-17,y+6,z+10)]));
   item.label.textContent=`${config.options[i]} Ω`;const p=P(x,y+18,z);item.label.setAttribute('x',p[0]);item.label.setAttribute('y',p[1]+6);
  });
  // The socket is a support surface, so it must precede the elevated components
  // throughout their springs' overshoot, rather than compete at the same depth.
  root.append(socket.g);
  objects.filter(o=>o!==socket).sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(o=>root.append(o.g));
  filament.classList.toggle('hi',light.x>.1);
  rays.setAttribute('d',light.x>.01?Array.from({length:10},(_,i)=>{const a=i/10*Math.PI*2;return open([[bx+Math.cos(a)*27,by+Math.sin(a)*27],[bx+Math.cos(a)*(27+light.x*8+win.x*10),by+Math.sin(a)*(27+light.x*8+win.x*10)]]);}).join(''):'');
  flow.setAttribute('d',config.checked&&config.selected!==null?wire.getAttribute('d'):'');return moving;
 });
 function release(){if(!drag)return;const i=drag.i,item=items[i];const dropped=Math.hypot(item.pos[0].t+30,item.pos[1].t+55)<27;
  const selected=dropped?i:config.selected===i?null:config.selected;drag=null;stage.removeAttribute('data-dragging');config={...config,selected};targets();loop.wake();
  parent.postMessage({type:'feynman-circuit-select',value:selected},location.origin);
 }
 bag.add(pointer(stage,{down:(p,e)=>{if(config.solved)return;
  const distances=items.map(item=>{const q=P(item.pos[0].t,item.pos[1].t,item.pos[2].t+10);return Math.hypot(q[0]-p[0],q[1]-p[1]);});
  const i=distances.indexOf(Math.min(...distances));if(distances[i]>30)return;
  const [x,y]=unproj(C,p[0],p[1],22);drag={i,dx:items[i].pos[0].t-x,dy:items[i].pos[1].t-y};items[i].pos[2].t=22;
  stage.setPointerCapture(e.pointerId);stage.setAttribute('data-dragging','true');loop.wake();
 },move:p=>{if(!drag)return;const[x,y]=unproj(C,p[0],p[1],22),item=items[drag.i];item.pos[0].t=Math.max(-95,Math.min(95,x+drag.dx));item.pos[1].t=Math.max(-65,Math.min(112,y+drag.dy));loop.wake();},leave:()=>{}}));
 bag.on(stage,'lostpointercapture',release);
 bag.on(window,'message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='feynman-circuit-state')update(e.data.config);});
 bag.add(loop.unregister);bag.add(()=>svg.replaceChildren());update(config);return{set:()=>{},destroy:bag.dispose};
}
hairline({name:'circuit',means:'Choose a resistor and snap it into the circuit to supply the required lamp current.',rules:[1,3,6,7,8,9],range:[1,2,3],tour:[[140,230],[200,140],null],mount});
