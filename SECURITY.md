# Security policy

BRAVO handles brigade members' personal details and, at some stations, physical
access equipment. Please report security problems privately so they can be fixed
before they are public.

## Reporting a vulnerability

Use GitHub's private reporting: open the **Security** tab of this repository and
choose **Report a vulnerability**. Please don't open a public issue or pull
request for a security problem.

Include what you found, how to reproduce it, and what an attacker could do with
it. You should get a reply within a week.

## Supported versions

Only the latest `main` branch is supported. There are no maintained release
branches.

## If you run your own copy

- Anything in a `VITE_*` environment variable is built into the JavaScript that
  every visitor downloads. Never put a secret, password or API key in one.
- Keep personal data (contact lists, member exports, screenshots of real people)
  out of the repository and out of `public/`. Store it in your Convex deployment
  behind authentication.
