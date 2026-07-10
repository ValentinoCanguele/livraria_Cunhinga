import PocketBase from 'pocketbase';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

const pb = new PocketBase(PB_URL);

// Evita cancelar pedidos de auth em paralelo (ex.: Firebase + login email)
pb.autoCancellation(false);

export default pb;
