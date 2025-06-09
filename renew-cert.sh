#!/bin/bash

# Se placer dans le dossier du script (portfolio-2)
cd "$(dirname "$0")"

echo ""
echo "🔁 [$(date)] Démarrage du renouvellement des certificats..."

# Étape 1 : renouvellement classique
docker compose run --rm certbot renew

# Étape 2 : simulation pour détecter si un renouvellement a réellement eu lieu
RENEWED=$(docker compose run --rm certbot renew --dry-run | grep "Congratulations" || true)

if [[ "$RENEWED" == *"Congratulations"* ]]; then
  echo "✅ Certificats renouvelés, rechargement de NGINX..."
  docker compose exec nginx nginx -s reload
else
  echo "ℹ️ Aucun renouvellement nécessaire (certificats toujours valides)."
fi

echo "✔️ Fin du processus de renouvellement."
echo ""
