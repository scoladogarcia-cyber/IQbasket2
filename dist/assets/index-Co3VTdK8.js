const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./GameLiveEditorView-D0HNO3qs.js","./LiveScoreHUDView-DPdZq37X.js","./FamilyWorkspaceView-abQLx7sb.js","./FamilyWorkspaceService-DSQM7XdG.js","./family-ai-products.config-OrkpNkiV.js","./BusinessMetricsView-CccHMYOI.js","./TrainingView-BNbinAl_.js","./player360.config-CCSL1AnT.js","./NutritionView-wCu5If7l.js","./WellnessSupportPanel-C6BjKQNQ.js","./Player360View-DGfOnt_B.js","./PrivacyCenterView-D1E_HMYj.js"])))=>i.map(i=>d[i]);
var Vs=Object.defineProperty;var ks=(o,e,t)=>e in o?Vs(o,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):o[e]=t;var Ze=(o,e,t)=>ks(o,typeof e!="symbol"?e+"":e,t);import{createClient as Fs}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const i of r.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&a(i)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function a(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const Za={SUPABASE_URL:"https://ssmljysecerbcvgjadks.supabase.co",SUPABASE_ANON_KEY:"sb_publishable_rnclIdTDgXEa-Cc2tuJnEQ_MoX3xtGz"},He={supabaseUrl:Za.SUPABASE_URL,supabaseAnonKey:Za.SUPABASE_ANON_KEY,collections:{SEASON_CATALOG:"season_catalog",TEAM_SEASONS:"team_seasons",ROSTER_MEMBERSHIPS:"roster_memberships",TEAM_SEASON_MEMBERSHIPS:"team_season_memberships"}},D=Fs(He.supabaseUrl,He.supabaseAnonKey,{auth:{persistSession:!0,autoRefreshToken:!0,detectSessionInUrl:!0}});class Us{async connect(){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.connect() debe ser implementado en la clase hija.")}async disconnect(){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.disconnect() debe ser implementado en la clase hija.")}async getAll(e){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.getAll() debe ser implementado en la clase hija.")}async getById(e,t){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.getById() debe ser implementado en la clase hija.")}async getByIds(e,t){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.getByIds() debe ser implementado en la clase hija.")}async save(e,t){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.save() debe ser implementado en la clase hija.")}async saveBatch(e,t){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.saveBatch() debe ser implementado en la clase hija.")}async update(e,t,a){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.update() debe ser implementado en la clase hija.")}async upsert(e,t,a="id"){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.upsert() debe ser implementado en la clase hija.")}async delete(e,t){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.delete() debe ser implementado en la clase hija.")}async deleteWhere(e,t){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.deleteWhere() debe ser implementado en la clase hija.")}async query(e,t,a={}){throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.query() debe ser implementado en la clase hija.")}}class zs extends Us{constructor(e){super(),this.client=e}async connect(){try{if(!this.client)return!1;const{error:e}=await this.client.from("teams").select("id").limit(1);return!e}catch(e){return console.error("[SupabaseAdapter] Error conectando con el backend de Supabase:",e),!1}}async disconnect(){return!0}async getAll(e){const{data:t,error:a}=await this.client.from(e).select("*");if(a)throw new Error(`[SupabaseAdapter.getAll] Error en tabla '${e}': ${a.message}`);return t||[]}async getById(e,t){if(!t)return null;const{data:a,error:s}=await this.client.from(e).select("*").eq("id",t).maybeSingle();return s?(console.warn(`[SupabaseAdapter.getById] Aviso en tabla '${e}' (ID: ${t}):`,s.message),null):a}async getByIds(e,t=[]){if(!Array.isArray(t)||t.length===0)return[];const{data:a,error:s}=await this.client.from(e).select("*").in("id",t);if(s)throw new Error(`[SupabaseAdapter.getByIds] Error en '${e}': ${s.message}`);return a||[]}async save(e,t={}){const a=new Date().toISOString(),s={...t,created_at:t.created_at||t.createdAt||a,updated_at:t.updated_at||t.updatedAt||a},{data:r,error:i}=await this.client.from(e).insert([s]).select().single();if(i)throw new Error(`[SupabaseAdapter.save] Error insertando en '${e}': ${i.message}`);return r}async saveBatch(e,t=[]){if(!Array.isArray(t)||t.length===0)return[];const a=new Date().toISOString(),s=t.map(n=>({...n,created_at:n.created_at||n.createdAt||a,updated_at:n.updated_at||n.updatedAt||a})),{data:r,error:i}=await this.client.from(e).upsert(s).select();if(i)throw new Error(`[SupabaseAdapter.saveBatch] Error en '${e}': ${i.message}`);return r||[]}async update(e,t,a={}){const s=new Date().toISOString(),r={...a,updated_at:s},{data:i,error:n}=await this.client.from(e).update(r).eq("id",t).select().single();if(n)throw new Error(`[SupabaseAdapter.update] Error actualizando '${e}' (ID: ${t}): ${n.message}`);return i}async upsert(e,t={},a="id"){const s=new Date().toISOString(),r={...t,created_at:t.created_at||t.createdAt||s,updated_at:s},{data:i,error:n}=await this.client.from(e).upsert([r],{onConflict:a}).select().single();if(n)throw new Error(`[SupabaseAdapter.upsert] Error en '${e}': ${n.message}`);return i}async delete(e,t){const{error:a}=await this.client.from(e).delete().eq("id",t);return a?(console.error(`[SupabaseAdapter.delete] Error eliminando en '${e}':`,a.message),!1):!0}async deleteWhere(e,t={}){let a=this.client.from(e).delete();for(const[r,i]of Object.entries(t))i!==void 0&&(a=a.eq(r,i));const{error:s}=await a;return s?(console.error(`[SupabaseAdapter.deleteWhere] Error en '${e}':`,s.message),!1):!0}async query(e,t={},a={}){const s=typeof a.columns=="string"&&a.columns.trim()?a.columns:"*";let r=this.client.from(e).select(s);if(t&&typeof t=="object")for(const[d,c]of Object.entries(t))c!=null&&(r=r.eq(d,c));if(a.orderBy&&(r=r.order(a.orderBy,{ascending:a.ascending!==!1})),typeof a.offset=="number"&&typeof a.limit=="number"){const d=a.offset,c=a.offset+a.limit-1;r=r.range(d,c)}else typeof a.limit=="number"&&(r=r.limit(a.limit));const{data:i,error:n}=await r;if(n)throw new Error(`[SupabaseAdapter.query] Error consultando '${e}': ${n.message}`);return i||[]}}class Gs{constructor(e){this.db=e,this.collection=He.collections.SEASON_CATALOG}async list({status:e=null,includeTest:t=!0}={}){const a={};return e&&(a.status=e),t||(a.is_test=!1),this.db.query(this.collection,a,{orderBy:"start_date",ascending:!1})}async getById(e){return e?this.db.getById(this.collection,e):null}async getByIds(e=[]){if(!Array.isArray(e)||e.length===0)return[];if(typeof this.db.getByIds=="function")try{return await this.db.getByIds(this.collection,e)}catch(a){console.warn("[SeasonCatalogRepository] Lectura por lote no disponible; se usa fallback por ID:",a.message)}return(await Promise.all(e.map(a=>this.getById(a)))).filter(Boolean)}async getByCode(e){return e&&(await this.db.query(this.collection,{code:e},{limit:1}))[0]||null}async save(e){if(!(e!=null&&e.code)||!(e!=null&&e.name))throw new Error("SeasonCatalogRepository: code y name son obligatorios.");return this.db.upsert(this.collection,e,"code")}}class Bs{constructor(e){this.db=e,this.collection=He.collections.TEAM_SEASONS}async listByTeam(e,{status:t=null}={}){if(!e)return[];const a={team_id:e};return t&&(a.status=t),this.db.query(this.collection,a,{orderBy:"created_at",ascending:!1})}async listBySeason(e,{status:t=null}={}){if(!e)return[];const a={season_id:e};return t&&(a.status=t),this.db.query(this.collection,a)}async getById(e){return e?this.db.getById(this.collection,e):null}async getByTeamAndSeason(e,t){return!e||!t?null:(await this.db.query(this.collection,{team_id:e,season_id:t},{limit:1}))[0]||null}async save(e){if(!(e!=null&&e.team_id)||!(e!=null&&e.season_id))throw new Error("TeamSeasonRepository: team_id y season_id son obligatorios.");return this.db.upsert(this.collection,e,"team_id,season_id")}}class js{constructor(e){this.db=e,this.collection=He.collections.ROSTER_MEMBERSHIPS}async listByTeamSeason(e,{status:t=null}={}){if(!e)return[];const a={team_season_id:e};return t&&(a.status=t),this.db.query(this.collection,a)}async listByPlayer(e){return e?this.db.query(this.collection,{player_id:e},{orderBy:"joined_at",ascending:!0}):[]}async get(e,t){return!e||!t?null:(await this.db.query(this.collection,{player_id:e,team_season_id:t},{limit:1}))[0]||null}async save(e){if(!(e!=null&&e.player_id)||!(e!=null&&e.team_season_id))throw new Error("RosterMembershipRepository: player_id y team_season_id son obligatorios.");return this.db.upsert(this.collection,e,"player_id,team_season_id")}}class Ws{constructor(e){this.db=e,this.collection=He.collections.TEAM_SEASON_MEMBERSHIPS}async listByUser(e,{status:t="ACTIVE"}={}){if(!e)return[];const a={user_id:e};return t&&(a.status=t),this.db.query(this.collection,a)}async listByTeamSeason(e,{status:t="ACTIVE"}={}){if(!e)return[];const a={team_season_id:e};return t&&(a.status=t),this.db.query(this.collection,a)}async listByUserAndScope(e,t){return!e||!t?[]:this.db.query(this.collection,{user_id:e,team_season_id:t})}async save(e){if(!(e!=null&&e.user_id)||!(e!=null&&e.team_season_id)||!(e!=null&&e.function_role))throw new Error("TeamSeasonMembershipRepository: user_id, team_season_id y function_role son obligatorios.");return this.db.upsert(this.collection,e,"user_id,team_season_id,function_role")}}function Pt(o){return String(o??"").trim().toLowerCase().replace(/[^a-z0-9]/g,"")}class Hs{constructor(e){if(!e)throw new Error("SeasonContextService requiere un adaptador de base de datos.");this.seasons=new Gs(e),this.teamSeasons=new Bs(e),this.rosters=new js(e),this.memberships=new Ws(e)}async listByTeam(e,{status:t="ACTIVE"}={}){if(!e)return[];const a=await this.teamSeasons.listByTeam(e,{status:t});if(!Array.isArray(a)||a.length===0)return[];const s=[...new Set(a.map(n=>n.season_id).filter(Boolean).map(String))],r=await this.seasons.getByIds(s),i=new Map((r||[]).map(n=>[String(n.id),n]));return a.map(n=>{const d=i.get(String(n.season_id));return d?{id:n.legacy_season_id||d.id,legacy_season_id:n.legacy_season_id||null,legacySeasonId:n.legacy_season_id||null,global_season_id:d.id,globalSeasonId:d.id,team_season_id:n.id,teamSeasonId:n.id,team_id:n.team_id,teamId:n.team_id,code:d.code,name:d.name,start_date:d.start_date,end_date:d.end_date,status:n.status||d.status||"ACTIVE",data_status:n.data_status||"ACTIVE",source:"v3"}:null}).filter(Boolean).sort((n,d)=>{const c=n.start_date?new Date(n.start_date).getTime():0,u=d.start_date?new Date(d.start_date).getTime():0;return c!==u?u-c:String(d.code||d.name||"").localeCompare(String(n.code||n.name||""))})}resolve(e=[],t=null){if(!Array.isArray(e)||e.length===0)return null;if(!t)return e[0];const a=Pt(t);if(!a)return e[0];const s=e.find(i=>[i.name,i.code,i.id,i.legacy_season_id,i.global_season_id,i.team_season_id].map(Pt).filter(Boolean).includes(a));return s||e.find(i=>[i.name,i.code].map(Pt).filter(Boolean).some(d=>d.includes(a)||a.includes(d)))||e[0]}async listRoster(e,{status:t=null}={}){return e?this.rosters.listByTeamSeason(e,{status:t}):[]}async listUserMemberships(e,{status:t="ACTIVE"}={}){return e?this.memberships.listByUser(e,{status:t}):[]}}const st="scolado@nechigroup.com",R=Object.freeze({SUPERADMIN:"SUPERADMIN",ADMIN:"ADMIN",ENTRENADOR:"ENTRENADOR",ANALISTA:"ANALISTA",PREPARADOR_FISICO:"PREPARADOR_FISICO",JUGADOR:"JUGADOR",FAMILIA_TUTOR:"FAMILIA_TUTOR",VISOR:"VISOR",INVITADO:"INVITADO"}),Ys=Object.freeze({SCOUT:R.ANALISTA,VIEWER:R.VISOR,FAMILY:R.FAMILIA_TUTOR,FAMILIA:R.FAMILIA_TUTOR,TUTOR:R.FAMILIA_TUTOR,PREPARADOR:R.PREPARADOR_FISICO,PREPARADOR_FÍSICO:R.PREPARADOR_FISICO,"PREPARADOR FISICO":R.PREPARADOR_FISICO,"PREPARADOR FÍSICO":R.PREPARADOR_FISICO});function ra(o=""){return String(o||"").trim().toLowerCase()}function It(o){const e=String(o||R.INVITADO).trim().toUpperCase(),t=Ys[e]||e;return Object.values(R).includes(t)?t:R.INVITADO}function Js(o,e=""){const t=ra(e),a=It(o);return a===R.SUPERADMIN&&t!==st?R.INVITADO:t===st?R.SUPERADMIN:a}function Xa(o=""){return ra(o)===st}Object.freeze([R.ENTRENADOR,R.ANALISTA,R.PREPARADOR_FISICO,R.JUGADOR,R.FAMILIA_TUTOR,R.VISOR,R.INVITADO]);const l=Object.freeze({NAVIGATE_MODULE:"NAVIGATE_MODULE",SELECT_TEAM:"SELECT_TEAM",SELECT_SEASON:"SELECT_SEASON",VIEW_DASHBOARD:"VIEW_DASHBOARD",VIEW_APPROVAL_CENTER:"VIEW_APPROVAL_CENTER",SYNC_DATA:"SYNC_DATA",VIEW_DATA_AUDIT:"VIEW_DATA_AUDIT",REPAIR_DATA_AUDIT:"REPAIR_DATA_AUDIT",VIEW_TEAM:"VIEW_TEAM",VIEW_ROSTER:"VIEW_ROSTER",VIEW_PLAYER_PROFILE:"VIEW_PLAYER_PROFILE",VIEW_PLAYER_STATS:"VIEW_PLAYER_STATS",VIEW_PLAYER_COMPARISON:"VIEW_PLAYER_COMPARISON",VIEW_PRIVATE_NOTES:"VIEW_PRIVATE_NOTES",EDIT_TACTICAL_NOTES:"EDIT_TACTICAL_NOTES",EDIT_PHYSICAL_NOTES:"EDIT_PHYSICAL_NOTES",EDIT_PLAYER_MASTER:"EDIT_PLAYER_MASTER",VIEW_GAMES:"VIEW_GAMES",CREATE_GAME:"CREATE_GAME",EDIT_GAME:"EDIT_GAME",DELETE_GAME:"DELETE_GAME",RECORD_LIVE_GAME:"RECORD_LIVE_GAME",PREPARE_GAME:"PREPARE_GAME",START_GAME:"START_GAME",FINISH_GAME:"FINISH_GAME",CANCEL_GAME:"CANCEL_GAME",LOCK_GAME:"LOCK_GAME",REOPEN_GAME:"REOPEN_GAME",REQUEST_GAME_LOCK:"REQUEST_GAME_LOCK",REVIEW_GAME_LOCK_REQUESTS:"REVIEW_GAME_LOCK_REQUESTS",VIEW_BOXSCORE:"VIEW_BOXSCORE",EDIT_BOXSCORE:"EDIT_BOXSCORE",VIEW_LINEUPS:"VIEW_LINEUPS",VIEW_ADVANCED_TEAM_STATS:"VIEW_ADVANCED_TEAM_STATS",VIEW_ADVANCED_PLAYER_STATS:"VIEW_ADVANCED_PLAYER_STATS",USE_COMPARATOR:"USE_COMPARATOR",GENERATE_REPORT:"GENERATE_REPORT",EXPORT_REPORT:"EXPORT_REPORT",MANAGE_REPORTS:"MANAGE_REPORTS",USE_AI:"USE_AI",VIEW_FAMILY_ADVISOR:"VIEW_FAMILY_ADVISOR",VIEW_FAMILY_WORKSPACE:"VIEW_FAMILY_WORKSPACE",VIEW_BUSINESS_METRICS:"VIEW_BUSINESS_METRICS",VIEW_FAMILY_PILOT:"VIEW_FAMILY_PILOT",ENROLL_FAMILY_PILOT:"ENROLL_FAMILY_PILOT",REVOKE_FAMILY_PILOT:"REVOKE_FAMILY_PILOT",INVITE_FAMILY_LINK:"INVITE_FAMILY_LINK",REVOKE_FAMILY_LINK:"REVOKE_FAMILY_LINK",EDIT_OWN_PROFILE:"EDIT_OWN_PROFILE",CHANGE_OWN_PASSWORD:"CHANGE_OWN_PASSWORD",VIEW_ACTIVE_ROLE:"VIEW_ACTIVE_ROLE",SIMULATE_ROLE:"SIMULATE_ROLE",VIEW_CLUBS:"VIEW_CLUBS",MANAGE_CLUBS:"MANAGE_CLUBS",MANAGE_TEAMS:"MANAGE_TEAMS",REQUEST_TEAM_ACCESS:"REQUEST_TEAM_ACCESS",APPROVE_TEAM_ACCESS:"APPROVE_TEAM_ACCESS",REQUEST_TRANSFER:"REQUEST_TRANSFER",APPROVE_TRANSFER:"APPROVE_TRANSFER",REVIEW_TRANSFER_SOURCE:"REVIEW_TRANSFER_SOURCE",REVIEW_TRANSFER_DESTINATION:"REVIEW_TRANSFER_DESTINATION",FINALIZE_TRANSFER:"FINALIZE_TRANSFER",MANAGE_ROSTER:"MANAGE_ROSTER",VIEW_SEASONS:"VIEW_SEASONS",MANAGE_SEASONS:"MANAGE_SEASONS",FREEZE_TEAM_SEASON:"FREEZE_TEAM_SEASON",REOPEN_TEAM_SEASON:"REOPEN_TEAM_SEASON",REQUEST_TEAM_SEASON_FREEZE:"REQUEST_TEAM_SEASON_FREEZE",REVIEW_TEAM_SEASON_FREEZE_REQUESTS:"REVIEW_TEAM_SEASON_FREEZE_REQUESTS",VIEW_USERS:"VIEW_USERS",INVITE_USERS:"INVITE_USERS",ASSIGN_STANDARD_ROLES:"ASSIGN_STANDARD_ROLES",ASSIGN_PRIVILEGED_ROLES:"ASSIGN_PRIVILEGED_ROLES",MANAGE_TRANSLATIONS:"MANAGE_TRANSLATIONS",VIEW_PLAYER_360:"VIEW_PLAYER_360",VIEW_OWN_PLAYER_360:"VIEW_OWN_PLAYER_360",VIEW_LINKED_PLAYER_360:"VIEW_LINKED_PLAYER_360",VIEW_TRAINING:"VIEW_TRAINING",CREATE_TRAINING:"CREATE_TRAINING",EDIT_TRAINING:"EDIT_TRAINING",DELETE_TRAINING:"DELETE_TRAINING",VIEW_EXTERNAL_DEVELOPMENT:"VIEW_EXTERNAL_DEVELOPMENT",CREATE_EXTERNAL_DEVELOPMENT:"CREATE_EXTERNAL_DEVELOPMENT",EDIT_EXTERNAL_DEVELOPMENT:"EDIT_EXTERNAL_DEVELOPMENT",VIEW_PLAYER_EVALUATION:"VIEW_PLAYER_EVALUATION",VIEW_PRIVATE_PLAYER_EVALUATION:"VIEW_PRIVATE_PLAYER_EVALUATION",CREATE_PLAYER_EVALUATION:"CREATE_PLAYER_EVALUATION",EDIT_PLAYER_EVALUATION:"EDIT_PLAYER_EVALUATION",ARCHIVE_PLAYER_EVALUATION:"ARCHIVE_PLAYER_EVALUATION",CREATE_EVALUATION_METRIC:"CREATE_EVALUATION_METRIC",EDIT_EVALUATION_METRIC:"EDIT_EVALUATION_METRIC",VIEW_OBJECTIVE_PROFILE:"VIEW_OBJECTIVE_PROFILE",CREATE_OBJECTIVE_PROFILE:"CREATE_OBJECTIVE_PROFILE",EDIT_OBJECTIVE_PROFILE:"EDIT_OBJECTIVE_PROFILE",ARCHIVE_OBJECTIVE_PROFILE:"ARCHIVE_OBJECTIVE_PROFILE",VIEW_DATA_COVERAGE:"VIEW_DATA_COVERAGE",VIEW_LONGITUDINAL_ANALYTICS:"VIEW_LONGITUDINAL_ANALYTICS",GENERATE_LONGITUDINAL_ANALYTICS:"GENERATE_LONGITUDINAL_ANALYTICS",VIEW_AI_INSIGHTS:"VIEW_AI_INSIGHTS",GENERATE_AI_INSIGHTS:"GENERATE_AI_INSIGHTS",REVIEW_AI_INSIGHTS:"REVIEW_AI_INSIGHTS",EXPORT_PLAYER_360:"EXPORT_PLAYER_360",VIEW_PRIVACY_AUTHORIZATIONS:"VIEW_PRIVACY_AUTHORIZATIONS",CREATE_PRIVACY_AUTHORIZATION:"CREATE_PRIVACY_AUTHORIZATION",REVOKE_PRIVACY_AUTHORIZATION:"REVOKE_PRIVACY_AUTHORIZATION",VIEW_SENSITIVE_ACCESS_GRANTS:"VIEW_SENSITIVE_ACCESS_GRANTS",REQUEST_SENSITIVE_ACCESS:"REQUEST_SENSITIVE_ACCESS",GRANT_SENSITIVE_ACCESS:"GRANT_SENSITIVE_ACCESS",REVIEW_SENSITIVE_ACCESS_REQUESTS:"REVIEW_SENSITIVE_ACCESS_REQUESTS",REVOKE_SENSITIVE_ACCESS:"REVOKE_SENSITIVE_ACCESS",VIEW_PRIVACY_AUDIT:"VIEW_PRIVACY_AUDIT",VIEW_RECOVERY:"VIEW_RECOVERY",EDIT_RECOVERY:"EDIT_RECOVERY",VIEW_NUTRITION:"VIEW_NUTRITION",EDIT_NUTRITION:"EDIT_NUTRITION",VIEW_NEURO_DATA:"VIEW_NEURO_DATA",VIEW_WELLNESS_RECOMMENDATIONS:"VIEW_WELLNESS_RECOMMENDATIONS"}),Ge=[l.NAVIGATE_MODULE,l.SELECT_TEAM,l.SELECT_SEASON,l.VIEW_DASHBOARD,l.VIEW_APPROVAL_CENTER,l.VIEW_FAMILY_WORKSPACE,l.VIEW_TEAM,l.VIEW_ROSTER,l.VIEW_PLAYER_PROFILE,l.VIEW_PLAYER_STATS,l.VIEW_GAMES,l.VIEW_BOXSCORE,l.VIEW_LINEUPS,l.VIEW_ADVANCED_TEAM_STATS,l.VIEW_ADVANCED_PLAYER_STATS,l.GENERATE_REPORT,l.EDIT_OWN_PROFILE,l.CHANGE_OWN_PASSWORD,l.VIEW_ACTIVE_ROLE,l.VIEW_CLUBS,l.VIEW_SEASONS],Qs=[l.VIEW_PLAYER_COMPARISON,l.USE_COMPARATOR,l.USE_AI,l.VIEW_FAMILY_ADVISOR,l.VIEW_PLAYER_360,l.VIEW_TRAINING,l.VIEW_EXTERNAL_DEVELOPMENT,l.VIEW_PLAYER_EVALUATION,l.VIEW_OBJECTIVE_PROFILE,l.VIEW_DATA_COVERAGE,l.VIEW_LONGITUDINAL_ANALYTICS,l.VIEW_AI_INSIGHTS,l.VIEW_RECOVERY,l.VIEW_NUTRITION,l.VIEW_WELLNESS_RECOMMENDATIONS],wt=Object.freeze({[R.SUPERADMIN]:Object.values(l),[R.ADMIN]:[...Ge,l.SYNC_DATA,l.VIEW_DATA_AUDIT,l.REPAIR_DATA_AUDIT,l.VIEW_PLAYER_COMPARISON,l.VIEW_PRIVATE_NOTES,l.EDIT_TACTICAL_NOTES,l.EDIT_PHYSICAL_NOTES,l.EDIT_PLAYER_MASTER,l.CREATE_GAME,l.EDIT_GAME,l.DELETE_GAME,l.RECORD_LIVE_GAME,l.PREPARE_GAME,l.START_GAME,l.FINISH_GAME,l.CANCEL_GAME,l.EDIT_BOXSCORE,l.LOCK_GAME,l.REOPEN_GAME,l.REVIEW_GAME_LOCK_REQUESTS,l.USE_COMPARATOR,l.EXPORT_REPORT,l.MANAGE_REPORTS,l.USE_AI,l.VIEW_FAMILY_ADVISOR,l.MANAGE_CLUBS,l.MANAGE_TEAMS,l.APPROVE_TEAM_ACCESS,l.REQUEST_TRANSFER,l.REVIEW_TRANSFER_SOURCE,l.REVIEW_TRANSFER_DESTINATION,l.MANAGE_ROSTER,l.MANAGE_SEASONS,l.FREEZE_TEAM_SEASON,l.REOPEN_TEAM_SEASON,l.REVIEW_TEAM_SEASON_FREEZE_REQUESTS,l.VIEW_USERS,l.INVITE_USERS,l.ASSIGN_STANDARD_ROLES,l.VIEW_PLAYER_360,l.VIEW_TRAINING,l.CREATE_TRAINING,l.EDIT_TRAINING,l.DELETE_TRAINING,l.VIEW_EXTERNAL_DEVELOPMENT,l.CREATE_EXTERNAL_DEVELOPMENT,l.EDIT_EXTERNAL_DEVELOPMENT,l.VIEW_PLAYER_EVALUATION,l.VIEW_PRIVATE_PLAYER_EVALUATION,l.CREATE_PLAYER_EVALUATION,l.EDIT_PLAYER_EVALUATION,l.ARCHIVE_PLAYER_EVALUATION,l.CREATE_EVALUATION_METRIC,l.EDIT_EVALUATION_METRIC,l.VIEW_OBJECTIVE_PROFILE,l.CREATE_OBJECTIVE_PROFILE,l.EDIT_OBJECTIVE_PROFILE,l.ARCHIVE_OBJECTIVE_PROFILE,l.VIEW_RECOVERY,l.EDIT_RECOVERY,l.VIEW_NUTRITION,l.EDIT_NUTRITION,l.VIEW_WELLNESS_RECOMMENDATIONS,l.VIEW_DATA_COVERAGE,l.VIEW_LONGITUDINAL_ANALYTICS,l.GENERATE_LONGITUDINAL_ANALYTICS,l.VIEW_AI_INSIGHTS,l.GENERATE_AI_INSIGHTS,l.REVIEW_AI_INSIGHTS,l.EXPORT_PLAYER_360,l.VIEW_PRIVACY_AUTHORIZATIONS,l.CREATE_PRIVACY_AUTHORIZATION,l.REVOKE_PRIVACY_AUTHORIZATION,l.INVITE_FAMILY_LINK,l.REVOKE_FAMILY_LINK,l.VIEW_SENSITIVE_ACCESS_GRANTS,l.REQUEST_SENSITIVE_ACCESS,l.GRANT_SENSITIVE_ACCESS,l.REVIEW_SENSITIVE_ACCESS_REQUESTS,l.REVOKE_SENSITIVE_ACCESS,l.VIEW_PRIVACY_AUDIT],[R.ENTRENADOR]:[...Ge,l.SYNC_DATA,l.VIEW_DATA_AUDIT,l.VIEW_PLAYER_COMPARISON,l.VIEW_PRIVATE_NOTES,l.EDIT_TACTICAL_NOTES,l.EDIT_PLAYER_MASTER,l.CREATE_GAME,l.EDIT_GAME,l.RECORD_LIVE_GAME,l.PREPARE_GAME,l.START_GAME,l.FINISH_GAME,l.CANCEL_GAME,l.EDIT_BOXSCORE,l.REQUEST_GAME_LOCK,l.USE_COMPARATOR,l.EXPORT_REPORT,l.MANAGE_REPORTS,l.USE_AI,l.VIEW_FAMILY_ADVISOR,l.REQUEST_TEAM_ACCESS,l.REQUEST_TRANSFER,l.MANAGE_ROSTER,l.MANAGE_SEASONS,l.REQUEST_TEAM_SEASON_FREEZE,l.VIEW_PLAYER_360,l.VIEW_TRAINING,l.CREATE_TRAINING,l.EDIT_TRAINING,l.DELETE_TRAINING,l.VIEW_EXTERNAL_DEVELOPMENT,l.CREATE_EXTERNAL_DEVELOPMENT,l.EDIT_EXTERNAL_DEVELOPMENT,l.VIEW_PLAYER_EVALUATION,l.VIEW_PRIVATE_PLAYER_EVALUATION,l.CREATE_PLAYER_EVALUATION,l.EDIT_PLAYER_EVALUATION,l.ARCHIVE_PLAYER_EVALUATION,l.CREATE_EVALUATION_METRIC,l.EDIT_EVALUATION_METRIC,l.VIEW_OBJECTIVE_PROFILE,l.CREATE_OBJECTIVE_PROFILE,l.EDIT_OBJECTIVE_PROFILE,l.ARCHIVE_OBJECTIVE_PROFILE,l.VIEW_RECOVERY,l.EDIT_RECOVERY,l.VIEW_NUTRITION,l.EDIT_NUTRITION,l.VIEW_WELLNESS_RECOMMENDATIONS,l.VIEW_DATA_COVERAGE,l.VIEW_LONGITUDINAL_ANALYTICS,l.GENERATE_LONGITUDINAL_ANALYTICS,l.VIEW_AI_INSIGHTS,l.GENERATE_AI_INSIGHTS,l.REVIEW_AI_INSIGHTS,l.EXPORT_PLAYER_360,l.REQUEST_SENSITIVE_ACCESS],[R.ANALISTA]:[...Ge,l.SYNC_DATA,l.VIEW_DATA_AUDIT,l.VIEW_PLAYER_COMPARISON,l.VIEW_PRIVATE_NOTES,l.CREATE_GAME,l.EDIT_GAME,l.RECORD_LIVE_GAME,l.PREPARE_GAME,l.START_GAME,l.FINISH_GAME,l.EDIT_BOXSCORE,l.REQUEST_GAME_LOCK,l.USE_COMPARATOR,l.EXPORT_REPORT,l.MANAGE_REPORTS,l.USE_AI,l.VIEW_FAMILY_ADVISOR,l.REQUEST_TEAM_ACCESS,l.REQUEST_TEAM_SEASON_FREEZE,l.VIEW_PLAYER_360,l.VIEW_TRAINING,l.VIEW_EXTERNAL_DEVELOPMENT,l.VIEW_PLAYER_EVALUATION,l.VIEW_OBJECTIVE_PROFILE,l.VIEW_DATA_COVERAGE,l.VIEW_LONGITUDINAL_ANALYTICS,l.GENERATE_LONGITUDINAL_ANALYTICS,l.VIEW_AI_INSIGHTS,l.GENERATE_AI_INSIGHTS,l.EXPORT_PLAYER_360,l.REQUEST_SENSITIVE_ACCESS],[R.PREPARADOR_FISICO]:[...Ge,l.VIEW_PRIVATE_NOTES,l.EDIT_PHYSICAL_NOTES,l.USE_COMPARATOR,l.EXPORT_REPORT,l.MANAGE_REPORTS,l.USE_AI,l.VIEW_FAMILY_ADVISOR,l.REQUEST_TEAM_ACCESS,l.VIEW_PLAYER_360,l.VIEW_TRAINING,l.VIEW_EXTERNAL_DEVELOPMENT,l.VIEW_PLAYER_EVALUATION,l.VIEW_OBJECTIVE_PROFILE,l.VIEW_RECOVERY,l.EDIT_RECOVERY,l.VIEW_NUTRITION,l.EDIT_NUTRITION,l.VIEW_WELLNESS_RECOMMENDATIONS,l.VIEW_DATA_COVERAGE,l.VIEW_LONGITUDINAL_ANALYTICS,l.GENERATE_LONGITUDINAL_ANALYTICS,l.VIEW_AI_INSIGHTS,l.GENERATE_AI_INSIGHTS,l.EXPORT_PLAYER_360,l.REQUEST_SENSITIVE_ACCESS],[R.JUGADOR]:[l.NAVIGATE_MODULE,l.SELECT_TEAM,l.SELECT_SEASON,l.VIEW_DASHBOARD,l.VIEW_APPROVAL_CENTER,l.VIEW_TEAM,l.VIEW_ROSTER,l.VIEW_PLAYER_PROFILE,l.VIEW_PLAYER_STATS,l.VIEW_GAMES,l.VIEW_BOXSCORE,l.VIEW_LINEUPS,l.VIEW_ADVANCED_TEAM_STATS,l.VIEW_ADVANCED_PLAYER_STATS,l.GENERATE_REPORT,l.EXPORT_REPORT,l.VIEW_FAMILY_ADVISOR,l.EDIT_OWN_PROFILE,l.CHANGE_OWN_PASSWORD,l.VIEW_ACTIVE_ROLE,l.VIEW_CLUBS,l.VIEW_SEASONS,l.REQUEST_TEAM_ACCESS,l.VIEW_RECOVERY,l.EDIT_RECOVERY,l.VIEW_NUTRITION,l.EDIT_NUTRITION,l.VIEW_WELLNESS_RECOMMENDATIONS,l.VIEW_OWN_PLAYER_360],[R.FAMILIA_TUTOR]:[l.NAVIGATE_MODULE,l.SELECT_TEAM,l.SELECT_SEASON,l.VIEW_DASHBOARD,l.VIEW_APPROVAL_CENTER,l.VIEW_TEAM,l.VIEW_ROSTER,l.VIEW_PLAYER_PROFILE,l.VIEW_PLAYER_STATS,l.VIEW_GAMES,l.VIEW_BOXSCORE,l.VIEW_LINEUPS,l.VIEW_ADVANCED_TEAM_STATS,l.VIEW_ADVANCED_PLAYER_STATS,l.GENERATE_REPORT,l.EXPORT_REPORT,l.USE_AI,l.VIEW_FAMILY_ADVISOR,l.EDIT_OWN_PROFILE,l.CHANGE_OWN_PASSWORD,l.VIEW_ACTIVE_ROLE,l.VIEW_CLUBS,l.VIEW_SEASONS,l.REQUEST_TEAM_ACCESS,l.VIEW_RECOVERY,l.EDIT_RECOVERY,l.VIEW_NUTRITION,l.EDIT_NUTRITION,l.VIEW_WELLNESS_RECOMMENDATIONS,l.VIEW_LINKED_PLAYER_360],[R.VISOR]:[...Ge,l.VIEW_PLAYER_COMPARISON,l.VIEW_DATA_AUDIT,l.USE_COMPARATOR,l.EXPORT_REPORT,l.USE_AI,l.EDIT_OWN_PROFILE,l.CHANGE_OWN_PASSWORD,l.REQUEST_TEAM_ACCESS,l.VIEW_PLAYER_360,l.VIEW_OBJECTIVE_PROFILE,l.VIEW_DATA_COVERAGE],[R.INVITADO]:[...Ge,...Qs,l.REQUEST_TEAM_ACCESS]}),Ks=Object.freeze({[R.SUPERADMIN]:1/0,[R.ADMIN]:200,[R.ENTRENADOR]:100,[R.ANALISTA]:100,[R.PREPARADOR_FISICO]:50,[R.JUGADOR]:0,[R.FAMILIA_TUTOR]:10,[R.VISOR]:20,[R.INVITADO]:10}),Zs=Object.freeze({dashboard:l.VIEW_DASHBOARD,approvals:l.VIEW_APPROVAL_CENTER,requests:l.VIEW_APPROVAL_CENTER,solicitudes:l.VIEW_APPROVAL_CENTER,bandeja:l.VIEW_APPROVAL_CENTER,privacy:l.VIEW_PRIVACY_AUTHORIZATIONS,"privacy-center":l.VIEW_PRIVACY_AUTHORIZATIONS,privacidad:l.VIEW_PRIVACY_AUTHORIZATIONS,team:l.VIEW_TEAM,equipo:l.VIEW_TEAM,players:l.VIEW_ROSTER,jugadores:l.VIEW_ROSTER,training:l.VIEW_TRAINING,entrenamientos:l.VIEW_TRAINING,development:l.VIEW_TRAINING,desarrollo:l.VIEW_TRAINING,nutrition:l.VIEW_NUTRITION,nutricion:l.VIEW_NUTRITION,player360:l.VIEW_PLAYER_360,"player-360":l.VIEW_PLAYER_360,"desarrollo-jugador":l.VIEW_PLAYER_360,player:l.VIEW_PLAYER_PROFILE,jugador:l.VIEW_PLAYER_PROFILE,games:l.VIEW_GAMES,partidos:l.VIEW_GAMES,game:l.VIEW_GAMES,live:l.RECORD_LIVE_GAME,hud:l.RECORD_LIVE_GAME,"live-hud":l.RECORD_LIVE_GAME,"easy-entry":l.RECORD_LIVE_GAME,easy:l.RECORD_LIVE_GAME,"entrada-facil":l.RECORD_LIVE_GAME,"live-entry":l.RECORD_LIVE_GAME,boxscore:l.VIEW_BOXSCORE,registro:l.VIEW_BOXSCORE,lineups:l.VIEW_LINEUPS,quintetos:l.VIEW_LINEUPS,advanced:l.VIEW_ADVANCED_TEAM_STATS,heatmap:l.VIEW_ADVANCED_PLAYER_STATS,calor:l.VIEW_ADVANCED_PLAYER_STATS,shotchart:l.VIEW_ADVANCED_PLAYER_STATS,comparator:l.USE_COMPARATOR,comparador:l.USE_COMPARATOR,reports:l.GENERATE_REPORT,informes:l.GENERATE_REPORT,informe:l.GENERATE_REPORT,"family-advisor":l.VIEW_FAMILY_ADVISOR,business:l.VIEW_BUSINESS_METRICS,negocio:l.VIEW_BUSINESS_METRICS,family:l.VIEW_FAMILY_WORKSPACE,familia:l.VIEW_FAMILY_WORKSPACE,familias:l.VIEW_FAMILY_WORKSPACE,bienestar:l.VIEW_FAMILY_ADVISOR,advisor:l.VIEW_FAMILY_ADVISOR,ask:l.USE_AI,"ask-ai":l.USE_AI,pregunta:l.USE_AI,preguntale:l.USE_AI,ai:l.USE_AI,ia:l.USE_AI,profile:l.EDIT_OWN_PROFILE,perfil:l.EDIT_OWN_PROFILE,settings:l.VIEW_ACTIVE_ROLE,configuracion:l.VIEW_ACTIVE_ROLE,translations:l.MANAGE_TRANSLATIONS}),Pe=Object.freeze({ACTIVE:"ACTIVE",SUSPENDED:"SUSPENDED",DISABLED:"DISABLED",PENDING_ACTIVATION:"PENDING_ACTIVATION"}),Xs=new Set(Object.values(Pe));function Ot(o){if(o==null||String(o).trim()==="")return Pe.ACTIVE;const e=String(o).trim().toUpperCase();return Xs.has(e)?e:Pe.DISABLED}function gs(o){return Ot(o)===Pe.ACTIVE}class _s extends Error{constructor(e){const t=Ot(e);super(`ACCOUNT_NOT_ACTIVE:${t}`),this.name="AccountAccessError",this.code="ACCOUNT_NOT_ACTIVE",this.accountStatus=t}}function er(o){if(!gs(o))throw new _s(o);return!0}const es=Object.freeze({EDIT_PLAY_BY_PLAY:l.EDIT_GAME,VALIDATE_CHANGE_REQUESTS:l.APPROVE_TEAM_ACCESS,VIEW_REPORTS:l.GENERATE_REPORT,EXPORT_REPORTS:l.EXPORT_REPORT,VIEW_TEAM_STATS:l.VIEW_ADVANCED_TEAM_STATS,VIEW_ALL_PLAYER_STATS:l.VIEW_ADVANCED_PLAYER_STATS,MANAGE_USERS:l.VIEW_USERS,CREATE_PLAYER:l.MANAGE_ROSTER,EDIT_PLAYER:l.MANAGE_ROSTER,DELETE_PLAYER:l.MANAGE_ROSTER,CREATE_TEAM:l.MANAGE_TEAMS,EDIT_TEAM:l.MANAGE_TEAMS,DELETE_TEAM:l.MANAGE_TEAMS}),tr=Object.freeze({ADMIN:R.ADMIN,COORDINADOR:R.ADMIN,DIRECTOR_DEPORTIVO:R.ADMIN,ENTRENADOR:R.ENTRENADOR,AYUDANTE:R.ENTRENADOR,ANALISTA:R.ANALISTA,PREPARADOR_FISICO:R.PREPARADOR_FISICO,JUGADOR:R.JUGADOR,FAMILIA_TUTOR:R.FAMILIA_TUTOR,VISOR:R.VISOR}),ar=Object.freeze([R.ADMIN,R.ENTRENADOR,R.ANALISTA,R.PREPARADOR_FISICO,R.JUGADOR,R.FAMILIA_TUTOR,R.VISOR]);function Xe(o){if(!o)return[];if(Array.isArray(o))return o.map(String);if(typeof o=="string")try{const e=JSON.parse(o);return Array.isArray(e)?e.map(String):[String(o)]}catch{return o.split(",").map(e=>e.trim()).filter(Boolean)}return[]}class sr{constructor(e=null){this.currentUser=null,this.previewRole=null,this.teamClubMap=new Map,e&&this.setCurrentUser(e)}setCurrentUser(e){if(!e)return this.currentUser=null,this.previewRole=null,null;const t=ra(e.email),a=Js(e.role,t);return this.currentUser={...e,id:e.id||e.user_id||null,email:t,role:a,globalRole:String(e.globalRole??e.global_role??"").trim().toUpperCase()||null,clubId:e.clubId??e.club_id??null,allowedTeamIds:Xe(e.allowedTeamIds??e.assigned_team_ids??e.allowed_team_ids??e.team_ids??(e.team_id?[e.team_id]:[])),allowedSeasonIds:Xe(e.allowedSeasonIds??e.allowed_season_ids??e.season_ids??[]),allowedTeamSeasonIds:Xe(e.allowedTeamSeasonIds??e.allowed_team_season_ids??[]),allowedGlobalSeasonIds:Xe(e.allowedGlobalSeasonIds??e.allowed_global_season_ids??[]),contextualMemberships:Array.isArray(e.contextualMemberships)?e.contextualMemberships.map(s=>({...s,teamSeasonId:s.teamSeasonId??s.team_season_id??null,teamId:s.teamId??s.team_id??null,globalSeasonId:s.globalSeasonId??s.season_id??null,role:String(s.role??s.function_role??"").trim().toUpperCase(),status:String(s.status||"ACTIVE").trim().toUpperCase()})):[],playerId:e.playerId??e.player_id??e.linked_player_id??null,linkedPlayerIds:Xe(e.linkedPlayerIds??e.linked_player_ids??e.player_ids??(e.linked_player_id?[e.linked_player_id]:[])),registrationStatus:String(e.status||""),accountStatus:Ot(e.accountStatus??e.account_status)},Xa(t)&&(this.currentUser.role=R.SUPERADMIN),this.currentUser}clear(){this.currentUser=null,this.previewRole=null,this.teamClubMap.clear()}setTeamCatalog(e=[]){this.teamClubMap.clear(),(e||[]).forEach(t=>{t!=null&&t.id&&this.teamClubMap.set(String(t.id),String(t.club_id??t.clubId??""))})}getCurrentUser(){return this.currentUser}getAuthenticatedRole(){var e;return((e=this.currentUser)==null?void 0:e.role)||R.INVITADO}getEffectiveRole(e={}){return this.getRoleForContext(e,{preview:!0})}getRoleForContext(e={},{preview:t=!1}={}){var r;const a=this.getAuthenticatedRole();return a===R.SUPERADMIN?t&&this.previewRole?this.previewRole:R.SUPERADMIN:String(((r=this.currentUser)==null?void 0:r.globalRole)||"").toUpperCase()==="ADMIN"?R.ADMIN:this._resolveContextualRole(e)||a}_resolveContextualRole(e={}){var r,i;if(!((i=(r=this.currentUser)==null?void 0:r.contextualMemberships)!=null&&i.length))return null;const t=e.teamSeasonId?String(e.teamSeasonId):"",a=e.teamId?String(e.teamId):"",s=this.currentUser.contextualMemberships.filter(n=>String(n.status||"ACTIVE").toUpperCase()!=="ACTIVE"?!1:t?String(n.teamSeasonId||"")===t:a?String(n.teamId||"")===a:!1).map(n=>tr[String(n.role||"").toUpperCase()]).filter(Boolean);return ar.find(n=>s.includes(n))||null}isAccountActive(){return!!this.currentUser&&gs(this.currentUser.accountStatus)}isAuthenticated(){var e,t;return!!((e=this.currentUser)!=null&&e.id||(t=this.currentUser)!=null&&t.email)&&this.isAccountActive()}isAdmin(){return this.isAccountActive()&&[R.SUPERADMIN,R.ADMIN].includes(this.getAuthenticatedRole())}isScout(){return this.isAccountActive()&&[R.SUPERADMIN,R.ADMIN,R.ENTRENADOR,R.ANALISTA].includes(this.getAuthenticatedRole())}hasRole(e,{preview:t=!0}={}){if(!this.isAccountActive())return!1;const a=t?this.getEffectiveRole():this.getAuthenticatedRole();return(Array.isArray(e)?e:[e]).some(r=>It(r)===a)}can(e,t={}){if(!this.isAccountActive())return!1;const a=es[e]||e,s=this.getRoleForContext(t);return(wt[s]||[]).includes(a)?this._passesScope(t):!1}canPreview(e,t={}){if(!this.isAccountActive())return!1;const a=es[e]||e,s=this.getRoleForContext(t,{preview:!0});return(wt[s]||[]).includes(a)?this._passesScope(t):!1}getAiMonthlyLimit({preview:e=!1}={}){if(!this.isAccountActive())return 0;const t=e?this.getEffectiveRole():this.getAuthenticatedRole();return Ks[t]??0}setPreviewRole(e){return!this.isAccountActive()||this.getAuthenticatedRole()!==R.SUPERADMIN?!1:(this.previewRole=It(e),!0)}clearPreviewRole(){this.previewRole=null}canAccessClub(e){return!this.isAccountActive()||!e||!this.currentUser?!1:this.getAuthenticatedRole()===R.SUPERADMIN?!0:String(this.currentUser.clubId||"")===String(e)}canAccessTeam(e){if(!this.isAccountActive()||!e||!this.currentUser)return!1;const t=this.getAuthenticatedRole();if(t===R.SUPERADMIN)return!0;if(t===R.ADMIN&&this.currentUser.clubId){const a=this.teamClubMap.get(String(e));if(a&&a===String(this.currentUser.clubId))return!0}return this.currentUser.allowedTeamIds.includes(String(e))}canAccessSeason(e){return!this.isAccountActive()||!e||!this.currentUser?!1:this.getAuthenticatedRole()===R.SUPERADMIN||this.currentUser.allowedSeasonIds.length===0?!0:this.currentUser.allowedSeasonIds.includes(String(e))}canAccessTeamSeason(e){if(!this.isAccountActive()||!e||!this.currentUser)return!1;if(this.getAuthenticatedRole()===R.SUPERADMIN)return!0;const t=String(e);return this.currentUser.allowedTeamSeasonIds.includes(t)?!0:this.currentUser.contextualMemberships.some(a=>String(a.teamSeasonId||"")===t&&String(a.status||"ACTIVE").toUpperCase()==="ACTIVE")}getContextRoles(e){if(!this.isAccountActive())return[];if(!e||!this.currentUser)return[];const t=String(e);return this.currentUser.contextualMemberships.filter(a=>String(a.teamSeasonId||"")===t&&String(a.status||"ACTIVE").toUpperCase()==="ACTIVE").map(a=>String(a.role||"").toUpperCase()).filter(Boolean)}canAccessPlayer(e,t=null){if(!this.isAccountActive()||!e||!this.currentUser)return!1;const a=this.getAuthenticatedRole();return a===R.SUPERADMIN?!0:a===R.JUGADOR?String(this.currentUser.playerId||"")===String(e):a===R.FAMILIA_TUTOR?this.currentUser.linkedPlayerIds.includes(String(e)):t?this.canAccessTeam(t):!1}canAssignRole(e,t=""){if(!this.isAccountActive())return!1;const a=It(e),s=Xa(t);return a===R.SUPERADMIN?s&&this.getAuthenticatedRole()===R.SUPERADMIN:s?!1:a===R.ADMIN?this.can(l.ASSIGN_PRIVILEGED_ROLES):this.can(l.ASSIGN_STANDARD_ROLES)}_passesScope(e={}){return!e||Object.keys(e).length===0?!0:!(e.clubId&&!this.canAccessClub(e.clubId)||e.teamId&&!this.canAccessTeam(e.teamId)||e.teamSeasonId&&!this.canAccessTeamSeason(e.teamSeasonId)||e.seasonId&&!this.canAccessSeason(e.seasonId)||e.playerId&&!this.canAccessPlayer(e.playerId,e.playerTeamId||e.teamId))}}function Lt(o=""){const e=String(o||"").trim(),t=e.match(/^(\d{4})\s*[-\/]\s*(\d{4})$/);return t?t[1]+"/"+t[2]:e}function rr({teamId:o,seasonName:e,staffAssignments:t=[],seasons:a=[],team:s=null,fallback:r="Por definir"}={}){const i=String(o||""),n=Lt(e).trim().toLowerCase(),d=(t||[]).filter(_=>{const p=String(_.team_id||_.teamId||"")===i,m=Lt(_.season_name||_.seasonName||"").trim().toLowerCase()===n,f=String(_.staff_role||_.staffRole||"").toUpperCase()==="HEAD_COACH";return p&&m&&f}),c=d.find(_=>String(_.status||"ACTIVE").toUpperCase()==="ACTIVE");if(c)return c.staff_name||c.staffName||c.external_name||c.externalName||r;if(d.length>0)return r;const u=(a||[]).find(_=>{const p=String(_.team_id||_.teamId||"")===i,m=Lt(_.name||"").trim().toLowerCase();return p&&(!n||m===n)});return u!=null&&u.coach_name||u!=null&&u.coachName?u.coach_name||u.coachName:(s==null?void 0:s.coach_name)||(s==null?void 0:s.coachName)||(s==null?void 0:s.coach)||r}class ir{constructor(){this.clubs=[],this.teams=[],this.players=[],this.games=[],this.seasons=[],this.legacySeasons=[],this.staffAssignments=[],this.rosterMemberships=[],this.rosterStints=[],this.playerGameStats=[],this.gamePeriodScores=[],this.gameEvents=[],this.loadedGameEventIds=new Set,this.listeners=new Set,this.isLoaded=!1,this.isLoading=!1,this.permissionService=null,this.seasonContextService=D?new Hs(new zs(D)):null}setPermissionService(e){this.permissionService=e||null}_assertPermission(e,t={},a="Acceso denegado."){if(!this.permissionService)throw new Error("Seguridad no inicializada: no se permite escribir datos.");if(!this.permissionService.can(e,t))throw new Error(a)}_filterAuthorizedData(){var u,_,p;const e=this.permissionService;if(!e||e.getAuthenticatedRole()===R.SUPERADMIN)return;const t=e.getCurrentUser();(u=e.setTeamCatalog)==null||u.call(e,this.teams||[]),new Set(((t==null?void 0:t.allowedTeamIds)||[]).map(String));const a=new Set(((t==null?void 0:t.linkedPlayerIds)||[]).map(String));this.teams=(this.teams||[]).filter(m=>e.canAccessTeam(String(m.id)));const s=String(((_=this.getActiveTeamId)==null?void 0:_.call(this))||""),r=!!(s&&e.canAccessTeam(s)),i=((p=this.getActiveTeamSeasonId)==null?void 0:p.call(this,s))||null,n=new Set((this.rosterMemberships||[]).filter(m=>!i||String(m.team_season_id||m.teamSeasonId||"")===String(i)).map(m=>String(m.player_id||m.playerId||"")).filter(Boolean)),d=new Set;this.players=(this.players||[]).filter(m=>{const f=e.canAccessTeam(String(m.team_id||m.teamId||"")),g=r&&n.has(String(m.id)),E=(t==null?void 0:t.playerId)&&String(t.playerId)===String(m.id),T=a.has(String(m.id)),x=f||g||E||T;return x&&d.add(String(m.id)),x});const c=new Set;if(this.games=(this.games||[]).filter(m=>{const f=e.canAccessTeam(String(m.team_id||m.teamId||""));return f&&c.add(String(m.id)),f}),this.playerGameStats=(this.playerGameStats||[]).filter(m=>c.has(String(m.game_id||m.gameId||""))||d.has(String(m.player_id||m.playerId||""))),this.gamePeriodScores=(this.gamePeriodScores||[]).filter(m=>c.has(String(m.game_id||m.gameId||""))),this.gameEvents=(this.gameEvents||[]).filter(m=>c.has(String(m.game_id||m.gameId||""))),this.staffAssignments=(this.staffAssignments||[]).filter(m=>{const f=String(m.team_id||m.teamId||""),g=String(m.club_id||m.clubId||"");return f&&e.canAccessTeam(f)||(t==null?void 0:t.clubId)&&g===String(t.clubId)}),t!=null&&t.clubId)this.clubs=(this.clubs||[]).filter(m=>String(m.id)===String(t.clubId));else{const m=new Set(this.teams.map(f=>String(f.club_id||f.clubId||"")));this.clubs=(this.clubs||[]).filter(f=>m.has(String(f.id)))}}_generateUUID(){return typeof crypto<"u"&&crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(e){const t=Math.random()*16|0;return(e==="x"?t:t&3|8).toString(16)})}_normalizeTeam(e){return e&&{...e,id:String(e.id),club_id:e.club_id||e.clubId||null,clubId:e.club_id||e.clubId||null,name:e.name||"Equipo",category:e.category||"General",competition:e.competition||"Liga",coach_name:e.coach_name||e.coachName||e.coach||"Por definir",coachName:e.coach_name||e.coachName||e.coach||"Por definir",coach:e.coach_name||e.coachName||e.coach||"Por definir",color:e.color||"#1e3a8a"}}_normalizeStaffAssignment(e){if(!e)return e;const t=e.staff_name||e.staffName||e.external_name||e.externalName||e.user_name||e.userName||"";return{...e,id:String(e.id),club_id:e.club_id||e.clubId||null,clubId:e.club_id||e.clubId||null,team_id:e.team_id||e.teamId||null,teamId:e.team_id||e.teamId||null,team_season_id:e.team_season_id||e.teamSeasonId||null,teamSeasonId:e.team_season_id||e.teamSeasonId||null,season_name:e.season_name||e.seasonName||"",seasonName:e.season_name||e.seasonName||"",staff_role:e.staff_role||e.staffRole||"",staffRole:e.staff_role||e.staffRole||"",staff_name:t,staffName:t,external_name:e.external_name||e.externalName||null,externalName:e.external_name||e.externalName||null,user_id:e.user_id||e.userId||null,userId:e.user_id||e.userId||null,status:String(e.status||"ACTIVE").toUpperCase()}}_normalizePlayer(e){if(!e)return e;const t=e.first_name||e.firstName||"",a=e.last_name||e.lastName||"",s=e.jersey!==void 0&&e.jersey!==null?String(e.jersey):e.number?String(e.number):"?",r=e.primary_position||e.primaryPosition||e.position||"Alero";return{...e,id:String(e.id),team_id:e.team_id||e.teamId||null,teamId:e.team_id||e.teamId||null,first_name:t,firstName:t,last_name:a,lastName:a,name:`${t} ${a}`.trim()||e.name||`Jugador #${s}`,jersey:s,number:s,primary_position:r,primaryPosition:r,position:r,height:e.height||e.height_cm||"1.88 m",status:e.status||"Activo"}}_normalizeGame(e){if(!e)return e;const t=Number(e.team_score??e.teamScore??e.our_score??e.points??0),a=Number(e.opponent_score??e.opponentScore??e.opp_score??e.opp_points??0),s=e.opponent||e.opponent_name||e.opponentName||"Rival",r=String(e.edit_state||e.editState||"OPEN").toUpperCase(),i=r==="LOCKED";return{...e,id:String(e.id),team_id:e.team_id||e.teamId||null,teamId:e.team_id||e.teamId||null,season_id:e.season_id||e.seasonId||null,seasonId:e.season_id||e.seasonId||null,team_season_id:e.team_season_id||e.teamSeasonId||null,teamSeasonId:e.team_season_id||e.teamSeasonId||null,opponent:s,opponent_name:s,opponentName:s,team_score:t,teamScore:t,our_score:t,opponent_score:a,opponentScore:a,opp_score:a,date:e.date||"",venue:e.venue||"Local",status:e.status||"Finalizado",edit_state:r,editState:r,is_locked:i,isLocked:i,locked_at:e.locked_at||e.lockedAt||null,lockedAt:e.locked_at||e.lockedAt||null,locked_by:e.locked_by||e.lockedBy||null,lockedBy:e.locked_by||e.lockedBy||null,lock_reason:e.lock_reason||e.lockReason||null,lockReason:e.lock_reason||e.lockReason||null,reopened_at:e.reopened_at||e.reopenedAt||null,reopenedAt:e.reopened_at||e.reopenedAt||null,reopened_by:e.reopened_by||e.reopenedBy||null,reopenedBy:e.reopened_by||e.reopenedBy||null}}_normalizeStat(e){if(!e)return e;const t=Number(e.fg2_made??e.fg2Made??e.points_2_made??0),a=Number(e.fg2_attempted??e.fg2Attempted??e.points_2_attempted??0),s=Number(e.fg3_made??e.fg3Made??e.points_3_made??0),r=Number(e.fg3_attempted??e.fg3Attempted??e.points_3_attempted??0),i=Number(e.ft_made??e.ftMade??e.free_throws_made??0),n=Number(e.ft_attempted??e.ftAttempted??e.free_throws_attempted??0),d=Number(e.off_reb??e.offReb??e.rebounds_offensive??0),c=Number(e.def_reb??e.defReb??e.rebounds_defensive??0),u=Number(e.rebounds??d+c),_=Number(e.assists??e.ast??0),p=Number(e.steals??e.stl??0),m=Number(e.blocks??e.blocks_made??e.blocksMade??0),f=Number(e.turnovers??e.tov??0),g=Number(e.fouls_committed??e.foulsCommitted??e.fouls??0),E=Number(e.fouls_drawn??e.foulsDrawn??e.fouls_received??0),T=Number(e.plus_minus??e.plusMinus??0),x=!!(e.starter||e.isStarter),S=e.points!==void 0&&e.points!==null&&Number(e.points)>0?Number(e.points):t*2+s*3+i,M=a+r,v=t+s,A=Math.max(0,M-v),C=Math.max(0,n-i),O=S+u+_+p+m+E-(A+C+f+g);return{...e,game_id:String(e.game_id||e.gameId),gameId:String(e.game_id||e.gameId),player_id:String(e.player_id||e.playerId),playerId:String(e.player_id||e.playerId),starter:x,minutes:Number(e.minutes??e.minutesPlayed??0),minutesPlayed:Number(e.minutes??e.minutesPlayed??0),points:S,fg2_made:t,fg2Made:t,fg2_attempted:a,fg2Attempted:a,fg3_made:s,fg3Made:s,fg3_attempted:r,fg3Attempted:r,ft_made:i,ftMade:i,ft_attempted:n,ftAttempted:n,off_reb:d,offReb:d,def_reb:c,defReb:c,rebounds:u,assists:_,ast:_,steals:p,stl:p,blocks:m,blocks_made:m,turnovers:f,tov:f,fouls_committed:g,fouls:g,fouls_drawn:E,foulsDrawn:E,plus_minus:T,evaluation:Number(e.evaluation??O),val:Number(e.evaluation??O),pir:Number(e.evaluation??O)}}async _loadSeasonContexts(e){if(!e||!D)return this.seasons=[],this.legacySeasons=[],null;const{data:t,error:a}=await D.from("seasons").select("id,team_id,name,start_date,end_date,coach_name,created_at").eq("team_id",e).order("created_at",{ascending:!1});a?(console.warn("[DataStore] No se pudieron cargar temporadas legacy:",a.message),this.legacySeasons=[]):this.legacySeasons=t||[];try{const i=this.seasonContextService?await this.seasonContextService.listByTeam(e,{status:"ACTIVE"}):[];if(i.length>0){const n=new Map((this.legacySeasons||[]).map(d=>[String(d.id),d]));this.seasons=i.map(d=>{const c=n.get(String(d.legacy_season_id||""));return{...d,coach_name:(c==null?void 0:c.coach_name)||null,legacy_name:(c==null?void 0:c.name)||null}})}else this.seasons=this.legacySeasons||[]}catch(i){console.warn("[DataStore] Contexto v3 no disponible; se mantiene compatibilidad legacy:",i.message),this.seasons=this.legacySeasons||[]}const s=typeof localStorage<"u"?localStorage.getItem("iq_active_season"):null,r=this._resolveSeasonContext(s,e);return r!=null&&r.name&&typeof localStorage<"u"&&localStorage.setItem("iq_active_season",String(r.name)),r}async _loadCanonicalStaffAssignments(e=null){const t=(e==null?void 0:e.global_season_id)||(e==null?void 0:e.globalSeasonId)||(e==null?void 0:e.season_id)||(e==null?void 0:e.seasonId)||null;if(!(!D||!t))try{const{data:a,error:s}=await D.from("team_seasons").select("id,team_id,season_id,status").eq("season_id",t);if(s)throw s;const r=a||[],i=r.map(f=>f.id).filter(Boolean);if(i.length===0){this.staffAssignments=[];return}const{data:n,error:d}=await D.from("team_season_staff_assignments").select("id,team_season_id,staff_role,user_id,external_name,status,created_at,updated_at").in("team_season_id",i);if(d)throw d;const c=n||[],u=[...new Set(c.map(f=>f.user_id).filter(Boolean).map(String))],_=new Map;if(u.length>0){const{data:f,error:g}=await D.from("user_profiles").select("id,first_name,last_name,email").in("id",u);if(g)throw g;(f||[]).forEach(E=>{const T=[E.first_name,E.last_name].filter(Boolean).join(" ").trim();_.set(String(E.id),T||E.email||"Staff")})}const p=new Map(r.map(f=>[String(f.id),f])),m=this._formatSeasonDisplayName((e==null?void 0:e.name)||(e==null?void 0:e.code)||"");this.staffAssignments=c.map(f=>{const g=p.get(String(f.team_season_id)),E=f.user_id?_.get(String(f.user_id)):"";return this._normalizeStaffAssignment({...f,team_id:(g==null?void 0:g.team_id)||null,season_name:m,staff_name:f.external_name||E||""})})}catch(a){console.warn("[DataStore] No se pudo hidratar staff v3 por temporada:",(a==null?void 0:a.message)||a)}}_resolveSeasonContext(e=null,t=null){const a=this.getSeasons(t);if(a.length===0)return null;if(this.seasonContextService&&a.some(i=>i.source==="v3"))return this.seasonContextService.resolve(a,e);if(!e)return a[0];const s=i=>String(i??"").trim().toLowerCase().replace(/[^a-z0-9]/g,""),r=s(e);return a.find(i=>{const n=[i.id,i.name].map(s).filter(Boolean);return n.includes(r)||n.some(d=>d.includes(r)||r.includes(d))})||a[0]}async init(e=null,t=!1){var a,s,r;if(!(this.isLoaded&&!t)&&!this.isLoading){this.isLoading=!0,e&&this.setActiveTeamAndSeason(e,null);try{if(typeof localStorage<"u"){const i=localStorage.getItem("iq_cache_teams"),n=localStorage.getItem("iq_cache_players"),d=localStorage.getItem("iq_cache_games"),c=localStorage.getItem("iq_cache_staff_assignments"),u=localStorage.getItem("iq_cache_roster_memberships"),_=localStorage.getItem("iq_cache_roster_stints"),p=localStorage.getItem("iq_cache_stats"),m=localStorage.getItem("iq_cache_periods"),f=localStorage.getItem("iq_cache_events");i&&(this.teams=JSON.parse(i).map(g=>this._normalizeTeam(g))),n&&(this.players=JSON.parse(n).map(g=>this._normalizePlayer(g))),d&&(this.games=JSON.parse(d).map(g=>this._normalizeGame(g))),c&&(this.staffAssignments=JSON.parse(c).map(g=>this._normalizeStaffAssignment(g))),u&&(this.rosterMemberships=JSON.parse(u)),_&&(this.rosterStints=JSON.parse(_)),p&&(this.playerGameStats=JSON.parse(p).map(g=>this._normalizeStat(g))),m&&(this.gamePeriodScores=JSON.parse(m)),f&&(this.gameEvents=JSON.parse(f),this.gameEvents.forEach(g=>{const E=(g==null?void 0:g.game_id)||(g==null?void 0:g.gameId);E&&this.loadedGameEventIds.add(String(E))}))}if(D){const[i,n]=await Promise.allSettled([D.from("clubs").select("id,name,logo_url,created_by,created_at,phone,address,coordinator_name"),D.from("teams").select("id,club_id,name,category,competition,color,logo_url,periods_count,period_minutes,coach_name,created_at")]);i.status==="fulfilled"&&!i.value.error&&Array.isArray(i.value.data)&&(this.clubs=i.value.data),n.status==="fulfilled"&&!n.value.error&&Array.isArray(n.value.data)&&(this.teams=n.value.data.map(S=>this._normalizeTeam(S))),(s=(a=this.permissionService)==null?void 0:a.setTeamCatalog)==null||s.call(a,this.teams||[]);const d=typeof localStorage<"u"?localStorage.getItem("iq_active_team_id"):null,c=String(e||d||"").trim(),u=c&&(this.teams||[]).some(S=>String(S.id)===c),_=this.permissionService,p=((r=_==null?void 0:_.getAuthenticatedRole)==null?void 0:r.call(_))===R.SUPERADMIN,m=u&&(!_||p||_.canAccessTeam(c)),f=(this.teams||[]).find(S=>!_||p||_.canAccessTeam(String(S.id))),g=m?c:f!=null&&f.id?String(f.id):"";if(g&&typeof localStorage<"u"&&localStorage.setItem("iq_active_team_id",g),!!(_&&!p&&!g))this.players=[],this.games=[],this.seasons=[],this.legacySeasons=[],this.rosterMemberships=[],this.rosterStints=[],this.staffAssignments=[];else{const S=await this._loadSeasonContexts(g);await this._loadCanonicalStaffAssignments(S);let M=D.from("players").select("*"),v=D.from("games").select("id,team_id,season_id,team_season_id,date,time,opponent,competition,round,venue,venue_name,periods_count,period_minutes,status,periods,team_score,opponent_score,observations,video_url,created_at,starter_ids,notes,has_overtime,overtime_count,edit_state,locked_at,locked_by,lock_reason,reopened_at,reopened_by").order("date",{ascending:!1});g&&(M=M.eq("team_id",g),v=v.eq("team_id",g));const A=this.getActiveTeamSeasonId(g);A&&(v=v.eq("team_season_id",A));const[C,O]=await Promise.allSettled([M,v]);if(this.rosterMemberships=[],this.rosterStints=[],A)try{const{data:L,error:y}=await D.from("roster_memberships").select("id,player_id,team_season_id,jersey,primary_position,secondary_positions,status,joined_at,left_at").eq("team_season_id",A);if(y)console.warn("[DataStore] Plantilla v3 no disponible:",y.message);else{this.rosterMemberships=L||[];const F=this.rosterMemberships.map(k=>k.id).filter(Boolean);if(F.length>0){const{data:k,error:W}=await D.from("roster_membership_stints").select("id,roster_membership_id,valid_from,valid_until,source,notes").in("roster_membership_id",F);W?/roster_membership_stints|does not exist|schema cache/i.test(String(W.message||""))||console.warn("[DataStore] No se pudieron cargar periodos de plantilla:",W.message):this.rosterStints=k||[]}}}catch(L){console.warn("[DataStore] Plantilla v3 no disponible:",L.message)}if(C.status==="fulfilled"&&!C.value.error){this.players=(C.value.data||[]).map(F=>this._normalizePlayer(F));const L=new Set(this.players.map(F=>String(F.id))),y=this.rosterMemberships.map(F=>String(F.player_id||"")).filter(F=>F&&!L.has(F));if(y.length>0){const{data:F,error:k}=await D.from("players").select("*").in("id",y);k||(F||[]).forEach(W=>{L.has(String(W.id))||(this.players.push(this._normalizePlayer(W)),L.add(String(W.id)))})}}O.status==="fulfilled"&&!O.value.error&&(this.games=(O.value.data||[]).map(L=>this._normalizeGame(L)))}const T=(this.games||[]).map(S=>String(S.id)).filter(Boolean);if(T.length>0){const[S,M]=await Promise.all([this._fetchRowsByGameIds("player_game_stats",T),this._fetchRowsByGameIds("game_period_scores",T)]);this.playerGameStats=S.map(v=>this._normalizeStat(v)),this.gamePeriodScores=M}else this.playerGameStats=[],this.gamePeriodScores=[];const x=new Set(T);this.gameEvents=(this.gameEvents||[]).filter(S=>x.has(String(S.game_id||S.gameId||""))),this.loadedGameEventIds=new Set([...this.loadedGameEventIds].filter(S=>x.has(String(S)))),this._filterAuthorizedData(),this._persistToStorage()}this._filterAuthorizedData()}catch(i){console.warn("[DataStore] Inicialización local:",i.message)}finally{this.isLoaded=!0,this.isLoading=!1,this._notifyListeners()}}}async _fetchRowsByGameIds(e,t=[],a="*"){if(!D)return[];const s=[...new Set((t||[]).map(String).filter(Boolean))];if(s.length===0)return[];const r=100,i=[];for(let n=0;n<s.length;n+=r){const d=s.slice(n,n+r),{data:c,error:u}=await D.from(e).select(a).in("game_id",d);if(u){console.warn(`[DataStore] Error cargando ${e} por game_id:`,u.message);continue}Array.isArray(c)&&i.push(...c)}return i}_persistToStorage(){if(!(typeof localStorage>"u"))try{localStorage.setItem("iq_cache_teams",JSON.stringify(this.teams)),localStorage.setItem("iq_cache_players",JSON.stringify(this.players)),localStorage.setItem("iq_cache_games",JSON.stringify(this.games)),localStorage.setItem("iq_cache_staff_assignments",JSON.stringify(this.staffAssignments)),localStorage.setItem("iq_cache_roster_memberships",JSON.stringify(this.rosterMemberships)),localStorage.setItem("iq_cache_roster_stints",JSON.stringify(this.rosterStints)),localStorage.setItem("iq_cache_stats",JSON.stringify(this.playerGameStats)),localStorage.setItem("iq_cache_periods",JSON.stringify(this.gamePeriodScores)),localStorage.setItem("iq_cache_events",JSON.stringify(this.gameEvents))}catch(e){console.warn("[DataStore] Error persistiendo en LocalStorage:",e.message)}}getActiveTeamId(){if(typeof localStorage<"u"){const e=localStorage.getItem("iq_active_team_id");if(e)return e}return this.teams.length>0?String(this.teams[0].id):""}getSeasons(e=null){const t=String(e||this.getActiveTeamId()||"");return(this.seasons||[]).filter(a=>{const s=String(a.team_id||a.teamId||"");return!s||!t||s===t})}getActiveSeason(){const e=this.getActiveTeamId(),t=typeof localStorage<"u"?localStorage.getItem("iq_active_season"):null,a=this._resolveSeasonContext(t,e);return a!=null&&a.name?String(a.name):""}_formatSeasonDisplayName(e=""){const t=String(e||"").trim(),a=t.match(/^(\d{4})\s*[-\/]\s*(\d{4})$/);return a?`${a[1]}/${a[2]}`:t}getActiveSeasonDisplayName(e=null){const t=String(e||this.getActiveTeamId()||""),a=this.getActiveSeasonContext(t);if((a==null?void 0:a.source)==="v3"&&(a!=null&&a.name))return this._formatSeasonDisplayName(a.name);const s=[...new Set((this.games||[]).filter(r=>!t||String(r.team_id||r.teamId||"")===t).map(r=>r.season_id||r.seasonId).filter(Boolean).map(String))];if(s.length===1){const r=(this.legacySeasons||this.seasons||[]).find(i=>String(i.id||"")===s[0]);if(r!=null&&r.name)return this._formatSeasonDisplayName(r.name)}return this._formatSeasonDisplayName((a==null?void 0:a.name)||this.getActiveSeason()||"")}getActiveSeasonContext(e=null){const t=String(e||this.getActiveTeamId()||""),a=typeof localStorage<"u"?localStorage.getItem("iq_active_season"):null;return this._resolveSeasonContext(a,t)}async getAllTeamSeasonContexts({status:e="ACTIVE"}={}){if(!this.seasonContextService)return[];const t=this.getTeams()||[];return t.length===0?[]:(await Promise.allSettled(t.filter(s=>s==null?void 0:s.id).map(async s=>(await this.seasonContextService.listByTeam(s.id,{status:e})||[]).map(i=>({...i,team_name:s.name||"Equipo",team_category:s.category||"",team_competition:s.competition||"",team_club_id:s.club_id||s.clubId||null}))))).filter(s=>s.status==="fulfilled").flatMap(s=>s.value||[])}getActiveSeasonId(e=null){const t=this.getActiveSeasonContext(e);return(t==null?void 0:t.legacy_season_id)||(t==null?void 0:t.legacySeasonId)||(t==null?void 0:t.id)||null}getActiveTeamSeasonId(e=null){const t=this.getActiveSeasonContext(e);return(t==null?void 0:t.team_season_id)||(t==null?void 0:t.teamSeasonId)||null}getActiveGlobalSeasonId(e=null){const t=this.getActiveSeasonContext(e);return(t==null?void 0:t.global_season_id)||(t==null?void 0:t.globalSeasonId)||null}setActiveTeamAndSeason(e,t){return e&&this.permissionService&&!this.permissionService.canAccessTeam(e)?(console.warn("[DataStore] Intento de seleccionar un equipo no autorizado:",e),!1):(typeof localStorage<"u"&&(e&&localStorage.setItem("iq_active_team_id",String(e)),t&&localStorage.setItem("iq_active_season",String(t))),this._notifyListeners(),!0)}getClubs(){return this.clubs||[]}getClubById(e){return e&&(this.clubs||[]).find(t=>String(t.id).toLowerCase()===String(e).toLowerCase())||null}getTeams(){return!this.teams||this.teams.length===0?this.permissionService&&this.permissionService.getAuthenticatedRole()!==R.SUPERADMIN?[]:[{id:this.getActiveTeamId(),name:"Equipo Principal",category:"Sénior",competition:"Liga",coachName:"Por definir",color:"#1e3a8a"}]:this.teams}getTeamById(e){const t=String(e||this.getActiveTeamId()).toLowerCase();return this.getTeams().find(a=>String(a.id).toLowerCase()===t)||this.getTeams()[0]}getStaffAssignments({clubId:e=null,teamId:t=null,seasonName:a=null,role:s=null}={}){return(this.staffAssignments||[]).filter(r=>!(e&&String(r.club_id||r.clubId||"")!==String(e)||t&&String(r.team_id||r.teamId||"")!==String(t)||a&&String(r.season_name||r.seasonName||"").trim().toLowerCase()!==String(a).trim().toLowerCase()||s&&String(r.staff_role||r.staffRole||"").toUpperCase()!==String(s).toUpperCase()))}getTeamCoach(e=null,t=null){const a=e||this.getActiveTeamId(),s=t||this.getActiveSeason()||"";return rr({teamId:a,seasonName:s,staffAssignments:this.staffAssignments||[],seasons:this.seasons||[],team:this.getTeamById(a),fallback:"Por definir"})}getClubCoordinator(e,t=null){const a=t||this.getActiveSeason(),s=this.getStaffAssignments({clubId:e,seasonName:a,role:"COORDINATOR"}).find(i=>!(i.team_id||i.teamId));if(s)return s.staff_name||s.staffName||"No asignado";const r=this.getClubById(e);return(r==null?void 0:r.coordinator_name)||(r==null?void 0:r.coordinatorName)||"No asignado"}setStaffAssignmentLocal(e){const t=this._normalizeStaffAssignment(e),a=(this.staffAssignments||[]).findIndex(s=>String(s.id)===String(t.id)||String(s.team_id||s.teamId||"")===String(t.team_id||t.teamId||"")&&String(s.club_id||s.clubId||"")===String(t.club_id||t.clubId||"")&&String(s.season_name||s.seasonName||"").toLowerCase()===String(t.season_name||t.seasonName||"").toLowerCase()&&String(s.staff_role||s.staffRole||"").toUpperCase()===String(t.staff_role||t.staffRole||"").toUpperCase());a>=0?this.staffAssignments[a]=t:this.staffAssignments.push(t),this._persistToStorage(),this._notifyListeners()}getPlayerDirectory(){return[...this.players||[]]}getTeamPlayers(e=null){const t=this.players||[],a=String(e||this.getActiveTeamId()).toLowerCase();return[...t.filter(r=>String(r.team_id||r.teamId||"").toLowerCase()===a)].sort((r,i)=>(Number(r.jersey)||0)-(Number(i.jersey)||0))}_getRosterMembershipsForTeamSeason(e){return e?(this.rosterMemberships||[]).filter(t=>String(t.team_season_id||t.teamSeasonId||"")===String(e)):[]}_getStintsForMembership(e){return e?(this.rosterStints||[]).filter(t=>String(t.roster_membership_id||t.rosterMembershipId||"")===String(e)):[]}_dateOnly(e=null){if(!e)return"";const t=String(e);return t.length>=10?t.slice(0,10):t}_todayLocalDate(){const e=new Date;return[e.getFullYear(),String(e.getMonth()+1).padStart(2,"0"),String(e.getDate()).padStart(2,"0")].join("-")}_getSeasonReferenceDate(e=null){const t=this.getActiveSeasonContext(e),a=this._todayLocalDate(),s=this._dateOnly((t==null?void 0:t.start_date)||(t==null?void 0:t.startDate)),r=this._dateOnly((t==null?void 0:t.end_date)||(t==null?void 0:t.endDate));return s&&a<s?s:r&&a>r?r:a}_membershipRepresentsParticipation(e,t=null){if(!e)return!1;const a=String(e.player_id||e.playerId||"");return t!=null&&t.has(a)||this._getStintsForMembership(e.id).length>0||this._dateOnly(e.joined_at)||this._dateOnly(e.left_at)?!0:["ACTIVE","ACTIVO"].includes(String(e.status||"").toUpperCase())}_membershipEligibleOnDate(e,t){if(!e)return!1;const a=this._dateOnly(t)||this._todayLocalDate(),s=this._getStintsForMembership(e.id);if(s.length>0)return s.some(d=>{const c=this._dateOnly(d.valid_from),u=this._dateOnly(d.valid_until);return!!c&&c<=a&&(!u||u>=a)});const r=String(e.status||"ACTIVE").toUpperCase(),i=this._dateOnly(e.joined_at),n=this._dateOnly(e.left_at);return["ACTIVE","ACTIVO"].includes(r)&&(!i||i<=a)&&(!n||n>=a)}_applyRosterMembership(e,t){return!e||!t?e:{...e,roster_membership_id:t.id,rosterMembershipId:t.id,roster_status:t.status,rosterStatus:t.status,roster_stints:this._getStintsForMembership(t.id),rosterStints:this._getStintsForMembership(t.id),jersey:t.jersey??e.jersey,number:t.jersey??e.number??e.jersey,primary_position:t.primary_position||e.primary_position,primaryPosition:t.primary_position||e.primaryPosition,position:t.primary_position||e.position}}getPlayersEligibleOnDate(e=null,t=null){const a=e||this.getActiveTeamId(),s=this.getActiveTeamSeasonId(a),r=this.getTeamPlayers(a);if(!s)return r;const i=this._getRosterMembershipsForTeamSeason(s);if(i.length===0)return r;const n=new Map((this.players||[]).map(d=>[String(d.id),d]));return i.filter(d=>this._membershipEligibleOnDate(d,t)).map(d=>{const c=n.get(String(d.player_id||d.playerId));return c?this._applyRosterMembership(c,d):null}).filter(Boolean).sort((d,c)=>(Number(d.jersey)||0)-(Number(c.jersey)||0))}getPlayersForActiveSeason(e=null){const t=e||this.getActiveTeamId();return this.getPlayersEligibleOnDate(t,this._getSeasonReferenceDate(t))}getSeasonParticipantPlayers(e=null){const t=e||this.getActiveTeamId(),a=this.getActiveTeamSeasonId(t),s=this.getTeamPlayers(t);if(!a)return s;const r=this._getRosterMembershipsForTeamSeason(a),i=new Map((this.players||[]).map(u=>[String(u.id),u])),n=new Set(this.getGamesForActiveSeason(t).map(u=>String(u.id))),d=new Set((this.playerGameStats||[]).filter(u=>n.has(String(u.game_id||u.gameId||""))).map(u=>String(u.player_id||u.playerId||"")).filter(Boolean)),c=new Map;return r.filter(u=>this._membershipRepresentsParticipation(u,d)).forEach(u=>{const _=i.get(String(u.player_id||u.playerId));_&&c.set(String(_.id),this._applyRosterMembership(_,u))}),d.forEach(u=>{if(c.has(u))return;const _=i.get(u);_&&c.set(u,_)}),c.size===0?s:[...c.values()].sort((u,_)=>(Number(u.jersey)||0)-(Number(_.jersey)||0))}getEligibleGamesForPlayer(e,t=null){if(!e)return[];const a=t||this.getActiveTeamId(),s=this.getActiveTeamSeasonId(a),r=this._getRosterMembershipsForTeamSeason(s).find(i=>String(i.player_id||i.playerId||"")===String(e));return r?this.getGamesForActiveSeason(a).filter(i=>this._membershipEligibleOnDate(r,i.date)):[]}getPlayers(e=null){return this.getPlayersForActiveSeason(e)}getPlayerById(e){return e&&(this.players||[]).find(t=>String(t.id)===String(e))||null}getGames(e=null){const t=this.games||[],a=String(e||this.getActiveTeamId()).toLowerCase();return[...t.filter(r=>String(r.team_id||r.teamId||"").toLowerCase()===a)].sort((r,i)=>new Date(i.date||0)-new Date(r.date||0))}getGamesForActiveSeason(e=null){const t=String(e||this.getActiveTeamId()||""),a=this.getGames(t);if(a.length===0)return[];const s=this.getActiveSeasonContext(t),r=(s==null?void 0:s.team_season_id)||(s==null?void 0:s.teamSeasonId)||null,i=(s==null?void 0:s.legacy_season_id)||(s==null?void 0:s.legacySeasonId)||(s==null?void 0:s.id)||null,n=a.filter(c=>!!(c.team_season_id||c.teamSeasonId));if(r&&n.length>0){const c=a.filter(u=>String(u.team_season_id||u.teamSeasonId||"")===String(r));if(c.length>0)return c}const d=[...new Set(a.map(c=>c.season_id||c.seasonId).filter(Boolean).map(String))];if(i){const c=a.filter(u=>String(u.season_id||u.seasonId||"")===String(i));if(c.length>0)return c}return d.length<=1?a:[]}getGameById(e){return e&&(this.games||[]).find(t=>String(t.id)===String(e))||null}getPlayerGameStats(e=null,t=null){let a=this.playerGameStats||[];return e&&(a=a.filter(s=>String(s.player_id||s.playerId)===String(e))),t&&(a=a.filter(s=>String(s.game_id||s.gameId)===String(t))),a}getGamePeriodScores(e){return e?(this.gamePeriodScores||[]).filter(t=>String(t.game_id||t.gameId)===String(e)).sort((t,a)=>Number(t.period_number??t.periodNumber??1)-Number(a.period_number??a.periodNumber??1)):[]}getGameEvents(e=null){return e?(this.gameEvents||[]).filter(t=>String(t.game_id||t.gameId)===String(e)):this.gameEvents||[]}async loadGameEvents(e=[],t=!1){const a=[...new Set((Array.isArray(e)?e:[e]).map(String).filter(Boolean))];if(a.length===0||!D)return[];const s=t?a:a.filter(i=>!this.loadedGameEventIds.has(i));if(s.length>0){const i=await this._fetchRowsByGameIds("game_events",s),n=new Set(s),d=(this.gameEvents||[]).filter(c=>!n.has(String(c.game_id||c.gameId||"")));this.gameEvents=[...d,...i],s.forEach(c=>this.loadedGameEventIds.add(String(c))),this._persistToStorage()}const r=new Set(a);return(this.gameEvents||[]).filter(i=>r.has(String(i.game_id||i.gameId||"")))}async saveGameAndStats(e,t=[],a=[],s=[]){const r=e.team_id||e.teamId||this.getActiveTeamId(),i=e.season_id||e.seasonId||this.getActiveSeasonId(r),n=e.team_season_id||e.teamSeasonId||this.getActiveTeamSeasonId(r),d=e.id?this.games.find(y=>String(y.id)===String(e.id)):null;if(d&&String(d.edit_state||d.editState||"OPEN").toUpperCase()==="LOCKED")throw new Error("Partido cerrado: reabre el partido antes de modificar datos.");const c=d?l.EDIT_GAME:l.CREATE_GAME;this._assertPermission(c,{teamId:r,seasonId:i,teamSeasonId:n},d?"No tienes permiso para modificar este partido.":"No tienes permiso para crear partidos en este equipo.");const u=y=>typeof y=="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(y),_=e.id&&u(e.id)?e.id:this._generateUUID(),p=e.team_id||e.teamId||this.getActiveTeamId(),m=e.season_id||e.seasonId||this.getActiveSeasonId(p),f=e.team_season_id||e.teamSeasonId||n||this.getActiveTeamSeasonId(p);if(!f)throw new Error("No se pudo resolver el contexto equipo-temporada v3 para guardar el partido.");const g=this._normalizeGame({...e,id:_,team_id:p,season_id:m,team_season_id:f}),E=t.map(y=>this._normalizeStat({...y,game_id:_})),T=new Set(this.getPlayersEligibleOnDate(p,g.date).map(y=>String(y.id))),x=[...new Set(E.map(y=>String(y.player_id||y.playerId||"")).filter(y=>y&&!T.has(y)))],S=[...new Set((s||[]).map(y=>String(y.player_id||y.playerId||"")).filter(y=>y&&!T.has(y)))],v=(Array.isArray(e.starter_ids||e.starterIds)?(e.starter_ids||e.starterIds).map(String):[]).filter(y=>!T.has(y)),A=[...new Set([...x,...S,...v])];if(A.length>0){const y=A.map(F=>{const k=this.getPlayerById(F);return(k==null?void 0:k.name)||[k==null?void 0:k.first_name,k==null?void 0:k.last_name].filter(Boolean).join(" ")||F});throw new Error(`Hay jugadores no elegibles para este equipo en la fecha ${g.date}: ${y.join(", ")}.`)}const C=this.games.findIndex(y=>String(y.id)===String(_));C>=0?this.games[C]=g:this.games.unshift(g),this.playerGameStats=this.playerGameStats.filter(y=>String(y.game_id||y.gameId)!==String(_)),this.playerGameStats.push(...E);const O=a.map(y=>({id:y.id&&u(y.id)?y.id:this._generateUUID(),game_id:_,period_type:y.period_type||(y.is_overtime?"overtime":"quarter"),period_number:Number(y.period_number??y.periodNumber??1),team_score:Number(y.team_score??y.teamScore??0),opponent_score:Number(y.opponent_score??y.opponentScore??0),is_overtime:!!(y.is_overtime??y.isOvertime??!1)}));this.gamePeriodScores=this.gamePeriodScores.filter(y=>String(y.game_id||y.gameId)!==String(_)),this.gamePeriodScores.push(...O);const L=s.map((y,F)=>{var H,K,ne;const k=y.player_id||y.playerId||null,W=y.action_type||y.action||y.event_type||"fg2_attempted",G=y.coord_x!==void 0&&y.coord_x!==null?parseFloat(Number(y.coord_x).toFixed(2)):((H=y.coordinates)==null?void 0:H.x)!==void 0?parseFloat(Number(y.coordinates.x).toFixed(2)):null,w=y.coord_y!==void 0&&y.coord_y!==null?parseFloat(Number(y.coord_y).toFixed(2)):((K=y.coordinates)==null?void 0:K.y)!==void 0?parseFloat(Number(y.coordinates.y).toFixed(2)):null;return{id:y.id&&u(y.id)?y.id:this._generateUUID(),game_id:_,player_id:k&&u(k)?k:null,team_id:p,period:Number(y.period||1),game_clock:y.game_clock||y.timeRemaining?String(y.game_clock||"10:00"):"10:00",action_type:W,points:Number(y.points||0),made:!!(y.made??((ne=y.coordinates)==null?void 0:ne.made)??!1),coord_x:G,coord_y:w}});if(this.gameEvents=this.gameEvents.filter(y=>String(y.game_id||y.gameId)!==String(_)),this.gameEvents.push(...L),this._persistToStorage(),D)try{const y={id:_,team_id:p,season_id:m,team_season_id:f,date:g.date||new Date().toISOString().split("T")[0],time:e.time||"18:00",opponent:g.opponent||"Rival",competition:e.competition||"Liga",round:e.round||"Jornada 1",venue:g.venue||"Local",venue_name:e.venue_name||"",periods_count:4,period_minutes:10,status:g.status||"Finalizado",periods:O,team_score:g.team_score,opponent_score:g.opponent_score,starter_ids:Array.isArray(e.starter_ids)?e.starter_ids:[],notes:e.notes||"",video_url:e.video_url||""},{error:F}=await D.from("games").upsert([y]);if(F)throw new Error(`[games] ${F.message}`);if(E.length>0){const k=E.map(G=>({game_id:_,player_id:G.player_id,starter:!!G.starter,minutes:Number(G.minutes||0),fg2_made:Number(G.fg2_made||0),fg2_attempted:Number(G.fg2_attempted||0),fg3_made:Number(G.fg3_made||0),fg3_attempted:Number(G.fg3_attempted||0),ft_made:Number(G.ft_made||0),ft_attempted:Number(G.ft_attempted||0),off_reb:Number(G.off_reb||0),def_reb:Number(G.def_reb||0),assists:Number(G.assists||0),steals:Number(G.steals||0),blocks:Number(G.blocks||0),blocks_made:Number(G.blocks_made||0),blocks_received:Number(G.blocks_received||0),turnovers:Number(G.turnovers||0),fouls_committed:Number(G.fouls_committed||0),fouls_drawn:Number(G.fouls_drawn||0),plus_minus:Number(G.plus_minus||0),evaluation:Number(G.evaluation||0),points:Number(G.points||0)})),{error:W}=await D.from("player_game_stats").upsert(k,{onConflict:"game_id,player_id"});if(W)throw new Error(`[player_game_stats] ${W.message}`)}if(O.length>0){await D.from("game_period_scores").delete().eq("game_id",_);const{error:k}=await D.from("game_period_scores").insert(O);if(k)throw new Error(`[game_period_scores] ${k.message}`)}if(L.length>0){await D.from("game_events").delete().eq("game_id",_);const{error:k}=await D.from("game_events").insert(L);if(k)throw new Error(`[game_events] ${k.message}`)}}catch(y){throw console.error("[DataStore] Error guardando en Supabase:",y),y}return this._notifyListeners(),_}async deleteGame(e){if(!e)return!1;const t=this.games.find(a=>String(a.id)===String(e));if(t&&String(t.edit_state||t.editState||"OPEN").toUpperCase()==="LOCKED")throw new Error("Partido cerrado: reabre el partido antes de modificar datos.");if(this._assertPermission(l.DELETE_GAME,{teamId:(t==null?void 0:t.team_id)||(t==null?void 0:t.teamId)||this.getActiveTeamId(),seasonId:(t==null?void 0:t.season_id)||(t==null?void 0:t.seasonId)||null,teamSeasonId:(t==null?void 0:t.team_season_id)||(t==null?void 0:t.teamSeasonId)||this.getActiveTeamSeasonId()},"No tienes permiso para borrar este partido."),this.games=this.games.filter(a=>String(a.id)!==String(e)),this.playerGameStats=this.playerGameStats.filter(a=>String(a.game_id||a.gameId)!==String(e)),this.gamePeriodScores=this.gamePeriodScores.filter(a=>String(a.game_id||a.gameId)!==String(e)),this.gameEvents=this.gameEvents.filter(a=>String(a.game_id||a.gameId)!==String(e)),this._persistToStorage(),D)try{await Promise.allSettled([D.from("games").delete().eq("id",e),D.from("player_game_stats").delete().eq("game_id",e),D.from("game_period_scores").delete().eq("game_id",e),D.from("game_events").delete().eq("game_id",e)])}catch(a){console.warn("[DataStore] Error en borrado remoto:",a.message)}return this._notifyListeners(),!0}async updatePlayer(e,t,a=l.EDIT_PLAYER_MASTER){const s=this.players.find(i=>String(i.id)===String(e));this._assertPermission(a,{playerId:e,playerTeamId:(s==null?void 0:s.team_id)||(s==null?void 0:s.teamId)||null,teamId:(s==null?void 0:s.team_id)||(s==null?void 0:s.teamId)||null,teamSeasonId:this.getActiveTeamSeasonId((s==null?void 0:s.team_id)||(s==null?void 0:s.teamId)||null)},"No tienes permiso para modificar los datos de este jugador.");const r=this.players.findIndex(i=>String(i.id)===String(e));if(r>=0&&(this.players[r]=this._normalizePlayer({...this.players[r],...t}),this._persistToStorage()),D)try{await D.from("players").update(t).eq("id",e)}catch(i){console.warn("[DataStore] Error actualizando jugador en remoto:",i.message)}this._notifyListeners()}subscribe(e){return typeof e=="function"&&this.listeners.add(e),()=>{this.listeners.delete(e)}}_notifyListeners(){this.listeners.forEach(e=>{try{e(this)}catch(t){console.error("[DataStore] Error en listener:",t)}})}}const b=new ir,nr="iqbasket_offline_v1",or=1,Ce="game_sync_outbox",hs="iqbasket.gameSyncOutbox.v1",lr=5,Ee=Object.freeze({SYNCED:"SYNCED",PENDING:"PENDING",SYNCING:"SYNCING",FAILED:"FAILED",OFFLINE:"OFFLINE"});function mt(){return new Date().toISOString()}function ft(o){return o==null?o:JSON.parse(JSON.stringify(o))}function ia(){return typeof indexedDB>"u"?Promise.resolve(null):new Promise((o,e)=>{const t=indexedDB.open(nr,or);t.onupgradeneeded=()=>{const a=t.result;if(!a.objectStoreNames.contains(Ce)){const s=a.createObjectStore(Ce,{keyPath:"key"});s.createIndex("status","status",{unique:!1}),s.createIndex("updatedAt","updatedAt",{unique:!1})}},t.onsuccess=()=>o(t.result),t.onerror=()=>e(t.error||new Error("OFFLINE_DB_OPEN_FAILED"))})}async function dr(o){const e=await ia();return e?new Promise((t,a)=>{const s=e.transaction(Ce,"readwrite");s.objectStore(Ce).put(o),s.oncomplete=()=>{e.close(),t(!0)},s.onerror=()=>{const r=s.error;e.close(),a(r)}}):!1}async function cr(o){const e=await ia();return e?new Promise((t,a)=>{const s=e.transaction(Ce,"readwrite");s.objectStore(Ce).delete(o),s.oncomplete=()=>{e.close(),t(!0)},s.onerror=()=>{const r=s.error;e.close(),a(r)}}):!1}async function ur(){const o=await ia();return o?new Promise((e,t)=>{const a=o.transaction(Ce,"readonly"),s=a.objectStore(Ce).getAll();s.onsuccess=()=>e(s.result||[]),s.onerror=()=>t(s.error),a.oncomplete=()=>o.close()}):null}function na(){if(typeof localStorage>"u")return[];try{const o=JSON.parse(localStorage.getItem(hs)||"[]");return Array.isArray(o)?o:[]}catch{return[]}}function bs(o){typeof localStorage>"u"||localStorage.setItem(hs,JSON.stringify(o))}async function Ct(o){try{if(await dr(o))return}catch(t){console.warn("[OfflineOutbox] IndexedDB write fallback:",(t==null?void 0:t.message)||t)}const e=na().filter(t=>t.key!==o.key);e.push(o),bs(e.slice(-50))}async function pr(o){try{if(await cr(o))return}catch(e){console.warn("[OfflineOutbox] IndexedDB delete fallback:",(e==null?void 0:e.message)||e)}bs(na().filter(e=>e.key!==o))}async function mr(){try{const o=await ur();if(o)return o}catch(o){console.warn("[OfflineOutbox] IndexedDB read fallback:",(o==null?void 0:o.message)||o)}return na()}function Es(o){const e=String((o==null?void 0:o.message)||o||"").toLowerCase();return String((o==null?void 0:o.code)||"").toUpperCase()==="42501"||/permission|denied|rls|row.level.security|jwt|unauthori[sz]ed|forbidden|constraint|duplicate|invalid|locked|frozen/.test(e)?!1:typeof navigator<"u"&&navigator.onLine===!1?!0:/failed to fetch|network|networkerror|fetch failed|timeout|timed out|connection|offline|load failed/.test(e)}function gt(o){typeof window>"u"||window.dispatchEvent(new CustomEvent("iqbasket:game-sync-status",{detail:o}))}class fr{constructor({persistAggregate:e}={}){this.persistAggregate=typeof e=="function"?e:null,this.processing=!1,this.lastProcessAt=0}_key(e){return`game:${String(e||"").trim()}`}async enqueue({game:e,playerStats:t=[],periodScores:a=[],gameEvents:s=[],error:r=null}){if(!(e!=null&&e.id))throw new Error("OFFLINE_OUTBOX_GAME_ID_REQUIRED");const i={key:this._key(e.id),gameId:String(e.id),status:Ee.PENDING,attempts:0,payload:{game:ft(e),playerStats:ft(t||[]),periodScores:ft(a||[]),gameEvents:ft(s||[])},lastError:String((r==null?void 0:r.message)||r||""),createdAt:mt(),updatedAt:mt()};await Ct(i);const n=typeof navigator<"u"&&navigator.onLine===!1;return gt({gameId:i.gameId,status:n?Ee.OFFLINE:Ee.PENDING,pending:!0}),i}async list(){return(await mr()).sort((e,t)=>String(e.updatedAt).localeCompare(String(t.updatedAt)))}async pendingCount(){return(await this.list()).filter(e=>[Ee.PENDING,Ee.SYNCING,Ee.FAILED].includes(e.status)).length}async process({force:e=!1}={}){if(this.processing||!this.persistAggregate)return{processed:0,remaining:await this.pendingCount()};if(typeof navigator<"u"&&navigator.onLine===!1)return{processed:0,remaining:await this.pendingCount()};const t=Date.now();if(!e&&t-this.lastProcessAt<3e3)return{processed:0,remaining:await this.pendingCount()};this.processing=!0,this.lastProcessAt=t;let a=0;try{const s=await this.list();for(const r of s){if(r.status===Ee.FAILED&&!e)continue;const i={...r,status:Ee.SYNCING,updatedAt:mt()};await Ct(i),gt({gameId:r.gameId,status:Ee.SYNCING,pending:!0});try{const n=r.payload||{};await this.persistAggregate(n.game,n.playerStats||[],n.periodScores||[],n.gameEvents||[]),await pr(r.key),a+=1,gt({gameId:r.gameId,status:Ee.SYNCED,pending:!1})}catch(n){const d=Number(r.attempts||0)+1,c=Es(n),u=!c||d>=lr;if(await Ct({...r,status:u?Ee.FAILED:Ee.PENDING,attempts:d,lastError:String((n==null?void 0:n.message)||n||"SYNC_FAILED"),updatedAt:mt()}),gt({gameId:r.gameId,status:u?Ee.FAILED:Ee.PENDING,pending:!0,retryable:c}),!c)break}}}finally{this.processing=!1}return{processed:a,remaining:await this.pendingCount()}}}const ts=Symbol.for("iqbasket.offlineGameSave.v1");function gr(){return typeof crypto<"u"&&typeof crypto.randomUUID=="function"?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,o=>{const e=Math.random()*16|0;return(o==="x"?e:e&3|8).toString(16)})}function Dt(o){window.dispatchEvent(new CustomEvent("iqbasket:game-sync-status",{detail:o}))}function _r(o=b){if(!o||o[ts])return(o==null?void 0:o.offlineGameOutbox)||null;if(typeof o.saveGameAndStats!="function")return null;const e=o.saveGameAndStats.bind(o),t=new fr({persistAggregate:e});return o.offlineGameOutbox=t,o[ts]=!0,o.saveGameAndStats=async(a,s=[],r=[],i=[])=>{var d;const n={...a||{},id:(a==null?void 0:a.id)||gr()};try{const c=await e(n,s,r,i);return Dt({gameId:c,status:Ee.SYNCED,pending:!1}),t.process(),c}catch(c){if(!Es(c))throw c;return await t.enqueue({game:n,playerStats:s,periodScores:r,gameEvents:i,error:c}),(d=o._notifyListeners)==null||d.call(o),n.id}},typeof window<"u"&&(window.addEventListener("online",()=>{Dt({status:Ee.PENDING,pending:!0,connectivity:"ONLINE"}),t.process({force:!0})}),window.addEventListener("offline",()=>{Dt({status:Ee.OFFLINE,pending:!0,connectivity:"OFFLINE"})}),queueMicrotask(()=>void t.process())),t}typeof window<"u"&&_r();const ce=Object.freeze({defaultLanguage:"es",defaultLocale:"es",fallbackLanguage:"es",fallbackLocale:"es",storageKey:"iq_locale",legacyStorageKeys:["iq_lang","iq_basket_lang","iqbasket_language","iq_language","language","locale"],localeAliases:{cat:"ca"},supportedLocales:[{code:"es",name:"Español",flag:"🇪🇸",nativeName:"Español"},{code:"ca",name:"Català",flag:"🏴󠁡󠁱󠁣󠁡󠁴󠁿",nativeName:"Català"},{code:"en",name:"English",flag:"🇬🇧",nativeName:"English"},{code:"fr",name:"Français",flag:"🇫🇷",nativeName:"Français"}]});class hr{constructor(){this.locales={},this.listeners=new Set,this.defaultLanguage=(ce==null?void 0:ce.defaultLanguage)||"es",this.storageKey=(ce==null?void 0:ce.storageKey)||"iqbasket_language",this.currentLanguage=this._loadSavedLanguage()}_loadSavedLanguage(){if(typeof localStorage<"u"){const e=localStorage.getItem(this.storageKey);if(e&&typeof e=="string")return e.trim().toLowerCase()}return this.defaultLanguage}loadDictionary(e,t={}){if(!e||typeof t!="object")return;const a=e.trim().toLowerCase();this.locales[a]={...this.locales[a]||{},...t},this._notifyListeners()}loadLanguageFromDB(e,t=[]){if(!e||!Array.isArray(t))return;const a=e.trim().toLowerCase(),s={};t.forEach(r=>{r&&r.key&&r.value!==void 0&&(s[r.key]=r.value)}),this.locales[a]={...this.locales[a]||{},...s},this._notifyListeners()}setLanguage(e){if(!e)return;const t=e.trim().toLowerCase();this.currentLanguage!==t&&(this.currentLanguage=t,typeof localStorage<"u"&&localStorage.setItem(this.storageKey,t),this._notifyListeners())}getLanguage(){return this.currentLanguage}t(e,t={}){if(!e||typeof e!="string")return"";const a=this.locales[this.currentLanguage]||{},s=this.locales[this.defaultLanguage]||{};let r=a[e]??s[e]??e;return t&&typeof t=="object"&&Object.keys(t).forEach(i=>{const n=t[i]!==void 0&&t[i]!==null?String(t[i]):"";r=r.replace(new RegExp(`\\{${i}\\}`,"g"),n)}),r}getMetricHelp(e){const t=e.toLowerCase().replace(/[^a-z0-9_]/g,"");return{name:this.t(`stats.${t}.name`),description:this.t(`stats.${t}.desc`),formula:this.t(`stats.${t}.formula`)}}subscribe(e){return typeof e=="function"&&this.listeners.add(e),()=>{this.listeners.delete(e)}}_notifyListeners(){this.listeners.forEach(e=>{try{e(this.currentLanguage)}catch(t){console.error("[I18nEngine] Error ejecutando suscriptor:",t)}})}}const et=new hr;class br{constructor(){this.dictionaries={es:{},ca:{},en:{},fr:{}},this.listeners=new Set,this.currentLocale=this._resolveAndMigrateLocale(),this._hydrateLocalCustomTranslations()}_resolveAndMigrateLocale(){const e=(ce==null?void 0:ce.storageKey)||"iq_locale";if(typeof localStorage<"u"){const a=localStorage.getItem(e);if(a&&this._isValidLocale(this._normalizeLocale(a)))return this._normalizeLocale(a);const s=(ce==null?void 0:ce.legacyStorageKeys)||["iq_language","language","locale","iq_dict_lang"];for(const r of s){const i=localStorage.getItem(r);if(i){const n=this._normalizeLocale(i);if(this._isValidLocale(n))return this.setLocale(n),n}}}if(typeof navigator<"u"){const a=navigator.languages||[navigator.language||navigator.userLanguage||"es"];for(const s of a){const r=String(s).split("-")[0].toLowerCase(),i=this._normalizeLocale(r);if(this._isValidLocale(i))return this.setLocale(i),i}}const t=(ce==null?void 0:ce.defaultLocale)||"es";return this.setLocale(t),t}_normalizeLocale(e){const t=String(e||"es").trim().toLowerCase();return t==="cat"?"ca":t}_isValidLocale(e){var a;return(((a=ce==null?void 0:ce.supportedLocales)==null?void 0:a.map(s=>s.code))||["es","ca","en","fr"]).includes(e)}_hydrateLocalCustomTranslations(){if(typeof localStorage>"u")return;["es","ca","en","fr"].forEach(t=>{const a=localStorage.getItem(`iq_dict_${t}`);if(a)try{const s=JSON.parse(a);this.dictionaries[t]||(this.dictionaries[t]={}),Object.assign(this.dictionaries[t],s),et.loadDictionary(t,s)}catch{console.warn(`[I18nService] Error parseando iq_dict_${t}`)}})}async loadRemoteTranslations(e){if(e)try{const t=this.getLocale(),a=t==="ca"?"cat":t,{data:s,error:r}=await e.from("translations").select("key,language_code,translation,updated_at").or(`language_code.eq.${t},language_code.eq.${a}`);if(!r&&Array.isArray(s)&&s.length>0){this.dictionaries[t]||(this.dictionaries[t]={});const i={};if(s.forEach(n=>{n.key&&n.translation!==void 0&&(this.dictionaries[t][n.key]=n.translation,i[n.key]=n.translation)}),typeof localStorage<"u"){const n=JSON.parse(localStorage.getItem(`iq_dict_${t}`)||"{}");localStorage.setItem(`iq_dict_${t}`,JSON.stringify({...n,...i}))}et.loadDictionary(t,i),this.notify()}}catch(t){console.warn("[I18nService] No se pudieron sincronizar traducciones desde Supabase:",t.message)}}addTranslations(e,t={}){const a=this._normalizeLocale(e);if(this.dictionaries[a]||(this.dictionaries[a]={}),Object.assign(this.dictionaries[a],t),et.loadDictionary(a,t),typeof localStorage<"u"){const s=JSON.parse(localStorage.getItem(`iq_dict_${a}`)||"{}");localStorage.setItem(`iq_dict_${a}`,JSON.stringify({...s,...t}))}a===this.currentLocale&&this.notify()}getLocale(){return this.currentLocale}setLocale(e){const t=this._normalizeLocale(e);if(this._isValidLocale(t)){if(this.currentLocale=t,et.setLanguage(t),typeof localStorage<"u"){const a=(ce==null?void 0:ce.storageKey)||"iq_locale";localStorage.setItem(a,t),((ce==null?void 0:ce.legacyStorageKeys)||["iq_language","language","locale"]).forEach(r=>localStorage.setItem(r,t))}typeof document<"u"&&document.documentElement&&(document.documentElement.lang=t),this.notify()}}subscribe(e){return typeof e=="function"&&this.listeners.add(e),()=>this.listeners.delete(e)}notify(){this.listeners.forEach(e=>{try{e(this.currentLocale)}catch(t){console.error("[I18nService] Error en listener:",t)}})}t(e,t={},a=""){if(!e)return"";const s=this.dictionaries[this.currentLocale]||{};let r;if(s[e]!==void 0&&(r=s[e]),r===void 0&&e.includes(".")&&(r=e.split(".").reduce((n,d)=>n&&n[d]!==void 0?n[d]:void 0,s)),r===void 0){const i=et.t(e,t);if(i&&i!==e)return i}if(r===void 0&&this.currentLocale!=="es"){const i=this.dictionaries.es||{};i[e]!==void 0?r=i[e]:e.includes(".")&&(r=e.split(".").reduce((d,c)=>d&&d[c]!==void 0?d[c]:void 0,i))}return r===void 0?a||e:typeof r=="string"&&t&&Object.keys(t).length>0?Object.keys(t).reduce((i,n)=>{const d=t[n]!==void 0&&t[n]!==null?String(t[n]):"";return i.replace(new RegExp(`{{\\s*${n}\\s*}}`,"g"),d).replace(new RegExp(`\\{${n}\\}`,"g"),d)},r):String(r)}formatNumber(e,t={}){return e==null||isNaN(Number(e))?"-":new Intl.NumberFormat(this.currentLocale,t).format(Number(e))}formatPercent(e,t=1){return e==null||isNaN(Number(e))?"-":new Intl.NumberFormat(this.currentLocale,{style:"percent",minimumFractionDigits:t,maximumFractionDigits:t}).format(Number(e)/100)}formatDate(e,t={year:"numeric",month:"short",day:"numeric"}){if(!e)return"-";const a=typeof e=="string"?new Date(e):e;return new Intl.DateTimeFormat(this.currentLocale,t).format(a)}}const se=new br,Re=class Re{static normalizeLang(e="es"){const t=String(e||"es").trim().toLowerCase();return t==="cat"?"ca":t}static t(e,t="",a=""){if(!e)return"";let s=typeof t=="string"?t:a;const r=this.normalizeLang(this.currentLang),n=(this.dictionaries[r]||this.dictionaries.es||{})[e];return n!=null&&n!==""?n:s||e}static getDictionary(e=null){const t=this.normalizeLang(e||this.currentLang);return this.dictionaries[t]||this.defaultDictionary[t]||this.defaultDictionary.es}static saveDictionary(e,t){const a=this.normalizeLang(e);this.dictionaries[a]={...this.dictionaries[a]||{},...t},typeof localStorage<"u"&&(localStorage.setItem(`iq_dict_${a}`,JSON.stringify(this.dictionaries[a])),localStorage.setItem(`iq_dict_sync_${a}`,String(Date.now())))}static async setLanguage(e){const t=this.normalizeLang(e);if(this.currentLang=t,typeof localStorage<"u"){localStorage.setItem("iq_lang",t);const a=localStorage.getItem(`iq_dict_${t}`);if(a)try{this.dictionaries[t]={...this.dictionaries[t],...JSON.parse(a)}}catch{}}se&&typeof se.setLocale=="function"&&se.setLocale(t)}static async initAllTranslations(e=!1){try{const t=this.normalizeLang(this.currentLang||"es");let a=!1;if(typeof localStorage<"u"){const s=localStorage.getItem(`iq_dict_${t}`);if(s)try{this.dictionaries[t]={...this.dictionaries[t],...JSON.parse(s)},a=!0}catch{}if(!e&&a){const r=Number(localStorage.getItem(`iq_dict_sync_${t}`)||0);if(r>0&&Date.now()-r<this.remoteCacheTtlMs)return}}if(D){let s=D.from("translations").select("key,language_code,translation,updated_at");t==="ca"?s=s.in("language_code",["ca","cat"]):s=s.eq("language_code",t);const{data:r,error:i}=await s;!i&&Array.isArray(r)&&(r.forEach(n=>{const d=this.normalizeLang(n.language_code);this.dictionaries[d]||(this.dictionaries[d]={}),this.dictionaries[d][n.key]=n.translation}),typeof localStorage<"u"&&(localStorage.setItem(`iq_dict_${t}`,JSON.stringify(this.dictionaries[t]||{})),localStorage.setItem(`iq_dict_sync_${t}`,String(Date.now()))))}}catch(t){console.warn("[TranslationStore] Inicialización offline:",t.message)}}};Ze(Re,"defaultDictionary",{es:{dashboard:"Dashboard",team:"Equipo",players:"Jugadores",games:"Partidos",boxscore:"Registro Estadístico",advanced_stats:"Estadística Avanzada",lineups:"Quintetos",comparator:"Comparador",reports:"Informes",ask_ai:"Pregúntale a tus datos",profile:"Mi Perfil",settings:"Configuración",privacy_center:"Privacidad y accesos",privacy_governance:"Gobierno",approval_center:"Solicitudes","approvals.title":"Bandeja de Solicitudes","approvals.subtitle":"Centraliza accesos, cierres y traspasos, mostrando sólo las acciones permitidas por tu rol y contexto.","approvals.refresh":"Actualizar","approvals.total":"Total","approvals.pending":"Pendientes","approvals.resolved":"Resueltas","approvals.history":"Historial","approvals.all":"Todas","approvals.type_game_lock":"Cierre de partido","approvals.type_team_access":"Acceso a equipo","approvals.status_pending":"Pendiente","approvals.status_approved":"Aprobada","approvals.status_rejected":"Rechazada","approvals.status_cancelled":"Cancelada","approvals.view_context":"Ver contexto","approvals.approve":"Aprobar","approvals.reject":"Rechazar","approvals.loading":"Cargando solicitudes...","approvals.partial":"La bandeja se ha cargado parcialmente.","approvals.empty_pending":"No tienes solicitudes pendientes","approvals.empty_filter":"No hay solicitudes en este filtro","approvals.empty_help":"La bandeja se actualizará al entrar de nuevo o al pulsar Actualizar.","approvals.restricted":"Acceso restringido","approvals.restricted_body":"Tu perfil no puede consultar la Bandeja de Solicitudes.","approvals.game_title":"Cerrar partido vs {opponent}","approvals.access_subtitle":"Acceso a {team} como {role}","approvals.approve_lock_confirm":"¿Aprobar y cerrar este partido? Quedará bloqueado hasta que un Admin/Superadmin lo reabra.","approvals.approve_access_confirm":"¿Aprobar esta solicitud de acceso?","approvals.reject_reason":"Motivo del rechazo (opcional):","approvals.resolution_note":"Nota de resolución (opcional)","approvals.resolution_note_placeholder":"Añade contexto para la auditoría","approvals.action_error":"No se pudo completar la acción.","approvals.type_transfer":"Traspaso","approvals.type_season_freeze":"Cierre de temporada","approvals.season_freeze_title":"Cerrar temporada · {team}","approvals.approve_season_freeze_confirm":"¿Aprobar el cierre de esta temporada? Sus partidos abiertos y la plantilla quedarán congelados en modo histórico.","approvals.transfer_title":"Traspaso · {player}","approvals.transfer_route":"{origin} → {destination}","approvals.transfer_source":"Origen","approvals.transfer_destination":"Destino","approvals.transfer_pending":"Pendiente","approvals.transfer_approved":"Aprobado","approvals.transfer_rejected":"Rechazado","approvals.transfer_last_day_source":"Último día en origen","approvals.transfer_first_day_destination":"Primer día en destino","approvals.transfer_requested_start":"Alta solicitada","approvals.transfer_reason_optional":"Motivo / nota (opcional)","approvals.transfer_reason_placeholder":"Añade contexto si es necesario","approvals.transfer_approve_side":"Aprobar","approvals.transfer_ready":"Lista para finalizar","approvals.transfer_finalize":"Finalizar traspaso","approvals.transfer_finalize_help":"Origen y destino están aprobados. La finalización aplicará el cambio temporal de plantilla con las fechas acordadas.","approvals.transfer_finalize_confirm":"¿Finalizar el traspaso con las fechas aprobadas por origen y destino? Esta acción actualizará la elegibilidad histórica del jugador.","approvals.transfer_date_required":"Selecciona una fecha válida antes de aprobar.",logout:"Cerrar sesión",language:"Idioma",local:"Local",visitor:"Visitante",pending:"Pendiente",completed:"Finalizado",opponent:"Rival",score:"Resultado",in_favor:"A favor",against:"En contra",actions:"Acciones",season:"Temporada",record:"Balance",active_players:"Jugadores Activos",team_info:"Información del Equipo",roster:"Plantilla",no_players_loaded:"No hay jugadores cargados en la plantilla.",jersey:"Dorsal",position:"Posición",status:"Estado",height:"Altura",save_changes:"Guardar Cambios",read_only:"Modo Solo Lectura",view_boxscore:"Análisis",edit:"Editar",search_player:"Buscar jugador...",all_positions:"Todas las Posiciones",all:"Todos",quarters:"CUARTOS",track_live:"Toma Gráfica / Pista",report:"Informe",delete_game:"Eliminar partido",confirm_delete_game:"¿Estás seguro de que deseas eliminar este partido? Se borrarán todas sus estadísticas y eventos asociados.",team_games:"Partidos del Equipo",registered_games:"partidos registrados",register_new_game:"Registrar Nuevo Partido",sort:"ORDENAR",no_games_recorded:"No hay partidos registrados.",edit_game:"Toma de Datos en Vivo",cancel:"Volver al Listado",date:"Fecha",matchday:"Jornada",venue:"Sede",arena:"Pabellón / Arena",starting_five:"QUINTETO TITULAR",game_saved_msg:"Partido guardado exitosamente con cuartos, estadísticas y mapa de tiro sincronizados.",analytics_suite:"Estadística Avanzada & Cartas de Tiro",analytics_subtitle:"Rendimiento espacial, informe individual con radar y comparativa On/Off",tab_court_heatmap:"Pista & Zonas",tab_player_report:"Informe de Jugador",tab_on_off:"Comparativa On / Off & Rival","heatmap.filter_game":"PARTIDO","heatmap.all_games":"Todos los partidos","heatmap.filter_player":"JUGADOR","heatmap.all_players":"Todo el equipo","heatmap.filter_period":"PERIODO","heatmap.all_periods":"Todos los cuartos","heatmap.filter_outcome":"RESULTADO DE TIRO","heatmap.all_outcomes":"Anotados y Fallados","heatmap.only_made":"Solo Anotados","heatmap.only_missed":"Solo Fallados","heatmap.all_distances":"Todas las Distancias","heatmap.paint":"Bajo el Aro / Pintura","heatmap.mid_range":"Media Distancia","heatmap.threes":"Línea de 3 Puntos","heatmap.mode_zones":"Zonas","heatmap.mode_density":"Calor","heatmap.mode_shots":"Tiros","heatmap.paint_badge":"PINTURA","heatmap.mid_badge":"MEDIA DIST.","heatmap.top_three_badge":"TRIPLE FRONTAL","heatmap.left_corner_badge":"ESQ. IZQ","heatmap.right_corner_badge":"ESQ. DER","heatmap.summary_title":"Resumen de Lanzamiento","heatmap.zones_title":"Distribución por Distancia","heatmap.made_shots":"Anotados","heatmap.missed_shots":"Fallados","heatmap.pts_produced":"Puntos Producidos en Cancha","heatmap.efficiency":"Eficiencia","heatmap.made_legend":"Anotado","heatmap.missed_legend":"Fallado","heatmap.season_report":"Informe de Temporada","heatmap.efficiency_profile":"Perfil de Eficiencia Ofensiva y Porcentajes de Tiro","heatmap.skills_radar":"Radar de Habilidades (Advanced Radar)","heatmap.shot_breakdown":"Desglose de Lanzamientos de","heatmap.on_off_title":"Matriz de Rendimiento On / Off & Rival","heatmap.on_off_subtitle":"Impacto diferencial en pista con el jugador presente (ON) vs descansando (OFF)","heatmap.analyzed_players":"Jugadores Analizados"},ca:{dashboard:"Tauler Principal",team:"Equip",players:"Jugadors",games:"Partits",boxscore:"Registre Estadístic",advanced_stats:"Estadística Avançada",lineups:"Quintets",comparator:"Comparador",reports:"Informes",ask_ai:"Pregunta a les dades",profile:"El meu Perfil",settings:"Configuració",privacy_center:"Privacitat i accessos",privacy_governance:"Governança",approval_center:"Sol·licituds","approvals.title":"Safata de Sol·licituds","approvals.subtitle":"Centralitza accessos, tancaments i traspassos, mostrant només les accions permeses pel teu rol i context.","approvals.refresh":"Actualitzar","approvals.total":"Total","approvals.pending":"Pendents","approvals.resolved":"Resoltes","approvals.history":"Historial","approvals.all":"Totes","approvals.type_game_lock":"Tancament de partit","approvals.type_team_access":"Accés a equip","approvals.status_pending":"Pendent","approvals.status_approved":"Aprovada","approvals.status_rejected":"Rebutjada","approvals.status_cancelled":"Cancel·lada","approvals.view_context":"Veure context","approvals.approve":"Aprovar","approvals.reject":"Rebutjar","approvals.loading":"Carregant sol·licituds...","approvals.partial":"La safata s’ha carregat parcialment.","approvals.empty_pending":"No tens sol·licituds pendents","approvals.empty_filter":"No hi ha sol·licituds en aquest filtre","approvals.empty_help":"La safata s’actualitzarà en tornar a entrar o en prémer Actualitzar.","approvals.restricted":"Accés restringit","approvals.restricted_body":"El teu perfil no pot consultar la Safata de Sol·licituds.","approvals.game_title":"Tancar partit vs {opponent}","approvals.access_subtitle":"Accés a {team} com a {role}","approvals.approve_lock_confirm":"Aprovar i tancar aquest partit? Quedarà bloquejat fins que un Admin/Superadmin el reobri.","approvals.approve_access_confirm":"Aprovar aquesta sol·licitud d’accés?","approvals.reject_reason":"Motiu del rebuig (opcional):","approvals.resolution_note":"Nota de resolució (opcional)","approvals.resolution_note_placeholder":"Afegeix context per a l’auditoria","approvals.action_error":"No s’ha pogut completar l’acció.","approvals.type_transfer":"Traspàs","approvals.type_season_freeze":"Tancament de temporada","approvals.season_freeze_title":"Tancar temporada · {team}","approvals.approve_season_freeze_confirm":"Aprovar el tancament d’aquesta temporada? Els partits oberts i la plantilla quedaran congelats en mode històric.","approvals.transfer_title":"Traspàs · {player}","approvals.transfer_route":"{origin} → {destination}","approvals.transfer_source":"Origen","approvals.transfer_destination":"Destí","approvals.transfer_pending":"Pendent","approvals.transfer_approved":"Aprovat","approvals.transfer_rejected":"Rebutjat","approvals.transfer_last_day_source":"Últim dia a l’origen","approvals.transfer_first_day_destination":"Primer dia al destí","approvals.transfer_requested_start":"Alta sol·licitada","approvals.transfer_reason_optional":"Motiu / nota (opcional)","approvals.transfer_reason_placeholder":"Afegeix context si cal","approvals.transfer_approve_side":"Aprovar","approvals.transfer_ready":"Llest per finalitzar","approvals.transfer_finalize":"Finalitzar traspàs","approvals.transfer_finalize_help":"Origen i destí estan aprovats. La finalització aplicarà el canvi temporal de plantilla amb les dates acordades.","approvals.transfer_finalize_confirm":"Finalitzar el traspàs amb les dates aprovades per origen i destí? Aquesta acció actualitzarà l’elegibilitat històrica del jugador.","approvals.transfer_date_required":"Selecciona una data vàlida abans d’aprovar.",logout:"Tancar sessió",language:"Idioma",local:"Local",visitor:"Visitant",pending:"Pendent",completed:"Finalitzat",opponent:"Rival",score:"Resultat",in_favor:"A favor",against:"En contra",actions:"Accions",season:"Temporada",record:"Balanç",active_players:"Jugadors Actius",team_info:"Informació de l'Equip",roster:"Plantilla",no_players_loaded:"No hi ha jugadors carregats a la plantilla.",jersey:"Dorsal",position:"Posició",status:"Estat",height:"Alçada",save_changes:"Desar Canvis",read_only:"Mode Només Lectura",view_boxscore:"Anàlisi",edit:"Editar",search_player:"Cercar jugador...",all_positions:"Totes les Posicions",all:"Tots",quarters:"QUARTS",track_live:"Presa Gràfica / Pista",report:"Informe",delete_game:"Eliminar partit",confirm_delete_game:"Segur que voleu eliminar aquest partit? S'esborraran totes les seves estadístiques i esdeveniments associats.",team_games:"Partits de l'Equip",registered_games:"partits registrats",register_new_game:"Registrar Nou Partit",sort:"ORDENAR",no_games_recorded:"No hi ha partits registrats.",edit_game:"Presa de Dades en Viu",cancel:"Tornar al Llistat",date:"Data",matchday:"Jornada",venue:"Seu",arena:"Pavelló / Arena",starting_five:"QUINTET TITULAR",game_saved_msg:"Partit desat correctament amb quarts, estadístiques i mapa de tir sincronitzats.",analytics_suite:"Estadística Avançada & Cartes de Tir",analytics_subtitle:"Rendiment espacial, informe individual amb radar i comparativa On/Off",tab_court_heatmap:"Pista & Zones",tab_player_report:"Informe de Jugador",tab_on_off:"Comparativa On / Off & Rival","heatmap.filter_game":"PARTIT","heatmap.all_games":"Tots els partits","heatmap.filter_player":"JUGADOR","heatmap.all_players":"Tot l'equip","heatmap.filter_period":"PERÍODE","heatmap.all_periods":"Tots els quarts","heatmap.filter_outcome":"RESULTAT DE TIR","heatmap.all_outcomes":"Anotats i Fallats","heatmap.only_made":"Només Anotats","heatmap.only_missed":"Només Fallats","heatmap.all_distances":"Totes les Distàncies","heatmap.paint":"Sota la Canastra / Pintura","heatmap.mid_range":"Mitja Distància","heatmap.threes":"Línia de 3 Punts","heatmap.mode_zones":"Zones","heatmap.mode_density":"Calor","heatmap.mode_shots":"Tirs","heatmap.paint_badge":"PINTURA","heatmap.mid_badge":"MITJA DIST.","heatmap.top_three_badge":"TRIPLE FRONTAL","heatmap.left_corner_badge":"ESQ. ESQ","heatmap.right_corner_badge":"ESQ. DRE","heatmap.summary_title":"Resum de Llançament","heatmap.zones_title":"Distribució per Distància","heatmap.made_shots":"Anotats","heatmap.missed_shots":"Fallats","heatmap.pts_produced":"Punts Produïts a Pista","heatmap.efficiency":"Eficiència","heatmap.made_legend":"Anotat","heatmap.missed_legend":"Fallat","heatmap.season_report":"Informe de Temporada","heatmap.efficiency_profile":"Perfil d'Eficiència Ofensiva i Percentatges de Tir","heatmap.skills_radar":"Radar d'Habilitats (Advanced Radar)","heatmap.shot_breakdown":"Desglossament de Llançaments de","heatmap.on_off_title":"Matriu de Rendiment On / Off & Rival","heatmap.on_off_subtitle":"Impacte diferencial a pista amb el jugador present (ON) vs descansant (OFF)","heatmap.analyzed_players":"Jugadors Analitzats"},en:{dashboard:"Dashboard",team:"Team",players:"Players",games:"Games",boxscore:"Box Score Register",advanced_stats:"Advanced Stats",lineups:"Lineups",comparator:"Comparator",reports:"Reports",ask_ai:"Ask your Data",profile:"My Profile",settings:"Settings",privacy_center:"Privacy & access",privacy_governance:"Governance",approval_center:"Requests","approvals.title":"Request Inbox","approvals.subtitle":"Centralizes access, game closures and transfers, exposing only actions allowed by your role and context.","approvals.refresh":"Refresh","approvals.total":"Total","approvals.pending":"Pending","approvals.resolved":"Resolved","approvals.history":"History","approvals.all":"All","approvals.type_game_lock":"Game closure","approvals.type_team_access":"Team access","approvals.status_pending":"Pending","approvals.status_approved":"Approved","approvals.status_rejected":"Rejected","approvals.status_cancelled":"Cancelled","approvals.view_context":"View context","approvals.approve":"Approve","approvals.reject":"Reject","approvals.loading":"Loading requests...","approvals.partial":"The inbox was only partially loaded.","approvals.empty_pending":"You have no pending requests","approvals.empty_filter":"No requests match this filter","approvals.empty_help":"The inbox refreshes when reopened or when you press Refresh.","approvals.restricted":"Restricted access","approvals.restricted_body":"Your profile cannot access the Request Inbox.","approvals.game_title":"Close game vs {opponent}","approvals.access_subtitle":"Access to {team} as {role}","approvals.approve_lock_confirm":"Approve and close this game? It will remain locked until an Admin/Superadmin reopens it.","approvals.approve_access_confirm":"Approve this access request?","approvals.reject_reason":"Rejection reason (optional):","approvals.resolution_note":"Resolution note (optional)","approvals.resolution_note_placeholder":"Add context for the audit trail","approvals.action_error":"The action could not be completed.","approvals.type_transfer":"Transfer","approvals.type_season_freeze":"Season closure","approvals.season_freeze_title":"Close season · {team}","approvals.approve_season_freeze_confirm":"Approve this season closure? Open games and the roster will be frozen in historical read-only mode.","approvals.transfer_title":"Transfer · {player}","approvals.transfer_route":"{origin} → {destination}","approvals.transfer_source":"Source","approvals.transfer_destination":"Destination","approvals.transfer_pending":"Pending","approvals.transfer_approved":"Approved","approvals.transfer_rejected":"Rejected","approvals.transfer_last_day_source":"Last day at source","approvals.transfer_first_day_destination":"First day at destination","approvals.transfer_requested_start":"Requested start","approvals.transfer_reason_optional":"Reason / note (optional)","approvals.transfer_reason_placeholder":"Add context if needed","approvals.transfer_approve_side":"Approve","approvals.transfer_ready":"Ready to finalize","approvals.transfer_finalize":"Finalize transfer","approvals.transfer_finalize_help":"Source and destination are approved. Finalization will apply the roster eligibility change using the agreed dates.","approvals.transfer_finalize_confirm":"Finalize the transfer using the dates approved by source and destination? This will update the player’s historical eligibility.","approvals.transfer_date_required":"Select a valid date before approving.",logout:"Log Out",language:"Language",local:"Home",visitor:"Away",pending:"Pending",completed:"Final",opponent:"Opponent",score:"Score",in_favor:"For",against:"Against",actions:"Actions",season:"Season",record:"Record",active_players:"Active Players",team_info:"Team Information",roster:"Roster",no_players_loaded:"No players loaded in the roster.",jersey:"Jersey",position:"Position",status:"Status",height:"Height",save_changes:"Save Changes",read_only:"Read-Only Mode",view_boxscore:"Analysis",edit:"Edit",search_player:"Search player...",all_positions:"All Positions",all:"All",quarters:"QUARTERS",track_live:"Graphical Tracking / Court",report:"Report",delete_game:"Delete Game",confirm_delete_game:"Are you sure you want to delete this game? All associated stats and events will be permanently removed.",team_games:"Team Games",registered_games:"registered games",register_new_game:"Register New Game",sort:"SORT",no_games_recorded:"No games recorded.",edit_game:"Live Game Data Entry",cancel:"Back to List",date:"Date",matchday:"Round",venue:"Venue",arena:"Arena / Gym",starting_five:"STARTING FIVE",game_saved_msg:"Game saved successfully with periods, stats, and shot chart synchronized.",analytics_suite:"Advanced Stats & Shot Charts",analytics_subtitle:"Spatial performance, individual report with radar, and On/Off comparison",tab_court_heatmap:"Court & Zones",tab_player_report:"Player Report",tab_on_off:"On / Off & Opponent Comparison","heatmap.filter_game":"GAME","heatmap.all_games":"All Games","heatmap.filter_player":"PLAYER","heatmap.all_players":"All Team","heatmap.filter_period":"PERIOD","heatmap.all_periods":"All Quarters","heatmap.filter_outcome":"SHOT OUTCOME","heatmap.all_outcomes":"Made & Missed","heatmap.only_made":"Only Made","heatmap.only_missed":"Only Missed","heatmap.all_distances":"All Distances","heatmap.paint":"Under Rim / Paint","heatmap.mid_range":"Mid-Range","heatmap.threes":"3-Point Line","heatmap.mode_zones":"Zones","heatmap.mode_density":"Heatmap","heatmap.mode_shots":"Shots","heatmap.paint_badge":"PAINT","heatmap.mid_badge":"MID-RANGE","heatmap.top_three_badge":"TOP THREE","heatmap.left_corner_badge":"LEFT CORNER","heatmap.right_corner_badge":"RIGHT CORNER","heatmap.summary_title":"Shooting Summary","heatmap.zones_title":"Distance Breakdown","heatmap.made_shots":"Made","heatmap.missed_shots":"Missed","heatmap.pts_produced":"Points Produced on Court","heatmap.efficiency":"Efficiency","heatmap.made_legend":"Made","heatmap.missed_legend":"Missed","heatmap.season_report":"Season Report","heatmap.efficiency_profile":"Offensive Efficiency Profile & Shooting Percentages","heatmap.skills_radar":"Skills Radar (Advanced Radar)","heatmap.shot_breakdown":"Shot Breakdown of","heatmap.on_off_title":"On / Off & Opponent Performance Matrix","heatmap.on_off_subtitle":"Differential on-court impact with player present (ON) vs resting (OFF)","heatmap.analyzed_players":"Analyzed Players"},fr:{dashboard:"Tableau de Bord",team:"Équipe",players:"Joueurs",games:"Matchs",boxscore:"Registre Statistique",advanced_stats:"Statistiques Avancées",lineups:"Cinq Majeur",comparator:"Comparateur",reports:"Rapports",ask_ai:"Posez une question",profile:"Mon Profil",settings:"Paramètres",privacy_center:"Confidentialité et accès",privacy_governance:"Gouvernance",approval_center:"Demandes","approvals.title":"Boîte de Demandes","approvals.subtitle":"Centralise les accès, clôtures et transferts, et n’affiche que les actions autorisées par votre rôle et votre contexte.","approvals.refresh":"Actualiser","approvals.total":"Total","approvals.pending":"En attente","approvals.resolved":"Résolues","approvals.history":"Historique","approvals.all":"Toutes","approvals.type_game_lock":"Clôture de match","approvals.type_team_access":"Accès à l’équipe","approvals.status_pending":"En attente","approvals.status_approved":"Approuvée","approvals.status_rejected":"Rejetée","approvals.status_cancelled":"Annulée","approvals.view_context":"Voir le contexte","approvals.approve":"Approuver","approvals.reject":"Rejeter","approvals.loading":"Chargement des demandes...","approvals.partial":"La boîte de demandes n’a été chargée que partiellement.","approvals.empty_pending":"Vous n’avez aucune demande en attente","approvals.empty_filter":"Aucune demande pour ce filtre","approvals.empty_help":"La boîte se met à jour à sa réouverture ou en appuyant sur Actualiser.","approvals.restricted":"Accès restreint","approvals.restricted_body":"Votre profil ne peut pas consulter la Boîte de Demandes.","approvals.game_title":"Clôturer le match contre {opponent}","approvals.access_subtitle":"Accès à {team} comme {role}","approvals.approve_lock_confirm":"Approuver et clôturer ce match ? Il restera verrouillé jusqu’à sa réouverture par un Admin/Superadmin.","approvals.approve_access_confirm":"Approuver cette demande d’accès ?","approvals.reject_reason":"Motif du rejet (facultatif) :","approvals.resolution_note":"Note de résolution (facultative)","approvals.resolution_note_placeholder":"Ajoutez du contexte pour l’audit","approvals.action_error":"L’action n’a pas pu être effectuée.","approvals.type_transfer":"Transfert","approvals.type_season_freeze":"Clôture de saison","approvals.season_freeze_title":"Clôturer la saison · {team}","approvals.approve_season_freeze_confirm":"Approuver la clôture de cette saison ? Les matchs ouverts et l’effectif seront figés en mode historique.","approvals.transfer_title":"Transfert · {player}","approvals.transfer_route":"{origin} → {destination}","approvals.transfer_source":"Origine","approvals.transfer_destination":"Destination","approvals.transfer_pending":"En attente","approvals.transfer_approved":"Approuvé","approvals.transfer_rejected":"Rejeté","approvals.transfer_last_day_source":"Dernier jour à l’origine","approvals.transfer_first_day_destination":"Premier jour à destination","approvals.transfer_requested_start":"Début demandé","approvals.transfer_reason_optional":"Motif / note (facultatif)","approvals.transfer_reason_placeholder":"Ajoutez du contexte si nécessaire","approvals.transfer_approve_side":"Approuver","approvals.transfer_ready":"Prêt à finaliser","approvals.transfer_finalize":"Finaliser le transfert","approvals.transfer_finalize_help":"L’origine et la destination ont approuvé. La finalisation appliquera le changement d’éligibilité avec les dates convenues.","approvals.transfer_finalize_confirm":"Finaliser le transfert avec les dates approuvées par l’origine et la destination ? Cette action mettra à jour l’éligibilité historique du joueur.","approvals.transfer_date_required":"Sélectionnez une date valide avant d’approuver.",logout:"Déconnexion",language:"Langue",local:"Domicile",visitor:"Extérieur",pending:"En attente",completed:"Terminé",opponent:"Adversaire",score:"Score",in_favor:"Pour",against:"Contre",actions:"Actions",season:"Saison",record:"Bilan",active_players:"Joueurs Actifs",team_info:"Informations sur l'équipe",roster:"Effectif",no_players_loaded:"Aucun joueur chargé dans l'effectif.",jersey:"Maillot",position:"Poste",status:"Statut",height:"Taille",save_changes:"Enregistrer les modifications",read_only:"Mode Lecture Seule",view_boxscore:"Analyse",edit:"Modifier",search_player:"Rechercher un joueur...",all_positions:"Toutes les Positions",all:"Tous",quarters:"QUARTS-TEMPS",track_live:"Prise Graphique / Terrain",report:"Rapport",delete_game:"Supprimer le match",confirm_delete_game:"Êtes-vous sûr de vouloir supprimer ce match ?",team_games:"Matchs de l'Équipe",registered_games:"matchs enregistrés",register_new_game:"Enregistrer un Nouveau Match",sort:"TRIER",no_games_recorded:"Aucun match enregistré.",edit_game:"Saisie de Données en Direct",cancel:"Retour à la Liste",date:"Date",matchday:"Journée",venue:"Lieu",arena:"Gymnase / Salle",starting_five:"CINQ MAJEUR",game_saved_msg:"Match enregistré avec succès.",analytics_suite:"Statistiques Avancées & Cartes de Tir",analytics_subtitle:"Performance spatiale, rapport individuel avec radar et On/Off",tab_court_heatmap:"Terrain & Zones",tab_player_report:"Rapport Joueur",tab_on_off:"Comparatif On / Off & Adversaire","heatmap.filter_game":"MATCH","heatmap.all_games":"Tous les matchs","heatmap.filter_player":"JOUEUR","heatmap.all_players":"Toute l'équipe","heatmap.filter_period":"PÉRIODE","heatmap.all_periods":"Tous les quarts-temps","heatmap.filter_outcome":"RÉSULTAT DU TIR","heatmap.all_outcomes":"Réussis et Manqués","heatmap.only_made":"Seulement Réussis","heatmap.only_missed":"Seulement Manqués","heatmap.all_distances":"Toutes les Distances","heatmap.paint":"Sous le Panier / Raquette","heatmap.mid_range":"Mi-Distance","heatmap.threes":"Ligne à 3 Points","heatmap.mode_zones":"Zones","heatmap.mode_density":"Chaleur","heatmap.mode_shots":"Tirs","heatmap.paint_badge":"RAQUETTE","heatmap.mid_badge":"MI-DISTANCE","heatmap.top_three_badge":"3 PTS EN TÊTE","heatmap.left_corner_badge":"COIN GAUCHE","heatmap.right_corner_badge":"COIN DROIT","heatmap.summary_title":"Résumé des Tirs","heatmap.zones_title":"Répartition par Distance","heatmap.made_shots":"Réussis","heatmap.missed_shots":"Manqués","heatmap.pts_produced":"Points Marqués sur le Terrain","heatmap.efficiency":"Efficacité","heatmap.made_legend":"Réussi","heatmap.missed_legend":"Manqué","heatmap.season_report":"Rapport de Saison","heatmap.efficiency_profile":"Profil d'Efficacité Offensive et Pourcentages de Tir","heatmap.skills_radar":"Radar de Compétences (Advanced Radar)","heatmap.shot_breakdown":"Détail des Tirs de","heatmap.on_off_title":"Matrice de Rendement On / Off & Adversaire","heatmap.on_off_subtitle":"Impact différentiel sur le terrain avec le joueur (ON) vs au repos (OFF)","heatmap.analyzed_players":"Joueurs Analysés"}}),Ze(Re,"dictionaries",{es:{...Re.defaultDictionary.es},ca:{...Re.defaultDictionary.ca},en:{...Re.defaultDictionary.en},fr:{...Re.defaultDictionary.fr}}),Ze(Re,"currentLang",localStorage.getItem("iq_lang")||"es"),Ze(Re,"remoteCacheTtlMs",6*60*60*1e3);let j=Re;function tt(o=[]){return[...new Set((o||[]).filter(e=>e!=null&&e!=="").map(String))]}class Er{constructor(e){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e}async enrichProfile(e={}){if(!this.supabase||!(e!=null&&e.id))return e;const t=Array.isArray(e.assigned_team_ids)?e.assigned_team_ids:[],a=e.linked_player_id?[e.linked_player_id]:[],[s,r]=await Promise.all([this.supabase.from("team_season_memberships").select("team_season_id,function_role,status,valid_from,valid_until").eq("user_id",e.id).eq("status","ACTIVE"),this.supabase.from("user_player_links").select("player_id,relation_type,status,valid_from,valid_until").eq("user_id",e.id).eq("status","ACTIVE")]);s.error&&console.warn("[AuthorizationContext] No se pudieron cargar membresías v3:",s.error.message),r.error&&console.warn("[AuthorizationContext] No se pudieron cargar vínculos usuario-jugador:",r.error.message);const i=s.error?[]:s.data||[],n=tt(i.map(f=>f.team_season_id));let d=[];if(n.length>0){const{data:f,error:g}=await this.supabase.from("team_seasons").select("id,team_id,season_id,status").in("id",n);g?console.warn("[AuthorizationContext] No se pudieron resolver team_seasons:",g.message):d=f||[]}const c=new Map(d.map(f=>[String(f.id),f])),u=i.map(f=>{const g=c.get(String(f.team_season_id));return{teamSeasonId:f.team_season_id,teamId:(g==null?void 0:g.team_id)||null,globalSeasonId:(g==null?void 0:g.season_id)||null,role:String(f.function_role||"").toUpperCase(),status:String(f.status||"").toUpperCase(),validFrom:f.valid_from||null,validUntil:f.valid_until||null}}),_=u.map(f=>f.teamId).filter(Boolean),p=u.map(f=>f.globalSeasonId).filter(Boolean),m=(r.error?[]:r.data||[]).map(f=>f.player_id).filter(Boolean);return{...e,allowedTeamIds:tt([...t,..._]),allowedTeamSeasonIds:tt(n),allowedGlobalSeasonIds:tt(p),linkedPlayerIds:tt([...a,...m]),contextualMemberships:u,authorizationModel:i.length>0?"V3_HYBRID":"LEGACY_COMPAT"}}}class vr{constructor(e){this.supabase=e}async getCurrentState(){var r;if(!((r=this.supabase)!=null&&r.rpc))throw new Error("ACCOUNT_STATUS_BACKEND_UNAVAILABLE");const{data:e,error:t}=await this.supabase.rpc("iq_current_account_state");if(t){const i=new Error(t.message||"ACCOUNT_STATUS_LOOKUP_FAILED");throw i.code="ACCOUNT_STATUS_LOOKUP_FAILED",i.cause=t,i}const a=(e==null?void 0:e.account_status)??(e==null?void 0:e.accountStatus),s=Ot(a);return{active:!!(e!=null&&e.active)&&s===Pe.ACTIVE,accountStatus:s,changedAt:(e==null?void 0:e.changed_at)??(e==null?void 0:e.changedAt)??null,reasonCode:(e==null?void 0:e.reason_code)??(e==null?void 0:e.reasonCode)??null}}}const yr="modulepreload",Sr=function(o,e){return new URL(o,e).href},as={},fe=function(e,t,a){let s=Promise.resolve();if(t&&t.length>0){const i=document.getElementsByTagName("link"),n=document.querySelector("meta[property=csp-nonce]"),d=(n==null?void 0:n.nonce)||(n==null?void 0:n.getAttribute("nonce"));s=Promise.allSettled(t.map(c=>{if(c=Sr(c,a),c in as)return;as[c]=!0;const u=c.endsWith(".css"),_=u?'[rel="stylesheet"]':"";if(!!a)for(let f=i.length-1;f>=0;f--){const g=i[f];if(g.href===c&&(!u||g.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${c}"]${_}`))return;const m=document.createElement("link");if(m.rel=u?"stylesheet":yr,u||(m.as="script"),m.crossOrigin="",m.href=c,d&&m.setAttribute("nonce",d),document.head.appendChild(m),u)return new Promise((f,g)=>{m.addEventListener("load",f),m.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${c}`)))})}))}function r(i){const n=new Event("vite:preloadError",{cancelable:!0});if(n.payload=i,window.dispatchEvent(n),!n.defaultPrevented)throw i}return s.then(i=>{for(const n of i||[])n.status==="rejected"&&r(n.reason);return e().catch(r)})},Ar=Object.freeze({team:async({supabase:o,authController:e})=>{const{TeamStatsView:t}=await fe(async()=>{const{TeamStatsView:a}=await import("./TeamStatsView-DTZ73Kco.js");return{TeamStatsView:a}},[],import.meta.url);return new t(o,e)},liveeditor:async({gameController:o,authController:e})=>{const{GameLiveEditorView:t}=await fe(async()=>{const{GameLiveEditorView:a}=await import("./GameLiveEditorView-D0HNO3qs.js");return{GameLiveEditorView:a}},__vite__mapDeps([0,1]),import.meta.url);return new t(o,e)},heatmap:async({supabase:o,authController:e})=>{const{HeatmapAnalysisView:t}=await fe(async()=>{const{HeatmapAnalysisView:a}=await import("./HeatmapAnalysisView-DuF4VkCO.js");return{HeatmapAnalysisView:a}},[],import.meta.url);return new t(o,e)},advanced:async({gameController:o})=>{const{AdvancedStatsView:e}=await fe(async()=>{const{AdvancedStatsView:t}=await import("./AdvancedStatsView-BuG8Gyvq.js");return{AdvancedStatsView:t}},[],import.meta.url);return new e(o)},boxscore:async({supabase:o,authController:e})=>{const{GameBoxScoreView:t}=await fe(async()=>{const{GameBoxScoreView:a}=await import("./GameBoxScoreView-BpDEEIrg.js");return{GameBoxScoreView:a}},[],import.meta.url);return new t(o,e)},player:async({supabase:o,authController:e})=>{const{PlayerStatsView:t}=await fe(async()=>{const{PlayerStatsView:a}=await import("./PlayerStatsView-Cbe-j3bg.js");return{PlayerStatsView:a}},[],import.meta.url);return new t(o,e)},lineups:async({authController:o})=>{const{LineupsView:e}=await fe(async()=>{const{LineupsView:t}=await import("./LineupsView-BgoTHbWn.js");return{LineupsView:t}},[],import.meta.url);return new e(o)},comparator:async({authController:o})=>{const{ComparatorView:e}=await fe(async()=>{const{ComparatorView:t}=await import("./ComparatorView-DzdBsCp7.js");return{ComparatorView:t}},[],import.meta.url);return new e(o)},reports:async({authController:o})=>{const{ReportsView:e}=await fe(async()=>{const{ReportsView:t}=await import("./ReportsView-qdPESf6t.js");return{ReportsView:t}},[],import.meta.url);return new e(o)},familyworkspace:async({supabase:o,authController:e})=>{const{FamilyWorkspaceView:t}=await fe(async()=>{const{FamilyWorkspaceView:a}=await import("./FamilyWorkspaceView-abQLx7sb.js");return{FamilyWorkspaceView:a}},__vite__mapDeps([2,3,4]),import.meta.url);return new t(o,e)},business:async({supabase:o,authController:e})=>{const{BusinessMetricsView:t}=await fe(async()=>{const{BusinessMetricsView:a}=await import("./BusinessMetricsView-CccHMYOI.js");return{BusinessMetricsView:a}},__vite__mapDeps([5,4]),import.meta.url);return new t(o,e)},familyadvisor:async({authController:o})=>{const{FamilyAdvisorView:e}=await fe(async()=>{const{FamilyAdvisorView:t}=await import("./FamilyAdvisorView-Bp6BTD4y.js");return{FamilyAdvisorView:t}},[],import.meta.url);return new e(o)},training:async({supabase:o,authController:e})=>{const{TrainingView:t}=await fe(async()=>{const{TrainingView:a}=await import("./TrainingView-BNbinAl_.js");return{TrainingView:a}},__vite__mapDeps([6,7]),import.meta.url);return new t(o,e)},nutrition:async({supabase:o,authController:e})=>{const{NutritionView:t}=await fe(async()=>{const{NutritionView:a}=await import("./NutritionView-wCu5If7l.js");return{NutritionView:a}},__vite__mapDeps([8,9]),import.meta.url);return new t(o,e)},player360:async({supabase:o,authController:e})=>{const{Player360View:t}=await fe(async()=>{const{Player360View:a}=await import("./Player360View-DGfOnt_B.js");return{Player360View:a}},__vite__mapDeps([10,7,9]),import.meta.url);return new t(o,e)},privacy:async({supabase:o,authController:e})=>{const{PrivacyCenterView:t}=await fe(async()=>{const{PrivacyCenterView:a}=await import("./PrivacyCenterView-D1E_HMYj.js");return{PrivacyCenterView:a}},__vite__mapDeps([11,3]),import.meta.url);return new t(o,e)},ask:async({authController:o})=>{const{AskAIView:e}=await fe(async()=>{const{AskAIView:t}=await import("./AskAIView-0KwfudGB.js");return{AskAIView:t}},[],import.meta.url);return new e(o)},profile:async({authController:o})=>{const{ProfileView:e}=await fe(async()=>{const{ProfileView:t}=await import("./ProfileView-fXvTaI_-.js");return{ProfileView:t}},[],import.meta.url);return new e(o)}}),ss=Object.freeze({equipo:"team",perfil:"profile"}),Ir=Object.freeze({livehud:async({authController:o},{gameId:e=null}={})=>{const{LiveScoreHUDView:t}=await fe(async()=>{const{LiveScoreHUDView:a}=await import("./LiveScoreHUDView-DPdZq37X.js");return{LiveScoreHUDView:a}},[],import.meta.url);return new t(o,e)},easyentry:async({gameController:o,authController:e,i18n:t},{gameId:a=null}={})=>{const{EasyStatsEntryView:s}=await fe(async()=>{const{EasyStatsEntryView:r}=await import("./EasyStatsEntryView-LlQYI7Gz.js");return{EasyStatsEntryView:r}},[],import.meta.url);return new s(o,e,t,a)}});class Tr{constructor(e,t={}){this.dependencies=Object.freeze({...e}),this.target=t,this.pending=new Map}_canonicalKey(e){return ss[e]||e}async get(e){const t=this._canonicalKey(e);if(this.target[t])return this.target[t];if(this.pending.has(t))return this.pending.get(t);const a=Ar[t];if(!a)throw new Error(`UNKNOWN_LAZY_VIEW:${t}`);const s=a(this.dependencies).then(r=>{this.target[t]=r;for(const[i,n]of Object.entries(ss))n===t&&(this.target[i]=r);return r}).finally(()=>this.pending.delete(t));return this.pending.set(t,s),s}async create(e,t={}){const a=Ir[e];if(!a)throw new Error(`UNKNOWN_LAZY_VIEW_FACTORY:${e}`);return a(this.dependencies,t)}}Object.freeze(Object.fromEntries(Object.values(l).map(o=>[o,Object.entries(wt).filter(([,e])=>e.includes(o)).map(([e])=>e)])));const Yt={appName:"IQ Basket"};class Nr{constructor(){this.activeTab="login"}t(e,t=""){return(j?j.t(e,t):se.t(e,t))||t}render(e={}){const t=localStorage.getItem("iq_lang")||"es",a=e.errorMessage?se.t("auth.error",{},e.errorMessage)||e.errorMessage:"",s=a?`<div style="background-color: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px; border-radius: 8px; font-size: 12px; margin-bottom: 16px; font-weight: 600;">${a}</div>`:"";return`
      <div style="min-height: 100vh; background-color: var(--color-bg, #f8fafc); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; font-family: var(--font-family-base, system-ui); position: relative; box-sizing: border-box;">
        
        <!-- Selector Global de Idioma -->
        <div style="position: absolute; top: 16px; right: 20px; display: flex; align-items: center; gap: 8px; background: white; padding: 6px 12px; border-radius: 20px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); z-index: 10;">
          <span style="font-size: 14px;">🌐</span>
          <select id="auth-lang-toggle" style="border: none; background: transparent; font-size: 12px; font-weight: 800; color: #334155; outline: none; cursor: pointer; min-height: 32px;">
            <option value="es" ${t==="es"?"selected":""}>Español (ES)</option>
            <option value="ca" ${t==="ca"||t==="cat"?"selected":""}>Català (CAT)</option>
            <option value="en" ${t==="en"?"selected":""}>English (EN)</option>
            <option value="fr" ${t==="fr"?"selected":""}>Français (FR)</option>
          </select>
        </div>

        <!-- Logotipo Superior -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 64px; height: 64px; background-color: var(--color-secondary, #0f172a); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
            <span style="font-size: 32px;">🏀</span>
          </div>
          <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em;">${Yt.appName}</h1>
          <p style="font-size: 13px; color: #64748b; margin-top: 4px;">${this.t("app_tagline","Análisis estadístico de baloncesto")}</p>
        </div>

        <!-- Tarjeta de Formulario -->
        <div class="card" style="width: 100%; max-width: 440px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); box-sizing: border-box;">
          
          <!-- Pestañas de Navegación -->
          <div style="display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px;">
            <button
              type="button"
              id="tab-btn-login"
              style="flex: 1; padding: 10px; background: none; border: none; font-size: 13px; font-weight: 800; cursor: pointer; color: ${this.activeTab==="login"?"#1e3a8a":"#64748b"}; border-bottom: 3px solid ${this.activeTab==="login"?"#1e3a8a":"transparent"}; margin-bottom: -2px; min-height: 44px;"
            >
              ${this.t("login_title","Iniciar sesión")}
            </button>
            <button
              type="button"
              id="tab-btn-register"
              style="flex: 1; padding: 10px; background: none; border: none; font-size: 13px; font-weight: 800; cursor: pointer; color: ${this.activeTab==="register"?"#1e3a8a":"#64748b"}; border-bottom: 3px solid ${this.activeTab==="register"?"#1e3a8a":"transparent"}; margin-bottom: -2px; min-height: 44px;"
            >
              ${this.t("register_tab","Alta Nueva (Registro)")}
            </button>
          </div>

          <div id="login-error-container">${s}</div>

          <!-- 1. FORMULARIO DE INICIO DE SESIÓN -->
          ${this.activeTab==="login"?`
            <form id="login-form" style="display: flex; flex-direction: column; gap: 18px;">
              
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label for="login-email" style="display: block; font-size: 12px; font-weight: 700; color: #334155;">
                  ${this.t("email_label","Mail de acceso")} *
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="usuario@iqbasket.com"
                  style="width: 100%; height: 44px; padding: 10px 12px; background-color: #f0f7ff; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; color: #0f172a; outline: none; box-sizing: border-box;"
                />
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label for="login-password" style="display: block; font-size: 12px; font-weight: 700; color: #334155;">
                  ${this.t("password_label","Contraseña")} *
                </label>
                <div style="position: relative; display: flex; align-items: center; width: 100%;">
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    style="width: 100%; height: 44px; padding: 10px 48px 10px 12px; background-color: #f0f7ff; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; color: #0f172a; outline: none; box-sizing: border-box;"
                  />
                  <button
                    type="button"
                    class="pwd-toggle-btn"
                    data-target="login-password"
                    style="position: absolute; right: 4px; background: none; border: none; cursor: pointer; color: #64748b; font-size: 16px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;"
                    title="${this.t("toggle_password_title","Mostrar/Ocultar contraseña")}"
                  >
                    👁️
                  </button>
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                style="width: 100%; height: 44px; background-color: var(--color-primary, #f97316); color: #ffffff; font-weight: 800; border-radius: 10px; border: none; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px;"
              >
                ➔ ${this.t("enter_button","Entrar")}
              </button>
            </form>

            <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center; display: flex; flex-direction: column; gap: 8px;">
              <button type="button" id="btn-switch-to-register" style="background: none; border: none; font-size: 12px; color: #2563eb; font-weight: 700; cursor: pointer; min-height: 36px;">
                ${this.t("new_registration","Alta nueva (Crear cuenta)")}
              </button>
              <a href="#" style="font-size: 12px; color: #94a3b8; text-decoration: none; min-height: 36px; display: inline-flex; align-items: center; justify-content: center;">
                ${this.t("forgot_password","¿Olvidaste tu contraseña?")}
              </a>
            </div>
          `:""}

          <!-- 2. FORMULARIO DE ALTA NUEVA / REGISTRO -->
          ${this.activeTab==="register"?`
            <form id="register-form" style="display: flex; flex-direction: column; gap: 14px;">
              
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 12px; border-radius: 8px; font-size: 11px; color: #166534; font-weight: 600;">
                ℹ️ ${this.t("register_subtitle","Obtendrás acceso en modo INVITADO (Solo Lectura para Demo).")}
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label for="reg-firstname" style="font-size: 11px; font-weight: 700; color: #334155;">
                    ${this.t("first_name","Nombre")} *
                  </label>
                  <input id="reg-firstname" type="text" required placeholder="Ej. Carlos" style="height: 40px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label for="reg-lastname" style="font-size: 11px; font-weight: 700; color: #334155;">
                    ${this.t("last_name","Apellidos")} *
                  </label>
                  <input id="reg-lastname" type="text" required placeholder="Ej. García" style="height: 40px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="reg-email" style="font-size: 11px; font-weight: 700; color: #334155;">
                  ${this.t("email_label","Correo Electrónico")} *
                </label>
                <input id="reg-email" type="email" required placeholder="usuario@ejemplo.com" style="height: 40px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
              </div>

              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="reg-password" style="font-size: 11px; font-weight: 700; color: #334155;">
                  ${this.t("password_label","Contraseña")} *
                </label>
                <div style="position: relative; display: flex; align-items: center; width: 100%;">
                  <input id="reg-password" type="password" required placeholder="Mínimo 6 caracteres" minlength="6" style="width: 100%; height: 40px; padding: 8px 40px 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
                  <button type="button" class="pwd-toggle-btn" data-target="reg-password" style="position: absolute; right: 2px; background: none; border: none; cursor: pointer; color: #64748b; font-size: 14px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;">👁️</button>
                </div>
              </div>

              <input type="hidden" id="reg-role" value="INVITADO" />

              <button
                id="register-submit-btn"
                type="submit"
                style="width: 100%; height: 44px; background-color: #1e3a8a; color: #ffffff; font-weight: 800; border-radius: 10px; border: none; font-size: 13px; cursor: pointer; margin-top: 8px;"
              >
                📝 ${this.t("register_button","Completar Registro (Invitado)")}
              </button>
            </form>

            <div style="margin-top: 16px; text-align: center;">
              <button type="button" id="btn-switch-to-login" style="background: none; border: none; font-size: 12px; color: #2563eb; font-weight: 700; cursor: pointer; min-height: 36px;">
                ${this.t("already_have_account","¿Ya tienes una cuenta? Iniciar sesión")}
              </button>
            </div>
          `:""}

        </div>
      </div>
    `}}class Q{static t(e,t=""){return(j?j.t(e,t):se.t(e,t))||t}static _normalizeRouteKey(e){const t=String(e||"").toLowerCase().trim();return["partidos","games","game","live"].includes(t)?"games":["approvals","requests","solicitudes","bandeja"].includes(t)?"approvals":["advanced","advanced_stats"].includes(t)?"advanced":["heatmap","calor","shotchart"].includes(t)?"heatmap":["easy-entry","easy","entrada-facil","live-entry"].includes(t)?"easy-entry":["boxscore","registro"].includes(t)?"boxscore":["team","equipo"].includes(t)?"team":["players","jugadores","player","jugador"].includes(t)?"players":["training","entrenamientos","development","desarrollo"].includes(t)?"training":["nutrition","nutricion"].includes(t)?"nutrition":["privacy","privacy-center","privacidad","autorizaciones"].includes(t)?"privacy":["settings","configuracion","translations"].includes(t)?"settings":["lineups","quintetos"].includes(t)?"lineups":["comparator","comparador"].includes(t)?"comparator":["reports","informes","informe"].includes(t)?"reports":["family","familia","familias","mi-jugador"].includes(t)?"family":["family-advisor","bienestar","advisor"].includes(t)?"family-advisor":["business","negocio","growth"].includes(t)?"business":["ask","pregunta","preguntale","ai","ia","ask-ai"].includes(t)?"ask":["profile","perfil"].includes(t)?"profile":t||"dashboard"}static updateActiveMenu(e){const t=Q._normalizeRouteKey(e);document.querySelectorAll(".nav-link, .mobile-nav-item").forEach(s=>{s.getAttribute("data-route-key")===t?s.classList.add("active"):s.classList.remove("active")})}static _restoreSidebarScroll(){const e=sessionStorage.getItem("iq_sidebar_scroll");if(e!==null){const t=parseInt(e,10),a=document.querySelectorAll(".sidebar-inner, .app-sidebar, #app-sidebar");a.forEach(s=>{s.scrollTop=t}),requestAnimationFrame(()=>{a.forEach(s=>{s.scrollTop=t})})}}static _bindSidebarScrollPreservation(){document.querySelectorAll(".sidebar-inner, .app-sidebar, #app-sidebar").forEach(t=>{t.addEventListener("scroll",()=>{sessionStorage.setItem("iq_sidebar_scroll",t.scrollTop)},{passive:!0})})}static bindMobileDrawerEvents(){Q._restoreSidebarScroll(),Q._bindSidebarScrollPreservation();const e=document.getElementById("btn-mobile-more-toggle"),t=document.getElementById("btn-close-drawer"),a=document.getElementById("mobile-more-drawer");if(!e||!a)return;const s=r=>{a.classList.toggle("open",r),a.classList.toggle("is-visible",r),a.setAttribute("aria-hidden",r?"false":"true"),a.style.display=r?"flex":"none",e.setAttribute("aria-expanded",r?"true":"false"),document.body.style.overflow=r?"hidden":""};e.dataset.drawerBound!=="true"&&(e.dataset.drawerBound="true",e.addEventListener("click",r=>{r.preventDefault(),r.stopPropagation(),s(!a.classList.contains("open"))})),t&&t.dataset.drawerBound!=="true"&&(t.dataset.drawerBound="true",t.addEventListener("click",r=>{r.preventDefault(),r.stopPropagation(),s(!1)})),a.dataset.drawerBound!=="true"&&(a.dataset.drawerBound="true",a.addEventListener("click",r=>{r.target===a&&s(!1)})),a.querySelectorAll("a, button, .drawer-item").forEach(r=>{r.dataset.drawerActionBound!=="true"&&(r.dataset.drawerActionBound="true",r.addEventListener("click",i=>{if(r.classList.contains("disabled-link")){i.preventDefault(),i.stopPropagation(),alert("⚠️ Esta función no está disponible para tu rol de usuario.");return}s(!1)}))}),document.querySelectorAll(".disabled-link").forEach(r=>{r.dataset.disabledBound!=="true"&&(r.dataset.disabledBound="true",r.addEventListener("click",i=>{i.preventDefault(),i.stopPropagation(),alert("⚠️ Esta función no está disponible para tu rol de usuario.")}))}),document.querySelectorAll(".nav-link").forEach(r=>{r.dataset.scrollBound!=="true"&&(r.dataset.scrollBound="true",r.addEventListener("click",()=>{const i=document.querySelector(".sidebar-inner, .app-sidebar, #app-sidebar");i&&sessionStorage.setItem("iq_sidebar_scroll",i.scrollTop)}))}),s(!1)}static wrap(e,t="dashboard",a="ADMIN"){var W,G,w;const s=document.querySelector(".sidebar-inner, .app-sidebar, #app-sidebar");s&&s.scrollTop>0&&sessionStorage.setItem("iq_sidebar_scroll",s.scrollTop);const r=Q._normalizeRouteKey(t),i=se.getLocale?se.getLocale():"es";localStorage.getItem("iq_user_email");const n=b.getActiveTeamId()||localStorage.getItem("iq_active_team_id")||"",d=((W=b.getActiveSeasonContext)==null?void 0:W.call(b,n))||null,c=((G=b.getActiveSeasonDisplayName)==null?void 0:G.call(b,n))||b.getActiveSeason()||localStorage.getItem("iq_active_season")||"",u=(d==null?void 0:d.team_season_id)||(d==null?void 0:d.teamSeasonId)||(d==null?void 0:d.name)||c,p=b.getTeams()||[],m=((w=b.getSeasons)==null?void 0:w.call(b,n))||[],f=m.length>0?m:c?[{id:"fallback-active-season",name:c,isActive:!0}]:[],g=wt[a]||[],E=H=>g.includes(H),T=!E(l.USE_COMPARATOR),x=!E(l.USE_AI),S=!E(l.VIEW_TRAINING),M=!E(l.VIEW_NUTRITION),v=E(l.VIEW_PRIVACY_AUTHORIZATIONS),A=E(l.VIEW_BUSINESS_METRICS),C=["FAMILIA_TUTOR","JUGADOR","INVITADO"].includes(String(a||"").toUpperCase()),L=[{titleKey:"general",defaultTitle:"GENERAL",items:[{key:"dashboard",labelKey:"dashboard",fallback:"Dashboard",route:"dashboard",svg:'<rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect>'},{key:"approvals",labelKey:"approval_center",fallback:"Solicitudes",route:"approvals",svg:'<path d="M4 4h16v16H4z"></path><path d="M4 9h16"></path><path d="M8 13h8"></path><path d="M8 17h5"></path>'},...A?[{key:"business",labelKey:"business_metrics",fallback:"Negocio",route:"business",svg:'<path d="M4 19V9"></path><path d="M10 19V5"></path><path d="M16 19v-7"></path><path d="M22 19V2"></path>'}]:[]]},{titleKey:"team",defaultTitle:"EQUIPO",items:[{key:"team",labelKey:"team",fallback:"Equipo",route:"team",svg:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle>'},{key:"players",labelKey:"players",fallback:"Jugadores",route:"players",svg:'<circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 1 0-16 0"></path>'},{key:"games",labelKey:"games",fallback:"Partidos",route:"games",svg:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>'},{key:"lineups",labelKey:"lineups",fallback:"Quintetos",route:"lineups",svg:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><circle cx="19" cy="11" r="2"></circle>'}]},{titleKey:"player360.development",defaultTitle:"DESARROLLO",items:[{key:"training",labelKey:"player360.training.nav",fallback:"Entrenamientos",route:"training",disabled:S,svg:'<path d="M6 5v14"></path><path d="M18 5v14"></path><path d="M3 8v8"></path><path d="M21 8v8"></path><path d="M6 12h12"></path>'},{key:"nutrition",labelKey:"player360.nutrition.nav",fallback:"Nutrición",route:"nutrition",disabled:M,svg:'<path d="M12 2v20"></path><path d="M4 7c4 0 8 2 8 6"></path><path d="M20 5c-4 0-8 2-8 7"></path><path d="M6 18h12"></path>'}]},{titleKey:"advanced_stats",defaultTitle:"ESTADÍSTICA AVANZADA",items:[{key:"advanced",labelKey:"advanced_stats",fallback:"Stats Avanzadas",route:"advanced",svg:'<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>'},{key:"heatmap",labelKey:"heatmap_analysis",fallback:"Mapa de Calor",route:"heatmap",svg:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>'},{key:"comparator",labelKey:"comparator",fallback:"Comparador",route:"comparator",disabled:T,svg:'<path d="M16 3h5v5"></path><path d="M8 21H3v-5"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path>'},{key:"reports",labelKey:"reports",fallback:"Informes",route:"reports",svg:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line>'},{key:"ask",labelKey:"ask_ai",fallback:"Asistente IQ",route:"ask",disabled:x,svg:'<path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12L2.5 7.5"></path><path d="M12 12v10"></path>'}]},{titleKey:"welfare",defaultTitle:"BIENESTAR",items:[{key:"family",labelKey:"family_workspace",fallback:"Mi jugador",route:"family",svg:'<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path><path d="M18 5l2 2 3-3"></path>'},{key:"family-advisor",labelKey:"family_advisor",fallback:"Familias & Bienestar",route:"family-advisor",svg:'<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>'}]},{titleKey:"profile",defaultTitle:"MI PERFIL",items:[{key:"profile",labelKey:"profile",fallback:"Mi Perfil",route:"profile",svg:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>'},...v?[{key:"privacy",labelKey:"privacy_center",fallback:"Privacidad y accesos",route:"privacy",svg:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path>'}]:[],{key:"settings",labelKey:"settings",fallback:"Configuración",route:"settings",svg:'<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'}]}].map(H=>`
      <div class="nav-group">
        <span class="nav-group-title">${Q.t(H.titleKey,H.defaultTitle).toUpperCase()}</span>
        ${H.items.map(K=>{const ne=r===K.key,ue=Q.t(K.labelKey,K.fallback),le=!!K.disabled;return`
            <a href="${le?"javascript:void(0);":"#/"+K.route}" 
               class="nav-link ${ne?"active":""} ${le?"disabled-link":""}" 
               data-route-key="${K.key}">
              <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${K.svg}</svg>
              <span class="nav-label">${ue}${le?" 🔒":""}</span>
            </a>
          `}).join("")}
      </div>
    `).join(""),y=p.length>0?p.map(H=>`
      <option value="${H.id}" ${String(H.id)===String(n)?"selected":""}>
        ${H.name} (${H.category||"Senior"})
      </option>
    `).join(""):'<option value="" disabled selected>⚠️ Sin equipos asignados</option>',F=f.length>0?f.map(H=>{const K=H.team_season_id||H.teamSeasonId||H.name,ne=String(H.name||""),ue=ne.match(/^(\d{4})\s*[-\/]\s*(\d{4})$/),le=ue?`${ue[1]}/${ue[2]}`:ne,Z=(d==null?void 0:d.source)==="v3"?String(K)===String(u):String(le)===String(c);return`
        <option value="${K}" ${Z?"selected":""}>
          ${le}
        </option>
      `}).join(""):'<option value="" disabled selected>⚠️ Sin temporadas</option>',k=`
      <option value="es" ${i==="es"?"selected":""}>ES</option>
      <option value="ca" ${i==="ca"||i==="cat"?"selected":""}>CAT</option>
      <option value="en" ${i==="en"?"selected":""}>EN</option>
      <option value="fr" ${i==="fr"?"selected":""}>FR</option>
    `;return`
      <div class="app-layout">

        <!-- HEADER MÓVIL (< 768px) -->
        <header class="mobile-header mobile-only">
          <div class="mobile-brand">
            <div class="logo-box" style="width: 28px; height: 28px; font-size: 12px;">IQ</div>
            <span class="brand-title">${Yt.appName}</span>
          </div>

          <div class="mobile-selectors-row">
            <select id="mobile-select-team" class="mobile-select">
              ${y}
            </select>
            <select id="mobile-select-season" class="mobile-select">
              ${F}
            </select>
            <div class="mobile-lang-box">
              <span class="mobile-lang-icon">🌐</span>
              <select id="mobile-select-lang-toggle" class="mobile-select mobile-lang-select">
                ${k}
              </select>
            </div>
          </div>
        </header>

        <!-- BARRA LATERAL (DESKTOP >= 768px) -->
        <aside id="app-sidebar" class="app-sidebar desktop-only">
          <div class="sidebar-inner">

            <div class="sidebar-header">
              <div class="logo-box">IQ</div>
              <span class="logo-title">${Yt.appName}</span>
            </div>

            <div class="sidebar-selectors">
              <div class="selector-group">
                <label>${Q.t("team","EQUIPO").toUpperCase()}</label>
                <select id="sidebar-select-team" class="sidebar-select">
                  ${y}
                </select>
              </div>
              <div class="selector-group">
                <label>${Q.t("season","TEMPORADA").toUpperCase()}</label>
                <select id="sidebar-select-season" class="sidebar-select">
                  ${F}
                </select>
              </div>
            </div>

            <nav class="sidebar-nav">
              ${L}
            </nav>

            <div class="sidebar-footer">
              <div class="lang-row">
                <span class="lang-label">🌐 ${Q.t("language","IDIOMA")}</span>
                <select id="select-lang-toggle" class="lang-select">
                  <option value="es" ${i==="es"?"selected":""}>Español</option>
                  <option value="ca" ${i==="ca"||i==="cat"?"selected":""}>Català</option>
                  <option value="en" ${i==="en"?"selected":""}>English</option>
                  <option value="fr" ${i==="fr"?"selected":""}>Français</option>
                </select>
              </div>

              <button type="button" id="btn-logout" class="btn-logout" data-session-action="logout">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                <span>${Q.t("logout","Cerrar sesión")}</span>
              </button>
            </div>

          </div>
        </aside>

        <!-- ÁREA PRINCIPAL -->
        <main class="app-main">
          <div id="dashboard-content-area">
            ${e}
          </div>
        </main>

        <!-- NAVEGACIÓN INFERIOR MÓVIL (5 ÍTEMS) -->
        <nav class="mobile-bottom-bar mobile-only" aria-label="Navegación Móvil">
          <a href="#/dashboard" class="mobile-nav-item ${r==="dashboard"?"active":""}" data-route-key="dashboard">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            <span class="mobile-label">${Q.t("dashboard","Dashboard")}</span>
          </a>
          <a href="#/team" class="mobile-nav-item ${r==="team"?"active":""}" data-route-key="team">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            <span class="mobile-label">${Q.t("team","Equipo")}</span>
          </a>
          <a href="#/games" class="mobile-nav-item ${r==="games"?"active":""}" data-route-key="games">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line></svg>
            <span class="mobile-label">${Q.t("games","Partidos")}</span>
          </a>
          ${C?`
          <a href="#/family" class="mobile-nav-item ${r==="family"?"active":""}" data-route-key="family">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>
            <span class="mobile-label">${Q.t("family_workspace","Mi jugador")}</span>
          </a>`:`
          <a href="#/heatmap" class="mobile-nav-item ${r==="heatmap"?"active":""}" data-route-key="heatmap">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            <span class="mobile-label">${Q.t("heatmap_analysis","Calor")}</span>
          </a>`}
          <button type="button" id="btn-mobile-more-toggle" class="mobile-nav-item" aria-expanded="false">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
            <span class="mobile-label">${Q.t("navigation.more","Más")}</span>
          </button>
        </nav>

        <!-- BOTTOM SHEET MÓVIL PARA "MÁS" -->
        <div id="mobile-more-drawer" class="mobile-drawer-overlay mobile-only" aria-hidden="true" style="display: none;">
          <div class="mobile-drawer-content">
            <div class="drawer-header">
              <span class="drawer-title">${Q.t("navigation.more","Más Opciones")}</span>
              <button type="button" id="btn-close-drawer" class="drawer-close">&times;</button>
            </div>
            <div class="drawer-grid">
              <a href="#/approvals" class="drawer-item" data-route-key="approvals">
                <span class="drawer-icon">📥</span>
                <span>${Q.t("approval_center","Solicitudes")}</span>
              </a>
              <a href="#/advanced" class="drawer-item">
                <span class="drawer-icon">📈</span>
                <span>${Q.t("advanced_stats","Stats Avanzadas")}</span>
              </a>
              <a href="#/players" class="drawer-item">
                <span class="drawer-icon">👤</span>
                <span>${Q.t("players","Jugadores")}</span>
              </a>
              <a href="${S?"javascript:void(0);":"#/training"}" class="drawer-item ${S?"disabled-link":""}" data-route-key="training">
                <span class="drawer-icon">🏋️</span>
                <span>${Q.t("player360.training.nav","Entrenamientos")}${S?" 🔒":""}</span>
              </a>
              <a href="${M?"javascript:void(0);":"#/nutrition"}" class="drawer-item ${M?"disabled-link":""}" data-route-key="nutrition">
                <span class="drawer-icon">🥤</span>
                <span>${Q.t("player360.nutrition.nav","Nutrición")}${M?" 🔒":""}</span>
              </a>
              <a href="#/lineups" class="drawer-item">
                <span class="drawer-icon">🏀</span>
                <span>${Q.t("lineups","Quintetos")}</span>
              </a>
              <a href="${T?"javascript:void(0);":"#/comparator"}" class="drawer-item ${T?"disabled-link":""}">
                <span class="drawer-icon">⚖️</span>
                <span>${Q.t("comparator","Comparador")}${T?" 🔒":""}</span>
              </a>
              <a href="#/reports" class="drawer-item">
                <span class="drawer-icon">📄</span>
                <span>${Q.t("reports","Informes")}</span>
              </a>
              <a href="#/family-advisor" class="drawer-item">
                <span class="drawer-icon">👨‍👩‍👧‍👦</span>
                <span>${Q.t("family_advisor","Familias & Bienestar")}</span>
              </a>
              <a href="${x?"javascript:void(0);":"#/ask"}" class="drawer-item ${x?"disabled-link":""}">
                <span class="drawer-icon">🤖</span>
                <span>${Q.t("ask_ai","Asistente IQ")}${x?" 🔒":""}</span>
              </a>
              ${v?`
              <a href="#/privacy" class="drawer-item" data-route-key="privacy">
                <span class="drawer-icon">🛡️</span>
                <span>${Q.t("privacy_center","Privacidad y accesos")}</span>
              </a>`:""}
              <a href="#/profile" class="drawer-item">
                <span class="drawer-icon">👤</span>
                <span>${Q.t("profile","Perfil")}</span>
              </a>
              <a href="#/settings" class="drawer-item">
                <span class="drawer-icon">⚙️</span>
                <span>${Q.t("settings","Configuración")}</span>
              </a>
              <button type="button"
                      id="btn-mobile-logout"
                      class="drawer-item drawer-item-logout"
                      data-session-action="logout">
                <span class="drawer-icon">↪</span>
                <span>${Q.t("logout","Cerrar sesión")}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- ESTILOS CON ALTO CONTRASTE TIPOGRÁFICO Y PROTECCIÓN DE COLORES -->
      <style>
        *, *::before, *::after {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          background-color: var(--color-bg, #f8fafc);
          font-family: var(--font-family-base, system-ui, -apple-system, sans-serif);
          overflow-x: hidden;
        }

        .app-layout {
          min-height: 100vh;
          width: 100%;
          display: flex;
          background-color: var(--color-bg, #f8fafc);
        }

        .desktop-only { display: flex; }
        .mobile-only { display: none; }

        .disabled-link {
          opacity: 0.45 !important;
          cursor: not-allowed !important;
          filter: grayscale(0.8);
        }

        /* SIDEBAR DESKTOP CON FONDO OSCURO */
        .app-sidebar {
          width: 260px;
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          background-color: #0b1329 !important;
          color: #ffffff !important;
          box-sizing: border-box;
          z-index: 50;
          border-right: 1px solid #1e293b;
        }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px 14px;
          box-sizing: border-box;
        }

        .sidebar-inner::-webkit-scrollbar {
          width: 5px;
        }
        .sidebar-inner::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .sidebar-inner::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 4px;
        }

        .logo-box {
          width: 32px;
          height: 32px;
          background-color: var(--color-primary, #f97316);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 900;
          font-size: 14px;
          flex-shrink: 0;
        }

        .logo-title {
          font-weight: 900;
          font-size: 18px;
          letter-spacing: -0.02em;
          color: #ffffff !important;
        }

        .sidebar-selectors {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 4px;
        }

        /* ETIQUETAS: BLANCO NÍTIDO */
        .selector-group label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #f1f5f9 !important;
          display: block;
          margin-bottom: 4px;
          letter-spacing: 0.05em;
        }

        .sidebar-select {
          width: 100%;
          background-color: #1e293b !important;
          border: 1px solid #475569;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 600;
          outline: none;
          box-sizing: border-box;
          cursor: pointer;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .nav-group {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        /* TÍTULOS DE CATEGORÍA: AZUL CELESTE LUMINOSO */
        .nav-group-title {
          font-size: 10px;
          font-weight: 800;
          color: #60a5fa !important;
          letter-spacing: 0.08em;
          padding-left: 10px;
          margin-bottom: 4px;
        }

        /* ENLACES Y TEXTOS INACTIVOS: BLANCO HUESO (#f8fafc) CON MÁXIMO CONTRASTE */
        .nav-link, 
        .app-sidebar a, 
        .app-sidebar a span,
        .app-sidebar .nav-label {
          color: #f8fafc !important;
          -webkit-text-fill-color: #f8fafc !important;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.15s ease;
          min-height: 40px;
        }

        .nav-link .nav-svg {
          stroke: #f8fafc !important;
          color: #f8fafc !important;
        }

        .nav-link:hover {
          background-color: rgba(255, 255, 255, 0.14) !important;
          color: #ffffff !important;
        }

        .nav-link:hover .nav-svg,
        .nav-link:hover span {
          stroke: #ffffff !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        /* ENLACE ACTIVO: FONDO NARANJA CON TEXTO BLANCO */
        .nav-link.active,
        .app-sidebar .nav-link.active span,
        .app-sidebar .nav-link.active .nav-label {
          background-color: var(--color-primary, #f97316) !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          box-shadow: 0 4px 10px rgba(249, 115, 22, 0.35);
        }

        .nav-link.active .nav-svg {
          stroke: #ffffff !important;
          color: #ffffff !important;
        }

        .nav-svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .sidebar-footer {
          border-top: 1px solid #1e293b;
          padding-top: 14px;
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lang-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 4px;
        }

        .lang-label {
          font-size: 11px;
          font-weight: 800;
          color: #f1f5f9 !important;
        }

        .lang-select {
          background-color: #1e293b !important;
          border: 1px solid #475569;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 700;
          outline: none;
          cursor: pointer;
        }

        .btn-logout {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          font-size: 13px;
          font-weight: 700;
          color: #fca5a5 !important;
          background: transparent;
          border: 1px solid #334155;
          cursor: pointer;
          border-radius: 8px;
          min-height: 40px;
          transition: background 0.15s ease;
        }

        .btn-logout .nav-svg {
          stroke: #fca5a5 !important;
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #ffffff !important;
        }

        .btn-logout:hover .nav-svg {
          stroke: #ffffff !important;
        }

        .app-main {
          flex: 1;
          margin-left: 260px;
          padding: 32px 24px;
          box-sizing: border-box;
          display: flex;
          justify-content: center;
          min-width: 0;
          width: calc(100% - 260px);
        }

        #dashboard-content-area {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }

          .app-layout {
            flex-direction: column;
          }

          .mobile-header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background-color: var(--color-secondary, #0f172a);
            color: #ffffff;
            height: 56px;
            padding: 0 10px;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #1e293b;
            gap: 6px;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 800;
            color: #ffffff;
            flex-shrink: 0;
          }

          .mobile-brand .brand-title {
            font-size: 13px;
            font-weight: 900;
          }

          .mobile-selectors-row {
            display: flex;
            gap: 4px;
            align-items: center;
            flex: 1;
            justify-content: flex-end;
          }

          .mobile-select {
            background-color: #1e293b;
            border: 1px solid #334155;
            color: #ffffff;
            border-radius: 6px;
            padding: 4px;
            font-size: 11px;
            font-weight: 700;
            outline: none;
            max-width: 110px;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            height: 34px;
          }

          .mobile-lang-box {
            display: flex;
            align-items: center;
            background-color: #1e293b;
            border: 1px solid #334155;
            border-radius: 6px;
            padding-left: 4px;
            height: 34px;
          }

          .mobile-lang-icon {
            font-size: 12px;
          }

          .mobile-lang-select {
            border: none !important;
            background: transparent !important;
            padding-left: 2px !important;
            width: 52px !important;
          }

          .app-main {
            margin-left: 0;
            width: 100%;
            padding: 16px 12px;
            padding-bottom: calc(64px + env(safe-area-inset-bottom, 16px));
          }

          .mobile-bottom-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: calc(58px + env(safe-area-inset-bottom, 0px));
            padding-bottom: env(safe-area-inset-bottom, 0px);
            background-color: var(--color-secondary, #0f172a);
            border-top: 1px solid #1e293b;
            z-index: 1000;
            display: flex;
            justify-content: space-around;
            align-items: center;
            box-sizing: border-box;
          }

          .mobile-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #cbd5e1;
            text-decoration: none;
            font-size: 10px;
            font-weight: 700;
            flex: 1;
            max-width: 20%;
            height: 100%;
            padding: 4px 0;
            background: none;
            border: none;
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
            box-sizing: border-box;
          }

          .mobile-nav-item.active {
            color: var(--color-primary, #f97316);
          }

          .mobile-svg {
            width: 20px;
            height: 20px;
            margin-bottom: 2px;
          }

          .mobile-label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            display: block;
          }

          .mobile-drawer-overlay {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100dvh;
            min-height: 100dvh;
            background-color: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 1050;
            display: none;
            align-items: flex-end;
            overflow: hidden;
            overscroll-behavior: contain;
          }

          .mobile-drawer-overlay.open {
            display: flex !important;
          }

          .mobile-drawer-content {
            width: 100%;
            min-height: 0;
            background-color: #ffffff;
            border-top-left-radius: 16px;
            border-top-right-radius: 16px;
            padding: 16px;
            padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px));
            max-height: calc(100dvh - max(12px, env(safe-area-inset-top, 0px)));
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-y: contain;
            touch-action: pan-y;
            scrollbar-gutter: stable;
          }

          .drawer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            position: sticky;
            top: -16px;
            background: #ffffff;
            z-index: 2;
            padding: 12px 0 8px;
          }

          .drawer-title {
            font-weight: 800;
            font-size: 16px;
            color: #0f172a;
          }

          .drawer-close {
            font-size: 24px;
            background: none;
            border: none;
            cursor: pointer;
            color: #64748b;
            font-weight: 800;
          }

          .drawer-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .drawer-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 9px 10px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            text-decoration: none;
            color: #0f172a;
            font-weight: 600;
            font-size: 13px;
            min-height: 44px;
            box-sizing: border-box;
            touch-action: manipulation;
          }

          .drawer-item-logout {
            grid-column: 1 / -1;
            justify-content: center;
            width: 100%;
            color: #b91c1c;
            background-color: #fff7f7;
            border-color: #fecaca;
            cursor: pointer;
            font-weight: 800;
          }

          .drawer-item-logout:active {
            background-color: #fee2e2;
          }
        }
      </style>
    `}}se&&typeof se.subscribe=="function"&&se.subscribe(()=>{if(document.querySelectorAll(".nav-link .nav-label").length>0){const e={dashboard:"dashboard",team:"team",players:"players",training:"player360.training.nav",games:"games",lineups:"lineups",advanced:"advanced_stats",heatmap:"heatmap_analysis",comparator:"comparator",reports:"reports","family-advisor":"family_advisor",ask:"ask_ai",profile:"profile",settings:"settings",privacy:"privacy_center"};document.querySelectorAll(".nav-link, .mobile-nav-item, .drawer-item").forEach(t=>{var i;const a=t.getAttribute("data-route-key")||((i=t.getAttribute("href"))==null?void 0:i.replace("#/","")),s=Q._normalizeRouteKey(a),r=e[s];if(r){const n=t.querySelector(".nav-label, .mobile-label, span:last-child");n&&(n.textContent=Q.t(r,n.textContent))}})}});window.addEventListener("hashchange",()=>{Q._restoreSidebarScroll()});const Mt="VISOR";class vs{constructor(e){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e}async _getCurrentProfile(){var r;if(!this.supabase)return null;const{data:e,error:t}=await this.supabase.auth.getUser();if(t||!((r=e==null?void 0:e.user)!=null&&r.id))return null;const{data:a,error:s}=await this.supabase.from("user_profiles").select("id,email,role,global_role,status,assigned_team_ids").eq("id",e.user.id).maybeSingle();if(s)throw s;return a||null}async _resolveTeamSeasonId(e,t=null){if(!this.supabase||!e)return null;if(t)return t;const{data:a,error:s}=await this.supabase.from("team_seasons").select("id,team_id,status,created_at").eq("team_id",e).eq("status","ACTIVE").order("created_at",{ascending:!1}).limit(2);if(s)throw s;if(!Array.isArray(a)||a.length===0)return null;if(a.length>1)throw new Error("Hay más de una temporada activa para este equipo; selecciona la temporada antes de solicitar acceso.");return a[0].id}async listTeamDirectory(){if(!this.supabase)return[];const{data:e,error:t}=await this.supabase.from("teams").select("id,club_id,name,category,competition,color,logo_url").order("name",{ascending:!0});if(t)throw t;return e||[]}async listRequests(){if(!this.supabase)return[];const e=await this._getCurrentProfile();if(!e)return[];let t=this.supabase.from("team_join_requests").select("id,user_id,team_id,team_season_id,requested_role,status,notes,created_at").order("created_at",{ascending:!1});const a=String(e.global_role||e.role||"").toUpperCase();if(a!=="SUPERADMIN"&&a!=="ADMIN")t=t.eq("user_id",e.id);else if(a==="ADMIN"){const p=Array.isArray(e.assigned_team_ids)?e.assigned_team_ids.map(String).filter(Boolean):[];if(p.length===0)return[];t=t.in("team_id",p)}const{data:s,error:r}=await t;if(r)throw r;if(!Array.isArray(s)||s.length===0)return[];const i=[...new Set(s.map(p=>p.team_id).filter(Boolean))],n=[...new Set(s.map(p=>p.user_id).filter(Boolean))],[d,c]=await Promise.all([i.length>0?this.supabase.from("teams").select("id,name").in("id",i):Promise.resolve({data:[],error:null}),n.length>0?this.supabase.from("user_profiles").select("id,email,first_name,last_name").in("id",n):Promise.resolve({data:[],error:null})]);if(d.error)throw d.error;if(c.error)throw c.error;const u=new Map((d.data||[]).map(p=>[String(p.id),p])),_=new Map((c.data||[]).map(p=>[String(p.id),p]));return s.map(p=>{const m=u.get(String(p.team_id)),f=_.get(String(p.user_id)),g=String(p.status||"pending").toUpperCase();return{...p,userEmail:(f==null?void 0:f.email)||"",userName:[f==null?void 0:f.first_name,f==null?void 0:f.last_name].filter(Boolean).join(" "),teamId:p.team_id,teamName:(m==null?void 0:m.name)||"Equipo",requestedRole:p.requested_role||Mt,status:g==="PENDING"?"PENDIENTE":g,date:p.created_at?new Date(p.created_at).toLocaleDateString():""}})}async requestAccess(e,t=Mt,a=null){if(!this.supabase||!e)throw new Error("Equipo no especificado.");const s=await this._getCurrentProfile();if(!(s!=null&&s.id))throw new Error("Usuario no autenticado.");const r=await this._resolveTeamSeasonId(e,a);if(!r)throw new Error("No existe un contexto equipo-temporada activo para esta solicitud.");const{data:i,error:n}=await this.supabase.rpc("iq_v3_request_team_access",{target_team_season_id:r,requested_function_role:t||Mt});if(n)throw n;return Array.isArray(i)?i[0]||null:i}async reviewRequest(e,t){if(!this.supabase||!e)throw new Error("Solicitud no especificada.");const{data:a,error:s}=await this.supabase.rpc("iq_v3_review_team_access",{request_id:e,approve_request:!!t});if(s)throw s;return Array.isArray(a)?a[0]||null:a}}function _t(o={}){return{teamId:o.team_id||o.teamId||null,seasonId:o.season_id||o.seasonId||null,teamSeasonId:o.team_season_id||o.teamSeasonId||null}}class Rr{constructor(e,t){this.supabase=e||null,this.auth=t||null}static isLocked(e={}){return String(e.edit_state||e.editState||"OPEN").toUpperCase()==="LOCKED"}canLock(e={}){var t,a;return!!((a=(t=this.auth)==null?void 0:t.canPreview)!=null&&a.call(t,l.LOCK_GAME,_t(e)))}canReopen(e={}){var t,a;return!!((a=(t=this.auth)==null?void 0:t.canPreview)!=null&&a.call(t,l.REOPEN_GAME,_t(e)))}canReviewRequests(e={}){var t,a;return!!((a=(t=this.auth)==null?void 0:t.canPreview)!=null&&a.call(t,l.REVIEW_GAME_LOCK_REQUESTS,_t(e)))}canRequestLock(e={}){var t,a;return!!((a=(t=this.auth)==null?void 0:t.canPreview)!=null&&a.call(t,l.REQUEST_GAME_LOCK,_t(e)))}async listRequests(e=[],{status:t=null}={}){if(!this.supabase)return[];let a=this.supabase.from("game_lock_requests").select("id,game_id,requested_by,requested_by_role,request_reason,status,created_at,resolved_at,resolved_by,resolution_note").order("created_at",{ascending:!1});const s=t?String(t).trim().toUpperCase():null;s&&(a=a.eq("status",s));const r=[...new Set((e||[]).map(String).filter(Boolean))];r.length>0&&(a=a.in("game_id",r));const{data:i,error:n}=await a;if(n)throw n;return i||[]}async listPendingRequests(e=[]){return this.listRequests(e,{status:"PENDING"})}async requestLock(e,t=null){if(!this.supabase)throw new Error("Base de datos no disponible.");const{data:a,error:s}=await this.supabase.rpc("iq_v5_request_game_lock",{p_game_id:e,p_reason:t||null});if(s)throw s;return a}async setLocked(e,t,a=null){if(!this.supabase)throw new Error("Base de datos no disponible.");const{data:s,error:r}=await this.supabase.rpc("iq_v5_set_game_edit_state",{p_game_id:e,p_target_state:t?"LOCKED":"OPEN",p_reason:a||null});if(r)throw r;return s}async resolveRequest(e,t,a=null){if(!this.supabase)throw new Error("Base de datos no disponible.");const s=String(t||"").toUpperCase();if(!["APPROVED","REJECTED"].includes(s))throw new Error("Resolución de solicitud no válida.");const{data:r,error:i}=await this.supabase.rpc("iq_v5_resolve_game_lock_request",{p_request_id:e,p_decision:s,p_resolution_note:a||null});if(i)throw i;return r}}function ht(o=null){if(!o)return null;const e=String(o).trim().slice(0,10),t=e.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!t)return null;const a=Number(t[1]),s=Number(t[2]),r=Number(t[3]),i=new Date(a,s-1,r);return i.getFullYear()===a&&i.getMonth()===s-1&&i.getDate()===r?e:null}class ys{constructor(e){this.supabase=e,this._capabilities=null}async getCapabilities({force:e=!1}={}){if(!this.supabase)return{ready:!1};if(!e&&this._capabilities)return this._capabilities;try{const{data:t,error:a}=await this.supabase.rpc("iq_v4_transfer_request_capabilities");if(a)throw a;return this._capabilities=t||{ready:!1},this._capabilities}catch{}try{const{data:t,error:a}=await this.supabase.rpc("iq_v3_transfer_request_capabilities");if(a)throw a;this._capabilities=t||{ready:!1}}catch(t){console.warn("[TransferRequestService] Backend de solicitudes de traspaso no disponible:",(t==null?void 0:t.message)||t),this._capabilities={ready:!1}}return this._capabilities}async listRequests({scopeTeamSeasonId:e=null,targetTeamSeasonId:t=null,status:a=null}={}){const s=await this.getCapabilities();if(!(s!=null&&s.ready)||!this.supabase)return[];const r=!!(s!=null&&s.dual_review),i=["id","player_id","from_team_season_id","to_team_season_id","status","requested_by","requested_at","workflow_version","reviewed_by","reviewed_at","approved_last_date_from","approved_first_date_to","rejection_reason"];r&&i.push("requested_first_date_to");let n=this.supabase.from("roster_transfer_requests").select(i.join(",")).order("requested_at",{ascending:!1});const d=a?String(a).trim().toUpperCase():null;d&&(n=n.eq("status",d));const c=e||t||null;c&&(n=n.or(`from_team_season_id.eq.${c},to_team_season_id.eq.${c}`));const{data:u,error:_}=await n;if(_)throw _;if(!(u!=null&&u.length))return[];const p=[...new Set(u.map(A=>A.player_id).filter(Boolean))],m=[...new Set(u.flatMap(A=>[A.from_team_season_id,A.to_team_season_id]).filter(Boolean))],f=u.map(A=>A.id).filter(Boolean),g=r&&f.length>0?this.supabase.from("roster_transfer_reviews").select("id,request_id,side,decision,effective_date,reviewer_id,reviewed_at,reason").in("request_id",f):Promise.resolve({data:[],error:null}),[E,T,x]=await Promise.all([p.length?this.supabase.from("players").select("id,first_name,last_name,jersey,primary_position").in("id",p):Promise.resolve({data:[],error:null}),m.length?this.supabase.from("team_seasons").select("id,team_id,season_id,status").in("id",m):Promise.resolve({data:[],error:null}),g]);if(E.error)throw E.error;if(T.error)throw T.error;if(x.error)throw x.error;const S=new Map((E.data||[]).map(A=>[String(A.id),A])),M=new Map((T.data||[]).map(A=>[String(A.id),A])),v=new Map;return(x.data||[]).forEach(A=>{const C=String(A.request_id||"");v.has(C)||v.set(C,{}),v.get(C)[String(A.side||"").toUpperCase()]=A}),u.map(A=>{const C=S.get(String(A.player_id))||{},O=M.get(String(A.from_team_season_id))||{},L=M.get(String(A.to_team_season_id))||{},y=v.get(String(A.id))||{},F=y.SOURCE||null,k=y.DESTINATION||null,W=String(A.workflow_version||"").toUpperCase()==="DUAL_REVIEW_V2";return{id:A.id,playerId:A.player_id,playerName:[C.first_name,C.last_name].filter(Boolean).join(" ")||"Jugador",fromTeamSeasonId:A.from_team_season_id,toTeamSeasonId:A.to_team_season_id,originTeamId:O.team_id||null,targetTeamId:L.team_id||null,globalSeasonId:L.season_id||O.season_id||null,status:A.status,requestedBy:A.requested_by,requestedAt:A.requested_at,requestedFirstDateTo:A.requested_first_date_to||null,workflowVersion:A.workflow_version,dualWorkflow:W,sourceDecision:(F==null?void 0:F.decision)||(W?"PENDING":null),sourceDate:(F==null?void 0:F.effective_date)||A.approved_last_date_from||null,sourceReviewedBy:(F==null?void 0:F.reviewer_id)||null,sourceReviewedAt:(F==null?void 0:F.reviewed_at)||null,sourceReason:(F==null?void 0:F.reason)||null,destinationDecision:(k==null?void 0:k.decision)||(W?"PENDING":null),destinationDate:(k==null?void 0:k.effective_date)||A.approved_first_date_to||A.requested_first_date_to||null,destinationReviewedBy:(k==null?void 0:k.reviewer_id)||null,destinationReviewedAt:(k==null?void 0:k.reviewed_at)||null,destinationReason:(k==null?void 0:k.reason)||null,readyForFinalization:W&&(F==null?void 0:F.decision)==="APPROVED"&&(k==null?void 0:k.decision)==="APPROVED",reviewedBy:A.reviewed_by||null,reviewedAt:A.reviewed_at||null,rejectionReason:A.rejection_reason||null}})}async listPending({scopeTeamSeasonId:e=null,targetTeamSeasonId:t=null}={}){return this.listRequests({scopeTeamSeasonId:e,targetTeamSeasonId:t,status:"PENDING"})}async listMarket({targetTeamSeasonId:e}){if(!this.supabase)throw new Error("No hay conexión disponible con la base de datos.");if(!e)throw new Error("No se pudo resolver el equipo-temporada de destino.");const{data:t,error:a}=await this.supabase.rpc("iq_v3_list_transfer_market",{p_target_team_season_id:e});if(a)throw a;return(t||[]).map(s=>({id:s.player_id,playerId:s.player_id,first_name:s.first_name||"",last_name:s.last_name||"",playerName:[s.first_name,s.last_name].filter(Boolean).join(" ")||"Jugador",jersey:s.jersey,primary_position:s.primary_position||"Jugador",team_id:s.source_team_id,team_name:s.source_team_name||"Equipo",from_team_season_id:s.from_team_season_id,global_season_id:s.global_season_id,source_stint_from:s.source_stint_from,pending_to_target:!!s.pending_to_target}))}async requestTransfer({playerId:e,fromTeamSeasonId:t,toTeamSeasonId:a,firstDateTo:s=null}){if(!this.supabase)throw new Error("No hay conexión disponible con la base de datos.");const r=await this.getCapabilities();if(r!=null&&r.dual_review){const d=ht(s);if(!d)throw new Error("La fecha prevista de alta en destino es obligatoria.");const{data:c,error:u}=await this.supabase.rpc("iq_v4_request_transfer",{p_player_id:e,p_from_team_season_id:t,p_to_team_season_id:a,p_requested_first_date_to:d});if(u)throw u;return c}const{data:i,error:n}=await this.supabase.rpc("iq_v3_request_transfer",{p_player_id:e,p_from_team_season_id:t,p_to_team_season_id:a});if(n)throw n;return i}async reviewTransferSide({requestId:e,side:t,decision:a,effectiveDate:s=null,reason:r=null}){if(!this.supabase)throw new Error("No hay conexión disponible con la base de datos.");const i=String(t||"").trim().toUpperCase(),n=String(a||"").trim().toUpperCase();if(!["SOURCE","DESTINATION"].includes(i))throw new Error("El lado de revisión del traspaso no es válido.");if(!["APPROVED","REJECTED"].includes(n))throw new Error("La decisión del traspaso no es válida.");const d=n==="APPROVED"?ht(s):null;if(n==="APPROVED"&&!d)throw new Error("La fecha efectiva es obligatoria para aprobar.");const{data:c,error:u}=await this.supabase.rpc("iq_v4_review_transfer_side",{p_request_id:e,p_side:i,p_decision:n,p_effective_date:d,p_reason:r||null});if(u)throw u;return c}async finalizeTransfer({requestId:e}){if(!this.supabase)throw new Error("No hay conexión disponible con la base de datos.");const{data:t,error:a}=await this.supabase.rpc("iq_v4_finalize_transfer_request",{p_request_id:e});if(a)throw a;return t}async approveTransfer({requestId:e,lastDateFrom:t,firstDateTo:a}){if(!this.supabase)throw new Error("No hay conexión disponible con la base de datos.");const s=ht(t),r=ht(a);if(!s||!r)throw new Error("Las fechas de salida y alta son obligatorias.");if(r<=s)throw new Error("La fecha de alta en destino debe ser posterior al último día en origen.");const{data:i,error:n}=await this.supabase.rpc("iq_v3_approve_transfer_request",{p_request_id:e,p_last_date_from:s,p_first_date_to:r});if(n)throw n;return i}async rejectTransfer({requestId:e,reason:t=null}){if(!this.supabase)throw new Error("No hay conexión disponible con la base de datos.");const{data:a,error:s}=await this.supabase.rpc("iq_v3_reject_transfer_request",{p_request_id:e,p_reason:t||null});if(s)throw s;return a}}function bt(o={}){return{teamId:o.team_id||o.teamId||null,seasonId:o.season_id||o.seasonId||null,teamSeasonId:o.id||o.team_season_id||o.teamSeasonId||null}}function $t(o=""){return String(o||"").trim().toUpperCase()}class ke{constructor(e,t=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.auth=t}static isFrozen(e={}){return $t(e.data_status||e.dataStatus||"ACTIVE")==="FROZEN"}isFrozen(e={}){return ke.isFrozen(e)}async getCapabilities(){if(!this.supabase)return{ready:!1,reason:"NO_DATABASE"};const{data:e,error:t}=await this.supabase.rpc("iq_v6_team_season_freeze_capabilities");return t?{ready:!1,reason:"BACKEND_NOT_APPLIED"}:{ready:!!((e==null?void 0:e.ready)??(e==null?void 0:e.team_season_freeze)),...e||{}}}_teamSeasonId(e={}){return e.id||e.team_season_id||e.teamSeasonId||null}_hasExactFreezeAuthority(e={}){var r,i,n;const t=(i=(r=this.auth)==null?void 0:r.getAuthenticatedRole)==null?void 0:i.call(r);if(t===R.SUPERADMIN)return!0;const a=this._teamSeasonId(e);return((a&&((n=this.auth)!=null&&n.getContextRoles)?this.auth.getContextRoles(a):[])||[]).map(d=>String(d).toUpperCase()).includes("ADMIN")?!0:t===R.ADMIN}canFreeze(e={}){var t,a;return!ke.isFrozen(e)&&this._hasExactFreezeAuthority(e)&&!!((a=(t=this.auth)==null?void 0:t.canPreview)!=null&&a.call(t,l.FREEZE_TEAM_SEASON,bt(e)))}canReopen(e={}){var t,a;return ke.isFrozen(e)&&this._hasExactFreezeAuthority(e)&&!!((a=(t=this.auth)==null?void 0:t.canPreview)!=null&&a.call(t,l.REOPEN_TEAM_SEASON,bt(e)))}canRequestFreeze(e={}){var t,a;return ke.isFrozen(e)||this.canFreeze(e)?!1:!!((a=(t=this.auth)==null?void 0:t.canPreview)!=null&&a.call(t,l.REQUEST_TEAM_SEASON_FREEZE,bt(e)))}canReviewRequests(e={}){var t,a;return this._hasExactFreezeAuthority(e)&&!!((a=(t=this.auth)==null?void 0:t.canPreview)!=null&&a.call(t,l.REVIEW_TEAM_SEASON_FREEZE_REQUESTS,bt(e)))}async listRequests(e=[],{status:t=null}={}){if(!this.supabase)return[];let a=this.supabase.from("team_season_freeze_requests").select("id,team_season_id,requested_by,requested_by_role,request_reason,status,created_at,resolved_at,resolved_by,resolution_note").order("created_at",{ascending:!1});const s=[...new Set((e||[]).map(String).filter(Boolean))];s.length>0&&(a=a.in("team_season_id",s));const r=t?$t(t):null;r&&(a=a.eq("status",r));const{data:i,error:n}=await a;if(n)throw n;return i||[]}async requestFreeze(e,t=null){if(!this.supabase)throw new Error("Base de datos no disponible.");const{data:a,error:s}=await this.supabase.rpc("iq_v6_request_team_season_freeze",{p_team_season_id:e,p_reason:t||null});if(s)throw s;return a}async setFrozen(e,t,a=null){if(!this.supabase)throw new Error("Base de datos no disponible.");const{data:s,error:r}=await this.supabase.rpc("iq_v6_set_team_season_data_state",{p_team_season_id:e,p_target_state:t?"FROZEN":"ACTIVE",p_reason:a||null});if(r)throw r;return s}async resolveRequest(e,t,a=null){if(!this.supabase)throw new Error("Base de datos no disponible.");const s=$t(t);if(!["APPROVED","REJECTED"].includes(s))throw new Error("Resolución de cierre de temporada no válida.");const{data:r,error:i}=await this.supabase.rpc("iq_v6_resolve_team_season_freeze_request",{p_request_id:e,p_decision:s,p_resolution_note:a||null});if(i)throw i;return r}}const ee=Object.freeze({TEAM_ACCESS:"TEAM_ACCESS",GAME_LOCK:"GAME_LOCK",TRANSFER:"TRANSFER",TEAM_SEASON_FREEZE:"TEAM_SEASON_FREEZE"});function Et(o=""){const e=String(o||"").trim().toUpperCase();return["PENDING","PENDIENTE"].includes(e)?"PENDING":["APPROVED","APROBADO","APROBADA"].includes(e)?"APPROVED":["REJECTED","RECHAZADO","RECHAZADA"].includes(e)?"REJECTED":["CANCELLED","CANCELED","CANCELADO","CANCELADA"].includes(e)?"CANCELLED":e||"UNKNOWN"}function rs(o){const e=o?new Date(o).getTime():0;return Number.isFinite(e)?e:0}class wr{constructor(e,t,a=b){this.supabase=e||null,this.auth=t||null,this.dataStore=a,this.teamAccessService=new vs(this.supabase),this.gameLockService=new Rr(this.supabase,this.auth),this.transferRequestService=new ys(this.supabase),this.seasonFreezeService=new ke(this.supabase,this.auth)}_activeGames(){var t,a,s,r,i,n;const e=((a=(t=this.dataStore).getActiveTeamId)==null?void 0:a.call(t))||null;return((r=(s=this.dataStore).getGamesForActiveSeason)==null?void 0:r.call(s,e))||((n=(i=this.dataStore).getGames)==null?void 0:n.call(i,e))||[]}_normalizeTeamAccessRequest(e={}){var r,i;const t=e.teamId||e.team_id||null,a=Et(e.status),s=a==="PENDING"&&!!((i=(r=this.auth)==null?void 0:r.canPreview)!=null&&i.call(r,l.APPROVE_TEAM_ACCESS,{teamId:t}));return{id:e.id,type:ee.TEAM_ACCESS,status:a,createdAt:e.created_at||e.requested_at||null,resolvedAt:e.reviewed_at||e.resolved_at||null,title:e.userName||e.userEmail||"",subtitle:"",detail:e.notes||"",teamName:e.teamName||"",requestedRole:e.requestedRole||e.requested_role||"VISOR",teamId:t,teamSeasonId:e.team_season_id||e.teamSeasonId||null,actor:e.userEmail||e.userName||"",canApprove:s,canReject:s,raw:e}}_normalizeGameLockRequest(e={},t=new Map){var u,_;const a=t.get(String(e.game_id||e.gameId||""))||{},s=Et(e.status),r=a.team_id||a.teamId||((_=(u=this.dataStore).getActiveTeamId)==null?void 0:_.call(u))||null,i=a.team_season_id||a.teamSeasonId||null,n=s==="PENDING"&&this.gameLockService.canReviewRequests(a),d=a.opponent||a.opponentName||"",c=a.date||"";return{id:e.id,type:ee.GAME_LOCK,status:s,createdAt:e.created_at||null,resolvedAt:e.resolved_at||null,title:d,subtitle:"",detail:e.request_reason||e.resolution_note||"",opponent:d,gameDate:c,requestedRole:e.requested_by_role||"",teamId:r,teamSeasonId:i,gameId:e.game_id||e.gameId||null,actor:e.requested_by_role||"",canApprove:n,canReject:n,raw:e}}_normalizeTransferRequest(e={}){var _,p,m,f,g,E,T,x,S,M;const t=Et(e.status),a={teamId:e.originTeamId||null,teamSeasonId:e.fromTeamSeasonId||null},s={teamId:e.targetTeamId||null,teamSeasonId:e.toTeamSeasonId||null},r=(((p=(_=this.dataStore).getTeams)==null?void 0:p.call(_))||[]).find(v=>String(v.id)===String(e.originTeamId||"")),i=(((f=(m=this.dataStore).getTeams)==null?void 0:f.call(m))||[]).find(v=>String(v.id)===String(e.targetTeamId||"")),n=t==="PENDING"&&!!e.dualWorkflow,d=n&&e.sourceDecision==="PENDING"&&!!((E=(g=this.auth)==null?void 0:g.canPreview)!=null&&E.call(g,l.REVIEW_TRANSFER_SOURCE,a)),c=n&&e.destinationDecision==="PENDING"&&!!((x=(T=this.auth)==null?void 0:T.canPreview)!=null&&x.call(T,l.REVIEW_TRANSFER_DESTINATION,s)),u=n&&!!e.readyForFinalization&&!!((M=(S=this.auth)==null?void 0:S.canPreview)!=null&&M.call(S,l.FINALIZE_TRANSFER));return{id:e.id,type:ee.TRANSFER,status:t,createdAt:e.requestedAt||null,resolvedAt:e.reviewedAt||null,title:e.playerName||"Jugador",subtitle:"",detail:e.rejectionReason||"",playerId:e.playerId||null,playerName:e.playerName||"Jugador",originTeamId:e.originTeamId||null,targetTeamId:e.targetTeamId||null,fromTeamSeasonId:e.fromTeamSeasonId||null,toTeamSeasonId:e.toTeamSeasonId||null,originTeamName:(r==null?void 0:r.name)||"Equipo origen",targetTeamName:(i==null?void 0:i.name)||"Equipo destino",workflowVersion:e.workflowVersion||null,dualWorkflow:!!e.dualWorkflow,requestedFirstDateTo:e.requestedFirstDateTo||null,sourceDecision:e.sourceDecision||null,sourceDate:e.sourceDate||null,sourceReason:e.sourceReason||null,destinationDecision:e.destinationDecision||null,destinationDate:e.destinationDate||e.requestedFirstDateTo||null,destinationReason:e.destinationReason||null,readyForFinalization:!!e.readyForFinalization,canSourceReview:d,canDestinationReview:c,canFinalize:u,canApprove:!1,canReject:!1,raw:e}}_normalizeSeasonFreezeRequest(e={},t={}){var c,u,_,p,m,f;const a=Et(e.status),s=e.team_season_id||e.teamSeasonId||(t==null?void 0:t.team_season_id)||(t==null?void 0:t.teamSeasonId)||null,r=(t==null?void 0:t.team_id)||(t==null?void 0:t.teamId)||((u=(c=this.dataStore).getActiveTeamId)==null?void 0:u.call(c))||null,i=(t==null?void 0:t.global_season_id)||(t==null?void 0:t.globalSeasonId)||(t==null?void 0:t.season_id)||(t==null?void 0:t.seasonId)||null,n=((p=(_=this.dataStore).getTeamById)==null?void 0:p.call(_,r))||(((f=(m=this.dataStore).getTeams)==null?void 0:f.call(m))||[]).find(g=>String(g.id)===String(r||""))||{},d=a==="PENDING"&&this.seasonFreezeService.canReviewRequests({...t,id:s,team_id:r,season_id:i});return{id:e.id,type:ee.TEAM_SEASON_FREEZE,status:a,createdAt:e.created_at||null,resolvedAt:e.resolved_at||null,title:n.name||"Equipo",subtitle:(t==null?void 0:t.name)||(t==null?void 0:t.code)||"",detail:e.request_reason||e.resolution_note||"",teamId:r,seasonId:i,teamSeasonId:s,teamName:n.name||"Equipo",seasonName:(t==null?void 0:t.name)||(t==null?void 0:t.code)||"Temporada",requestedRole:e.requested_by_role||"",actor:e.requested_by_role||"",canApprove:d,canReject:d,raw:e}}async load(){var m,f,g,E,T,x,S,M,v,A;const e=this._activeGames(),t=new Map(e.map(C=>[String(C.id),C])),a=e.map(C=>C.id).filter(Boolean),s=((f=(m=this.dataStore).getActiveTeamId)==null?void 0:f.call(m))||null,r=((E=(g=this.dataStore).getActiveSeasonContext)==null?void 0:E.call(g,s))||null,i=((x=(T=this.dataStore).getActiveTeamSeasonId)==null?void 0:x.call(T,s))||(r==null?void 0:r.team_season_id)||(r==null?void 0:r.teamSeasonId)||null,[n,d,c,u]=await Promise.allSettled([this.teamAccessService.listRequests(),a.length>0?this.gameLockService.listRequests(a):Promise.resolve([]),i?this.transferRequestService.listRequests({scopeTeamSeasonId:i}):Promise.resolve([]),i?this.seasonFreezeService.listRequests([i]):Promise.resolve([])]),_=[],p=[];return n.status==="fulfilled"?p.push(...(n.value||[]).map(C=>this._normalizeTeamAccessRequest(C))):_.push({source:ee.TEAM_ACCESS,message:((S=n.reason)==null?void 0:S.message)||String(n.reason||"Error cargando accesos")}),d.status==="fulfilled"?p.push(...(d.value||[]).map(C=>this._normalizeGameLockRequest(C,t))):_.push({source:ee.GAME_LOCK,message:((M=d.reason)==null?void 0:M.message)||String(d.reason||"Error cargando cierres")}),c.status==="fulfilled"?p.push(...(c.value||[]).map(C=>this._normalizeTransferRequest(C))):_.push({source:ee.TRANSFER,message:((v=c.reason)==null?void 0:v.message)||String(c.reason||"Error cargando traspasos")}),u.status==="fulfilled"?p.push(...(u.value||[]).map(C=>this._normalizeSeasonFreezeRequest(C,r||{}))):_.push({source:ee.TEAM_SEASON_FREEZE,message:((A=u.reason)==null?void 0:A.message)||String(u.reason||"Error cargando cierres de temporada")}),p.sort((C,O)=>rs(O.createdAt)-rs(C.createdAt)),{items:p,errors:_,pendingCount:p.filter(C=>C.status==="PENDING").length,resolvedCount:p.filter(C=>C.status!=="PENDING").length}}async approve(e,t=null){if(!(e!=null&&e.id)||!(e!=null&&e.canApprove))throw new Error("No tienes permiso para aprobar esta solicitud.");if(e.type===ee.TEAM_ACCESS)return this.teamAccessService.reviewRequest(e.id,!0);if(e.type===ee.GAME_LOCK)return this.gameLockService.resolveRequest(e.id,"APPROVED",t||"Aprobado desde Bandeja de Solicitudes");if(e.type===ee.TEAM_SEASON_FREEZE)return this.seasonFreezeService.resolveRequest(e.id,"APPROVED",t||"Cierre de temporada aprobado desde Bandeja de Solicitudes");throw new Error("Tipo de solicitud no soportado.")}async reviewTransfer(e,t,a,s=null,r=null){if(!(e!=null&&e.id)||e.type!==ee.TRANSFER)throw new Error("Solicitud de traspaso no válida.");const i=String(t||"").toUpperCase();if(!(i==="SOURCE"?e.canSourceReview:e.canDestinationReview))throw new Error("No tienes permiso para revisar este lado del traspaso.");return this.transferRequestService.reviewTransferSide({requestId:e.id,side:i,decision:a,effectiveDate:s,reason:r})}async finalizeTransfer(e){if(!(e!=null&&e.id)||e.type!==ee.TRANSFER||!e.canFinalize)throw new Error("El traspaso no está listo o no tienes permiso para finalizarlo.");return this.transferRequestService.finalizeTransfer({requestId:e.id})}async reject(e,t=null){if(!(e!=null&&e.id)||!(e!=null&&e.canReject))throw new Error("No tienes permiso para rechazar esta solicitud.");if(e.type===ee.TEAM_ACCESS)return this.teamAccessService.reviewRequest(e.id,!1);if(e.type===ee.GAME_LOCK)return this.gameLockService.resolveRequest(e.id,"REJECTED",t||null);if(e.type===ee.TEAM_SEASON_FREEZE)return this.seasonFreezeService.resolveRequest(e.id,"REJECTED",t||null);throw new Error("Tipo de solicitud no soportado.")}}class xr{constructor(e,t){this.supabase=e||null,this.auth=t||null,this.service=new wr(this.supabase,this.auth,b),this.state={items:[],errors:[],pendingCount:0,resolvedCount:0},this.filter="PENDING",this.container=null,this.isLoading=!1}t(e,t="",a={}){var r;let s=((r=j==null?void 0:j.t)==null?void 0:r.call(j,e,t))||t||e;return Object.entries(a||{}).forEach(([i,n])=>{s=String(s).replaceAll(`{${i}}`,String(n??""))}),s}_escape(e=""){return String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}_statusMeta(e=""){const t=String(e||"").toUpperCase();return t==="PENDING"?{label:this.t("approvals.status_pending","Pendiente"),icon:"⏳",bg:"#fef3c7",fg:"#92400e",border:"#fde68a"}:t==="APPROVED"?{label:this.t("approvals.status_approved","Aprobada"),icon:"✓",bg:"#dcfce7",fg:"#166534",border:"#86efac"}:t==="REJECTED"?{label:this.t("approvals.status_rejected","Rechazada"),icon:"×",bg:"#fee2e2",fg:"#991b1b",border:"#fca5a5"}:t==="CANCELLED"?{label:this.t("approvals.status_cancelled","Cancelada"),icon:"—",bg:"#f1f5f9",fg:"#475569",border:"#cbd5e1"}:{label:t||"Estado",icon:"•",bg:"#f1f5f9",fg:"#475569",border:"#cbd5e1"}}_typeMeta(e){return e===ee.GAME_LOCK?{label:this.t("approvals.type_game_lock","Cierre de partido"),icon:"🔒",bg:"#fff7ed",fg:"#9a3412"}:e===ee.TRANSFER?{label:this.t("approvals.type_transfer","Traspaso"),icon:"🔄",bg:"#f5f3ff",fg:"#6d28d9"}:e===ee.TEAM_SEASON_FREEZE?{label:this.t("approvals.type_season_freeze","Cierre de temporada"),icon:"🗄️",bg:"#fff1f2",fg:"#9f1239"}:{label:this.t("approvals.type_team_access","Acceso a equipo"),icon:"👥",bg:"#eff6ff",fg:"#1d4ed8"}}_itemTitle(e){return e.type===ee.TRANSFER?this.t("approvals.transfer_title","Traspaso · {player}",{player:e.playerName||e.title||"Jugador"}):e.type===ee.GAME_LOCK?this.t("approvals.game_title","Cerrar partido vs {opponent}",{opponent:e.opponent||e.title||"Rival"}):e.type===ee.TEAM_SEASON_FREEZE?this.t("approvals.season_freeze_title","Cerrar temporada · {team}",{team:e.teamName||e.title||"Equipo"}):e.title||e.actor||this.t("approvals.type_team_access","Acceso a equipo")}_itemSubtitle(e){return e.type===ee.TRANSFER?this.t("approvals.transfer_route","{origin} → {destination}",{origin:e.originTeamName||"Equipo origen",destination:e.targetTeamName||"Equipo destino"}):e.type===ee.GAME_LOCK?[e.gameDate||"",e.requestedRole||""].filter(Boolean).join(" · "):e.type===ee.TEAM_SEASON_FREEZE?[e.seasonName||"",e.requestedRole||""].filter(Boolean).join(" · "):this.t("approvals.access_subtitle","Acceso a {team} como {role}",{team:e.teamName||"equipo",role:e.requestedRole||"VISOR"})}_shiftIsoDate(e,t=0){if(!e||!/^\d{4}-\d{2}-\d{2}$/.test(String(e)))return"";const[a,s,r]=String(e).split("-").map(Number),i=new Date(Date.UTC(a,s-1,r));return i.setUTCDate(i.getUTCDate()+Number(t||0)),i.toISOString().slice(0,10)}_transferReviewMeta(e="PENDING"){const t=String(e||"PENDING").toUpperCase();return t==="APPROVED"?{icon:"✓",label:this.t("approvals.transfer_approved","Aprobado"),bg:"#dcfce7",fg:"#166534"}:t==="REJECTED"?{icon:"×",label:this.t("approvals.transfer_rejected","Rechazado"),bg:"#fee2e2",fg:"#991b1b"}:{icon:"⏳",label:this.t("approvals.transfer_pending","Pendiente"),bg:"#fef3c7",fg:"#92400e"}}_formatDate(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?String(e):new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(t)}_visibleItems(){return this.filter==="ALL"?this.state.items||[]:this.filter==="RESOLVED"?(this.state.items||[]).filter(e=>e.status!=="PENDING"):(this.state.items||[]).filter(e=>e.status==="PENDING")}async render(e="dashboard-content-area"){var a,s;const t=typeof e=="string"?document.getElementById(e):e;if(t){if(this.container=t,!((s=(a=this.auth)==null?void 0:a.canPreview)!=null&&s.call(a,l.VIEW_APPROVAL_CENTER))){t.innerHTML=`
        <div style="padding:24px;background:#ffffff;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">
          <h2 style="margin:0 0 8px;font-size:18px;">🔒 ${this.t("approvals.restricted","Acceso restringido")}</h2>
          <p style="margin:0;">${this.t("approvals.restricted_body","Tu perfil no puede consultar la Bandeja de Solicitudes.")}</p>
        </div>
      `;return}await this._loadAndRender()}}async _loadAndRender(){if(!(!this.container||this.isLoading)){this.isLoading=!0,this.container.innerHTML=`
      <div style="max-width:1180px;margin:0 auto;padding:4px 0 80px;">
        <div style="padding:28px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;text-align:center;color:#475569;">
          <div style="font-size:28px;margin-bottom:8px;">⏳</div>
          <strong>${this.t("approvals.loading","Cargando solicitudes...")}</strong>
        </div>
      </div>
    `;try{this.state=await this.service.load()}catch(e){console.error("[ApprovalCenterView] Error cargando bandeja:",e),this.state={items:[],errors:[{source:"CENTER",message:(e==null?void 0:e.message)||String(e)}],pendingCount:0,resolvedCount:0}}finally{this.isLoading=!1}this._renderState()}}_renderState(){if(!this.container)return;const e=this._visibleItems(),t=(this.state.items||[]).length,a=Number(this.state.pendingCount||0),s=Number(this.state.resolvedCount||0),r=(this.state.errors||[]).length>0?`
        <div style="margin-bottom:14px;padding:12px 14px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:12px;">
          ⚠️ ${this.t("approvals.partial","La bandeja se ha cargado parcialmente.")} ${this._escape((this.state.errors||[]).map(n=>n.message).join(" · "))}
        </div>
      `:"",i=e.length>0?e.map(n=>this._renderItem(n)).join(""):this._renderEmptyState();this.container.innerHTML=`
      <section style="max-width:1180px;margin:0 auto;padding:4px 0 90px;font-family:system-ui,-apple-system,sans-serif;">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <h1 style="margin:0;color:#0f172a;font-size:24px;font-weight:900;">📥 ${this.t("approvals.title","Bandeja de Solicitudes")}</h1>
              ${a>0?`<span style="padding:4px 9px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:900;">${a} ${this.t("approvals.pending","Pendientes").toLowerCase()}</span>`:""}
            </div>
            <p style="margin:6px 0 0;color:#64748b;font-size:13px;line-height:1.45;max-width:720px;">
${this.t("approvals.subtitle","Centraliza accesos, cierres y traspasos, mostrando sólo las acciones permitidas por tu rol y contexto.")}
            </p>
          </div>
          <button type="button" id="btn-refresh-approval-center"
                  style="min-height:44px;padding:9px 14px;border-radius:9px;border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;font-weight:800;cursor:pointer;">
            ↻ ${this.t("approvals.refresh","Actualizar")}
          </button>
        </header>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:13px;">
            <div style="font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;">${this.t("approvals.total","Total")}</div>
            <div style="font-size:24px;color:#0f172a;font-weight:900;margin-top:3px;">${t}</div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:13px;">
            <div style="font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;">${this.t("approvals.pending","Pendientes")}</div>
            <div style="font-size:24px;color:#78350f;font-weight:900;margin-top:3px;">${a}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:13px;">
            <div style="font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;">${this.t("approvals.resolved","Resueltas")}</div>
            <div style="font-size:24px;color:#334155;font-weight:900;margin-top:3px;">${s}</div>
          </div>
        </div>

        ${r}

        <div role="tablist" aria-label="Filtrar solicitudes" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
          ${this._renderFilterButton("PENDING",`${this.t("approvals.pending","Pendientes")} (${a})`)}
          ${this._renderFilterButton("RESOLVED",`${this.t("approvals.history","Historial")} (${s})`)}
          ${this._renderFilterButton("ALL",`${this.t("approvals.all","Todas")} (${t})`)}
        </div>

        <div id="approval-center-list" style="display:grid;gap:10px;">
          ${i}
        </div>
      </section>
    `,this._bindEvents()}_renderFilterButton(e,t){const a=this.filter===e;return`
      <button type="button" class="approval-filter" data-filter="${e}"
              role="tab" aria-selected="${a}"
              style="min-height:44px;padding:8px 14px;border-radius:999px;border:1px solid ${a?"#1e3a8a":"#cbd5e1"};background:${a?"#1e3a8a":"#ffffff"};color:${a?"#ffffff":"#334155"};font-weight:800;cursor:pointer;">
        ${t}
      </button>
    `}_renderTransferSide(e,t){const a=t==="SOURCE",s=a?e.sourceDecision:e.destinationDecision,r=a?e.sourceDate:e.destinationDate,i=a?e.canSourceReview:e.canDestinationReview,n=this._transferReviewMeta(s),d=a?this.t("approvals.transfer_source","Origen"):this.t("approvals.transfer_destination","Destino"),c=a?this.t("approvals.transfer_last_day_source","Último día en origen"):this.t("approvals.transfer_first_day_destination","Primer día en destino"),u=r||(a?this._shiftIsoDate(e.destinationDate||e.requestedFirstDateTo,-1):e.requestedFirstDateTo)||"";return`
      <div style="padding:12px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong style="font-size:12px;color:#0f172a;">${d}</strong>
          <span style="padding:3px 8px;border-radius:999px;background:${n.bg};color:${n.fg};font-size:10px;font-weight:900;">${n.icon} ${n.label}</span>
        </div>
        ${r?`<div style="margin-top:7px;font-size:11px;color:#475569;">${c}: <strong>${this._escape(r)}</strong></div>`:""}
        ${i?`
          <div style="margin-top:10px;display:grid;gap:8px;">
            <label style="display:grid;gap:4px;font-size:11px;color:#475569;font-weight:700;">
              ${c}
              <input type="date"
                     class="transfer-review-date"
                     data-side="${t}"
                     value="${this._escape(u)}"
                     style="width:100%;min-height:44px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;color:#0f172a;font:inherit;">
            </label>
            <label style="display:grid;gap:4px;font-size:11px;color:#475569;font-weight:700;">
              ${this.t("approvals.transfer_reason_optional","Motivo / nota (opcional)")}
              <input type="text"
                     class="transfer-review-reason"
                     data-side="${t}"
                     maxlength="240"
                     placeholder="${this._escape(this.t("approvals.transfer_reason_placeholder","Añade contexto si es necesario"))}"
                     style="width:100%;min-height:44px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;color:#0f172a;font:inherit;">
            </label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button"
                      class="btn-transfer-review"
                      data-request-id="${this._escape(e.id)}"
                      data-side="${t}"
                      data-decision="APPROVED"
                      style="min-height:44px;flex:1 1 130px;padding:8px 12px;border:0;border-radius:8px;background:#166534;color:#ffffff;font-size:12px;font-weight:900;cursor:pointer;">
                ✓ ${this.t("approvals.transfer_approve_side","Aprobar")}
              </button>
              <button type="button"
                      class="btn-transfer-review"
                      data-request-id="${this._escape(e.id)}"
                      data-side="${t}"
                      data-decision="REJECTED"
                      style="min-height:44px;flex:1 1 130px;padding:8px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fff1f2;color:#be123c;font-size:12px;font-weight:900;cursor:pointer;">
                ${this.t("approvals.reject","Rechazar")}
              </button>
            </div>
          </div>
        `:""}
      </div>
    `}_renderTransferItem(e,t,a,s,r){const i=e.readyForFinalization&&e.status==="PENDING";return`
      <article class="approval-card transfer-approval-card" data-request-id="${this._escape(e.id)}"
               style="background:#ffffff;border:1px solid #ddd6fe;border-radius:14px;padding:15px;box-shadow:0 1px 3px rgba(15,23,42,.04);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="min-width:0;flex:1 1 300px;">
            <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:7px;">
              <span style="padding:3px 8px;border-radius:999px;background:${a.bg};color:${a.fg};font-size:11px;font-weight:900;">${a.icon} ${a.label}</span>
              <span style="padding:3px 8px;border-radius:999px;background:${t.bg};color:${t.fg};border:1px solid ${t.border};font-size:11px;font-weight:900;">${t.icon} ${t.label}</span>
              ${i?`<span style="padding:3px 8px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:10px;font-weight:900;">${this.t("approvals.transfer_ready","Lista para finalizar")}</span>`:""}
            </div>
            <h2 style="margin:0;color:#0f172a;font-size:15px;font-weight:900;overflow-wrap:anywhere;">${this._escape(this._itemTitle(e))}</h2>
            <div style="margin-top:4px;color:#475569;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${this._escape(this._itemSubtitle(e))}</div>
            ${e.requestedFirstDateTo?`<div style="margin-top:7px;color:#64748b;font-size:11px;">${this.t("approvals.transfer_requested_start","Alta solicitada")}: <strong>${this._escape(e.requestedFirstDateTo)}</strong></div>`:""}
            ${r?`<div style="margin-top:7px;padding:8px 10px;border-radius:8px;background:#fff1f2;color:#9f1239;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${r}</div>`:""}
            ${s?`<div style="margin-top:7px;color:#94a3b8;font-size:11px;">${s}</div>`:""}
          </div>
          <a href="#/settings" style="min-height:44px;display:inline-flex;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;text-decoration:none;font-size:12px;font-weight:800;">${this.t("approvals.view_context","Ver contexto")}</a>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:12px;">
          ${this._renderTransferSide(e,"SOURCE")}
          ${this._renderTransferSide(e,"DESTINATION")}
        </div>

        ${e.canFinalize?`
          <div style="margin-top:12px;padding:12px;border-radius:11px;background:#f5f3ff;border:1px solid #c4b5fd;">
            <div style="font-size:11px;color:#5b21b6;line-height:1.45;margin-bottom:8px;">
              ${this.t("approvals.transfer_finalize_help","Origen y destino están aprobados. La finalización aplicará el cambio temporal de plantilla con las fechas acordadas.")}
            </div>
            <button type="button"
                    class="btn-transfer-finalize"
                    data-request-id="${this._escape(e.id)}"
                    style="width:100%;min-height:46px;padding:9px 14px;border:0;border-radius:9px;background:#6d28d9;color:#ffffff;font-size:12px;font-weight:900;cursor:pointer;">
              ⚡ ${this.t("approvals.transfer_finalize","Finalizar traspaso")}
            </button>
          </div>
        `:""}
      </article>
    `}_renderItem(e){const t=this._statusMeta(e.status),a=this._typeMeta(e.type),s=this._formatDate(e.createdAt),r=e.detail?this._escape(e.detail):"",i=e.status==="PENDING"&&(e.canApprove||e.canReject),n=e.type===ee.GAME_LOCK?"#/games":"#/settings";return e.type===ee.TRANSFER?this._renderTransferItem(e,t,a,s,r):`
      <article class="approval-card" data-request-id="${this._escape(e.id)}"
               style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:15px;box-shadow:0 1px 3px rgba(15,23,42,.04);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="min-width:0;flex:1 1 280px;">
            <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:7px;">
              <span style="padding:3px 8px;border-radius:999px;background:${a.bg};color:${a.fg};font-size:11px;font-weight:900;">${a.icon} ${a.label}</span>
              <span style="padding:3px 8px;border-radius:999px;background:${t.bg};color:${t.fg};border:1px solid ${t.border};font-size:11px;font-weight:900;">${t.icon} ${t.label}</span>
            </div>
            <h2 style="margin:0;color:#0f172a;font-size:15px;font-weight:900;overflow-wrap:anywhere;">${this._escape(this._itemTitle(e))}</h2>
            <div style="margin-top:4px;color:#475569;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${this._escape(this._itemSubtitle(e))}</div>
            ${r?`<div style="margin-top:7px;padding:8px 10px;border-radius:8px;background:#f8fafc;color:#334155;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${r}</div>`:""}
            ${s?`<div style="margin-top:7px;color:#94a3b8;font-size:11px;">${s}</div>`:""}
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
            <a href="${n}" style="min-height:44px;display:inline-flex;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;text-decoration:none;font-size:12px;font-weight:800;">${this.t("approvals.view_context","Ver contexto")}</a>
            ${i&&e.canApprove?`<button type="button" class="btn-approval-approve" data-request-id="${this._escape(e.id)}" style="min-height:44px;padding:8px 12px;border:0;border-radius:8px;background:#166534;color:#ffffff;font-size:12px;font-weight:900;cursor:pointer;">✓ ${this.t("approvals.approve","Aprobar")}</button>`:""}
            ${i&&e.canReject?`<button type="button" class="btn-approval-reject" data-request-id="${this._escape(e.id)}" style="min-height:44px;padding:8px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fff1f2;color:#be123c;font-size:12px;font-weight:900;cursor:pointer;">${this.t("approvals.reject","Rechazar")}</button>`:""}
          </div>
        </div>
        ${i&&[ee.GAME_LOCK,ee.TEAM_SEASON_FREEZE].includes(e.type)?`
          <label style="display:grid;gap:4px;margin-top:12px;font-size:11px;font-weight:800;color:#475569;">
            ${this.t("approvals.resolution_note","Nota de resolución (opcional)")}
            <input type="text"
                   class="approval-resolution-note"
                   data-request-id="${this._escape(e.id)}"
                   maxlength="240"
                   placeholder="${this._escape(this.t("approvals.resolution_note_placeholder","Añade contexto para la auditoría"))}"
                   style="width:100%;min-height:44px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;color:#0f172a;font:inherit;">
          </label>
        `:""}
      </article>
    `}_renderEmptyState(){const e=this.filter==="PENDING";return`
      <div style="padding:34px 20px;text-align:center;background:#ffffff;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;">
        <div style="font-size:28px;margin-bottom:8px;">${e?"✅":"📭"}</div>
        <strong style="display:block;color:#334155;margin-bottom:4px;">${e?this.t("approvals.empty_pending","No tienes solicitudes pendientes"):this.t("approvals.empty_filter","No hay solicitudes en este filtro")}</strong>
        <span style="font-size:12px;">${this.t("approvals.empty_help","La bandeja se actualizará al entrar de nuevo o al pulsar Actualizar.")}</span>
      </div>
    `}_findItem(e){return(this.state.items||[]).find(t=>String(t.id)===String(e))||null}_bindEvents(){var e,t,a,s,r,i,n;(t=(e=this.container)==null?void 0:e.querySelector("#btn-refresh-approval-center"))==null||t.addEventListener("click",()=>{this._loadAndRender()}),(a=this.container)==null||a.querySelectorAll(".approval-filter").forEach(d=>{d.addEventListener("click",()=>{this.filter=d.dataset.filter||"PENDING",this._renderState()})}),(s=this.container)==null||s.querySelectorAll(".btn-transfer-review").forEach(d=>{d.addEventListener("click",async c=>{const u=c.currentTarget.dataset.requestId,_=String(c.currentTarget.dataset.side||"").toUpperCase(),p=String(c.currentTarget.dataset.decision||"").toUpperCase(),m=this._findItem(u);if(!m||m.type!==ee.TRANSFER)return;const f=c.currentTarget.closest(".transfer-approval-card"),g=f==null?void 0:f.querySelector(`.transfer-review-date[data-side="${_}"]`),E=f==null?void 0:f.querySelector(`.transfer-review-reason[data-side="${_}"]`),T=p==="APPROVED"?String((g==null?void 0:g.value)||""):null,x=String((E==null?void 0:E.value)||"").trim()||null;if(p==="APPROVED"&&!/^\d{4}-\d{2}-\d{2}$/.test(T||"")){alert(this.t("approvals.transfer_date_required","Selecciona una fecha válida antes de aprobar.")),g==null||g.focus();return}await this._runAction(c.currentTarget,()=>this.service.reviewTransfer(m,_,p,T,x))})}),(r=this.container)==null||r.querySelectorAll(".btn-transfer-finalize").forEach(d=>{d.addEventListener("click",async c=>{const u=this._findItem(c.currentTarget.dataset.requestId);!u||u.type!==ee.TRANSFER||confirm(this.t("approvals.transfer_finalize_confirm","¿Finalizar el traspaso con las fechas aprobadas por origen y destino? Esta acción actualizará la elegibilidad histórica del jugador."))&&await this._runAction(c.currentTarget,async()=>{var _;await this.service.finalizeTransfer(u),b.isLoaded=!1,await b.init(((_=b.getActiveTeamId)==null?void 0:_.call(b))||null,!0)})})}),(i=this.container)==null||i.querySelectorAll(".btn-approval-approve").forEach(d=>{d.addEventListener("click",async c=>{var m,f;const u=this._findItem(c.currentTarget.dataset.requestId);if(!u)return;const _=u.type===ee.GAME_LOCK?this.t("approvals.approve_lock_confirm","¿Aprobar y cerrar este partido? Quedará bloqueado hasta que un Admin/Superadmin lo reabra."):u.type===ee.TEAM_SEASON_FREEZE?this.t("approvals.approve_season_freeze_confirm","¿Aprobar el cierre de esta temporada? Sus partidos abiertos y la plantilla quedarán congelados en modo histórico."):this.t("approvals.approve_access_confirm","¿Aprobar esta solicitud de acceso?");if(!confirm(_))return;const p=String(((f=(m=this.container)==null?void 0:m.querySelector(`.approval-resolution-note[data-request-id="${u.id}"]`))==null?void 0:f.value)||"").trim()||null;await this._runAction(c.currentTarget,async()=>{var g;await this.service.approve(u,p),[ee.GAME_LOCK,ee.TEAM_SEASON_FREEZE].includes(u.type)&&(b.isLoaded=!1,await b.init(((g=b.getActiveTeamId)==null?void 0:g.call(b))||null,!0))})})}),(n=this.container)==null||n.querySelectorAll(".btn-approval-reject").forEach(d=>{d.addEventListener("click",async c=>{var p,m;const u=this._findItem(c.currentTarget.dataset.requestId);if(!u)return;const _=String(((m=(p=this.container)==null?void 0:p.querySelector(`.approval-resolution-note[data-request-id="${u.id}"]`))==null?void 0:m.value)||"").trim()||null;await this._runAction(c.currentTarget,()=>this.service.reject(u,_))})})}async _runAction(e,t){try{e.disabled=!0,e.style.opacity="0.65",await t(),await this._loadAndRender()}catch(a){console.error("[ApprovalCenterView] Error resolviendo solicitud:",a),alert(`❌ ${this.t("approvals.action_error","No se pudo completar la acción.")} ${(a==null?void 0:a.message)||a}`),e.disabled=!1,e.style.opacity="1"}}}class Ne{static calculatePoints(e=0,t=0,a=0){const s=Number(e)||0,r=Number(t)||0,i=Number(a)||0;return s*2+r*3+i}static calculateFGM(e=0,t=0){return(Number(e)||0)+(Number(t)||0)}static calculateFGA(e=0,t=0){return(Number(e)||0)+(Number(t)||0)}static calculatePercentage(e=0,t=0,a=1){const s=Number(t)||0,r=Number(e)||0;if(s<=0)return 0;const i=r/s*100;return Number(i.toFixed(a))}static calculateTotalRebounds(e=0,t=0){return(Number(e)||0)+(Number(t)||0)}static calculatePIR(e={}){const t=Number(e.fg2Made??e.fg2_made??e.points_2_made??0),a=Number(e.fg2Attempted??e.fg2_attempted??e.points_2_attempted??0),s=Number(e.fg3Made??e.fg3_made??e.points_3_made??0),r=Number(e.fg3Attempted??e.fg3_attempted??e.points_3_attempted??0),i=Number(e.ftMade??e.ft_made??e.free_throws_made??0),n=Number(e.ftAttempted??e.ft_attempted??e.free_throws_attempted??0),d=t+s,c=a+r,u=Math.max(0,c-d),_=Math.max(0,n-i),p=Number(e.points??e.pts??this.calculatePoints(t,s,i)),m=Number(e.offReb??e.off_reb??e.rebounds_offensive??0),f=Number(e.defReb??e.def_reb??e.rebounds_defensive??0),g=Number(e.totalRebounds??e.rebounds??e.trb??m+f),E=Number(e.assists??e.ast??0),T=Number(e.steals??e.stl??0),x=Number(e.blocksMade??e.blocks_made??e.blk??e.blocks??0),S=Number(e.foulsDrawn??e.fouls_drawn??e.fouls_received??e.fd??0),M=Number(e.turnovers??e.tov??0),v=Number(e.blocksReceived??e.blocks_received??e.blkr??e.ba??0),A=Number(e.foulsCommitted??e.fouls_committed??e.fouls??e.pf??0),C=p+g+E+T+x+S,O=u+_+M+v+A;return C-O}static calculateEFF(e={}){const t=Number(e.fg2Made??e.fg2_made??e.points_2_made??0),a=Number(e.fg2Attempted??e.fg2_attempted??e.points_2_attempted??0),s=Number(e.fg3Made??e.fg3_made??e.points_3_made??0),r=Number(e.fg3Attempted??e.fg3_attempted??e.points_3_attempted??0),i=Number(e.ftMade??e.ft_made??e.free_throws_made??0),n=Number(e.ftAttempted??e.ft_attempted??e.free_throws_attempted??0),d=t+s,c=a+r,u=Math.max(0,c-d),_=Math.max(0,n-i),p=Number(e.points??e.pts??this.calculatePoints(t,s,i)),m=Number(e.offReb??e.off_reb??e.rebounds_offensive??0),f=Number(e.defReb??e.def_reb??e.rebounds_defensive??0),g=Number(e.totalRebounds??e.rebounds??e.trb??m+f),E=Number(e.assists??e.ast??0),T=Number(e.steals??e.stl??0),x=Number(e.blocksMade??e.blocks_made??e.blk??e.blocks??0),S=Number(e.turnovers??e.tov??0),M=p+g+E+T+x,v=u+_+S;return M-v}static calculateGameScore(e={}){const t=Number(e.fg2Made??e.fg2_made??e.points_2_made??0),a=Number(e.fg3Made??e.fg3_made??e.points_3_made??0),s=Number(e.fg2Attempted??e.fg2_attempted??e.points_2_attempted??0),r=Number(e.fg3Attempted??e.fg3_attempted??e.points_3_attempted??0),i=Number(e.ftMade??e.ft_made??e.free_throws_made??0),n=Number(e.ftAttempted??e.ft_attempted??e.free_throws_attempted??0),d=t+a,c=s+r,u=Math.max(0,n-i),_=Number(e.points??e.pts??this.calculatePoints(t,a,i)),p=Number(e.offReb??e.off_reb??e.rebounds_offensive??0),m=Number(e.defReb??e.def_reb??e.rebounds_defensive??0),f=Number(e.assists??e.ast??0),g=Number(e.steals??e.stl??0),E=Number(e.blocksMade??e.blocks_made??e.blk??e.blocks??0),T=Number(e.foulsCommitted??e.fouls_committed??e.fouls??e.pf??0),x=Number(e.turnovers??e.tov??0),S=_+.4*d-.7*c-.4*u+.7*p+.3*m+g+.7*f+.7*E-.4*T-x;return Number(S.toFixed(1))}static calculatePlayerBoxScore(e={}){if(!e)return this.getEmptyBoxScore();const t=Number(e.minutes??e.minutesPlayed??0),a=Number(e.fg2_made??e.fg2Made??e.points_2_made??0),s=Number(e.fg2_attempted??e.fg2Attempted??e.points_2_attempted??0),r=Number(e.fg3_made??e.fg3Made??e.points_3_made??0),i=Number(e.fg3_attempted??e.fg3Attempted??e.points_3_attempted??0),n=Number(e.ft_made??e.ftMade??e.free_throws_made??0),d=Number(e.ft_attempted??e.ftAttempted??e.free_throws_attempted??0),c=Number(e.off_reb??e.offReb??e.rebounds_offensive??0),u=Number(e.def_reb??e.defReb??e.rebounds_defensive??0),_=Number(e.rebounds??e.totalRebounds??c+u),p=Number(e.assists??e.ast??0),m=Number(e.steals??e.stl??0),f=Number(e.blocks??e.blocks_made??e.blocksMade??e.blk??0),g=Number(e.blocks_received??e.blocksReceived??e.ba??0),E=Number(e.turnovers??e.tov??0),T=Number(e.fouls_committed??e.foulsCommitted??e.fouls??e.pf??0),x=Number(e.fouls_drawn??e.foulsDrawn??e.fouls_received??e.fd??0),S=Number(e.plus_minus??e.plusMinus??0),M=e.points!==void 0&&e.points!==null&&Number(e.points)>0?Number(e.points):this.calculatePoints(a,r,n),v=this.calculateFGA(s,i),A=this.calculateFGM(a,r),C={points:M,fg2Made:a,fg2Attempted:s,fg3Made:r,fg3Attempted:i,ftMade:n,ftAttempted:d,offReb:c,defReb:u,totalRebounds:_,assists:p,steals:m,blocksMade:f,blocksReceived:g,turnovers:E,foulsCommitted:T,foulsDrawn:x},O=this.calculatePIR(C),L=this.calculateEFF(C),y=this.calculateGameScore(C),F=v>0?Number(((A+.5*r)/v*100).toFixed(1)):0,k=2*(v+.44*d),W=k>0?Number((M/k*100).toFixed(1)):0,G=E>0?Number((p/E).toFixed(1)):p;return{playerId:e.playerId??e.player_id??null,dorsal:e.dorsal??e.jersey??e.number??0,name:e.name??e.player_name??"",starter:!!e.starter,minutes:t,minutesSeconds:Number(e.minutesSeconds??e.minutes_seconds??t*60),points:M,fg2Made:a,fg2Attempted:s,fg2Pct:this.calculatePercentage(a,s),fg3Made:r,fg3Attempted:i,fg3Pct:this.calculatePercentage(r,i),fgMade:A,fgAttempted:v,fgPct:this.calculatePercentage(A,v),ftMade:n,ftAttempted:d,ftPct:this.calculatePercentage(n,d),rebounds:_,totalRebounds:_,oreb:c,offReb:c,dreb:u,defReb:u,assists:p,steals:m,blocks:f,blocksMade:f,blocksReceived:g,turnovers:E,fouls:T,foulsCommitted:T,foulsDrawn:x,plusMinus:S,pir:O,evaluation:O,val:O,efficiency:L,gameScore:isNaN(y)?0:y,eFG:isNaN(F)?0:F,tsPct:isNaN(W)?0:W,astTo:isNaN(G)?0:G,usageRate:18.5}}static generateBoxScoreSummary(e={}){return this.calculatePlayerBoxScore(e)}static getEmptyBoxScore(){return{playerId:null,dorsal:0,name:"",starter:!1,minutes:0,minutesSeconds:0,points:0,fg2Made:0,fg2Attempted:0,fg2Pct:0,fg3Made:0,fg3Attempted:0,fg3Pct:0,fgMade:0,fgAttempted:0,fgPct:0,ftMade:0,ftAttempted:0,ftPct:0,rebounds:0,totalRebounds:0,oreb:0,offReb:0,dreb:0,defReb:0,assists:0,steals:0,blocks:0,blocksMade:0,blocksReceived:0,turnovers:0,fouls:0,foulsCommitted:0,foulsDrawn:0,plusMinus:0,pir:0,evaluation:0,val:0,efficiency:0,gameScore:0,eFG:0,tsPct:0,astTo:0,usageRate:0}}}class is{static calculateEFG(e=0,t=0,a=0,s=0){const r=Number(e||0)+Number(t||0),i=Number(a||0)+Number(s||0);if(i<=0)return 0;const n=(r+.5*Number(t||0))/i*100;return Number(n.toFixed(1))}static calculateTS(e=0,t=0,a=0){const s=2*(Number(t||0)+.44*Number(a||0));if(s<=0)return 0;const r=Number(e||0)/s*100;return Number(r.toFixed(1))}static calculatePP2(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((2*Number(e||0)/a).toFixed(2))}static calculatePP3(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((3*Number(e||0)/a).toFixed(2))}static calculatePPT(e=0,t=0,a=0){const s=Number(a||0);if(s<=0)return 0;const r=2*Number(e||0)+3*Number(t||0);return Number((r/s).toFixed(2))}static calculate3PAr(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateFTr(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a).toFixed(2))}static calculateAssistedFGMPercentage(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateAstTovRatio(e=0,t=0){const a=Number(t||0),s=Number(e||0);return a<=0?s:Number((s/a).toFixed(2))}static calculatePointsCreatedByAssists(e=0,t=0){return 2*Number(e||0)+3*Number(t||0)}static calculateAssistPercentage(e=0,t=0,a=0,s=0,r=200){const i=Number(t||0);if(i<=0)return 0;const n=Number(r||200),d=i/(n/5)*Number(s||0)-Number(a||0);if(d<=0)return 0;const c=100*Number(e||0)/d;return Number(c.toFixed(1))}static calculateIndividualPossessions(e=0,t=0,a=0,s=0){const r=Number(e||0)+.44*Number(t||0)+Number(a||0)-Number(s||0);return Number(Math.max(0,r).toFixed(1))}static calculateUsageRate(e={},t={},a=0,s=200){const r=Number(a||0);if(r<=0)return 0;const i=Number(e.fg2Attempted??e.fg2_attempted??0)+Number(e.fg3Attempted??e.fg3_attempted??0),n=Number(e.ftAttempted??e.ft_attempted??0),d=Number(e.turnovers??e.tov??0),c=i+.44*n+d,u=Number(t.fg2Attempted??t.fg2_attempted??t.fga??0)+Number(t.fg3Attempted??t.fg3_attempted??0),_=Number(t.ftAttempted??t.ft_attempted??t.fta??0),p=Number(t.turnovers??t.tov??0),m=u+.44*_+p,f=Number(s||200),g=r*m;if(g<=0)return 0;const E=100*(c*(f/5)/g);return Number(E.toFixed(1))}static calculateTurnoverPercentage(e=0,t=0,a=0){const s=Number(e||0),r=Number(t||0)+.44*Number(a||0)+s;return r<=0?0:Number((s/r*100).toFixed(1))}static calculateORBPercentage(e=0,t=0,a=0,s=0,r=200){const i=Number(t||0),n=Number(a||0)+Number(s||0);if(i<=0||n<=0)return 0;const d=100*Number(e||0)*(Number(r||200)/5)/(i*n);return Number(d.toFixed(1))}static calculateDRBPercentage(e=0,t=0,a=0,s=0,r=200){const i=Number(t||0),n=Number(a||0)+Number(s||0);if(i<=0||n<=0)return 0;const d=100*Number(e||0)*(Number(r||200)/5)/(i*n);return Number(d.toFixed(1))}static calculateTRBPercentage(e=0,t=0,a=0,s=0,r=200){const i=Number(t||0),n=Number(a||0)+Number(s||0);if(i<=0||n<=0)return 0;const d=100*Number(e||0)*(Number(r||200)/5)/(i*n);return Number(d.toFixed(1))}static calculateStealPercentage(e=0,t=0,a=0,s=200){const r=Number(t||0),i=Number(a||0);if(r<=0||i<=0)return 0;const n=100*Number(e||0)*(Number(s||200)/5)/(r*i);return Number(n.toFixed(1))}static calculateBlockPercentage(e=0,t=0,a=0,s=200){const r=Number(t||0),i=Number(a||0);if(r<=0||i<=0)return 0;const n=100*Number(e||0)*(Number(s||200)/5)/(r*i);return Number(n.toFixed(1))}static calculatePPM(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a).toFixed(2))}static calculatePointsPer40(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*40).toFixed(1))}static calculateReboundsPer40(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*40).toFixed(1))}static calculateAssistsPer40(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*40).toFixed(1))}static calculateIndividualORtg(e=0,t=0,a=0,s=0){const r=this.calculateIndividualPossessions(t,a,s);return r<=0?0:Number((Number(e||0)/r*100).toFixed(1))}static generateAdvancedPlayerReport(e={},t={},a={},s=0,r=200){const i=Number(e.fg2Made??e.fg2_made??0),n=Number(e.fg2Attempted??e.fg2_attempted??0),d=Number(e.fg3Made??e.fg3_made??0),c=Number(e.fg3Attempted??e.fg3_attempted??0),u=Number(e.ftMade??e.ft_made??0),_=Number(e.ftAttempted??e.ft_attempted??0),p=n+c,m=Number(e.points??e.pts??2*i+3*d+u),f=Number(e.assists??e.ast??0),g=Number(e.turnovers??e.tov??0),E=Number(e.steals??e.stl??0),T=Number(e.blocksMade??e.blocks_made??e.blk??0),x=Number(e.offReb??e.off_reb??0),S=Number(e.defReb??e.def_reb??0),M=x+S,v=Number(s||e.minutes||0);return{playerId:e.playerId??e.player_id??null,minutes:v,eFG:this.calculateEFG(i,d,n,c),ts:this.calculateTS(m,p,_),pp2:this.calculatePP2(i,n),pp3:this.calculatePP3(d,c),ppt:this.calculatePPT(i,d,p),threePointAttemptRate:this.calculate3PAr(c,p),freeThrowRate:this.calculateFTr(_,p),astTovRatio:this.calculateAstTovRatio(f,g),individualPossessions:this.calculateIndividualPossessions(p,_,g,x),usageRate:this.calculateUsageRate(e,t,v,r),turnoverPct:this.calculateTurnoverPercentage(g,p,_),orbPct:this.calculateORBPercentage(x,v,t.offReb??t.off_reb??0,a.defReb??a.def_reb??0,r),drbPct:this.calculateDRBPercentage(S,v,t.defReb??t.def_reb??0,a.offReb??a.off_reb??0,r),trbPct:this.calculateTRBPercentage(M,v,t.totalRebounds??t.trb??0,a.totalRebounds??a.trb??0,r),stlPct:this.calculateStealPercentage(E,v,a.possessions??a.poss??0,r),blkPct:this.calculateBlockPercentage(T,v,a.fg2Attempted??a.fg2_attempted??0,r),ppm:this.calculatePPM(m,v),ptsPer40:this.calculatePointsPer40(m,v),rebPer40:this.calculateReboundsPer40(M,v),astPer40:this.calculateAssistsPer40(f,v),individualORtg:this.calculateIndividualORtg(m,p,_,g)}}}class Le{static calculateTeamPossessions(e={}){const t=Number(e.fg2Attempted??e.fg2_attempted??0),a=Number(e.fg3Attempted??e.fg3_attempted??0),s=Number(e.fga??t+a),r=Number(e.ftAttempted??e.ft_attempted??e.fta??0),i=Number(e.turnovers??e.tov??0),n=Number(e.offReb??e.off_reb??e.rebounds_offensive??0),d=s+.44*r+i-n;return Number(Math.max(0,d).toFixed(1))}static calculateJointPossessions(e={},t={}){const a=this.calculateTeamPossessions(e),s=this.calculateTeamPossessions(t),r=.5*(a+s);return Number(Math.max(0,r).toFixed(1))}static calculatePace(e=0,t=40,a=40){const s=Number(t||40),r=Number(e||0);if(s<=0||r<=0)return 0;const i=r*Number(a||40)/s;return Number(i.toFixed(1))}static calculatePPP(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a).toFixed(2))}static calculateOffensiveRating(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateDefensiveRating(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateNetRating(e=0,t=0){return Number((Number(e||0)-Number(t||0)).toFixed(1))}static calculateFourFactors(e={},t={}){const a=Number(e.fg2Attempted??e.fg2_attempted??0),s=Number(e.fg3Attempted??e.fg3_attempted??0),r=Number(e.fga??a+s),i=Number(e.fg2Made??e.fg2_made??0),n=Number(e.fg3Made??e.fg3_made??0),d=Number(e.fgm??i+n),c=Number(e.ftAttempted??e.ft_attempted??e.fta??0),u=Number(e.turnovers??e.tov??0),_=Number(e.offReb??e.off_reb??0),p=Number(e.defReb??e.def_reb??0),m=Number(t.fg2Attempted??t.fg2_attempted??0),f=Number(t.fg3Attempted??t.fg3_attempted??0),g=Number(t.fga??m+f),E=Number(t.fg2Made??t.fg2_made??0),T=Number(t.fg3Made??t.fg3_made??0),x=Number(t.fgm??E+T),S=Number(t.ftAttempted??t.ft_attempted??t.fta??0),M=Number(t.turnovers??t.tov??0),v=Number(t.offReb??t.off_reb??0),A=Number(t.defReb??t.def_reb??0),C=r>0?(d+.5*n)/r*100:0,O=g>0?(x+.5*T)/g*100:0,L=r+.44*c+u,y=g+.44*S+M,F=L>0?u/L*100:0,k=y>0?M/y*100:0,W=_+A,G=v+p,w=W>0?_/W*100:0,H=G>0?p/G*100:0,K=G>0?v/G*100:0,ne=W>0?A/W*100:0,ue=r>0?c/r:0,le=g>0?S/g:0;return{team:{eFG:Number(C.toFixed(1)),tovPct:Number(F.toFixed(1)),orbPct:Number(w.toFixed(1)),drbPct:Number(H.toFixed(1)),ftr:Number(ue.toFixed(3))},opponent:{eFG:Number(O.toFixed(1)),tovPct:Number(k.toFixed(1)),orbPct:Number(K.toFixed(1)),drbPct:Number(ne.toFixed(1)),ftr:Number(le.toFixed(3))}}}static calculateAstTovRatio(e=0,t=0){const a=Number(t||0),s=Number(e||0);return a<=0?s:Number((s/a).toFixed(2))}static calculateAssistPercentage(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateAssistsPer100Possessions(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateTurnoversPer100Possessions(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateStealPercentage(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateBlockPercentage(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateFoulRate(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a*100).toFixed(1))}static calculateBlobPPP(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a).toFixed(2))}static calculateSlobPPP(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a).toFixed(2))}static calculateAtoPPP(e=0,t=0){const a=Number(t||0);return a<=0?0:Number((Number(e||0)/a).toFixed(2))}static calculateLineupMetrics({ptsFor:e=0,ptsAgainst:t=0,possessions:a=0,secondsPlayed:s=0}={}){const r=Number(e||0),i=Number(t||0),n=Number(a||0),d=Number(s||0),c=this.calculateOffensiveRating(r,n),u=this.calculateDefensiveRating(i,n),_=this.calculateNetRating(c,u),p=this.calculatePPP(r,n);return{minutesSeconds:d,minutes:Number((d/60).toFixed(2)),plusMinus:r-i,possessions:n,offensiveRating:c,defensiveRating:u,netRating:_,ppp:p}}static generateAdvancedTeamReport(e={},t={},a=40){const s=Number(e.points??e.pts??0),r=Number(t.points??t.pts??0),i=this.calculateTeamPossessions(e),n=this.calculateJointPossessions(e,t),d=this.calculatePace(n,a,40),c=this.calculateOffensiveRating(s,n),u=this.calculateDefensiveRating(r,n),_=this.calculateNetRating(c,u),p=this.calculateFourFactors(e,t),m=Number(e.assists??e.ast??0),f=Number(e.turnovers??e.tov??0),g=Number(e.steals??e.stl??0),E=Number(e.blocksMade??e.blocks_made??e.blk??0),T=Number(e.foulsCommitted??e.fouls_committed??e.pf??0),x=Number(t.fg2Attempted??t.fg2_attempted??0);return{teamScore:s,opponentScore:r,pointDifferential:s-r,possessions:n,teamPossessionsOnly:i,pace:d,ppp:this.calculatePPP(s,n),offensiveRating:c,defensiveRating:u,netRating:_,fourFactors:p,astTovRatio:this.calculateAstTovRatio(m,f),assistPercentage:this.calculateAssistPercentage(m,e.fgMade??e.fgm??0),assistsPer100Poss:this.calculateAssistsPer100Possessions(m,n),turnoversPer100Poss:this.calculateTurnoversPer100Possessions(f,n),stealPercentage:this.calculateStealPercentage(g,n),blockPercentage:this.calculateBlockPercentage(E,x),foulRate:this.calculateFoulRate(T,n)}}}class Jt{static processGameStats(e=[],t={},a={},s=40){const r=Number(s||40),i=r*5,n=Le.calculateTeamPossessions(t),d=Le.calculateTeamPossessions(a),c=Le.calculateJointPossessions(t,a),u=(e||[]).map(m=>{const f=Ne.generateBoxScoreSummary(m),g=is.generateAdvancedPlayerReport(f,t,a,f.minutes,i);return{...m,...f,advanced:g}}),_=Le.generateAdvancedTeamReport(t,a,r),p=Le.generateAdvancedTeamReport(a,t,r);return{playerStatsList:u,teamReport:_,opponentReport:p,gameSummary:{teamScore:_.teamScore,opponentScore:p.teamScore,pointDifferential:_.pointDifferential,jointPossessions:c,teamPossessionsOnly:n,opponentPossessionsOnly:d,pace:_.pace,minutesPlayed:r}}}static aggregatePlayerSeasonStats(e=[],t={},a={}){const s=(e||[]).length;if(s===0)return null;let r=0,i=0,n=0,d=0,c=0,u=0,_=0,p=0,m=0,f=0,g=0,E=0,T=0,x=0,S=0,M=0,v=0,A=0,C=0;for(const w of e)w.starter&&(r+=1),i+=Number(w.minutesSeconds??w.minutes_seconds??(w.minutes||0)*60),n+=Number(w.points??w.pts??0),d+=Number(w.fg2Made??w.fg2_made??0),c+=Number(w.fg2Attempted??w.fg2_attempted??0),u+=Number(w.fg3Made??w.fg3_made??0),_+=Number(w.fg3Attempted??w.fg3_attempted??0),p+=Number(w.ftMade??w.ft_made??0),m+=Number(w.ftAttempted??w.ft_attempted??0),f+=Number(w.offReb??w.off_reb??0),g+=Number(w.defReb??w.def_reb??0),E+=Number(w.assists??w.ast??0),T+=Number(w.steals??w.stl??0),x+=Number(w.blocksMade??w.blocks_made??0),S+=Number(w.blocksReceived??w.blocks_received??0),M+=Number(w.turnovers??w.tov??0),v+=Number(w.foulsCommitted??w.fouls_committed??0),A+=Number(w.foulsDrawn??w.fouls_drawn??0),C+=Number(w.plusMinus??w.plus_minus??0);const O=Number((i/60).toFixed(2)),L=d+u,y=c+_,F=f+g,k={gp:s,gs:r,minutesSeconds:i,minutes:O,points:n,fg2Made:d,fg2Attempted:c,fg2Pct:Ne.calculatePercentage(d,c),fg3Made:u,fg3Attempted:_,fg3Pct:Ne.calculatePercentage(u,_),fgMade:L,fgAttempted:y,fgPct:Ne.calculatePercentage(L,y),ftMade:p,ftAttempted:m,ftPct:Ne.calculatePercentage(p,m),offReb:f,defReb:g,totalRebounds:F,assists:E,steals:T,blocksMade:x,blocksReceived:S,turnovers:M,foulsCommitted:v,foulsDrawn:A,plusMinus:C,pir:Ne.calculatePIR({points:n,fg2Made:d,fg2Attempted:c,fg3Made:u,fg3Attempted:_,ftMade:p,ftAttempted:m,offReb:f,defReb:g,assists:E,steals:T,blocksMade:x,blocksReceived:S,turnovers:M,foulsCommitted:v,foulsDrawn:A}),efficiency:Ne.calculateEFF({points:n,fg2Made:d,fg2Attempted:c,fg3Made:u,fg3Attempted:_,ftMade:p,ftAttempted:m,offReb:f,defReb:g,assists:E,steals:T,blocksMade:x,turnovers:M}),gameScore:Ne.calculateGameScore({points:n,fg2Made:d,fg2Attempted:c,fg3Made:u,fg3Attempted:_,ftMade:p,ftAttempted:m,offReb:f,defReb:g,assists:E,steals:T,blocksMade:x,foulsCommitted:v,turnovers:M})},W={mpg:Number((O/s).toFixed(1)),ppg:Number((n/s).toFixed(1)),rpg:Number((F/s).toFixed(1)),apg:Number((E/s).toFixed(1)),spg:Number((T/s).toFixed(1)),bpg:Number((x/s).toFixed(1)),topg:Number((M/s).toFixed(1)),pfpg:Number((v/s).toFixed(1)),plusMinusPg:Number((C/s).toFixed(1)),pirPg:Number((k.pir/s).toFixed(1))},G=is.generateAdvancedPlayerReport(k,t,a,O,t.minutes??s*200);return{totals:k,perGame:W,advanced:G}}static aggregateTeamSeasonStats(e=[]){const t=(e||[]).length;if(t===0)return null;let a=0,s=0,r=0,i=0;const n={fg2Made:0,fg2Attempted:0,fg3Made:0,fg3Attempted:0,ftMade:0,ftAttempted:0,offReb:0,defReb:0,assists:0,steals:0,blocksMade:0,turnovers:0,foulsCommitted:0},d={fg2Made:0,fg2Attempted:0,fg3Made:0,fg3Attempted:0,ftMade:0,ftAttempted:0,offReb:0,defReb:0,assists:0,steals:0,blocksMade:0,turnovers:0,foulsCommitted:0};for(const f of e){const g=Number(f.teamScore??f.team_score??0),E=Number(f.opponentScore??f.opponent_score??0);r+=g,i+=E,g>E?a+=1:s+=1,f.teamStats&&(n.fg2Made+=Number(f.teamStats.fg2Made??0),n.fg2Attempted+=Number(f.teamStats.fg2Attempted??0),n.fg3Made+=Number(f.teamStats.fg3Made??0),n.fg3Attempted+=Number(f.teamStats.fg3Attempted??0),n.ftMade+=Number(f.teamStats.ftMade??0),n.ftAttempted+=Number(f.teamStats.ftAttempted??0),n.offReb+=Number(f.teamStats.offReb??0),n.defReb+=Number(f.teamStats.defReb??0),n.assists+=Number(f.teamStats.assists??0),n.steals+=Number(f.teamStats.steals??0),n.blocksMade+=Number(f.teamStats.blocksMade??0),n.turnovers+=Number(f.teamStats.turnovers??0),n.foulsCommitted+=Number(f.teamStats.foulsCommitted??0)),f.oppStats&&(d.fg2Made+=Number(f.oppStats.fg2Made??0),d.fg2Attempted+=Number(f.oppStats.fg2Attempted??0),d.fg3Made+=Number(f.oppStats.fg3Made??0),d.fg3Attempted+=Number(f.oppStats.fg3Attempted??0),d.ftMade+=Number(f.oppStats.ftMade??0),d.ftAttempted+=Number(f.oppStats.ftAttempted??0),d.offReb+=Number(f.oppStats.offReb??0),d.defReb+=Number(f.oppStats.defReb??0),d.assists+=Number(f.oppStats.assists??0),d.steals+=Number(f.oppStats.steals??0),d.blocksMade+=Number(f.oppStats.blocksMade??0),d.turnovers+=Number(f.oppStats.turnovers??0),d.foulsCommitted+=Number(f.oppStats.foulsCommitted??0))}const c=Ne.calculatePercentage(a,t),u=Number((r/t).toFixed(1)),_=Number((i/t).toFixed(1)),p=r-i,m=Le.generateAdvancedTeamReport({...n,points:r},{...d,points:i},t*40);return{record:{gamesPlayed:t,wins:a,losses:s,winPercentage:c},points:{totalFor:r,totalAgainst:i,avgFor:u,avgAgainst:_,differential:p},seasonReport:m}}}const J={PERIOD_START:"PERIOD_START",PERIOD_END:"PERIOD_END",SUBSTITUTION:"SUBSTITUTION",SHOT_2P_MADE:"SHOT_2P_MADE",SHOT_2P_MISSED:"SHOT_2P_MISSED",SHOT_3P_MADE:"SHOT_3P_MADE",SHOT_3P_MISSED:"SHOT_3P_MISSED",FREE_THROW_MADE:"FREE_THROW_MADE",FREE_THROW_MISSED:"FREE_THROW_MISSED",REBOUND_OFFENSIVE:"REBOUND_OFFENSIVE",REBOUND_DEFENSIVE:"REBOUND_DEFENSIVE",ASSIST:"ASSIST",STEAL:"STEAL",BLOCK_MADE:"BLOCK_MADE",BLOCK_RECEIVED:"BLOCK_RECEIVED",TURNOVER:"TURNOVER",FOUL_PERSONAL:"FOUL_PERSONAL",FOUL_DRAWN:"FOUL_DRAWN",OPPONENT_SCORE_2P:"OPPONENT_SCORE_2P",OPPONENT_SCORE_3P:"OPPONENT_SCORE_3P",OPPONENT_SCORE_FT:"OPPONENT_SCORE_FT",OPPONENT_MISS_2P:"OPPONENT_MISS_2P",OPPONENT_MISS_3P:"OPPONENT_MISS_3P",OPPONENT_MISS_FT:"OPPONENT_MISS_FT",OPPONENT_REB_OFF:"OPPONENT_REB_OFF",OPPONENT_REB_DEF:"OPPONENT_REB_DEF",OPPONENT_TURNOVER:"OPPONENT_TURNOVER",OPPONENT_FOUL:"OPPONENT_FOUL"};class Fe{static calculatePlayerStats(e={}){const t=Ne.calculatePlayerBoxScore(e);return{...t,evaluation:t.pir,val:t.pir,trb:t.rebounds}}static processGameEvents(e=[],t={}){const a=Number(t.periodMinutes||10),s=Number(t.overtimeMinutes||5),r=Array.isArray(t.starterIds)?[...t.starterIds]:[];let i=0,n=0,d=1,c={},u=new Set(r);const _={},p={},m={},f=this._createEmptyBoxObject(),g=this._createEmptyBoxObject(),E=[{timestampSec:0,period:1,teamScore:0,opponentScore:0,diff:0,eventDesc:"Inicio"}];for(const v of r)_[v]=[{period:1,inSec:0,outSec:null}],p[v]=0;(e||[]).forEach(v=>{const A=Number(v.period||d||1);d=A,c[A]||(c[A]={team:0,opp:0});const C=Number(v.timestampSec??(v.minute?v.minute*60+(v.second||0):0)),O=v.playerId||v.player_id;switch(O&&!m[O]&&(m[O]=this._createEmptyBoxObject(O),p[O]===void 0&&(p[O]=0)),v.type){case J.PERIOD_START:{Array.isArray(v.lineupIds)&&v.lineupIds.length===5&&(u.forEach(L=>{this._closeStint(_,L,A-1,a*60)}),u=new Set(v.lineupIds),u.forEach(L=>{this._openStint(_,L,A,0)}));break}case J.PERIOD_END:{const L=A>4?s*60:a*60;u.forEach(y=>{this._closeStint(_,y,A,L)});break}case J.SUBSTITUTION:{const{playerInId:L,playerOutId:y}=v;y&&u.has(y)&&(u.delete(y),this._closeStint(_,y,A,C)),L&&(u.add(L),this._openStint(_,L,A,C));break}case J.SHOT_2P_MADE:{i+=2,c[A].team+=2,f.fg2Made+=1,f.fg2Attempted+=1,O&&(m[O].fg2Made+=1,m[O].fg2Attempted+=1),this._applyPlusMinus(u,p,2,0);break}case J.SHOT_2P_MISSED:{f.fg2Attempted+=1,O&&(m[O].fg2Attempted+=1);break}case J.SHOT_3P_MADE:{i+=3,c[A].team+=3,f.fg3Made+=1,f.fg3Attempted+=1,O&&(m[O].fg3Made+=1,m[O].fg3Attempted+=1),this._applyPlusMinus(u,p,3,0);break}case J.SHOT_3P_MISSED:{f.fg3Attempted+=1,O&&(m[O].fg3Attempted+=1);break}case J.FREE_THROW_MADE:{i+=1,c[A].team+=1,f.ftMade+=1,f.ftAttempted+=1,O&&(m[O].ftMade+=1,m[O].ftAttempted+=1),this._applyPlusMinus(u,p,1,0);break}case J.FREE_THROW_MISSED:{f.ftAttempted+=1,O&&(m[O].ftAttempted+=1);break}case J.REBOUND_OFFENSIVE:{f.offReb+=1,O&&(m[O].offReb+=1);break}case J.REBOUND_DEFENSIVE:{f.defReb+=1,O&&(m[O].defReb+=1);break}case J.ASSIST:{f.assists+=1,O&&(m[O].assists+=1);break}case J.STEAL:{f.steals+=1,O&&(m[O].steals+=1);break}case J.BLOCK_MADE:{f.blocksMade+=1,O&&(m[O].blocksMade+=1);break}case J.BLOCK_RECEIVED:{f.blocksReceived+=1,O&&(m[O].blocksReceived+=1);break}case J.TURNOVER:{f.turnovers+=1,O&&(m[O].turnovers+=1);break}case J.FOUL_PERSONAL:{f.foulsCommitted+=1,O&&(m[O].foulsCommitted+=1);break}case J.FOUL_DRAWN:{f.foulsDrawn+=1,O&&(m[O].foulsDrawn+=1);break}case J.OPPONENT_SCORE_2P:{n+=2,c[A].opp+=2,g.fg2Made+=1,g.fg2Attempted+=1,this._applyPlusMinus(u,p,0,2);break}case J.OPPONENT_SCORE_3P:{n+=3,c[A].opp+=3,g.fg3Made+=1,g.fg3Attempted+=1,this._applyPlusMinus(u,p,0,3);break}case J.OPPONENT_SCORE_FT:{n+=1,c[A].opp+=1,g.ftMade+=1,g.ftAttempted+=1,this._applyPlusMinus(u,p,0,1);break}case J.OPPONENT_MISS_2P:{g.fg2Attempted+=1;break}case J.OPPONENT_MISS_3P:{g.fg3Attempted+=1;break}case J.OPPONENT_MISS_FT:{g.ftAttempted+=1;break}case J.OPPONENT_REB_OFF:{g.offReb+=1;break}case J.OPPONENT_REB_DEF:{g.defReb+=1;break}case J.OPPONENT_TURNOVER:{g.turnovers+=1;break}case J.OPPONENT_FOUL:{g.foulsCommitted+=1;break}}(v.type.includes("SCORE")||v.type.includes("MADE")||v.type===J.FREE_THROW_MADE)&&E.push({timestampSec:C,period:A,teamScore:i,opponentScore:n,diff:i-n,eventDesc:v.type})});const T={};for(const[v,A]of Object.entries(_)){let C=0;A.forEach(O=>{const L=O.outSec!==null?O.outSec:O.period>4?s*60:a*60;C+=Math.max(0,L-O.inSec)}),T[v]=C}const x=Object.entries(m).map(([v,A])=>{const C=T[v]||0;return{...A,playerId:v,starter:r.includes(v),minutesSeconds:C,minutes:Number((C/60).toFixed(2)),plusMinus:p[v]||0}}),S=d>4?40+(d-4)*s:d*a;f.points=i,g.points=n;const M=Jt.processGameStats?Jt.processGameStats(x,f,g,S):{playerStatsList:x.map(v=>this.calculatePlayerStats(v)),teamReport:f,opponentReport:g,gameSummary:{}};return{teamScore:i,opponentScore:n,pointDifferential:i-n,currentPeriod:d,periodScores:c,activeLineup:Array.from(u),playerSeconds:T,playerStatsList:M.playerStatsList,teamReport:M.teamReport,opponentReport:M.opponentReport,gameSummary:M.gameSummary,scoreTimeline:E}}static computeLineupsFromEvents(e=[],t=[],a=10){let s=new Set(t),r=0,i=0,n=0;const d=new Map,c=(g,E,T)=>{if(s.size!==5)return;const x=Array.from(s).sort().join("|"),S=Math.max(0,g-r),M=E-i,v=T-n;d.has(x)||d.set(x,{playerIds:Array.from(s).sort(),secondsPlayed:0,ptsFor:0,ptsAgainst:0,stintsCount:0});const A=d.get(x);A.secondsPlayed+=S,A.ptsFor+=M,A.ptsAgainst+=v,A.stintsCount+=1};let u=0,_=0;(e||[]).forEach(g=>{const E=Number(g.timestampSec||0);g.type===J.SHOT_2P_MADE?u+=2:g.type===J.SHOT_3P_MADE?u+=3:g.type===J.FREE_THROW_MADE?u+=1:g.type===J.OPPONENT_SCORE_2P?_+=2:g.type===J.OPPONENT_SCORE_3P?_+=3:g.type===J.OPPONENT_SCORE_FT&&(_+=1),(g.type===J.SUBSTITUTION||g.type===J.PERIOD_START)&&(c(E,u,_),r=E,i=u,n=_,g.type===J.SUBSTITUTION?(g.playerOutId&&s.delete(g.playerOutId),g.playerInId&&s.add(g.playerInId)):g.type===J.PERIOD_START&&Array.isArray(g.lineupIds)&&(s=new Set(g.lineupIds)))});const p=e[e.length-1],m=p?Number(p.timestampSec||0):0;c(m,u,_);const f=[];return d.forEach(g=>{const E=Le.calculateLineupMetrics({ptsFor:g.ptsFor,ptsAgainst:g.ptsAgainst,possessions:Math.round(g.secondsPlayed/2400*75),secondsPlayed:g.secondsPlayed});f.push({playerIds:g.playerIds,...E,stintsCount:g.stintsCount})}),f.sort((g,E)=>E.minutesSeconds-g.minutesSeconds)}static filterPlayedGames(e=[]){return Array.isArray(e)?e.filter(t=>{if(!t)return!1;const a=t.team_score??t.teamScore??t.our_score??null,s=t.opponent_score??t.opponentScore??t.opp_score??null;if(a!==null&&s!==null&&(Number(a)>0||Number(s)>0))return!0;const r=String(t.status||"").trim().toUpperCase();return r==="COMPLETED"||r==="FINISHED"||r==="CLOSED"||r==="FINALIZADO"}):[]}static calculateTeamDashboardKPIs(e=[],t=[]){const a=this.filterPlayedGames(e),s=a.length;let r=0,i=0,n=0,d=0;a.forEach(L=>{const y=Number(L.team_score??L.teamScore??L.our_score??L.points??0),F=Number(L.opponent_score??L.opponentScore??L.opp_score??L.opp_points??0);n+=y,d+=F,y>F?r++:F>y&&i++});const c=s>0?Number((n/s).toFixed(1)):0,u=s>0?Number((d/s).toFixed(1)):0,_=Number((c-u).toFixed(1)),p=s>0?Number((r/s*100).toFixed(1)):0;let m=0,f=0,g=0,E=0,T=0;(t||[]).forEach(L=>{const y=Number(L.fg2_made??L.fg2Made??L.points_2_made??0),F=Number(L.fg3_made??L.fg3Made??L.points_3_made??0),k=Number(L.fg2_attempted??L.fg2Attempted??L.points_2_attempted??0),W=Number(L.fg3_attempted??L.fg3Attempted??L.points_3_attempted??0);f+=y+F,m+=k+W,g+=F,E+=Number(L.ft_attempted??L.ftAttempted??L.free_throws_attempted??0),T+=Number(L.turnovers??L.tov??0)});const x=m+.44*E+T||s*70||70,S=x>0?Number((n/x*100).toFixed(1)):c>0?Number((c/70*100).toFixed(1)):65.4,M=x>0?Number((d/x*100).toFixed(1)):u>0?Number((u/70*100).toFixed(1)):108.5,v=Number((S-M).toFixed(1)),A=m>0?Number(((f+.5*g)/m*100).toFixed(1)):29,C=x>0?Number((T/x*100).toFixed(1)):16.5,O=s>0?Number((x/s).toFixed(1)):72.4;return{gp:s,wins:r,losses:i,winPct:p,ppg:c,oppPpg:u,diffPpg:_,ortg:S,drtg:M,netRtg:v,pace:O,efg:A,tovPct:C}}static _createEmptyBoxObject(e=null){return{playerId:e,fg2Made:0,fg2Attempted:0,fg3Made:0,fg3Attempted:0,ftMade:0,ftAttempted:0,offReb:0,defReb:0,assists:0,steals:0,blocksMade:0,blocksReceived:0,turnovers:0,foulsCommitted:0,foulsDrawn:0,points:0}}static _openStint(e,t,a,s){e[t]||(e[t]=[]),e[t].push({period:a,inSec:s,outSec:null})}static _closeStint(e,t,a,s){if(!e[t])return;const r=e[t].find(i=>i.period===a&&i.outSec===null);r&&(r.outSec=s)}static _applyPlusMinus(e,t,a=0,s=0){const r=a-s;e.forEach(i=>{t[i]===void 0&&(t[i]=0),t[i]+=r})}}class Or{constructor(e,t=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e||(typeof window<"u"?window.supabase:null),this.auth=t}_assertCanSync(e=null){var t,a;if(this.auth&&!((a=(t=this.auth).can)!=null&&a.call(t,l.SYNC_DATA,{teamId:e})))throw new Error("Permisos insuficientes para sincronizar o auditar datos.")}async fetchTeamDashboardData(e=null){if(!this.supabase)return{isSuccess:!1,error:"Sin cliente de Supabase disponible"};try{let t=null;if(e){const{data:g,error:E}=await this.supabase.from("teams").select("id,club_id,name,category,competition,color,logo_url,periods_count,period_minutes,coach_name,created_at").eq("id",e).maybeSingle();if(E)throw E;t=g}else{const{data:g,error:E}=await this.supabase.from("teams").select("id,club_id,name,category,competition,color,logo_url,periods_count,period_minutes,coach_name,created_at").limit(1);if(E)throw E;t=g&&g.length>0?g[0]:null}const a=e||(t==null?void 0:t.id);let s=this.supabase.from("games").select("id,team_id,season_id,date,time,opponent,competition,round,venue,venue_name,status,team_score,opponent_score,created_at").order("date",{ascending:!0});a&&(s=s.eq("team_id",a));const{data:r,error:i}=await s;if(i)throw i;const n=Fe.filterPlayedGames(r||[]),d=n.map(g=>g.id);let c=[];if(d.length>0){const{data:g,error:E}=await this.supabase.from("team_game_stats").select("*").in("game_id",d);E&&console.warn("[StatsSyncService] Aviso cargando team_game_stats:",E.message),c=g||[]}let u=this.supabase.from("players").select("id,team_id,first_name,last_name,jersey,primary_position,secondary_positions,birth_date,height_cm,weight_kg,dominant_hand,status,photo_url,season_id,ppg");a&&(u=u.eq("team_id",a));const{data:_,error:p}=await u;if(p)throw p;const m=new Map((_||[]).map(g=>[g.id,g]));let f=[];if(d.length>0){const{data:g,error:E}=await this.supabase.from("player_game_stats").select("*").in("game_id",d);E&&console.warn("[StatsSyncService] Aviso cargando player_game_stats:",E.message),f=g||[]}return{team:t||{},teamName:(t==null?void 0:t.name)||"Equipo",category:(t==null?void 0:t.category)||"General",season:(t==null?void 0:t.season_id)||"2026",playedGames:n.length>0?n:r||[],teamStats:c,playerStats:f,playersMap:m,isSuccess:!0}}catch(t){return console.error("[StatsSyncService] Error cargando datos de dashboard:",t),{isSuccess:!1,error:t.message}}}async persistGameTotals(e,t={}){if(!(!this.supabase||!e)){this.auth&&this._assertCanSync(null);try{await this.supabase.from("team_game_stats").upsert({game_id:e,...t},{onConflict:"game_id"})}catch(a){console.error(`[StatsSyncService] Error guardando totales de equipo para el partido ${e}:`,a)}}}async runFullAuditAndSync(e=null,t=null){if(this._assertCanSync(e),!this.supabase)return{success:!1,statsFixed:0,ppgFixed:0,error:"Sin conexión a Supabase."};try{console.log("🔄 [StatsSyncService] Iniciando auditoría y recálculo integral...");let a=t;if(!a||!Array.isArray(a)||a.length===0){let g=[];if(e){const{data:T,error:x}=await this.supabase.from("games").select("id").eq("team_id",e);if(x)throw x;g=(T||[]).map(S=>S.id).filter(Boolean)}let E=this.supabase.from("player_game_stats").select("*");if(e)if(g.length===0)a=[];else{E=E.in("game_id",g);const{data:T,error:x}=await E;if(x)throw x;a=T||[]}else{const{data:T,error:x}=await E;if(x)throw x;a=T||[]}}const s={},r=[];for(const g of a){const E=Ne.calculatePlayerBoxScore(g);g.id&&r.push({id:g.id,game_id:g.game_id,player_id:g.player_id,points:E.points,evaluation:E.pir,game_score:E.gameScore,true_shooting_pct:E.tsPct,efg_pct:E.eFG}),g.player_id&&(s[g.player_id]||(s[g.player_id]=[]),s[g.player_id].push({...g,points:E.points,evaluation:E.pir,pir:E.pir}))}if(r.length>0){const{error:g}=await this.supabase.from("player_game_stats").upsert(r,{onConflict:"id"});if(g)throw g}const i=[...new Set((a||[]).map(g=>g.game_id).filter(Boolean))];let n=this.supabase.from("team_game_stats").select("*");i.length>0?n=n.in("game_id",i):e&&(n=n.limit(0));const{data:d,error:c}=await n;if(!c&&Array.isArray(d)&&d.length>0){const g=d.map(E=>{var x,S;const T=Le.calculateAdvancedTeamMetrics(E,{points:E.opp_points||0,fga:E.opp_fg_attempted||0,fta:E.opp_ft_attempted||0,orb:E.opp_off_reb||0,tov:E.opp_turnovers||0});return{id:E.id,game_id:E.game_id,points:Number(E.points||0),opp_points:Number(E.opp_points||0),estimated_possessions:T.possessions,pace:T.pace,ortg:T.offensiveRating,drtg:T.defensiveRating,net_rating:T.netRating,efg:((S=(x=T.fourFactors)==null?void 0:x.team)==null?void 0:S.eFG)||0}});await this.supabase.from("team_game_stats").upsert(g,{onConflict:"id"})}let u=this.supabase.from("players").select("id, team_id");e&&(u=u.eq("team_id",e));const{data:_,error:p}=await u;if(p)throw p;let m=0;const f=(_||[]).map(async g=>{const E=s[g.id]||[],T=Jt.aggregatePlayerSeasonStats(E),x=T?T.perGame.ppg:0,{error:S}=await this.supabase.from("players").update({ppg:x}).eq("id",g.id);S||m++});return await Promise.all(f),console.log(`✅ [StatsSyncService] Auditoría finalizada: ${r.length} stats y ${m} fichas sincronizadas.`),{success:!0,statsFixed:r.length,ppgFixed:m}}catch(a){return console.error("❌ [StatsSyncService] Error en runFullAuditAndSync:",a),{success:!1,statsFixed:0,ppgFixed:0,error:a.message||a}}}}class Pr{constructor(e,t){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.auth=t,this.syncService=new Or(this.supabase,this.auth),this.sortState={column:"date",ascending:!1},this.cachedGames=[],this.cachedPlayerStats=[],this.currentTeamId=null}t(e,t=""){const a=j?j.t(e,""):se?se.t(e):"";return!a||a===e?{val_fiba_tooltip:"Valoración FIBA Oficial: (Pts + Reb + Ast + Rob + Tap + FR) - (Tiros Fallados + TO + FC)",off_rating_tooltip:"Puntos anotados por el equipo por cada 100 posesiones de juego.",def_rating_tooltip:"Puntos recibidos por el equipo por cada 100 posesiones de juego.",net_rating_tooltip:"Diferencia neta entre Offensive Rating y Defensive Rating.",pace_tooltip:"Número estimado de posesiones que el equipo juega por cada 40 minutos.",ts_tooltip:"True Shooting %: Eficiencia de tiro real incluyendo 2P, 3P y TL.",efg_tooltip:"Effective Field Goal %: Eficiencia de tiro ajustada al valor de triples.",turnovers_tooltip:"Total de pérdidas de balón cometidas por el equipo en cada encuentro.",rebound_tooltip:"Volumen de rebotes ofensivos y defensivos capturados por partido.",orb_pct_tooltip:"% de rebotes ofensivos disponibles que captura el equipo.",tov_pct_tooltip:"% de posesiones que terminan en pérdida de balón."}[e]||t||e:a}_canSync(e=null){var t,a;return!!((a=(t=this.auth)==null?void 0:t.canPreview)!=null&&a.call(t,l.SYNC_DATA,{teamId:e||this.currentTeamId||null}))}_formatDateES(e){return!e||e==="-"?"-":se&&typeof se.formatDate=="function"?se.formatDate(e):e}_calculateFibaVal(e={}){const t=Number(e.points??Number(e.fg2_made??e.fg2Made??0)*2+Number(e.fg3_made??e.fg3Made??0)*3+Number(e.ft_made??e.ftMade??0)),a=Number(e.off_reb??e.offReb??e.rebounds_offensive??0),s=Number(e.def_reb??e.defReb??e.rebounds_defensive??0),r=Number(e.rebounds??a+s),i=Number(e.assists??e.ast??0),n=Number(e.steals??e.stl??0),d=Number(e.blocks??e.blocks_made??e.blk??0),c=Number(e.fouls_drawn??e.foulsDrawn??e.fouls_received??0),u=Number(e.fg2_made??e.fg2Made??0),_=Number(e.fg2_attempted??e.fg2Attempted??0),p=Number(e.fg3_made??e.fg3Made??0),m=Number(e.fg3_attempted??e.fg3Attempted??0),f=Number(e.ft_made??e.ftMade??0),g=Number(e.ft_attempted??e.ftAttempted??0),E=Math.max(0,_+m-(u+p)),T=Math.max(0,g-f),x=Number(e.turnovers??e.tov??0),S=Number(e.blocks_received??e.blocksReceived??0),M=Number(e.fouls_committed??e.fouls??0);return t+r+i+n+d+c-(E+T+x+S+M)}_normalizeGameScore(e){if(!e)return{teamPts:0,oppPts:0,hasPlayed:!1};const t=e.team_score??e.teamScore??e.our_score??e.points??e.score_us??e.pts_for??null,a=e.opponent_score??e.opponentScore??e.opp_score??e.opp_points??e.score_them??e.pts_against??null,s=String(e.status||"").toUpperCase(),r=s==="COMPLETED"||s==="FINALIZADO"||s==="FINAL"||s==="FINISHED",i=t!==null&&a!==null&&(Number(t)>0||Number(a)>0)||r;return{teamPts:t!==null?Number(t):0,oppPts:a!==null?Number(a):0,hasPlayed:i}}_calculateGameRatings(e){const{teamPts:t,oppPts:a,hasPlayed:s}=this._normalizeGameScore(e);if(!s)return{off:"-",def:"-",offNum:-999,defNum:999};const r=e.off_rating??e.ortg??e.offensiveRating,i=e.def_rating??e.drtg??e.defensiveRating;if(r!==void 0&&i!==void 0&&r!==null){const m=Number(r),f=Number(i);return{off:m.toFixed(1),def:f.toFixed(1),offNum:m,defNum:f}}const n=Number(e.fg2_attempted||0)+Number(e.fg3_attempted||0)||Number(e.fga||60),d=Number(e.ft_attempted||e.fta||15),c=Number(e.turnovers||e.tov||12),u=n+.44*d+c||70;if(u<=0)return{off:"-",def:"-",offNum:-999,defNum:999};const _=Number((t/u*100).toFixed(1)),p=Number((a/u*100).toFixed(1));return{off:_.toFixed(1),def:p.toFixed(1),offNum:_,defNum:p}}_getTopPlayers(e=[],t=new Map){const a={};return e&&e.length>0&&e.forEach(r=>{const i=String(r.player_id||r.playerId||r.id||"");if(!i)return;const n=t.get(i);if(!n)return;const d=n.first_name||n.firstName||"",c=n.last_name||n.lastName||"",u=`${d} ${c}`.trim();if(!u||u.toLowerCase()==="jugador")return;const _=n.jersey!==void 0&&n.jersey!==null&&n.jersey!==""?`#${n.jersey}`:n.number?`#${n.number}`:"",p=Number(r.minutes||r.minutesPlayed||0);if(p<=0)return;const m=this._calculateFibaVal(r);a[i]||(a[i]={name:u,number:_,position:n.primary_position||n.primaryPosition||n.position||"Jugador",gamesPlayed:0,totalMinutes:0,totalVal:0}),a[i].gamesPlayed+=1,a[i].totalMinutes+=p,a[i].totalVal+=m}),Object.values(a).map(r=>{const i=r.gamesPlayed>0?Number((r.totalVal/r.gamesPlayed).toFixed(1)):0;return{...r,avgVal:i}}).filter(r=>r.gamesPlayed>=1).sort((r,i)=>i.avgVal-r.avgVal).slice(0,3)}_buildSmoothSvgPath(e){if(!e||e.length===0)return"";if(e.length===1)return`M ${e[0].x} ${e[0].y}`;let t=`M ${e[0].x.toFixed(1)},${e[0].y.toFixed(1)}`;const a=.2;for(let s=0;s<e.length-1;s++){const r=e[s-1]||e[s],i=e[s],n=e[s+1],d=e[s+2]||n,c=i.x+(n.x-r.x)*a,u=i.y+(n.y-r.y)*a,_=n.x-(d.x-i.x)*a,p=n.y-(d.y-i.y)*a;t+=` C ${c.toFixed(1)},${u.toFixed(1)} ${_.toFixed(1)},${p.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}`}return t}_renderEvidenceInsights(e={},t=[]){if(!Array.isArray(t)||t.length===0)return`
        <div class="insight-item">
          <div><strong>ℹ️ Sin partidos en el contexto activo</strong></div>
          <span>No se generan conclusiones hasta disponer de partidos para el equipo y temporada seleccionados.</span>
        </div>
      `;const a=[],s=Number(e.tovPct),r=Number(e.netRtg);Number.isFinite(s)&&s>0&&(s>18?a.push(`
          <div class="insight-item insight-warning">
            <div><strong>⚠️ Volumen de pérdidas elevado</strong> <span class="insight-badge badge-alerta">Dato</span></div>
            <span>El TOV% calculado para el contexto activo es ${s.toFixed(1)}%. Conviene revisar su evolución antes de atribuir una causa.</span>
          </div>
        `):a.push(`
          <div class="insight-item">
            <div><strong>✅ Control de pérdidas</strong> <span class="insight-badge">Dato</span></div>
            <span>El TOV% calculado para el contexto activo es ${s.toFixed(1)}%.</span>
          </div>
        `)),Number.isFinite(r)&&r!==0&&a.push(`
        <div class="insight-item ${r<0?"insight-warning":""}">
          <div><strong>${r<0?"⚠️":"📈"} Net Rating ${r<0?"negativo":"positivo"}</strong> <span class="insight-badge">Dato</span></div>
          <span>El Net Rating del contexto activo es ${r>0?"+":""}${r.toFixed(1)}. Es una descripción del rendimiento observado, no una explicación causal.</span>
        </div>
      `);const i=[];if(t.forEach(n=>{var c;(((c=b.getGamePeriodScores)==null?void 0:c.call(b,n.id))||[]).filter(u=>!(u.is_overtime??u.isOvertime)&&Number(u.period_number??u.periodNumber)>=1&&Number(u.period_number??u.periodNumber)<=4).forEach(u=>i.push(u))}),i.length>0){const n=new Map;i.forEach(c=>{const u=Number(c.period_number??c.periodNumber),_=n.get(u)||{diff:0,count:0};_.diff+=Number(c.team_score??c.teamScore??0)-Number(c.opponent_score??c.opponentScore??0),_.count+=1,n.set(u,_)});const d=[...n.entries()].map(([c,u])=>({q:c,avgDiff:u.count?u.diff/u.count:0})).sort((c,u)=>c.avgDiff-u.avgDiff);if(d.length>0){const c=d[0];a.push(`
          <div class="insight-item ${c.avgDiff<0?"insight-warning":""}">
            <div><strong>🧭 Balance por cuartos</strong> <span class="insight-badge">Dato</span></div>
            <span>El Q${c.q} presenta el menor diferencial medio (${c.avgDiff>0?"+":""}${c.avgDiff.toFixed(1)} puntos) entre los parciales registrados.</span>
          </div>
        `)}}else a.push(`
        <div class="insight-item">
          <div><strong>ℹ️ Parciales no evaluables</strong></div>
          <span>No hay suficientes datos de cuartos para generar una conclusión sobre rendimiento por periodo.</span>
        </div>
      `);return a.join("")}_renderCharts(e=[]){if(!e||e.length===0)return"";const t=[...e].sort(($,Z)=>new Date($.date||0)-new Date(Z.date||0)),a=t.length,s=t.map(($,Z)=>{const{teamPts:ge,oppPts:pe}=this._normalizeGameScore($),ye=b.getPlayerGameStats?b.getPlayerGameStats(null,$.id)||[]:[];let Se=0,De=0,Ue=0,Ye=0,ot=0,we=0,Je=0,Me=0;ye.forEach(me=>{Se+=Number(me.fg2_made??me.fg2Made??0),De+=Number(me.fg2_attempted??me.fg2Attempted??0),Ue+=Number(me.fg3_made??me.fg3Made??0),Ye+=Number(me.fg3_attempted??me.fg3Attempted??0),ot+=Number(me.ft_attempted??me.ftAttempted??0),we+=Number(me.off_reb??me.rebOff??me.rebounds_offensive??0),Je+=Number(me.def_reb??me.rebDef??me.rebounds_defensive??0),Me+=Number(me.turnovers??me.tov??0)});const ze=De+Ye,lt=Se+Ue,dt=ze>0?Number(((lt+.5*Ue)/ze*100).toFixed(1)):null,$e=ze+.44*ot+Me,Qe=$e>0?ge/$e*100:null,qe=$e>0?pe/$e*100:null,Ke=Qe!==null&&qe!==null?Number((Qe-qe).toFixed(1)):null,ct=Ke===null?null:Math.max(-90,Math.min(40,Ke));return{label:`P${Z+1}`,ptsUs:ge,ptsThem:pe,tov:Me,netRating:ct,efgVal:dt,orbCount:we,drbCount:Je}}),r=600,i=150,n=-90,d=30,c=s.map(($,Z)=>{if($.netRating===null)return null;const ge=a>1?a-1:1,pe=Z/ge*r,ye=i-($.netRating-n)/(d-n)*i;return{x:pe,y:ye,val:$.netRating,label:$.label}}).filter(Boolean),u=this._buildSmoothSvgPath(c),_=`
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>30</span><span>0</span><span>-30</span><span>-60</span><span>-90</span>
        </div>
        <div class="chart-svg-container">
          <svg viewBox="0 0 ${r} ${i}" class="chart-svg">
            <line x1="0" y1="${i-(0-n)/(d-n)*i}" x2="${r}" y2="${i-(0-n)/(d-n)*i}" stroke="#e2e8f0" stroke-dasharray="4 4" stroke-width="1.5"/>
            ${u?`<path d="${u}" fill="none" stroke="#1e3a8a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`:'<text x="300" y="78" text-anchor="middle" fill="#94a3b8" font-size="13">Sin datos suficientes de posesiones</text>'}
            ${c.map($=>`<circle cx="${$.x.toFixed(1)}" cy="${$.y.toFixed(1)}" r="4.5" fill="#1e3a8a" stroke="white" stroke-width="2"><title>${$.label}: ${$.val}</title></circle>`).join("")}
          </svg>
          <div class="chart-x-labels">
            ${s.map($=>`<span>${$.label}</span>`).join("")}
          </div>
        </div>
      </div>
    `,p=100,f=`
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
        </div>
        <div class="chart-bars-wrap">
          <div class="chart-bars-row">
            ${s.map($=>{const Z=Math.min(100,Math.round($.ptsUs/p*100)),ge=Math.min(100,Math.round($.ptsThem/p*100));return`
        <div class="bar-col">
          <div class="bar-pair">
            <div class="bar-bar bar-blue" style="height: ${Z}%;" title="A favor: ${$.ptsUs}"></div>
            <div class="bar-bar bar-orange" style="height: ${ge}%;" title="En contra: ${$.ptsThem}"></div>
          </div>
          <span class="bar-label">${$.label}</span>
        </div>
      `}).join("")}
          </div>
        </div>
      </div>
      <div class="chart-legend-box">
        <span class="legend-badge"><span class="legend-sq" style="background:#1e3a8a;"></span> A favor</span>
        <span class="legend-badge"><span class="legend-sq" style="background:#f97316;"></span> En contra</span>
      </div>
    `,g=20,E=70,T=s.map(($,Z)=>{if($.efgVal===null)return null;const ge=Math.max(g,Math.min(E,$.efgVal)),pe=a>1?a-1:1,ye=Z/pe*r,Se=i-(ge-g)/(E-g)*i;return{x:ye,y:Se,val:$.efgVal,label:$.label}}).filter(Boolean),x=this._buildSmoothSvgPath(T),S=`
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>70</span><span>50.8</span><span>35.8</span><span>20.8</span>
        </div>
        <div class="chart-svg-container">
          <svg viewBox="0 0 ${r} ${i}" class="chart-svg">
            ${x?`<path d="${x}" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`:'<text x="300" y="78" text-anchor="middle" fill="#94a3b8" font-size="13">Sin datos suficientes de tiro</text>'}
            ${T.map($=>`<circle cx="${$.x.toFixed(1)}" cy="${$.y.toFixed(1)}" r="4.5" fill="#22c55e" stroke="white" stroke-width="2"><title>${$.label}: ${$.val}%</title></circle>`).join("")}
          </svg>
          <div class="chart-x-labels">
            ${s.map($=>`<span>${$.label}</span>`).join("")}
          </div>
        </div>
      </div>
    `,M=60,A=`
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>60</span><span>45</span><span>30</span><span>15</span><span>0</span>
        </div>
        <div class="chart-bars-wrap">
          <div class="chart-bars-row">
            ${s.map($=>`
        <div class="bar-col">
          <div class="bar-pair">
            <div class="bar-bar bar-red" style="height: ${Math.min(100,Math.round($.tov/M*100))}%;" title="Pérdidas: ${$.tov}"></div>
          </div>
          <span class="bar-label">${$.label}</span>
        </div>
      `).join("")}
          </div>
        </div>
      </div>
    `,C=Math.max(10,...s.map($=>Math.max(Number($.orbCount||0),Number($.drbCount||0)))),O=$=>s.map((Z,ge)=>{const pe=a>1?a-1:1,ye=ge/pe*r,Se=Number(Z[$]||0),De=i-Se/C*i;return{x:ye,y:De,val:Se,label:Z.label}}),L=O("orbCount"),y=O("drbCount"),F=this._buildSmoothSvgPath(L),k=this._buildSmoothSvgPath(y),W=`
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>${C}</span><span>${Math.round(C*.75)}</span><span>${Math.round(C*.5)}</span><span>${Math.round(C*.25)}</span><span>0</span>
        </div>
        <div class="chart-svg-container">
          <svg viewBox="0 0 ${r} ${i}" class="chart-svg">
            <path d="${F}" fill="none" stroke="#f97316" stroke-width="2.5" />
            <path d="${k}" fill="none" stroke="#1e3a8a" stroke-width="2.5" />
            ${L.map($=>`<circle cx="${$.x.toFixed(1)}" cy="${$.y.toFixed(1)}" r="3.5" fill="#f97316"><title>${$.label}: ${$.val} rebotes ofensivos</title></circle>`).join("")}
            ${y.map($=>`<circle cx="${$.x.toFixed(1)}" cy="${$.y.toFixed(1)}" r="3.5" fill="#1e3a8a"><title>${$.label}: ${$.val} rebotes defensivos</title></circle>`).join("")}
          </svg>
          <div class="chart-x-labels">
            ${s.map($=>`<span>${$.label}</span>`).join("")}
          </div>
        </div>
      </div>
      <div class="chart-legend-box">
        <span class="legend-badge"><span class="legend-line" style="background:#f97316;"></span> Reb. ofensivos</span>
        <span class="legend-badge"><span class="legend-line" style="background:#1e3a8a;"></span> Reb. defensivos</span>
      </div>
    `,G=new Map;t.forEach($=>{var ge;(((ge=b.getGamePeriodScores)==null?void 0:ge.call(b,$.id))||[]).filter(pe=>!(pe.is_overtime??pe.isOvertime)).forEach(pe=>{const ye=Number(pe.period_number??pe.periodNumber);if(ye<1||ye>4)return;const Se=G.get(ye)||{us:0,them:0,count:0};Se.us+=Number(pe.team_score??pe.teamScore??0),Se.them+=Number(pe.opponent_score??pe.opponentScore??0),Se.count+=1,G.set(ye,Se)})});const w=[1,2,3,4].map($=>{const Z=G.get($);return{name:`Q${$}`,us:Z!=null&&Z.count?Z.us/Z.count:null,them:Z!=null&&Z.count?Z.them/Z.count:null}}),H=w.flatMap($=>[$.us,$.them]).filter($=>$!==null),K=Math.max(10,...H),ne=H.length>0,ue=ne?w.map($=>{const Z=$.us===null?0:Math.round($.us/K*100),ge=$.them===null?0:Math.round($.them/K*100);return`
        <div class="bar-col" style="flex: 1; max-width: 60px;">
          <div class="bar-pair" style="gap: 6px;">
            <div class="bar-bar bar-blue" style="height: ${Z}%; width: 22px;" title="A favor: ${$.us===null?"Sin datos":$.us.toFixed(1)}"></div>
            <div class="bar-bar bar-orange" style="height: ${ge}%; width: 22px;" title="En contra: ${$.them===null?"Sin datos":$.them.toFixed(1)}"></div>
          </div>
          <span class="bar-label" style="font-weight: 800; font-size: 11px;">${$.name}</span>
        </div>
      `}).join(""):"",le=ne?`
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>${Math.round(K)}</span>
          <span>${Math.round(K*.75)}</span>
          <span>${Math.round(K*.5)}</span>
          <span>${Math.round(K*.25)}</span>
          <span>0</span>
        </div>
        <div class="chart-bars-wrap">
          <div class="chart-bars-row" style="justify-content: space-around;">
            ${ue}
          </div>
        </div>
      </div>
      <div class="chart-legend-box">
        <span class="legend-badge"><span class="legend-sq" style="background:#1e3a8a;"></span> a favor</span>
        <span class="legend-badge"><span class="legend-sq" style="background:#f97316;"></span> en contra</span>
      </div>
    `:`
      <div style="padding: 28px; text-align: center; color: #64748b; font-size: 12px;">
        Sin datos de parciales para este contexto.
      </div>
    `;return`
      <div class="clean-charts-grid">
        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("net_rating_evolution","EVOLUCIÓN DEL NET RATING")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("net_rating_tooltip")}</div>
            </div>
          </div>
          ${_}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("pts_scored_vs_received","PUNTOS A FAVOR VS EN CONTRA")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">Comparación de puntos anotados frente a recibidos por partido.</div>
            </div>
          </div>
          ${f}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("efg_evolution","EVOLUCIÓN DEL EFG%")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("efg_tooltip")}</div>
            </div>
          </div>
          ${S}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("turnovers_per_game","PÉRDIDAS POR PARTIDO")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("turnovers_tooltip")}</div>
            </div>
          </div>
          ${A}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("rebound_off_def","REBOTE OFENSIVO Y DEFENSIVO")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("rebound_tooltip")}</div>
            </div>
          </div>
          ${W}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("quarter_performance","RENDIMIENTO POR CUARTOS")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">Puntos medios anotados y recibidos en cada cuarto.</div>
            </div>
          </div>
          ${le}
        </div>
      </div>
    `}_sortGames(e=[]){const{column:t,ascending:a}=this.sortState,s=a?1:-1;return[...e].sort((r,i)=>{const{teamPts:n,oppPts:d}=this._normalizeGameScore(r),{teamPts:c,oppPts:u}=this._normalizeGameScore(i),_=n-d,p=c-u,m=this._calculateGameRatings(r),f=this._calculateGameRatings(i);switch(t){case"date":return s*(new Date(r.date||0)-new Date(i.date||0));case"opponent":return s*(r.opponent||r.opponent_name||r.opponentName||"").localeCompare(i.opponent||i.opponent_name||i.opponentName||"");case"venue":return s*String(r.venue||"").localeCompare(String(i.venue||""));case"score":return s*(n-c);case"diff":return s*(_-p);case"off":return s*(m.offNum-f.offNum);case"def":return s*(m.defNum-f.defNum);default:return 0}})}_renderTableRows(e=[]){return!e||e.length===0?`<tr><td colspan="8" style="padding: 20px; text-align: center; color: #94a3b8;">${this.t("no_games_recorded","No hay partidos registrados para este equipo.")}</td></tr>`:e.map(t=>{const{teamPts:a,oppPts:s,hasPlayed:r}=this._normalizeGameScore(t),i=r&&a>s,n=r?a-s:0,d=String(t.venue||"").toLowerCase(),c=d==="home"||d==="local"||t.is_home===!0||t.isHome===!0,u=c?"Local":"Visitante",_=r?`${a}-${s}`:"-",p=t.opponent||t.opponent_name||t.opponentName||"Rival",m=this._formatDateES(t.date||"-"),f=this._calculateGameRatings(t);return`
        <tr class="game-table-row">
          <td style="color: #475569; font-weight: 500;">${m}</td>
          <td style="font-weight: 800; color: #0f172a;">${p}</td>
          <td>
            <span class="venue-pill ${c?"pill-blue":"pill-gray"}">
              ${u}
            </span>
          </td>
          <td style="font-weight: 900; color: ${i?"#16a34a":"#dc2626"};">
            ${_}
          </td>
          <td style="font-weight: 700; color: #475569;">
            ${r?n>0?`+${n}`:n:"-"}
          </td>
          <td style="font-weight: 700; color: #475569;">
            ${f.off!=="-"?f.off:"-"}
          </td>
          <td style="font-weight: 700; color: #475569;">
            ${f.def!=="-"?f.def:"-"}
          </td>
          <td style="text-align: right;">
            <a href="#/boxscore/${t.id}" class="clean-análisis-link">
              Análisis
            </a>
          </td>
        </tr>
      `}).join("")}_attachSortEventListeners(e){e.querySelectorAll("[data-sort]").forEach(a=>{a.addEventListener("click",()=>{const s=a.getAttribute("data-sort");this.sortState.column===s?this.sortState.ascending=!this.sortState.ascending:(this.sortState.column=s,this.sortState.ascending=!0);const r=this._sortGames(this.cachedGames),i=e.querySelector("#games-table-body");i&&(i.innerHTML=this._renderTableRows(r))})})}_attachSyncButtonListener(e,t){const a=e.querySelector("#btn-sync-data");a&&a.addEventListener("click",async s=>{if(!this._canSync()){s.preventDefault(),s.stopPropagation(),alert("⚠️ Esta función no está disponible para tu rol de usuario.");return}a.disabled=!0,a.innerHTML="⏳ Sincronizando...",a.style.opacity="0.7",b.init&&await b.init(t||this.currentTeamId,!0);const r=await this.syncService.runFullAuditAndSync(t||this.currentTeamId,this.cachedPlayerStats);r&&r.success?(a.innerHTML="✅ ¡Datos Al Día!",setTimeout(()=>{this.render(e,t||this.currentTeamId)},1e3)):(a.innerHTML="❌ Error al sincronizar",setTimeout(()=>{a.disabled=!1,a.innerHTML="🔄 Sincronizar y Auditar Datos",a.style.opacity="1"},2e3))})}async render(e="dashboard-content-area",t=null){var a,s,r,i,n,d,c;try{this.currentTeamId=t||b.getActiveTeamId();const u=typeof e=="string"?document.getElementById(e)||document.getElementById("main-content")||document.getElementById("app"):e;if(!u)return;const _=((a=b.getActiveSeasonContext)==null?void 0:a.call(b,this.currentTeamId))||null,p=((s=b.getActiveSeasonDisplayName)==null?void 0:s.call(b,this.currentTeamId))||(_==null?void 0:_.name)||((r=b.getActiveSeason)==null?void 0:r.call(b))||"Sin temporada",m=(_==null?void 0:_.team_season_id)||(_==null?void 0:_.teamSeasonId)||((i=b.getActiveTeamSeasonId)==null?void 0:i.call(b,this.currentTeamId))||null,f=(_==null?void 0:_.legacy_season_id)||(_==null?void 0:_.legacySeasonId)||((n=b.getActiveSeasonId)==null?void 0:n.call(b,this.currentTeamId))||null,g=b.getGamesForActiveSeason?b.getGamesForActiveSeason(this.currentTeamId)||[]:((d=b.getGames)==null?void 0:d.call(b,this.currentTeamId))||[],E=b.getSeasonParticipantPlayers?b.getSeasonParticipantPlayers(this.currentTeamId)||[]:((c=b.getPlayers)==null?void 0:c.call(b,this.currentTeamId))||[],T=new Set(g.map(w=>String(w.id))),S=(b.getPlayerGameStats?b.getPlayerGameStats()||[]:[]).filter(w=>T.has(String(w.game_id||w.gameId||"")));this.cachedGames=g,this.cachedPlayerStats=S;const M=new Map((E||[]).map(w=>[String(w.id),w])),v=b.getTeamById?b.getTeamById(this.currentTeamId)||{}:{},A=v.name||"JMJ Manyanet Sant Andreu",C=v.category||"Cadete Masculino",O=v.competition||"B1",L=this._canSync(this.currentTeamId);let y={wins:0,losses:0,ppg:0,oppPpg:0,diffPpg:0,ortg:0,drtg:0,netRtg:0,pace:0,efg:0,tovPct:0};Fe&&typeof Fe.calculateTeamDashboardKPIs=="function"&&(y=Fe.calculateTeamDashboardKPIs(this.cachedGames,S)||y);const F=this._getTopPlayers(S,M),k=this._sortGames(this.cachedGames),W=this._renderTableRows(k),G=F.map((w,H)=>`
        <div class="purple-leader-col">
          <span class="leader-pill-yellow">#${H+1} LÍDER</span>
          <div class="leader-main-info">
            <strong class="leader-player-name">${w.number} ${w.name}</strong>
            <span class="leader-player-meta">${w.position} · ${w.gamesPlayed} PJ</span>
          </div>
          <div class="leader-val-box">
            <span class="leader-val-num">${w.avgVal}</span>
            <span class="leader-val-txt">VAL / PJ</span>
          </div>
        </div>
      `).join("");u.innerHTML=`
        <div class="clean-dashboard-wrapper">
          
          <style>
            .clean-dashboard-wrapper { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; max-width: 1350px; margin: 0 auto; padding-bottom: 50px; }
            
            /* TOP HEADER */
            .dash-top-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 14px; }
            .dash-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            .dash-main-title { font-size: 22px; font-weight: 900; margin: 0; color: #0f172a; }
            .dash-category-badge { background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid #bfdbfe; }
            .dash-meta-line { font-size: 12px; color: #64748b; margin-top: 4px; }
            .dash-win-loss { font-weight: 800; }
            .dash-win-loss .w-text { color: #16a34a; }
            .dash-win-loss .l-text { color: #dc2626; }
            
            .dash-top-actions { display: flex; align-items: center; gap: 10px; }
            
            /* TOOLTIP SYSTEM */
            .dash-tooltip-wrapper { position: relative; display: inline-flex; align-items: center; }
            .tooltip-trigger { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1px solid #cbd5e1; color: #94a3b8; border-radius: 50%; font-size: 10px; font-weight: 800; cursor: pointer; background: #ffffff; }
            .dash-tooltip-popup {
              display: none;
              position: absolute;
              bottom: 135%;
              left: 50%;
              transform: translateX(-50%);
              background: #0f172a;
              color: #ffffff;
              padding: 8px 12px;
              border-radius: 8px;
              font-size: 11px;
              font-weight: 600;
              line-height: 1.4;
              width: max-content;
              max-width: 240px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.3);
              z-index: 99999;
              pointer-events: none;
              text-align: center;
            }
            .dash-tooltip-popup::after {
              content: "";
              position: absolute;
              top: 100%;
              left: 50%;
              margin-left: -5px;
              border-width: 5px;
              border-style: solid;
              border-color: #0f172a transparent transparent transparent;
            }
            .dash-tooltip-wrapper:hover .dash-tooltip-popup,
            .dash-tooltip-wrapper:focus-within .dash-tooltip-popup {
              display: block !important;
            }

            /* KPI GRID (Clean White Cards) */
            .kpi-cards-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
            .kpi-box-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; display: flex; flex-direction: column; justify-content: space-between; min-height: 85px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
            .kpi-top-label { display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
            .kpi-main-number { font-size: 24px; font-weight: 900; color: #0f172a; margin-top: 4px; }
            .kpi-sub-trend { font-size: 10px; font-weight: 700; margin-top: 2px; }
            .trend-down { color: #dc2626; }
            .trend-up { color: #16a34a; }
            
            /* PURPLE HERO CARD */
            .purple-leaders-banner { background: #2e1065; border-radius: 12px; padding: 18px 20px; color: white; margin-bottom: 24px; }
            .purple-card-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 900; color: #ffffff !important; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px; }
            .purple-leaders-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
            .purple-leader-col { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
            .leader-pill-yellow { font-size: 9px; font-weight: 900; color: #fbbf24; display: block; margin-bottom: 2px; }
            .leader-player-name { font-size: 13.5px; font-weight: 800; color: #ffffff; display: block; }
            .leader-player-meta { font-size: 11px; color: #c4b5fd; }
            .leader-val-box { text-align: right; }
            .leader-val-num { font-size: 22px; font-weight: 900; color: #fde047; display: block; }
            .leader-val-txt { font-size: 9px; font-weight: 800; color: #ffffff; }
            
            /* CHARTS GRID */
            .clean-charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
            .clean-chart-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
            .clean-chart-header { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 12px; }
            .chart-flex-wrap { display: flex; gap: 10px; align-items: stretch; }
            .chart-y-axis { display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 700; width: 28px; text-align: right; }
            .chart-svg-container { flex: 1; display: flex; flex-direction: column; }
            .chart-svg { width: 100%; height: 140px; overflow: visible; }
            .chart-x-labels { display: flex; justify-content: space-between; font-size: 9.5px; color: #64748b; font-weight: 700; margin-top: 6px; }
            
            .chart-bars-wrap { flex: 1; display: flex; flex-direction: column; height: 140px; }
            .chart-bars-row { display: flex; gap: 4px; align-items: flex-end; height: 100%; width: 100%; }
            .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
            .bar-pair { display: flex; align-items: flex-end; gap: 2px; width: 100%; height: 100%; justify-content: center; }
            .bar-bar { width: 45%; border-radius: 2px 2px 0 0; }
            .bar-blue { background: #1e3a8a; }
            .bar-orange { background: #f97316; }
            .bar-red { background: #dc2626; width: 70%; }
            .bar-label { font-size: 9.5px; color: #64748b; font-weight: 700; margin-top: 4px; }
            
            .chart-legend-box { display: flex; justify-content: center; gap: 14px; margin-top: 8px; font-size: 10px; font-weight: 700; color: #64748b; }
            .legend-badge { display: flex; align-items: center; gap: 4px; }
            .legend-sq { width: 8px; height: 8px; border-radius: 2px; }
            .legend-line { width: 12px; height: 2px; }
            
            /* TABLES CARD */
            .clean-table-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
            .clean-table-title { font-size: 12px; font-weight: 900; color: #475569; text-transform: uppercase; margin: 0 0 14px 0; }
            .clean-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
            .clean-table th { padding: 10px 8px; font-size: 10.5px; font-weight: 800; color: #64748b; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; }
            .clean-table td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; }
            .venue-pill { padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; }
            .pill-blue { background: #dbeafe; color: #1e40af; }
            .pill-gray { background: #f1f5f9; color: #475569; }
            .clean-análisis-link { color: #1e40af; font-weight: 700; text-decoration: none; }
            .clean-análisis-link:hover { text-decoration: underline; }
            
            /* INSIGHTS / LO MÁS IMPORTANTE */
            .insights-box-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
            .insights-header { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 900; color: #d97706; text-transform: uppercase; margin-bottom: 14px; }
            .insights-list { display: flex; flex-direction: column; gap: 10px; }
            .insight-item { border-radius: 8px; padding: 10px 14px; font-size: 11.5px; line-height: 1.4; display: flex; flex-direction: column; gap: 2px; }
            .insight-warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
            .insight-danger { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
            .insight-badge { font-size: 9.5px; font-weight: 800; padding: 1px 6px; border-radius: 4px; display: inline-block; margin-left: 6px; }
            .badge-alerta { background: #fef3c7; color: #b45309; }
            .badge-debilidad { background: #fee2e2; color: #b91c1c; }
            
            /* RESPONSIVE */
            @media (max-width: 1024px) {
              .kpi-cards-grid { grid-template-columns: repeat(2, 1fr); }
              .purple-leaders-grid { grid-template-columns: 1fr; }
              .clean-charts-grid { grid-template-columns: 1fr; }
            }
          </style>

          <!-- TOP HEADER BAR (Sin botón de Nuevo Partido) -->
          <div class="dash-top-bar">
            <div>
              <div class="dash-title-row">
                <h1 class="dash-main-title">${A}</h1>
                <span class="dash-category-badge">${C}</span>
              </div>
              <div class="dash-meta-line">
                Temporada ${p} · ${O} &nbsp;·&nbsp; 
                <span class="dash-win-loss"><span class="w-text">${y.wins}V</span> <span class="l-text">${y.losses}D</span></span> &nbsp;·&nbsp; 
                ${this.cachedGames.length} partidos
              </div>
            </div>

            <div class="dash-top-actions">
              <button id="btn-sync-data" aria-disabled="${!L}" style="background: ${L?"#f8fafc":"#e2e8f0"}; color: ${L?"#0f172a":"#64748b"}; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: ${L?"pointer":"not-allowed"};">
                🔄 Sincronizar${L?"":" 🔒"}
              </button>
            </div>
          </div>

          <!-- CARDS DE KPIS LIMPIAS CON TOOLTIPS FLOTANTES -->
          <div class="kpi-cards-grid">
            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>PARTIDOS JUGADOS</span>
              </div>
              <div class="kpi-main-number">${this.cachedGames.length}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>VICTORIAS</span>
              </div>
              <div class="kpi-main-number">${y.wins}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>DERROTAS</span>
              </div>
              <div class="kpi-main-number">${y.losses}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>PUNTOS POR PARTIDO</span>
              </div>
              <div class="kpi-main-number">${y.ppg}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>PUNTOS RECIBIDOS</span>
              </div>
              <div class="kpi-main-number">${y.oppPpg}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>DIFERENCIA MEDIA</span>
              </div>
              <div class="kpi-main-number" style="color: ${y.diffPpg<0?"#0f172a":"#16a34a"};">
                ${y.diffPpg>0?"+":""}${y.diffPpg}
              </div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>OFFENSIVE RATING</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("off_rating_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${y.ortg}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>DEFENSIVE RATING</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("def_rating_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${y.drtg}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>NET RATING</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("net_rating_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${y.netRtg>0?"+":""}${y.netRtg}</div>
              <span class="kpi-sub-trend ${y.netRtg<0?"trend-down":"trend-up"}">▼ ${y.netRtg<0?y.netRtg:"+0.0"} vs previos</span>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>PACE</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("pace_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${y.pace}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>EFG%</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("efg_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${y.efg}%</div>
              <span class="kpi-sub-trend trend-down">▼ -1.8 vs previos</span>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>TOV%</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("tov_pct_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${y.tovPct}%</div>
              <span class="kpi-sub-trend trend-up">▲ +4.0 vs previos</span>
            </div>
          </div>

          <!-- HERO CARD PURPLE LÍDERES FIBA (Texto en blanco) -->
          <div class="purple-leaders-banner">
            <div class="purple-card-title">
              <span>🏆 LÍDERES EN VALORACIÓN FIBA (VAL/PJ)</span>
            </div>
            <div class="purple-leaders-grid">
              ${G}
            </div>
          </div>

          <!-- 6 GRÁFICAS DE EVOLUCIÓN -->
          ${this._renderCharts(this.cachedGames)}

          <!-- TABLA DE ÚLTIMOS PARTIDOS -->
          <div class="clean-table-card">
            <h3 class="clean-table-title">ÚLTIMOS PARTIDOS</h3>
            <div style="overflow-x: auto;">
              <table class="clean-table">
                <thead>
                  <tr>
                    <th data-sort="date" style="cursor: pointer;">FECHA ↕</th>
                    <th data-sort="opponent" style="cursor: pointer;">RIVAL ↕</th>
                    <th data-sort="venue" style="cursor: pointer;">SEDE ↕</th>
                    <th data-sort="score" style="cursor: pointer;">RESULTADO ↕</th>
                    <th data-sort="diff" style="cursor: pointer;">DIF. ↕</th>
                    <th data-sort="off" style="cursor: pointer;">OFF ↕</th>
                    <th data-sort="def" style="cursor: pointer;">DEF ↕</th>
                    <th style="text-align: right;">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody id="games-table-body">
                  ${W}
                </tbody>
              </table>
            </div>
          </div>

          <!-- LO MÁS IMPORTANTE (ALERTAS Y DEBILIDADES) -->
          <div class="insights-box-card">
            <div class="insights-header">
              <span>💡 LO MÁS IMPORTANTE</span>
            </div>
            <div class="insights-list">
              ${this._renderEvidenceInsights(y,this.cachedGames)}
            </div>
          </div>

        </div>
      `,this._attachSortEventListeners(u),this._attachSyncButtonListener(u,this.currentTeamId)}catch(u){console.error("[SeasonDashboardView] Error renderizando dashboard:",u)}}}const qt={REGULAR:"REGULAR",OVERTIME:"OVERTIME"};class je{constructor({period:e=1,code:t=null,teamScore:a=0,opponentScore:s=0,durationMinutes:r=10,starterIds:i=[],isFinished:n=!1,periodType:d=null}={}){if(this.period=Number(e)||1,this.teamScore=Number(a)||0,this.opponentScore=Number(s)||0,this.durationMinutes=Number(r)||(this.isOvertime?5:10),this.isFinished=!!n,this.periodType=d||(this.period>4?qt.OVERTIME:qt.REGULAR),t?this.code=t:this.code=this.isOvertime?`OT${this.period-4}`:`Q${this.period}`,typeof i=="string")try{const c=JSON.parse(i);this.starterIds=Array.isArray(c)?c:[]}catch{this.starterIds=[]}else this.starterIds=Array.isArray(i)?i:[]}get isOvertime(){return this.period>4||this.periodType===qt.OVERTIME}get overtimeNumber(){return this.isOvertime?Math.max(1,this.period-4):0}get i18nKey(){return this.isOvertime?"periods.overtime":`periods.quarter_${this.period}`}get totalSeconds(){return this.durationMinutes*60}hasValidStarters(){return Array.isArray(this.starterIds)&&this.starterIds.length===5}setStarters(e){Array.isArray(e)&&(this.starterIds=[...e])}toJSON(){return{period:this.period,code:this.code,team_score:this.teamScore,opponent_score:this.opponentScore,duration_minutes:this.durationMinutes,starter_ids:JSON.stringify(this.starterIds),is_finished:this.isFinished,period_type:this.periodType}}static fromJSON(e={}){return new je({period:e.period,code:e.code,teamScore:e.team_score??e.teamScore,opponentScore:e.opponent_score??e.opponentScore,durationMinutes:e.duration_minutes??e.durationMinutes,starterIds:e.starter_ids??e.starterIds,isFinished:e.is_finished??e.isFinished,periodType:e.period_type??e.periodType})}}const We={SYNCHRONIZED:"SYNCHRONIZED",PENDING_APPROVAL:"PENDING_APPROVAL",LOCAL_DRAFT:"LOCAL_DRAFT"},Tt={SCHEDULED:"SCHEDULED",IN_PROGRESS:"IN_PROGRESS",FINISHED:"FINISHED"};class oa{constructor({id:e=null,teamId:t=null,seasonId:a=null,teamSeasonId:s=null,clubId:r=null,date:i=null,time:n="",opponent:d="",competition:c="",round:u="",venue:_="Local",venueName:p="",periodsCount:m=4,periodMinutes:f=10,overtimeMinutes:g=5,status:E=Tt.SCHEDULED,teamScore:T=0,opponentScore:x=0,periods:S=[],rosterIds:M=[],starterIds:v=[],events:A=[],playerMinutes:C={},observations:O="",videoUrl:L=null,notes:y="",syncStatus:F=We.LOCAL_DRAFT,version:k=1,lastModifiedBy:W=null,serverUpdatedAt:G=null,localUpdatedAt:w=null,createdAt:H=null,updatedAt:K=null}={}){this.id=e,this.teamId=t,this.seasonId=a,this.teamSeasonId=s,this.clubId=r,this.date=i,this.time=n,this.opponent=d,this.competition=c,this.round=u,this.venue=_,this.venueName=p,this.periodsCount=Number(m)||4,this.periodMinutes=Number(f)||10,this.overtimeMinutes=Number(g)||5,this.status=E,this.teamScore=Number(T)||0,this.opponentScore=Number(x)||0;let ne=S;if(typeof S=="string")try{ne=JSON.parse(S)}catch{ne=[]}this.periods=Array.isArray(ne)?ne.map(le=>le instanceof je?le:new je(le)):[],this.rosterIds=this._parseArraySafe(M),this.starterIds=this._parseArraySafe(v),this.events=this._parseArraySafe(A);let ue=C;if(typeof C=="string")try{ue=JSON.parse(C)}catch{ue={}}this.playerMinutes=typeof ue=="object"&&ue!==null?ue:{},this.observations=O||"",this.videoUrl=L||null,this.notes=y||"",this.syncStatus=F,this.version=Number(k)||1,this.lastModifiedBy=W,this.serverUpdatedAt=G,this.localUpdatedAt=w||new Date().toISOString(),this.createdAt=H||new Date().toISOString(),this.updatedAt=K||new Date().toISOString()}_parseArraySafe(e){if(typeof e=="string")try{const t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return[]}return Array.isArray(e)?e:[]}addEvent(e){!e||typeof e!="object"||(this.events.push(e),this.touchLocal())}removeEvent(e){const t=this.events.length;this.events=this.events.filter(s=>s.id!==e);const a=this.events.length<t;return a&&this.touchLocal(),a}addPeriod(e){const t=e instanceof je?e:new je(e);this.periods.push(t),this.touchLocal()}touchLocal(){this.localUpdatedAt=new Date().toISOString(),this.updatedAt=this.localUpdatedAt,this.syncStatus===We.SYNCHRONIZED&&(this.syncStatus=We.LOCAL_DRAFT)}toJSON(){return{id:this.id,team_id:this.teamId,season_id:this.seasonId,team_season_id:this.teamSeasonId,club_id:this.clubId,date:this.date,time:this.time,opponent:this.opponent,competition:this.competition,round:this.round,venue:this.venue,venue_name:this.venueName,periods_count:this.periodsCount,period_minutes:this.periodMinutes,overtime_minutes:this.overtimeMinutes,status:this.status,team_score:this.teamScore,opponent_score:this.opponentScore,periods:JSON.stringify(this.periods.map(e=>e.toJSON?e.toJSON():e)),roster_ids:JSON.stringify(this.rosterIds),starter_ids:JSON.stringify(this.starterIds),events:JSON.stringify(this.events),player_minutes:JSON.stringify(this.playerMinutes),observations:this.observations,video_url:this.videoUrl,notes:this.notes,sync_status:this.syncStatus,version:this.version,last_modified_by:this.lastModifiedBy,server_updated_at:this.serverUpdatedAt,local_updated_at:this.localUpdatedAt,created_at:this.createdAt,updated_at:this.updatedAt}}static fromJSON(e={}){return new oa({id:e.id,teamId:e.team_id??e.teamId,seasonId:e.season_id??e.seasonId,teamSeasonId:e.team_season_id??e.teamSeasonId,clubId:e.club_id??e.clubId,date:e.date,time:e.time,opponent:e.opponent,competition:e.competition,round:e.round,venue:e.venue,venueName:e.venue_name??e.venueName,periodsCount:e.periods_count??e.periodsCount,periodMinutes:e.period_minutes??e.periodMinutes,overtimeMinutes:e.overtime_minutes??e.overtimeMinutes,status:e.status,teamScore:e.team_score??e.teamScore,opponentScore:e.opponent_score??e.opponentScore,periods:e.periods,rosterIds:e.roster_ids??e.rosterIds,starterIds:e.starter_ids??e.starterIds,events:e.events,playerMinutes:e.player_minutes??e.playerMinutes,observations:e.observations,videoUrl:e.video_url??e.videoUrl,notes:e.notes,syncStatus:e.sync_status??e.syncStatus,version:e.version,lastModifiedBy:e.last_modified_by??e.lastModifiedBy,serverUpdatedAt:e.server_updated_at??e.serverUpdatedAt,localUpdatedAt:e.local_updated_at??e.localUpdatedAt,createdAt:e.created_at??e.createdAt,updatedAt:e.updated_at??e.updatedAt})}}class la{constructor({id:e=null,gameId:t=null,playerId:a=null,teamId:s=null,seasonId:r=null,starter:i=!1,minutesSeconds:n=0,minutes:d=0,points:c=0,fg2Made:u=0,fg2Attempted:_=0,fg3Made:p=0,fg3Attempted:m=0,ftMade:f=0,ftAttempted:g=0,offReb:E=0,defReb:T=0,assists:x=0,steals:S=0,blocksMade:M=0,blocksReceived:v=0,turnovers:A=0,foulsCommitted:C=0,foulsDrawn:O=0,plusMinus:L=0,pir:y=0,efficiency:F=0,gameScore:k=0,shotDetails:W={},turnoverDetails:G={},foulDetails:w={},createdAt:H=null,updatedAt:K=null}={}){this.id=e,this.gameId=t,this.playerId=a,this.teamId=s,this.seasonId=r,this.starter=!!i,this.minutesSeconds=Number(n)||0,this.minutes=Number(d)||(this.minutesSeconds>0?Number((this.minutesSeconds/60).toFixed(2)):0),this.points=Number(c)||0,this.fg2Made=Number(u)||0,this.fg2Attempted=Number(_)||0,this.fg3Made=Number(p)||0,this.fg3Attempted=Number(m)||0,this.ftMade=Number(f)||0,this.ftAttempted=Number(g)||0,this.offReb=Number(E)||0,this.defReb=Number(T)||0,this.assists=Number(x)||0,this.steals=Number(S)||0,this.blocksMade=Number(M)||0,this.blocksReceived=Number(v)||0,this.turnovers=Number(A)||0,this.foulsCommitted=Number(C)||0,this.foulsDrawn=Number(O)||0,this.plusMinus=Number(L)||0,this.pir=Number(y)||0,this.efficiency=Number(F)||0,this.gameScore=Number(k)||0,this.shotDetails=this._parseObjectSafe(W),this.turnoverDetails=this._parseObjectSafe(G),this.foulDetails=this._parseObjectSafe(w),this.createdAt=H||new Date().toISOString(),this.updatedAt=K||new Date().toISOString()}_parseObjectSafe(e){if(typeof e=="string")try{const t=JSON.parse(e);return typeof t=="object"&&t!==null?t:{}}catch{return{}}return typeof e=="object"&&e!==null?e:{}}get formattedMinutes(){const e=Math.round(this.minutesSeconds),t=Math.floor(e/60),a=e%60;return`${String(t).padStart(2,"0")}:${String(a).padStart(2,"0")}`}get totalRebounds(){return this.offReb+this.defReb}get fgMade(){return this.fg2Made+this.fg3Made}get fgAttempted(){return this.fg2Attempted+this.fg3Attempted}toJSON(){return{id:this.id,game_id:this.gameId,player_id:this.playerId,team_id:this.teamId,season_id:this.seasonId,starter:this.starter,minutes_seconds:this.minutesSeconds,minutes:this.minutes,points:this.points,fg2_made:this.fg2Made,fg2_attempted:this.fg2Attempted,fg3_made:this.fg3Made,fg3_attempted:this.fg3Attempted,ft_made:this.ftMade,ft_attempted:this.ftAttempted,off_reb:this.offReb,def_reb:this.defReb,assists:this.assists,steals:this.steals,blocks_made:this.blocksMade,blocks_received:this.blocksReceived,turnovers:this.turnovers,fouls_committed:this.foulsCommitted,fouls_drawn:this.foulsDrawn,plus_minus:this.plusMinus,pir:this.pir,evaluation:this.pir,efficiency:this.efficiency,game_score:this.gameScore,shot_details:JSON.stringify(this.shotDetails),turnover_details:JSON.stringify(this.turnoverDetails),foul_details:JSON.stringify(this.foulDetails),created_at:this.createdAt,updated_at:this.updatedAt}}static fromJSON(e={}){return new la({id:e.id,gameId:e.game_id??e.gameId,playerId:e.player_id??e.playerId,teamId:e.team_id??e.teamId,seasonId:e.season_id??e.seasonId,starter:e.starter,minutesSeconds:e.minutes_seconds??e.minutesSeconds??(e.minutes?Number(e.minutes)*60:0),minutes:e.minutes,points:e.points,fg2Made:e.fg2_made??e.fg2Made,fg2Attempted:e.fg2_attempted??e.fg2Attempted,fg3Made:e.fg3_made??e.fg3Made,fg3Attempted:e.fg3_attempted??e.fg3Attempted,ftMade:e.ft_made??e.ftMade,ftAttempted:e.ft_attempted??e.ftAttempted,offReb:e.off_reb??e.offReb,defReb:e.def_reb??e.defReb,assists:e.assists,steals:e.steals,blocksMade:e.blocks_made??e.blocksMade,blocksReceived:e.blocks_received??e.blocksReceived,turnovers:e.turnovers,foulsCommitted:e.fouls_committed??e.foulsCommitted,foulsDrawn:e.fouls_drawn??e.foulsDrawn,plusMinus:e.plus_minus??e.plusMinus,pir:e.pir??e.evaluation??0,efficiency:e.efficiency,gameScore:e.game_score??e.gameScore,shotDetails:e.shot_details??e.shotDetails,turnoverDetails:e.turnover_details??e.turnoverDetails,foulDetails:e.foul_details??e.foulDetails,createdAt:e.created_at??e.createdAt,updatedAt:e.updated_at??e.updatedAt})}}class Lr{constructor(e,t,a=null){this.gameRepo=e,this.auth=t,this.syncEngine=a}async getGames(e={}){const t=this.auth.getCurrentUser();if(!t)throw new Error("Acceso no autorizado: Inicie sesión.");const a={...e};if(!this.auth.hasRole("SUPERADMIN")&&(t.clubId&&(a.clubId=t.clubId),a.teamId&&!this.auth.canAccessTeam(a.teamId)))throw new Error("Acceso denegado: No tiene permisos sobre este equipo.");return await this.gameRepo.getAll(a)}async getGameById(e){if(!e)throw new Error("Identificador de partido no especificado.");const t=await this.gameRepo.getById(e);if(!t)throw new Error("Partido no encontrado.");if(!this.auth.canAccessTeam(t.teamId))throw new Error("Acceso denegado: No tiene permisos para consultar este partido.");return t}async createGame(e={}){if(!this.auth.can("CREATE_GAME"))throw new Error("Permisos insuficientes para crear partidos.");if(e.teamId&&!this.auth.canAccessTeam(e.teamId))throw new Error("No puede crear partidos para un equipo no autorizado.");const t=this.auth.getCurrentUser(),a=new oa({...e,clubId:t.clubId||e.clubId,status:Tt.SCHEDULED,syncStatus:We.LOCAL_DRAFT,lastModifiedBy:t.id});return await this.gameRepo.save(a)}async recordGameEvent(e,t={}){if(!this.auth.can("RECORD_LIVE_GAME"))throw new Error("Permisos insuficientes para registrar estadísticas en vivo.");const a=await this.getGameById(e),s=this.auth.getCurrentUser(),i={id:`evt_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,timestamp:new Date().toISOString(),registeredBy:s.id,...t};a.addEvent(i),a.status=Tt.IN_PROGRESS;const n=Fe.processGameEvents(a.events,{periodMinutes:a.periodMinutes,overtimeMinutes:a.overtimeMinutes,starterIds:a.starterIds});return a.teamScore=n.teamScore,a.opponentScore=n.opponentScore,a.lastModifiedBy=s.id,await this.gameRepo.update(a.id,a),{game:a,computedState:n}}async undoGameEvent(e,t=null){if(!this.auth.can("EDIT_PLAY_BY_PLAY"))throw new Error("Permisos insuficientes para modificar el Play-by-Play.");const a=await this.getGameById(e);if(!a.events||a.events.length===0)throw new Error("No hay eventos registrados para deshacer.");t?a.removeEvent(t):(a.events.pop(),a.touchLocal());const s=Fe.processGameEvents(a.events,{periodMinutes:a.periodMinutes,overtimeMinutes:a.overtimeMinutes,starterIds:a.starterIds});return a.teamScore=s.teamScore,a.opponentScore=s.opponentScore,await this.gameRepo.update(a.id,a),{game:a,computedState:s}}async finalizeGame(e,t={}){const a=await this.getGameById(e),s=this.auth.getCurrentUser();t.playerMinutes&&(a.playerMinutes={...a.playerMinutes,...t.playerMinutes}),t.observations&&(a.observations=t.observations),t.notes&&(a.notes=t.notes),a.status=Tt.FINISHED,a.lastModifiedBy=s.id;const r=Fe.processGameEvents(a.events,{periodMinutes:a.periodMinutes,overtimeMinutes:a.overtimeMinutes,starterIds:a.starterIds});a.teamScore=r.teamScore,a.opponentScore=r.opponentScore;const i=r.playerStatsList.map(d=>new la({gameId:a.id,playerId:d.playerId,teamId:a.teamId,seasonId:a.seasonId,starter:d.starter,minutesSeconds:d.minutesSeconds,minutes:d.minutes,points:d.points,fg2Made:d.fg2Made,fg2Attempted:d.fg2Attempted,fg3Made:d.fg3Made,fg3Attempted:d.fg3Attempted,ftMade:d.ftMade,ftAttempted:d.ftAttempted,offReb:d.offReb,defReb:d.defReb,assists:d.assists,steals:d.steals,blocksMade:d.blocksMade,blocksReceived:d.blocksReceived,turnovers:d.turnovers,foulsCommitted:d.foulsCommitted,foulsDrawn:d.foulsDrawn,plusMinus:d.plusMinus,pir:d.pir,efficiency:d.efficiency,gameScore:d.gameScore}));let n=null;return this.auth.isAdmin()?(a.syncStatus=We.SYNCHRONIZED,a.serverUpdatedAt=new Date().toISOString(),await this.gameRepo.update(a.id,a),await this.gameRepo.savePlayerStatsBatch(i),this.syncEngine&&typeof this.syncEngine.pushGame=="function"&&await this.syncEngine.pushGame(a,i)):(a.syncStatus=We.PENDING_APPROVAL,await this.gameRepo.update(a.id,a),await this.gameRepo.savePlayerStatsBatch(i),n=await this.gameRepo.submitChangeRequest({gameId:a.id,proposedGame:a,requestedBy:s.id,userRole:s.role})),{game:a,computedState:r,changeRequest:n}}async resolveChangeRequest(e,t=!0){if(!this.auth.can("VALIDATE_CHANGE_REQUESTS"))throw new Error("Permisos insuficientes: Solo un Administrador puede validar cambios.");return this.syncEngine&&typeof this.syncEngine.resolveChangeRequest=="function"?await this.syncEngine.resolveChangeRequest(e,t):!0}}class Cr{constructor(e=null,t=null){this.translationRepo=e,this.syncEngine=t,this.currentPage=1,this.pageSize=20}t(e,t=""){return(j?j.t(e,t):se.t(e,t))||t}showSyncOverlay(e="⚡ Guardando idioma..."){let t=document.getElementById("sync-loading-overlay");t||(t=document.createElement("div"),t.id="sync-loading-overlay",t.style.cssText=`
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 9999; color: white; font-family: var(--font-family-base, system-ui);
      `,document.body.appendChild(t)),t.innerHTML=`
      <div style="width: 48px; height: 48px; border: 4px solid var(--color-primary, #f97316); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">${e}</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Actualizando diccionario en Supabase...</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `,t.style.display="flex"}hideSyncOverlay(){const e=document.getElementById("sync-loading-overlay");e&&(e.style.display="none")}_normalizeLang(e){if(!e)return"es";const t=String(e).trim().toLowerCase();return t==="cat"||t==="catalan"||t==="català"?"ca":t}render(e=se.getLocale?se.getLocale():"es",t=[]){const a=this._normalizeLang(e),s=j?j.getDictionary(a):{},r=["general","dashboard","team","players","games","boxscore","advanced_stats","lineups","comparator","reports","ask_ai","profile","settings","logout","language","local","visitor","pending","completed","opponent","score","score_result","in_favor","against","actions","season","record","active_players","team_info","roster","no_players_loaded","jersey","position","status","height","save_changes","read_only","view_boxscore","edit","search_player","all_positions","points","rebounds","assists","steals","turnovers","blocks","fouls","team_games","register_new_game","registered_games","back_to_players","back_to_register","boxscore_detail_subtitle","net_rating_evolution","pts_scored_vs_received","efg_evolution","turnovers_per_game","rebound_off_def","quarter_performance","pts_for","pts_against","reb_off","reb_def","last_games","date","rival","venue","diff","off_rating_tooltip","def_rating_tooltip","analysis","lineups_title","lineups_with","games_with_registered_lineup","see_names","see_numbers","min_games_short","note_label","sample_warning_note","advanced_subtitle","efg_desc","tov_desc","select_players","select_at_least_2","select_players_desc","reports_module","profile_role_label","profile_data_title","first_name","last_name","phone","email","login","role_disabled_label","save_profile","change_password_title","new_password","repeat_password","change_password_btn","assigned_teams_title","superadmin_access_msg","settings_subtitle","tab_clubs_teams","tab_roster","tab_users_roles","tab_seasons","tab_languages_translations","tab_role_simulation","create_new_club_title","club_name","coordinator_name","address","create_club_btn","create_new_team_title","assigned_club","team_name","category","competition","head_coach","main_color","create_full_team_btn","global_transfer_market","transfer_market_desc","open_market_btn","add_new_player_title","primary_position","add_to_roster_btn","active_roster_title","user_invite_title","full_name","assigned_role","temp_password","invite_user_btn","manage_users_roles_title","user","save_role","registered_seasons_title","new_season_name","add_season_btn","save_name","role_simulation_title","role_simulation_desc","simulate_superadmin","simulate_admin","simulate_coach","simulate_analyst","simulate_player","simulate_guest","disable_simulation_btn","registered_clubs_title","edit_club_btn","teams_title","currently_active","action","configure","activate","coach","edit_player_data","cancel","active","inactive"],i=r.length,n=Math.ceil(i/this.pageSize)||1;this.currentPage>n&&(this.currentPage=n),this.currentPage<1&&(this.currentPage=1);const d=(this.currentPage-1)*this.pageSize,c=d+this.pageSize,u=r.slice(d,c);let _="";return u.forEach(p=>{const m=Array.isArray(t)?t.find(g=>g.key===p):null,f=m?m.translation||m.value:s[p]||"";_+=`
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px; font-weight: 700; color: #1e3a8a; font-family: monospace; font-size: 13px;">
            <code>${p}</code>
          </td>
          <td style="padding: 12px;">
            <input 
              type="text" 
              data-key="${p}" 
              value="${f}" 
              placeholder="${this.t(p,p)}" 
              class="i18n-input" 
              style="width: 100%; height: 44px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 600; box-sizing: border-box;"
            />
          </td>
        </tr>
      `}),`
      <div class="language-settings-view" style="max-width: 1000px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">🌐 ${this.t("languages_mgmt_title","Administración de Idiomas")}</h2>
          <p style="font-size: 13px; color: #64748b; margin-top: 4px;">
            ${this.t("languages_mgmt_desc","Personaliza y guarda las traducciones directamente en la base de datos de Supabase.")}
          </p>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div class="lang-selector" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <label for="langCodeInput" style="font-weight: 700; font-size: 13px; color: #334155;">${this.t("select_lang_to_modify","Selección de Idioma a Modificar:")}</label>
              <select id="langCodeInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 13px; min-height: 44px; background: white;">
                <option value="es" ${a==="es"?"selected":""}>es (Español)</option>
                <option value="ca" ${a==="ca"?"selected":""}>ca (Català)</option>
                <option value="en" ${a==="en"?"selected":""}>en (English)</option>
                <option value="fr" ${a==="fr"?"selected":""}>fr (Français)</option>
              </select>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b;">
              <button type="button" id="btn-prev-lang-page" class="btn-outline-sm" ${this.currentPage<=1?'disabled style="opacity:0.5; cursor:not-allowed;"':""}>⬅️ ${this.t("previous","Anterior")}</button>
              <span style="font-weight: 800; color: #1e3a8a;">${this.t("page_indicator","Pág.")} ${this.currentPage} ${this.t("of","de")} ${n}</span>
              <button type="button" id="btn-next-lang-page" class="btn-outline-sm" ${this.currentPage>=n?'disabled style="opacity:0.5; cursor:not-allowed;"':""}>${this.t("next","Siguiente")} ➡️</button>
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="translations-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 12px; width: 35%;">${this.t("system_key_col","Clave de Sistema")}</th>
                  <th style="padding: 12px;">${this.t("custom_translation_col","Traducción Personalizada")}</th>
                </tr>
              </thead>
              <tbody>
                ${_}
              </tbody>
            </table>
          </div>

          <div class="actions" style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b;">
              <button type="button" id="btn-prev-lang-page-bottom" class="btn-outline-sm" ${this.currentPage<=1?'disabled style="opacity:0.5; cursor:not-allowed;"':""}>⬅️ ${this.t("previous","Anterior")}</button>
              <span>${this.t("showing","Mostrando")} ${d+1}-${Math.min(c,i)} ${this.t("of","de")} ${i} ${this.t("keys_unit","claves")}</span>
              <button type="button" id="btn-next-lang-page-bottom" class="btn-outline-sm" ${this.currentPage>=n?'disabled style="opacity:0.5; cursor:not-allowed;"':""}>${this.t("next","Siguiente")} ➡️</button>
            </div>

            <button 
              id="btnSaveLanguage" 
              class="btn-primary" 
              style="background: var(--color-primary, #f97316); color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; min-height: 44px;"
            >
              💾 ${this.t("save_translations_btn","Guardar Traducciones en Supabase")}
            </button>
          </div>
        </div>
      </div>
    `}async handleSave(e=null){var n;const t=(n=document.getElementById("langCodeInput"))==null?void 0:n.value,a=this._normalizeLang(e||t||(se.getLocale?se.getLocale():"es")),s=document.querySelectorAll(".i18n-input"),r=[],i={};if(s.forEach(d=>{const c=d.getAttribute("data-key"),u=d.value.trim();c&&u&&(i[c]=u,r.push({key:c,language_code:a,translation:u}))}),r.length===0){alert("⚠️ No hay campos de traducción para guardar.");return}this.showSyncOverlay(`💾 Guardando traducciones [${a.toUpperCase()}] en Supabase...`);try{if(D){const{error:d}=await D.from("translations").upsert(r,{onConflict:"key,language_code"});if(d){console.warn("Upsert directo falló, intentando por claves individuales:",d.message);for(const c of r)await D.from("translations").delete().eq("key",c.key).eq("language_code",c.language_code),await D.from("translations").insert([c])}}j&&(j.saveDictionary(a,i),await j.setLanguage(a)),se&&typeof se.notify=="function"&&se.notify(),this.hideSyncOverlay(),alert(`✅ ¡Traducciones guardadas con éxito para [${a.toUpperCase()}]!`)}catch(d){this.hideSyncOverlay(),console.error("Error al guardar traducciones:",d),alert(`❌ Error al conectar con Supabase: ${d.message}`)}}}const Ie=Object.freeze({HEAD_COACH:"HEAD_COACH",COORDINATOR:"COORDINATOR",ASSISTANT_COACH:"ASSISTANT_COACH",PHYSICAL_TRAINER:"PHYSICAL_TRAINER",TEAM_MANAGER:"TEAM_MANAGER",SPORTS_DIRECTOR:"SPORTS_DIRECTOR"});class Dr{constructor(e,t=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.contextStore=t||null}_normalizeSeasonName(e=""){const t=String(e||"").trim(),a=t.match(/^(\d{4})\s*[-\/]\s*(\d{4})$/);return a?a[1]+"/"+a[2]:t}async _resolveTeamSeason({teamId:e,seasonName:t}){var _,p;if(!e||!t)throw new Error("Equipo y temporada son obligatorios para resolver el staff.");const a=this._normalizeSeasonName(t),r=(((p=(_=this.contextStore)==null?void 0:_.getSeasons)==null?void 0:p.call(_,e))||[]).find(m=>this._normalizeSeasonName((m==null?void 0:m.name)||(m==null?void 0:m.code)||"")===a);if(r){const m=r.team_season_id||r.teamSeasonId||(r.source==="v3"?r.id:null);if(m)return{teamSeasonId:String(m),seasonName:a}}const{data:i,error:n}=await this.supabase.from("season_catalog").select("id,name,code");if(n)throw n;const d=(i||[]).find(m=>{const f=this._normalizeSeasonName(m.name||""),g=this._normalizeSeasonName(String(m.code||"").replaceAll("_","/"));return f===a||g===a});if(!d)throw new Error("No se ha encontrado la temporada global "+a+".");const{data:c,error:u}=await this.supabase.from("team_seasons").select("id,team_id,season_id,status").eq("team_id",e).eq("season_id",d.id).maybeSingle();if(u)throw u;if(!c)throw new Error("El equipo no está vinculado a la temporada seleccionada.");return{teamSeasonId:String(c.id),seasonName:this._normalizeSeasonName(d.name||a)}}async _findActiveAssignment(e,t){const{data:a,error:s}=await this.supabase.from("team_season_staff_assignments").select("id,team_season_id,staff_role,user_id,external_name,status").eq("team_season_id",e).eq("staff_role",String(t||"").toUpperCase()).eq("status","ACTIVE");if(s)throw s;return(a||[])[0]||null}async upsertAssignment({clubId:e=null,teamId:t=null,seasonName:a,role:s,staffName:r}){if(!this.supabase)throw new Error("Supabase no configurado.");const i=String(s||"").toUpperCase(),n=String(r||"").trim()||null;if(i===Ie.HEAD_COACH){const d=await this._resolveTeamSeason({teamId:t,seasonName:a}),c=await this._findActiveAssignment(d.teamSeasonId,Ie.HEAD_COACH);if(!n){if(c!=null&&c.id){const{error:p}=await this.supabase.rpc("iq_v3_remove_team_season_staff",{p_assignment_id:c.id});if(p)throw p}return{id:(c==null?void 0:c.id)||"head-coach:"+d.teamSeasonId,team_season_id:d.teamSeasonId,team_id:String(t),club_id:e,season_name:d.seasonName,staff_role:Ie.HEAD_COACH,staff_name:"",external_name:null,status:"INACTIVE",removed:!0}}const{data:u,error:_}=await this.supabase.rpc("iq_v3_assign_team_season_staff",{p_team_season_id:d.teamSeasonId,p_staff_role:Ie.HEAD_COACH,p_user_id:null,p_external_name:n});if(_)throw _;return{...u||{},id:(u==null?void 0:u.id)||(c==null?void 0:c.id)||"head-coach:"+d.teamSeasonId,team_season_id:d.teamSeasonId,team_id:String(t),club_id:e,season_name:d.seasonName,staff_role:Ie.HEAD_COACH,staff_name:n,external_name:n,status:(u==null?void 0:u.status)||"ACTIVE"}}if(i===Ie.COORDINATOR){if(!e)throw new Error("Club obligatorio para asignar coordinador.");const{data:d,error:c}=await this.supabase.from("clubs").update({coordinator_name:n}).eq("id",e).select("id,coordinator_name").single();if(c)throw c;return{id:`coordinator:${d.id}`,club_id:d.id,team_id:null,season_name:String(a||""),staff_role:Ie.COORDINATOR,staff_name:d.coordinator_name}}throw new Error("Esta función de staff requiere el modelo v3 por equipo-temporada y todavía no se guarda en producción.")}async removeAssignment({clubId:e=null,teamId:t=null,seasonName:a,role:s}){if(!this.supabase)throw new Error("Supabase no configurado.");const r=String(s||"").toUpperCase();if(r===Ie.HEAD_COACH){if(!t||!a)return!1;const i=await this._resolveTeamSeason({teamId:t,seasonName:a}),n=await this._findActiveAssignment(i.teamSeasonId,Ie.HEAD_COACH);if(!(n!=null&&n.id))return!0;const{error:d}=await this.supabase.rpc("iq_v3_remove_team_season_staff",{p_assignment_id:n.id});if(d)throw d;return!0}if(r===Ie.COORDINATOR){if(!e)return!1;const{error:i}=await this.supabase.from("clubs").update({coordinator_name:null}).eq("id",e);if(i)throw i;return!0}throw new Error("La eliminación de esta función se habilitará con memberships v3.")}}class Mr{constructor(e,t=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.contextStore=t}async getCapabilities(){if(!this.supabase)return{ready:!1,reason:"NO_DATABASE"};const{data:e,error:t}=await this.supabase.rpc("iq_v3_season_admin_capabilities");return t?{ready:!1,reason:"BACKEND_NOT_APPLIED"}:{ready:!!((e==null?void 0:e.ready)??(e==null?void 0:e.season_management_ready)??!1),...e||{}}}async _loadGlobalSeasonCatalog(){if(!this.supabase)return[];const{data:e,error:t}=await this.supabase.from("season_catalog").select("id,code,name,start_date,end_date,status,is_test").order("start_date",{ascending:!1});return t?(console.warn("[SeasonManagement] No se pudo leer season_catalog:",t.message),[]):e||[]}async loadOverview(){var i,n,d,c,u,_;if(!this.supabase)return{capabilities:{ready:!1,reason:"NO_DATABASE"},seasons:[],teamSeasons:[],teams:[],staffAssignments:[],legacySeasons:[],usersById:new Map};const e=await this.getCapabilities(),t=await this._loadGlobalSeasonCatalog();if((i=this.contextStore)!=null&&i.getAllTeamSeasonContexts){const p=await this.contextStore.getAllTeamSeasonContexts({status:"ACTIVE"});if(p.length>0){const m=new Map,f=[];p.forEach(v=>{const A=v.global_season_id||v.globalSeasonId,C=v.team_season_id||v.teamSeasonId,O=v.team_id||v.teamId;A&&!m.has(String(A))&&m.set(String(A),{id:A,code:v.code||v.name||"",name:v.name||v.code||"",start_date:v.start_date||null,end_date:v.end_date||null,status:v.status||"ACTIVE",is_test:!1}),C&&O&&A&&f.push({id:C,team_id:O,season_id:A,legacy_season_id:v.legacy_season_id||v.legacySeasonId||null,status:v.status||"ACTIVE",data_status:v.data_status||"ACTIVE"})});const g=(((d=(n=this.contextStore).getTeams)==null?void 0:d.call(n))||[]).map(v=>({id:v.id,club_id:v.club_id||v.clubId||null,name:v.name,category:v.category||"",competition:v.competition||""})),E=this.contextStore.legacySeasons||[];let T=[];try{const v=await this.supabase.from("team_season_staff_assignments").select("id,team_season_id,staff_role,user_id,external_name,status,created_at,updated_at").eq("status","ACTIVE");v.error||(T=v.data||[])}catch{T=[]}const x=[...new Set(T.map(v=>v.user_id).filter(Boolean).map(String))],S=new Map;if(x.length>0){const{data:v,error:A}=await this.supabase.from("user_profiles").select("id,email,first_name,last_name").in("id",x);A||(v||[]).forEach(C=>S.set(String(C.id),C))}const M=new Map(t.map(v=>[String(v.id),v]));return[...m.values()].forEach(v=>{M.has(String(v.id))||M.set(String(v.id),v)}),{capabilities:e,seasons:[...M.values()].sort((v,A)=>{const C=v.start_date?new Date(v.start_date).getTime():0;return(A.start_date?new Date(A.start_date).getTime():0)-C}),teamSeasons:f,teams:g,staffAssignments:T,legacySeasons:E,usersById:S}}}const[a,s]=await Promise.all([this.supabase.from("season_catalog").select("id,code,name,start_date,end_date,status,is_test").order("start_date",{ascending:!1}),this.supabase.from("team_seasons").select("id,team_id,season_id,legacy_season_id,status,data_status")]),r=[a.error,s.error].find(Boolean);if(r)throw r;return{capabilities:e,seasons:a.data||[],teamSeasons:s.data||[],teams:((u=(c=this.contextStore)==null?void 0:c.getTeams)==null?void 0:u.call(c))||[],staffAssignments:[],legacySeasons:((_=this.contextStore)==null?void 0:_.legacySeasons)||[],usersById:new Map}}async createGlobalSeason({code:e,name:t,startDate:a=null,endDate:s=null}){const{data:r,error:i}=await this.supabase.rpc("iq_v3_create_global_season",{p_code:e,p_name:t,p_start_date:a,p_end_date:s});if(i)throw i;return r}async updateGlobalSeason({seasonId:e,code:t,name:a,startDate:s=null,endDate:r=null,status:i="ACTIVE"}){const{data:n,error:d}=await this.supabase.rpc("iq_v3_update_global_season",{p_season_id:e,p_code:t,p_name:a,p_start_date:s,p_end_date:r,p_status:i});if(d)throw d;return n}async linkTeamSeason({teamId:e,seasonId:t}){const{data:a,error:s}=await this.supabase.rpc("iq_v3_link_team_season",{p_team_id:e,p_season_id:t});if(s)throw s;return a}async setTeamSeasonStatus({teamSeasonId:e,status:t}){const{data:a,error:s}=await this.supabase.rpc("iq_v3_set_team_season_status",{p_team_season_id:e,p_status:t});if(s)throw s;return a}async assignStaff({teamSeasonId:e,staffRole:t,userId:a=null,externalName:s=null}){const{data:r,error:i}=await this.supabase.rpc("iq_v3_assign_team_season_staff",{p_team_season_id:e,p_staff_role:t,p_user_id:a,p_external_name:s});if(i)throw i;return r}async removeStaff({assignmentId:e}){const{data:t,error:a}=await this.supabase.rpc("iq_v3_remove_team_season_staff",{p_assignment_id:e});if(a)throw a;return t}}function ve(o=""){return String(o??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function vt(o=""){const e=String(o||"").trim(),t=e.match(/^(\d{4})\s*[-\/]\s*(\d{4})$/);return t?`${t[1]}/${t[2]}`:e}function yt(o){return o?String(o).slice(0,10):""}const Vt=Object.freeze({HEAD_COACH:"Entrenador principal",ASSISTANT_COACH:"Ayudante",ANALYST:"Analista",PHYSICAL_TRAINER:"Preparador físico",TEAM_MANAGER:"Delegado / Team manager"});class $r{constructor(e,t=null,a=null){this.service=e,this.auth=t,this.freezeService=a,this.freezeCapabilities={ready:!1},this.freezeRequests=[],this.state=null}async load(){var a,s,r,i;const[e,t]=await Promise.all([this.service.loadOverview(),((s=(a=this.freezeService)==null?void 0:a.getCapabilities)==null?void 0:s.call(a))||Promise.resolve({ready:!1})]);if(this.state=e,this.freezeCapabilities=t||{ready:!1},this.freezeRequests=[],this.freezeCapabilities.ready&&((r=this.freezeService)!=null&&r.listRequests))try{const n=(((i=this.state)==null?void 0:i.teamSeasons)||[]).map(d=>d.id).filter(Boolean);this.freezeRequests=n.length?await this.freezeService.listRequests(n,{status:"PENDING"}):[]}catch(n){console.warn("[SeasonManagementView] No se pudieron cargar solicitudes de cierre:",(n==null?void 0:n.message)||n),this.freezeRequests=[]}return this.state}_hasPendingFreezeRequest(e){return this.freezeRequests.some(t=>String(t.team_season_id||t.teamSeasonId||"")===String(e||"")&&String(t.status||"").toUpperCase()==="PENDING")}_getActiveStaff(e){var t;return(((t=this.state)==null?void 0:t.staffAssignments)||[]).filter(a=>String(a.team_season_id)===String(e)&&String(a.status||"ACTIVE").toUpperCase()==="ACTIVE")}_staffDisplayName(e){var t,a;if(!e)return"";if(e.user_id){const s=(a=(t=this.state)==null?void 0:t.usersById)==null?void 0:a.get(String(e.user_id));if(s)return[s.first_name,s.last_name].filter(Boolean).join(" ").trim()||s.email||"Usuario"}return e.external_name||"Sin asignar"}_renderStaffGrid(e){const t=this._getActiveStaff(e.id);return Object.entries(Vt).map(([a,s])=>{const r=t.filter(n=>n.staff_role===a),i=r.map(n=>this._staffDisplayName(n)).filter(Boolean);return`
        <div style="padding:10px;background:#f8fafc;border-radius:8px;">
          <div style="font-size:10px;font-weight:800;color:#64748b;">${ve(s.toUpperCase())}</div>
          <div style="margin-top:4px;font-size:${a==="HEAD_COACH"?"13px":"12px"};font-weight:${a==="HEAD_COACH"?"800":"700"};color:#0f172a;">
            ${ve(i.join(", ")||"Sin asignar")}
          </div>
          ${r.some(n=>n.user_id)?'<div style="font-size:9px;color:#15803d;margin-top:3px;">Usuario vinculado a IQBasket</div>':r.length>0?'<div style="font-size:9px;color:#64748b;margin-top:3px;">Staff externo · sin acceso automático</div>':""}
        </div>
      `}).join("")}renderMarkup({activeTeamId:e=null,canManage:t=!1}={}){var c,u,_;const a=this.state||{capabilities:{ready:!1},seasons:[],teamSeasons:[],teams:[]},s=!!((c=a.capabilities)!=null&&c.ready),r=!!(t&&s),i=!!(t&&s&&((u=a.capabilities)!=null&&u.global_season_write)),n=!!((_=this.freezeCapabilities)!=null&&_.ready),d=new Map((a.teams||[]).map(p=>[String(p.id),p]));return`
      <div class="config-container season-management-v3">
        <div class="config-card" style="border:1px solid #bbf7d0;background:#f0fdf4;">
          <div class="card-title" style="margin-bottom:8px;color:#166534;"><span>✅</span> TEMPORADAS V3 ACTIVAS</div>
          <div style="font-size:12px;color:#334155;line-height:1.55;">
            Una temporada se crea una sola vez y se vincula a los equipos que participan en ella.
            Entrenadores y resto del staff se asignan específicamente a <strong>Equipo + Temporada</strong>.
          </div>
          <div style="margin-top:10px;font-size:11px;font-weight:800;color:${s?"#15803d":"#b45309"};">
            ${s?"✅ Backend seguro disponible · escrituras mediante RPC.":"🟡 Modo lectura · backend de gestión no disponible."}
          </div>
        </div>

        <div class="config-card">
          <div class="card-title"><span>📅</span> TEMPORADAS GLOBALES (${a.seasons.length})</div>

          ${a.seasons.length>0?a.seasons.map(p=>{const m=a.teamSeasons.filter(E=>String(E.season_id)===String(p.id)),f=new Set(m.map(E=>String(E.team_id))),g=(a.teams||[]).filter(E=>!f.has(String(E.id)));return`
              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:12px;background:#fff;">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                  <div>
                    <div style="font-size:16px;font-weight:900;color:#0f172a;">${ve(vt(p.name))}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:3px;">
                      Código: ${ve(p.code)}
                      ${p.start_date||p.end_date?` · ${ve(yt(p.start_date)||"—")} → ${ve(yt(p.end_date)||"—")}`:""}
                      · ${m.length} equipo(s)
                    </div>
                  </div>

                  <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">
                    <span class="${String(p.status).toUpperCase()==="ACTIVE"?"badge-active-team":"badge-inactive"}">
                      ${ve(p.status||"ACTIVE")}
                    </span>
                    ${i?`
                      <button type="button"
                        class="btn-outline-sm season-v3-action"
                        data-action="edit-season"
                        data-season-id="${p.id}">
                        ✏️ Editar
                      </button>
                    `:""}
                  </div>
                </div>

                <div style="margin-top:12px;">
                  <div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:6px;">EQUIPOS VINCULADOS</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${m.length?m.map(E=>{const T=d.get(String(E.team_id));return`<span class="badge-category">${ve((T==null?void 0:T.name)||"Equipo")}</span>`}).join(""):'<span style="font-size:11px;color:#94a3b8;">Todavía sin equipos vinculados</span>'}
                  </div>
                </div>

                ${i&&g.length>0?`
                  <div style="margin-top:12px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
                    <div class="form-group" style="min-width:220px;flex:1;">
                      <label>Vincular otro equipo</label>
                      <select class="season-link-team-select" data-season-id="${p.id}">
                        <option value="">Selecciona equipo…</option>
                        ${g.map(E=>`
                          <option value="${E.id}">${ve(E.name)}</option>
                        `).join("")}
                      </select>
                    </div>
                    <button type="button"
                      class="btn-secondary-sm season-v3-action"
                      data-action="link-team"
                      data-season-id="${p.id}">
                      + Vincular
                    </button>
                  </div>
                `:""}
              </div>
            `}).join(""):'<p style="font-size:12px;color:#64748b;">No hay temporadas globales registradas.</p>'}

          ${t?`
            <div style="margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px;">
              <button type="button"
                class="btn-primary season-v3-action"
                data-action="create-season"
                ${i?"":"disabled"}
                style="${i?"":"opacity:.5;cursor:not-allowed;"}">
                + Nueva temporada global
              </button>
              ${t&&!i?'<div style="font-size:10px;color:#64748b;margin-top:6px;">La creación y edición del catálogo global está reservada al SUPERADMIN.</div>':""}
            </div>
          `:""}
        </div>

        <div class="config-card">
          <div class="card-title"><span>🏀</span> EQUIPOS POR TEMPORADA</div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${a.teamSeasons.length>0?a.teamSeasons.map(p=>{var A,C,O,L,y,F,k,W;const m=d.get(String(p.team_id))||{},f=a.seasons.find(G=>String(G.id)===String(p.season_id))||{},g=String(p.team_id)===String(e||""),E=String(p.status||"ACTIVE").toUpperCase()==="ACTIVE",T=!!((C=(A=this.freezeService)==null?void 0:A.isFrozen)!=null&&C.call(A,p)),x=this._hasPendingFreezeRequest(p.id),S=!!(n&&((L=(O=this.freezeService)==null?void 0:O.canFreeze)!=null&&L.call(O,p))),M=!!(n&&((F=(y=this.freezeService)==null?void 0:y.canReopen)!=null&&F.call(y,p))),v=!!(n&&!x&&((W=(k=this.freezeService)==null?void 0:k.canRequestFreeze)!=null&&W.call(k,p)));return`
                <div style="border:1px solid ${g?"#93c5fd":"#e2e8f0"};border-radius:12px;padding:14px;background:${g?"#eff6ff":"#fff"};">
                  <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
                    <div>
                      <div style="font-size:14px;font-weight:900;color:#0f172a;">${ve(m.name||"Equipo")}</div>
                      <div style="font-size:11px;color:#64748b;margin-top:2px;">
                        ${ve(vt(f.name||""))}
                        ${m.category?` · ${ve(m.category)}`:""}
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                      <span class="${E?"badge-active-team":"badge-inactive"}">
                        ${ve(p.status||"ACTIVE")}
                      </span>
                      <span style="padding:3px 8px;border-radius:6px;font-size:11px;font-weight:900;background:${T?"#fee2e2":"#dcfce7"};color:${T?"#991b1b":"#166534"};">
                        ${T?"🔒 Datos cerrados":"🟢 Datos abiertos"}
                      </span>
                      ${x?'<span class="badge-pending">⏳ Cierre solicitado</span>':""}
                    </div>
                  </div>

                  <div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:${T?"#fff1f2":"#f8fafc"};border:1px solid ${T?"#fecdd3":"#e2e8f0"};">
                    <div style="font-size:11px;font-weight:900;color:${T?"#9f1239":"#334155"};">
                      ${T?"Temporada cerrada para edición competitiva":"Integridad de temporada"}
                    </div>
                    <div style="margin-top:3px;font-size:10px;line-height:1.5;color:#64748b;">
                      ${T?"Partidos y plantilla quedan en modo histórico de solo lectura. Para corregir datos es obligatorio reabrir la temporada.":"El cierre congela partidos y plantilla sin ocultar estadísticas, informes ni histórico."}
                    </div>
                    ${n?`
                      ${S||M||v?`
                        <label style="display:grid;gap:4px;margin-top:9px;font-size:10px;font-weight:800;color:#475569;">
                          Motivo / nota de auditoría
                          <input type="text"
                            class="season-freeze-reason"
                            data-team-season-id="${p.id}"
                            maxlength="240"
                            placeholder="${T?"Ej.: Corrección autorizada de datos":"Ej.: Temporada finalizada"}"
                            style="width:100%;min-height:44px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font:inherit;">
                        </label>
                      `:""}
                      <div style="margin-top:9px;display:flex;gap:8px;flex-wrap:wrap;">
                        ${S?`
                          <button type="button"
                            class="btn-danger-sm season-v3-action"
                            data-action="freeze-scope-data"
                            data-team-season-id="${p.id}"
                            style="min-height:44px;font-weight:900;">
                            🔒 Cerrar temporada
                          </button>
                        `:""}
                        ${M?`
                          <button type="button"
                            class="btn-secondary-sm season-v3-action"
                            data-action="reopen-scope-data"
                            data-team-season-id="${p.id}"
                            style="min-height:44px;font-weight:900;">
                            🔓 Reabrir temporada
                          </button>
                        `:""}
                        ${v?`
                          <button type="button"
                            class="btn-outline-sm season-v3-action"
                            data-action="request-freeze-scope-data"
                            data-team-season-id="${p.id}"
                            style="min-height:44px;font-weight:900;">
                            📩 Solicitar cierre
                          </button>
                        `:""}
                      </div>
                    `:'<div style="margin-top:6px;font-size:10px;color:#b45309;">Lifecycle V6 no disponible · modo lectura.</div>'}
                  </div>

                  <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;">
                    ${this._renderStaffGrid(p)}
                  </div>

                  ${t?`
                    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                      <button type="button"
                        class="btn-secondary-sm season-v3-action"
                        data-action="manage-staff"
                        data-team-season-id="${p.id}"
                        ${r?"":"disabled"}
                        style="${r?"":"opacity:.5;cursor:not-allowed;"}">
                        👥 Gestionar staff
                      </button>

                      <button type="button"
                        class="btn-outline-sm season-v3-action"
                        data-action="set-scope-status"
                        data-team-season-id="${p.id}"
                        data-status="${E?"ARCHIVED":"ACTIVE"}"
                        ${r?"":"disabled"}
                        style="${r?"":"opacity:.5;cursor:not-allowed;"}">
                        ${E?"📦 Archivar vínculo":"↩️ Reactivar vínculo"}
                      </button>
                    </div>
                  `:""}
                </div>
              `}).join(""):'<p style="font-size:12px;color:#64748b;">No hay equipos vinculados a temporadas globales.</p>'}
          </div>
        </div>

        <div class="config-card" style="border:1px solid #e2e8f0;background:#f8fafc;">
          <div class="card-title"><span>🛡️</span> COMPATIBILIDAD Y SEGURIDAD</div>
          <p style="font-size:12px;color:#475569;line-height:1.55;margin:0;">
            IQBasket conserva temporalmente las columnas legacy como respaldo, pero esta pantalla utiliza
            <strong>season_catalog</strong>, <strong>team_seasons</strong> y <strong>team_season_staff_assignments</strong>
            como modelo operativo. No se eliminan históricos desde esta interfaz.
          </p>
        </div>

        <div id="season-v3-modal" class="season-v3-modal" style="display:none;">
          <div class="season-v3-modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div id="season-v3-modal-title" style="font-size:16px;font-weight:900;color:#0f172a;">Temporada</div>
              <button type="button" class="btn-outline-sm" data-action="close-season-modal">✕</button>
            </div>
            <form id="season-v3-form" style="margin-top:14px;">
              <input type="hidden" id="season-v3-id">
              <div class="grid-2-cols">
                <div class="form-group">
                  <label>Código</label>
                  <input id="season-v3-code" required placeholder="2026-2027">
                </div>
                <div class="form-group">
                  <label>Nombre visible</label>
                  <input id="season-v3-name" required placeholder="2026/2027">
                </div>
                <div class="form-group">
                  <label>Inicio</label>
                  <input id="season-v3-start" type="date">
                </div>
                <div class="form-group">
                  <label>Fin</label>
                  <input id="season-v3-end" type="date">
                </div>
                <div class="form-group">
                  <label>Estado</label>
                  <select id="season-v3-status">
                    <option value="ACTIVE">Activa</option>
                    <option value="INACTIVE">Inactiva</option>
                    <option value="ARCHIVED">Archivada</option>
                  </select>
                </div>
              </div>
              <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
                <button type="button" class="btn-outline-sm" data-action="close-season-modal">Cancelar</button>
                <button type="submit" class="btn-primary">Guardar temporada</button>
              </div>
            </form>
          </div>
        </div>

        <div id="staff-v3-modal" class="season-v3-modal" style="display:none;">
          <div class="season-v3-modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div>
                <div style="font-size:16px;font-weight:900;color:#0f172a;">Gestionar staff</div>
                <div id="staff-v3-context-label" style="font-size:11px;color:#64748b;margin-top:2px;"></div>
              </div>
              <button type="button" class="btn-outline-sm" data-action="close-staff-modal">✕</button>
            </div>

            <div id="staff-v3-current" style="margin-top:14px;"></div>

            <form id="staff-v3-form" style="margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px;">
              <input type="hidden" id="staff-v3-team-season-id">
              <div class="grid-2-cols">
                <div class="form-group">
                  <label>Función</label>
                  <select id="staff-v3-role" required>
                    ${Object.entries(Vt).map(([p,m])=>`
                      <option value="${p}">${ve(m)}</option>
                    `).join("")}
                  </select>
                </div>
                <div class="form-group">
                  <label>Nombre</label>
                  <input id="staff-v3-name" required placeholder="Nombre y apellidos">
                </div>
              </div>
              <p style="font-size:10px;color:#64748b;margin:8px 0 0;">
                Este formulario registra staff externo. Si posteriormente se vincula una cuenta de usuario,
                el acceso se gestionará mediante su membresía contextual.
              </p>
              <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
                <button type="button" class="btn-outline-sm" data-action="close-staff-modal">Cancelar</button>
                <button type="submit" class="btn-primary">Asignar</button>
              </div>
            </form>
          </div>
        </div>

        <style>
          .season-v3-modal {
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100dvh;
            box-sizing: border-box;
            z-index: 10020;
            background: rgba(15, 23, 42, .52);
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding:
              max(10px, env(safe-area-inset-top))
              max(10px, env(safe-area-inset-right))
              max(12px, env(safe-area-inset-bottom))
              max(10px, env(safe-area-inset-left));
          }
          .season-v3-modal-card {
            width: min(680px, 100%);
            max-height: calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            box-sizing: border-box;
            background: white;
            border-radius: 14px;
            padding: 18px;
            margin: auto;
            box-shadow: 0 18px 60px rgba(15, 23, 42, .24);
          }
          @media (max-width: 640px) {
            .season-v3-modal-card {
              width: 100%;
              margin: 0;
              padding: 14px;
              border-radius: 12px;
              max-height: calc(100dvh - 20px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
            }
          }
          .season-v3-staff-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 9px 0;
            border-bottom: 1px solid #e2e8f0;
          }
        </style>
      </div>
    `}_openSeasonModal(e,t=null){const a=e.querySelector("#season-v3-modal");a&&(e.querySelector("#season-v3-modal-title").textContent=t?"Editar temporada global":"Nueva temporada global",e.querySelector("#season-v3-id").value=(t==null?void 0:t.id)||"",e.querySelector("#season-v3-code").value=(t==null?void 0:t.code)||"",e.querySelector("#season-v3-name").value=vt((t==null?void 0:t.name)||""),e.querySelector("#season-v3-start").value=yt(t==null?void 0:t.start_date),e.querySelector("#season-v3-end").value=yt(t==null?void 0:t.end_date),e.querySelector("#season-v3-status").value=(t==null?void 0:t.status)||"ACTIVE",a.style.display="flex")}_openStaffModal(e,t){var c,u,_;const a=e.querySelector("#staff-v3-modal");if(!a)return;const s=(((c=this.state)==null?void 0:c.teamSeasons)||[]).find(p=>String(p.id)===String(t)),r=(((u=this.state)==null?void 0:u.teams)||[]).find(p=>String(p.id)===String(s==null?void 0:s.team_id)),i=(((_=this.state)==null?void 0:_.seasons)||[]).find(p=>String(p.id)===String(s==null?void 0:s.season_id));e.querySelector("#staff-v3-team-season-id").value=t,e.querySelector("#staff-v3-context-label").textContent=`${(r==null?void 0:r.name)||"Equipo"} · ${vt((i==null?void 0:i.name)||"")}`;const n=this._getActiveStaff(t),d=e.querySelector("#staff-v3-current");d.innerHTML=n.length?n.map(p=>`
          <div class="season-v3-staff-row">
            <div>
              <div style="font-size:11px;font-weight:800;color:#64748b;">
                ${ve(Vt[p.staff_role]||p.staff_role)}
              </div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:2px;">
                ${ve(this._staffDisplayName(p))}
              </div>
            </div>
            <button type="button"
              class="btn-danger-sm season-v3-remove-staff"
              data-assignment-id="${p.id}">
              Quitar
            </button>
          </div>
        `).join(""):'<div style="font-size:12px;color:#64748b;">No hay staff asignado todavía.</div>',a.style.display="flex"}bindEvents(e,{onBackendUnavailable:t=null,onChanged:a=null,onError:s=null}={}){var d,c,u,_;const r=p=>{console.error("[SeasonManagementView]",p),s?s(p):alert(`❌ ${(p==null?void 0:p.message)||p}`)},i=async()=>{await this.load(),a&&await a()};e.querySelectorAll(".season-v3-action[disabled]").forEach(p=>{p.addEventListener("click",()=>t==null?void 0:t())}),(d=e.querySelector('[data-action="create-season"]:not([disabled])'))==null||d.addEventListener("click",()=>{this._openSeasonModal(e)}),e.querySelectorAll('[data-action="edit-season"]').forEach(p=>{p.addEventListener("click",()=>{var f;const m=(((f=this.state)==null?void 0:f.seasons)||[]).find(g=>String(g.id)===String(p.dataset.seasonId));m&&this._openSeasonModal(e,m)})}),e.querySelectorAll('[data-action="close-season-modal"]').forEach(p=>{p.addEventListener("click",()=>{const m=e.querySelector("#season-v3-modal");m&&(m.style.display="none")})}),(c=e.querySelector("#season-v3-form"))==null||c.addEventListener("submit",async p=>{p.preventDefault();const m=e.querySelector("#season-v3-id").value,f={code:e.querySelector("#season-v3-code").value.trim(),name:e.querySelector("#season-v3-name").value.trim(),startDate:e.querySelector("#season-v3-start").value||null,endDate:e.querySelector("#season-v3-end").value||null,status:e.querySelector("#season-v3-status").value};try{m?await this.service.updateGlobalSeason({seasonId:m,...f}):await this.service.createGlobalSeason(f),await i()}catch(g){r(g)}}),e.querySelectorAll('[data-action="link-team"]').forEach(p=>{p.addEventListener("click",async()=>{const m=p.dataset.seasonId,f=e.querySelector(`.season-link-team-select[data-season-id="${m}"]`),g=f==null?void 0:f.value;if(!g){alert("Selecciona primero un equipo.");return}try{await this.service.linkTeamSeason({teamId:g,seasonId:m}),await i()}catch(E){r(E)}})});const n=p=>{var m;return String(((m=e.querySelector(`.season-freeze-reason[data-team-season-id="${p}"]`))==null?void 0:m.value)||"").trim()||null};e.querySelectorAll('[data-action="request-freeze-scope-data"]').forEach(p=>{p.addEventListener("click",async()=>{const m=p.dataset.teamSeasonId,f=n(m);try{await this.freezeService.requestFreeze(m,f),await i()}catch(g){r(g)}})}),e.querySelectorAll('[data-action="freeze-scope-data"]').forEach(p=>{p.addEventListener("click",async()=>{const m=p.dataset.teamSeasonId;if(confirm("¿Cerrar esta temporada? Se bloquearán sus partidos abiertos y la plantilla quedará en modo histórico de solo lectura."))try{await this.freezeService.setFrozen(m,!0,n(m)||"Cierre de temporada"),await i()}catch(f){r(f)}})}),e.querySelectorAll('[data-action="reopen-scope-data"]').forEach(p=>{p.addEventListener("click",async()=>{const m=p.dataset.teamSeasonId;if(confirm("¿Reabrir esta temporada para corregir datos? Sólo se reabrirán los partidos que fueron bloqueados por su cierre de temporada."))try{await this.freezeService.setFrozen(m,!1,n(m)||"Corrección autorizada"),await i()}catch(f){r(f)}})}),e.querySelectorAll('[data-action="set-scope-status"]:not([disabled])').forEach(p=>{p.addEventListener("click",async()=>{const m=p.dataset.teamSeasonId,f=p.dataset.status;if(confirm(`¿Seguro que quieres ${f==="ARCHIVED"?"archivar":"reactivar"} este vínculo equipo-temporada?`))try{await this.service.setTeamSeasonStatus({teamSeasonId:m,status:f}),await i()}catch(E){r(E)}})}),e.querySelectorAll('[data-action="manage-staff"]:not([disabled])').forEach(p=>{p.addEventListener("click",()=>{this._openStaffModal(e,p.dataset.teamSeasonId)})}),e.querySelectorAll('[data-action="close-staff-modal"]').forEach(p=>{p.addEventListener("click",()=>{const m=e.querySelector("#staff-v3-modal");m&&(m.style.display="none")})}),(u=e.querySelector("#staff-v3-form"))==null||u.addEventListener("submit",async p=>{p.preventDefault();const m=e.querySelector("#staff-v3-team-season-id").value,f=e.querySelector("#staff-v3-role").value,g=e.querySelector("#staff-v3-name").value.trim();if(g)try{await this.service.assignStaff({teamSeasonId:m,staffRole:f,externalName:g}),await i()}catch(E){r(E)}}),(_=e.querySelector("#staff-v3-current"))==null||_.addEventListener("click",async p=>{const m=p.target.closest(".season-v3-remove-staff");if(m&&confirm("¿Quitar esta asignación de staff de la temporada?"))try{await this.service.removeStaff({assignmentId:m.dataset.assignmentId}),await i()}catch(f){r(f)}})}}function Ae(o=null){if(!o)return null;const e=String(o);return e.length>=10?e.slice(0,10):e}function Qt(){const o=new Date;return[o.getFullYear(),String(o.getMonth()+1).padStart(2,"0"),String(o.getDate()).padStart(2,"0")].join("-")}function qr(o=null){const e=Qt(),t=Ae((o==null?void 0:o.start_date)||(o==null?void 0:o.startDate)),a=Ae((o==null?void 0:o.end_date)||(o==null?void 0:o.endDate));return t&&e<t?t:a&&e>a?a:e}class Vr{constructor(e,t){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e,this.dataStore=t}async getCapabilities(){if(!this.supabase)return{ready:!1,reason:"NO_DATABASE"};const{data:e,error:t}=await this.supabase.rpc("iq_v3_roster_admin_capabilities");return t?{ready:!1,reason:"BACKEND_NOT_APPLIED"}:{ready:!!(e!=null&&e.ready),...e||{}}}_isDateInsideStint(e,t){const a=Ae(t)||Qt(),s=Ae(e==null?void 0:e.valid_from),r=Ae(e==null?void 0:e.valid_until);return s?s<=a&&(!r||r>=a):!1}_applyMembership(e,t=null,a=[],s=!1,r=null){const i=Ae(r)||Qt(),n=a.filter(c=>this._isDateInsideStint(c,i)).sort((c,u)=>String(u.valid_from||"").localeCompare(String(c.valid_from||"")))[0]||null,d=a.length>0?!!n:["ACTIVE","ACTIVO"].includes(String((t==null?void 0:t.status)||"").toUpperCase());return{...e,rosterMembershipId:(t==null?void 0:t.id)||null,rosterStatus:(t==null?void 0:t.status)||(s?"INHERITED":null),rosterInherited:s,rosterActiveNow:d,rosterReferenceDate:i,rosterStints:a,rosterCurrentFrom:Ae(n==null?void 0:n.valid_from),rosterCurrentUntil:Ae(n==null?void 0:n.valid_until),rosterFirstFrom:a.length?[...a].map(c=>Ae(c.valid_from)).filter(Boolean).sort()[0]||null:Ae(t==null?void 0:t.joined_at),rosterLastUntil:a.length?[...a].map(c=>Ae(c.valid_until)).filter(Boolean).sort().at(-1)||null:Ae(t==null?void 0:t.left_at),jersey:(t==null?void 0:t.jersey)??e.jersey??e.number??null,number:(t==null?void 0:t.jersey)??e.number??e.jersey??null,primary_position:(t==null?void 0:t.primary_position)||e.primary_position||e.position||"Jugador",position:(t==null?void 0:t.primary_position)||e.position||e.primary_position||"Jugador"}}async loadForTeam(e){var C,O,L,y,F,k,W,G;const t=((O=(C=this.dataStore)==null?void 0:C.getActiveSeasonContext)==null?void 0:O.call(C,e))||null,a=(t==null?void 0:t.team_season_id)||(t==null?void 0:t.teamSeasonId)||null,s=qr(t),r=await this.getCapabilities(),i=((y=(L=this.dataStore)==null?void 0:L.getTeamPlayers)==null?void 0:y.call(L,e))||((k=(F=this.dataStore)==null?void 0:F.getPlayers)==null?void 0:k.call(F,e))||[];if(!a||!this.supabase||!r.ready)return{capabilities:r,context:t,teamSeasonId:a,referenceDate:s,persisted:!1,memberships:[],stints:[],activePlayers:i.map(w=>this._applyMembership(w,null,[],!0,s)),seasonParticipants:i.map(w=>this._applyMembership(w,null,[],!0,s)),historicalPlayers:[],availablePlayers:[]};const{data:n,error:d}=await this.supabase.from("roster_memberships").select("id,player_id,team_season_id,jersey,primary_position,secondary_positions,status,joined_at,left_at").eq("team_season_id",a);if(d)throw d;const c=n||[];if(c.length===0)return{capabilities:r,context:t,teamSeasonId:a,referenceDate:s,persisted:!1,memberships:c,stints:[],activePlayers:i.map(w=>this._applyMembership(w,null,[],!0,s)),seasonParticipants:i.map(w=>this._applyMembership(w,null,[],!0,s)),historicalPlayers:[],availablePlayers:[]};const u=c.map(w=>w.id).filter(Boolean);let _=[];if(u.length>0){const{data:w,error:H}=await this.supabase.from("roster_membership_stints").select("id,roster_membership_id,valid_from,valid_until,source,notes").in("roster_membership_id",u);if(H)throw H;_=w||[]}const p=c.map(w=>w.player_id).filter(Boolean),m=new Map((((G=(W=this.dataStore)==null?void 0:W.getPlayerDirectory)==null?void 0:G.call(W))||i).map(w=>[String(w.id),w])),f=p.filter(w=>!m.has(String(w)));if(f.length>0){const{data:w,error:H}=await this.supabase.from("players").select("*").in("id",f);H||(w||[]).forEach(K=>m.set(String(K.id),K))}const g=new Map;_.forEach(w=>{const H=String(w.roster_membership_id);g.has(H)||g.set(H,[]),g.get(H).push(w)});const E=new Map(c.map(w=>[String(w.player_id),w])),T=[];c.forEach(w=>{const H=m.get(String(w.player_id));if(!H)return;const K=g.get(String(w.id))||[];T.push(this._applyMembership(H,w,K,!1,s))});const x=T.filter(w=>w.rosterActiveNow),S=T.filter(w=>w.rosterActiveNow?!1:(w.rosterStints||[]).length>0||!!w.rosterFirstFrom||!!w.rosterLastUntil),M=new Set(S.map(w=>String(w.id))),v=new Set(T.map(w=>String(w.id))),A=[...T.filter(w=>!w.rosterActiveNow&&!M.has(String(w.id))),...i.filter(w=>!v.has(String(w.id))).map(w=>this._applyMembership(w,null,[],!1,s))];return{capabilities:r,context:t,teamSeasonId:a,referenceDate:s,persisted:!0,memberships:c,stints:_,membershipByPlayer:E,activePlayers:x,seasonParticipants:T,historicalPlayers:S,availablePlayers:A}}async resolveTeamSeason(e,t){if(!e||!t||!this.supabase)return null;const{data:a,error:s}=await this.supabase.from("team_seasons").select("id,team_id,season_id,status").eq("team_id",e).eq("season_id",t).limit(1);if(s)throw s;return(a||[])[0]||null}async transferPlayer({playerId:e,fromTeamSeasonId:t,toTeamSeasonId:a,lastDateFrom:s,firstDateTo:r,newJersey:i=null,newPrimaryPosition:n=null}){const d=Ae(s),c=Ae(r);if(!d||!c)throw new Error("Las fechas de salida y alta del traspaso son obligatorias.");if(c<=d)throw new Error("La fecha de alta en destino debe ser posterior al último día en origen.");const{data:u,error:_}=await this.supabase.rpc("iq_v3_transfer_player",{p_player_id:e,p_from_team_season_id:t,p_to_team_season_id:a,p_last_date_from:d,p_first_date_to:c,p_new_jersey:i,p_new_primary_position:n});if(_)throw _;return u}async createPlayer({teamSeasonId:e,firstName:t,lastName:a,jersey:s,primaryPosition:r,effectiveDate:i=null}){const{data:n,error:d}=await this.supabase.rpc("iq_v3_create_player_for_roster",{p_team_season_id:e,p_first_name:t,p_last_name:a,p_jersey:s,p_primary_position:r,p_effective_date:i});if(d)throw d;return n}async setMember({teamSeasonId:e,playerId:t,status:a="ACTIVE",jersey:s=null,primaryPosition:r=null,effectiveDate:i=null}){const{data:n,error:d}=await this.supabase.rpc("iq_v3_set_roster_member",{p_team_season_id:e,p_player_id:t,p_status:a,p_jersey:s,p_primary_position:r,p_effective_date:i});if(d)throw d;return n}async removePlayer({teamSeasonId:e,playerId:t,lastEligibleDate:a=null}){if(!this.supabase)throw new Error("No hay conexión disponible con la base de datos.");const{data:s,error:r}=await this.supabase.rpc("iq_v3_remove_roster_member",{p_team_season_id:e,p_player_id:t,p_last_eligible_date:Ae(a)});if(r)throw r;return s}async reactivatePlayer({teamSeasonId:e,playerId:t,jersey:a=null,primaryPosition:s=null,firstEligibleDate:r=null}){return this.setMember({teamSeasonId:e,playerId:t,status:"ACTIVE",jersey:a,primaryPosition:s,effectiveDate:r})}}function _e(o=""){const e=String(o||"").trim(),t=e.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!t)return null;const a=Number(t[1]),s=Number(t[2]),r=Number(t[3]),i=new Date(a,s-1,r);return i.getFullYear()===a&&i.getMonth()===s-1&&i.getDate()===r?e:null}function kt(){const o=new Date;return[o.getFullYear(),String(o.getMonth()+1).padStart(2,"0"),String(o.getDate()).padStart(2,"0")].join("-")}function Ft(o,e){const t=_e(o);if(!t)return null;const[a,s,r]=t.split("-").map(Number),i=new Date(a,s-1,r);return i.setDate(i.getDate()+Number(e||0)),[i.getFullYear(),String(i.getMonth()+1).padStart(2,"0"),String(i.getDate()).padStart(2,"0")].join("-")}function Ss(o=null){return{start:_e((o==null?void 0:o.start_date)||(o==null?void 0:o.startDate)||""),end:_e((o==null?void 0:o.end_date)||(o==null?void 0:o.endDate)||"")}}function Be(o,e=null){const t=_e(o);if(!t)return!1;const{start:a,end:s}=Ss(e);return(!a||t>=a)&&(!s||t<=s)}function ns(...o){const e=o.map(_e).filter(Boolean).sort();return e.length?e.at(-1):null}function kr(o={}){const e=Array.isArray(o.rosterStints)?o.rosterStints:[];if(e.length>0)return[...e].sort((s,r)=>String(s.valid_from||"").localeCompare(String(r.valid_from||""))).map(s=>{const r=_e(s.valid_from)||"?",i=_e(s.valid_until)||"abierto";return`${r} → ${i}`}).join(" · ");const t=_e(o.rosterFirstFrom),a=_e(o.rosterLastUntil);return t?`${t} → ${a||"abierto"}`:"Sin intervalo histórico"}class Fr{constructor(e=null){var s,r,i;this.auth=e,this.currentUserRole=((r=(s=this.auth)==null?void 0:s.getAuthenticatedRole)==null?void 0:r.call(s))||R.INVITADO,this.simulatedRole=((i=this.auth)==null?void 0:i.previewRole)||null;const t=this.getEffectiveRole();this.activeTab=[R.JUGADOR,R.FAMILIA_TUTOR,R.VISOR,R.INVITADO].includes(t)?"requests":[R.ENTRENADOR,R.ANALISTA,R.PREPARADOR_FISICO].includes(t)?"players":"club",this.clubSubView="list",this.selectedTeamForEdit=null,this.selectedClubForEdit=null,this.selectedUserForProfileCard=null,this.languageSettingsView=new Cr,this.marketSearchQuery="",this.marketCurrentPage=1,this.marketItemsPerPage=10,this.allMarketPlayers=[],this.isMarketLoaded=!1,this.marketTransferStartDate="",this.selectedLangForEdit=localStorage.getItem("iq_lang")||"es",this.availableLangs=[{code:"es",label:"Español (ES)"},{code:"ca",label:"Català (CAT)"},{code:"en",label:"English (EN)"},{code:"fr",label:"Français (FR)"}],this.dbTranslations=[],this.seasonsList=[],this.joinRequests=[],this.teamDirectory=[],this.accessRequestService=new vs(D),this.staffAssignmentService=new Dr(D,b),this.seasonManagementService=new Mr(D,b),this.seasonFreezeService=new ke(D,this.auth),this.seasonManagementView=new $r(this.seasonManagementService,this.auth,this.seasonFreezeService),this.rosterManagementService=new Vr(D,b),this.rosterState=null,this.transferRequestService=new ys(D),this.transferRequestCapabilities={ready:!1},this.transfers=[];const a=localStorage.getItem("iq_user_teams_map");this.userTeamAssignments=a?JSON.parse(a):{},this.profilesList=[]}t(e,t=""){const a=j?j.t(e,""):se.t(e);return!a||a===e?t:a}getEffectiveRole(){var e,t,a,s,r;return this.currentUserRole=((t=(e=this.auth)==null?void 0:e.getAuthenticatedRole)==null?void 0:t.call(e))||this.currentUserRole||R.INVITADO,this.simulatedRole=((a=this.auth)==null?void 0:a.previewRole)||null,((r=(s=this.auth)==null?void 0:s.getEffectiveRole)==null?void 0:r.call(s))||this.simulatedRole||this.currentUserRole}showSyncOverlay(e="⚡ Sincronizando con Supabase..."){let t=document.getElementById("sync-loading-overlay");t||(t=document.createElement("div"),t.id="sync-loading-overlay",t.style.cssText=`
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 9999; color: white; font-family: var(--font-family-base, system-ui);
      `,document.body.appendChild(t)),t.innerHTML=`
      <div style="width: 48px; height: 48px; border: 4px solid var(--color-primary, #f97316); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">${e}</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Guardando cambios en la Base de Datos...</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `,t.style.display="flex"}hideSyncOverlay(){const e=document.getElementById("sync-loading-overlay");e&&(e.style.display="none")}_permissionForAction(e){return{VIEW_TAB_CLUB:l.VIEW_CLUBS,MANAGE_CLUB_DATA:l.MANAGE_CLUBS,CREATE_TEAM:l.MANAGE_TEAMS,VIEW_TAB_USERS:l.VIEW_USERS,INVITE_USERS:l.INVITE_USERS,MANAGE_ROLES:l.ASSIGN_STANDARD_ROLES,ASSIGN_TEAMS_TO_USER:l.APPROVE_TEAM_ACCESS,APPROVE_JOIN_REQUESTS:l.APPROVE_TEAM_ACCESS,VIEW_TAB_PLAYERS:l.VIEW_ROSTER,MANAGE_PLAYERS:l.MANAGE_ROSTER,REQUEST_TRANSFERS:l.REQUEST_TRANSFER,APPROVE_TRANSFERS:l.APPROVE_TRANSFER,VIEW_TAB_SEASONS:l.VIEW_SEASONS,CREATE_SEASON:l.MANAGE_SEASONS,VIEW_TAB_REQUESTS:l.REQUEST_TEAM_ACCESS,REQUEST_JOIN_CLUB:l.REQUEST_TEAM_ACCESS,EDIT_DATA:l.MANAGE_ROSTER}[e]||null}_can(e){var s,r,i,n,d,c,u,_,p,m,f,g;const t=this.getEffectiveRole();if(["VIEW_TAB_TRANSLATIONS","CREATE_CLUB","DELETE_SEASON","DELETE_CLUB","DELETE_TEAM","VIEW_TAB_SIMULATION","MODIFY_ACTIVE_ROLE"].includes(e))return t===R.SUPERADMIN;if(e==="ASSIGN_ADMIN_ROLE")return!!((r=(s=this.auth)==null?void 0:s.canPreview)!=null&&r.call(s,l.ASSIGN_PRIVILEGED_ROLES));if(e==="EDIT_DATA")return!!((n=(i=this.auth)==null?void 0:i.canPreview)!=null&&n.call(i,l.MANAGE_CLUBS)||(c=(d=this.auth)==null?void 0:d.canPreview)!=null&&c.call(d,l.MANAGE_ROSTER)||(_=(u=this.auth)==null?void 0:u.canPreview)!=null&&_.call(u,l.MANAGE_SEASONS)||(m=(p=this.auth)==null?void 0:p.canPreview)!=null&&m.call(p,l.EDIT_GAME));const a=this._permissionForAction(e);return a?!!((g=(f=this.auth)==null?void 0:f.canPreview)!=null&&g.call(f,a)):!1}_visibleSettingsTabs(){return[{key:"club",action:"VIEW_TAB_CLUB"},{key:"players",action:"VIEW_TAB_PLAYERS"},{key:"users",action:"VIEW_TAB_USERS"},{key:"seasons",action:"VIEW_TAB_SEASONS"},{key:"requests",action:"VIEW_TAB_REQUESTS"},{key:"translations",action:"VIEW_TAB_TRANSLATIONS"},{key:"simulation",action:"VIEW_TAB_SIMULATION"}].filter(({action:t})=>this._can(t)).map(({key:t})=>t)}_ensureVisibleActiveTab(){const e=this._visibleSettingsTabs();if(e.includes(this.activeTab))return this.activeTab;const t=["requests","players","seasons","club","users","translations","simulation"];return this.activeTab=t.find(a=>e.includes(a))||e[0]||"requests",this.activeTab}_canReal(e,t={}){var s,r,i,n,d,c;if(["VIEW_TAB_TRANSLATIONS","CREATE_CLUB","DELETE_SEASON","DELETE_CLUB","DELETE_TEAM","VIEW_TAB_SIMULATION","MODIFY_ACTIVE_ROLE"].includes(e))return((r=(s=this.auth)==null?void 0:s.getAuthenticatedRole)==null?void 0:r.call(s))===R.SUPERADMIN;if(e==="ASSIGN_ADMIN_ROLE")return!!((n=(i=this.auth)==null?void 0:i.can)!=null&&n.call(i,l.ASSIGN_PRIVILEGED_ROLES,t));const a=this._permissionForAction(e);return a?!!((c=(d=this.auth)==null?void 0:d.can)!=null&&c.call(d,a,t)):!1}async _fetchProfiles(){var e,t,a,s,r,i,n,d;try{if(!D||!((t=(e=this.auth)==null?void 0:e.can)!=null&&t.call(e,l.VIEW_USERS))){this.profilesList=[];return}let c=D.from("user_profiles").select("id,email,first_name,last_name,phone,role,status,assigned_team_ids,linked_player_id,created_at").order("created_at",{ascending:!1});const u=(s=(a=this.auth).getCurrentUser)==null?void 0:s.call(a);if(((i=(r=this.auth).getAuthenticatedRole)==null?void 0:i.call(r))===R.ADMIN){const m=((u==null?void 0:u.allowedTeamIds)||[]).map(String).filter(Boolean);if(m.length===0){this.profilesList=[];return}c=c.overlaps("assigned_team_ids",m)}const{data:_,error:p}=await c;!p&&_&&(this.profilesList=((d=(n=this.auth).getAuthenticatedRole)==null?void 0:d.call(n))===R.SUPERADMIN?_:_.filter(m=>String(m.email||"").toLowerCase()!==st),this.profilesList.forEach(m=>{const f=Array.isArray(m.assigned_team_ids)?m.assigned_team_ids.map(String):[];this.userTeamAssignments[m.email]=f}),this._saveAssignmentsLocal())}catch(c){console.warn("Error leyendo perfiles:",c)}}async _fetchSeasons(){var e;try{const t=b.getActiveTeamId();if(!D)return;let a=D.from("seasons").select("*").order("created_at",{ascending:!1});t&&(a=a.eq("team_id",t));const{data:s,error:r}=await a;if(!r&&s&&s.length>0)this.seasonsList=s;else{const i=((e=b.getSeasons)==null?void 0:e.call(b,t))||[],n=localStorage.getItem("iq_seasons");this.seasonsList=i.length>0?i:n?JSON.parse(n):[]}this._saveSeasonsLocal()}catch(t){console.warn("Error leyendo temporadas de Supabase:",t)}}async _refreshCurrentAuthorizationProfile(){var e,t,a,s,r;try{const i=(t=(e=this.auth)==null?void 0:e.getCurrentUser)==null?void 0:t.call(e);if(!D||!(i!=null&&i.email))return!1;const{data:n,error:d}=await D.from("user_profiles").select("id,email,first_name,last_name,phone,role,status,assigned_team_ids,linked_player_id,created_at").eq("email",i.email).maybeSingle();if(d||!n)return!1;const c=(i.allowedTeamIds||[]).map(String).sort().join(","),u=(s=(a=this.auth).setCurrentUser)==null?void 0:s.call(a,{...i,...n,email:i.email}),_=((u==null?void 0:u.allowedTeamIds)||[]).map(String).sort().join(",");return c!==_&&((r=b.setPermissionService)==null||r.call(b,this.auth),b.isLoaded=!1,await b.init(null,!0)),!0}catch(i){return console.warn("No se pudo refrescar el alcance del usuario:",i),!1}}async _fetchTeamDirectory(){try{this.teamDirectory=await this.accessRequestService.listTeamDirectory()}catch(e){console.warn("Error cargando directorio de equipos:",e),this.teamDirectory=[]}}async _fetchJoinRequests(){try{this.joinRequests=await this.accessRequestService.listRequests(),this._saveRequestsLocal()}catch(e){console.warn("Error cargando solicitudes de acceso:",e),this.joinRequests=[]}}async _requestTeamAccess(e){await this.accessRequestService.requestAccess(e),await this._fetchJoinRequests()}async _reviewTeamAccess(e,t){await this.accessRequestService.reviewRequest(e,t),await Promise.all([this._fetchJoinRequests(),this._fetchProfiles()])}async _saveStaffAssignment({clubId:e=null,teamId:t=null,seasonName:a,role:s,staffName:r}){var n;const i=await this.staffAssignmentService.upsertAssignment({clubId:e,teamId:t,seasonName:a,role:s,staffName:r});return(n=b.setStaffAssignmentLocal)==null||n.call(b,i),i}_saveSeasonsLocal(){localStorage.setItem("iq_seasons",JSON.stringify(this.seasonsList))}_saveRequestsLocal(){localStorage.setItem("iq_team_join_requests",JSON.stringify(this.joinRequests))}_saveAssignmentsLocal(){localStorage.setItem("iq_user_teams_map",JSON.stringify(this.userTeamAssignments))}async _persistUserTeamAssignments(e,t=[]){var c,u;if(!((u=(c=this.auth)==null?void 0:c.can)!=null&&u.call(c,l.APPROVE_TEAM_ACCESS)))throw new Error("No tienes permiso para asignar equipos a usuarios.");const a=[...new Set((t||[]).map(String))];for(const _ of a)if(!this.auth.can(l.APPROVE_TEAM_ACCESS,{teamId:_}))throw new Error("No puedes asignar uno o más equipos fuera de tu alcance.");const s=this.profilesList.find(_=>String(_.email||"").toLowerCase()===String(e||"").toLowerCase());if(s!=null&&s.club_id&&!this.auth.can(l.APPROVE_TEAM_ACCESS,{clubId:s.club_id}))throw new Error("No puedes gestionar usuarios de otro club.");if(!(s!=null&&s.id))throw new Error("No se ha podido resolver el usuario objetivo.");const{data:r,error:i}=await D.rpc("iq_v7_set_user_team_assignments",{p_user_id:s.id,p_team_ids:a});if(i)throw i;const n=r==null?void 0:r.assigned_team_ids,d=Array.isArray(n)?n.map(String):a;s.assigned_team_ids=d,this.userTeamAssignments[e]=d,this._saveAssignmentsLocal()}async _refreshTransferRequests(e=null){var t;try{return this.transferRequestCapabilities=await this.transferRequestService.getCapabilities({force:!0}),!((t=this.transferRequestCapabilities)!=null&&t.ready)||!e?(this.transfers=[],this.transfers):(this.transfers=await this.transferRequestService.listPending({scopeTeamSeasonId:e}),this.transfers)}catch(a){return console.warn("No se pudieron cargar las solicitudes persistentes de traspaso:",a),this.transferRequestCapabilities={ready:!1},this.transfers=[],[]}}async _fetchTranslationsForLang(e){try{if(!D)return;const t=e==="cat"?"ca":e;let a=D.from("translations").select("key,language_code,translation,created_at,updated_at");a=t==="ca"?a.in("language_code",["ca","cat"]):a.eq("language_code",t);const{data:s,error:r}=await a;!r&&s&&(this.dbTranslations=s)}catch(t){console.warn("Error cargando traducciones de Supabase:",t)}}async _fetchAllMarketPlayers(e=!1){var s;if(this.isMarketLoaded&&!e&&this.allMarketPlayers.length>0)return this.allMarketPlayers;const t=((s=this.rosterState)==null?void 0:s.teamSeasonId)||null;if(!t)throw new Error("No se pudo resolver la temporada activa del equipo de destino.");const a=await this.transferRequestService.listMarket({targetTeamSeasonId:t});return this.allMarketPlayers=a||[],this.isMarketLoaded=!0,this.allMarketPlayers}_renderMarketTable(e){var p,m,f,g,E,T,x;const t=e.querySelector("#market-modal-table-container");if(!t)return;const a=this.allMarketPlayers.length>0?this.allMarketPlayers:b.getPlayers()||[],s=b.getActiveTeamId(),r=a.filter(S=>{const M=`${S.first_name||S.firstName||""} ${S.last_name||S.lastName||""}`.toLowerCase(),v=(S.team_name||S.teamName||"").toLowerCase(),A=this.marketSearchQuery.toLowerCase();return M.includes(A)||v.includes(A)}),i=Math.ceil(r.length/this.marketItemsPerPage)||1;this.marketCurrentPage>i&&(this.marketCurrentPage=i);const n=(this.marketCurrentPage-1)*this.marketItemsPerPage,d=r.slice(n,n+this.marketItemsPerPage),c=!!((p=this.transferRequestCapabilities)!=null&&p.dual_review),u=((m=this.rosterState)==null?void 0:m.context)||((f=b.getActiveSeasonContext)==null?void 0:f.call(b,s))||null,_=this.marketTransferStartDate||((g=this.rosterState)==null?void 0:g.referenceDate)||_e(u==null?void 0:u.start_date)||kt();t.innerHTML=`
      ${c?`
        <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:12px;border:1px solid #c4b5fd;border-radius:10px;background:#f5f3ff;">
          <label style="display:grid;gap:4px;min-width:min(100%,230px);flex:1 1 230px;font-size:11px;color:#5b21b6;font-weight:800;">
            Fecha prevista de alta en destino
            <input type="date"
                   id="market-transfer-start-date"
                   value="${_||""}"
                   style="width:100%;min-height:44px;box-sizing:border-box;padding:8px 10px;border:1px solid #a78bfa;border-radius:8px;background:#ffffff;color:#0f172a;font:inherit;">
          </label>
          <div style="flex:2 1 280px;font-size:11px;line-height:1.45;color:#6b21a8;">
            El destino propone esta fecha al solicitar el fichaje. El equipo de origen validará por separado el último día de elegibilidad.
          </div>
        </div>
      `:""}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Posición</th>
              <th>Equipo Actual</th>
              <th style="text-align: right;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${d.length>0?d.map(S=>{const M=String(S.team_id).toLowerCase()===String(s).toLowerCase(),v=!!S.pending_to_target||this.transfers.some(A=>String(A.playerId)===String(S.id)&&A.status==="PENDING");return`
                <tr>
                  <td><strong>#${S.jersey??S.number??"-"} ${S.first_name||""} ${S.last_name||""}</strong></td>
                  <td><span class="badge-category">${S.primary_position||S.position||"Alero"}</span></td>
                  <td>${S.team_name||"Otro Equipo"}</td>
                  <td style="text-align: right;">
                    ${M?`
                      <span class="badge-active-team">En tu plantilla</span>
                    `:v?`
                      <span class="badge-pending">⏳ Solicitado</span>
                    `:`
                      <button type="button" class="btn-request-transfer btn-secondary-sm" data-id="${S.id}" data-name="${S.first_name||""} ${S.last_name||""}" data-team-season-origin="${S.from_team_season_id||""}">
                        ⚡ Fichar
                      </button>
                    `}
                  </td>
                </tr>
              `}).join(""):'<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">No se encontraron jugadores que coincidan con la búsqueda.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
        <span style="font-size: 12px; color: #64748b;">Página ${this.marketCurrentPage} de ${i} (${r.length} jugadores)</span>
        <div style="display: flex; gap: 6px;">
          <button type="button" id="btn-market-prev" class="btn-outline-sm" ${this.marketCurrentPage<=1?"disabled":""}>← Anterior</button>
          <button type="button" id="btn-market-next" class="btn-outline-sm" ${this.marketCurrentPage>=i?"disabled":""}>Siguiente →</button>
        </div>
      </div>
    `,(E=t.querySelector("#market-transfer-start-date"))==null||E.addEventListener("change",S=>{this.marketTransferStartDate=String(S.currentTarget.value||"")}),t.querySelectorAll(".btn-request-transfer").forEach(S=>{S.addEventListener("click",async M=>{var y,F,k,W,G,w,H,K,ne,ue;if(!((F=(y=this.auth)==null?void 0:y.can)!=null&&F.call(y,l.REQUEST_TRANSFER,{teamId:s}))){alert("⚠️ No tienes permiso para solicitar traspasos.");return}if(!((k=this.transferRequestCapabilities)!=null&&k.ready)){alert("⚠️ Las solicitudes persistentes de traspaso todavía no están disponibles.");return}const v=M.currentTarget.getAttribute("data-id"),A=M.currentTarget.getAttribute("data-name"),C=M.currentTarget.getAttribute("data-team-season-origin"),O=((W=this.rosterState)==null?void 0:W.teamSeasonId)||null;if(!v||!C||!O){alert("⚠️ No se pudo resolver el jugador o el ámbito temporal del traspaso.");return}let L=null;if((G=this.transferRequestCapabilities)!=null&&G.dual_review){const le=((w=t.querySelector("#market-transfer-start-date"))==null?void 0:w.value)||"";L=_e(le);const $=((H=this.rosterState)==null?void 0:H.context)||((K=b.getActiveSeasonContext)==null?void 0:K.call(b,s))||null;if(!L){alert("⚠️ Selecciona una fecha prevista de alta válida."),(ne=t.querySelector("#market-transfer-start-date"))==null||ne.focus();return}if(!Be(L,$)){alert("⚠️ La fecha prevista de alta debe estar dentro de la temporada activa."),(ue=t.querySelector("#market-transfer-start-date"))==null||ue.focus();return}this.marketTransferStartDate=L}this.showSyncOverlay("📩 Registrando solicitud de traspaso...");try{await this.transferRequestService.requestTransfer({playerId:v,fromTeamSeasonId:C,toTeamSeasonId:O,firstDateTo:L}),await this._refreshTransferRequests(O),this.hideSyncOverlay(),alert(`✅ Solicitud de fichaje registrada para ${A}.`),this._renderMarketTable(e)}catch(le){this.hideSyncOverlay(),console.error("Error registrando solicitud de traspaso:",le),alert(`❌ No se pudo registrar el traspaso: ${le.message||le}`)}})}),(T=t.querySelector("#btn-market-prev"))==null||T.addEventListener("click",()=>{this.marketCurrentPage>1&&(this.marketCurrentPage--,this._renderMarketTable(e))}),(x=t.querySelector("#btn-market-next"))==null||x.addEventListener("click",()=>{this.marketCurrentPage<i&&(this.marketCurrentPage++,this._renderMarketTable(e))})}async render(e="dashboard-content-area"){var Qe,qe,Ke,ct,me,da,ca,ua,pa,ma,fa,ga,_a,ha,ba,Ea,va,ya,Sa,ut,Aa,Ia,Ta,Na,Ra,wa,xa,Oa,Pa,La,Ca,Da,Ma,$a,qa,Va,ka,Fa,Ua,za,Ga,Ba,ja,Wa,Ha,Ya,Ja,Qa;const t=document.getElementById(e)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!t)return;const a=b.getActiveTeamId();if(this._ensureVisibleActiveTab(),this.seasonsList.length===0&&await this._fetchSeasons(),this.activeTab==="players"){try{this.rosterState=await this.rosterManagementService.loadForTeam(a)}catch(h){console.warn("No se pudo cargar la plantilla v3 por temporada:",h),this.rosterState=null}this._can("REQUEST_TRANSFERS")||this._can("APPROVE_TRANSFERS")?await this._refreshTransferRequests(((Qe=this.rosterState)==null?void 0:Qe.teamSeasonId)||null):this.transfers=[]}if((this._can("APPROVE_JOIN_REQUESTS")||this.activeTab==="requests")&&await this._fetchJoinRequests(),this.activeTab==="users"&&await this._fetchProfiles(),this.activeTab==="requests"&&(await this._refreshCurrentAuthorizationProfile(),await this._fetchTeamDirectory()),this.activeTab==="translations"&&await this._fetchTranslationsForLang(this.selectedLangForEdit),this.activeTab==="seasons")try{await this.seasonManagementView.load()}catch(h){console.warn("No se pudo cargar la gestión v3 de temporadas:",h)}const s=this.getEffectiveRole(),r=!this._can("EDIT_DATA"),i=((ct=(Ke=(qe=this.auth)==null?void 0:qe.getCurrentUser)==null?void 0:Ke.call(qe))==null?void 0:ct.email)||"",n=((me=b.getActiveSeasonContext)==null?void 0:me.call(b,a))||null,d=((da=b.getActiveSeasonDisplayName)==null?void 0:da.call(b,a))||b.getActiveSeason()||"Sin temporada",c=(n==null?void 0:n.team_season_id)||(n==null?void 0:n.teamSeasonId)||((n==null?void 0:n.source)==="v3"?n==null?void 0:n.id:null)||null,u=b.getPlayers()||[],_=this.activeTab==="players"&&this.rosterState?this.rosterState.activePlayers:u,p=this.activeTab==="players"?((ca=this.rosterState)==null?void 0:ca.availablePlayers)||[]:[],m=this.activeTab==="players"?((ua=this.rosterState)==null?void 0:ua.historicalPlayers)||[]:[],f=(ma=(pa=this.rosterState)==null?void 0:pa.context)!=null&&ma.name?String(this.rosterState.context.name).replace(/^(\d{4})\s*[-\/]\s*(\d{4})$/,"$1/$2"):d,g=!!((ga=(fa=this.rosterState)==null?void 0:fa.capabilities)!=null&&ga.ready),E=!!(g&&((ha=(_a=this.rosterState)==null?void 0:_a.capabilities)!=null&&ha.supports_seed_exclusion)),T=!!((ba=this.transferRequestCapabilities)!=null&&ba.ready),x=!!(T&&((Ea=this.transferRequestCapabilities)!=null&&Ea.market_directory)),S=((va=this.rosterState)==null?void 0:va.teamSeasonId)||null,M=((ya=this.rosterState)==null?void 0:ya.referenceDate)||_e(n==null?void 0:n.start_date)||_e(n==null?void 0:n.end_date)||kt(),v=((Sa=this.rosterState)==null?void 0:Sa.context)||n,A=Ss(v),C=String((v==null?void 0:v.data_status)||(v==null?void 0:v.dataStatus)||"ACTIVE").toUpperCase()==="FROZEN",O=this._can("MANAGE_PLAYERS")&&!C,L=b.getClubs()||[],y=b.getTeams()||[],F=this.teamDirectory.length>0?this.teamDirectory:y,k=((Ia=(Aa=(ut=this.auth)==null?void 0:ut.getCurrentUser)==null?void 0:Aa.call(ut))==null?void 0:Ia.allowedTeamIds)||[],W=this.transfers.filter(h=>h.status==="PENDING"),G=W.filter(h=>h.dualWorkflow),w=W.filter(h=>!h.dualWorkflow),H=this.joinRequests.filter(h=>h.status==="PENDIENTE"),K=((Ta=b.getSeasons)==null?void 0:Ta.call(b,a))||[],ne=y,ue=this.profilesList,le=this._can("MODIFY_ACTIVE_ROLE"),$=this._can("MANAGE_CLUB_DATA"),Z=this._can("CREATE_TEAM");t.innerHTML=`
      <div class="config-container">
        
        <!-- HEADER CONFIGURACIÓN -->
        <div class="config-header">
          <div>
            <h1>${this.t("settings","Configuración")} ⚙️</h1>
            <p>${this.t("settings_subtitle","Gestión de perfil, fichas de usuario, permisos, asignación de equipos e idiomas.")}</p>
          </div>

          <div style="display: flex; gap: 10px; align-items: center;">
            ${this.simulatedRole?`
              <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #b45309; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                <span>🎭 ${this.t("simulating_role","Simulando:")} ${this.simulatedRole}</span>
                <button type="button" id="btn-stop-simulation" style="background: #dc2626; color: white; border: none; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer;">✕ ${this.t("exit","Salir")}</button>
              </div>
            `:""}

            <!-- BOTÓN ROL ACTIVO: HABILITADO SOLO PARA SUPERADMIN -->
            <div class="role-selector-chip">
              <span style="font-size: 11px; font-weight: 800; color: #475569;">${this.t("active_role","Rol Activo:")}</span>
              <select id="select-demo-role" ${le?"":'disabled style="opacity: 0.6; cursor: not-allowed;"'}>
                <option value="SUPERADMIN" ${s==="SUPERADMIN"?"selected":""}>👑 Superadmin</option>
                <option value="ADMIN" ${s==="ADMIN"?"selected":""}>🔑 Admin Club</option>
                <option value="ENTRENADOR" ${s==="ENTRENADOR"?"selected":""}>📋 Entrenador</option>
                <option value="ANALISTA" ${s==="ANALISTA"?"selected":""}>📈 Analista</option>
                <option value="PREPARADOR_FISICO" ${s==="PREPARADOR_FISICO"?"selected":""}>💪 Preparador físico</option>
                <option value="JUGADOR" ${s==="JUGADOR"?"selected":""}>👤 Jugador</option>
                <option value="FAMILIA_TUTOR" ${s==="FAMILIA_TUTOR"?"selected":""}>👪 Familia / Tutor</option>
                <option value="VISOR" ${s==="VISOR"?"selected":""}>👁️ Visor</option>
                <option value="INVITADO" ${s==="INVITADO"?"selected":""}>🧪 Invitado (Demo)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- PESTAÑAS PRINCIPALES FILTRADAS SEGÚN ROL -->
        <div class="config-tabs">
          ${this._can("VIEW_TAB_CLUB")?`
            <button class="tab-btn ${this.activeTab==="club"?"active":""}" data-tab="club">
              🏢 ${this.t("tab_clubs_teams","Clubs & Equipos")}
            </button>
          `:""}
          
          ${this._can("VIEW_TAB_PLAYERS")?`
            <button class="tab-btn ${this.activeTab==="players"?"active":""}" data-tab="players">
              👥 ${this.t("tab_roster","Plantilla")} (${_.length})
            </button>
          `:""}

          ${this._can("VIEW_TAB_USERS")?`
            <button class="tab-btn ${this.activeTab==="users"?"active":""}" data-tab="users">
              👤 ${this.t("tab_users_roles","Usuarios & Fichas")} (${ue.length})
              ${H.length>0?`<span style="background: #ef4444; color: white; border-radius: 50%; padding: 2px 6px; font-size: 10px; margin-left: 4px; font-weight: 800;">${H.length}</span>`:""}
            </button>
          `:""}

          ${this._can("VIEW_TAB_SEASONS")?`
            <button class="tab-btn ${this.activeTab==="seasons"?"active":""}" data-tab="seasons">
              📅 ${this.t("tab_seasons","Temporadas")} (${((Ra=(Na=this.seasonManagementView.state)==null?void 0:Na.seasons)==null?void 0:Ra.length)??this.seasonsList.length})
            </button>
          `:""}

          ${this._can("VIEW_TAB_REQUESTS")?`
            <button class="tab-btn ${this.activeTab==="requests"?"active":""}" data-tab="requests">
              🛡️ Mis Equipos & Solicitudes
            </button>
          `:""}

          ${this._can("VIEW_TAB_TRANSLATIONS")?`
            <button class="tab-btn tab-admin ${this.activeTab==="translations"?"active":""}" data-tab="translations">
              🌐 ${this.t("tab_languages_translations","Idiomas & Traducciones")} 👑
            </button>
          `:""}

          ${this.currentUserRole==="SUPERADMIN"?`
            <button class="tab-btn tab-simulation ${this.activeTab==="simulation"?"active":""}" data-tab="simulation">
              🎭 ${this.t("tab_role_simulation","Simulación de Roles")} 👑
            </button>
          `:""}
        </div>

        ${r?`<div class="read-only-banner">ℹ️ Permisos asignados al perfil: <strong>${s}</strong>.</div>`:""}

        <!-- CONTENIDO PESTAÑAS -->
        <div class="tab-content-area">
          
          <!-- PESTAÑA DEDICADA A INVITADOS / JUGADORES / ADHESIÓN -->
          ${this.activeTab==="requests"&&this._can("VIEW_TAB_REQUESTS")?`
            <div class="config-container">
              
              <!-- 1. SELECCIONAR EQUIPO PERMITIDO Y TEMPORADA EN PANTALLA -->
              <div class="config-card">
                <div class="card-title"><span>👀</span> SELECCIÓN DE VISUALIZACIÓN DE EQUIPOS AUTORIZADOS</div>
                <p style="font-size: 12px; color: #64748b; margin-top: -10px; margin-bottom: 16px;">
                  Solo puedes ver y consultar estadísticas de los equipos que te han sido asignados por el administrador:
                </p>
                <div class="grid-2-cols">
                  <div class="form-group">
                    <label>Equipo Autorizado en Pantalla</label>
                    <select id="select-guest-active-team">
                      ${ne.length>0?ne.map(h=>`
                        <option value="${h.id}" ${String(h.id).toLowerCase()===String(a).toLowerCase()?"selected":""}>
                          ${h.name} (${h.category||"Baloncesto"})
                        </option>
                      `).join(""):'<option value="" disabled selected>⚠️ No tienes ningún equipo asignado aún</option>'}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Temporada en Pantalla</label>
                    <select id="select-guest-active-season">
                      ${K.length>0?K.map(h=>{const N=h.team_season_id||h.teamSeasonId||h.name,I=String(h.name||""),P=I.match(/^(\\d{4})\\s*[-\\/]\\s*(\\d{4})$/),q=P?`${P[1]}/${P[2]}`:I,V=(n==null?void 0:n.team_season_id)||(n==null?void 0:n.teamSeasonId)||(n==null?void 0:n.name)||d,U=String(N)===String(V)||String(q)===String(d);return`<option value="${N}" ${U?"selected":""}>${q}</option>`}).join(""):'<option value="" disabled selected>Sin temporadas vinculadas</option>'}
                    </select>
                  </div>
                </div>
              </div>

              <!-- 2. SOLICITAR UNIRSE A OTRO EQUIPO -->
              <div class="config-card">
                <div class="card-title"><span>📩</span> SOLICITAR ACCESO A OTROS EQUIPOS</div>
                <p style="font-size: 12px; color: #64748b; margin-top: -10px; margin-bottom: 16px;">
                  Si deseas ver estadísticas o formar parte de un equipo adicional, envía una solicitud que le llegará únicamente a los administradores del club y al Superadmin:
                </p>

                <div class="table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Equipo</th>
                        <th>Categoría</th>
                        <th>Competición</th>
                        <th>Estado de tu Solicitud</th>
                        <th style="text-align: right;">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${F.length>0?F.map(h=>{const N=this.joinRequests.find(P=>P.userEmail===i&&String(P.teamId)===String(h.id)),I=k.includes(String(h.id));return`
                          <tr>
                            <td><strong>${h.name}</strong>${h.club_name?`<div style="font-size:10px;color:#64748b;">${h.club_name}</div>`:""}</td>
                            <td><span class="badge-category">${h.category||"General"}</span></td>
                            <td>${h.competition||"Oficial"}</td>
                            <td>
                              ${I?'<span class="badge-active-team">🟢 Acceso Concedido</span>':N?`<span class="${N.status==="APROBADO"?"badge-active-team":"badge-pending"}">${N.status}</span>`:'<span class="badge-inactive">Sin solicitar</span>'}
                            </td>
                            <td style="text-align: right;">
                              ${I?`
                                <button type="button" class="btn-outline-sm" disabled>Equipo Asignado</button>
                              `:N?`
                                <button type="button" class="btn-outline-sm" disabled>Solicitud Registrada</button>
                              `:`
                                <button type="button" class="btn-request-join-team btn-secondary-sm" data-id="${h.id}" data-name="${h.name}">
                                  ✉️ Solicitar Acceso
                                </button>
                              `}
                            </td>
                          </tr>
                        `}).join(""):'<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay equipos registrados en el sistema.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          `:""}

          <!-- PESTAÑA 1: CLUBS Y EQUIPOS (ADMIN Y SUPERADMIN) -->
          ${this.activeTab==="club"&&this._can("VIEW_TAB_CLUB")?`
            ${this.clubSubView==="list"?`
              ${this._can("CREATE_CLUB")?`
                <div class="config-card" style="margin-bottom: 16px;">
                  <div class="card-title"><span>👑</span> CREAR UN NUEVO CLUB (EXCLUSIVO SUPERADMIN)</div>
                  <form id="form-create-club" class="grid-2-cols">
                    <div class="form-group"><label>Nombre del Club *</label><input type="text" id="club-new-name" placeholder="Ej. CB Sants" required /></div>
                    <div class="form-group"><label>Coordinador · temporada ${d}</label><input type="text" id="club-new-coordinator" placeholder="Ej. Marc Soler" /></div>
                    <div class="form-group"><label>Teléfono</label><input type="text" id="club-new-phone" placeholder="Ej. +34 600 000 000" /></div>
                    <div class="form-group"><label>Dirección</label><input type="text" id="club-new-address" placeholder="Ej. Av. de Roma 12" /></div>
                    <div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">+ Crear Club</button></div>
                  </form>
                </div>
              `:""}

              ${this._can("CREATE_TEAM")?`
                <div class="config-card" style="margin-bottom: 16px;">
                  <div class="card-title"><span>🏆</span> CREAR UN NUEVO EQUIPO</div>
                  <form id="form-create-team" class="grid-2-cols">
                    <div class="form-group"><label>Club Asignado *</label><select id="team-new-club-id" required>${L.map(h=>`<option value="${h.id}">${h.name}</option>`).join("")}</select></div>
                    <div class="form-group"><label>Nombre del Equipo *</label><input type="text" id="team-new-name" placeholder="Ej. Mini Femení B" required /></div>
                    <div class="form-group"><label>Categoría *</label><input type="text" id="team-new-category" placeholder="Ej. Mini / Alevín" required /></div>
                    <div class="form-group"><label>Competición *</label><input type="text" id="team-new-competition" placeholder="Ej. B1 / Preferente" required /></div>
                    <div class="form-group"><label>Entrenador Principal · temporada ${d}</label><input type="text" id="team-new-coach" placeholder="Ej. Teo Raichman" /></div>
                    <div class="form-group"><label>Color Principal</label><input type="color" id="team-new-color" value="#ea580c" style="width: 100%; height: 38px; border: none; cursor: pointer;" /></div>
                    <div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">+ Crear Equipo Completo</button></div>
                  </form>
                </div>
              `:""}

              <div class="config-card" style="margin-bottom: 16px;">
                <div class="card-title"><span>🏢</span> CLUBS REGISTRADOS (${L.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>Nombre del Club</th><th>Coordinador</th><th>Teléfono</th><th>Dirección</th><th style="text-align: right;">Acción</th></tr></thead>
                    <tbody>${L.length>0?L.map(h=>{var N;return`<tr><td><strong>${h.name||"Sin Nombre"}</strong></td><td>${((N=b.getClubCoordinator)==null?void 0:N.call(b,h.id,d))||h.coordinator_name||"No asignado"}<div style="font-size:10px;color:#94a3b8;">${d}</div></td><td>${h.phone||"-"}</td><td>${h.address||"-"}</td><td style="text-align: right;"><button type="button" class="btn-edit-club btn-outline-sm" data-id="${h.id}">${$?"✏️ Editar Club":"👁️ Ver Club"}</button></td></tr>`}).join(""):'<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay clubs registrados.</td></tr>'}</tbody>
                  </table>
                </div>
              </div>

              <div class="config-card">
                <div class="card-title"><span>📊</span> EQUIPOS REGISTRADOS DE TUS ACCESOS (${ne.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead><tr><th>Club</th><th>Equipo</th><th>Categoría</th><th>Entrenador</th><th>Estado</th><th style="text-align: right;">Acción</th></tr></thead>
                    <tbody>${ne.length>0?ne.map(h=>{var I;const N=String(h.id).trim().toLowerCase()===String(a).trim().toLowerCase();return`<tr class="${N?"active-team-row":""}"><td><strong>${h.clubName||"Club"}</strong></td><td>${h.name}</td><td><span class="badge-category">${h.category||"-"}</span></td><td><strong>${((I=b.getTeamCoach)==null?void 0:I.call(b,h.id,d))||h.coach_name||h.coach||"Por definir"}</strong><div style="font-size:10px;color:#94a3b8;">${d}</div></td><td>${N?'<span class="badge-active-team">🟢 Activo Actual</span>':`<button type="button" class="btn-set-active-team btn-outline-sm" data-id="${h.id}">Activar</button>`}</td><td style="text-align: right;"><button type="button" class="btn-edit-team btn-secondary-sm" data-id="${h.id}">${Z?"⚙️ Configurar":"👁️ Ver Equipo"}</button></td></tr>`}).join(""):'<tr><td colspan="6" style="text-align: center; color: #64748b;">No hay equipos registrados asignados.</td></tr>'}</tbody>
                  </table>
                </div>
              </div>
            `:""}

            ${this.clubSubView==="edit-team"?`
              <div class="config-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div class="card-title" style="margin: 0;"><span>🏆</span> DATOS DEL EQUIPO (${((wa=this.selectedTeamForEdit)==null?void 0:wa.name)||""})</div>
                  <button type="button" class="btn-back-to-list btn-outline-sm">⬅️ Volver al Listado</button>
                </div>

                <form id="form-edit-team" class="grid-2-cols">
                  <div class="form-group"><label>Nombre del Club</label><input type="text" value="${((xa=this.selectedTeamForEdit)==null?void 0:xa.clubName)||"Club"}" disabled /></div>
                  <div class="form-group"><label>Nombre del Equipo *</label><input type="text" id="edit-team-name" value="${((Oa=this.selectedTeamForEdit)==null?void 0:Oa.name)||""}" ${Z?"":"disabled"} required /></div>
                  <div class="form-group"><label>Categoría</label><input type="text" id="edit-team-category" value="${((Pa=this.selectedTeamForEdit)==null?void 0:Pa.category)||""}" ${Z?"":"disabled"} /></div>
                  <div class="form-group"><label>Competición</label><input type="text" id="edit-team-competition" value="${((La=this.selectedTeamForEdit)==null?void 0:La.competition)||""}" ${Z?"":"disabled"} /></div>
                  <div class="form-group"><label>Entrenador Principal · temporada ${d}</label><input type="text" id="edit-team-coach" value="${((Da=b.getTeamCoach)==null?void 0:Da.call(b,(Ca=this.selectedTeamForEdit)==null?void 0:Ca.id,d))||""}" ${Z?"":"disabled"} /></div>
                  <div class="form-group"><label>Color Principal</label><input type="color" id="edit-team-color" value="${((Ma=this.selectedTeamForEdit)==null?void 0:Ma.color)||"#ea580c"}" style="width: 100%; height: 38px; border: none; cursor: pointer;" ${Z?"":"disabled"} /></div>
                  ${Z?'<div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">💾 Guardar Cambios Equipo</button></div>':""}
                </form>
              </div>
            `:""}

            ${this.clubSubView==="edit-club"?`
              <div class="config-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div class="card-title" style="margin: 0;"><span>🏢</span> CONFIGURACIÓN DEL CLUB (${(($a=this.selectedClubForEdit)==null?void 0:$a.name)||""})</div>
                  <button type="button" class="btn-back-to-list btn-outline-sm">⬅️ Volver al Listado</button>
                </div>

                <form id="form-edit-club" class="grid-2-cols">
                  <div class="form-group"><label>Nombre del Club *</label><input type="text" id="edit-club-name" value="${((qa=this.selectedClubForEdit)==null?void 0:qa.name)||""}" ${$?"":"disabled"} required /></div>
                  <div class="form-group"><label>Coordinador · temporada ${d}</label><input type="text" id="edit-club-coordinator" value="${((ka=b.getClubCoordinator)==null?void 0:ka.call(b,(Va=this.selectedClubForEdit)==null?void 0:Va.id,d))||""}" ${$?"":"disabled"} /></div>
                  <div class="form-group"><label>Teléfono</label><input type="text" id="edit-club-phone" value="${((Fa=this.selectedClubForEdit)==null?void 0:Fa.phone)||""}" ${$?"":"disabled"} /></div>
                  <div class="form-group"><label>Dirección</label><input type="text" id="edit-club-address" value="${((Ua=this.selectedClubForEdit)==null?void 0:Ua.address)||""}" ${$?"":"disabled"} /></div>
                  ${$?'<div style="grid-column: 1 / -1; text-align: right;"><button type="submit" class="btn-primary">💾 Guardar Datos del Club</button></div>':""}
                </form>
              </div>
            `:""}
          `:""}

          <!-- PESTAÑA 2: PLANTILLA -->
          ${this.activeTab==="players"&&this._can("VIEW_TAB_PLAYERS")?`
            <div class="config-container">
              ${C?`
                <div class="read-only-banner" style="background:#fff1f2;border-color:#fecdd3;color:#9f1239;">
                  🔒 <strong>Temporada cerrada.</strong> La plantilla y los partidos están en modo histórico de solo lectura.
                  Admin/Superadmin debe reabrir la temporada antes de realizar correcciones.
                </div>
              `:""}
              
              <!-- RESUMEN DE TRASPASOS DUALES: la revisión operativa vive en la Bandeja -->
              ${G.length>0?`
                <div class="config-card" style="border:2px solid #c4b5fd;background:#f5f3ff;">
                  <div class="card-title" style="color:#6d28d9;"><span>🔄</span> TRASPASOS EN REVISIÓN (${G.length})</div>
                  <div style="font-size:12px;color:#5b21b6;line-height:1.5;margin-bottom:10px;">
                    Las nuevas solicitudes se validan por separado entre origen y destino. Gestiona las fechas y decisiones desde la Bandeja de Solicitudes.
                  </div>
                  <div style="display:grid;gap:8px;">
                    ${G.map(h=>`
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 10px;border:1px solid #ddd6fe;border-radius:9px;background:#ffffff;">
                        <div>
                          <strong style="font-size:12px;color:#0f172a;">${h.playerName}</strong>
                          <div style="font-size:11px;color:#64748b;margin-top:3px;">
                            Origen: ${h.sourceDecision||"PENDING"} · Destino: ${h.destinationDecision||"PENDING"}
                          </div>
                        </div>
                        <a href="#/approvals" class="btn-secondary-sm" style="text-decoration:none;min-height:40px;display:inline-flex;align-items:center;">📥 Abrir solicitud</a>
                      </div>
                    `).join("")}
                  </div>
                </div>
              `:""}

              <!-- Compatibilidad: solicitudes V1 previas sólo para SUPERADMIN -->
              ${this._can("APPROVE_TRANSFERS")&&w.length>0?`
                <div class="config-card" style="border:2px solid #f59e0b;background:#fffbeb;">
                  <div class="card-title" style="color:#b45309;"><span>📩</span> SOLICITUDES LEGACY PENDIENTES (${w.length})</div>
                  <div class="table-responsive">
                    <table class="data-table">
                      <thead><tr><th>Jugador</th><th>Origen</th><th>Destino</th><th style="text-align:right;">Acciones</th></tr></thead>
                      <tbody>
                        ${w.map(h=>{const N=y.find(P=>String(P.id).toLowerCase()===String(h.originTeamId).toLowerCase()),I=y.find(P=>String(P.id).toLowerCase()===String(h.targetTeamId).toLowerCase());return`
                            <tr>
                              <td><strong>${h.playerName}</strong></td>
                              <td><span class="badge-category">${N?N.name:"Equipo origen"}</span></td>
                              <td><span class="badge-active-team">${I?I.name:"Equipo destino"}</span></td>
                              <td style="text-align:right;display:flex;justify-content:flex-end;gap:8px;">
                                <button type="button" class="btn-approve-transfer btn-secondary-sm" data-id="${h.id}" data-player-id="${h.playerId}" data-target-team="${h.targetTeamId}" style="background:#16a34a;color:white;">🟢 Aprobar Legacy</button>
                                <button type="button" class="btn-reject-transfer btn-danger-sm" data-id="${h.id}">🔴 Rechazar</button>
                              </td>
                            </tr>
                          `}).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              `:""}

              <!-- BOTÓN PARA ABRIR SUBPANTALLA DEL MERCADO -->
              ${this._can("REQUEST_TRANSFERS")&&x?`
              <div class="config-card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                  <h3 style="margin: 0; font-size: 15px; color: #1e3a8a; font-weight: 800;">🔄 Mercado de Fichajes Global</h3>
                  <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Busca y solicita el traspaso de jugadores de cualquier equipo del sistema.</p>
                </div>
                <button type="button" id="btn-open-market-modal" class="btn-primary" style="background: #6366f1; padding: 10px 18px; font-size: 13px;">
                  🔍 Abrir Mercado / Fichar Jugador
                </button>
              </div>
              `:""}

              ${this._can("REQUEST_TRANSFERS")&&!x?`
                <div class="read-only-banner">
                  ${T?"El directorio seguro del mercado todavía no está disponible. Las solicitudes existentes siguen operativas, pero las nuevas búsquedas quedan desactivadas.":"El backend persistente de traspasos todavía no está disponible. El mercado queda desactivado para evitar solicitudes locales no auditables."}
                </div>
              `:""}

              <!-- BLOQUE DE AÑADIR JUGADOR NUEVO -->
              ${O?`
                <div class="config-card">
                  <div class="card-title"><span>👥</span> AÑADIR JUGADOR NUEVO · ${f}</div>
                   ${g?"":'<div class="read-only-banner" style="margin-bottom:12px;">La gestión histórica de plantilla está en modo lectura hasta aplicar el backend v3 de roster.</div>'}
                  <form id="form-add-player" class="grid-4-cols">
                    <div class="form-group"><label>Nombre *</label><input type="text" id="add-p-name" placeholder="Ej. Pablo" required /></div>
                    <div class="form-group"><label>Apellidos *</label><input type="text" id="add-p-lastname" placeholder="Ej. García" required /></div>
                    <div class="form-group"><label>Dorsal / Nº *</label><input type="number" id="add-p-number" placeholder="Ej. 10" required min="0" max="99" /></div>
                    <div class="form-group">
                      <label>Posición Principal *</label>
                      <select id="add-p-position" required>
                        <option value="Base">Base</option><option value="Escolta">Escolta</option><option value="Alero">Alero</option><option value="Ala-pívot">Ala-pívot</option><option value="Pívot">Pívot</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Primer día elegible *</label>
                      <input type="date" id="add-p-effective-date" value="${M||""}" ${A.start?`min="${A.start}"`:""} ${A.end?`max="${A.end}"`:""} required />
                    </div>
                    <div style="grid-column: 1 / -1; text-align: right;">
                      <button type="submit" class="btn-secondary" ${g&&S?"":'disabled style="opacity:.5;cursor:not-allowed;"'}>+ Crear y Añadir a la Plantilla</button>
                    </div>
                  </form>
                </div>
              `:""}

              <!-- JUGADORES PLANTILLA DE LA TEMPORADA ACTIVA -->
              <div class="config-card">
                <div class="card-title"><span>📋</span> PLANTILLA ${f} · ${M} (${_.length})</div>
                ${this.rosterState&&!this.rosterState.persisted?`
                  <div style="font-size:11px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px;margin-bottom:12px;">
                    Esta temporada parte de la plantilla anterior como base. El primer cambio la guardará como plantilla independiente.
                  </div>
                `:""}
                <div class="players-grid">
                  ${_.length>0?_.map(h=>`
                    <div class="player-card ${h.status==="TRASPASADO"?"player-transferred":""}">
                      <div>
                        <strong>#${h.jersey??h.number??"?"} ${h.first_name||""} ${h.last_name||""}</strong>
                        <div style="font-size: 11px; color: #64748b;">
                          ${h.primary_position||h.position||"Jugador"} • ${h.rosterCurrentFrom?`Elegible desde ${h.rosterCurrentFrom}`:h.rosterInherited?"Base heredada":"Activo en esta temporada"}
                        </div>
                      </div>
                      ${O?`
                        <div class="player-card-actions">
                          <button type="button" class="btn-edit-player-modal btn-edit-link" data-id="${h.id}">✏️ Editar</button>
                          <button type="button" class="btn-remove-player-season btn-danger-sm" data-id="${h.id}" ${E&&S?"":"disabled"}>
                            Quitar
                          </button>
                        </div>
                      `:""}
                    </div>
                  `).join(""):'<p style="font-size: 13px; color: #64748b; grid-column: 1/-1;">No hay jugadores en esta temporada.</p>'}
                </div>
              </div>

              ${m.length>0?`
                <div class="config-card">
                  <div class="card-title"><span>🕘</span> HISTÓRICO DE PLANTILLA · ${f} (${m.length})</div>
                  <div style="font-size:11px;color:#64748b;margin:-6px 0 12px;">
                    Jugadores que participaron en esta temporada pero no están elegibles en la fecha de referencia ${M}.
                  </div>
                  <div class="players-grid">
                    ${m.map(h=>`
                      <div class="player-card player-transferred">
                        <div>
                          <strong>#${h.jersey??h.number??"?"} ${h.first_name||""} ${h.last_name||""}</strong>
                          <div style="font-size:11px;color:#64748b;">
                            ${h.primary_position||h.position||"Jugador"} · ${kr(h)}
                          </div>
                        </div>
                        ${O&&g?`
                          <button type="button" class="btn-reactivate-player-season btn-secondary-sm" data-id="${h.id}">
                            + Reincorporar
                          </button>
                        `:""}
                      </div>
                    `).join("")}
                  </div>
                </div>
              `:""}

              ${p.length>0&&O?`
                <div class="config-card">
                  <div class="card-title"><span>↩️</span> JUGADORES DEL EQUIPO FUERA DE ${f}</div>
                  <div class="players-grid">
                    ${p.map(h=>`
                      <div class="player-card">
                        <div>
                          <strong>#${h.jersey??h.number??"?"} ${h.first_name||""} ${h.last_name||""}</strong>
                          <div style="font-size:11px;color:#64748b;">${h.primary_position||h.position||"Jugador"} · No inscrito en esta temporada</div>
                        </div>
                        <button type="button" class="btn-reactivate-player-season btn-secondary-sm" data-id="${h.id}">
                          + Añadir
                        </button>
                      </div>
                    `).join("")}
                  </div>
                </div>
              `:""}
              <!-- MODAL DE EDICIÓN DE JUGADOR -->
              <div id="modal-edit-player" class="iq-modal-overlay" style="display:none;">
                <div class="config-card iq-modal-card iq-modal-card-sm">
                  <div class="iq-modal-header">
                    <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">✏️ Editar Datos del Jugador</h3>
                    <button type="button" id="btn-close-edit-player-modal" class="btn-outline-sm" style="font-size: 14px;">✕</button>
                  </div>

                  <form id="form-edit-player-modal" class="grid-2-cols">
                    <input type="hidden" id="edit-p-id" />
                    <div class="form-group"><label>Nombre *</label><input type="text" id="edit-p-name" ${r?"disabled":""} required /></div>
                    <div class="form-group"><label>Apellidos *</label><input type="text" id="edit-p-lastname" ${r?"disabled":""} required /></div>
                    <div class="form-group"><label>Dorsal / Nº *</label><input type="number" id="edit-p-number" min="0" max="99" ${r?"disabled":""} required /></div>
                    <div class="form-group">
                      <label>Posición Principal *</label>
                      <select id="edit-p-position" ${r?"disabled":""} required>
                        <option value="Base">Base</option><option value="Escolta">Escolta</option><option value="Alero">Alero</option><option value="Ala-pívot">Ala-pívot</option><option value="Pívot">Pívot</option>
                      </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                      <label>Estado general del jugador</label>
                      <select id="edit-p-status" ${r?"disabled":""}>
                        <option value="Activo">Activo</option>
                        <option value="Lesionado">Lesionado</option>
                        <option value="Inactivo">Inactivo</option>
                        <option value="TRASPASADO">Traspasado (estado legacy)</option>
                      </select>
                      <small style="font-size:10px;color:#64748b;line-height:1.35;">
                        Este estado descriptivo no cambia la elegibilidad por temporada. Para dar de baja o reincorporar al jugador utiliza «Quitar» / «Reincorporar», que conservan el historial por fechas.
                      </small>
                    </div>
                    <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                      <button type="button" id="btn-cancel-edit-player" class="btn-outline-sm">Cancelar</button>
                      ${!r&&g&&S?'<button type="submit" class="btn-primary">💾 Guardar Cambios</button>':""}
                    </div>
                  </form>
                </div>
              </div>

              <!-- SUBPANTALLA / MODAL DEL MERCADO GLOBAL -->
              <div id="modal-market-global" class="iq-modal-overlay" style="display:none;">
                <div class="config-card iq-modal-card iq-modal-card-lg">
                  <div class="iq-modal-header">
                    <div>
                      <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">🔄 Mercado de Fichajes Global</h3>
                      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Solo se muestran jugadores con un periodo activo en otro equipo de la misma temporada. No se exponen datos privados de otros equipos.</p>
                    </div>
                    <button type="button" id="btn-close-market-modal" class="btn-outline-sm" style="font-size: 16px; padding: 4px 10px;">✕</button>
                  </div>
                  <div style="margin-bottom: 12px;">
                    <input type="text" id="input-market-search" placeholder="🔍 Buscar por nombre, apellido o club..." value="${this.marketSearchQuery}" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
                  </div>
                  <div id="market-modal-table-container"></div>
                </div>
              </div>

            </div>
          `:""}

          <!-- PESTAÑA 3: USUARIOS & ROLES (ADMIN Y SUPERADMIN) -->
          ${this.activeTab==="users"&&this._can("VIEW_TAB_USERS")?`
            <div class="config-container">
              
              <!-- TARJETA DE AVISO DESTACADA: SOLICITUDES DE ADHESIÓN PENDIENTES -->
              ${this._can("APPROVE_JOIN_REQUESTS")&&H.length>0?`
                <div class="config-card" style="border: 2px solid #ea580c; background: #fff7ed; margin-bottom: 16px;">
                  <div class="card-title" style="color: #c2410c;">
                    <span>📩</span> SOLICITUDES DE ADHESIÓN A EQUIPO PENDIENTES (${H.length})
                  </div>
                  <p style="font-size: 12px; color: #9a3412; margin-top: -10px; margin-bottom: 12px;">
                    Los siguientes usuarios han solicitado unirse a un equipo de tu club. Puedes autorizar su acceso o rechazar la petición:
                  </p>
                  <div class="table-responsive">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Usuario (Email)</th>
                          <th>Equipo Solicitado</th>
                          <th>Fecha Solicitud</th>
                          <th style="text-align: right;">Acciones de Gestión</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${H.map(h=>`
                          <tr>
                            <td><strong>${h.userEmail}</strong></td>
                            <td><span class="badge-category">${h.teamName||"Equipo"}</span></td>
                            <td>${h.date||"-"}</td>
                            <td style="text-align: right; display: flex; justify-content: flex-end; gap: 8px;">
                              <button type="button" class="btn-approve-join-req btn-secondary-sm" data-id="${h.id}" data-email="${h.userEmail}" data-team-id="${h.teamId}" style="background: #16a34a; color: white;">
                                🟢 Aprobar y Conceder Acceso
                              </button>
                              <button type="button" class="btn-reject-join-req btn-danger-sm" data-id="${h.id}">
                                🔴 Rechazar
                              </button>
                            </td>
                          </tr>
                        `).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              `:""}

              <div class="config-card">
                <div class="card-title"><span>👤</span> ALTA DE USUARIO E INVITACIÓN DIRECTA</div>
                <form id="form-create-user-profile" class="grid-2-cols">
                  <div class="form-group">
                    <label>Nombre Completo *</label>
                    <input type="text" id="new-user-name" placeholder="Ej. Carlos García" required />
                  </div>
                  <div class="form-group">
                    <label>Correo Electrónico (Email) *</label>
                    <input type="email" id="new-user-email" placeholder="usuario@ejemplo.com" required />
                  </div>
                  <div class="form-group">
                    <label>Rol Asignado *</label>
                    <select id="new-user-role">
                      ${this._can("ASSIGN_ADMIN_ROLE")?'<option value="ADMIN">Administrador de Club</option>':""}
                      <option value="ENTRENADOR" selected>Entrenador</option>
                      <option value="ANALISTA">Analista</option>
                      <option value="PREPARADOR_FISICO">Preparador físico</option>
                      <option value="JUGADOR">Jugador</option>
                      <option value="FAMILIA_TUTOR">Familia / Tutor</option>
                      <option value="VISOR">Visor (Solo Lectura)</option>
                      <option value="INVITADO">Invitado (Demo)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>🔑 Contraseña Temporal *</label>
                    <input type="password" id="new-user-pass" placeholder="Contraseña temporal segura" autocomplete="new-password" required />
                  </div>
                  <div class="form-group" id="new-user-player-group" style="display: none; grid-column: 1 / -1;">
                    <label>🏀 Jugador que representa esta cuenta *</label>
                    <select id="new-user-player">
                      <option value="">Selecciona un jugador del equipo activo</option>
                      ${u.map(h=>`
                        <option value="${h.id}">#${h.jersey??"-"} · ${h.first_name||""} ${h.last_name||""}</option>
                      `).join("")}
                    </select>
                    <small style="display:block; margin-top:6px; color:#64748b;">
                      El vínculo SELF se guarda en el perfil y en la relación usuario-jugador. Familia/Tutor se vincula después mediante invitación GUARDIAN.
                    </small>
                  </div>
                  <div style="grid-column: 1 / -1; text-align: right;">
                    <button type="submit" id="btn-submit-create-user" class="btn-primary">✉️ Dar de Alta e Invitar Usuario</button>
                  </div>
                </form>
              </div>

              <div class="config-card">
                <div class="card-title"><span>👥</span> ADMINISTRAR MIEMBROS, ROLES Y ASIGNACIÓN DE EQUIPOS (${ue.length})</div>
                <div class="table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Rol Asignado</th>
                        <th>Equipos Asignados</th>
                        <th style="text-align: right;">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${ue.length>0?ue.map(h=>{const N=this.userTeamAssignments[h.email]||[],I=y.filter(z=>N.includes(String(z.id))).map(z=>z.name),P=this.joinRequests.some(z=>z.userEmail===h.email&&z.status==="PENDIENTE"),q=String(h.email||"").toLowerCase()===st,V=h.role===R.ADMIN&&!this._can("ASSIGN_ADMIN_ROLE"),U=q||V;return`
                          <tr>
                            <td>
                              <strong>${(h.first_name||"")+" "+(h.last_name||"")||"Sin Nombre"}</strong>
                              ${P?'<span style="background: #ea580c; color: white; border-radius: 4px; padding: 2px 6px; font-size: 10px; margin-left: 6px; font-weight: 800;">⏳ Solicitud Pendiente</span>':""}
                            </td>
                            <td>${h.email||"-"}</td>
                            <td>
                              <select class="select-user-role" data-id="${h.id}" ${U?"disabled":""} style="padding: 4px 8px; border-radius: 6px; font-weight: 700;">
                                ${q?'<option value="SUPERADMIN" selected>Superadmin único</option>':""}
                                ${!q&&this._can("ASSIGN_ADMIN_ROLE")?`<option value="ADMIN" ${h.role==="ADMIN"?"selected":""}>Administrador de Club</option>`:""}
                                ${q?"":`
                                  <option value="ENTRENADOR" ${h.role==="ENTRENADOR"?"selected":""}>Entrenador</option>
                                  <option value="ANALISTA" ${["ANALISTA","SCOUT"].includes(h.role)?"selected":""}>Analista</option>
                                  <option value="PREPARADOR_FISICO" ${h.role==="PREPARADOR_FISICO"?"selected":""}>Preparador físico</option>
                                  <option value="JUGADOR" ${h.role==="JUGADOR"?"selected":""}>Jugador</option>
                                  <option value="FAMILIA_TUTOR" ${h.role==="FAMILIA_TUTOR"?"selected":""}>Familia / Tutor</option>
                                  <option value="VISOR" ${["VISOR","VIEWER"].includes(h.role)?"selected":""}>Visor</option>
                                  <option value="INVITADO" ${h.role==="INVITADO"?"selected":""}>Invitado (Demo)</option>
                                `}
                              </select>
                              ${q?"":`
                                <div class="user-player-link-group" data-id="${h.id}" style="margin-top: 8px; ${h.role==="JUGADOR"?"":"display:none;"}">
                                  <label style="display:block; font-size:11px; font-weight:700; color:#475569; margin-bottom:4px;">🏀 Jugador vinculado *</label>
                                  <select class="select-user-player-link" data-id="${h.id}" style="width:100%; padding:6px 8px; border-radius:6px;">
                                    <option value="">Selecciona jugador del equipo activo</option>
                                    ${u.map(z=>`
                                      <option value="${z.id}" ${String(h.linked_player_id||"")===String(z.id)?"selected":""}>#${z.jersey??"-"} · ${z.first_name||""} ${z.last_name||""}</option>
                                    `).join("")}
                                  </select>
                                </div>
                              `}
                            </td>
                            <td>
                              ${q?'<span class="badge-active-team">🌍 Todos los Equipos</span>':I.length>0?`<span class="badge-category">${I.join(", ")}</span>`:'<span class="badge-inactive">Sin Equipos</span>'}
                            </td>
                            <td style="text-align: right; display: flex; justify-content: flex-end; gap: 6px;">
                              <button type="button" class="btn-save-user-role btn-secondary-sm" data-id="${h.id}" title="Guardar Rol" ${U?'disabled style="opacity:.5;cursor:not-allowed;"':""}>💾 Guardar Rol</button>
                              <button type="button" class="btn-open-user-card btn-outline-sm" data-email="${h.email}">📇 Ver Ficha / Equipos</button>
                            </td>
                          </tr>
                        `}).join(""):'<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay usuarios registrados.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- MODAL FICHA TÉCNICA DE USUARIO Y ASIGNACIÓN MULTIEQUIPO -->
              <div id="modal-user-card" class="iq-modal-overlay" style="display:none;">
                <div class="config-card iq-modal-card iq-modal-card-md">
                  <div class="iq-modal-header">
                    <h3 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800;">📇 FICHA TÉCNICA Y ASIGNACIÓN DE EQUIPOS</h3>
                    <button type="button" id="btn-close-user-card-modal" class="btn-outline-sm" style="font-size: 14px;">✕</button>
                  </div>

                  <div id="user-card-modal-content"></div>
                </div>
              </div>

            </div>
          `:""}

          <!-- PESTAÑA 4: TEMPORADAS V3 -->
          ${this.activeTab==="seasons"&&this._can("VIEW_TAB_SEASONS")?this.seasonManagementView.renderMarkup({activeTeamId:a,canManage:this._can("CREATE_SEASON")}):""}

          <!-- PESTAÑA 5: IDIOMAS Y TRADUCCIONES (SUPERADMIN) -->
          ${this.activeTab==="translations"&&this._can("VIEW_TAB_TRANSLATIONS")?`
            <div id="translations-subview-container">
              ${this.languageSettingsView.render()}
            </div>
          `:""}

          <!-- PESTAÑA 6: SIMULACIÓN DE ROLES (EXCLUSIVO SUPERADMIN) -->
          ${this.activeTab==="simulation"&&this.currentUserRole==="SUPERADMIN"?`
            <div class="config-card" style="border: 2px solid #6366f1;">
              <div class="card-title" style="color: #4f46e5;"><span>🎭</span> MODO SIMULACIÓN DE PANTALLAS Y PERMISOS</div>
              <p style="font-size: 13px; color: #475569; margin-top: -8px; margin-bottom: 20px;">
                Selecciona un rol para simular la interfaz y comprobar de inmediato qué opciones y botones puede ver y ejecutar cada perfil de usuario en toda la app.
              </p>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="SUPERADMIN" style="padding: 14px; text-align: left; font-weight: 800;">👑 Simular SUPERADMIN</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="ADMIN" style="padding: 14px; text-align: left; font-weight: 800;">🔑 Simular ADMIN CLUB</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="ENTRENADOR" style="padding: 14px; text-align: left; font-weight: 800;">📋 Simular ENTRENADOR</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="ANALISTA" style="padding: 14px; text-align: left; font-weight: 800;">📈 Simular ANALISTA</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="PREPARADOR_FISICO" style="padding: 14px; text-align: left; font-weight: 800;">💪 Simular PREPARADOR FÍSICO</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="JUGADOR" style="padding: 14px; text-align: left; font-weight: 800;">👤 Simular JUGADOR</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="FAMILIA_TUTOR" style="padding: 14px; text-align: left; font-weight: 800;">👪 Simular FAMILIA / TUTOR</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="VISOR" style="padding: 14px; text-align: left; font-weight: 800;">👁️ Simular VISOR</button>
                <button type="button" class="btn-simulate-role btn-outline-sm" data-role="INVITADO" style="padding: 14px; text-align: left; font-weight: 800;">🧪 Simular INVITADO (Demo)</button>
              </div>

              ${this.simulatedRole?`
                <div style="text-align: right;">
                  <button type="button" id="btn-reset-simulation" class="btn-danger-sm" style="padding: 10px 18px; font-weight: 800;">🔴 Desactivar Simulación (Volver a Modo Real)</button>
                </div>
              `:""}
            </div>
          `:""}

        </div>

      </div>

      <!-- ESTILOS RESPONSIVE -->
      <style>
        .config-container { max-width: 1000px; margin: 0 auto; font-family: var(--font-family-base, system-ui); display: flex; flex-direction: column; gap: 16px; }
        .config-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .config-header h1 { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0; }
        .config-header p { font-size: 12px; color: #64748b; margin: 2px 0 0 0; }
        
        .role-selector-chip { display: flex; align-items: center; gap: 8px; background: #f1f5f9; padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; }
        .role-selector-chip select { background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; outline: none; cursor: pointer; }

        .config-tabs { display: flex; gap: 6px; border-bottom: 2px solid #e2e8f0; overflow-x: auto; padding-bottom: 2px; }
        .tab-btn { background: #f1f5f9; border: 1px solid #cbd5e1; border-bottom: none; padding: 8px 14px; border-radius: 8px 8px 0 0; font-size: 12px; font-weight: 700; color: #475569; cursor: pointer; white-space: nowrap; }
        .tab-btn.active { background: #1e3a8a; color: white; border-color: #1e3a8a; }
        .tab-btn.tab-admin { background: #fef3c7; color: #92400e; border-color: #fde68a; }
        .tab-btn.tab-simulation { background: #e0e7ff; color: #3730a3; border-color: #c7d2fe; }

        .read-only-banner { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 10px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; }
        .config-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .card-title { font-size: 12px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.04em; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }

        .grid-2-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-4-cols { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
        .grid-inline { display: flex; gap: 12px; align-items: flex-end; }

        .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-group label { font-size: 11px; font-weight: 700; color: #475569; }
        .form-group input, .form-group select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none; background: white; min-height: 44px; box-sizing: border-box; }

        .btn-primary { background: #1e3a8a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; min-height: 44px; }
        .btn-secondary { background: #6366f1; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; min-height: 44px; }
        .btn-secondary-sm { background: #6366f1; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; min-height: 36px; }
        .btn-outline-sm { background: white; border: 1px solid #cbd5e1; color: #334155; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; min-height: 36px; }
        .btn-danger-sm { background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 6px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; min-height: 36px; }

        .table-responsive { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table th, .data-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .data-table th { background: #f8fafc; font-weight: 800; color: #475569; }

        .active-team-row { background: #f0fdf4; }
        .badge-category { background: #e0e7ff; color: #3730a3; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; }
        .badge-active-team { background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
        .badge-pending { background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
        .badge-inactive { background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }

        .players-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .player-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .player-card-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

        .iq-modal-overlay {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          min-height: 100dvh;
          box-sizing: border-box;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          z-index: 10020;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          align-items: flex-start;
          justify-content: center;
          padding:
            max(10px, env(safe-area-inset-top))
            max(10px, env(safe-area-inset-right))
            max(12px, env(safe-area-inset-bottom))
            max(10px, env(safe-area-inset-left));
        }
        .iq-modal-card {
          width: 100%;
          min-height: 0;
          max-height: calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
          box-sizing: border-box;
          margin: auto 0;
          padding-bottom: max(16px, env(safe-area-inset-bottom));
        }
        .iq-modal-card-sm { max-width: 500px; }
        .iq-modal-card-md { max-width: 600px; }
        .iq-modal-card-lg { max-width: 850px; }
        .iq-modal-header {
          position: sticky;
          top: -20px;
          z-index: 2;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin: -4px -4px 16px;
          padding: 4px 4px 10px;
          background: white;
          border-bottom: 1px solid #f1f5f9;
        }

        @media (max-width: 868px) {
          .grid-2-cols, .grid-4-cols, .players-grid { grid-template-columns: 1fr !important; }
          .player-card { align-items: flex-start; flex-wrap: wrap; }
          .player-card-actions { width: 100%; justify-content: flex-start; }
          .iq-modal-card {
            margin: 0;
            max-height: calc(100dvh - 20px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
            padding: 14px;
            padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
          }
          .iq-modal-header { top: -14px; margin: -2px -2px 12px; padding-top: 2px; }
        }
      </style>
    `;const ge=t.querySelector("#select-demo-role");ge&&!le&&ge.addEventListener("click",h=>{h.preventDefault(),alert("⚠️ La modificación del Rol Activo solo está disponible para el perfil SUPERADMIN.")}),t.querySelectorAll(".tab-btn").forEach(h=>{h.addEventListener("click",async N=>{this.activeTab=N.currentTarget.getAttribute("data-tab"),this.clubSubView="list",await this.render(e)})});const pe=t.querySelector("#form-create-club");pe&&pe.addEventListener("submit",async h=>{var V,U,z,Y;if(h.preventDefault(),!this._canReal("CREATE_CLUB"))return alert("⚠️ Solo el Superadmin puede crear clubes.");const N=(V=t.querySelector("#club-new-name"))==null?void 0:V.value.trim(),I=(U=t.querySelector("#club-new-coordinator"))==null?void 0:U.value.trim(),P=(z=t.querySelector("#club-new-phone"))==null?void 0:z.value.trim(),q=(Y=t.querySelector("#club-new-address"))==null?void 0:Y.value.trim();if(!N)return alert("Introduce el nombre del club.");this.showSyncOverlay("⚡ Creando nuevo club en Supabase...");try{if(!D)throw new Error("Supabase no configurado");const{data:B,error:te}=await D.from("clubs").insert([{name:N,coordinator_name:I,phone:P,address:q}]).select().single();if(te)throw te;I!==void 0&&await this._saveStaffAssignment({clubId:B.id,seasonName:d,role:Ie.COORDINATOR,staffName:I}),b.isLoaded=!1,await b.init(a,!0),this.hideSyncOverlay(),alert(`✅ Club "${N}" creado exitosamente.`),await this.render(e)}catch(B){this.hideSyncOverlay(),console.error("Error creando club:",B),alert(`❌ Error al crear club: ${B.message||B}`)}});const ye=t.querySelector("#form-create-team");ye&&ye.addEventListener("submit",async h=>{var z,Y,B,te,ae,oe,re,he;h.preventDefault();const N=(z=t.querySelector("#team-new-club-id"))==null?void 0:z.value,I=(Y=t.querySelector("#team-new-name"))==null?void 0:Y.value.trim(),P=(B=t.querySelector("#team-new-category"))==null?void 0:B.value.trim(),q=(te=t.querySelector("#team-new-competition"))==null?void 0:te.value.trim(),V=(ae=t.querySelector("#team-new-coach"))==null?void 0:ae.value.trim(),U=((oe=t.querySelector("#team-new-color"))==null?void 0:oe.value)||"#ea580c";if(!I||!N)return alert("Introduce los campos obligatorios del equipo.");if(!((he=(re=this.auth)==null?void 0:re.can)!=null&&he.call(re,l.MANAGE_TEAMS,{clubId:N})))return alert("⚠️ No tienes permiso para crear equipos en este club.");this.showSyncOverlay("⚡ Creando nuevo equipo en Supabase...");try{if(!D)throw new Error("Supabase no configurado");const{data:de,error:ie}=await D.from("teams").insert([{club_id:N,name:I,category:P,competition:q,coach_name:V,color:U}]).select().single();if(ie)throw ie;await this._saveStaffAssignment({clubId:N,teamId:de.id,seasonName:d,role:Ie.HEAD_COACH,staffName:V}),b.isLoaded=!1,await b.init(de.id,!0),this.hideSyncOverlay(),alert(`✅ Equipo "${I}" creado exitosamente.`),await this.render(e)}catch(de){this.hideSyncOverlay(),console.error("Error creando equipo:",de),alert(`❌ Error al crear equipo: ${de.message||de}`)}}),t.querySelectorAll(".btn-edit-club").forEach(h=>{h.addEventListener("click",()=>{const N=h.getAttribute("data-id");this.selectedClubForEdit=L.find(I=>String(I.id)===String(N)),this.clubSubView="edit-club",this.render(e)})}),t.querySelectorAll(".btn-edit-team").forEach(h=>{h.addEventListener("click",()=>{const N=h.getAttribute("data-id");this.selectedTeamForEdit=y.find(I=>String(I.id)===String(N)),this.clubSubView="edit-team",this.render(e)})}),t.querySelectorAll(".btn-back-to-list").forEach(h=>{h.addEventListener("click",()=>{this.clubSubView="list",this.render(e)})});const Se=t.querySelector("#form-edit-team");Se&&Se.addEventListener("submit",async h=>{var z,Y,B,te,ae,oe,re,he,de,ie;h.preventDefault();const N=(z=this.selectedTeamForEdit)==null?void 0:z.id,I=(Y=t.querySelector("#edit-team-name"))==null?void 0:Y.value.trim(),P=(B=t.querySelector("#edit-team-category"))==null?void 0:B.value.trim(),q=(te=t.querySelector("#edit-team-competition"))==null?void 0:te.value.trim(),V=(ae=t.querySelector("#edit-team-coach"))==null?void 0:ae.value.trim(),U=(oe=t.querySelector("#edit-team-color"))==null?void 0:oe.value;if(!((he=(re=this.auth)==null?void 0:re.can)!=null&&he.call(re,l.MANAGE_TEAMS,{teamId:N})))return alert("⚠️ No tienes permiso para modificar este equipo.");this.showSyncOverlay("💾 Actualizando equipo en Supabase...");try{if(!D)throw new Error("Supabase no configurado");const{error:be}=await D.from("teams").update({name:I,category:P,competition:q,color:U}).eq("id",N);if(be)throw be;await this._saveStaffAssignment({clubId:((de=this.selectedTeamForEdit)==null?void 0:de.club_id)||((ie=this.selectedTeamForEdit)==null?void 0:ie.clubId)||null,teamId:N,seasonName:d,role:Ie.HEAD_COACH,staffName:V}),b.isLoaded=!1,await b.init(a,!0),this.hideSyncOverlay(),alert("✅ Datos del equipo guardados correctamente."),this.clubSubView="list",await this.render(e)}catch(be){this.hideSyncOverlay(),console.error("Error guardando equipo:",be),alert(`❌ Error al guardar equipo: ${be.message}`)}});const De=t.querySelector("#form-edit-club");De&&De.addEventListener("submit",async h=>{var U,z,Y,B,te,ae,oe;h.preventDefault();const N=(U=this.selectedClubForEdit)==null?void 0:U.id,I=(z=t.querySelector("#edit-club-name"))==null?void 0:z.value.trim(),P=(Y=t.querySelector("#edit-club-coordinator"))==null?void 0:Y.value.trim(),q=(B=t.querySelector("#edit-club-phone"))==null?void 0:B.value.trim(),V=(te=t.querySelector("#edit-club-address"))==null?void 0:te.value.trim();if(!((oe=(ae=this.auth)==null?void 0:ae.can)!=null&&oe.call(ae,l.MANAGE_CLUBS,{clubId:N})))return alert("⚠️ No tienes permiso para modificar este club.");this.showSyncOverlay("💾 Actualizando club en Supabase...");try{if(!D)throw new Error("Supabase no configurado");const{error:re}=await D.from("clubs").update({name:I,phone:q,address:V}).eq("id",N);if(re)throw re;await this._saveStaffAssignment({clubId:N,seasonName:d,role:Ie.COORDINATOR,staffName:P}),b.isLoaded=!1,await b.init(a,!0),this.hideSyncOverlay(),alert("✅ Datos del club guardados correctamente."),this.clubSubView="list",await this.render(e)}catch(re){this.hideSyncOverlay(),console.error("Error guardando club:",re),alert(`❌ Error al guardar club: ${re.message}`)}});const Ue=t.querySelector("#form-add-player");Ue&&Ue.addEventListener("submit",async h=>{var U,z,Y,B,te,ae,oe;h.preventDefault();const N=(U=t.querySelector("#add-p-name"))==null?void 0:U.value.trim(),I=(z=t.querySelector("#add-p-lastname"))==null?void 0:z.value.trim(),P=Number(((Y=t.querySelector("#add-p-number"))==null?void 0:Y.value)||0),q=((B=t.querySelector("#add-p-position"))==null?void 0:B.value)||"Alero",V=_e((te=t.querySelector("#add-p-effective-date"))==null?void 0:te.value);if(!N||!I)return alert("Introduce nombre y apellidos del jugador.");if(!V)return alert("Indica el primer día en que el jugador será elegible.");if(!Be(V,v))return alert("⚠️ El primer día elegible debe estar dentro de las fechas de la temporada.");if(!((oe=(ae=this.auth)==null?void 0:ae.can)!=null&&oe.call(ae,l.MANAGE_ROSTER,{teamId:a,teamSeasonId:S})))return alert("⚠️ No tienes permiso para añadir jugadores a esta plantilla.");this.showSyncOverlay("⚡ Añadiendo jugador a la plantilla de la temporada...");try{if(!g||!S)throw new Error("La gestión de plantilla por temporada todavía no está disponible.");await this.rosterManagementService.createPlayer({teamSeasonId:S,firstName:N,lastName:I,jersey:P,primaryPosition:q,effectiveDate:V}),b.isLoaded=!1,await b.init(a,!0),this.hideSyncOverlay(),alert(`✅ Jugador #${P} ${N} ${I} añadido con éxito.`),await this.render(e)}catch(re){this.hideSyncOverlay(),console.error("Error añadiendo jugador:",re),alert(`❌ Error al añadir jugador: ${re.message}`)}}),t.querySelectorAll(".btn-edit-player-modal").forEach(h=>{h.addEventListener("click",()=>{const N=h.getAttribute("data-id"),I=_.find(q=>String(q.id)===String(N));if(!I)return;t.querySelector("#edit-p-id").value=I.id,t.querySelector("#edit-p-name").value=I.first_name||I.firstName||"",t.querySelector("#edit-p-lastname").value=I.last_name||I.lastName||"",t.querySelector("#edit-p-number").value=I.jersey??I.number??"",t.querySelector("#edit-p-position").value=I.primary_position||I.position||"Alero",t.querySelector("#edit-p-status").value=I.status||"Activo";const P=t.querySelector("#modal-edit-player");P&&(P.style.display="flex")})}),(za=t.querySelector("#btn-close-edit-player-modal"))==null||za.addEventListener("click",()=>{t.querySelector("#modal-edit-player").style.display="none"}),(Ga=t.querySelector("#btn-cancel-edit-player"))==null||Ga.addEventListener("click",()=>{t.querySelector("#modal-edit-player").style.display="none"});const Ye=t.querySelector("#form-edit-player-modal");Ye&&Ye.addEventListener("submit",async h=>{var z,Y,B,te,ae,oe,re,he;h.preventDefault();const N=(z=t.querySelector("#edit-p-id"))==null?void 0:z.value,I=(Y=t.querySelector("#edit-p-name"))==null?void 0:Y.value.trim(),P=(B=t.querySelector("#edit-p-lastname"))==null?void 0:B.value.trim(),q=Number(((te=t.querySelector("#edit-p-number"))==null?void 0:te.value)||0),V=(ae=t.querySelector("#edit-p-position"))==null?void 0:ae.value,U=(oe=t.querySelector("#edit-p-status"))==null?void 0:oe.value;if(!((he=(re=this.auth)==null?void 0:re.can)!=null&&he.call(re,l.MANAGE_ROSTER,{teamId:a,teamSeasonId:S})))return alert("⚠️ No tienes permiso para modificar esta plantilla.");this.showSyncOverlay("💾 Guardando cambios del jugador...");try{if(!g||!S)throw new Error("La edición de plantilla por temporada todavía no está disponible.");await b.updatePlayer(N,{first_name:I,last_name:P,status:U},l.EDIT_PLAYER_MASTER),g&&S&&await this.rosterManagementService.setMember({teamSeasonId:S,playerId:N,status:"ACTIVE",jersey:q,primaryPosition:V}),b.isLoaded=!1,await b.init(a,!0),this.hideSyncOverlay(),alert("✅ Jugador actualizado correctamente."),t.querySelector("#modal-edit-player").style.display="none",await this.render(e)}catch(de){this.hideSyncOverlay(),console.error("Error actualizando jugador:",de),alert(`❌ Error al actualizar jugador: ${de.message}`)}}),t.querySelectorAll(".btn-remove-player-season").forEach(h=>{h.addEventListener("click",async()=>{var U,z;const N=h.getAttribute("data-id"),I=_.find(Y=>String(Y.id)===String(N));if(!I||!S||!E)return;if(!((z=(U=this.auth)==null?void 0:U.can)!=null&&z.call(U,l.MANAGE_ROSTER,{teamId:a,teamSeasonId:S}))){alert("⚠️ No tienes permiso para modificar esta plantilla.");return}const P=[I.first_name,I.last_name].filter(Boolean).join(" ")||I.name||"este jugador";if(!confirm(`Quitar a ${P} de ${f}?

Si solo fue heredado de la temporada anterior y todavía no participó, se excluirá sin crear un historial falso. Si ya participó, se conservarán todos sus datos y se cerrará su periodo de elegibilidad.`))return;const q=prompt("Último día en que el jugador puede participar en esta temporada (AAAA-MM-DD):",M||"");if(q===null)return;const V=_e(q);if(!V){alert("⚠️ Introduce una fecha válida con formato AAAA-MM-DD.");return}if(!Be(V,v)){alert("⚠️ El último día elegible debe estar dentro de las fechas de la temporada.");return}this.showSyncOverlay("💾 Actualizando plantilla de la temporada...");try{await this.rosterManagementService.removePlayer({teamSeasonId:S,playerId:N,lastEligibleDate:V}),b.isLoaded=!1,await b.init(a,!0),this.rosterState=await this.rosterManagementService.loadForTeam(a),this.hideSyncOverlay(),await this.render(e)}catch(Y){this.hideSyncOverlay(),console.error("Error quitando jugador de temporada:",Y),alert(`❌ No se pudo quitar al jugador de esta temporada: ${Y.message||Y}`)}})}),t.querySelectorAll(".btn-reactivate-player-season").forEach(h=>{h.addEventListener("click",async()=>{var z,Y;const N=h.getAttribute("data-id");if(!N||!S||!g)return;if(!((Y=(z=this.auth)==null?void 0:z.can)!=null&&Y.call(z,l.MANAGE_ROSTER,{teamId:a,teamSeasonId:S}))){alert("⚠️ No tienes permiso para modificar esta plantilla.");return}const I=[...m,...p].find(B=>String(B.id)===String(N)),P=I!=null&&I.rosterLastUntil?Ft(I.rosterLastUntil,1):null,q=ns(M,P)||M||"",V=prompt("Primer día en que el jugador puede participar en esta temporada (AAAA-MM-DD):",q);if(V===null)return;const U=_e(V);if(!U){alert("⚠️ Introduce una fecha válida con formato AAAA-MM-DD.");return}if(!Be(U,v)){alert("⚠️ El primer día elegible debe estar dentro de las fechas de la temporada.");return}if(I!=null&&I.rosterLastUntil&&U<=I.rosterLastUntil){alert(`⚠️ La reincorporación debe ser posterior al último periodo cerrado (${I.rosterLastUntil}).`);return}this.showSyncOverlay("💾 Añadiendo jugador a la temporada...");try{await this.rosterManagementService.reactivatePlayer({teamSeasonId:S,playerId:N,firstEligibleDate:U}),b.isLoaded=!1,await b.init(a,!0),this.rosterState=await this.rosterManagementService.loadForTeam(a),this.hideSyncOverlay(),await this.render(e)}catch(B){this.hideSyncOverlay(),console.error("Error reactivando jugador en temporada:",B),alert(`❌ No se pudo añadir al jugador a esta temporada: ${B.message||B}`)}})}),(Ba=t.querySelector("#btn-open-market-modal"))==null||Ba.addEventListener("click",async()=>{this.showSyncOverlay("⚡ Cargando jugadores elegibles de la temporada...");try{await this._fetchAllMarketPlayers(!0);const h=t.querySelector("#modal-market-global");h&&(h.style.display="flex",this._renderMarketTable(t))}catch(h){console.error("Error cargando directorio seguro de traspasos:",h),alert(`❌ No se pudo cargar el mercado de esta temporada: ${h.message||h}`)}finally{this.hideSyncOverlay()}}),(ja=t.querySelector("#btn-close-market-modal"))==null||ja.addEventListener("click",()=>{const h=t.querySelector("#modal-market-global");h&&(h.style.display="none")}),(Wa=t.querySelector("#input-market-search"))==null||Wa.addEventListener("input",h=>{this.marketSearchQuery=h.target.value,this.marketCurrentPage=1,this._renderMarketTable(t)});const ot=h=>{var q;const N=t.querySelector("#user-card-modal-content");if(!N)return;const I=this.userTeamAssignments[h.email]||[],P=this.joinRequests.filter(V=>V.userEmail===h.email&&V.status==="PENDIENTE");N.innerHTML=`
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h4 style="margin: 0; font-size: 15px; color: #0f172a;">${(h.first_name||"")+" "+(h.last_name||"")||"Sin Nombre"}</h4>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${h.email}</p>
            </div>
            <span class="badge-active-team">${h.role||"INVITADO"}</span>
          </div>

          ${P.length>0?`
            <div style="background: #fff7ed; border: 1px solid #ffedd5; padding: 12px; border-radius: 8px;">
              <h5 style="margin: 0 0 8px 0; font-size: 12px; color: #c2410c;">📩 SOLICITUDES PENDIENTES DE ESTE USUARIO:</h5>
              ${P.map(V=>`
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 6px;">
                  <span>Solicita acceso a: <strong>${V.teamName||"Equipo"}</strong></span>
                  <button type="button" class="btn-approve-join-req btn-secondary-sm" data-id="${V.id}" data-email="${V.userEmail}" data-team-id="${V.teamId}" style="background: #16a34a; color: white;">🟢 Aprobar</button>
                </div>
              `).join("")}
            </div>
          `:""}

          <form id="form-save-user-teams-assignment">
            <h5 style="margin: 0 0 10px 0; font-size: 13px; color: #1e3a8a;">🛡️ EQUIPOS PERMITIDOS / ASIGNADOS:</h5>
            
            <div style="max-height: 220px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
              ${y.map(V=>{const U=I.includes(String(V.id));return`
                  <label style="display: flex; align-items: center; gap: 10px; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" class="chk-assign-team" value="${V.id}" ${U?"checked":""} />
                    <span><strong>${V.name}</strong> (${V.category||"Equipo"})</span>
                  </label>
                `}).join("")}
            </div>

            <div style="margin-top: 16px; text-align: right;">
              <button type="submit" class="btn-primary">💾 Guardar Asignación de Equipos</button>
            </div>
          </form>

        </div>
      `,N.querySelectorAll(".btn-approve-join-req").forEach(V=>{V.addEventListener("click",async U=>{var B,te;if(!((te=(B=this.auth)==null?void 0:B.can)!=null&&te.call(B,l.APPROVE_TEAM_ACCESS)))return alert("⚠️ No tienes permiso para aprobar accesos.");const z=U.currentTarget.getAttribute("data-id"),Y=U.currentTarget.getAttribute("data-email");U.currentTarget.getAttribute("data-team-id");try{await this._reviewTeamAccess(z,!0)}catch(ae){return alert(`❌ No se pudo conceder el acceso: ${ae.message}`)}alert(`🟢 Solicitud aprobada. Se ha concedido acceso a ${Y}.`),t.querySelector("#modal-user-card").style.display="none",this.render(e)})}),(q=N.querySelector("#form-save-user-teams-assignment"))==null||q.addEventListener("submit",async V=>{var z,Y;if(V.preventDefault(),!((Y=(z=this.auth)==null?void 0:z.can)!=null&&Y.call(z,l.APPROVE_TEAM_ACCESS))){alert("⚠️ No tienes permiso para asignar equipos.");return}const U=[];N.querySelectorAll(".chk-assign-team:checked").forEach(B=>{U.push(B.value)});try{await this._persistUserTeamAssignments(h.email,U)}catch(B){alert(`❌ No se pudo guardar la asignación: ${B.message}`);return}alert(`✅ Equipos actualizados correctamente para ${h.email}.`),t.querySelector("#modal-user-card").style.display="none",this.render(e)})};t.querySelectorAll(".btn-approve-join-req").forEach(h=>{h.addEventListener("click",async N=>{var V,U;N.preventDefault();const I=N.currentTarget.getAttribute("data-id"),P=N.currentTarget.getAttribute("data-email"),q=N.currentTarget.getAttribute("data-team-id");if(!((U=(V=this.auth)==null?void 0:V.can)!=null&&U.call(V,l.APPROVE_TEAM_ACCESS,{teamId:q}))){alert("⚠️ No tienes permiso para aprobar accesos a este equipo.");return}try{await this._reviewTeamAccess(I,!0)}catch(z){alert(`❌ No se pudo conceder el acceso: ${z.message}`);return}alert(`🟢 Solicitud aprobada. Se ha concedido acceso al equipo a ${P}.`),await this.render(e)})}),t.querySelectorAll(".btn-reject-join-req").forEach(h=>{h.addEventListener("click",async N=>{var P,q;N.preventDefault();const I=N.currentTarget.getAttribute("data-id");if(!((q=(P=this.auth)==null?void 0:P.can)!=null&&q.call(P,l.APPROVE_TEAM_ACCESS))){alert("⚠️ No tienes permiso para rechazar solicitudes.");return}try{await this._reviewTeamAccess(I,!1)}catch(V){alert(`❌ No se pudo rechazar la solicitud: ${V.message}`);return}alert("🔴 Solicitud de adhesión rechazada."),await this.render(e)})}),t.querySelectorAll(".btn-open-user-card").forEach(h=>{h.addEventListener("click",N=>{const I=N.currentTarget.getAttribute("data-email"),P=this.profilesList.find(q=>q.email===I);if(P){const q=t.querySelector("#modal-user-card");q&&(q.style.display="flex",ot(P))}})}),(Ha=t.querySelector("#btn-close-user-card-modal"))==null||Ha.addEventListener("click",()=>{const h=t.querySelector("#modal-user-card");h&&(h.style.display="none")}),(Ya=t.querySelector("#select-guest-active-team"))==null||Ya.addEventListener("change",async h=>{const N=h.target.value;N&&(localStorage.setItem("iq_active_team_id",N),b.isLoaded=!1,await b.init(N,!0),alert("🟢 Equipo seleccionado como activo."),window.iqApp&&(window.iqApp.teamId=N,await window.iqApp.render()))}),(Ja=t.querySelector("#select-guest-active-season"))==null||Ja.addEventListener("change",async h=>{var P;const N=h.target.value;if(!N)return;typeof b.setActiveTeamAndSeason=="function"&&b.setActiveTeamAndSeason(null,N),localStorage.setItem("iq_active_season",N),b.isLoaded=!1,await b.init(a,!0);const I=((P=h.target.options[h.target.selectedIndex])==null?void 0:P.textContent)||N;alert(`🟢 Temporada ${I} seleccionada.`),window.iqApp&&await window.iqApp.render()}),t.querySelectorAll(".btn-request-join-team").forEach(h=>{h.addEventListener("click",async N=>{const I=N.currentTarget.getAttribute("data-id"),P=N.currentTarget.getAttribute("data-name");try{await this._requestTeamAccess(I),alert(`✉️ Solicitud enviada correctamente para unirse a ${P}. La solicitud ya es visible para los administradores autorizados y el Superadmin.`),await this.render(e)}catch(q){alert(`❌ No se pudo registrar la solicitud: ${q.message}`)}})});const we=t.querySelector("#new-user-role"),Je=t.querySelector("#new-user-player-group"),Me=t.querySelector("#new-user-player"),ze=()=>{const h=(we==null?void 0:we.value)===R.JUGADOR;Je&&(Je.style.display=h?"block":"none"),Me&&(Me.required=!!h,h||(Me.value=""))};we==null||we.addEventListener("change",ze),ze();const lt=t.querySelector("#form-create-user-profile");lt&&lt.addEventListener("submit",async h=>{var ae,oe,re,he,de,ie,be,xe,Ka;h.preventDefault(),h.stopPropagation();const N=((ae=t.querySelector("#new-user-name"))==null?void 0:ae.value.trim())||"",I=(oe=t.querySelector("#new-user-email"))==null?void 0:oe.value.trim(),P=((re=t.querySelector("#new-user-role"))==null?void 0:re.value)||R.ENTRENADOR,q=((he=t.querySelector("#new-user-pass"))==null?void 0:he.value)||"",V=P===R.JUGADOR&&((de=t.querySelector("#new-user-player"))==null?void 0:de.value)||null,U=new Set([R.ENTRENADOR,R.ANALISTA,R.PREPARADOR_FISICO,R.JUGADOR,R.VISOR,R.INVITADO]),z=c&&U.has(P)?[c]:[];if(!N||!I||!q){alert("⚠️ Completa los campos obligatorios para dar de alta al usuario.");return}if(P===R.JUGADOR&&!V){alert("⚠️ Selecciona el jugador que representará esta cuenta.");return}if(!((be=(ie=this.auth)==null?void 0:ie.can)!=null&&be.call(ie,l.INVITE_USERS))){alert("⚠️ No tienes permiso para invitar usuarios.");return}if(!((Ka=(xe=this.auth)==null?void 0:xe.canAssignRole)!=null&&Ka.call(xe,P,I))){alert("⚠️ No tienes permiso para asignar ese rol. Solo scolado@nechigroup.com puede ser Superadmin.");return}const Y=N.split(" "),B=Y[0],te=Y.slice(1).join(" ");this.showSyncOverlay("⚡ Registrando usuario en la Base de Datos IQB...");try{if(!D)throw new Error("Cliente Supabase no configurado");const{data:Oe,error:pt}=await D.functions.invoke("admin-users",{body:{action:"create-user",email:I,password:q,firstName:B,lastName:te,role:P,teamIds:a?[a]:[],teamSeasonIds:z,linkedPlayerId:V}});if(pt||Oe!=null&&Oe.error){this.hideSyncOverlay(),alert(`❌ Error al crear usuario: ${(Oe==null?void 0:Oe.error)||(pt==null?void 0:pt.message)||"Error desconocido"}`);return}await this._fetchProfiles(),this.hideSyncOverlay(),alert(`✅ Usuario "${N}" (${P}) registrado con éxito.`),await this.render(e)}catch(Oe){this.hideSyncOverlay(),console.error("Error creando usuario:",Oe),alert(`❌ Error al conectar con Supabase: ${Oe.message}`)}}),t.querySelectorAll(".select-user-role").forEach(h=>{h.addEventListener("change",N=>{const I=N.currentTarget.getAttribute("data-id"),P=t.querySelector(`.user-player-link-group[data-id="${I}"]`),q=t.querySelector(`.select-user-player-link[data-id="${I}"]`),V=N.currentTarget.value===R.JUGADOR;P&&(P.style.display=V?"block":"none"),q&&(q.required=!!V,V||(q.value=""))})}),t.querySelectorAll(".btn-save-user-role").forEach(h=>{h.addEventListener("click",async N=>{var B,te,ae,oe,re,he,de;N.preventDefault();const I=N.currentTarget.getAttribute("data-id"),P=t.querySelector(`.select-user-role[data-id="${I}"]`);if(!P)return;const q=P.value,V=this.profilesList.find(ie=>String(ie.id)===String(I)),U=t.querySelector(`.select-user-player-link[data-id="${I}"]`),z=q===R.JUGADOR&&(U==null?void 0:U.value)||null,Y=((ae=(te=(B=this.auth)==null?void 0:B.getCurrentUser)==null?void 0:te.call(B))==null?void 0:ae.email)||"";if(V){if(String(V.email||"").toLowerCase()===String(Y).toLowerCase()){alert("⚠️ No puedes modificar tu propio rol.");return}if(!((re=(oe=this.auth)==null?void 0:oe.canAssignRole)!=null&&re.call(oe,q,V.email))){alert("⚠️ No tienes permiso para asignar ese rol.");return}if(q===R.JUGADOR&&!z){alert("⚠️ Para asignar el rol JUGADOR debes seleccionar qué jugador representa esta cuenta."),(he=U==null?void 0:U.focus)==null||he.call(U);return}this.showSyncOverlay("💾 Actualizando rol e identidad deportiva...");try{if(!D)throw new Error("Cliente Supabase no configurado");const{data:ie,error:be}=await D.rpc("iq_v7_assign_user_role_context",{p_user_id:I,p_role:q,p_linked_player_id:z});if(be){this.hideSyncOverlay();const xe=String(be.message||"");xe.includes("PLAYER_LINK_REQUIRED")?(alert("Para asignar el rol JUGADOR debes seleccionar primero el jugador vinculado."),(de=U==null?void 0:U.focus)==null||de.call(U)):alert(`Error actualizando rol: ${xe}`);return}V&&(V.role=(ie==null?void 0:ie.role)||q,V.global_role=((ie==null?void 0:ie.role)||q)===R.ADMIN?R.ADMIN:null,V.linked_player_id=(ie==null?void 0:ie.linked_player_id)||null),this.hideSyncOverlay(),alert(`✅ Rol actualizado a "${q}" correctamente.`),await this.render(e)}catch(ie){this.hideSyncOverlay(),console.error("Error al actualizar rol:",ie),alert(`❌ Error al conectar con Supabase: ${ie.message}`)}}})}),t.querySelectorAll(".btn-approve-transfer").forEach(h=>{h.addEventListener("click",async N=>{var q,V,U,z,Y;N.preventDefault();const I=N.currentTarget.getAttribute("data-id"),P=N.currentTarget.getAttribute("data-target-team");if(!((V=(q=this.auth)==null?void 0:q.can)!=null&&V.call(q,l.APPROVE_TRANSFER,{teamId:P}))){alert("⚠️ No tienes permiso para aprobar este traspaso.");return}try{const[B,te]=await Promise.all([this.rosterManagementService.getCapabilities(),this.transferRequestService.getCapabilities()]);if(!(B!=null&&B.ready)||!(B!=null&&B.supports_multiple_stints))throw new Error("El backend temporal de traspasos todavía no está aplicado.");if(!(te!=null&&te.ready)||!(te!=null&&te.persistent_requests))throw new Error("El backend persistente de solicitudes de traspaso todavía no está aplicado.");if(((z=(U=this.auth)==null?void 0:U.getAuthenticatedRole)==null?void 0:z.call(U))!==R.SUPERADMIN)throw new Error("Los traspasos entre equipos están restringidos temporalmente al SUPERADMIN hasta implantar la aprobación doble origen/destino.");const ae=this.transfers.find(xe=>String(xe.id)===String(I));if(!(ae!=null&&ae.id))throw new Error("La solicitud ya no está pendiente o no se pudo recuperar.");if(ae.dualWorkflow)throw new Error("Este traspaso usa revisión dual y debe gestionarse desde la Bandeja de Solicitudes.");const oe=ns(M||kt(),A.start?Ft(A.start,1):null),re=Ft(oe,-1),he=prompt("Último día elegible en el equipo de origen (AAAA-MM-DD):",re||"");if(he===null)return;const de=_e(he),ie=prompt("Primer día elegible en el equipo de destino (AAAA-MM-DD):",oe);if(ie===null)return;const be=_e(ie);if(!de||!be){alert("⚠️ Las dos fechas del traspaso deben tener formato AAAA-MM-DD.");return}if(!Be(de,v)||!Be(be,v)){alert("⚠️ Las fechas de salida y alta deben estar dentro de la temporada.");return}if(be<=de){alert("⚠️ La fecha de alta en destino debe ser posterior al último día en origen.");return}this.showSyncOverlay("⚡ Procesando traspaso temporal seguro..."),await this.transferRequestService.approveTransfer({requestId:ae.id,lastDateFrom:de,firstDateTo:be}),b.isLoaded=!1,await b.init(a,!0),this.rosterState=await this.rosterManagementService.loadForTeam(a),await this._refreshTransferRequests(((Y=this.rosterState)==null?void 0:Y.teamSeasonId)||null),this.hideSyncOverlay(),alert(`🟢 Traspaso aprobado. Último día en origen: ${de}. Alta en destino: ${be}.`),await this.render(e)}catch(B){this.hideSyncOverlay(),console.error("Error aprobando traspaso:",B),alert(`❌ Error durante el traspaso: ${B.message}`)}})}),t.querySelectorAll(".btn-reject-transfer").forEach(h=>{h.addEventListener("click",async N=>{var U,z,Y;N.preventDefault();const I=N.currentTarget.getAttribute("data-id"),P=this.transfers.find(B=>String(B.id)===String(I)),q=(P==null?void 0:P.targetTeamId)||a;if(!((z=(U=this.auth)==null?void 0:U.can)!=null&&z.call(U,l.APPROVE_TRANSFER,{teamId:q}))){alert("⚠️ No tienes permiso para rechazar este traspaso.");return}if(!(P!=null&&P.id)){alert("⚠️ La solicitud ya no está pendiente.");return}if(P.dualWorkflow){alert("⚠️ Este traspaso usa revisión dual y debe gestionarse desde la Bandeja de Solicitudes.");return}const V=prompt("Motivo del rechazo (opcional):","");if(V!==null){this.showSyncOverlay("🛑 Registrando rechazo del traspaso...");try{await this.transferRequestService.rejectTransfer({requestId:P.id,reason:V}),await this._refreshTransferRequests(((Y=this.rosterState)==null?void 0:Y.teamSeasonId)||null),this.hideSyncOverlay(),alert("🔴 Solicitud de traspaso rechazada."),await this.render(e)}catch(B){this.hideSyncOverlay(),console.error("Error rechazando traspaso:",B),alert(`❌ No se pudo rechazar el traspaso: ${B.message||B}`)}}})}),t.querySelectorAll(".btn-set-active-team").forEach(h=>{h.addEventListener("click",async N=>{var P,q;N.preventDefault();const I=N.currentTarget.getAttribute("data-id");if(I){if(!((q=(P=this.auth)==null?void 0:P.can)!=null&&q.call(P,l.SELECT_TEAM,{teamId:I}))){alert("⚠️ No tienes permiso para activar este equipo.");return}this.showSyncOverlay("⚡ Activando equipo en el sistema...");try{localStorage.setItem("iq_active_team_id",I),typeof b.setActiveTeamAndSeason=="function"&&b.setActiveTeamAndSeason(I,null),b.isLoaded=!1,await b.init(I,!0),this.hideSyncOverlay(),alert("🟢 Equipo activado correctamente."),window.iqApp&&typeof window.iqApp.render=="function"?(window.iqApp.teamId=I,await window.iqApp.render()):await this.render(e)}catch(V){this.hideSyncOverlay(),console.error("Error al activar equipo:",V)}}})});const dt=t.querySelector("#form-create-season");dt&&dt.addEventListener("submit",async h=>{var P,q;h.preventDefault();const N=t.querySelector("#input-new-season-name"),I=N==null?void 0:N.value.trim();if(I){if(!((q=(P=this.auth)==null?void 0:P.can)!=null&&q.call(P,l.MANAGE_SEASONS,{teamId:a}))){alert("⚠️ No tienes permiso para crear temporadas en este equipo.");return}this.showSyncOverlay("⚡ Registrando nueva temporada en Supabase...");try{if(!D)throw new Error("Cliente Supabase no configurado");const{data:V,error:U}=await D.from("seasons").insert([{name:I,team_id:a}]).select().single();if(U){this.hideSyncOverlay(),alert(`❌ Error al insertar temporada en Supabase: ${U.message}`);return}V&&(this.seasonsList.unshift(V),localStorage.setItem("iq_active_season",I),this._saveSeasonsLocal()),this.hideSyncOverlay(),alert(`✅ Temporada "${I}" creada con éxito.`),await this.render(e)}catch(V){this.hideSyncOverlay(),console.error("Error creando temporada:",V)}}}),t.querySelectorAll(".btn-save-season-name").forEach(h=>{h.addEventListener("click",async N=>{var V,U;const I=N.currentTarget.getAttribute("data-id"),P=t.querySelector(`.input-season-edit[data-id="${I}"]`),q=P==null?void 0:P.value.trim();if(q){if(!((U=(V=this.auth)==null?void 0:V.can)!=null&&U.call(V,l.MANAGE_SEASONS,{teamId:a}))){alert("⚠️ No tienes permiso para modificar temporadas.");return}this.showSyncOverlay("💾 Actualizando temporada...");try{if(!D)throw new Error("Supabase no configurado");await D.from("seasons").update({name:q}).eq("id",I);const z=this.seasonsList.find(Y=>String(Y.id)===String(I));z&&(z.name=q),this._saveSeasonsLocal(),this.hideSyncOverlay(),alert("✅ Nombre de temporada actualizado."),await this.render(e)}catch(z){this.hideSyncOverlay(),alert(`❌ Error: ${z.message}`)}}})}),t.querySelectorAll(".btn-activate-season").forEach(h=>{h.addEventListener("click",async N=>{const I=N.currentTarget.getAttribute("data-name");localStorage.setItem("iq_active_season",I),typeof b.setActiveTeamAndSeason=="function"&&b.setActiveTeamAndSeason(null,I),alert(`🟢 Temporada "${I}" activada.`),await this.render(e)})}),t.querySelectorAll(".btn-delete-season").forEach(h=>{h.addEventListener("click",async N=>{const I=N.currentTarget.getAttribute("data-id");if(!this._canReal("DELETE_SEASON")){alert("⚠️ Solo el Superadmin puede eliminar temporadas.");return}if(confirm("⚠️ ¿Estás seguro de eliminar esta temporada de Supabase?")){this.showSyncOverlay("🗑️ Eliminando temporada en Supabase...");try{if(!D)throw new Error("Cliente Supabase no configurado");const{error:P}=await D.from("seasons").delete().eq("id",I);if(P){this.hideSyncOverlay(),alert(`❌ No se pudo eliminar de Supabase: ${P.message}`);return}this.seasonsList=this.seasonsList.filter(q=>String(q.id)!==String(I)),this._saveSeasonsLocal(),this.hideSyncOverlay(),await this.render(e)}catch(P){this.hideSyncOverlay(),console.error("Error borrando temporada:",P)}}})}),this.activeTab==="seasons"&&this.seasonManagementView.bindEvents(t,{onBackendUnavailable:()=>{alert("ℹ️ Esta acción no está disponible para tu rol o el backend seguro no está activo.")},onChanged:async()=>{await this.render(e)},onError:h=>{alert(`❌ No se pudo completar la operación: ${(h==null?void 0:h.message)||h}`)}}),this.activeTab==="translations"&&(this.languageSettingsView.bindEvents(t),t.querySelectorAll("button, .btn-primary, .btn-save-translations").forEach(h=>{h.textContent.includes("Guardar Traducciones")&&h.addEventListener("click",async N=>{var I,P;if(N.preventDefault(),!((P=(I=this.auth)==null?void 0:I.can)!=null&&P.call(I,l.MANAGE_TRANSLATIONS))){alert("⚠️ No tienes permiso para modificar traducciones.");return}this.showSyncOverlay("💾 Guardando diccionario completo en Supabase...");try{j&&typeof j.saveAllToSupabase=="function"&&await j.saveAllToSupabase(),this.hideSyncOverlay(),alert("✅ ¡Traducciones guardadas exitosamente en la base de datos!")}catch(q){this.hideSyncOverlay(),console.error("Error guardando traducciones:",q),alert(`❌ Error al guardar traducciones: ${q.message||q}`)}})})),t.querySelectorAll(".btn-simulate-role").forEach(h=>{h.addEventListener("click",async N=>{var P,q;const I=N.currentTarget.getAttribute("data-role");if(!((q=(P=this.auth)==null?void 0:P.setPreviewRole)!=null&&q.call(P,I))){alert("⚠️ Solo el Superadmin puede simular roles.");return}this.simulatedRole=this.auth.previewRole,localStorage.setItem("iq_simulated_role",I),alert(`🎭 Simulación activada: La app muestra la interfaz de '${I}'.`),await this.render(e)})});const $e=t.querySelector("#btn-reset-simulation")||t.querySelector("#btn-stop-simulation");$e&&$e.addEventListener("click",async()=>{var h,N,I,P;(N=(h=this.auth)==null?void 0:h.clearPreviewRole)==null||N.call(h),this.simulatedRole=null,this.currentUserRole=((P=(I=this.auth)==null?void 0:I.getAuthenticatedRole)==null?void 0:P.call(I))||R.INVITADO,localStorage.removeItem("iq_simulated_role"),alert("🔴 Simulación desactivada. Volviendo a control total de SUPERADMIN."),await this.render(e)}),le&&((Qa=t.querySelector("#select-demo-role"))==null||Qa.addEventListener("change",async h=>{var I,P;const N=h.target.value;(P=(I=this.auth)==null?void 0:I.setPreviewRole)!=null&&P.call(I,N)&&(this.simulatedRole=this.auth.previewRole,localStorage.setItem("iq_simulated_role",N),await this.render(e))}))}}class Ur{constructor(){this.isAuthenticated=!1,this.userEmail="",this.userRole=R.INVITADO,this.currentRoute="dashboard",this.routeParams={},this.teamId=localStorage.getItem("iq_active_team_id")||"",this.translationsLoaded=!1,this.permissionService=new sr,this.authController=this.permissionService,this.authorizationContextService=new Er(D),this.accountStatusService=new vr(D),this._authorizationRefreshPromise=null,this.gameController=new Lr(null,this.authController,{supabase:D}),this.views={auth:new Nr,dashboard:new Pr(D,this.authController),approvals:new xr(D,this.authController),settings:new Fr(this.authController)},this.lazyViews=new Tr({supabase:D,authController:this.authController,gameController:this.gameController,i18n:se},this.views)}_getPreloadFallbackTexts(e){const t=(localStorage.getItem("iq_lang")||"es").toLowerCase(),a={es:{preload_title:"Precargando IQ Basket...",preload_subtitle:"Sincronizando plantilla, partidos y estadísticas desde la Base de Datos IQB...",changing_team:"Cambiando de equipo...",syncing_season:"Sincronizando temporada...",changing_language:"Cambiando idioma..."},ca:{preload_title:"Precarregant IQ Basket...",preload_subtitle:"Sincronitzant plantilla, partits i estadístiques des de la Base de Dades IQB...",changing_team:"Canviant d'equip...",syncing_season:"Sincronitzant temporada...",changing_language:"Canviant d'idioma..."},cat:{preload_title:"Precarregant IQ Basket...",preload_subtitle:"Sincronitzant plantilla, partits i estadístiques des de la Base de Dades IQB...",changing_team:"Canviant d'equip...",syncing_season:"Sincronitzant temporada...",changing_language:"Canviant d'idioma..."},en:{preload_title:"Preloading IQ Basket...",preload_subtitle:"Synchronizing roster, games, and statistics from the IQB Database...",changing_team:"Changing team...",syncing_season:"Synchronizing season...",changing_language:"Changing language..."},fr:{preload_title:"Préchargement de IQ Basket...",preload_subtitle:"Synchronisation de l'effectif, des matchs et des statistiques depuis la Base de Données IQB...",changing_team:"Changement d'équipe...",syncing_season:"Synchronisation de la saison...",changing_language:"Changement de langue..."}};return(a[t]||a.es)[e]||a.es[e]||e}showLoadingOverlay(e="preload_title"){const t=document.getElementById("app");if(!t)return;let a=j?j.t(e,""):"";(!a||a===e)&&(a=this._getPreloadFallbackTexts(e));let s=j?j.t("preload_subtitle",""):"";(!s||s==="preload_subtitle")&&(s=this._getPreloadFallbackTexts("preload_subtitle")),t.innerHTML=`
      <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font-family-base, system-ui); background: #f8fafc; padding: 20px; text-align: center;">
        <div style="width: 48px; height: 48px; border: 4px solid #e2e8f0; border-top-color: var(--color-primary, #f97316); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
        <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 800;">⚡ ${a}</h3>
        <p style="margin: 0; color: #64748b; font-size: 13px; max-width: 420px;">${s}</p>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `}_applyAuthenticatedUser(e,t=null){var i,n,d;if(!(e!=null&&e.email))return null;const a={...t||{},id:e.id||(t==null?void 0:t.id)||null,email:e.email,role:(t==null?void 0:t.role)||((i=e.user_metadata)==null?void 0:i.role)||R.INVITADO,first_name:(t==null?void 0:t.first_name)||((n=e.user_metadata)==null?void 0:n.first_name)||"",last_name:(t==null?void 0:t.last_name)||((d=e.user_metadata)==null?void 0:d.last_name)||""},s=this.permissionService.setCurrentUser(a);if(!s)return null;er(s.accountStatus),this.userEmail=s.email,this.userRole=s.role,this.isAuthenticated=!0,localStorage.setItem("iq_user_email",s.email),localStorage.setItem("iq_user_role",s.role),localStorage.setItem("iq_user_name",a.first_name||""),localStorage.setItem("iq_user_lastname",a.last_name||""),localStorage.removeItem("iq_simulated_role");const r=JSON.parse(localStorage.getItem("iq_user_teams_map")||"{}");return r[s.email]=s.allowedTeamIds||[],localStorage.setItem("iq_user_teams_map",JSON.stringify(r)),typeof b.setPermissionService=="function"&&b.setPermissionService(this.permissionService),s}async _enrichAuthenticatedProfile(e,t=null){const a={...t||{},id:(e==null?void 0:e.id)||(t==null?void 0:t.id)||null,email:(e==null?void 0:e.email)||(t==null?void 0:t.email)||""},s=await this.accountStatusService.getCurrentState();if(!s.active)throw new _s(s.accountStatus);a.account_status=s.accountStatus;try{return await this.authorizationContextService.enrichProfile(a)}catch(r){return console.warn("[RBAC] No se pudo cargar el contexto v3; se mantiene compatibilidad legacy:",r.message),a}}_getAccountAccessMessage(e){var t,a;if((e==null?void 0:e.code)==="ACCOUNT_NOT_ACTIVE"){const s={[Pe.SUSPENDED]:["account_suspended","Tu cuenta está suspendida. Contacta con un administrador."],[Pe.PENDING_ACTIVATION]:["account_pending_activation","Tu cuenta está pendiente de activación."],[Pe.DISABLED]:["account_disabled","Tu cuenta está desactivada. Contacta con un administrador."]},[r,i]=s[e.accountStatus]||s[Pe.DISABLED];return((t=j==null?void 0:j.t)==null?void 0:t.call(j,r,i))||i}return((a=j==null?void 0:j.t)==null?void 0:a.call(j,"account_status_unavailable","No se ha podido verificar de forma segura el estado de tu cuenta. Inténtalo de nuevo."))||"No se ha podido verificar de forma segura el estado de tu cuenta. Inténtalo de nuevo."}_isAccountSecurityError(e){return(e==null?void 0:e.code)==="ACCOUNT_NOT_ACTIVE"||(e==null?void 0:e.code)==="ACCOUNT_STATUS_LOOKUP_FAILED"||(e==null?void 0:e.message)==="ACCOUNT_STATUS_BACKEND_UNAVAILABLE"}async _closeRejectedAccountSession(e,{renderAuth:t=!1}={}){try{D&&await D.auth.signOut({scope:"local"})}catch(a){console.warn("[ACCOUNT] No se pudo cerrar la sesión rechazada:",(a==null?void 0:a.message)||a)}if(this._clearSessionContext(),t){const a=document.getElementById("app");a&&(a.innerHTML=this.views.auth.render({errorMessage:this._getAccountAccessMessage(e)}),this.bindAuthEvents())}}async refreshAuthenticatedAuthorizationContext({reason:e="runtime"}={}){return!D||!this.isAuthenticated?!1:this._authorizationRefreshPromise?this._authorizationRefreshPromise:(this._authorizationRefreshPromise=(async()=>{var t;try{const{data:a,error:s}=await D.auth.getSession(),r=(t=a==null?void 0:a.session)==null?void 0:t.user;if(s||!(r!=null&&r.email))return s&&console.warn(`[RBAC] Refresco de autorizacion (${e}) sin sesion valida:`,s.message),!1;const{data:i,error:n}=await D.from("user_profiles").select("id,email,first_name,last_name,phone,role,global_role,status,assigned_team_ids,linked_player_id,created_at").eq("email",r.email).maybeSingle();if(n)return console.warn(`[RBAC] Refresco de autorizacion (${e}) sin perfil:`,n.message),!1;const d=this.permissionService.previewRole||null,c=await this._enrichAuthenticatedProfile(r,i),u=this._applyAuthenticatedUser(r,c);return d&&(u==null?void 0:u.role)===R.SUPERADMIN&&this.permissionService.setPreviewRole(d),!!u}catch(a){return console.warn(`[RBAC] No se pudo refrescar la autorizacion (${e}):`,(a==null?void 0:a.message)||a),this._isAccountSecurityError(a)&&await this._closeRejectedAccountSession(a,{renderAuth:!0}),!1}finally{this._authorizationRefreshPromise=null}})(),this._authorizationRefreshPromise)}async restoreAuthenticatedSession(){var e;if(!D)return!1;try{const{data:t,error:a}=await D.auth.getSession();if(a||!((e=t==null?void 0:t.session)!=null&&e.user))return!1;const s=t.session.user,r=s.email||"",{data:i}=await D.from("user_profiles").select("id,email,first_name,last_name,phone,role,global_role,status,assigned_team_ids,linked_player_id,created_at").eq("email",r).maybeSingle(),n=await this._enrichAuthenticatedProfile(s,i);return this._applyAuthenticatedUser(s,n),!0}catch(t){return console.warn("[RBAC] No se pudo restaurar la sesión:",t),this._isAccountSecurityError(t)&&await this._closeRejectedAccountSession(t),!1}}bindAuthEvents(){const e=document.getElementById("auth-lang-toggle");e&&e.addEventListener("change",async d=>{const c=d.target.value;se&&typeof se.setLocale=="function"&&se.setLocale(c),j&&typeof j.setLanguage=="function"?await j.setLanguage(c):localStorage.setItem("iq_lang",c),j&&typeof j.initAllTranslations=="function"&&await j.initAllTranslations(),this.render()}),document.querySelectorAll(".pwd-toggle-btn").forEach(d=>{d.addEventListener("click",c=>{c.preventDefault(),c.stopPropagation();const u=d.getAttribute("data-target"),_=document.getElementById(u);if(_){const p=_.type==="password";_.type=p?"text":"password"}})});const t=document.getElementById("tab-btn-login"),a=document.getElementById("tab-btn-register"),s=document.getElementById("btn-switch-to-register"),r=document.getElementById("btn-switch-to-login");t&&t.addEventListener("click",()=>{this.views.auth.activeTab="login",this.render()}),a&&a.addEventListener("click",()=>{this.views.auth.activeTab="register",this.render()}),s&&s.addEventListener("click",()=>{this.views.auth.activeTab="register",this.render()}),r&&r.addEventListener("click",()=>{this.views.auth.activeTab="login",this.render()});const i=document.getElementById("login-form");i&&i.addEventListener("submit",async d=>{var _,p;d.preventDefault();const c=(_=document.getElementById("login-email"))==null?void 0:_.value.trim(),u=(p=document.getElementById("login-password"))==null?void 0:p.value;if(!c||!u){alert("⚠️ "+(j?j.t("fill_required_fields","Por favor, completa el correo y la contraseña."):"Por favor, completa el correo y la contraseña."));return}this.showLoadingOverlay("preload_title");try{if(!D)throw new Error("Supabase no configurado");const{data:m,error:f}=await D.auth.signInWithPassword({email:c,password:u});if(f||!(m!=null&&m.user)){this.isAuthenticated=!1;const x=f!=null&&f.message.includes("Invalid login credentials")?"Credenciales incorrectas: Correo electrónico o contraseña no válidos.":(f==null?void 0:f.message)||"Error al autenticar usuario.",S=document.getElementById("app");S&&(S.innerHTML=this.views.auth.render({errorMessage:x}),this.bindAuthEvents()),alert(`❌ Error de acceso: ${x}`);return}const{data:g}=await D.from("user_profiles").select("id,email,first_name,last_name,phone,role,global_role,status,assigned_team_ids,linked_player_id,created_at").eq("email",c).maybeSingle(),E=await this._enrichAuthenticatedProfile(m.user,g);if(!this._applyAuthenticatedUser(m.user,E))throw new Error("No se pudo resolver el perfil de autorización.");await b.init(this.teamId,!0),this.render()}catch(m){if(console.error("Excepción en inicio de sesión:",m),this._isAccountSecurityError(m)){const f=this._getAccountAccessMessage(m);await this._closeRejectedAccountSession(m,{renderAuth:!0}),alert(`⛔ ${f}`);return}this.isAuthenticated=!1,alert("❌ Ocurrió un error inesperado al validar las credenciales."),this.render()}});const n=document.getElementById("register-form");n&&n.addEventListener("submit",async d=>{var f,g,E,T;d.preventDefault();const c=(f=document.getElementById("reg-firstname"))==null?void 0:f.value.trim(),u=(g=document.getElementById("reg-lastname"))==null?void 0:g.value.trim(),_=(E=document.getElementById("reg-email"))==null?void 0:E.value.trim(),p=(T=document.getElementById("reg-password"))==null?void 0:T.value,m="INVITADO";if(!c||!u||!_||!p){alert("⚠️ "+(j?j.t("fill_required_fields","Por favor, completa todos los campos obligatorios."):"Por favor, completa todos los campos obligatorios."));return}this.showLoadingOverlay("preload_title");try{if(!D)throw new Error("Supabase no configurado");const{data:x,error:S}=await D.auth.signUp({email:_,password:p,options:{data:{first_name:c,last_name:u,role:m}}});if(S){this.render(),alert(`❌ No se pudo completar el registro: ${S.message}`);return}const M=await this._enrichAuthenticatedProfile(x.user,{email:_,first_name:c,last_name:u,role:m});if(!this._applyAuthenticatedUser(x.user,M))throw new Error("No se pudo inicializar el perfil INVITADO.");alert(`✅ ¡Bienvenido ${c}! Tu cuenta ha sido creada con perfil INVITADO (Demo / acceso limitado).`),await b.init(this.teamId,!0),this.render()}catch(x){console.error("Excepción en registro:",x),alert(`❌ Error durante el registro: ${x.message}`),this.render()}})}_clearSessionContext(){this.isAuthenticated=!1,this.userEmail="",this.userRole=R.INVITADO,this.teamId="",this.currentRoute="dashboard",this.routeParams={},this.permissionService.clear(),b.isLoaded=!1,["iq_user_email","iq_user_role","iq_user_name","iq_user_lastname","iq_user_phone","iq_user_teams_map","iq_simulated_role","iq_active_team_id","iq_active_season"].forEach(t=>localStorage.removeItem(t)),sessionStorage.removeItem("iq_sidebar_scroll"),document.body.style.overflow=""}bindLayoutEvents(){const e=document.getElementById("app");e&&e.dataset.sessionActionsBound!=="true"&&(e.dataset.sessionActionsBound="true",e.addEventListener("click",async _=>{var m,f;const p=(f=(m=_.target).closest)==null?void 0:f.call(m,'[data-session-action="logout"]');if(!(!p||!e.contains(p))&&(_.preventDefault(),_.stopPropagation(),p.dataset.logoutBusy!=="true")){p.dataset.logoutBusy="true",p.disabled=!0,p.setAttribute("aria-busy","true");try{if(D){const{error:g}=await D.auth.signOut({scope:"local"});g&&console.warn("Nota al cerrar sesión:",g.message||g)}}catch(g){console.warn("Nota al cerrar sesión:",g)}this._clearSessionContext(),window.location.hash!=="#/dashboard"&&window.history.replaceState(null,"","#/dashboard"),await this.render()}}));const t=async _=>{const p=_.target.value;se&&typeof se.setLocale=="function"&&se.setLocale(p),j&&typeof j.setLanguage=="function"?await j.setLanguage(p):localStorage.setItem("iq_lang",p),this.showLoadingOverlay("changing_language"),j&&typeof j.initAllTranslations=="function"&&await j.initAllTranslations();const m=document.getElementById("app");m&&(m.innerHTML=""),this.render()},a=document.getElementById("select-lang-toggle"),s=document.getElementById("mobile-select-lang-toggle");a&&!a.dataset.bound&&(a.dataset.bound="true",a.addEventListener("change",t)),s&&!s.dataset.bound&&(s.dataset.bound="true",s.addEventListener("change",t));const r=async _=>{const p=_.target.value;let m=this.permissionService.can(l.SELECT_TEAM,{teamId:p});if(m||(await this.refreshAuthenticatedAuthorizationContext({reason:"team_change"}),m=this.permissionService.can(l.SELECT_TEAM,{teamId:p})),!m){alert("No tienes permiso para acceder a este equipo."),this.render();return}this.teamId=p,localStorage.setItem("iq_active_team_id",p),this.showLoadingOverlay("changing_team"),typeof b.setActiveTeamAndSeason=="function"&&b.setActiveTeamAndSeason(p,null),b.isLoaded=!1,await b.init(p,!0),this.render()},i=document.getElementById("sidebar-select-team"),n=document.getElementById("mobile-select-team");i&&!i.dataset.bound&&(i.dataset.bound="true",i.addEventListener("change",r)),n&&!n.dataset.bound&&(n.dataset.bound="true",n.addEventListener("change",r));const d=async _=>{const p=_.target.value;localStorage.setItem("iq_active_season",p),await this.refreshAuthenticatedAuthorizationContext({reason:"season_change"}),this.showLoadingOverlay("syncing_season"),typeof b.setActiveTeamAndSeason=="function"&&b.setActiveTeamAndSeason(null,p),b.isLoaded=!1,await b.init(this.teamId,!0),this.render()},c=document.getElementById("sidebar-select-season"),u=document.getElementById("mobile-select-season");c&&!c.dataset.bound&&(c.dataset.bound="true",c.addEventListener("change",d)),u&&!u.dataset.bound&&(u.dataset.bound="true",u.addEventListener("change",d)),window.isHashBound||(window.isHashBound=!0,window.onhashchange=async()=>{if(window.hasUnsavedChanges){if(!confirm("⚠️ Tienes cambios sin guardar. Si cambias de pantalla se perderán las modificaciones. ¿Deseas salir sin guardar?")){window.location.hash=`#/${this.currentRoute}`;return}window.hasUnsavedChanges=!1}await this.parseHashRoute(),await this.render()})}async parseHashRoute(){var n,d,c;const e=window.location.hash.replace("#/","").trim();if(!e){this.currentRoute="dashboard",this.routeParams={};return}const t=e.split("/"),a=t[0].toLowerCase(),s=Zs[a],r=["player360","player-360","desarrollo-jugador","nutrition","nutricion"].includes(a)&&t[1]||null,i={teamId:this.teamId||((n=b.getActiveTeamId)==null?void 0:n.call(b))||null,teamSeasonId:((d=b.getActiveTeamSeasonId)==null?void 0:d.call(b))||null,playerId:r,playerTeamId:this.teamId||((c=b.getActiveTeamId)==null?void 0:c.call(b))||null};if(s&&this.isAuthenticated){let u=this.permissionService.canPreview(s,i);if(u||(await this.refreshAuthenticatedAuthorizationContext({reason:`route:${a}`}),u=this.permissionService.canPreview(s,i)),!u){alert("Tu perfil no tiene acceso a esta seccion. Has sido redirigido al Dashboard."),window.location.hash="#/dashboard",this.currentRoute="dashboard",this.routeParams={};return}}this.currentRoute=a,this.routeParams={id:t[1]||null}}renderPlaceholder(e,t=""){const a=document.getElementById("dashboard-content-area");a&&(a.innerHTML=`
        <div style="padding: 24px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; font-family: var(--font-family-base, system-ui);">
          <h2 style="margin: 0 0 8px 0; color: #0f172a;">${e}</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">
            ${t?`Sección en desarrollo para la temporada 2026. Requiere <code>src/views/${t}.js</code>`:"Sección en desarrollo para la temporada 2026."}
          </p>
        </div>
      `)}async render(){var n,d,c,u,_;const e=document.getElementById("app");if(!e)return;if(!this.translationsLoaded&&j&&typeof j.initAllTranslations=="function"&&(await j.initAllTranslations(),this.translationsLoaded=!0),!this.isAuthenticated){e.innerHTML=this.views.auth.render(),this.bindAuthEvents();return}this.userRole=this.permissionService.getEffectiveRole({teamId:this.teamId||((n=b.getActiveTeamId)==null?void 0:n.call(b))||null,teamSeasonId:((d=b.getActiveTeamSeasonId)==null?void 0:d.call(b))||null}),(c=this.permissionService.getCurrentUser())!=null&&c.email;const t=b.getTeams()||[],a=this.permissionService.getAuthenticatedRole()===R.SUPERADMIN?t:t.filter(p=>this.permissionService.canAccessTeam(p.id));let s=localStorage.getItem("iq_active_team_id");this.permissionService.getAuthenticatedRole()!==R.SUPERADMIN&&a.length>0&&(a.some(m=>String(m.id)===String(s))||(s=a[0].id,localStorage.setItem("iq_active_team_id",s))),this.teamId=s||this.teamId,(!b.isLoaded||b.getActiveTeamId()!==this.teamId)&&(this.showLoadingOverlay("preload_title"),await b.init(this.teamId,!0)),this.userRole=this.permissionService.getEffectiveRole({teamId:this.teamId||((u=b.getActiveTeamId)==null?void 0:u.call(b))||null,teamSeasonId:((_=b.getActiveTeamSeasonId)==null?void 0:_.call(b))||null}),e.innerHTML=Q.wrap('<div id="dashboard-content-area"></div>',this.currentRoute,this.userRole),Q.bindMobileDrawerEvents(),this.bindLayoutEvents(),Q.updateActiveMenu(this.currentRoute);const r=this.currentRoute,i="dashboard-content-area";switch(r){case"dashboard":this.views.dashboard&&await this.views.dashboard.render(i,this.teamId);break;case"team":case"equipo":{await(await this.lazyViews.get("team")).render(i,this.teamId);break}case"live":case"hud":case"live-hud":case"easy-entry":case"easy":case"entrada-facil":case"live-entry":await(await this.lazyViews.create("livehud",{gameId:this.routeParams.id||null})).render(i);break;case"approvals":case"requests":case"solicitudes":case"bandeja":this.views.approvals&&await this.views.approvals.render(i);break;case"games":case"partidos":case"game":{await(await this.lazyViews.get("liveeditor")).render(i,this.routeParams.id,this.teamId);break}case"advanced":{await(await this.lazyViews.get("advanced")).render(i);break}case"heatmap":case"calor":case"shotchart":{await(await this.lazyViews.get("heatmap")).render(i,this.teamId);break}case"boxscore":case"registro":{await(await this.lazyViews.get("boxscore")).render(i,this.routeParams.id);break}case"players":case"jugadores":case"player":case"jugador":{await(await this.lazyViews.get("player")).render(i,this.routeParams.id,this.teamId);break}case"lineups":case"quintetos":{await(await this.lazyViews.get("lineups")).render(i);break}case"training":case"entrenamientos":case"development":case"desarrollo":{await(await this.lazyViews.get("training")).render(i,this.teamId);break}case"nutrition":case"nutricion":{await(await this.lazyViews.get("nutrition")).render(i,this.routeParams.id,this.teamId);break}case"player360":case"player-360":case"desarrollo-jugador":{await(await this.lazyViews.get("player360")).render(i,this.routeParams.id,this.teamId);break}case"comparator":case"comparador":{await(await this.lazyViews.get("comparator")).render(i);break}case"reports":case"informes":case"informe":{await(await this.lazyViews.get("reports")).render(i);break}case"family":case"familia":case"familias":{await(await this.lazyViews.get("familyworkspace")).render(i,this.routeParams);break}case"family-advisor":case"bienestar":case"advisor":{await(await this.lazyViews.get("familyadvisor")).render(i);break}case"business":case"negocio":{await(await this.lazyViews.get("business")).render(i);break}case"ask":case"ask-ai":case"pregunta":case"preguntale":case"ai":case"ia":{await(await this.lazyViews.get("ask")).render(i);break}case"profile":case"perfil":{await(await this.lazyViews.get("profile")).render(i);break}case"privacy":case"privacy-center":case"privacidad":{await(await this.lazyViews.get("privacy")).render(i);break}case"settings":case"configuracion":case"translations":this.views.settings&&await this.views.settings.render(i);break;default:this.renderPlaceholder(`Módulo ${r.toUpperCase()}`);break}}}document.addEventListener("DOMContentLoaded",async()=>{const o=new Ur;window.iqApp=o,await o.restoreAuthenticatedSession(),await o.parseHashRoute(),await o.render()});const zr=".easy-entry-wrapper",Gr="[data-match-capture-status]",Br="[data-match-capture-floating-undo]",As="iqbasket.matchCapture.mode";let Ut=!1;function jr(){return typeof navigator<"u"&&typeof navigator.vibrate=="function"}function Kt(o=12){try{jr()&&navigator.vibrate(o)}catch{}}function Is(o){const e=[...o.querySelectorAll(".player-card-btn")];return e.find(t=>t.getAttribute("aria-pressed")==="true")||e.find(t=>t.classList.contains("active-player"))||null}function Wr(o){const e=Is(o);return e?String(e.getAttribute("data-player-name")||e.textContent||"").trim():""}function os(o){return!!o.querySelector('.mode-selector-btn[data-mode="rapido"].active-mode')}function Hr(o){const e=o.querySelector(".mode-selector-btn.active-mode");return(e==null?void 0:e.getAttribute("data-mode"))||""}function Yr(o){var s,r;o.classList.add("match-capture-v2");const e=o.querySelectorAll(".player-card-btn");if(e.length){const i=e[0].parentElement;i==null||i.classList.add("match-capture-player-grid"),(s=i==null?void 0:i.parentElement)==null||s.classList.add("match-capture-player-panel")}o.querySelectorAll(".action-btn").forEach(i=>{var c;const n=i.parentElement;if(!n)return;n.classList.add("match-capture-action-grid");const d=n.querySelectorAll(":scope > .action-btn").length;n.dataset.actionCount=String(d),(c=n.parentElement)==null||c.classList.add("match-capture-action-group")});const t=o.querySelectorAll(".mode-selector-btn");t.length&&((r=t[0].parentElement)==null||r.classList.add("match-capture-mode-switcher"));const a=o.querySelectorAll(".action-btn");if(a.length){let i=a[0].parentElement;for(;i&&i!==o;){if(i.tagName==="SECTION"){i.classList.add("match-capture-action-panel");break}i=i.parentElement}}}function Ts(o){let e=o.querySelector(Gr);if(e)return e;e=document.createElement("div"),e.className="match-capture-status",e.dataset.matchCaptureStatus="true",e.setAttribute("role","status"),e.setAttribute("aria-live","polite");const t=o.querySelector("#entry-main-content");return t!=null&&t.parentElement?t.parentElement.insertBefore(e,t):o.prepend(e),e}function zt(o,e,t){if(!o)return;const a=`${e}:${t}`;o.dataset.renderSignature!==a&&(o.dataset.renderSignature=a,o.dataset.step=e,o.innerHTML=t)}function Ns(o){let e=o.querySelector(Br);return e||(e=document.createElement("button"),e.type="button",e.className="match-capture-floating-undo",e.dataset.matchCaptureFloatingUndo="true",e.setAttribute("aria-label","Deshacer última acción"),e.innerHTML='<span aria-hidden="true">↩</span><span>Deshacer</span>',e.addEventListener("click",()=>{const t=o.querySelector("#btn-undo");!t||t.disabled||(Kt([10,20,10]),t.click())}),o.appendChild(e),e)}function Rs(o){var r;const e=Ns(o),t=o.querySelector("#btn-undo"),a=Number(((r=o.querySelector("#action-count"))==null?void 0:r.textContent)||0),s=!t||t.disabled||a<=0;e.disabled=s,e.setAttribute("aria-disabled",String(s))}function Zt(o){const e=Is(o);o.querySelectorAll(".player-card-btn").forEach(s=>{const r=s===e;s.setAttribute("aria-pressed",String(r)),s.classList.toggle("match-capture-player-selected",r)});const t=Wr(o);o.querySelectorAll(".action-btn").forEach(s=>{os(o)?(s.disabled=!t,s.setAttribute("aria-disabled",String(!t))):(s.disabled=!1,s.removeAttribute("aria-disabled"));const r=String(s.textContent||"Acción").trim(),i=t?`${r} · ${t}`:`${r} · selecciona primero un jugador`;s.getAttribute("aria-label")!==i&&s.setAttribute("aria-label",i)});const a=Ts(o);if(!os(o)){zt(a,"mode","<strong>Captura de partido</strong><span>Elige el modo que mejor encaje con la tarea.</span>");return}t?zt(a,"action",`<strong>2 · Registra acción</strong><span>${Jr(t)} seleccionado.</span>`):zt(a,"player","<strong>1 · Elige jugador</strong><span>Después podrás registrar la acción con un solo toque.</span>")}function Jr(o=""){return String(o).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function Qr(o){if(o)try{sessionStorage.setItem(As,o)}catch{}}function Kr(){try{return sessionStorage.getItem(As)||""}catch{return""}}function Zr(o){if(typeof matchMedia!="function"||!matchMedia("(max-width: 768px)").matches)return;const e=Kr();if(!e||Hr(o)===e)return;const a=o.querySelector(`.mode-selector-btn[data-mode="${CSS.escape(e)}"]`);a==null||a.click()}function Xr(o){o.dataset.matchCaptureBound!=="true"&&(o.dataset.matchCaptureBound="true",o.addEventListener("click",e=>{var r,i,n,d,c,u;const t=(i=(r=e.target).closest)==null?void 0:i.call(r,".player-card-btn");if(t&&o.contains(t)){o.querySelectorAll(".player-card-btn").forEach(_=>{_.setAttribute("aria-pressed",String(_===t))}),Kt(10),queueMicrotask(()=>Zt(o));return}const a=(d=(n=e.target).closest)==null?void 0:d.call(n,".action-btn");if(a&&o.contains(a)&&!a.disabled){Kt(14),queueMicrotask(()=>{Rs(o),Zt(o)});return}const s=(u=(c=e.target).closest)==null?void 0:u.call(c,".mode-selector-btn");s&&o.contains(s)&&(Qr(s.getAttribute("data-mode")),queueMicrotask(()=>ws(o)))}))}function ws(o){o!=null&&o.isConnected&&(Yr(o),Ts(o),Ns(o),Xr(o),Zt(o),Rs(o),Zr(o))}function Xt(){document.querySelectorAll(zr).forEach(ws)}function ei(){if(Ut)return;Ut=!0;const o=()=>{Ut=!1,Xt()};typeof requestAnimationFrame=="function"?requestAnimationFrame(o):setTimeout(o,0)}typeof document<"u"&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",Xt,{once:!0}):Xt(),new MutationObserver(ei).observe(document.documentElement,{childList:!0,subtree:!0}));function ls(o,e){const t=String(o||"").trim();if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t))throw new Error(`GamePlayStateService: ${e} inválido.`);return t}class ti{constructor(e=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e}_ready(){var e;if(!((e=this.supabase)!=null&&e.rpc))throw new Error("GamePlayStateService: backend no disponible.")}async snapshot(e){this._ready();const{data:t,error:a}=await this.supabase.rpc("iq_v13_game_play_state_snapshot",{p_game_id:ls(e,"gameId")});if(a)throw new Error(a.message||"No se pudo leer el estado del partido.");return t||{}}async transition({gameId:e,targetState:t,reason:a=null}){this._ready();const s=String(t||"").trim().toUpperCase();if(!/^(SCHEDULED|READY|LIVE|FINISHED|CANCELLED)$/.test(s))throw new Error("GamePlayStateService: estado destino inválido.");const{data:r,error:i}=await this.supabase.rpc("iq_v13_set_game_play_state",{p_game_id:ls(e,"gameId"),p_target_state:s,p_reason:a?String(a).trim():null});if(i)throw new Error(i.message||"No se pudo cambiar el estado del partido.");return r||{}}}const X=Object.freeze({SCHEDULED:"SCHEDULED",READY:"READY",LIVE:"LIVE",FINISHED:"FINISHED",CANCELLED:"CANCELLED"}),xs=Object.freeze({[X.SCHEDULED]:"Programado",[X.READY]:"Preparado",[X.LIVE]:"En juego",[X.FINISHED]:"Finalizado",[X.CANCELLED]:"Cancelado"});Object.freeze({[X.SCHEDULED]:Object.freeze([X.READY,X.CANCELLED]),[X.READY]:Object.freeze([X.SCHEDULED,X.LIVE,X.CANCELLED]),[X.LIVE]:Object.freeze([X.FINISHED]),[X.FINISHED]:Object.freeze([]),[X.CANCELLED]:Object.freeze([])});function Os(o){const e=String(o||"").trim().toUpperCase();return Object.values(X).includes(e)?e:X.SCHEDULED}function ai({playState:o,editState:e="OPEN"}={}){const t=Os(o),a=String(e||"OPEN").trim().toUpperCase()==="LOCKED"?"LOCKED":"OPEN";return Object.freeze({playState:t,editState:a,canCapture:t===X.LIVE&&a==="OPEN",canCorrect:t===X.FINISHED&&a==="OPEN",historical:t===X.FINISHED&&a==="LOCKED"})}const si=new ti(D),ds="data-game-play-state-v2";let Nt=!1,Gt=!1;const ri=Object.freeze({[X.READY]:l.PREPARE_GAME,[X.SCHEDULED]:l.PREPARE_GAME,[X.LIVE]:l.START_GAME,[X.FINISHED]:l.FINISH_GAME,[X.CANCELLED]:l.CANCEL_GAME});function ii(){const o=String(window.location.hash||"").match(/^#\/(?:easy-entry|entrada-facil|live-entry|live|hud|live-hud)\/([0-9a-f-]{36})(?:$|[/?])/i);return(o==null?void 0:o[1])||null}function ni(){var e;const o=ii();return o&&(((e=b.getGames)==null?void 0:e.call(b))||[]).find(t=>String(t.id)===String(o))||null}function oi(o){var a,s;if(!o)return null;const e=o.team_id||o.teamId||((a=b.getActiveTeamId)==null?void 0:a.call(b))||null,t=o.team_season_id||o.teamSeasonId||((s=b.getActiveTeamSeasonId)==null?void 0:s.call(b,e))||null;return{teamId:e,teamSeasonId:t,gameId:o.id}}function Ps(o,e){var s,r;const t=oi(o),a=ri[e];return!a||!(t!=null&&t.teamId)||!(t!=null&&t.teamSeasonId)?!1:!!((r=(s=b.permissionService)==null?void 0:s.canPreview)!=null&&r.call(s,a,t))}function li(o,e){return(()=>{switch(e){case X.SCHEDULED:return[{to:X.READY,label:"Preparar partido",kind:"primary"}];case X.READY:return[{to:X.SCHEDULED,label:"Volver a programado",kind:"secondary"},{to:X.LIVE,label:"Iniciar partido",kind:"primary"}];case X.LIVE:return[{to:X.FINISHED,label:"Finalizar partido",kind:"danger"}];default:return[]}})().filter(a=>Ps(o,a.to))}function di(o){return o.historical?"Partido finalizado y bloqueado: histórico en solo lectura.":o.canCorrect?"Partido finalizado: las correcciones siguen permitidas hasta cerrar el acta.":o.canCapture?"Partido en juego: captura activa.":o.playState===X.READY?"Preparado para empezar; todavía no está en juego.":o.playState===X.CANCELLED?"Partido cancelado.":"Partido programado."}function ci(o,e,t,a){return JSON.stringify({gameId:String((o==null?void 0:o.id)||""),playState:e,editState:t,actions:a.map(s=>s.to),busy:Nt})}function Ls(o,e){if(!o||!e)return;const t=Os(e.play_state||e.playState),a=String(e.edit_state||e.editState||"OPEN").toUpperCase(),s=ai({playState:t,editState:a}),r=a==="LOCKED"?[]:li(e,t);let i=o.querySelector(`[${ds}]`);if(!i){i=document.createElement("section"),i.setAttribute(ds,"true"),i.className="game-play-state-v2";const d=o.querySelector("#entry-main-content");d?d.insertAdjacentElement("beforebegin",i):o.prepend(i)}const n=ci(e,t,a,r);i.dataset.renderSignature!==n&&(i.dataset.playState=t,i.dataset.editState=a,i.dataset.renderSignature=n,i.innerHTML=`
    <div class="game-play-state-copy">
      <span class="game-play-state-badge">${xs[t]||t}</span>
      <div><strong>${di(s)}</strong><small>Estado deportivo y bloqueo de edición son controles independientes.</small></div>
    </div>
    ${r.length?`<div class="game-play-state-actions">${r.map(d=>`
      <button type="button" data-game-play-target="${d.to}" data-kind="${d.kind}">${d.label}</button>
    `).join("")}</div>`:""}
    <div class="game-play-state-feedback" data-game-play-feedback role="status" aria-live="polite"></div>
  `,ui(i,e))}function cs(o,e,t="info"){const a=o.querySelector("[data-game-play-feedback]");a&&(a.textContent!==e&&(a.textContent=e),a.dataset.type=t)}function ui(o,e){o.querySelectorAll("[data-game-play-target]").forEach(t=>{t.addEventListener("click",async()=>{if(Nt)return;const a=t.dataset.gamePlayTarget;if(!Ps(e,a))return;const s=xs[a]||a;if(!(a===X.FINISHED&&!confirm("¿Finalizar el partido? El acta seguirá abierta para correcciones hasta que se bloquee por separado."))){Nt=!0,o.querySelectorAll("button").forEach(r=>{r.disabled=!0}),cs(o,`Cambiando a ${s}…`);try{const r=await si.transition({gameId:e.id,targetState:a});e.play_state=r.play_state||a,e.playState=e.play_state,e.status=r.legacy_status||e.status,e.play_state_changed_at=r.changed_at||new Date().toISOString()}catch(r){cs(o,(r==null?void 0:r.message)||"No se pudo cambiar el estado.","error"),o.querySelectorAll("button").forEach(i=>{i.disabled=!1});return}finally{Nt=!1}o.dataset.renderSignature="",Ls(o.closest(".easy-entry-wrapper"),e)}})})}function ea(){const o=ni(),e=document.querySelector(".easy-entry-wrapper");!o||!e||Ls(e,o)}function pi(){if(Gt)return;Gt=!0;const o=()=>{Gt=!1,ea()};typeof requestAnimationFrame=="function"?requestAnimationFrame(o):setTimeout(o,0)}if(typeof window<"u"&&typeof document<"u"){window.addEventListener("hashchange",()=>queueMicrotask(ea));const o=()=>{ea(),new MutationObserver(pi).observe(document.documentElement,{childList:!0,subtree:!0})};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o,{once:!0}):o()}const rt=".p360w-editor",mi=".p360w-metric",Cs=".p360w-input",us="data-wellness-cards-enhanced";function Ds(o=10){try{typeof navigator<"u"&&typeof navigator.vibrate=="function"&&navigator.vibrate(o)}catch{}}function fi(o=""){return String(o).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function gi(o){var e;return String(((e=o==null?void 0:o.dataset)==null?void 0:e.metricCode)||"").trim().toUpperCase()}function _i(o){if(!(o instanceof HTMLSelectElement)||String(o.dataset.valueType||"").toUpperCase()!=="SCALE")return!1;const e=[...o.options].map(t=>t.value).filter(t=>t!=="").map(Number).filter(Number.isFinite);return e.length>=2&&e.length<=7}function hi(o,e){if(String(o.dataset.valueType||"").toUpperCase()==="BOOLEAN"){if(e.value==="true")return"Sí";if(e.value==="false")return"No"}return String(e.textContent||e.value).trim()}function Ms(o){o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))}function ta(o,e){const t=String(e.value??"");o.querySelectorAll("[data-wellness-card-value]").forEach(a=>{const s=String(a.dataset.wellnessCardValue??"")===t;a.classList.toggle("wellness-card-option-selected",s),a.setAttribute("aria-checked",String(s)),a.setAttribute("aria-pressed",String(s))})}function bi(o,e){var r,i;if(!(e instanceof HTMLSelectElement))return!1;const t=String(e.dataset.valueType||"").toUpperCase();if(!["BOOLEAN","CHOICE","SCALE"].includes(t)||t==="SCALE"&&!_i(e))return!1;const a=[...e.options].filter(n=>n.value!=="");if(!a.length)return!1;const s=document.createElement("div");return s.className=`wellness-card-options wellness-card-options-${t.toLowerCase()}`,s.setAttribute("role","radiogroup"),s.setAttribute("aria-label",((i=(r=o.querySelector(".p360w-metric-name"))==null?void 0:r.textContent)==null?void 0:i.trim())||"Selecciona un valor"),a.forEach(n=>{const d=document.createElement("button");d.type="button",d.className="wellness-card-option",d.dataset.wellnessCardValue=n.value,d.setAttribute("role","radio"),d.innerHTML=`<strong>${fi(hi(e,n))}</strong>`,d.addEventListener("click",()=>{e.value=n.value,Ds(10),ta(o,e),Ms(e),it(o.closest(rt))}),s.appendChild(d)}),e.classList.add("wellness-card-source"),e.setAttribute("aria-hidden","true"),e.tabIndex=-1,e.insertAdjacentElement("afterend",s),ta(o,e),!0}function Ei(o,e){if(!(e instanceof HTMLInputElement)||gi(e)!=="SLEEP_DURATION_HOURS")return!1;const t=document.createElement("div");return t.className="wellness-card-quick-values",t.setAttribute("aria-label","Horas de sueño rápidas"),[6,7,8,9].forEach(a=>{const s=document.createElement("button");s.type="button",s.className="wellness-card-quick-value",s.dataset.wellnessQuickValue=String(a),s.textContent=`${a} h`,s.addEventListener("click",()=>{e.value=String(a),Ds(8),Ms(e),Rt(o,e),it(o.closest(rt))}),t.appendChild(s)}),e.insertAdjacentElement("afterend",t),e.addEventListener("input",()=>{Rt(o,e),it(o.closest(rt))}),Rt(o,e),!0}function Rt(o,e){const t=Number(e.value);o.querySelectorAll("[data-wellness-quick-value]").forEach(a=>{const s=Number(a.dataset.wellnessQuickValue)===t;a.classList.toggle("wellness-card-option-selected",s),a.setAttribute("aria-pressed",String(s))})}function vi(o){if(!o)return null;let e=o.querySelector("[data-wellness-checkin-progress]");if(e)return e;e=document.createElement("div"),e.className="wellness-checkin-progress",e.dataset.wellnessCheckinProgress="true",e.setAttribute("role","status"),e.setAttribute("aria-live","polite");const t=o.querySelector(".p360w-head");return t?t.insertAdjacentElement("afterend",e):o.prepend(e),e}function it(o){if(!o)return;const e=[...o.querySelectorAll(Cs)];if(!e.length)return;const t=e.filter(i=>String(i.value??"").trim()!=="").length,a=vi(o);if(!a)return;const s=`
    <span><strong>Check-in express</strong> · ${t}/${e.length} respondidas</span>
    <span class="wellness-checkin-time">≈ 30 s · puedes dejar métricas sin responder</span>
  `;a.innerHTML!==s&&(a.innerHTML=s);const r=String(t===e.length);a.dataset.complete!==r&&(a.dataset.complete=r)}function yi(o){if(!o||o.getAttribute(us)==="true")return;const e=o.querySelector(Cs);if(!e)return;o.setAttribute(us,"true"),o.classList.add("wellness-card-metric"),bi(o,e)||Ei(o,e),e.addEventListener("change",()=>{ta(o,e),Rt(o,e),it(o.closest(rt))})}function Si(o){o!=null&&o.isConnected&&(o.classList.add("wellness-cards-v1"),o.querySelectorAll(mi).forEach(yi),it(o))}function ps(){document.querySelectorAll(rt).forEach(Si)}if(typeof document<"u"){const o=()=>{ps();let e=!1;const t=()=>{e=!1,ps()};new MutationObserver(()=>{e||(e=!0,typeof requestAnimationFrame=="function"?requestAnimationFrame(t):setTimeout(t,0))}).observe(document.documentElement,{childList:!0,subtree:!0})};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o,{once:!0}):o()}function at(o,e){const t=String(o||"").trim();if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t))throw new Error(`PlayerJourneyService: ${e} inválido.`);return t}class Ai{constructor(e=null){this.supabase=(e==null?void 0:e.supabase)||(e==null?void 0:e.default)||e}_assertReady(){var e;if(!((e=this.supabase)!=null&&e.rpc))throw new Error("PlayerJourneyService: backend no disponible.")}async snapshot({teamSeasonId:e,playerId:t}){this._assertReady();const{data:a,error:s}=await this.supabase.rpc("iq_v12_player_journey_snapshot",{p_team_season_id:at(e,"teamSeasonId"),p_player_id:at(t,"playerId")});if(s)throw new Error(s.message||"No se pudo cargar Mi camino.");return a||{}}async start({teamSeasonId:e,playerId:t,challengeCode:a}){this._assertReady();const s=String(a||"").trim().toUpperCase();if(!/^[A-Z][A-Z0-9_]{1,63}$/.test(s))throw new Error("PlayerJourneyService: challengeCode inválido.");const{data:r,error:i}=await this.supabase.rpc("iq_v12_player_journey_start",{p_team_season_id:at(e,"teamSeasonId"),p_player_id:at(t,"playerId"),p_challenge_code:s});if(i)throw new Error(i.message||"No se pudo iniciar el micro-reto.");return r||{}}async complete(e){this._assertReady();const{data:t,error:a}=await this.supabase.rpc("iq_v12_player_journey_complete",{p_challenge_id:at(e,"challengeId")});if(a)throw new Error(a.message||"No se pudo completar el micro-reto.");return t||{}}}const St=Object.freeze({EXPLORING:"EXPLORING",BUILDING:"BUILDING",CONSOLIDATING:"CONSOLIDATING",OWNING_PROCESS:"OWNING_PROCESS"}),Ii=Object.freeze({[St.EXPLORING]:"Empieza tu camino",[St.BUILDING]:"Construyendo hábitos de mejora",[St.CONSOLIDATING]:"Consolidando tu proceso",[St.OWNING_PROCESS]:"Liderando tu desarrollo"}),nt="player-journey-v1",aa=new Ai(D);let Bt="";function Te(o=""){return String(o??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function Ti(){const o=String(window.location.hash||"").match(/^#\/(?:player|jugador)\/([0-9a-f-]{36})(?:$|[/?])/i);return(o==null?void 0:o[1])||null}function Ni(){var r,i,n,d;const o=b.permissionService,e=((r=o==null?void 0:o.getCurrentUser)==null?void 0:r.call(o))||null;if(!e||((i=o==null?void 0:o.getAuthenticatedRole)==null?void 0:i.call(o))!==R.JUGADOR)return null;const t=Ti();if(!t||String(e.playerId||"")!==String(t))return null;const a=((n=b.getActiveTeamId)==null?void 0:n.call(b))||null,s=((d=b.getActiveTeamSeasonId)==null?void 0:d.call(b,a))||null;return!a||!s?null:{playerId:t,teamId:a,teamSeasonId:s}}function ms(o=10){try{typeof(navigator==null?void 0:navigator.vibrate)=="function"&&navigator.vibrate(o)}catch{}}function Ri(o=[]){return o.length?`<div class="player-journey-badges">${o.map(e=>`
    <article class="player-journey-badge">
      <span aria-hidden="true">◆</span>
      <div><strong>${Te(e.label)}</strong><small>${Te(e.description)}</small></div>
    </article>
  `).join("")}</div>`:'<p class="player-journey-muted">Tus hitos aparecerán aquí a medida que completes ciclos semanales. No hay rankings ni comparación con otros jugadores.</p>'}function wi(o){return o?`
    <article class="player-journey-active">
      <div class="player-journey-active-head">
        <div><span>Micro-reto de la semana</span><h3>${Te(o.title)}</h3></div>
        <span class="player-journey-week">hasta ${Te(o.ends_on)}</span>
      </div>
      <p>${Te(o.description)}</p>
      <div class="player-journey-criterion"><strong>Para cerrarlo</strong><span>${Te(o.success_criterion)}</span></div>
      <button type="button" class="player-journey-complete" data-player-journey-complete="${Te(o.id)}">✓ Marcar reflexión completada</button>
      <small>Completar un reto registra tu proceso; no significa que una habilidad esté dominada.</small>
    </article>
  `:""}function xi(o=[]){return o.length?`
    <div class="player-journey-catalog" role="list">
      ${o.map(e=>`
        <article class="player-journey-choice" role="listitem">
          <div><span>${e.category==="TACTICAL"?"Lectura de juego":"Técnica"}</span><h3>${Te(e.title)}</h3></div>
          <p>${Te(e.description)}</p>
          <small>${Te(e.success_criterion)}</small>
          <button type="button" data-player-journey-start="${Te(e.code)}">Elegir este reto</button>
        </article>
      `).join("")}
    </div>
  `:'<p class="player-journey-muted">No hay micro-retos disponibles ahora mismo.</p>'}function Oi(o=[]){return o.length?`
    <details class="player-journey-history">
      <summary>Retos anteriores (${o.length})</summary>
      <div>${o.map(e=>`
        <span><strong>${Te(e.title)}</strong><small>${Te(String(e.completed_at||"").slice(0,10))}</small></span>
      `).join("")}</div>
    </details>
  `:""}function Pi(o={}){const e=o.active_challenge||null,t=Ii[o.stage]||"Tu proceso de mejora";return`
    <section id="${nt}" class="player-journey" aria-labelledby="player-journey-title">
      <header class="player-journey-hero">
        <div>
          <p>MI CAMINO · SOLO PARA TI</p>
          <h2 id="player-journey-title">${Te(t)}</h2>
          <span>${Number(o.completed_count||0)} micro-retos completados</span>
        </div>
        <div class="player-journey-safety" title="Sin rankings, rachas de login ni datos de salud">Progreso personal</div>
      </header>

      ${e?wi(e):`
        <article class="player-journey-intro">
          <div><strong>Elige un único foco para esta semana</strong><p>Un reto pequeño, observable y conectado con situaciones reales de baloncesto.</p></div>
          <span>1 por semana</span>
        </article>
        ${xi(o.catalog||[])}
      `}

      <section class="player-journey-milestones" aria-label="Hitos personales">
        <div class="player-journey-section-title"><strong>Hitos de proceso</strong><span>Sin puntos ni clasificación</span></div>
        ${Ri(o.badges||[])}
      </section>

      ${Oi(o.history||[])}
      <p class="player-journey-disclaimer">Este espacio reconoce constancia y reflexión. No usa Wellness, datos de salud, comparaciones sociales ni afirma dominio técnico por completar un reto.</p>
    </section>
  `}function At(o,e,t="info"){let a=o.querySelector("[data-player-journey-status]");a||(a=document.createElement("div"),a.dataset.playerJourneyStatus="true",a.className="player-journey-status",a.setAttribute("role","status"),a.setAttribute("aria-live","polite"),o.prepend(a)),a.dataset.type=t,a.textContent=e}async function sa(o,{force:e=!1}={}){var s;const t=document.getElementById("dashboard-content-area");if(!(t!=null&&t.isConnected))return;const a=`${o.teamSeasonId}:${o.playerId}`;if(!(!e&&(Bt===a||document.getElementById(nt)))){Bt=a;try{const r=await aa.snapshot(o);(s=document.getElementById(nt))==null||s.remove(),t.insertAdjacentHTML("beforeend",Pi(r)),Li(o)}catch(r){console.debug("[PlayerJourney] Surface unavailable:",(r==null?void 0:r.message)||r)}finally{Bt=""}}}function Li(o){var t;const e=document.getElementById(nt);e&&(e.querySelectorAll("[data-player-journey-start]").forEach(a=>{a.addEventListener("click",async()=>{const s=a.dataset.playerJourneyStart;if(confirm("Este será tu único micro-reto nuevo de esta semana. ¿Quieres empezar con este foco?")){a.disabled=!0,At(e,"Guardando tu reto…");try{await aa.start({...o,challengeCode:s}),ms([10,20,10]),e.remove(),await sa(o,{force:!0})}catch(r){At(e,(r==null?void 0:r.message)||"No se ha podido iniciar el reto.","error"),a.disabled=!1}}})}),(t=e.querySelector("[data-player-journey-complete]"))==null||t.addEventListener("click",async a=>{const s=a.currentTarget;if(confirm("¿Has realizado la observación y reflexión que propone el reto?")){s.disabled=!0,At(e,"Registrando el reto como completado…");try{await aa.complete(s.dataset.playerJourneyComplete),ms([15,25,15]),e.remove(),await sa(o,{force:!0})}catch(r){At(e,(r==null?void 0:r.message)||"No se ha podido completar el reto.","error"),s.disabled=!1}}}))}function jt(){var e;const o=Ni();if(!o){(e=document.getElementById(nt))==null||e.remove();return}sa(o)}if(typeof window<"u"&&typeof document<"u"){window.addEventListener("hashchange",()=>queueMicrotask(jt));const o=()=>{jt(),new MutationObserver(()=>jt()).observe(document.documentElement,{childList:!0,subtree:!0})};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o,{once:!0}):o()}const xt="data-game-sync-badge";let fs=null,Ve=null,Wt=!1;function Ci(o={}){switch(o.status){case"OFFLINE":return{icon:"●",text:"Sin conexión · guardado local",tone:"offline"};case"PENDING":return{icon:"↻",text:"Pendiente de sincronizar",tone:"pending"};case"SYNCING":return{icon:"↻",text:"Sincronizando…",tone:"syncing"};case"FAILED":return{icon:"!",text:"Revisa la sincronización",tone:"failed"};case"SYNCED":return{icon:"✓",text:"Sincronizado",tone:"synced"};default:return{icon:"",text:"",tone:""}}}function Di(o){let e=o.querySelector(`[${xt}]`);if(e)return e;e=document.createElement("div"),e.setAttribute(xt,"true"),e.className="game-sync-badge",e.setAttribute("role","status"),e.setAttribute("aria-live","polite");const t=o.querySelector("header");return t?t.appendChild(e):o.prepend(e),e}function $s(o,e){const t=Di(o),a=Ci(e),s=`${a.tone}|${a.icon}|${a.text}`;return t.dataset.renderSignature!==s&&(t.dataset.renderSignature=s,t.dataset.tone=a.tone,t.innerHTML=`<span aria-hidden="true">${a.icon}</span><strong>${a.text}</strong>`),t.hidden=!a.text,t}function Ht(o=Ve){o&&(document.querySelectorAll(".easy-entry-wrapper").forEach(e=>$s(e,o)),clearTimeout(fs),o.status==="SYNCED"&&(fs=setTimeout(()=>{document.querySelectorAll(`[${xt}]`).forEach(e=>{e.hidden=!0})},2200)))}function Mi(){return typeof navigator<"u"&&navigator.onLine===!1?{status:"OFFLINE",pending:!0}:Ve}function qs(){const o=Mi();o&&document.querySelectorAll(".easy-entry-wrapper").forEach(e=>{e.querySelector(`[${xt}]`)||$s(e,o)})}function $i(){if(Wt)return;Wt=!0;const o=()=>{Wt=!1,qs()};typeof requestAnimationFrame=="function"?requestAnimationFrame(o):setTimeout(o,0)}if(typeof window<"u"&&typeof document<"u"){window.addEventListener("iqbasket:game-sync-status",e=>{Ve=e.detail||null,Ht(Ve)}),window.addEventListener("offline",()=>{Ve={status:"OFFLINE",pending:!0},Ht(Ve)}),window.addEventListener("online",()=>Ht(Ve||{status:"PENDING"}));const o=()=>{qs(),new MutationObserver($i).observe(document.documentElement,{childList:!0,subtree:!0})};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o,{once:!0}):o()}export{Yt as A,Ne as B,b as D,Rr as G,se as I,l as P,Fe as S,j as T,Jt as a,D as s};
