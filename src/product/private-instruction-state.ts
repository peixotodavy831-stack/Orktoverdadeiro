export interface PrivateInstructionState {read_at:string|null;expires_at:string}
export function visiblePrivateInstructions<T extends PrivateInstructionState>(rows:T[],showRead=false,now=Date.now()):T[]{
 return rows.filter(row=>{const expires=Date.parse(row.expires_at);return Number.isFinite(expires)&&expires>now&&(showRead||!row.read_at);});
}
