const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const DB_NAME = 'velora-local-library';
const DB_VERSION = 1;
let db, tracks = [], playlists = [], profile = {name:'', avatar:null}, currentTrackId = null, currentPlaylistId = null, editingPlaylistId = null, pendingCover = null, toastTimer;

const audio = $('#audioElement');
const fallbackCover = 'icon.svg';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const d = request.result;
      if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', {keyPath:'id'});
      if (!d.objectStoreNames.contains('playlists')) d.createObjectStore('playlists', {keyPath:'id'});
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', {keyPath:'key'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function store(name, mode='readonly') { return db.transaction(name, mode).objectStore(name); }
function requestResult(req) { return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}); }
async function getAll(name) { return requestResult(store(name).getAll()); }
async function put(name, value) { return requestResult(store(name,'readwrite').put(value)); }
async function del(name, key) { return requestResult(store(name,'readwrite').delete(key)); }
function id() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2); }
function showToast(message) { const t=$('#toast'); t.textContent=message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2800); }
function safeText(s='') { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function coverURL(blob) { return blob ? URL.createObjectURL(blob) : fallbackCover; }
function formatTime(n) { if (!Number.isFinite(n)) return '0:00'; const m=Math.floor(n/60), s=Math.floor(n%60); return `${m}:${String(s).padStart(2,'0')}`; }
function getTrack(idValue) { return tracks.find(t=>t.id===idValue); }
function activePlaylist() { return playlists.find(p=>p.id===currentPlaylistId); }

async function init() {
  try {
    db = await openDB();
    tracks = await getAll('tracks');
    playlists = await getAll('playlists');
    const settings = await getAll('settings');
    const p = settings.find(x=>x.key==='profile'); if(p) profile=p.value;
    const oldWelcome = settings.find(x=>x.key==='welcome');
    if(!playlists.length && !oldWelcome) {
      const starter = {id:id(),name:'little daydreams',description:'Songs for slow mornings ♡',cover:null,trackIds:[],created:Date.now()};
      playlists.push(starter); await put('playlists',starter); await put('settings',{key:'welcome',value:true});
    }
    renderAll();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  } catch(e) { console.error(e); showToast('Lokaler Speicher konnte nicht geöffnet werden. Bitte öffne Velora über eine sichere HTTPS-Adresse.'); }
}
function renderAll() {
  renderTracks(); renderPlaylists(); renderProfile(); updatePlayer();
}
function renderTracks() {
  const query = ($('#searchInput')?.value || '').trim().toLowerCase();
  const filtered = tracks.filter(t=>`${t.title} ${t.artist} ${t.filename}`.toLowerCase().includes(query));
  const row = t => `<div class="track-row"><img class="track-cover" src="${t.cover ? coverURL(t.cover) : fallbackCover}" alt=""><button class="track-meta" data-play="${t.id}" style="border:0;background:transparent;padding:0"><strong>${safeText(t.title)}</strong><span>${safeText(t.artist || 'Unbekannter Interpret')}</span></button><button class="icon-button" data-fav="${t.id}" aria-label="Favorit">${t.favorite?'♥':'♡'}</button><button class="row-more" data-more="${t.id}" aria-label="Weitere Optionen">⋯</button></div>`;
  const html = filtered.map(row).join('');
  $('#allTracks').classList.toggle('empty-state',!filtered.length);
  $('#allTracks').innerHTML = html || (tracks.length ? 'Keine passenden Songs gefunden ♡' : 'Importiere MP3-Dateien von deinem Gerät.');
  const recent = [...tracks].sort((a,b)=>b.added-a.added).slice(0,4);
  $('#recentTracks').classList.toggle('empty-state',!recent.length);
  $('#recentTracks').innerHTML = recent.map(row).join('') || 'Deine ersten Songs warten hier ♡';
  bindTrackButtons();
}
function renderPlaylists() {
  const card = p => `<button class="playlist-card" data-playlist="${p.id}"><img src="${p.cover ? coverURL(p.cover) : fallbackCover}" alt=""><strong>${safeText(p.name)}</strong><small>${p.trackIds.length} ${p.trackIds.length===1?'Song':'Songs'} · ♡</small></button>`;
  $('#allPlaylists').innerHTML = playlists.map(card).join('') || '<div class="empty-state">Erstelle deine erste Playlist ♡</div>';
  $('#homePlaylists').innerHTML = playlists.slice(0,4).map(card).join('') || '<div class="empty-state">Deine erste Playlist wartet hier ♡</div>';
  $$('[data-playlist]').forEach(b=>b.addEventListener('click',()=>openPlaylist(b.dataset.playlist)));
}
function renderProfile() {
  $('#profileName').value=profile.name||'';
  const url=profile.avatar?coverURL(profile.avatar):fallbackCover;
  $('#headerAvatar').src=url; $('#profileAvatar').src=url;
}
function updatePlayer() {
  const t=getTrack(currentTrackId);
  $('#playerDock').hidden=!t;
  if(!t)return;
  $('#dockCover').src=t.cover?coverURL(t.cover):fallbackCover;
  $('#dockTitle').textContent=t.title; $('#dockArtist').textContent=t.artist||'Unbekannter Interpret';
  $('#bigCover').src=t.cover?coverURL(t.cover):fallbackCover;
  $('#bigTitle').textContent=t.title; $('#bigArtist').textContent=t.artist||'Unbekannter Interpret';
  const playing=!audio.paused;
  $('#dockPlayButton').textContent=playing?'Ⅱ':'▶'; $('#mainPlayButton').textContent=playing?'Ⅱ':'▶';
}
function bindTrackButtons() {
  $$('[data-play]').forEach(b=>b.addEventListener('click',()=>playTrack(b.dataset.play)));
  $$('[data-fav]').forEach(b=>b.addEventListener('click',async()=>{const t=getTrack(b.dataset.fav);if(!t)return;t.favorite=!t.favorite;await put('tracks',t);renderTracks();showToast(t.favorite?'Zu deinen Favoriten hinzugefügt ♡':'Aus Favoriten entfernt');}));
  $$('[data-more]').forEach(b=>b.addEventListener('click',()=>trackMenu(b.dataset.more)));
}
async function trackMenu(trackId) {
  const t=getTrack(trackId); if(!t)return;
  const action=prompt(`Optionen für „${t.title}“:\n1 = zu Playlist hinzufügen\n2 = Coverbild ändern\n3 = Song entfernen\n\nBitte Zahl eingeben:`);
  if(action==='1') {
    if(!playlists.length){showToast('Erstelle zuerst eine Playlist.');return;}
    const options=playlists.map((p,i)=>`${i+1}. ${p.name}`).join('\n');
    const n=Number(prompt(`Zu welcher Playlist?\n${options}`));
    const p=playlists[n-1]; if(!p)return;
    if(!p.trackIds.includes(t.id))p.trackIds.push(t.id);
    await put('playlists',p);renderPlaylists();showToast('Song zur Playlist hinzugefügt ♡');
  } else if(action==='2') {
    $('#coverInput').onchange=async e=>{const f=e.target.files[0];if(f){t.cover=f;await put('tracks',t);renderAll();showToast('Cover gespeichert ♡');}e.target.value='';};
    $('#coverInput').click();
  } else if(action==='3') {
    if(confirm(`„${t.title}“ aus Velora entfernen?`)){if(currentTrackId===t.id){audio.pause();audio.removeAttribute('src');currentTrackId=null;}await del('tracks',t.id);tracks=tracks.filter(x=>x.id!==t.id);for(const p of playlists){p.trackIds=p.trackIds.filter(x=>x!==t.id);await put('playlists',p);}renderAll();showToast('Song aus der Bibliothek entfernt.');}
  }
}
async function playTrack(trackId) {
  const t=getTrack(trackId); if(!t)return;
  currentTrackId=t.id;
  audio.src=URL.createObjectURL(t.file);
  updatePlayer();
  try { await audio.play(); } catch(e) { showToast('Tippe auf Play, um die Wiedergabe zu starten.'); }
  updatePlayer();
}
function nextTrack(direction=1) {
  let list=tracks;
  const p=activePlaylist(); if(p) {const fromPlaylist=p.trackIds.map(getTrack).filter(Boolean);if(fromPlaylist.length)list=fromPlaylist;}
  if(!list.length)return;
  const index=list.findIndex(t=>t.id===currentTrackId);
  const next=list[(index+direction+list.length)%list.length];
  playTrack(next.id);
}
function goView(viewId) {
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===viewId));
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===viewId));
  if(viewId==='musicView')renderTracks();
  window.scrollTo({top:0,behavior:'smooth'});
}
async function importAudio(files) {
  const audioFiles=[...files].filter(f=>f.type.startsWith('audio/')||/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name));
  if(!audioFiles.length){showToast('Bitte wähle eine Audiodatei aus.');return;}
  for(const file of audioFiles) {
    const base=file.name.replace(/\.[^.]+$/,'');
    const t={id:id(),filename:file.name,title:base,artist:'',file,cover:null,favorite:false,added:Date.now()};
    await put('tracks',t);tracks.push(t);
  }
  renderAll();showToast(`${audioFiles.length} ${audioFiles.length===1?'Song':'Songs'} importiert ♡`);
}
function openPlaylistForm(p=null) {
  editingPlaylistId=p?.id||null; pendingCover=p?.cover||null;
  $('#playlistDialogTitle').textContent=p?'Playlist bearbeiten':'Neue Playlist';
  $('#playlistName').value=p?.name||'';
  $('#playlistDescription').value=p?.description||'';
  $('#playlistCoverPreview').src=pendingCover?coverURL(pendingCover):fallbackCover;
  $('#playlistDialog').showModal();
}
async function savePlaylist(event) {
  event.preventDefault();
  const name=$('#playlistName').value.trim();if(!name)return;
  if(editingPlaylistId) {
    const p=playlists.find(x=>x.id===editingPlaylistId);if(!p)return;
    p.name=name;p.description=$('#playlistDescription').value.trim();p.cover=pendingCover;
    await put('playlists',p);
  } else {
    const p={id:id(),name,description:$('#playlistDescription').value.trim(),cover:pendingCover,trackIds:[],created:Date.now()};
    playlists.unshift(p);await put('playlists',p);
  }
  $('#playlistDialog').close();renderPlaylists();showToast('Playlist gespeichert ♡');
}
function openPlaylist(pid) {
  currentPlaylistId=pid;const p=playlists.find(x=>x.id===pid);if(!p)return;
  $('#detailCover').src=p.cover?coverURL(p.cover):fallbackCover;
  $('#detailName').textContent=p.name;$('#detailDescription').textContent=p.description||'Eine kleine Sammlung deiner Lieblingssongs ♡';
  const list=p.trackIds.map(getTrack).filter(Boolean);
  $('#detailCount').textContent=`${list.length} SONG${list.length===1?'':'S'} · MADE BY YOU`;
  $('#detailTracks').innerHTML=list.map(t=>`<div class="track-row"><img class="track-cover" src="${t.cover?coverURL(t.cover):fallbackCover}" alt=""><button class="track-meta" data-play="${t.id}" style="border:0;background:transparent;padding:0"><strong>${safeText(t.title)}</strong><span>${safeText(t.artist||'Unbekannter Interpret')}</span></button><button class="row-more" data-remove-from-playlist="${t.id}" aria-label="Aus Playlist entfernen">−</button></div>`).join('')||'<div class="empty-state">Diese Playlist ist noch leer. Füge deine Lieblingssongs hinzu ♡</div>';
  $('#detailTracks').querySelectorAll('[data-play]').forEach(b=>b.addEventListener('click',()=>playTrack(b.dataset.play)));
  $('#detailTracks').querySelectorAll('[data-remove-from-playlist]').forEach(b=>b.addEventListener('click',async()=>{p.trackIds=p.trackIds.filter(x=>x!==b.dataset.removeFromPlaylist);await put('playlists',p);openPlaylist(pid);renderPlaylists();}));
  $('#playlistDetailDialog').showModal();
}
async function changeImage(input, callback) {
  input.onchange=async e=>{const f=e.target.files[0];if(f){callback(f);}input.value='';};
  input.click();
}
function exportBackup() {
  const payload={format:'velora-backup-v1',exportedAt:new Date().toISOString(),profile:{name:profile.name||'',avatar:profile.avatar||null},tracks:tracks.map(t=>({...t,fileData:null})),playlists:playlists.map(p=>({...p,cover:p.cover||null}))};
  const fileReaders=[];
  const blobToDataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
  Promise.all(tracks.map(async(t)=>({ ...t, fileData:await blobToDataURL(t.file),coverData:t.cover?await blobToDataURL(t.cover):null, file:undefined, cover:undefined }))).then(async exportedTracks=>{
    const exportedPlaylists=await Promise.all(playlists.map(async p=>({...p,coverData:p.cover?await blobToDataURL(p.cover):null,cover:undefined})));
    const avatarData=profile.avatar?await blobToDataURL(profile.avatar):null;
    const out={format:'velora-backup-v1',exportedAt:new Date().toISOString(),profile:{name:profile.name||'',avatarData},tracks:exportedTracks,playlists:exportedPlaylists};
    const blob=new Blob([JSON.stringify(out)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`velora-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
    showToast('Backup exportiert. Bitte sicher aufbewahren ♡');
  }).catch(e=>{console.error(e);showToast('Backup konnte nicht erstellt werden. Vielleicht sind zu viele/große Dateien enthalten.');});
}
function dataURLToBlob(url){const [meta,data]=url.split(',');const mime=(meta.match(/data:(.*?);base64/)||[])[1]||'application/octet-stream';const bin=atob(data);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:mime});}
async function restoreBackup(file) {
  try {
    const data=JSON.parse(await file.text());if(data.format!=='velora-backup-v1')throw new Error('wrong format');
    if(!confirm('Backup importieren? Die vorhandene Bibliothek wird ergänzt; gleiche IDs können überschrieben werden.'))return;
    for(const raw of data.tracks||[]){const t={...raw,file:dataURLToBlob(raw.fileData),cover:raw.coverData?dataURLToBlob(raw.coverData):null};delete t.fileData;delete t.coverData;await put('tracks',t);}
    for(const raw of data.playlists||[]){const p={...raw,cover:raw.coverData?dataURLToBlob(raw.coverData):null};delete p.coverData;await put('playlists',p);}
    if(data.profile){profile={name:data.profile.name||'',avatar:data.profile.avatarData?dataURLToBlob(data.profile.avatarData):null};await put('settings',{key:'profile',value:profile});}
    tracks=await getAll('tracks');playlists=await getAll('playlists');renderAll();showToast('Backup wiederhergestellt ♡');
  } catch(e){console.error(e);showToast('Backup-Datei konnte nicht gelesen werden.');}
}

$$('.tab').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.go)));
$('#importButton').addEventListener('click',()=>$('#audioInput').click());
$('#heroImportButton').addEventListener('click',()=>$('#audioInput').click());
$('#audioInput').addEventListener('change',e=>{importAudio(e.target.files);e.target.value='';});
$('#searchInput').addEventListener('input',renderTracks);
$('#newPlaylistButton').addEventListener('click',()=>openPlaylistForm());
$('#playlistForm').addEventListener('submit',savePlaylist);
$('#cancelPlaylistButton').addEventListener('click',()=>$('#playlistDialog').close());
$('#choosePlaylistCoverButton').addEventListener('click',()=>changeImage($('#coverInput'),f=>{pendingCover=f;$('#playlistCoverPreview').src=coverURL(f);}));
$('#closeDetailButton').addEventListener('click',()=>$('#playlistDetailDialog').close());
$('#editPlaylistButton').addEventListener('click',()=>{const p=activePlaylist();$('#playlistDetailDialog').close();openPlaylistForm(p);});
$('#deletePlaylistButton').addEventListener('click',async()=>{const p=activePlaylist();if(p&&confirm(`Playlist „${p.name}“ löschen? Die Songs bleiben in deiner Bibliothek.`)){await del('playlists',p.id);playlists=playlists.filter(x=>x.id!==p.id);$('#playlistDetailDialog').close();renderPlaylists();showToast('Playlist gelöscht.');}});
$('#addSongsButton').addEventListener('click',async()=>{const p=activePlaylist();if(!p)return;if(!tracks.length){showToast('Importiere zuerst Musik.');return;}const options=tracks.map((t,i)=>`${i+1}. ${t.title}`).join('\n');const answer=prompt(`Songnummer(n) eingeben, getrennt mit Komma:\n${options}`);if(!answer)return;answer.split(',').map(x=>Number(x.trim())-1).forEach(i=>{if(tracks[i]&&!p.trackIds.includes(tracks[i].id))p.trackIds.push(tracks[i].id);});await put('playlists',p);openPlaylist(p.id);renderPlaylists();});
$('#profileAvatarButton').addEventListener('click',()=>$('#avatarInput').click());
$('#profilePhotoButton').addEventListener('click',()=>$('#avatarInput').click());
$('#avatarInput').addEventListener('change',async e=>{const f=e.target.files[0];if(f){profile.avatar=f;await put('settings',{key:'profile',value:profile});renderProfile();showToast('Profilbild gespeichert ♡');}e.target.value='';});
$('#saveProfileButton').addEventListener('click',async()=>{profile.name=$('#profileName').value.trim();await put('settings',{key:'profile',value:profile});showToast('Profil gespeichert ♡');});
$('#backupButton').addEventListener('click',exportBackup);
$('#restoreInput').addEventListener('change',e=>{if(e.target.files[0])restoreBackup(e.target.files[0]);e.target.value='';});
$('#dockPlayButton').addEventListener('click',()=>{if(!currentTrackId)return;if(audio.paused)audio.play();else audio.pause();updatePlayer();});
$('#dockNextButton').addEventListener('click',()=>nextTrack(1));
$('#openPlayerButton').addEventListener('click',()=>$('#nowPlayingDialog').showModal());
$('#dockArtButton').addEventListener('click',()=>$('#nowPlayingDialog').showModal());
$('#closePlayerButton').addEventListener('click',()=>$('#nowPlayingDialog').close());
$('#mainPlayButton').addEventListener('click',()=>{if(!currentTrackId)return;if(audio.paused)audio.play();else audio.pause();updatePlayer();});
$('#nextButton').addEventListener('click',()=>nextTrack(1));
$('#prevButton').addEventListener('click',()=>{if(audio.currentTime>3){audio.currentTime=0;}else nextTrack(-1);});
$('#seekBar').addEventListener('input',()=>{if(Number.isFinite(audio.duration))audio.currentTime=(Number($('#seekBar').value)/1000)*audio.duration;});
audio.addEventListener('timeupdate',()=>{if(Number.isFinite(audio.duration)){ $('#seekBar').value=String(Math.round(audio.currentTime/audio.duration*1000));$('#currentTime').textContent=formatTime(audio.currentTime);$('#durationTime').textContent=formatTime(audio.duration);}});
audio.addEventListener('play',updatePlayer);audio.addEventListener('pause',updatePlayer);audio.addEventListener('ended',()=>nextTrack(1));
window.addEventListener('beforeunload',()=>{});
init();