import React, { useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Download, Save, QrCode, Link2, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeGeneratorProps {
  onSaved?: () => void;
}

export function QRCodeGenerator({ onSaved }: QRCodeGeneratorProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [svgData, setSvgData] = useState<string | null>(null);
  const [saveToDatabase, setSaveToDatabase] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const createQRCode = useMutation(api.qrCodes.createQRCode);

  const generateQRCode = useCallback(async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url.trim());
    } catch {
      toast.error('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setIsGenerating(true);
    try {
      const svg = await QRCode.toString(url.trim(), {
        type: 'svg',
        width: 256,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      setSvgData(svg);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  }, [url]);

  const handleSave = useCallback(async () => {
    if (!svgData) {
      toast.error('Generate a QR code first');
      return;
    }

    setIsSaving(true);
    try {
      await createQRCode({
        name: name.trim() || undefined,
        url: url.trim(),
        svgData,
      });
      toast.success('QR code saved');
      // Reset form
      setUrl('');
      setName('');
      setSvgData(null);
      onSaved?.();
    } catch (error) {
      console.error('Error saving QR code:', error);
      toast.error('Failed to save QR code');
    } finally {
      setIsSaving(false);
    }
  }, [svgData, name, url, createQRCode, onSaved]);

  const handleDownload = useCallback((format: 'svg' | 'png') => {
    if (!svgData) return;

    const fileName = name.trim() || 'qr-code';

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
      // Convert SVG to PNG for download
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Create high-resolution canvas (4x for crisp output)
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
              toast.success('PNG downloaded (1024x1024)');
            }
          }, 'image/png');
        }
        URL.revokeObjectURL(svgUrl);
      };

      img.src = svgUrl;
    }
  }, [svgData, name]);

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Generate QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="My QR Code"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this QR code
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              URL
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateQRCode()}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch
                id="save-toggle"
                checked={saveToDatabase}
                onCheckedChange={setSaveToDatabase}
              />
              <Label htmlFor="save-toggle" className="text-sm cursor-pointer">
                Save to my QR codes
              </Label>
            </div>
          </div>

          <Button
            onClick={generateQRCode}
            disabled={isGenerating || !url.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                Generating...
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4 mr-2" />
                Generate QR Code
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {svgData && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center p-4 bg-white rounded-lg border">
              <div
                className="w-64 h-64"
                dangerouslySetInnerHTML={{ __html: svgData }}
              />
            </div>

            <p className="text-xs text-center text-muted-foreground">
              {url}
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => handleDownload('svg')}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download SVG
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload('png')}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PNG
              </Button>
            </div>

            {saveToDatabase && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save QR Code
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
