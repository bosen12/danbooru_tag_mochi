// 偏好卡牌托盤的補位（hand.js 的 FLIP）：牌多到要左右捲時，出一張、回來一張，
// 留下來的牌不能先跳一下再滑（以前整排中心挪半張：電腦 71px、手機 43px），
// 只有真的換了位置的牌在動、離空格近的先動；捲到最右邊出牌，右邊不動、左邊靠過來。
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=(()=>{
  for(const p of [process.env.PLAYWRIGHT_MODULE,'playwright',resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){try{return require(p);}catch{}}
  throw new Error('Install Playwright or set PLAYWRIGHT_MODULE');
})();
const root=resolve(import.meta.dirname,'..');
const front=existsSync(resolve(root,'web6/hand.js'))?'web6':'web';
const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/fixture'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/${front}/tokens.css"><link rel="stylesheet" href="/${front}/card.css"><link rel="stylesheet" href="/${front}/styles.css"><main style="height:1200px">字盒</main>`);
    return;
  }
  let file=resolve(root,'.'+decodeURIComponent(u.pathname));
  if(!existsSync(file)&&u.pathname.startsWith('/web6/'))file=resolve(root,'web',u.pathname.slice(6));
  if(!file.startsWith(root)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
let failed=0;
async function check(name,fn){
  try{await fn();console.log('ok',name);}catch(e){failed++;console.log('FAIL',name);console.log(e?.stack||e);}
}

async function open({width=1280,height=860,reduced=false,isMobile=false}={}){
  const page=await browser.newPage({viewport:{width,height},isMobile,hasTouch:isMobile,reducedMotion:reduced?'reduce':'no-preference'});
  await page.route('https://**/*',r=>r.abort());
  await page.goto(origin+'/fixture');
  await page.evaluate(async(front)=>{
    const T=Array.from({length:26},(_,i)=>'t'+i);
    window.T=T;window.pooled=new Set();
    let list=[...T];
    const store={list:()=>[...list],set(v){list=[...v];},onChange(){},has:(t)=>list.includes(t)};
    const {createHand}=await import(`/${front}/hand.js`);
    window.hand=createHand({key:'reflow.hand',store,startOpen:true,makeNode:(t)=>{const n=document.createElement('div');n.className='card';n.dataset.tag=t;n.textContent=t;n.style.height='120px';return n;},inPool:(t)=>pooled.has(t),onPlay(){}});
    window.hand.setOpen(true);
    const body=document.querySelector('.fav-body');
    // 量：每張牌在畫面上的中心 x（跟捲動、動畫都算進去）。
    window.rects=()=>Object.fromEntries([...document.querySelectorAll('.fav-slot')].map((s)=>{const r=s.querySelector('.fav-card').getBoundingClientRect();return[s.dataset.tag,r.left+r.width/2];}));
    window.slotAnims=()=>document.getAnimations().filter((a)=>a.effect?.target?.classList?.contains('fav-slot'));
    window.frame=()=>new Promise((r)=>requestAnimationFrame(()=>r()));
    window.settle=async()=>{for(let i=0;i<40&&slotAnims().some((a)=>a.playState==='running');i++)await frame();for(const a of slotAnims())a.finish();await frame();};
    // 出牌（或回來）：跟房間一樣改卡池、叫 update；點下去那個 task 之後先跑一格 requestAnimationFrame 才畫。
    window.act=async(fn)=>{fn();hand.update();await frame();const an=slotAnims();for(const a of an)a.pause();return an;};
    window.at=(an,t)=>{for(const a of an)a.currentTime=t;return rects();};
    window.scrollEnd=async()=>{body.scrollLeft=body.scrollWidth;await frame();await frame();};
    window.visible=()=>{const br=body.getBoundingClientRect();return[...document.querySelectorAll('.fav-slot')].filter((s)=>{const r=s.querySelector('.fav-card').getBoundingClientRect();return r.left>=br.left&&r.right<=br.right;}).map((s)=>s.dataset.tag);};
    window.step=()=>{const c=[...document.querySelectorAll('.fav-slot')].slice(0,2).map((s)=>s.querySelector('.fav-card').getBoundingClientRect().left);return c[1]-c[0];};
  },front);
  await page.waitForTimeout(400);
  await page.evaluate(()=>settle());
  return page;
}

const near=(a,b,tol=1)=>Math.abs(a-b)<=tol;
function sameAll(before,after,skip=[]){
  for(const [t,x] of Object.entries(before)){if(skip.includes(t)||after[t]==null)continue;assert.ok(near(x,after[t]),`${t} jumped ${(after[t]-x).toFixed(1)}px at the first frame`);}
}

try{
  await check('playing a card from a scrolling tray: nobody jumps, left side stays, right side closes one step',async()=>{
    const page=await open();
    const r=await page.evaluate(async()=>{
      const vis=visible();const tag=vis[3];const step0=step();
      const before=rects();const an=await act(()=>pooled.add(tag));
      const f0=at(an,0);for(const a of an)a.finish();await frame();
      return{tag,vis,before,f0,end:rects(),step:step0,scroll:document.querySelector('.fav-hand').dataset.scroll,animated:an.length};
    });
    assert.equal(r.scroll,'true','fixture must be the scrolling tray');
    assert.ok(r.animated>0,'right side must slide in');
    sameAll(r.before,r.f0,[r.tag]);
    const i=r.vis.indexOf(r.tag);
    for(const t of r.vis.slice(0,i))assert.ok(near(r.before[t],r.end[t]),`${t} on the left must not move`);
    for(const t of r.vis.slice(i+1))assert.ok(near(r.end[t],r.before[t]-r.step,1.5),`${t} on the right must close one step`);
    await page.close();
  });

  await check('closing the gap: the nearest card moves first, farther ones a little later',async()=>{
    const page=await open();
    const r=await page.evaluate(async()=>{
      const vis=visible();const tag=vis[2];const before=rects();const an=await act(()=>pooled.add(tag));
      const mid=at(an,110);return{vis,tag,before,mid};
    });
    const i=r.vis.indexOf(r.tag);
    const moved=(t)=>Math.abs(r.mid[t]-r.before[t]);
    assert.ok(moved(r.vis[i+1])>moved(r.vis[i+2])+1,`nearest ${moved(r.vis[i+1]).toFixed(1)} must lead next ${moved(r.vis[i+2]).toFixed(1)}`);
    assert.ok(moved(r.vis[i+2])>moved(r.vis[i+4])+1,'and the next one leads the farther ones');
    await page.close();
  });

  await check('scrolled to the end: the scroll clamps without a jump; right side stays, left side moves in',async()=>{
    const page=await open();
    const r=await page.evaluate(async()=>{
      await scrollEnd();const vis=visible();const tag=vis[vis.length-3];const step0=step();
      const s0=document.querySelector('.fav-body').scrollLeft;
      const before=rects();const an=await act(()=>pooled.add(tag));
      const f0=at(an,0);const s1=document.querySelector('.fav-body').scrollLeft;
      for(const a of an)a.finish();await frame();
      return{vis,tag,before,f0,end:rects(),step:step0,s0,s1};
    });
    assert.ok(r.s1<r.s0-10,'fixture must actually clamp the scroll');
    sameAll(r.before,r.f0,[r.tag]);
    const i=r.vis.indexOf(r.tag);
    for(const t of r.vis.slice(i+1))assert.ok(near(r.before[t],r.end[t]),`${t} on the right must not move`);
    for(const t of r.vis.slice(0,i))assert.ok(near(r.end[t],r.before[t]+r.step,1.5),`${t} on the left must move in one step`);
    await page.close();
  });

  await check('a card coming back opens its slot without a jump; left side stays',async()=>{
    const page=await open();
    const r=await page.evaluate(async()=>{
      const vis=visible();const tag=vis[3];pooled.add(tag);hand.update();await settle();
      const before=rects();const an=await act(()=>pooled.delete(tag));
      const f0=at(an,0);for(const a of an)a.finish();await frame();
      return{vis,tag,before,f0,end:rects()};
    });
    sameAll(r.before,r.f0,[r.tag]);
    const i=r.vis.indexOf(r.tag);
    for(const t of r.vis.slice(0,i))assert.ok(near(r.before[t],r.end[t]),`${t} on the left must not move`);
    await page.close();
  });

  await check('phone: same, no half-card jump',async()=>{
    const page=await open({width:390,height:844,isMobile:true});
    const r=await page.evaluate(async()=>{
      const vis=visible();const tag=vis[1];const before=rects();const an=await act(()=>pooled.add(tag));
      return{tag,before,f0:at(an,0),scroll:document.querySelector('.fav-hand').dataset.scroll};
    });
    assert.equal(r.scroll,'true');
    sameAll(r.before,r.f0,[r.tag]);
    await page.close();
  });

  await check('reduced motion: no sliding animations',async()=>{
    const page=await open({reduced:true});
    const n=await page.evaluate(async()=>{const tag=visible()[3];const an=await act(()=>pooled.add(tag));return an.length;});
    assert.equal(n,0);
    await page.close();
  });
}finally{
  await browser.close();
  server.close();
}
if(failed){console.log(`${failed} failed`);process.exit(1);}
console.log('all ok');
