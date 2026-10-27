# PSG Transport Management — API

Express 5 and MongoDB/Mongoose API for login, role-based access, user provisioning, and fleet vehicles.

## Run locally

1. Copy `env.example` to `.env`, set `MONGODB_URI`, and replace `JWT_SECRET` with a unique random secret of at least 32 characters. Set the frontend origin in `CLIENT_URL`.
2. Install dependencies with `npm install`.
3. Create the first administrator:

   ```powershell
   $env:ADMIN_NAME="Transport Administrator"
   $env:ADMIN_EMAIL="admin@example.com"
   $env:ADMIN_PASSWORD="use-a-unique-password-at-least-12-characters"
   npm run seed:admin
   ```

   The seed command creates an administrator only if that email does not exist. Do not commit `.env` or real credentials.

4. Start the API with `npm run dev` (watch mode) or `npm start`. The default address is `http://localhost:3000`.

## Roles

| Role | Read vehicles | Create/update/delete vehicles | Create user accounts |
| --- | --- | --- | --- |
| `admin` | Yes | Yes | Yes |
| `manager` | Yes | Yes | No |
| `operator` | Yes | No | No |

Administrators create manager and operator accounts through `POST /api/auth/users`; public sign-up is intentionally disabled.

## API

All authenticated routes use the HTTP-only `psg_transport_session` cookie (configurable with `AUTH_COOKIE_NAME`). The browser client sends credentials; configure `CLIENT_URL` to the exact allowed frontend origin.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | Sign in; sets the session cookie |
| `GET` | `/api/auth/me` | Authenticated | Return the current user |
| `POST` | `/api/auth/logout` | Public | Clear the session cookie |
| `POST` | `/api/auth/users` | Admin | Create an account |
| `GET` | `/api/vehicles` | Authenticated | List vehicles; optional `type` and `status` filters |
| `POST` | `/api/vehicles` | Admin, manager | Add a vehicle |
| `PATCH` | `/api/vehicles/:id` | Admin, manager | Update provided vehicle fields |
| `DELETE` | `/api/vehicles/:id` | Admin, manager | Remove a vehicle |
| `GET` | `/api/service-history` | Admin, transport officer | Search and page through vehicle service records |
| `GET` | `/api/service-history/stats` | Admin, transport officer | Fleet-wide service counts and spend summaries |
| `POST` | `/api/service-history` | Admin, transport officer | Record a service, repair, inspection, or scheduled maintenance |
| `PUT` | `/api/service-history/:id` | Admin, transport officer | Update a service record |
| `DELETE` | `/api/service-history/:id` | Admin | Delete a service record |

Service history records include a vehicle, service category and status, service date and odometer, work description, provider, cost, optional next-service date/odometer, and notes. List filters include search, vehicle, service type, status, and service-date range. Service records are kept in their own collection because a vehicle's maintenance history can grow over time.

Vehicle JSON fields: `type` (`bus` or `car`), `registrationNumber`, `make`, `model`, `year`, `capacity`, `fuelType` (`diesel`, `petrol`, `electric`, `hybrid`, `cng`, `other`), `status` (`active`, `maintenance`, `inactive`), and optional `assignedDriver` and `notes`.

Example account creation:

```json
{
  "name": "Fleet Operator",
  "email": "operator@example.com",
  "password": "a-unique-password-of-12-chars",
  "role": "operator"
}
```

Passwords are hashed with bcrypt. JWT signing keys must remain private. In production, serve the client and API over HTTPS so the session cookie is marked `Secure`.
