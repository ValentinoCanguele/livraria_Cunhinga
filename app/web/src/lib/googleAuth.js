import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth as mainAuth } from './firebaseClient';

const firebaseConfig = {
  projectId: "skilful-form-c5jvd",
  appId: "1:230460246055:web:5d55cdcb8fbeaac9c06602",
  apiKey: "AIzaSyB6W7DlLvEvFxJhjnhGZxa3H-blxQfz0n0",
  authDomain: "skilful-form-c5jvd.firebaseapp.com",
  storageBucket: "skilful-form-c5jvd.firebasestorage.app",
  messagingSenderId: "230460246055"
};

// Initialize Firebase safely under a custom named app to avoid collision with the main firestore database client app
const app = getApps().find(a => a.name === 'googleAuthApp') || initializeApp(firebaseConfig, 'googleAuthApp');
export const googleAuth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

// Add Workspace scopes requested
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.addScope('https://mail.google.com/');
googleProvider.addScope('https://www.googleapis.com/auth/contacts');

let cachedToken = null;
let authStateListener = null;

export const getCachedGoogleToken = () => {
  return cachedToken || sessionStorage.getItem('google_access_token');
};

export const setCachedGoogleToken = (token) => {
  cachedToken = token;
  if (token) {
    sessionStorage.setItem('google_access_token', token);
  } else {
    sessionStorage.removeItem('google_access_token');
  }
};

export const initGoogleAuth = (onSuccess, onFailure) => {
  if (authStateListener) authStateListener();

  // Listen to the main auth state instead of the isolated googleAuth to unify authentication
  authStateListener = onAuthStateChanged(mainAuth, (user) => {
    const token = getCachedGoogleToken();
    if (user && token) {
      onSuccess(user, token);
    } else {
      // If no token in sessionStorage but user is logged in, try googleAuth fallback
      const fallbackListener = onAuthStateChanged(googleAuth, (gUser) => {
        if (gUser && cachedToken) {
          onSuccess(gUser, cachedToken);
        } else {
          onFailure();
        }
      });
      return () => {
        fallbackListener();
      };
    }
  });

  return authStateListener;
};

export const signInWithGoogleWorkspace = async () => {
  try {
    // Unify login by signing in with the main Auth instance
    const result = await signInWithPopup(mainAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) {
      throw new Error('Failed to obtain Google access token.');
    }
    setCachedGoogleToken(credential.accessToken);
    
    return { user: result.user, token: credential.accessToken };
  } catch (error) {
    if (error && error.code === 'auth/popup-closed-by-user') {
      console.warn('Google Workspace Sign-In: Popup closed by user.');
    } else {
      console.error('Google Workspace Sign-In Error:', error);
    }
    throw error;
  }
};

export const logoutGoogleWorkspace = async () => {
  await signOut(mainAuth);
  await googleAuth.signOut();
  setCachedGoogleToken(null);
};

// ==========================================
// GOOGLE DRIVE API FUNCTIONS
// ==========================================
export const listDriveFiles = async (token) => {
  const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,webViewLink,iconLink,modifiedTime)&orderBy=modifiedTime%20desc', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to list Google Drive files');
  const data = await response.json();
  return data.files || [];
};

export const uploadDriveFile = async (token, file, metadata = {}) => {
  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();
  const fileDataPromise = new Promise((resolve) => {
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsBinaryString(file);
  });
  const fileData = await fileDataPromise;

  const fileMetadata = {
    name: file.name,
    ...metadata
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(fileMetadata) +
    delimiter +
    `Content-Type: ${file.type || 'application/octet-stream'}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    btoa(fileData) +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!response.ok) throw new Error('Failed to upload file to Google Drive');
  return response.json();
};

export const deleteDriveFile = async (token, fileId) => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to delete Google Drive file');
  return true;
};

// ==========================================
// GOOGLE CALENDAR API FUNCTIONS
// ==========================================
export const listCalendarEvents = async (token) => {
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=20&orderBy=startTime&singleEvents=true&timeMin=' + new Date().toISOString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to list Google Calendar events');
  const data = await response.json();
  return data.items || [];
};

export const createCalendarEvent = async (token, eventDetails) => {
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventDetails)
  });
  if (!response.ok) throw new Error('Failed to create Google Calendar event');
  return response.json();
};

export const deleteCalendarEvent = async (token, eventId) => {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to delete Google Calendar event');
  return true;
};

// ==========================================
// GMAIL API FUNCTIONS
// ==========================================
export const listGmailMessages = async (token) => {
  const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to list Gmail messages');
  const data = await response.json();
  const messages = data.messages || [];

  // Fetch details for each message
  const detailedMessages = await Promise.all(
    messages.map(async (msg) => {
      try {
        const detailRes = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          const headers = detail.payload?.headers || [];
          const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(Sem Assunto)';
          const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Desconhecido';
          const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || '';
          return {
            id: msg.id,
            subject,
            from,
            date,
            snippet: detail.snippet || ''
          };
        }
      } catch (err) {
        console.error('Error fetching message detail:', err);
      }
      return { id: msg.id, subject: 'Erro ao carregar', from: 'Desconhecido', snippet: '' };
    })
  );

  return detailedMessages;
};

export const sendGmailMessage = async (token, { to, subject, body }) => {
  // Gmail format: Raw base64url encoded RFC 2822 message
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    body
  ];
  const email = emailLines.join('\r\n');
  const base64Safe = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: base64Safe })
  });

  if (!response.ok) throw new Error('Failed to send email via Gmail');
  return response.json();
};

// ==========================================
// GOOGLE CONTACTS (PEOPLE API) FUNCTIONS
// ==========================================
function mapGoogleConnection(c) {
  const name = c.names?.[0]?.displayName || 'Sem Nome';
  const email = c.emailAddresses?.[0]?.value || '';
  const phone = c.phoneNumbers?.[0]?.value || '';
  const photo = c.photos?.[0]?.url || null;
  return {
    resourceName: c.resourceName,
    name,
    email,
    phone,
    photo
  };
}

export const listGoogleContacts = async (token) => {
  const response = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos&pageSize=30', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to list Google Contacts');
  const data = await response.json();
  return (data.connections || []).map(mapGoogleConnection);
};

export const listAllGoogleContacts = async (token, onProgress) => {
  const all = [];
  let pageToken = '';
  let page = 0;

  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections');
    url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers,photos');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to list Google Contacts');
    const data = await response.json();
    const batch = (data.connections || []).map(mapGoogleConnection);
    const valid = batch.filter((c) => c.name && (c.email || c.phone));
    all.push(...valid);
    pageToken = data.nextPageToken || '';
    page += 1;
    if (onProgress) onProgress({ loaded: all.length, page });
  } while (pageToken);

  return all;
};
