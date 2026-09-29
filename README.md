## Admin sign-in

Admin access is disabled until server credentials are configured. Copy `.env.example` to `.env.local`, then set:

- `ADMIN_EMAIL` to the administrator's email address.
- `ADMIN_PASSWORD` to a unique password with at least 12 characters.
- `ADMIN_SESSION_SECRET` to a random value with at least 32 characters. Generate one with `node -p "require('node:crypto').randomBytes(32).toString('hex')"`.

Restart the development server after changing `.env.local`. Set the same variables in the production hosting environment before deployment. The server issues an HTTP-only, signed session cookie that expires after eight hours; the cookie is marked secure in production.

The admin dashboard can update stock counts and move orders between pending payment, processing, shipped, and completed. Changes are saved to PostgreSQL when `DATABASE_URL` is set, or to the local JSON data files otherwise.
