// SOULSCRIPT — VERSION DE TEST TEMPORAIRE
// Diagnostic Netlify Identity uniquement.
// Aucun envoi d'email dans cette version.

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  const user = context.clientContext && context.clientContext.user;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(
      {
        authenticated: !!user,
        email: user?.email || null,
        role: user?.app_metadata?.roles || null,
        hasClientContext: !!context.clientContext,
        hasIdentity: !!(context.clientContext && context.clientContext.identity)
      },
      null,
      2
    )
  };
};
