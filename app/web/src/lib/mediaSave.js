import pb from '@/lib/dataClient';
import { sanitizeImageUrlForSave } from '@/lib/imageUrl';
import { uploadImageToRecord, removeImageFromRecord, syncUploadedImageUrl } from '@/components/admin/ImageField';

export function pbErrorMessage(err) {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  const data = err.data || err.response || {};
  if (data.data && typeof data.data === 'object') {
    const firstKey = Object.keys(data.data)[0];
    if (firstKey && data.data[firstKey]?.message) {
      return `${firstKey}: ${data.data[firstKey].message}`;
    }
  }
  return data.message || err.message || 'Erro desconhecido';
}

export function sanitizeUrlField(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith('blob:')) return '';
  return sanitizeImageUrlForSave(value);
}

/**
 * Guarda registo com suporte a ficheiro PB + URL externa + remoção.
 */
export async function saveRecordWithMedia({
  collection,
  recordId,
  data,
  create,
  file,
  fileField,
  urlField,
  removed = false,
  hadFile = false,
}) {
  const payload = { ...data };
  if (urlField && urlField in payload) {
    payload[urlField] = sanitizeUrlField(payload[urlField]);
  }

  let id = recordId;

  if (removed && id && fileField) {
    await removeImageFromRecord(collection, id, fileField, urlField || undefined);
    if (urlField) payload[urlField] = '';
  }

  if (id) {
    await pb.collection(collection).update(id, payload);
  } else {
    const created = await create
      ? await create(payload)
      : await pb.collection(collection).create(payload);
    id = created.id;
  }

  if (file && id && fileField) {
    await uploadImageToRecord(collection, id, fileField, file);
    if (urlField) {
      await syncUploadedImageUrl(collection, id, fileField, urlField);
    }
  } else if (urlField && payload[urlField] && hadFile && !file && !removed && fileField) {
    await removeImageFromRecord(collection, id, fileField);
  }

  return id;
}

export function recordImageUrl(record, urlField, fileField) {
  if (!record) return '';
  if (record[fileField]) {
    try {
      return pb.files.getURL(record, record[fileField]);
    } catch {
      // fall through
    }
  }
  return sanitizeUrlField(record[urlField] || '');
}
