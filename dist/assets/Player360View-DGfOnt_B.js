import{P as A,D as k}from"./index-Co3VTdK8.js";import{c as J,d as q,e as Pe,P as B,T as je,f as Re}from"./player360.config-CCSL1AnT.js";import{W as Ce,a as De}from"./WellnessSupportPanel-C6BjKQNQ.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";function $e(i){if(!i||typeof i.from!="function"||typeof i.rpc!="function")throw new Error("EvaluationService: cliente de datos no disponible.")}function I(i,e){if(i==null||i==="")throw new Error(`EvaluationService: ${e} es obligatorio.`);return i}function U(i){return Array.isArray(i)?i:[]}function de(i,e){return U(i).reduce((a,t)=>{const s=String((t==null?void 0:t[e])||"");return a.has(s)||a.set(s,[]),a.get(s).push(t),a},new Map)}class ke{constructor(e=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this._capabilities=null}_assertReady(){$e(this.supabase)}async getCapabilities({force:e=!1}={}){if(this._assertReady(),this._capabilities&&!e)return this._capabilities;const{data:a,error:t}=await this.supabase.rpc("iq_v4_evaluation_capabilities");if(t)throw t;return this._capabilities=a||{ready:!1,evaluation:!1,objective_profile:!1,metric_catalog:!1},this._capabilities}async listMetrics({teamSeasonId:e}={}){this._assertReady(),I(e,"teamSeasonId");const{data:a,error:t}=await this.supabase.rpc("iq_v4_list_evaluation_metrics",{p_team_season_id:e});if(t)throw t;return U(a)}async upsertMetric({teamSeasonId:e=null,code:a,domainCode:t,name:s,description:n=null,scaleMin:r=0,scaleMax:o=10,scaleStep:c=.5,higherIsBetter:d=!0,sensitivity:p="PRIVATE_SPORTING",isActive:u=!0,sortOrder:_=0}={}){this._assertReady(),I(a,"code"),I(t,"domainCode"),I(s,"name");const{data:v,error:g}=await this.supabase.rpc("iq_v4_upsert_evaluation_metric",{p_team_season_id:e,p_code:String(a).toUpperCase(),p_domain_code:String(t).toUpperCase(),p_name:s,p_description:n,p_scale_min:r,p_scale_max:o,p_scale_step:c,p_higher_is_better:!!d,p_sensitivity:String(p||"PRIVATE_SPORTING").toUpperCase(),p_is_active:!!u,p_sort_order:Number(_)||0});if(g)throw g;return v}async listEvaluations({teamSeasonId:e,playerId:a,includeHistory:t=!1,includeArchived:s=!1,limit:n=100}={}){this._assertReady(),I(e,"teamSeasonId"),I(a,"playerId");let r=this.supabase.from("player_evaluations").select("*").eq("team_season_id",e).eq("player_id",a).order("evaluation_date",{ascending:!1}).order("created_at",{ascending:!1}).limit(Math.max(1,Math.min(Number(n)||100,500)));t?s||(r=r.neq("status","ARCHIVED")):r=r.eq("status","CURRENT");const{data:o,error:c}=await r;if(c)throw c;const d=U(o);if(!d.length)return[];const p=d.map(g=>g.id).filter(Boolean),{data:u,error:_}=await this.supabase.from("player_evaluation_scores").select("*").in("evaluation_id",p).order("domain_code",{ascending:!0}).order("metric_name",{ascending:!0});if(_)throw _;const v=de(u,"evaluation_id");return d.map(g=>({...g,scores:v.get(String(g.id))||[]}))}async saveEvaluation({teamSeasonId:e,playerId:a,evaluationDate:t,title:s,evaluationType:n="GENERAL",sourceType:r="CLUB_COACH",evaluatorName:o=null,summary:c=null,strengths:d=null,developmentPriorities:p=null,isPrivate:u=!1,shareWithPlayer:_=!1,scores:v=[],provenance:g={},metadata:x={},existingEvaluationId:S=null}={}){this._assertReady(),I(e,"teamSeasonId"),I(a,"playerId"),I(t,"evaluationDate"),I(s,"title");const l=U(v).filter(E=>(E==null?void 0:E.metric_code)||(E==null?void 0:E.metricCode));if(!l.length)throw new Error("EvaluationService: indica al menos una puntuación.");const{data:y,error:f}=await this.supabase.rpc("iq_v4_save_player_evaluation",{p_team_season_id:e,p_player_id:a,p_evaluation_date:t,p_title:s,p_evaluation_type:String(n||"GENERAL").toUpperCase(),p_source_type:String(r||"CLUB_COACH").toUpperCase(),p_evaluator_name:o,p_summary:c,p_strengths:d,p_development_priorities:p,p_is_private:!!u,p_share_with_player:!!_,p_scores:l.map(E=>({metric_code:String(E.metric_code||E.metricCode).toUpperCase(),score:E.score,confidence:E.confidence??null,notes:E.notes??null,evidence:E.evidence??null,metadata:E.metadata&&typeof E.metadata=="object"?E.metadata:{}})),p_provenance:g&&typeof g=="object"?g:{},p_metadata:x&&typeof x=="object"?x:{},p_existing_evaluation_id:S});if(f)throw f;return y}async archiveEvaluation(e){this._assertReady(),I(e,"evaluationId");const{data:a,error:t}=await this.supabase.rpc("iq_v4_archive_player_evaluation",{p_evaluation_id:e});if(t)throw t;return!!a}async listObjectiveProfiles({teamSeasonId:e,playerId:a,includeHistory:t=!1,includeArchived:s=!1,limit:n=50}={}){this._assertReady(),I(e,"teamSeasonId"),I(a,"playerId");let r=this.supabase.from("player_objective_profiles").select("*").eq("team_season_id",e).eq("player_id",a).order("effective_date",{ascending:!1}).order("created_at",{ascending:!1}).limit(Math.max(1,Math.min(Number(n)||50,200)));t?s||(r=r.neq("status","ARCHIVED")):r=r.eq("status","ACTIVE");const{data:o,error:c}=await r;if(c)throw c;const d=U(o);if(!d.length)return[];const p=d.map(g=>g.id).filter(Boolean),{data:u,error:_}=await this.supabase.from("player_objective_targets").select("*").in("profile_id",p).order("domain_code",{ascending:!0}).order("metric_name",{ascending:!0});if(_)throw _;const v=de(u,"profile_id");return d.map(g=>({...g,targets:v.get(String(g.id))||[]}))}async getActiveObjectiveProfile({teamSeasonId:e,playerId:a}={}){return(await this.listObjectiveProfiles({teamSeasonId:e,playerId:a,includeHistory:!1,includeArchived:!1,limit:1}))[0]||null}async saveObjectiveProfile({teamSeasonId:e,playerId:a,effectiveDate:t,targetDate:s=null,title:n,rationale:r=null,targets:o=[],provenance:c={},metadata:d={},expectedActiveProfileId:p=null}={}){this._assertReady(),I(e,"teamSeasonId"),I(a,"playerId"),I(t,"effectiveDate"),I(n,"title");const u=U(o).filter(g=>(g==null?void 0:g.metric_code)||(g==null?void 0:g.metricCode));if(!u.length)throw new Error("EvaluationService: indica al menos un objetivo.");const{data:_,error:v}=await this.supabase.rpc("iq_v4_save_objective_profile",{p_team_season_id:e,p_player_id:a,p_effective_date:t,p_target_date:s||null,p_title:n,p_rationale:r,p_targets:u.map(g=>({metric_code:String(g.metric_code||g.metricCode).toUpperCase(),target_score:g.target_score??g.targetScore,priority_weight:g.priority_weight??g.priorityWeight??1,notes:g.notes??null,metadata:g.metadata&&typeof g.metadata=="object"?g.metadata:{}})),p_provenance:c&&typeof c=="object"?c:{},p_metadata:d&&typeof d=="object"?d:{},p_expected_active_profile_id:p});if(v)throw v;return _}async archiveObjectiveProfile(e){this._assertReady(),I(e,"profileId");const{data:a,error:t}=await this.supabase.rpc("iq_v4_archive_objective_profile",{p_profile_id:e});if(t)throw t;return!!a}async getObjectiveGap(e){this._assertReady(),I(e,"profileId");const{data:a,error:t}=await this.supabase.rpc("iq_v4_get_player_objective_gap",{p_profile_id:e});if(t)throw t;return U(a)}}const Y=Object.freeze({gatewayVersion:"PLAYER360_AI_GATEWAY_V1",outputContractVersion:"PLAYER360_AI_INSIGHT_V1",edgeFunctionName:"player360-ai-insight",promptVersion:"PLAYER360_STAFF_ES_V2",generationEnabled:!1,allowedAudiences:Object.freeze(["STAFF"]),allowedEvidenceModules:Object.freeze(["competition","training","external_development","evaluation"]),restrictedEvidenceModules:Object.freeze(["nutrition","recovery","neuro_cognitive"]),maxEvidenceBytes:64*1024,maxListItems:8,maxTextLength:2400});Object.freeze(new Set(["fact_type","evidence_type","metric_key","left_metric_key","right_metric_key","unit","aggregation","sample_size","direction","slope_per_week","first_value","last_value","absolute_change","relative_change_pct","coverage_pct","lag_buckets","coefficient","strength","causal_claim_allowed","status","series_total","series_with_data","observed_buckets","minimum_buckets","observed_pairs","minimum_pairs","reason"]));const Z=Object.freeze({contractVersion:"PLAYER360_LONGITUDINAL_V1",calculationVersion:"PLAYER360_LONGITUDINAL_2026.09_V1",bucketUnit:"WEEK",weekStartsOn:1,minimumTrendBuckets:3,minimumAssociationPairs:5,defaultAggregation:"AVERAGE",supportedAggregations:Object.freeze(["AVERAGE","SUM","MIN","MAX","LAST"]),defaultStableTolerance:1e-6}),X=Object.freeze({competition:Object.freeze([Object.freeze({metric_code:"POINTS",source_field:"points",unit:"PTS",aggregation:"AVERAGE",label:"Puntos"}),Object.freeze({metric_code:"EVALUATION",source_field:"evaluation",unit:"INDEX",aggregation:"AVERAGE",label:"Valoración"}),Object.freeze({metric_code:"MINUTES",source_field:"minutes",unit:"MIN",aggregation:"AVERAGE",label:"Minutos"}),Object.freeze({metric_code:"REBOUNDS",source_field:"rebounds",unit:"COUNT",aggregation:"AVERAGE",label:"Rebotes"}),Object.freeze({metric_code:"ASSISTS",source_field:"assists",unit:"COUNT",aggregation:"AVERAGE",label:"Asistencias"}),Object.freeze({metric_code:"PLUS_MINUS",source_field:"plus_minus",unit:"POINT_DIFF",aggregation:"AVERAGE",label:"+/-"})]),training:Object.freeze([Object.freeze({metric_code:"SESSION_LOAD",source_field:"internal_load",unit:"AU",aggregation:"SUM",label:"Carga de entrenamiento"}),Object.freeze({metric_code:"PARTICIPATED_MINUTES",source_field:"participated_minutes",unit:"MIN",aggregation:"SUM",label:"Minutos de entrenamiento"}),Object.freeze({metric_code:"RPE",source_field:"rpe",unit:"RPE_0_10",aggregation:"AVERAGE",label:"RPE de entrenamiento"})]),external_development:Object.freeze([Object.freeze({metric_code:"EXTERNAL_LOAD",source_field:"internal_load",unit:"AU",aggregation:"SUM",label:"Carga de tecnificación"}),Object.freeze({metric_code:"EXTERNAL_MINUTES",source_field:"duration_minutes",unit:"MIN",aggregation:"SUM",label:"Minutos de tecnificación"}),Object.freeze({metric_code:"EXTERNAL_RPE",source_field:"rpe",unit:"RPE_0_10",aggregation:"AVERAGE",label:"RPE de tecnificación"})])}),Ae=Object.freeze([Object.freeze({left:"training.SESSION_LOAD",right:"competition.EVALUATION",lag_buckets:1,label:"Carga de entrenamiento → valoración competitiva"}),Object.freeze({left:"training.SESSION_LOAD",right:"competition.POINTS",lag_buckets:1,label:"Carga de entrenamiento → puntos"})]),ze=Object.freeze({generationEnabled:Y.generationEnabled,edgeFunctionName:Y.edgeFunctionName,promptVersion:Y.promptVersion}),Ue="PLAYER360_EVIDENCE_V1";function Ve(i){if(!i||typeof i.from!="function"||typeof i.rpc!="function")throw new Error("LongitudinalAnalyticsService: cliente de datos no disponible.")}function T(i,e){if(i==null||i==="")throw new Error(`LongitudinalAnalyticsService: ${e} es obligatorio.`);return i}function ae(i,e){if(!i||typeof i!="object"||Array.isArray(i))throw new Error(`LongitudinalAnalyticsService: ${e} debe ser un objeto.`);return i}function pe(i){return Array.isArray(i)?i:[]}class Me{constructor(e=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this._capabilities=null}_assertReady(){Ve(this.supabase)}async getCapabilities({force:e=!1}={}){if(this._assertReady(),this._capabilities&&!e)return this._capabilities;const{data:a,error:t}=await this.supabase.rpc("iq_v4_longitudinal_capabilities");if(t)throw t;return this._capabilities=a||{ready:!1,longitudinal_snapshots:!1,ai_insights:!1,human_review:!1},this._capabilities}async listSnapshots({teamSeasonId:e,playerId:a,limit:t=50}={}){this._assertReady(),T(e,"teamSeasonId"),T(a,"playerId");const{data:s,error:n}=await this.supabase.from("player_longitudinal_snapshots").select("*").eq("team_season_id",e).eq("player_id",a).order("period_end",{ascending:!1}).order("generated_at",{ascending:!1}).limit(Math.max(1,Math.min(Number(t)||50,200)));if(n)throw n;return pe(s)}async saveSnapshot({teamSeasonId:e,playerId:a,periodStart:t,periodEnd:s,calculationVersion:n=Z.calculationVersion,sourceRevision:r=null,sourceFingerprint:o,snapshot:c,evidenceBundle:d,rejectedObservations:p=0}={}){if(this._assertReady(),T(e,"teamSeasonId"),T(a,"playerId"),T(t,"periodStart"),T(s,"periodEnd"),T(o,"sourceFingerprint"),ae(c,"snapshot"),ae(d,"evidenceBundle"),c.contract_version!==Z.contractVersion)throw new Error("LongitudinalAnalyticsService: contrato longitudinal incompatible.");if(c.calculation_version!==n)throw new Error("LongitudinalAnalyticsService: versión de cálculo inconsistente.");if(d.evidence_version!==Ue||d.calculation_version!==n)throw new Error("LongitudinalAnalyticsService: evidencia incompatible con el cálculo.");const{data:u,error:_}=await this.supabase.rpc("iq_v4_save_longitudinal_snapshot",{p_team_season_id:e,p_player_id:a,p_period_start:t,p_period_end:s,p_contract_version:Z.contractVersion,p_calculation_version:n,p_source_revision:r,p_source_fingerprint:o,p_snapshot:c,p_evidence_bundle:d,p_rejected_observations:Math.max(0,Number(p)||0)});if(_)throw _;return u}async listInsights({snapshotId:e,audience:a=null,status:t=null,limit:s=50}={}){this._assertReady(),T(e,"snapshotId");let n=this.supabase.from("player_ai_insights").select("*").eq("snapshot_id",e).order("created_at",{ascending:!1}).limit(Math.max(1,Math.min(Number(s)||50,200)));a&&(n=n.eq("audience",String(a).toUpperCase())),t&&(n=n.eq("status",String(t).toUpperCase()));const{data:r,error:o}=await n;if(o)throw o;return pe(r)}async saveAiInsight({snapshotId:e,audience:a,locale:t="es",provider:s,modelName:n,promptVersion:r,content:o}={}){this._assertReady(),T(e,"snapshotId"),T(a,"audience"),T(s,"provider"),T(n,"modelName"),T(r,"promptVersion"),ae(o,"content");const{data:c,error:d}=await this.supabase.rpc("iq_v4_save_ai_insight",{p_snapshot_id:e,p_audience:String(a).toUpperCase(),p_locale:String(t||"es").toLowerCase(),p_provider:s,p_model_name:n,p_prompt_version:r,p_content:o});if(d)throw d;return c}async reviewAiInsight({insightId:e,status:a,notes:t=null}={}){this._assertReady(),T(e,"insightId"),T(a,"status");const s=String(a).toUpperCase();if(!["APPROVED","REJECTED","ARCHIVED"].includes(s))throw new Error("LongitudinalAnalyticsService: estado de revisión no permitido.");const{data:n,error:r}=await this.supabase.rpc("iq_v4_review_ai_insight",{p_insight_id:e,p_status:s,p_review_notes:t});if(r)throw r;return!!n}}function Ge(i,e){if(i==null||i==="")throw new Error(`Player360AiGatewayService: ${e} es obligatorio.`);return i}function qe(i){if(!(i!=null&&i.functions)||typeof i.functions.invoke!="function")throw new Error("Player360AiGatewayService: cliente de Edge Functions no disponible.")}function Be(i=null){var e;if(i)return String(i).trim();if(typeof((e=globalThis.crypto)==null?void 0:e.randomUUID)=="function")return globalThis.crypto.randomUUID();throw new Error("AI_IDEMPOTENCY_KEY_UNAVAILABLE")}class Fe{constructor(e=null,a={}){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.edgeFunctionName=a.edgeFunctionName||Y.edgeFunctionName,this.generationEnabled=a.generationEnabled??Y.generationEnabled}isEnabled(){return!!this.generationEnabled}async generateInsight({snapshotId:e,audience:a="STAFF",locale:t="es",idempotencyKey:s=null}={}){if(qe(this.supabase),Ge(e,"snapshotId"),!this.isEnabled())throw new Error("AI_GATEWAY_NOT_ENABLED");const n=String(a||"STAFF").trim().toUpperCase();if(!Y.allowedAudiences.includes(n))throw new Error("AI_AUDIENCE_UNSUPPORTED");const r=Be(s),{data:o,error:c}=await this.supabase.functions.invoke(this.edgeFunctionName,{body:{snapshot_id:e,idempotency_key:r,audience:n,locale:String(t||"es").trim().toLowerCase()}});if(c)throw c;if(!(o!=null&&o.success)||!(o!=null&&o.insight_id)){const d=(o==null?void 0:o.error_code)||"AI_GATEWAY_GENERATION_FAILED",p=o!=null&&o.message?`: ${o.message}`:"";throw new Error(`${d}${p}`)}return{insightId:o.insight_id,status:o.status||"DRAFT",provider:o.provider||null,modelName:o.model_name||null,promptVersion:o.prompt_version||null,usage:o.usage||null,usageLedgerId:o.usage_ledger_id||null,idempotencyKey:r,replayed:!!o.replayed}}}const Ye=24*60*60*1e3,ce=7*Ye;function V(i,e){const a=String(i??"").trim();if(!a)throw new Error(`LongitudinalAnalyticsCalculator: ${e} es obligatorio.`);return a}function xe(i){if(i==null||typeof i=="boolean"||typeof i=="string"&&!i.trim())return null;const e=Number(i);return Number.isFinite(e)?e:null}function H(i,e=6){if(!Number.isFinite(i))return null;const a=10**e;return Math.round(i*a)/a}function M(i,e){const a=V(i,e),t=Date.parse(a.length===10?`${a}T00:00:00.000Z`:a);if(Number.isNaN(t))throw new Error(`LongitudinalAnalyticsCalculator: ${e} debe ser una fecha ISO válida.`);return new Date(t)}function C(i){return i.toISOString().slice(0,10)}function ie(i){const e=new Date(i);e.setUTCHours(0,0,0,0);const a=(e.getUTCDay()+6)%7;return e.setUTCDate(e.getUTCDate()-a),e}function re(i,e){const a=M(i,"bucket_start");return a.setTime(a.getTime()+(Number(e)||0)*ce),C(a)}function He(i,e,a){return(Array.isArray(i)?i:[]).map(t=>{const s=(t==null?void 0:t.from)||(t==null?void 0:t.valid_from)||(t==null?void 0:t.start_date)||null,n=(t==null?void 0:t.to)||(t==null?void 0:t.valid_until)||(t==null?void 0:t.end_date)||null;if(!s)return null;const r=M(s,"eligibility.from"),o=n?M(n,"eligibility.to"):new Date(a);o.setUTCHours(23,59,59,999);const c=new Date(Math.max(r.getTime(),e.getTime())),d=new Date(Math.min(o.getTime(),a.getTime()));return d<c?null:{from:C(c),to:C(d),from_timestamp:c.getTime(),to_timestamp:d.getTime()}}).filter(Boolean).sort((t,s)=>t.from_timestamp-s.from_timestamp)}function Ie(i){return!i||typeof i!="object"||Object.isFrozen(i)?i:(Object.values(i).forEach(Ie),Object.freeze(i))}function we(i,e){return`${String(i||"").toLowerCase()}.${String(e||"").toUpperCase()}`}function We(i,e){const a=V(i==null?void 0:i.module,"metricDefinitions.module").toLowerCase(),t=V(i==null?void 0:i.metric_code,"metricDefinitions.metric_code").toUpperCase(),s=String((i==null?void 0:i.aggregation)||e.defaultAggregation).toUpperCase();if(!e.supportedAggregations.includes(s))throw new Error(`LongitudinalAnalyticsCalculator: agregación no soportada (${s}).`);const n=xe(i==null?void 0:i.stable_tolerance);return{key:we(a,t),module:a,metric_code:t,unit:i!=null&&i.unit?String(i.unit):null,aggregation:s,stable_tolerance:n===null?e.defaultStableTolerance:Math.max(0,n)}}function Ke(i,e){var s;const a=[...i].sort((n,r)=>n.timestamp-r.timestamp),t=a.map(n=>n.value);return e==="SUM"?t.reduce((n,r)=>n+r,0):e==="MIN"?Math.min(...t):e==="MAX"?Math.max(...t):e==="LAST"?((s=a.at(-1))==null?void 0:s.value)??null:t.reduce((n,r)=>n+r,0)/t.length}function Xe(i,e,a){var x,S;if(i.length<a)return{status:"INSUFFICIENT_DATA",sample_size:i.length,minimum_sample_size:a,slope_per_week:null,direction:null,first_value:((x=i[0])==null?void 0:x.value)??null,last_value:((S=i.at(-1))==null?void 0:S.value)??null,absolute_change:null,relative_change_pct:null};const t=i.length,s=M(i[0].bucket_start,"bucket_start").getTime(),n=i.map(l=>(M(l.bucket_start,"bucket_start").getTime()-s)/ce),r=n.reduce((l,y)=>l+y,0)/t,o=i.reduce((l,y)=>l+y.value,0)/t;let c=0,d=0;i.forEach((l,y)=>{c+=(n[y]-r)*(l.value-o),d+=(n[y]-r)**2});const p=d?c/d:0,u=i[0].value,_=i.at(-1).value,v=_-u,g=e.stable_tolerance;return{status:"READY",sample_size:t,minimum_sample_size:a,slope_per_week:H(p),direction:Math.abs(p)<=g?"STABLE":p>0?"UP":"DOWN",first_value:u,last_value:_,absolute_change:H(v),relative_change_pct:u===0?null:H(v/Math.abs(u)*100,2)}}function Je(i){const e=i.length,a=i.reduce((o,c)=>o+c.left,0)/e,t=i.reduce((o,c)=>o+c.right,0)/e;let s=0,n=0,r=0;return i.forEach(o=>{const c=o.left-a,d=o.right-t;s+=c*d,n+=c**2,r+=d**2}),n===0||r===0?null:s/Math.sqrt(n*r)}function Ze(i){const e=Math.abs(i);return e<.3?"WEAK":e<.5?"MODERATE":"STRONG"}class Qe{static calculate({playerId:e,teamSeasonId:a,period:t,observations:s=[],metricDefinitions:n=[],associationDefinitions:r=[],eligibilityPeriods:o=[],config:c=Z}={}){const d=V(e,"playerId"),p=V(a,"teamSeasonId"),u=M(t==null?void 0:t.from,"period.from"),_=M(t==null?void 0:t.to,"period.to");if(_.setUTCHours(23,59,59,999),_<u)throw new Error("LongitudinalAnalyticsCalculator: period.to no puede ser anterior a period.from.");const v=He(o,u,_),g=Array.isArray(o)&&o.length>0,x=n.map(h=>We(h,c)),S=new Map(x.map(h=>[h.key,h])),l=new Map(x.map(h=>[h.key,new Map]));let y=0;(Array.isArray(s)?s:[]).forEach(h=>{if(String((h==null?void 0:h.player_id)||"")!==d||String((h==null?void 0:h.team_season_id)||"")!==p)return;const N=S.get(we(h==null?void 0:h.module,h==null?void 0:h.metric_code));if(!N)return;const O=xe(h==null?void 0:h.value),w=Date.parse((h==null?void 0:h.occurred_at)||"");if(O===null||Number.isNaN(w)){y+=1;return}if(w<u.getTime()||w>_.getTime()||g&&!v.some(Q=>w>=Q.from_timestamp&&w<=Q.to_timestamp))return;const P=C(ie(new Date(w))),G=l.get(N.key);G.has(P)||G.set(P,[]),G.get(P).push({value:O,timestamp:w})});const f=new Set;(g?v:[{from:C(u),to:C(_),from_timestamp:u.getTime(),to_timestamp:_.getTime()}]).forEach(h=>{let N=ie(new Date(h.from_timestamp));const O=ie(new Date(h.to_timestamp));for(;N.getTime()<=O.getTime();)f.add(C(N)),N=new Date(N.getTime()+ce)});const $=f.size,L=x.map(h=>{const O=[...l.get(h.key).entries()].sort(([w],[P])=>w.localeCompare(P)).map(([w,P])=>({bucket_start:w,bucket_end:re(w,1),value:H(Ke(P,h.aggregation)),observation_count:P.length}));return{...h,points:O,coverage:{expected_buckets:$,observed_buckets:O.length,coverage_pct:$?H(O.length/$*100,2):0},trend:Xe(O,h,c.minimumTrendBuckets)}}),le=new Map(L.map(h=>[h.key,h])),Le=r.map(h=>{const N=V(h==null?void 0:h.left,"associationDefinitions.left"),O=V(h==null?void 0:h.right,"associationDefinitions.right"),w=Math.max(0,Math.trunc(Number(h==null?void 0:h.lag_buckets)||0)),P=le.get(N),G=le.get(O);if(!P||!G)throw new Error("LongitudinalAnalyticsCalculator: asociación referencia una serie inexistente.");const Q=new Map(G.points.map(R=>[R.bucket_start,R.value])),D=P.points.map(R=>({bucket_start:R.bucket_start,outcome_bucket_start:re(R.bucket_start,w),left:R.value,right:Q.get(re(R.bucket_start,w))})).filter(R=>Number.isFinite(R.right));if(D.length<c.minimumAssociationPairs)return{left:N,right:O,lag_buckets:w,status:"INSUFFICIENT_DATA",sample_size:D.length,minimum_sample_size:c.minimumAssociationPairs,coefficient:null,direction:null,strength:null,pairs:D};const W=Je(D);return W===null?{left:N,right:O,lag_buckets:w,status:"NO_VARIANCE",sample_size:D.length,minimum_sample_size:c.minimumAssociationPairs,coefficient:null,direction:null,strength:null,pairs:D}:{left:N,right:O,lag_buckets:w,status:"READY",sample_size:D.length,minimum_sample_size:c.minimumAssociationPairs,coefficient:H(W,4),direction:W>0?"POSITIVE":W<0?"NEGATIVE":"NONE",strength:Ze(W),pairs:D}});return Ie({contract_version:c.contractVersion,calculation_version:c.calculationVersion,player_id:d,team_season_id:p,period:{from:C(u),to:C(_)},bucket_unit:c.bucketUnit,eligibility_periods:v.map(h=>({from:h.from,to:h.to})),expected_buckets:$,rejected_observations:y,series:L,associations:Le,limitations:["Las asociaciones son descriptivas y no demuestran causalidad.","Los resultados dependen de la cobertura, calidad y regularidad de los datos de origen."]})}}const et=new Set(Object.values(Pe)),tt=new Set(Object.values(B)),at=new Set(Object.values(q));function F(i,e){const a=String(i??"").trim();if(!a)throw new Error(`Player360Observation: ${e} es obligatorio.`);return a}function te(i){return i==null||i===""?null:String(i)}function ue(i,e,a){if(i==null||i==="")return e;const t=Number(i);if(!Number.isFinite(t)||t<0||t>1)throw new Error(`Player360Observation: ${a} debe estar entre 0 y 1.`);return t}function Te(i){const e=F(i,"occurred_at"),a=Date.parse(e);if(Number.isNaN(a))throw new Error("Player360Observation: occurred_at debe ser una fecha ISO válida.");return new Date(a).toISOString()}function Oe(i={}){var r;const e=F(i.module,"module").toLowerCase();if(!et.has(e))throw new Error(`Player360Observation: módulo no soportado (${e}).`);const a=F(i.source_type,"source_type").toUpperCase();if(!tt.has(a))throw new Error(`Player360Observation: source_type no soportado (${a}).`);const t=String(i.sensitivity||((r=J.modules[e])==null?void 0:r.sensitivity)||q.STANDARD).toUpperCase();if(!at.has(t))throw new Error(`Player360Observation: sensitivity no soportada (${t}).`);const s=F(i.metric_code,"metric_code").toUpperCase(),n=F(i.player_id,"player_id");return Object.freeze({contract_version:J.contractVersion,module:e,player_id:n,team_season_id:te(i.team_season_id),occurred_at:Te(i.occurred_at),source_type:a,source_id:te(i.source_id),metric_code:s,value:i.value??null,unit:i.unit?String(i.unit):null,quality:ue(i.quality,J.coverage.qualityDefault,"quality"),confidence:ue(i.confidence,null,"confidence"),sensitivity:t,captured_by:te(i.captured_by),provenance:i.provenance&&typeof i.provenance=="object"?{...i.provenance}:{},metadata:i.metadata&&typeof i.metadata=="object"?{...i.metadata}:{}})}function it({playerId:i,teamSeasonId:e=null,period:a=null,facts:t=[],missingData:s=[],limitations:n=[],calculationVersion:r=null,generatedAt:o=new Date().toISOString()}={}){const c=F(i,"playerId");return Object.freeze({evidence_version:J.insightEvidenceVersion,player_id:c,team_season_id:te(e),period:a&&typeof a=="object"?{...a}:null,facts:Array.isArray(t)?t.map(d=>({...d})):[],missing_data:Array.isArray(s)?[...s]:[],limitations:Array.isArray(n)?[...n]:[],calculation_version:r?String(r):null,generated_at:Te(o)})}class rt{static build({snapshot:e,coverage:a=null,generatedAt:t}={}){if(!(e!=null&&e.player_id)||!(e!=null&&e.team_season_id))throw new Error("LongitudinalEvidenceAssembler: snapshot longitudinal incompleto.");const s=[],n=[];return(e.series||[]).forEach(r=>{var o,c,d,p,u;((o=r.trend)==null?void 0:o.status)==="READY"?s.push({fact_type:"LONGITUDINAL_TREND",metric_key:r.key,unit:r.unit,aggregation:r.aggregation,sample_size:r.trend.sample_size,direction:r.trend.direction,slope_per_week:r.trend.slope_per_week,first_value:r.trend.first_value,last_value:r.trend.last_value,absolute_change:r.trend.absolute_change,relative_change_pct:r.trend.relative_change_pct,coverage_pct:((c=r.coverage)==null?void 0:c.coverage_pct)??null}):n.push({evidence_type:"LONGITUDINAL_TREND",metric_key:r.key,observed_buckets:((d=r.trend)==null?void 0:d.sample_size)||0,minimum_buckets:((p=r.trend)==null?void 0:p.minimum_sample_size)||null,reason:((u=r.trend)==null?void 0:u.status)||"NO_DATA"})}),(e.associations||[]).forEach(r=>{r.status==="READY"?s.push({fact_type:"DESCRIPTIVE_ASSOCIATION",left_metric_key:r.left,right_metric_key:r.right,lag_buckets:r.lag_buckets,sample_size:r.sample_size,coefficient:r.coefficient,direction:r.direction,strength:r.strength,causal_claim_allowed:!1}):n.push({evidence_type:"DESCRIPTIVE_ASSOCIATION",left_metric_key:r.left,right_metric_key:r.right,observed_pairs:r.sample_size,minimum_pairs:r.minimum_sample_size,reason:r.status})}),a&&s.push({fact_type:"DATA_COVERAGE",...a}),it({playerId:e.player_id,teamSeasonId:e.team_season_id,period:e.period,facts:s,missingData:n,limitations:[...e.limitations||[],"La IA solo puede redactar e interpretar los hechos incluidos; no puede sustituir sus cálculos."],calculationVersion:e.calculation_version,generatedAt:t})}}function Ne(i){if(i==null||i===""||typeof i=="boolean")return null;const e=Number(i);return Number.isFinite(e)?e:null}function ee(i,e="12:00:00.000Z"){const a=String(i||"").trim();if(!a)return null;const t=Date.parse(a.length===10?`${a}T${e}`:a);return Number.isNaN(t)?null:new Date(t).toISOString()}function me(i,e){const a=String(i||e||"").toUpperCase();return Object.values(B).includes(a)?a:e}function se({target:i,source:e,sourceId:a,occurredAt:t,playerId:s,teamSeasonId:n,module:r,sourceType:o,sensitivity:c,mappings:d,provenance:p={}}){t&&(d||[]).forEach(u=>{const _=Ne(e==null?void 0:e[u.source_field]);_!==null&&i.push(Oe({module:r,player_id:s,team_season_id:n,occurred_at:t,source_type:o,source_id:a,metric_code:u.metric_code,value:_,unit:u.unit,quality:1,sensitivity:c,provenance:p}))})}function st(i=[]){const e=new Map;return i.forEach(a=>{const t=`${String(a.module).toLowerCase()}.${String(a.metric_code).toUpperCase()}`;e.has(t)||e.set(t,a)}),[...e.values()]}class nt{static assemble({playerId:e,teamSeasonId:a,eligibleGames:t=[],playerGameStats:s=[],trainingSessions:n=[],externalSessions:r=[],evaluations:o=[],evaluationMetrics:c=[]}={}){if(!e||!a)throw new Error("Player360ObservationAssembler: playerId y teamSeasonId son obligatorios.");const d=[],p=[],u={};Object.entries(X).forEach(([l,y])=>{y.forEach(f=>{p.push({module:l,metric_code:f.metric_code,unit:f.unit,aggregation:f.aggregation}),u[`${l}.${f.metric_code}`]=f.label})});const _=new Map((t||[]).filter(l=>l==null?void 0:l.id).map(l=>[String(l.id),l]));(s||[]).filter(l=>String((l==null?void 0:l.player_id)||(l==null?void 0:l.playerId)||"")===String(e)).forEach(l=>{const y=String((l==null?void 0:l.game_id)||(l==null?void 0:l.gameId)||""),f=_.get(y);f&&se({target:d,source:l,sourceId:y,occurredAt:ee(f.date),playerId:e,teamSeasonId:a,module:"competition",sourceType:B.GAME_SYSTEM,sensitivity:q.STANDARD,mappings:X.competition,provenance:{source_table:"player_game_stats",game_id:y}})}),(n||[]).forEach(l=>{const y=((l==null?void 0:l.participants)||[]).find(f=>String((f==null?void 0:f.player_id)||(f==null?void 0:f.playerId)||"")===String(e));y&&se({target:d,source:y,sourceId:l.id,occurredAt:ee(l.session_date),playerId:e,teamSeasonId:a,module:"training",sourceType:B.CLUB_COACH,sensitivity:q.STANDARD,mappings:X.training,provenance:{source_table:"training_participants",training_session_id:l.id,attendance_status:y.attendance_status||null}})}),(r||[]).filter(l=>String((l==null?void 0:l.player_id)||(l==null?void 0:l.playerId)||"")===String(e)).forEach(l=>{se({target:d,source:l,sourceId:l.id,occurredAt:ee(l.activity_date),playerId:e,teamSeasonId:a,module:"external_development",sourceType:me(l.source_type,B.EXTERNAL_COACH),sensitivity:q.PRIVATE_SPORTING,mappings:X.external_development,provenance:{source_table:"external_development_sessions",provider_type:l.provider_type||null}})});const v=new Map((c||[]).map(l=>[String((l==null?void 0:l.code)||(l==null?void 0:l.metric_code)||"").toUpperCase(),l]));(o||[]).forEach(l=>{const y=ee(l.evaluation_date);y&&(l.scores||[]).forEach(f=>{const E=String((f==null?void 0:f.metric_code)||(f==null?void 0:f.code)||"").toUpperCase(),$=Ne(f==null?void 0:f.score);if(!E||$===null)return;const L=v.get(E);p.push({module:"evaluation",metric_code:E,unit:"SCORE_0_10",aggregation:"LAST"}),u[`evaluation.${E}`]=(L==null?void 0:L.name)||f.metric_name||E,d.push(Oe({module:"evaluation",player_id:e,team_season_id:a,occurred_at:y,source_type:me(l.source_type,B.CLUB_COACH),source_id:l.id,metric_code:E,value:$,unit:"SCORE_0_10",quality:1,sensitivity:String((L==null?void 0:L.sensitivity)||q.PRIVATE_SPORTING).toUpperCase(),provenance:{source_table:"player_evaluation_scores",evaluation_id:l.id,domain_code:f.domain_code||(L==null?void 0:L.domain_code)||null}}))})});const g=st(p),x=new Set(g.map(l=>`${l.module}.${l.metric_code}`)),S=Ae.filter(l=>x.has(l.left)&&x.has(l.right)).map(({left:l,right:y,lag_buckets:f})=>({left:l,right:y,lag_buckets:f}));return Object.freeze({observations:Object.freeze(d),metricDefinitions:Object.freeze(g),metricLabels:Object.freeze({...u}),associationDefinitions:Object.freeze(S)})}}function ge(i){const e=String(i||"").trim();if(!e)return null;const a=Date.parse(e.length===10?`${e}T00:00:00.000Z`:e);return Number.isNaN(a)?null:new Date(a).toISOString().slice(0,10)}function oe(i){return Array.isArray(i)?i.map(oe):!i||typeof i!="object"?i:Object.keys(i).sort().reduce((e,a)=>(e[a]=oe(i[a]),e),{})}async function ot(i){var t;if(!((t=globalThis.crypto)!=null&&t.subtle)||typeof TextEncoder>"u")throw new Error("LongitudinalAnalyticsOrchestrator: Web Crypto no disponible.");const e=new TextEncoder().encode(i),a=await globalThis.crypto.subtle.digest("SHA-256",e);return[...new Uint8Array(a)].map(s=>s.toString(16).padStart(2,"0")).join("")}function ct(i){const e=Array.isArray(i==null?void 0:i.series)?i.series:[];if(!e.length)return{status:"NO_DATA",coverage_pct:0,series_total:0,series_with_data:0};const a=Math.round(e.reduce((n,r)=>{var o;return n+(Number((o=r==null?void 0:r.coverage)==null?void 0:o.coverage_pct)||0)},0)/e.length*100)/100,t=J.coverage.thresholds;return{status:a<=t.NONE_MAX?"NO_DATA":a<=t.LOW_MAX?"LOW":a<=t.PARTIAL_MAX?"PARTIAL":a<=t.GOOD_MAX?"GOOD":"COMPLETE",coverage_pct:a,series_total:e.length,series_with_data:e.filter(n=>((n==null?void 0:n.points)||[]).length>0).length}}function he(i={}){return[i.module,i.metric_code,i.occurred_at,i.source_type,i.source_id,String(i.value)].join("|")}function _e(i={}){return[i.module,i.metric_code,i.aggregation,i.unit].join("|")}class lt{constructor({dataStore:e,trainingService:a,evaluationService:t,analyticsService:s}={}){this.dataStore=e,this.trainingService=a,this.evaluationService=t,this.analyticsService=s}_assertDependencies(){if(!this.dataStore||!this.trainingService||!this.evaluationService||!this.analyticsService)throw new Error("LongitudinalAnalyticsOrchestrator: dependencias incompletas.")}_eligibilityPeriods(e,a){var s,n;const t=(((n=(s=this.dataStore).getSeasonParticipantPlayers)==null?void 0:n.call(s,e))||[]).find(r=>String((r==null?void 0:r.id)||"")===String(a));return((t==null?void 0:t.roster_stints)||(t==null?void 0:t.rosterStints)||[]).map(r=>({from:ge((r==null?void 0:r.valid_from)||(r==null?void 0:r.validFrom)),to:ge((r==null?void 0:r.valid_until)||(r==null?void 0:r.validUntil))})).filter(r=>r.from)}async loadSourceBundle({teamId:e,teamSeasonId:a,playerId:t,periodStart:s,periodEnd:n}={}){var v,g,x,S;if(this._assertDependencies(),!e||!a||!t||!s||!n)throw new Error("LongitudinalAnalyticsOrchestrator: contexto y periodo son obligatorios.");const r=((g=(v=this.dataStore).getEligibleGamesForPlayer)==null?void 0:g.call(v,t,e))||[],o=new Set(r.map(l=>String(l.id))),c=(((S=(x=this.dataStore).getPlayerGameStats)==null?void 0:S.call(x,t))||[]).filter(l=>o.has(String((l==null?void 0:l.game_id)||(l==null?void 0:l.gameId)||""))),[d,p,u,_]=await Promise.all([this.trainingService.listSessions({teamSeasonId:a,fromDate:s,toDate:n,includeArchived:!1,limit:500}),this.trainingService.listExternalDevelopment({teamSeasonId:a,playerId:t,fromDate:s,toDate:n,limit:500}),this.evaluationService.listEvaluations({teamSeasonId:a,playerId:t,includeHistory:!1,includeArchived:!1,limit:500}),this.evaluationService.listMetrics({teamSeasonId:a})]);return{eligibleGames:r,playerGameStats:c,trainingSessions:d,externalSessions:p,evaluations:u,evaluationMetrics:_,eligibilityPeriods:this._eligibilityPeriods(e,t)}}async buildSnapshotCandidate({teamId:e,teamSeasonId:a,playerId:t,periodStart:s,periodEnd:n}={}){const r=await this.loadSourceBundle({teamId:e,teamSeasonId:a,playerId:t,periodStart:s,periodEnd:n}),o=nt.assemble({playerId:t,teamSeasonId:a,eligibleGames:r.eligibleGames,playerGameStats:r.playerGameStats,trainingSessions:r.trainingSessions,externalSessions:r.externalSessions,evaluations:r.evaluations,evaluationMetrics:r.evaluationMetrics});if(!o.observations.length)throw new Error("No hay observaciones Player 360 disponibles para el periodo seleccionado.");const c=[...o.observations].sort((S,l)=>he(S).localeCompare(he(l))),d=[...o.metricDefinitions].sort((S,l)=>_e(S).localeCompare(_e(l))),p=[...o.associationDefinitions].sort((S,l)=>`${S.left}|${S.right}|${S.lag_buckets}`.localeCompare(`${l.left}|${l.right}|${l.lag_buckets}`)),u=Qe.calculate({playerId:t,teamSeasonId:a,period:{from:s,to:n},observations:c,metricDefinitions:d,associationDefinitions:p,eligibilityPeriods:r.eligibilityPeriods}),_=ct(u),v=rt.build({snapshot:u,coverage:_}),g=oe({contract_version:u.contract_version,calculation_version:u.calculation_version,player_id:t,team_season_id:a,period:u.period,eligibility_periods:u.eligibility_periods,observations:c,metric_definitions:d,association_definitions:p}),x=`sha256:${await ot(JSON.stringify(g))}`;return Object.freeze({snapshot:u,evidenceBundle:v,sourceFingerprint:x,metricLabels:o.metricLabels,sourceCounts:Object.freeze({competition_games:r.eligibleGames.length,competition_stat_rows:r.playerGameStats.length,training_sessions:r.trainingSessions.length,external_sessions:r.externalSessions.length,evaluations:r.evaluations.length,observations:c.length})})}async generateAndSaveSnapshot(e={}){const a=await this.buildSnapshotCandidate(e),t=await this.analyticsService.saveSnapshot({teamSeasonId:e.teamSeasonId,playerId:e.playerId,periodStart:e.periodStart,periodEnd:e.periodEnd,calculationVersion:Z.calculationVersion,sourceRevision:null,sourceFingerprint:a.sourceFingerprint,snapshot:a.snapshot,evidenceBundle:a.evidenceBundle,rejectedObservations:a.snapshot.rejected_observations});return Object.freeze({...a,snapshotId:t})}}function b(i=""){return String(i??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function j(i,e=1){const a=Number(i);return Number.isFinite(a)?a.toLocaleString(void 0,{maximumFractionDigits:e,minimumFractionDigits:0}):"—"}function dt(i){const e=String(i||"").toUpperCase();return e==="UP"?"↗ Tendencia ascendente":e==="DOWN"?"↘ Tendencia descendente":e==="STABLE"?"→ Tendencia estable":"Datos insuficientes"}function fe(i){const e=String(i||"").toUpperCase();return{DRAFT:"Borrador",APPROVED:"Aprobado",REJECTED:"Rechazado",ARCHIVED:"Archivado",READY:"Disponible",INSUFFICIENT_DATA:"Datos insuficientes",NO_VARIANCE:"Sin variación"}[e]||e||"—"}function ve(i){return Array.isArray(i)?'<ul class="p360d-list">'+i.map(e=>"<li>"+b(typeof e=="object"?JSON.stringify(e):e)+"</li>").join("")+"</ul>":i&&typeof i=="object"?'<pre class="p360d-pre">'+b(JSON.stringify(i,null,2))+"</pre>":"<p>"+b(i??"")+"</p>"}class pt{constructor({analyticsService:e,orchestrator:a,aiGatewayService:t,can:s}={}){this.analyticsService=e,this.orchestrator=a,this.aiGatewayService=t,this.can=typeof s=="function"?s:()=>!1,this.context=null,this.capabilities=null,this.snapshots=[],this.insights=[],this.selectedSnapshotId=null,this.lastError=null}_can(e){return!!this.can(e)}_selectedSnapshot(){return this.snapshots.find(e=>String((e==null?void 0:e.id)||"")===String(this.selectedSnapshotId||""))||this.snapshots[0]||null}_metricLabel(e){var t;const a=String(e||"");for(const[s,n]of Object.entries(X)){const r=n.find(o=>a===s+"."+o.metric_code);if(r)return r.label}if(a.startsWith("evaluation.")){const s=a.split(".")[1]||"",n=(((t=this.context)==null?void 0:t.evaluationMetrics)||[]).find(r=>String((r==null?void 0:r.code)||(r==null?void 0:r.metric_code)||"").toUpperCase()===s.toUpperCase());return(n==null?void 0:n.name)||s}return a||"Métrica"}_associationLabel(e={}){const a=Ae.find(t=>t.left===e.left&&t.right===e.right&&Number(t.lag_buckets||0)===Number(e.lag_buckets||0));return(a==null?void 0:a.label)||this._metricLabel(e.left)+" ↔ "+this._metricLabel(e.right)}async load(e={}){var s,n,r;this.context={...e},this.lastError=null,this.snapshots=[],this.insights=[];const a=this._can(A.VIEW_LONGITUDINAL_ANALYTICS),t=this._can(A.VIEW_AI_INSIGHTS);if(!a&&!t||!((s=this.analyticsService)!=null&&s.supabase)){this.capabilities=null;return}try{if(this.capabilities=await this.analyticsService.getCapabilities({force:!0}),!((n=this.capabilities)!=null&&n.ready))return;a&&(this.snapshots=await this.analyticsService.listSnapshots({teamSeasonId:e.teamSeasonId,playerId:e.playerId,limit:50})),this.selectedSnapshotId&&!this.snapshots.some(o=>String(o.id)===String(this.selectedSnapshotId))&&(this.selectedSnapshotId=null),this.selectedSnapshotId=this.selectedSnapshotId||((r=this.snapshots[0])==null?void 0:r.id)||null,t&&this.selectedSnapshotId&&(this.insights=await this.analyticsService.listInsights({snapshotId:this.selectedSnapshotId,limit:50}))}catch(o){console.error("[LongitudinalAnalyticsPanel] Error cargando analítica:",o),this.lastError=o}}isAvailable(){var e;return!!((e=this.capabilities)!=null&&e.ready&&(this._can(A.VIEW_LONGITUDINAL_ANALYTICS)||this._can(A.VIEW_AI_INSIGHTS)))}_renderStyles(){return"<style>.p360d-panel{display:grid;gap:14px;min-width:0}.p360d-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;min-width:0}.p360d-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.p360d-head h2,.p360d-head h3{margin:0}.p360d-head p{margin:4px 0 0;color:#64748b;font-size:12px;line-height:1.5}.p360d-period{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}.p360d-period label{display:grid;gap:5px;font-size:11px;font-weight:800;color:#475569}.p360d-period input,.p360d-select,.p360d-review-notes{width:100%;min-height:44px;border:1px solid #cbd5e1;border-radius:9px;padding:9px 10px;background:#fff;color:#0f172a;font:inherit}.p360d-primary,.p360d-secondary{min-height:44px;border-radius:9px;padding:9px 13px;font-weight:800;cursor:pointer}.p360d-primary{background:#1e3a8a;color:#fff;border:1px solid #1e3a8a}.p360d-secondary{background:#fff;color:#334155;border:1px solid #cbd5e1}.p360d-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.p360d-kpi{border:1px solid #e2e8f0;border-radius:10px;padding:11px;background:#f8fafc;display:grid;gap:3px}.p360d-kpi span{font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase}.p360d-kpi strong{font-size:18px}.p360d-series{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.p360d-series-card{border:1px solid #e2e8f0;border-radius:11px;padding:11px;display:grid;gap:7px;min-width:0}.p360d-series-card h4{margin:0;font-size:13px}.p360d-series-meta{display:flex;gap:7px;flex-wrap:wrap;font-size:10px;color:#64748b;font-weight:800}.p360d-trend{font-size:12px;font-weight:900;color:#1e3a8a}.p360d-associations,.p360d-insights{display:grid;gap:8px}.p360d-association,.p360d-insight{border:1px solid #e2e8f0;border-radius:11px;padding:11px;display:grid;gap:8px}.p360d-badge{display:inline-flex;width:fit-content;border-radius:999px;padding:4px 8px;background:#f1f5f9;color:#475569;font-size:10px;font-weight:900}.p360d-badge-approved{background:#dcfce7;color:#166534}.p360d-badge-rejected{background:#fee2e2;color:#991b1b}.p360d-badge-draft{background:#fef3c7;color:#92400e}.p360d-content{display:grid;gap:8px}.p360d-content h5{margin:0;font-size:11px;text-transform:uppercase;color:#64748b}.p360d-content p{margin:0;font-size:12px;line-height:1.5;color:#334155}.p360d-list{margin:0;padding-left:20px;color:#334155;font-size:12px;line-height:1.5}.p360d-pre{margin:0;max-width:100%;overflow:auto;white-space:pre-wrap;font-size:11px;background:#f8fafc;border-radius:8px;padding:9px}.p360d-review{display:grid;gap:8px;border-top:1px solid #f1f5f9;padding-top:8px}.p360d-review-actions{display:flex;gap:8px;flex-wrap:wrap}.p360d-note,.p360d-empty,.p360d-error{border-radius:10px;padding:12px;font-size:12px;line-height:1.5}.p360d-note{background:#f0f9ff;border:1px solid #bae6fd;color:#0c4a6e}.p360d-empty{background:#f8fafc;border:1px dashed #cbd5e1;color:#64748b;text-align:center}.p360d-error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}@media(max-width:900px){.p360d-series{grid-template-columns:repeat(2,minmax(0,1fr))}.p360d-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.p360d-period{grid-template-columns:1fr}.p360d-period button{width:100%}.p360d-series{grid-template-columns:1fr}.p360d-head{display:grid}.p360d-review-actions{display:grid}.p360d-review-actions button{width:100%}}</style>"}_renderSnapshotSelector(){return this.snapshots.length?'<label style="display:grid;gap:5px;font-size:11px;font-weight:800;color:#475569;"><span>Snapshot analítico</span><select id="p360d-snapshot-select" class="p360d-select">'+this.snapshots.map(e=>{const a=String(e.id)===String(this.selectedSnapshotId)?" selected":"";return'<option value="'+b(e.id)+'"'+a+">"+b(String(e.period_start||"")+" → "+String(e.period_end||""))+"</option>"}).join("")+"</select></label>":""}_renderSeries(e){const a=Array.isArray(e==null?void 0:e.series)?e.series:[];return a.length?'<div class="p360d-series">'+a.map(t=>{const s=t.trend||{},n=t.coverage||{},r=Number.isFinite(Number(s.relative_change_pct))?j(s.relative_change_pct,1)+"%":"—";return'<article class="p360d-series-card"><h4>'+b(this._metricLabel(t.key))+'</h4><div class="p360d-series-meta"><span>'+b(t.module||"")+"</span><span>Cobertura "+j(n.coverage_pct,1)+"%</span><span>n="+j(s.sample_size,0)+'</span></div><div class="p360d-trend">'+b(dt(s.direction))+'</div><div class="p360d-series-meta"><span>'+j(s.first_value,1)+" → "+j(s.last_value,1)+"</span><span>Δ "+b(r)+"</span></div></article>"}).join("")+"</div>":'<div class="p360d-empty">El snapshot no contiene series longitudinales.</div>'}_renderAssociations(e){const a=Array.isArray(e==null?void 0:e.associations)?e.associations:[];return a.length?'<div class="p360d-card"><div class="p360d-head"><div><h3>Patrones descriptivos</h3><p>Asociaciones temporales. Nunca se presentan como causalidad.</p></div></div><div class="p360d-associations">'+a.map(t=>{const s=String(t.status).toUpperCase()==="READY";return'<article class="p360d-association"><strong>'+b(this._associationLabel(t))+'</strong><div class="p360d-series-meta"><span>'+b(fe(t.status))+"</span><span>lag "+j(t.lag_buckets,0)+" semana(s)</span><span>n="+j(t.sample_size,0)+"</span>"+(s?"<span>r="+j(t.coefficient,2)+"</span>":"")+'</div><div class="p360d-note">Relación descriptiva: no demuestra causalidad ni permite atribuir causa y efecto.</div></article>'}).join("")+"</div></div>":""}_renderInsightContent(e={}){const a=[["summary","Resumen"],["interpretation","Interpretación"],["priorities","Prioridades"],["recommendations","Recomendaciones"],["action_plan","Plan de acción"]].filter(([t])=>(e==null?void 0:e[t])!==void 0&&(e==null?void 0:e[t])!==null);return a.length?'<div class="p360d-content">'+a.map(([t,s])=>"<section><h5>"+s+"</h5>"+ve(e[t])+"</section>").join("")+"</div>":'<div class="p360d-content">'+ve(e)+"</div>"}_renderInsights(){var r,o;if(!this._can(A.VIEW_AI_INSIGHTS))return"";const e=this._can(A.REVIEW_AI_INSIGHTS),a=this.insights.length?'<div class="p360d-insights">'+this.insights.map(c=>{const d=String(c.status||"DRAFT").toUpperCase(),p=e&&d==="DRAFT"?'<div class="p360d-review"><textarea class="p360d-review-notes" rows="2" placeholder="Nota de revisión opcional"></textarea><div class="p360d-review-actions"><button type="button" class="p360d-primary p360d-review-insight" data-insight-id="'+b(c.id)+'" data-review-status="APPROVED">Aprobar</button><button type="button" class="p360d-secondary p360d-review-insight" data-insight-id="'+b(c.id)+'" data-review-status="REJECTED">Rechazar</button></div></div>':"";return'<article class="p360d-insight"><div class="p360d-head"><div><strong>'+b(c.audience||"STAFF")+'</strong><div class="p360d-series-meta"><span>'+b(c.provider||"")+"</span><span>"+b(c.model_name||"")+"</span><span>"+b(c.prompt_version||"")+'</span></div></div><span class="p360d-badge p360d-badge-'+b(d.toLowerCase())+'">'+b(fe(d))+"</span></div>"+this._renderInsightContent(c.content||{})+p+"</article>"}).join("")+"</div>":'<div class="p360d-empty">Todavía no hay interpretaciones IA guardadas para este snapshot.</div>',t=this._can(A.GENERATE_AI_INSIGHTS),s=!!(ze.generationEnabled&&((o=(r=this.aiGatewayService)==null?void 0:r.isEnabled)!=null&&o.call(r)));return'<div class="p360d-card"><div class="p360d-head"><div><h3>Interpretación IA</h3><p>Separada de la evidencia objetiva y sometida a revisión humana.</p></div></div>'+(t?s?'<div class="p360d-review-actions"><button type="button" id="p360d-generate-ai" class="p360d-primary">Generar interpretación IA</button></div><div class="p360d-note">La IA recibe únicamente evidencia longitudinal autorizada y guarda siempre un borrador sujeto a revisión humana.</div>':'<div class="p360d-note">La pasarela IA está preparada pero permanece desactivada hasta validar backend, secretos y cuotas. No se almacenan claves de proveedor en el navegador y el navegador nunca llama directamente al proveedor.</div>':"")+a+"</div>"}render(){var c,d,p;const e=this._selectedSnapshot(),a=(e==null?void 0:e.snapshot)||null,t=(e==null?void 0:e.evidence_bundle)||null,s=((c=this.context)==null?void 0:c.dateBounds)||{},r=this._can(A.GENERATE_LONGITUDINAL_ANALYTICS)?'<div class="p360d-card"><div class="p360d-head"><div><h3>Actualizar evidencia longitudinal</h3><p>Recalcula con datos reales y respeta altas/bajas de plantilla por stint.</p></div></div><form id="p360d-generate-form" class="p360d-period"><label><span>Desde</span><input id="p360d-period-from" type="date" value="'+b(s.min||"")+'"'+(s.min?' min="'+b(s.min)+'"':"")+(s.max?' max="'+b(s.max)+'"':"")+' required /></label><label><span>Hasta</span><input id="p360d-period-to" type="date" value="'+b(s.max||"")+'"'+(s.min?' min="'+b(s.min)+'"':"")+(s.max?' max="'+b(s.max)+'"':"")+' required /></label><button type="submit" class="p360d-primary">Generar snapshot</button></form></div>':"",o=e?'<div class="p360d-card"><div class="p360d-head"><div><h2>Evolución longitudinal</h2><p>Datos deterministas; una tendencia ascendente o descendente no implica por sí misma mejora o empeoramiento.</p></div>'+this._renderSnapshotSelector()+'</div><div class="p360d-summary"><div class="p360d-kpi"><span>Periodo</span><strong>'+b(String(e.period_start||"")+" → "+String(e.period_end||""))+'</strong></div><div class="p360d-kpi"><span>Semanas elegibles</span><strong>'+j(a==null?void 0:a.expected_buckets,0)+'</strong></div><div class="p360d-kpi"><span>Hechos IA</span><strong>'+j((d=t==null?void 0:t.facts)==null?void 0:d.length,0)+'</strong></div><div class="p360d-kpi"><span>Datos ausentes</span><strong>'+j((p=t==null?void 0:t.missing_data)==null?void 0:p.length,0)+'</strong></div></div><div style="height:10px"></div>'+this._renderSeries(a)+"</div>"+this._renderAssociations(a)+this._renderInsights():'<div class="p360d-empty">Todavía no existe un snapshot longitudinal para este jugador. Genera el primero para empezar a analizar evolución y cobertura.</div>';return'<section class="p360d-panel">'+this._renderStyles()+(this.lastError?'<div class="p360d-error">'+b(this.lastError.message||this.lastError)+"</div>":"")+r+o+"</section>"}async bind(e,{onChanged:a}={}){var s,n,r;const t=typeof a=="function"?a:()=>{};(s=e.querySelector("#p360d-snapshot-select"))==null||s.addEventListener("change",async o=>{this.selectedSnapshotId=o.currentTarget.value||null,await this.load(this.context),await t()}),(n=e.querySelector("#p360d-generate-form"))==null||n.addEventListener("submit",async o=>{var _,v;o.preventDefault();const c=o.currentTarget,d=c.querySelector('button[type="submit"]'),p=(_=c.querySelector("#p360d-period-from"))==null?void 0:_.value,u=(v=c.querySelector("#p360d-period-to"))==null?void 0:v.value;if(!p||!u||u<p){alert("⚠️ Revisa el periodo de análisis.");return}d.disabled=!0;try{const g=await this.orchestrator.generateAndSaveSnapshot({teamId:this.context.teamId,teamSeasonId:this.context.teamSeasonId,playerId:this.context.playerId,periodStart:p,periodEnd:u});this.selectedSnapshotId=g.snapshotId,await this.load(this.context),await t()}catch(g){console.error("[LongitudinalAnalyticsPanel] Error generando snapshot:",g),alert("❌ "+(g.message||g)),d.disabled=!1}}),(r=e.querySelector("#p360d-generate-ai"))==null||r.addEventListener("click",async o=>{const c=o.currentTarget;if(this.selectedSnapshotId&&confirm("¿Generar una interpretación IA? Esta acción puede consumir cuota de la licencia y el resultado se guardará como borrador.")){c.disabled=!0;try{await this.aiGatewayService.generateInsight({snapshotId:this.selectedSnapshotId,audience:"STAFF",locale:"es"}),await this.load(this.context),await t()}catch(d){console.error("[LongitudinalAnalyticsPanel] Error generando insight IA:",d),alert("❌ "+(d.message||d)),c.disabled=!1}}}),e.querySelectorAll(".p360d-review-insight").forEach(o=>{o.addEventListener("click",async()=>{var u;const c=o.dataset.reviewStatus,d=o.closest(".p360d-insight"),p=((u=d==null?void 0:d.querySelector(".p360d-review-notes"))==null?void 0:u.value.trim())||null;if(confirm(c==="APPROVED"?"¿Aprobar esta interpretación IA?":"¿Rechazar esta interpretación IA?")){o.disabled=!0;try{await this.analyticsService.reviewAiInsight({insightId:o.dataset.insightId,status:c,notes:p}),await this.load(this.context),await t()}catch(_){console.error("[LongitudinalAnalyticsPanel] Error revisando insight:",_),alert("❌ "+(_.message||_)),o.disabled=!1}}})})}}function be(i){return String(i??"").trim().toUpperCase()}function z(i){if(i==null||i==="")return null;const e=Number(i);return Number.isFinite(e)?e:null}class ye{static calculate({targets:e=[],evaluations:a=[]}={}){const t=new Map;return(Array.isArray(a)?a:[]).filter(s=>String((s==null?void 0:s.status)||"CURRENT").toUpperCase()==="CURRENT").sort((s,n)=>{const r=String((s==null?void 0:s.evaluation_date)||(s==null?void 0:s.evaluationDate)||""),o=String((n==null?void 0:n.evaluation_date)||(n==null?void 0:n.evaluationDate)||"");return r!==o?o.localeCompare(r):String((n==null?void 0:n.created_at)||"").localeCompare(String((s==null?void 0:s.created_at)||""))}).forEach(s=>{(Array.isArray(s==null?void 0:s.scores)?s.scores:[]).forEach(n=>{const r=be(n.metric_code||n.metricCode);!r||t.has(r)||t.set(r,{score:z(n.score),evaluationId:s.id||null,evaluationDate:s.evaluation_date||s.evaluationDate||null})})}),(Array.isArray(e)?e:[]).map(s=>{const n=be(s.metric_code||s.metricCode),r=t.get(n)||null,o=z(s.target_score??s.targetScore),c=z(r==null?void 0:r.score),d=s.higher_is_better??s.higherIsBetter??!0,p=c===null||o===null?null:d?o-c:c-o;return Object.freeze({profile_id:s.profile_id||s.profileId||null,metric_code:n,domain_code:String(s.domain_code||s.domainCode||"").toUpperCase(),metric_name:s.metric_name||s.metricName||n,current_score:c,target_score:o,gap_to_target:p,priority_weight:z(s.priority_weight??s.priorityWeight)??1,last_evaluation_date:(r==null?void 0:r.evaluationDate)||null,current_evaluation_id:(r==null?void 0:r.evaluationId)||null,data_status:c===null?"NO_EVALUATION":"AVAILABLE",gap_status:c===null?"NO_DATA":p<=0?"TARGET_MET":"GAP"})})}static classify(e={}){if(e.data_status==="NO_EVALUATION"||e.current_score===null)return"NO_DATA";const a=z(e.gap_to_target);return a===null?"NO_DATA":a<=0?"TARGET_MET":"GAP"}static summarize(e=[]){const a=Array.isArray(e)?e:[],t=a.filter(o=>this.classify(o)!=="NO_DATA"),s=t.filter(o=>this.classify(o)==="TARGET_MET"),n=t.filter(o=>this.classify(o)==="GAP"),r=n.reduce((o,c)=>{const d=Math.max(0,z(c.gap_to_target)??0),p=z(c.priority_weight)??1;return o+d*p},0);return Object.freeze({total_targets:a.length,targets_with_data:t.length,targets_without_data:a.length-t.length,targets_met:s.length,targets_pending:n.length,weighted_pending_gap:Math.round(r*1e3)/1e3})}}function m(i=""){return String(i??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function ne(i){if(i==null||i==="")return null;const e=Number(i);return Number.isFinite(e)?e:null}function Ee(i=""){return String(i||"").slice(0,10)}function ut(){const i=new Date;return[i.getFullYear(),String(i.getMonth()+1).padStart(2,"0"),String(i.getDate()).padStart(2,"0")].join("-")}function K(i,e=1){const a=Number(i);return Number.isFinite(a)?a.toLocaleString(void 0,{maximumFractionDigits:e,minimumFractionDigits:0}):"—"}function mt(i={}){return i.name||[i.first_name,i.last_name].filter(Boolean).join(" ")||[i.firstName,i.lastName].filter(Boolean).join(" ")||"Jugador"}function Se(i=[]){const e=new Map;return(Array.isArray(i)?i:[]).forEach(a=>{const t=String(a.domain_code||"OTHER").toUpperCase();e.has(t)||e.set(t,[]),e.get(t).push(a)}),e}class vt{constructor(e=null,a=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.auth=a,this.service=new ke(this.supabase),this.trainingService=new je(this.supabase),this.analyticsService=new Me(this.supabase),this.aiGatewayService=new Fe(this.supabase),this.analyticsOrchestrator=new lt({dataStore:k,trainingService:this.trainingService,evaluationService:this.service,analyticsService:this.analyticsService}),this.analyticsPanel=new pt({analyticsService:this.analyticsService,orchestrator:this.analyticsOrchestrator,aiGatewayService:this.aiGatewayService,can:t=>this._can(t)}),this.wellnessService=new Ce(this.supabase),this.wellnessPanel=new De({service:this.wellnessService,can:t=>this._can(t)}),this.containerId="dashboard-content-area",this.teamId=null,this.teamSeasonId=null,this.playerId=null,this.player=null,this.capabilities=null,this.metrics=[],this.evaluations=[],this.objectiveProfile=null,this.gaps=[],this.lastError=null,this.isLoading=!1,this.activeTab="evaluation",this.editingEvaluationId=null}_context(){return{teamId:this.teamId,teamSeasonId:this.teamSeasonId,playerId:this.playerId,playerTeamId:this.teamId}}_can(e){var a,t;return e?typeof((a=this.auth)==null?void 0:a.canPreview)=="function"?!!this.auth.canPreview(e,this._context()):typeof((t=this.auth)==null?void 0:t.can)=="function"?!!this.auth.can(e,this._context()):!1:!1}_seasonContext(){var e,a;return((a=(e=k).getActiveSeasonContext)==null?void 0:a.call(e,this.teamId))||null}_dateBounds(){const e=this._seasonContext();return{min:Ee((e==null?void 0:e.start_date)||(e==null?void 0:e.startDate)),max:Ee((e==null?void 0:e.end_date)||(e==null?void 0:e.endDate))}}_defaultDate(){const e=ut(),{min:a,max:t}=this._dateBounds();return a&&e<a?a:t&&e>t?t:e}_evaluationById(e){return this.evaluations.find(a=>String(a.id)===String(e))||null}_metricLabel(e={}){return e.name||e.metric_name||e.code||e.metric_code||"Métrica"}_domainLabel(e){const a=String(e||"OTHER").toUpperCase();return Re[a]||a}async _load(){var e;this.isLoading=!0,this.lastError=null;try{if(this.capabilities=await this.service.getCapabilities({force:!0}),!((e=this.capabilities)!=null&&e.ready)){this.metrics=[],this.evaluations=[],this.objectiveProfile=null,this.gaps=[],await this.wellnessPanel.load({teamId:this.teamId,teamSeasonId:this.teamSeasonId,playerId:this.playerId,dateBounds:this._dateBounds()});return}const a=this._can(A.VIEW_PLAYER_EVALUATION),t=this._can(A.VIEW_OBJECTIVE_PROFILE),[s,n,r]=await Promise.all([a||t?this.service.listMetrics({teamSeasonId:this.teamSeasonId}):Promise.resolve([]),a?this.service.listEvaluations({teamSeasonId:this.teamSeasonId,playerId:this.playerId,includeHistory:!1}):Promise.resolve([]),t?this.service.getActiveObjectiveProfile({teamSeasonId:this.teamSeasonId,playerId:this.playerId}):Promise.resolve(null)]);this.metrics=s,this.evaluations=n,this.objectiveProfile=r,this.gaps=r!=null&&r.id?await this.service.getObjectiveGap(r.id):[],await Promise.all([this.analyticsPanel.load({teamId:this.teamId,teamSeasonId:this.teamSeasonId,playerId:this.playerId,dateBounds:this._dateBounds(),evaluationMetrics:this.metrics}),this.wellnessPanel.load({teamId:this.teamId,teamSeasonId:this.teamSeasonId,playerId:this.playerId,dateBounds:this._dateBounds()})])}catch(a){console.error("[Player360View] Error cargando Phase 4C:",a),this.lastError=a}finally{this.isLoading=!1}}_renderStyles(){return`
      <style>
        .p360c-view {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
          color: #0f172a;
          font-family: var(--font-family-base, system-ui, -apple-system, sans-serif);
          box-sizing: border-box;
        }
        .p360c-view * { box-sizing: border-box; }
        .p360c-back {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          width: fit-content;
          color: #475569;
          text-decoration: none;
          font-weight: 700;
          font-size: 13px;
        }
        .p360c-hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          padding: 20px;
          border-radius: 16px;
          background: linear-gradient(135deg, #0f172a, #1e3a8a);
          color: white;
        }
        .p360c-hero h1 { margin: 0 0 5px; font-size: clamp(22px, 4vw, 30px); color: #ffffff !important; }
        .p360c-hero p { margin: 0; color: #dbeafe; line-height: 1.5; }
        .p360c-context {
          flex: 0 0 auto;
          border: 1px solid rgba(255,255,255,.24);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          color: #ffffff !important;
        }
        .p360c-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: thin;
        }
        .p360c-tab {
          min-height: 44px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 9px 14px;
          background: white;
          color: #475569;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }
        .p360c-tab[aria-selected="true"] {
          background: #1e3a8a;
          color: white;
          border-color: #1e3a8a;
        }
        .p360c-panel { display: grid; gap: 14px; min-width: 0; }
        .p360c-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          min-width: 0;
        }
        .p360c-section-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .p360c-section-head h2,
        .p360c-section-head h3 { margin: 0; }
        .p360c-section-head p { margin: 4px 0 0; color: #64748b; font-size: 12px; line-height: 1.5; }
        .p360c-badge {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          border-radius: 999px;
          padding: 4px 9px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }
        .p360c-badge-private { background: #fef3c7; color: #92400e; }
        .p360c-badge-current { background: #dcfce7; color: #166534; }
        .p360c-form { display: grid; gap: 14px; }
        .p360c-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .p360c-form label {
          display: grid;
          gap: 6px;
          min-width: 0;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }
        .p360c-form input,
        .p360c-form select,
        .p360c-form textarea {
          width: 100%;
          min-height: 44px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          padding: 9px 10px;
          background: white;
          color: #0f172a;
          font: inherit;
        }
        .p360c-form textarea { resize: vertical; min-height: 88px; }
        .p360c-span-2 { grid-column: 1 / -1; }
        .p360c-check {
          display: flex !important;
          grid-template-columns: none !important;
          align-items: center;
          gap: 8px !important;
          min-height: 44px;
        }
        .p360c-check input { width: 18px; min-height: 18px; }
        .p360c-domain-groups { display: grid; gap: 14px; }
        .p360c-domain {
          display: grid;
          gap: 8px;
          border-top: 1px solid #e2e8f0;
          padding-top: 12px;
        }
        .p360c-domain:first-child { border-top: 0; padding-top: 0; }
        .p360c-domain-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: #1e3a8a;
          font-weight: 900;
        }
        .p360c-metric-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .p360c-metric {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
          background: #f8fafc;
          min-width: 0;
        }
        .p360c-metric label { gap: 5px; }
        .p360c-metric small { color: #64748b; font-weight: 500; line-height: 1.4; }
        .p360c-target-row {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(90px,.6fr) minmax(90px,.6fr);
          gap: 8px;
          align-items: end;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
          background: #f8fafc;
        }
        .p360c-target-label { display: grid; gap: 3px; }
        .p360c-target-label strong { font-size: 13px; }
        .p360c-target-label span { color: #64748b; font-size: 11px; }
        .p360c-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .p360c-primary, .p360c-secondary, .p360c-danger {
          min-height: 44px;
          border-radius: 9px;
          padding: 9px 13px;
          font-weight: 800;
          cursor: pointer;
        }
        .p360c-primary { background: #1e3a8a; color: white; border: 1px solid #1e3a8a; }
        .p360c-secondary { background: white; color: #334155; border: 1px solid #cbd5e1; }
        .p360c-danger { background: #fff; color: #b91c1c; border: 1px solid #fecaca; }
        .p360c-history { display: grid; gap: 10px; }
        .p360c-eval-card { display: grid; gap: 12px; }
        .p360c-eval-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .p360c-eval-top h3 { margin: 3px 0 0; font-size: 16px; }
        .p360c-meta { color: #64748b; font-size: 11px; font-weight: 700; }
        .p360c-copy-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 8px;
        }
        .p360c-copy {
          background: #f8fafc;
          border-radius: 9px;
          padding: 10px;
          min-width: 0;
        }
        .p360c-copy span {
          display: block;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 4px;
        }
        .p360c-copy p {
          margin: 0;
          color: #334155;
          font-size: 12px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .p360c-score-list {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .p360c-score {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #1e3a8a;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
        }
        .p360c-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 8px;
        }
        .p360c-kpi {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          background: white;
          display: grid;
          gap: 3px;
        }
        .p360c-kpi span { color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .p360c-kpi strong { font-size: 20px; }
        .p360c-gap-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .p360c-gap {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 11px;
          display: grid;
          gap: 5px;
          background: white;
        }
        .p360c-gap-head { display: flex; justify-content: space-between; gap: 8px; }
        .p360c-gap-title { font-weight: 900; font-size: 13px; }
        .p360c-gap-domain { color: #64748b; font-size: 10px; font-weight: 800; }
        .p360c-gap-values { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; }
        .p360c-gap-status { font-size: 11px; font-weight: 900; }
        .p360c-gap-pending { color: #b45309; }
        .p360c-gap-met { color: #15803d; }
        .p360c-gap-missing { color: #64748b; }
        .p360c-empty, .p360c-error, .p360c-note {
          border-radius: 10px;
          padding: 13px;
          font-size: 12px;
          line-height: 1.5;
        }
        .p360c-empty { border: 1px dashed #cbd5e1; color: #64748b; background: #f8fafc; text-align: center; }
        .p360c-error { border: 1px solid #fecaca; color: #991b1b; background: #fef2f2; }
        .p360c-note { border: 1px solid #bae6fd; color: #0c4a6e; background: #f0f9ff; }
        details.p360c-card > summary {
          min-height: 44px;
          cursor: pointer;
          font-weight: 900;
          display: flex;
          align-items: center;
          list-style: none;
        }
        details.p360c-card > summary::-webkit-details-marker { display:none; }

        @media (max-width: 900px) {
          .p360c-metric-grid, .p360c-gap-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .p360c-copy-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .p360c-view { gap: 12px; }
          .p360c-hero { display: grid; padding: 16px; border-radius: 12px; }
          .p360c-context { justify-self: start; white-space: normal; }
          .p360c-form-grid { grid-template-columns: 1fr; }
          .p360c-span-2 { grid-column: auto; }
          .p360c-metric-grid, .p360c-gap-grid { grid-template-columns: 1fr; }
          .p360c-target-row { grid-template-columns: 1fr 1fr; }
          .p360c-target-label { grid-column: 1 / -1; }
          .p360c-kpis { grid-template-columns: 1fr 1fr; }
          .p360c-eval-top, .p360c-section-head { display: grid; }
          .p360c-actions { display: grid; grid-template-columns: 1fr; }
          .p360c-actions > * { width: 100%; }
        }
      </style>
    `}_renderTabs(){var a;const e=[];return this._can(A.VIEW_PLAYER_EVALUATION)&&e.push({id:"evaluation",label:"🧭 Evaluación"}),this._can(A.VIEW_OBJECTIVE_PROFILE)&&e.push({id:"objective",label:"🎯 Perfil objetivo"}),this.analyticsPanel.isAvailable()&&e.push({id:"analytics",label:"📈 Evolución + IA"}),this.wellnessPanel.isAvailable()&&e.push({id:"wellness",label:"🥤 Nutrición + recuperación"}),e.some(t=>t.id===this.activeTab)||(this.activeTab=((a=e[0])==null?void 0:a.id)||"evaluation"),`
      <div class="p360c-tabs" role="tablist" aria-label="Player 360">
        ${e.map(t=>`
          <button
            type="button"
            class="p360c-tab"
            data-p360c-tab="${t.id}"
            aria-selected="${this.activeTab===t.id}"
          >${t.label}</button>
        `).join("")}
      </div>
    `}_renderMetricInputs(e=[]){const a=new Map((e||[]).map(t=>[String(t.metric_code||"").toUpperCase(),t]));return[...Se(this.metrics).entries()].map(([t,s])=>`
      <section class="p360c-domain">
        <div class="p360c-domain-title">${m(this._domainLabel(t))}</div>
        <div class="p360c-metric-grid">
          ${s.map(n=>{var o;const r=((o=a.get(String(n.code).toUpperCase()))==null?void 0:o.score)??"";return`
              <div class="p360c-metric">
                <label>
                  <span>${m(n.name)}</span>
                  <input
                    class="p360c-eval-score"
                    data-metric-code="${m(n.code)}"
                    type="number"
                    inputmode="decimal"
                    min="${m(n.scale_min)}"
                    max="${m(n.scale_max)}"
                    step="${m(n.scale_step)}"
                    value="${m(r)}"
                    placeholder="—"
                    aria-label="${m(n.name)}"
                  />
                  <small>Escala ${m(n.scale_min)}–${m(n.scale_max)}</small>
                </label>
              </div>
            `}).join("")}
        </div>
      </section>
    `).join("")}_renderEvaluationForm(){const e=this._can(A.CREATE_PLAYER_EVALUATION),a=this._can(A.EDIT_PLAYER_EVALUATION),t=this.editingEvaluationId?this._evaluationById(this.editingEvaluationId):null;if(!t&&!e||t&&!a)return"";const{min:s,max:n}=this._dateBounds(),r=(t==null?void 0:t.evaluation_date)||this._defaultDate();return`
      <details class="p360c-card" id="p360c-evaluation-editor" ${t?"open":""}>
        <summary>
          ${t?"✏️ Crear nueva revisión de la evaluación":"＋ Nueva evaluación"}
        </summary>
        <form class="p360c-form" id="p360c-evaluation-form">
          <div class="p360c-note">
            Una edición no sobrescribe el histórico: crea una nueva revisión y conserva la anterior.
          </div>

          <div class="p360c-form-grid">
            <label>
              <span>Fecha *</span>
              <input
                id="p360c-evaluation-date"
                type="date"
                required
                min="${m(s)}"
                max="${m(n)}"
                value="${m(r)}"
              />
            </label>
            <label>
              <span>Tipo</span>
              <select id="p360c-evaluation-type">
                ${["GENERAL","TECHNICAL","TACTICAL","PHYSICAL"].map(o=>`
                  <option value="${o}" ${String((t==null?void 0:t.evaluation_type)||"GENERAL")===o?"selected":""}>
                    ${o==="GENERAL"?"General":this._domainLabel(o)}
                  </option>
                `).join("")}
              </select>
            </label>
            <label class="p360c-span-2">
              <span>Título *</span>
              <input
                id="p360c-evaluation-title"
                type="text"
                required
                maxlength="140"
                value="${m((t==null?void 0:t.title)||"")}"
                placeholder="Ej. Evaluación mensual de desarrollo"
              />
            </label>
            <label>
              <span>Procedencia</span>
              <select id="p360c-evaluation-source">
                ${[["CLUB_COACH","Entrenador del club"],["EXTERNAL_COACH","Entrenador / tecnificador externo"],["OTHER","Otra fuente"]].map(([o,c])=>`
                  <option value="${o}" ${String((t==null?void 0:t.source_type)||"CLUB_COACH")===o?"selected":""}>
                    ${c}
                  </option>
                `).join("")}
              </select>
            </label>
            <label>
              <span>Nombre del evaluador externo (opcional)</span>
              <input
                id="p360c-evaluator-name"
                type="text"
                maxlength="120"
                value="${m((t==null?void 0:t.evaluator_name)||"")}"
              />
            </label>
            <label class="p360c-span-2">
              <span>Resumen</span>
              <textarea id="p360c-evaluation-summary">${m((t==null?void 0:t.summary)||"")}</textarea>
            </label>
            <label>
              <span>Fortalezas</span>
              <textarea id="p360c-evaluation-strengths">${m((t==null?void 0:t.strengths)||"")}</textarea>
            </label>
            <label>
              <span>Prioridades de desarrollo</span>
              <textarea id="p360c-evaluation-priorities">${m((t==null?void 0:t.development_priorities)||"")}</textarea>
            </label>
            <label class="p360c-check p360c-span-2">
              <input
                id="p360c-evaluation-private"
                type="checkbox"
                ${t!=null&&t.is_private?"checked":""}
              />
              <span>Evaluación privada para roles autorizados del cuerpo técnico</span>
            </label>
          </div>

          <div class="p360c-domain-groups">
            ${this._renderMetricInputs((t==null?void 0:t.scores)||[])}
          </div>

          <div class="p360c-actions">
            ${t?`
              <button type="button" class="p360c-secondary" id="p360c-cancel-evaluation-edit">
                Cancelar revisión
              </button>
            `:""}
            <button type="submit" class="p360c-primary">
              ${t?"Guardar nueva revisión":"Guardar evaluación"}
            </button>
          </div>
        </form>
      </details>
    `}_renderEvaluationCard(e){const a=this._can(A.EDIT_PLAYER_EVALUATION),t=this._can(A.ARCHIVE_PLAYER_EVALUATION);return`
      <article class="p360c-card p360c-eval-card">
        <div class="p360c-eval-top">
          <div>
            <div class="p360c-meta">
              ${m(e.evaluation_date)} · revisión ${m(e.revision||1)}
            </div>
            <h3>${m(e.title)}</h3>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span class="p360c-badge p360c-badge-current">Actual</span>
            ${e.is_private?'<span class="p360c-badge p360c-badge-private">Privada</span>':'<span class="p360c-badge">Staff</span>'}
          </div>
        </div>

        <div class="p360c-meta">
          ${m(e.evaluation_type||"GENERAL")} ·
          ${m(e.source_type||"CLUB_COACH")}
          ${e.evaluator_name?" · "+m(e.evaluator_name):""}
        </div>

        <div class="p360c-score-list">
          ${(e.scores||[]).map(s=>`
            <span class="p360c-score">
              ${m(s.metric_name||s.metric_code)}:
              ${K(s.score,1)}
            </span>
          `).join("")||'<span class="p360c-meta">Sin puntuaciones visibles</span>'}
        </div>

        ${e.summary||e.strengths||e.development_priorities?`
          <div class="p360c-copy-grid">
            <div class="p360c-copy">
              <span>Resumen</span>
              <p>${m(e.summary||"—")}</p>
            </div>
            <div class="p360c-copy">
              <span>Fortalezas</span>
              <p>${m(e.strengths||"—")}</p>
            </div>
            <div class="p360c-copy">
              <span>Prioridades</span>
              <p>${m(e.development_priorities||"—")}</p>
            </div>
          </div>
        `:""}

        ${a||t?`
          <div class="p360c-actions">
            ${a?`
              <button
                type="button"
                class="p360c-secondary p360c-edit-evaluation"
                data-evaluation-id="${m(e.id)}"
              >✏️ Revisar</button>
            `:""}
            ${t?`
              <button
                type="button"
                class="p360c-danger p360c-archive-evaluation"
                data-evaluation-id="${m(e.id)}"
              >Archivar</button>
            `:""}
          </div>
        `:""}
      </article>
    `}_renderEvaluationPanel(){return this._can(A.VIEW_PLAYER_EVALUATION)?`
      <section class="p360c-panel" id="p360c-panel-evaluation">
        ${this._renderEvaluationForm()}

        <div class="p360c-section-head">
          <div>
            <h2>Histórico de evaluaciones</h2>
            <p>Cada fecha representa una observación humana estructurada; no sustituye las estadísticas objetivas.</p>
          </div>
          <span class="p360c-badge">${this.evaluations.length} actuales</span>
        </div>

        <div class="p360c-history">
          ${this.evaluations.length?this.evaluations.map(e=>this._renderEvaluationCard(e)).join(""):'<div class="p360c-empty">Todavía no hay evaluaciones registradas para esta temporada.</div>'}
        </div>
      </section>
    `:'<div class="p360c-error">Tu perfil no puede consultar evaluaciones de este jugador.</div>'}_renderTargetInputs(){var a;const e=new Map((((a=this.objectiveProfile)==null?void 0:a.targets)||[]).map(t=>[String(t.metric_code||"").toUpperCase(),t]));return[...Se(this.metrics).entries()].map(([t,s])=>`
      <section class="p360c-domain">
        <div class="p360c-domain-title">${m(this._domainLabel(t))}</div>
        <div style="display:grid;gap:8px;">
          ${s.map(n=>{const r=e.get(String(n.code).toUpperCase());return`
              <div class="p360c-target-row">
                <div class="p360c-target-label">
                  <strong>${m(n.name)}</strong>
                  <span>Escala ${m(n.scale_min)}–${m(n.scale_max)}</span>
                </div>
                <label>
                  <span>Objetivo</span>
                  <input
                    class="p360c-target-score"
                    data-metric-code="${m(n.code)}"
                    type="number"
                    inputmode="decimal"
                    min="${m(n.scale_min)}"
                    max="${m(n.scale_max)}"
                    step="${m(n.scale_step)}"
                    value="${m((r==null?void 0:r.target_score)??"")}"
                    placeholder="—"
                  />
                </label>
                <label>
                  <span>Prioridad</span>
                  <input
                    class="p360c-target-weight"
                    data-metric-code="${m(n.code)}"
                    type="number"
                    inputmode="decimal"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value="${m((r==null?void 0:r.priority_weight)??1)}"
                  />
                </label>
              </div>
            `}).join("")}
        </div>
      </section>
    `).join("")}_renderObjectiveForm(){var o,c,d,p,u;const e=this._can(A.CREATE_OBJECTIVE_PROFILE),a=this._can(A.EDIT_OBJECTIVE_PROFILE),t=!!((o=this.objectiveProfile)!=null&&o.id);if(!t&&!e||t&&!a)return"";const{min:s,max:n}=this._dateBounds(),r=((c=this.objectiveProfile)==null?void 0:c.effective_date)||this._defaultDate();return`
      <details class="p360c-card" id="p360c-objective-editor">
        <summary>
          ${t?"✏️ Revisar perfil objetivo":"＋ Crear perfil objetivo"}
        </summary>
        <form class="p360c-form" id="p360c-objective-form">
          <div class="p360c-note">
            Guardar cambios crea una nueva revisión del perfil. Los gaps se calculan de forma determinista contra la última evaluación disponible.
          </div>

          <div class="p360c-form-grid">
            <label>
              <span>Fecha de vigencia *</span>
              <input
                id="p360c-objective-effective-date"
                type="date"
                required
                min="${m(s)}"
                max="${m(n)}"
                value="${m(r)}"
              />
            </label>
            <label>
              <span>Fecha objetivo</span>
              <input
                id="p360c-objective-target-date"
                type="date"
                min="${m(r||s)}"
                max="${m(n)}"
                value="${m(((d=this.objectiveProfile)==null?void 0:d.target_date)||"")}"
              />
            </label>
            <label class="p360c-span-2">
              <span>Nombre del perfil *</span>
              <input
                id="p360c-objective-title"
                type="text"
                required
                maxlength="140"
                value="${m(((p=this.objectiveProfile)==null?void 0:p.title)||"")}"
                placeholder="Ej. Perfil objetivo final de temporada"
              />
            </label>
            <label class="p360c-span-2">
              <span>Razonamiento / propósito</span>
              <textarea id="p360c-objective-rationale">${m(((u=this.objectiveProfile)==null?void 0:u.rationale)||"")}</textarea>
            </label>
          </div>

          <div class="p360c-domain-groups">
            ${this._renderTargetInputs()}
          </div>

          <div class="p360c-actions">
            <button type="submit" class="p360c-primary">
              ${t?"Guardar nueva revisión":"Crear perfil objetivo"}
            </button>
          </div>
        </form>
      </details>
    `}_renderGapCard(e){const a=ye.classify(e),t=a==="NO_DATA"?'<span class="p360c-gap-status p360c-gap-missing">Sin evaluación</span>':a==="TARGET_MET"?'<span class="p360c-gap-status p360c-gap-met">Objetivo alcanzado</span>':`<span class="p360c-gap-status p360c-gap-pending">Faltan ${K(e.gap_to_target,1)}</span>`;return`
      <div class="p360c-gap">
        <div class="p360c-gap-head">
          <div>
            <div class="p360c-gap-title">${m(e.metric_name||e.metric_code)}</div>
            <div class="p360c-gap-domain">${m(this._domainLabel(e.domain_code))}</div>
          </div>
          ${t}
        </div>
        <div class="p360c-gap-values">
          <span>Actual: <strong>${K(e.current_score,1)}</strong></span>
          <span>Objetivo: <strong>${K(e.target_score,1)}</strong></span>
          <span>Prioridad: <strong>${K(e.priority_weight,1)}</strong></span>
        </div>
      </div>
    `}_renderObjectivePanel(){if(!this._can(A.VIEW_OBJECTIVE_PROFILE))return'<div class="p360c-error">Tu perfil no puede consultar el perfil objetivo de este jugador.</div>';const e=ye.summarize(this.gaps);return`
      <section class="p360c-panel" id="p360c-panel-objective">
        ${this._renderObjectiveForm()}

        ${this.objectiveProfile?`
          <article class="p360c-card">
            <div class="p360c-section-head">
              <div>
                <h2>${m(this.objectiveProfile.title)}</h2>
                <p>
                  Vigente desde ${m(this.objectiveProfile.effective_date)}
                  ${this.objectiveProfile.target_date?" · objetivo "+m(this.objectiveProfile.target_date):""}
                  · revisión ${m(this.objectiveProfile.revision||1)}
                </p>
              </div>
              <span class="p360c-badge p360c-badge-current">Perfil activo</span>
            </div>

            ${this.objectiveProfile.rationale?`<div class="p360c-note">${m(this.objectiveProfile.rationale)}</div>`:""}

            <div class="p360c-kpis" style="margin-top:12px;">
              <div class="p360c-kpi"><span>Objetivos</span><strong>${e.total_targets}</strong></div>
              <div class="p360c-kpi"><span>Con datos</span><strong>${e.targets_with_data}</strong></div>
              <div class="p360c-kpi"><span>Alcanzados</span><strong>${e.targets_met}</strong></div>
              <div class="p360c-kpi"><span>Pendientes</span><strong>${e.targets_pending}</strong></div>
            </div>

            <div class="p360c-gap-grid" style="margin-top:12px;">
              ${this.gaps.map(a=>this._renderGapCard(a)).join("")}
            </div>

            ${this._can(A.ARCHIVE_OBJECTIVE_PROFILE)?`
              <div class="p360c-actions" style="margin-top:12px;">
                <button
                  type="button"
                  class="p360c-danger"
                  id="p360c-archive-objective"
                  data-profile-id="${m(this.objectiveProfile.id)}"
                >Archivar perfil objetivo</button>
              </div>
            `:""}
          </article>
        `:'<div class="p360c-empty">Todavía no existe un perfil objetivo activo para este jugador.</div>'}
      </section>
    `}_renderBody(){return this.activeTab==="objective"?this._renderObjectivePanel():this.activeTab==="analytics"?this.analyticsPanel.render():this.activeTab==="wellness"?this.wellnessPanel.render():this._renderEvaluationPanel()}_bindTabs(e){e.querySelectorAll("[data-p360c-tab]").forEach(a=>{a.addEventListener("click",()=>{const t=a.dataset.p360cTab;this.activeTab=["evaluation","objective","analytics","wellness"].includes(t)?t:"evaluation",this._renderLoaded(e)})})}_collectEvaluationScores(e){return[...e.querySelectorAll(".p360c-eval-score")].map(a=>{const t=ne(a.value);return t===null?null:{metric_code:a.dataset.metricCode,score:t}}).filter(Boolean)}_collectTargets(e){const a=new Map([...e.querySelectorAll(".p360c-target-weight")].map(t=>[t.dataset.metricCode,ne(t.value)??1]));return[...e.querySelectorAll(".p360c-target-score")].map(t=>{const s=ne(t.value);return s===null?null:{metric_code:t.dataset.metricCode,target_score:s,priority_weight:a.get(t.dataset.metricCode)??1}}).filter(Boolean)}_bindEvaluationEvents(e){var a,t;(a=e.querySelector("#p360c-cancel-evaluation-edit"))==null||a.addEventListener("click",()=>{this.editingEvaluationId=null,this._renderLoaded(e)}),e.querySelectorAll(".p360c-edit-evaluation").forEach(s=>{s.addEventListener("click",()=>{var n;this.editingEvaluationId=s.dataset.evaluationId,this._renderLoaded(e),(n=e.querySelector("#p360c-evaluation-editor"))==null||n.scrollIntoView({block:"start",behavior:"smooth"})})}),e.querySelectorAll(".p360c-archive-evaluation").forEach(s=>{s.addEventListener("click",async()=>{if(confirm("¿Archivar esta evaluación? El histórico de revisiones se conservará.")){s.disabled=!0;try{await this.service.archiveEvaluation(s.dataset.evaluationId),this.editingEvaluationId=null,await this.render(this.containerId,this.playerId,this.teamId)}catch(n){console.error("[Player360View] Error archivando evaluación:",n),alert(`❌ ${n.message||n}`),s.disabled=!1}}})}),(t=e.querySelector("#p360c-evaluation-form"))==null||t.addEventListener("submit",async s=>{var c,d,p,u,_,v,g,x,S;s.preventDefault();const n=s.currentTarget,r=n.querySelector('button[type="submit"]'),o=this._collectEvaluationScores(n);if(!o.length){alert("⚠️ Puntúa al menos una métrica.");return}r.disabled=!0;try{await this.service.saveEvaluation({teamSeasonId:this.teamSeasonId,playerId:this.playerId,evaluationDate:(c=n.querySelector("#p360c-evaluation-date"))==null?void 0:c.value,title:(d=n.querySelector("#p360c-evaluation-title"))==null?void 0:d.value.trim(),evaluationType:(p=n.querySelector("#p360c-evaluation-type"))==null?void 0:p.value,sourceType:(u=n.querySelector("#p360c-evaluation-source"))==null?void 0:u.value,evaluatorName:((_=n.querySelector("#p360c-evaluator-name"))==null?void 0:_.value.trim())||null,summary:((v=n.querySelector("#p360c-evaluation-summary"))==null?void 0:v.value.trim())||null,strengths:((g=n.querySelector("#p360c-evaluation-strengths"))==null?void 0:g.value.trim())||null,developmentPriorities:((x=n.querySelector("#p360c-evaluation-priorities"))==null?void 0:x.value.trim())||null,isPrivate:!!((S=n.querySelector("#p360c-evaluation-private"))!=null&&S.checked),shareWithPlayer:!1,scores:o,provenance:{entered_from:"IQBASKET_PLAYER360_PHASE4C_UI"},existingEvaluationId:this.editingEvaluationId}),this.editingEvaluationId=null,await this.render(this.containerId,this.playerId,this.teamId)}catch(l){console.error("[Player360View] Error guardando evaluación:",l),alert(`❌ ${l.message||l}`),r.disabled=!1}})}_bindObjectiveEvents(e){var t,s;const a=e.querySelector("#p360c-objective-effective-date");a==null||a.addEventListener("change",()=>{const n=e.querySelector("#p360c-objective-target-date");n&&(n.min=a.value)}),(t=e.querySelector("#p360c-objective-form"))==null||t.addEventListener("submit",async n=>{var d,p,u,_,v;n.preventDefault();const r=n.currentTarget,o=r.querySelector('button[type="submit"]'),c=this._collectTargets(r);if(!c.length){alert("⚠️ Define al menos un objetivo.");return}o.disabled=!0;try{await this.service.saveObjectiveProfile({teamSeasonId:this.teamSeasonId,playerId:this.playerId,effectiveDate:(d=r.querySelector("#p360c-objective-effective-date"))==null?void 0:d.value,targetDate:((p=r.querySelector("#p360c-objective-target-date"))==null?void 0:p.value)||null,title:(u=r.querySelector("#p360c-objective-title"))==null?void 0:u.value.trim(),rationale:((_=r.querySelector("#p360c-objective-rationale"))==null?void 0:_.value.trim())||null,targets:c,provenance:{entered_from:"IQBASKET_PLAYER360_PHASE4C_UI"},expectedActiveProfileId:((v=this.objectiveProfile)==null?void 0:v.id)||null}),await this.render(this.containerId,this.playerId,this.teamId)}catch(g){console.error("[Player360View] Error guardando perfil objetivo:",g),alert(`❌ ${g.message||g}`),o.disabled=!1}}),(s=e.querySelector("#p360c-archive-objective"))==null||s.addEventListener("click",async n=>{const r=n.currentTarget;if(confirm("¿Archivar el perfil objetivo activo? Se conservará su histórico.")){r.disabled=!0;try{await this.service.archiveObjectiveProfile(r.dataset.profileId),await this.render(this.containerId,this.playerId,this.teamId)}catch(o){console.error("[Player360View] Error archivando perfil objetivo:",o),alert(`❌ ${o.message||o}`),r.disabled=!1}}})}_renderLoaded(e){var s,n,r,o,c,d,p,u;const a=((n=(s=k).getActiveSeasonDisplayName)==null?void 0:n.call(s,this.teamId))||((r=this._seasonContext())==null?void 0:r.name)||"Temporada activa",t=((d=(c=(o=k).getTeamById)==null?void 0:c.call(o,this.teamId))==null?void 0:d.name)||"Equipo";e.innerHTML=`
      <section class="p360c-view">
        ${this._renderStyles()}
        <a class="p360c-back" href="#/player/${m(this.playerId)}">← Volver a la ficha del jugador</a>

        <header class="p360c-hero">
          <div>
            <h1>Player 360 · ${m(mt(this.player))}</h1>
            <p>
              Evaluación humana, perfil objetivo, evolución longitudinal y apoyo de hábitos.
              Los check-ins de Nutrition/Recovery se mantienen separados de estadísticas e IA.
            </p>
          </div>
          <span class="p360c-context">${m(t)} · ${m(a)}</span>
        </header>

        ${this.lastError?`
          <div class="p360c-error">
            No se ha podido cargar Player 360: ${m(this.lastError.message||this.lastError)}
          </div>
        `:""}

        ${!((p=this.capabilities)!=null&&p.evaluation)||!((u=this.capabilities)!=null&&u.objective_profile)?`
          <div class="p360c-note">
            Algunas capacidades de Phase 4C no están disponibles en este entorno.
          </div>
        `:""}

        ${this._renderTabs()}
        ${this._renderBody()}
      </section>
    `,this._bindTabs(e),this._bindEvaluationEvents(e),this._bindObjectiveEvents(e),this.analyticsPanel.bind(e,{onChanged:async()=>{this.activeTab="analytics",this._renderLoaded(e)}}),this.wellnessPanel.bind(e,{onChanged:async()=>{this.activeTab="wellness",this._renderLoaded(e)}})}async render(e="dashboard-content-area",a=null,t=null){var n,r,o,c,d,p;this.containerId=e,this.teamId=t||((r=(n=k).getActiveTeamId)==null?void 0:r.call(n))||null,this.teamSeasonId=((c=(o=k).getActiveTeamSeasonId)==null?void 0:c.call(o,this.teamId))||null,this.playerId=a,this.player=((p=(d=k).getPlayerById)==null?void 0:p.call(d,a))||null;const s=document.getElementById(e);if(s){if(!this.playerId||!this.player){s.innerHTML='<div class="p360c-error">Jugador no encontrado.</div>';return}if(!this.teamSeasonId){s.innerHTML='<div class="p360c-error">No se ha podido resolver el equipo-temporada activo.</div>';return}if(!this._can(A.VIEW_PLAYER_360)){s.innerHTML=`
        <div class="p360c-error">
          Tu perfil no tiene permiso para consultar Player 360 de este jugador.
        </div>
      `;return}await this._load(),this._renderLoaded(s)}}}export{vt as Player360View};
