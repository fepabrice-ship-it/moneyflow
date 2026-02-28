Cahier des Charges : "MoneyFlow - Brayce Edition"

1. Objectif du ProjetDévelopper une application web dynamique et granulaire permettant de suivre en temps réel les finances personnelles, en distinguant strictement les obligations (charges fixes, tontines, etc...) du budget de divertissement.

2. Stack TechniqueFrontend : React.js (Vite) + Tailwind CSS.Backend & Auth : Supabase (PostgreSQL + Auth + Edge Functions).

Visualisation : Recharts ou Tremor (pour les graphiques).

Icônes : Lucide-React.

3. Fonctionnalités Clés (MVP)

A. Dashboard "Safe-to-Spend" (Indicateur Phare)Calcul dynamique du Reste à Vivre : Revenu - (Somme des Obligations du mois) - (Dépenses déjà effectuées).

Vue d'ensemble circulaire montrant la répartition : Fixe (Obligations) vs Variable (Loisirs).

B. Interface Mobile-First : Pour noter rapidement une dépense à la sortie de la salle de sport ou après un achat.Feedback visuel : Barre de progression passant du vert au rouge si le budget "Loisirs" dépasse les prévisions.

6. Contraintes SpécifiquesPrécision locale : Gestion de la monnaie sans décimales inutiles (FCFA).Dynamisme : Tout changement dans une dépense doit recalculer instantanément le "Safe-to-Spend".

Note pour Antigravity : L'utilisateur est un développeur et designer graphique (Brayc). L'UI doit être épurée, minimaliste, avec une attention particulière à la typographie. Le système doit automatiser le calcul des tontines en fonction du calendrier civil.

- un dashboard qui montre le montant qu'il reste à vivre.
- un dashboard qui montre le montant qu'il reste à dépenser.
- un dashboard qui montre le montant qu'il reste à épargner.
