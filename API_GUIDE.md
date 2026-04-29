# Documentation API Ali Mobile Backend

Cette API gère le backend de la plateforme Ali Mobile, incluant l'authentification des administrateurs, le suivi des transactions et les notifications via n8n.

## 🚀 Configuration de base

- **URL de Production :** `https://votre-backend.render.com` (à remplacer par votre URL réelle)
- **Format des données :** JSON
- **Authentification :** JWT (Bearer Token)

---

## 🔐 Authentification

Toutes les routes `/api/admin/*` nécessitent un jeton d'accès valide.

### 1. Connexion Admin
`POST /api/auth/login`

**Corps de la requête :**
```json
{
  "email": "admin@alimobile.com",
  "password": "votre_mot_de_passe"
}
```

**Réponse (Success) :**
Le `refreshToken` est automatiquement stocké dans un cookie HTTP-only sécurisé.
```json
{
  "accessToken": "eyJhbG...",
  "admin": {
    "name": "Gérard",
    "email": "admin@alimobile.com"
  }
}
```

### 2. Rafraîchir le Token
`POST /api/auth/refresh-token`
(Utilise le cookie `refreshToken`)

---

## 👤 Gestion des Administrateurs

L'inscription publique est désactivée par sécurité. Utilisez le script fourni en ligne de commande sur le serveur :

```bash
node scripts/create-admin.js <email> <mot_de_passe> "<nom>"
```

---

## 📊 Dashboard & Statistiques

### 1. Obtenir les Statistiques
`GET /api/admin/stats`
*Nécessite Header: `Authorization: Bearer <token>`*

**Réponse :**
```json
{
  "totalTransactions": 150,
  "paidTransactions": 20,
  "activatedTransactions": 120,
  "pendingTransactions": 10,
  "totalRevenue": 4500.5,
  "activationRate": 80,
  "platformBreakdown": [
    { "platform": "WhatsApp", "_count": { "id": 100 } },
    { "platform": "Telegram", "_count": { "id": 50 } }
  ],
  "dailyRevenue": [
    { "date": "2026-04-20", "revenue": 500 },
    { "date": "2026-04-21", "revenue": 750 }
  ]
}
```

---

## 💸 Transactions

### 1. Initialiser un Paiement
`POST /api/payment/initiate`
Initie un paiement via SerdiPay.

**Corps de la requête :**
```json
{
  "customerPhone": "243810000000",
  "customerName": "Nom Client",
  "platform": "WhatsApp",
  "decoderNumber": "1234567890",
  "amount": 10.0
}
```

### 2. Initialiser un Paiement de TEST
`POST /api/payment/initiate-test`
Simule un paiement sans appeler SerdiPay. La transaction est marquée comme test (`isTest: true`).

### 3. Liste des Transactions
`GET /api/admin/transactions`
*Nécessite Header: `Authorization: Bearer <token>`*

### 4. Confirmer un Paiement de TEST (Admin)
`PATCH /api/admin/transactions/:id/confirm-test`
*Nécessite Header: `Authorization: Bearer <token>`*
Permet à l'admin de confirmer manuellement la réception d'un paiement de test. Passe le statut à `PAID`.

### 5. Activer une Transaction
`PATCH /api/admin/transactions/:id/activate`
*Nécessite Header: `Authorization: Bearer <token>`*

Cette route :
1. Change le statut en `ACTIVATED`.
2. Déclenche automatiquement le webhook n8n pour notifier le client.

---

## 🧪 Tests & Notifications

### 1. Tester la notification WhatsApp
`POST /api/admin/test-whatsapp`
*Nécessite Header: `Authorization: Bearer <token>`*

**Corps de la requête :**
```json
{
  "phone": "243000000000",
  "name": "Client Test"
}
```

---

## 🛠 Erreurs Communes

- **401 Unauthorized :** Token manquant ou expiré.
- **403 Forbidden :** Token invalide ou Refresh Token expiré.
- **CORS Error (Failed to fetch) :** L'URL de votre application frontend n'est pas autorisée dans `server.js`.
- **500 Internal Server Error :** Vérifiez les logs du serveur backend.

---

*Document généré le 27 Avril 2026 pour Ali Mobile.*
