// A logo as a data URL for jsPDF, or null when it cannot be fetched (a missing or broken logo never blocks a PDF).
export async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export const imageFormatOf = (data: string): 'JPEG' | 'PNG' => (/^data:image\/jpe?g/i.test(data) ? 'JPEG' : 'PNG')
