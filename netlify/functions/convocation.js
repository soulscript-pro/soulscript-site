/*
═══════════════════════════════════════════════════════════════
  SOULSCRIPT — FONCTION CONVOCATION — V1
═══════════════════════════════════════════════════════════════

  RÔLE :
  Reçoit un numéro de dossier (d) et un jeton secret (t).
  Si le jeton correspond, renvoie les données du client :
  prénom, numéro de dossier, et l'adresse de ses Archives.

  EMPLACEMENT DANS LE REPO :
  netlify/functions/convocation.js
  (même dossier que gardien.js et natal-chart.js — sans les toucher)

  ─────────────────────────────────────────────────────────────
  CONFIGURATION DES CLIENTS :
  Dans Netlify → Site settings → Environment variables,
  créer une variable nommée :  SOULSCRIPT_CLIENTS

  Sa valeur est un JSON sur une seule ligne, par exemple :

  {"0017":{"t":"lion-etoile-7h42","prenom":"Anissa","url":"https://drive.google.com/..."},"0018":{"t":"porte-memoire-3k9x","prenom":"Sarah","url":"https://drive.google.com/..."}}

  Pour ajouter une cliente :
  1. Ouvrir la variable SOULSCRIPT_CLIENTS dans Netlify
  2. Ajouter une entrée : "NUMERO":{"t":"JETON","prenom":"PRENOM","url":"LIEN"}
  3. Enregistrer, PUIS déclencher un nouveau déploiement
     (Deploys → Trigger deploy → Clear cache and deploy site).
     IMPORTANT : contrairement à ce qu'indiquait une version
     précédente de ce commentaire, Netlify NE relit PAS toujours
     la variable à chaud pour les fonctions déjà actives — un
     redéploiement garantit que la nouvelle valeur est prise en
     compte par toutes les instances de la fonction.

  Le lien à envoyer à la cliente est alors :
  https://soulscript.pro/invitation-v1.html?d=NUMERO&t=JETON

  CONSEIL POUR LES JETONS :
  Choisir des jetons impossibles à deviner (3 mots + chiffres),
  différents pour chaque cliente. Ne jamais réutiliser un jeton.
═══════════════════════════════════════════════════════════════
*/

exports.handler = async function(event) {

  // ── En-têtes communs à toutes les réponses ──
  const entetes = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store' // jamais de mise en cache des données client
  };

  // ── 1. Lire les paramètres du lien ──
  const params  = event.queryStringParameters || {};
  const dossier = (params.d || '').trim();
  const jeton   = (params.t || '').trim();

  if (!dossier || !jeton) {
    return {
      statusCode: 400,
      headers: entetes,
      body: JSON.stringify({ erreur: 'Paramètres manquants.' })
    };
  }

  // ── 2. Charger le registre des clients depuis la variable Netlify ──
  let registre;
  try {
    registre = JSON.parse(process.env.SOULSCRIPT_CLIENTS || '{}');
  } catch (e) {
    // JSON mal formé dans la variable d'environnement
    console.error('SOULSCRIPT_CLIENTS : JSON invalide —', e.message);
    return {
      statusCode: 500,
      headers: entetes,
      body: JSON.stringify({ erreur: 'Registre indisponible.' })
    };
  }

  // ── 3. Vérifier le dossier et le jeton ──
  const client = registre[dossier];
  const jetonStocke = client ? String(client.t || '').trim() : '';

  if (!client || jetonStocke !== jeton) {
    // Réponse identique que le dossier existe ou non :
    // impossible de deviner quels numéros de dossier existent.
    return {
      statusCode: 403,
      headers: entetes,
      body: JSON.stringify({ erreur: 'Les Archives ne reconnaissent pas cette signature.' })
    };
  }

  // ── 4. La signature est reconnue : renvoyer la convocation ──
  return {
    statusCode: 200,
    headers: entetes,
    body: JSON.stringify({
      prenom: client.prenom,
      dossier: dossier,
      url: client.url
    })
  };
};
