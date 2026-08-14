# Activer l'envoi d'emails (Resend)

## Pourquoi ce changement

Railway **bloque le SMTP sortant**. Vérifié depuis le serveur lui-même via
`GET /admin/mail/probe` : les connexions vers `smtp.hostinger.com` expirent
silencieusement sur les ports 465 **et** 587, alors que les mêmes ports
répondent en quelques millisecondes depuis un poste ordinaire. C'est une
protection anti-spam classique chez les hébergeurs.

La configuration Hostinger n'a jamais été en cause. On garde la boîte
`infodalyan@fashodalyansp.com` — elle continue de recevoir et d'envoyer
normalement à la main. Seuls les emails **automatiques** de la plateforme
(réinitialisation de mot de passe, confirmation de commande, alerte vendeur)
changent de circuit : ils partiront par l'API HTTPS de Resend, sur le port 443,
que personne ne bloque.

---

## 1. Créer le compte

[resend.com](https://resend.com) → **Sign up**. L'offre gratuite couvre
**3 000 emails par mois** (100 par jour), très largement au-delà des besoins
actuels de la plateforme.

## 2. Déclarer le domaine

**Domains** → **Add Domain** → saisir :

```
fashodalyansp.com
```

Pour la région, choisir **`eu-west-1` (Ireland)** : c'est la plus proche de
l'Afrique de l'Ouest et de l'Europe, donc la plus rapide pour tes destinataires.

Resend affiche alors 3 enregistrements DNS à créer.

## 3. Ajouter les enregistrements chez Hostinger

**hPanel** → **Domaines** → `fashodalyansp.com` → **DNS / Serveurs de noms**.

> **Ta messagerie Hostinger n'est pas menacée.** Les enregistrements de Resend
> portent sur le sous-domaine **`send`**, pas sur la racine du domaine. Ton
> `MX` principal — celui qui fait arriver le courrier dans ta boîte — reste
> intact. Ne le supprime surtout pas.
>
> Pour la même raison, laisser **« Enable Receiving » désactivé** dans Resend :
> cette option ajoute un `MX` sur la racine du domaine et détournerait le
> courrier entrant loin de ta boîte Hostinger. On veut envoyer, pas recevoir.

Trois enregistrements à créer :

| Type | Nom | Valeur | Priorité |
|---|---|---|---|
| `MX` | `send` | ⚠️ **copier depuis Resend** | `10` |
| `TXT` | `send` | ⚠️ **copier depuis Resend** | — |
| `TXT` | `resend._domainkey` | ⚠️ **copier depuis Resend** | — |

> **Ne recopie aucune valeur écrite dans ce guide.** La clé DKIM est unique à
> ton domaine : c'est une chaîne de plusieurs centaines de caractères que
> personne ne peut deviner. Resend l'affiche **tronquée** à l'écran
> (`p=MIGfMA[…]QIDAQAB`) — il faut impérativement utiliser **l'icône de copie**
> à côté de la valeur, jamais la sélectionner à la souris, sinon on ne copie
> que le fragment visible.
>
> Une valeur DKIM fausse ou tronquée donne toujours le même symptôme :
> `The fashodalyansp.com domain is not verified`.

Rappel du piège déjà rencontré : **Hostinger refuse d'ajouter un enregistrement
dont le nom existe déjà**. Si `send` existe (enregistrement de parking), le
supprimer d'abord.

Revenir ensuite sur Resend → **Verify DNS Records**. La vérification prend de
quelques minutes à une heure. Le statut doit passer à **Verified**.

## 4. Créer la clé API

**API Keys** → **Create API Key** :

- Nom : `odalyan-production`
- Permission : **Sending access**
- Domaine : `fashodalyansp.com`

La clé (`re_...`) **ne s'affiche qu'une seule fois**. La copier directement
dans Railway à l'étape suivante — ne la coller nulle part ailleurs.

## 5. Variables Railway

Service `@odalyan/api` → **Variables** :

| Variable | Valeur |
|---|---|
| `RESEND_API_KEY` | la clé `re_...` |
| `MAIL_FROM` | `Odalyan FashionSphere <infodalyan@fashodalyansp.com>` |

Dès que `RESEND_API_KEY` est présente, elle **prend le pas sur le SMTP** — les
variables `SMTP_*` peuvent rester en place, elles ne servent plus qu'au
développement local. Le service redémarre tout seul.

## 6. Vérifier

Page **Administration** → carte **Envoi d'emails**. La ligne « Canal » doit
afficher **Resend (API HTTPS)**. Saisir une adresse et cliquer sur
**Envoyer un test** : le message doit arriver en quelques secondes.

En cas de refus, le panneau affiche le message exact de Resend :

| Message | Cause |
|---|---|
| `The fashodalyansp.com domain is not verified` | Étape 3 pas terminée, ou DNS pas encore propagé |
| `Invalid API key` | Clé mal recopiée, ou espace parasite |
| `You can only send testing emails to your own address` | Domaine non vérifié : Resend limite alors aux emails de ton propre compte |

---

## Astuce : tester avant la vérification DNS

Sans attendre la propagation, on peut envoyer depuis l'adresse de bac à sable
de Resend en posant provisoirement :

```
MAIL_FROM=Odalyan FashionSphere <onboarding@resend.dev>
```

Cela ne fonctionne que vers l'adresse email du compte Resend, mais suffit à
confirmer que la clé et le circuit HTTPS marchent. Remettre l'adresse
définitive une fois le domaine vérifié.
