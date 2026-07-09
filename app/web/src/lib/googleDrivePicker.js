import { normalizeImageUrl } from '@/lib/imageUrl';
import pb from '@/lib/pocketbaseClient';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';

let gapiPromise = null;
let gisPromise = null;

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(s);
  });
}

function loadGapi() {
  if (!gapiPromise) {
    gapiPromise = loadScript(GAPI_SRC, 'google-gapi').then(
      () => new Promise((resolve) => {
        window.gapi.load('picker', () => resolve(window.gapi));
      }),
    );
  }
  return gapiPromise;
}

function loadGis() {
  if (!gisPromise) {
    gisPromise = loadScript(GIS_SRC, 'google-gis');
  }
  return gisPromise;
}

function requestAccessToken(clientId) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services não carregou'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error));
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

function driveViewUrl(fileId) {
  return normalizeImageUrl(`https://drive.google.com/file/d/${fileId}/view`);
}

/**
 * Lista imagens via proxy autenticado no servidor (API key não exposta).
 */
export async function listDriveFolderImages({ folderId } = {}) {
  const params = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : '';
  const data = await pb.send(`/api/app/admin/drive-images${params}`, { method: 'GET' });
  return data?.files || [];
}

/**
 * Abre o Google Picker filtrado por pasta (requer client_id + api_key).
 */
export async function openGoogleDrivePicker({ apiKey, clientId, folderId, onPick, onError }) {
  try {
    await loadGis();
    await loadGapi();
    const token = await requestAccessToken(clientId);
    const google = window.google;
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
      .setIncludeFolders(true);
    if (folderId) view.setParent(folderId);

    const picker = new google.picker.PickerBuilder()
      .setDeveloperKey(apiKey)
      .setOAuthToken(token)
      .addView(view)
      .setOrigin(window.location.protocol + '//' + window.location.host)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
          const doc = data.docs[0];
          onPick?.(driveViewUrl(doc.id), doc);
        }
      })
      .build();
    picker.setVisible(true);
  } catch (err) {
    onError?.(err);
    throw err;
  }
}

export function driveImageFromId(fileId) {
  return driveViewUrl(fileId);
}
