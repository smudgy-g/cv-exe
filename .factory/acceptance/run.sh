#!/usr/bin/env bash
# The black-box acceptance of a pushed commit. Replace this stub; until you do, nothing can be delivered.
#
# It runs in a sandbox with NO network, with:
#   $PROJECT_ARCHIVE  a git archive (.tar) of the exact pushed commit
#   $COMMIT $REF      the commit it must report, and the branch it came from
#   $INPUTS           this directory, read-only, as the working directory
#   $ASSETS           your read-only assets directory, when acceptance.assets names one
#
# Print one JSON object on stdout and nothing else; logs go to stderr:
#   {"commit": "'"$COMMIT"'", "pass": true, "detail": "what was checked"}
# Exit zero for any completed verdict, including a failure. Exit nonzero only for an infrastructure problem.
printf '%s\n' 'Acceptance is not configured: write .factory/acceptance/run.sh in your repository.' >&2
exit 2
