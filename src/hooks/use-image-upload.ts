import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

const BUCKET = "user-uploads";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const COMPRESS_ABOVE = 4 * 1024 * 1024; // compress if > 4 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const HEIC_TYPES = ["image/heic", "image/heif"];

interface UploadResult {
  base64: string;
  preview: string;
  storagePath: string | null;
  publicUrl: string | null;
}

interface UseImageUploadReturn {
  uploading: boolean;
  uploadError: string | null;
  lastUpload: UploadResult | null;
  handleFileUpload: (file: File) => Promise<UploadResult | null>;
  debugLog: string[];
}

export function useImageUpload(): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const log = (msg: string) => {
    console.log(`[ImageUpload] ${msg}`);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
  };

  const readAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Грешка при четене на файла"));
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (file: File): Promise<UploadResult | null> => {
    setUploadError(null);
    setDebugLog([]);

    if (!file) {
      const err = "Няма избран файл";
      log(`❌ ${err}`);
      setUploadError(err);
      toast.error(err);
      return null;
    }

    const mimeType = file.type || "";
    log(`📄 Файл: ${file.name} | ${(file.size / 1024).toFixed(0)} KB | type="${mimeType}"`);

    // Reject HEIC/HEIF explicitly
    if (HEIC_TYPES.includes(mimeType) || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name)) {
      const err = "Моля, изберете JPG или PNG снимка. HEIC форматът не се поддържа.";
      log(`❌ ${err}`);
      setUploadError(err);
      toast.error(err);
      return null;
    }

    // Allow empty type (common on mobile Telegram) or known types
    if (mimeType && !ALLOWED_TYPES.includes(mimeType)) {
      const err = `Неподдържан формат: ${mimeType}. Моля, изберете JPG или PNG снимка.`;
      log(`❌ ${err}`);
      setUploadError(err);
      toast.error(err);
      return null;
    }

    setUploading(true);

    try {
      // Step 0: Compress if needed
      let processedFile = file;
      if (file.size > COMPRESS_ABOVE) {
        log(`⏳ Компресиране (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);
        try {
          processedFile = await imageCompression(file, {
            maxSizeMB: 3,
            maxWidthOrHeight: 2048,
            useWebWorker: false, // more reliable in Telegram WebApp
            fileType: "image/jpeg",
          });
          log(`✅ Компресирано: ${(processedFile.size / 1024).toFixed(0)} KB`);
        } catch (compErr: any) {
          log(`⚠️ Компресирането неуспешно, използваме оригинала: ${compErr.message}`);
          processedFile = file;
        }
      }

      if (processedFile.size > MAX_SIZE) {
        const err = "Файлът е твърде голям (макс. 10 МБ). Моля, изберете по-малка снимка.";
        log(`❌ ${err}`);
        setUploadError(err);
        setUploading(false);
        toast.error(err);
        return null;
      }

      // Step 1: Read as base64
      log("⏳ Четене като base64...");
      const base64 = await readAsBase64(processedFile);
      log(`✅ Base64 готов (${(base64.length / 1024).toFixed(0)} KB)`);

      // Step 2: Upload to Supabase Storage
      log("⏳ Качване в Storage...");
      let storagePath: string | null = null;
      let publicUrl: string | null = null;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id ?? "anonymous";
        const ext = processedFile.name?.split(".").pop()?.toLowerCase() || "jpg";
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
        const uniqueName = `${crypto.randomUUID()}.${safeExt}`;
        const filePath = `${userId}/${uniqueName}`;

        log(`📂 Path: ${filePath}`);

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, processedFile, {
            contentType: processedFile.type || "image/jpeg",
            upsert: false,
          });

        if (uploadErr) {
          const errMsg = uploadErr.message || String(uploadErr);
          log(`⚠️ Storage: ${errMsg}`);
          console.warn("[ImageUpload] Storage upload failed:", uploadErr);
        } else {
          storagePath = uploadData?.path ?? filePath;
          log(`✅ Storage: ${storagePath}`);

          const { data: urlData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl) {
            publicUrl = urlData.publicUrl;
            log(`✅ URL: ${publicUrl}`);
          }
        }
      } catch (storageErr: any) {
        log(`⚠️ Storage грешка: ${storageErr.message}`);
      }

      const result: UploadResult = { base64, preview: base64, storagePath, publicUrl };
      setLastUpload(result);
      setUploading(false);

      if (storagePath) {
        toast.success("Снимката е качена успешно!");
        log("🎉 Готово (Storage + Base64)");
      } else {
        toast.success("Снимката е заредена");
        log("✅ Готово (само Base64)");
      }

      return result;
    } catch (err: any) {
      const errMsg = err.message || "Неизвестна грешка при качване";
      log(`❌ ${errMsg}`);
      setUploadError(errMsg);
      setUploading(false);
      toast.error(errMsg);
      return null;
    }
  };

  return { uploading, uploadError, lastUpload, handleFileUpload, debugLog };
}
