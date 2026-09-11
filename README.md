# Quick Delivery - Delivery Operations Dashboard

> Tableau de bord de gestion des opérations de livraison avec suivi en temps réel, alertes automatiques et statistiques de performance.



## 🚀 Stack technique

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=flat-square&logo=bootstrap&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat-square&logo=chart.js&logoColor=white)

## 📋 Prérequis

- Navigateur web moderne (Chrome, Firefox, Edge, Safari)
- Serveur web local ou hébergement statique (pour l'accès via HTTP/HTTPS)
- Compte Supabase (optionnel, pour les fonctionnalités en temps réel)

## ⚙️ Installation

```bash
# 1. Cloner le repo
git clone https://github.com/ton-username/Delivery_operations_dashboard.git
cd Delivery_operations_dashboard

# 2. Configurer les variables d'environnement
cp .env.example .env
# Remplis les valeurs dans .env avec tes credentials Supabase et UltraMSG

# 3. Lancer le projet
# Option A: Avec un serveur local (recommandé)
npx serve .
# Ou avec Python:
python -m http.server 8000
# Ou avec PHP:
php -S localhost:8000

# Option B: Ouvrir directement index.html dans le navigateur
# (Certaines fonctionnalités pourraient être limitées)
```

## ✨ Fonctionnalités

### Gestion des commandes
- **Tableau de bord interactif** : Liste des commandes avec filtres avancés (date, heure, statut)
- **Recherche intelligente** : Recherche par numéro de commande, client, mandataire, ou numéro de téléphone
- **Suivi en temps réel** : Mises à jour automatiques des statuts et messages via Supabase Realtime
- **Impression multi-commandes** : Sélection et impression de plusieurs commandes en PDF

### Communication
- **Messagerie intégrée** : Envoi de messages texte, images et enregistrements audio
- **Intégration WhatsApp** : Liens directs vers WhatsApp pour contacter clients et mandataires
- **Historique des conversations** : Conservation complète des échanges pour chaque commande

### Alertes et suivi
- **Détection automatique des problèmes** : Alertes basées sur des mots-clés dans les messages
- **Système de notifications** : Cloche de notification pour les alertes en temps réel
- **Timeline des événements** : Historique complet des changements de statut et interventions

### Statistiques et rapports
- **Graphiques de performance** : Visualisation des commandes par heure, par jour
- **Analyse des mandataires** : Suivi des rejets et performance par livreur
- **Métriques de l'équipe** : Score de performance pour le département de suivi
- **Filtres temporels** : Analyse par jour, semaine ou mois

### Gestion des utilisateurs
- **Authentification sécurisée** : Connexion via Supabase Auth
- **Rôles et permissions** : Admin (accès complet) et Tracking (accès limité)
- **Approbation des comptes** : Système de validation des nouveaux utilisateurs
- **Gestion des profils** : Modification des informations et mots de passe

## 🌐 Démo live

En cours de déploiement

## 📁 Structure du projet

```
Delivery_operations_dashboard-main/
├── assets/
│   ├── css/              # Feuilles de style
│   ├── js/               # Modules JavaScript
│   │   ├── app.js        # Initialisation et routing
│   │   ├── auth.js       # Gestion de l'authentification
│   │   ├── store.js      # Gestion des données (localStorage/Supabase)
│   │   ├── orders.js     # Logique de gestion des commandes
│   │   ├── order-details.js  # Détails d'une commande
│   │   ├── stats.js      # Statistiques et graphiques
│   │   ├── alerts.js     # Système d'alertes
│   │   ├── realtime.js   # Connexion Supabase Realtime
│   │   └── ...
│   ├── data/             # Données JSON de démonstration
│   ├── icons/            # Icônes et favicon
│   └── audio/            # Fichiers audio
├── .github/workflows/    # Configuration GitHub Actions
├── index.html            # Page d'accueil
├── dashboard.html        # Tableau de bord principal
├── login.html            # Page de connexion
├── signup.html           # Page d'inscription
├── order-details.html    # Détails d'une commande
├── print-orders.html     # Impression des commandes
├── pending.html          # Page d'attente d'approbation
├── reset-password.html   # Réinitialisation du mot de passe
├── .env.example          # Exemple de configuration
├── .gitignore            # Fichiers ignorés par Git
├── .htaccess             # Configuration Apache
├── supabase-config.js    # Configuration Supabase (à personnaliser)
├── supabase_setup.sql    # Script SQL pour la base de données
└── insert_sample_data.sql # Données de démonstration
```

## 🔧 Configuration

### Supabase Setup

1. Créer un nouveau projet sur [supabase.com](https://supabase.com)
2. Exécuter le script `supabase_setup.sql` dans l'éditeur SQL Supabase
3. Copier l'URL et la clé anon depuis Settings > API
4. Configurer ces valeurs dans `.env` ou directement dans `supabase-config.js`

### UltraMSG (Optionnel)

Pour l'envoi de messages WhatsApp via UltraMSG :
1. Créer un compte sur [ultramsg.com](https://ultramsg.com)
2. Créer une instance et obtenir le token
3. Configurer dans `.env` ou `supabase-config.js`

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des nouvelles fonctionnalités
- Soumettre des pull requests

## 📄 Licence

Ce projet est sous licence MIT.

## 👤 Auteur

**Mohamed Aziz Chaabani**  
Portfolio : https://portfolio-chaabeni-mohamed-aziz.netlify.app  
GitHub : https://github.com/ton-username

---

**Note** : Ce projet utilise Supabase pour l'authentification et la base de données en temps réel. Assurez-vous de configurer correctement vos variables d'environnement avant le déploiement en production.
