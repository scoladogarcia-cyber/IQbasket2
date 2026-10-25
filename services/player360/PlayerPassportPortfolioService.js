/**
 * @fileoverview Authorized lifetime read adapter for Player Passport V68.
 * The browser NEVER expands authorization: PostgreSQL RBAC, RLS, premium
 * entitlement and per-season restrictions remain authoritative.
 */
import { WellnessService } from "./WellnessService.js";
const PAGE_SIZE=250;
function required(v,name){ if(!v)throw new Error('PASSPORT_'+name+'_REQUIRED');return v; }
function array(v){return Array.isArray(v)?v:[];}
async function queryAll(client,table,fields,playerId,{orderKey,limit=10000}={}){
  let out=[];
  for(let offset=0;offset<limit;offset+=PAGE_SIZE){
    let q=client.from(table).select(fields).eq('player_id',playerId);
    if(orderKey)q=q.order(orderKey,{ascending:true});
    const {data,error}=await q.range(offset,offset+PAGE_SIZE-1);
    if(error)throw new Error(table+': '+(error.message||error));
    out.push(...array(data));
    if(!data||data.length<PAGE_SIZE)return out;
  }
  // Truncation is never silently reported as a full lifetime history.
  throw new Error('PASSPORT_PAGINATION_LIMIT_REACHED: '+table);
}
export class PlayerPassportPortfolioService {
  constructor(client){this.client=client?.supabase||client?.default||client;this.wellnessService=new WellnessService(this.client);}
  async load({playerId,teamSeasonId}){
    required(playerId,'PLAYER');required(teamSeasonId,'SEASON');
    if(!this.client?.rpc||!this.client?.from)throw new Error('PASSPORT_BACKEND_NOT_READY');
    // The first RPC validates passport license and resource authorization.
    const {data:career,error}=await this.client.rpc('iq_v68_player_passport_career',{
      p_player_id:playerId,p_team_season_id:teamSeasonId
    });
    if(error)throw new Error('PASSPORT_CAREER_DENIED: '+(error.message||error));
    // Old-club records are visible only if explicitly shared with a verified
    // player/guardian relation. Current staff never inherit that access.
    const {data:sharedEvaluations,error:sharedError}=await this.client.rpc(
      'iq_v68_passport_shared_career',{p_player_id:playerId,p_team_season_id:teamSeasonId}
    );
    if(sharedError)throw new Error('PASSPORT_SHARED_HISTORY: '+(sharedError.message||sharedError));
    const [training,games,assessments]=await Promise.allSettled([
      queryAll(this.client,'iq_passport_training_minutes_v68',
        'training_session_id,authorization_context_id,session_date,session_status,session_kind,classification_review,attendance_status,participated_minutes,duration_override_minutes,duration_minutes,recorded_minutes,accredited_minutes',
        playerId,{orderKey:'training_session_id'}),
      queryAll(this.client,'iq_passport_game_evidence_v68',
        'game_id,authorization_context_id,game_date,game_status,minutes,points,assists,offensive_rebounds,defensive_rebounds,steals,blocks,turnovers,fg2_made,fg2_attempted,fg3_made,fg3_attempted,ft_made,ft_attempted',
        playerId,{orderKey:'game_id'}),
      queryAll(this.client,'player_evaluations',
        'id,team_season_id,assessment_duration_minutes,evaluation_date',
        playerId,{orderKey:'id'})
    ]);
    const unpack=(result,label)=>result.status==='fulfilled'
      ?{rows:result.value,error:null}
      :{rows:[],error:label+': '+String(result.reason?.message||result.reason)};
    const wellness={};
    // Existing sensitive-data RPC is the only source. No direct table reads.
    for(const module of ['recovery','nutrition']){
      try{
        const cap=await this.wellnessService.resolveAccessContext({
          teamSeasonId,playerId,module
        });
        if(!cap.can_read||!cap.purpose){
          wellness[module]={allowed:false,rows:[],purpose:null,error:null};
          continue;
        }
        const list=await this.wellnessService.listEntries({
          teamSeasonId,playerId,module,purpose:cap.purpose,limit:30
        });
        wellness[module]={allowed:true,rows:list,purpose:cap.purpose,error:null};
      }catch(error){
        wellness[module]={allowed:false,rows:[],purpose:null,
          error:'WELLNESS_ACCESS: '+String(error?.message||error)};
      }
    }
    return {career:career||{},sharedEvaluations:array(sharedEvaluations),training:unpack(training,'TRAINING'),
      games:unpack(games,'GAMES'),assessmentTime:unpack(assessments,'ASSESSMENTS'),
      wellness};
  }
}
export default PlayerPassportPortfolioService;
