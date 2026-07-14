#!/usr/bin/env bash

set -euo pipefail

printf '\n===== BlueCrew 2028.13C full-suite validation =====\n\n'

npm test

printf '\n===== changed files =====\n'
git status --short

printf '\n===== diff summary =====\n'
git diff --stat

printf '\n===== 2028.13C validation complete =====\n'
printf 'Full Playwright suite passed.\n'
printf 'Responsive Layout & Final UX Hardening is complete.\n'
