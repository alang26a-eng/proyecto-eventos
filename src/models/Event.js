// Modelo base en memoria. La persistencia se incorporará en próximas entregas.
export default class Event {
  constructor({ id = null, title = '', description = '', date = null, location = '', capacity = 0, organizerId = null } = {}) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.date = date;
    this.location = location;
    this.capacity = capacity;
    this.organizerId = organizerId;
  }
}
