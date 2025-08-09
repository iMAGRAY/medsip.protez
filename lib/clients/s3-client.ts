"use client"

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { ListObjectsV2Command } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { RUNTIME_CONFIG } from '../app-config'
import {
  calculateFileHashClient,
  createFileMetadata,
  generateS3KeyFromHash,
  getFileExtension,
  type FileMetadata,
  type DuplicateFileInfo,
  type DuplicateCheckResult
} from "../file-hash"

// Types for upload results
export interface UploadResult {
  success: boolean
  url?: string
  key?: string
  error?: string
  isDuplicate?: boolean
  existingFile?: DuplicateFileInfo
  fileId?: number
  hash?: string
  requiresUserChoice?: boolean
}

export interface UploadOptions {
  folder?: string
  onProgress?: (progress: number) => void
  checkDuplicates?: boolean
  forceUpload?: boolean
  onDuplicateFound?: (duplicateInfo: DuplicateCheckResult) => Promise<'use-existing' | 'upload-new' | 'cancel'>
}

export class MediaManager {
  private static instance: MediaManager
  private uploadQueue: Map<string, Promise<UploadResult>> = new Map()
  private s3Client: S3Client

  // S3 Configuration from environment variables
  private readonly config = {
    endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_ENDPOINT || "https://s3.twcstorage.ru",
    region: process.env.NEXT_PUBLIC_S3_REGION || process.env.S3_REGION || "ru-1",
    bucket: process.env.NEXT_PUBLIC_S3_BUCKET || process.env.S3_BUCKET || RUNTIME_CONFIG.MEDIA.S3.BUCKET_ID,
    credentials: {
      accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY || process.env.S3_ACCESS_KEY || "IA1BWYIMK9CDTD4H32ZG",
      secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_KEY || process.env.S3_SECRET_KEY || "qDtZCRN0t9WIYxEe2PbA7yfT0wcNlom1dIMHMR4p",
    },
  }

