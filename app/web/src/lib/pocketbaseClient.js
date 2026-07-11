import PocketBase from 'pocketbase';

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');

// Disable automatic cancellation to prevent React double-renders or concurrent queries from aborting each other
pb.autoCancellation(false);

export default pb;
