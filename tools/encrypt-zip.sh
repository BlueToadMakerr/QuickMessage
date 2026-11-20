#!/bin/sh
# Usage: tools/encrypt-zip.sh quickmessage-callNN.zip   ->  quickmessage-callNN.qmenc  (upload THAT to incoming/)
# Hybrid encryption with the public key in tools/qm-zip-public.pem: a random AES-256 key encrypts the zip, RSA-4096 (OAEP) encrypts that key.
# File layout: 512 bytes (RSA-encrypted AES key) + AES-256-CBC (PBKDF2) ciphertext. Only the private key (repo secret QM_ZIP_KEY) can open it.
set -e
in="$1"; [ -f "$in" ] || { echo "usage: $0 file.zip" >&2; exit 1; }
here=$(dirname "$0"); out="${in%.zip}.qmenc"; k=$(mktemp)
openssl rand -hex 32 > "$k"
openssl pkeyutl -encrypt -pubin -inkey "$here/qm-zip-public.pem" -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in "$k" -out "$out"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass file:"$k" -in "$in" >> "$out"
rm -f "$k"; echo "$out"
