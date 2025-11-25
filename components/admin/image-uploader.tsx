/**
 * Image Uploader Component
 *
 * Features:
 * - Drag-and-drop zone
 * - Click to browse
 * - Image optimization (resize large images to max 1920px, compress to 85%)
 * - Generate markdown: ![alt text](url)
 * - Upload to /public/uploads/news/ or use base64 for small images (<100KB)
 * - Show preview thumbnail
 * - Copy markdown button
 *
 * @example
 * <ImageUploader
 *   onImageInsert={(markdown) => console.log(markdown)}
 *   maxSizeMB={5}
 * />
 */

"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, Copy, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";

interface ImageUploaderProps {
  onImageInsert: (markdownImage: string) => void;
  maxSizeMB?: number;      // Default: 5MB
  acceptedFormats?: string[]; // Default: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
}

interface UploadedImage {
  url: string;
  markdown: string;
  alt: string;
  preview: string;
}

export function ImageUploader({
  onImageInsert,
  maxSizeMB = 5,
  acceptedFormats = ["image/png", "image/jpeg", "image/webp", "image/gif"],
}: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [altText, setAltText] = useState("");
  const [copied, setCopied] = useState(false);

  // Optimize image (resize and compress)
  const optimizeImage = useCallback(
    async (file: File): Promise<{ blob: Blob; isBase64: boolean }> => {
      return new Promise((resolve, reject) => {
        const img = document.createElement("img");
        const reader = new FileReader();

        reader.onload = (e) => {
          img.src = e.target?.result as string;
        };

        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          // Calculate new dimensions (max 1920px width)
          const MAX_WIDTH = 1920;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image"));
                return;
              }

              // Use base64 for small images (<100KB)
              const useBase64 = blob.size < 100 * 1024;
              resolve({ blob, isBase64: useBase64 });
            },
            file.type,
            0.85 // 85% quality
          );
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
    },
    []
  );

  // Upload image to server or convert to base64
  const uploadImage = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);

      try {
        // Validate file type
        if (!acceptedFormats.includes(file.type)) {
          throw new Error(
            `Invalid file type. Accepted formats: ${acceptedFormats.join(", ")}`
          );
        }

        // Validate file size
        if (file.size > maxSizeMB * 1024 * 1024) {
          throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
        }

        // Optimize image
        const { blob, isBase64 } = await optimizeImage(file);

        let imageUrl: string;
        let preview: string;

        if (isBase64) {
          // Convert to base64 for small images
          const reader = new FileReader();
          imageUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(blob);
          });
          preview = imageUrl;
        } else {
          // Upload to server for large images
          const formData = new FormData();
          formData.append("file", blob, file.name);

          const response = await fetch("/api/admin/upload-image", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to upload image");
          }

          const result = await response.json();
          imageUrl = result.url;
          preview = imageUrl;
        }

        // Generate default alt text from filename
        const defaultAlt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setAltText(defaultAlt);

        const markdown = `![${defaultAlt}](${imageUrl})`;

        setUploadedImage({
          url: imageUrl,
          markdown,
          alt: defaultAlt,
          preview,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload image");
      } finally {
        setUploading(false);
      }
    },
    [acceptedFormats, maxSizeMB, optimizeImage]
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      uploadImage(files[0]);
    },
    [uploadImage]
  );

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadImage(e.dataTransfer.files[0]);
      }
    },
    [uploadImage]
  );

  // Update markdown with custom alt text
  const handleAltChange = useCallback(
    (newAlt: string) => {
      setAltText(newAlt);
      if (uploadedImage) {
        const markdown = `![${newAlt}](${uploadedImage.url})`;
        setUploadedImage({ ...uploadedImage, markdown, alt: newAlt });
      }
    },
    [uploadedImage]
  );

  // Insert markdown into editor
  const handleInsert = useCallback(() => {
    if (uploadedImage) {
      onImageInsert(uploadedImage.markdown);
      setUploadedImage(null);
      setAltText("");
    }
  }, [uploadedImage, onImageInsert]);

  // Copy markdown to clipboard
  const handleCopy = useCallback(() => {
    if (uploadedImage) {
      navigator.clipboard.writeText(uploadedImage.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [uploadedImage]);

  // Clear uploaded image
  const handleClear = useCallback(() => {
    setUploadedImage(null);
    setAltText("");
    setError(null);
  }, []);

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {!uploadedImage ? (
          <>
            {/* Upload Zone */}
            <div
              className={cn(
                "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
                uploading && "opacity-50 pointer-events-none"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="image-upload"
                className="sr-only"
                accept={acceptedFormats.join(",")}
                onChange={(e) => handleFileSelect(e.target.files)}
                disabled={uploading}
              />

              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploading and optimizing...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Drag and drop an image here</p>
                    <p className="text-xs text-muted-foreground mt-1">or</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("image-upload")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Files
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Max {maxSizeMB}MB • {acceptedFormats.map((f) => f.split("/")[1].toUpperCase()).join(", ")}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 text-center">{error}</div>
            )}
          </>
        ) : (
          <>
            {/* Preview and Controls */}
            <div className="space-y-4">
              {/* Preview */}
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={uploadedImage.preview}
                  alt={uploadedImage.alt}
                  className="w-full h-full object-contain"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleClear}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Alt Text */}
              <div>
                <Label htmlFor="alt-text">Alt Text (for accessibility)</Label>
                <Input
                  id="alt-text"
                  value={altText}
                  onChange={(e) => handleAltChange(e.target.value)}
                  placeholder="Describe the image"
                />
              </div>

              {/* Markdown Preview */}
              <div>
                <Label>Markdown Code</Label>
                <div className="relative">
                  <Input
                    value={uploadedImage.markdown}
                    readOnly
                    className="font-mono text-xs pr-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button type="button" onClick={handleInsert} className="flex-1">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Insert into Editor
                </Button>
                <Button type="button" variant="outline" onClick={handleClear}>
                  Upload Another
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
