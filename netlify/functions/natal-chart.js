// ═══════════════════════════════════════════════════════════════
// SOULSCRIPT — Netlify Function
// Appel API Railway (Swiss Ephemeris) + Envoi mail Resend
// ═══════════════════════════════════════════════════════════════

const REPLIT_API = "https://astro-api-production-f446.up.railway.app";

const SIGNS_FR = {
  "Aries":"Bélier","Taurus":"Taureau","Gemini":"Gémeaux","Cancer":"Cancer",
  "Leo":"Lion","Virgo":"Vierge","Libra":"Balance","Scorpio":"Scorpion",
  "Sagittarius":"Sagittaire","Capricorn":"Capricorne","Aquarius":"Verseau","Pisces":"Poissons"
};
const SIGNS_SYM = {
  "Aries":"♈","Taurus":"♉","Gemini":"♊","Cancer":"♋","Leo":"♌","Virgo":"♍",
  "Libra":"♎","Scorpio":"♏","Sagittarius":"♐","Capricorn":"♑","Aquarius":"♒","Pisces":"♓"
};
const PLANETS_FR = {
  "Sun":"Soleil","Moon":"Lune","Mercury":"Mercure","Venus":"Vénus","Mars":"Mars",
  "Jupiter":"Jupiter","Saturn":"Saturne","Uranus":"Uranus","Neptune":"Neptune",
  "Pluto":"Pluton","Chiron":"Chiron","NorthNode":"Nœud Nord"
};
const PLANETS_SYM = {
  "Sun":"☉","Moon":"☽","Mercury":"☿","Venus":"♀","Mars":"♂","Jupiter":"♃",
  "Saturn":"♄","Uranus":"♅","Neptune":"♆","Pluto":"♇","Chiron":"⚷","NorthNode":"☊"
};

const PACK_META = {
  "relationnel": {
    label: "Relationnel",
    title: "Les Archives du Lien",
    intro: "Ce chapitre rassemble les archétypes qui façonnent votre manière d'aimer, de désirer, de vous attacher et de choisir vos alliances."
  },
  "karma": {
    label: "Karma",
    title: "Les Archives du Karma",
    intro: "Ces points révèlent les fils invisibles qui relient votre âme à ses engagements anciens — dettes, contrats et patterns que vous portez au-delà d'une seule vie."
  },
  "ombre": {
    label: "Ombre",
    title: "Les Archives de l'Ombre",
    intro: "Ce chapitre explore les zones d'ombre de la psyché — les blessures non digérées, les dynamiques de pouvoir et les territoires que l'âme évite encore d'explorer."
  },
  "mission": {
    label: "Mission",
    title: "Les Archives de la Mission",
    intro: "Ces astéroïdes cartographient le sens profond de votre incarnation — la vocation, le service, l'héritage que vous êtes venu déposer dans le monde."
  },
  "sante": {
    label: "Santé",
    title: "Les Archives de Guérison",
    intro: "Ce chapitre éclaire votre rapport au corps, à la vitalité et aux processus de régénération — les ressources de guérison inscrites dans votre carte natale."
  }
};

async function geocode(lieu) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(lieu)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SOULSCRIPT/1.0 (soulscript.officiel@outlook.com)" }
  });
  const data = await res.json();
  if (!data || data.length === 0) throw new Error(`Lieu introuvable : ${lieu}`);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function getTimezoneOffset(lat, lon, year, month, day, hour, minute) {
  try {
    const tzUrl = `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`;
    const tzRes = await fetch(tzUrl);
    if (!tzRes.ok) throw new Error("timeapi error");
    const tzData = await tzRes.json();
    const timezoneName = tzData.timeZone;

    const convUrl = `https://timeapi.io/api/conversion/convertTimeZone`;
    const convRes = await fetch(convUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        fromTimeZone: timezoneName,
        dateTime: `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")} ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00`,
        toTimeZone: "UTC",
        dstAmbiguity: ""
      })
    });
    if (!convRes.ok) throw new Error("conversion error");
    const convData = await convRes.json();
    const utcStr = convData.conversionResult.dateTime;
    const utcDate = new Date(utcStr);
    return {
      utcYear:  utcDate.getUTCFullYear(),
      utcMonth: utcDate.getUTCMonth() + 1,
      utcDay:   utcDate.getUTCDate(),
      utcHour:  utcDate.getUTCHours(),
      utcMin:   utcDate.getUTCMinutes()
    };
  } catch(err) {
    console.warn("Timezone API failed, using longitude estimate:", err.message);
    const offsetHours = Math.round(lon / 15);
    const utcDecimal = hour + minute / 60 - offsetHours;
    const totalMin = Math.round(utcDecimal * 60);
    const d = new Date(Date.UTC(year, month-1, day, 0, 0) + totalMin * 60000);
    return {
      utcYear:  d.getUTCFullYear(),
      utcMonth: d.getUTCMonth() + 1,
      utcDay:   d.getUTCDate(),
      utcHour:  d.getUTCHours(),
      utcMin:   d.getUTCMinutes()
    };
  }
}

