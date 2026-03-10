# Microwest Smartphone Reservation Dashboard

Mini application interne pour enregistrer rapidement les reservations clients quand un smartphone reconditionne n'est pas disponible en magasin.

## Stack

- React 19 + Vite
- Tailwind CSS 4
- Node.js + Express
- SQLite via `node:sqlite`

## Structure

```text
.
|-- client
|-- server
|-- package.json
`-- README.md
```

## Prerequis

- Node.js 24 ou plus recent
- npm 10 ou plus recent

## Installation

Depuis la racine du projet :

```bash
npm install
```

## Lancement en developpement

Depuis la racine du projet :

```bash
npm run dev
```

Cette commande lance :

- le frontend Vite sur `http://localhost:5173`
- l'API backend sur `http://localhost:3001`

Le frontend proxifie automatiquement les requetes `/api` vers le backend.

## Commandes racine

Depuis la racine du projet :

```bash
npm run dev
npm run build
npm run start
```

Comportement des scripts :

- `npm run dev` lance le frontend et le backend en parallele
- `npm run build` build uniquement le frontend
- `npm run start` lance uniquement le serveur backend

## Scripts par dossier

Si besoin, chaque partie peut etre lancee separement.

Backend :

```bash
cd server
npm run dev
```

```bash
cd server
npm run start
```

Frontend :

```bash
cd client
npm run dev
```

```bash
cd client
npm run build
npm run preview
```

## Fonctionnalites

- ajout, modification et suppression de reservations
- suivi rapide des statuts : `en_attente`, `contacte`, `vendu`, `annule`
- recherche par client, numero de telephone ou note
- filtres par modele, capacite et statut
- filtre "seulement en attente"
- tri par date
- compteurs total et en attente
- export CSV des donnees filtrees

## API principale

- `GET /api/health`
- `GET /api/options`
- `GET /api/requests`
- `GET /api/requests/export/csv`
- `POST /api/requests`
- `PUT /api/requests/:id`
- `PATCH /api/requests/:id/status`
- `DELETE /api/requests/:id`

## Donnees

La base SQLite est creee automatiquement au premier lancement dans `server/data/microwest.sqlite`.

Le mode journal SQLite `WAL` est active automatiquement.

## Note SQLite

Le backend utilise le module natif `node:sqlite` de Node.js pour eviter toute compilation locale de dependance C++.
