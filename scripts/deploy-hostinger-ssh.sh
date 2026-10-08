#!/usr/bin/env bash

set -Eeuo pipefail

mode="${1:-deploy}"

required=(
  HOSTINGER_SSH_HOST
  HOSTINGER_SSH_PORT
  HOSTINGER_SSH_USER
  HOSTINGER_TARGET_DIR
  HOSTINGER_SSH_PRIVATE_KEY_FILE
  HOSTINGER_SSH_KNOWN_HOSTS_FILE
)

for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error::$name is required"
    exit 1
  fi
done

if [[ "$HOSTINGER_SSH_HOST" != "195.200.3.12" ]]; then
  echo "::error::SSH transfers must use the pinned Hostinger IP (195.200.3.12)"
  exit 1
fi

if [[ "$HOSTINGER_SSH_PORT" != "65002" ]]; then
  echo "::error::Unexpected Hostinger SSH port"
  exit 1
fi

if [[ "$HOSTINGER_SSH_USER" != "u711511061" ]]; then
  echo "::error::Unexpected Hostinger SSH user"
  exit 1
fi

if [[ "$HOSTINGER_TARGET_DIR" != "/home/u711511061/domains/agenorsoft.app/public_html/domestic" ]]; then
  echo "::error::Unexpected Agenor Domestic production path: $HOSTINGER_TARGET_DIR"
  exit 1
fi

if [[ ! -f "$HOSTINGER_SSH_PRIVATE_KEY_FILE" ]]; then
  echo "::error::SSH private key file is missing"
  exit 1
fi

if [[ ! -f "$HOSTINGER_SSH_KNOWN_HOSTS_FILE" ]]; then
  echo "::error::SSH known_hosts file is missing"
  exit 1
fi

ssh_options=(
  -i "$HOSTINGER_SSH_PRIVATE_KEY_FILE"
  -p "$HOSTINGER_SSH_PORT"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=$HOSTINGER_SSH_KNOWN_HOSTS_FILE"
  -o ConnectTimeout=15
  -o ConnectionAttempts=4
  -o LogLevel=ERROR
)

scp_options=(
  -i "$HOSTINGER_SSH_PRIVATE_KEY_FILE"
  -P "$HOSTINGER_SSH_PORT"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=$HOSTINGER_SSH_KNOWN_HOSTS_FILE"
  -o ConnectTimeout=15
  -o ConnectionAttempts=4
  -o LogLevel=ERROR
)

remote="${HOSTINGER_SSH_USER}@${HOSTINGER_SSH_HOST}"
remote_target_q="$(printf '%q' "$HOSTINGER_TARGET_DIR")"
staging_dir="${DOMESTIC_DEPLOY_STAGING_DIR:-${DEPLOY_STAGING_DIR:-tmp/atomic-deploy}}"
run_id="${GITHUB_RUN_ID:-local}"
backup_dir="/home/u711511061/.domestic-deploy-backups/${run_id}"
backup_dir_q="$(printf '%q' "$backup_dir")"

if [[ "$mode" != "check" && ! "$run_id" =~ ^[0-9]+$ ]]; then
  echo "::error::Deploy and rollback require a numeric GitHub run id"
  exit 1
fi

ssh_remote() {
  ssh "${ssh_options[@]}" "$remote" "$1"
}

validate_remote() {
  # Asegurar que el directorio remoto exista
  ssh_remote "mkdir -p -- $remote_target_q"
  local resolved
  resolved="$(ssh_remote "test -d $remote_target_q && test -w $remote_target_q && readlink -f -- $remote_target_q")"
  if [[ "$resolved" != "$HOSTINGER_TARGET_DIR" ]]; then
    echo "::error::Remote Domestic path mismatch: got $resolved expected $HOSTINGER_TARGET_DIR"
    exit 1
  fi

  ssh-keygen -F "[${HOSTINGER_SSH_HOST}]:${HOSTINGER_SSH_PORT}" \
    -f "$HOSTINGER_SSH_KNOWN_HOSTS_FILE" >/dev/null
}

copy_stage() {
  local stage="$1"
  local local_dir="$staging_dir/$stage"

  if [[ ! -d "$local_dir" ]]; then
    echo "::error::Missing deploy stage $local_dir"
    exit 1
  fi

  if ! find "$local_dir" -type f -print -quit | grep -q .; then
    echo "::error::Deploy stage $stage is empty"
    exit 1
  fi

  scp "${scp_options[@]}" -r "$local_dir/." "$remote:$HOSTINGER_TARGET_DIR/"
}

backup_mutable() {
  ssh_remote "set -eu; mkdir -p -- $backup_dir_q; chmod 700 -- $backup_dir_q; for file in .htaccess manifest.webmanifest sw.js registerSW.js index.html version.json; do if test -f $remote_target_q/\"\$file\"; then cp -p -- $remote_target_q/\"\$file\" $backup_dir_q/\"\$file\"; : > $backup_dir_q/\"\$file.present\"; fi; done"
}

rollback_mutable() {
  ssh_remote "set -eu; test -d $backup_dir_q; for file in sw.js registerSW.js .htaccess manifest.webmanifest index.html version.json; do if test -f $backup_dir_q/\"\$file.present\"; then cp -p -- $backup_dir_q/\"\$file\" $remote_target_q/\"\$file\"; else rm -f -- $remote_target_q/\"\$file\"; fi; done"
}

case "$mode" in
  check)
    validate_remote
    echo "SSH authentication and production path verified."
    ;;
  rollback)
    validate_remote
    rollback_mutable
    echo "Mutable Domestic shell restored from $backup_dir."
    ;;
  deploy)
    validate_remote

    for stage in immutable service-worker shell index version; do
      if [[ ! -d "$staging_dir/$stage" ]]; then
        echo "::error::Missing deploy stage $stage"
        exit 1
      fi
    done

    backup_mutable
    rollback_needed=true
    trap 'if [[ "$rollback_needed" == true ]]; then rollback_mutable; fi' ERR

    echo "DEPLOY_ORDER=1_assets"
    copy_stage immutable

    echo "DEPLOY_ORDER=2_verify_assets_http"
    DOMESTIC_IMMUTABLE_DIR="$staging_dir/immutable" \
      node scripts/verify-hostinger-assets.mjs

    echo "DEPLOY_ORDER=3_service_worker"
    copy_stage service-worker

    echo "DEPLOY_ORDER=4_main_shell"
    copy_stage shell

    echo "DEPLOY_ORDER=5_index_html"
    copy_stage index

    echo "DEPLOY_ORDER=6_version_json"
    copy_stage version

    rollback_needed=false
    trap - ERR

    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
      echo "backup_dir=$backup_dir" >> "$GITHUB_OUTPUT"
    fi
    echo "SSH deploy completed; rollback retained at $backup_dir."
    ;;
  *)
    echo "::error::Usage: $0 check|deploy|rollback"
    exit 1
    ;;
esac
