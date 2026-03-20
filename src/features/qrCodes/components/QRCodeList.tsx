import React, { useState, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Download, Trash2, ExternalLink, QrCode, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export function QRCodeList() {
  const qrCodes = useQuery(api.qrCodes.getUserQRCodes);
  const deleteQRCode = useMutation(api.qrCodes.deleteQRCode);
  const [deletingId, setDeletingId] = useState<Id<'qrCodes'> | null>(null);

  const handleDelete = useCallback(async (id: Id<'qrCodes'>) => {
    setDeletingId(id);
    try {
      await deleteQRCode({ id });
      toast.success('QR code deleted');
    } catch (error) {
      console.error('Error deleting QR code:', error);
      toast.error('Failed to delete QR code');
    } finally {
      setDeletingId(null);
    }
  }, [deleteQRCode]);

  const handleDownload = useCallback((svgData: string, name: string, format: 'svg' | 'png') => {
    const fileName = name || 'qr-code';

    if (format === 'svg') {
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${fileName}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      toast.success('SVG downloaded');
    } else {
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const scale = 4;
        const canvas = document.createElement('canvas');
        canvas.width = 256 * scale;
        canvas.height = 256 * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              const pngUrl = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = pngUrl;
              link.download = `${fileName}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(pngUrl);
              toast.success('PNG downloaded');
            }
          }, 'image/png');
        }
        URL.revokeObjectURL(svgUrl);
      };

      img.src = svgUrl;
    }
  }, []);

  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  }, []);

  // Loading state
  if (qrCodes === undefined) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <span>Loading QR codes…</span>
      </div>
    );
  }

  // Empty state
  if (qrCodes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <QrCode className="w-5 h-5" />
            <CardTitle className="text-base font-medium">No saved QR codes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Generate a QR code and save it to see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {qrCodes.map((qrCode) => (
        <Card key={qrCode._id} className="overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="grid gap-4 sm:gap-5 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
              <div className="flex justify-center md:justify-start">
                <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700">
                  <div
                    className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: qrCode.svgData }}
                  />
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white break-words">
                    {qrCode.name}
                  </h3>
                  <a
                    href={qrCode.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-1.5 text-sm text-muted-foreground hover:text-primary"
                  >
                    <span className="min-w-0 break-all">{qrCode.url}</span>
                    <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  </a>
                </div>

                <p className="text-xs text-muted-foreground">
                  Created {formatDistanceToNow(qrCode.createdAt, { addSuffix: true })}
                </p>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => handleCopyUrl(qrCode.url)}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy URL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => handleDownload(qrCode.svgData, qrCode.name, 'svg')}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    SVG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => handleDownload(qrCode.svgData, qrCode.name, 'png')}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    PNG
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 sm:w-auto"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete QR Code</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{qrCode.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(qrCode._id)}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={deletingId === qrCode._id}
                        >
                          {deletingId === qrCode._id ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
