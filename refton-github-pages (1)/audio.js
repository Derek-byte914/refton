// Original Tidefold audio graph. Browser Web Audio API only.
export const DEFAULT={hp:20,lp:20000,bass:0,drive:0,echo:0,reverb:0,tremolo:0,pan:0,mix:100,speed:1,fade:false,tail:true};
export const PRESETS=[
{id:'clean',icon:'○',ru:'Оригинал',en:'Original',descRu:'Без обработки',descEn:'Untouched',values:{}},
{id:'underwater',icon:'≈',ru:'Под водой',en:'Underwater',descRu:'Глубоко и мягко',descEn:'Deep & muffled',values:{lp:650,hp:35,reverb:8,tremolo:0,bass:2}},
{id:'wall',icon:'▥',ru:'За стеной',en:'Behind a wall',descRu:'Далёкий бас',descEn:'Distant bass',values:{lp:380,bass:4,reverb:0}},
{id:'radio',icon:'⌁',ru:'Радио',en:'Radio',descRu:'Тёплый ретро',descEn:'Warm & vintage',values:{hp:330,lp:3800,drive:4}},
{id:'phone',icon:'⌕',ru:'Телефон',en:'Telephone',descRu:'Узкий диапазон',descEn:'Narrow band',values:{hp:650,lp:2400,drive:0}},
{id:'echo',icon:')))',ru:'Эхо',en:'Echo',descRu:'Повторения',descEn:'Repeating trails',values:{echo:45}},
{id:'hall',icon:'⋒',ru:'Большой зал',en:'Great hall',descRu:'Объём и воздух',descEn:'Wide & spacious',values:{reverb:65}},
{id:'drive',icon:'ϟ',ru:'Искажение',en:'Distortion',descRu:'Грубая фактура',descEn:'Rough texture',values:{drive:65,lp:7000}},
{id:'bass',icon:'≋',ru:'Больше баса',en:'Bass boost',descRu:'Плотный низ',descEn:'Full low end',values:{bass:10}},
{id:'dream',icon:'☾',ru:'Сон',en:'Dream',descRu:'Медленно и далеко',descEn:'Slow & distant',values:{speed:.85,lp:7000,reverb:45,echo:15}},
{id:'slow',icon:'≪',ru:'Замедление',en:'Slowed',descRu:'Ниже и спокойнее',descEn:'Lower & slower',values:{speed:.75}},
{id:'fast',icon:'≫',ru:'Ускорение',en:'Sped up',descRu:'Быстрее и выше',descEn:'Faster & higher',values:{speed:1.25}}
];
export function sanitize(v={}){const o={...DEFAULT};const limits={hp:[20,2000],lp:[200,20000],bass:[-12,12],drive:[0,100],echo:[0,80],reverb:[0,100],tremolo:[0,80],pan:[-1,1],mix:[0,100],speed:[.5,2]};for(const [k,[lo,hi]] of Object.entries(limits)){if(Number.isFinite(Number(v[k])))o[k]=Math.max(lo,Math.min(hi,Number(v[k])))}o.fade=!!v.fade;o.tail=v.tail!==false;return o;}
export function tailSeconds(p,bypass=false){return !bypass&&p.tail&&p.mix>0?Math.max(p.reverb>0?2.8:0,p.echo>0?3:0):0;}
const impulseCache=new WeakMap();
function impulse(ctx){if(impulseCache.has(ctx))return impulseCache.get(ctx);const ir=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*2.8),ctx.sampleRate);let seed=4721;for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);let a=0,b=0,total=0;const coefficient=1-Math.exp(-2*Math.PI*3200/ctx.sampleRate);for(let i=0;i<d.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a+=coefficient*(seed/4294967296*2-1-a);b+=coefficient*(a-b);const time=i/ctx.sampleRate;d[i]=b*Math.min(1,time/.035)*Math.exp(-time*2.8)*Math.pow(1-i/d.length,2);total+=d[i]*d[i]}const scale=total?.35/Math.sqrt(total):0;for(let i=0;i<d.length;i++)d[i]*=scale}impulseCache.set(ctx,ir);return ir;}
// Fixed topology: automation changes AudioParams, never restarts the source.
export function createGraph(ctx,input,raw,bypass=false){const nodes=[],osc=[];let initialized=false;
const make=(type)=>{const n=ctx[type]();nodes.push(n);return n;};
const gain=()=>make('createGain');const output=gain(),dry=gain(),wet=gain(),sum=gain();input.connect(dry);dry.connect(output);sum.connect(wet);wet.connect(output);
const hp=make('createBiquadFilter');hp.type='highpass';hp.Q.value=.5;
const lp=make('createBiquadFilter');lp.type='lowpass';lp.Q.value=.5;
const bass=make('createBiquadFilter');bass.type='lowshelf';bass.frequency.value=180;
input.connect(hp);hp.connect(lp);lp.connect(bass);
const cleanDrive=gain(),driveInput=gain(),driveLevel=gain(),driveSum=gain(),shape=make('createWaveShaper');const curve=new Float32Array(65537);for(let i=0;i<curve.length;i++){const x=2*i/(curve.length-1)-1;curve[i]=Math.tanh(x*3)/Math.tanh(3)}shape.curve=curve;shape.oversample='4x';bass.connect(cleanDrive);cleanDrive.connect(driveSum);bass.connect(driveInput);driveInput.connect(shape);shape.connect(driveLevel);driveLevel.connect(driveSum);
const trem=gain(),depth=gain(),lfo=make('createOscillator');lfo.frequency.value=1.3;lfo.connect(depth);depth.connect(trem.gain);driveSum.connect(trem);lfo.start();osc.push(lfo);let last=trem;
let pan;if(ctx.createStereoPanner){pan=make('createStereoPanner');last.connect(pan);last=pan}last.connect(sum);
const delay=ctx.createDelay(1);nodes.push(delay);delay.delayTime.value=.32;const feedback=gain(),echoLevel=gain(),damping=make('createBiquadFilter');damping.type='lowpass';damping.frequency.value=4200;damping.Q.value=.5;feedback.gain.value=.32;last.connect(delay);delay.connect(damping);damping.connect(feedback);feedback.connect(delay);damping.connect(echoLevel);echoLevel.connect(sum);
const conv=make('createConvolver'),reverbLevel=gain();conv.normalize=false;conv.buffer=impulse(ctx);last.connect(conv);conv.connect(reverbLevel);reverbLevel.connect(sum);
function set(param,value){if(!initialized){param.value=value;return}param.setTargetAtTime(value,ctx.currentTime,.025)}
function update(raw,bypass=false){const p=sanitize(raw);const clean=p.hp===20&&p.lp===20000&&p.bass===0&&p.drive===0&&p.echo===0&&p.reverb===0&&p.tremolo===0&&p.pan===0;const mix=bypass||clean?0:p.mix/100;set(hp.frequency,p.hp);set(lp.frequency,Math.min(p.lp,ctx.sampleRate*.45));set(bass.gain,p.bass);const drive=p.drive/100;set(cleanDrive.gain,1-drive);set(driveInput.gain,1+drive*2);set(driveLevel.gain,drive*.65);set(trem.gain,1-p.tremolo/200);set(depth.gain,p.tremolo/200);if(pan)set(pan.pan,p.pan);set(echoLevel.gain,p.echo/100);set(reverbLevel.gain,p.reverb/100*.65);
// Reserve headroom for boosted bass and summed effect returns.
const headroom=.78/(Math.pow(10,Math.max(0,p.bass)/20)*(1+p.echo/100/(1-.32)+p.reverb/100*.8));set(dry.gain,1-mix);set(wet.gain,mix*headroom);initialized=true;}
update(raw,bypass);return {output,update,dispose(){osc.forEach(o=>{try{o.stop()}catch{}});nodes.forEach(n=>{try{n.disconnect()}catch{}})}};
}
export function scheduleSource(ctx,buffer,params,start,end,when=0,bypass=false){const p=sanitize(params);const source=ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=p.speed;const env=ctx.createGain();source.connect(env);const dur=(end-start)/p.speed;const f=p.fade?Math.min(.3,dur/2):Math.min(.005,dur/2);env.gain.setValueAtTime(0,when);env.gain.linearRampToValueAtTime(1,when+f);env.gain.linearRampToValueAtTime(1,when+Math.max(f,dur-f));env.gain.linearRampToValueAtTime(0,when+dur);const graph=createGraph(ctx,env,p,bypass);source.start(when,start,end-start);return {source,graph,env,duration:dur,dispose(){try{source.stop()}catch{}source.disconnect();env.disconnect();graph.dispose()}};}
export function wavBytes(channels,sampleRate){const count=channels.length,n=channels[0].length;const ab=new ArrayBuffer(44+n*count*2),v=new DataView(ab);const str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i))};str(0,'RIFF');v.setUint32(4,36+n*count*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,count,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*count*2,true);v.setUint16(32,count*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*count*2,true);let at=44;for(let i=0;i<n;i++)for(let c=0;c<count;c++){const x=Math.max(-1,Math.min(1,channels[c][i]));v.setInt16(at,x<0?Math.round(x*32768):Math.round(x*32767),true);at+=2}return ab;}
