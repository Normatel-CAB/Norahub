import { supabase } from './supabase';

export async function encryptCPF(cpf) {
  if (!cpf || !cpf.trim()) return '';
  const { data, error } = await supabase.functions.invoke('encrypt-personal-data', {
    body: { cpf },
  });
  if (error) throw error;
  return data.encrypted;
}
