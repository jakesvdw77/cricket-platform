import { triggerDownload } from '../triggerDownload'

// Saves a generated file (the result image) through the shared forced-download helper.
export function downloadFile(file: File): void {
  triggerDownload(URL.createObjectURL(file), file.name)
}
