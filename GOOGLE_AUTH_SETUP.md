# Configuration "Connexion avec Google" (Supabase + Google Cloud)

Le code de l'app est prêt (bouton « Continuer avec Google » sur web + Android natif).
Il reste ces étapes de configuration, à faire une seule fois.

## 1. Google Cloud Console (https://console.cloud.google.com)

### a) Créer le projet et l'écran de consentement
1. Créez (ou sélectionnez) un projet, ex. `MoneyFlow`.
2. **API et services → Écran de consentement** (en anglais : "OAuth consent
   screen"). La nouvelle console redirige vers **Google Auth Platform** avec
   un assistant « Premiers pas » :
   - **Informations sur l'application** : nom `MoneyFlow`, email d'assistance.
   - **Audience** : **Externe** (External) — pas « Interne », qui limiterait
     la connexion aux comptes de votre organisation Google.
   - **Coordonnées** : votre email → Créer.
   - Les scopes par défaut (`email`, `profile`, `openid`) suffisent.
3. Après les tests, **publiez l'app** : Google Auth Platform → **Audience →
   État de publication → Publier l'application** ("In production"), sinon
   seuls les utilisateurs test déclarés pourront se connecter.

### b) Client OAuth de type **Web** (obligatoire — utilisé par Supabase ET par Android)
1. **API et services → Identifiants → Créer des identifiants → ID client
   OAuth** (ou Google Auth Platform → onglet **Clients** → Créer un client —
   c'est le même écran).
2. Type : **Web application**, nom : `MoneyFlow Web`.
3. **Authorized redirect URIs** — ajoutez exactement :
   ```
   https://<VOTRE-REF-PROJET>.supabase.co/auth/v1/callback
   ```
   (la réf projet est dans votre `VITE_SUPABASE_URL`)
4. **Authorized JavaScript origins** — ajoutez l'URL de votre app web
   (production) et `http://localhost:5173` pour le dev.
5. Notez le **Client ID** (…apps.googleusercontent.com) et le **Client Secret**.

### c) Client OAuth de type **Android** (requis pour le sélecteur de compte natif)
1. **Identifiants → Créer des identifiants → ID client OAuth** → type **Android**.
2. Package name : `com.moneyflow.app`
3. SHA-1 : il faut ajouter **chaque** empreinte utilisée :
   - **Debug** (PowerShell) :
     ```powershell
     keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
     ```
   - **Release** : même commande avec votre keystore de release.
   - **Play Store** : si vous publiez avec Play App Signing, ajoutez aussi le
     SHA-1 affiché dans Play Console → Setup → App integrity → App signing.
   (Créez un client Android par SHA-1 si nécessaire.)
4. Aucun secret n'est généré pour ce client — c'est normal. Il n'y a rien à
   copier dans l'app : sa seule existence autorise le package + SHA-1.

## 2. Supabase Dashboard (https://supabase.com/dashboard)

1. **Authentication → Sign In / Providers → Google** :
   - **Enable** ✅
   - **Client ID** : le Client ID **Web** (étape 1b)
   - **Client Secret** : le secret **Web**
   - **Authorized Client IDs** (champ "Client IDs" / skip nonce non requis) :
     ajoutez aussi le Client ID **Web** ici — c'est lui qui signe les idToken
     envoyés par l'app Android via `signInWithIdToken`.
2. **Authentication → URL Configuration** :
   - **Site URL** : l'URL de production de l'app web.
   - **Additional Redirect URLs** : ajoutez `http://localhost:5173` (dev).
3. **Gardez le provider Email activé** : c'est le fallback pour les
   utilisateurs sans compte Google, et le flux « mot de passe oublié »
   en dépend.

## 3. Variables d'environnement

Dans `.env` (déjà préparé) :
```
VITE_GOOGLE_WEB_CLIENT_ID=<Client ID WEB>.apps.googleusercontent.com
```
Puis rebuild : `npm run build && npx cap sync android`.

## 4. Sécurité des utilisateurs existants

- Toutes vos données sont liées à l'UUID de `auth.users` (RLS via `auth.uid()`).
- Quand un utilisateur existant (inscrit par email/mot de passe) se connecte
  avec Google **avec la même adresse email**, Supabase **rattache l'identité
  Google au compte existant** (l'email Google est vérifié). Même UUID →
  mêmes projets, transactions, budgets. Rien à migrer.
- Un utilisateur dont l'email n'est pas un compte Google continue simplement
  à utiliser email + mot de passe (et peut désormais vraiment réinitialiser
  son mot de passe grâce au nouvel écran).

Pour vérifier qui utilise quoi, dans le SQL Editor Supabase :
```sql
select u.email, array_agg(i.provider) as providers
from auth.users u
join auth.identities i on i.user_id = u.id
group by u.email
order by u.email;
```

## 5. Checklist de test

- [ ] Web (localhost) : « Continuer avec Google » → redirection → retour connecté.
- [ ] Web : compte existant email/mot de passe → connexion Google avec le même
      email → on retrouve ses données (même UUID).
- [ ] Android : bouton Google → sélecteur de compte natif → connecté.
- [ ] « Mot de passe oublié » → email reçu → lien → écran « Nouveau mot de
      passe » → reconnexion avec le nouveau mot de passe.

## Dépannage rapide

- **`DEVELOPER_ERROR` / code 10 sur Android** : SHA-1 manquant ou mauvais
  package name dans le client Android, ou `VITE_GOOGLE_WEB_CLIENT_ID` qui
  n'est pas le client **Web**.
- **`Unacceptable audience in id_token`** (Supabase) : ajoutez le Client ID
  Web dans « Authorized Client IDs » du provider Google.
- **Redirection web qui échoue** : vérifiez l'URI de callback Supabase dans le
  client Web Google, et les Redirect URLs dans Supabase.
