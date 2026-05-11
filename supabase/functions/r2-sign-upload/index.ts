import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R2 = new S3Client({
  region: "auto",
  endpoint: Deno.env.get("R2_ENDPOINT")!,
  credentials: {
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  },
});

const BUCKET_NAME = Deno.env.get("R2_BUCKET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const { key, contentType } = await req.json();

    if (!key || typeof key !== "string") {
      return json({ error: "Missing key" }, 400);
    }

    if (!key.startsWith("zips/")) {
      return json({ error: "Invalid upload path" }, 400);
    }

    const lowerKey = key.toLowerCase();

    const allowed =
      lowerKey.endsWith(".zip") ||
      lowerKey.endsWith(".rar") ||
      lowerKey.endsWith(".7z") ||
      lowerKey.endsWith(".tar.gz") ||
      lowerKey.endsWith(".tgz");

    if (!allowed) {
      return json({ error: "Only compressed files are allowed" }, 400);
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    const url = await getSignedUrl(R2, command, {
      expiresIn: 300,
    });

    return json({ url, key });
  } catch (err) {
    console.error("[r2-sign-upload] error:", err);
    return json({ error: "Failed to create upload URL" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}