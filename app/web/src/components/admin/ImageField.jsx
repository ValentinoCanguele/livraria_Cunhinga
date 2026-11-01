import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link2, Upload, X, ImageIcon, Info, HardDrive, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import pb from '@/lib/dataClient';
import { normalizeImageUrl, isPersistableImageUrl } from '@/lib/imageUrl';
import { listDriveFolderImages, openGoogleDrivePicker } from '@/lib/googleDrivePicker';

/**
 * Campo de imagem com URL externa, upload ou Google Drive.
 */
export default function ImageField({
  label,
  value = '',
  onChange,
  onFileChange,
  onClear,
  hint,
  aspect = 'livre',
  maxSizeMB = 2,
  previewClassName = 'h-24 w-24',
  driveConfig = null,
  showDrive = true,
}) {
  const initialMode = value?.startsWith('blob:') ? 'upload' : 'url';
  const [mode, setMode] = useState(initialMode);
  const [preview, setPreview] = useState(value);
  const [error, setError] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveListed, setDriveListed] = useState(false);
  const inputRef = useRef(null);

  const defaultHint = `Formatos: PNG, JPG, WebP, SVG · Máx. ${maxSizeMB}MB · Proporção recomendada: ${aspect}`;

  useEffect(() => {
    if (!value?.startsWith('blob:')) {
      setPreview(value || '');
    }
  }, [value]);

  const handleUrlChange = (raw) => {
    const url = normalizeImageUrl(raw);
    setPreview(url || raw);
    onChange(url || raw);
    setError('');
    onFileChange?.(null);
  };

  const handleFile = (file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setError('Formato não suportado. Use PNG, JPG, WebP ou SVG.');
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Ficheiro demasiado grande. Máximo ${maxSizeMB}MB.`);
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    onChange(localUrl);
    onFileChange?.(file);
    setError('');
  };

  const clear = () => {
    setPreview('');
    onChange('');
    onFileChange?.(null);
    onClear?.();
    if (inputRef.current) inputRef.current.value = '';
    setDriveFiles([]);
    setDriveListed(false);
  };

  const driveEnabled = showDrive && driveConfig?.enabled;
  const driveApiKey = driveConfig?.api_key || driveConfig?.apiKey || '';
  const driveClientId = driveConfig?.client_id || driveConfig?.clientId || '';
  const driveFolderId = driveConfig?.folder_id || driveConfig?.folderId || '';

  const loadDriveGallery = useCallback(async () => {
    if (!driveFolderId) {
      setError('Configure a pasta do Google Drive em Integrações.');
      return;
    }
    setDriveLoading(true);
    setError('');
    try {
      const files = await listDriveFolderImages({ folderId: driveFolderId });
      setDriveFiles(files);
      setDriveListed(true);
      if (files.length === 0) {
        setError('Nenhuma imagem encontrada na pasta. Verifique se a pasta está partilhada publicamente ou use o Picker.');
      }
    } catch (err) {
      setError(err.message || 'Erro ao carregar imagens do Drive');
    } finally {
      setDriveLoading(false);
    }
  }, [driveFolderId]);

  const openPicker = async () => {
    if (!driveApiKey || !driveClientId) {
      setError('Configure API key e Client ID OAuth em Integrações → Google Drive.');
      return;
    }
    setError('');
    try {
      await openGoogleDrivePicker({
        apiKey: driveApiKey,
        clientId: driveClientId,
        folderId: driveFolderId || undefined,
        onPick: (url) => {
          setPreview(url);
          onChange(url);
          onFileChange?.(null);
        },
        onError: (err) => setError(err.message),
      });
    } catch (err) {
      setError(err.message || 'Não foi possível abrir o Google Drive');
    }
  };

  const selectDriveFile = (file) => {
    setPreview(file.url);
    onChange(file.url);
    onFileChange?.(null);
    setError('');
  };

  const tabCols = driveEnabled ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      <div className="flex gap-4 items-start">
        <div className={`${previewClassName} rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center shrink-0`}>
          {preview ? (
            <img src={preview} alt="Preview" className="w-full h-full object-contain" onError={() => setPreview('')} />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <Tabs value={mode} onValueChange={setMode} className="w-full">
            <TabsList className={`grid w-full ${tabCols} h-8`}>
              <TabsTrigger value="url" className="text-xs"><Link2 className="h-3 w-3 mr-1" />URL</TabsTrigger>
              <TabsTrigger value="upload" className="text-xs"><Upload className="h-3 w-3 mr-1" />Upload</TabsTrigger>
              {driveEnabled && (
                <TabsTrigger value="drive" className="text-xs"><HardDrive className="h-3 w-3 mr-1" />Drive</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="url" className="mt-2 space-y-2">
              <Input
                placeholder="https://exemplo.com/imagem.jpg"
                value={value?.startsWith('blob:') ? '' : (value || '')}
                onChange={(e) => handleUrlChange(e.target.value)}
                onBlur={(e) => {
                  const n = normalizeImageUrl(e.target.value);
                  if (n && n !== e.target.value) handleUrlChange(n);
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                Cole um link directo (CDN, Unsplash) ou link partilhado do Google Drive — será convertido automaticamente.
              </p>
              {value && !value.startsWith('blob:') && !isPersistableImageUrl(value) && (
                <p className="text-[10px] text-amber-600">URL pode não ser válida para guardar. Use https://...</p>
              )}
            </TabsContent>

            <TabsContent value="upload" className="mt-2 space-y-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Escolher ficheiro
              </Button>
              <p className="text-[10px] text-muted-foreground">O ficheiro será guardado no servidor ao submeter o formulário.</p>
            </TabsContent>

            {driveEnabled && (
              <TabsContent value="drive" className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={!driveClientId}>
                    <HardDrive className="h-4 w-4 mr-1" /> Abrir Google Drive
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={loadDriveGallery} disabled={driveLoading || !driveFolderId}>
                    {driveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ver pasta do sistema'}
                  </Button>
                </div>
                {driveListed && driveFiles.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1 border rounded-lg bg-muted/20">
                    {driveFiles.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        title={f.name}
                        onClick={() => selectDriveFile(f)}
                        className="aspect-square rounded-md overflow-hidden border hover:ring-2 hover:ring-[#0ea5c9] transition-shadow"
                      >
                        <img src={f.thumb} alt={f.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Imagens filtradas da pasta configurada em Integrações. Picker requer Client ID OAuth; galeria requer pasta pública + API key.
                </p>
              </TabsContent>
            )}
          </Tabs>

          {(preview || value) && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-destructive h-7" onClick={clear}>
              <X className="h-3 w-3 mr-1" /> Remover
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#0ea5c9]/5 border border-[#0ea5c9]/15 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 text-[#0ea5c9] shrink-0 mt-0.5" />
        <span>{hint || defaultHint}</span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export async function uploadImageToRecord(collection, recordId, fieldName, file) {
  const formData = new FormData();
  formData.append(fieldName, file);
  return pb.collection(collection).update(recordId, formData);
}

export async function removeImageFromRecord(collection, recordId, fieldName, urlFieldName) {
  const payload = { [fieldName]: null };
  if (urlFieldName) payload[urlFieldName] = '';
  return pb.collection(collection).update(recordId, payload);
}

export async function syncUploadedImageUrl(collection, recordId, fileField, urlField) {
  const rec = await pb.collection(collection).getOne(recordId);
  if (!rec[fileField]) return rec;
  const fileUrl = pb.files.getURL(rec, rec[fileField]);
  return pb.collection(collection).update(recordId, { [urlField]: fileUrl });
}
