import supabaseDB from "../../config/connectDB";

export class StorageService {
  async generatePresignedUploadUrl(
    bucket: string, 
    key: string, 
    contentType: string, 
    expiresIn: number
  ): Promise<string> {
    const { data, error } = await supabaseDB.storage
      .from(bucket)
      .createSignedUploadUrl(key);

    if (error) {
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }

    return data.signedUrl; // Return only the signed URL as a string
  }

  async generatePresignedDownloadUrl(
    bucket: string, 
    key: string, 
    expiresIn: number
  ): Promise<string> {
    const { data, error } = await supabaseDB.storage
      .from(bucket)
      .createSignedUrl(key, expiresIn);

    if (error) {
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  async fileExists(bucket: string, key: string): Promise<boolean> {
    const { data, error } = await supabaseDB.storage
      .from(bucket)
      .list(key.split('/').slice(0, -1).join('/'), {
        limit: 1,
        search: key.split('/').pop()
      });

    if (error) {
      throw new Error(`Failed to check file existence: ${error.message}`);
    }

    return data.length > 0;
  }

  async deleteFile(bucket: string, key: string): Promise<void> {
    const { error } = await supabaseDB.storage
      .from(bucket)
      .remove([key]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
}