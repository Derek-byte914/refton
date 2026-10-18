import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(process.env.TIDEFOLD_TEST_REQUIRE || import.meta.url);
const WAE=require('web-audio-engine');
const {indexedDB}=require('fake-indexeddb');globalThis.indexedDB=indexedDB;
import {DEFAULT,PRESETS,sanitize,scheduleSource,tailSeconds,wavBytes} from '../audio.js';
import {putProject,allProjects,removeProject,makeBackup,readBackup} from '../storage.js';
const results=[];const sr=44100;const offline=()=>new WAE.OfflineAudioContext(2,sr*4,sr);
const init=offline(),source=init.createBuffer(2,sr,sr);
for(let c=0;c<2;c++)for(let i=0;i<sr;i++)source.getChannelData(c)[i]=.15*Math.sin(2*Math.PI*180*i/sr)+.15*Math.sin(2*Math.PI*5000*i/sr);
function tone(a,hz){let re=0,im=0;for(let i=4000;i<sr;i++){re+=a[i]*Math.cos(2*Math.PI*hz*i/sr);im+=a[i]*Math.sin(2*Math.PI*hz*i/sr)}return Math.hypot(re,im)}
function rms(a,start=0,end=a.length){let v=0;for(let i=start;i<end;i++)v+=a[i]*a[i];return Math.sqrt(v/(end-start))}
async function render(p,bypass=false){const ctx=offline();const graph=scheduleSource(ctx,source,p,0,1,0,bypass);graph.graph.output.connect(ctx.destination);const b=await ctx.startRendering();graph.dispose();return b}
const baseline=await render(DEFAULT);const clean=baseline.getChannelData(0);assert(rms(clean,4000,40000)>.14,"sustained preview amplitude");
for(const p of PRESETS){const config={...DEFAULT,...p.values},out=await render(config),a=out.getChannelData(0);assert(a.every(Number.isFinite),p.id+' finite');assert(rms(a)>0.001,p.id+' audible');let diff=0;for(let i=0;i<sr;i++)diff+=Math.abs(a[i]-clean[i]);if(!['clean','hall'].includes(p.id))assert(diff>1,p.id+' changes audio');results.push({preset:p.id,rms:rms(a),difference:diff});if(p.id==='underwater')assert(tone(a,5000)<tone(clean,5000)*.1,'underwater attenuates high frequency')}
const bypass=await render({...DEFAULT,lp:600,drive:65,reverb:80},true);assert.deepEqual(bypass.getChannelData(0),clean,'A/B bypass identical to clean');
assert.equal(tailSeconds({...DEFAULT,echo:40}),3);assert.equal(tailSeconds({...DEFAULT,reverb:40,tail:false}),0);
const sane=sanitize({speed:99,hp:-5,lp:'oops',bass:Infinity});assert.equal(sane.speed,2);assert.equal(sane.hp,20);assert.equal(sane.lp,20000);assert.equal(sane.bass,0);
const wav=wavBytes([source.getChannelData(0),source.getChannelData(1)],sr);const view=new DataView(wav);assert.equal(view.getUint32(40,true),sr*4);assert.equal(view.getUint32(24,true),44100);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(4,true),wav.byteLength-8);
const outDir=process.env.TIDEFOLD_TEST_OUTPUT || '/tmp/tidefold-tests';await fs.mkdir(outDir,{recursive:true});await fs.writeFile(outDir+'/test.wav',Buffer.from(wav));
const p={id:'test-project',name:'Проверка',fileName:'test.wav',mime:'audio/wav',blob:new Blob([wav],{type:'audio/wav'}),params:{...DEFAULT,lp:650,echo:20},preset:'custom',start:.2,end:.8,updated:1};await putProject(p);let rows=await allProjects();assert.equal(rows.length,1);assert.equal(rows[0].name,p.name);p.name='Updated';await putProject(p);rows=await allProjects();assert.equal(rows.length,1);assert.equal(rows[0].name,'Updated');const backup=makeBackup(p);const roundtrip=await readBackup(backup);assert.deepEqual(new Uint8Array(await roundtrip.blob.arrayBuffer()),new Uint8Array(wav));assert.deepEqual(roundtrip.params,p.params);assert.equal(roundtrip.start,.2);assert.equal(roundtrip.id,null);await assert.rejects(()=>readBackup(new Blob(['invalid'])));await removeProject(p.id);assert.equal((await allProjects()).length,0);
let messages=[];const sandbox={Blob,Float32Array,Int16Array,Uint8Array,Math,postMessage:d=>messages.push(d)};vm.createContext(sandbox);sandbox.importScripts=()=>vm.runInContext(lame,sandbox);const lame=await fs.readFile(new URL('../vendor/lame.min.js',import.meta.url),'utf8');vm.runInContext(await fs.readFile(new URL('../export-worker.js',import.meta.url),'utf8'),sandbox);
for(const kbps of [128,192,320]){messages=[];sandbox.onmessage({data:{channels:[source.getChannelData(0),source.getChannelData(1)],sampleRate:sr,kbps,protect:true}});const result=messages.at(-1);assert(!result.error,result.error);assert(result.blob.size>1000);await fs.writeFile(outDir+'/test-'+kbps+'.mp3',new Uint8Array(await result.blob.arrayBuffer()))}
console.log(JSON.stringify({passed:true,checks:'12 presets render finite audible PCM; underwater attenuation; A/B identity; tail; bounds; WAV header; IndexedDB insert/update/delete; binary backup exact roundtrip; invalid backup rejected; MP3 128/192/320 encoding',presets:results,notes:'Node web-audio-engine is a reference renderer, not browser QA. Its convolver is a pass-through implementation; native convolution needs browser verification.'},null,2));

let CaptureClass;const packets=[];const workletSandbox={AudioWorkletProcessor:class{constructor(){this.port={postMessage:x=>packets.push(x)}}},Float32Array,registerProcessor:(name,c)=>{CaptureClass=c}};vm.createContext(workletSandbox);vm.runInContext(await fs.readFile(new URL('../capture-worklet.js',import.meta.url),'utf8'),workletSandbox);const cap=new CaptureClass();cap.port.onmessage({data:'start'});for(let i=0;i<33;i++)cap.process([[new Float32Array(128).fill(.25),new Float32Array(128).fill(-.5)]],[]);cap.port.onmessage({data:'stop'});assert.equal(packets[0].channels[0].length,4096);assert.equal(packets[1].channels[0].length,128);assert.equal(packets[0].channels[0][0],.25);assert.equal(packets[0].channels[1][0],-.5);assert.equal(packets[2].done,true);console.log('PASS: worklet PCM batching, stereo samples, final flush');
