// netlify/functions/stripe-webhook.js
// SOULSCRIPT — E-mail de confirmation après paiement Stripe confirmé
// Déclenché par le webhook Stripe : checkout.session.completed
// Aucune dépendance externe : crypto (Node natif) + fetch (natif)
// Ne touche à aucune autre fonction. Fichier autonome.

const crypto = require("crypto");

// ---------- Vérification de la signature Stripe ----------
function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  // En-tête au format : t=1234567890,v1=abc...,v1=def...
  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp = null;
  const signatures = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  // Tolérance : 5 minutes (protection contre les rejeux)
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (isNaN(age) || age > 300) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");

  return signatures.some((sig) => {
    const sigBuffer = Buffer.from(sig, "utf8");
    return (
      sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    );
  });
}

// ---------- Utilitaires ----------
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractFirstName(fullName) {
  if (!fullName || typeof fullName !== "string") return null;
  const first = fullName.trim().split(/\s+/)[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function formatAmount(amountTotal, currency) {
  if (typeof amountTotal !== "number") return null;
  const value = (amountTotal / 100).toFixed(2).replace(".", ",");
  const symbol = currency === "eur" ? "€" : (currency || "").toUpperCase();
  return `${value} ${symbol}`;
}

// ---------- Template HTML de l'e-mail ----------
function buildEmailHtml({ greeting, productLabel, amountLabel, orderDate }) {
  const recapAmount = amountLabel
    ? `<tr>
        <td style="padding:6px 0; font-family:Georgia,'Times New Roman',serif; font-size:13px; color:#8a7a5f;">Montant</td>
        <td align="right" style="padding:6px 0; font-family:Georgia,'Times New Roman',serif; font-size:14px; color:#E8CC7A;">${escapeHtml(amountLabel)}</td>
      </tr>`
    : "";

  const recapDate = orderDate
    ? `<tr>
        <td style="padding:6px 0; font-family:Georgia,'Times New Roman',serif; font-size:13px; color:#8a7a5f;">Date</td>
        <td align="right" style="padding:6px 0; font-family:Georgia,'Times New Roman',serif; font-size:14px; color:#e8e0d0;">${escapeHtml(orderDate)}</td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Les Archives se sont ouvertes pour vous.</title>
</head>
<body style="margin:0; padding:0; background-color:#060402;" bgcolor="#060402">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
    Votre lecture SOULSCRIPT est désormais en préparation.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#060402" style="background-color:#060402;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <!-- En-tête -->
          <tr>
            <td align="center" style="padding:16px 0 28px 0;">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:26px; letter-spacing:10px; color:#E8CC7A; text-transform:uppercase;">
                SOULSCRIPT
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:11px; letter-spacing:4px; color:#8a7a5f; text-transform:uppercase; padding-top:10px;">
                Les Archives de votre âme
              </div>
            </td>
          </tr>

          <!-- Filet doré -->
          <tr>
            <td style="padding:0 8px;">
              <div style="height:1px; background-color:#3a2f1e; line-height:1px; font-size:1px;">&nbsp;</div>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:36px 24px 8px 24px;">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:24px; line-height:1.35; color:#f0e8d8; letter-spacing:1px;">
                Les Archives se sont ouvertes pour vous.
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 24px 0 24px;">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:1.7; color:#C89B5B;">
                ${escapeHtml(greeting)}
              </div>

              <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:1.8; color:#d8d0c0; padding-top:18px;">
                Votre commande a bien été reçue.
              </div>

              <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:1.8; color:#d8d0c0; padding-top:18px;">
                Quelque part dans les Archives, votre lecture <span style="color:#E8CC7A;">SOULSCRIPT</span> est désormais en préparation.
              </div>

              <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:1.8; color:#d8d0c0; padding-top:18px;">
                Votre histoire, vos structures invisibles, vos fractures, vos liens et les cycles qui traversent votre trajectoire vont être étudiés avec attention et précision.
              </div>
            </td>
          </tr>

          <!-- Encadré 72 heures -->
          <tr>
            <td style="padding:28px 24px 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #3a2f1e; background-color:#0c0805;">
                <tr>
                  <td style="padding:20px 22px;">
                    <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:1.7; color:#e8e0d0;">
                      Votre lecture personnalisée vous sera transmise par e-mail sous <span style="color:#E8CC7A;">72&nbsp;heures</span>.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 24px 0 24px;">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:1.8; color:#d8d0c0;">
                D'ici là, vous n'avez rien à faire.<br>
                Les Archives sont déjà au travail.
              </div>
            </td>
          </tr>

          <!-- Récapitulatif -->
          <tr>
            <td style="padding:32px 24px 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #3a2f1e; background-color:#0c0805;">
                <tr>
                  <td style="padding:20px 22px;">
                    <div style="font-family:Georgia,'Times New Roman',serif; font-size:12px; letter-spacing:3px; color:#8a7a5f; text-transform:uppercase; padding-bottom:12px;">
                      Récapitulatif
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:6px 0; font-family:Georgia,'Times New Roman',serif; font-size:13px; color:#8a7a5f;">Lecture</td>
                        <td align="right" style="padding:6px 0; font-family:Georgia,'Times New Roman',serif; font-size:14px; color:#e8e0d0;">${escapeHtml(productLabel)}</td>
                      </tr>
                      ${recapAmount}
                      ${recapDate}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td align="center" style="padding:40px 24px 0 24px;">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:1.7; color:#C89B5B; font-style:italic;">
                Merci de votre confiance.
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:14px; letter-spacing:3px; color:#E8CC7A; text-transform:uppercase; padding-top:18px;">
                SOULSCRIPT
              </div>
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:11px; letter-spacing:2px; color:#8a7a5f; text-transform:uppercase; padding-top:6px;">
                Les Archives de votre âme
              </div>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="padding:40px 8px 0 8px;">
              <div style="height:1px; background-color:#3a2f1e; line-height:1px; font-size:1px;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 24px 30px 24px;">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:12px; line-height:1.8; color:#6a5f4a;">
                Une question ? Contactez-nous :
                <a href="mailto:soulscript.officiel@outlook.com" style="color:#C89B5B; text-decoration:none;">soulscript.officiel@outlook.com</a>
                <br>
                &copy; 2026 SOULSCRIPT &mdash; Tous droits réservés.
                <br>
                Ce message a été envoyé automatiquement.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------- Handler principal ----------
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!webhookSecret || !resendApiKey) {
    console.error("Variables d'environnement manquantes (STRIPE_WEBHOOK_SECRET ou RESEND_API_KEY).");
    return { statusCode: 500, body: "Configuration incomplète" };
  }

  // Corps brut exact — indispensable pour la vérification de signature
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : (event.body || "");

  const signatureHeader =
    event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    console.warn("Signature Stripe invalide — requête rejetée.");
    return { statusCode: 400, body: "Signature invalide" };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (err) {
    return { statusCode: 400, body: "JSON invalide" };
  }

  // On ne traite que la confirmation de paiement
  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "Événement ignoré" };
  }

  const session = stripeEvent.data && stripeEvent.data.object;

  // SÉCURITÉ : n'envoyer l'e-mail que si le paiement est réellement encaissé.
  // Une session peut être "complete" avec payment_status "unpaid"
  // (ex. paiement différé, virement en attente). Réponse 200 : on ne veut
  // pas que Stripe retente cet événement — le paiement confirmé arrivera
  // le cas échéant via un événement ultérieur.
  if (!session || session.payment_status !== "paid") {
    console.log(
      "Session complétée mais non payée — aucun e-mail envoyé.",
      session && session.id,
      "payment_status:",
      session && session.payment_status
    );
    return { statusCode: 200, body: "Paiement non confirmé — aucun envoi" };
  }

  const email = session.customer_details && session.customer_details.email;

  if (!email) {
    console.error("Session sans e-mail client — aucun envoi possible.", session.id);
    return { statusCode: 200, body: "Pas d'e-mail client" };
  }

  // Prénom avec repli élégant
  const firstName = extractFirstName(
    session.customer_details && session.customer_details.name
  );
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

  // Produit : libellé fixe (le Payment Link n'inclut pas les lignes d'achat dans l'événement)
  const productLabel = "SOULSCRIPT — Lecture Complète";

  const amountLabel = formatAmount(session.amount_total, session.currency);

  const orderDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

  const html = buildEmailHtml({ greeting, productLabel, amountLabel, orderDate });

  // ---------- Envoi via Resend (idempotent) ----------
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        // Idempotence : si Stripe renvoie le même événement,
        // Resend reconnaît la clé et n'envoie pas de doublon.
        "Idempotency-Key": `soulscript-confirmation-${session.id}`,
      },
      body: JSON.stringify({
        from: "SOULSCRIPT — Les Archives <archives@soulscript.pro>",
        to: [email],
        reply_to: "soulscript.officiel@outlook.com",
        subject: "Les Archives se sont ouvertes pour vous.",
        html: html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erreur Resend :", response.status, errorText);
      // 500 → Stripe retentera plus tard ; l'Idempotency-Key empêche tout doublon.
      return { statusCode: 500, body: "Échec de l'envoi" };
    }

    console.log("E-mail de confirmation envoyé pour la session :", session.id);
    return { statusCode: 200, body: "E-mail envoyé" };
  } catch (err) {
    console.error("Erreur lors de l'envoi :", err.message);
    return { statusCode: 200 === 0 ? 500 : 500, body: "Erreur d'envoi" };
  }
};
