// Modelo base en memoria. La persistencia se incorporará en próximas entregas.
export default class User {
  constructor({ id = null, firstName = '', lastName = '', email = '', passwordHash = '', role = 'user' } = {}) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.passwordHash = passwordHash;
    this.role = role;
  }
}
