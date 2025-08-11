import React, { useRef, useState } from 'react'

interface ImageUploadProps {
  onImageUpload: (file: File) => void
  isAnalyzing: boolean
  disabled: boolean
}

export function ImageUpload({ onImageUpload, isAnalyzing, disabled }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')

  const validateFile = (file: File): string | null => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file'
    }

    // Validate file size (5MB max to match server limit)
    if (file.size > 5 * 1024 * 1024) {
      return 'Image file must be smaller than 5MB'
    }

    return null
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const error = validateFile(file)
    if (error) {
      alert(error)
      return
    }

    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    // Call the upload handler
    onImageUpload(file)
  }

  const handleClick = () => {
    if (disabled) return
    fileInputRef.current?.click()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    if (disabled) return

    const file = event.dataTransfer.files[0]
    if (!file) return

    const error = validateFile(file)
    if (error) {
      alert(error)
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    onImageUpload(file)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  return (
    <div className="image-upload">
      <div 
        className={`upload-area ${disabled ? 'disabled' : ''}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="upload-icon">📷</div>
        <div className="upload-text">
          {isAnalyzing ? 'Analyzing ingredients...' : 'Upload ingredient photo'}
        </div>
        <div className="upload-hint">
          Click here or drag and drop an image (max 5MB)
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="file-input"
          disabled={disabled}
        />
      </div>
      
      {previewUrl && (
        <img 
          src={previewUrl} 
          alt="Uploaded ingredients" 
          className="uploaded-image"
        />
      )}
    </div>
  )
}