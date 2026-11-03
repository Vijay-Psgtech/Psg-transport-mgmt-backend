export const ROLES = Object.freeze({
  ADMIN: 'admin',
  TRANSPORT_OFFICER: 'transport_officer',
  DRIVER: 'driver',
  TRANSPORT_USER: 'transport_user',
});

export const ROLE_LIST = Object.values(ROLES);

// Roles allowed to view and maintain the fleet
export const FLEET_MANAGERS = [ROLES.ADMIN, ROLES.TRANSPORT_OFFICER];
