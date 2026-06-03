import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

export async function encryptCPF(cpf) {
  if (!cpf || !cpf.trim()) return '';
  const fn = httpsCallable(functions, 'encryptPersonalData');
  const result = await fn({ cpf });
  return result.data.encrypted;
}
