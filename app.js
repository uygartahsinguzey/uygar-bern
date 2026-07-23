const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DEFAULTS={focus:25,short:5,long:15,dailyGoal:120,darkness:60,blur:2,autoStart:false,ambientVolume:28};
const initialSubjects=['Psikoloji','İngilizce','Python','Genel tekrar'];
const state={
 mode:'focus',running:false,remaining:1500,endAt:null,interval:null,
 settings:load('bernaSettings',DEFAULTS),
 stats:load('bernaStats',{date:key(),minutes:0,pomodoros:0,streak:0,lastStudyDate:null,totalPomodoros:0}),
 history:load('bernaHistory',{}),
 subjectTotals:load('bernaSubjectTotals',{}),
 tasks:loadArray('bernaTasks',[]),
 subjects:loadArray('bernaSubjects',initialSubjects),
 sessions:loadArray('bernaSessions',[]),
 exam:load('bernaExam',{name:'',date:''})
};
let ambient={ctx:null,nodes:[],playing:false,type:'off'};
function load(k,f){try{return {...f,...JSON.parse(localStorage.getItem(k)||'{}')}}catch{return {...f}}}
function loadArray(k,f){try{const x=JSON.parse(localStorage.getItem(k));return Array.isArray(x)?x:f.slice()}catch{return f.slice()}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function key(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function yesterday(){const d=new Date();d.setDate(d.getDate()-1);return key(d)}
function ensureDay(){if(state.stats.date!==key()){state.stats.date=key();state.stats.minutes=0;state.stats.pomodoros=0;save('bernaStats',state.stats)}}
function duration(mode){return Math.max(1,+state.settings[mode]||DEFAULTS[mode])*60}
function formatMin(n){return n>=60?`${Math.floor(n/60)} sa ${n%60} dk`:`${n} dk`}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1800)}
function setPage(id){
function renderBadges(){
 const p=state.stats.totalPomodoros||0, streak=state.stats.streak||0, total=Object.values(state.history).reduce((a,b)=>a+b,0);
 const badges=[
  ['✦','İlk adım','İlk Pomodoro’yu tamamla',p>=1],
  ['🐾','Miki’nin dostu','10 Pomodoro tamamla',p>=10],
  ['📚','Derin odak','50 Pomodoro tamamla',p>=50],
  ['🔥','Ritim','7 günlük seri oluştur',streak>=7],
  ['⏳','On saat','Toplam 600 dakika çalış',total>=600],
  ['🏛','Usta öğrenci','150 Pomodoro tamamla',p>=150]
 ];
 $('#badgeCount').textContent=`${badges.filter(x=>x[3]).length} / ${badges.length}`;
 $('#badgeGrid').innerHTML=badges.map(b=>`<article class="badge ${b[3]?'unlocked':''}"><span class="badge-icon">${b[0]}</span><strong>${b[1]}</strong><small>${b[3]?'Kazanıldı':b[2]}</small></article>`).join('');
}
function renderSessions(){
 $('#sessionLog').innerHTML=state.sessions.length?state.sessions.slice(0,10).map(s=>{
  const d=new Date(s.date); const date=d.toLocaleDateString('tr-TR',{day:'numeric',month:'short'}); const time=d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  return `<div class="session-entry"><strong>${escapeHTML(s.subject)}</strong><span>${date} · ${time} · ${s.minutes} dk</span><small>${s.note?escapeHTML(s.note):'Not eklenmedi'}</small></div>`;
 }).join(''):'<div class="empty-state">Tamamlanan oturumlar burada görünecek.</div>';
}
function renderExam(){
 $('#examName').value=state.exam.name||''; $('#examDate').value=state.exam.date||'';
 const box=$('#examCountdown');
 if(!state.exam.date){box.innerHTML='<strong>Henüz sınav eklenmedi</strong><small>Bir hedef tarihi eklediğinde burada geri sayım görünür.</small>';return}
 const target=new Date(`${state.exam.date}T23:59:59`), diff=target-Date.now(), days=Math.max(0,Math.ceil(diff/86400000));
 box.innerHTML=diff<0?`<strong>Sınav tarihi geçti</strong><small>${escapeHTML(state.exam.name||'Sınav')}</small>`:`<strong>${days} gün kaldı</strong><small>${escapeHTML(state.exam.name||'Sınav')} · ${new Date(state.exam.date+'T12:00:00').toLocaleDateString('tr-TR')}</small>`;
}
function saveExam(){state.exam={name:$('#examName').value.trim(),date:$('#examDate').value};save('bernaExam',state.exam);renderExam();toast('Sınav geri sayımı kaydedildi')}
function exportData(){
 const keys=['bernaSettings','bernaStats','bernaHistory','bernaSubjectTotals','bernaTasks','bernaSubjects','bernaSessions','bernaExam','bernaSubject'];
 const data={version:3,exportedAt:new Date().toISOString()};
 keys.forEach(k=>data[k]=localStorage.getItem(k));
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=`berna-yedek-${key()}.json`;a.click();URL.revokeObjectURL(a.href);toast('Yedek indirildi');
}
async function importData(file){
 try{const data=JSON.parse(await file.text());if(!data.version)throw Error();Object.entries(data).forEach(([k,v])=>{if(k.startsWith('berna')&&v!==null)localStorage.setItem(k,v)});toast('Yedek yüklendi');setTimeout(()=>location.reload(),700)}catch{toast('Yedek dosyası geçersiz')}
}
function stopAmbient(){
 ambient.nodes.forEach(n=>{try{n.stop?.();n.disconnect?.()}catch{}});ambient.nodes=[];ambient.playing=false;$('#ambientToggle').textContent='Çal';
}
function startAmbient(type){
 stopAmbient(); if(type==='off')return;
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC){toast('Bu cihaz sesi desteklemiyor');return}
 const ctx=ambient.ctx||(ambient.ctx=new AC());ctx.resume();const gain=ctx.createGain();gain.gain.value=(state.settings.ambientVolume||28)/100*.35;gain.connect(ctx.destination);ambient.nodes.push(gain);
 const noise=(filterType,freq,volume=1)=>{
  const size=ctx.sampleRate*2,buf=ctx.createBuffer(1,size,ctx.sampleRate),d=buf.getChannelData(0);
  let last=0;for(let i=0;i<size;i++){const w=Math.random()*2-1;last=(last+.02*w)/1.02;d[i]=type==='brown'?last*3.5:w}
  const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;const f=ctx.createBiquadFilter();f.type=filterType;f.frequency.value=freq;const g=ctx.createGain();g.gain.value=volume;src.connect(f).connect(g).connect(gain);src.start();ambient.nodes.push(src,f,g);
 };
 if(type==='rain'){noise('lowpass',4200,.45);noise('highpass',1800,.18)}
 if(type==='brown')noise('lowpass',700,.75);
 if(type==='cafe'){noise('bandpass',900,.23);const osc=ctx.createOscillator(),g=ctx.createGain();osc.frequency.value=120;g.gain.value=.015;osc.connect(g).connect(gain);osc.start();ambient.nodes.push(osc,g)}
 ambient.playing=true;ambient.type=type;$('#ambientToggle').textContent='Durdur';
}
function toggleAmbient(){const type=$('#ambientSelect').value;if(ambient.playing)stopAmbient();else startAmbient(type)}