  constructor() {
    // Initialize S3 client
    this.s3Client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: this.config.credentials,
      forcePathStyle: true,
    })
  }

  static getInstance(): MediaManager {
    if (!MediaManager.instance) {
      MediaManager.instance = new MediaManager()
    }
    return MediaManager.instance
  }

  // Generate unique file key
  private generateFileKey(file: File, folder = "products"): string {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const extension = file.name.split(".").pop()
    return `${folder}/${timestamp}-${randomId}.${extension}`
  }

  // Get public URL for a file
  getPublicUrl(key: string): string {
    return `${this.config.endpoint}/${this.config.bucket}/${key}`
  }

  // Get file info from S3
  async getFileInfo(key: string): Promise<{ exists: boolean; size?: number; lastModified?: Date; contentType?: string }> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })

      const response = await this.s3Client.send(command)

      return {
        exists: true,
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
      }
    } catch (error) {
      return { exists: false }
    }
  }

  // List files with prefix
  async listFiles(prefix: string = ""): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
      })

      const response = await this.s3Client.send(command)
      return response.Contents?.map(obj => obj.Key || "") || []
    } catch (error) {

      return []
    }
  }

  // Check for duplicate files
  async checkDuplicate(file: File): Promise<DuplicateCheckResult> {
    try {

      // Calculate file hash
      const hash = await calculateFileHashClient(file)
      const metadata = await createFileMetadata(file, hash)

      // Check in database
      const response = await fetch('/api/media/check-duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hash,
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type
        })
      })

      if (!response.ok) {
        throw new Error(`Duplicate check failed: ${response.status}`)
      }

      const result = await response.json()

      return {
        isDuplicate: result.isDuplicate,
        existingFile: result.existingFile,
        hash,
        metadata
      }
    } catch (error) {

      throw error
    }
  }

  // Register new file in deduplication system
  async registerFile(metadata: FileMetadata, s3Key: string, s3Url: string): Promise<number> {
    try {
      const response = await fetch('/api/media/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hash: metadata.hash,
          originalName: metadata.originalName,
          extension: metadata.extension,
          fileSize: metadata.size,
          mimeType: metadata.mimeType,
          s3Key,
          s3Url,
          width: metadata.width,
          height: metadata.height,
          metadata: {
            uploadedAt: metadata.uploadedAt
          }
        })
      })

      if (!response.ok) {
        throw new Error(`File registration failed: ${response.status}`)
      }

      const result = await response.json()

      if (result.isDuplicate) {

      } else {

      }

      return result.file.id
    } catch (error) {

      throw error
    }
  }

  // Upload file to S3 with deduplication support
  async uploadFile(
    file: File,
    options: UploadOptions | string = {},
    legacyOnProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    // Support legacy signature (file, folder, onProgress)
    let uploadOptions: UploadOptions
    if (typeof options === 'string') {
      const folder = options
      uploadOptions = { folder, onProgress: legacyOnProgress, checkDuplicates: true }
    } else {
      uploadOptions = { folder: "products", checkDuplicates: true, ...options }
    }

    try {
      // Validate file
      if (!file) {
        return { success: false, error: "No file provided" }
      }

      // Check file size (max 10MB)
      if (file.size > RUNTIME_CONFIG.MEDIA.FILE_LIMITS.MAX_FILE_SIZE) {
        return { success: false, error: "File size must be less than 10MB" }
      }

      // Check file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
      if (!allowedTypes.includes(file.type)) {
        return { success: false, error: "Only image files are allowed (JPEG, PNG, WebP, GIF)" }
      }

      // Check for duplicates if enabled
      if (uploadOptions.checkDuplicates && !uploadOptions.forceUpload) {
        const duplicateCheck = await this.checkDuplicate(file)

        if (duplicateCheck.isDuplicate && duplicateCheck.existingFile) {
          if (uploadOptions.onDuplicateFound) {
            const userChoice = await uploadOptions.onDuplicateFound(duplicateCheck)

            if (userChoice === 'cancel') {
              return { success: false, error: "Upload cancelled by user" }
            } else if (userChoice === 'use-existing') {
              return {
                success: true,
                url: duplicateCheck.existingFile.s3_url,
                key: duplicateCheck.existingFile.s3_url.split('/').pop() || '',
                isDuplicate: true,
                existingFile: duplicateCheck.existingFile,
                hash: duplicateCheck.hash
              }
            }
            // If 'upload-new', continue with upload
          } else {
            // Return duplicate info for UI to handle
            return {
              success: false,
              isDuplicate: true,
              existingFile: duplicateCheck.existingFile,
              hash: duplicateCheck.hash,
              requiresUserChoice: true,
              error: "Duplicate file found - user choice required"
            }
          }
        }
      }

      // Generate file key
      let fileKey: string
      if (uploadOptions.checkDuplicates && !uploadOptions.forceUpload) {
        const hash = await calculateFileHashClient(file)
        const extension = getFileExtension(file.name)
        fileKey = generateS3KeyFromHash(hash, extension, uploadOptions.folder)
      } else {
        fileKey = this.generateFileKey(file, uploadOptions.folder)
      }

      // Check if upload is already in progress
      if (this.uploadQueue.has(fileKey)) {
        return await this.uploadQueue.get(fileKey)!
      }

      // Start upload process
      const uploadPromise = this.performUploadWithDeduplication(file, fileKey, uploadOptions)
      this.uploadQueue.set(fileKey, uploadPromise)

      const result = await uploadPromise
      this.uploadQueue.delete(fileKey)

      return result
    } catch (error) {

      return { success: false, error: "Upload failed. Please try again." }
    }
  }

  private async performUploadWithDeduplication(file: File, key: string, options: UploadOptions): Promise<UploadResult> {
    try {
      // Calculate file metadata for registration
      let metadata: FileMetadata | null = null
      if (options.checkDuplicates) {
        const hash = await calculateFileHashClient(file)
        metadata = await createFileMetadata(file, hash)
      }

      // Perform actual upload
      const uploadResult = await this.performUpload(file, key, options.onProgress)

      if (uploadResult.success && metadata && options.checkDuplicates) {
        try {
          // Register file in deduplication system
          const fileId = await this.registerFile(metadata, key, uploadResult.url!)
          uploadResult.fileId = fileId
          uploadResult.hash = metadata.hash
        } catch (error) {

          // Не прерываем загрузку из-за ошибки регистрации
        }
      }

      return uploadResult
    } catch (error) {

      return { success: false, error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  }

  private async performUpload(file: File, key: string, onProgress?: (progress: number) => void): Promise<UploadResult> {
    try {
      // Real S3 upload with progress tracking
      if (onProgress) {
        onProgress(0)
      }

      // -------------------------------------------
      // 🌐 Загрузка через серверный энд-поинт /api/upload
      //   (избегаем CORS-проблем с прямым PUT-коннектом)
      // -------------------------------------------

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = `Upload failed via /api/upload: ${response.status}`

        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = `Upload failed: ${errorData.error}`
            if (errorData.details) {
              errorMessage += ` (${errorData.details})`
            }
          }
        } catch (e) {
          // Fallback if response is not JSON
          const textError = await response.text()
          if (textError) {
            errorMessage += ` - ${textError}`
          }
        }

        console.error(`Upload failed for file ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`, errorMessage)

        throw new Error(errorMessage)
      }

      const data = await response.json()

      if (onProgress) onProgress(100)

      return {
        success: true,
        url: data.url,
        key: data.key,
      }
    } catch (error) {

      return { success: false, error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  }

  // Delete file from S3
  async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })

      await this.s3Client.send(command)

      return true
    } catch (error) {

      return false
    }
  }

  // Get signed URL for private access
  async getSignedUrl(key: string, expiresIn = RUNTIME_CONFIG.MEDIA.S3.SIGNED_URL_EXPIRES): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn })
      return signedUrl
    } catch (error) {

      // Fallback to public URL
      return this.getPublicUrl(key)
    }
  }

  // Batch upload multiple files
  async uploadMultiple(
    files: File[],
    options?: { prefix?: string; onProgress?: (fileIndex: number, progress: number) => void }
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const result = await this.uploadFile(file, options?.prefix || "products", (progress) => {
        if (options?.onProgress) {
          options.onProgress(i, progress)
        }
      })
      results.push(result)
    }

    return results
  }

  // Cleanup method for component unmount
  cleanup() {
    this.uploadQueue.clear()
  }
}

// Export singleton instance for convenience
export const mediaManager = MediaManager.getInstance()