async function fetchNatalChart(year, month, day, localHour, localMin, lat, lon) {
  const utc = await getTimezoneOffset(lat, lon, year, month, day, localHour, localMin);
  const res = await fetch(`${REPLIT_API}/natal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      year: utc.utcYear, month: utc.utcMonth, day: utc.utcDay,
      hour: utc.utcHour, minute: utc.utcMin,
      lat: lat, lon: lon
    })
  });
  if (!res.ok) throw new Error(`Railway API error: ${res.status}`);
  return { chart: await res.json(), utc };
}

async function fetchAsteroids(utc, lat, lon, requestedPacks) {
  try {
    const res = await fetch(`${REPLIT_API}/asteroids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packs: requestedPacks,
        year: utc.utcYear, month: utc.utcMonth, day: utc.utcDay,
        hour: utc.utcHour, minute: utc.utcMin,
        lat: lat, lon: lon
      })
    });
    if (!res.ok) throw new Error(`Asteroids API error: ${res.status}`);
    return await res.json();
  } catch(err) {
    console.warn("Asteroids API failed (non-blocking):", err.message);
    return null;
  }
}

function buildPacksHTML(asteroids, requestedPacks) {
  if (!asteroids) return "";

  const sections = requestedPacks.map(packKey => {
    const pack = asteroids[packKey];
    if (!pack || Object.keys(pack).length === 0) return "";

    const meta = PACK_META[packKey] || { label: packKey, title: packKey, intro: "" };

    const rows = Object.entries(pack).map(([key, a]) => {
      if (a.error) return "";
      const signFR  = SIGNS_FR[a.sign] || a.sign;
      const signSym = SIGNS_SYM[a.sign] || "";
      return `<tr>
        <td style="padding:6px 12px;font-size:13px;color:#D7D0C4;border-bottom:1px solid rgba(212,175,55,.07);">${a.name} <span style="font-size:10px;color:rgba(212,175,55,.35);">#${a.id}</span></td>
        <td style="padding:6px 12px;font-size:13px;color:#D4AF37;border-bottom:1px solid rgba(212,175,55,.07);">${a.degree}°${String(a.minute).padStart(2,"0")}' ${signSym} ${signFR}</td>
        <td style="padding:6px 12px;font-size:12px;color:rgba(212,175,55,.55);border-bottom:1px solid rgba(212,175,55,.07);">Maison ${a.house}</td>
      </tr>`;
    }).join("");

    if (!rows) return "";

    return `
    <div style="margin-bottom:32px;">
      <div style="font-size:9px;letter-spacing:5px;color:rgba(212,175,55,.4);text-transform:uppercase;margin-bottom:4px;">Pack ${meta.label}</div>
      <div style="font-size:13px;color:#D4AF37;letter-spacing:2px;margin-bottom:8px;">${meta.title}</div>
      <div style="font-size:12px;color:rgba(215,208,196,.5);font-style:italic;margin-bottom:12px;line-height:1.6;">${meta.intro}</div>
      <table style="width:100%;border-collapse:collapse;background:rgba(0,0,0,.15);">${rows}</table>
    </div>`;
  }).join("");

  if (!sections.trim()) return "";

  return `
  <div style="border-top:1px solid rgba(212,175,55,.12);padding-top:28px;margin-top:28px;">
    <div style="font-size:9px;letter-spacing:5px;color:rgba(212,175,55,.4);text-transform:uppercase;margin-bottom:24px;">Archives des Astéroïdes</div>
    ${sections}
  </div>`;
}

