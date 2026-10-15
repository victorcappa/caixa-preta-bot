"use client";
/* eslint-disable @next/next/no-img-element -- Raw reference pixels are used by the local vision pipeline. */
import { useCallback, useEffect, useState, useRef } from "react";
import { prepareDeck, tarotCommand } from "@/lib/tarot/client";
import TarotCatalogEditor from "./TarotCatalogEditor";
import PublicOperatorControls from "@/components/PublicOperatorControls";
import { DEFAULT_TAROT_VISUAL } from "@/lib/tarot/state";
import styles from "./TarotControls.module.css";

const configFields = [["questionsUntilAutonomy","Perguntas até autonomia"],["maxCards","Máximo de cartas"],["intervalMs","Intervalo entre cartas (ms)"],["maxDurationMs","Duração total (ms)"],["reflectionSeconds","Reflexão aproximada (s)"],["questionFrequency","Perguntar a cada N cartas"],["associationIntensity","Intensidade de associações (0–100)"]];
const profileFields = [["humor","Humor"],["provocation","Provocação"],["philosophy","Densidade filosófica"],["association","Associação livre"],["social","Crítica social"],["poetry","Linguagem poética"],["rigor","Rigor analítico"]];

export default function TarotControls() {
  const [snapshot,setSnapshot]=useState(null),[cards,setCards]=useState([]),[back,setBack]=useState(null);
  const [section,setSection]=useState("apresentacao");
  const [selected,setSelected]=useState(0),[editor,setEditor]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState("");
  const [question,setQuestion]=useState(""),[instruction,setInstruction]=useState(""),[preparation,setPreparation]=useState("");
  const [context,setContext]=useState({text:"",date:"",url:""});
  const refreshSequence=useRef(0),settingsPending=useRef(0);
  const tarot=snapshot?.tarot,sessionId=snapshot?.sessionId;
  const refresh=useCallback(async(force=false)=>{
    if(settingsPending.current&&!force)return;
    const sequence=++refreshSequence.current;
    const response=await fetch("/api/tarot",{cache:"no-store"});
    const result=await response.json();
    if(sequence!==refreshSequence.current)return;
    if(response.ok) setSnapshot(result);
    else setError(result.error || "Treinamento indisponível.");
  },[]);
  const loadCatalog=useCallback(async()=>{const r=await fetch("/api/tarot/catalog",{cache:"no-store"});if(r.ok){const data=await r.json();setCards(data.cards);setBack(data.back);}},[]);
  useEffect(()=>{void refresh();void loadCatalog();const timer=setInterval(()=>void refresh().catch(()=>{}),1500);return()=>clearInterval(timer);},[refresh,loadCatalog]);
  async function command(action,data={}) {
    const setting=["config","camera","visual","profile"].includes(action)&&data[action];
    if(setting){
      settingsPending.current++;refreshSequence.current++;
      setSnapshot((old)=>old?{...old,tarot:{...old.tarot,[action]:{...old.tarot[action],...setting}}}:old);
    }
    setError("");
    try { await tarotCommand(sessionId,action,data);await refresh(true);return true; }
    catch(error) { setError(error.message);return false; }
    finally {if(setting){settingsPending.current--;void refresh();}}
  }
  async function ask(event) {
    event.preventDefault();setPending(true);
    if(await command("ask",{question,requestId:crypto.randomUUID()}))setQuestion("");
    setPending(false);
  }
  async function upload(files) {
    setPending(true);setError("");let count=0;
    try {
      for(const file of files) {
        const prefix=file.name.match(/^(\d{1,2})[-_ ]/);
        const id=files.length===1 ? selected : prefix ? Number(prefix[1]) : NaN;
        if(!Number.isInteger(id)||id<0||id>21)throw new Error(`Arquivo sem número 0–21: ${file.name}`);
        const form=new FormData();form.set("sessionId",sessionId);form.set("id",`${id}`);form.set("image",file);
        const response=await fetch("/api/tarot/catalog",{method:"POST",body:form});
        if(!response.ok)throw new Error(`Falha no upload de ${file.name}`);count++;
      }
      setPreparation(`${count} referência(s) importada(s). Prepare o baralho novamente.`);await loadCatalog();setEditor(false);
    } catch(error){setError(error.message);}finally{setPending(false);}
  }
  async function prepare() {
    setPending(true);setError("");setPreparation("Carregando OpenCV local…");
    try {const result=await prepareDeck(({count,total})=>setPreparation(`Preparando ${count}/${total}…`));setPreparation(`${result.count} referências preparadas. Descritores salvos neste navegador.`);}
    catch(error){setError(error.message);}finally{setPending(false);}
  }
  return <section className={styles.controls} aria-label="Controle do treinamento">
    <header className={styles.controlHeader}><div><h1>TARÔ / TREINAMENTO</h1><p>{tarot ? `SESSÃO ${sessionId.slice(0,8)} · ${tarot.active?"ATIVO":"EM ESPERA"} · ${tarot.generation} · ${tarot.autonomy.status}` : "CONECTANDO À SESSÃO"}</p></div>
      <div className={styles.actions}><button disabled={!tarot} onClick={()=>command("start")}>INICIAR PRÓLOGO</button><button disabled={!tarot} onClick={()=>command("interrupt")}>INTERROMPER FALA</button><button disabled={!tarot} onClick={()=>command("end")}>ENCERRAR PRÓLOGO</button><a href="/treinamento" target="_blank" rel="noreferrer">ABRIR PROJEÇÃO ↗</a></div>
    </header>
    <div className={styles.workspace}><nav className={styles.sectionNav} aria-label="Seções do treinamento">
      {[["apresentacao","Apresentação"],["camera","Câmera e carta"],["chao","Cartas no chão"],["conversa","Conversa"],["autonomia","Autonomia"],["baralho","Baralho"],["visual","Visual"],["contexto","Personalidade e contexto"]].map(([id,label])=><button key={id} type="button" aria-current={section===id?"page":undefined} onClick={()=>setSection(id)}>{label}</button>)}
    </nav><div className={styles.content}>

      {tarot ? <>

        <details open hidden={section!=="apresentacao"}><summary>APRESENTAÇÃO</summary><div className={styles.section}><p className={styles.hint}>Câmera e processamento pertencem à tela pública. A prévia usa a referência e o estado compartilhado, sem vídeo remoto.</p><div className={styles.actions}><button onClick={()=>command("start")}>INICIAR</button><button onClick={()=>command("end")}>ENCERRAR PRÓLOGO</button><button onClick={()=>command("reset")}>REINICIAR TREINAMENTO</button><button onClick={()=>command("interrupt")}>INTERROMPER FALA</button><button onClick={()=>command("resume-speech")}>RETOMAR FALA</button><a href="/" target="_blank" rel="noreferrer">PRINCIPAL ↗</a></div>{tarot.currentCard?<div className={styles.preview}><img src={tarot.currentCard.imageUrl} alt={tarot.currentCard.name}/><div><strong>{tarot.currentCard.name}</strong><p>{tarot.response?.text||"Aguardando interpretação automática."}</p></div></div>:<p>Inicie o prólogo e mostre uma carta. O inventário visual das 22 referências já está incluído.</p>}</div></details>
        <details open hidden={section!=="camera"}><summary>CÂMERA E CARTA</summary><div className={styles.section}>
          <label>Câmera da projeção<select value={tarot.camera.deviceId} onChange={(e)=>command("camera",{deviceId:e.target.value})}><option value="">Automática / integrada</option>{tarot.camera.devices.map((device)=><option key={device.deviceId} value={device.deviceId}>{device.label||"Câmera"}</option>)}</select></label>
          <div className={styles.actions}><button onClick={()=>command("camera",{enabled:true})}>INICIAR CÂMERA</button><button onClick={()=>command("camera",{enabled:false})}>PARAR CÂMERA</button><button onClick={()=>command("camera",{capture:true})}>CAPTURAR CARTA</button><button disabled={pending||!tarot.currentCard} onClick={()=>command("analyze",{requestId:crypto.randomUUID()})}>INTERPRETAR CARTA ATUAL</button></div>
          <label className={styles.check}><input type="checkbox" checked={tarot.camera.automatic} onChange={(e)=>command("camera",{automatic:e.target.checked})} />Reconhecimento automático</label>
          <label className={styles.check}><input type="checkbox" checked={tarot.config.autoAnalyze!==false} onChange={(e)=>command("config",{config:{autoAnalyze:e.target.checked}})} />Análise automática</label>
          <label className={styles.check}><input type="checkbox" checked={Boolean(tarot.config.repeatOnReturn)} onChange={(e)=>command("config",{config:{repeatOnReturn:e.target.checked}})} />Repetir análise quando uma carta retorna (desmarcado: retomar contexto)</label>
          <label className={styles.check}><input type="checkbox" checked={tarot.config.glareProtection!==false} onChange={(e)=>command("config",{config:{glareProtection:e.target.checked}})}/>Proteção contra reflexos e contraste local</label>
          <p className={styles.hint}>Até duas cartas recebem uma interpretação conjunta. Ao perder qualquer carta da leitura, a fala para; reapresentá-la retoma do ponto interrompido. Reflexos que apagam a impressão exigem mudar a inclinação ou a luz.</p>
          <label>Palavras por reflexão<input type="number" min="45" max="150" defaultValue={tarot.config.maxWords||90} onBlur={(e)=>command("config",{config:{maxWords:Number(e.target.value)}})}/></label>
          <label>Estabilidade mínima (ms)<input type="number" min="200" max="3000" defaultValue={tarot.config.stabilityMs||450} onBlur={(e)=>command("config",{config:{stabilityMs:Number(e.target.value)}})}/></label>
          <p>CÂMERA: {tarot.camera.status} · CARTA: {tarot.currentCard?.name||"NENHUMA"}{tarot.currentCard?.source?` · ${tarot.currentCard.source}`:""}</p>
          <label>Carta / correção manual<select value={selected} onChange={(e)=>{setSelected(Number(e.target.value));setEditor(false);}}>{cards.map((card)=><option key={card.id} value={card.id}>{card.number} · {card.name}{!card.imageUrl?" · SEM IMAGEM":""}</option>)}</select></label>
          <div className={styles.actions}><button onClick={()=>command("select",{cardId:selected,source:"manual-camera"})}>CONFIRMAR CARTA NA CÂMERA</button><button onClick={()=>command("contingency")}>REPRODUZIR FALA CADASTRADA</button></div>
          {tarot.currentCard ? <div className={styles.preview}><img src={tarot.currentCard.imageUrl} alt={`Referência: ${tarot.currentCard.name}`} /><div><strong>{tarot.currentCard.name}</strong><p>{tarot.response?.text||"Sem fala atual."}</p><small>PRÉVIA DA REFERÊNCIA · {tarot.currentCard.source}</small></div></div>:null}
        </div></details>
        <details open hidden={section!=="chao"}><summary>CARTAS NO CHÃO</summary><div className={styles.section}>
          <p>{tarot.readCards?.length||0}/{tarot.config.floorAfterCards||6} cartas interpretadas · etapa: {tarot.floor?.phase||"idle"}</p>
          <label className={styles.check}><input type="checkbox" checked={tarot.config.floorEnabled!==false} onChange={(e)=>command("config",{config:{floorEnabled:e.target.checked}})}/>Pedir os 22 versos após as leituras</label>
          <label>Cartas antes da etapa do chão<input type="number" min="1" max="22" defaultValue={tarot.config.floorAfterCards||6} key={tarot.config.floorAfterCards} onBlur={(e)=>command("config",{config:{floorAfterCards:Number(e.target.value)}})}/></label>
          <label>Estabilidade das cartas no chão (ms)<input type="number" min="500" max="5000" defaultValue={tarot.config.floorStabilityMs||1200} onBlur={(e)=>command("config",{config:{floorStabilityMs:Number(e.target.value)}})}/></label>
          {back?<div className={styles.preview}><img src={back.imageUrl} alt="Verso real do baralho"/><p>Verso cadastrado: carta-fundo.jpeg. Reconhecimento e comparação locais.</p></div>:<p>Referência de verso ausente: adicione carta-fundo.jpeg em assets/tarot.</p>}
          <p className={styles.hint}>Após 6 cartas distintas (ou o limite ajustado), o bot pede os 22 versos separados e visíveis. Só escolhe com 22 detecções estáveis do verso real. A ordem segue a imagem: fileiras de cima para baixo, cartas da direita para a esquerda. A seleção fica destacada. A retirada precisa preservar as outras 21 posições; depois mostre somente a frente da escolhida. O encerramento vem após a interpretação.</p>
          {tarot.floor?.error?<p role="status">{tarot.floor.error}</p>:null}
          <div className={styles.actions}><button disabled={!tarot.active} onClick={()=>command("floor-start")}>INICIAR ETAPA DO CHÃO</button><button onClick={()=>command("floor-reset")}>REINICIAR CONTAGEM DAS CARTAS</button></div>
        </div></details>
        <details open hidden={section!=="baralho"}><summary>CATÁLOGO DE ARCANOS / PREPARAR BARALHO</summary><div className={styles.section}>
          <p>22 arcanos · {cards.filter((c)=>c.imageUrl).length} imagens · {cards.filter((c)=>c.preparation?.inventory).length} inventários · {cards.filter((c)=>c.elements.some((e)=>e.validated)).length} com âncoras revisadas.</p>
          <label>Arcano do catálogo<select value={selected} onChange={(e)=>{setSelected(Number(e.target.value));setEditor(false);}}>{cards.map((c)=><option key={c.id} value={c.id}>{c.number} · {c.name} · {c.elements.length} elementos / {c.preparation?.verifiedAnchors||0} âncoras</option>)}</select></label>
          <p className={styles.hint}>Inventários já preparados a partir das fotografias reais. PREPARAR BARALHO recalcula somente descritores locais; o editor serve para ajustes.</p>
          <p className={styles.hint}>As imagens de assets/tarot são carregadas pelo número do arquivo. No lote, use 0-nome.jpeg até 21-nome.jpeg. Uma imagem substitui a carta selecionada e invalida suas âncoras antigas.</p>
          <label>Importar referência individual ou lote<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={pending} onChange={(e)=>{void upload(Array.from(e.target.files));e.target.value="";}} /></label>
          <div className={styles.actions}><button disabled={pending} onClick={prepare}>PREPARAR BARALHO</button><button onClick={()=>{void loadCatalog();setEditor(!editor);}}>EDITAR CARTA {selected}</button><a href="/treinamento" target="_blank" rel="noreferrer">TESTAR NA WEBCAM ↗</a></div>
          {preparation?<p role="status">{preparation}</p>:null}
          {editor&&cards[selected]?<TarotCatalogEditor key={`${selected}:${cards[selected].version}`} card={cards[selected]} sessionId={sessionId} onSaved={(card)=>setCards((old)=>old.map((c)=>c.id===card.id?card:c))}/>:null}
        </div></details>
        <details open hidden={section!=="conversa"}><summary>CONVERSA</summary><div className={styles.section}>
          <form onSubmit={ask}><label>Pergunta ao bot<textarea value={question} onChange={(e)=>setQuestion(e.target.value)} placeholder="O que esta imagem diz sobre a percepção?" /></label><button disabled={pending||!question.trim()||!tarot.currentCard||!tarot.active||!["idle","interpreting"].includes(tarot.floor?.phase||"idle")}>ENVIAR PERGUNTA</button></form>
          <label>Instrução privada<textarea value={instruction} onChange={(e)=>setInstruction(e.target.value)} /></label><button onClick={()=>command("instruction",{text:instruction})}>SALVAR INSTRUÇÃO PRIVADA</button>
          <details><summary>HISTÓRICO DA SESSÃO</summary><div className={styles.history}>{snapshot.history.map((message)=><p key={message.id}><strong>{message.role==="user"?"PERGUNTA":"BOT"}:</strong> {message.content}</p>)}</div></details>
        </div></details>
        <details open hidden={section!=="autonomia"}><summary>AUTONOMIA</summary><div className={styles.section}>
          <p>{tarot.answeredQuestions} perguntas respondidas · {tarot.autonomy.count}/{tarot.config.maxCards} cartas autônomas</p>
          <div className={styles.configGrid}>{configFields.map(([key,label])=><label key={key}>{label}<input type="number" defaultValue={tarot.config[key]} key={`${key}:${tarot.config[key]}`} onBlur={(e)=>command("config",{config:{[key]:Number(e.target.value)}})}/></label>)}</div>
          <label className={styles.check}><input type="checkbox" checked={tarot.config.automatic} onChange={(e)=>command("config",{config:{automatic:e.target.checked}})}/>Ativar após a última resposta terminar</label>
          <div className={styles.actions}>{[["autonomy-start","ATIVAR AGORA"],["autonomy-pause","PAUSAR"],["autonomy-resume","RETOMAR"],["next","PRÓXIMA CARTA"],["human","RETOMAR CONTROLE HUMANO"]].map(([action,label])=><button key={action} onClick={()=>command(action)}>{label}</button>)}<button onClick={()=>command("next",{cardId:selected})}>USAR CARTA {selected} NA PRÓXIMA REFLEXÃO</button></div>
        </div></details>
        <details open hidden={section!=="contexto"}><summary>PERSONALIDADE DO TREINAMENTO</summary><div className={styles.section}><PublicOperatorControls parametersOnly /><p className={styles.hint}>Os controles abaixo complementam a personalidade compartilhada do bot.</p>{profileFields.map(([key,label])=><label className={styles.slider} key={key}>{label}<input type="range" min="0" max="100" value={tarot.profile[key]??50} onChange={(e)=>command("profile",{profile:{...tarot.profile,[key]:Number(e.target.value)}})}/><span>{tarot.profile[key]??50}%</span></label>)}<button onClick={()=>command("profile",{profile:{}})}>RESTAURAR PERFIL</button></div></details>
        <details hidden={section!=="contexto"}><summary>CONTEXTO CONTEMPORÂNEO</summary><div className={styles.section}>
          <p className={styles.hint}>Prepare antes do espetáculo. Cada fato exige data e fonte; a consulta durante a apresentação usa os dados locais.</p>
          <label>Acontecimento<textarea value={context.text} onChange={(e)=>setContext({...context,text:e.target.value})}/></label><label>Data<input type="date" value={context.date} onChange={(e)=>setContext({...context,date:e.target.value})}/></label><label>Fonte<input type="url" value={context.url} onChange={(e)=>setContext({...context,url:e.target.value})}/></label>
          <button disabled={!context.text||!context.date||!/^https?:\/\//.test(context.url)} onClick={async()=>{if(await command("contexts",{contexts:[...tarot.contexts,{...context,enabled:true}]}))setContext({text:"",date:"",url:""});}}>ADICIONAR CONTEXTO</button>
          {tarot.contexts.map((c,i)=><label className={styles.check} key={`${i}:${c.url}`}><input type="checkbox" checked={c.enabled} onChange={(e)=>command("contexts",{contexts:tarot.contexts.map((item,n)=>n===i?{...item,enabled:e.target.checked}:item)})}/><span>{c.date} · {c.text} <a href={c.url} target="_blank" rel="noreferrer">FONTE ↗</a></span></label>)}
        </div></details>
        <details open hidden={section!=="visual"}><summary>VISUAL</summary><div className={styles.section}>
          <p className={styles.hint}>A carta mantém a cor e a nitidez. Os efeitos ficam fora de seu quadrilátero e acompanham a geometria real.</p>
          {[["blur","Desfoque do fundo",18,1],["dimming","Escurecimento do fundo",.85,.01],["green","Tonalidade verde",.6,.01],["matrix","Efeito Matrix",.5,.01],["outline","Contorno da carta",1,.01]].map(([key,label,max,step])=><RangeSetting key={key} label={label} value={tarot.visual?.[key]??DEFAULT_TAROT_VISUAL[key]} max={max} step={step} onCommit={(value)=>command("visual",{visual:{[key]:value}})}/>) }
          <RangeSetting label="Tamanho do texto do bot" value={tarot.visual?.textSize||38} min={24} max={64} step={1} onCommit={(value)=>command("visual",{visual:{textSize:value}})}/>
          <label>Formato Matrix<select aria-label="Formato Matrix" value={tarot.visual?.matrixStyle||"rain"} onChange={(e)=>command("visual",{visual:{matrixStyle:e.target.value}})}><option value="rain">Chuva de códigos</option><option value="constellation">Constelação de signos</option><option value="orbits">Órbitas e conexões</option><option value="runes">Círculos e runas</option></select></label>
          {[["matrixDensity","Quantidade de símbolos",4,90,1],["matrixSpeed","Velocidade Matrix",.1,4,.1],["matrixSize","Tamanho dos símbolos",8,40,1],["matrixGlow","Brilho dos símbolos",0,25,1],["matrixTrails","Persistência dos rastros",0,.97,.01],["matrixScanlines","Linhas de varredura",0,.6,.01],["matrixPulse","Pulsação",0,1,.05],["matrixRotation","Rotação do campo",0,180,1]].map(([key,label,min,max,step])=><RangeSetting key={key} label={label} value={tarot.visual?.[key]??DEFAULT_TAROT_VISUAL[key]} min={min} max={max} step={step} onCommit={(value)=>command("visual",{visual:{[key]:value}})}/>)}
          <label>Alfabeto de símbolos<textarea aria-label="Alfabeto de símbolos" key={tarot.visual?.matrixSymbols} defaultValue={tarot.visual?.matrixSymbols||DEFAULT_TAROT_VISUAL.matrixSymbols} maxLength={180} onBlur={(e)=>command("visual",{visual:{matrixSymbols:e.target.value}})}/></label>
          <label>Cor dos símbolos<input type="color" defaultValue={tarot.visual?.matrixColor||DEFAULT_TAROT_VISUAL.matrixColor} onBlur={(e)=>command("visual",{visual:{matrixColor:e.target.value}})}/></label>
          <label className={styles.check}><input type="checkbox" checked={tarot.visual?.animations!==false} onChange={(e)=>command("visual",{visual:{animations:e.target.checked}})}/>Animações discretas</label>
          <RangeSetting label="Velocidade de revelação" value={tarot.config.revealSpeed||1} min={.25} max={4} step={.25} onCommit={(value)=>command("config",{config:{revealSpeed:value}})}/>
          <button onClick={()=>command("visual",{visual:DEFAULT_TAROT_VISUAL})}>RESTAURAR VISUAL</button>
        </div></details>
        {tarot.error?<p role="status" className={styles.error}>ÚLTIMA OCORRÊNCIA: {tarot.error}</p>:null}
      </>:<p>Conectando à sessão…</p>}
      {error?<p role="alert" className={styles.error}>{error}</p>:null}
    </div></div>
  </section>;
}

function RangeSetting({label,value,min=0,max,step,onCommit}) {
  const [draft,setDraft]=useState(value);const editing=useRef(false);
  useEffect(()=>{if(!editing.current)setDraft(value);},[value]);
  const commit=(event)=>{editing.current=false;void onCommit(Number(event.currentTarget.value));};
  return <label className={styles.slider}>{label}<input type="range" min={min} max={max} step={step} value={draft} onPointerDown={()=>{editing.current=true;}} onChange={(e)=>{editing.current=true;setDraft(Number(e.target.value));}} onPointerUp={commit} onKeyUp={commit} onBlur={commit}/><output>{max<=1?`${Math.round(draft*100)}%`:draft}</output></label>;
}
