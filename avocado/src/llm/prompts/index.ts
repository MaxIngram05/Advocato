import type { Lang } from '../../core/model';
import type { LlmTask } from '../../ports';

export interface PromptTemplate {
  /** Task instructions appended after the charter. May use {clientName} and {opposingParties}. */
  instructions: Record<Lang, string>;
}

/**
 * §14.1 one template per task. Wording never presupposes a side (G10): perspective
 * comes only from the role variables resolved from the confirmed stance.
 */
export const PROMPT_TEMPLATES: Record<LlmTask, PromptTemplate> = {
  detectMissingInfo: {
    instructions: {
      en: 'TASK: Read the intake answers in the user message. List the required information that is still missing or ambiguous, and phrase at most 3 precise follow-up questions for the lawyer.',
      fr: 'TÂCHE : Lisez les réponses d’ouverture du dossier dans le message. Dressez la liste des renseignements requis encore manquants ou ambigus et formulez au plus 3 questions précises pour l’avocat.',
    },
  },
  suggestStance: {
    instructions: {
      en: 'TASK: From the conversation and exhibits in the user message, suggest which role the lawyer’s client most likely plays (claimant, defendant or other) and the client’s name. Quote the evidence (exhibit, locator, excerpt) behind the suggestion and give a confidence between 0 and 1. If nothing points to a role, return null. This is only a suggestion; the lawyer decides.',
      fr: 'TÂCHE : À partir de la conversation et des pièces du message, suggérez le rôle le plus probable du client de l’avocat (demandeur, défendeur ou autre) et son nom. Citez la preuve (pièce, repère, extrait) qui appuie la suggestion et donnez une confiance entre 0 et 1. Si rien n’indique un rôle, renvoyez null. Ce n’est qu’une suggestion : l’avocat décide.',
    },
  },
  extractFacts: {
    instructions: {
      en: 'TASK: Extract a long, exhaustive list of facts from the exhibits in the user message: every distinct assertion that is dated or datable. For each fact give the text, the date (ISO, if any), the parties involved, the source references (exhibit id, locator, short verbatim excerpt), its status, the parties’ position on it, and its favorability for {clientName}. A fact with no source reference must be labeled hypothesis or missing. Include facts that hurt {clientName}.',
      fr: 'TÂCHE : Extrayez des pièces du message une liste longue et exhaustive de faits : chaque affirmation distincte, datée ou datable. Pour chaque fait, donnez le texte, la date (ISO, s’il y a lieu), les parties concernées, les sources (identifiant de pièce, repère, court extrait textuel), son statut, la position des parties et son caractère favorable ou défavorable pour {clientName}. Un fait sans source doit être qualifié hypothesis ou missing. Incluez les faits qui nuisent à {clientName}.',
    },
  },
  buildMatrixRows: {
    instructions: {
      en: 'TASK: Build argumentation matrix rows for the required legal elements listed in the user message. For each element give: the relevant fact ids, the evidence (exhibit references), the application of the rule or the gap, the argument from the perspective of {clientName}, the conclusion sought, the ALLOWED_SOURCES ids relied on, and a confidence (established, arguable, weak, missing). When no fact supports an element, say so explicitly as a gap.',
      fr: 'TÂCHE : Construisez les lignes de la matrice d’argumentation pour les éléments juridiques requis énumérés dans le message. Pour chaque élément : les identifiants des faits pertinents, la preuve (renvois aux pièces), l’application de la règle ou la lacune, l’argument du point de vue de {clientName}, la conclusion demandée, les identifiants ALLOWED_SOURCES invoqués et un degré de confiance (established, arguable, weak, missing). Si aucun fait n’appuie un élément, indiquez explicitement la lacune.',
    },
  },
  assessDamages: {
    instructions: {
      en: 'TASK: Analyse the prejudice and damages from the perspective of {clientName}: heads of damage, quantum, supporting evidence and gaps. If {clientName} answers a claim, analyse which heads of damage claimed by {opposingParties} are unproven, indirect, unforeseeable or overstated.',
      fr: 'TÂCHE : Analysez le préjudice et les dommages du point de vue de {clientName} : chefs de dommages, quantum, preuve à l’appui et lacunes. Si {clientName} répond à une demande, analysez quels chefs de dommages réclamés par {opposingParties} ne sont pas prouvés, sont indirects, imprévisibles ou surévalués.',
    },
  },
  proposeArguments: {
    instructions: {
      en: 'TASK: Propose up to 5 distinct argument options for {clientName}, built only from the selected facts and the matrix rows in the user message. For each: a title, a one-paragraph summary, a strength from 1 to 5, the element ids covered, the fact ids used, the key ALLOWED_SOURCES ids and the main risks. Never pad the list with weak or invented options; if fewer than 5 sound options exist, return fewer and explain why in `shortfallReason`.',
      fr: 'TÂCHE : Proposez jusqu’à 5 options d’argument distinctes pour {clientName}, construites uniquement à partir des faits sélectionnés et des lignes de matrice du message. Pour chacune : un titre, un résumé d’un paragraphe, une force de 1 à 5, les éléments couverts, les faits utilisés, les principales sources ALLOWED_SOURCES et les principaux risques. Ne gonflez jamais la liste avec des options faibles ou inventées; s’il existe moins de 5 options solides, renvoyez-en moins et expliquez pourquoi dans `shortfallReason`.',
    },
  },
  generateCounterArguments: {
    instructions: {
      en: 'TASK: List the counter-arguments that {opposingParties} is likely to raise against the selected argument of {clientName}: the ones already stated (given in the user message) and those you anticipate from the candidate list. Mark each as stated or anticipated and cite ALLOWED_SOURCES ids where a rule supports it.',
      fr: 'TÂCHE : Énumérez les contre-arguments que {opposingParties} soulèvera vraisemblablement contre l’argument retenu par {clientName} : ceux déjà formulés (fournis dans le message) et ceux que vous anticipez à partir de la liste de candidats. Indiquez pour chacun s’il est formulé ou anticipé et citez les identifiants ALLOWED_SOURCES qui l’appuient.',
    },
  },
  generateRebuttals: {
    instructions: {
      en: 'TASK: For each counter-argument in the user message, write at least one rebuttal (réplique) for {clientName}. Each rebuttal must rely on a fact id or an ALLOWED_SOURCES id; say plainly when a counter-argument is strong.',
      fr: 'TÂCHE : Pour chaque contre-argument du message, rédigez au moins une réplique pour {clientName}. Chaque réplique doit s’appuyer sur un identifiant de fait ou de source ALLOWED_SOURCES; dites franchement lorsqu’un contre-argument est solide.',
    },
  },
  justifyRemedy: {
    instructions: {
      en: 'TASK: Using the remedy eligibility results in the user message (decision support computed from the matrix), justify the principal remedy and the alternatives from the perspective of {clientName}, and give the reason each other remedy is rejected. Each justification must refer to the eligibility conditions satisfied and cite ALLOWED_SOURCES ids.',
      fr: 'TÂCHE : À partir des résultats d’admissibilité des réparations fournis dans le message (aide à la décision calculée à partir de la matrice), justifiez la réparation principale et les réparations subsidiaires du point de vue de {clientName}, et donnez le motif du rejet de chaque autre réparation. Chaque justification doit renvoyer aux conditions remplies et citer des identifiants ALLOWED_SOURCES.',
    },
  },
  analyseUnfavorableEvidence: {
    instructions: {
      en: 'TASK: For every fact or exhibit in the user message that is unfavorable to {clientName}, state its impact, a response strategy, and the residual risk (low, medium, high). Do not leave any unfavorable item out.',
      fr: 'TÂCHE : Pour chaque fait ou pièce du message défavorable à {clientName}, indiquez son incidence, une stratégie de réponse et le risque résiduel (low, medium, high). N’omettez aucun élément défavorable.',
    },
  },
  draftDocument: {
    instructions: {
      en: 'TASK: Write a rough draft of the argument for {clientName} from the matrix, arguments and rebuttals in the user message. Keep every citation as an ALLOWED_SOURCES id in square brackets, e.g. [S-3], and every fact reference as its id, e.g. (F-12).',
      fr: 'TÂCHE : Rédigez une ébauche de l’argumentation pour {clientName} à partir de la matrice, des arguments et des répliques du message. Conservez chaque citation sous forme d’identifiant ALLOWED_SOURCES entre crochets, p. ex. [S-3], et chaque renvoi à un fait sous forme d’identifiant, p. ex. (F-12).',
    },
  },
  proofread: {
    instructions: {
      en: 'TASK: Proofread the text in the user message for language, internal consistency and citation format (McGill style with a pinpoint). Propose each change as a suggestion with the original text, the replacement and the reason. Never rewrite silently.',
      fr: 'TÂCHE : Révisez le texte du message : langue, cohérence interne et format des références (style du Guide McGill avec renvoi précis). Proposez chaque modification sous forme de suggestion avec le texte original, le remplacement et le motif. Ne réécrivez jamais en silence.',
    },
  },
  findWeaknesses: {
    instructions: {
      en: 'TASK: Find the general weaknesses of the argument of {clientName} in the user message. For each weakness, justify it with the counter-argument {opposingParties} could make, and propose countermeasures to add to the argument.',
      fr: 'TÂCHE : Relevez les faiblesses générales de l’argumentation de {clientName} présentée dans le message. Pour chaque faiblesse, justifiez-la par le contre-argument que {opposingParties} pourrait invoquer et proposez des contre-mesures à ajouter à l’argumentation.',
    },
  },
  suggestNextPrompts: {
    instructions: {
      en: 'TASK: Suggest exactly 3 short, specific next requests the lawyer acting for {clientName} could make, based on the current state of the case in the user message (e.g. strengthen a weak element, proofread a section, find weaknesses in the remedy justification).',
      fr: 'TÂCHE : Suggérez exactement 3 demandes suivantes, courtes et précises, que l’avocat de {clientName} pourrait faire, selon l’état actuel du dossier présenté dans le message (p. ex. renforcer un élément faible, réviser une section, trouver les faiblesses de la justification de la réparation).',
    },
  },
  buildAnalysis: {
    instructions: {
      en: 'TASK: Build the complete written argument for {clientName} from the selected CASE FACTS and ALLOWED_SOURCES. Produce: the legal questions; the applicable rules (each with ALLOWED_SOURCES ids); the cause of action in narrative form; the argumentation matrix (one row per required legal element: element, fact ids, evidence with exhibit references, application of the rule or the gap, argument, conclusion sought, source ids, confidence; mark a missing element as a gap with confidence missing); damages or prejudice (or why prejudice is not proven when {clientName} answers a claim); the remedy (principal, alternatives, rejected with reasons); every item of evidence unfavorable to {clientName} with impact, response and residual risk; the main and supplementary arguments, each with the counter-arguments of {opposingParties} (stated or anticipated) and at least one rebuttal each; the conclusions to ask of the court; and your uncertainties. Cite only ALLOWED_SOURCES ids in citationIds and only existing fact ids in factIds.',
      fr: 'TÂCHE : Bâtissez l’argumentation écrite complète de {clientName} à partir des CASE FACTS sélectionnés et des ALLOWED_SOURCES. Produisez : les questions juridiques; les règles applicables (chacune avec ses identifiants ALLOWED_SOURCES); le fondement du recours sous forme narrative; la matrice d’argumentation (une ligne par élément juridique requis : élément, faits, preuve avec renvois aux pièces, application de la règle ou lacune, argument, conclusion demandée, sources, degré de confiance; un élément non établi est une lacune de confiance missing); les dommages ou le préjudice (ou pourquoi le préjudice n’est pas prouvé si {clientName} répond à une demande); la réparation (principale, subsidiaires, rejetées avec motifs); chaque élément de preuve défavorable à {clientName} avec incidence, réponse et risque résiduel; les arguments principaux et subsidiaires, chacun avec les contre-arguments de {opposingParties} (formulés ou anticipés) et au moins une réplique chacun; les conclusions à demander au tribunal; et vos incertitudes. Ne citez dans citationIds que des identifiants ALLOWED_SOURCES et dans factIds que des faits existants.',
    },
  },
  converse: {
    instructions: {
      en: "TASK: You are Advocato, a legal assistant chatting with a lawyer in a sidebar. Reply naturally and briefly (2 to 5 sentences), like a helpful colleague, never like a form. The user message gives the current step, what is already known about the case, the information still missing, the exhibits, facts and draft (if any), the recent conversation and the lawyer's latest message. (1) In `extracted`, record ONLY case information the lawyer states (court, area of law, ISO date of the facts, the client's name, the role the lawyer's client appears to have, the opposing parties, each party's role in the transaction, the outcome sought, arguments already raised by the other side, the legal issue, the procedure stage); use null or [] for anything not stated and never guess. (2) If missingInformation is not empty, ask in one natural sentence for at most the first two items listed there, in that order (and nothing else); never ask again for something already in `known`. A month and year is enough for the date of facts (use the first day of the month). (3) The role of the lawyer's client is never settled by you. Only while known.roleConfirmedByLawyer is null: when the role seems clear, set clientRoleSuggestion and say a confirmation button will appear. Once it is confirmed, never mention confirming it again. (4) When missingInformation is empty, say what happens next (see nextStep), once, without repeating earlier messages. Never say the information is complete while missingInformation is not empty. (5) If the lawyer asks a question, answer it from the case material and cite only ALLOWED_SOURCES ids in citationIds. Never invent law.",
      fr: "TÂCHE : Vous êtes Advocato, un assistant juridique qui discute avec un avocat dans un panneau latéral. Répondez naturellement et brièvement (2 à 5 phrases), comme un collègue serviable, jamais comme un formulaire. Le message fournit l’étape en cours, ce qui est déjà connu du dossier, les renseignements manquants, les pièces, les faits et l’ébauche (s’il y a lieu), la conversation récente et le dernier message de l’avocat. (1) Dans `extracted`, consignez UNIQUEMENT les renseignements que l’avocat énonce (tribunal, domaine de droit, date ISO des faits, nom du client, rôle apparent du client de l’avocat, parties adverses, rôle de chaque partie dans l’opération, résultat recherché, arguments déjà soulevés par l’autre partie, question juridique, étape de la procédure); mettez null ou [] pour tout ce qui n’est pas énoncé et ne devinez jamais. (2) Si missingInformation n’est pas vide, demandez en une seule phrase naturelle au plus les deux premiers éléments de cette liste, dans cet ordre (et rien d’autre); ne redemandez jamais un élément déjà présent dans `known`. Un mois et une année suffisent pour la date des faits (utilisez le premier jour du mois). (3) Vous ne tranchez jamais le rôle du client de l’avocat. Seulement tant que known.roleConfirmedByLawyer est null : si le rôle semble clair, remplissez clientRoleSuggestion et indiquez qu’un bouton de confirmation va apparaître. Une fois confirmé, n’en reparlez plus. (4) Quand missingInformation est vide, dites ce qui suit (voir nextStep), une seule fois, sans répéter vos messages précédents. Ne dites jamais que les renseignements sont complets tant que missingInformation n’est pas vide. (5) Si l’avocat pose une question, répondez à partir du dossier et ne citez dans citationIds que des identifiants ALLOWED_SOURCES. N’inventez jamais de droit.",
    },
  },
  transcribePdf: {
    instructions: {
      en: 'TASK: Transcribe the attached PDF verbatim. Mark each page with its number. Do not summarize, translate or correct the text.',
      fr: 'TÂCHE : Transcrivez textuellement le PDF joint. Indiquez le numéro de chaque page. Ne résumez pas, ne traduisez pas et ne corrigez pas le texte.',
    },
  },
};
