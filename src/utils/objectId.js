import mongoose from 'mongoose';
import HttpError from './HttpError.js';

export function requireObjectId(value, label = 'Identificador') {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw new HttpError(400, label + ' inválido');
  }
  return new mongoose.Types.ObjectId(value);
}
