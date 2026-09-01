'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Loader2, ZoomIn } from 'lucide-react'

// Featured image convention across the site (see the "Rekomendasi ukuran"
// hint next to the upload button in admin/page.tsx) - 16:9, 1200x675.
const ASPECT_RATIO = 1200 / 675
const OUTPUT_WIDTH = 1200
const OUTPUT_HEIGHT = 675

interface ImageCropDialogProps {
    /** The raw file the user just picked - shown as the crop source. Dialog is open whenever this is non-null. */
    file: File | null
    onClose: () => void
    /** Called with the cropped, still-original-format image (server side converts to WebP, same as before) once the user confirms. */
    onCropComplete: (croppedFile: File) => void
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new window.Image()
        img.addEventListener('load', () => resolve(img))
        img.addEventListener('error', reject)
        img.src = src
    })
}

/** Renders the user's crop selection onto a fixed 1200x675 canvas and returns it as a File, preserving the original mime type so the existing sharp-based WebP conversion server-side is unaffected. */
async function getCroppedFile(imageSrc: string, cropPixels: Area, fileName: string, mimeType: string): Promise<File> {
    const image = await loadImage(imageSrc)
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_WIDTH
    canvas.height = OUTPUT_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')

    ctx.drawImage(
        image,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT
    )

    const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to crop image'))), mimeType, 0.95)
    })

    return new File([blob], fileName, { type: mimeType })
}

/**
 * Crop-before-upload step for the featured image flow (admin/page.tsx's
 * "Upload Gambar dari Komputer" button). Lets the admin drag/zoom the photo
 * within a fixed 16:9 frame so what lands in the article actually matches
 * the site's recommended 1200x675 size, instead of uploading the raw photo
 * as-is (any aspect ratio, any resolution) and hoping it looks right.
 */
export function ImageCropDialog({ file, onClose, onCropComplete }: ImageCropDialogProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [processing, setProcessing] = useState(false)

    // Re-derive the object URL whenever a new file comes in, and revoke the
    // previous one - avoids leaking blob: URLs across repeated opens.
    if (file && !imageSrc) {
        const url = URL.createObjectURL(file)
        setImageSrc(url)
    }

    const handleClose = useCallback(() => {
        if (imageSrc) URL.revokeObjectURL(imageSrc)
        setImageSrc(null)
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setCroppedAreaPixels(null)
        onClose()
    }, [imageSrc, onClose])

    async function handleConfirm() {
        if (!file || !imageSrc || !croppedAreaPixels) return
        setProcessing(true)
        try {
            const cropped = await getCroppedFile(imageSrc, croppedAreaPixels, file.name, file.type || 'image/jpeg')
            onCropComplete(cropped)
            handleClose()
        } catch (err) {
            console.error('Crop failed:', err)
        } finally {
            setProcessing(false)
        }
    }

    return (
        <Dialog open={!!file} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Atur Ukuran Gambar (16:9)</DialogTitle>
                </DialogHeader>

                {imageSrc && (
                    <>
                        <div className="relative w-full h-[400px] bg-muted rounded-lg overflow-hidden">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={ASPECT_RATIO}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Geser gambar untuk memposisikan, gunakan slider untuk memperbesar/memperkecil. Area di dalam kotak yang akan tersimpan sebagai gambar artikel (1200×675px).
                        </p>
                        <div className="flex items-center gap-3">
                            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Slider
                                value={[zoom]}
                                onValueChange={([v]) => setZoom(v)}
                                min={1}
                                max={3}
                                step={0.01}
                                className="flex-1"
                            />
                        </div>
                    </>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleClose} disabled={processing}>
                        Batal
                    </Button>
                    <Button type="button" onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
                        {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Gunakan Gambar Ini
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
