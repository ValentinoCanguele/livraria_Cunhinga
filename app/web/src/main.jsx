import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { initFeatureFlags } from '@/lib/featureFlags';

// Antes de montar: os interruptores viram atributos no `<html>`, e o CSS já encontra o
// estado certo na primeira pintura. Feito depois, os elementos apareciam um instante com
// os efeitos ligados antes de os perderem.
initFeatureFlags();

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);