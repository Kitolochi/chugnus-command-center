import { useState } from 'react'

export function useCodexImagePaste(addFiles: (files: string[]) => void, onError: (error: string) => void) {
  const [pasting, setPasting] = useState(false)
  const onPaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'))
    if (images.length) event.preventDefault()
    setPasting(true)
    try {
      const files: string[] = []
      for (const image of images) {
        const localPath = (image as File & { path?: string }).path
        if (localPath && /\.(png|jpe?g|gif|webp)$/i.test(localPath)) files.push(localPath)
        else files.push(await window.electronAPI.codexSavePastedImage(new Uint8Array(await image.arrayBuffer())))
      }
      if (!images.length) files.push(...(await window.electronAPI.codexPasteImages()))
      if (files.length) addFiles(files)
    } catch (error) {
      onError(String(error))
    } finally {
      setPasting(false)
    }
  }
  return { onPaste, pasting }
}
