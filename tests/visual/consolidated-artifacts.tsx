import {useState} from 'react';
import LiveQuoteView from '../../src/components/LiveQuoteView';
import WrappedPublicView from '../../src/components/WrappedPublicView';

/** Local synthetic links only: exercises the actual views, never provider APIs. */
export function ConsolidatedArtifactsFixture(){
 const[token,setToken]=useState('fixture-a');
 return <section>
  <div className="flex flex-wrap items-center gap-3 p-4" aria-label="Controles do fixture">
   <label>Link fictício <select aria-label="Link fictício" value={token} onChange={event=>setToken(event.target.value)}>
    <option value="fixture-a">A</option><option value="fixture-b">B</option><option value="fixture-unavailable">Indisponível</option>
   </select></label>
  </div>
  <LiveQuoteView token={token}/><WrappedPublicView token={token}/>
 </section>;
}
