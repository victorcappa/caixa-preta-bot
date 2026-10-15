// Test-only preload. Confirms that the existing model receives text data, never images.
import fs from "node:fs/promises";
const fixture=process.env.CAIXA_PRETA_TAROT_MOCK;
if(fixture){
  const original=globalThis.fetch;
  globalThis.fetch=async(input,options={})=>{
    if(!String(input?.url||input).startsWith("https://api.openai.com/"))return original(input,options);
    const request=JSON.parse(options.body),config=JSON.parse(await fs.readFile(fixture,"utf8"));
    await fs.writeFile(`${fixture}.request.json`,JSON.stringify(request));
    await fs.appendFile(`${fixture}.calls.jsonl`,JSON.stringify({at:Date.now(),textOnly:!JSON.stringify(request).includes("input_image")})+"\n");
    if(config.delay)await new Promise((resolve)=>setTimeout(resolve,config.delay));
    options.signal?.throwIfAborted();
    if(config.failure)return Response.json({error:{message:"offline"}},{status:503});
    const content=JSON.parse(request.input.at(-1).content);
    const first=content.elements[0],second=content.elements.find((e)=>e.cardNumber!==first?.cardNumber)||content.elements[1];
    const observation=[{text:first?`${first.name}. Um limite para o olhar.`:"Uma carta. Ainda há muito a observar.",elementIds:first?[first.id]:[]}];
    if(second)observation.push({text:`${second.name}. Esta presença muda a relação entre as formas.`,elementIds:[second.id]});
    const text=JSON.stringify({observation,interpretation:[{text:content.cards?.length>1?"As duas cartas ligam impulso e transformação numa única tensão.":"O gesto sugere uma tensão entre movimento e limite.",elementIds:first?[first.id]:[]}],association:[{text:config.association||"Uma máquina também aprende a reconhecer padrões antes de lhes atribuir sentido.",elementIds:[]}]});
    return Response.json({id:"tarot-test",object:"response",status:"completed",output:[{type:"message",role:"assistant",content:[{type:"output_text",text,annotations:[]}]}]});
  };
}
