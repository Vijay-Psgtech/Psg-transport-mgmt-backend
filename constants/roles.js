export const ROLES = Object.freeze({
  ADMIN: 'admin',
  TRANSPORT_OFFICER: 'transport_officer',
  DRIVER: 'driver',
  STAFF: 'staff',
  STUDENT: 'student',
  PARENT: 'parent',
});

export const ROLE_LIST = Object.values(ROLES);

// Roles allowed to view and maintain the fleet
export const FLEET_MANAGERS = [ROLES.ADMIN, ROLES.TRANSPORT_OFFICER];
