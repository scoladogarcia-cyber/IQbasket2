/**
 * @fileoverview Optional, non-clinical reflection on sport enjoyment and agency.
 * @description No score, athlete profile, network, persistence, prediction or ranking.
 * The family should ask the player, not answer on their behalf.
 */
export const MOTIVATION_QUESTIONS_V74=Object.freeze([
  Object.freeze({id:"ENJOYMENT",es:"¿Has disfrutado jugando esta semana?",ca:"Has gaudit jugant aquesta setmana?",en:"Have you enjoyed playing this week?",fr:"As-tu pris plaisir à jouer cette semaine ?"}),
  Object.freeze({id:"LEARNING",es:"¿Has podido aprender o probar algo nuevo?",ca:"Has pogut aprendre o provar alguna cosa nova?",en:"Have you been able to learn or try something new?",fr:"As-tu pu apprendre ou essayer quelque chose de nouveau ?"}),
  Object.freeze({id:"VOICE",es:"¿Has podido expresar lo que te gustaría mejorar?",ca:"Has pogut dir què t'agradaria millorar?",en:"Have you been able to say what you would like to improve?",fr:"As-tu pu dire ce que tu aimerais améliorer ?"})
]);
export const MOTIVATION_LANG_V74=Object.freeze({
  es:{title:"Conversaciones que ayudan",intro:"Si el jugador quiere, dedica un minuto a escucharle. No es un test ni se envía al entrenador.",choice:"Prefiero no responder",yes:"Sí",sometimes:"A veces",notNow:"Esta semana no",action:"Preparar conversación",reset:"Borrar respuestas",empty:"Puedes dejar cualquier pregunta sin respuesta.",result:"Gracias por hablarlo. Escucha con curiosidad, pregunta qué le ayudaría y acordad un pequeño paso sin presión.",privacy:"Privado y voluntario: las respuestas solo se usan en esta pantalla, no se guardan, comparten ni envían a IA."},
  ca:{title:"Converses que ajuden",intro:"Si el jugador vol, dedica un minut a escoltar-lo. No és un test ni s'envia a l'entrenador.",choice:"Prefereixo no respondre",yes:"Sí",sometimes:"A vegades",notNow:"Aquesta setmana no",action:"Preparar conversa",reset:"Esborrar respostes",empty:"Pots deixar qualsevol pregunta sense resposta.",result:"Gràcies per parlar-ne. Escolta amb curiositat, pregunta què l'ajudaria i acordeu un petit pas sense pressió.",privacy:"Privat i voluntari: les respostes només es fan servir en aquesta pantalla, no es desen ni es comparteixen ni s'envien a IA."},
  en:{title:"Conversations that help",intro:"If the player wants to, take a minute to listen. This is not a test and is not sent to the coach.",choice:"Prefer not to answer",yes:"Yes",sometimes:"Sometimes",notNow:"Not this week",action:"Prepare conversation",reset:"Clear answers",empty:"Any question can be left unanswered.",result:"Thanks for talking. Listen with curiosity, ask what would help and agree on one pressure-free small step.",privacy:"Private and optional: answers are used only on this screen, never saved, shared or sent to AI."},
  fr:{title:"Des échanges qui aident",intro:"Si le joueur le souhaite, prenez une minute pour l'écouter. Ce n'est pas un test ni un message au coach.",choice:"Je préfère ne pas répondre",yes:"Oui",sometimes:"Parfois",notNow:"Pas cette semaine",action:"Préparer l'échange",reset:"Effacer les réponses",empty:"Toute question peut rester sans réponse.",result:"Merci d'en parler. Écoutez avec curiosité, demandez ce qui aiderait et convenez d'un petit pas sans pression.",privacy:"Privé et facultatif : les réponses restent sur cet écran, sans sauvegarde, partage ni envoi à une IA."}
});
export const MOTIVATION_CHOICES_V74=Object.freeze(["YES","SOMETIMES","NOT_NOW",""]);
export function reflectionV74(answers={},locale="es"){
  const lang=MOTIVATION_LANG_V74[locale]||MOTIVATION_LANG_V74.es;
  if(!answers||typeof answers!=="object"||Array.isArray(answers))throw new Error("Respuestas no válidas.");
  const selected={};
  for(const question of MOTIVATION_QUESTIONS_V74){
    const value=String(answers[question.id]??"");
    if(!MOTIVATION_CHOICES_V74.includes(value))throw new Error("Respuesta desconocida.");
    if(value)selected[question.id]=value;
  }
  return Object.freeze({answered:Object.keys(selected).length,message:Object.keys(selected).length?lang.result:lang.empty});
}


/**
 * One optional conversation starter, derived locally from the child's chosen
 * response. Not a score or psychological inference; answers never leave the UI.
 */
export function motivationConversationV75(answers={},locale="es"){
  const result=reflectionV74(answers,locale);
  if(!result.answered)return Object.freeze({message:result.message,starter:null});
  const codes=Object.freeze({
    es:{ENJOYMENT:"¿Qué cambiarías para disfrutar más jugando?",LEARNING:"¿Qué te gustaría aprender o probar a tu ritmo?",VOICE:"¿Qué te gustaría que los adultos escucháramos mejor?",POSITIVE:"¿Qué momento del baloncesto te gustaría repetir?"},
    ca:{ENJOYMENT:"Què canviaries per gaudir més jugant?",LEARNING:"Què t'agradaria aprendre o provar al teu ritme?",VOICE:"Què t'agradaria que els adults escoltéssim millor?",POSITIVE:"Quin moment del bàsquet t'agradaria repetir?"},
    en:{ENJOYMENT:"What would make playing more enjoyable for you?",LEARNING:"What would you like to learn or try at your own pace?",VOICE:"What would you like adults to listen to more closely?",POSITIVE:"What basketball moment would you like to repeat?"},
    fr:{ENJOYMENT:"Qu'est-ce qui rendrait le jeu plus agréable pour toi ?",LEARNING:"Qu'aimerais-tu apprendre ou essayer à ton rythme ?",VOICE:"Qu'aimerais-tu que les adultes écoutent davantage ?",POSITIVE:"Quel moment de basket aimerais-tu revivre ?"}
  });
  const phrases=codes[locale]||codes.es;
  const priority=["ENJOYMENT","LEARNING","VOICE"].find(id=>["NOT_NOW","SOMETIMES"].includes(String(answers?.[id]??"")));
  return Object.freeze({message:result.message,starter:phrases[priority||"POSITIVE"]});
}
