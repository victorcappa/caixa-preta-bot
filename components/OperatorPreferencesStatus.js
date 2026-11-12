"use client";
import {useEffect,useState} from 'react';
export default function OperatorPreferencesStatus(){
  const [status,setStatus]=useState(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true;const refresh=async()=>{try{const r=await fetch('/api/operator-preferences',{cache:'no-store'});if(!r.ok)throw new Error();const data=await r.json();if(active){setStatus(data);setError(Boolean(data.error));}}catch{if(active)setError(true);}};void refresh();const timer=setInterval(refresh,2500);return()=>{active=false;clearInterval(timer);};},[]);
  return <p role="status" aria-label="Salvamento dos parâmetros">{error?'Não foi possível confirmar o salvamento dos ajustes.':!status?'Verificando ajustes salvos…':!status.saved?'Aguardando salvamento dos ajustes.':!status.runtimeReady?'Valores atuais salvos. Reinicie o servidor para ativar o salvamento automático nesta execução.':`Ajustes salvos automaticamente · ${new Date(status.savedAt).toLocaleString('pt-BR')}`}</p>;
}
