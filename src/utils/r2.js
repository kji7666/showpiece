import { supabase } from "@/supabase";

const getContentType = (file) => {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".rar")) return "application/vnd.rar";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".7z")) return "application/x-7z-compressed";
  if (lower.endsWith(".tar.gz")) return "application/gzip";
  if (lower.endsWith(".tgz")) return "application/gzip";

  return file.type || "application/octet-stream";
};

const sanitizeFileName = (name) => {
  return String(name || "file")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_");
};

export const uploadToR2 = async (file, folder = "zips") => {
  if (!file) {
    throw new Error("沒有選擇檔案");
  }

  const safeName = sanitizeFileName(file.name);
  const key = `${folder}/${Date.now()}-${safeName}`;
  const contentType = getContentType(file);

  console.log("[R2 upload request]", {
    key,
    contentType,
    size: file.size,
  });

  const { data, error } = await supabase.functions.invoke("r2-sign-upload", {
    body: {
      key,
      contentType,
    },
  });

  if (error) {
    console.error("[R2 upload sign error]", error);
    throw new Error(error.message || "取得 R2 上傳連結失敗");
  }

  if (!data?.url) {
    throw new Error("Edge Function 沒有回傳上傳 URL");
  }

  const uploadRes = await fetch(data.url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    console.error("[R2 upload failed]", uploadRes.status, text);
    throw new Error(`R2 上傳失敗：${uploadRes.status}`);
  }

  console.log("[R2 upload success]", key);

  return key;
};

export const getR2DownloadLink = async (key) => {
  if (!key) {
    throw new Error("缺少 R2 檔案路徑");
  }

  console.log("[R2 download request]", key);

  const { data, error } = await supabase.functions.invoke("r2-sign-download", {
    body: { key },
  });

  if (error) {
    console.error("[R2 download sign error]", error);
    throw new Error(error.message || "取得 R2 下載連結失敗");
  }

  if (!data?.url) {
    throw new Error("Edge Function 沒有回傳下載 URL");
  }

  return data.url;
};