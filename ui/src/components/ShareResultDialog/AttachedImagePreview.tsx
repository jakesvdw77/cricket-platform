import { useEffect, useState } from 'react'
import { Box, Skeleton } from '@mui/material'

export interface AttachedImagePreviewProps {
  // The very file that travels with the text (null while it is being generated).
  file: File | null
  alt: string
  radius?: number
}

// Shows the attached result image: an object URL of the same PNG file that is shared, so what is seen is what is sent.
export function AttachedImagePreview({ file, alt, radius = 6 }: AttachedImagePreviewProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(next)
    }
  }, [file])

  if (!url) {
    return <Skeleton variant="rounded" role="img" aria-label="Creating the image" sx={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', borderRadius: `${radius}px` }} />
  }
  return <Box component="img" src={url} alt={alt} sx={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '1 / 1', borderRadius: `${radius}px` }} />
}