function buildMailHTML(nom, date_naissance, heure_naissance, lieu, geo, chart, asteroids, requestedPacks) {
  const asc = chart.ascendant;
  const mc  = chart.mc;
  const planetsOrder = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","NorthNode"];

  const rows = planetsOrder.map(key => {
    const p = chart.planets[key];
    if (!p) return "";
    const nameFR = PLANETS_FR[key] || key;
    const sym    = PLANETS_SYM[key] || "";
    const signFR = SIGNS_FR[p.sign] || p.sign;
    const signSym= SIGNS_SYM[p.sign] || "";
    const retro  = p.retrograde ? " ℞" : "";
    return `<tr>
      <td style="padding:7px 12px;font-size:13px;color:#D7D0C4;border-bottom:1px solid rgba(212,175,55,.07);">${sym} ${nameFR}</td>
      <td style="padding:7px 12px;font-size:13px;color:#D4AF37;border-bottom:1px solid rgba(212,175,55,.07);">${p.degree}°${String(p.minute).padStart(2,"0")}' ${signSym} ${signFR}${retro}</td>
      <td style="padding:7px 12px;font-size:12px;color:rgba(212,175,55,.55);border-bottom:1px solid rgba(212,175,55,.07);">Maison ${p.house}</td>
    </tr>`;
  }).join("");

  const ascFR  = SIGNS_FR[asc.sign] || asc.sign;
  const ascSym = SIGNS_SYM[asc.sign] || "";
  const mcFR   = SIGNS_FR[mc.sign] || mc.sign;
  const mcSym  = SIGNS_SYM[mc.sign] || "";

  const packsHTML = buildPacksHTML(asteroids, requestedPacks);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="background:#0a0a0a;margin:0;padding:32px;font-family:Georgia,serif;">
<div style="max-width:660px;margin:0 auto;background:#0d0d0d;border:1px solid rgba(212,175,55,.2);padding:40px;">
  <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid rgba(212,175,55,.12);">
    <div style="font-size:10px;letter-spacing:7px;color:rgba(212,175,55,.4);text-transform:uppercase;margin-bottom:6px;">Archives de l'Âme</div>
    <div style="font-size:20px;letter-spacing:6px;color:#D4AF37;text-transform:uppercase;">SOULSCRIPT</div>
    <div style="margin-top:12px;font-size:10px;letter-spacing:4px;color:rgba(212,175,55,.4);text-transform:uppercase;">Nouveau Dossier — Thème Natal</div>
  </div>
  <div style="margin-bottom:28px;padding:16px;background:rgba(212,175,55,.03);border-left:2px solid rgba(212,175,55,.25);">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:3px 0;font-size:12px;color:rgba(212,175,55,.55);width:140px;">Nom</td><td style="font-size:13px;color:#D7D0C4;">${nom}</td></tr>
      <tr><td style="padding:3px 0;font-size:12px;color:rgba(212,175,55,.55);">Date</td><td style="font-size:13px;color:#D7D0C4;">${date_naissance}</td></tr>
      <tr><td style="padding:3px 0;font-size:12px;color:rgba(212,175,55,.55);">Heure</td><td style="font-size:13px;color:#D7D0C4;">${heure_naissance}</td></tr>
      <tr><td style="padding:3px 0;font-size:12px;color:rgba(212,175,55,.55);">Lieu</td><td style="font-size:13px;color:#D7D0C4;">${lieu}</td></tr>
      <tr><td style="padding:3px 0;font-size:12px;color:rgba(212,175,55,.55);">Coordonnées</td><td style="font-size:12px;color:rgba(215,208,196,.5);">${geo.lat.toFixed(4)}°N ${geo.lon.toFixed(4)}°E</td></tr>
    </table>
  </div>
  <div style="margin-bottom:24px;">
    <div style="font-size:9px;letter-spacing:5px;color:rgba(212,175,55,.4);text-transform:uppercase;margin-bottom:10px;">Points Angulaires</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:7px 12px;font-size:14px;color:#D4AF37;font-weight:bold;">↑ Ascendant</td>
          <td style="padding:7px 12px;font-size:14px;color:#D4AF37;">${asc.degree}°${String(asc.minute).padStart(2,"0")}' ${ascSym} ${ascFR}</td></tr>
      <tr><td style="padding:7px 12px;font-size:13px;color:rgba(212,175,55,.6);">MC</td>
          <td style="padding:7px 12px;font-size:13px;color:rgba(212,175,55,.6);">${mc.degree}°${String(mc.minute).padStart(2,"0")}' ${mcSym} ${mcFR}</td></tr>
    </table>
  </div>
  <div style="margin-bottom:28px;">
    <div style="font-size:9px;letter-spacing:5px;color:rgba(212,175,55,.4);text-transform:uppercase;margin-bottom:10px;">Positions Planétaires — Whole Signs</div>
    <table style="width:100%;border-collapse:collapse;background:rgba(0,0,0,.15);">${rows}</table>
  </div>
  ${packsHTML}
  <div style="border-top:1px solid rgba(212,175,55,.08);padding-top:16px;text-align:center;margin-top:28px;">
    <div style="font-size:10px;color:rgba(212,175,55,.25);letter-spacing:3px;text-transform:uppercase;">Swiss Ephemeris · Whole Signs · Tropical · Géocentrique</div>
    <div style="margin-top:6px;font-size:10px;color:rgba(215,208,196,.15);">Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</div>
  </div>
</div></body></html>`;
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const body = JSON.parse(event.body);
    const { nom, date_naissance, heure_naissance, lieu_naissance, email } = body;
    if (!nom || !date_naissance || !heure_naissance || !lieu_naissance || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: "Champs manquants" }) };
    }

    const requestedPacks = body.packs ?? ["relationnel", "karma", "ombre", "mission", "sante"];

    const [year, month, day] = date_naissance.split("-").map(Number);
    const [localHour, localMin] = heure_naissance.split(":").map(Number);

    const geo = await geocode(lieu_naissance);
    const { chart, utc } = await fetchNatalChart(year, month, day, localHour, localMin, geo.lat, geo.lon);
    const asteroids = await fetchAsteroids(utc, geo.lat, geo.lon, requestedPacks);
    const html = buildMailHTML(nom, date_naissance, heure_naissance, lieu_naissance, geo, chart, asteroids, requestedPacks);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SOULSCRIPT <onboarding@resend.dev>",
        to: ["soulscript.officiel@outlook.com"],
        subject: `✦ SOULSCRIPT — Nouveau dossier : ${nom}`,
        html
      })
    });

    if (!resendRes.ok) console.error("Resend error:", await resendRes.text());

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error("Erreur natal-chart:", err);
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
  }
};
