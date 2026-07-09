import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';

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

export const initGoogleAuth = (onSuccess, onFailure) => {
  if (authStateListener) authStateListener();

  authStateListener = onAuthStateChanged(googleAuth, (user) => {
    if (user) {
      // Check session storage for token persistence in same browser session if desired, 
      // but skill recommends in-memory caching.
      if (cachedToken) {
        onSuccess(user, cachedToken);
      } else {
        // We need to re-login if token is cleared from memory, or retrieve from memory cache.
        onFailure();
      }
    } else {
      cachedToken = null;
      onFailure();
    }
  });

  return authStateListener;
};

export const signInWithGoogleWorkspace = async () => {
  try {
    const result = await signInWithPopup(googleAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) {
      throw new Error('Failed to obtain Google access token.');
    }
    cachedToken = credential.accessToken;
    return { user: result.user, token: cachedToken };
  } catch (error) {
    console.error('Google Workspace Sign-In Error:', error);
    throw error;
  }
};

export const logoutGoogleWorkspace = async () => {
  await googleAuth.signOut();
  cachedToken = null;
};

export const getCachedGoogleToken = () => cachedToken;

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
export const listGoogleContacts = async (token) => {
  const response = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos&pageSize=30', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to list Google Contacts');
  const data = await response.json();
  const connections = data.connections || [];

  return connections.map((c) => {
    const name = c.names?.[0]?.displayName || 'Sem Nome';
    const email = c.emailAddresses?.[0]?.value || 'Sem Email';
    const phone = c.phoneNumbers?.[0]?.value || 'Sem Telefone';
    const photo = c.photos?.[0]?.url || null;
    return {
      resourceName: c.resourceName,
      name,
      email,
      phone,
      photo
    };
  });
};