$$('.main-tab').forEach(x=>x.classList.toggle('active',x.dataset.page===id));$$('.page').forEach(x=>x.classList.toggle('active',x.id===id));if(id==='statsPage')renderAnalytics()}
function setMode(mode){stop();state.mode=mode;state.remaining=duration(mode);$$('.mode-tab').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode));const x={focus:['ODAK ZAMANI','Telefonu bırak. Sadece bu oturuma odaklan.'],short:['KISA MOLA','Nefes al, su iç ve gözlerini dinlendir.'],long:['UZUN MOLA','Biraz uzaklaş. Zihnini gerçekten dinlendir.']}[mode];$('#modeLabel').textContent=x[0];$('#sessionHint').textContent=x[1];renderTimer();renderMiki()}
function renderTimer(){const m=Math.floor(state.remaining/60),s=state.remaining%60;$('#timer').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;document.title=`${$('#timer').textContent} · Berna`}
function start(){if(state.running)return;state.running=true;state.endAt=Date.now()+state.remaining*1000;$('#startButton').textContent='Duraklat';state.interval=setInterval(tick,250);renderMiki()}
function stop(){state.running=false;state.endAt=null;$('#startButton').textContent='Başlat';clearInterval(state.interval);state.interval=null;renderMiki()}
function tick(){const next=Math.max(0,Math.ceil((state.endAt-Date.now())/1000));if(next!==state.remaining){state.remaining=next;renderTimer();renderMiki()}if(next===0)complete()}
function reset(){stop();state.remaining=duration(state.mode);renderTimer();renderMiki()}
function progress(){return Math.min(1,Math.max(0,(duration('focus')-state.remaining)/duration('focus')))}
function roomLevel(){const p=state.stats.totalPomodoros||0;return p>=75?3:p>=35?2:p>=10?1:0}
function renderMiki(){const scene=$('#mikiScene'),room=$('#mikiRoom');scene.className='miki-scene';room.className=`miki-room room-${roomLevel()}`;if(state.mode!=='focus'||(!state.running&&state.remaining===duration('focus'))){scene.classList.add('sleeping','stage-0');$('#mikiMessage').textContent=state.mode==='focus'?'Miki seninle çalışmaya hazır.':'Miki de dinleniyor.';return}const p=progress(),stage=p<.2?0:p<.55?1:p<.85?2:3;scene.classList.add(`stage-${stage}`);if(state.running)scene.classList.add('running');$('#mikiMessage').textContent=['Miki uyandı. Hadi başlayalım.','Miki sessizce yanında.','Miki kitabını açtı.','Son düzlüktesiniz.'][stage]}
function complete(){const completed=state.mode;stop();if(completed==='focus'){ensureDay();const mins=+state.settings.focus;state.stats.minutes+=mins;state.stats.pomodoros++;state.stats.totalPomodoros=(state.stats.totalPomodoros||0)+1;if(state.stats.lastStudyDate!==key()){state.stats.streak=state.stats.lastStudyDate===yesterday()?state.stats.streak+1:1;state.stats.lastStudyDate=key()}state.history[key()]=(state.history[key()]||0)+mins;const sub=$('#subjectSelect').value;state.subjectTotals[sub]=(state.subjectTotals[sub]||0)+mins;
const note=$('#focusNote').value.trim();
state.sessions.unshift({date:new Date().toISOString(),subject:sub,minutes:mins,note});
state.sessions=state.sessions.slice(0,30);
save('bernaSessions',state.sessions);
save('bernaStats',state.stats);save('bernaHistory',state.history);save('bernaSubjectTotals',state.subjectTotals);renderStats();renderSessions();$('#mikiScene').className='miki-scene stage-3 celebrate';$('#mikiMessage').textContent='Miki seninle gurur duyuyor!';toast('Pomodoro tamamlandı ✦')}tone();if(navigator.vibrate)navigator.vibrate([160,80,160]);const next=completed==='focus'?(state.stats.pomodoros%4===0?'long':'short'):'focus';setTimeout(()=>{setMode(next);if(state.settings.autoStart)start()},1600)}
function tone(){try{const a=new(AudioContext||webkitAudioContext),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.setValueAtTime(.001,a.currentTime);g.gain.exponentialRampToValueAtTime(.16,a.currentTime+.02);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.45);o.start();o.stop(a.currentTime+.46)}catch{}}
function renderStats(){ensureDay();$('#todayMinutes').textContent=formatMin(state.stats.minutes);$('#pomodoroCount').textContent=state.stats.pomodoros;$('#streakCount').textContent=`${state.stats.streak} gün`;$('#streakMessage').textContent=state.stats.streak?'Ritmi bozma. Miki seni bekliyor.':'İlk çalışma gününü başlat.';const p=Math.min(100,Math.round(state.stats.minutes/state.settings.dailyGoal*100));$('#goalLabel').textContent=`${state.stats.minutes} / ${state.settings.dailyGoal} dk`;$('#goalPercent').textContent=`${p}%`;$('#progressBar').style.width=`${p}%`;renderMiki()}
function renderSubjects(){const select=$('#subjectSelect'),current=localStorage.getItem('bernaSubject')||state.subjects[0];select.innerHTML=state.subjects.map(s=>`<option>${escapeHTML(s)}</option>`).join('');select.value=state.subjects.includes(current)?current:state.subjects[0];$('#subjectList').innerHTML=state.subjects.map((s,i)=>`<span class="chip">${escapeHTML(s)}${state.subjects.length>1?`<button data-delete-subject="${i}" aria-label="Sil">×</button>`:''}</span>`).join('')}
function renderTasks(){const done=state.tasks.filter(t=>t.done).length;$('#taskSummary').textContent=`${done} / ${state.tasks.length}`;$('#taskList').innerHTML=state.tasks.length?state.tasks.map((t,i)=>`<div class="task-item ${t.done?'done':''}"><input class="task-check" type="checkbox" data-toggle-task="${i}" ${t.done?'checked':''}><span class="task-text">${escapeHTML(t.text)}</span><button class="delete-button" data-delete-task="${i}">×</button></div>`).join(''):'<div class="empty-state">Bugün için henüz görev yok.</div>'}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function last7(){const a=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);a.push({k:key(d),label:['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][d.getDay()]})}return a}
function renderAnalytics(){renderBadges();const days=last7(),vals=days.map(d=>state.history[d.k]||0),max=Math.max(30,...vals);$('#weekTotal').textContent=formatMin(vals.reduce((a,b)=>a+b,0));$('#weekChart').innerHTML=days.map((d,i)=>`<div class="bar-wrap"><b>${vals[i]}</b><div class="bar" style="height:${Math.max(2,vals[i]/max*125)}px"></div><small>${d.label}</small></div>`).join('');const entries=Object.entries(state.subjectTotals).sort((a,b)=>b[1]-a[1]),total=Math.max(1,entries.reduce((a,[,v])=>a+v,0));$('#subjectStats').innerHTML=entries.length?entries.map(([s,v])=>`<div><div class="subject-stat-head"><span>${escapeHTML(s)}</span><b>${formatMin(v)}</b></div><div class="progress-track"><div class="progress-bar" style="width:${v/total*100}%"></div></div></div>`).join(''):'<div class="empty-state">Henüz çalışma kaydı yok.</div>';const lvl=roomLevel(),thresholds=[10,35,75,150],start=[0,10,35,75][lvl],next=thresholds[lvl],p=Math.min(100,Math.round(((state.stats.totalPomodoros-start)/(next-start))*100));$('#roomLevel').textContent=lvl+1;$('#roomDescription').textContent=['Miki’nin sade minderi.','Pencereli sakin köşe.','Bitkili çalışma alanı.','Kitaplıklı özel oda.'][lvl];$('#roomProgress').style.width=`${p}%`;$('#roomNext').textContent=`Sonraki gelişim için ${Math.max(0,next-state.stats.totalPomodoros)} Pomodoro.`}
function openSettings(){for(const k of ['focus','short','long'])$(`#${k}Duration`).value=state.settings[k];$('#dailyGoal').value=state.settings.dailyGoal;$('#autoStart').checked=!!state.settings.autoStart;$('#ambientVolume').value=state.settings.ambientVolume||28;$('#backgroundDarkness').value=state.settings.darkness;$('#backgroundBlur').value=state.settings.blur;rangeLabels();$('#settingsDialog').showModal()}
function saveSettings(){state.settings={focus:clamp('#focusDuration',1,90),short:clamp('#shortDuration',1,30),long:clamp('#longDuration',1,60),dailyGoal:clamp('#dailyGoal',10,600),darkness:+$('#backgroundDarkness').value,blur:+$('#backgroundBlur').value,autoStart:$('#autoStart').checked,ambientVolume:+$('#ambientVolume').value};save('bernaSettings',state.settings);applyBackground();reset();renderStats();toast('Ayarlar kaydedildi')}
function clamp(s,a,b){return Math.min(b,Math.max(a,+$(s).value||a))}
function applyBackground(){document.documentElement.style.setProperty('--overlay',state.settings.darkness/100);document.documentElement.style.setProperty('--blur',`${state.settings.blur}px`)}
function rangeLabels(){$('#darknessValue').textContent=`${$('#backgroundDarkness').value}%`;$('#blurValue').textContent=`${$('#backgroundBlur').value} px`;$('#ambientVolumeValue').textContent=`${$('#ambientVolume').value}%`;document.documentElement.style.setProperty('--overlay',$('#backgroundDarkness').value/100);document.documentElement.style.setProperty('--blur',`${$('#backgroundBlur').value}px`)}
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open('bernaDB',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function saveBackground(file){if(!file?.type.startsWith('image/'))return;const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(file,'background');tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close();loadBackground();toast('Arka plan kaydedildi')}
async function loadBackground(){try{const db=await openDB(),file=await new Promise((res,rej)=>{const r=db.transaction('assets').objectStore('assets').get('background');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});db.close();const bg=$('#photoBackground');if(file){const u=URL.createObjectURL(file);bg.style.backgroundImage=`url("${u}")`;bg.classList.add('active')}else bg.classList.remove('active')}catch{}}
async function removeBackground(){const db=await openDB();await new Promise(res=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').delete('background');tx.oncomplete=res});db.close();$('#photoBackground').classList.remove('active');toast('Arka plan kaldırıldı')}

function renderBadges(){
 const p=state.stats.totalPomodoros||0, streak=state.stats.streak||0, total=Object.values(state.history).reduce((a,b)=>a+b,0);
 const badges=[
  ['✦','İlk adım','İlk Pomodoro’yu tamamla',p>=1],
  ['🐾','Miki’nin dostu','10 Pomodoro tamamla',p>=10],
  ['📚','Derin odak','50 Pomodoro tamamla',p>=50],
  ['🔥','Ritim','7 günlük seri oluştur',streak>=7],
  ['⏳','On saat','Toplam 600 dakika çalış',total>=600],
  ['🏛','Usta öğrenci','150 Pomodoro tamamla',p>=150]
 ];
 $('#badgeCount').textContent=`${badges.filter(x=>x[3]).length} / ${badges.length}`;
 $('#badgeGrid').innerHTML=badges.map(b=>`<article class="badge ${b[3]?'unlocked':''}"><span class="badge-icon">${b[0]}</span><strong>${b[1]}</strong><small>${b[3]?'Kazanıldı':b[2]}</small></article>`).join('');
}
function renderSessions(){
 $('#sessionLog').innerHTML=state.sessions.length?state.sessions.slice(0,10).map(s=>{
  const d=new Date(s.date); const date=d.toLocaleDateString('tr-TR',{day:'numeric',month:'short'}); const time=d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  return `<div class="session-entry"><strong>${escapeHTML(s.subject)}</strong><span>${date} · ${time} · ${s.minutes} dk</span><small>${s.note?escapeHTML(s.note):'Not eklenmedi'}</small></div>`;
 }).join(''):'<div class="empty-state">Tamamlanan oturumlar burada görünecek.</div>';
}
function renderExam(){
 $('#examName').value=state.exam.name||''; $('#examDate').value=state.exam.date||'';
 const box=$('#examCountdown');
 if(!state.exam.date){box.innerHTML='<strong>Henüz sınav eklenmedi</strong><small>Bir hedef tarihi eklediğinde burada geri sayım görünür.</small>';return}
 const target=new Date(`${state.exam.date}T23:59:59`), diff=target-Date.now(), days=Math.max(0,Math.ceil(diff/86400000));
 box.innerHTML=diff<0?`<strong>Sınav tarihi geçti</strong><small>${escapeHTML(state.exam.name||'Sınav')}</small>`:`<strong>${days} gün kaldı</strong><small>${escapeHTML(state.exam.name||'Sınav')} · ${new Date(state.exam.date+'T12:00:00').toLocaleDateString('tr-TR')}</small>`;
}
function saveExam(){state.exam={name:$('#examName').value.trim(),date:$('#examDate').value};save('bernaExam',state.exam);renderExam();toast('Sınav geri sayımı kaydedildi')}
function exportData(){
 const keys=['bernaSettings','bernaStats','bernaHistory','bernaSubjectTotals','bernaTasks','bernaSubjects','bernaSessions','bernaExam','bernaSubject'];
 const data={version:3,exportedAt:new Date().toISOString()};
 keys.forEach(k=>data[k]=localStorage.getItem(k));
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=`berna-yedek-${key()}.json`;a.click();URL.revokeObjectURL(a.href);toast('Yedek indirildi');
}
async function importData(file){
 try{const data=JSON.parse(await file.text());if(!data.version)throw Error();Object.entries(data).forEach(([k,v])=>{if(k.startsWith('berna')&&v!==null)localStorage.setItem(k,v)});toast('Yedek yüklendi');setTimeout(()=>location.reload(),700)}catch{toast('Yedek dosyası geçersiz')}
}
function stopAmbient(){
 ambient.nodes.forEach(n=>{try{n.stop?.();n.disconnect?.()}catch{}});ambient.nodes=[];ambient.playing=false;$('#ambientToggle').textContent='Çal';
}
function startAmbient(type){
 stopAmbient(); if(type==='off')return;
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC){toast('Bu cihaz sesi desteklemiyor');return}
 const ctx=ambient.ctx||(ambient.ctx=new AC());ctx.resume();const gain=ctx.createGain();gain.gain.value=(state.settings.ambientVolume||28)/100*.35;gain.connect(ctx.destination);ambient.nodes.push(gain);
 const noise=(filterType,freq,volume=1)=>{
  const size=ctx.sampleRate*2,buf=ctx.createBuffer(1,size,ctx.sampleRate),d=buf.getChannelData(0);
  let last=0;for(let i=0;i<size;i++){const w=Math.random()*2-1;last=(last+.02*w)/1.02;d[i]=type==='brown'?last*3.5:w}
  const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;const f=ctx.createBiquadFilter();f.type=filterType;f.frequency.value=freq;const g=ctx.createGain();g.gain.value=volume;src.connect(f).connect(g).connect(gain);src.start();ambient.nodes.push(src,f,g);
 };
 if(type==='rain'){noise('lowpass',4200,.45);noise('highpass',1800,.18)}
 if(type==='brown')noise('lowpass',700,.75);
 if(type==='cafe'){noise('bandpass',900,.23);const osc=ctx.createOscillator(),g=ctx.createGain();osc.frequency.value=120;g.gain.value=.015;osc.connect(g).connect(gain);osc.start();ambient.nodes.push(osc,g)}
 ambient.playing=true;ambient.type=type;$('#ambientToggle').textContent='Durdur';
}
function toggleAmbient(){const type=$('#ambientSelect').value;if(ambient.playing)stopAmbient();else startAmbient(type)}

$$('.main-tab').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
$$('.mode-tab').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('#startButton').onclick=()=>state.running?stop():start();$('#resetButton').onclick=reset;$('#settingsButton').onclick=openSettings;$('#saveSettingsButton').onclick=saveSettings;
$('#quickTaskButton').onclick=()=>setPage('tasksPage');
$('#taskForm').onsubmit=e=>{e.preventDefault();const v=$('#taskInput').value.trim();if(!v)return;state.tasks.push({text:v,done:false});save('bernaTasks',state.tasks);$('#taskInput').value='';renderTasks()};
$('#taskList').onclick=e=>{const del=e.target.dataset.deleteTask,tog=e.target.dataset.toggleTask;if(del!==undefined){state.tasks.splice(+del,1)}if(tog!==undefined){state.tasks[+tog].done=e.target.checked}save('bernaTasks',state.tasks);renderTasks()};
$('#subjectForm').onsubmit=e=>{e.preventDefault();const v=$('#subjectInput').value.trim();if(!v||state.subjects.includes(v))return;state.subjects.push(v);save('bernaSubjects',state.subjects);$('#subjectInput').value='';renderSubjects()};
$('#subjectList').onclick=e=>{const i=e.target.dataset.deleteSubject;if(i===undefined)return;state.subjects.splice(+i,1);save('bernaSubjects',state.subjects);renderSubjects()};
$('#subjectSelect').onchange=()=>localStorage.setItem('bernaSubject',$('#subjectSelect').value);
$('#ambientToggle').onclick=toggleAmbient;$('#ambientSelect').onchange=()=>{if(ambient.playing)startAmbient($('#ambientSelect').value)};
$('#saveExamButton').onclick=saveExam;$('#exportButton').onclick=exportData;$('#importInput').onchange=e=>{importData(e.target.files?.[0]);e.target.value=''};
$('#ambientVolume').oninput=()=>{rangeLabels();if(ambient.playing)startAmbient($('#ambientSelect').value)};
$('#backgroundInput').onchange=e=>{saveBackground(e.target.files?.[0]);e.target.value=''};$('#removeBackgroundButton').onclick=removeBackground;$('#backgroundDarkness').oninput=rangeLabels;$('#backgroundBlur').oninput=rangeLabels;
$('#mikiButton').onclick=()=>{const s=$('#mikiScene');s.classList.remove('petted');void s.offsetWidth;s.classList.add('petted');toast('Miki: mırıldan…')};
$('#clearDataButton').onclick=()=>{if(!confirm('Tüm Berna verileri silinsin mi?'))return;['bernaStats','bernaHistory','bernaSubjectTotals','bernaTasks'].forEach(k=>localStorage.removeItem(k));location.reload()};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.running)tick()});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
applyBackground();loadBackground();renderSubjects();renderTasks();renderSessions();renderExam();renderBadges();setMode('focus');renderStats();