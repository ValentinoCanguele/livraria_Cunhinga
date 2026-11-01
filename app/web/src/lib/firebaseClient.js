/**
 * Firebase — só o Auth, e só para as ferramentas do Google Workspace do painel.
 *
 * Os dados da loja estão todos no Supabase. O Firestore foi desligado (as regras em
 * `firestore.rules` fecham tudo), por isso o SDK do Firestore saiu daqui: estava a ser
 * carregado em cada visita e a fazer no arranque um pedido a `test/connection` que as
 * regras negam. O que sobra é carregado dinamicamente por quem precisa.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const logoutFirebase = async () => {
  await signOut(auth);
};
