// One fruit moves between the viewing plates. Only the decorative pose crosses documents.
(() => {
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const scenes = [...document.querySelectorAll('.specimen')];
  const object = document.createElement('div'), canvas = document.createElement('canvas');
  object.className = 'orchard-object';
  object.setAttribute('aria-hidden','true');
  object.append(canvas);
  const imageURL = new URL('./orchard-apple.webp',document.currentScript.src).href;
  const key = 'orchard-fruit-flight-v2';
  const visible = new Set();
  let scene = null, draw = null, started = false, size = 0, frame = 0, flight = null, hold = 0;
  let x = 0, y = 0, aimX = 0, aimY = 0, lastTime = 0;
  let pending = null, expectedPath = null;
  const glass = document.createElement('div');
  glass.className='specimen traveling-glass';
  glass.setAttribute('aria-hidden','true');
  glass.append(scenes[0].querySelector('.specimen-space').cloneNode(true));
  let glassFlight=null;

  function placeGlass(rect) {
    Object.assign(glass.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
    glass.style.setProperty('--tilt-x',(-y*6)+'deg');
    glass.style.setProperty('--tilt-y',(x*8)+'deg');
    document.body.append(glass);
  }
  function clearGlass() {
    glassFlight?.cancel(); glassFlight=null;
    glass.remove(); scene?.classList.remove('receiving-glass');
  }
  function travelGlass(from) {
    const to=scene.getBoundingClientRect();
    if (!onscreen(from) || !onscreen(to)) return;
    scene.classList.add('receiving-glass');
    placeGlass(to);
    const transform='translate('+(from.left-to.left)+'px,'+(from.top-to.top)+'px) scale('+
      from.width/to.width+','+from.height/to.height+')';
    const animation=glass.animate([{transform},{transform:'none'}],
      {duration:420,easing:'cubic-bezier(.24,.78,.28,1)',fill:'both'});
    glassFlight=animation;
    animation.finished.then(()=>{ if(glassFlight===animation) clearGlass(); }).catch(()=>{});
  }

  function objectRect() {
    const r = object.getBoundingClientRect();
    return {left:r.left,top:r.top,width:r.width,height:r.height};
  }
  function onscreen(r) {
    return r && r.width > 0 && r.height > 0 && r.top < innerHeight && r.top+r.height > 0 &&
      r.left < innerWidth && r.left+r.width > 0;
  }
  function square(slot) {
    const r = slot.getBoundingClientRect(), side = Math.min(r.width,r.height);
    return {left:r.left+(r.width-side)/2,top:r.top+(r.height-side)/2,width:side,height:side};
  }
  function render() {
    if (!draw || !size || !motion.matches) return;
    const pixels = Math.max(2,Math.min(820, Math.round(size*Math.min(devicePixelRatio||1,2))));
    object.classList.toggle('has-volume',draw(.045+x*.43,-.025+y*.19,pixels));
  }
  function pose() {
    if (!scene) return;
    scene.style.setProperty('--tilt-x',(-y*6).toFixed(2)+'deg');
    scene.style.setProperty('--tilt-y',(x*8).toFixed(2)+'deg');
    scene.style.setProperty('--drift-x',(x*9).toFixed(2)+'px');
    scene.style.setProperty('--drift-y',(y*5).toFixed(2)+'px');
    render();
  }
  function step(time) {
    frame = 0;
    if (document.hidden || (!visible.has(scene) && !flight)) return;
    const ease = 1-Math.exp(-Math.min(48,time-(lastTime||time-16))/80);
    lastTime = time;
    x += (aimX-x)*ease; y += (aimY-y)*ease;
    const moving = Math.abs(aimX-x)+Math.abs(aimY-y)>.002;
    if (!moving) { x=aimX; y=aimY; }
    pose();
    if (moving) frame=requestAnimationFrame(step);
  }
  function aim(dx,dy) {
    aimX=Math.max(-1,Math.min(1,dx)); aimY=Math.max(-1,Math.min(1,dy));
    if (!frame) {lastTime=0;frame=requestAnimationFrame(step);}
  }
  async function startRenderer() {
    if (started || !motion.matches) return;
    started=true;
    try {
      const {createAppleRenderer} = await import('./apple-volume.js?v=depth-1');
      draw=await createAppleRenderer(canvas,imageURL);
      if (draw && motion.matches) render();
    } catch { /* The independent WebP poster also works without a GPU. */ }
  }
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault(); draw=null; object.classList.remove('has-volume');
  });
  canvas.addEventListener('webglcontextrestored',()=>{ started=false; startRenderer(); });

  function dock() {
    if (!scene) { object.remove(); return; }
    const slot=scene.querySelector('.fruit');
    const side=Math.min(slot.offsetWidth,slot.offsetHeight);
    object.classList.remove('in-flight');
    object.style.removeProperty('left'); object.style.removeProperty('top');
    object.style.width=object.style.height=side+'px';
    size=side;
    if (object.parentElement!==slot) slot.append(object);
    object.style.removeProperty('--poster');
    pose();
  }
  function floatAt(rect) {
    object.classList.add('in-flight');
    Object.assign(object.style,{left:rect.left+'px',top:rect.top+'px',
      width:rect.width+'px',height:rect.height+'px'});
    size=rect.width;
    document.body.append(object);
  }
  function cancelFlight() {
    if (flight) { const old=flight; flight=null; old.cancel(); }
    clearTimeout(hold); clearGlass();
  }
  function show(next,from=null,oldGlass=null) {
    if (!next) {
      cancelFlight(); scene=null; pending=null; object.remove(); return;
    }
    const same=scene===next;
    const changed=scene && !same;
    if (same && !pending && !from) return;
    const record=pending;
    const source=record?.rect ?? from;
    pending=null;
    cancelFlight();
    if (changed) {
      for (const prop of ['--tilt-x','--tilt-y','--drift-x','--drift-y']) scene.style.removeProperty(prop);
    }
    scene=next;
    document.documentElement.classList.add('orchard-object-active');
    const dest=square(scene.querySelector('.fruit'));
    if (record) { x=record.x; y=record.y; }
    if (motion.matches && onscreen(source) && onscreen(dest) && object.animate) {
      floatAt(dest);
      travelGlass(record?.glass ?? oldGlass);
      const dx=source.left+source.width/2-dest.left-dest.width/2;
      const dy=source.top+source.height/2-dest.top-dest.height/2;
      const ratio=source.width/dest.width;
      const animation=object.animate([
        {transform:'translate('+dx+'px,'+dy+'px) scale('+ratio+')'},
        {transform:'none'}
      ],{duration:540,easing:'cubic-bezier(.23,.76,.23,1)',fill:'both'});
      flight=animation;
      animation.finished.then(()=>{
        if (flight!==animation) return;
        flight=null; animation.cancel(); dock();
      }).catch(()=>{});
      const panel=scene.closest('.release, .gate, .field-mast');
      const copy=panel?.querySelector('.mast-copy, .covertext, :scope > div:first-child:not(.cover)');
      const detail=panel?.matches('.field-mast') ? document.querySelector('#stats') :
        panel?.matches('.release') ? document.querySelector('.chart-panel') : document.querySelector('#loginForm');
      detail?.animate([{opacity:.72,transform:'translateY(7px)'},{opacity:1,transform:'none'}],
        {duration:370,easing:'ease-out'});
      copy?.animate([{opacity:.58,transform:'translateY(5px)'},{opacity:1,transform:'none'}],
        {duration:320,easing:'ease-out'});
    } else {
      if (!record && !changed && motion.matches && !same) { x=-.48; y=.16; }
      dock();
    }
    if (motion.matches) startRenderer();
    aim(0,0);
  }
  function capture() {
    if (!motion.matches || !scene || !object.isConnected || !onscreen(objectRect())) return null;
    const glassRect=(glass.isConnected?glass:scene).getBoundingClientRect().toJSON();
    const result={rect:objectRect(),glass:glassRect,x,y};
    // Save only the fruit, so a slow authenticated response never blanks out the moving object.
    if (draw && object.classList.contains('has-volume')) {
      const thumb=document.createElement('canvas');
      thumb.width=thumb.height=180;
      try {
        render();
        thumb.getContext('2d').drawImage(canvas,0,0,180,180);
        result.poster=thumb.toDataURL('image/webp',.82);
      } catch { /* The standard poster is already preloaded. */ }
    }
    return result;
  }
  function writeHandoff(to) {
    const snapshot=capture();
    try {
      if (snapshot) sessionStorage.setItem(key,JSON.stringify({...snapshot,to,clicked:!!expectedPath,at:Date.now()}));
      else sessionStorage.removeItem(key);
    } catch { /* Private browsing may disable storage. */ }
  }
  function readHandoff(restoring=false) {
    try {
      const item=JSON.parse(sessionStorage.getItem(key));
      if (!item) return;
      sessionStorage.removeItem(key);
      const traversal=restoring || performance.getEntriesByType('navigation')[0]?.type==='back_forward';
      if (!motion.matches || Date.now()-item.at>15000 || item.to!==location.pathname ||
          (!item.clicked && !traversal) || !onscreen(item.rect)) return;
      cancelFlight();
      pending=item; x=item.x; y=item.y;
      if (item.poster && /^data:image\/(webp|png);base64,/.test(item.poster)) {
        object.style.setProperty('--poster','url("'+item.poster+'")');
      }
      document.documentElement.classList.add('orchard-object-active');
      if (onscreen(item.glass)) placeGlass(item.glass);
      floatAt(item.rect);
      hold=setTimeout(()=>{ if(pending)show(null); },10000);
    } catch { /* Direct navigation does not require a handoff. */ }
  }
  const onScreen=() => scenes.find(s=>s.offsetWidth && s.offsetHeight);
  function resume() {
    const next=onScreen();
    if (next) show(next);
  }
  const observer=new IntersectionObserver(entries=>{
    for (const entry of entries) {
      if (entry.isIntersecting) {
        visible.add(entry.target);
        if (scene===entry.target) aim(aimX,aimY);
      } else visible.delete(entry.target);
    }
  });
  const resize=new ResizeObserver(()=>{
    if (scene && scene.offsetWidth && !flight && !pending) dock();
  });
  for (const item of scenes) {
    observer.observe(item); resize.observe(item.querySelector('.fruit'));
    const plate=item.parentElement;
    plate.addEventListener('pointermove',event=>{
      if (!motion.matches || scene!==item || !visible.has(item)) return;
      const box=plate.getBoundingClientRect();
      aim(2*(event.clientX-box.left)/box.width-1,2*(event.clientY-box.top)/box.height-1);
    },{passive:true});
    plate.addEventListener('pointerleave',()=>{ if (scene===item) aim(0,0); });
  }
  window.addEventListener('scroll',()=>{
    if (flight && scene) {cancelFlight();dock();}
    if (!motion.matches || fine.matches || !visible.has(scene)) return;
    const box=scene.getBoundingClientRect();
    const shift=(innerHeight*.42-box.top-box.height/2)/innerHeight;
    aim(shift*1.5,shift);
  },{passive:true});
  window.addEventListener('resize',()=>{ if(flight) {cancelFlight();dock();} });
  document.addEventListener('orchard-screen',event=>show(event.detail.scene,event.detail.from,event.detail.glass));
  document.addEventListener('orchard-report-ready',resume);
  document.addEventListener('orchard-report-unavailable',()=>show(null));
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a.model-progress-entry, a.progress-link');
    if (!link || event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey) return;
    expectedPath=link.pathname;
  });
  window.addEventListener('pagehide',()=>{
    if (location.pathname!=='/' && location.pathname!=='/model-progress') return;
    const to=expectedPath || (location.pathname==='/'?'/model-progress':'/');
    writeHandoff(to);
    expectedPath=null;
  });
  window.addEventListener('pageshow',event=>{
    if (event.persisted) readHandoff(true);
    resume();
  });
  motion.addEventListener('change',()=>{
    cancelFlight(); pending=null; x=y=aimX=aimY=0; dock();
    if (motion.matches) startRenderer(); else object.classList.remove('has-volume');
  });
  readHandoff(); resume();
})();
