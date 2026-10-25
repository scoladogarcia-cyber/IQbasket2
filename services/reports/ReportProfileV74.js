/**
 * @fileoverview Configurable, deterministic season report section plan.
 * @description Profiles only rearrange already-authorized report sections.
 * They cannot grant data access, publish a player profile or infer talent.
 */
export const REPORT_PROFILE_V74=Object.freeze({
  VISUAL:Object.freeze({key:"VISUAL",title:"Visual breve",overview:true,quality:false,interpretation:true,glossary:false,complete:false}),
  DEVELOPMENT:Object.freeze({key:"DEVELOPMENT",title:"Seguimiento con evidencia",overview:true,quality:true,interpretation:true,glossary:true,complete:false}),
  COMPLETE:Object.freeze({key:"COMPLETE",title:"Técnico completo",overview:false,quality:true,interpretation:false,glossary:true,complete:true})
});
export function resolveReportProfileV74(code,options={}){
  if(!Object.prototype.hasOwnProperty.call(REPORT_PROFILE_V74,code))throw new Error("Perfil de informe no admitido.");
  const base=REPORT_PROFILE_V74[code],result={...base};
  for(const key of ["overview","quality","interpretation","glossary"]){
    if(Object.prototype.hasOwnProperty.call(options,key)){
      if(typeof options[key]!=="boolean")throw new Error("Configuración del informe no válida.");
      result[key]=options[key];
    }
  }
  if(result.complete&&result.overview)throw new Error("El perfil técnico completo ya incluye el resumen, evita duplicarlo.");
  if(!result.complete&&!result.overview&&!result.quality&&!result.interpretation&&!result.glossary)
    throw new Error("Selecciona alguna sección del informe.");
  return Object.freeze(result);
}
