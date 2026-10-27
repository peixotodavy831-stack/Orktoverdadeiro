import {ARTIFACT_SIGNATURE} from '../product/artifact-signature.js';

export function ArtifactSignature({dark=false}:{dark?:boolean}){
 return <div aria-label={ARTIFACT_SIGNATURE.label} className={`flex items-center justify-end gap-2 text-[11px] ${dark?'text-zinc-400':'text-zinc-600'}`}>
  <span aria-hidden="true">Criado com</span>
  <img src={ARTIFACT_SIGNATURE.symbol} alt="" width={20} height={20} aria-hidden="true"/>
  <img src={ARTIFACT_SIGNATURE.wordmark} alt="ORKTO" width={76} height={18} aria-hidden="true" style={{filter:dark?'brightness(0) invert(1)':'brightness(0)'}}/>
 </div>;
}
