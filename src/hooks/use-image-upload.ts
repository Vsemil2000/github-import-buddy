import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "user-uploads";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

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

    // Validate file
    if (!file) {
      const err = "Няма избран файл";
      log(`❌ ${err}`);
      setUploadError(err);
      toast.error(err);
      return null;
    }

    log(`📄 Файл избран: ${file.name} (${(file.size / 1024).toFixed(0)} KB, ${file.type})`);

    if (file.size > MAX_SIZE) {
      const err = "Файлът е твърде голям (макс. 10 МБ)";
      log(`❌ ${err}`);
      setUploadError(err);
      toast.error(err);
      return null;
    }

    if (!ALLOWED_TYPES.includes(file.type) && file.type !== "") {
      const err = `Неподдържан формат: ${file.type}. Моля, качете JPEG, PNG или WebP.`;
      log(`❌ ${err}`);
      setUploadError(err);
      toast.error(err);
      return null;
    }

    setUploading(true);
    log("⏳ Четене на файла като base64...");

    try {
      // Step 1: Read as base64 for preview and Edge Functions
      const base64 = await readAsBase64(file);
      log("✅ Base64 готов");

      // Step 2: Upload to Supabase Storage
      log("⏳ Качване в Storage...");

      let storagePath: string | null = null;
      let publicUrl: string | null = null;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id ?? "anonymous";
        const ext = file.name.split(".").pop() || "jpg";
        const uniqueName = `${crypto.randomUUID()}.${ext}`;
        const filePath = `${userId}/${uniqueName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, file, {
            contentType: file.type || "image/jpeg",
            upsert: false,
          });

        if (uploadErr) {
          const errMsg = uploadErr.message || String(uploadErr);
          if (errMsg.includes("Bucket not found")) {
            log(`⚠️ Bucket "${BUCKET}" не съществува. Снимката е заредена локално.`);
          } else if (errMsg.includes("security") || errMsg.includes("policy") || errMsg.includes("permission")) {
            log(`⚠️ Storage permission denied: ${errMsg}`);
          } else {
            log(`⚠️ Upload грешка: ${errMsg}`);
          }
          console.warn("[ImageUpload] Storage upload failed:", uploadErr);
          // Don't block — base64 is still available for Edge Functions
        } else {
          storagePath = uploadData?.path ?? filePath;
          log(`✅ Качено в Storage: ${storagePath}`);

          const { data: urlData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl) {
            publicUrl = urlData.publicUrl;
            log(`✅ Public URL: ${publicUrl}`);
          } else {
            log("⚠️ Не може да се генерира public URL");
          }
        }
      } catch (storageErr: any) {
        log(`⚠️ Storage грешка: ${storageErr.message}`);
        console.warn("[ImageUpload] Storage error:", storageErr);
      }

      const result: UploadResult = {
        base64,
        preview: base64,
        storagePath,
        publicUrl,
      };

      setLastUpload(result);
      setUploading(false);

      if (storagePath) {
        toast.success("Снимката е качена успешно!");
        log("🎉 Upload завършен успешно");
      } else {
        toast.success("Снимката е заредена");
        log("✅ Снимката е заредена (без Storage)");
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
