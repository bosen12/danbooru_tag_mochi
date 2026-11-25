// 偏好角色的名單彈窗（fav-chars.js 的 openFavChars）：
// 一頁幾張照彈窗擺得下多少算、翻頁鈕一直在畫面上（以前固定四排，1440×900 第四排切一半、翻頁鈕在彈窗外面）；
// 子分類（性別、系列）跟字盒同一套、換頁籤留著；按錯再按回來放回原位（以前跑到第一位）；
// 搜尋照字盒的排序、搜到禁用角色說是禁用；搜不到再清掉，「找不到」那行要收起來；牌不各自當容器（開窗慢、進場卡）。
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
const front=existsSync(resolve(root,'web6/fav-chars.js'))?'web6':'web';
// 禁用角色的名單（卡冊那份 tag_dates.json 的 banned）
const dates={banned:[{tag:'rem (re:zero)',zh:'雷姆',groupZh:'動漫・從零開始',series:'re:zero'}]};
const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/fixture'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/${front}/tokens.css"><link rel="stylesheet" href="/${front}/card.css"><link rel="stylesheet" href="/${front}/styles.css"><body><main>墨池</main></body></html>`);
    return;
  }
  if(u.pathname==='/tag_dates.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(dates));return;}
  if(u.pathname.startsWith('/api/')){res.writeHead(404).end();return;}
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

// 三部作品：甲（動漫、女 30）、乙（動漫、男 20）、丙（遊戲、女 20）；前 60 位是偏好（新加的在前）。
// 搜尋排序用：「ann」完全相符的 ann (丙) 要排在名字裡含 ann 的 joanne 前面。
function roster(){
  const c=[];
  const add=(tag,zh,fam,series,gate)=>c.push({tag,zh,suit:'chara',group:'chara-'+series,groupZh:`${fam}・${series}`,gate,rating:'general',seal:null,eras:['any'],item:{tag,zh,series}});
  for(let i=0;i<30;i++)add(`kou ${i}`,`甲女${i}`,'動漫','甲','female');
  for(let i=0;i<20;i++)add(`otsu ${i}`,`乙男${i}`,'動漫','乙','male');
  add('joanne (hei)','喬安','遊戲','丙','female');
  for(let i=0;i<18;i++)add(`hei ${i}`,`丙女${i}`,'遊戲','丙','female');
  add('ann (hei)','安','遊戲','丙','female');
  return c;
}
const favs=[...roster().slice(0,50).map((c)=>c.tag),'joanne (hei)','ann (hei)',...roster().slice(51,59).map((c)=>c.tag)];

// Windows 的 WinNAT 偶爾一陣一陣擋本機連線（ERR_NETWORK_ACCESS_DENIED、載不到模組）：不是測試壞，開頁重試幾次。
async function open(opts={}){
  for(let i=0;;i++){
    try{return await openOnce(opts);}
    catch(e){if(i>=8||!/ERR_NETWORK_ACCESS_DENIED|Failed to fetch dynamically imported module/.test(String(e)))throw e;await new Promise((r)=>setTimeout(r,2500));}
  }
}
async function openOnce({width=1440,height=900,reduced=false,isMobile=false,tab}={}){
  const page=await browser.newPage({viewport:{width,height},isMobile,hasTouch:isMobile,reducedMotion:reduced?'reduce':'no-preference'});
  try{return await load(page,{reduced,tab});}catch(e){await page.close();throw e;}
}
async function load(page,{reduced,tab}){
  await page.route('https://**/*',r=>r.abort());
  await page.addInitScript((favs)=>{try{localStorage.setItem('mochi.fav.chars.v1',JSON.stringify(favs));localStorage.removeItem('mochi.cardcq.favc-grid');}catch{}},favs);
  await page.goto(origin+'/fixture');
  await page.evaluate(async({front,cards,tab})=>{
    const m=await import(`/${front}/fav-chars.js`);
    window.favChars=m.favChars;
    const assets={art:()=>null,sources:()=>null,mini:()=>null,count:()=>0};
    window.sheet=m.openFavChars({cards,assets,tab});
    window.frame=()=>new Promise((r)=>requestAnimationFrame(()=>r()));
    window.wait=(ms)=>new Promise((r)=>setTimeout(r,ms));
    window.cells=()=>[...document.querySelectorAll('.favc-cell')];
    window.tags=()=>cells().map((c)=>c.dataset.tag);
    window.layout=()=>{
      const s=document.querySelector('.favc-sheet');const pg=document.querySelector('.favc-pager');const g=document.querySelector('.favc-grid');
      const gr=g.getBoundingClientRect();const pr=pg.getBoundingClientRect();
      return{n:cells().length,page:document.querySelector('.favc-page').textContent,pagerShown:!pg.hidden,pagerBottom:pr.bottom,pagerTop:pr.top,vh:innerHeight,
        sheetScrolls:s.scrollHeight>s.clientHeight+1,below:cells().filter((c)=>c.getBoundingClientRect().bottom>gr.bottom+1).length};
    };
  },{front,cards:roster(),tab});
  await page.waitForTimeout(reduced?100:700);
  return page;
}
const settle=(page)=>page.waitForTimeout(700);

try{
  for(const view of [{name:'desktop 1440×900',width:1440,height:900},{name:'phone 390×844',width:390,height:844,isMobile:true}]){
    await check(`${view.name}: a page fits the dialog and the pager is always on screen`,async()=>{
      const page=await open(view);
      const r=await page.evaluate(()=>layout());
      assert.ok(r.pagerShown,'60 favorites need more than one page');
      assert.ok(r.pagerBottom<=r.vh,`pager bottom ${r.pagerBottom} must be inside the ${r.vh}px viewport`);
      assert.equal(r.sheetScrolls,false,'the dialog must not need scrolling to reach the pager');
      assert.equal(r.below,0,'no card may hang below the card area');
      assert.ok(r.n>=8,`at least two rows (got ${r.n})`);
      // 展開一串作品（籤列變高）：翻頁鈕不動，張數照新的高度重算，還是沒有牌掉出去。
      await page.click('.favc-chips .chip-fold');
      await page.waitForTimeout(900);
      const r2=await page.evaluate(()=>layout());
      assert.ok(Math.abs(r2.pagerTop-r.pagerTop)<1,`pager moved ${r2.pagerTop-r.pagerTop}px when a series group opened`);
      assert.equal(r2.below,0);assert.equal(r2.sheetScrolls,false);
      await page.close();
    });
  }

  await check('subcategories: gender and series chips like the library; a pick filters and survives a tab switch',async()=>{
    const page=await open();
    const chips=await page.evaluate(()=>document.querySelector('.favc-chips').innerText.replace(/\s+/g,' '));
    assert.match(chips,/性別/);assert.match(chips,/系列/);assert.match(chips,/動漫/);assert.match(chips,/遊戲/);
    await page.click('.favc-chips .chip-fold');
    await page.waitForTimeout(500);
    await page.click('.favc-chips .group-chip:text-is("乙")');
    await settle(page);
    let t=await page.evaluate(()=>tags());
    assert.ok(t.length>0&&t.every((x)=>x.startsWith('otsu ')),'only series 乙: '+t.join(','));
    await page.click('.favc-tab[data-tab="add"]');
    await settle(page);
    t=await page.evaluate(()=>tags());
    assert.ok(t.length===20&&t.every((x)=>x.startsWith('otsu ')),'the series filter carries over to Add characters');
    await page.click('.favc-chips [data-gender="female"]');
    await settle(page);
    t=await page.evaluate(()=>({tags:tags(),empty:document.querySelector('.favc-empty').textContent}));
    assert.ok(t.tags.length>0&&t.tags.every((x)=>!x.startsWith('otsu ')),'a series without women resets to All');
    // 鍵盤：在籤上按 Enter，焦點留在那一顆
    await page.focus('.favc-chips [data-gender="male"]');
    await page.keyboard.press('Enter');
    await settle(page);
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.gender),'male','focus stays on the chip that was pressed');
    await page.close();
  });

  await check('a mis-tap undone goes back to the same place in the list (not to the front)',async()=>{
    const page=await open();
    const r=await page.evaluate(async()=>{
      document.querySelector('.favc-next').click();await wait(700);
      const c=cells()[2];const tag=c.dataset.tag;const before=favChars.list();
      c.click();const faded=c.dataset.on;const stays=c.isConnected;
      c.click();
      return{tag,from:before.indexOf(tag),to:favChars.list().indexOf(tag),same:before.join()===favChars.list().join(),faded,stays};
    });
    assert.equal(r.faded,'false');assert.ok(r.stays,'the removed card stays in place (faded) until the page changes');
    assert.ok(r.from>0);
    assert.ok(r.same,`${r.tag} moved from #${r.from+1} to #${r.to+1}`);
    await page.close();
  });

  await check('search: exact name first, blocked characters are named, the empty line hides again',async()=>{
    const page=await open({tab:'add'});
    await page.fill('.favc-search','ann');
    await settle(page);
    const t=await page.evaluate(()=>tags());
    assert.equal(t[0],'ann (hei)','the exact name comes before joanne: '+t.join(','));
    await page.fill('.favc-search','雷姆');
    await page.waitForTimeout(1000);
    const miss=await page.evaluate(()=>document.querySelector('.favc-empty').textContent);
    assert.match(miss,/雷姆.*禁用角色/,miss);
    await page.fill('.favc-search','');
    await settle(page);
    const shown=await page.evaluate(()=>({display:getComputedStyle(document.querySelector('.favc-empty')).display,n:cells().length}));
    assert.equal(shown.display,'none','the "no match" line must hide once results are back');
    assert.ok(shown.n>0);
    // 我的偏好搜不到、加角色有：一顆直接過去
    await page.click('.favc-tab[data-tab="mine"]');
    await settle(page);
    await page.fill('.favc-search','hei 17');
    await settle(page);
    const btn=page.locator('.favc-empty button');
    assert.equal(await btn.count(),1,'offer to look in Add characters');
    await btn.click();
    await settle(page);
    assert.deepEqual(await page.evaluate(()=>[document.querySelector('.favc-tab[aria-selected="true"]').dataset.tab,tags()]),['add',['hei 17']]);
    await page.close();
  });

  await check('cards are sized once for the whole grid (not one size container per card)',async()=>{
    const page=await open();
    const r=await page.evaluate(()=>{const g=document.querySelector('.favc-grid');const c=g.querySelector('.card');return{sized:'sized' in g.dataset,ct:getComputedStyle(c).containerType};});
    assert.ok(r.sized,'the grid measures the card width (sizeCards)');
    assert.equal(r.ct,'normal');
    await page.close();
  });

  // 每一格畫完（rAF 之後）記彈窗的高度：一格就跳完＝沒有過渡。
  // 時間到就停、交出去的是複本：以前停了之後還有一格排好的量測，落在下一步（把內容刪掉）之後才量，
  // 量到縮回去的高度又塞進這一組的尾巴，頭尾一減變成「沒長高」（2026-11-25 查到，約四次掉一次）。
  const heights=`window.watchHeight=(sheet,ms)=>new Promise((done)=>{const h=[];let run=true;const read=()=>{if(run)h.push(Math.round(sheet.getBoundingClientRect().height));};
    const tick=()=>requestAnimationFrame(()=>setTimeout(()=>{read();if(run)tick();},0));read();tick();setTimeout(()=>{run=false;done(h.slice());},ms);});`;
  const smooth=(h,label)=>{
    const steps=[];for(let i=1;i<h.length;i++)if(h[i]!==h[i-1])steps.push(h[i]-h[i-1]);
    const total=h.at(-1)-h[0];
    assert.ok(Math.abs(total)>80,`${label}: the height must actually change (${h[0]} → ${h.at(-1)})`);
    assert.ok(steps.length>=4,`${label}: changed in ${steps.length} frame(s), expected a gradual transition: ${h.join(',')}`);
    assert.ok(Math.max(...steps.map(Math.abs))<Math.abs(total)*0.6,`${label}: most of the change happened in one frame: ${h.join(',')}`);
  };

  await check('switching to a short list shrinks the dialog over several frames, not in one jump',async()=>{
    const page=await open();
    const h=await page.evaluate(async(src)=>{
      (0,eval)(src);const s=document.querySelector('.favc-sheet');
      const p=watchHeight(s,1100);
      const q=document.querySelector('.favc-search');q.value='hei 1';q.dispatchEvent(new Event('input',{bubbles:true}));
      return p;
    },heights);
    smooth(h,'paged → one short page');
    assert.ok(h.at(-1)<h[0],'the dialog ends smaller');
    await page.close();
  });

  await check('any dialog (openSheet) eases to its new height when its content changes, without ResizeObserver errors',async()=>{
    const page=await open();
    const errors=[];page.on('pageerror',(e)=>errors.push(String(e)));
    const r=await page.evaluate(async({front,src})=>{
      (0,eval)(src);
      const seen=[];addEventListener('error',(e)=>seen.push(e.message));
      const {openSheet}=await import(`/${front}/ui.js`);
      const body=document.createElement('div');body.innerHTML='<p>一行</p>';
      const {sheet}=openSheet('測試',body);
      await new Promise((r)=>setTimeout(r,700));
      const grow=watchHeight(sheet,900);
      for(let i=0;i<8;i++){const p=document.createElement('p');p.textContent='多一行 '+i;p.style.height='30px';body.append(p);}
      const up=await grow;
      const shrink=watchHeight(sheet,900);
      body.replaceChildren(Object.assign(document.createElement('p'),{textContent:'剩一行'}));
      return{up,down:await shrink,seen};
    },{front,src:heights});
    smooth(r.up,'content added');
    smooth(r.down,'content removed');
    assert.deepEqual([...r.seen,...errors].filter((m)=>/ResizeObserver/.test(m)),[],'no ResizeObserver loop errors');
    await page.close();
  });

  await check('reduced motion: paging and filtering swap instantly with no animation',async()=>{
    const page=await open({reduced:true});
    const r=await page.evaluate(async()=>{
      const a=tags()[0];document.querySelector('.favc-next').click();
      const b=tags()[0];document.querySelector('.favc-chips [data-gender="male"]').click();
      return{changed:a!==b,anims:document.getAnimations().length,male:tags().every((t)=>t.startsWith('otsu '))};
    });
    assert.ok(r.changed);assert.ok(r.male);assert.equal(r.anims,0);
    await page.close();
  });
}finally{
  await browser.close();
  server.close();
}
if(failed){console.log(`${failed} failed`);process.exit(1);}
console.log('all fav-chars dialog checks passed');
