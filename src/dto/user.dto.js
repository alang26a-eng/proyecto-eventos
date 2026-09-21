import { pick, referenceId } from './fields.js';
export const currentUserDTO = user => ({ id: referenceId(user), ...pick(user, ['email', 'role']) });
export const userDTO = user => ({ id: referenceId(user), ...pick(user, ['first_name', 'last_name', 'email', 'role']) });
export const adminUserDTO = user => ({ _id: referenceId(user), ...pick(user, ['first_name', 'last_name', 'email', 'role']) });
