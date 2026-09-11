// =========================================================
// server.js — Serveur relais 2AO Selfie (protocole v1.5)
// Hébergé sur Render (dz34sni-26.onrender.com)
// Rôles :
//   1. Agent (BLS)  → POST /task/:code        stocke la session OZ
//   2. Client (Tél) → GET /task/:code         récupère la session
//   3. Client (Tél) → POST /result/:code      remonte le verdict OZ
// =========================================================

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ---------------------------------------------------------
// STOCKAGE EN MÉMOIRE (non persistant, suffisant pour Render)
// ---------------------------------------------------------
const tasks = {};    // code -> session capturée par l'Agent
const results = {};  // code -> verdict OZ remonté par le Client

// Durée de vie d'un tâche : 30 min
const TTL_MS = 30 * 60 * 1000;

// ---------------------------------------------------------
// Cleanup périodique des tâches/résultats expirés
// ---------------------------------------------------------
setInterval(() => {
  const now = Date.now();
  for (const code of Object.keys(tasks)) {
    if (now - (tasks[code].timestamp || now) > TTL_MS) delete tasks[code];
  }
  for (const code of Object.keys(results)) {
    if (now - (results[code].ts || now) > TTL_MS) delete results[code];
  }
}, 60 * 1000);

// ---------------------------------------------------------
// Route de garde  /ping
// ---------------------------------------------------------
app.get('/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ---------------------------------------------------------
// 1) POST /task/:code — l'Agent dépose la session capturée
// ---------------------------------------------------------
app.post('/task/:code', (req, res) => {
  const code = req.params.code;
  if (!/^\d{4}$/.test(code)) {
    return res.status(400).json({ ok: false, error: 'code invalide' });
  }

  const body = req.body || {};

  tasks[code] = {
    // Nouvelles données OZ (inline) — c'est LE point clé du v1.5
    sessionToken: body.sessionToken || '',
    webAdapterUrl: body.webAdapterUrl || '',
    transactionId: body.transactionId || '',
    appointmentId: body.appointmentId || '',

    // Métadonnées
    userId: body.userId || '',
    code: code,
    realIp: body.realIp || '',
    proxy: body.proxy || '',
    userAgent: body.userAgent || '',
    pageUrl: body.pageUrl || '',
    verificationToken: body.verificationToken || '',
    timestamp: body.timestamp || Date.now()
  };

  console.log(`[TASK] 📥 ${code} — sessionToken=${(tasks[code].sessionToken || '').slice(0, 12)}...`);
  res.json({ ok: true });
});

// ---------------------------------------------------------
// 2) GET /task/:code — le Client récupère la session
// ---------------------------------------------------------
app.get('/task/:code', (req, res) => {
  const code = req.params.code;
  const task = tasks[code];

  if (!task) {
    return res.status(404).json({ ok: false, error: 'aucune session pour ce code' });
  }

  // On renvoie TOUT : le client construira l'URL OZ depuis sessionToken
  res.json({ ok: true, task: task });
});

// ---------------------------------------------------------
// 3) POST /result/:code — le Client remonte le verdict OZ
// ---------------------------------------------------------
app.post('/result/:code', (req, res) => {
  const code = req.params.code;
  if (!/^\d{4}$/.test(code)) {
    return res.status(400).json({ ok: false, error: 'code invalide' });
  }

  const body = req.body || {};
  results[code] = {
    ...body,
    ts: Date.now()
  };

  console.log(`[RESULT] 🏁 ${code} — ${body.status || 'N/A'}`);
  res.json({ ok: true });
});

// ---------------------------------------------------------
// 4) GET /result/:code — l'Agent lit le verdict du client
// ---------------------------------------------------------
app.get('/result/:code', (req, res) => {
  const code = req.params.code;
  const result = results[code];
  if (!result) {
    return res.status(404).json({ ok: false, error: 'aucun resultat pour ce code' });
  }
  res.json({ ok: true, result: result });
});

// ---------------------------------------------------------
// Page de test (facultatif) pour vérifier chez Render
// ---------------------------------------------------------
app.get('/', (req, res) => {
  res.send('<h1>2AO Selfie relay 🚀</h1><p>POST /task/:code — GET /task/:code — POST /result/:code</p>');
});

// ---------------------------------------------------------
// Démarrage (Render fournit le PORT automatiquement)
// ---------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[SERVER] 🚀 2AO Selfie relay écoute sur le port ${PORT}`);
});
